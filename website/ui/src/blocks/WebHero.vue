<script setup lang="ts">
/** WebHero —— 首屏区块：静态图 / 轮播图 × 文案层，overlay 与 split 两种形态。 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { cva, type VariantProps } from 'class-variance-authority'
import type { ClassValue } from 'clsx'
import { cn } from '../lib/cn.ts'
import { wrapIndex } from '../lib/carousel.ts'
import { componentStrings } from '../componentStrings.ts'

export interface WebHeroAction {
  label: string
  href: string
  variant?: 'primary' | 'ghost' | 'outline'
}

export interface WebHeroSlide {
  image: string
  alt?: string
  title?: string
  href?: string
}

const props = withDefaults(
  defineProps<{
    variant?: HeroVariants['variant']
    /** 轮播图（优先于单图）。 */
    slides?: WebHeroSlide[]
    /** 单图模式。 */
    image?: string | null
    imageAlt?: string | null
    eyebrow?: string | null
    title?: string | null
    summary?: string | null
    actions?: WebHeroAction[] | null
    /** 底部渐变遮罩（overlay 时默认开）。 */
    scrim?: boolean | null
    autoplay?: boolean | null
    interval?: number
    class?: ClassValue
  }>(),
  {
    variant: 'overlay',
    slides: () => [],
    image: null,
    imageAlt: null,
    eyebrow: null,
    title: null,
    summary: null,
    actions: null,
    scrim: null,
    autoplay: true,
    interval: 5000,
    class: undefined,
  },
)

defineOptions({ inheritAttrs: false })

const heroVariants = cva('web-hero relative overflow-hidden', {
  variants: {
    variant: {
      overlay: 'flex min-h-[var(--web-hero-min-h,420px)] flex-col items-end',
      split: 'grid lg:grid-cols-2',
    },
  },
  defaultVariants: { variant: 'overlay' },
})
type HeroVariants = VariantProps<typeof heroVariants>

const rootClass = computed(() => cn(heroVariants({ variant: props.variant }), props.class))

const hasCarousel = computed(() => props.slides.length > 1)
const activeIndex = ref(0)
let timer: ReturnType<typeof setInterval> | null = null

function startAutoplay(): void {
  if (!hasCarousel.value || props.autoplay === false || typeof window === 'undefined') return
  timer = setInterval(() => {
    activeIndex.value = wrapIndex(activeIndex.value, 1, props.slides.length)
  }, Math.max(1000, props.interval))
}
onMounted(startAutoplay)
onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})

const showScrim = computed(() => props.scrim ?? props.variant === 'overlay')

// 鼠标拖拽左右切换轮播（阈值 50px）
const dragStartX = ref<number | null>(null)
function onPointerDown(e: PointerEvent): void {
  dragStartX.value = e.clientX
}
function onPointerUp(e: PointerEvent): void {
  if (dragStartX.value === null || !hasCarousel.value) return
  const dx = e.clientX - dragStartX.value
  if (Math.abs(dx) > 50) {
    activeIndex.value = wrapIndex(activeIndex.value, dx < 0 ? 1 : -1, props.slides.length)
  }
  dragStartX.value = null
}
</script>

