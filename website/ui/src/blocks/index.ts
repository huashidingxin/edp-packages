/**
 * /website-ui —— 语义 block 层。
 * 视觉默认值走令牌工具类；站点通过 o-* 语义类 / data-attr / CSS 变量 /
 * 插槽 / 同名组件替换 五级逃生口定制。规范见 BLOCKS_SPEC.md。
 */

// ── 基础件 ────────────────────────────────────────────
export { default as WebCarousel } from './WebCarousel.vue';
export { default as WebMarquee } from './WebMarquee.vue';
export { default as WebSection } from './WebSection.vue';
export { default as WebGrid } from './WebGrid.vue';
export { default as WebBreadcrumbs } from './WebBreadcrumbs.vue';
export type { WebBreadcrumbEntry } from './WebBreadcrumbs.vue';
export { default as WebPagination } from './WebPagination.vue';
export { default as WebRichText } from './WebRichText.vue';

// ── 站点骨架 ──────────────────────────────────────────
export { default as WebHeader } from './WebHeader.vue';
export type { WebHeaderMenuItem, WebHeaderLocaleLink } from './WebHeader.vue';
export { default as WebFooter } from './WebFooter.vue';
export type { WebFooterMenuLink } from './WebFooter.vue';

// ── 内容块 ────────────────────────────────────────────
export { default as WebCard } from './WebCard.vue';
export { default as WebShare } from './WebShare.vue';
export { default as WebHero } from './WebHero.vue';
export type { WebHeroAction, WebHeroSlide } from './WebHero.vue';
export { CARD_KIND_DEFAULT_RATIO, type WebCardKind } from './card.ts';

// ── 页面块 ────────────────────────────────────────────
export { default as WebCollectionPage } from './WebCollectionPage.vue';
export { default as WebAbout } from './WebAbout.vue';
export type { WebAboutFeature, WebAboutMilestone, WebAboutStat } from './WebAbout.vue';
export { default as WebRecordPage } from './WebRecordPage.vue';
export type { WebRecordNavItem } from './WebRecordPage.vue';
export { countNodes, findActivePath, type WebSidebarNode, type WebCategoryChip } from './collection.ts';

// ── 表单 / 会话 / 客服 ────────────────────────────────
export { default as WebContactForm } from './WebContactForm.vue';
export type { FormT } from './WebContactForm.vue';
export { default as WebFormFieldControl } from './WebFormFieldControl.vue';
export { default as WebUserArea } from './WebUserArea.vue';
export { default as WebChatWidget } from './WebChatWidget.vue';
export { default as WebServiceSidebar } from './WebServiceSidebar.vue';
