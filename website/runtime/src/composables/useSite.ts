import { SiteClient, type FetchLike } from '@edp/website-ui/client'
import type { BootstrapResponse, CollectionQuery, PageDataQuery, PageDataResponse, CollectionResponse, RecordResponse, CategoryResponse, SubmitFormOptions, SubmitFormResult, LocaleCode, MenuItem, SiteInfo, ThemeInfo, SiteMenus } from '@edp/website-ui/contracts'
import { useLocaleLight } from './useLocaleLight.ts'
import { computed, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { useAsyncData, useNuxtApp, useRuntimeConfig, useState, type NuxtApp } from 'nuxt/app'
import { bootstrapKey, pageDataKey, sharedSiteRequest, stableQueryKey } from '../lib/siteRequests.ts'
import { loadImageCategory } from '../lib/imageCategory.ts'

/** Layout reads bootstrap; pages read page-data; lists/details request additional data on demand. */
export function useSiteClient(): SiteClient {
  const nuxt = useNuxtApp()
  if (!nuxt.$site) {
    const config = useRuntimeConfig()
    const apiBase = String(config.apiBase || config.public.apiBase || 'http://127.0.0.1:8787')
    const applicationCode = String(config.public.applicationCode || '')
    const fetcher: FetchLike = async (url, options) => $fetch(url, options as never) as Promise<never>
    // host 回退真实请求 Host；applicationCode 已锁定应用，forceHost 已废弃
    const host = import.meta.server ? 'localhost' : window.location.hostname
    return new SiteClient({ apiBase, host, applicationCode, fetch: fetcher })
  }
  return nuxt.$site as SiteClient
}

// SSR prefetch and hydration may reuse payload data. Explicit refreshes must reach the API.
function payloadData<T>(key: string, app: NuxtApp, context: { cause: string }): T | undefined {
  return context.cause === 'initial' ? app.payload.data[key] as T | undefined : undefined
}

export function useSiteBootstrap(opts: { server?: boolean } = {}) {
  const client = useSiteClient()
  const nuxtApp = useNuxtApp()
  const state = useState<BootstrapResponse | null>('web:bootstrap:data', () => null)
  const { requestLocale } = useLocaleLight()
  const key = computed(() => bootstrapKey(requestLocale.value))
  const result = useAsyncData<BootstrapResponse | null>(
    key,
    () => {
      const locale = requestLocale.value
      return sharedSiteRequest(nuxtApp, bootstrapKey(locale), () => client.bootstrap({ locale }))
    },
    { server: opts.server ?? true, default: () => null, dedupe: 'defer', getCachedData: payloadData },
  )
  watch(result.data, (data) => { if (data) state.value = data }, { immediate: true })
  return result
}

export function useSitePageData(opts: {
  code: MaybeRefOrGetter<string>
  params?: MaybeRefOrGetter<Record<string, number | string | undefined>>
  id?: MaybeRefOrGetter<number | null>
  locale?: MaybeRefOrGetter<LocaleCode | null>
  device?: string
  server?: boolean
}) {
  const client = useSiteClient()
  const nuxtApp = useNuxtApp()
  const { requestLocale } = useLocaleLight()
  const code = computed(() => String(toValue(opts.code) ?? ''))
  const query = computed<PageDataQuery>(() => ({
    ...(toValue(opts.params) ?? {}),
    locale: toValue(opts.locale) ?? requestLocale.value,
    ...(opts.id !== undefined ? { id: toValue(opts.id) ?? undefined } : {}),
    device: opts.device,
  }))
  const key = computed(() => pageDataKey(code.value, query.value))
  return useAsyncData<PageDataResponse | null>(
    key,
    () => {
      const pageCode = code.value
      const params = query.value
      return pageCode
        ? sharedSiteRequest(nuxtApp, pageDataKey(pageCode, params), () => client.pageData(pageCode, params))
        : Promise.resolve(null)
    },
    { server: opts.server ?? true, default: () => null, dedupe: 'defer', getCachedData: payloadData },
  )
}

export function useSiteCollection(opts: {
  type: string
  limit?: MaybeRefOrGetter<number>
  page?: MaybeRefOrGetter<number>
  categorySlug?: MaybeRefOrGetter<string | null>
  filters?: MaybeRefOrGetter<Record<string, unknown> | null>
  locale?: MaybeRefOrGetter<LocaleCode | null>
  server?: boolean
}) {
  const client = useSiteClient()
  const { requestLocale } = useLocaleLight()
  const query = computed<CollectionQuery>(() => ({
    ...(toValue(opts.filters) ?? {}),
    locale: toValue(opts.locale) ?? requestLocale.value,
    ...(opts.limit != null ? { limit: Math.max(1, Math.floor(toValue(opts.limit))) } : {}),
    ...(opts.page != null ? { page: Math.max(1, Math.floor(toValue(opts.page))) } : {}),
    ...(toValue(opts.categorySlug) ? { category_slug: toValue(opts.categorySlug)! } : {}),
  }))
  const key = computed(() => `web:collection:${opts.type}:${stableQueryKey(query.value)}`)
  return useAsyncData<CollectionResponse | null>(
    key, () => client.collection(opts.type, query.value),
    { server: opts.server ?? true, default: () => null, dedupe: 'defer' },
  )
}

export function useSiteRecord(opts: {
  type: string
  id?: MaybeRefOrGetter<number | null>
  locale?: MaybeRefOrGetter<LocaleCode | null>
  server?: boolean
}) {
  const client = useSiteClient()
  const { requestLocale } = useLocaleLight()
  const currentLocale = computed(() => toValue(opts.locale) ?? requestLocale.value)
  const id = computed(() => toValue(opts.id) ?? null)
  const key = computed(() => `web:record:${opts.type}:${id.value ?? ''}:${currentLocale.value ?? 'default'}`)
  return useAsyncData<RecordResponse | null>(
    key,
    () => id.value ? client.record(opts.type, id.value, { locale: currentLocale.value }) : Promise.resolve(null),
    { server: opts.server ?? true, default: () => null, dedupe: 'defer' },
  )
}

export function useSiteCategory(opts: {
  path?: MaybeRefOrGetter<string | null>
  categoryId?: MaybeRefOrGetter<number | null>
  locale?: MaybeRefOrGetter<LocaleCode | null>
  server?: boolean
}) {
  const client = useSiteClient()
  const { requestLocale } = useLocaleLight()
  const currentLocale = computed(() => toValue(opts.locale) ?? requestLocale.value)
  const path = computed(() => toValue(opts.path) ?? null)
  const categoryId = computed(() => toValue(opts.categoryId) ?? null)
  const key = computed(() => `web:category:${path.value ?? ''}:${categoryId.value ?? ''}:${currentLocale.value ?? 'default'}`)
  return useAsyncData<CategoryResponse | null>(
    key,
    () => (path.value || categoryId.value)
      ? client.category({
          ...(path.value ? { path: path.value } : {}),
          ...(categoryId.value ? { category_id: categoryId.value } : {}),
          locale: currentLocale.value,
        })
      : Promise.resolve(null),
    { server: opts.server ?? true, default: () => null, dedupe: 'defer' },
  )
}

export function useSiteImageCategory(path: MaybeRefOrGetter<string>) {
  const client = useSiteClient()
  const { requestLocale } = useLocaleLight()
  const key = computed(() => `web:image-category:${toValue(path)}:${requestLocale.value ?? 'default'}`)
  return useAsyncData(key, () => loadImageCategory(client, toValue(path), requestLocale.value), {
    default: () => null, dedupe: 'defer', getCachedData: payloadData,
  })
}

export async function submitForm(code: string, payload: Record<string, unknown>, opts: SubmitFormOptions = {}): Promise<SubmitFormResult> {
  const client = useSiteClient()
  const { requestLocale } = useLocaleLight()
  return client.submitForm(code, payload, { ...opts, locale: opts.locale ?? requestLocale.value })
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
