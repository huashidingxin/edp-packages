import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// Run after building UI/runtime: real Nuxt SSR, with a deliberately delayed bootstrap.
const runtime = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const fixture = await mkdtemp(join(tmpdir(), 'edp-ssr-'))
const requests = []
let pendingBootstrap
let output = ''
let child
const api = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://fixture')
  const locale = url.searchParams.get('locale')
  const label = locale === 'en' ? 'English' : 'French'
  const event = { path: url.pathname, locale, cardId: url.searchParams.get('card_id'), finished: false, parallel: false }
  requests.push(event)
  let data
  if (url.pathname.endsWith('/bootstrap')) {
    await new Promise((done) => {
      const timer = setTimeout(done, 800)
      pendingBootstrap = { event, finish: () => { clearTimeout(timer); done() } }
    })
    data = {
      site: { application_id: 1, tenant_id: 1, name: `Shell-${label}`, default_locale: 'fr-FR', enabled_locales: ['fr-FR', 'en-GB'], locales: [{ code: 'fr-FR' }, { code: 'en-GB' }], branding: {}, ai_chat: { enabled: false } },
      menus: { header: [], footer: [] }, navigation: {}, strings: {},
    }
  } else if (url.pathname.includes('/page-data/')) {
    event.parallel = !!pendingBootstrap && !pendingBootstrap.event.finished
    pendingBootstrap?.finish()
    data = { page: { id: 1, code: 'home' }, locale: locale === 'en' ? 'en-GB' : 'fr-FR', blocks: { intro: { title: `Page-${label}` }, vcard: { id: event.cardId || 'none' } } }
  } else {
    res.writeHead(404)
    res.end()
    return
  }
  event.finished = true
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify({ success: true, data }))
})

async function listen(server) {
  await new Promise((done) => server.listen(0, '127.0.0.1', done))
  return server.address().port
}

try {
  const apiPort = await listen(api)
  const portProbe = createServer()
  const appPort = await listen(portProbe)
  await new Promise((done) => portProbe.close(done))
  await mkdir(join(fixture, 'app/pages'), { recursive: true })
  await mkdir(join(fixture, 'app/layouts'), { recursive: true })
  await symlink(join(runtime, 'node_modules'), join(fixture, 'node_modules'), 'dir')
  await writeFile(join(fixture, 'package.json'), JSON.stringify({ type: 'module', private: true }))
  await writeFile(join(fixture, 'nuxt.config.ts'), `export default defineNuxtConfig({
    modules: [${JSON.stringify(join(runtime, 'dist/module.js'))}],
    website: { registerTemplates: false, rendering: { default: 'ssr' }, widgets: { chat: false, user: false } },
    runtimeConfig: { apiBase: 'http://127.0.0.1:${apiPort}', public: { applicationCode: 'ssr-fixture' } },
    devtools: { enabled: false }, compatibilityDate: '2026-01-01',
  })`)
  await writeFile(join(fixture, 'app/app.vue'), '<template><NuxtLayout><NuxtPage /></NuxtLayout></template>')
  await writeFile(join(fixture, 'app/layouts/default.vue'), `<script setup lang="ts">
    const { data } = useSiteBootstrap()
    const { locale } = useLocale()
    useHead({ htmlAttrs: { lang: locale } })
    </script><template><div><header>{{ data?.site.name }}</header><slot /></div></template>`)
  await writeFile(join(fixture, 'app/pages/index.vue'), `<script setup lang="ts">
    definePageMeta({ sitePageData: { code: 'home', params: { card_id: 'card_id' } } })
    const route = useRoute()
    const { data } = useSitePageData({ code: 'home', params: computed(() => ({ card_id: route.query.card_id || undefined })) })
    const { data: sharedBootstrap } = useSiteBootstrap()
    </script><template><main>{{ data?.blocks?.intro?.title }}<span>{{ sharedBootstrap?.site.name }}</span><span>Card-{{ data?.blocks?.vcard?.id }}</span></main></template>`)
  child = spawn(process.execPath, [join(runtime, 'node_modules/nuxt/bin/nuxt.mjs'), 'dev', fixture, '--host', '127.0.0.1', '--port', String(appPort)], {
    cwd: fixture, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NO_COLOR: '1', NUXT_TELEMETRY_DISABLED: '1' },
  })
  child.stdout.on('data', (chunk) => { output += chunk })
  child.stderr.on('data', (chunk) => { output += chunk })
  const base = `http://127.0.0.1:${appPort}`
  const deadline = Date.now() + 60000
  while (true) {
    try {
      const response = await fetch(base)
      if (response.ok && (await response.text()).includes('Page-French')) break
    } catch {}
    if (Date.now() > deadline || child.exitCode !== null) throw new Error(`Nuxt fixture did not become ready.\n${output.slice(-6000)}`)
    await new Promise((done) => setTimeout(done, 200))
  }
  for (const [path, label, expectedLocale, cardId] of [['/', 'French', null, null], ['/en', 'English', 'en', null], ['/?card_id=12', 'French', null, '12'], ['/?card_id=34', 'French', null, '34']]) {
    requests.length = 0
    pendingBootstrap = undefined
    const response = await fetch(`${base}${path}`)
    const html = await response.text()
    assert.equal(response.status, 200, html.slice(0, 1000))
    assert.ok(html.includes(`Page-${label}`), 'Page content must be rendered on the server')
    assert.ok(html.includes(`Shell-${label}`), 'Shell must use the requested language')
    assert.ok(html.includes(`Card-${cardId || 'none'}`), 'Bound record ID must be rendered with its own payload')
    assert.equal(requests.length, 2, JSON.stringify(requests))
    const page = requests.find((entry) => entry.path.includes('/page-data/'))
    assert.equal(page.cardId, cardId)
    assert.equal(page?.parallel, true, 'Page request must start before bootstrap completes')
    assert.ok(requests.every((entry) => entry.locale === expectedLocale), JSON.stringify(requests))
    console.log(`SSR ${path}: concurrent bootstrap/page-data, two API calls, ${label} HTML and payload`)
  }
} finally {
  if (child && child.exitCode === null) {
    child.kill('SIGTERM')
    await new Promise((done) => child.once('exit', done))
  }
  api.closeAllConnections()
  await new Promise((done) => api.close(done))
  await rm(fixture, { recursive: true, force: true })
}
