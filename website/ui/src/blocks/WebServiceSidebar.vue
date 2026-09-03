<script setup lang="ts">
/**
 * WebServiceSidebar —— 右侧悬浮按钮列（回顶 + 可扩展）。
 *
 * 纵向顺序约定（新增按钮必须遵循）：
 *   客服（WebChatWidget 悬浮球，最上）→ 扩展按钮（#default 插槽，中间）→ 返回顶部（最底贴地）
 *
 * - 客服球由 WebChatWidget 承担：回顶可见时通过 useServiceUi 联动抬高让位；
 * - 扩展按钮放 #default 插槽（渲染在回顶上方，与客服同列、同尺寸变量），
 *   若新增的扩展会顶到客服球，站点可调 --web-chat-ball-raise 再把客服球抬高；
 * - 回顶按钮贴底常驻定位（bottom-6），滚动超过阈值后动态出现。
 */
import { onMounted, onBeforeUnmount } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '../lib/cn.ts'
import { useServiceUi } from '../lib/chatStore.ts'
import { componentStrings } from '../componentStrings.ts'

const props = withDefaults(
  defineProps<{
    /** 滚动超过多少 px 后显示回到顶部（默认 200） */
    showThreshold?: number
    /** 距右侧距离（与客服球 right-6 对齐） */
    right?: number
    /** 距底部距离（默认贴地，与客服球未抬升时同高） */
    bottom?: number
    class?: ClassValue
  }>(),
  {
    showThreshold: 200,
    right: 24,
    bottom: 24,
    class: undefined,
  },
)

defineOptions({ inheritAttrs: false })

const serviceUi = useServiceUi()

function onScroll() {
  serviceUi.backTopVisible = window.scrollY > props.showThreshold
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
})

const S = componentStrings.WebServiceSidebar
</script>

<template>
  <div
    :class="cn(
      'web-service-sidebar fixed z-40 flex flex-col items-center gap-2.5',
      $props.class,
    )"
    :style="{ right: `${right}px`, bottom: `${bottom}px` }"
    :aria-label="S.tools"
  >
    <!-- 扩展按钮（客服之下、回顶之上）；尺寸沿用 --web-service-size -->
    <slot />
    <!-- 回到顶部（滚动后出现；尺寸与客服悬浮球 size-14 一致；永远贴底） -->
    <Transition name="web-service-rise">
      <button
        v-if="serviceUi.backTopVisible"
        type="button"
        class="web-service-sidebar__btn group flex items-center justify-center rounded-full border border-border/60 bg-card/70 text-muted-foreground/70 shadow-sm backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-card hover:text-primary hover:shadow-lg active:scale-95"
        :style="{ width: 'var(--web-service-size, 3.5rem)', height: 'var(--web-service-size, 3.5rem)' }"
        :aria-label="S.toTop"
        @click="scrollToTop"
      >
        <svg class="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M18 15l-6-6-6 6" />
        </svg>
      </button>
    </Transition>
  </div>
</template>

<style scoped>
.web-service-rise-enter-active,
.web-service-rise-leave-active {
  transition: opacity 0.25s, transform 0.25s;
}
.web-service-rise-enter-from,
.web-service-rise-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.9);
}
@media (prefers-reduced-motion: reduce) {
  .web-service-rise-enter-active,
  .web-service-rise-leave-active {
    transition: none;
  }
}
</style>
