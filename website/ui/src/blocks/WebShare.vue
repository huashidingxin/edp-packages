<script setup lang="ts">
/**
 * WebShare —— "分享到"渠道按钮条 + 微信扫码弹窗。
 *
 * - 渠道可配置：channels 缺省 ['weibo','qq','wechat','qzone','douban','linkedin']，含 'copy'（复制链接）；
 * - 图标走 Iconify 离线子集（src/lib/share-icons.ts，构建期抽取，无运行时 API 依赖）；#icon 插槽可整体替换；
 * - 微信：桌面端无分享入口，改为锚定按钮上方的 Popover 二维码（本地生成，随主题色），
 *   点击气泡外任意处 / Esc 即关（reka-ui Popover 默认 dismissable）；
 * - 文案零硬编码：默认值登记 componentStrings.WebShare；
 * - SSR 安全：分享 URL / 二维码都在点击时才取（window / 纯 JS 编码）。
 */
import { computed, ref } from 'vue'
import { addCollection, Icon } from '@iconify/vue'
import {
  PopoverArrow,
  PopoverContent,
  PopoverPortal,
  PopoverRoot,
  PopoverTrigger,
} from 'reka-ui'
import { componentStrings } from '../componentStrings.ts'
import { floatingClass } from '../lib/ui.ts'
import { qrSvg, type QrSvg } from '../lib/qr.ts'
import { shareIconSet } from '../lib/share-icons.ts'

addCollection(shareIconSet)

const props = withDefaults(
  defineProps<{
    /** 分享目标链接；缺省取当前页地址。 */
    url?: string | null
    /** 分享文案标题。 */
    title?: string | null
    /** 分享文案摘要（可选）。 */
    summary?: string | null
    /** 渠道列表：weibo / qq / wechat / qzone / douban / linkedin / copy。 */
    channels?: string[] | null
  }>(),
  { url: null, title: null, summary: null, channels: null },
)

type ChannelBrand = { color: string; label: string; icon: string }

const BRANDS: Record<string, ChannelBrand> = {
  weibo: { color: '#e6162d', label: componentStrings.WebShare.weibo, icon: 'web-share:sinaweibo' },
  qq: { color: '#12b7f5', label: componentStrings.WebShare.qq, icon: 'web-share:tencentqq' },
  wechat: { color: '#09b83e', label: componentStrings.WebShare.wechat, icon: 'web-share:wechat' },
  qzone: { color: '#fbbc0d', label: componentStrings.WebShare.qzone, icon: 'web-share:qzone' },
  douban: { color: '#2e9e74', label: componentStrings.WebShare.douban, icon: 'web-share:douban' },
  linkedin: { color: '#0a66c2', label: componentStrings.WebShare.linkedin, icon: 'web-share:linkedin' },
  copy: { color: '#64748b', label: componentStrings.WebShare.copyLink, icon: 'web-share:link' },
}

const channels = computed<string[]>(() =>
  (props.channels?.length ? props.channels : ['weibo', 'qq', 'wechat', 'qzone', 'douban', 'linkedin']),
)

const copied = ref(false)
let copiedTimer: ReturnType<typeof setTimeout> | undefined

/* 微信扫码弹层状态：点击时才取 URL 并本地生成二维码 */
const qrOpen = ref(false)
const qrUrl = ref('')
const qr = ref<QrSvg | null>(null)

function currentUrl(): string {
  return props.url ?? (typeof window !== 'undefined' ? window.location.href : '')
}
function shareText(): string {
  return [props.title, props.summary].filter(Boolean).join(' ')
}

async function copyLink(): Promise<void> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(currentUrl())
    }
  } catch {
    /* 剪贴板不可用时静默失败（如非安全上下文） */
  }
  copied.value = true
  if (copiedTimer) clearTimeout(copiedTimer)
  copiedTimer = setTimeout(() => (copied.value = false), 1600)
}

function openShare(u: string): void {
  if (typeof window !== 'undefined') window.open(u, '_blank', 'noopener,width=700,height=560')
}

/** 微信气泡展开时现算二维码（URL 取当前页，SSR 不触碰 window）。 */
function onWechatOpen(open: boolean): void {
  qrOpen.value = open
  if (!open) return
  qrUrl.value = currentUrl()
  qr.value = qrSvg(qrUrl.value)
}

function onClick(ch: string): void {
  const u = encodeURIComponent(currentUrl())
  const t = encodeURIComponent(shareText())
  if (ch === 'copy') return void copyLink()
  if (ch === 'weibo') return openShare(`https://service.weibo.com/share/share.php?url=${u}&title=${t}`)
  if (ch === 'qq') return openShare(`https://connect.qq.com/widget/shareqq/index.html?url=${u}&title=${t}`)
  if (ch === 'qzone') return openShare(`https://sns.qzone.qq.com/cgi-bin/qzshare/cgi_qzshare_onekey?url=${u}&title=${t}`)
  if (ch === 'douban') return openShare(`https://www.douban.com/share/service?url=${u}&title=${t}`)
  if (ch === 'linkedin') return openShare(`https://www.linkedin.com/sharing/share-offsite/?url=${u}`)
}

