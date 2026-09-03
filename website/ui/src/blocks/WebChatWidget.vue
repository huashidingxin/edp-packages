<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { AiChatPublicConfig } from '../contracts/index.ts'
import { cn } from '../lib/cn.ts'
import { componentStrings } from '../componentStrings.ts'
import { parseSseEvent, splitSseFrames, renderMarkdown, formatTime, clampWindowToViewport, type ChatSseEvent } from '../lib/chat.ts'
import { useChatState, useServiceUi, type ChatMessage } from '../lib/chatStore.ts'
export type FormT = (source: string, vars?: Record<string, string | number | undefined>) => string

/**
 * 网站智能客服 Widget —— 读 bootstrap `site.ai_chat` 公开配置，
 * 经公开 SSE 端点（/api/v1/ai/chat/stream）多轮对话。
 *
 * - 跨页面共享：状态存 module 级单例（chatStore），Nuxt layout 持久 + sessionStorage 兜底，刷新不丢。
 * - SSR 安全直出：不依赖 ClientOnly，服务端渲染悬浮球，客户端 hydration 无需重挂载，路由切换不闪。
 * - 交互参考旧 DX Customer Service：头部拖拽、角柄/按钮缩放、typing 指示、停止生成、
 *   未读角标、时间戳、头像、在线状态、自动增高输入框、视口钳制、Markdown 渲染。
 */

const props = withDefaults(defineProps<{
  config?: AiChatPublicConfig | null
  t?: FormT
  /** 隐藏悬浮气泡按钮（由 WebServiceSidebar 接管入口） */
  hideBubble?: boolean
  class?: string
}>(), {
  config: null,
  t: undefined,
  hideBubble: false,
  class: '',
})

const t = (source: string, vars?: Record<string, string | number | undefined>): string => {
  if (props.t) return props.t(source, vars)
  if (!vars) return componentStrings.WebChatWidget[source as keyof typeof componentStrings.WebChatWidget] as string ?? source
  const template = componentStrings.WebChatWidget[source as keyof typeof componentStrings.WebChatWidget] as string | undefined
  return (template ?? source).replace(/\{(\w+)\}/g, (m, name: string) => {
    const v = vars[name]
    return v !== undefined ? String(v) : m
  })
}

// ── 共享状态（跨页 + 刷新持久） ──────────────────────────
const store = useChatState()
const messages = computed<ChatMessage[]>(() => store.messages)

// ── 悬浮按钮列瞬态（不持久化）：回顶按钮可见时抬高让位 ────
const serviceUi = useServiceUi()

// ── 派生配置 ────────────────────────────────────────────
const isEnabled = computed(() => Boolean(props.config?.enabled))
const title = computed(() => props.config?.title || componentStrings.WebChatWidget.title)
const welcome = computed(() => props.config?.welcome || componentStrings.WebChatWidget.welcome)
const position = computed(() => (props.config?.position === 'left' ? 'left' : 'right'))
const botAvatar = computed(() => props.config?.bot_avatar || '')
const userAvatar = computed(() => props.config?.user_avatar || '')

// 品牌主色：优先配置 gradient，缺省用站点 primary token（去 AI 蓝默认）
const brandBg = computed(() => {
  const g = props.config?.gradient
  if (g && typeof g.start === 'string' && typeof g.end === 'string') {
    return `linear-gradient(135deg, ${g.start} 0%, ${g.end} 100%)`
  }
  return 'var(--color-primary, #1e3a8a)'
})
const brandSolid = computed(() => 'var(--color-primary, #1e3a8a)')

const SEND_COOLDOWN = 1000
const WINDOW_SIZES = { normal: { width: 380, height: 600 }, large: { width: 760, height: 820 } }

// ── 组件内运行态 ─────────────────────────────────────────
const isGenerating = ref(false)
const isTyping = ref(false)
const inputText = ref('')
const messagesRef = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLTextAreaElement | null>(null)
const windowRef = ref<HTMLElement | null>(null)
const lastSendTime = ref(0)
let abortController: AbortController | null = null
let initialized = false

// 拖拽 / 缩放
const isDragging = ref(false)
const dragStart = ref({ x: 0, y: 0, posX: 0, posY: 0 })
const isResizing = ref(false)
const resizeStart = ref({ x: 0, y: 0, w: 0, h: 0 })

