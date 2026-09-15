/**
 * 运行期基建（两个小工具）。
 *
 * `getGlobalSingleton`：公共层以软链（`link:`）被引用时，H5 dev 下 Vite 的依赖预构建
 * 可能产出**两份模块实例**，模块级变量会分裂（曾表现为"小程序有品牌色、H5 回落默认蓝"）。
 * 把状态挂到 `globalThis` 上即可消除 —— 与 uview-plus 把 `$u` 挂全局同一思路。
 */

declare const uni: any

/** 取（必要时创建）全局单例；同名 key 在多份模块实例间共享同一对象。 */
export function getGlobalSingleton<T>(key: string, create: () => T): T {
  const holder = globalThis as unknown as Record<string, T | undefined>
  const existing = holder[key]
  if (existing !== undefined) return existing
  const created = create()
  holder[key] = created
  return created
}

/** 清空（测试与"重置运行期状态"用）。 */
export function clearGlobalSingleton(key: string): void {
  delete (globalThis as unknown as Record<string, unknown>)[key]
}

/** uni 全局；不存在时返回 undefined（纯逻辑在 node 下跑测试时用）。 */
export function getUni(): any {
  return typeof uni === 'undefined' ? undefined : uni
}

export function hasUni(): boolean {
  return typeof uni !== 'undefined'
}
