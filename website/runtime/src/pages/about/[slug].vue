<script setup lang="ts">
import { submitForm, useSiteClient, useBootstrapSite, useSitePageData } from '../../composables/useSite.ts'
import { useT } from '../../composables/useT.ts'
import { useSiteNavigation } from '../../lib/site.ts'
/**
 * 模板：关于页（pages.code 约定寻址：code = 'about-' + slug）。
 * 内容全部由 schema 装配：banner（page_locales.banner → static 模板页回落）、
 * content（static_content：{ title?, summary?, body?, contact?, sections? }）。
 * 联系形态由数据驱动：content.contact 存在 → 方式卡 + 表单（nav.contact_form_code），
 * 无任何 slug/映射表特判。
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useAsyncData, useHead, useRoute } from 'nuxt/app'
import { WebAbout, WebContactForm, WebHero } from '@edp/website-ui'
import type { FormSchema } from '@edp/website-ui/contracts'
import { useLocaleLight } from '../../composables/useLocaleLight.ts'

const route = useRoute()
const { t } = useT()
const site = useBootstrapSite()
const nav = useSiteNavigation()

const slug = computed(() => String(route.params.slug ?? ''))

/* code 约定推导（唯一寻址方式）：code = 'about-' + slug */
const pageCode = computed(() => `about-${slug.value}`)

const { data: page } = useSitePageData({ code: pageCode })
/* 标准块（docs/README.md#page-config）：intro=导语卡 / body=正文卡 /
 * sections=版块列表 / stats=数据条目；全部只含 card 约定字段。 */
const blocks = computed<Record<string, any>>(() => (page.value?.blocks as Record<string, any>) ?? {})
const asObj = (v: any): Record<string, any> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, any>) : {})
const intro = computed<Record<string, any>>(() => asObj(blocks.value.intro))
const displayEyebrow = computed<string | null>(() => intro.value.subtitle ?? null)
const displayImage = computed<string | null>(() => intro.value.image ?? null)
/* 标题：intro.title → page.page.title（后台 page_locales） */
const heroTitle = computed(() => intro.value.title || page.value?.page?.title || t('关于我们'))
const displaySummary = computed(() => intro.value.content ?? '')
const displayBody = computed<string | null>(() => {
  const body = asObj(blocks.value.body).content
  return typeof body === 'string' && body.trim() ? body : null
})
const displayFeatures = computed<any[]>(() => (Array.isArray(blocks.value.sections) ? blocks.value.sections : []))
const displayStats = computed<any[]>(() => (Array.isArray(blocks.value.stats) ? blocks.value.stats : []))
/* 联系形态:数据驱动 —— 联系页（contact_path 指向的 slug）或页面配置 contact 行卡片。
 * 页面级 contact = cards [{title, content, target: tel:/mailto:}]；
 * 未配置时联系页回落站点级 branding.contact（顶栏/页脚同源）。
 * 地图配置（map/map_tk）属应用级 branding 配置，不再放页面内容。 */
const isContactSlug = computed(() =>
  slug.value === (String(nav.value.contactPath ?? '').split('/').pop() || 'contact-us'))
const brandingContact = computed<Record<string, string>>(() => {
  const branding = ((site.value.branding as any)?.contact ?? {}) as Record<string, unknown>
  return Object.fromEntries(
    Object.entries(branding).filter(([, v]) => v !== null && v !== undefined && v !== ''),
  ) as Record<string, string>
})
const brandingRows = computed(() => {
  const c = brandingContact.value
  return [
    { key: 'phone', label: t('电话咨询'), value: c.phone ?? null, href: c.phone ? `tel:${c.phone}` : null },
    { key: 'email', label: t('邮件联系'), value: c.email ?? null, href: c.email ? `mailto:${c.email}` : null },
    { key: 'hours', label: t('工作时间'), value: c.hours ?? null, href: null },
    { key: 'address', label: t('到厂参观'), value: c.address ?? null, href: null },
  ].filter((r) => r.value)
})
const pageContactRows = computed<any[]>(() => {
  const rows = blocks.value.contact
  if (!Array.isArray(rows)) return []
  return rows
    .filter((r: any) => r && typeof r === 'object' && r.content)
    .map((r: any) => ({ key: String(r.title ?? ''), label: String(r.title ?? ''), value: String(r.content), href: r.target ? String(r.target) : null }))
})
const contactRows = computed<any[]>(() => {
  if (pageContactRows.value.length) return pageContactRows.value
  return isContactSlug.value ? brandingRows.value : []
})

