<script setup lang="ts">
/**
 * 模板:产品分类 / 详情双模式。
 *   /products/{id}   → 详情(WebRecordPage + SiteRecordMedia 站点挂点)
 *   /products/{slug} → 分类列表(侧栏树来自 category 上下文)
 */
import { computed } from 'vue'
import { useSiteCollection, useSiteCategory, useSiteRecord } from '../../composables/useSite.ts'
import { useT } from '../../composables/useT.ts'
import { useLocale } from '../../composables/useLocale.ts'
import { useSiteNavigation, recordPath } from '../../lib/site.ts'
import { useHead, useRoute } from 'nuxt/app'
import { WebBreadcrumbs, WebCard, WebCollectionPage, WebGrid, WebHero, WebPagination as OPagination, WebRecordPage, type WebSidebarNode, type WebRecordNavItem } from '@edp/website-ui'
import { isActivePath } from '@edp/website-ui'

const route = useRoute()
const { t } = useT()
const { localePath } = useLocale()
const cfg = useSiteNavigation()

const slug = computed(() => String(route.params.slug ?? ''))
const isDetail = computed(() => /^\d+$/.test(slug.value))
const categoryPath = computed(() => `products/${slug.value}`)
const contactPath = computed(() => cfg.value.contactPath)

/* ---------- 分类模式 ---------- */
const { data: collection, error: collectionError } = useSiteCollection({
  type: 'product',
  categorySlug: isDetail.value ? null : categoryPath,
  limit: 100,
})
const { data: categoryCtx } = useSiteCategory({ path: isDetail.value ? null : categoryPath })

/* ---------- 详情模式 ---------- */
const { data: record } = useSiteRecord({
  type: 'product',
  id: computed(() => (isDetail.value ? Number(slug.value) : null)),
})

const catValues = computed<any>(() => categoryCtx.value?.category?.values ?? null)
const recValues = computed<any>(() => record.value?.record?.values ?? null)
const recCatValues = computed<any>(() => record.value?.category?.values ?? null)

/** 品牌徽标：仅随数据渲染（values.brand / brandName），不设任何默认品牌名（禁止硬编码可见文本）。 */
const brand = computed(() => {
  const v = recValues.value ?? {}
  const b = v.brand ?? v.brandName
  return b == null || b === '' ? '' : String(b)
})
const recCatBanner = computed(() => recCatValues.value?.banner ?? null)
const recCatBannerSlides = computed(() =>
  ((recCatBanner.value?.items as any[]) ?? [])
    .map((i) => ({ image: String(i.image ?? ''), alt: i.alt ? String(i.alt) : '' }))
    .filter((s) => !!s.image),
)
const catBanner = computed(() => catValues.value?.banner ?? null)
const catBannerSlides = computed(() =>
  ((catBanner.value?.items as any[]) ?? [])
    .map((i) => ({ image: String(i.image ?? ''), alt: i.alt ? String(i.alt) : '' }))
    .filter((s) => !!s.image),
)

const pageTitle = computed(() =>
  isDetail.value ? recValues.value?.title : catValues.value?.title ?? slug.value)
const pageSummary = computed(() =>
  isDetail.value ? recValues.value?.summary : catValues.value?.description ?? '')

/**
 * 面包屑:后端 breadcrumbs 已含「首页」时不重复前置;并做相邻去重。
 */
const breadcrumbs = computed(() => {
  const crumbs = (isDetail.value ? recCatValues.value?.breadcrumbs : catValues.value?.breadcrumbs) ?? []
  const mapped = (crumbs as any[]).map((c) => ({ label: c.label as string, href: (c.href as string) ?? null }))
  const home = { label: t('首页'), href: localePath('/') }
  const list: Array<{ label: string; href: string | null }> = mapped[0]?.label === home.label ? mapped : [home, ...mapped]
  if (isDetail.value && recValues.value) {
    const last = list[list.length - 1]
    if (last?.label !== recValues.value.title) list.push({ label: recValues.value.title as string, href: null })
  }
  // 相邻同名校验(后端数据防御)
  return list.filter((c, i) => i === 0 || c.label !== list[i - 1]!.label)
})

const sidebarRaw = computed<any[]>(() =>
  (isDetail.value ? recCatValues.value?.sidebar?.items : catValues.value?.sidebar?.items) ?? [])
const mapNodes = (nodes: any[]): WebSidebarNode[] =>
  nodes.map((n: any) => ({
    title: n.title,
    href: String(n.href || n.url || '/products'),
    active: isActivePath(`/products/${slug.value}`, String(n.href || n.url || '')),
    children: mapNodes(n.children ?? []),
  }))
const sidebarNodes = computed<WebSidebarNode[]>(() => mapNodes(sidebarRaw.value))

const page = computed(() => Number(collection.value?.meta?.page ?? 1))
const totalPages = computed(() => Number(collection.value?.meta?.total_pages ?? 0))
const items = computed(() => collection.value?.items ?? [])
const total = computed(() => Number(collection.value?.meta?.total ?? items.value.length))

const gallery = computed(() => {
  const m = recValues.value?.media
  return Array.isArray(m) && m.length
    ? m.map((g: any) => ({ url: String(g.src ?? g.url ?? g), alt: String(g.alt ?? pageTitle.value ?? '') }))
    : []
})

useHead({
  title: () => pageTitle.value || t('产品中心'),
  meta: [{ name: 'description', content: () => pageSummary.value || '' }],
})

const vals = (item: any): Record<string, any> => item?.values ?? {}
function extractId(key: string, v: Record<string, any> | null): number | string {
  const id = v?.id
  if (id != null && id !== '') return id as number | string
  const tail = String(key).split(':').pop() ?? key
  return /^\d+$/.test(tail) ? Number(tail) : tail
}

