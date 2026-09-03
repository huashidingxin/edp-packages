<script setup lang="ts">
/** WebCollectionPage —— 列表页骨架：sidebar / chips / full 三种形态 + 内容插槽。 */
import { computed } from 'vue'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../lib/cn.ts'
import { componentStrings } from '../componentStrings.ts'
import type { WebSidebarNode, WebCategoryChip } from './collection.ts'

const props = withDefaults(
  defineProps<{
    variant?: CollectionVariants['variant']
    title?: string | null
    summary?: string | null
    /** chips 形态的分类胶囊。 */
    categories?: WebCategoryChip[]
    /** sidebar 形态的分类树（后端 category.sidebar）。 */
    sidebar?: WebSidebarNode[] | null
  }>(),
  {
    variant: 'full',
    title: null,
    summary: null,
    categories: () => [],
    sidebar: null,
  },
)

defineOptions({ inheritAttrs: false })

const layoutVariants = cva('mx-auto w-full max-w-site px-4 sm:px-6', {
  variants: {
    variant: {
      sidebar: 'grid gap-10 lg:grid-cols-[260px_1fr]',
      chips: '',
      full: '',
    },
  },
  defaultVariants: { variant: 'full' },
})
type CollectionVariants = VariantProps<typeof layoutVariants>

const layoutClass = computed(() => layoutVariants({ variant: props.variant }))
</script>

<template>
  <div class="web-collection bg-background" :data-variant="variant">
    <!-- #head 在变体栅格之外:避免占位破坏 aside/main 自动布局 -->
    <div class="web-collection__headwrap">
      <slot name="head">
        <header v-if="title || summary" class="web-collection__pagehead border-b border-border bg-muted/40">
          <div class="mx-auto w-full max-w-site px-4 py-10 sm:px-6">
            <div class="web-collection__head max-w-3xl">
              <h1 v-if="title" class="web-collection__title font-display text-display-md font-bold tracking-tight">{{ title }}</h1>
              <p v-if="summary" class="web-collection__summary mt-3 text-muted-foreground">{{ summary }}</p>
            </div>
          </div>
        </header>
      </slot>
    </div>

    <div :class="cn(layoutClass, 'py-[var(--web-collection-py,clamp(3rem,2rem+2vw,5rem))]')">
      <!-- sidebar -->
      <aside v-if="variant === 'sidebar'" class="web-collection__aside">
        <div class="web-collection__sidebar sticky top-24 rounded-card border border-border bg-card p-4">
          <h2 class="web-collection__sidebar-title px-2 pb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {{ componentStrings.WebCollectionPage.sidebarTitle }}
          </h2>
          <slot name="sidebar" :nodes="sidebar ?? []">
            <ul class="space-y-0.5">
              <li v-for="node in sidebar ?? []" :key="node.title + (node.href ?? '')">
                <a
                  :href="node.href || node.url || '#'"
                  :class="cn(
                    'block rounded-md px-3 py-2 text-sm transition-colors',
                    node.active ? 'bg-primary/10 font-semibold text-primary' : 'text-foreground/80 hover:bg-muted hover:text-primary',
                  )"
                >{{ node.title }}</a>
                <ul v-if="node.children?.length" class="ml-3 mt-0.5 space-y-0.5 border-l border-border pl-2">
                  <li v-for="child in node.children" :key="child.title + (child.href ?? '')">
                    <a
                      :href="child.href || child.url || '#'"
                      :class="cn(
                        'block rounded-md px-3 py-1.5 text-sm transition-colors',
                        child.active ? 'font-semibold text-primary' : 'text-muted-foreground hover:text-primary',
                      )"
                    >{{ child.title }}</a>
                  </li>
                </ul>
              </li>
            </ul>
          </slot>
        </div>
      </aside>

      <div class="web-collection__main min-w-0">
        <!-- chips -->
        <div v-if="categories.length" class="web-collection__chips mb-8 flex flex-wrap gap-2">
          <a
            v-for="chip in categories"
            :key="chip.slug"
            :href="chip.href"
            :class="cn(
              'inline-flex h-9 items-center rounded-full border px-4 text-sm transition-colors',
              chip.active
                ? 'border-primary bg-primary font-medium text-primary-foreground'
                : 'border-border bg-card text-foreground/75 hover:border-primary/40 hover:text-primary',
            )"
          >{{ chip.label }}</a>
        </div>

        <div class="web-collection__body">
          <slot />
        </div>

        <div v-if="$slots.pagination" class="web-collection__pagination mt-12">
          <slot name="pagination" />
        </div>
      </div>
    </div>
  </div>
</template>
