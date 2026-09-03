import { useBootstrapStrings } from './useSite'

/**
 * UI 词条翻译：t(source, opts?)。
 *
 * - source = 默认语言（zh-CN）原文，写文案即写 key，无额外 key 文件。
 * - 查找链：bootstrap.strings["context:source"]（位置级覆盖）→
 *   bootstrap.strings[source]（全局词条）→ 原文兜底（zh 天然正确）。
 * - 支持 {name} 占位符插值。
 *
 * 词条由后台 site_ui_strings 配置，新增语言不需要改前端。
 */
export function useT() {
  const strings = useBootstrapStrings()

  const lookup = (source: string, ctx?: string | null): string | undefined => {
    const map = strings.value
    if (ctx) {
      const hit = map[`${ctx}:${source}`]
      if (hit !== undefined) return hit
    }
    return map[source]
  }

  const t = (source: string, vars?: { ctx?: string } & Record<string, string | number | undefined>): string => {
    const raw = lookup(source, vars?.ctx) ?? source
    if (!vars) return raw
    return raw.replace(/\{(\w+)\}/g, (match, name: string) => {
      const value = vars[name]
      return value !== undefined ? String(value) : match
    })
  }

  return { t }
}
