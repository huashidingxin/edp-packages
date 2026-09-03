import type { LocaleCode } from '@edp/website-ui/contracts'
import { computed } from 'vue'
import { useRoute, useState } from 'nuxt/app'

const LOCALE_PREFIX_RE = /^\/[a-z]{2,3}(-[a-z0-9]{2,8})?(\/|$)/i

const localePrefixOf = (code: string): string => {
  const normalized = code.replace('_', '-')
  const lang = normalized.split('-')[0]?.toLowerCase() || normalized.toLowerCase()
  return lang
}

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
 * - 所有 v2 接口请求显式带 ?locale= 当前语言，并且路径剥离前缀后传入。
 * - localePath(path) 将逻辑路径转回当前语言下的真实 URL（默认语言无前缀）。
 */
export function useLocale() {
  const route = useRoute()
  const bootstrap = useState<BootstrapSnapshot | null>('web:bootstrap:data', () => null)
  const defaultLocale = computed<string>(() => bootstrap.value?.site?.default_locale ?? 'zh-CN')
  const locales = computed<SiteLocaleInfo[]>(() => bootstrap.value?.site?.locales ?? [])

  const localeFromPath = (path: string): string => {
    const segment = path.split('/')[1] ?? ''
    if (LOCALE_PREFIX_RE.test(path) && segment) {
      const found = locales.value.find((l) => localePrefixOf(String(l.code)) === segment.toLowerCase())
      if (found) return String(found.code)
    }
    return defaultLocale.value
  }

  const stripPrefix = (path: string): string => {
    if (!LOCALE_PREFIX_RE.test(path)) return path
    const segment = path.split('/')[1] ?? ''
    if (segment && locales.value.some((l) => localePrefixOf(String(l.code)) === segment.toLowerCase())) {
      const rest = path.split('/').slice(2).join('/')
      return rest ? `/${rest}` : '/'
    }
    return path
  }

  const prefixedPath = (locale: string, logicalPath: string): string => {
    if (locale === defaultLocale.value) return logicalPath || '/'
    const prefix = localePrefixOf(locale)
    return `/${prefix}${logicalPath === '/' || !logicalPath ? '' : logicalPath}`
  }

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

  /** 逻辑路径 -> 当前语言下的真实 URL（默认语言无前缀）。 */
  const localePath = (path: string): string => prefixedPath(locale.value, path || '/')

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
