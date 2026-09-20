import type { LocaleCode } from '@edp/website-ui/contracts'
import { computed } from 'vue'
import { useRoute, useState } from 'nuxt/app'
import { localeCodeFromPath, localizePath, prefixLocalePath, stripLocalePrefix } from '../lib/locale.ts'

export interface LocaleLink {
  locale: LocaleCode
  label?: string
  native_label?: string
  path: string
}

export interface SiteLocaleInfo {
  code: string
  label?: string
  native_label?: string
}

/**
 * 多语言约定（平台站点通用）：
 * - 默认语言无 URL 前缀；
 * - 其他启用语言使用 /{lang} 短码前缀（如 /en/products）；
 * - 所有 /api/v1 接口请求显式带 ?locale= 当前语言，并且路径剥离前缀后传入。
 * - localePath(path) 将逻辑路径转回当前语言下的真实 URL（默认语言无前缀）；
 *   该函数幂等：后端下发的 `href` 已是本地化 URL（如 /en/about），再次调用不会叠加成 /en/en/about。
 */
export function useLocale() {
  const route = useRoute()
  const bootstrap = useState<BootstrapSnapshot | null>('web:bootstrap:data', () => null)
  const defaultLocale = computed<string>(() => bootstrap.value?.site?.default_locale ?? 'zh-CN')
  const locales = computed<SiteLocaleInfo[]>(() => bootstrap.value?.site?.locales ?? [])
  const localeCodes = computed<string[]>(() => locales.value.map((l) => String(l.code)))

  const localeFromPath = (path: string): string =>
    localeCodeFromPath(path, localeCodes.value) ?? defaultLocale.value

  const stripPrefix = (path: string): string => stripLocalePrefix(path, localeCodes.value)

  const prefixedPath = (locale: string, logicalPath: string): string =>
    prefixLocalePath(logicalPath, locale, defaultLocale.value)

  const locale = computed(() => localeFromPath(route.path))
  const logicalPath = computed(() => stripPrefix(route.path))

  const localeLinks = computed<LocaleLink[]>(() =>
    locales.value.map((l) => ({
      locale: String(l.code),
      label: l.label,
      native_label: l.native_label,
      path: prefixedPath(String(l.code), logicalPath.value),
    })),
  )

  /**
   * 逻辑路径 -> 当前语言下的真实 URL（默认语言无前缀）。
   * 对已经带语言前缀的路径（后端本地化过的菜单 href）幂等，不会产生 `/en/en/...`。
   */
  const localePath = (path: string): string =>
    localizePath(path || '/', locale.value, defaultLocale.value, localeCodes.value)

  return { locale, defaultLocale, locales, localeFromPath, stripPrefix, prefixedPath, logicalPath, localeLinks, localePath }
}

/** 简化 bootstrap snapshot（与 useLocaleLight 共享 state key）。 */
interface BootstrapSnapshot {
  site?: {
    name?: string
    default_locale?: string
    enabled_locales?: string[]
    locales?: SiteLocaleInfo[]
    branding?: {
      logo?: string | null
      logo_alt?: string
      favicon?: string | null
      show_name?: boolean
      copyright?: string | null
    }
    application_id?: number
    tenant_id?: number
  }
  theme?: { tokens?: unknown }
  menus?: { header?: unknown[]; footer?: unknown[] }
}
