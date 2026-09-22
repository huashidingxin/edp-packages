/**
 * @edp/website-runtime —— 站点运行时：基建 + 标准页面模板库（按模块按需注册）。
 *
 * 职责：
 * - SSR SiteClient 注入 + bootstrap 预取 + 会话 provider 配置
 * - composables / lib 自动 imports
 * - 公共 layout / app.vue / router.options 兜底（站点本地同名文件优先）
 * - **标准页面模板**（home/products/articles/gallery/cases/jobs/team/about/catch-all），
 *   经 `website.modules` 按需注册：关掉的模块路由不进构建产物（真·按需打包）；
 *   站点本地同名页面存在时自动跳过对应模板（单页覆写粒度）
 * - 站点挂点组件目录（components/，优先级低于站点，可同名覆盖，如 SiteRecordMedia）
 * - 渲染策略声明（website.rendering）→ Nitro routeRules 编译：
 *     default 'ssg'  → 全站预渲染（配合 `nuxt generate` 静态托管）
 *     overrides      → 单路径 'ssr' | 'spa' | 'swr' | 'isr'，混合站才需要 Node
 *     pagination     → 全局分页：任何 `/{...}/page/{n}` 前 N 页预渲染，其余运行时缓存
 *     sections       → 区段混合：该区段详情页（纯数字 slug）转运行时缓存
 *                      （见 lib/prerender.ts；node-server 上用 'swr'，'isr' 是空规则）
 * - 缓存按需失效端点 `POST /api/__isr/revalidate`：后端内容发布后立即刷新页面
 *   （HMAC 签名 + 时间窗 + nonce，见 lib/revalidate.ts；未配 secret 即 404）
 *
 * 站点 nuxt.config 最小用法：
 *   modules: ['@edp/website-runtime']
 *   runtimeConfig: { apiBase, public: { forceHost, apiBase } }
 */
import { defineNuxtModule, addPlugin, addImportsDir, addLayout, addTypeTemplate, addComponentsDir, addServerHandler, useLogger } from '@nuxt/kit'
import { defu } from 'defu'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolveModulesOptions, type WebsiteModulesOptions, type ResolvedWebsiteModules } from './lib/modules.ts'
import { findLayoutNuxtLayoutUsage } from './lib/layoutLint.ts'
import {
  DEFAULT_CACHE_MAX_AGE,
  createPaginationPrerenderFilter,
  createSectionPrerenderFilter,
  normalizeLocalePrefixes,
  paginationRouteModes,
  resolvePaginationPolicy,
  resolveSectionPolicies,
  sectionRouteModes,
  type RenderMode,
  type WebsiteRenderingOptions,
} from './lib/prerender.ts'
import { REVALIDATE_ROUTE, type PageCodePaths } from './lib/revalidate.ts'

const moduleDir = dirname(fileURLToPath(import.meta.url))

export type { RenderMode, WebsitePaginationOptions, WebsiteRenderingSection, WebsiteRenderingOptions } from './lib/prerender.ts'
export type { PageCodePaths, RevalidatePayload, RevalidateScope } from './lib/revalidate.ts'

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
  dataCode?: string
}> = [
  { path: '/', name: 'website-index', file: resolve(moduleDir, 'pages/index.vue'), gate: 'home', local: 'index.vue', dataCode: 'home' },
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
  { path: '/team', name: 'website-team', file: resolve(moduleDir, 'pages/team/index.vue'), gate: 'team', local: 'team/index.vue' },
  { path: '/team/:id()', name: 'website-team-id', file: resolve(moduleDir, 'pages/team/[id].vue'), gate: 'team', local: 'team/[id].vue' },
  { path: '/about/:slug()', name: 'website-about-slug', file: resolve(moduleDir, 'pages/about/[slug].vue'), gate: 'about', local: 'about/[slug].vue', dataCode: 'about-:slug' },
  { path: '/:pathMatch(.*)*', name: 'website-catch-all', file: resolve(moduleDir, 'pages/[...slug].vue'), gate: null, local: '[...slug].vue' },
]

