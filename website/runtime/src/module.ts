/**
 * @edp/website-runtime —— 站点运行时：基建 + 标准页面模板库（按模块按需注册）。
 *
 * 职责：
 * - SSR SiteClient 注入 + bootstrap 预取 + 会话 provider 配置
 * - composables / lib 自动 imports
 * - 公共 layout / app.vue / router.options 兜底（站点本地同名文件优先）
 * - **标准页面模板**（home/products/articles/gallery/cases/about/catch-all），
 *   经 `website.modules` 按需注册：关掉的模块路由不进构建产物（真·按需打包）；
 *   站点本地同名页面存在时自动跳过对应模板（单页覆写粒度）
 * - 站点挂点组件目录（components/，优先级低于站点，可同名覆盖，如 SiteRecordMedia）
 * - 渲染策略声明（website.rendering）→ Nitro routeRules 编译：
 *     default 'ssg'  → 全站预渲染（配合 `nuxt generate` 静态托管）
 *     overrides      → 单路径 'ssr' | 'spa' | 'swr' | 'isr'，混合站才需要 Node
 *
 * 站点 nuxt.config 最小用法：
 *   modules: ['@edp/website-runtime']
 *   runtimeConfig: { apiBase, public: { forceHost, previewDomain, apiBase } }
 */
import { defineNuxtModule, addPlugin, addImportsDir, addLayout, addTypeTemplate, addComponentsDir, useLogger } from '@nuxt/kit'
import { defu } from 'defu'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolveModulesOptions, type WebsiteModulesOptions, type ResolvedWebsiteModules } from './lib/modules.ts'
import { findLayoutNuxtLayoutUsage } from './lib/layoutLint.ts'

const moduleDir = dirname(fileURLToPath(import.meta.url))

/** 页面渲染模式。 */
export type RenderMode = 'ssg' | 'ssr' | 'spa' | 'swr' | 'isr'

export interface WebsiteRenderingOptions {
  /** 全站默认模式；'ssg' 时自动启用 crawlLinks 预渲染。 */
  default?: RenderMode
  /** 按路由 pattern 覆盖，如 { '/user/**': 'spa' }。 */
  overrides?: Record<string, RenderMode>
}

export interface WebsiteRuntimeOptions {
  registerComposables: boolean
  registerTemplates: boolean
  /** 标准模块开关；未配置 = 全开。 */
  modules?: WebsiteModulesOptions
  /** 有状态全局挂件：chat 由 bootstrap ai_chat.enabled 决定；user 为登录注水岛开关。 */
  widgets: { chat: boolean; user: boolean }
  rendering?: WebsiteRenderingOptions
}

/** 模板路由表：path → 模板文件 + 生效模块门 + 站点本地覆写文件。 */
const TEMPLATE_PAGES: Array<{
  path: string
  name: string
  file: string
  /** 解析后模块键；null = 恒注册（catch-all）。 */
  gate: keyof ResolvedWebsiteModules | null
  local: string
}> = [
  { path: '/', name: 'website-index', file: resolve(moduleDir, 'pages/index.vue'), gate: 'home', local: 'index.vue' },
  { path: '/products', name: 'website-products', file: resolve(moduleDir, 'pages/products/index.vue'), gate: 'productsListing', local: 'products/index.vue' },
  { path: '/products/:slug()', name: 'website-products-slug', file: resolve(moduleDir, 'pages/products/[slug].vue'), gate: 'productsDetail', local: 'products/[slug].vue' },
  { path: '/articles', name: 'website-articles', file: resolve(moduleDir, 'pages/articles/index.vue'), gate: 'articles', local: 'articles/index.vue' },
  { path: '/articles/:slug()', name: 'website-articles-slug', file: resolve(moduleDir, 'pages/articles/[slug].vue'), gate: 'articles', local: 'articles/[slug].vue' },
  { path: '/gallery', name: 'website-gallery', file: resolve(moduleDir, 'pages/gallery/index.vue'), gate: 'gallery', local: 'gallery/index.vue' },
  { path: '/gallery/:slug()', name: 'website-gallery-slug', file: resolve(moduleDir, 'pages/gallery/[slug].vue'), gate: 'gallery', local: 'gallery/[slug].vue' },
  { path: '/cases', name: 'website-cases', file: resolve(moduleDir, 'pages/cases/index.vue'), gate: 'cases', local: 'cases/index.vue' },
  { path: '/cases/:slug()', name: 'website-cases-slug', file: resolve(moduleDir, 'pages/cases/[slug].vue'), gate: 'cases', local: 'cases/[slug].vue' },
  { path: '/jobs', name: 'website-jobs', file: resolve(moduleDir, 'pages/jobs/index.vue'), gate: 'jobs', local: 'jobs/index.vue' },
  { path: '/jobs/:slug()', name: 'website-jobs-slug', file: resolve(moduleDir, 'pages/jobs/[slug].vue'), gate: 'jobs', local: 'jobs/[slug].vue' },
  { path: '/about/:slug()', name: 'website-about-slug', file: resolve(moduleDir, 'pages/about/[slug].vue'), gate: 'about', local: 'about/[slug].vue' },
  { path: '/:pathMatch(.*)*', name: 'website-catch-all', file: resolve(moduleDir, 'pages/[...slug].vue'), gate: null, local: '[...slug].vue' },
]