/* 地图：branding.contact.map = "lat,lng"（天地图瓦片，需 map_tk 密钥）或完整 iframe URL；缺省不渲染 */
const mapIframeUrl = computed<string | null>(() => {
  const raw = String(brandingContact.value.map ?? '').trim()
  return /^https?:\/\//i.test(raw) ? raw : null
})

const mapPoint = computed<{ lat: number; lng: number } | null>(() => {
  if (mapIframeUrl.value) return null
  const m = String(brandingContact.value.map ?? '').trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/)
  if (!m) return null
  const lat = Number(m[1])
  const lng = Number(m[2])
  return Math.abs(lat) <= 85 && Math.abs(lng) <= 180 ? { lat, lng } : null
})

/* 天地图 tk 密钥：应用级配置（applications.settings.branding.contact.map_tk，
 * 经 bootstrap.branding.contact 流出）。无密钥不渲染瓦片地图 */
const mapTk = computed(() => String(brandingContact.value.map_tk ?? brandingContact.value.map_key ?? '').trim() || null)

const hasMap = computed(() => Boolean(mapIframeUrl.value || (mapPoint.value && mapTk.value)))
void hasMap

/* 天地图瓦片 6x3 网格自拼（vec_w 底图 + cva_w 中文注记双层）：标记点落在容器中心；
 * zoom 14（单块约 1.5km，整图约 9km 视野）。DataServer 无 tk 返回 418。 */
const MAP_TILE_ZOOM = 14
const mapTiles = computed(() => {
  const p = mapPoint.value
  const tk = mapTk.value
  if (!p || !tk) return null
  const n = 2 ** MAP_TILE_ZOOM
  const cx = ((p.lng + 180) / 360) * n
  const cy = ((1 - Math.asinh(Math.tan((p.lat * Math.PI) / 180)) / Math.PI) / 2) * n
  const bx = Math.floor(cx) - 3
  const by = Math.floor(cy) - 1
  const offset = { x: (cx - bx) * 256, y: (cy - by) * 256 }
  const tiles: { key: string; i: number; j: number; x: number; y: number; s: number }[] = []
  for (let j = 0; j < 3; j++) {
    for (let i = 0; i < 6; i++) {
      const x = bx + i
      const y = by + j
      if (y < 0 || y >= n) continue
      tiles.push({ key: `${x}-${y}`, i, j, x, y, s: (i + j) % 8 })
    }
  }
  return { tiles, offset, tk }
})

const tileSrc = (t: { x: number; y: number; s: number }, layer: 'vec_w' | 'cva_w', tk: string) =>
  `https://t${t.s}.tianditu.gov.cn/DataServer?T=${layer}&x=${t.x}&y=${t.y}&l=${MAP_TILE_ZOOM}&tk=${encodeURIComponent(tk)}`

const mapOpenUrl = computed<string | null>(() => {
  const p = mapPoint.value
  if (!p) return null
  const name = encodeURIComponent(brandingContact.value.address ?? '')
  return `https://uri.amap.com/marker?position=${p.lng},${p.lat}&name=${name}`
})

/* 天地图 JS API 交互地图：可拖拽/滚轮缩放 + 企业坐标 marker；
 * 脚本加载或初始化失败（tk 域名白名单 / 网络不通）时回落静态瓦片拼图。 */
const mapEl = ref<HTMLElement | null>(null)
const tdtReady = ref(false)
let tdtMap: any = null

onMounted(() => {
  const p = mapPoint.value
  const tk = mapTk.value
  if (!p || !tk) return
  const w = window as any
  const init = () => {
    if (!mapEl.value || !w.T || tdtMap) return
    try {
      tdtMap = new w.T.Map(mapEl.value)
      tdtMap.centerAndZoom(new w.T.LngLat(p.lng, p.lat), MAP_TILE_ZOOM)
      tdtMap.enableScrollWheelZoom()
      tdtMap.addOverLay(new w.T.Marker(new w.T.LngLat(p.lng, p.lat)))
      tdtReady.value = true
    } catch {
      tdtMap = null
    }
  }
  if (w.T) {
    init()
    return
  }
  const script = document.createElement('script')
  script.src = `https://api.tianditu.gov.cn/api?v=4.0&tk=${encodeURIComponent(tk)}`
  script.async = true
  script.onload = init
  document.head.appendChild(script)
})

