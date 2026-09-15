import test from 'node:test'
import assert from 'node:assert/strict'
import {
  bootstrapKey, pageDataKey, prefetchSiteData, requestLocaleFromPath,
  resolvePageDataRoute, sharedSiteRequest, stableQueryKey,
} from '../src/lib/siteRequests.ts'

test('unprefixed requests let the application choose its default locale', () => {
  assert.equal(requestLocaleFromPath('/'), undefined)
  assert.equal(requestLocaleFromPath('/about/company'), undefined)
  assert.equal(requestLocaleFromPath('/faq'), undefined)
  assert.equal(requestLocaleFromPath('/en/about/company'), 'en')
  assert.equal(bootstrapKey(undefined), 'web:bootstrap:default')
  assert.notEqual(pageDataKey('home'), pageDataKey('home', { locale: 'en' }))
})

test('route data declarations resolve parameters without bootstrap', () => {
  assert.deepEqual(resolvePageDataRoute({ code: 'about-:slug' }, { slug: 'company' }), { code: 'about-company' })
  assert.deepEqual(resolvePageDataRoute({ code: 'product', idParam: 'id' }, { id: '12' }), { code: 'product', id: 12 })
  assert.equal(resolvePageDataRoute({ code: 'about-:slug' }, {}), null)
  assert.equal(resolvePageDataRoute(undefined, {}), null)
})

test('bootstrap and page data start together and populate matching SSR payload keys', async () => {
  const scope = { payload: { data: {} as Record<string, unknown> } }
  const calls: string[] = []
  let releaseBootstrap!: () => void
  const bootstrapReady = new Promise<void>((resolve) => { releaseBootstrap = resolve })
  const client = {
    async bootstrap(query: { locale?: string }) {
      calls.push(`bootstrap:${query.locale}`)
      await bootstrapReady
      return { site: { default_locale: 'en-US' } }
    },
    async pageData(code: string, query: { locale?: string }) {
      calls.push(`${code}:${query.locale}`)
      releaseBootstrap()
      return { blocks: { intro: { title: 'Home' } } }
    },
  }
  await prefetchSiteData(scope, client, undefined, { code: 'home' })
  assert.deepEqual(calls, ['bootstrap:undefined', 'home:undefined'])
  assert.deepEqual(scope.payload.data[pageDataKey('home')], { blocks: { intro: { title: 'Home' } } })
  // Subsequent layout/page consumers share the completed prefetch.
  await prefetchSiteData(scope, client, undefined, { code: 'home' })
  assert.equal(calls.length, 2)
})

test('a failed shared request can retry; concurrent consumers use one request', async () => {
  const scope = {}
  let calls = 0
  const fail = () => { calls++; return Promise.reject(new Error('offline')) }
  const one = sharedSiteRequest(scope, 'bootstrap', fail)
  const two = sharedSiteRequest(scope, 'bootstrap', fail)
  assert.equal(one, two)
  await assert.rejects(one, /offline/)
  assert.equal(await sharedSiteRequest(scope, 'bootstrap', async () => { calls++; return 'online' }), 'online')
  assert.equal(calls, 2)
})

test('collection filter values change keys, while object insertion order does not', () => {
  assert.notEqual(stableQueryKey({ category_id: 1 }), stableQueryKey({ category_id: 2 }))
  assert.equal(stableQueryKey({ page: 2, keyword: 'x' }), stableQueryKey({ keyword: 'x', page: 2 }))
  assert.equal(stableQueryKey({ page: 1, keyword: '' }), stableQueryKey({ page: 1 }))
})

test('every bound page record parameter participates in request and SSR payload identity', () => {
  assert.notEqual(pageDataKey('home', { card_id: 1 }), pageDataKey('home', { card_id: 2 }))
  assert.notEqual(pageDataKey('home', { card_id: 1, service_id: 2 }), pageDataKey('home', { card_id: 1, service_id: 3 }))
  assert.equal(pageDataKey('home', { card_id: 1, locale: 'zh-CN' }), pageDataKey('home', { locale: 'zh-CN', card_id: 1 }))
  assert.equal(pageDataKey('home', { card_id: '12' }), pageDataKey('home', { card_id: 12 }))
})

test('SSR forwards declared route and query ID bindings and reuses the matching payload', async () => {
  const declaration = { code: 'home', params: { card_id: 'card', service_id: 'service' } }
  const page = resolvePageDataRoute(declaration, { card: '12' }, { service: '34', ignored: '56' })
  assert.deepEqual(page, { code: 'home', params: { card_id: 12, service_id: 34 } })
  assert.equal(resolvePageDataRoute(declaration, {}, { card: ['12', '13'] }), null)
  const scope = { payload: { data: {} as Record<string, unknown> } }
  const calls: unknown[] = []
  await prefetchSiteData(scope, {
    async bootstrap() { return {} },
    async pageData(code, query) { calls.push([code, query]); return { blocks: { vcard: { id: 12 } } } },
  }, 'en', page)
  assert.deepEqual(calls, [['home', { locale: 'en', card_id: 12, service_id: 34 }]])
  assert.deepEqual(scope.payload.data[pageDataKey('home', { card_id: 12, service_id: 34, locale: 'en' })], { blocks: { vcard: { id: 12 } } })
})
