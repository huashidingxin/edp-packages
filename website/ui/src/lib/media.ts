/**
 * 媒体条目 —— 与后端 products/case_studies.media JSON 列契约对齐：
 * { type: 'image'|'video'|'model'|'3d'; src: string; alt?; poster?; thumbnail? }
 * src 既可以是图片、视频，也可以是 glb/gltf 模型 URL。
 * url 作为 src 的兼容别名（站点旧数据可能用 url 命名）。
 */
export interface MediaItem {
  type?: string
  /** 媒体 URL（图片 / 视频 / 模型）。 */
  src?: string
  /** src 的兼容别名。 */
  url?: string
  alt?: string
  /** 视频海报 / 模型未加载时占位图。 */
  poster?: string
  /** 缩略图（缺省回退 src/poster）。 */
  thumbnail?: string
  [key: string]: unknown
}

/** 取媒体 URL（src 优先，兼容 url）。 */
export function mediaSrc(m: MediaItem | null | undefined): string {
  return String(m?.src ?? m?.url ?? '')
}

const MODEL_TYPES = new Set(['model', '3d', 'glb', 'gltf'])
const VIDEO_TYPES = new Set(['video', 'mp4', 'webm', 'ogv', 'mov'])
const MODEL_EXT_RE = /\.(glb|gltf)(\?|$)/i
const VIDEO_EXT_RE = /\.(mp4|webm|ogv|mov)(\?|$)/i

/** 是否为 3D 模型（type=model/3d/glb/gltf 或 src 以 .glb/.gltf 结尾）。 */
export function isModel(m: MediaItem | null | undefined): boolean {
  const t = (m?.type ?? '').toLowerCase()
  return MODEL_TYPES.has(t) || MODEL_EXT_RE.test(mediaSrc(m))
}

/** 是否为视频（type=video 或 src 以常见视频扩展结尾）。 */
export function isVideo(m: MediaItem | null | undefined): boolean {
  const t = (m?.type ?? '').toLowerCase()
  return VIDEO_TYPES.has(t) || VIDEO_EXT_RE.test(mediaSrc(m))
}

/** 类型徽标：IMG / VID / 3D。 */
export function mediaBadge(m: MediaItem | null | undefined): 'IMG' | 'VID' | '3D' {
  if (isVideo(m)) return 'VID'
  if (isModel(m)) return '3D'
  return 'IMG'
}

/** 取缩略图 URL（thumbnail 优先，回退 poster，再回退 src）。 */
export function mediaThumb(m: MediaItem | null | undefined): string {
  return String(m?.thumbnail ?? m?.poster ?? mediaSrc(m))
}

/**
 * 组装展示列表：cover 未出现在 media 时补为首图（image 类型）。
 * cover 已在 media 中或 media 为空时不重复。
 */
export function normalizeMedia(media: MediaItem[] | null | undefined, cover?: string | null, title?: string): MediaItem[] {
  const list = Array.isArray(media) ? media.filter((m) => m && typeof m === 'object') : []
  const srcs = new Set(list.map((m) => mediaSrc(m)).filter(Boolean))
  if (cover && !srcs.has(String(cover))) {
    return [{ type: 'image', src: String(cover), alt: title ?? '' }, ...list]
  }
  return list
}
