import { computed, getCurrentScope, onScopeDispose, ref, shallowRef, toValue, type MaybeRefOrGetter } from 'vue'
import { getHttpConfig } from './request.ts'
import { appSite, type CollectionParams } from './site.ts'
import type { CollectionResponse, SourceItem } from './types.ts'

/** 页面通过 onLoad / onPullDownRefresh / onReachBottom 决定何时加载，不绑定网站路由。 */
export function useAppCollection(kind: string, params: MaybeRefOrGetter<CollectionParams> = {}) {
  const items = shallowRef<SourceItem[]>([])
  const meta = shallowRef<CollectionResponse['meta'] | null>(null)
  const page = ref(0)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const hasMore = ref(true)
  let generation = 0
  let pending: Promise<CollectionResponse | null> | null = null
  let context = ''
  let failedPage: number | null = null

  function identity(): string {
    const config = getHttpConfig()
    return JSON.stringify([config.baseURL, config.applicationCode, config.locale, kind,
      Object.entries(toValue(params)).filter(([key]) => key !== 'page').sort(([a], [b]) => a.localeCompare(b))])
  }

  function ensureContext(): void {
    const next = identity()
    if (context === next) return
    context = next
    generation++
    pending = null
    failedPage = null
    items.value = []
    meta.value = null
    page.value = 0
    hasMore.value = true
    error.value = null
    loading.value = false
  }

  function fetchPage(nextPage: number): Promise<CollectionResponse | null> {
    const currentGeneration = generation
    const currentContext = context
    const query = { ...toValue(params), page: nextPage }
    const isCurrent = () => generation === currentGeneration && identity() === currentContext
    loading.value = true
    error.value = null
    failedPage = null
    pending = (async () => {
      try {
        const data = await appSite.collection(kind, query, { custom: { toast: false } })
        if (!isCurrent()) return null
        const merged = nextPage === 1 ? data.items : [...items.value, ...data.items]
        items.value = [...new Map(merged.map((item) => [item.key, item])).values()]
        meta.value = data.meta
        page.value = data.meta.page ?? nextPage
        hasMore.value = data.meta.has_more ?? (data.meta.total_pages != null
          ? page.value < data.meta.total_pages
          : data.meta.total != null
            ? page.value * (data.meta.per_page ?? query.limit ?? 12) < data.meta.total
            : data.items.length >= (query.limit ?? 12))
        return data
      } catch (cause) {
        if (isCurrent()) {
          error.value = cause instanceof Error ? cause.message : String(cause)
          failedPage = nextPage
        }
        return null
      } finally {
        if (isCurrent()) {
          pending = null
          loading.value = false
        }
      }
    })()
    return pending
  }

  function reload(): Promise<CollectionResponse | null> {
    ensureContext()
    generation++ // 刷新覆盖正在加载的旧分页；同应用已有内容保留到成功返回。
    return fetchPage(1)
  }

  function loadMore(): Promise<CollectionResponse | null> {
    ensureContext()
    if (pending) return pending
    if (failedPage !== null) return fetchPage(failedPage)
    if (!hasMore.value) return Promise.resolve(null)
    return fetchPage(page.value + 1)
  }

  if (getCurrentScope()) onScopeDispose(() => { generation++ })

  return { items, meta, page, loading, error, hasMore, total: computed(() => meta.value?.total ?? items.value.length), reload, loadMore }
}
