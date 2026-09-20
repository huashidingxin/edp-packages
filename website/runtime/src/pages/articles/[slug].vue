<script setup lang="ts">
import { submitForm, useBootstrapMenus, useBootstrapSite, useSiteCategory, useSiteCollection, useSitePageData, useSiteRecord } from '../../composables/useSite.ts'
import { useT } from '../../composables/useT.ts'
import { useLocale } from '../../composables/useLocale.ts'
import { recordPath, useSiteNavigation } from '../../lib/site.ts'
import { useWebReveal } from '../../composables/useWebReveal.ts'
/** 资讯栏目 / 详情双模式（通用：胶囊分类 + 详情）。 */
import { computed, ref } from 'vue'
import { useHead, useRoute } from 'nuxt/app'
import { WebBreadcrumbs, WebHero, WebRichText, WebShare } from '@edp/website-ui'

const route = useRoute()
const { t } = useT()
const { localePath } = useLocale()
const cfg = useSiteNavigation()
const site = useBootstrapSite()
const menus = useBootstrapMenus()

const siteName = computed(() => site.value?.name || '')
const contact = computed<Record<string, any>>(
  () => ((site.value?.branding as any)?.contact ?? {}) as Record<string, any>,
)
const phone = computed(() => String(contact.value.phone ?? contact.value.mobile ?? ''))

const slug = computed(() => String(route.params.slug ?? ''))
const isDetail = computed(() => /^\d+$/.test(slug.value))
const defaultSlug = computed(() => cfg.value.defaultArticlesSlug)

const { data: categoryCtx } = useSiteCategory({ path: 'articles' })
const catValues = computed<any>(() => categoryCtx.value?.category?.values ?? null)
const banner = computed(() => catValues.value?.banner ?? null)
const bannerSlides = computed(() =>
  ((banner.value?.items as any[]) ?? [])
    .map((i) => ({ image: String(i.image ?? ''), alt: i.alt ? String(i.alt) : '' }))
    .filter((s) => !!s.image),
)
const categories = computed<any[]>(() =>
  ((catValues.value?.sidebar as any)?.items ?? []).map((n: any) => ({
    slug: String(n.href ?? n.url ?? '').split('/').filter(Boolean).pop() || '',
    label: n.title,
  })),
)
const crumbs = computed(() => [
  { label: t('首页'), href: '/' },
  { label: t('新闻资讯'), href: `/articles/${defaultSlug.value}` },
  { label: pageTitle.value ?? '' },
])

const { data: collection } = useSiteCollection({
  type: 'article',
  categorySlug: computed(() => (isDetail.value ? null : `articles/${slug.value}`)),
  limit: 100,
})
const { data: record } = useSiteRecord({
  type: 'article',
  id: computed(() => (isDetail.value ? Number(slug.value) : null)),
})

const items = computed(() => collection.value?.items ?? [])

/** 列表入场：进入视口才播放（首屏直出，后续卡片按 index 错峰上浮）。 */
const listRef = ref<HTMLElement | null>(null)
useWebReveal(() => listRef.value, { deps: [items] })

/** 列表页右侧栏：精选推荐阅读（取前 5 篇） */
const recommendedItems = computed(() => items.value.slice(0, 5))

/** 列表页右侧栏：了解企业 / 快捷通道 */
const quickLinks = computed(() => {
  const links: Array<{ label: string; href: string }> = []
  const allMenuItems = [...(menus.value?.header ?? []), ...(menus.value?.footer ?? [])]

  const aboutItem = allMenuItems.find((m: any) => String(m.href ?? '').startsWith('/about'))
  links.push({
    label: aboutItem?.title || t('企业简介'),
    href: String(aboutItem?.href ?? '/about'),
  })

  const prodItem = allMenuItems.find((m: any) =>
    String(m.href ?? '').startsWith('/products') || String(m.href ?? '').startsWith('/cases'),
  )
  if (prodItem) {
    links.push({
      label: prodItem.title,
      href: String(prodItem.href),
    })
  }

  const contactItem = allMenuItems.find((m: any) => String(m.href ?? '').includes('contact'))
  links.push({
    label: contactItem?.title || t('联系我们'),
    href: String(contactItem?.href ?? cfg.value.contactPath ?? '/contact'),
  })

  return links
})

