/** 小程序/H5/APP 的公开业务 API；不依赖网站路由、Host 或 Nuxt。 */
import { getPlatformDevice } from './platform.ts'
import { getHttpConfig, http, type Params, type RequestOptions } from './request.ts'
import type { BootstrapResponse, CategoryTreeResponse, CollectionResponse, FormResponse, PageDataResponse, RecordResponse, SourceItem, SubmitFormResult } from './types.ts'

type ReadOptions = Omit<RequestOptions, 'url' | 'method' | 'params' | 'data'>
export interface LocaleParams { locale?: string }
export interface PageDataParams extends LocaleParams { id?: number | string; [parameter: string]: string | number | undefined }
export interface CategoryTreeParams extends LocaleParams { /** 集合 kind 或路径命名空间：`case-study` / `cases` / `product` / `article` / `gallery`。 */ type: string }
export type CollectionParams = Params & { locale?: string; page?: number; limit?: number; pagination?: 'simple' | 'full' }
export interface SubmitFormOptions extends LocaleParams {
  context?: Record<string, unknown>
  rule_spec_id?: number | null
}

const segment = (value: string | number) => encodeURIComponent(String(value))
const withLocale = (params: Params = {}): Params => ({ locale: getHttpConfig().locale, ...params })

export const appSite = {
  bootstrap(params: LocaleParams = {}, options?: ReadOptions): Promise<BootstrapResponse> {
    return http.get('/site/bootstrap', withLocale({ include: 'site,strings', ...params }), options)
  },
  pageData(code: string, params: PageDataParams = {}, options?: ReadOptions): Promise<PageDataResponse> {
    return http.get(`/site/page-data/${segment(code)}`, withLocale({ device: getPlatformDevice(), ...params }), options)
  },
  collection(kind: string, params: CollectionParams = {}, options?: ReadOptions): Promise<CollectionResponse> {
    return http.get(`/site/collections/${segment(kind)}`, withLocale({ ...params, pagination: params.pagination ?? 'simple' }), options)
  },
  /**
   * 单类型分类树：顶层节点即大分类，`children` 即子类。
   * 列表页（如案例页顶部 tab）据此自建导航，再按分类 id 取集合。
   */
  categories(params: CategoryTreeParams, options?: ReadOptions): Promise<CategoryTreeResponse> {
    return http.get('/site/categories', withLocale({ ...params }), options)
  },
  record(kind: string, id: number | string, params: LocaleParams = {}, options?: ReadOptions): Promise<RecordResponse> {
    return http.get(`/site/records/${segment(kind)}/${segment(id)}`, withLocale({ ...params }), options)
  },
  form(code: string, params: LocaleParams = {}, options?: ReadOptions): Promise<FormResponse> {
    return http.get(`/site/forms/${segment(code)}`, withLocale({ ...params }), options)
  },
  submitForm(code: string, payload: Record<string, unknown>, params: SubmitFormOptions = {}, options?: ReadOptions): Promise<SubmitFormResult> {
    return http.post(`/site/forms/${segment(code)}/submit`, { payload, locale: getHttpConfig().locale, ...params }, options)
  },
}

/** SourceItem.key 是 kind:id，不能直接拿它当详情接口的 id。 */
export function sourceItemId(item: SourceItem): string | null {
  const id = item.values.id
  if ((typeof id === 'number' || typeof id === 'string') && String(id) !== '') return String(id)
  const separator = item.key.indexOf(':')
  return separator >= 0 && separator < item.key.length - 1 ? item.key.slice(separator + 1) : null
}
