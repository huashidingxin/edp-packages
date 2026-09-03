/**
 * SiteClient 注入 —— SSR bootstrap 预取 + 会话 provider 配置（universal）。
 *
 * - $site：SiteClient（host 解析 / preview token / auth provider）
 * - 服务端：预取 bootstrap 写入 payload，layout 与页面共享（整页单请求原则）
 * - 客户端：configureSession(client.auth) 供 WebUserArea 等 ClientOnly 岛使用
 *   （authMock=1 时注入 MockAuthProvider，契约先行、后端就绪零改动切换）
 */
import { createSiteClient } from '@edp/website-ui/client'
import { MockAuthProvider } from '@edp/website-ui/auth'
import { configureSession } from '@edp/website-ui/session'
import type { FetchLike, SiteClient } from '@edp/website-ui/client'
// 模块内插件文件不做自动 import 转换，必须显式引入 Nuxt API
import {
  defineNuxtPlugin,
  useRuntimeConfig,
  useRequestHeaders,
  useNuxtApp,
  useState,
} from 'nuxt/app'

export default defineNuxtPlugin(async () => {
  const config = useRuntimeConfig()
  const apiBase = String(config.apiBase || config.public.apiBase || 'http://127.0.0.1:8787')
  const forceHost = String(config.public.forceHost || '')
  const previewDomain = String(config.public.previewDomain || '')
  const authMock = String(config.public.authMock || '') === '1'

  const getHost = (): string => {
    if (forceHost) return forceHost.split(':')[0] || forceHost
    if (import.meta.server) {
      const headers = useRequestHeaders(['host'])
      return (headers.host || 'localhost').split(':')[0] || 'localhost'
    }
    return window.location.hostname
  }

  const makeClient = (): SiteClient =>
    createSiteClient({
      apiBase,
      host: getHost(),
      previewDomain,
      fetch: $fetch as unknown as FetchLike,
      ...(authMock ? { auth: new MockAuthProvider() } : {}),
    })

  const client = makeClient()
  configureSession(client.auth)

  if (import.meta.server) {
    const data = await client.bootstrap().catch(() => null)
    useState('web:bootstrap:data', () => data)
    // 预取结果写入 payload 缓存，layout 的 useSiteBootstrap 同 key 直接命中，避免重复请求
    const defaultLocale = data?.site?.default_locale
    if (defaultLocale && data) {
      useNuxtApp().payload.data[`web:bootstrap:${defaultLocale}`] = data
    }
  }

  return {
    provide: {
      site: client,
    },
  }
})