const labelOf = (ch: string): string => BRANDS[ch]?.label ?? ch
const colorOf = (ch: string): string => BRANDS[ch]?.color ?? '#64748b'
const iconOf = (ch: string): string => BRANDS[ch]?.icon ?? 'web-share:link'
</script>

<template>
  <div class="web-share">
    <div class="web-share__head">
      <Icon icon="web-share:share-2" class="web-share__head-icon" aria-hidden="true" />
      <span class="web-share__label">{{ componentStrings.WebShare.label }}</span>
      <Transition name="web-share-fade">
        <span v-if="copied" class="web-share__copied">
          <Icon icon="web-share:check" width="13" height="13" aria-hidden="true" />
          {{ componentStrings.WebShare.copied }}
        </span>
      </Transition>
    </div>

    <div class="web-share__row">
      <template v-for="ch in channels" :key="ch">
        <!-- 微信：气泡锚在按钮上方（side="top"），点击外部 / Esc 即关 -->
        <PopoverRoot v-if="ch === 'wechat'" :open="qrOpen" @update:open="onWechatOpen">
          <PopoverTrigger as-child>
            <button
              type="button"
              class="web-share__btn"
              :style="{ '--web-share-color': colorOf(ch) }"
              :title="labelOf(ch)"
              :aria-label="labelOf(ch)"
            >
              <slot name="icon" :channel="ch" :label="labelOf(ch)">
                <Icon :icon="iconOf(ch)" width="18" height="18" aria-hidden="true" />
              </slot>
            </button>
          </PopoverTrigger>
          <PopoverPortal>
            <PopoverContent
              side="top"
              :side-offset="10"
              :collision-padding="12"
              :class="floatingClass"
            >
              <div class="web-share__pop w-56 rounded-card border border-border bg-popover p-4 text-center shadow-pop">
                <p class="flex items-center justify-center gap-1.5 font-display text-sm font-semibold text-foreground">
                  <Icon icon="web-share:qr-code" width="15" height="15" class="text-primary" aria-hidden="true" />
                  {{ componentStrings.WebShare.wechatTitle }}
                </p>
                <p class="mt-1 text-xs text-muted-foreground">{{ componentStrings.WebShare.wechatHint }}</p>

                <!-- 白底衬纸保证扫码对比度；currentColor 跟随前景色 -->
                <div class="mt-3 inline-block rounded-xl border border-border bg-white p-2.5 text-foreground">
                  <svg
                    v-if="qr"
                    :viewBox="`0 0 ${qr.size} ${qr.size}`"
                    class="size-40"
                    role="img"
                    :aria-label="qrUrl"
                    shape-rendering="crispEdges"
                  >
                    <path :d="qr.d" fill="currentColor" />
                  </svg>
                </div>
                <p class="mt-2.5 break-all text-[11px] leading-relaxed text-muted-foreground">{{ qrUrl }}</p>
              </div>
              <PopoverArrow class="fill-popover" :width="14" :height="7" />
            </PopoverContent>
          </PopoverPortal>
        </PopoverRoot>

        <button
          v-else
          type="button"
          class="web-share__btn"
          :style="{ '--web-share-color': colorOf(ch) }"
          :title="labelOf(ch)"
          :aria-label="labelOf(ch)"
          @click="onClick(ch)"
        >
          <slot name="icon" :channel="ch" :label="labelOf(ch)">
            <Icon :icon="iconOf(ch)" width="18" height="18" aria-hidden="true" />
          </slot>
        </button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.web-share__head {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-foreground);
}
.web-share__head-icon {
  width: 18px;
  height: 18px;
  color: var(--color-primary);
}
.web-share__row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 14px;
}
.web-share__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-card);
  color: var(--web-share-color, var(--color-muted-foreground));
  cursor: pointer;
  transition:
    background-color 0.25s,
    color 0.25s,
    border-color 0.25s,
    transform 0.2s,
    box-shadow 0.25s;
}
.web-share__btn:hover {
  background: var(--web-share-color, var(--color-muted-foreground));
  border-color: var(--web-share-color, var(--color-muted-foreground));
  color: #fff;
  transform: translateY(-2px);
  box-shadow: 0 8px 18px rgb(0 0 0 / 0.12);
}
.web-share__btn:active {
  transform: translateY(0) scale(0.96);
}
.web-share__btn:focus-visible {
  outline: 2px solid var(--color-ring);
  outline-offset: 2px;
}
/* 气泡入场：轻微上浮 + 淡入，尊重 prefers-reduced-motion */
.web-share__pop[data-state='open'] {
  animation: web-share-pop-in 0.18s var(--web-motion-ease, cubic-bezier(0.22, 1, 0.36, 1));
}
@keyframes web-share-pop-in {
  from {
    opacity: 0;
    transform: translateY(4px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
@media (prefers-reduced-motion: reduce) {
  .web-share__pop[data-state='open'] {
    animation: none;
  }
}
.web-share__copied {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--color-primary);
}
.web-share-fade-enter-active,
.web-share-fade-leave-active {
  transition: opacity 0.25s;
}
.web-share-fade-enter-from,
.web-share-fade-leave-to {
  opacity: 0;
}
</style>
