<script setup lang="ts">
/**
 * WebAbout —— 关于页正文块：split / narrative / timeline 三种叙事形态。
 *
 * 默认外观：眉题 + 大标题 + 装饰短线 + 摘要，媒体带错位色块与抬升阴影，
 * 正文走 .web-prose，可选数据条（stats）与特性卡（features），CTA 主按钮收尾。
 *
 * 五级定制逃生口：
 *   1. props：variant / size / align / mediaPosition / featureColumns / titleTag / class…
 *   2. 部件 class：headClass / mediaClass / bodyClass / featuresClass
 *   3. 插槽：#head #eyebrow #title #summary #media #body #stats #actions
 *            #features #feature（作用域）#milestone（作用域）#default（整身）#after
 *   4. CSS 变量：--web-about-head-mb / -gap / -gap-lg / -media-ratio / -prose-size /
 *      -summary-leading / -divider-w / -frame-x / -frame-y / -stat-size /
 *      -features-mt / -feature-gap / -timeline-gap / -narrative-w / -body-mt /
 *      -media-mt …（祖先节点声明即生效；标题字号走 --text-display-* 令牌）
 *   5. data 钩子：data-variant / data-align / data-size / data-media
 */
import { computed, useSlots } from 'vue'
import { cva } from 'class-variance-authority'
import type { ClassValue } from 'clsx'
import { cn } from '../lib/cn.ts'
import {
  aboutFeatureCols,
  aboutFeatureIndex,
  aboutHeadClass,
  aboutMediaOrderClass,
  aboutMediaRatioClass,
  aboutTitleClass,
  normalizeAboutFeatures,
  normalizeAboutStats,
  type WebAboutAlign,
  type WebAboutColumns,
  type WebAboutFeature,
  type WebAboutMediaSide,
  type WebAboutMilestone,
  type WebAboutSize,
  type WebAboutStat,
} from '../lib/about.ts'
import { componentStrings } from '../componentStrings.ts'
import WebRichText from './WebRichText.vue'

export type { WebAboutFeature, WebAboutStat, WebAboutMilestone }

const props = withDefaults(
  defineProps<{
    variant?: 'split' | 'narrative' | 'timeline'
    /** 整体尺度：标题字号 + 头部下间距。 */
    size?: WebAboutSize
    /** 头部对齐；缺省时 timeline 居中、其余居左。 */
    align?: WebAboutAlign | null
    /** 标题标签（多 h1 场合降级为 h2）。 */
    titleTag?: 'h1' | 'h2' | 'h3'
    eyebrow?: string | null
    title?: string | null
    summary?: string | null
    image?: string | null
    imageAlt?: string | null
    /** 富文本正文（web-prose 渲染）。 */
    bodyHtml?: string | null
    /** 数据条：{ value, label }。 */
    stats?: WebAboutStat[] | null
    /** 特性卡：{ title, summary?, icon?, href? }。 */
    features?: WebAboutFeature[] | null
    featureColumns?: WebAboutColumns
    milestones?: WebAboutMilestone[] | null
    /** split 形态下媒体所在列。 */
    mediaPosition?: WebAboutMediaSide
    /** 媒体错位装饰色块。 */
    mediaFrame?: boolean
    contactHref?: string | null
    contactLabel?: string | null
    /** 标题下装饰短线（默认关闭，避免每节都来一遍装饰套路）。 */
    divider?: boolean
    class?: ClassValue
    headClass?: ClassValue
    mediaClass?: ClassValue
    bodyClass?: ClassValue
    featuresClass?: ClassValue
  }>(),
  {
    variant: 'split',
    size: 'md',
    align: null,
    titleTag: 'h1',
    eyebrow: null,
    title: null,
    summary: null,
    image: null,
    imageAlt: null,
    bodyHtml: null,
    stats: null,
    features: null,
    featureColumns: 3,
    milestones: null,
    mediaPosition: 'start',
    mediaFrame: true,
    divider: false,
    contactHref: null,
    contactLabel: null,
    class: undefined,
    headClass: undefined,
    mediaClass: undefined,
    bodyClass: undefined,
    featuresClass: undefined,
  },
)

defineOptions({ inheritAttrs: false })

const aboutVariants = cva('web-about', {
  variants: {
    align: {
      left: '',
      center: 'text-center',
    },
  },
  defaultVariants: { align: 'left' },
})

