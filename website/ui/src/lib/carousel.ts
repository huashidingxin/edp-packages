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

/**
 * 连续无缝轮播环绕计算：
 * 保持 scrollLeft 始终落在中间组 [setWidth, setWidth * 2) 区间内。
 * 越界时以 setWidth 为步长进行瞬时平移，返回修正后的 scrollLeft。
 */
export function wrapScrollPosition(scrollLeft: number, setWidth: number): number {
  if (setWidth <= 0) return scrollLeft
  let current = scrollLeft
  while (current >= setWidth * 2) {
    current -= setWidth
  }
  while (current < setWidth) {
    current += setWidth
  }
  return current
}

/**
 * 计算单组数据的几何跨度（含项宽与 gap）：
 * 给定各卡片相对于轨道的 offsetLeft 数组与单组数据项数 count，
 * 计算从第 0 项到第 count 项的准确位移。
 */
export function measureSetStride(offsets: number[], count: number, fallbackWidth: number): number {
  if (count <= 0 || offsets.length < count * 2) {
    return fallbackWidth > 0 ? fallbackWidth / 3 : 0
  }
  const first = offsets[0] ?? 0
  const secondSetFirst = offsets[count] ?? 0
  const stride = secondSetFirst - first
  return stride > 0 ? stride : (fallbackWidth > 0 ? fallbackWidth / 3 : 0)
}

