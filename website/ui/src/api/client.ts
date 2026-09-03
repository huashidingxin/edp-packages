import type {
  ApiEnvelope,
  BootstrapResponse,
  CategoryQuery,
  CategoryResponse,
  CollectionQuery,
  CollectionResponse,
  ContentQuery,
  ContentResponse,
  FormSchema,
  FormSchemaQuery,
  MediaResponse,
  PageDataQuery,
  PageDataResponse,
  RecordQuery,
  RecordResponse,
  SitemapQuery,
  SubmitFormOptions,
  SubmitFormResult,
} from '../contracts/index.ts';
import { designPreviewTokenForHost } from './preview.ts';
import { RemoteAuthProvider, type AuthProvider, type AuthLoginPayload, type AuthRegisterPayload } from './auth.ts';

/** Minimal fetch-like signature accepted by the client (Nuxt ofetch / native fetch). */
export interface FetchLike {
  <T = unknown>(url: string, options?: Record<string, unknown>): Promise<T>;
}

export interface SiteClientOptions {
  /** Backend API base, no trailing slash. e.g. `http://127.0.0.1:8787`. */
  apiBase: string;
  /** Host for tenant resolution. */
  host: string;
  /** Preview domain root for design preview token resolution. */
  previewDomain?: string;
  /** Optional fetch implementation. */
  fetch?: FetchLike;
  /** 会话提供者；缺省 RemoteAuthProvider（契约端点），mock 场景注入 MockAuthProvider。 */
  auth?: AuthProvider;
}

export class SiteClientError extends Error {
  readonly statusCode: number;
  readonly details: unknown;
  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.name = 'SiteClientError';
    this.statusCode = statusCode;
    if (details !== undefined) this.details = details;
  }
}

const KNOWN_FAILURE_STATUS = new Set([400, 401, 403, 404, 409, 422, 500, 502, 503, 504]);

export class SiteClient {
  protected readonly base: string;
  protected readonly host: string;
  protected readonly previewDomain: string;
  protected readonly fetcher: FetchLike;
  private authProvider?: AuthProvider;

  constructor(options: SiteClientOptions) {
    if (!options.apiBase) throw new SiteClientError(500, 'apiBase is required');
    if (!options.host) throw new SiteClientError(500, 'host is required');
    this.base = options.apiBase.replace(/\/$/, '');
    this.host = options.host;
    this.previewDomain = options.previewDomain ?? '';
    this.authProvider = options.auth;
    this.fetcher = options.fetch ??
      (async <T = unknown>(url: string, opts?: Record<string, unknown>): Promise<T> =>
        globalThis.fetch(url, opts as RequestInit) as Promise<T>);
  }

  getHost(): string { return this.host; }

  /** 站点访客会话（remote 契约端点；mock 由构造方注入）。 */
  get auth(): AuthProvider {
    return (this.authProvider ??= new RemoteAuthProvider(this.base, this.fetcher));
  }

  login(payload: AuthLoginPayload): Promise<import('../contracts/index.ts').SiteUser> {
    return this.auth.login(payload);
  }
  register(payload: AuthRegisterPayload): Promise<import('../contracts/index.ts').SiteUser> {
    return this.auth.register(payload);
  }
  logout(): Promise<void> {
    return this.auth.logout();
  }
  me(): Promise<import('../contracts/index.ts').SiteUser | null> {
    return this.auth.me();
  }

  previewToken(): string | null {
    return designPreviewTokenForHost(this.host, this.previewDomain);
  }

  /** GET /api/v1/site/bootstrap */
  async bootstrap(query: { locale?: string } = {}): Promise<BootstrapResponse> {
    const params: Record<string, string> = { host: this.host };
    if (query.locale) params.locale = query.locale;
    return this.request<BootstrapResponse>(`${this.base}/api/v1/site/bootstrap`, params);
  }

  /** GET /api/v1/site/page-data/{code} — 整页主入口。 */
  async pageData(code: string, query: PageDataQuery = {}): Promise<PageDataResponse> {
    const params: Record<string, string> = { host: this.host };
    if (query.locale) params.locale = query.locale;
    if (query.id != null) params.id = String(query.id);
    if (query.device) params.device = query.device;
    if (query.preview) params.preview = '1';
    return this.request<PageDataResponse>(
      `${this.base}/api/v1/site/page-data/${encodeURIComponent(code)}`,
      params,
    );
  }

  /** GET /api/v1/site/collections/{type} — 仅运维 / 客户端分页。 */
  async collection(type: string, query: CollectionQuery = {}): Promise<CollectionResponse> {
    const params: Record<string, string> = { host: this.host };
    if (query.locale) params.locale = query.locale;
    if (query.page) params.page = String(query.page);
    if (query.limit) params.limit = String(query.limit);
    if (query.category_slug) params.category_slug = query.category_slug;
    for (const [k, v] of Object.entries(query)) {
      if (['host', 'locale', 'page', 'limit', 'category_slug'].includes(k)) continue;
      if (v === null || v === undefined || v === '') continue;
      params[k] = Array.isArray(v) ? v.map(String).join(',') : String(v);
    }
    return this.request<CollectionResponse>(`${this.base}/api/v1/site/collections/${encodeURIComponent(type)}`, params);
  }

