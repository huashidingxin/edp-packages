/**
 * 公共 site 工具与导航配置。
 *
 * 站点差异（默认栏目、联系页路径、about 路由映射、表单绑定、标语）由后端
 * `bootstrap.navigation` 下发（applications.settings.navigation，各站 seed 写入），
 * 公共页通过 `useSiteNavigation()` 读取；前端不再有 `lib/site.ts` 站点配置注入。
 */
import type { ComputedRef } from 'vue'
import { computed } from 'vue'
import { useSiteBootstrap } from '../composables/useSite.ts'
import type { BootstrapResponse } from '@edp/website-ui/contracts'

/** 通用分类条目。 */
export interface TaxonomyEntry {
  slug: string
  label: string
}

/** 分类侧栏节点（来自接口 category 上下文的 sidebar 树，含 active 高亮）。 */
export interface SidebarNode {
  title: string
  href?: string | null
  url?: string | null
  active?: boolean
  children?: SidebarNode[]
}

/** 双品牌条目（如廊坊「丹顶鹤 / WGW」）。 */
export interface BrandEntry extends TaxonomyEntry {
  children: TaxonomyEntry[]
}

/** 站点导航配置（bootstrap.navigation 映射后的前端形态）。 */
export interface SiteNavigationConfig {
  /** /articles 默认栏目 slug（`/articles` 重定向目标）。 */
  defaultArticlesSlug: string
  /** /gallery 默认栏目 slug。 */
  defaultGallerySlug: string
  /** /about 默认页面 slug（`/about` 简写重定向目标）。 */
  defaultAboutSlug: string
  /** 站点联系页逻辑路径（绝对，locale 前缀由 useLocale 拼接）。 */
  contactPath: string
  /** 联系页关联的表单 code（公共页 ContactForm 渲染用）。 */
  contactFormCode?: string
  /** 站点默认申请表单 code（职位详情投递用；职位级 apply_form_code 优先）。 */
  applyFormCode?: string
  /** 校招渠道（channel=campus）默认申请表单 code，缺省回落 applyFormCode。 */
  applyFormCodeCampus?: string
  /** 产品品牌 slug 列表（公共 products 总览页按 sections.{slug} 渲染，可选）。 */
  productBrandSlugs?: string[]
  /** 顶栏标语（contact.slogan 未配置时的兜底）。 */
  slogan?: string
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' && v !== '' ? v : fallback
}
function arr(v: unknown): string[] {
  return Array.isArray(v) ? v.map(String) : []
}

/** 读取站点导航配置（bootstrap.navigation；后端未配时回落默认值）。 */
export function useSiteNavigation(): ComputedRef<SiteNavigationConfig> {
  const { data } = useSiteBootstrap()
  return computed(() => {
    const nav = ((data.value as BootstrapResponse | null)?.navigation ?? {}) as Record<string, unknown>
    return {
      defaultArticlesSlug: str(nav.default_articles_slug ?? nav.default_insights_slug, 'xinwenzhongxin'),
      defaultGallerySlug: str(nav.default_gallery_slug, 'rongyuzizhi'),
      defaultAboutSlug: str(nav.default_about_slug, 'gongsijianjie'),
      contactPath: str(nav.contact_path, '/about/contact-us'),
      contactFormCode: str(nav.contact_form_code) || undefined,
      applyFormCode: str(nav.apply_form_code) || undefined,
      applyFormCodeCampus: str(nav.apply_form_code_campus) || undefined,
      productBrandSlugs: arr(nav.product_brand_slugs),
      slogan: str(nav.slogan) || undefined,
    }
  })
}

/** 详情页路径：record_navigation 只返回 `{title,id,slug}`，path 由前端按 kind 拼。 */
export function recordPath(kind: 'product' | 'article' | 'gallery' | 'case' | 'job', id: number | string): string {
  if (kind === 'product') return `/products/${id}`
  if (kind === 'gallery') return `/gallery/${id}`
  if (kind === 'case') return `/cases/${id}`
  if (kind === 'job') return `/jobs/${id}`
  return `/articles/${id}`
}

/** 列表页路径。 */
export function categoryPath(family: 'products' | 'articles' | 'gallery' | 'about', slug: string): string {
  return `/${family}/${slug}`
}

/** 判断路由参数是详情 id（纯数字）还是分类 slug。 */
export function isRecordId(slug?: string | null): boolean {
  return !!slug && /^\d+$/.test(slug)
}

/** 从一组 TaxonomyEntry 中查找标签，找不到返回 null。 */
export function fallbackLabelOption(slug: string | null | undefined, list: readonly TaxonomyEntry[]): string | null {
  if (!slug) return null
  return list.find((e) => e.slug === slug)?.label ?? null
}

/** 把站点的 `TaxonomyEntry[]` 转为带 href 的导航列表（用于面包屑/胶囊等）。 */
export function taxonomyToNav(
  entries: readonly TaxonomyEntry[],
  base: string,
  toHref: (slug: string, base: string) => string = (slug, b) => `${b}/${slug}`,
): Array<TaxonomyEntry & { href: string }> {
  return entries.map((e) => ({ ...e, href: toHref(e.slug, base) }))
}