const recValues = computed<any>(() => record.value?.record?.values ?? null)
/** 详情页:文章所属分类的上下文随 record 接口返回,其 sidebar 树已由后端标记 active。 */
const recordCtx = computed<any>(() => record.value?.category?.values ?? null)
const currentCategory = computed(() => categories.value.find((c) => c.slug === slug.value))
const pageTitle = computed(() => (isDetail.value ? recValues.value?.title : currentCategory.value?.label) ?? t('资讯中心'))

/** 详情页侧边栏分类导航:详情用文章所属分类的 sidebar(自带 active 高亮);无数据时兜底当前栏目入口。 */
const navCategories = computed<any[]>(() => {
  const src = (isDetail.value ? recordCtx.value?.sidebar : catValues.value?.sidebar) as any
  const nodes = ((src?.items ?? []) as any[]).map((n) => ({
    slug: String(n.href ?? n.url ?? '').split('/').filter(Boolean).pop() || '',
    label: n.title,
    active: n.active === true,
  }))
  if (nodes.length) return nodes
  if (categories.value.length) return categories.value.map((c) => ({ ...c, active: c.slug === slug.value }))
  const label = (catValues.value?.title as string) || currentCategory.value?.label || t('资讯中心')
  return [{ slug: defaultSlug.value, label, active: true }]
})

/** 详情页:文章所属分类(标题 + 列表页链接),用于标题旁的分类入口。 */
const detailCat = computed(() => {
  if (!isDetail.value) return null
  const catSlug = String(recordCtx.value?.slug ?? '')
  return catSlug ? { slug: catSlug, label: String(recordCtx.value?.title ?? '') } : null
})

const dateOf = computed(() => {
  const v = recValues.value?.published_at
  if (!v) return null
  const d = new Date(v as string)
  return Number.isNaN(d.getTime()) ? null : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})

useHead({
  title: () => pageTitle.value || t('新闻资讯'),
  meta: [{ name: 'description', content: () => recValues.value?.summary || '' }],
})

const vals = (item: any): Record<string, any> => item?.values ?? {}
function extractId(key: string, v: Record<string, any> | null): number | string {
  const id = v?.id
  if (id != null && id !== '') return id as number | string
  const tail = String(key).split(':').pop() ?? key
  return /^\d+$/.test(tail) ? Number(tail) : tail
}

