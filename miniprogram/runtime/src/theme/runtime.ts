/**
 * 主题运行时（含 vue / uni 副作用）。
 *
 * ```ts
 * setupAppTheme({ primary: '#c8401f' })       // App.vue onLaunch
 * const { cssVars } = useAppTheme()           // 页面
 * <view :style="cssVars"> … var(--color-primary) … </view>
 * ```
 * 状态挂**全局单例**：公共层以软链被引用时 H5 dev 可能产出两份模块实例，
 * 模块级变量会分裂（曾表现为"小程序有品牌色、H5 回落默认蓝"）。见 global.ts。
 */
import { computed, readonly, ref } from 'vue'
import { getGlobalSingleton, getUni, hasUni } from '../global.ts'
import { defaultTokens, tokensToCssVars, tokensToUpColorMap, type ThemeTokens } from './tokens.ts'

const store = getGlobalSingleton('__EDP_APP_THEME__', () => ({
  tokens: ref<ThemeTokens>({ ...defaultTokens }),
}))

/** 当前令牌（只读）。 */
export const appTokens = readonly(store.tokens)

/** 当前令牌对应的 CSS 变量表（挂页面根节点）。 */
export const appCssVars = computed<Record<string, string>>(() => tokensToCssVars(store.tokens.value))

/** 设置品牌令牌：更新状态 + 同步 uview 色板。应用启动调用一次。 */
export function setupAppTheme(overrides: Partial<ThemeTokens> = {}): ThemeTokens {
  store.tokens.value = { ...defaultTokens, ...overrides }
  syncUpTheme(store.tokens.value)
  return store.tokens.value
}

/** 只同步 uview 色板，不改内部状态。 */
export function syncUpTheme(tokens: ThemeTokens): void {
  if (!hasUni()) return
  const u = getUni()?.$u
  if (u && typeof u.setConfig === 'function') u.setConfig({ color: tokensToUpColorMap(tokens) })
}

/**
 * 同步**原生 tabBar** 配色（`pages.json` 是 JSON，颜色没法引用令牌，只能启动时补一次）。
 * 注意 uview 的 `config.nativeThemeSync` 必须保持关闭，否则会用灰白默认值覆盖品牌色。
 */
export function applyThemeToTabBar(
  overrides: Partial<ThemeTokens> = {},
  borderStyle: 'black' | 'white' = 'black',
): void {
  if (!hasUni()) return
  const u = getUni()
  if (typeof u?.setTabBarStyle !== 'function') return
  const tokens = { ...defaultTokens, ...overrides }
  u.setTabBarStyle({
    color: tokens.mutedForeground,
    selectedColor: tokens.primary,
    backgroundColor: tokens.card,
    borderStyle,
  })
}

/** 业务页取令牌：`const { cssVars, tokens } = useAppTheme()`。 */
export function useAppTheme() {
  return { tokens: appTokens, cssVars: appCssVars, setTheme: setupAppTheme, applyThemeToTabBar }
}
