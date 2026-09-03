/** ApiEnvelope — 统一响应包络。 */
export interface ApiEnvelope<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: Record<string, unknown>;
}

/** BCP 47 locale code, e.g. `zh-CN`, `en-US`. */
export type LocaleCode = string;

export interface LocaleInfo {
  code: string;
  label: string;
  native_label: string;
}

/** 站点品牌设置。 */
export interface SiteBranding {
  logo: string | null;
  logo_alt: string;
  favicon: string | null;
  show_name: boolean;
  copyright: string | null;
  /** 联系方式（bootstrap 下发；空值缺省，前端按需回落）。 */
  contact?: SiteContact | null;
}

/** 站点联系方式（顶栏 / 页脚 / 联系页）。 */
export interface SiteContact {
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  qr_image?: string | null;
  qr_label?: string | null;
  shop_url?: string | null;
  shop_label?: string | null;
  icp?: string | null;
  icp_url?: string | null;
  company?: string | null;
  slogan?: string | null;
}

/** AI 聊天公开配置（bootstrap `site.ai_chat`，render 下发的不含 system_prompt）。 */
export interface AiChatPublicConfig {
  enabled: boolean;
  title?: string;
  welcome?: string;
  position?: 'left' | 'right';
  bot_avatar?: string | null;
  user_avatar?: string | null;
  gradient?: { start: string; end: string };
  endpoint?: string;
  application_id?: number;
  [key: string]: unknown;
}

/** Bootstrap 返回的 `site` 对象。 */
export interface SiteInfo {
  application_id: number;
  code?: string | null;
  name: string;
  default_locale: LocaleCode;
  enabled_locales: LocaleCode[];
  tenant_id: number;
  timezone: string;
  branding: SiteBranding;
  locales: LocaleInfo[];
  ai_chat: AiChatPublicConfig;
}

/** 主题 tokens。 */
export interface ThemeTokens {
  colors?: Record<string, string>;
  color?: Record<string, string>;
  font?: Record<string, string>;
  fontSize?: Record<string, string>;
  spacing?: Record<string, string>;
  radius?: Record<string, string>;
  shadow?: Record<string, string>;
  sizing?: Record<string, string>;
  lineHeight?: Record<string, string>;
  letterSpacing?: Record<string, string>;
  /** 媒体宽高比令牌（`ratio.card: '4/3'` -> `--ratio-card`）。 */
  ratio?: Record<string, string>;
  /** 容器宽度令牌（`container.site: '1280px'` -> `--container-site`）。 */
  container?: Record<string, string>;
  [key: string]: unknown;
}

export interface ThemeInfo {
  tokens: ThemeTokens;
  version: string;
  stylesheet: {
    url?: string;
    inline?: string;
  };
}

/** 菜单。 */
export interface MenuMeta {
  active?: boolean;
  [key: string]: unknown;
}

export interface MenuItem {
  id: number | string;
  title: string;
  url?: string;
  href?: string;
  active_prefixes?: string[];
  meta?: MenuMeta;
  children?: MenuItem[];
}

export type MenuTree = MenuItem[];

export interface SiteMenus {
  header: MenuTree;
  footer: MenuTree;
  [code: string]: MenuTree;
}

/** 面包屑。 */
export interface BreadcrumbItem {
  label: string;
  href: string | null;
  current: boolean;
}

/** Record 详情页上/下条。 */
export interface RecordNavigationItem {
  title: string;
  id: number;
  path: string;
}

/** 上下文引用。 */
export interface ContextRef {
  key: string;
  values: Record<string, unknown>;
}

/** hreflang。 */
export interface HreflangEntry {
  locale: LocaleCode;
  path: string;
  id?: number;
  slug?: string;
}

/** Source 元信息。 */
export interface SourceMeta {
  kind?: string;
  variant?: string;
  list_variant?: string;
  total?: number;
  page?: number;
  per_page?: number;
  total_pages?: number;
  page_param?: string;
  [key: string]: unknown;
}

/** Source item。 */
export interface SourceItem {
  key: string;
  values: Record<string, unknown>;
}

/** Source 解释结果。 */
export interface SourceResult {
  items: SourceItem[];
  meta: SourceMeta;
}

export type Sources = Record<string, SourceResult>;

/** 表单字段。 */
export interface FormFieldOption {
  label: string;
  value: string;
}

export interface FormField {
  name: string;
  type: string;
  label?: string;
  required?: boolean;
  placeholder?: string;
  options?: FormFieldOption[];
  /**
   * 规则引擎（可选）：`{ rule_id, expr: { connector: 'and'|'or', children: [...] } }`，
   * 叶子 `{ type, value?, message?, level?: 1|2 }`。level=1 阻断提交，level=2 仅警告。
   * rule_id=0 恒生效；>0 仅当表单 settings.rule_spec 选中时生效。
   */
  rules?: unknown;
  /**
   * 可见条件（可选）：单条件 `{ field, operator, value }` 或复合 `{ and|or: [cond] }`。
   * operator: equals | not_equals | in | not_in | filled | empty。
   */
  visible_when?: unknown;
  /** 必填联动（可选）：同 visible_when 形状；命中时视为必填。 */
  required_when?: unknown;
  /** 禁用联动（可选）：同 visible_when 形状；命中时字段禁用且跳过必填。 */
  disabled_when?: unknown;
  [key: string]: unknown;
}

/** 表单 schema。 */
export interface FormSchema {
  id: number;
  code: string;
  locale: LocaleCode;
  title: string | null;
  submit_text: string | null;
  success_message: string | null;
  error_message?: string | null;
  messages?: Record<string, unknown>;
  layout?: unknown;
  /** 表单级设置：`{ rule_spec?: { enabled?, options: { rule_id, label? }[] } }` 等。 */
  settings?: unknown;
  fields: FormField[];
}

/** 设计预览状态。 */
export interface PreviewState {
  is_preview: boolean;
  token?: string;
  workspace_id?: number;
}
