/**
 * reka-ui 组装共享接线（视觉常量，非封装层）。
 *
 * 约定：行为一律直接组装 reka-ui 原件；本文件只沉淀跨 block 重复的样式串，
 * 避免 overlay / 浮层的 z-index 梯队各自漂移。
 */

/** 弹层遮罩（Dialog/Sheet 通用）。 */
export const overlayClass = 'fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px]';

/** 浮层内容统一层级与无障碍轮廓清除。 */
export const floatingClass = 'z-50 outline-none';