const slots = useSlots()
/* 媒体缺席（无 image 且无 #media）时分栏退化为单列，正文不缩在半栏里 */
const hasMedia = computed(() => Boolean(props.image || slots.media))
const resolvedAlign = computed<WebAboutAlign>(() => props.align ?? (props.variant === 'timeline' ? 'center' : 'left'))
const rootClass = computed(() => cn(aboutVariants({ align: resolvedAlign.value }), props.class))
const headClassComputed = computed(() => aboutHeadClass(resolvedAlign.value, props.size))
const titleClass = computed(() => aboutTitleClass(props.size))
const mediaRatioClass = computed(() => aboutMediaRatioClass(props.variant))
const splitClass = computed(() =>
  cn(
    'web-about__main grid items-start gap-[var(--web-about-gap,2.5rem)]',
    hasMedia.value ? 'lg:grid-cols-2 lg:gap-[var(--web-about-gap-lg,4rem)]' : 'lg:grid-cols-1',
  ),
)
const featureColsClass = computed(() => aboutFeatureCols(props.featureColumns))
const headline = computed(() => props.title ?? '')
const mediaAlt = computed(() => props.imageAlt ?? headline.value)
const statList = computed(() => normalizeAboutStats(props.stats))
const featureList = computed(() => normalizeAboutFeatures(props.features))
const ctaLabel = computed(() => props.contactLabel || componentStrings.WebAbout.contactCta)
</script>

