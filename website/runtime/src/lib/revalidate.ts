/**
 * 站点缓存按需失效（ISR revalidate）—— 纯逻辑（node:test），前后端共用同一份算法。
 *
 * 场景：全站走运行时缓存渲染（`website.rendering.default = 'swr'`）后，内容一改就要
 * 让相关页面立刻重新渲染。后端（Laravel）在保存/发布内容后调用站点 Node 服务上的
 * `POST /api/__isr/revalidate`，由站点侧清掉对应页面的缓存条目。
 *
 * 鉴权：HMAC-SHA256 签名（不是明文 token），两端算法完全一致：
 *
 *   canonical = METHOD + "\n" + PATH + "\n" + timestamp + "\n" + nonce + "\n" + sha256hex(rawBody)
 *   signature = hex(hmac_sha256(secret, canonical))
 *
 *   请求头：x-edp-timestamp（Unix 秒）、x-edp-nonce（随机 hex）、x-edp-signature
 *
 * 校验顺序（任何一步失败即拒绝，且**先验签再消费 nonce**，避免未签名流量污染 nonce 表）：
 *   1. 未配置 secret → 端点视为不存在（404）
 *   2. 头缺失 / 时间戳超出容差（默认 300s）→ 401
 *   3. 签名常数时间比较 → 401
 *   4. nonce 未使用过（窗口内去重）→ 401
 *   5. 载荷里的 application_code 必须等于本站身份 → 403（防跨站重放）
 *
 * 载荷（`application_code` 必填，其余按 scope 取用）：
 *
 *   { application_code, scope: 'record' | 'model' | 'site',
 *     type?, id?, category?, pages?: string[], paths?: string[] }
 *
 * 失效范围由「约定映射 + 依赖清单」两层拼出（见 expandPurgeTargets 注释），
 * 匹配缓存条目时依赖 Nitro 的键格式：`nitro/routes:_:<路径前16个词字符>.<url hash>.json`。
 */
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { LOCALE_PREFIX_RE } from './locale.ts';

/** 站点侧端点路径（前后端共用常量）。 */
export const REVALIDATE_ROUTE = '/api/__isr/revalidate';
/** 时间戳容差（秒）。 */
export const REVALIDATE_TOLERANCE_SECONDS = 300;
/** 单次请求最多接受的自定义路径数（防滥用）。 */
export const REVALIDATE_MAX_PATHS = 200;
/** Nitro 路由缓存的存储组名（runtime 内部 app 侧 `cachedEventHandler({ group })`）。 */
export const REVALIDATE_CACHE_GROUP = 'nitro/routes';

/**
 * 内容模型 → 站点区段路径（只含平台有标准列表/详情路由的模型）。
 *
 * 键以后端 `ContentPublicationService::typeMap()` / `website_registry.sources` 的
 * 真实 type 为准（`gallery-item` / `case-study` / `team-member`）；同时保留部分
 * 前端模板里出现过的短名（`case` / `team` / `gallery`）作为兼容别名。
 */
export const TYPE_SECTIONS: Record<string, string> = {
  article: 'articles',
  product: 'products',
  'gallery-item': 'gallery',
  gallery: 'gallery',
  'case-study': 'cases',
  case: 'cases',
  job: 'jobs',
  'team-member': 'team',
  team: 'team',
};

export type RevalidateScope = 'record' | 'model' | 'site';

export interface RevalidatePayload {
  application_code: string;
  scope: RevalidateScope;
  type?: string;
  id?: number;
  category?: string;
  /** 引用了该模型的 page-data 页面 code（后端按 blocks schema 推导）。 */
  pages?: string[];
  /** 精确路径（逻辑路径，不带语言前缀），如 `['/', '/articles/qiyexinwen']`。 */
  paths?: string[];
}

export interface PurgeTargets {
  /** 需要精确清除的逻辑路径（不含语言前缀）。 */
  paths: string[];
  /** 需要按前缀清除的区段路径（模型级）。 */
  prefixes: string[];
  /** 全站清空。 */
  all: boolean;
}

