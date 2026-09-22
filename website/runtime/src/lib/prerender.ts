/**
 * 区段混合渲染（列表前 N 页 SSG + 详情/深分页运行时缓存）—— 纯逻辑（node:test）。
 *
 * 为什么需要它：Nitro routeRules 只按路径模式匹配（radix3，无正则），而平台把
 * 「栏目列表 `/articles/{slug}`」与「详情 `/articles/{id}`」放在同一段，规则层面无法区分。
 * 因此采用「兜底 + 排除」两步：
 *   1. routeRules 用 `/<section>/**` 兜底运行时缓存 —— node-server 上 `isr` 是空规则
 *      （既不缓存也不物化渲染路由），只有 `swr` 会被归一化成 `cache:{swr,maxAge}` 并包成
 *      带缓存的渲染路由，所以默认模式取 `swr`（60s 失效 + 后台再生成，即 ISR 语义）；
 *   2. 构建期用 `nitro.prerender.ignore` 谓词排除「详情 + 第 N+1 页起的分页」，
 *      crawler（`crawlLinks`）从列表第 1 页爬取时自然只产出前 N 页。
 *
 * 约定沿用平台既有事实：详情 slug 为纯数字（lib/site.ts `isRecordId`）、
 * 分页为路径式 `/<section>/[{slug}/]page/{n}`（禁用 `?page=`，见编码规范 R7）。
 */
import { LOCALE_PREFIX_RE } from './locale.ts';

/** 渲染模式（站点 nuxt.config `website.rendering`）。 */
export type RenderMode = 'ssg' | 'ssr' | 'spa' | 'swr' | 'isr';

/** 单个区段的混合渲染参数。 */
export interface WebsiteRenderingSection {
  /** 构建期预渲染的列表页数（含第 1 页），默认 10；第 N+1 页起交给运行时缓存。 */
  listSsgPages?: number;
  /** 详情页与更深分页的运行模式，默认 `swr`（60s 失效）。 */
  mode?: RenderMode;
}

/**
 * 全局分页策略：**任何**形如 `/{...}/page/{n}` 的路径，不限区段/模型、不限语言前缀 ——
 * 前 `ssgPages` 页构建期预渲染，第 ssgPages+1 页起运行时缓存（默认 `swr`，60s 失效）。
 */
export interface WebsitePaginationOptions {
  /** 构建期预渲染的分页页数（含第 1 页），默认 10。 */
  ssgPages?: number;
  /** 更深分页的运行模式，默认 `swr`。 */
  mode?: RenderMode;
}

export interface WebsiteRenderingOptions {
  /** 全站默认模式；`ssg` 时自动启用 crawlLinks 预渲染。 */
  default?: RenderMode;
  /** 按路由 pattern 覆盖，如 `{ '/user/**': 'spa' }`；同 key 优先于 `sections`。 */
  overrides?: Record<string, RenderMode>;
  /**
   * `swr` / `isr` 的失效秒数（默认 60）。配了按需失效接口后可以调大（如 3600），
   * 它只是「漏通知时的最长陈旧时间」兜底；到期是 stale-while-revalidate，不会阻塞请求。
   */
  maxAge?: number;
  /**
   * 全局分页策略（推荐，需求「所有带 page 的分页都按前 N 页 SSG、其余运行时缓存」用它）：
   * 生成 `/**` 缓存规则 + 覆盖全站的深分页排除谓词，无需逐区段声明。
   */
  pagination?: WebsitePaginationOptions | boolean;
  /**
   * 区段级混合渲染：键为区段路径（`articles` / `products` / `gallery` / `cases` / `jobs` / `team`），
   * 值为参数或 `true`（全默认）。开启后该区段详情页（纯数字 slug）不参与构建期预渲染；
   * `listSsgPages` 可把该区段的分页预渲染页数收得比 `pagination` 更紧。
   */
  sections?: Record<string, WebsiteRenderingSection | boolean>;
  /** 非默认语言的 URL 短前缀，默认 `['en']`（与 router.options 的 `/en` 别名一致）。 */
  localePrefixes?: string[];
}

/** 区段不显式声明时预渲染的列表页数。 */
export const DEFAULT_LIST_SSG_PAGES = 10;
/** `swr` / `isr` 默认失效秒数。 */
export const DEFAULT_CACHE_MAX_AGE = 60;
/** 非默认语言默认短前缀（与 `router.options.ts` 的 `/en` 别名一致）。 */
export const DEFAULT_LOCALE_PREFIXES = ['en'];
/** 区段详情/深分页默认模式：node-server 上唯一真正生效的缓存模式。 */
export const DEFAULT_SECTION_MODE: RenderMode = 'swr';

export interface SectionPolicy {
  /** 区段基路径，如 `/articles`。 */
  base: string;
  listSsgPages: number;
  mode: RenderMode;
}

