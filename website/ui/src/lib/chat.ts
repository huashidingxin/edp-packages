/**
 * 智能客服 Widget 纯逻辑：visitor_id、SSE 分帧与事件解析。
 *
 * 后端协议（ChatController / AiService）：
 * - 端点 GET|POST /api/v1/ai/chat/stream?host=&message=&visitor_id=&session_id=
 * - 事件 `data: {...}`，类型 start（session_id）/ chunk（content）/ end（session_id）/ error（code/message）
 */

export interface ChatSseEvent {
  type: 'start' | 'chunk' | 'end' | 'error'
  session_id?: number
  content?: string
  code?: string
  message?: string
}

const STORAGE_KEY = 'edp:chat:visitor'

function randomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * 生成 / 复用当前浏览器访客 ID（localStorage 持久化，跨会话延续）。
 * SSR 环境（无 window）返回空字符串，由调用方仅在客户端获取。
 */
export function buildVisitorId(): string {
  if (typeof window === 'undefined') return ''
  try {
    const existing = window.localStorage.getItem(STORAGE_KEY)
    if (existing) return existing
    const id = randomId()
    window.localStorage.setItem(STORAGE_KEY, id)
    return id
  } catch {
    return randomId()
  }
}

/** 重置访客 ID（用于测试）。 */
export function resetVisitorIdStorage(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

/**
 * 将累积的 SSE 文本按空行分帧（兼容 \r\n / \n），返回完整帧数组。
 * 帧之间可能被 fetch reader 切分，由调用方维护累积 buffer。
 */
export function splitSseFrames(raw: string): string[] {
  if (!raw) return []
  return raw
    .replace(/\r\n/g, '\n')
    .split('\n\n')
    .map((f) => f.trim())
    .filter((f) => f !== '')
}

/**
 * 解析单个 SSE 帧（形如 `data: {json}`），返回事件对象；非 data 帧返回 null。
 * JSON 解析失败或结构无效返回 null（容错跳过）。
 */
export function parseSseEvent(frame: string): ChatSseEvent | null {
  if (!frame) return null
  const dataLine = frame
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.startsWith('data:'))
  if (!dataLine) return null
  const payload = dataLine.slice(5).trim()
  if (payload === '' || payload === '[DONE]') return null
  try {
    const json = JSON.parse(payload) as Partial<ChatSseEvent>
    if (json && typeof json.type === 'string' && ['start', 'chunk', 'end', 'error'].includes(json.type)) {
      return json as ChatSseEvent
    }
    return null
  } catch {
    return null
  }
}

/** 生成会话内自增 / 时间戳消息 id（客户端）。 */
export function nextMessageId(): number {
  return Date.now()
}

/** 消息时间 HH:MM。 */
export function formatTime(timestamp: number): string {
  const d = new Date(timestamp)
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function safeUrl(url: string): string {
  const trimmed = url.trim()
  if (/^(https?:|mailto:|\/|#)/i.test(trimmed)) return trimmed
  return '#'
}

function renderInline(src: string): string {
  const escaped = escapeHtml(src)
  return escaped
    .replace(/`([^`]+)`/g, (_, code: string) => `<code>${code!}</code>`)
    .replace(/\*\*([^*]+)\*\*/g, (_, text: string) => `<strong>${text!}</strong>`)
    .replace(/(^|\s)\*([^*\s][^*]*?)\*(?=\s|$)/g, '$1<em>$2</em>')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt: string, url: string) => `<img src="${safeUrl(url!)}" alt="${alt!}" loading="lazy" />`)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text: string, url: string) => `<a href="${safeUrl(url!)}" target="_blank" rel="noopener">${text!}</a>`)
}

/**
 * 轻量 Markdown → HTML（客服消息渲染，不引入重依赖）。
 * 支持：标题 / 粗体 / 斜体 / 行内代码 / 代码块 / 无序列表 / 有序列表 / 引用 / 链接 / 图片 / 换行。
 * 输出已做 HTML 转义与 URL 白名单，防 XSS。
 */
export function renderMarkdown(src: string): string {
  if (!src) return ''
  const lines = src.replace(/\r\n/g, '\n').split('\n')
  const out: string[] = []
  let listType: 'ul' | 'ol' | null = null
  let codeBlock = false
  let codeBuf: string[] = []
  let quote = false
  let para: string[] = []

  const flushPara = () => {
    if (para.length > 0) {
      out.push(`<p>${renderInline(para.join(' '))}</p>`)
      para = []
    }
  }
  const flushList = () => {
    if (listType) {
      out.push(`</${listType}>`)
      listType = null
    }
  }

  for (const line of lines) {
    // fenced code block
    if (/^```/.test(line.trim())) {
      flushPara()
      flushList()
      if (codeBlock) {
        out.push(`<pre><code>${escapeHtml(codeBuf.join('\n'))}</code></pre>`)
        codeBuf = []
        codeBlock = false
      } else {
        codeBlock = true
      }
      continue
    }
    if (codeBlock) {
      codeBuf.push(line)
      continue
    }
    if (line.trim() === '') {
      flushPara()
      flushList()
      continue
    }
    // headings
    const heading = /^(#{1,4})\s+(.*)$/.exec(line.trim())
    if (heading) {
      flushPara()
      flushList()
      const level = heading[1]!.length
      out.push(`<h${level}>${renderInline(heading[2]!)}</h${level}>`)
      continue
    }
    // blockquote
    const bq = /^>\s?(.*)$/.exec(line.trim())
    if (bq) {
      flushPara()
      flushList()
      out.push(`<blockquote>${renderInline(bq[1]!)}</blockquote>`)
      continue
    }
    // unordered list
    const ul = /^[-*]\s+(.*)$/.exec(line.trim())
    if (ul) {
      flushPara()
      if (listType !== 'ul') {
        flushList()
        out.push('<ul>')
        listType = 'ul'
      }
      out.push(`<li>${renderInline(ul[1]!)}</li>`)
      continue
    }
    // ordered list
    const ol = /^\d+\.\s+(.*)$/.exec(line.trim())
    if (ol) {
      flushPara()
      if (listType !== 'ol') {
        flushList()
        out.push('<ol>')
        listType = 'ol'
      }
      out.push(`<li>${renderInline(ol[1]!)}</li>`)
      continue
    }
    // paragraph accumulation
    flushList()
    para.push(line.trim())
  }
  if (codeBlock) {
    out.push(`<pre><code>${escapeHtml(codeBuf.join('\n'))}</code></pre>`)
  }
  flushPara()
  flushList()
  return out.join('\n')
}

/** 窗口在视口内的钳制（拖拽/缩放后不越界），返回修正后的 top/left。 */
export function clampWindowToViewport(
  rect: { left: number; top: number; width: number; height: number },
  viewport: { width: number; height: number },
  margin = 12,
): { left: number; top: number } {
  let left = rect.left
  let top = rect.top
  if (left < margin) left = margin
  if (top < margin) top = margin
  if (left + rect.width > viewport.width - margin) {
    left = Math.max(margin, viewport.width - rect.width - margin)
  }
  if (top + rect.height > viewport.height - margin) {
    top = Math.max(margin, viewport.height - rect.height - margin)
  }
  return { left, top }
}
