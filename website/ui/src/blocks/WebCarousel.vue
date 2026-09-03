<script setup lang="ts">
/** WebCarousel —— 横向图片轮播:触屏原生滑动 + 鼠标拖拽 + 箭头/圆点切换器(scroll-snap 原生实现,零依赖)。
 *  部件变量：--web-carousel-fit（object-fit，默认 cover；证书/文档类媒体可在祖先设 contain 完整呈现）。 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { componentStrings } from '../componentStrings.ts'

export interface WebCarouselItem {
  image: string
  alt?: string
  href?: string | null
}

const props = withDefaults(
  defineProps<{
    items?: WebCarouselItem[]
    /** 桌面端每屏卡片数(移动端自动放宽为单卡大图)。 */
    perView?: number
    /** 图片卡高度(px)。 */
    height?: number
    /** 到头后循环回卷。 */
    loop?: boolean
  }>(),
  { items: () => [], perView: 3, height: 220, loop: true },
)

const viewport = ref<HTMLElement | null>(null)
const page = ref(0)
const pages = ref(1)
/** 鼠标拖拽中(禁用 snap,防止程序化滚动被吸附打断)。 */
const dragging = ref(false)

const per = computed(() => Math.max(1, props.perView))

/** 卡位步长(px)=卡宽+间距;吸附位、翻页、圆点全部按它计算。
 *  用屏宽当页单位是错的:桌面一屏放多卡,末页只滚到 overflow(不足一屏),
 *  round(scrollLeft/屏宽) 恒为 0 → 圆点不更新、拖拽钳制归零。 */
let stepPx = 1

function measure() {
  const el = viewport.value
  if (!el) return
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
  const el = viewport.value
  if (!el) return
  const max = el.scrollWidth - el.clientWidth
  if (max <= 0) return
  let next = (Math.round(el.scrollLeft / stepPx) + dir) * stepPx
  if (props.loop) {
    if (next < 0) next = max
    if (next > max) next = 0
  } else {
    next = Math.max(0, Math.min(next, max))
  }
  el.scrollTo({ left: next, behavior: 'smooth' })
}

/* 鼠标拖拽(触屏设备走原生滚动)。松手按位移阈值翻一页,而不是对 scrollLeft 取整:
   鼠标一次只能拖几十像素,不足半屏取整永远落回原页,表现为"松手复原"。
   dragging 覆盖"拖拽 + settle 平滑动画"两段(保持 snap 关闭);pointerDown 只在按住时为真,
   settle 期间鼠标已松开,不能再带动视口。 */
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
  dragging.value = true
  startX = e.clientX
  startLeft = el.scrollLeft
  el.setPointerCapture(e.pointerId)
}
function onPointerMove(e: PointerEvent) {
  /* 只有按住鼠标时才跟随;settle 动画期间按键已松开,不能再带动视口 */
  if (!dragging.value || !pointerDown) return
  const el = viewport.value
  if (!el) return
  el.scrollLeft = startLeft - (e.clientX - startX)
  if (Math.abs(e.clientX - startX) > 6) movedFar = true
}
function onPointerUp(e: PointerEvent) {
  if (!pointerDown) return
  pointerDown = false
  const el = viewport.value
  if (!el) return
  const max = el.scrollWidth - el.clientWidth
  /* advanced>0 = 鼠标左拖、内容前进(下一张方向);鼠标右拖为回退。 */
  const advanced = el.scrollLeft - startLeft
  const startIdx = Math.round(startLeft / stepPx)
  /* 未跨过卡位时的最小翻动距离:超过则按拖动方向走一步,否则回弹 */
  const minMove = Math.max(24, stepPx * 0.15)
  let target = Math.round(el.scrollLeft / stepPx)
  if (target === startIdx && Math.abs(advanced) > minMove) target = startIdx + (advanced > 0 ? 1 : -1)
  target = Math.max(0, Math.min(target, pages.value - 1))
  el.scrollTo({ left: Math.min(target * stepPx, max), behavior: 'smooth' })
  /* 平滑动画期间保持 snap 关闭,动画结束再恢复,避免浏览器中途回吸 */
  if (settleTimer) clearTimeout(settleTimer)
  settleTimer = setTimeout(() => { settleTimer = null; dragging.value = false }, 450)
}
function onClickCapture(e: MouseEvent) {
  /* 拖拽后松手落在链接卡片上,不触发跳转 */
  if (movedFar) {
    e.preventDefault()
    e.stopPropagation()
    movedFar = false
  }
}

let ro: ResizeObserver | null = null
onMounted(() => {
  measure()
  ro = new ResizeObserver(measure)
  if (viewport.value) ro.observe(viewport.value)
})
onBeforeUnmount(() => ro?.disconnect())
</script>

<template>
  <div
    v-if="items.length"
    class="web-carousel"
    role="region"
    :aria-label="componentStrings.WebCarousel.label"
    :style="{ '--cw-per': per }"
  >
    <div class="web-carousel__stage relative">
      <div
        ref="viewport"
        class="web-carousel__viewport flex snap-x snap-mandatory gap-4 overflow-x-auto select-none"
        :class="{ 'is-dragging': dragging }"
        @scroll.passive="measure"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
        @click.capture="onClickCapture"
      >
        <component
          :is="item.href ? 'a' : 'div'"
          v-for="(item, i) in items"
          :key="i"
          data-carousel-card
          class="web-carousel__card shrink-0 snap-start"
          :href="item.href ?? undefined"
        >
          <img
            :src="item.image"
            :alt="item.alt ?? ''"
            loading="lazy"
            draggable="false"
            class="rounded-card border border-border shadow-card"
            :style="`height: ${height}px; width: 100%; object-fit: var(--web-carousel-fit, cover)`"
          >
        </component>
      </div>

      <!-- 箭头:覆盖在图片居中两侧(定位基准是 stage,不再受页面其他 positioned 祖先影响) -->
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
    </div>

    <!-- 指示器:圆点居中在下 -->
    <div class="mt-4 flex items-center justify-center gap-1.5">
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
  </div>
</template>

<style scoped>
/* 箭头的定位基准:stage 自身必须 positioned,否则 absolute 按钮会相对页面更上层的 positioned 祖先(hero 等)定位 */
.web-carousel__stage {
  position: relative;
}
.web-carousel__viewport {
  scrollbar-width: none;
  cursor: grab;
}
.web-carousel__viewport:active {
  cursor: grabbing;
}
.web-carousel__viewport::-webkit-scrollbar {
  display: none;
}
/* 鼠标拖拽期间关闭 snap,松手后由 JS 吸附;图片禁用浏览器原生拖拽鬼影 */
.web-carousel__viewport.is-dragging {
  scroll-snap-type: none;
}
.web-carousel__viewport img {
  -webkit-user-drag: none;
  user-select: none;
}
/* 移动端单卡大图;sm 两卡;lg 起按 perView 均分 */
.web-carousel__card {
  width: min(78%, 360px);
}
@media (min-width: 640px) {
  .web-carousel__card {
    width: calc((100% - 16px) / 2);
  }
}
@media (min-width: 1024px) {
  .web-carousel__card {
    width: calc((100% - (var(--cw-per) - 1) * 16px) / var(--cw-per));
  }
}
</style>
