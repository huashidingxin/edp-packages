import { SiteClient, type FetchLike } from '@edp/website-ui/client'
import type { BootstrapResponse, CollectionQuery, PageDataQuery, PageDataResponse, CollectionResponse, RecordResponse, CategoryResponse, SubmitFormOptions, SubmitFormResult, LocaleCode, MenuItem, SiteInfo, ThemeInfo, SiteMenus } from '@edp/website-ui/contracts'
import { useLocaleLight } from './useLocaleLight.ts'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useAsyncData, useNuxtApp, useRuntimeConfig } from 'nuxt/app'

/**
 * v2 Site API 封装 — 整页单请求原则。
 *
 * layout 调 useSiteBootstrap()；页面调 useSitePageData({ code })。
 * 整页之后的补充请求（翻页 / 切分类）用 useSiteCollection；
 * 详情补充 useSiteRecord、分类上下文补充 useSiteCategory；
 * 表单提交直接用 submitForm。
 */

export function useSiteClient(): SiteClient {
  const nuxt = useNuxtApp()
  if (!nuxt.$site) {
    // SSR + 客户端容错：fallback 构造
    const config = useRuntimeConfig()
    const apiBase = String(config.apiBase || config.public.apiBase || 'http://127.0.0.1:8787')
    const forceHost = String(config.public.forceHost || '')
    const previewDomain = String(config.public.previewDomain || '')
    const fetcher: FetchLike = async (url, options) => $fetch(url, options as never) as Promise<never>
    const host = forceHost ? forceHost.split(':')[0]! : (import.meta.server ? 'localhost' : window.location.hostname)
    return new SiteClient({ apiBase, host, previewDomain, fetch: fetcher })
  }
  return nuxt.$site as SiteClient
}

const BOOTSTRAP_KEY = 'web:bootstrap'

/**
 * SSR/CSR 同一次渲染内共享 bootstrap promise（按 nuxtApp + key），
 * 避免多个 useT() 组件对同一语言各发一次 bootstrap 请求。
 * useAsyncData 的 getCachedData 只覆盖"已完成的缓存"，不覆盖"进行中"的请求。
 */
const bootstrapPromises = new WeakMap<object, Map<string, Promise<BootstrapResponse | null>>>()

function sharedBootstrap(nuxtApp: object, key: string, fetch: () => Promise<BootstrapResponse>): Promise<BootstrapResponse | null> {
  let perApp = bootstrapPromises.get(nuxtApp)
  if (!perApp) {
    perApp = new Map()
    bootstrapPromises.set(nuxtApp, perApp)
  }
  const existing = perApp.get(key)
  if (existing) return existing
  const promise = fetch().then((data) => data, () => null)
  perApp.set(key, promise)
  return promise
}

export function useSiteBootstrap(opts: { server?: boolean } = {}) {
  const client = useSiteClient()
  const nuxtApp = useNuxtApp()
  const { locale } = useLocaleLight()
  // bootstrap 响应到达后 locale 前缀（/en）才可解析；key 需响应式以重取正确语言
  const key = computed(() => `${BOOTSTRAP_KEY}:${locale.value}`)
  return useAsyncData<BootstrapResponse | null>(
    key,
    () => sharedBootstrap(nuxtApp, key.value, () => client.bootstrap(locale.value ? { locale: locale.value } : {})),
    {
      server: opts.server ?? true,
      default: () => null,
      // SSR 下跨组件共享同 key 结果，避免每个 useT() 组件各发一次 bootstrap 请求。
      // Nuxt 默认 getCachedData 读 static.data（dev/prerender 为空），导致同 key 重复请求。
      getCachedData: (k: string, app: import('nuxt/app').NuxtApp) =>
        app.payload.data[k] as BootstrapResponse | null | undefined,
    },
  )
}

export function useSitePageData(opts: {
  code: MaybeRefOrGetter<string>
  id?: number | null
  locale?: LocaleCode | null
  device?: string
  preview?: boolean
  server?: boolean
}) {
  const client = useSiteClient()
  const { locale } = useLocaleLight()
  const currentLocale = computed<LocaleCode>(() => opts.locale ?? locale.value)
  const code = computed(() => String(toValue(opts.code) ?? ''))
  const key = computed(() => `web:page-data:${code.value}:${opts.id ?? ''}:${currentLocale.value}:${opts.device ?? 'web'}:${opts.preview ? '1' : '0'}`)

  return useAsyncData<PageDataResponse | null>(
    key,
    () => (code.value
      ? client.pageData(code.value, {
          locale: currentLocale.value || undefined,
          id: opts.id ?? undefined,
          device: opts.device,
          preview: opts.preview,
        })
      : Promise.resolve(null)),
    { server: opts.server ?? true, default: () => null },
  )
}

