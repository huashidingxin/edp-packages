/**
 * Nitro 自动导入的运行时全局声明（仅供本包 typecheck 使用）。
 *
 * `src/server/*.ts` 是随站点构建注入 Nitro 的处理器：运行时的 defineEventHandler /
 * useRuntimeConfig / useStorage / $fetch 等由站点侧 Nitro 自动导入提供（不写 import，
 * 避免与站点自身的 h3 / nitropack 版本重复解析出两份实例）。本包独立 typecheck 时
 * 没有 Nitro 上下文，因此在这里补最小声明；站点构建不做类型检查，不受影响。
 */
declare function defineEventHandler<T = unknown>(handler: (event: any) => T | Promise<T>): any

declare function readRawBody(event: any, encoding?: 'utf8' | false): Promise<string | Buffer | undefined>

declare function getHeader(event: any, name: string): string | undefined

declare function setResponseStatus(event: any, status: number, text?: string): void

declare function getRequestIP(event: any, options?: { xForwardedFor?: boolean }): string | undefined

declare function useRuntimeConfig(event?: any): any

declare function useStorage(base?: string): any

declare const $fetch: <T = unknown>(url: string, options?: Record<string, unknown>) => Promise<T>
