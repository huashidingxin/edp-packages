<script setup lang="ts">
/** WebRecordPage —— 记录详情页渲染块（产品/文章/案例/图集通用）。 */
import { computed } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '../lib/cn.ts'
import { componentStrings } from '../componentStrings.ts'
import WebRichText from './WebRichText.vue'

export interface WebRecordNavItem {
  title: string
  id: number
  slug?: string | number | null
}

const props = withDefaults(
  defineProps<{
    title?: string | null
    summary?: string | null
    /** 主图 URL。 */
    cover?: string | null
    /** 图集（存在则渲染缩略图行，配合 #media 可整体替换）。 */
    gallery?: Array<{ url: string; alt?: string | null }> | null
    date?: string | null
    meta?: string | null
    /** 富文本正文。 */
    bodyHtml?: string | null
    breadcrumbs?: Array<{ label: string; href?: string | null }>
    listHref?: string | null
    previous?: WebRecordNavItem | null
    next?: WebRecordNavItem | null
    /** prev/next 的链接拼装（record_navigation 只含 {title,id,slug}，path 由站点按 kind 拼）。 */
    makeNavHref?: ((item: WebRecordNavItem) => string) | null
    class?: ClassValue
  }>(),
  {
    title: null,
    summary: null,
    cover: null,
    gallery: null,
    date: null,
    meta: null,
    bodyHtml: null,
    breadcrumbs: () => [],
    listHref: null,
    previous: null,
    next: null,
    makeNavHref: null,
    class: undefined,
  },
)

defineOptions({ inheritAttrs: false })

const activeImage = computed(() => props.cover || props.gallery?.[0]?.url || null)
const thumbs = computed(() => (props.gallery?.length ? props.gallery : []))
</script>

<template>
  <div :class="cn('web-record mx-auto w-full max-w-site px-4 sm:px-6', props.class)">
    <!-- 头部 -->
    <header class="web-record__head border-b border-border py-8">
      <slot name="breadcrumbs" :items="breadcrumbs" />
    </header>

    <div class="web-record__layout py-10">
      <!-- 首屏：封面图 + 属性并排（属性不随页面滚动） -->
      <div class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start lg:gap-10">
        <!-- 主列 -->
        <div class="web-record__main min-w-0">
          <div class="web-record__media-box w-full">
            <slot name="media" :cover="cover" :gallery="gallery ?? []">
              <figure v-if="activeImage" class="web-record__media overflow-hidden rounded-card shadow-card">
                <img :src="activeImage" :alt="title ?? ''" class="aspect-[var(--ratio-record,1/1)] w-full object-cover" loading="eager">
              </figure>
              <div v-if="thumbs.length > 1" class="web-record__thumbs mt-4 grid grid-cols-5 gap-2.5">
                <div
                  v-for="(g, i) in thumbs.slice(0, 10)"
                  :key="g.url + i"
                  class="overflow-hidden rounded-md bg-muted"
                >
                  <img :src="g.url" :alt="g.alt ?? ''" class="aspect-square size-full object-cover opacity-90 transition-opacity hover:opacity-100" loading="lazy">
                </div>
              </div>
            </slot>
          </div>
        </div>

        <!-- 侧栏：标题 + 属性 + 操作 -->
        <aside class="web-record__aside min-w-0 space-y-5">
          <slot name="title-area">
            <h1 class="font-display text-display-md font-bold tracking-tight">{{ title }}</h1>
            <p v-if="summary" class="mt-3 leading-relaxed text-muted-foreground">{{ summary }}</p>
          </slot>
          <div class="border-t border-border" />
          <slot name="aside" />
          <div class="border-t border-border" />
          <a
            v-if="listHref"
            :href="listHref"
            class="inline-flex h-10 w-full items-center justify-center rounded-md border border-border bg-card text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary"
          >{{ componentStrings.WebRecordPage.backToList }}</a>
        </aside>
      </div>

      <!-- 正文：全宽 -->
      <WebRichText v-if="bodyHtml" :html="bodyHtml" tag="article" class="web-record__body mt-10 w-full max-w-none" />

      <slot name="after-body" />
    </div>

    <!-- 上 / 下条 -->
    <nav
      v-if="previous || next"
      class="web-record__nav grid gap-4 border-t border-border py-8 sm:grid-cols-2"
      :aria-label="componentStrings.WebRecordPage.overview"
    >
      <a
        v-if="previous && makeNavHref?.(previous)"
        :href="makeNavHref(previous)"
        class="web-record__nav-item group rounded-card border border-border bg-card p-5 transition-colors hover:border-primary/40"
      >
        <p class="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <svg class="size-4 transition-transform group-hover:-translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M19 12H5m7-7-7 7 7 7"/></svg>
          {{ componentStrings.WebRecordPage.previous }}
        </p>
        <p class="mt-2 line-clamp-2 font-medium group-hover:text-primary">{{ previous.title }}</p>
      </a>
      <span v-else aria-hidden="true" />

      <a
        v-if="next && makeNavHref?.(next)"
        :href="makeNavHref(next)"
        class="web-record__nav-item group rounded-card border border-border bg-card p-5 text-right transition-colors hover:border-primary/40"
      >
        <p class="flex items-center justify-end gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {{ componentStrings.WebRecordPage.next }}
          <svg class="size-4 transition-transform group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14m-7-7 7 7-7 7"/></svg>
        </p>
        <p class="mt-2 line-clamp-2 font-medium group-hover:text-primary">{{ next.title }}</p>
      </a>
    </nav>
  </div>
</template>