export function useSiteCollection(opts: {
  type: string
  limit?: MaybeRefOrGetter<number>
  page?: MaybeRefOrGetter<number>
  categorySlug?: MaybeRefOrGetter<string | null>
  filters?: MaybeRefOrGetter<Record<string, unknown> | null>
  locale?: LocaleCode | null
  server?: boolean
}) {
  const client = useSiteClient()
  const { locale } = useLocaleLight()
  const currentLocale = opts.locale ?? locale.value
  const categorySlug = computed(() => (opts.categorySlug != null ? toValue(opts.categorySlug) : null) ?? null)
  const limit = computed(() => (opts.limit != null ? Math.max(1, Math.floor(toValue(opts.limit))) : undefined))
  const page = computed(() => (opts.page != null ? Math.max(1, Math.floor(toValue(opts.page))) : undefined))
  const filters = computed(() => toValue(opts.filters) ?? null)
  // 必须保持响应式：key 变化才会触发 useAsyncData 重新拉取（否则切筛选无反应）。
  const filtersKey = computed(() =>
    Object.entries(filters.value ?? {})
      .filter(([, v]) => v !== null && v !== undefined && v !== '')
      .map(([k, v]) => `${k}=${Array.isArray(v) ? v.join(',') : String(v)}`)
      .join('&'),
  )
  const key = computed(() => `web:collection:${opts.type}:${limit.value ?? 12}:${page.value ?? 1}:${categorySlug.value}:${filtersKey}:${currentLocale}`)

  return useAsyncData<CollectionResponse | null>(
    key,
    () => client.collection(opts.type, {
      locale: currentLocale || undefined,
      limit: limit.value,
      page: page.value,
      ...(categorySlug.value ? { category_slug: categorySlug.value } : {}),
      ...(filters.value ?? {}),
    } as CollectionQuery),
    { server: opts.server ?? true, default: () => null },
  )
}

/** GET /api/v2/site/records/{type}/{id} — 详情页补充请求（含 category 上下文）。 */
export function useSiteRecord(opts: {
  type: string
  id?: MaybeRefOrGetter<number | null>
  locale?: LocaleCode | null
  server?: boolean
}) {
  const client = useSiteClient()
  const { locale } = useLocaleLight()
  const currentLocale = opts.locale ?? locale.value
  const id = computed(() => toValue(opts.id) ?? null)
  const key = computed(() => `web:record:${opts.type}:${id.value ?? ''}:${currentLocale}`)

  return useAsyncData<RecordResponse | null>(
    key,
    () => (id.value ? client.record(opts.type, id.value, { locale: currentLocale || undefined }) : Promise.resolve(null)),
    { server: opts.server ?? true, default: () => null },
  )
}

/** GET /api/v2/site/category — 分类上下文（sidebar/breadcrumbs/seo）。 */
export function useSiteCategory(opts: {
  path?: MaybeRefOrGetter<string | null>
  categoryId?: MaybeRefOrGetter<number | null>
  locale?: LocaleCode | null
  server?: boolean
}) {
  const client = useSiteClient()
  const { locale } = useLocaleLight()
  const currentLocale = opts.locale ?? locale.value
  const path = computed(() => (opts.path != null ? toValue(opts.path) : null) ?? null)
  const categoryId = computed(() => (opts.categoryId != null ? toValue(opts.categoryId) : null) ?? null)
  const key = computed(() => `web:category:${path.value ?? ''}:${categoryId.value ?? ''}:${currentLocale}`)

  return useAsyncData<CategoryResponse | null>(
    key,
    () => ((path.value || categoryId.value)
      ? client.category({
          ...(path.value ? { path: path.value } : {}),
          ...(categoryId.value ? { category_id: categoryId.value } : {}),
          locale: currentLocale || undefined,
        })
      : Promise.resolve(null)),
    { server: opts.server ?? true, default: () => null },
  )
}

export async function submitForm(code: string, payload: Record<string, unknown>, opts: SubmitFormOptions = {}): Promise<SubmitFormResult> {
  const client = useSiteClient()
  const { locale } = useLocaleLight()
  return client.submitForm(code, payload, { ...opts, ...(opts.locale ? {} : locale.value ? { locale: locale.value } : {}) })
}

/* ---------- bootstrap-derived 工具派生 ---------- */

export function useBootstrapSite(): import('vue').ComputedRef<Pick<SiteInfo, 'name' | 'branding' | 'default_locale' | 'enabled_locales' | 'locales' | 'application_id' | 'tenant_id'>> {
  const { data } = useSiteBootstrap()
  return computed(() => {
    const site = (data.value as BootstrapResponse | null)?.site
    if (!site) {
      return {
        name: '',
        branding: { logo: null, logo_alt: '', favicon: null, show_name: true, copyright: null },
        default_locale: 'zh-CN',
        enabled_locales: [],
        locales: [],
        application_id: 0,
        tenant_id: 0,
      } as Pick<SiteInfo, 'name' | 'branding' | 'default_locale' | 'enabled_locales' | 'locales' | 'application_id' | 'tenant_id'>
    }
    return site
  })
}

export function useBootstrapMenus(): import('vue').ComputedRef<SiteMenus> {
  const { data } = useSiteBootstrap()
  return computed(() => (data.value as BootstrapResponse | null)?.menus ?? { header: [], footer: [] })
}

export function useBootstrapTheme(): import('vue').ComputedRef<ThemeInfo | null> {
  const { data } = useSiteBootstrap()
  return computed(() => (data.value as BootstrapResponse | null)?.theme ?? null)
}

/** UI 词条表（bootstrap.strings，按当前语言，缺译回退默认语言）。 */
export function useBootstrapStrings(): import('vue').ComputedRef<Record<string, string>> {
  const { data } = useSiteBootstrap()
  return computed(() => (data.value as BootstrapResponse | null)?.strings ?? {})
}

export type { MenuItem, CollectionResponse, PageDataResponse, RecordResponse, CategoryResponse }
