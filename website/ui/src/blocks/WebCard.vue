<script setup lang="ts">
/**
 * WebCard —— 统一内容卡片（kind × variant × orientation 组合）。
 *
 * 定制契约示范（所有 block 遵循）：
 * 1. 语义类钩子：根 `web-card` + `web-card--{kind}`，部件 `web-card__{part}`；
 * 2. data 钩子：`data-variant` / `data-kind` / `data-orientation`；
 * 3. cva 变体类：variant/orientation 映射为工具类组合；
 * 4. 部件级变量：媒体比例 `--web-card-ratio`（ratio prop 或任意祖先声明）；
 * 5. 插槽逃生口：#media / #title / #meta / #actions / #default（整身替换）。
 * 样式默认值全部走 --color-* / --radius-* / --shadow-* / --aspect-* 令牌。
 */
import { computed } from 'vue'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../lib/cn.ts'
import { componentStrings } from '../componentStrings.ts'
import { CARD_KIND_DEFAULT_RATIO, type WebCardKind } from './card.ts'

const props =  withDefaults(
  defineProps<{
    kind?: WebCardKind
    variant?: CardVariants['variant']
    orientation?: CardVariants['orientation']
    /** CSS aspect-ratio 值，如 '4/3'、'16/9'；缺省读 kind 默认或祖先变量。 */
    ratio?: string | null
    /** 是否渲染媒体区；纯文字卡设 false（不渲染封面/占位块，卡片只剩文字体）。 */
    media?: boolean | null
    title?: string | null
    summary?: string | null
    image?: string | null
    imageAlt?: string | null
    href?: string | null
    /** 元信息行（分类 / 日期等已格式化文本）。 */
    meta?: string | null
    /** 角标文本（如 NEW / 推荐）。 */
    tag?: string | null
    /** 跳转锚点 title 属性。 */
    linkTitle?: string | null
  }>(),
  {
    kind: 'plain',
    variant: 'raised',
    orientation: 'vertical',
    ratio: null,
    media: true,
    title: null,
    summary: null,
    image: null,
    imageAlt: null,
    href: null,
    meta: null,
    tag: null,
    linkTitle: null,
  },
)

const cardVariants = cva('web-card group relative flex overflow-hidden', {
  variants: {
    variant: {
      raised:
        'rounded-card border border-border bg-card text-card-foreground shadow-card web-motion hover:-translate-y-1 hover:shadow-lift',
      flush: '',
      outline:
        'rounded-card border border-border bg-transparent web-motion hover:border-primary/40',
      minimal: '',
      overlay: 'rounded-card bg-card shadow-card web-motion hover:-translate-y-1 hover:shadow-lift',
    },
    orientation: {
      vertical: 'flex-col',
      horizontal: 'flex-row items-stretch',
    },
  },
  defaultVariants: { variant: 'raised', orientation: 'vertical' },
})
type CardVariants = VariantProps<typeof cardVariants>

const isOverlay = computed(() => props.variant === 'overlay')
const isHorizontal = computed(() => !isOverlay.value && props.orientation === 'horizontal')

const rootClass = computed(() =>
  cn(cardVariants({ variant: props.variant, orientation: props.orientation })),
)

/** 水平布局时媒体列宽由变量控制（站点可覆盖）。 */
const mediaStyle = computed(() => ({
  '--web-card-ratio': props.ratio || CARD_KIND_DEFAULT_RATIO[props.kind],
}))

const mediaBoxClass = computed(() =>
  cn(
    'web-card__media relative shrink-0 overflow-hidden bg-muted',
    isHorizontal.value ? 'w-[var(--web-card-media-w,38%)] self-stretch' : 'w-full',
  ),
)

const titleTag = computed(() => (props.href ? 'a' : 'div'))

/** media=false → 整块媒体区（含占位块）不渲染，纯文字形态。 */
const showMedia = computed(() => props.media !== false)
</script>

<template>
  <component
    :is="titleTag"
    :href="href ?? undefined"
    :title="linkTitle ?? undefined"
    :class="rootClass"
    :style="mediaStyle"
    :data-variant="variant"
    :data-kind="kind"
    :data-orientation="orientation"
  >
    <!-- #media 整体替换；media=false 或无封面时整块不渲染（无图卡=纯文字卡，不再渲染大块占位框） -->
    <template v-if="showMedia">
      <slot name="media" :image="image" :alt="imageAlt" :title="title">
        <div v-if="image" :class="mediaBoxClass">
          <img
            :src="image"
            :alt="imageAlt ?? title ?? ''"
            loading="lazy"
            class="web-card__media-img size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
          >
          <span
            v-if="tag"
            class="web-card__tag absolute left-3 top-3 inline-flex items-center rounded-sm bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground"
          >{{ tag }}</span>
        </div>
      </slot>
    </template>

    <!-- overlay 变体：文字压图 -->
    <template v-if="isOverlay">
      <slot>
        <div class="web-card__body absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent p-5 pt-12">
          <slot name="meta">
            <p v-if="meta" class="web-card__meta text-xs font-medium text-white/75">{{ meta }}</p>
          </slot>
          <slot name="title">
            <h3 class="web-card__title mt-1 line-clamp-2 text-base font-semibold leading-snug text-white">{{ title }}</h3>
          </slot>
          <slot name="actions" />
        </div>
      </slot>
    </template>

    <!-- 常规变体 -->
    <template v-else>
      <slot>
        <div class="web-card__body flex min-w-0 flex-1 flex-col p-5">
          <slot name="meta">
            <p v-if="meta" class="web-card__meta truncate text-xs font-medium text-primary">{{ meta }}</p>
          </slot>
          <slot name="title">
            <h3 class="web-card__title mt-1.5 line-clamp-2 text-base font-semibold leading-snug text-foreground transition-colors group-hover:text-primary">
              {{ title }}
            </h3>
          </slot>
          <slot name="summary">
            <p v-if="summary" class="web-card__summary web-clamp-2 mt-2 text-sm leading-relaxed text-muted-foreground">{{ summary }}</p>
          </slot>
          <div v-if="$slots.actions" class="web-card__actions mt-auto pt-4">
            <slot name="actions" />
          </div>
        </div>
      </slot>
    </template>
  </component>
</template>