  /** GET /api/v1/site/records/{type}/{id} — 后台 Provider 内部 / 运维。 */
  async record(type: string, id: number, query: RecordQuery = {}): Promise<RecordResponse> {
    const params: Record<string, string> = { host: this.host };
    if (query.locale) params.locale = query.locale;
    return this.request<RecordResponse>(`${this.base}/api/v1/site/records/${encodeURIComponent(type)}/${id}`, params);
  }

  /** GET /api/v1/site/category — 后台 Provider 内部 / 运维。 */
  async category(query: CategoryQuery): Promise<CategoryResponse> {
    const params: Record<string, string> = { host: this.host };
    if (query.path) params.path = query.path;
    if (query.category_id != null) params.category_id = String(query.category_id);
    if (query.locale) params.locale = query.locale;
    return this.request<CategoryResponse>(`${this.base}/api/v1/site/category`, params);
  }

  /** GET /api/v1/site/content — 仅运维 / 调试（前端文件路由不使用）。 */
  async content(query: ContentQuery): Promise<ContentResponse> {
    const params: Record<string, string> = { host: this.host, content_key: query.content_key };
    if (query.path) params.path = query.path;
    if (query.page_id != null) params.page_id = String(query.page_id);
    if (query.locale) params.locale = query.locale;
    return this.request<ContentResponse>(`${this.base}/api/v1/site/content`, params);
  }

  /** GET /api/v1/site/forms/{code} — 后台 Provider 内部 / 运维。 */
  async formSchema(code: string, query: FormSchemaQuery = {}): Promise<FormSchema> {
    const params: Record<string, string> = { host: this.host };
    if (query.locale) params.locale = query.locale;
    return this.request<FormSchema>(`${this.base}/api/v1/site/forms/${encodeURIComponent(code)}`, params);
  }

  /** GET /api/v1/site/media/{id}. */
  async media(id: number): Promise<MediaResponse> {
    return this.request<MediaResponse>(`${this.base}/api/v1/site/media/${id}`, { host: this.host });
  }

  /** POST /api/v1/site/forms/{code}/submit. */
  async submitForm(
    code: string,
    payload: Record<string, unknown>,
    options: SubmitFormOptions = {},
  ): Promise<SubmitFormResult> {
    const hasFiles = Object.values(options.files ?? {}).some((list) => Array.isArray(list) && list.length > 0);
    const body: FormData | Record<string, unknown> = hasFiles
      ? new FormData()
      : { payload, locale: options.locale, context: options.context, rule_spec_id: options.rule_spec_id ?? null };
    if (body instanceof FormData) {
      body.append('payload', JSON.stringify(payload));
      if (options.locale) body.append('locale', options.locale);
      if (options.context) body.append('context', JSON.stringify(options.context));
      body.append('rule_spec_id', String(options.rule_spec_id ?? ''));
      for (const [field, list] of Object.entries(options.files ?? {})) {
        if (!Array.isArray(list)) continue;
        for (const file of list) body.append(`files[${field}][]`, file, file.name);
      }
    }

    const res = await this.fetcher<ApiEnvelope<SubmitFormResult>>(
      `${this.base}/api/v1/site/forms/${encodeURIComponent(code)}/submit`,
      { method: 'POST', query: { host: this.host }, body, ignoreResponseError: true } as Record<string, unknown>,
    );
    const env = res as ApiEnvelope<SubmitFormResult> | null;
    if (!env || !env.success || !env.data) {
      throw new SiteClientError(422, env?.error?.message ?? 'Submit failed', env?.error);
    }
    return env.data;
  }

  /** GET /api/v1/site/sitemap.xml — 返回 XML 字符串。 */
  async sitemap(query: SitemapQuery = {}): Promise<string> {
    const params: Record<string, string> = { host: this.host };
    if (query.locale) params.locale = query.locale;
    const res = await this.fetcher<Response>(`${this.base}/api/v1/site/sitemap.xml`, {
      query: params,
      headers: { accept: 'application/xml' },
      ignoreResponseError: true,
    } as Record<string, unknown>);
    if (res && typeof res.text === 'function') {
      const text = await res.text();
      return text;
    }
    // framework 返回字符串
    return String(res as unknown);
  }

  protected async request<T>(url: string, params: Record<string, string>): Promise<T> {
    const res = await this.fetcher<ApiEnvelope<T>>(url, {
      query: params,
      ignoreResponseError: true,
    } as Record<string, unknown>);
    const env = res as ApiEnvelope<T> | null;
    if (!env || !env.success || env.data === undefined) {
      const status = env?.error?.code === 'NOT_FOUND' ? 404 : (env?.error?.code === 'VALIDATION_FAILED' ? 422 : 400);
      // eslint-disable-next-line no-console
      console.error('[SiteClient][FAIL]', url, JSON.stringify(params), env?.error?.code, env?.error?.message);
      throw new SiteClientError(status, env?.error?.message ?? 'Request failed', env?.error);
    }
    return env.data as T;
  }
}

export { KNOWN_FAILURE_STATUS };

export interface UseSiteClientConfig {
  apiBase: string;
  host: string;
  previewDomain?: string;
  fetch?: FetchLike;
  auth?: AuthProvider;
}

/** Nuxt 端 SiteClient 工厂（可被任意 Vue/Nuxt 应用显式 import）。 */
export function createSiteClient(config: UseSiteClientConfig, fetchImpl?: FetchLike): SiteClient {
  return new SiteClient({
    apiBase: config.apiBase,
    host: config.host,
    previewDomain: config.previewDomain,
    fetch: config.fetch ?? fetchImpl,
    auth: config.auth,
  });
}
