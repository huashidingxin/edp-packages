import type {
  ContextRef,
  HreflangEntry,
  LocaleCode,
  MenuItem,
  RecordNavigationItem,
  SiteInfo,
  SiteMenus,
  SourceItem,
  SourceResult,
  ThemeInfo,
} from './common.ts';

/** GET /api/v1/site/bootstrap */
export interface BootstrapResponse {
  site: SiteInfo;
  theme: ThemeInfo;
  menus: SiteMenus;
  /**
   * 站点导航/路由配置（默认栏目落地页、联系页路径与表单、about 路由映射、品牌 sections 等）。
   * 来源 applications.settings.navigation（各站 seed 写入）；缺省由前端回落。
   */
  navigation?: SiteNavigation;
  /**
   * UI 词条（chrome 文本翻译字典，按当前语言返回，缺译回退默认语言）。
   * key 约定：全局词条 = source（默认语言原文）；位置级覆盖 = "context:source"。
   * 未命中的词条由前端回退到内联字面量（即默认语言原文）。
   */
  strings: Record<string, string>;
}

/** 站点导航/路由配置（bootstrap.navigation）。 */
export interface SiteNavigation {
  default_articles_slug?: string | null;
  default_gallery_slug?: string | null;
  default_about_slug?: string | null;
  contact_path?: string | null;
  contact_form_code?: string | null;
  /** 站点默认申请表单 code（职位详情投递用；职位级 apply_form_code 优先）。 */
  apply_form_code?: string | null;
  /** 校招渠道（channel=campus）默认申请表单 code，缺省回落 apply_form_code。 */
  apply_form_code_campus?: string | null;
  product_brand_slugs?: string[] | null;
  slogan?: string | null;
}

/* ---------- 轻量接口的响应类型 ---------- */

/** GET /api/v1/site/collections/{type} 与 page-data.sections 中的集合区块。 */
export interface CollectionResponse {
  items: SourceItem[];
  meta: SourceResult['meta'];
  /** 当请求带 category_slug / Provider 内部已解析时返回。 */
  category?: { id: number; values: Record<string, unknown>; family: string };
}

/** GET /api/v1/site/records/{type}/{id}。 */
export interface RecordResponse {
  record: SourceItem | null;
  seo?: Record<string, unknown>;
  navigation?: {
    previous?: RecordNavigationItem | null;
    next?: RecordNavigationItem | null;
  };
  category_id?: number;
  locales?: HreflangEntry[];
  category?: { id: number; values: Record<string, unknown>; family: string };
}

/** GET /api/v1/site/category。 */
export interface CategoryResponse {
  category: { id: number; values: Record<string, unknown>; family: string };
  template: { type: string; title: string } | null;
}

/** GET /api/v1/site/content。 */
export interface ContentResponse {
  content: Record<string, unknown> | null;
}

/** GET /api/v1/site/media/{id}。 */
export interface MediaResponse {
  id: number;
  url: string;
  url_thumb?: string | null;
  mime: string | null;
  size: number | null;
  alt: string | null;
}

/** 整页主入口 GET /api/v1/site/page-data/{code} 的 query。 */
export interface PageDataQuery {
  host?: string;
  locale?: string;
  /** Record 详情页 id；仅当 code 等于记录类型时使用。 */
  id?: number;
  device?: string;
  /** 设计预览模式：跳过缓存、允许读草稿 schema（需配合 preview token）。 */
  preview?: boolean;
}

export interface PageBannerItem {
  image: string
  mobile_image?: string | null
  alt?: string | null
  title?: string | null
  subtitle?: string | null
  description?: string | null
  link?: string | null
  button_text?: string | null
}

export interface PageBannerConfig {
  code?: string | null
  enabled?: boolean
  autoplay?: boolean
  interval?: number
  height?: string | null
  items: PageBannerItem[]
}

/** GET /api/v1/site/page-data/{code} */
export type PageDataResponse = {
  /** 页面身份；路由未命中为 null。 */
  page: {
    id: number;
    code: string;
    slug: string | null;
    title: string | null;
    type: 'home' | 'static' | 'list' | 'detail' | 'custom' | null;
    locale: string;
  } | null;
  locale: string;
  /** 页面级 Banner：page_locales.banner 解析后的 PageBannerConfig（多图轮播+标题+副标题），随整页一次性返回。 */
  banner?: PageBannerConfig | null;
  /** schema 顶层 content_key 对应的 page_contents（已 locale fallback + 媒体解析）。 */
  content: Record<string, unknown> | null;
  /** 各 section 的 Provider 结果，key 来自 schema。 */
  sections: Record<string, CollectionResponse | Record<string, unknown> | null>;
};

/** Schema 文档形状（后台 page_data_schemas.schema JSON）。 */
export interface PageDataSchemaDoc {
  /** 顶层静态内容键（page_contents.content_key）。 */
  content_key?: string;
  sections: Record<
    string,
    {
      provider: 'collection_list' | 'static_content' | 'record_detail';
      config: Record<string, unknown>;
    }
  >;
}

/* ---------- 轻量接口（运维 / Provider 内部） ---------- */

export interface CollectionQuery {
  host?: string;
  locale?: string;
  page?: number;
  limit?: number;
  category_slug?: string;
  format?: string;
  department?: string;
  location?: string;
  industry?: string;
  kind?: string;
  [key: string]: unknown;
}

export interface RecordQuery {
  host?: string;
  locale?: string;
}

export interface CategoryQuery {
  host?: string;
  path?: string;
  category_id?: number;
  locale?: string;
}

export interface ContentQuery {
  host?: string;
  path?: string;
  page_id?: number;
  content_key: string;
  locale?: string;
}

export interface ViewQuery {
  host?: string;
  path?: string;
  locale?: string;
  content_key?: string;
  forms?: string[];
  preview_token?: string;
}

export interface FormSchemaQuery {
  host?: string;
  locale?: string;
}

export interface SitemapQuery {
  host?: string;
  locale?: string;
}

export interface SubmitFormOptions {
  locale?: string;
  files?: Record<string, File[]>;
  /** 服务端上下文（multipart 场景随 payload 一并以 JSON 传输）。 */
  context?: Record<string, unknown>;
  /** 校验规范 id（schema.settings.rule_spec 启用时随表单提交；缺省=全部规则生效）。 */
  rule_spec_id?: number | null;
}

export interface SubmitFormResult {
  id: number;
  submitted_at: string;
}

export type CollectionType = string;
