<script setup lang="ts">
/** WebCarousel —— 通用多模式轮播组件
 *  支持三种模式：
 *  1. standard（默认）：触屏原生滑动 + 鼠标拖拽 + snap 吸附卡片流
 *  2. continuous：连续无缝流式自动滚动（工程案例等展示）
 *  3. coverflow / centered：居中聚焦卡片轮播（正中最大、两侧自适应缩放、拖拽与自动轮播、无限循环、数字分页）
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { componentStrings } from '../componentStrings.ts'
import { wrapIndex } from '../lib/carousel.ts'

export interface WebCarouselItem {
  image?: string
  alt?: string
  href?: string | null
  [key: string]: any
}

const props = withDefaults(
  defineProps<{
    items?: any[]
    /** 轮播模式：standard | continuous | coverflow | centered */
    mode?: 'standard' | 'continuous' | 'coverflow' | 'centered'
    /** 桌面端每屏卡片数 (standard 模式) */
    perView?: number
    /** 图片卡高度(px) */
    height?: number
    /** 是否循环 */
    loop?: boolean
    /** 是否自动播放 (continuous 与 coverflow 模式默认开启) */
    autoplay?: boolean
    /** 自动播放间隔(ms) */
    autoplayInterval?: number
    /** 连续滚动速度 (px/frame, continuous 模式) */
    speed?: number
    /** 卡片间距 */
    gap?: string | number
  }>(),
  {
    items: () => [],
    mode: 'standard',
    perView: 3,
    height: 220,
    loop: true,
    autoplay: false,
    autoplayInterval: 3500,
    speed: 1,
    gap: '20px',
  },
)

const emit = defineEmits<{
  (e: 'change', index: number): void
}>()

const isCoverflow = computed(() => props.mode === 'coverflow' || props.mode === 'centered')
const isContinuous = computed(() => props.mode === 'continuous')

/* ==========================================================================
   1. 居中聚焦模式 (Coverflow / Centered)
   ========================================================================== */
const activeIndex = ref(0)
const isHovered = ref(false)

const totalItems = computed(() => props.items.length)

function getOffset(index: number): number {
  const len = totalItems.value
  if (len <= 1) return 0
  let diff = index - activeIndex.value
  while (diff > len / 2) diff -= len
  while (diff < -len / 2) diff += len
  return diff
}

function next() {
  if (totalItems.value <= 1) return
  activeIndex.value = wrapIndex(activeIndex.value, 1, totalItems.value)
  emit('change', activeIndex.value)
}

function prev() {
  if (totalItems.value <= 1) return
  activeIndex.value = wrapIndex(activeIndex.value, -1, totalItems.value)
  emit('change', activeIndex.value)
}

function selectIndex(index: number) {
  activeIndex.value = index
  emit('change', activeIndex.value)
}

/* 自动播放计时器 (支持 Coverflow 与 Standard 模式) */
let autoplayTimer: ReturnType<typeof setInterval> | null = null
function startAutoplay() {
  stopAutoplay()
  if (!props.autoplay && !isCoverflow.value) return
  autoplayTimer = setInterval(() => {
    if (!isHovered.value && !dragging.value) {
      if (isCoverflow.value) next()
      else go(1)
    }
  }, props.autoplayInterval)
}

function stopAutoplay() {
  if (autoplayTimer) {
    clearInterval(autoplayTimer)
    autoplayTimer = null
  }
}

watch(
  () => props.autoplay,
  (val) => {
    if (val) startAutoplay()
    else stopAutoplay()
  },
)

/* 鼠标拖拽 / 触屏手势 (Coverflow 模式) */
let pointerStartX = 0
let pointerDeltaX = 0
const isDraggingCoverflow = ref(false)

function onCoverflowPointerDown(e: PointerEvent) {
  pointerStartX = e.clientX
  pointerDeltaX = 0
  isDraggingCoverflow.value = true
}

function onCoverflowPointerMove(e: PointerEvent) {
  if (!isDraggingCoverflow.value) return
  pointerDeltaX = e.clientX - pointerStartX
}

function onCoverflowPointerUp() {
  if (!isDraggingCoverflow.value) return
  isDraggingCoverflow.value = false
  if (Math.abs(pointerDeltaX) > 35) {
    if (pointerDeltaX < 0) next()
    else prev()
  }
  pointerDeltaX = 0
}

