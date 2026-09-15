/**
 * Resource —— 极简 REST 资源类（与参考实现同形）。
 *
 * ```ts
 * const product = new Resource('/admin/products')
 * await product.list({ page: 1 })      // GET    /admin/products?page=1
 * await product.get(12)                // GET    /admin/products/12
 * await product.store(payload)         // POST   /admin/products
 * await product.update(12, payload)    // PUT    /admin/products/12
 * await product.destroy(12)            // DELETE /admin/products/12
 * ```
 */
import { http, type Params, type RequestOptions } from './request.ts'

type ExtraOptions = Omit<RequestOptions, 'url' | 'data' | 'params' | 'method'>

export class Resource {
  readonly uri: string
  readonly options: ExtraOptions

  constructor(uri: string, options: ExtraOptions = {}) {
    this.uri = /^https?:\/\//i.test(uri) ? uri : uri.startsWith('/') ? uri : `/${uri}`
    this.options = options
  }

  list<T = unknown>(params?: Params, options: ExtraOptions = {}): Promise<T> {
    return http.get<T>(this.uri, params, { ...this.options, ...options })
  }

  get<T = unknown>(id: string | number = '', options: ExtraOptions = {}): Promise<T> {
    return http.get<T>(`${this.uri}${id === '' ? '' : `/${id}`}`, undefined, { ...this.options, ...options })
  }

  store<T = unknown>(data?: unknown, options: ExtraOptions = {}): Promise<T> {
    return http.post<T>(this.uri, data, { ...this.options, ...options })
  }

  update<T = unknown>(id: string | number, data?: unknown, options: ExtraOptions = {}): Promise<T> {
    return http.put<T>(`${this.uri}/${id}`, data, { ...this.options, ...options })
  }

  destroy<T = unknown>(id: string | number, data: unknown = {}, options: ExtraOptions = {}): Promise<T> {
    return http.delete<T>(`${this.uri}/${id}`, data, { ...this.options, ...options })
  }
}
