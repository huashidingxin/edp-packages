/**
 * `/api/v1` 消费侧类型（只保留实际用到的形状）。
 *
 * 与后端公开契约对齐，不从 website UI 引入运行时依赖。
 * 页面自己的 blocks 字段由应用扩展，公共包只声明 API 的稳定外壳。
 */

/** 统一响应包络。 */
export interface ApiEnvelope<T = unknown> {
  success: boolean
  data?: T
  error?: { code: string; message: string; details?: unknown }
}

export interface SiteContact {
  phone?: string | null
  email?: string | null
  address?: string | null
  company?: string | null
  icp?: string | null
  icp_url?: string | null
  /** 站点坐标，缺省时前端不得猜测位置。 */
  latitude?: number | null
  longitude?: number | null
  coordinate_type?: string | null
}

export interface SiteInfo {
  application_id: number
  name: string
  default_locale: string
  enabled_locales: string[]
  branding: {
    logo: string | null
    logo_alt: string
    show_name: boolean
    copyright: string | null
    contact?: SiteContact | null
  }
}

/** GET /api/v1/site/bootstrap */
export interface BootstrapResponse {
  site: SiteInfo
  menus?: Record<string, unknown>
  navigation?: Record<string, unknown>
  strings: Record<string, string>
}

/** 集合项 / 详情记录通用形状。 */
export interface SourceItem {
  key: string
  values: Record<string, unknown>
}

/** GET /api/v1/site/collections/{type} */
export interface CollectionResponse {
  items: SourceItem[]
  meta: { total?: number; page?: number; per_page?: number; total_pages?: number; has_more?: boolean }
}

/** GET /api/v1/site/page-data/{code} */
export interface PageDataResponse {
  page: { id: number; code: string; slug: string | null; title: string | null; type: number | null; locale: string }
  locale: string
  blocks: Record<string, Record<string, unknown> | unknown[] | null>
}

/** GET /api/v1/site/categories?type=… —— 单类型分类树（列表页自建导航用）。 */
export interface CategoryNode {
  id: number
  title: string
  slug: string
  /** 命名空间前缀的完整路径，如 `/cases/xuanchuanpian`。 */
  path: string
  children: CategoryNode[]
}

export interface CategoryTreeResponse {
  type: string
  namespace: string
  items: CategoryNode[]
}

/** GET /api/v1/site/records/{type}/{id} */
export interface RecordResponse {
  record: SourceItem | null
  navigation?: { previous?: RecordNavigationItem | null; next?: RecordNavigationItem | null }
}

export interface RecordNavigationItem { title: string; id: number; slug?: string | null }

/** 表单字段定义由业务页面消费，布局仍由应用代码实现。 */
export interface FormResponse {
  id: number
  code: string
  title?: string | null
  fields: Array<Record<string, unknown>>
  [key: string]: unknown
}

export interface SubmitFormResult {
  id: number
  form_id: number
  submitted_at: string | null
  success_message: string
  success_message_html?: string
  warnings?: unknown[]
}