/* ==========================================================================
   2. 标准模式与连续滚动模式 (Standard & Continuous)
   ========================================================================== */
const viewport = ref<HTMLElement | null>(null)
const page = ref(0)
const pages = ref(1)
const dragging = ref(false)
const per = computed(() => Math.max(1, props.perView))

let stepPx = 1
function measure() {
  const el = viewport.value
  if (!el || isCoverflow.value) return
  const cards = el.querySelectorAll<HTMLElement>('[data-carousel-card]')
  const first = cards[0]
  const second = cards[1]
  const step = first && second ? second.offsetLeft - first.offsetLeft : el.clientWidth
  stepPx = step > 0 ? step : el.clientWidth
  const overflow = el.scrollWidth - el.clientWidth
  pages.value = overflow > 4 ? Math.ceil(overflow / stepPx) + 1 : 1
  page.value = Math.min(pages.value - 1, Math.max(0, Math.round(el.scrollLeft / stepPx)))
}

function jumpTo(i: number) {
  const el = viewport.value
  if (!el) return
  el.scrollTo({ left: Math.min(i * stepPx, el.scrollWidth - el.clientWidth), behavior: 'smooth' })
}

function go(dir: 1 | -1) {
  if (isCoverflow.value) {
    if (dir === 1) next()
    else prev()
    return
  }
  const el = viewport.value
  if (!el) return
  const max = el.scrollWidth - el.clientWidth
  if (max <= 0) return
  let nextPos = (Math.round(el.scrollLeft / stepPx) + dir) * stepPx
  if (props.loop) {
    if (nextPos < 0) nextPos = max
    if (nextPos > max) nextPos = 0
  } else {
    nextPos = Math.max(0, Math.min(nextPos, max))
  }
  el.scrollTo({ left: nextPos, behavior: 'smooth' })
}

/* Standard 拖拽 */
let startX = 0
let startLeft = 0
let movedFar = false
let pointerDown = false
let settleTimer: ReturnType<typeof setTimeout> | null = null

function onPointerDown(e: PointerEvent) {
  if (e.pointerType !== 'mouse') return
  const el = viewport.value
  if (!el) return
  if (settleTimer) { clearTimeout(settleTimer); settleTimer = null }
  movedFar = false
  pointerDown = true
  startX = e.clientX
  startLeft = el.scrollLeft
}

