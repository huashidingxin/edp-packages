/**
 * 请求封装 + 拦截器 —— 用法对齐 `huaren-app-frontend/utils/request.js`。
 *
 * 装配（App.vue onLaunch 一次）：
 * ```ts
 * setupAppHttp({ baseURL: 'https://api.x.com/api/v1', applicationCode: 'demo' })
 * ```
 * 调用：
 * ```ts
 * http.get('/site/bootstrap', { locale: 'zh-CN' })
 * appSite.collection('product', { page: 1 })   // 见 site.ts
 * ```
 * 单次开关：`custom: { auth, loading, toast, raw }`（与参考实现同名同义）。
 *
 * 默认行为：补 header（Accept / Content-Type / X-Application-Code / Authorization）、
 * 业务包络 `{success,data,error}` 自动解包、失败按状态码给中文提示并 toast。
 */
import { getGlobalSingleton, getUni, hasUni } from './global.ts'

export type Method = 'GET' | 'POST' | 'PUT' | 'DELETE'
export type Params = Record<string, string | number | boolean | null | undefined>

export interface RequestCustom {
  /** 有 token 时是否带 Authorization（默认 true） */
  auth?: boolean
  /** 是否显示 loading；字符串作为提示文案 */
  loading?: boolean | string
  /** 失败是否自动 toast（默认 true） */
  toast?: boolean
  /** 返回完整包络而非解包后的 data */
  raw?: boolean
}

export interface RequestOptions {
  url: string
  method?: Method
  params?: Params
  data?: unknown
  header?: Record<string, string>
  timeout?: number
  custom?: RequestCustom
}

export interface HttpConfig {
  /** 如 `https://api.x.com/api/v1`（建议含 `/api/v1`，Resource 里只写资源路径） */
  baseURL: string
  timeout?: number
  /** 小程序没有 Host，后端靠 `X-Application-Code` 解析租户/应用 */
  applicationCode?: string
  /** 留空由后端选择应用默认语言；页面可在单次请求中覆盖。 */
  locale?: string
  getToken?: () => string | null
}

export class AppRequestError extends Error {
  readonly statusCode: number
  readonly code?: string
  readonly response?: unknown
  readonly config?: RequestOptions

  constructor(
    statusCode: number,
    message: string,
    options: { code?: string; response?: unknown; config?: RequestOptions } = {},
  ) {
    super(message)
    this.name = 'AppRequestError'
    this.statusCode = statusCode
    this.code = options.code
    this.response = options.response
    this.config = options.config
  }
}

interface TransportResult {
  statusCode: number
  data: unknown
  header?: Record<string, string>
}

type Transport = (options: {
  url: string
  method: Method
  data?: unknown
  header?: Record<string, string>
  timeout?: number
}) => Promise<TransportResult>

type RequestInterceptor = (options: RequestOptions) => RequestOptions | Promise<RequestOptions>
type ResponseInterceptor = (data: unknown, options: RequestOptions) => unknown | Promise<unknown>
type RejectInterceptor = (error: AppRequestError) => unknown

interface Store {
  config: HttpConfig
  transport: Transport
  requestInterceptors: RequestInterceptor[]
  responseInterceptors: ResponseInterceptor[]
  rejectInterceptors: RejectInterceptor[]
  loadingRequests: Set<symbol>
}

const KEY = '__EDP_APP_REQUEST__'

const store = getGlobalSingleton<Store>(KEY, () => ({
  config: { baseURL: '', timeout: 15000 },
  transport: uniTransport,
  requestInterceptors: [],
  responseInterceptors: [],
  rejectInterceptors: [],
  loadingRequests: new Set(),
}))

/* ────────────────────────── 装配 ────────────────────────── */

/** 应用启动装配一次（baseURL / 应用标识 / 默认拦截器）。 */
export function setupAppHttp(config: HttpConfig): void {
  store.config = { ...store.config, ...config }
  store.requestInterceptors = [defaultRequestInterceptor]
  store.responseInterceptors = []
  store.rejectInterceptors = [defaultRejectInterceptor]
}

/** 重置（测试与切换环境用）。 */
export function resetAppHttp(): void {
  if (store.loadingRequests.size) getUni()?.hideLoading?.()
  store.loadingRequests.clear()
  store.config = { baseURL: '', timeout: 15000 }
  store.transport = uniTransport
  store.requestInterceptors = []
  store.responseInterceptors = []
  store.rejectInterceptors = []
}

