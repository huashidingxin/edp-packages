/** 媒体条目（图片 / 视频 / 3D 模型）。 */
export interface MediaItem {
  type?: string
  src?: string
  alt?: string
  poster?: string
  modelUrl?: string
  [key: string]: unknown
}

const MODEL_TYPES = new Set(['model', '3d', 'glb', 'gltf'])
const VIDEO_TYPES = new Set(['video', 'mp4', 'webm', 'ogv', 'mov'])
const MODEL_EXT_RE = /\.(glb|gltf)(\?|$)/i
const VIDEO_EXT_RE = /\.(mp4|webm|ogv|mov)(\?|$)/i

/** 是否为 3D 模型（type=model/3d/glb/gltf 或 src 以 .glb/.gltf 结尾）。 */
export function isModel(m: MediaItem | null | undefined): boolean {
  const t = (m?.type ?? '').toLowerCase()
  return MODEL_TYPES.has(t) || MODEL_EXT_RE.test(String(m?.src ?? ''))
}

/** 是否为视频（type=video 或 src 以常见视频扩展结尾）。 */
export function isVideo(m: MediaItem | null | undefined): boolean {
  const t = (m?.type ?? '').toLowerCase()
  return VIDEO_TYPES.has(t) || VIDEO_EXT_RE.test(String(m?.src ?? ''))
}

/** 类型徽标：IMG / VID / 3D。 */
export function mediaBadge(m: MediaItem | null | undefined): 'IMG' | 'VID' | '3D' {
  if (isVideo(m)) return 'VID'
  if (isModel(m)) return '3D'
  return 'IMG'
}

/**
 * 组装展示列表：cover 未出现在 media 时补为首图。
 * cover 已在 media 中或 media 为空时不重复。
 */
export function normalizeMedia(media: MediaItem[] | null | undefined, cover?: string | null, title?: string): MediaItem[] {
  const list = Array.isArray(media) ? media.filter((m) => m && typeof m === 'object') : []
  if (cover && !list.some((m) => m.src === cover)) {
    return [{ type: 'image', src: cover, alt: title ?? '' }, ...list]
  }
  return list
}
