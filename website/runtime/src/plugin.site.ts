/** SiteClient injection, concurrent SSR data prefetch, and session setup. */
import { createSiteClient } from '@edp/website-ui/client'
import { MockAuthProvider } from '@edp/website-ui/auth'
import { configureSession } from '@edp/website-ui/session'
import type { FetchLike } from '@edp/website-ui/client'
import type { BootstrapResponse } from '@edp/website-ui/contracts'
import {
  addRouteMiddleware, defineNuxtPlugin, useRuntimeConfig,
  useRequestHeaders, useRequestURL, useState,
} from 'nuxt/app'
import { prefetchSiteData, requestLocaleFromPath, resolvePageDataRoute } from './lib/siteRequests.ts'

export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig()
  const apiBase = String(config.apiBase || config.public.apiBase || 'http://127.0.0.1:8787')
  const applicationCode = String(config.public.applicationCode || '')
  const authMock = String(config.public.authMock || '') === '1'
  const requestHost = import.meta.server ? useRequestHeaders(['host']).host : window.location.hostname
  // host 始终回退真实请求 Host；applicationCode 已锁定应用，forceHost 已废弃
  const host = (requestHost || 'localhost').split(':')[0] || 'localhost'
  const client = createSiteClient({
    apiBase, host, applicationCode, fetch: $fetch as unknown as FetchLike,
    ...(authMock ? { auth: new MockAuthProvider() } : {}),
  })
  configureSession(client.auth)

  if (import.meta.server) {
    const state = useState<BootstrapResponse | null>('web:bootstrap:data', () => null)
    // Start immediately, without blocking router resolution and page request scheduling.
    void prefetchSiteData(nuxtApp, client, requestLocaleFromPath(useRequestURL().pathname))
      .then((data) => { if (data) state.value = data })

    addRouteMiddleware('website-data', async (to) => {
      const data = await prefetchSiteData(
        nuxtApp, client, requestLocaleFromPath(to.path),
        resolvePageDataRoute(to.meta.sitePageData, to.params, to.query),
      )
      if (data) state.value = data
    }, { global: true })
  }

  return { provide: { site: client } }
})