function hasLocalPage(pagesDir: string, relative: string): boolean {
  const base = relative.endsWith('.vue') ? relative.slice(0, -4) : relative
  return ['.vue', '.ts', '.js'].some((ext) => existsSync(resolve(pagesDir, `${base}${ext}`)))
}

/**
 * 收集 `page code → 路由路径`：
 * - 模板页直接读注册时写入的 `meta.sitePageData.code`；
 * - 站点本地页从文件里读 `definePageMeta({ sitePageData: { code } })`（与 layoutLint 同手法，
 *   pages:extend 阶段拿不到 Nuxt 后续解析出的 meta）。
 * 带动态段的 code（如 `about-:slug` → `/about/:slug`）收为前缀模式。
 */
function collectPageCodePaths(
  pages: Array<{ path?: string; file?: string; meta?: Record<string, unknown> }>,
  target: PageCodePaths,
): void {
  for (const page of pages) {
    const path = page.path
    if (!path) continue
    const meta = page.meta?.sitePageData as { code?: string } | undefined
    const code = meta?.code ?? readPageCode(page.file)
    if (!code) continue
    registerPageCode(target, code, path)
  }
}

function readPageCode(file?: string): string | null {
  if (!file) return null
  try {
    const source = readFileSync(file, 'utf-8')
    const match = source.match(/sitePageData\s*:\s*\{[\s\S]{0,160}?code\s*:\s*['"]([a-z0-9][a-z0-9_-]*)['"]/)
    return match?.[1] ?? null
  } catch {
    return null
  }
}

function registerPageCode(target: PageCodePaths, code: string, path: string): void {
  const normalized = path.endsWith('/') && path !== '/' ? path.slice(0, -1) : path
  const codeSplit = code.indexOf(':')
  const pathSplit = normalized.indexOf(':')
  if (codeSplit === -1 && pathSplit === -1) {
    target.exact[code] = normalized
    return
  }
  if (codeSplit > 0 && pathSplit > 0) {
    const codePrefix = code.slice(0, codeSplit)
    const pathPrefix = normalized.slice(0, normalized.lastIndexOf('/', pathSplit) + 1)
    target.patterns.push({ codePrefix, pathPrefix: pathPrefix || '/' })
  }
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

function modeToRouteRule(mode: RenderMode, maxAge: number = DEFAULT_CACHE_MAX_AGE): Record<string, unknown> {
  switch (mode) {
    case 'ssg':
      return { prerender: true }
    case 'spa':
      return { ssr: false }
    case 'swr':
      return { swr: maxAge }
    case 'isr':
      return { isr: maxAge }
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
    rendering: { default: 'ssg', overrides: {}, sections: {} },
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

    // page code → 路由路径（缓存失效的依赖清单用：后端只知道 code，站点负责翻成 URL）
    const pageCodePaths: PageCodePaths = { exact: {}, patterns: [] }

    if (options.registerTemplates) {
      const pagesDir = resolve(nuxt.options.srcDir, 'pages')
      nuxt.hook('pages:extend', (pages) => {
        for (const tpl of TEMPLATE_PAGES) {
          if (tpl.gate && !modules[tpl.gate]) continue
          if (hasLocalPage(pagesDir, tpl.local)) continue
          const exists = pages.some((p) => (p.path ?? '') === tpl.path)
          if (exists) continue
          pages.push({ path: tpl.path, name: tpl.name, file: tpl.file, meta: { websiteModules: modules, ...(tpl.dataCode ? { sitePageData: { code: tpl.dataCode } } : {}) } })
        }
        collectPageCodePaths(pages, pageCodePaths)
      })
    } else {
      nuxt.hook('pages:extend', (pages) => collectPageCodePaths(pages, pageCodePaths))
    }

    /* ---------- 缓存按需失效端点 ---------- */
    // POST /api/__isr/revalidate：后端发布内容后立即刷新相关页面；未配 secret 时端点返回 404
    addServerHandler({
      route: REVALIDATE_ROUTE,
      method: 'post',
      handler: resolve(moduleDir, 'server/revalidate.ts'),
    })

    /* ---------- 渲染策略 → routeRules ---------- */
    const rendering = options.rendering ?? {}
    const sectionPolicies = resolveSectionPolicies(rendering.sections)
    const paginationPolicy = resolvePaginationPolicy(rendering.pagination)
    const maxAge = Math.max(Math.floor(Number(rendering.maxAge ?? DEFAULT_CACHE_MAX_AGE)) || DEFAULT_CACHE_MAX_AGE, 1)
    const rules: Record<string, Record<string, unknown>> = {}
    // 区段混合渲染先铺 `/<section>/**`（含语言前缀变体），显式 overrides 后写并覆盖同 key
    for (const [pattern, mode] of Object.entries(sectionRouteModes(sectionPolicies, rendering.localePrefixes))) {
      rules[pattern] = modeToRouteRule(mode, maxAge)
    }
    // 全局分页策略：`/**` 一条覆盖所有区段与语言前缀（未预渲染的页面按 mode 缓存渲染）
    for (const [pattern, mode] of Object.entries(paginationRouteModes(paginationPolicy))) {
      rules[pattern] = modeToRouteRule(mode, maxAge)
    }
    for (const [pattern, mode] of Object.entries(rendering.overrides ?? {})) {
      rules[pattern] = modeToRouteRule(mode, maxAge)
    }
    const def = rendering.default ?? 'ssg'
    if (def !== 'ssr') {
      const rule = modeToRouteRule(def, maxAge)
      if (rule && Object.keys(rule).length > 0 && !rules['/**']) {
        rules['/**'] = rule
      }
    }
    // API/端点一律不进页面缓存：Nitro 的缓存键只含 URL（POST 请求体不参与），
    // 一旦被缓存会把首个响应复用给后续调用（revalidate 端点自身踩过这个坑）。
    // 必须在规则全部生成之后判断（含 default 推导出的 `/**`）。
    if (Object.values(rules).some((rule) => 'cache' in rule || 'swr' in rule || 'isr' in rule)) {
      rules['/api/**'] = { cache: false }
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
    // 混合策略必须同时排除「详情 + 深分页」的预渲染，否则 crawler 会把它们一并产出（静态文件优先 → 白配缓存）
    const prerenderFilters = [
      createSectionPrerenderFilter(sectionPolicies),
      createPaginationPrerenderFilter(paginationPolicy),
    ].filter((filter): filter is (path: string) => boolean => filter !== null)
    if (prerenderFilters.length > 0) {
      const prerender = (nitroOptions.prerender as Record<string, unknown>) ?? {}
      const ignore = Array.isArray(prerender.ignore) ? prerender.ignore : []
      nitroOptions.prerender = { ...prerender, ignore: [...ignore, ...prerenderFilters] }
    }

    /* ---------- 缓存失效端点的运行期配置（私有） ---------- */
    const publicConfig = (nuxt.options.runtimeConfig.public ?? {}) as Record<string, unknown>
    const existingRevalidate = (nuxt.options.runtimeConfig.revalidate ?? {}) as Record<string, unknown>
    nuxt.options.runtimeConfig.revalidate = defu(existingRevalidate, {
      // 未配置即视作未启用（端点 404）；运行期可用 NUXT_REVALIDATE_SECRET 覆盖
      secret: String(process.env.NUXT_ISR_REVALIDATE_SECRET || process.env.NUXT_REVALIDATE_SECRET || ''),
      applicationCode: String(publicConfig.applicationCode ?? process.env.NUXT_PUBLIC_APPLICATION_CODE ?? ''),
      localePrefixes: normalizeLocalePrefixes(rendering.localePrefixes),
      // 对象在 pages:extend 阶段被填充（同引用，构建后期读取）
      pageCodePaths,
    })

    // widgets 开关透传给 layout（经 runtimeConfig public）
    nuxt.options.runtimeConfig.public = nuxt.options.runtimeConfig.public ?? {}
    ;(nuxt.options.runtimeConfig.public as Record<string, unknown>).chatWidget =
      (nuxt.options.runtimeConfig.public as Record<string, unknown>).chatWidget ?? options.widgets.chat
    ;(nuxt.options.runtimeConfig.public as Record<string, unknown>).userWidget =
      (nuxt.options.runtimeConfig.public as Record<string, unknown>).userWidget ?? options.widgets.user
  },
})
