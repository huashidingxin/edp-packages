/**
 * /website-runtime —— 纯基建出口（模块入口由 Nuxt 直接指向 module.ts）。
 */
export { default as default } from './module.ts';
export type { WebsiteRuntimeOptions, WebsiteRenderingOptions, RenderMode } from './module.ts';

// composables / lib 显式导出（layout 等模块内文件无法使用 Nuxt auto-import）
export * from './composables/useSite.ts';
export * from './composables/useT.ts';
export * from './composables/useLocale.ts';
export * from './composables/useLocaleLight.ts';
export * from './composables/useWebReveal.ts';
export * from './lib/site.ts';