/** 替换传输实现（测试打桩 / 联调 mock）。 */
export function setTransport(transport: Transport): void {
  store.transport = transport
}

export function getHttpConfig(): Readonly<HttpConfig> {
  return store.config
}

/* ────────────────────────── 调用入口 ────────────────────────── */

export const http = {
  get<T = unknown>(url: string, params?: Params, options?: Omit<RequestOptions, 'url' | 'params' | 'method'>) {
    return request<T>({ ...options, url, method: 'GET', params })
  },
  post<T = unknown>(url: string, data?: unknown, options?: Omit<RequestOptions, 'url' | 'data' | 'method'>) {
    return request<T>({ ...options, url, method: 'POST', data })
  },
  put<T = unknown>(url: string, data?: unknown, options?: Omit<RequestOptions, 'url' | 'data' | 'method'>) {
    return request<T>({ ...options, url, method: 'PUT', data })
  },
  delete<T = unknown>(url: string, data?: unknown, options?: Omit<RequestOptions, 'url' | 'data' | 'method'>) {
    return request<T>({ ...options, url, method: 'DELETE', data })
  },
  request,
  interceptors: {
    request: {
      use(fn: RequestInterceptor) {
        store.requestInterceptors.push(fn)
      },
    },
    response: {
      use(onFulfilled?: ResponseInterceptor, onRejected?: RejectInterceptor) {
        if (onFulfilled) store.responseInterceptors.push(onFulfilled)
        if (onRejected) store.rejectInterceptors.push(onRejected)
      },
    },
  },
}

async function request<T = unknown>(options: RequestOptions): Promise<T> {
  let config: RequestOptions = {
    method: 'GET',
    timeout: store.config.timeout ?? 15000,
    ...options,
    header: { ...(options.header ?? {}) },
    custom: { auth: true, toast: true, ...(options.custom ?? {}) },
  }
  const baseURL = store.config.baseURL
  const transport = store.transport
  let releaseLoading = () => {}

  try {
    for (const interceptor of store.requestInterceptors) config = await interceptor(config)
    releaseLoading = beginLoading(config)
    const result = await transport({
      url: buildUrl(config, baseURL),
      method: (config.method ?? 'GET') as Method,
      data: config.data,
      header: config.header,
      timeout: config.timeout,
    })

    if (result.statusCode < 200 || result.statusCode >= 300) {
      throw statusError(result, config)
    }

    let payload = unwrap(result.data, config)
    for (const interceptor of store.responseInterceptors) payload = await interceptor(payload, config)
    return payload as T
  } catch (error) {
    let current = toRequestError(error, config)
    for (const interceptor of store.rejectInterceptors) {
      try {
        return (await interceptor(current)) as T
      } catch (next) {
        current = toRequestError(next, config)
      }
    }
    throw current
  } finally {
    releaseLoading()
  }
}

/* ────────────────────────── 内部实现 ────────────────────────── */

function buildUrl(config: RequestOptions, baseURL: string): string {
  const base = (baseURL ?? '').replace(/\/+$/, '')
  const path = config.url.startsWith('/') ? config.url : `/${config.url}`
  const url = /^https?:\/\//i.test(config.url) ? config.url : `${base}${path}`
  if (!/^https?:\/\//i.test(url)) {
    throw new AppRequestError(500, 'setupAppHttp() 未调用或 baseURL 为空', { code: 'NOT_CONFIGURED', config })
  }
  const pairs = Object.entries(config.params ?? {})
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
  return pairs.length ? `${url}${url.includes('?') ? '&' : '?'}${pairs.join('&')}` : url
}

/** 业务包络解包：`{success,data,error}` → data；失败抛错并按错误码映射状态。 */
function unwrap(body: unknown, config: RequestOptions): unknown {
  if (config.custom?.raw) return body
  if (!body || typeof body !== 'object' || !('success' in body)) return body

  const envelope = body as { success: boolean; data?: unknown; error?: { code?: string; message?: string } }
  if (envelope.success === true) return envelope.data

  const code = envelope.error?.code
  return throwBusinessError(code, envelope.error?.message, body, config)
}

function throwBusinessError(
  code: string | undefined,
  message: string | undefined,
  body: unknown,
  config: RequestOptions,
): never {
  const statusCode =
    code === 'NOT_FOUND' ? 404 : code === 'VALIDATION_FAILED' ? 422 : code === 'UNAUTHORIZED' ? 401 : 400
  throw new AppRequestError(statusCode, message ?? '请求失败', { code, response: body, config })
}

