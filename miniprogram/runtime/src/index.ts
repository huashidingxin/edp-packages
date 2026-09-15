/**
 * /miniprogram-runtime —— 小程序公共层（只做公共工具与公共请求，不做业务组件）。
 *
 * ```ts
 * // App.vue onLaunch —— 一个调用完成装配（启动顺序、tab 页集合都由包处理）
 * setupAppRuntime({ theme: brandTokens, http: apiConfig })
 *
 * // 业务页（显式 import 为主：有类型、可测）
 * const { items } = await appSite.collection('product', { page: 1 })
 * openPath('/pages/product/detail', { id: 12 })
 * openLink(banner.link)            // 后端下发的链接
 *
 * // 也可以用全局入口（少写 import，适合零散调用 / 非 Vue 模块）
 * await uni.$edp.http.get('/site/business-cards')
 * uni.$edp.openLink(banner.link)
 * ```
 * 业务页用 `uni_modules/uview-plus` 自由拼装；公共布局等从多个真实小程序里再抽取。
 */
import appPagesJson from './app-pages.ts'
import { injectAppPagesJson } from './router.ts'

// 包入口自动读取应用的 `pages.json` 并注入：`setupAppRouter()` / `setupAppRuntime()` 不必再传。
// 注意 `pages.json` 不能写注释（按 JSON 解析），需要注释时用 `setupAppRouter({ tabPaths })` 覆盖。
injectAppPagesJson(appPagesJson)

// 运行时装配（应用入口只需要这一个调用）
export { setupAppRuntime } from './setup.ts'
export type { AppRuntimeOptions } from './setup.ts'

// 请求
export {
  friendlyMessage,
  getHttpConfig,
  http,
  AppRequestError,
  resetAppHttp,
  setTransport,
  setupAppHttp,
} from './request.ts'
export type { HttpConfig, Method, Params, RequestCustom, RequestOptions } from './request.ts'
export { Resource } from './resource.ts'
export { appSite, sourceItemId } from './site.ts'
export type { CategoryTreeParams, CollectionParams, LocaleParams, PageDataParams, SubmitFormOptions } from './site.ts'
export { useAppCollection } from './collection.ts'

// 主题
export { defaultTokens, tokensToCssVars, tokensToUpColorMap } from './theme/tokens.ts'
export type { ThemeTokens } from './theme/tokens.ts'
export {
  applyThemeToTabBar,
  appCssVars,
  appTokens,
  setupAppTheme,
  syncUpTheme,
  useAppTheme,
} from './theme/runtime.ts'

// 站点数据
export { prefetchAppBootstrap, resetAppBootstrap, useAppBootstrap } from './bootstrap.ts'

// 运行期基建
export { clearGlobalSingleton, getGlobalSingleton, getUni, hasUni } from './global.ts'

// 端信息（跨端：小程序 / H5 / APP）
export { getPlatformDevice } from './platform.ts'
export type { PlatformDevice } from './platform.ts'

// 全局便捷入口（uni.$edp / uni.Resource，零 import）
export { installAppGlobals } from './globals.ts'
export type { AppGlobalApi } from './globals.ts'

// 路由（原生 tabBar 下 switchTab 判定 + 咽喉点拦截 + 内容链接分发）
export {
  collectTabPaths,
  getTabPaths,
  goBack,
  installAppRouteInterceptor,
  isTabPath,
  normalizeAppPath,
  openLink,
  openPath,
  resetAppRouter,
  resolveOpenMethod,
  setupAppRouter,
  toQueryString,
} from './router.ts'
export type {
  AppRouteGuard,
  AppRouteGuardContext,
  AppRouteMethod,
  AppRouterOptions,
  OpenMethod,
} from './router.ts'

// 类型
export type {
  ApiEnvelope,
  BootstrapResponse,
  CategoryNode,
  CategoryTreeResponse,
  CollectionResponse,
  FormResponse,
  PageDataResponse,
  RecordResponse,
  SiteContact,
  SiteInfo,
  SourceItem,
  SubmitFormResult,
} from './types.ts'
