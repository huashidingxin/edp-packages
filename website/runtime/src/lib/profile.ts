/**
 * 团队人物纯逻辑（node:test 覆盖）。
 *
 * 背景：WP 迁移的人物正文常把「姓名 / 学位 / 擅长领域 / 电话 / 个人简介 /
 * 介绍视频」塞进同一富文本，且混有 Elementor 样式块与裸资源链接。
 * 以下函数只做展示层提取与净化，不改数据。
 */

/** 去标签：HTML → 纯文本（单空格归一；样式块先剔除）。 */
export function stripTags(value: unknown): string {
  return String(value ?? '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * 正文清洗：去掉样式块与裸 mp4 文本链接（已升级为播放器的）。
 * `<video src="…mp4">` 内的地址前是英文引号，不会被误删。
 */
export function cleanBio(value: unknown): string {
  let s = String(value ?? '')
  if (!s) return ''
  s = s.replace(/<style[\s\S]*?<\/style>/gi, '')
  s = s.replace(/(^|[\s>])https?:\/\/[^\s"'<>]+\.mp4(?:#[^\s"'<>]*)?/gi, '$1')
  return s.trim()
}

/** 是否为有效标题：至少 2 个中英文字符，过滤纯数字/符号/单字文件名垃圾。 */
export function isRealTitle(value: unknown): boolean {
  const s = String(value ?? '')
    .trim()
    .replace(/\.(jpe?g|png|webp|gif|bmp)$/i, '')
  if (!s) return false
  return (s.match(/[一-鿿a-zA-Z]/g) ?? []).length >= 2
}

/**
 * 擅长领域摘录：正文 "擅长领域" 之后、电话/简介之前，46 字。
 * 无标记时回退摘要（占位文案按空处理）。
 */
export function expertiseOf(body: unknown, summary: unknown): string {
  const text = stripTags(body)
  const hit = (text.match(/擅长领域[:：\s]*(.{2,120}?)(电话|个人简介|个人信用|$)/)?.[1] ?? '')
    .replace(/[\s|]+/g, ' ')
    .trim()
  if (hit) return hit.slice(0, 46)
  const fallback = String(summary ?? '').trim()
  if (!fallback || fallback.includes('/*! elementor') || fallback.includes('.elementor-widget')) return ''
  return fallback.slice(0, 46)
}

/** 擅长领域拆词：按空白/竖线/顿号切分，最多 8 项。 */
export function expertiseList(body: unknown, summary: unknown): string[] {
  return expertiseOf(body, summary)
    .split(/[\s|、，,;；]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 8)
}

/** 学位 / 职务行：姓名之后、"擅长领域" 之前的头衔文字。 */
export function degreeOf(body: unknown, name: unknown): string {
  const text = stripTags(body)
  const head = (text.split('擅长领域')[0] ?? '').replace(/\s+/g, ' ').trim()
  const nm = String(name ?? '').trim()
  const rest = nm && head.startsWith(nm) ? head.slice(nm.length).trim() : head
  return rest.slice(0, 40)
}

/** 联系电话：正文 "电话" 后的第一组号码。 */
export function phoneOf(body: unknown): string | null {
  const hit = stripTags(body).match(/电话[:：\s]*([0-9][0-9\- ]{6,14}[0-9])/)
  return hit?.[1]?.replace(/\s+/g, '') ?? null
}

/** 人物简介："个人简介" 之后、视频链接之前的正文。 */
export function introOf(body: unknown): string {
  const text = stripTags(body)
  const hit = text.match(/个人简介[:：\s|]*(.{10,400}?)(https?:|$)/)?.[1] ?? ''
  return hit.replace(/[\s|]+/g, ' ').trim().slice(0, 400)
}

/** 视频介绍：正文内第一个 mp4 链接（含 #t= 片段）。 */
export function videoOf(body: unknown): string | null {
  return String(body ?? '').match(/https?:\/\/[^\s"'<>]+\.mp4(?:#[^\s"'<>]*)?/i)?.[0] ?? null
}
