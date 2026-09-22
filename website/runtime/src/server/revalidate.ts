/**
 * POST /api/__isr/revalidate —— 站点缓存按需失效（ISR / SWR 的「立即更新」入口）。
 *
 * 协议、签名算法与失效范围见 `lib/revalidate.ts` 顶部说明；两端（Laravel 后端 / 本端点）
 * 共用同一份算法实现，任何一方改动都必须同步。
 *
 * 端点默认关闭：未配置 `NUXT_ISR_REVALIDATE_SECRET`（私有 runtimeConfig
 * `revalidate.secret`，运行期可用 `NUXT_REVALIDATE_SECRET` 覆盖）时返回 404。
 *
 * 文件里的 defineEventHandler / useRuntimeConfig / useStorage / $fetch 等由 Nitro
 * 自动导入（类型声明见同目录 `nitro-globals.d.ts`），因此这里不写 import。
 */
import {
  REVALIDATE_CACHE_GROUP,
  REVALIDATE_TOLERANCE_SECONDS,
  cacheKeyMatchesPath,
  cacheKeyMatchesPrefix,
  expandLocalePaths,
  expandPurgeTargets,
  parseRevalidatePayload,
  resolvePageCodePaths,
  verifyRevalidateSignature,
  type PageCodePaths,
} from '../lib/revalidate.ts'

/** 限流：每 IP 每分钟最多调用次数（清缓存幂等，限流只为挡住滥用）。 */
const THROTTLE_WINDOW_MS = 60_000
const THROTTLE_LIMIT = 60
/** nonce 去重表上限（按时间淘汰，防止内存膨胀）。 */
const NONCE_LIMIT = 5000

const throttleHits = new Map<string, number[]>()
const usedNonces = new Map<string, number>()

function throttleExceeded(ip: string, now: number): boolean {
  const hits = (throttleHits.get(ip) ?? []).filter((at) => now - at < THROTTLE_WINDOW_MS)
  hits.push(now)
  throttleHits.set(ip, hits)
  if (throttleHits.size > 5000) throttleHits.clear()
  return hits.length > THROTTLE_LIMIT
}

/** 返回 true 表示该 nonce 已用过（重放）。 */
function nonceReplayed(nonce: string, now: number): boolean {
  for (const [key, at] of usedNonces) {
    if (now - at > REVALIDATE_TOLERANCE_SECONDS * 1000 * 2) usedNonces.delete(key)
  }
  if (usedNonces.has(nonce)) return true
  if (usedNonces.size >= NONCE_LIMIT) {
    const oldest = usedNonces.keys().next().value
    if (oldest !== undefined) usedNonces.delete(oldest)
  }
  usedNonces.set(nonce, now)
  return false
}

export default defineEventHandler(async (event) => {
  const fail = (status: number, code: string, message: string) => {
    setResponseStatus(event, status)
    return { success: false, error: { code, message } }
  }

  if (event.method !== 'POST') return fail(405, 'METHOD_NOT_ALLOWED', '只接受 POST')

  const config = useRuntimeConfig(event)
  const secret = String(config.revalidate?.secret ?? '')
  const siteCode = String(config.revalidate?.applicationCode ?? config.public?.applicationCode ?? '')
  const localePrefixes: string[] = config.revalidate?.localePrefixes ?? ['en']
  const pageCodePaths = config.revalidate?.pageCodePaths as PageCodePaths | undefined

  // 未配 secret = 该能力未启用：端点对外视为不存在
  if (!secret) return fail(404, 'REVALIDATE_DISABLED', '未启用缓存失效接口')

  const now = Date.now()
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  if (throttleExceeded(ip, now)) return fail(429, 'TOO_MANY_REQUESTS', '调用过于频繁')

  const rawBody = (await readRawBody(event)) ?? ''
  const verified = verifyRevalidateSignature({
    secret,
    rawBody,
    signature: getHeader(event, 'x-edp-signature'),
    timestamp: getHeader(event, 'x-edp-timestamp'),
    nonce: getHeader(event, 'x-edp-nonce'),
  })
  if (!verified.ok) return fail(401, 'UNAUTHORIZED', `签名校验失败：${verified.reason}`)
  if (nonceReplayed(verified.nonce, now)) return fail(401, 'UNAUTHORIZED', '签名校验失败：replayed_nonce')

  let raw: unknown
  try {
    raw = JSON.parse(String(rawBody))
  } catch {
    return fail(400, 'INVALID_BODY', '请求体不是合法 JSON')
  }
  const parsed = parseRevalidatePayload(raw)
  if (!parsed.ok) return fail(400, 'INVALID_BODY', `载荷校验失败：${parsed.reason}`)
  const payload = parsed.payload

  // 跨站重放防护：签名已覆盖整份载荷，这里再校验归属
  if (siteCode && payload.application_code !== siteCode) {
    return fail(403, 'APPLICATION_MISMATCH', 'application_code 与本站不一致')
  }

  const targets = expandPurgeTargets(payload)
  const dependencyPaths = resolvePageCodePaths(payload.pages ?? [], pageCodePaths)
  const exactPaths = expandLocalePaths([...targets.paths, ...dependencyPaths], localePrefixes)
  const prefixes = expandLocalePaths(targets.prefixes, localePrefixes)

  const cache = useStorage('cache')
  const keys: string[] = await cache.getKeys(REVALIDATE_CACHE_GROUP)
  const selected = targets.all
    ? keys
    : keys.filter((key: string) => (
      exactPaths.some((path) => cacheKeyMatchesPath(key, path))
      || prefixes.some((prefix) => cacheKeyMatchesPrefix(key, prefix))
    ))
  for (const key of selected) await cache.removeItem(key)

  return {
    success: true,
    data: {
      scope: payload.scope,
      scanned: keys.length,
      purged: selected.length,
      paths: exactPaths,
      prefixes,
    },
  }
})
