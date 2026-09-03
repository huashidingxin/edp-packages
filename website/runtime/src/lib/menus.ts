/**
 * 站点菜单增强合并(纯函数,node:test 覆盖)。
 *
 * 站点经 app.config.ts 的 website.menuEnhancements 声明增强,
 * runtime layout 合并到 bootstrap 菜单树后再交给 WebHeader。
 * 键可匹配菜单项 title 或 id(title 优先用于 CMS 可编辑场景)。
 */

/** 子项增强:描述 / 缩略图(触发 mega 卡片形态)。 */
export interface MenuChildEnhancement {
  description?: string
  image?: string
}

/** 项级增强:强制 mega + 子项增强。 */
export interface MenuItemEnhancement {
  mega?: boolean
  children?: Record<string, MenuChildEnhancement>
}

/** 按项 title 或 id 索引。 */
export type WebMenuEnhancements = Record<string, MenuItemEnhancement>

interface MutableMenuItem {
  id: number | string
  title: string
  mega?: boolean
  meta?: Record<string, unknown>
  description?: string
  image?: string
  children?: MutableMenuItem[]
}

function matchKey(item: MutableMenuItem, key: string): boolean {
  // id 优先(跨语言稳定);title 作为兼容回退(各语言不同,不推荐)
  return String(item.id) === key || item.title === key
}

/**
 * 返回增强后的新树(浅拷贝节点,不改入参);
 * enhancements 为空时原样返回同一引用(零开销路径)。
 */
export function applyMenuEnhancements<T extends MutableMenuItem>(
  tree: T[] | null | undefined,
  enhancements: WebMenuEnhancements | undefined,
): T[] {
  if (!tree || !enhancements || Object.keys(enhancements).length === 0) return tree ?? []
  return tree.map((item) => {
    const enh = Object.entries(enhancements).find(([key]) => matchKey(item as MutableMenuItem, key))?.[1]
    if (!enh) return item
    const next: T = { ...item }
    if (enh.mega != null) (next as MutableMenuItem).mega = enh.mega
    if (enh.children) {
      next.children = (item.children ?? []).map((child) => {
        const childEnh = Object.entries(enh.children ?? {}).find(([k]) => matchKey(child as MutableMenuItem, k))?.[1]
        return childEnh ? { ...child, ...childEnh } : child
      })
    }
    return next
  })
}