/** 构建期算出的 page code → 路由路径映射（含动态段模式）。 */
export interface PageCodePaths {
  exact: Record<string, string>;
  patterns: Array<{ codePrefix: string; pathPrefix: string }>;
}

export type ParseResult =
  | { ok: true; payload: RevalidatePayload }
  | { ok: false; reason: string };

const SCOPES: RevalidateScope[] = ['record', 'model', 'site'];

/** 校验并归一化请求载荷（只做结构与取值域校验，application_code 归属由调用方比对）。 */
export function parseRevalidatePayload(raw: unknown, maxPaths = REVALIDATE_MAX_PATHS): ParseResult {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, reason: 'invalid_body' };
  const input = raw as Record<string, unknown>;

  const applicationCode = String(input.application_code ?? '').trim();
  if (!applicationCode) return { ok: false, reason: 'missing_application_code' };

  const scopeRaw = input.scope === undefined ? 'record' : String(input.scope);
  if (!SCOPES.includes(scopeRaw as RevalidateScope)) return { ok: false, reason: 'invalid_scope' };
  const scope = scopeRaw as RevalidateScope;

  const type = input.type === undefined || input.type === null ? undefined : String(input.type).trim();
  if (scope !== 'site' && !type) return { ok: false, reason: 'missing_type' };

  let id: number | undefined;
  if (input.id !== undefined && input.id !== null && input.id !== '') {
    id = Number(input.id);
    if (!Number.isInteger(id) || id <= 0) return { ok: false, reason: 'invalid_id' };
  }
  if (scope === 'record' && id === undefined && !Array.isArray(input.paths) && !input.category) {
    return { ok: false, reason: 'missing_target' };
  }

  const category = input.category === undefined || input.category === null ? undefined : String(input.category).trim() || undefined;

  const rawPaths = input.paths === undefined ? [] : input.paths;
  if (!Array.isArray(rawPaths)) return { ok: false, reason: 'invalid_paths' };
  const paths = rawPaths.map((p) => normalizeLogicalPath(p)).filter((p): p is string => p !== null);
  if (paths.length !== rawPaths.length) return { ok: false, reason: 'invalid_paths' };
  if (paths.length > maxPaths) return { ok: false, reason: 'too_many_paths' };

  const rawPages = input.pages === undefined ? [] : input.pages;
  if (!Array.isArray(rawPages)) return { ok: false, reason: 'invalid_pages' };
  const pages = rawPages.map((p) => String(p ?? '').trim()).filter(Boolean);
  if (pages.length > maxPaths) return { ok: false, reason: 'too_many_pages' };

  return {
    ok: true,
    payload: {
      application_code: applicationCode,
      scope,
      ...(type ? { type } : {}),
      ...(id !== undefined ? { id } : {}),
      ...(category ? { category } : {}),
      ...(pages.length > 0 ? { pages } : {}),
      ...(paths.length > 0 ? { paths } : {}),
    },
  };
}

/** 逻辑路径归一化：必须是 `/` 开头的站内路径，去掉语言前缀、查询串与尾部斜杠。 */
export function normalizeLogicalPath(input: unknown): string | null {
  const value = String(input ?? '').trim();
  if (!value.startsWith('/')) return null;
  if (value.startsWith('//')) return null;
  const clean = value.split('?')[0]?.split('#')[0] ?? '';
  // 后端按约定只发逻辑路径；这里做一次幂等归一，避免带语言前缀时重复失效
  const logical = clean.replace(LOCALE_PREFIX_RE, '/');
  const trimmed = logical.replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed;
}

