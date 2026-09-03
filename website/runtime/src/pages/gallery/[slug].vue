<script setup lang="ts">
import { submitForm, useBootstrapSite, useSiteCategory, useSiteCollection, useSitePageData, useSiteRecord } from '../../composables/useSite.ts'
import { useT } from '../../composables/useT.ts'
import { useLocale } from '../../composables/useLocale.ts'
import { useSiteNavigation } from '../../lib/site.ts'
/** 模板：图集栏目页 /gallery/{slug}。 */
import { computed } from 'vue'
import { useHead, useRoute } from 'nuxt/app'
import { WebHero } from '@edp/website-ui'

const route = useRoute()
const { t } = useT()
const { localePath } = useLocale()
const cfg = useSiteNavigation()

const slug = computed(() => String(route.params.slug ?? ''))

const { data: categoryCtx } = useSiteCategory({ path: `gallery/${slug.value}` })
const catValues = computed<any>(() => categoryCtx.value?.category?.values ?? null)
const banner = computed(() => catValues.value?.banner ?? null)
const bannerSlides = computed(() =>
  ((banner.value?.items as any[]) ?? [])
    .map((i) => ({ image: String(i.image ?? ''), alt: i.alt ? String(i.alt) : '' }))
    .filter((s) => !!s.image),
)

const { data: collection } = useSiteCollection({
  type: 'gallery-item',
  categorySlug: computed(() => `gallery/${slug.value}`),
  limit: 100,
})
const items = computed(() => collection.value?.items ?? [])
const pageTitle = computed(() => catValues.value?.title ?? slug.value)
/** 数据源分类(website.modules.gallery.sources):不在相册切换胶囊里列出,页面保留兜底。 */
const sourceSlugs = computed<string[]>(() => ((route.meta.websiteModules as any)?.gallerySources as string[]) ?? [])
/** 同级相册分类(侧栏树 → 胶囊;含当前;数据源分类除外),>1 才显示切换条。 */
const galleryCats = computed<any[]>(() =>
  ((catValues.value?.sidebar as any)?.items ?? [])
    .map((n: any) => ({
      slug: String(n.href ?? n.url ?? '').split('/').filter(Boolean).pop() || '',
      label: String(n.title ?? ''),
    }))
    .filter((c: any) => !sourceSlugs.value.includes(c.slug)),
)

useHead({
  title: () => pageTitle.value || t('企业相册'),
  meta: [{ name: 'description', content: () => catValues.value?.description || '' }],
})
</script>

<template>
  <div>
    <WebHero
      v-if="bannerSlides.length"
      :slides="bannerSlides"
      :eyebrow="banner?.items?.[0]?.subtitle || undefined"
      :title="banner?.items?.[0]?.title || pageTitle || undefined"
      :summary="banner?.items?.[0]?.description || undefined"
      variant="overlay"
    />
    <section v-else class="bg-secondary py-12">
      <div class="mx-auto max-w-site px-4 sm:px-6">
        <h1 class="font-display text-display-md font-bold tracking-tight text-white">{{ pageTitle }}</h1>
        <p v-if="catValues?.description" class="mt-3 max-w-2xl text-sm text-white/70">{{ catValues.description }}</p>
      </div>
    </section>

    <!-- 相册分类切换(顶部胶囊,与 articles 页同款) -->
    <div v-if="galleryCats.length > 1" class="border-b border-border bg-background">
      <div class="mx-auto max-w-site px-4 py-4 sm:px-6">
        <div class="flex flex-wrap gap-2">
          <a
            v-for="cat in galleryCats"
            :key="cat.slug"
            :href="localePath(`/gallery/${cat.slug}`)"
            :class="[
              'inline-flex h-9 items-center rounded-full border px-4 text-sm font-medium transition-colors',
              cat.slug === slug
                ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                : 'border-transparent bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary',
            ]"
          >{{ cat.label }}</a>
        </div>
      </div>
    </div>

    <div class="bg-background py-14 sm:py-20" style="--web-section-py: clamp(2rem, 1.5rem + 1vw, 3rem)">
      <div class="mx-auto max-w-site px-4 sm:px-6">
        <div v-if="items.length" class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          <figure
            v-for="(item, i) in items"
            :key="String(item.key ?? i)"
            class="group overflow-hidden rounded-card border border-border bg-card shadow-card web-motion hover:-translate-y-1 hover:shadow-lift"
          >
            <img
              :src="String(item.values?.image ?? item.values?.cover ?? '')"
              :alt="String(item.values?.title ?? '')"
              class="aspect-square size-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            >
            <figcaption
              v-if="item.values?.title"
              class="truncate px-3 py-2.5 text-xs font-medium text-muted-foreground"
            >{{ t(String(item.values.title)) }}</figcaption>
          </figure>
        </div>
        <p v-else class="rounded-card border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          {{ t('该图集暂无内容，敬请期待。') }}
        </p>

      </div>
    </div>
  </div>
</template>
