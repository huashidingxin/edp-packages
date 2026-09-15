<script setup lang="ts">
/**
 * 通用首页模板 —— 区块内容驱动、存在才渲染。
 * 站点本地 app/pages/index.vue 存在时本模板不注册（单页覆写做品牌化）。
 * 数据：整页单请求 pageData('home')；hero 走 blocks.banner（页面级 banner），
 * 推荐产品 / 最新资讯走 具名模型块。首页内容前端自治，
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

const banner = computed(() => (page.value?.blocks?.banner as any) ?? null)
const bannerSlides = computed(() =>
  ((banner.value?.items as any[]) ?? [])
    .map((i) => ({ image: String(i.image ?? ''), alt: i.alt ? String(i.alt) : '' }))
    .filter((s) => !!s.image),
)

const sectionItems = (name: string) => computed<any[]>(() => ((page.value?.blocks?.[name] as any[]) ?? []))
const featured = sectionItems('featured_products')
const newsItems = sectionItems('latest_news')

/** 公共模板自己选择支持的块与布局，后端只返回模型记录。 */
const gallerySections = computed(() => [
  { key: 'partners', variant: 'logo' as const, title: t('合作伙伴'), field: 'logo' },
  { key: 'gallery', variant: 'photo' as const, title: t('企业相册'), field: 'image' },
].map((block) => ({
  ...block,
  items: ((page.value?.blocks?.[block.key] as any[]) ?? [])
    .map((record) => ({ image: String(record[block.field] ?? ''), alt: String(record.title ?? '') }))
    .filter((item) => !!item.image),
})).filter((block) => block.items.length))

const vals = (item: any): Record<string, any> => item ?? {}
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
          :key="String(item.id)"
          kind="product"
          variant="raised"
          :title="vals(item).title"
          :summary="vals(item).summary"
          :image="vals(item).cover"
          :href="localePath(recordPath('product', item.id))"
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
          :key="String(item.id)"
          kind="article"
          variant="raised"
          :title="vals(item).title"
          :summary="vals(item).summary"
          :image="vals(item).cover"
          :meta="vals(item).published_at ? String(vals(item).published_at).slice(0, 10) : ''"
          :href="localePath(recordPath('article', item.id))"
        />
      </WebGrid>
    </WebSection>

    <!-- 相册数据源滚动墙(合作伙伴等;具名块，前端选择呈现方式) -->
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