function onPointerMove(e: PointerEvent) {
  if (!pointerDown) return
  const el = viewport.value
  if (!el) return
  const delta = e.clientX - startX
  if (!movedFar && Math.abs(delta) > 6) {
    movedFar = true
    dragging.value = true
    try {
      el.setPointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }
  if (movedFar) {
    el.scrollLeft = startLeft - delta
  }
}

function onPointerUp(e: PointerEvent) {
  if (!pointerDown) return
  pointerDown = false
  const el = viewport.value
  if (!el) return
  if (!movedFar) {
    dragging.value = false
    return
  }
  try {
    if (el.hasPointerCapture?.(e.pointerId)) {
      el.releasePointerCapture(e.pointerId)
    }
  } catch {
    /* ignore */
  }
  const max = el.scrollWidth - el.clientWidth
  const advanced = el.scrollLeft - startLeft
  const startIdx = Math.round(startLeft / stepPx)
  const minMove = Math.max(24, stepPx * 0.15)
  let target = Math.round(el.scrollLeft / stepPx)
  if (target === startIdx && Math.abs(advanced) > minMove) target = startIdx + (advanced > 0 ? 1 : -1)
  target = Math.max(0, Math.min(target, pages.value - 1))
  el.scrollTo({ left: Math.min(target * stepPx, max), behavior: 'smooth' })
  if (settleTimer) clearTimeout(settleTimer)
  settleTimer = setTimeout(() => { settleTimer = null; dragging.value = false }, 450)
}

function onClickCapture(e: MouseEvent) {
  if (movedFar) {
    e.preventDefault()
    e.stopPropagation()
    movedFar = false
  }
}

/* Continuous 模式动画循环 */
let continuousRaf: number | null = null
function startContinuousScroll() {
  const el = viewport.value
  if (!el || !isContinuous.value) return

  const step = () => {
    if (!isHovered.value && !dragging.value && el) {
      el.scrollLeft += props.speed
      if (el.scrollLeft >= el.scrollWidth / 2) {
        el.scrollLeft = 0
      }
    }
    continuousRaf = requestAnimationFrame(step)
  }
  continuousRaf = requestAnimationFrame(step)
}

let ro: ResizeObserver | null = null
onMounted(() => {
  if (isCoverflow.value) {
    if (props.autoplay !== false) {
      startAutoplay()
    }
  } else {
    measure()
    ro = new ResizeObserver(measure)
    if (viewport.value) ro.observe(viewport.value)
    if (isContinuous.value) {
      startContinuousScroll()
    } else if (props.autoplay) {
      startAutoplay()
    }
  }
})

onBeforeUnmount(() => {
  stopAutoplay()
  if (continuousRaf) cancelAnimationFrame(continuousRaf)
  ro?.disconnect()
})
</script>

<template>
  <div
    v-if="items.length"
    class="web-carousel"
    :class="[
      `web-carousel--${mode}`,
      { 'is-coverflow': isCoverflow },
    ]"
    role="region"
    :aria-label="componentStrings.WebCarousel.label"
    :style="{ '--cw-per': per, '--cw-gap': typeof gap === 'number' ? `${gap}px` : gap }"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
  >
    <!-- =======================================================================
         A. 居中聚焦模式 (Coverflow / Centered)
         ======================================================================= -->
    <template v-if="isCoverflow">
      <div
        class="web-carousel__coverflow-stage"
        @pointerdown="onCoverflowPointerDown"
        @pointermove="onCoverflowPointerMove"
        @pointerup="onCoverflowPointerUp"
        @pointercancel="onCoverflowPointerUp"
      >
        <div class="web-carousel__coverflow-track">
          <div
            v-for="(item, i) in items"
            :key="i"
            class="web-carousel__coverflow-item"
            :class="{
              'is-active': i === activeIndex,
              'is-prev': getOffset(i) === -1,
              'is-next': getOffset(i) === 1,
              'is-far': Math.abs(getOffset(i)) > 1,
            }"
            :style="{
              '--offset': getOffset(i),
              '--abs-offset': Math.abs(getOffset(i)),
            }"
            @click="selectIndex(i)"
          >
            <!-- 默认插槽：支持外部自定义卡片内容 -->
            <slot :item="item" :index="i" :active="i === activeIndex">
              <div class="web-carousel__default-card">
                <img
                  :src="item.image || item"
                  :alt="item.alt || ''"
                  draggable="false"
                  :style="`height: ${height}px; object-fit: var(--web-carousel-fit, contain)`"
                >
              </div>
            </slot>
          </div>
        </div>
      </div>

      <!-- 分页控制插槽（传出 current, total, prev, next） -->
      <slot
        name="pagination"
        :current="activeIndex"
        :total="totalItems"
        :prev="prev"
        :next="next"
      >
        <div class="web-carousel__pagination mt-6 flex items-center justify-center gap-4">
          <button
            type="button"
            class="inline-flex size-9 items-center justify-center rounded-full bg-[#003582] text-white hover:opacity-90"
            :aria-label="componentStrings.WebCarousel.prev"
            @click="prev"
          >
            <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6" /></svg>
          </button>
          <span class="text-lg font-medium text-foreground">
            {{ String(activeIndex + 1).padStart(2, '0') }} / {{ String(totalItems).padStart(2, '0') }}
          </span>
          <button
            type="button"
            class="inline-flex size-9 items-center justify-center rounded-full border border-[#003C8A] bg-white text-[#003582] hover:bg-slate-50"
            :aria-label="componentStrings.WebCarousel.next"
            @click="next"
          >
            <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6" /></svg>
          </button>
        </div>
      </slot>
    </template>

    <!-- =======================================================================
         B. 标准模式与连续滚动模式 (Standard & Continuous)
         ======================================================================= -->
    <template v-else>
      <div class="web-carousel__stage relative">
        <div
          ref="viewport"
          class="web-carousel__viewport flex snap-x snap-mandatory gap-4 overflow-x-auto select-none"
          :class="{ 'is-dragging': dragging, 'is-continuous': isContinuous }"
          @scroll.passive="measure"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointercancel="onPointerUp"
          @click.capture="onClickCapture"
        >
          <!-- continuous 模式可多组重复以支持无限循环 -->
          <div
            v-for="(item, i) in (isContinuous ? [...items, ...items] : items)"
            :key="i"
            data-carousel-card
            class="web-carousel__card group shrink-0 snap-start"
          >
            <slot :item="item" :index="i" :active="false">
              <component
                :is="item.href ? 'a' : 'div'"
                :href="item.href ?? undefined"
              >
                <img
                  :src="item.image || item"
                  :alt="item.alt ?? ''"
                  loading="lazy"
                  draggable="false"
                  class="rounded-card border border-border shadow-card transition-shadow duration-300 group-hover:shadow-lift"
                  :style="`height: ${height}px; width: 100%; object-fit: var(--web-carousel-fit, cover)`"
                >
              </component>
            </slot>
          </div>
        </div>

        <!-- 默认左右箭头切换器 (非 continuous 模式) -->
        <template v-if="!isContinuous">
          <button
            type="button"
            class="absolute left-3 top-1/2 z-10 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-background/80 text-foreground shadow-md backdrop-blur-sm transition-colors hover:bg-background hover:text-primary"
            :aria-label="componentStrings.WebCarousel.prev"
            @click="go(-1)"
          >
            <svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
          </button>
          <button
            type="button"
            class="absolute right-3 top-1/2 z-10 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-background/80 text-foreground shadow-md backdrop-blur-sm transition-colors hover:bg-background hover:text-primary"
            :aria-label="componentStrings.WebCarousel.next"
            @click="go(1)"
          >
            <svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
          </button>
        </template>
      </div>

      <!-- 标准模式圆点指示器 -->
      <div v-if="!isContinuous" class="mt-4 flex items-center justify-center gap-1.5">
        <button
          v-for="p in pages"
          :key="p"
          type="button"
          class="size-1.5 rounded-full transition-colors"
          :class="p - 1 === page ? 'w-4 bg-primary' : 'bg-border hover:bg-muted-foreground/40'"
          :aria-label="String(p)"
          @click="jumpTo(p - 1)"
        />
      </div>
    </template>
  </div>
