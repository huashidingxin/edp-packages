/** 导航激活态匹配工具（纯函数，node:test 覆盖）。 */

const normalize = (p: string): string => {
  const trimmed = (p || '').split('?')[0]?.split('#')[0]?.replace(/\/+$/, '') ?? ''
  return trimmed === '' ? '/' : trimmed
}

/**
 * 当前路径是否命中链接：
 * - 精确相等；或
 * - 前缀命中且停在段边界；'/' 仅精确匹配。
 */
export function isActivePath(currentPath: string, linkPath: string): boolean {
  const cur = normalize(currentPath)
  const link = normalize(linkPath)
  if (!link) return false
  if (cur === link) return true
  if (link === '/') return false
  return cur.startsWith(`${link}/`)
}
