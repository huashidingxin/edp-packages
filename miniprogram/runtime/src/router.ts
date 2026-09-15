/**
 * 路由（跨端）—— 统一跳转、咽喉点拦截、内容链接分发。
 *
 * 三层，按"能不能被绕过"排序：
 * 1. `installAppRouteInterceptor()` —— **咽喉点**。给 5 个路由 API 装上拦截器，
 *    连第三方库 / uview 内部直接调 `uni.navigateTo` 也会被纠正，绕不过去；
 * 2. `openPath()` —— 显式入口（类型安全、返回实际使用的方法），业务代码首选；
 * 3. `openLink()` —— 内容驱动分发：后端下发的 `link`（banner / content 字段）交给它。
 *
 * 被固化的平台规则（每个应用各写一遍必出错的地方）：
 * - 原生 tabBar 下，`navigateTo` / `redirectTo` **不能**跳 tab 页（`can not navigateTo a tabbar page`）；
 *   反向 `switchTab` **不能**跳非 tab 页。两者由拦截器自动改走正确 API；
 * - `reLaunch` 允许跳 tab 页，**不要"顺手纠正"**；
 * - `switchTab` 的 url **不能带参数**，所以目标是 tab 页时 query 会被丢弃（跨 tab 传值走全局状态）；
 * - 分享 / 扫码直达详情页时栈内只有一页，`navigateBack` 会静默失败，必须回落兜底页。
 *
 * tab 页集合以 `pages.json` 的 `tabBar.list` 为唯一事实源（`@/` 别名只对应用成立，故由应用侧
 * import 后传入），避免手工维护数组与 `pages.json` 漂移。
 *
 * 用法（App.vue onLaunch 各调一次）：
 * ```ts
 * import pagesJson from '@/pages.json'
 * setupAppRouter({ pagesJson })
 * installAppRouteInterceptor()
 * ```
 *
 * 跨端：`addInterceptor` / `switchTab` / `navigateTo` / `redirectTo` / `reLaunch` / `navigateBack`
 * 都是 uni 标准 API，H5 / APP 的 tabBar 同由框架接管、语义一致，**故本模块无端分支**。
 */
import { getGlobalSingleton, getUni, hasUni } from './global.ts'

export type OpenMethod = 'switchTab' | 'navigateTo' | 'redirectTo' | 'none'

/** uni 路由 API（拦截器覆盖的 5 个）。 */
export type AppRouteMethod =
  | 'navigateTo'
  | 'redirectTo'
  | 'reLaunch'
  | 'switchTab'
  | 'navigateBack'

export type AppRouteMethod$Forward = Exclude<AppRouteMethod, 'navigateBack'>

export interface AppRouteGuardContext {
  /** 最终会以哪种方式跳转（已被拦截器纠正过） */
  method: AppRouteMethod$Forward
  /** 目标页路径（归一化，不含 query） */
  path: string
  /** 原始 url（含 query） */
  url: string
  /** 解析后的 query */
  query: Record<string, string>
}

/** 路由守卫：返回 `false` 取消本次跳转（登录拦截等策略由应用注入）。 */
export type AppRouteGuard = (context: AppRouteGuardContext) => boolean | void

export interface AppRouterOptions {
  /** 应用侧 `import pagesJson from '@/pages.json'` */
  pagesJson?: unknown
  /** 显式指定 tab 页路径（优先于 `pagesJson`；`pages.json` 带注释无法被 import 时用） */
  tabPaths?: readonly string[]
  /** 兜底首页（`navigateBack` 无处可退时回落），默认 `/pages/index/index` */
  homePath?: string
  /** 外链承载页（应用本地的 `web-view` 页），**不配则视为该应用不支持外链** */
  webviewPath?: string
}

interface RouterState {
  tabPaths: string[]
  homePath: string
  webviewPath: string
  intercepting: boolean
  /** 修正后的转发调用直通（同步重入，用标志位即可） */
  forwarding: boolean
  /** 应用的 `pages.json`（由包入口注入，见 app-pages.ts） */
  appPagesJson: unknown
}