<template>
  <section :class="rootClass" :data-variant="variant">
    <!-- 背景媒体 -->
    <div :class="cn('web-hero__media', variant === 'overlay' ? 'absolute inset-0' : 'relative min-h-[280px] lg:order-last lg:min-h-0')" :style="hasCarousel ? { cursor: 'grab' } : undefined" aria-hidden="true" @pointerdown="onPointerDown" @pointerup="onPointerUp">
      <!-- 常驻兜底底层:图片缺失/加载失败时不再露白 -->
      <div class="absolute inset-0 bg-gradient-to-br from-secondary via-secondary/90 to-secondary/70" />
      <template v-if="slides.length">
        <img
          v-for="(slide, i) in slides"
          :key="slide.image + i"
          :src="slide.image"
          :alt="slide.alt ?? ''"
          :class="cn('absolute inset-0 size-full object-cover transition-opacity duration-700', i === activeIndex ? 'opacity-100' : 'opacity-0')"
          loading="eager"
          referrerpolicy="no-referrer"
        >
      </template>
      <img v-else-if="image" :src="image" :alt="imageAlt ?? ''" class="absolute inset-0 size-full object-cover" loading="eager" referrerpolicy="no-referrer">
      <div v-if="showScrim" class="web-hero__scrim absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-black/10" />
    </div>

    <!-- 文案层 -->
    <div
      :class="cn(
        'web-hero__content relative z-10 mx-auto w-full max-w-site px-4 sm:px-6',
        variant === 'overlay' && 'flex flex-col items-center text-center pt-[var(--web-hero-pt,9rem)] pb-[var(--web-hero-pb,7rem)]',
        variant === 'split' && 'flex flex-col justify-center py-[var(--web-hero-split-py,5rem)] lg:order-first lg:pr-12',
      )"
    >
      <slot>
        <h1
          v-if="title"
          :class="cn(
            'web-hero__title max-w-4xl font-display font-bold tracking-tight text-[length:var(--web-hero-title-size,clamp(2rem,1.2rem+2.5vw,3.25rem))]',
            variant === 'overlay' ? 'text-white [text-shadow:0_2px_18px_rgb(0_0_0/0.35)]' : 'text-foreground',
          )"
        >{{ title }}</h1>
        <!-- banner 上的副标题：白字 + 标题下方（mt-3），不再是"装饰眉题" -->
        <p
          v-if="eyebrow"
          :class="cn(
            'web-hero__eyebrow mt-3 max-w-3xl text-base font-medium leading-relaxed sm:text-lg',
            variant === 'overlay' ? 'text-white/85' : 'text-muted-foreground',
          )"
        >{{ eyebrow }}</p>
        <p v-if="summary" :class="cn('web-hero__summary mt-5 max-w-2xl mx-auto text-base leading-relaxed sm:text-lg', variant === 'overlay' ? 'text-white/80' : 'text-muted-foreground')">{{ summary }}</p>
        <div v-if="actions?.length" class="web-hero__actions mt-8 flex flex-wrap justify-center gap-4">
          <a
            v-for="action in actions"
            :key="action.href + action.label"
            :href="action.href"
            :class="cn(
              'inline-flex h-12 items-center gap-2 rounded-md px-6 text-sm font-semibold transition-all',
              (action.variant ?? 'primary') === 'primary'
                && (variant === 'overlay'
                  ? 'bg-primary text-primary-foreground shadow-card hover:-translate-y-0.5 hover:bg-primary/90'
                  : 'bg-primary text-primary-foreground shadow-card hover:-translate-y-0.5 hover:bg-primary/90'),
              action.variant === 'outline'
                && (variant === 'overlay'
                  ? 'border border-white/30 bg-transparent text-white backdrop-blur hover:border-white/60 hover:bg-white/10'
                  : 'border border-border bg-transparent text-foreground hover:border-primary/50 hover:text-primary'),
              action.variant === 'ghost'
                && (variant === 'overlay' ? 'bg-white/10 text-white backdrop-blur hover:bg-white/20' : 'bg-muted text-foreground hover:bg-accent'),
            )"
          >{{ action.label || componentStrings.WebHero.primary }}</a>
        </div>
      </slot>
    </div>

    <!-- overlay 底部：轮播圆点 + footer（数据条），贴 hero 底；圆点在 footer 上方不被遮挡 -->
    <div v-if="variant === 'overlay'" class="relative z-10 mt-auto w-full">
      <div v-if="hasCarousel" class="web-hero__dots flex justify-center gap-2 pb-4">
        <button
          v-for="(_, i) in slides"
          :key="`dot-${i}`"
          type="button"
          :class="cn('h-1.5 rounded-full transition-all duration-300', i === activeIndex ? 'w-6 bg-white' : 'w-3 bg-white/40 hover:bg-white/70')"
          :aria-label="`${i + 1}`"
          @click="activeIndex = i"
        />
      </div>
      <div v-if="$slots.footer" class="web-hero__footer w-full">
        <slot name="footer" />
      </div>
    </div>
    <div v-else-if="$slots.footer" class="web-hero__footer relative z-10 mt-auto w-full">
      <slot name="footer" />
    </div>
  </section>
</template>