function statusError(result: TransportResult, config: RequestOptions): AppRequestError {
  const body = result.data as { message?: string; error?: { code?: string; message?: string } } | undefined
  return new AppRequestError(result.statusCode, body?.error?.message ?? body?.message ?? `HTTP ${result.statusCode}`, {
    code: body?.error?.code,
    response: result.data,
    config,
  })
}

function toRequestError(error: unknown, config: RequestOptions): AppRequestError {
  if (error instanceof AppRequestError) return error
  return new AppRequestError(500, error instanceof Error ? error.message : '请求失败', { config })
}

/** 默认请求拦截：补应用身份与会话 header。 */
function defaultRequestInterceptor(config: RequestOptions): RequestOptions {
  const header: Record<string, string> = { ...(config.header ?? {}) }
  if (!header.Accept) header.Accept = 'application/json'
  if (config.method && config.method !== 'GET' && !header['Content-Type']) {
    header['Content-Type'] = 'application/json'
  }
  if (store.config.applicationCode) header['X-Application-Code'] = store.config.applicationCode

  const token = store.config.getToken?.() ?? null
  if (token && config.custom?.auth !== false) header.Authorization = `Bearer ${token}`

  config.header = header
  return config
}

/** 默认失败拦截：显示可读错误并抛出，调用方始终可以在 finally 中结束页面状态。 */
function defaultRejectInterceptor(error: AppRequestError): unknown {
  const custom = error.config?.custom ?? {}

  const message = friendlyMessage(error)
  if (error.statusCode === 401) {
    showToast(message)
  } else if (custom.toast !== false) {
    showToast(message)
  }

  throw error
}

/** 状态码/错误 → 用户可读文案（与参考实现同一套映射）。 */
export function friendlyMessage(error: AppRequestError): string {
  const body = error.response as { message?: string; errors?: Record<string, string[]>; error?: { message?: string } } | undefined
  const serverMessage = body?.error?.message ?? body?.message

  if (error.statusCode === 0) return error.message
  if (error.statusCode === 422) {
    const first = body?.errors ? Object.values(body.errors)[0]?.[0] : undefined
    return first ?? serverMessage ?? '提交内容有误'
  }
  if (error.statusCode === 401) {
    return serverMessage && serverMessage !== 'Unauthenticated.' ? serverMessage : '登录信息已失效'
  }
  if (error.statusCode === 400 || error.statusCode === 403 || error.statusCode === 500) {
    return serverMessage ?? '出现了一点小问题，请稍后再试'
  }
  return serverMessage ?? `出现了一点小状况，请稍后再试：${error.statusCode}`
}

/** 默认传输：uni.request。 */
function uniTransport(options: {
  url: string
  method: Method
  data?: unknown
  header?: Record<string, string>
  timeout?: number
}): Promise<TransportResult> {
  return new Promise((resolve, reject) => {
    if (!hasUni() || typeof getUni()?.request !== 'function') {
      reject(new AppRequestError(500, 'uni.request 不可用'))
      return
    }
    getUni().request({
      url: options.url,
      method: options.method,
      data: options.data,
      header: options.header,
      timeout: options.timeout ?? 15000,
      success: (res: { statusCode?: number; data?: unknown; header?: Record<string, string> }) => {
        resolve({
          statusCode: typeof res?.statusCode === 'number' ? res.statusCode : 200,
          data: res?.data,
          header: res?.header,
        })
      },
      fail: (err: { errMsg?: string }) => {
        const errMsg = err?.errMsg ?? ''
        const message = errMsg.includes('timeout')
          ? '网络请求超时'
          : errMsg.includes('abort')
            ? '您的网络不稳定'
            : '网络请求失败'
        reject(new AppRequestError(0, message))
      },
    })
  })
}

function beginLoading(config: RequestOptions): () => void {
  if (!config.custom?.loading) return () => {}
  const token = Symbol('request-loading')
  store.loadingRequests.add(token)
  if (store.loadingRequests.size === 1) {
    getUni()?.showLoading?.({ title: typeof config.custom.loading === 'string' ? config.custom.loading : '加载中', mask: true })
  }
  return () => {
    if (store.loadingRequests.delete(token) && store.loadingRequests.size === 0) getUni()?.hideLoading?.()
  }
}

function showToast(message: string): void {
  const u = getUni()
  if (typeof u?.showToast === 'function') u.showToast({ title: message, icon: 'none', duration: 2000 })
}