const ROUTER_STATE_KEY = '__edpAppRouter__'
const DEFAULT_HOME_PATH = 'pages/index/index'

/** 平台规则：这两个 API 不能跳 tab 页（`reLaunch` 可以）。 */
const TAB_BLOCKED_METHODS: readonly AppRouteMethod[] = ['navigateTo', 'redirectTo']

/** 拦截器覆盖的路由 API。 */
const INTERCEPTED_METHODS: readonly AppRouteMethod[] = [
  'navigateTo',
  'redirectTo',
  'reLaunch',
  'switchTab',
  'navigateBack',
]

function routerState(): RouterState {
  return getGlobalSingleton<RouterState>(ROUTER_STATE_KEY, () => ({
    tabPaths: [],
    homePath: DEFAULT_HOME_PATH,
    webviewPath: '',
    intercepting: false,
    forwarding: false,
    appPagesJson: undefined,
  }))
}

/** 归一化应用内路径：去掉 query / hash 与前导、结尾斜杠 → `pages/index/index`。 */
export function normalizeAppPath(path: string): string {
  if (!path) return ''
  const withoutQuery = path.split('?')[0] ?? ''
  const withoutHash = withoutQuery.split('#')[0] ?? ''
  return withoutHash.replace(/^\/+/, '').replace(/\/+$/, '')
}

/** 解 query 串（只用于守卫上下文；页面读参数请用 `onLoad` 的 options）。 */
function parseQuery(url: string): Record<string, string> {
  const search = url.split('?')[1]
  if (!search) return {}
  const query: Record<string, string> = {}
  for (const pair of search.split('&')) {
    if (!pair) continue
    const index = pair.indexOf('=')
    const rawKey = index === -1 ? pair : pair.slice(0, index)
    const rawValue = index === -1 ? '' : pair.slice(index + 1)
    try {
      query[decodeURIComponent(rawKey)] = decodeURIComponent(rawValue)
    } catch {
      query[rawKey] = rawValue
    }
  }
  return query
}

/** 取当前页面栈：`getCurrentPages` 是 uni 全局函数（各端一致），不在 `uni` 对象上；`uni.getCurrentPages` 仅作兜底。 */
function stackPages(): unknown[] | undefined {
  const getter = (globalThis as unknown as { getCurrentPages?: () => unknown }).getCurrentPages
  if (typeof getter === 'function') return getter() as unknown[]
  const u = getUni()
  return u && typeof u.getCurrentPages === 'function' ? (u.getCurrentPages() as unknown[]) : undefined
}

/**
 * 当前页面栈深；无法获取（非 uni 容器 / API 缺失）时返回 0 表示「未知」。
 * 调用方必须区分「已知 1 页」与「未知」：未知时不能把返回拦截成回首页。
 */
function currentStackDepth(): number {
  const pages = stackPages()
  return Array.isArray(pages) ? pages.length : 0
}

/**
 * 从 `pages.json` 抽取 tab 页路径（去重、忽略非法项）。
 * 纯函数：包内不能用应用别名（`@/pages.json`），因此由应用侧 import 后传入。
 */
export function collectTabPaths(pagesJson: unknown): string[] {
  const list = (pagesJson as { tabBar?: { list?: unknown } } | null | undefined)?.tabBar?.list
  if (!Array.isArray(list)) return []
  const paths: string[] = []
  for (const item of list) {
    const pagePath = (item as { pagePath?: unknown } | null | undefined)?.pagePath
    if (typeof pagePath !== 'string') continue
    const normalized = normalizeAppPath(pagePath)
    if (normalized && !paths.includes(normalized)) paths.push(normalized)
  }
  return paths
}

/**
 * 注入应用的 `pages.json`（**由包入口 `index.ts` 自动调用**，应用代码不用管）。
 * 注入后 `setupAppRouter()` / `setupAppRuntime()` 不传 `pagesJson` 也能拿到 tab 页集合。
 */
export function injectAppPagesJson(pagesJson: unknown): void {
  routerState().appPagesJson = pagesJson
}

