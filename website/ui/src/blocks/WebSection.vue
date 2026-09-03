<script setup lang="ts">
/** WebSection —— 页面区块带容器：眉题/标题/摘要 + 内容插槽。 */
import { computed } from 'vue'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../lib/cn.ts'

const props = withDefaults(
  defineProps<{
    tone?: SectionVariants['tone']
    size?: 'sm' | 'md' | 'lg'
    align?: 'left' | 'center'
    eyebrow?: string | null
    title?: string | null
    summary?: string | null
    titleTag?: 'h1' | 'h2' | 'h3'
    /** 是否内置版心容器（max-w-site + 水平 padding）；调用方自管宽度时关掉。 */
    contained?: boolean
  }>(),
  {
    tone: 'background',
    size: 'md',
    align: 'left',
    eyebrow: null,
    title: null,
    summary: null,
    titleTag: 'h2',
    contained: true,
  },
)

const SECTION_PY = {
  /* 节间呼吸更紧凑：连续 section 不再稀。 */
  sm: 'clamp(1.75rem, 1.5rem + 0.5vw, 2.75rem)',
  md: 'clamp(2.5rem, 2rem + 1vw, 4rem)',
  lg: 'clamp(3.25rem, 2.5rem + 3vw, 5.5rem)',
} as const

const SECTION_HEAD_MB = {
  sm: 'mb-6',
  md: 'mb-8',
  lg: 'mb-12',
} as const

const toneVariants = cva('web-section', {
  variants: {
    tone: {
      background: 'bg-background',
      muted: 'bg-muted/60 text-foreground',
      card: 'bg-card text-card-foreground border-y border-border',
      dark: 'bg-secondary text-secondary-foreground site-band-dark',
      gradient: 'bg-gradient-to-b from-muted/50 to-background',
    },
  },
  defaultVariants: { tone: 'background' },
})
type SectionVariants = VariantProps<typeof toneVariants>

const rootClass = computed(() => cn(toneVariants({ tone: props.tone })))
const rootStyle = computed(() => ({ '--web-section-py': SECTION_PY[props.size] }))
</script>

<template>
  <section :class="rootClass" :style="rootStyle" :data-tone="tone" :data-size="size">
    <!-- 纵向留白 = 基础值与宽屏加档取大;--web-section-py-wide 仅在 ≥2xl 由全局样式表按 data-size 注入,
         普通屏下回退 0rem,行为与旧版完全一致;页面级内联覆盖不受影响 -->
    <div :class="cn(contained && 'mx-auto w-full max-w-site px-4 sm:px-6', 'py-[max(var(--web-section-py),var(--web-section-py-wide,0rem))]')">
      <!-- #head 整体替换 -->
      <slot name="head">
        <div
          v-if="eyebrow || title || summary || $slots.actions"
          :class="cn(
            'web-section__head',
            SECTION_HEAD_MB[size],
            align === 'center' && 'flex flex-col items-center text-center',
          )"
        >
          <div :class="cn('web-section__head-inner', align === 'center' && 'flex flex-col items-center')">
            <component
              :is="titleTag"
              v-if="title"
              class="web-section__title font-display font-bold tracking-tight text-display-md"
            >{{ title }}</component>
            <!-- eyebrow 改为标题下方的副标题；不再是大标题上的小帽 -->
            <p
              v-if="eyebrow"
              class="web-section__eyebrow mt-2 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg"
            >{{ eyebrow }}</p>
            <p v-if="summary" class="web-section__summary mt-3 max-w-2xl text-base leading-relaxed" :class="tone === 'dark' ? 'text-secondary-foreground/70' : 'text-muted-foreground'">
              {{ summary }}
            </p>
          </div>
          <slot name="actions" />
        </div>
      </slot>
      <div class="web-section__body">
        <slot />
      </div>

      <slot name="after" />
    </div>
  </section>
</template>