const size = computed(() => {
  if (store.ui.isLarge) return WINDOW_SIZES.large
  return store.ui.size
})

function isClient(): boolean {
  return typeof window !== 'undefined'
}

const windowStyle = computed(() => {
  const vw = isClient() ? window.innerWidth : 1024
  const vh = isClient() ? window.innerHeight : 768
  const w = Math.min(vw - 40, size.value.width)
  const h = Math.min(vh - 120, size.value.height)
  const base = {
    width: `${w}px`,
    height: `${h}px`,
    transition: isDragging.value || isResizing.value ? 'none' : undefined,
  } as Record<string, string | undefined>
  if (store.ui.position.x !== 0 || store.ui.position.y !== 0) {
    base.transform = `translate3d(${store.ui.position.x}px, ${store.ui.position.y}px, 0)`
  }
  return base
})

// ── 消息渲染 ──────────────────────────────────────────────
const markdownHtml = (content: string) => renderMarkdown(content)

function scrollToBottom() {
  nextTick(() => {
    if (messagesRef.value) messagesRef.value.scrollTop = messagesRef.value.scrollHeight
  })
}

watch(messages, () => scrollToBottom(), { deep: true })

function addMessage(type: 'user' | 'ai', content: string, final = true): ChatMessage {
  const msg: ChatMessage = { id: Date.now() + Math.random(), type, content, final, timestamp: Date.now() }
  store.messages.push(msg)
  scrollToBottom()
  return msg
}

function updateMessage(id: number, content: string) {
  const msg = store.messages.find((m) => m.id === id)
  if (msg) msg.content = content
}

function ensureWelcome() {
  if (store.messages.length === 0) addMessage('ai', welcome.value, true)
}

// ── 开关 / 未读 ───────────────────────────────────────────
function toggleChat() {
  store.ui.open = !store.ui.open
  if (store.ui.open) {
    ensureWelcome()
    store.unread = 0
    scrollToBottom()
  }
}

// ── 发送 / SSE ────────────────────────────────────────────
async function sendMessage() {
  const text = inputText.value.trim()
  if (!text || isGenerating.value) return

  const now = Date.now()
  if (now - lastSendTime.value < SEND_COOLDOWN) return
  lastSendTime.value = now

  if (abortController) abortController.abort()

  addMessage('user', text)
  inputText.value = ''
  autoResizeTextarea()
  if (!store.ui.open) store.unread++

  if (!props.config?.endpoint) {
    error(t('ChatWidget.error'))
    return
  }

  isGenerating.value = true
  isTyping.value = true

  const host = isClient() ? window.location.hostname : ''
  const url = `${props.config.endpoint}?host=${encodeURIComponent(host)}`
  abortController = new AbortController()

  let aiMessage: ChatMessage | null = null
  let aiContent = ''

  const handleEvent = (event: ChatSseEvent) => {
    switch (event.type) {
      case 'start':
        store.sessionId = event.session_id ?? null
        break
      case 'chunk':
        if (event.content) {
          if (!aiMessage) {
            aiMessage = addMessage('ai', '', false)
          }
          aiContent += event.content
          updateMessage(aiMessage.id, aiContent)
          scrollToBottom()
        }
        break
      case 'end':
        isGenerating.value = false
        isTyping.value = false
        store.sessionId = event.session_id ?? store.sessionId
        if (aiMessage) {
          aiMessage.final = true
          if (!store.ui.open) store.unread++
        }
        break
      case 'error':
        isGenerating.value = false
        isTyping.value = false
        if (aiMessage) {
          aiMessage.final = true
          aiMessage.content += `\n\n⚠️ ${event.message || t('ChatWidget.error')}`
        } else {
          error(event.message || t('ChatWidget.error'))
        }
        break
    }
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: abortController.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        visitor_id: store.visitorId,
        session_id: store.sessionId ?? undefined,
      }),
    })

    if (!res.ok) {
      let serverError = t('ChatWidget.error')
      try {
        const body = (await res.json()) as { message?: string }
        if (body.message) serverError = body.message
      } catch {
        /* ignore */
      }
      throw new Error(serverError)
    }
    if (!res.body) throw new Error(t('ChatWidget.error'))

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const frames = splitSseFrames(buffer)
      buffer = frames.pop() ?? ''
      for (const frame of frames) {
        const event = parseSseEvent(frame)
        if (event) handleEvent(event)
      }
    }
    const tail = parseSseEvent(buffer)
    if (tail) handleEvent(tail)

    if (!aiMessage) {
      isGenerating.value = false
      isTyping.value = false
      error(t('ChatWidget.error'))
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      const last = store.messages[store.messages.length - 1]
      if (last && last.type === 'ai' && !last.final) last.final = true
    } else {
      error(e instanceof Error && e.message ? e.message : t('ChatWidget.error'))
    }
  } finally {
    abortController = null
  }
}