/**
 * 注册路由配置（应用启动调一次，`setupAppRuntime` 内部已调用）。
 *
 * tab 页集合来源优先级：`tabPaths` → `pagesJson` → 包入口注入的应用 `pages.json`
 * （第三条是默认路径，应用零传参；前两条是覆盖口，用于 `pages.json` 带注释等场景）。
 */
export function setupAppRouter(options: AppRouterOptions = {}): void {
  const state = routerState()
  const resolved = options.tabPaths
    ? options.tabPaths.map(normalizeAppPath).filter(Boolean)
    : collectTabPaths(options.pagesJson ?? state.appPagesJson)
  state.tabPaths = [...new Set(resolved)]
  if (options.homePath) state.homePath = normalizeAppPath(options.homePath) || DEFAULT_HOME_PATH
  if (options.webviewPath !== undefined) state.webviewPath = normalizeAppPath(options.webviewPath)
}

export function getTabPaths(): readonly string[] {
  return routerState().tabPaths
}

/**
 * 清空路由配置与拦截器标记（测试 / 运行期重置用）。
 * 应用运行期**不要**调用：拦截器无法真正卸载，标记清掉会重复安装。
 */
export function resetAppRouter(): void {
  const state = routerState()
  state.tabPaths = []
  state.homePath = DEFAULT_HOME_PATH
  state.webviewPath = ''
  state.intercepting = false
  state.forwarding = false
  state.appPagesJson = undefined
}

export function isTabPath(path: string): boolean {
  const normalized = normalizeAppPath(path)
  return !!normalized && routerState().tabPaths.includes(normalized)
}

/** 对象 → 查询串；`undefined` / `null` / `''` 跳过（"不传即不筛"）。 */
export function toQueryString(query?: Record<string, unknown>): string {
  if (!query) return ''
  const pairs: string[] = []
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue
    pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
  }
  return pairs.length > 0 ? `?${pairs.join('&')}` : ''
}

/** 只判定不执行：便于单测，也便于调用方先判断再决定。 */
export function resolveOpenMethod(path: string, options: { replace?: boolean } = {}): OpenMethod {
  if (!normalizeAppPath(path)) return 'none'
  if (isTabPath(path)) return 'switchTab'
  return options.replace ? 'redirectTo' : 'navigateTo'
}

/**
 * 统一跳转，返回实际使用的方法。
 *
 * 注意：**`switchTab` 的 url 不能带参数**（各端一致），所以目标是 tab 页时 `query` 会被丢弃 ——
 * 跨 tab 传值请走全局状态或缓存，不要指望 query。
 */
export function openPath(
  path: string,
  query?: Record<string, unknown>,
  options: { replace?: boolean } = {},
): OpenMethod {
  const method = resolveOpenMethod(path, options)
  if (method === 'none' || !hasUni()) return method
  const normalized = normalizeAppPath(path)
  const url =
    method === 'switchTab' ? `/${normalized}` : `/${normalized}${toQueryString(query)}`
  const u = getUni()
  const api = u[method]
  if (typeof api === 'function') api({ url })
  return method
}

/**
 * 统一返回：栈内可回退则 `navigateBack`，栈内确认只剩一页时回落兜底页。
 * 栈深未知（getCurrentPages 不可用）时也尽力 `navigateBack`，不劫持成回首页。
 * 装了拦截器后这条规则对裸调 `uni.navigateBack` 同样生效（两者结论一致，不冲突）。
 */
export function goBack(fallbackPath?: string): void {
  console.log(1111)
  if (!hasUni()) return
  const u = getUni()
  console.log('-0--------',currentStackDepth())
  if (currentStackDepth() !== 1 && typeof u.navigateBack === 'function') {
    u.navigateBack({ delta: 1 })
    return
  }
  openPath(fallbackPath ?? `/${routerState().homePath}`)
}

/**
 * 最终生效的跳转方法：把平台不允许的组合纠正成可行的。
 * - `navigateTo` / `redirectTo` 跳 tab 页 → 改 `switchTab`
 * - `switchTab` 跳非 tab 页 → 改 `navigateTo`
 * - `reLaunch` 跳 tab 页平台本就允许，**不动**
 */