/** `sections` 配置 → 有序策略（长路径优先，便于 `/products/x` 与 `/products` 共存时精确匹配）。 */
export function resolveSectionPolicies(
  sections: Record<string, WebsiteRenderingSection | boolean> | undefined,
  defaultListSsgPages: number = DEFAULT_LIST_SSG_PAGES,
): SectionPolicy[] {
  if (!sections) return [];
  const policies: SectionPolicy[] = [];
  for (const [key, value] of Object.entries(sections)) {
    if (!value) continue;
    const base = `/${String(key).replace(/^\/+|\/+$/g, '')}`;
    if (base === '/') continue;
    const section = value === true ? {} : value;
    const pages = Math.floor(Number(section.listSsgPages ?? defaultListSsgPages));
    policies.push({
      base,
      listSsgPages: Number.isFinite(pages) && pages > 0 ? pages : defaultListSsgPages,
      mode: section.mode ?? DEFAULT_SECTION_MODE,
    });
  }
  return policies.sort((a, b) => b.base.length - a.base.length);
}

/** 语言前缀归一化：去斜杠/小写/去重；未声明时用默认 `['en']`，显式传 `[]` 表示「无前缀语言」。 */
export function normalizeLocalePrefixes(prefixes?: readonly string[]): string[] {
  if (prefixes === undefined) return [...DEFAULT_LOCALE_PREFIXES];
  return [...new Set(
    prefixes
      .map((prefix) => String(prefix).trim().replace(/^\/+|\/+$/g, '').toLowerCase())
      .filter(Boolean),
  )];
}

/**
 * 区段路由规则：`/<base>/**` 与各语言前缀变体（`/en/articles/**`）→ 运行模式。
 * 返回值直接喂给 routeRules；已预渲染的页面由静态文件优先命中，不受此规则影响。
 */
export function sectionRouteModes(
  policies: readonly SectionPolicy[],
  localePrefixes?: readonly string[],
): Record<string, RenderMode> {
  const prefixes = normalizeLocalePrefixes(localePrefixes);
  const modes: Record<string, RenderMode> = {};
  for (const policy of policies) {
    modes[`${policy.base}/**`] = policy.mode;
    for (const prefix of prefixes) modes[`/${prefix}${policy.base}/**`] = policy.mode;
  }
  return modes;
}

export interface PaginationPolicy {
  ssgPages: number;
  mode: RenderMode;
}

/** `pagination` 配置 → 策略；未配置返回 null（= 不启用全局分页策略）。 */
export function resolvePaginationPolicy(
  pagination: WebsitePaginationOptions | boolean | undefined,
): PaginationPolicy | null {
  if (!pagination) return null;
  const options = pagination === true ? {} : pagination;
  const pages = Math.floor(Number(options.ssgPages ?? DEFAULT_LIST_SSG_PAGES));
  return {
    ssgPages: Number.isFinite(pages) && pages > 0 ? pages : DEFAULT_LIST_SSG_PAGES,
    mode: options.mode ?? DEFAULT_SECTION_MODE,
  };
}

/**
 * 分页策略的路由规则：`/**` 一条即覆盖全部语言前缀变体
 * （`/en/...`、`/zh-CN/...` 都落在 `/**` 内，无需按前缀枚举）。
 */
export function paginationRouteModes(policy: PaginationPolicy | null): Record<string, RenderMode> {
  return policy ? { '/**': policy.mode } : {};
}

/**
 * 深分页过滤器：路径尾部为 `/page/{n}` 且 `n > ssgPages` → 不预渲染。
 * 只看路径后缀，因此不限区段/模型与语言前缀；第 N+1 页起由 `/**` 缓存规则接管。
 * 若某个区段另有更紧的 `sections.<name>.listSsgPages`，两个谓词取「任一命中即排除」，
 * 效果就是更紧的那个阈值生效。
 */
export function createPaginationPrerenderFilter(
  policy: PaginationPolicy | null,
): ((path: string) => boolean) | null {
  if (!policy) return null;
  const paged = /\/page\/(\d+)\/?$/i;
  return (path: string) => {
    const hit = paged.exec(String(path ?? ''));
    return hit !== null && Number(hit[1]) > policy.ssgPages;
  };
}

/**
 * 构建期预渲染过滤器：返回 `true` 表示「该路径交给运行时缓存渲染，不预渲染」。
 *
 * 命中：① 区段详情 `/<base>/{id}`（最后一段纯数字，含语言前缀变体）；
 *      ② 区分页 `/<base>/[{slug}/]page/{n}` 且 `n > listSsgPages`。
 */
export function createSectionPrerenderFilter(
  policies: readonly SectionPolicy[],
): ((path: string) => boolean) | null {
  if (policies.length === 0) return null;
  const matchers = policies.map((policy) => ({
    detail: new RegExp(`^${escapeRegExp(policy.base)}/\\d+$`),
    paged: new RegExp(`^${escapeRegExp(policy.base)}/(?:[^/]+/)?page/(\\d+)$`),
    listSsgPages: policy.listSsgPages,
  }));
  return (path: string) => {
    const logical = logicalPath(path);
    return matchers.some((matcher) => {
      if (matcher.detail.test(logical)) return true;
      const paged = matcher.paged.exec(logical);
      return paged !== null && Number(paged[1]) > matcher.listSsgPages;
    });
  };
}

/** 去掉 `/en`、`/en-US` 这类首段语言前缀（与 lib/locale.ts 同规则），并去掉尾部斜杠。 */
function logicalPath(path: string): string {
  const stripped = String(path ?? '').replace(LOCALE_PREFIX_RE, '/').replace(/\/+$/, '');
  return stripped.startsWith('/') ? stripped || '/' : `/${stripped}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
