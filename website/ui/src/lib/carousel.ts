/**
 * 轮播纯逻辑 —— 可单测的状态计算；组件内的响应式封装保持最薄。
 */

/** 环绕步进：dir=1/-1，越界回绕；len<=0 恒返 0。 */
export function wrapIndex(index: number, delta: number, len: number): number {
  if (len <= 0) return 0
  const n = ((index + delta) % len + len) % len
  return n
}

/** 最近有效索引（越界钳制）。 */
export function clampSlide(index: number, len: number): number {
  if (len <= 0) return 0
  return Math.min(Math.max(index, 0), len - 1)
}