</template>

<style scoped>
/* 居中聚焦模式 (Coverflow / Centered) */
.web-carousel__coverflow-stage {
  position: relative;
  width: 100%;
  overflow: hidden;
  padding: 30px 0 20px;
  user-select: none;
  touch-action: pan-y;
  cursor: grab;
}

.web-carousel__coverflow-stage:active {
  cursor: grabbing;
}

.web-carousel__coverflow-track {
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  min-height: 420px;
  perspective: 1000px;
}

.web-carousel__coverflow-item {
  position: absolute;
  top: 50%;
  left: 50%;
  transition: transform 0.45s cubic-bezier(0.25, 1, 0.5, 1),
              opacity 0.45s cubic-bezier(0.25, 1, 0.5, 1),
              z-index 0.45s;
  cursor: pointer;
  will-change: transform, opacity;
}

/* 激活项（正中心）：最大最亮 */
.web-carousel__coverflow-item.is-active {
  transform: translate(-50%, -50%) scale(1.15);
  z-index: 20;
  opacity: 1;
}

/* 紧挨两边项（前一张/后一张） */
.web-carousel__coverflow-item.is-prev {
  transform: translate(calc(-50% - 280px), -50%) scale(0.92);
  z-index: 10;
  opacity: 0.85;
}

.web-carousel__coverflow-item.is-next {
  transform: translate(calc(-50% + 280px), -50%) scale(0.92);
  z-index: 10;
  opacity: 0.85;
}

/* 更外侧项 */
.web-carousel__coverflow-item.is-far {
  transform: translate(calc(-50% + (var(--offset) * 260px)), -50%) scale(0.76);
  z-index: 5;
  opacity: 0.45;
  pointer-events: none;
}

@media (max-width: 900px) {
  .web-carousel__coverflow-item.is-prev {
    transform: translate(calc(-50% - 170px), -50%) scale(0.85);
  }
  .web-carousel__coverflow-item.is-next {
    transform: translate(calc(-50% + 170px), -50%) scale(0.85);
  }
  .web-carousel__coverflow-item.is-far {
    opacity: 0;
  }
}
</style>
