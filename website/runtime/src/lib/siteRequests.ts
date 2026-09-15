/** Request identity and SSR prefetch coordination, independent of Nuxt composable context. */
export interface SitePageDataRoute {
  /** Stable page code, optionally with a route parameter, e.g. about-:slug. */
  code: string
  idParam?: string
  /** Backend ID parameter -> route param or query key (route params take precedence). */
  params?: Record<string, string>
}

interface PageDataPrefetch { code: string; id?: number; params?: PageDataRequest }

export interface PageDataRequest {
  [parameter: string]: string | number | undefined
  locale?: string
  id?: number
  device?: string
}

export function requestLocaleFromPath(path: string): string | undefined {
  const segment = (path.split('/')[1] ?? '').toLowerCase()
  return /^(en|zh|ja|ko|fr|de)$/.test(segment) || /^[a-z]{2,3}-[a-z0-9]{2,8}$/.test(segment)
    ? segment : undefined
}

export const bootstrapKey = (locale?: string) => `web:bootstrap:${locale || 'default'}`
export function pageDataKey(code: string, query: PageDataRequest = {}) {
  const values = { ...query, locale: query.locale || 'default', device: query.device || 'web' }
  // Query strings and their numeric IDs produce the same HTTP request and must share SSR data.
  const canonical = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value == null ? undefined : String(value)]))
  return `web:page-blocks:${code}:${stableQueryKey(canonical)}`
}

export function stableQueryKey(query: Record<string, unknown>): string {
  return JSON.stringify(Object.entries(query)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .sort(([a], [b]) => a.localeCompare(b)))
}

export function resolvePageDataRoute(
  declaration: unknown,
  params: Record<string, unknown>,
  query: Record<string, unknown> = {},
): PageDataPrefetch | null {
  if (!declaration || typeof declaration !== 'object' || !('code' in declaration) || typeof declaration.code !== 'string') return null
  let missing = false
  const code = declaration.code.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, (_, key: string) => {
    const value = params[key]
    if (typeof value !== 'string' || !value) missing = true
    return typeof value === 'string' ? value : ''
  })
  if (missing || !code) return null
  const result: PageDataPrefetch = { code }
  if ('idParam' in declaration && declaration.idParam) {
    if (typeof declaration.idParam !== 'string') return null
    const id = Number(params[declaration.idParam])
    if (!Number.isSafeInteger(id) || id <= 0) return null
    result.id = id
  }
  if ('params' in declaration) {
    const bindings = declaration.params
    if (!bindings || typeof bindings !== 'object' || Array.isArray(bindings)) return null
    result.params = {}
    for (const [target, source] of Object.entries(bindings)) {
      if (typeof source !== 'string' || !/^[a-z][a-z0-9_]*$/.test(target)
        || ['host', 'locale', 'device', 'application_code'].includes(target)) return null
      const value = params[source] ?? query[source]
      if (value === null || value === undefined || value === '') continue
      if (!['string', 'number'].includes(typeof value) || !/^[1-9][0-9]*$/.test(String(value))
        || !Number.isSafeInteger(Number(value))) return null
      result.params[target] = Number(value)
    }
  }
  return result
}

const requests = new WeakMap<object, Map<string, Promise<unknown>>>()

export function sharedSiteRequest<T>(scope: object, key: string, fetcher: () => Promise<T>): Promise<T> {
  let pending = requests.get(scope)
  if (!pending) {
    pending = new Map()
    requests.set(scope, pending)
  }
  const existing = pending.get(key)
  if (existing) return existing as Promise<T>
  const request = Promise.resolve().then(fetcher).finally(() => {
    if (pending.get(key) === request) pending.delete(key)
  })
  pending.set(key, request)
  return request
}

interface PrefetchScope {
  payload: { data: Record<string, unknown> }
}

function prefetch<T>(scope: PrefetchScope, key: string, fetcher: () => Promise<T>): Promise<T> {
  if (scope.payload.data[key] !== undefined) return Promise.resolve(scope.payload.data[key] as T)
  return sharedSiteRequest(scope, key, fetcher).then((data) => {
    scope.payload.data[key] = data
    return data
  })
}

/** Start both requests before waiting; completed data is consumed by useAsyncData and hydration. */
export async function prefetchSiteData<Bootstrap>(
  scope: PrefetchScope,
  client: {
    bootstrap(query: { locale?: string }): Promise<Bootstrap>
    pageData(code: string, query: PageDataRequest): Promise<unknown>
  },
  locale?: string,
  page?: PageDataPrefetch | null,
): Promise<Bootstrap | undefined> {
  const bootstrap = prefetch(scope, bootstrapKey(locale), () => client.bootstrap({ locale }))
  const query = { locale, ...page?.params, ...(page?.id ? { id: page.id } : {}) }
  const pageRequest = page
    ? prefetch(scope, pageDataKey(page.code, query), () => client.pageData(page.code, query))
    : Promise.resolve()
  const [result] = await Promise.allSettled([bootstrap, pageRequest])
  return result.status === 'fulfilled' ? result.value : undefined
}
