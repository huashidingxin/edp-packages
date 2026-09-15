/**
 * 全局便捷入口（零 import 使用）。
 *
 * 和 `app.config.globalProperties` 是两回事：后者在 `<script setup>` 里取不到（要
 * `getCurrentInstance()`），而挂在 `uni` 上的东西**任何上下文都能直接用** —— 模板、
 * `<script setup>`、纯 JS/TS 模块、uni 拦截器、uview 组件内部，不需要 `this`、不需要 import。
 * 参考项目就是 `new uni.Resource('app', { params })` 这么用的。
 *
 * 纪律（否则全局挂载很快会变成一锅粥）：
 * 1. **只在这里挂**，业务代码不许往 `uni` 上随手加属性；
 * 2. **只挂已有导出的引用**，不产生第二套实现（`uni.$edp.openPath === openPath`，
 *    改一处即全局生效，也不会出现"两套 API 各自演化"）；
 * 3. 不往 uview 的 `uni.$u` 里塞我们的方法 —— `$u` 是 uview 自己的命名空间，
 *    升级时冲突/被覆盖都不好排查；用我们自己的 `uni.$edp`，便利性完全等价。
 *
 * ```ts
 * // App.vue onLaunch 调一次
 * installAppGlobals()
 * // 之后任何地方
 * const products = await new uni.Resource('/site/collections/product').list()
 * uni.$edp.openPath('/pages/product/detail', { id: 12 })
 * ```
 */
import { getUni, hasUni } from './global.ts'
import { http } from './request.ts'
import { Resource } from './resource.ts'
import { goBack, openLink, openPath } from './router.ts'

export interface AppGlobalApi {
  Resource: typeof Resource
  http: typeof http
  openPath: typeof openPath
  openLink: typeof openLink
  goBack: typeof goBack
}

declare global {
  namespace UniNamespace {
    interface Uni {
      /** 由 `installAppGlobals()` 挂载。 */
      $edp: AppGlobalApi
      /** 由 `installAppGlobals()` 挂载（与 `uni.$edp.Resource` 同一引用）。 */
      Resource: typeof Resource
    }
  }
}

/** 挂载全局便捷入口；返回挂载的对象（无 uni 环境时返回 undefined）。重复调用幂等。 */
export function installAppGlobals(): AppGlobalApi | undefined {
  if (!hasUni()) return undefined
  const u = getUni()
  const api: AppGlobalApi = { Resource, http, openPath, openLink, goBack }
  u.$edp = api
  u.Resource = Resource
  return api
}
