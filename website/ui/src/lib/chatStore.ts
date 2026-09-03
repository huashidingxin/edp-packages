import { reactive, watch } from 'vue'

/**
 * ChatWidget 跨页面共享状态 —— module 级单例 + sessionStorage 持久化。
 *
 * - 同一 tab 内 SPA 路由切换（Nuxt layout 持久）组件不重建，直接共享；
 * - 整页刷新 / 组件重挂载时从 sessionStorage 恢复（open/messages/session/位置/尺寸），
 *   保证刷新不丢状态；
 * - SSR 环境（无 window）返回空的惰性单例，不触碰 storage。
 */

export interface ChatMessage {
  id: number
  type: 'user' | 'ai'
  content: string
  final: boolean
  timestamp: number
}

export interface ChatUiState {
  open: boolean
  position: { x: number; y: number }
  size: { width: number; height: number }
  isLarge: boolean
}

export interface ChatState {
  ui: ChatUiState
  messages: ChatMessage[]
  sessionId: number | null
  visitorId: string
  unread: number
}

const STORAGE_KEY = 'edp:chat:state'
const VISITOR_KEY = 'edp:chat:visitor'

function isClient(): boolean {
  return typeof window !== 'undefined'
}

function load<T>(key: string): T | null {
  try {
    const raw = isClient() ? window.sessionStorage.getItem(key) : null
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function save(key: string, value: unknown): void {
  if (!isClient()) return
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* ignore */
  }
}

function remove(key: string): void {
  if (!isClient()) return
  try {
    window.sessionStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

function defaultState(): ChatState {
  return {
    ui: { open: false, position: { x: 0, y: 0 }, size: { width: 380, height: 600 }, isLarge: false },
    messages: [],
    sessionId: null,
    visitorId: '',
    unread: 0,
  }
}

let singleton: ChatState | null = null

/** 获取共享 chat 状态（module 级单例）。 */
export function useChatState(): ChatState {
  if (singleton) return singleton
  const persisted = load<ChatState>(STORAGE_KEY)
  const state = persisted ?? defaultState()
  // 客户端惰性初始化 visitorId
  if (isClient()) {
    let vid = ''
    try {
      vid = window.localStorage.getItem(VISITOR_KEY) ?? ''
    } catch {
      /* ignore */
    }
    if (!vid) {
      vid = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
      try {
        window.localStorage.setItem(VISITOR_KEY, vid)
      } catch {
        /* ignore */
      }
    }
    state.visitorId = vid
  }
  singleton = reactive(state) as ChatState
  if (isClient()) {
    watch(singleton, () => save(STORAGE_KEY, singleton), { deep: true })
  }
  return singleton
}

/**
 * 悬浮按钮列共享瞬态（不持久化）：
 * backTopVisible 由 WebServiceSidebar 滚动检测写入，WebChatWidget 据此抬高悬浮球让位。
 * 顺序约定：客服（最上）→ 扩展按钮（中）→ 返回顶部（最底贴地）。
 */
const serviceUi = reactive({ backTopVisible: false })

export function useServiceUi(): { backTopVisible: boolean } {
  return serviceUi
}

/** 重置会话（清空消息 / session / unread，保留 ui 布局）。 */
export function resetChatSession(): void {
  const state = useChatState()
  state.messages = []
  state.sessionId = null
  state.unread = 0
  remove(STORAGE_KEY)
  if (isClient()) {
    // 重新持久化（含空消息），避免 UI 布局丢失
    save(STORAGE_KEY, state)
  }
}
