/**
 * 应用基础信息与词条：先展示本地缓存，再异步刷新。
 * 缓存按应用 / API 地址 / 语言隔离；切换上下文或 reset 后忽略旧响应。
 * 页面内容用 appSite，分页列表用 useAppCollection，均不必等待 bootstrap。
 */
import { computed, getCurrentInstance, onMounted, reactive } from 'vue'
import { getGlobalSingleton, getUni } from './global.ts'
import { getHttpConfig } from './request.ts'
import { appSite } from './site.ts'
import type { BootstrapResponse } from './types.ts'

interface BootstrapContext { applicationCode: string; apiBase: string; locale: string }
interface BootstrapStore {
  data: BootstrapResponse | null
  loading: boolean
  error: string | null
  loaded: boolean
  inflight: Promise<BootstrapResponse | null> | null
  hydrated: boolean
  context: BootstrapContext | null
  generation: number
}
interface BootstrapCache extends BootstrapContext { savedAt: number; data: BootstrapResponse }

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000
const store = getGlobalSingleton<BootstrapStore>('__EDP_APP_BOOTSTRAP__', () => reactive({
  data: null, loading: false, error: null, loaded: false, inflight: null,
  hydrated: false, context: null, generation: 0,
}))

function currentContext(): BootstrapContext {
  const config = getHttpConfig()
  return { applicationCode: config.applicationCode ?? '', apiBase: config.baseURL, locale: config.locale ?? '' }
}

function sameContext(a: BootstrapContext | null, b: BootstrapContext): boolean {
  return a?.applicationCode === b.applicationCode && a.apiBase === b.apiBase && a.locale === b.locale
}

function cacheKey(context: BootstrapContext): string {
  return `edp:bootstrap:v1:${encodeURIComponent(context.applicationCode || 'default')}${context.locale ? `:${encodeURIComponent(context.locale)}` : ''}`
}

function readCache(context: BootstrapContext): BootstrapResponse | null {
  try {
    const raw = getUni()?.getStorageSync?.(cacheKey(context))
    const record = (typeof raw === 'string' ? JSON.parse(raw) : raw) as Partial<BootstrapCache> | null
    if (!record || typeof record !== 'object' || !record.data?.site || !record.data.strings) return null
    if (record.applicationCode !== context.applicationCode || record.apiBase !== context.apiBase || (record.locale ?? '') !== context.locale) return null
    if (typeof record.savedAt !== 'number' || Date.now() - record.savedAt > CACHE_TTL_MS) return null
    return record.data
  } catch {
    return null
  }
}

function writeCache(data: BootstrapResponse, context: BootstrapContext): void {
  try {
    getUni()?.setStorageSync?.(cacheKey(context), { ...context, savedAt: Date.now(), data } satisfies BootstrapCache)
  } catch {
    // 缓存不可写不影响请求结果。
  }
}

function clearCache(context: BootstrapContext): void {
  try {
    getUni()?.removeStorageSync?.(cacheKey(context))
  } catch {
    // 存储不可用时仍清理内存。
  }
}

function clearState(): void {
  store.generation++
  store.data = null
  store.loaded = false
  store.loading = false
  store.error = null
  store.inflight = null
  store.hydrated = false
}

function hydrateOnce(): BootstrapContext {
  const context = currentContext()
  if (!sameContext(store.context, context)) {
    clearState()
    store.context = context
  }
  if (!store.hydrated) {
    store.hydrated = true
    store.data = readCache(context)
    // 缓存只负责首帧；不置 loaded，后续仍需请求。
  }
  return context
}

async function load(force = false): Promise<BootstrapResponse | null> {
  const context = hydrateOnce()
  if (store.inflight) return store.inflight
  if (!force && store.loaded && store.data) return store.data
  const generation = store.generation
  const isCurrent = () => store.generation === generation && sameContext(currentContext(), context)
  store.loading = true
  store.error = null
  store.inflight = (async () => {
    try {
      const data = await appSite.bootstrap({}, { custom: { toast: false } })
      if (!isCurrent()) return null
      store.data = data
      store.loaded = true
      writeCache(data, context)
      return data
    } catch (error) {
      if (isCurrent()) store.error = error instanceof Error ? error.message : String(error)
      return null
    } finally {
      if (isCurrent()) {
        store.loading = false
        store.inflight = null
      }
    }
  })()
  return store.inflight
}

/** onLaunch 预取；onShow 可用 force 刷新，首轮在途请求会合并。 */
export function prefetchAppBootstrap(options: { force?: boolean } = {}): void {
  void load(options.force)
}

export function useAppBootstrap(options: { auto?: boolean } = {}) {
  hydrateOnce()
  if (options.auto !== false && getCurrentInstance()) onMounted(() => { void load() })
  return {
    data: computed(() => store.data),
    site: computed(() => store.data?.site ?? null),
    strings: computed(() => store.data?.strings ?? {}),
    loading: computed(() => store.loading),
    error: computed(() => store.error),
    loaded: computed(() => store.loaded),
    reload: () => load(true),
  }
}

/** 清空当前内存和本地缓存，并使已在途的响应失效。 */
export function resetAppBootstrap(): void {
  if (store.context) clearCache(store.context)
  const context = currentContext()
  clearCache(context)
  clearState()
  store.context = context
}
