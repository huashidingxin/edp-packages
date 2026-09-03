/**
 * /website-ui —— 统一出口。
 *
 * 分层：
 * - api/        数据通道（client / auth / theme / navigation / preview）
 * - contracts/  v2 Site API 类型契约
 * - blocks/     语义组件（Tailwind 实现 + o-* 覆盖钩子；交互行为直接组装 reka-ui 原件）
 * - auth/       会话 store
 * - lib/        纯逻辑工具（cn / nav / form / chat / media / ui 接线常量 …）
 */

// ── api ──────────────────────────────────────────────
export { SiteClient, SiteClientError, KNOWN_FAILURE_STATUS, createSiteClient } from './api/client.ts';
export type { FetchLike, SiteClientOptions, UseSiteClientConfig } from './api/client.ts';
export { AuthError, MockAuthProvider, RemoteAuthProvider, createMemoryAuthStorage } from './api/auth.ts';
export type { AuthProvider, AuthMode, MockAuthStorage } from './api/auth.ts';
export { tokensToCssVariables, resolveStylesheet } from './api/theme.ts';
export { buildRecordBreadcrumb, pickNext, pickPrevious } from './api/navigation.ts';
export { designPreviewTokenForHost } from './api/preview.ts';

// ── contracts ────────────────────────────────────────
export * from './contracts/index.ts';

// ── auth session ─────────────────────────────────────
export { configureSession, useSession } from './auth/session.ts';

// ── lib ──────────────────────────────────────────────
export { cn, blockClass } from './lib/cn.ts';
export { overlayClass, floatingClass } from './lib/ui.ts';
export { isActivePath } from './lib/nav.ts';
export {
  isFieldVisible,
  validateField,
  validateForm,
  buildPayload,
  defaultFor,
  spanClass,
  groupDefaultItems,
  defaultGroupItem,
} from './lib/form.ts';
export type { FormValue, FormValues, FormFile } from './lib/form.ts';
export {
  buildVisitorId,
  parseSseEvent,
  splitSseFrames,
  renderMarkdown,
  formatTime,
  clampWindowToViewport,
} from './lib/chat.ts';
export type { ChatSseEvent } from './lib/chat.ts';
export type { ChatMessage, ChatState, ChatUiState } from './lib/chatStore.ts';
export { useChatState, resetChatSession } from './lib/chatStore.ts';
export { isModel, isVideo, mediaBadge, normalizeMedia } from './lib/media.ts';
export type { MediaItem } from './lib/media.ts';
export { clampIndex, safeNextIndex, safePrevIndex } from './lib/lightbox.ts';
export { SHARE_CHANNELS, COPY_CHANNELS, buildShareUrl } from './lib/share.ts';
export type { ShareChannel } from './lib/share.ts';

// ── blocks ───────────────────────────────────────────
export * from './blocks/index.ts';

// ── strings ──────────────────────────────────────────
export { componentStrings } from './componentStrings.ts';
export type { ComponentStrings } from './componentStrings.ts';