function hasLocalPage(pagesDir: string, relative: string): boolean {
  const base = relative.endsWith('.vue') ? relative.slice(0, -4) : relative
  return ['.vue', '.ts', '.js'].some((ext) => existsSync(resolve(pagesDir, `${base}${ext}`)))
}

/**
 * 扫描站点本地 layouts/*.vue，发现自引用 <NuxtLayout> 即醒目报错（详见 src/lib/layoutLint.ts 注释）。
 * 自递归的症状是 dev server 首个页面请求起 100% CPU 死循环 —— 启动期直接前置报出。
 */
function lintLocalLayouts(nuxt: { options: { srcDir: string } }): void {
  const layoutsDir = resolve(nuxt.options.srcDir, 'layouts')
  if (!existsSync(layoutsDir)) return
  const names = readdirSync(layoutsDir).filter((f) => f.endsWith('.vue'))
  if (names.length === 0) return
  const contents: Record<string, string> = {}
  for (const name of names) contents[name] = readFileSync(resolve(layoutsDir, name), 'utf-8')
  const findings = findLayoutNuxtLayoutUsage(contents)
  const fatal = findings.filter((f) => f.kind === 'self')
  const nested = findings.filter((f) => f.kind === 'nested')
  const logger = useLogger('@edp/website-runtime')
  if (fatal.length > 0) {
    logger.error([
      '──────────────────────────────────────────────────────────',
      '⚠️  检测到本地 layout 自引用 <NuxtLayout> —— 必然无限递归！',
      ...fatal.map((f) => `  · layouts/${f.file}: ${f.snippet.slice(0, 60)}`),
      '  无 name 的 <NuxtLayout> 渲染的是「当前激活 layout」（即它自身）→ 死循环；',
      '  症状：dev server 收到首个页面请求后 100% CPU，页面永不响应。',
      '  修复：layout 内禁止渲染 <NuxtLayout>。页头/页脚定制请通过 app.vue',
      '  的 <NuxtLayout> 具名插槽传入（公共 layout 有 footer-* 插槽透传约定）。',
      '──────────────────────────────────────────────────────────',
    ].join('\n'))
  }
  if (nested.length > 0) {
    logger.warn([
      '⚠️  本地 layout 内嵌套渲染了具名 <NuxtLayout name="…">（非自递归，但常见误用）：',
      ...nested.map((f) => `  · layouts/${f.file}: ${f.snippet.slice(0, 60)}`),
      '  若本意是复用公共 layout 的页头/页脚，应删掉本地 layout、改走 app.vue 插槽。',
    ].join('\n'))
  }
}

function modeToRouteRule(mode: RenderMode): Record<string, unknown> {
  switch (mode) {
    case 'ssg':
      return { prerender: true }
    case 'spa':
      return { ssr: false }
    case 'swr':
      return { swr: 60 }
    case 'isr':
      return { isr: 60 }
    default:
      return {}
  }
}

