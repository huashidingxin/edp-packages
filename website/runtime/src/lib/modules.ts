/**
 * 网站模块配置解析（纯函数，node:test 覆盖）。
 *
 * 未配置 = 全部标准模块开启；模块整体关闭时其路由不注册，
 * 对应页面 chunk 不进构建产物（按需打包）。
 */

/** 列表页形态。 */
export type ProductsListing = 'sidebar' | 'chips'

export interface ProductsModuleOptions {
  listing?: ProductsListing
  detail?: boolean
}

/** 相册模块选项。sources = 仅作数据源的相册分类(不在切换胶囊列出;首页等处以轮播消费;页面保留兜底)。 */
export interface GalleryModuleOptions {
  sources?: string[]
}

export interface WebsiteModulesOptions {
  /** 首页兜底模板；站点本地 index.vue 存在时自动跳过注册。 */
  home?: boolean
  products?: boolean | ProductsModuleOptions
  articles?: boolean
  gallery?: boolean | GalleryModuleOptions
  cases?: boolean
  /** 招聘模块：/jobs 列表 + /jobs/{id} 详情（职位不走分类，按部门/地点筛选）。 */
  jobs?: boolean
  about?: boolean
}

export interface ResolvedWebsiteModules {
  home: boolean
  productsListing: ProductsListing | null
  productsDetail: boolean
  articles: boolean
  gallery: boolean
  gallerySources: string[]
  cases: boolean
  jobs: boolean
  about: boolean
}

const DEFAULTS: ResolvedWebsiteModules = {
  home: true,
  productsListing: 'sidebar',
  productsDetail: true,
  articles: true,
  gallery: true,
  gallerySources: [],
  cases: true,
  jobs: true,
  about: true,
}

function normalizeProducts(input: boolean | ProductsModuleOptions | undefined): {
  listing: ProductsListing | null
  detail: boolean
} {
  if (input === undefined || input === true) return { listing: 'sidebar', detail: true }
  if (input === false) return { listing: null, detail: false }
  return {
    listing: input.listing ?? 'sidebar',
    detail: input.detail ?? true,
  }
}

function normalizeGallery(input: boolean | GalleryModuleOptions | undefined): {
  on: boolean
  sources: string[]
} {
  if (input === undefined || input === true) return { on: true, sources: [] }
  if (input === false) return { on: false, sources: [] }
  return { on: true, sources: (input.sources ?? []).filter(Boolean) }
}

/** 合并用户配置与默认值；未知键忽略。 */
export function resolveModulesOptions(input: WebsiteModulesOptions | undefined): ResolvedWebsiteModules {
  if (!input) return { ...DEFAULTS }
  const products = normalizeProducts(input.products)
  const gallery = normalizeGallery(input.gallery)
  return {
    home: input.home ?? DEFAULTS.home,
    productsListing: products.listing,
    productsDetail: products.detail,
    articles: input.articles ?? DEFAULTS.articles,
    gallery: gallery.on,
    gallerySources: gallery.sources,
    cases: input.cases ?? DEFAULTS.cases,
    jobs: input.jobs ?? DEFAULTS.jobs,
    about: input.about ?? DEFAULTS.about,
  }
}
