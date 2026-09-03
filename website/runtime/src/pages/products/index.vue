<script setup lang="ts">
/**
 * 模板：产品总览 —— sidebar / chips 形态经 website.modules.products.listing 配置。
 * 站点本地 pages/products/index.vue 存在时本模板不注册。
 */
import { computed, ref } from 'vue'
import { useHead, useRoute } from 'nuxt/app'
import { useSiteCollection, useSiteCategory } from '../../composables/useSite.ts'
import { useT } from '../../composables/useT.ts'
import { useLocale } from '../../composables/useLocale.ts'
import { useSiteNavigation, recordPath } from '../../lib/site.ts'
import { WebBreadcrumbs, WebCard, WebCollectionPage, WebGrid, WebHero, type WebSidebarNode } from '@edp/website-ui'

const { t } = useT()
const { localePath } = useLocale()

const route = useRoute()
const variant = computed<'sidebar' | 'chips'>(() =>
  (route.meta.websiteModules as any)?.productsListing ?? 'sidebar')

const { data: categoryCtx } = useSiteCategory({ path: 'products' })
const catValues = computed<any>(() => categoryCtx.value?.category?.values ?? null)
const banner = computed(() => catValues.value?.banner ?? null)
const bannerSlides = computed(() =>
  ((banner.value?.items as any[]) ?? [])
    .map((i) => ({ image: String(i.image ?? ''), alt: i.alt ? String(i.alt) : '' }))
    .filter((s) => !!s.image),
)
const sidebarNodes = computed<WebSidebarNode[]>(() =>
  ((catValues.value?.sidebar as any)?.items ?? []).map((n: any) => ({
    title: n.title,
    href: String(n.href || n.url || '/products'),
    active: false,
  })))
const categories = computed(() =>
  sidebarNodes.value.map((n) => ({
    slug: String(n.href ?? '').split('/').filter(Boolean).pop() || '',
    label: n.title,
    href: String(n.href ?? '/products'),
  })))

const page = ref(1)
const { data: collection } = useSiteCollection({ type: 'product', limit: 100, page })
const items = computed(() => collection.value?.items ?? [])
const total = computed(() => Number(collection.value?.meta?.total ?? items.value.length))
const totalPages = computed(() => Number(collection.value?.meta?.total_pages ?? 0))
function makePageHref(p: number): string | null {
  return p === 1 ? localePath('/products') : `${localePath('/products')}?page=${p}`
}

/** 面包屑统一口径:后端已含「首页」时不重复前置;层级(含首页)<3 时组件整体不渲染。 */
const breadcrumbs = computed<any[]>(() => {
  const mapped = (((catValues.value?.breadcrumbs as any[]) ?? [])).map((c) => ({
    label: String(c.label ?? ''),
    href: (c.href as string) ?? null,
  }))
  return mapped[0]?.label === t('首页') ? mapped : [{ label: t('首页'), href: localePath('/') }, ...mapped]
})

useHead({ title: () => t('产品中心') })

const vals = (item: any): Record<string, any> => item?.values ?? {}
function extractId(key: string, v: Record<string, any> | null): number | string {
  const id = v?.id
  if (id != null && id !== '') return id as number | string
  const tail = String(key).split(':').pop() ?? key
  return /^\d+$/.test(tail) ? Number(tail) : tail
}
</script>

<template>
  <WebCollectionPage
    :variant="variant"
    :title="t('产品中心')"
    :summary="catValues?.description || ''"
    :sidebar="variant === 'sidebar' ? sidebarNodes : undefined"
  >
    <template #head>
      <WebHero
        v-if="bannerSlides.length"
        :slides="bannerSlides"
        :eyebrow="banner?.items?.[0]?.subtitle || undefined"
        :title="banner?.items?.[0]?.title || t('产品中心')"
        :summary="banner?.items?.[0]?.description || undefined"
        variant="overlay"
      />
      <section v-else class="border-b border-border bg-muted/40">
        <div class="mx-auto max-w-site px-4 py-10 sm:px-6 sm:py-14">
          <WebBreadcrumbs :items="breadcrumbs" class="mb-4" />
          <h1 class="font-display text-display-md font-bold tracking-tight">{{ banner?.items?.[0]?.title || t('产品中心') }}</h1>
          <p v-if="catValues?.description || banner?.items?.[0]?.description" class="mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">{{ catValues?.description || banner?.items?.[0]?.description }}</p>
        </div>
      </section>
      <!-- 有 banner 时面包屑置于 banner 下方 -->
      <div v-if="bannerSlides.length && breadcrumbs.length > 2" class="border-b border-border bg-background">
        <div class="mx-auto max-w-site px-4 py-3 sm:px-6">
          <WebBreadcrumbs :items="breadcrumbs" />
        </div>
      </div>
      <div v-if="variant === 'chips' && categories.length" class="mb-8 flex flex-wrap gap-2">
        <a
          v-for="cat in categories"
          :key="cat.slug"
          :href="localePath(cat.href)"
          class="inline-flex h-9 items-center rounded-full border border-border bg-card px-4 text-sm text-foreground/75 transition-colors hover:border-primary/40 hover:text-primary"
        >{{ cat.label }}</a>
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
    <p v-else class="rounded-card border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
      {{ t('该分类暂无产品，敬请期待。') }}
    </p>
  </WebCollectionPage>
</template>