<template>
  <div
    :class="rootClass"
    :data-variant="variant"
    :data-align="resolvedAlign"
    :data-size="size"
    :data-media="variant === 'split' ? mediaPosition : undefined"
    v-bind="$attrs"
  >
    <!-- 叙事头（#head 整块替换，#eyebrow/#title/#summary 局部替换） -->
    <slot name="head">
      <header v-if="eyebrow || title || summary" class="web-about__head" :class="cn(headClassComputed, headClass)">
        <slot name="title">
          <component
            :is="titleTag"
            v-if="title"
            class="web-about__title font-display font-bold tracking-tight"
            :class="titleClass"
          >{{ title }}</component>
        </slot>
        <!-- eyebrow 改为标题下方副标题，与 summary 合并形成「副标 + 描述」 -->
        <slot name="eyebrow">
          <p
            v-if="eyebrow"
            class="web-about__eyebrow mt-2 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg"
          >{{ eyebrow }}</p>
        </slot>
        <slot name="summary">
          <p
            v-if="summary"
            class="web-about__summary mt-2 text-base leading-[var(--web-about-summary-leading,1.7)] text-muted-foreground sm:text-lg"
          >{{ summary }}</p>
        </slot>
      </header>
    </slot>

    <!-- 主体（#default 整身替换：替换后不再残留 main / features 包装） -->
    <slot>
      <!-- 图文分栏 -->
      <div v-if="variant === 'split'" :class="splitClass">
        <slot name="media" :image="image" :alt="mediaAlt">
          <figure v-if="image" class="web-about__media relative" :class="cn(aboutMediaOrderClass(mediaPosition), mediaClass)">
            <span
              v-if="mediaFrame"
              class="web-about__frame absolute inset-x-[var(--web-about-frame-x,1rem)] -bottom-[var(--web-about-frame-y,1rem)] top-[var(--web-about-frame-y,1rem)] rounded-card bg-primary/10"
              aria-hidden="true"
            />
            <img
              :src="image"
              :alt="mediaAlt"
              :class="cn('relative w-full rounded-card object-cover shadow-lift', mediaRatioClass)"
              loading="lazy"
            >
          </figure>
        </slot>
        <div class="web-about__body min-w-0" :class="cn(bodyClass)">
          <slot name="body" :body-html="bodyHtml">
            <WebRichText
              v-if="bodyHtml"
              :html="bodyHtml"
              class="web-about__prose text-[length:var(--web-about-prose-size,1rem)]"
            />
          </slot>
          <slot name="stats" :stats="statList">
            <dl
              v-if="statList.length"
              class="web-about__stats mt-8 grid gap-6 border-t border-border pt-7 sm:grid-cols-[repeat(auto-fit,minmax(7rem,1fr))]"
            >
              <div v-for="(s, i) in statList" :key="(s.label ?? '') + i" class="min-w-0">
                <dt class="web-num font-display text-[length:var(--web-about-stat-size,1.875rem)] font-bold leading-none text-primary">
                  {{ s.value }}
                </dt>
                <dd v-if="s.label" class="mt-2 text-sm text-muted-foreground">{{ s.label }}</dd>
              </div>
            </dl>
          </slot>
          <slot name="actions">
            <a
              v-if="contactHref"
              :href="contactHref"
              class="web-about__cta group mt-8 inline-flex h-12 items-center gap-2 rounded-md bg-primary px-7 text-sm font-semibold text-primary-foreground shadow-card web-motion hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-lift"
            >
              {{ ctaLabel }}
              <svg class="size-4 transition-transform group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>
            </a>
          </slot>
        </div>
      </div>

      <!-- 纯文叙事 -->
      <template v-else-if="variant === 'narrative'">
        <slot name="media" :image="image" :alt="mediaAlt">
          <figure
            v-if="image"
            class="web-about__media relative mx-auto mt-[var(--web-about-media-mt,2.5rem)] w-full max-w-[var(--web-about-narrative-w,64rem)]"
            :class="cn(mediaClass)"
          >
            <span
              v-if="mediaFrame"
              class="web-about__frame absolute inset-x-[var(--web-about-frame-x,1.5rem)] -bottom-[var(--web-about-frame-y,1.25rem)] top-[var(--web-about-frame-y,1.25rem)] rounded-card bg-primary/10"
              aria-hidden="true"
            />
            <img
              :src="image"
              :alt="mediaAlt"
              :class="cn('relative w-full rounded-card object-cover shadow-lift', mediaRatioClass)"
              loading="lazy"
            >
          </figure>
        </slot>
        <div
          class="web-about__body mx-auto mt-[var(--web-about-body-mt,3rem)] w-full max-w-3xl"
          :class="cn(bodyClass)"
        >
          <slot name="body" :body-html="bodyHtml">
            <WebRichText
              v-if="bodyHtml"
              :html="bodyHtml"
              class="web-about__prose text-[length:var(--web-about-prose-size,1rem)]"
            />
          </slot>
          <slot name="stats" :stats="statList">
            <dl
              v-if="statList.length"
              class="web-about__stats mt-10 grid gap-6 border-t border-border pt-7 sm:grid-cols-[repeat(auto-fit,minmax(7rem,1fr))]"
            >
              <div v-for="(s, i) in statList" :key="(s.label ?? '') + i" class="min-w-0">
                <dt class="web-num font-display text-[length:var(--web-about-stat-size,1.875rem)] font-bold leading-none text-primary">
                  {{ s.value }}
                </dt>
                <dd v-if="s.label" class="mt-2 text-sm text-muted-foreground">{{ s.label }}</dd>
              </div>
            </dl>
          </slot>
          <slot name="actions">
            <a
              v-if="contactHref"
              :href="contactHref"
              class="web-about__cta group mt-8 inline-flex h-12 items-center gap-2 rounded-md bg-primary px-7 text-sm font-semibold text-primary-foreground shadow-card web-motion hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-lift"
            >
              {{ ctaLabel }}
              <svg class="size-4 transition-transform group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>
            </a>
          </slot>
        </div>
      </template>

      <!-- 时间轴 -->
      <template v-else>
        <ol class="web-about__timeline relative mx-auto w-full max-w-3xl space-y-[var(--web-about-timeline-gap,2.25rem)]">
          <span class="absolute bottom-2 left-3 top-2 w-px bg-gradient-to-b from-primary via-border to-transparent" aria-hidden="true" />
          <li
            v-for="(m, i) in milestones ?? []"
            :key="(m.title ?? '') + i"
            class="web-about__milestone relative pl-10"
          >
            <slot name="milestone" :milestone="m" :index="i">
              <span class="absolute left-0 top-1 grid size-6 place-items-center rounded-full border-2 border-primary bg-background" aria-hidden="true">
                <span class="size-2 rounded-full bg-primary" />
              </span>
              <p v-if="m.year" class="web-num inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                {{ m.year }}
              </p>
              <h3 class="mt-2 text-lg font-semibold">{{ m.title }}</h3>
              <p v-if="m.summary" class="mt-1.5 text-sm leading-relaxed text-muted-foreground">{{ m.summary }}</p>
            </slot>
          </li>
        </ol>
        <div v-if="bodyHtml" class="web-about__body mx-auto mt-[var(--web-about-body-mt,3rem)] w-full max-w-3xl" :class="cn(bodyClass)">
          <WebRichText :html="bodyHtml" class="web-about__prose text-[length:var(--web-about-prose-size,1rem)]" />
        </div>
      </template>

      <!-- 特性卡（#features 整块替换，#feature 单卡替换） -->
      <slot name="features" :features="featureList">
        <ul
          v-if="featureList.length"
          class="web-about__features mt-[var(--web-about-features-mt,3.5rem)] grid gap-[var(--web-about-feature-gap,1.5rem)]"
          :class="cn(featureColsClass, featuresClass)"
        >
          <li v-for="(f, i) in featureList" :key="f.title + i" class="min-w-0">
            <slot name="feature" :feature="f" :index="i">
              <component
                :is="f.href ? 'a' : 'div'"
                :href="f.href || undefined"
                class="web-about__feature group flex h-full flex-col rounded-card border border-border bg-card p-7 shadow-card web-motion hover:-translate-y-1 hover:border-primary/30 hover:shadow-lift"
              >
                <span class="web-num text-sm font-semibold text-primary/70">{{ f.icon || aboutFeatureIndex(i) }}</span>
                <h3 class="mt-3 font-display text-lg font-semibold">{{ f.title }}</h3>
                <p v-if="f.summary" class="mt-2.5 text-sm leading-relaxed text-muted-foreground">{{ f.summary }}</p>
              </component>
            </slot>
          </li>
        </ul>
      </slot>
    </slot>

    <slot name="after" />
  </div>
</template>
