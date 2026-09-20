/**
 * 语言前缀纯逻辑（网站 runtime 通用）。
 *
 * 约定：
 *  - 默认语言无 URL 前缀；其他启用语言用 `/{lang}` 短码前缀（如 `/en/products`）；
 *  - 后端下发的菜单/导航 `href` 已经是本地化 URL（`MenuService::localizedHref` 只规范化
 *    语言前缀、不嵌套），因此「加前缀」必须幂等：已带语言前缀的路径不能再次叠加，
 *    否则会生成 `/en/en/...` 这类 404 链接。
 */

/** `/en`、`/en-US/...` 这类首段语言前缀。 */
const LOCALE_PREFIX_RE = /^\/[a-z]{2,3}(-[a-z0-9]{2,8})?(\/|$)/i

/** 语言代码 -> URL 短前缀（`zh-CN` -> `zh`，`en_US` -> `en`）。 */
export const localeShort = (code: string): string => {
  const normalized = String(code ?? '').replace('_', '-')
  return normalized.split('-')[0]?.toLowerCase() || normalized.toLowerCase()
}

/**
 * 路径首段是已启用语言时返回该语言代码，否则返回 null。
 * 短码（`/en`）与规范码（`/en-US`、`/zh-CN`，忽略大小写）都识别；
 * 未启用语言（如站点自有栏目 `/english`）不视为前缀。
 */
export const localeCodeFromPath = (path: string, codes: readonly string[]): string | null => {
  const value = String(path ?? '')
  if (!LOCALE_PREFIX_RE.test(value)) return null
  const segment = (value.split('/')[1] ?? '').toLowerCase()
  if (!segment) return null
  const hit = codes.find((code) => {
    const raw = String(code)
    const canonical = raw.replace('_', '-').toLowerCase()
    return localeShort(raw) === segment || canonical === segment
  })
  return hit ? String(hit) : null
}

/** 去掉已存在的语言前缀（无前缀或前缀非启用语言时原样返回）。 */
export const stripLocalePrefix = (path: string, codes: readonly string[]): string => {
  const value = String(path ?? '') || '/'
  if (!localeCodeFromPath(value, codes)) return value
  const rest = value.split('/').slice(2).join('/')
  return rest ? `/${rest}` : '/'
}

/** 逻辑路径 -> 指定语言的真实 URL（默认语言无前缀）。 */
export const prefixLocalePath = (path: string, locale: string, defaultLocale: string): string => {
  const logical = String(path ?? '') || '/'
  if (locale === defaultLocale) return logical
  return `/${localeShort(locale)}${logical === '/' ? '' : logical}`
}

/**
 * 幂等本地化：先剥离已有语言前缀，再加上当前语言前缀。
 * 后端已经本地化的 href 与站点自建的逻辑路径都可以直接传入。
 */
export const localizePath = (
  path: string,
  locale: string,
  defaultLocale: string,
  codes: readonly string[],
): string => prefixLocalePath(stripLocalePrefix(path, codes), locale, defaultLocale)
