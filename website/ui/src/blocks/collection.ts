/** 列表页共享类型与工具（纯函数，node:test 覆盖）。 */

export interface WebSidebarNode {
  title: string
  href?: string | null
  url?: string | null
  active?: boolean
  children?: WebSidebarNode[]
}

/** 树的扁平计数。 */
export function countNodes(nodes: readonly WebSidebarNode[]): number {
  return nodes.reduce<number>((acc, n) => acc + 1 + countNodes(n.children ?? []), 0)
}

/** 找到激活节点路径（含自身）。 */
export function findActivePath(
  nodes: readonly WebSidebarNode[],
  path: WebSidebarNode[] = [],
): WebSidebarNode[] | null {
  for (const node of nodes) {
    const next = [...path, node]
    if (node.active) return next
    if (node.children?.length) {
      const hit = findActivePath(node.children, next)
      if (hit) return hit
    }
  }
  return null
}

export interface WebCategoryChip {
  slug: string
  label: string
  href: string
  active?: boolean
}
