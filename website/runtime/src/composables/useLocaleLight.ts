import type { LocaleCode, MenuItem, MenuItem as _MI, MenuTree, SiteInfo, LocaleInfo, SiteBranding } from '@edp/website-ui/contracts'
import { computed } from 'vue'
import { useRoute, useState } from 'nuxt/app'

const LOCALE_PREFIX_RE = /^\/[a-z]{2,3}(-[a-z0-9]{2,8})?(\/|$)/i

const localePrefixOf = (code: string): string => {
  const normalized = code.replace('_', '-')
  const lang = normalized.split('-')[0]?.toLowerCase() || normalized.toLowerCase()
  return lang
}

const findLocaleByPrefix = (code: string, locales: LocaleInfo[]): LocaleInfo | undefined =>
  locales.find((l) => localePrefixOf(String(l.code)) === code.toLowerCase())

/**
 * 轻量 locale 解析 — 仅依据 URL route.path + 当前已收的 defaultLocale。
 * useSiteBootstrap 自身也使用本函数避免循环依赖。
 */
export function useLocaleLight() {
  const route = useRoute()
  const bootstrapData = useState<BootstrapData | null>('web:bootstrap:data', () => null)
  const defaultLocale = computed<LocaleCode>(() => bootstrapData.value?.site?.default_locale ?? 'zh-CN')
  const locales = computed<LocaleInfo[]>(() => bootstrapData.value?.site?.locales ?? [])

  const localeFromPath = (path: string): string => {
    const segment = path.split('/')[1] ?? ''
    if (LOCALE_PREFIX_RE.test(path) && segment) {
      const found = findLocaleByPrefix(segment, locales.value)
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

  return { locale, defaultLocale, locales, localeFromPath, stripPrefix, prefixedPath, logicalPath }
}

interface BootstrapData {
  site?: Pick<SiteInfo, 'name' | 'default_locale' | 'enabled_locales' | 'locales' | 'branding' | 'application_id' | 'tenant_id'>
  theme?: { tokens?: unknown }
  menus?: { header?: MenuTree; footer?: MenuTree }
}
