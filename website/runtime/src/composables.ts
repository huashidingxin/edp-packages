/**
 * /website-runtime —— composables / lib 公共出口（运行时安全，不含 @nuxt/kit）。
 * 供站点与模块内 layout 显式 import；站点亦可依赖 Nuxt auto-import。
 */

// ── composables ─────────────────────────────────────────
export {
  useSiteClient,
  useSiteBootstrap,
  useSitePageData,
  useSiteCollection,
  useSiteRecord,
  useSiteCategory,
  submitForm,
  useBootstrapSite,
  useBootstrapMenus,
  useBootstrapTheme,
  useBootstrapStrings,
} from './composables/useSite.ts';

export { useLocale, type LocaleLink, type SiteLocaleInfo } from './composables/useLocale.ts';
export { useLocaleLight } from './composables/useLocaleLight.ts';
export { useT } from './composables/useT.ts';
export { useWebReveal, type WebRevealOptions } from './composables/useWebReveal.ts';

// ── lib ─────────────────────────────────────────────────
export {
  recordPath,
  categoryPath,
  isRecordId,
  fallbackLabelOption,
  taxonomyToNav,
  useSiteNavigation,
  type TaxonomyEntry,
  type BrandEntry,
  type SidebarNode,
  type SiteNavigationConfig,
} from './lib/site.ts';
export { applyMenuEnhancements } from './lib/menus.ts';
export type { WebMenuEnhancements, MenuItemEnhancement, MenuChildEnhancement } from './lib/menus.ts';