function makePageHref(p: number): string | null {
  return p === 1 ? localePath(categoryPath.value) : `${localePath(categoryPath.value)}?page=${p}`
}

function makeNavHref(item: WebRecordNavItem): string {
  return localePath(recordPath('product', item.id))
}
</script>


<template>
  <div>
    <!-- 分类模式 -->
    <WebCollectionPage
      v-if="!isDetail"
      variant="sidebar"
      :title="pageTitle ?? t('产品中心')"
      :summary="pageSummary"
      :sidebar="sidebarNodes"
    >
      <template #head>
        <WebHero
          v-if="catBannerSlides.length"
          :slides="catBannerSlides"
          :eyebrow="catBanner?.items?.[0]?.subtitle || undefined"
          :title="catBanner?.items?.[0]?.title || pageTitle || undefined"
          :summary="catBanner?.items?.[0]?.description || undefined"
          variant="overlay"
        />
        <section v-else class="border-b border-border bg-muted/40">
          <div class="mx-auto max-w-site px-4 py-10 sm:px-6 sm:py-14">
            <WebBreadcrumbs :items="breadcrumbs" class="mb-4" />
            <h1 class="font-display text-display-md font-bold tracking-tight">{{ pageTitle }}</h1>
            <p v-if="pageSummary" class="mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">{{ pageSummary }}</p>
          </div>
        </section>
        <div v-if="catBannerSlides.length && breadcrumbs.length > 2" class="border-b border-border bg-background">
          <div class="mx-auto max-w-site px-4 py-3 sm:px-6">
            <WebBreadcrumbs :items="breadcrumbs" />
          </div>
        </div>
      </template>

      <WebGrid v-if="items.length" :cols="3">
        <WebCard
          v-for="item in items"
          :key="String(item.key)"
          kind="product"
          variant="raised"
          :title="vals(item).title"
          :summary="vals(item).summary"
          :image="vals(item).cover"
          :href="localePath(recordPath('product', extractId(String(item.key), vals(item))))"
        />
      </WebGrid>
      <p v-else-if="collectionError" class="rounded-card border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
        {{ t('未找到该分类,请从侧栏选择其他系列。') }}
      </p>
      <p v-else class="rounded-card border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
        {{ t('该分类暂无产品,敬请期待。') }}
      </p>

      <template #pagination>
        <div v-if="totalPages > 1" class="flex flex-col items-center gap-4">
          <p class="web-num text-sm text-muted-foreground">{{ t('共 {count} 件产品', { count: total }) }}</p>
          <OPagination :page="page" :total-pages="totalPages" :make-href="makePageHref" />
        </div>
      </template>
    </WebCollectionPage>

    <!-- 详情模式:媒体区走 SiteRecordMedia 站点挂点(缺省实现为图/集) -->
    <template v-else>
      <WebHero
        v-if="recCatBannerSlides.length"
        :slides="recCatBannerSlides"
        :eyebrow="recCatBanner?.items?.[0]?.subtitle || undefined"
        :title="recCatBanner?.items?.[0]?.title || undefined"
        :summary="recCatBanner?.items?.[0]?.description || undefined"
        variant="overlay"
      />
      <div :class="recCatBannerSlides.length ? 'border-b border-border bg-background' : 'bg-secondary py-6'">
        <div class="mx-auto max-w-site px-4 sm:px-6" :class="recCatBannerSlides.length ? 'py-3' : ''">
          <WebBreadcrumbs :items="breadcrumbs" :on-dark="!recCatBannerSlides.length" />
        </div>
      </div>

      <!-- 主题色一律走站点令牌（main.css / 后台主题），模板不得内联覆盖站点 primary -->
      <WebRecordPage
        class="web-record--product"
        :title="pageTitle ?? ''"
        :summary="pageSummary"
        :cover="recValues?.cover ?? null"
        :gallery="gallery"
        :body-html="recValues?.body ?? null"
        :previous="record?.navigation?.previous ?? null"
        :next="record?.navigation?.next ?? null"
        :make-nav-href="makeNavHref"
      >
        <template #media="{ cover, gallery: mediaGallery }">
          <SiteRecordMedia :cover="(cover as string | null)" :gallery="(mediaGallery as any[])" :title="(pageTitle as string)" />
        </template>

        <template #aside>
          <div v-if="brand" class="inline-flex w-fit rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground">{{ brand }}</div>
          <dl class="grid grid-cols-2 gap-3">
            <template v-for="a in (recValues?.attributes ?? [])" :key="(a.code ?? a.label ?? '')">
              <div v-if="a.code !== 'name' && a.value !== null && a.value !== undefined && a.value !== ''" class="rounded-md border border-border bg-card px-4 py-3">
                <dt class="text-xs text-muted-foreground">{{ a.label ?? a.code }}</dt>
                <dd class="mt-1 text-sm font-medium text-foreground">{{ typeof a.value === 'object' ? JSON.stringify(a.value) : a.value }}</dd>
              </div>
            </template>
          </dl>
          <div class="flex items-center gap-3">
            <a
              :href="localePath(contactPath)"
              class="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-8 text-sm font-bold text-primary-foreground shadow-lg transition-all hover:-translate-y-0.5 hover:bg-primary/90"
            >
              {{ t('咨询报价') }}
              <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14m-7-7 7 7-7 7"/></svg>
            </a>
            <a
              :href="localePath(contactPath)"
              class="inline-flex h-12 items-center rounded-full border border-border bg-card px-8 text-sm font-bold text-foreground transition-colors hover:border-primary/50 hover:text-primary"
            >{{ t('联系我们') }}</a>
          </div>
        </template>
      </WebRecordPage>
    </template>
  </div>
</template>