/**
 * 区段级失效的「约定映射」：一条记录的增删改会影响哪些页面。
 *
 * - 固定页（精确匹配）：首页 `/`、区段入口 `/{section}`、详情 `/{section}/{id}`、栏目 `/{section}/{category}`
 * - 分页族（前缀匹配）：栏目 `/{section}/{category}`（覆盖其全部分页）、总览分页 `/{section}/page/{n}`
 *
 * 分页**不做页数枚举**：一是页数取决于站点每页条数（反查 `total_pages` 会被 `limit` 带偏），
 * 二是新增/删除会让后续所有页位移，按前缀一次清干净更可靠（缓存键的路径片段最多 16 字符，
 * 前缀比较天然覆盖同族路径，代价只是可能多清一两条）。
 *
 * 「依赖清单」（`payload.pages` 经 page code → 路径映射）由调用方追加，见 resolvePageCodePaths；
 * `payload.paths` 为精确补充。
 */
export function expandPurgeTargets(payload: RevalidatePayload): PurgeTargets {
  if (payload.scope === 'site') return { paths: [], prefixes: [], all: true };

  const section = payload.type ? TYPE_SECTIONS[payload.type] ?? null : null;
  if (payload.scope === 'model') {
    // 模型级：该区段全部页面（详情 id 无法枚举，按前缀清）
    return { paths: [], prefixes: section ? [`/${section}`] : [], all: !section };
  }

  const paths = new Set<string>(['/']);
  const prefixes = new Set<string>();
  if (section) {
    paths.add(`/${section}`);
    if (payload.id !== undefined) paths.add(`/${section}/${payload.id}`);
    if (payload.category) {
      paths.add(`/${section}/${payload.category}`);
      // 栏目分页族 + 该区段的总览分页族
      prefixes.add(`/${section}/${payload.category}`);
      prefixes.add(`/${section}/page`);
    } else {
      // 没有栏目信息时无法定位具体列表：整段失效（宁可多清）
      prefixes.add(`/${section}`);
    }
  }
  for (const path of payload.paths ?? []) paths.add(path);

  return { paths: [...paths].sort(), prefixes: [...prefixes].sort(), all: false };
}

/** page code → 路径（精确表 + 动态段模式，如 `about-:slug` → `/about/{slug}`）。 */
export function resolvePageCodePaths(pages: readonly string[], map: PageCodePaths | undefined): string[] {
  if (!map) return [];
  const resolved: string[] = [];
  for (const code of pages) {
    const exact = map.exact[code];
    if (exact) {
      resolved.push(exact);
      continue;
    }
    for (const pattern of map.patterns) {
      if (!code.startsWith(pattern.codePrefix)) continue;
      const rest = code.slice(pattern.codePrefix.length);
      if (!rest || rest.includes('/')) continue;
      resolved.push(`${pattern.pathPrefix}${rest}`.replace(/\/{2,}/g, '/'));
      break;
    }
  }
  return resolved;
}

/** 逻辑路径 × 语言前缀（默认语言无前缀）→ 真实 URL 列表。 */
export function expandLocalePaths(paths: readonly string[], localePrefixes: readonly string[]): string[] {
  const prefixes = [...new Set(localePrefixes.map((p) => String(p).replace(/^\/+|\/+$/g, '').toLowerCase()).filter(Boolean))];
  const out = new Set<string>();
  for (const path of paths) {
    out.add(path);
    for (const prefix of prefixes) out.add(path === '/' ? `/${prefix}` : `/${prefix}${path}`);
  }
  return [...out];
}

/** canonical 字符串（两端必须逐字节一致）。 */
export function buildRevalidateCanonical(input: {
  method?: string;
  path?: string;
  timestamp: string | number;
  nonce: string;
  bodyHash: string;
}): string {
  const method = String(input.method ?? 'POST').toUpperCase();
  const path = String(input.path ?? REVALIDATE_ROUTE);
  return [method, path, String(input.timestamp), String(input.nonce), input.bodyHash].join('\n');
}

/** 原始请求体 → sha256 hex（两端一致）。 */
export function sha256Hex(input: string | Uint8Array): string {
  return createHash('sha256').update(input).digest('hex');
}