function error(message: string) {
  isGenerating.value = false
  isTyping.value = false
  addMessage('ai', message, true)
}

function stopGeneration() {
  if (!isGenerating.value || !abortController) return
  abortController.abort()
  abortController = null
  isGenerating.value = false
  isTyping.value = false
  const last = store.messages[store.messages.length - 1]
  if (last && last.type === 'ai' && !last.final) last.final = true
}

// ── 输入框 ────────────────────────────────────────────────
function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendMessage()
  }
}

function autoResizeTextarea() {
  if (!inputRef.value) return
  const el = inputRef.value
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, 105)}px`
}

// ── 拖拽 ──────────────────────────────────────────────────
function startDrag(e: MouseEvent) {
  if ((e.target as HTMLElement).closest('.cw-btn')) return
  if (!store.ui.open) return
  isDragging.value = true
  dragStart.value = { x: e.clientX, y: e.clientY, posX: store.ui.position.x, posY: store.ui.position.y }

  const move = (ev: MouseEvent) => {
    if (!isDragging.value) return
    store.ui.position.x = dragStart.value.posX + ev.clientX - dragStart.value.x
    store.ui.position.y = dragStart.value.posY + ev.clientY - dragStart.value.y
  }
  const up = () => {
    isDragging.value = false
    document.removeEventListener('mousemove', move)
    document.removeEventListener('mouseup', up)
  }
  document.addEventListener('mousemove', move)
  document.addEventListener('mouseup', up)
  e.preventDefault()
}

// ── 缩放（角柄自由缩放 + 按钮大小切换） ───────────────────
function startResize(e: MouseEvent) {
  e.preventDefault()
  e.stopPropagation()
  isResizing.value = true
  resizeStart.value = { x: e.clientX, y: e.clientY, w: size.value.width, h: size.value.height }

  const move = (ev: MouseEvent) => {
    if (!isResizing.value) return
    const w = Math.max(300, resizeStart.value.w + ev.clientX - resizeStart.value.x)
    const h = Math.max(400, resizeStart.value.h + ev.clientY - resizeStart.value.y)
    store.ui.size = { width: w, height: h }
    store.ui.isLarge = false
  }
  const up = () => {
    isResizing.value = false
    document.removeEventListener('mousemove', move)
    document.removeEventListener('mouseup', up)
  }
  document.addEventListener('mousemove', move)
  document.addEventListener('mouseup', up)
}

function toggleSize() {
  store.ui.isLarge = !store.ui.isLarge
  nextTick(() => adjustWindowPosition())
}

function adjustWindowPosition() {
  const el = windowRef.value
  if (!el || !isClient()) return
  const rect = el.getBoundingClientRect()
  const { left, top } = clampWindowToViewport(
    { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
    { width: window.innerWidth, height: window.innerHeight },
  )
  if (left !== rect.left || top !== rect.top) {
    store.ui.position.x += left - rect.left
    store.ui.position.y += top - rect.top
  }
}

// ── 生命周期 ──────────────────────────────────────────────
onMounted(() => {
  if (!isEnabled.value) return
  if (initialized) return
  initialized = true
  scrollToBottom()
  window.addEventListener('resize', adjustWindowPosition)
  ensureWelcome()
})

onBeforeUnmount(() => {
  if (isClient()) window.removeEventListener('resize', adjustWindowPosition)
})
</script>

<template>
  <div
    :class="cn('web-chat-widget fixed z-50 transition-[bottom] duration-300', position === 'left' ? 'left-6' : 'right-6', $props.class)"
    :style="{
      /* 回顶按钮出现时抬高悬浮球让位（顺序：客服最上 → 扩展 → 回顶最底） */
      bottom: serviceUi.backTopVisible
        ? 'var(--web-chat-ball-raise, 5.75rem)'
        : 'var(--web-chat-ball-bottom, 1.5rem)',
    }"
  >
    <!-- 聊天窗口 -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 translate-y-3 scale-95"
      leave-active-class="transition duration-150 ease-in"
      leave-to-class="opacity-0 translate-y-3 scale-95"
    >
      <div
        v-if="store.ui.open"
        ref="windowRef"
        role="dialog"
        aria-label="ChatWidget.panelLabel"
        :style="windowStyle"
        :class="[
          'absolute bottom-[76px] flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl',
          position === 'left' ? 'left-0' : 'right-0',
        ]"
      >
        <!-- 头部：可拖拽 -->
        <div
          class="flex cursor-move select-none items-center gap-3 px-4 py-3 text-white"
          :style="{ background: brandBg }"
          @mousedown="startDrag"
        >
          <img
            v-if="botAvatar"
            :src="botAvatar"
            :alt="title"
            class="size-9 rounded-full bg-white/20 object-cover"
          />
          <div v-else class="flex size-9 items-center justify-center rounded-full bg-white/20">
            <svg class="size-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold">{{ title }}</p>
            <p class="flex items-center gap-1 text-xs opacity-85">
              <span class="inline-block size-1.5 rounded-full bg-white" />
              {{ t('ChatWidget.online') }}
            </p>
          </div>
          <div class="flex items-center gap-0.5">
            <button
              type="button"
              class="cw-btn flex size-8 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/20 hover:text-white"
              :title="store.ui.isLarge ? t('ChatWidget.shrink') : t('ChatWidget.enlarge')"
              :aria-label="store.ui.isLarge ? t('ChatWidget.shrink') : t('ChatWidget.enlarge')"
              @click.stop="toggleSize"
            >
              <svg v-if="!store.ui.isLarge" class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>
              <svg v-else class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 15h14"/><path d="M5 9h14"/></svg>
            </button>
            <button
              type="button"
              class="cw-btn flex size-8 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/20 hover:text-white"
              :aria-label="t('ChatWidget.close')"
              @click.stop="store.ui.open = false"
            >
              <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>
        </div>

        <!-- 消息区 -->
        <div ref="messagesRef" class="flex-1 space-y-3 overflow-y-auto bg-muted/30 px-4 py-4">
          <div
            v-for="(msg, i) in messages"
            :key="msg.id"
            :class="['flex w-full', msg.type === 'user' ? 'justify-end' : 'justify-start']"
          >
            <div :class="['flex max-w-[85%] gap-2', msg.type === 'user' ? 'flex-row-reverse' : '']">
              <img
                v-if="msg.type === 'user' && userAvatar"
                :src="userAvatar"
                :alt="t('ChatWidget.user')"
                class="mt-1 size-6 shrink-0 rounded-full object-cover"
              />
              <div class="flex min-w-0 flex-col">
                <div
                  :class="[
                    'rounded-2xl px-3.5 py-2 text-sm leading-relaxed shadow-sm',
                    msg.type === 'user'
                      ? 'rounded-br-sm bg-primary text-primary-foreground'
                      : 'rounded-bl-sm border border-border/60 bg-card text-foreground',
                  ]"
                >
                  <template v-if="msg.content">
                    <span v-if="msg.type === 'user'" class="whitespace-pre-wrap">{{ msg.content }}</span>
                    <div v-else class="cw-md" v-html="markdownHtml(msg.content)" />
                  </template>
                  <template v-else>
                    <span class="inline-flex gap-1 py-0.5">
                      <span class="cw-dot size-1.5 rounded-full bg-current" />
                      <span class="cw-dot size-1.5 rounded-full bg-current" style="animation-delay: 120ms" />
                      <span class="cw-dot size-1.5 rounded-full bg-current" style="animation-delay: 240ms" />
                    </span>
                  </template>
                </div>
                <span :class="['mt-1 text-[11px] text-muted-foreground', msg.type === 'user' ? 'text-right' : '']">
                  {{ formatTime(msg.timestamp) }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- 输入区 -->
        <form class="flex items-end gap-2 border-t border-border bg-card px-3 py-2.5" @submit.prevent="sendMessage">
          <div class="relative flex-1">
            <textarea
              ref="inputRef"
              v-model="inputText"
              rows="1"
              class="cw-input block max-h-[105px] w-full resize-none rounded-2xl border border-input bg-background py-2.5 pl-4 pr-12 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-1"
              :placeholder="t('ChatWidget.placeholder')"
              :aria-label="t('ChatWidget.placeholder')"
              :disabled="isGenerating"
              @keydown="handleKeyDown"
              @input="autoResizeTextarea"
            />
            <button
              v-if="!isGenerating"
              type="submit"
              :disabled="!inputText.trim()"
              :aria-label="t('ChatWidget.send')"
              :style="{ background: brandBg }"
              class="cw-btn absolute bottom-2 right-2 flex size-8 items-center justify-center rounded-full text-white shadow-md transition-all hover:scale-105 hover:shadow-lg disabled:opacity-40 disabled:hover:scale-100"
            >
              <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
            </button>
            <button
              v-else
              type="button"
              :aria-label="t('ChatWidget.stop')"
              class="cw-btn absolute bottom-2 right-2 flex size-8 items-center justify-center rounded-full bg-muted-foreground text-white shadow-md transition-transform hover:scale-105"
              @click="stopGeneration"
            >
              <svg class="size-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 6h12v12H6z"/></svg>
            </button>
          </div>
        </form>

        <!-- 角柄：自由缩放 -->
        <div
          class="cw-resize-handle absolute bottom-1 right-1 size-4 cursor-se-resize"
          :title="t('ChatWidget.resize')"
          @mousedown="startResize"
        >
          <svg class="size-3 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21 15-6 6"/><path d="m21 9-12 12"/><path d="m21 3-18 18"/></svg>
        </div>
      </div>
    </Transition>

    <!-- 悬浮球（hideBubble 时由 WebServiceSidebar 接管） -->
    <button
      v-if="isEnabled && !hideBubble"
      type="button"
      :aria-label="t(store.ui.open ? 'ChatWidget.close' : 'ChatWidget.open')"
      :style="{ background: brandBg }"
      :class="cn(
        'cw-btn relative flex size-14 items-center justify-center rounded-full text-white shadow-lg shadow-primary/20 transition-all hover:scale-105 hover:shadow-xl',
        store.ui.open ? 'rotate-90' : '',
      )"
      @click="toggleChat"
    >
      <svg v-if="!store.ui.open" class="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
        <path d="M8 12h.01" /><path d="M12 12h.01" /><path d="M16 12h.01" />
      </svg>
      <svg v-else class="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
      <span
        v-if="store.unread > 0 && !store.ui.open"
        class="absolute -right-0.5 -top-0.5 flex min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white ring-2 ring-background"
      >
        {{ store.unread > 99 ? '99+' : store.unread }}
      </span>
    </button>
  </div>
</template>

<style scoped>
.cw-dot {
  animation: cw-dot-bounce 1s infinite ease-in-out;
}
@keyframes cw-dot-bounce {
  0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
  40% { opacity: 1; transform: scale(1); }
}
.cw-messages::-webkit-scrollbar {
  width: 6px;
}
.cw-messages::-webkit-scrollbar-track {
  background: transparent;
}
.cw-messages::-webkit-scrollbar-thumb {
  background: var(--color-border, #e2e8f0);
  border-radius: 3px;
}
.cw-md :deep(p) {
  margin: 6px 0;
}
.cw-md :deep(p:first-child) {
  margin-top: 0;
}
.cw-md :deep(p:last-child) {
  margin-bottom: 0;
}
.cw-md :deep(h1),
.cw-md :deep(h2),
.cw-md :deep(h3),
.cw-md :deep(h4) {
  font-size: 1em;
  font-weight: 700;
  margin: 8px 0 4px;
}
.cw-md :deep(ul),
.cw-md :deep(ol) {
  margin: 6px 0;
  padding-left: 20px;
  list-style: disc;
}
.cw-md :deep(ol) {
  list-style: decimal;
}
.cw-md :deep(pre) {
  margin: 8px 0;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--color-muted, #f1f5f9);
  overflow-x: auto;
  font-size: 12px;
}
.cw-md :deep(code) {
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--color-muted, #f1f5f9);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.9em;
}
.cw-md :deep(pre code) {
  padding: 0;
  background: none;
}
.cw-md :deep(blockquote) {
  margin: 8px 0;
  padding-left: 10px;
  border-left: 3px solid var(--color-border, #e2e8f0);
  color: var(--color-muted-foreground);
}
.cw-md :deep(a) {
  color: var(--color-primary);
  text-decoration: underline;
}
.cw-md :deep(img) {
  max-width: 100%;
  border-radius: 8px;
  margin: 8px 0;
}
</style>
