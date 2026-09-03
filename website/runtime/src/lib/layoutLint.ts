/**
 * 本地 layout 自引用检测（纯函数，node:test 覆盖）。
 *
 * 背景：runtime 公共 layout 仅在站点**无**本地 `layouts/default.vue` 时注册。
 * 本地 layout 内再渲染 `<NuxtLayout>` 会解析回「当前激活 layout」（即它自身），
 * 形成自递归 —— 症状是 dev server 收到首个页面请求后 100% CPU、页面永不响应。
 * 历史事故：shouchuangmoju 本地 default.vue 内渲染 `<NuxtLayout>` 试图「继承」
 * 公共 layout，导致 dev server 死锁（2026-08）。本检测把这类坑前置到构建输出。
 *
 * 归类规则：
 * - `self`  —— 必死循环：无 name（渲染当前激活 layout = 自身）或 name 指向本文件；
 * - `nested` —— 嵌套渲染其它具名 layout（非自递归，但通常是「想继承公共 layout」的误用）。
 */

export interface LayoutNuxtLayoutFinding {
  /** layouts/ 下的文件名 */
  file: string
  /** self = 无限递归；nested = 嵌套渲染其它 layout */
  kind: 'self' | 'nested'
  /** 命中片段（用于日志定位） */
  snippet: string
}

/** 提取 SFC 根 <template> 块：首个 `<template` 开 → 最后一个 `</template>` 闭。 */
export function extractVueTemplate(source: string): string {
  const open = source.indexOf('<template')
  const close = source.lastIndexOf('</template>')
  if (open === -1 || close === -1 || close <= open) return ''
  return source.slice(open, close + '</template>'.length)
}

/** 去除 HTML 注释 —— 被注释掉的 <NuxtLayout> 不应误报。 */
function stripHtmlComments(source: string): string {
  return source.replace(/<!--[\s\S]*?-->/g, '')
}

/** 扫描各 layout 的模板中 <NuxtLayout> 用法并归类（NuxtLayoutFoo / nuxt-layout-xxx 不误命中）。 */
export function findLayoutNuxtLayoutUsage(files: Record<string, string>): LayoutNuxtLayoutFinding[] {
  const findings: LayoutNuxtLayoutFinding[] = []
  for (const [file, source] of Object.entries(files)) {
    const template = stripHtmlComments(extractVueTemplate(source))
    if (!template) continue
    // 结束边界用前瞻限定：后随空白 / '>' / '/'（自闭合），避免误匹配同名前缀组件
    for (const match of template.matchAll(/<(?:NuxtLayout|nuxt-layout)(?=[\s/>])([^>]*?)(?:\/>|>)/g)) {
      const attrs = match[1] ?? ''
      const nameAttr = /\bname\s*=\s*(?:"([^"]*)"|'([^']*)')/.exec(attrs)
      const name = nameAttr?.[1] ?? nameAttr?.[2]
      const stem = file.replace(/\.vue$/, '')
      findings.push({ file, kind: !name || name === stem ? 'self' : 'nested', snippet: match[0] })
    }
  }
  return findings
}
