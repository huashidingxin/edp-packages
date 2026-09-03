import { onBeforeUnmount, onMounted, watch, type WatchSource } from 'vue'

/**
 * useWebReveal —— 通用滚动入场（进入视口即激活，配全局错峰延迟）。
 *
 * 页面用法：
 *   <div ref="listRef">
 *     <a v-for="(item, i) in items"
 *        data-web-reveal
 *        :data-web-reveal-delay="`${Math.min(i * 70, 350)}ms`">
 *   </div>
 *
 *   const listRef = ref<HTMLElement | null>(null)
 *   useWebReveal(() => listRef.value, { deps: [items] })
 *
 * 机制：
 * - 候选元素由容器内 `[data-web-reveal]` 标记；首屏内元素直接激活（不经历隐藏帧，无闪烁），
 *   视口外元素先挂 `.web-rise-wait` 隐藏，进入视口后换 `.web-rise-in` 播放入场动画（unobserve）。
 * - 动画样式复用全局动效令牌（--web-motion-*）；错峰经 `data-web-reveal-delay`（毫秒字符串）
 *   注入 CSS 变量 --web-reveal-delay。
 * - 渐进增强：隐藏态仅由 JS 挂类触发，无 JS / 无 IntersectionObserver 时内容始终可见。
 * - prefers-reduced-motion 由 styles.css 的全局 @media 降级，本 composable 无需处理。
 *
 * options.deps：容器内容在挂载后还会变化（如客户端切换分类、翻页），把数据源传入以便重扫。
 */
export interface WebRevealOptions {
  /** 候选元素选择器（容器内），默认 '[data-web-reveal]'。 */
  selector?: string
  /** 提前量：元素进入该区域即激活。默认底部提前 8% 触发，滚动感更跟手。 */
  rootMargin?: string
  /** 可见比例阈值。 */
  threshold?: number
  /** 内容变化后需要重新扫描的依赖（列表数据等）。 */
  deps?: WatchSource[]
}

export function useWebReveal(
  container: () => HTMLElement | null | undefined,
  options: WebRevealOptions = {},
): void {
  const {
    selector = '[data-web-reveal]',
    rootMargin = '0px 0px -8% 0px',
    threshold = 0.05,
    deps = [],
  } = options
  let observer: IntersectionObserver | null = null

  /** 激活：换 .web-rise-in 播放入场并停止观察。 */
  const reveal = (el: HTMLElement): void => {
    el.classList.remove('web-rise-wait')
    if (el.classList.contains('web-rise-in')) return
    const delay = el.dataset.webRevealDelay
    if (delay) el.style.setProperty('--web-reveal-delay', delay)
    el.classList.add('web-rise-in')
    observer?.unobserve(el)
  }

  const scan = (): void => {
    const root = container()
    observer?.disconnect()
    observer = null
    if (!root || typeof IntersectionObserver === 'undefined') return
    const targets = Array.from(root.querySelectorAll<HTMLElement>(selector))
    if (!targets.length) return
    const pending: HTMLElement[] = []
    const viewportH = window.innerHeight
    for (const el of targets) {
      if (el.classList.contains('web-rise-in')) continue
      const rect = el.getBoundingClientRect()
      if (rect.top < viewportH && rect.bottom > 0) {
        // 首屏内：直接激活，不经历隐藏帧，避免闪烁
        reveal(el)
      } else {
        el.classList.add('web-rise-wait')
        pending.push(el)
      }
    }
    if (!pending.length) return
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) reveal(entry.target as HTMLElement)
        }
      },
      { rootMargin, threshold },
    )
    pending.forEach((el) => observer!.observe(el))
  }

  onMounted(scan)
  watch([container, ...deps], scan, { flush: 'post' })
  onBeforeUnmount(() => {
    observer?.disconnect()
    observer = null
  })
}