/** 生成签名（后端侧调用、单测、联调自检共用）。 */
export function signRevalidateRequest(input: {
  secret: string;
  rawBody: string | Uint8Array;
  timestamp: string | number;
  nonce: string;
  method?: string;
  path?: string;
}): string {
  const canonical = buildRevalidateCanonical({
    method: input.method,
    path: input.path,
    timestamp: input.timestamp,
    nonce: input.nonce,
    bodyHash: sha256Hex(input.rawBody),
  });
  return createHmac('sha256', input.secret).update(canonical).digest('hex');
}

export type VerifyResult = { ok: true; nonce: string } | { ok: false; reason: string };

/**
 * 校验签名（不做 nonce 去重——去重需要存储，由调用方在验签通过后执行）。
 */
export function verifyRevalidateSignature(input: {
  secret: string;
  rawBody: string | Uint8Array;
  signature?: string | null;
  timestamp?: string | null;
  nonce?: string | null;
  method?: string;
  path?: string;
  now?: number;
  toleranceSeconds?: number;
}): VerifyResult {
  const signature = String(input.signature ?? '').trim().toLowerCase();
  const timestamp = String(input.timestamp ?? '').trim();
  const nonce = String(input.nonce ?? '').trim();
  if (!signature || !timestamp || !nonce) return { ok: false, reason: 'missing_signature' };
  if (!/^[0-9a-f]{64}$/.test(signature)) return { ok: false, reason: 'malformed_signature' };
  if (!/^[0-9a-f]{16,64}$/i.test(nonce)) return { ok: false, reason: 'malformed_nonce' };

  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds)) return { ok: false, reason: 'malformed_timestamp' };
  const now = Math.floor(input.now ?? Date.now() / 1000);
  const tolerance = input.toleranceSeconds ?? REVALIDATE_TOLERANCE_SECONDS;
  if (Math.abs(now - seconds) > tolerance) return { ok: false, reason: 'stale_timestamp' };

  const expected = signRevalidateRequest({
    secret: input.secret,
    rawBody: input.rawBody,
    timestamp,
    nonce,
    method: input.method,
    path: input.path,
  });
  if (!timingSafeEqualHex(expected, signature)) return { ok: false, reason: 'invalid_signature' };
  return { ok: true, nonce };
}

function timingSafeEqualHex(a: string, b: string): boolean {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  if (left.length === 0 || left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * 复刻 Nitro 的路径片段：`escapeKey(decodeURI(pathname)).slice(0, 16) || 'index'`
 * （见 nitropack `runtime/internal/cache.mjs` 的 `defineCachedEventHandler.getKey`）。
 */
export function cachePathSegment(path: string): string {
  const pathname = path.split('?')[0] ?? '/';
  let decoded = pathname;
  try {
    decoded = decodeURI(pathname);
  } catch {
    /* 解码失败按原文处理 */
  }
  return decoded.replace(/\W/g, '').slice(0, 16) || 'index';
}

/** 从 Nitro 缓存键里取出 `<路径片段>.<url hash>.json` 部分。 */
function cacheKeyTail(key: string): string {
  const marker = key.indexOf(':_:');
  return marker === -1 ? key : key.slice(marker + 3);
}

/** 缓存键是否属于某条逻辑路径（含该路径的查询串变体）。 */
export function cacheKeyMatchesPath(key: string, logicalPath: string): boolean {
  const tail = cacheKeyTail(key);
  const segment = cachePathSegment(logicalPath);
  // `segment.` 与 `segment` 全等分别覆盖「有/无 hash」两种键形态
  return tail === segment || tail.startsWith(`${segment}.`) || tail.startsWith(`${segment}:`);
}

/** 缓存键是否落在某个区段前缀下（模型级失效）。 */
export function cacheKeyMatchesPrefix(key: string, pathPrefix: string): boolean {
  const tail = cacheKeyTail(key);
  const segment = cachePathSegment(pathPrefix);
  // 路径片段最多 16 字符，按前缀比较（宁可多清，不可漏清）
  return tail.startsWith(segment);
}