onBeforeUnmount(() => {
  if (tdtMap) {
    try {
      tdtMap.destroy?.()
    } catch {}
    tdtMap = null
  }
})

/* 页面级 banner(page_locales.banner,随 page-data 一次返回);与 articles/gallery 同模式 */
const banner = computed(() => (page.value?.blocks as any)?.banner ?? null)
const bannerSlides = computed(() =>
  ((banner.value?.items as any[]) ?? [])
    .map((i) => ({ image: String(i.image ?? ''), alt: i.alt ? String(i.alt) : '' }))
    .filter((s) => !!s.image),
)

useHead({
  title: () => heroTitle.value,
  meta: [{ name: 'description', content: () => displaySummary.value || '' }],
})

/* 表单 schema：SSR 预取（联系页即取，不依赖联系信息卡是否配置，
 * 避免 branding.contact / 页面 contact 块为空时整个联系区（含表单）被隐藏）。
 * 必须走 useAsyncData + await：纯客户端 watch 取数的结果不进 SSR payload，
 * 首帧只会渲染空壳表单（无字段，观感即「表单不显示」）。 */
const formCode = computed(() => nav.value.contactFormCode ?? '')
const formLocale = useLocaleLight().locale
const formOn = computed(() => isContactSlug.value || pageContactRows.value.length > 0)
const { data: formData } = await useAsyncData(
  'web:about-contact-form',
  () => {
    const code = formCode.value
    if (!code || !formOn.value) return Promise.resolve(null)
    return useSiteClient().formSchema(code, { locale: formLocale.value || undefined })
  },
  { watch: [formCode, formOn] },
)
const formSchema = computed<FormSchema | null>(() => (formData.value ?? null) as FormSchema | null)

const submitter = async (payload: Record<string, unknown>, files: Record<string, { raw?: File }[]>) => {
  const code = nav.value.contactFormCode
  if (!code) throw new Error(t('未配置留言表单'))
  // FormFile.raw → 原始 File（无 raw 的项丢弃，保证 multipart 类型正确）
  const raw: Record<string, File[]> = Object.fromEntries(
    Object.entries(files).map(([k, list]) => [k, list.map((f) => f.raw).filter((f): f is File => !!f)]),
  )
  await submitForm(code, payload, { files: raw })
}
</script>

