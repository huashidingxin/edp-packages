/**
 * 运行时一次性装配 —— **应用只需要调这一个函数**。
 *
 * 为什么要这一层（不是随手包一层）：
 * 1. **启动顺序属于运行时的知识**，不该让每个应用自己排：主题必须先于请求/路由就绪
 *    （uview 色板要被后续消费），拦截器必须晚于路由配置（它要读 tab 页集合）。
 *    靠注释和自觉遵守，早晚出错；
 * 2. 以后新增一个启动步骤（i18n、埋点、合规初始化…），只改这里 —— **所有客户应用升包即可，
 *    不用逐个去改 App.vue**；
 * 3. 应用侧从此只负责"提供值"，不再关心顺序。
 *
 * ```ts
 * // App.vue onLaunch —— 应用只提供"值"
 * setupAppRuntime({ theme: brandTokens, http: apiConfig })
 * ```
 *
 * 关于参数：`theme` / `http` 是应用级信息（品牌、后端标识），只能由应用提供；
 * `pagesJson` 已由包入口自动读取应用的 `pages.json`（见 app-pages.ts），**不用传**，
 * 仅在 `pages.json` 带注释无法被 JSON 解析时才用 `tabPaths` 覆盖。
 */
import { prefetchAppBootstrap } from './bootstrap.ts'
import { installAppGlobals } from './globals.ts'
import { setupAppHttp, type HttpConfig } from './request.ts'
import {
  installAppRouteInterceptor,
  setupAppRouter,
  type AppRouteGuard,
} from './router.ts'
import { setupAppTheme } from './theme/runtime.ts'
import type { ThemeTokens } from './theme/tokens.ts'

export interface AppRuntimeOptions {
  /** 品牌令牌（应用本地 `config/theme.ts`）；不传则跳过主题初始化 */
  theme?: Partial<ThemeTokens>
  /** 请求配置（应用本地 `config/api.ts`）；不传则跳过请求层初始化 */
  http?: HttpConfig
  /** 覆盖默认读取的应用 `pages.json`（一般不用传，包入口已自动注入） */
  pagesJson?: unknown
  /** 显式 tab 页路径，优先于 `pagesJson`（`pages.json` 带注释无法 import 时用） */
  tabPaths?: readonly string[]
  /** 兜底首页（`navigateBack` 无处可退时回落），默认 `/pages/index/index` */
  homePath?: string
  /** 外链承载页（应用本地的 `web-view` 页）；不配则视为该应用不支持外链 */
  webviewPath?: string
  /** 路由守卫（登录拦截等）：返回 `false` 取消跳转 */
  guard?: AppRouteGuard
  /** 是否挂全局便捷入口 `uni.$edp` / `uni.Resource`，默认 `true` */
  globals?: boolean
  /** 是否提前发起 `/site/bootstrap`，默认 `true` */
  prefetch?: boolean
}

/**
 * 一次性装配运行时（`App.vue onLaunch` 调用一次）。
 *
 * 细粒度入口（`setupAppTheme` / `setupAppHttp` / `setupAppRouter` / `installAppRouteInterceptor` /
 * `installAppGlobals` / `prefetchAppBootstrap`）仍然公开，供测试与特殊场景单独使用。
 */
export function setupAppRuntime(options: AppRuntimeOptions = {}): void {
  // 1. 主题：uview 色板与页面 CSS 变量最先就绪
  if (options.theme) setupAppTheme(options.theme)

  // 2. 请求：bootstrap 与所有页面请求都依赖它
  if (options.http) setupAppHttp(options.http)

  // 3. 路由：注册 tab 页集合（下一步的拦截器要读它）
  setupAppRouter({
    pagesJson: options.pagesJson,
    tabPaths: options.tabPaths,
    homePath: options.homePath,
    webviewPath: options.webviewPath,
  })

  // 4. 咽喉点：纠正 tab 页跳转 + navigateBack 栈内兜底（守卫策略由应用注入）
  installAppRouteInterceptor({ guard: options.guard })

  // 5. 全局便捷入口：uni.$edp / uni.Resource
  if (options.globals !== false) installAppGlobals()

  // 6. 站点数据提前发起（比任何页面都早）
  if (options.prefetch !== false) prefetchAppBootstrap()
}