/** 完整格式化日期 YYYY-MM-DD */
function formatDate(v: unknown): string | null {
  const m = String(v ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null
}

const detailCrumbs = computed(() => [
  { label: t('首页'), href: '/' },
  { label: t('新闻资讯'), href: `/articles/${defaultSlug.value}` },
  ...(detailCat.value ? [{ label: detailCat.value.label, href: `/articles/${detailCat.value.slug}` }] : []),
  { label: pageTitle.value ?? '' },
])

</script>

<template>
  <div>
    <!-- 栏目列表 -->
    <template v-if="!isDetail">
      <WebHero
        v-if="bannerSlides.length"
        :slides="bannerSlides"
        :eyebrow="banner?.items?.[0]?.subtitle || undefined"
        :title="banner?.items?.[0]?.title || pageTitle || undefined"
        :summary="banner?.items?.[0]?.description || undefined"
        variant="overlay"
      />
      <section v-else class="web-band-dark py-14">
        <div class="mx-auto max-w-site px-4 sm:px-6">
          <WebBreadcrumbs :items="crumbs" on-dark />
          <h1 class="mt-4 font-display text-display-md font-bold tracking-tight text-white">{{ pageTitle }}</h1>
        </div>
      </section>
      <div v-if="bannerSlides.length" class="border-b border-border bg-background">
        <div class="mx-auto max-w-site px-4 py-3 sm:px-6">
          <WebBreadcrumbs :items="crumbs" />
        </div>
      </div>
      <!-- 列表区:左侧新闻单列 + 右侧侧边栏(分类+推荐+快捷通道) -->
      <div class="bg-background pb-14 pt-10 sm:pb-20 sm:pt-12">
        <div class="mx-auto max-w-site px-4 sm:px-6">
          <!-- 经典两栏布局:左侧新闻单列(主栏自动撑满)+右侧侧边栏,两端完全占满版心宽度 -->
          <div class="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-10">
            <!-- 左主栏:新闻列表(自动撑满可用宽度) -->
            <main class="min-w-0 flex-1">
              <div v-if="items.length" ref="listRef" class="flex flex-col gap-4 sm:gap-5">
                <a
                  v-for="(item, i) in items"
                  :key="String(item.key)"
                  :href="localePath(recordPath('article', extractId(String(item.key), vals(item))))"
                  data-web-reveal
                  :data-web-reveal-delay="`${Math.min(i * 60, 300)}ms`"
                  class="group relative flex flex-col sm:flex-row items-stretch overflow-hidden rounded-2xl border border-border/80 bg-card p-3.5 sm:p-4 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-md hover:shadow-primary/[0.06]"
                >
                  <!-- 激活氛围:主色微光泽 -->
                  <span
                    class="pointer-events-none absolute inset-0 bg-gradient-to-r from-primary/[0.04] via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                    aria-hidden="true"
                  />
                  <!-- 左侧主题色指示条 -->
                  <span
                    class="pointer-events-none absolute left-0 top-0 h-full w-1 origin-top scale-y-0 rounded-r-full bg-gradient-to-b from-primary to-primary/60 transition-transform duration-300 group-hover:scale-y-100"
                    aria-hidden="true"
                  />

                  <!-- ① 缩略图:精确定位 220×120 (移动端自适应, sm及以上固定 220×120) -->
                  <div class="relative h-44 w-full shrink-0 overflow-hidden rounded-xl bg-muted ring-1 ring-border/30 sm:h-[120px] sm:w-[220px]">
                    <img
                      v-if="vals(item).cover"
                      :src="String(vals(item).cover)"
                      :alt="String(vals(item).title ?? '')"
                      class="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    >
                    <!-- 无图高级微渐变徽章 -->
                    <div v-else class="relative flex size-full items-center justify-center overflow-hidden bg-gradient-to-br from-primary/[0.08] via-accent/30 to-muted/80">
                      <span class="pointer-events-none absolute -right-3 -top-3 size-16 rounded-full bg-primary/10 blur-lg" aria-hidden="true" />
                      <div class="relative grid size-10 place-items-center rounded-xl bg-card/90 shadow-xs ring-1 ring-black/5 dark:ring-white/10 transition-transform duration-500 group-hover:scale-110">
                        <svg
                          class="size-5 text-primary/75 transition-colors duration-300 group-hover:text-primary"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="1.75"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
                          <path d="M18 14h-8" />
                          <path d="M15 18h-5" />
                          <path d="M10 6h8v4h-8V6Z" />
                        </svg>
                      </div>
                    </div>

                    <!-- 悬浮遮罩 -->
                    <span class="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" aria-hidden="true" />
                  </div>

                  <!-- ② 右侧文字区:标题 + 2 行摘要 + 底部日期与详情 -->
                  <div class="mt-3 flex min-w-0 flex-1 flex-col justify-between sm:mt-0 sm:pl-4">
                    <div>
                      <h3 class="web-clamp-1 sm:web-clamp-2 font-display text-base font-bold leading-snug tracking-tight text-foreground transition-colors duration-200 group-hover:text-primary sm:text-lg">
                        {{ vals(item).title }}
                      </h3>
                      <p v-if="vals(item).summary" class="web-clamp-2 mt-1.5 text-xs leading-relaxed text-muted-foreground transition-colors duration-200 group-hover:text-foreground/80 sm:text-sm">
                        {{ vals(item).summary }}
                      </p>
                    </div>

                    <!-- 底部元数据:日期 + 查看详情 -->
                    <div class="mt-3 flex items-center justify-between border-t border-border/50 pt-2 text-xs text-muted-foreground">
                      <span v-if="formatDate(vals(item).published_at)" class="web-num flex items-center gap-1.5 font-medium transition-colors duration-200 group-hover:text-foreground/75">
                        <svg class="size-3.5 text-muted-foreground/70 transition-colors duration-200 group-hover:text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
                          <line x1="16" x2="16" y1="2" y2="6"/>
                          <line x1="8" x2="8" y1="2" y2="6"/>
                          <line x1="3" x2="21" y1="10" y2="10"/>
                        </svg>
                        {{ formatDate(vals(item).published_at) }}
                      </span>
                      <span v-else />

                      <span class="inline-flex items-center gap-1 text-xs font-semibold text-primary transition-all duration-200 group-hover:translate-x-0.5">
                        {{ t('查看详情') }}
                        <svg class="size-3.5 transition-transform duration-200 group-hover:translate-x-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M5 12h14" />
                          <path d="m12 5 7 7-7 7" />
                        </svg>
                      </span>
                    </div>
                  </div>
                </a>
              </div>

              <!-- 空状态 -->
              <div v-else class="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border/80 bg-card/60 p-14 text-center sm:p-20">
                <div class="relative grid size-16 place-items-center rounded-2xl bg-primary/10 text-primary shadow-xs">
                  <svg class="size-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>
                    <path d="M14 2v4a2 2 0 0 0 2 2h4"/>
                    <path d="M10 13H8"/>
                    <path d="M16 17H8"/>
                    <path d="M16 13h-2"/>
                  </svg>
                </div>
                <p class="text-sm font-medium text-muted-foreground">{{ t('该栏目暂无内容，敬请期待。') }}</p>
              </div>
            </main>

            <!-- 右侧边栏:资讯分类 + 推荐阅读 + 了解企业/快捷通道 (把页面右侧饱满地撑起来) -->
            <aside class="flex w-full shrink-0 flex-col gap-5 lg:sticky lg:top-20 lg:w-80 xl:w-84 2xl:w-96">
              <!-- 资讯分类导航(若有多个分类则展示) -->
              <div v-if="categories.length > 1" class="rounded-2xl border border-border/80 bg-card p-5 shadow-xs">
                <h4 class="flex items-center gap-2 text-sm font-bold text-foreground">
                  <span class="size-1.5 rounded-full bg-primary" aria-hidden="true" />
                  {{ t('分类') }}
                </h4>
                <nav class="mt-3.5 flex flex-col gap-1.5" :aria-label="t('分类')">
                  <a
                    v-for="cat in categories"
                    :key="cat.slug"
                    :href="localePath(`/articles/${cat.slug}`)"
                    :aria-current="cat.slug === slug ? 'page' : undefined"
                    :class="[
                      'group flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm transition-all duration-200',
                      cat.slug === slug
                        ? 'bg-primary/10 text-primary font-semibold shadow-2xs ring-1 ring-primary/20'
                        : 'font-medium text-muted-foreground hover:bg-muted/70 hover:text-foreground hover:translate-x-0.5',
                    ]"
                  >
                    <span class="flex items-center gap-2">
                      <span
                        class="size-1.5 rounded-full transition-all duration-200"
                        :class="cat.slug === slug ? 'bg-primary scale-125' : 'bg-transparent group-hover:bg-muted-foreground/40'"
                        aria-hidden="true"
                      />
                      {{ cat.label }}
                    </span>
                    <svg
                      class="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
                      :class="cat.slug === slug ? 'text-primary' : 'opacity-0 group-hover:opacity-100 text-muted-foreground/60'"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </a>
                </nav>
              </div>

              <!-- 推荐阅读 -->
              <div v-if="recommendedItems.length" class="rounded-2xl border border-border/80 bg-card p-5 shadow-xs">
                <h4 class="flex items-center gap-2 text-sm font-bold text-foreground">
                  <span class="size-1.5 rounded-full bg-primary" aria-hidden="true" />
                  {{ t('推荐阅读') }}
                </h4>
                <div class="mt-4 flex flex-col divide-y divide-border/50">
                  <a
                    v-for="(item, idx) in recommendedItems"
                    :key="`rec-${String(item.key)}`"
                    :href="localePath(recordPath('article', extractId(String(item.key), vals(item))))"
                    class="group flex items-start gap-3 py-3 first:pt-0 last:pb-0 transition-colors"
                  >
                    <span class="web-num mt-0.5 text-xs font-bold text-muted-foreground/60 transition-colors duration-200 group-hover:text-primary">
                      {{ String(idx + 1).padStart(2, '0') }}
                    </span>
                    <div class="min-w-0 flex-1">
                      <p class="web-clamp-1 text-sm font-medium text-foreground transition-colors duration-200 group-hover:text-primary">
                        {{ vals(item).title }}
                      </p>
                      <p v-if="formatDate(vals(item).published_at)" class="web-num mt-1 text-[11px] text-muted-foreground">
                        {{ formatDate(vals(item).published_at) }}
                      </p>
                    </div>
                  </a>
                </div>
              </div>

              <!-- 了解企业 / 快捷通道 -->
              <div class="rounded-2xl border border-border/80 bg-card p-5 shadow-xs">
                <h4 class="flex items-center gap-2 text-sm font-bold text-foreground">
                  <span class="size-1.5 rounded-full bg-primary" aria-hidden="true" />
                  {{ siteName ? `${t('了解')}${siteName}` : t('了解我们') }}
                </h4>
                <nav class="mt-4 flex flex-col gap-1.5">
                  <a
                    v-for="link in quickLinks"
                    :key="link.href"
                    :href="localePath(link.href)"
                    class="group flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium text-muted-foreground transition-all duration-200 hover:bg-muted/80 hover:text-foreground hover:translate-x-0.5"
                  >
                    <span>{{ link.label }}</span>
                    <svg class="size-3.5 text-muted-foreground transition-transform duration-200 group-hover:translate-x-1 group-hover:text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M5 12h14" />
                      <path d="m12 5 7 7-7 7" />
                    </svg>
                  </a>
                </nav>
              </div>

              <!-- 咨询热线(若有) -->
              <div v-if="phone" class="rounded-2xl border border-border/80 bg-gradient-to-br from-card to-muted/40 p-5 shadow-xs">
                <p class="text-xs font-medium text-muted-foreground">{{ t('服务咨询热线') }}</p>
                <a :href="`tel:${phone.replace(/-/g, '')}`" class="web-num mt-1.5 flex items-center gap-2 text-base font-bold text-primary hover:underline">
                  <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                  </svg>
                  {{ phone }}
                </a>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </template>

    <!-- 文章详情 -->
    <template v-else>
      <!-- Banner -->
      <WebHero
        v-if="bannerSlides.length"
        :slides="bannerSlides"
        :eyebrow="banner?.items?.[0]?.subtitle || undefined"
        :title="banner?.items?.[0]?.title || pageTitle"
        :summary="banner?.items?.[0]?.description || undefined"
        variant="overlay"
      />
      <div v-if="bannerSlides.length" class="border-b border-border bg-background">
        <div class="mx-auto max-w-site px-4 py-3 sm:px-6">
          <WebBreadcrumbs :items="detailCrumbs" />
        </div>
      </div>
      <section v-else class="relative overflow-hidden bg-secondary text-secondary-foreground">
        <div class="pointer-events-none absolute -right-20 -top-20 size-80 rounded-full bg-primary/15 blur-3xl" aria-hidden="true" />
        <div class="relative mx-auto max-w-site px-4 py-8 sm:px-6 sm:py-10">
          <WebBreadcrumbs :items="detailCrumbs" :min-levels="2" on-dark />
        </div>
      </section>

      <!-- 详情主体:左侧边栏 + 右侧内容 -->
      <div class="bg-background py-12 sm:py-16">
        <div class="mx-auto max-w-site px-4 sm:px-6">
          <div class="flex flex-col gap-10 lg:flex-row">
            <!-- 左侧边栏 -->
            <aside class="w-full shrink-0 lg:sticky lg:top-20 lg:w-64 lg:self-start">
              <!-- 分类导航 -->
              <div class="rounded-2xl border border-border/80 bg-card p-5 shadow-xs">
                <h4 class="mb-4 flex items-center gap-2 text-sm font-bold text-foreground">
                  <span class="size-1.5 rounded-full bg-primary" aria-hidden="true" />
                  {{ t('分类') }}
                </h4>
                <nav class="flex flex-col gap-1.5">
                  <a
                    v-for="cat in navCategories"
                    :key="cat.slug"
                    :href="localePath(`/articles/${cat.slug}`)"
                    :class="[
                      'group flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200',
                      cat.active
                        ? 'bg-primary/10 text-primary font-semibold shadow-2xs'
                        : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground hover:translate-x-0.5',
                    ]"
                  >
                    <span>{{ cat.label }}</span>
                    <svg
                      :class="['size-3.5 transition-transform duration-200', cat.active ? 'text-primary' : 'opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 text-muted-foreground']"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </a>
                </nav>
              </div>

              <!-- 分享组件 -->
              <div class="mt-5 rounded-2xl border border-border/80 bg-card p-5 shadow-xs">
                <WebShare :title="recValues?.title" :summary="recValues?.summary" />
              </div>
            </aside>

            <!-- 右侧文章内容 -->
            <article class="min-w-0 flex-1">
              <h1 class="font-display text-2xl font-bold leading-tight tracking-tight sm:text-3xl lg:text-4xl">{{ recValues?.title }}</h1>
              <div class="mt-4 flex flex-wrap items-center gap-3 border-b border-border/60 pb-6 text-sm text-muted-foreground">
                <a
                  v-if="detailCat"
                  :href="localePath(`/articles/${detailCat.slug}`)"
                  class="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
                >{{ detailCat.label }}</a>
                <span v-if="dateOf" class="web-num flex items-center gap-1.5 font-medium">
                  <svg class="size-4 text-primary/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
                  {{ dateOf }}
                </span>
              </div>

              <!-- 详情封面（若有） -->
              <figure v-if="recValues?.cover" class="mt-8 overflow-hidden rounded-2xl border border-border/80 shadow-card">
                <img :src="String(recValues.cover)" :alt="String(recValues?.title ?? '')" class="aspect-[16/9] w-full object-cover" loading="lazy">
              </figure>
              <!-- 详情视频（若有） -->
              <div v-if="recValues?.video" class="mt-8 overflow-hidden rounded-2xl border border-border bg-black shadow-card">
                <video :src="String(recValues.video)" controls preload="metadata" playsinline class="aspect-video w-full" />
              </div>

              <WebRichText v-if="recValues?.body" :html="recValues.body" tag="section" class="mt-8" />

              <!-- 上下篇切换与返回列表导航 -->
              <div class="mt-12 border-t border-border/70 pt-8">
                <nav class="grid gap-4 sm:grid-cols-2" :aria-label="t('文章切换')">
                  <a
                    v-if="record?.navigation?.previous"
                    :href="localePath(recordPath('article', record.navigation.previous.id))"
                    class="group relative flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-5 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-md"
                  >
                    <div class="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors group-hover:text-primary">
                      <svg class="size-3.5 transition-transform duration-200 group-hover:-translate-x-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="m15 18-6-6 6-6" />
                      </svg>
                      <span>{{ t('上一篇') }}</span>
                    </div>
                    <p class="web-clamp-2 mt-2 text-sm font-medium leading-snug text-foreground transition-colors group-hover:text-primary">
                      {{ record.navigation.previous.title }}
                    </p>
                  </a>
                  <span v-else aria-hidden="true" />

                  <a
                    v-if="record?.navigation?.next"
                    :href="localePath(recordPath('article', record.navigation.next.id))"
                    class="group relative flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-5 text-right shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-md sm:col-start-2"
                  >
                    <div class="flex items-center justify-end gap-1.5 text-xs font-semibold text-muted-foreground transition-colors group-hover:text-primary">
                      <span>{{ t('下一篇') }}</span>
                      <svg class="size-3.5 transition-transform duration-200 group-hover:translate-x-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="m9 18 6-6-6-6" />
                      </svg>
                    </div>
                    <p class="web-clamp-2 mt-2 text-sm font-medium leading-snug text-foreground transition-colors group-hover:text-primary">
                      {{ record.navigation.next.title }}
                    </p>
                  </a>
                </nav>

                <div class="mt-8 flex justify-center">
                  <a
                    :href="detailCat ? localePath(`/articles/${detailCat.slug}`) : localePath(`/articles/${defaultSlug}`)"
                    class="inline-flex items-center gap-2 rounded-full border border-border/80 bg-muted/60 px-5 py-2 text-xs font-semibold text-muted-foreground transition-all duration-200 hover:border-primary/40 hover:bg-card hover:text-primary active:scale-95"
                  >
                    <svg class="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="m15 18-6-6 6-6" />
                    </svg>
                    <span>{{ t('返回列表') }}</span>
                  </a>
                </div>
              </div>
            </article>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