<template>
  <div>
    <!-- 页头：banner → WebHero，否则深色带；二者都承担 h1，
         故 WebAbout 只渲染正文 / 媒体 / 数据条 / 特性卡（不再重复标题摘要）。 -->
    <WebHero
      v-if="bannerSlides.length"
      :slides="bannerSlides"
      :eyebrow="banner?.items?.[0]?.subtitle || displayEyebrow || undefined"
      :title="banner?.items?.[0]?.title || heroTitle"
      :summary="banner?.items?.[0]?.description || displaySummary || undefined"
      variant="overlay"
    />
    <div v-else class="web-band-dark py-14">
      <div class="mx-auto max-w-site px-4 sm:px-6">
        <p v-if="displayEyebrow" class="text-sm font-medium text-white/70">{{ displayEyebrow }}</p>
        <h1 class="mt-3 font-display text-display-md font-bold tracking-tight">{{ heroTitle }}</h1>
        <p v-if="displaySummary" class="mt-3 max-w-2xl leading-relaxed opacity-70">{{ displaySummary }}</p>
      </div>
    </div>

    <!-- 联系形态(content.contact 数据驱动)；联系页且配置了 contact_form_code 时即渲染表单，不受联系信息卡是否为空影响 -->
    <div v-if="contactRows.length || (isContactSlug && nav.contactFormCode)" class="bg-background py-[var(--web-section-py)]" style="--web-section-py: clamp(3rem, 2rem + 2vw, 5rem)">
      <div class="mx-auto max-w-site px-4 sm:px-6">
        <!-- 通栏地图（iframe 或天地图瓦片，contact.map/map_tk 数据驱动，缺省整块隐藏） -->
        <div
          v-if="mapIframeUrl"
          class="h-[320px] overflow-hidden rounded-card border border-border bg-card shadow-card sm:h-[420px]"
        >
          <iframe
            :src="mapIframeUrl"
            class="size-full border-0"
            loading="lazy"
            :title="t('厂区位置')"
            referrerpolicy="no-referrer-when-downgrade"
          />
        </div>
        <div
          v-else-if="mapTiles"
          class="relative h-[320px] overflow-hidden rounded-card border border-border bg-card shadow-card sm:h-[440px]"
        >
          <!-- 天地图 JS API 交互层：拖拽 / 滚轮缩放 / 企业 marker。
               [&_img]:max-w-none 抵消 Tailwind preflight img{max-width:100%} 对绝对定位瓦片的压碎。 -->
          <div
            ref="mapEl"
            class="absolute inset-0 z-10 [&_canvas]:max-w-none [&_img]:max-w-none"
            :class="tdtReady ? '' : 'pointer-events-none opacity-0'"
          />
          <!-- 静态瓦片兜底：JS API 不可用时显示 -->
          <div v-show="!tdtReady" class="absolute inset-0">
            <div
              class="absolute left-1/2 top-1/2 h-[768px] w-[1536px]"
              :style="{ transform: `translate(${-mapTiles.offset.x}px, ${-mapTiles.offset.y}px)` }"
            >
              <template v-for="tile in mapTiles.tiles" :key="tile.key">
                <img
                  :src="tileSrc(tile, 'vec_w', mapTiles.tk)"
                  alt=""
                  draggable="false"
                  loading="lazy"
                  class="absolute size-64 max-w-none select-none"
                  :style="{ left: `${tile.i * 256}px`, top: `${tile.j * 256}px` }"
                />
                <img
                  :src="tileSrc(tile, 'cva_w', mapTiles.tk)"
                  alt=""
                  draggable="false"
                  loading="lazy"
                  class="absolute size-64 max-w-none select-none"
                  :style="{ left: `${tile.i * 256}px`, top: `${tile.j * 256}px` }"
                />
              </template>
            </div>
            <span class="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-full text-primary drop-shadow-md">
              <svg class="size-9" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Z"/><circle cx="12" cy="9" r="2.5" fill="#fff"/></svg>
            </span>
          </div>
          <a
            :href="mapOpenUrl!"
            target="_blank"
            rel="noopener"
            class="absolute bottom-3 right-3 z-10 inline-flex h-9 items-center gap-1 rounded-md bg-background/90 px-3 text-xs font-medium text-foreground shadow-md backdrop-blur transition-colors hover:text-primary"
          >
            {{ t('在地图中打开') }}
            <svg class="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg>
          </a>
          <span class="pointer-events-none absolute bottom-1.5 left-2 z-10 text-[10px] leading-none text-muted-foreground">© 天地图</span>
        </div>

        <!-- 信息卡：图标上、内容下，长文本自然换行 -->
        <ul class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <li
            v-for="row in contactRows"
            :key="row.key"
            :aria-label="row.label"
            class="flex flex-col gap-4 rounded-card border border-border bg-card p-6 shadow-card"
          >
            <span class="flex size-11 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <svg v-if="row.key === 'phone'" class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.08 4.18 2 2 0 0 1 4.06 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.68 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.32 1.85.55 2.81.7A2 2 0 0 1 22 16.92Z"/></svg>
              <svg v-else-if="row.key === 'email'" class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg>
              <svg v-else-if="row.key === 'hours'" class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
              <svg v-else class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
            </span>
            <div class="min-w-0">
              <a
                v-if="row.href"
                :href="row.href"
                class="block break-words font-semibold text-foreground transition-colors hover:text-primary"
              >{{ row.value }}</a>
              <p v-else class="break-words font-semibold leading-relaxed text-foreground">{{ row.value }}</p>
            </div>
          </li>
        </ul>

        <!-- 全宽留言表单 -->
        <WebContactForm
          v-if="nav.contactFormCode"
          :schema="formSchema"
          :submit="submitter"
          class="mt-10"
        />
      </div>
    </div>

    <!-- 通用内容页 -->
    <div v-else class="bg-background py-[var(--web-section-py)]" style="--web-section-py: clamp(3rem, 2rem + 2vw, 5rem)">
      <div class="mx-auto max-w-site px-4 sm:px-6">
        <WebAbout
          variant="split"
          :title="null"
          :body-html="displayBody"
          :image="displayImage"
          :image-alt="heroTitle"
          :features="displayFeatures"
          :stats="displayStats"
        />
      </div>
    </div>
  </div>
</template>