function resolveFinalMethod(
  method: AppRouteMethod$Forward,
  path: string,
): AppRouteMethod$Forward {
  const isTab = isTabPath(path)
  if (isTab) return TAB_BLOCKED_METHODS.includes(method) ? 'switchTab' : method
  return method === 'switchTab' ? 'navigateTo' : method
}

/**
 * 安装路由拦截器（App.vue onLaunch 调一次，重复调用无效）。
 *
 * 做三件事：
 * 1. `navigateTo` / `redirectTo` 目标是 tab 页 → 改走 `switchTab`（并取消原调用）；
 * 2. `switchTab` 目标是非 tab 页 → 改走 `navigateTo`（并取消原调用）；
 * 3. `navigateBack` 且栈内只有一页 → 回落兜底首页（并取消原调用）。
 *
 * 守卫 `guard` 在纠正**之前**判定：`context.url` / `context.query` 是用户原本想去的值，
 * `context.method` 是最终生效的跳转方式。一次跳转只调用一次，返回 `false` 取消整次跳转。
 */
export function installAppRouteInterceptor(options: { guard?: AppRouteGuard } = {}): void {
  if (!hasUni()) return
  const u = getUni()
  if (typeof u.addInterceptor !== 'function') return
  const state = routerState()
  if (state.intercepting) return
  const { guard } = options
  state.intercepting = true

  for (const method of INTERCEPTED_METHODS) {
    u.addInterceptor(method, {
      invoke(raw: unknown): unknown {
        if (state.forwarding) return raw // 纠正后的转发直通，避免守卫被调用两次
        if (method === 'navigateBack') {
          // 只有「确认栈内只剩一页」才回落兜底首页（分享/扫码直达的场景）；
          // 栈深未知（getCurrentPages 不可用，返回 0）时必须放行，否则所有返回都会被劫持到首页
          if (currentStackDepth() === 1) {
            openPath(`/${state.homePath}`)
            return false
          }
          return raw
        }

        const options = (raw ?? {}) as Record<string, unknown>
        const url = typeof options.url === 'string' ? options.url : ''
        const path = normalizeAppPath(url)
        if (!path) return raw

        const finalMethod = resolveFinalMethod(method as AppRouteMethod$Forward, path)

        // 守卫先判：看到的是用户原本想去哪（url / query 未被改写）
        if (guard && guard({ method: finalMethod, path, url, query: parseQuery(url) }) === false) {
          return false
        }

        // 再按平台规则纠正：转发到可行的 API（保留原始参数与 success / fail 回调），取消原调用
        if (finalMethod !== method) {
          const target = finalMethod === 'switchTab' ? { ...options, url: `/${path}` } : options
          const api = u[finalMethod]
          if (typeof api === 'function') {
            state.forwarding = true
            try {
              api(target)
            } finally {
              state.forwarding = false
            }
          }
          return false
        }
        return raw
      },
    })
  }
}

/**
 * 内容链接分发：把后端下发的 `link`（banner / content 字段）打开。
 * 返回 `true` 表示已被处理；`false` 表示本层没能力处理，由应用决定（见下）。
 *
 * - `http(s)://` → 应用配置的 `webviewPath`（未配置则返回 `false`）；
 *   参数必须 encode，否则目标 URL 自带的 `?` / `&` 会把外层参数解析冲垮；
 * - `/pages/...` → `openPath`（自动处理 tab 页 / 参数）；
 * - 站内相对路径（如 `/products/abc`）与其他 scheme（`tel:` / `mailto:`）**不猜**：
 *   各端承载方式不同（`uni.makePhoneCall` / `window.open` / `plus.runtime.openURL`），
 *   且站内路径需要映射到小程序页面，统一交给应用层处理。
 */
export function openLink(target?: string | null): boolean {
  const link = typeof target === 'string' ? target.trim() : ''
  if (!link || link.startsWith('#')) return false

  if (/^(https?:)?\/\//i.test(link)) {
    const { webviewPath } = routerState()
    if (!webviewPath) return false
    openPath(`/${webviewPath}`, { url: link })
    return true
  }

  if (link.startsWith('/pages') || link.startsWith('pages/')) {
    openPath(link)
    return true
  }

  return false
}