export default defineNuxtModule({
  meta: {
    name: '@edp/website-runtime',
    configKey: 'website',
    compatibility: { nuxt: '^4.0.0' },
  },
  defaults: {
    registerComposables: true,
    registerTemplates: true,
    modules: {},
    widgets: { chat: true, user: false },
    rendering: { default: 'ssg', overrides: {} },
  } as WebsiteRuntimeOptions,
  setup(options, nuxt) {
    // SSR SiteClient 注入 + bootstrap 预取 + 会话配置（universal 插件）
    addPlugin({ src: resolve(moduleDir, 'plugin.site.ts') })

    // composables 自动导入（useSite/useT/useLocale/useSitePageData …）
    if (options.registerComposables) {
      addImportsDir(resolve(moduleDir, 'composables'))
      addImportsDir(resolve(moduleDir, 'lib'))
    }

    // 站点挂点组件（低优先级：站点 app/components 同名即覆盖）
    addComponentsDir({
      path: resolve(moduleDir, 'components'),
      prefix: '',
      priority: 5,
    })

    // 公共 layout 兜底 —— 站点无本地 layouts/default.vue 时启用
    if (!existsSync(resolve(nuxt.options.srcDir, 'layouts/default.vue'))) {
      addLayout(resolve(moduleDir, 'layouts/default.vue'), 'default')
    }

    // 本地 layout 自引用 <NuxtLayout> 检测 —— 自递归会让 dev server 100% CPU 死锁且症状隐蔽，启动期前置报出
    lintLocalLayouts(nuxt)

    // app.vue 兜底
    if (!existsSync(resolve(nuxt.options.srcDir, 'app.vue'))) {
      nuxt.hook('app:resolve', (app) => {
        app.mainComponent = resolve(moduleDir, 'app.vue')
      })
    }

    // router.options 兜底 —— /{lang} 前缀别名
    const siteRouterOptions = ['.ts', '.mjs', '.js']
      .map((ext) => resolve(nuxt.options.srcDir, `router.options${ext}`))
      .some((p) => existsSync(p))
    if (!siteRouterOptions) {
      nuxt.hook('pages:routerOptions', (ctx) => {
        ctx.files.push({ path: resolve(moduleDir, 'router.options.ts'), optional: false })
      })
    }

    // 类型注入（$site / RuntimeConfig / AppConfig / *.vue shim）
    addTypeTemplate({
      filename: 'types/website-env.d.ts',
      getContents: () => readFileSync(resolve(moduleDir, 'env.d.ts'), 'utf-8'),
    })

    /* ---------- 模块解析 + 模板路由注册 ---------- */
    const modules = resolveModulesOptions(options.modules)
    // 注入 appConfig（构建期常量）：模板页经 useAppConfig() 读取变体等
    nuxt.options.appConfig = defu(nuxt.options.appConfig as Record<string, unknown>, {
      website: { modules },
    }) as typeof nuxt.options.appConfig

    if (options.registerTemplates) {
      const pagesDir = resolve(nuxt.options.srcDir, 'pages')
      nuxt.hook('pages:extend', (pages) => {
        for (const tpl of TEMPLATE_PAGES) {
          if (tpl.gate && !modules[tpl.gate]) continue
          if (hasLocalPage(pagesDir, tpl.local)) continue
          const exists = pages.some((p) => (p.path ?? '') === tpl.path)
          if (exists) continue
          pages.push({ path: tpl.path, name: tpl.name, file: tpl.file, meta: { websiteModules: modules } })
        }
      })
    }

    /* ---------- 渲染策略 → routeRules ---------- */
    const rendering = options.rendering ?? {}
    const rules: Record<string, Record<string, unknown>> = {}
    for (const [pattern, mode] of Object.entries(rendering.overrides ?? {})) {
      rules[pattern] = modeToRouteRule(mode)
    }
    const def = rendering.default ?? 'ssg'
    if (def !== 'ssr') {
      const rule = modeToRouteRule(def)
      if (rule && Object.keys(rule).length > 0 && !rules['/**']) {
        rules['/**'] = rule
      }
    }
    const nitroOptions = (nuxt.options as unknown as { nitro?: Record<string, unknown> }).nitro ??= {}
    if (Object.keys(rules).length > 0) {
      nitroOptions.routeRules = { ...rules, ...((nitroOptions.routeRules as Record<string, unknown>) ?? {}) }
    }
    if (def === 'ssg') {
      nitroOptions.prerender = {
        crawlLinks: true,
        routes: ['/'],
        ...((nitroOptions.prerender as Record<string, unknown>) ?? {}),
      }
    }

    // widgets 开关透传给 layout（经 runtimeConfig public）
    nuxt.options.runtimeConfig.public = nuxt.options.runtimeConfig.public ?? {}
    ;(nuxt.options.runtimeConfig.public as Record<string, unknown>).chatWidget =
      (nuxt.options.runtimeConfig.public as Record<string, unknown>).chatWidget ?? options.widgets.chat
    ;(nuxt.options.runtimeConfig.public as Record<string, unknown>).userWidget =
      (nuxt.options.runtimeConfig.public as Record<string, unknown>).userWidget ?? options.widgets.user
  },
})
