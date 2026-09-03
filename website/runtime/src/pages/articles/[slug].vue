<script setup lang="ts">
import { submitForm, useBootstrapSite, useSiteCategory, useSiteCollection, useSitePageData, useSiteRecord } from '../../composables/useSite.ts'
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

/** 列表日期块：从 YYYY-MM-DD 前缀拆出"日"与"年/月"，格式不符返回 null（不渲染日期列）。 */
function dateParts(v: unknown): { day: string; ym: string } | null {
  if (!v) return null
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return null
  const [, y, mo, d] = m
  if (!y || !mo || !d) return null
  return { day: String(Number(d)), ym: `${y}/${mo}` }
}

/** 分类胶囊按钮:激活=主题色实心;未激活=浅灰底(白区块上白片悬浮感强,给底色更稳)。 */
const pillClass = (active: boolean) =>
  active
    ? 'inline-flex h-9 items-center rounded-full border border-primary bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-all duration-200'
    : 'inline-flex h-9 items-center rounded-full border border-transparent bg-muted px-4 text-sm font-medium text-muted-foreground transition-all duration-200 hover:bg-primary/10 hover:text-primary'
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
      <!-- 列表区:分类入口与文章列表同一区块 -->
      <div class="bg-background pb-12 pt-10 sm:pb-16 sm:pt-14">
        <!-- 单栏直排:卡片带内边距、封面内嵌,卡内三栏 = 封面 | 内容 | 日期块 -->
        <div class="mx-auto max-w-site px-4 sm:px-6">
          <nav v-if="categories.length > 1" class="mb-8 flex flex-wrap items-center gap-2 sm:mb-10" :aria-label="t('分类切换')">
            <a
              v-for="cat in categories"
              :key="cat.slug"
              :href="localePath(`/articles/${cat.slug}`)"
              :aria-current="cat.slug === slug ? 'page' : undefined"
              :class="pillClass(cat.slug === slug)"
            >{{ cat.label }}</a>
          </nav>
          <div v-if="items.length" ref="listRef" class="flex flex-col gap-5">
            <a
              v-for="(item, i) in items"
              :key="String(item.key)"
              :href="localePath(recordPath('article', extractId(String(item.key), vals(item))))"
              data-web-reveal
              :data-web-reveal-delay="`${Math.min(i * 70, 350)}ms`"
              class="group relative flex items-center gap-4 overflow-hidden rounded-card border border-border/80 bg-card p-5 shadow-card web-motion hover:border-primary/40 sm:gap-6 sm:p-6"
            >
              <!-- 激活氛围:主色渐变底自左淡入(参考图淡红底) + 左侧主题条自上展开 -->
              <span
                class="pointer-events-none absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/[0.04] to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                aria-hidden="true"
              />
              <span
                class="pointer-events-none absolute left-0 top-0 h-full w-1 origin-top scale-y-0 rounded-r-full bg-gradient-to-b from-primary to-primary/60 transition-transform duration-500 group-hover:scale-y-100"
                aria-hidden="true"
              />
              <!-- ① 封面:内嵌在卡片留白内,不贴卡边 -->
              <div class="relative aspect-[16/10] w-32 shrink-0 overflow-hidden rounded-lg bg-muted sm:w-48 md:w-64">
                <img
                  v-if="vals(item).cover"
                  :src="String(vals(item).cover)"
                  :alt="String(vals(item).title ?? '')"
                  class="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                >
                <div v-else class="grid size-full place-items-center bg-gradient-to-br from-muted to-accent">
                  <svg
                    class="size-8 text-muted-foreground/40"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="m21 15-5-5L5 21" />
                  </svg>
                </div>
                <!-- 移动端日期角标:sm以下隐藏右侧日期列,改用封面右上角小角标 -->
                <span
                  v-if="dateParts(vals(item).published_at)"
                  class="absolute right-2 top-2 flex flex-col items-center rounded-md bg-card/90 px-2 py-1 text-center shadow-sm backdrop-blur-sm sm:hidden"
                >
                  <span class="web-num text-sm font-bold leading-none text-primary">{{ dateParts(vals(item).published_at)?.day }}</span>
                  <span class="web-num mt-0.5 text-[9px] leading-none text-muted-foreground">{{ dateParts(vals(item).published_at)?.ym }}</span>
                </span>
                <!-- 悬浮遮罩:封面底部渐变,增加"可点"暗示 -->
                <span class="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" aria-hidden="true" />
              </div>
              <!-- ② 内容:标题 + 摘要;激活时标题转主色,卡片整体淡主色背景衬托 -->
              <div class="flex min-w-0 flex-1 flex-col">
                <h3 class="web-clamp-2 font-display font-bold leading-snug text-foreground transition-colors duration-300 group-hover:text-primary sm:text-lg">{{ vals(item).title }}</h3>
                <p v-if="vals(item).summary" class="web-clamp-2 mt-2 text-sm leading-relaxed text-muted-foreground">{{ vals(item).summary }}</p>
              </div>
              <!-- ③ 日期块:大字"日" + 年/月(参考"大数字 + 下方年月"形式,主题化:display 大数字、悬浮转主色) -->
              <div
                v-if="dateParts(vals(item).published_at)"
                class="hidden flex-col items-center justify-center self-stretch rounded-lg bg-primary/[0.04] px-3 py-2 text-center sm:flex sm:w-16"
              >
                <span class="web-num font-display text-3xl font-bold leading-none tracking-tight text-foreground transition-[color,transform] duration-300 group-hover:scale-110 group-hover:text-primary sm:text-4xl">{{ dateParts(vals(item).published_at)?.day }}</span>
                <span class="web-num mt-1.5 text-[11px] font-medium tracking-widest text-muted-foreground">{{ dateParts(vals(item).published_at)?.ym }}</span>
              </div>
            </a>
          </div>
          <div v-else class="flex flex-col items-center gap-4 rounded-card border border-dashed border-border bg-card p-16 text-center">
            <div class="grid size-16 place-items-center rounded-full bg-muted">
              <svg class="size-8 text-muted-foreground/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>
                <path d="M14 2v4a2 2 0 0 0 2 2h4"/>
                <path d="M10 13H8"/>
                <path d="M16 17H8"/>
                <path d="M16 13h-2"/>
              </svg>
            </div>
            <p class="text-sm text-muted-foreground">{{ t('该栏目暂无内容，敬请期待。') }}</p>
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
          <WebBreadcrumbs :items="[{ label: t('首页'), href: '/' }, { label: t('新闻资讯'), href: `/articles/${defaultSlug}` }]" />
        </div>
      </div>
      <section v-else class="bg-secondary text-secondary-foreground">
        <div class="mx-auto max-w-site px-4 py-8 sm:px-6 sm:py-10">
          <WebBreadcrumbs :items="[{ label: t('首页'), href: '/' }, { label: t('新闻资讯'), href: `/articles/${defaultSlug}` }]" :min-levels="2" on-dark />
        </div>
      </section>

      <!-- 详情主体:左侧边栏 + 右侧内容 -->
      <div class="bg-background py-12 sm:py-16">
        <div class="mx-auto max-w-site px-4 sm:px-6">
          <div class="flex flex-col gap-10 lg:flex-row">
            <!-- 左侧边栏 -->
            <aside class="w-full shrink-0 lg:sticky lg:top-20 lg:w-64 lg:self-start">
              <!-- 分类导航 -->
              <div class="rounded-card border border-border bg-card p-5 shadow-card">
                <h4 class="mb-4 text-sm font-semibold text-foreground">{{ t('分类') }}</h4>
                <nav class="flex flex-col gap-1">
                  <a
                    v-for="cat in navCategories"
                    :key="cat.slug"
                    :href="localePath(`/articles/${cat.slug}`)"
                    :class="[
                      'flex items-center rounded-md px-3 py-2 text-sm transition-colors',
                      cat.active
                        ? 'bg-primary/10 font-medium text-primary'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    ]"
                  >{{ cat.label }}</a>
                </nav>
              </div>

              <!-- 分享组件(可配置渠道/可替换图标的公共块) -->
              <div class="mt-5 rounded-card border border-border bg-card p-5 shadow-card">
                <WebShare :title="recValues?.title" :summary="recValues?.summary" />
              </div>
            </aside>

            <!-- 右侧文章内容 -->
            <article class="min-w-0 flex-1">
              <h1 class="font-display text-display-md font-bold leading-tight">{{ recValues?.title }}</h1>
              <div class="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <a
                  v-if="detailCat"
                  :href="localePath(`/articles/${detailCat.slug}`)"
                  class="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                >{{ detailCat.label }}</a>
                <span v-if="dateOf" class="web-num flex items-center gap-1.5">
                  <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
                  {{ dateOf }}
                </span>
              </div>
              <WebRichText v-if="recValues?.body" :html="recValues.body" tag="section" class="mt-8" />

              <nav class="mt-12 grid gap-4 border-t border-border pt-8 sm:grid-cols-2" :aria-label="t('文章切换')">
                <a
                  v-if="record?.navigation?.previous"
                  :href="localePath(recordPath('article', record.navigation.previous.id))"
                  class="group rounded-card bg-card p-5 shadow-card web-motion hover:-translate-y-1 hover:shadow-lift"
                >
                  <p class="text-xs text-muted-foreground">{{ t('上一篇') }}</p>
                  <p class="web-clamp-2 mt-1 text-sm font-medium group-hover:text-primary">{{ record.navigation.previous.title }}</p>
                </a>
                <span v-else aria-hidden="true" />
                <a
                  v-if="record?.navigation?.next"
                  :href="localePath(recordPath('article', record.navigation.next.id))"
                  class="group rounded-card bg-card p-5 text-right shadow-card web-motion hover:-translate-y-1 hover:shadow-lift sm:col-start-2"
                >
                  <p class="text-xs text-muted-foreground">{{ t('下一篇') }}</p>
                  <p class="web-clamp-2 mt-1 text-sm font-medium group-hover:text-primary">{{ record.navigation.next.title }}</p>
                </a>
              </nav>
            </article>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
