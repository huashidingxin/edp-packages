<script setup lang="ts">
/**
 * 通用首页模板 —— 区块内容驱动、存在才渲染。
 * 站点本地 app/pages/index.vue 存在时本模板不注册（单页覆写做品牌化）。
 * 数据：整页单请求 pageData('home')；hero 走 page.banner（页面级 banner），
 * 推荐产品 / 最新资讯走 sections（collection_list）。首页内容前端自治，
 * 不再消费 content['home-*'] 约定键。
 */
import { computed } from 'vue'
import { useHead } from 'nuxt/app'
import { WebCard, WebCarousel, WebGrid, WebHero, WebMarquee, WebSection } from '@edp/website-ui'
import { useBootstrapSite, useSitePageData } from '../composables/useSite.ts'
import { useT } from '../composables/useT.ts'
import { useLocale } from '../composables/useLocale.ts'
import { recordPath } from '../lib/site.ts'

const { data: page } = useSitePageData({ code: 'home' })
const { t } = useT()
const { localePath } = useLocale()
const site = useBootstrapSite()

useHead({
  title: () => site.value?.name || t('首页'),
})

const banner = computed(() => page.value?.banner ?? null)
const bannerSlides = computed(() =>
  ((banner.value?.items as any[]) ?? [])
    .map((i) => ({ image: String(i.image ?? ''), alt: i.alt ? String(i.alt) : '' }))
    .filter((s) => !!s.image),
)

const sectionItems = (name: string) => computed<any[]>(() => ((page.value?.sections?.[name] as any)?.items ?? []))
const featured = sectionItems('featured_products')
const newsItems = sectionItems('latest_news')

/** 相册数据源区块:后台 section(collection_list → gallery-item)即首页滚动墙;任意 key,存在才渲染。 */
const gallerySections = computed(() =>
  Object.entries((page.value?.sections ?? {}) as Record<string, any>)
    .filter(([, s]) => ((s as any)?.category?.family ?? '') === 'gallery-list' && ((s as any)?.items?.length ?? 0) > 0)
    .map(([key, s]) => ({
      key,
      variant: (key === 'partners' ? 'logo' : 'photo') as 'logo' | 'photo',
      title: String((s as any)?.category?.values?.title ?? '') || t('合作伙伴'),
      items: (((s as any)?.items as any[]) ?? [])
        .map((i) => ({ image: String(i?.values?.image ?? i?.values?.cover ?? ''), alt: String(i?.values?.title ?? '') }))
        .filter((m) => !!m.image),
    })),
)

const vals = (item: any): Record<string, any> => item?.values ?? {}
function extractId(key: string, v: Record<string, any> | null): number | string {
  const id = v?.id
  if (id != null && id !== '') return id as number | string
  const tail = String(key).split(':').pop() ?? key
  return /^\d+$/.test(tail) ? Number(tail) : tail
}
</script>

<template>
  <div>
    <WebHero
      :slides="bannerSlides"
      :eyebrow="banner?.items?.[0]?.subtitle || undefined"
      :title="banner?.items?.[0]?.title || site.name"
      :summary="banner?.items?.[0]?.description || undefined"
      variant="overlay"
    />

    <!-- 推荐产品 -->
    <WebSection
      v-if="featured.length"
      tone="card"
      :eyebrow="t('产品精选')"
      :title="t('推荐产品')"
    >
      <template #actions>
        <a href="/products" class="inline-flex items-center gap-1.5 text-sm font-medium text-primary">{{ t('查看全部产品') }}</a>
      </template>
      <WebGrid :cols="3">
        <WebCard
          v-for="item in featured.slice(0, 6)"
          :key="String(item.key)"
          kind="product"
          variant="raised"
          :title="vals(item).title"
          :summary="vals(item).summary"
          :image="vals(item).cover"
          :href="localePath(recordPath('product', extractId(String(item.key), vals(item))))"
        />
      </WebGrid>
    </WebSection>

    <!-- 最新资讯 -->
    <WebSection
      v-if="newsItems.length"
      tone="gradient"
      :eyebrow="t('新闻资讯')"
      :title="t('最新动态')"
    >
      <WebGrid :cols="3">
        <WebCard
          v-for="item in newsItems.slice(0, 3)"
          :key="String(item.key)"
          kind="article"
          variant="raised"
          :title="vals(item).title"
          :summary="vals(item).summary"
          :image="vals(item).cover"
          :meta="vals(item).published_at ? String(vals(item).published_at).slice(0, 10) : ''"
          :href="localePath(recordPath('article', extractId(String(item.key), vals(item))))"
        />
      </WebGrid>
    </WebSection>

    <!-- 相册数据源滚动墙(合作伙伴等;后台 section 配置驱动,gallery-list 来源自动渲染) -->
    <WebSection
      v-for="wall in gallerySections"
      :key="wall.key"
      tone="card"
      :title="wall.title"
    >
      <WebMarquee v-if="wall.variant === 'logo'" variant="logo" :items="wall.items" />
      <WebCarousel v-else :items="wall.items" :per-view="3" :height="220" />
    </WebSection>

    <!-- CTA（前端自治，不再读 content['home-cta']） -->
    <section class="relative overflow-hidden py-20">
      <div class="absolute inset-0 bg-secondary" />
      <div class="relative mx-auto max-w-site px-4 text-center sm:px-6">
        <h2 class="font-display text-display-lg font-bold text-white">{{ site.name }}</h2>
        <p class="mt-5 text-white/70">{{ t('联系我们，了解如何支撑你的业务站点。') }}</p>
        <a
          href="/about"
          class="mt-8 inline-flex h-12 items-center rounded-md bg-primary px-8 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >{{ t('联系我们') }}</a>
      </div>
    </section>
  </div>
</template>
