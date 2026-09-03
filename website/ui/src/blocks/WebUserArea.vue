<script setup lang="ts">
/**
 * WebUserArea —— 会员态注水岛（ClientOnly 语义）。
 *
 * SSG 页面输出中性默认（登录按钮）；客户端挂载后经 useSession() 拉 /me，
 * 已登录则切换为用户菜单。SSR/构建期不请求、不渲染个性化内容。
 */
import { onMounted, ref } from 'vue'
import {
  DialogClose,
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger,
} from 'reka-ui'
import { componentStrings } from '../componentStrings.ts'
import { floatingClass, overlayClass } from '../lib/ui.ts'
import { useSession } from '../auth/session.ts'
import type { AuthLoginPayload } from '../api/auth.ts'

const props = withDefaults(
  defineProps<{
    /** 登录成功后的跳转；缺省原地刷新状态。 */
    redirectAfterLogin?: string | null
    accountLabel?: string | null
    passwordLabel?: string | null
    loginLabel?: string | null
    logoutLabel?: string | null
    closeLabel?: string | null
    class?: unknown
  }>(),
  {
    redirectAfterLogin: null,
    accountLabel: null,
    passwordLabel: null,
    loginLabel: null,
    logoutLabel: null,
    closeLabel: null,
    class: undefined,
  },
)

defineOptions({ inheritAttrs: false })

const { user, login, logout, refresh, isClient } = useSession()
const dialogOpen = ref(false)
const account = ref('')
const password = ref('')
const submitting = ref(false)
const error = ref<string | null>(null)

onMounted(() => {
  if (isClient && user.value === null) void refresh()
})

async function submitLogin(): Promise<void> {
  const payload: AuthLoginPayload = { account: account.value.trim(), password: password.value }
  if (!payload.account) {
    error.value = componentStrings.WebUserArea.loginRequired
    return
  }
  if (!payload.password) {
    error.value = componentStrings.WebUserArea.passwordRequired
    return
  }
  submitting.value = true
  error.value = null
  try {
    await login(payload)
    dialogOpen.value = false
    account.value = ''
    password.value = ''
    if (props.redirectAfterLogin && typeof window !== 'undefined') {
      window.location.href = props.redirectAfterLogin
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : componentStrings.WebUserArea.loginFailed
  } finally {
    submitting.value = false
  }
}

async function onLogout(): Promise<void> {
  await logout()
}
</script>

<template>
  <div :class="['web-user-area', props.class]" :data-auth-state="user?.id ? 'in' : 'out'">
    <!-- 未登录：登录入口 + 弹窗（Dialog 部件内联组装） -->
    <template v-if="!user">
      <DialogRoot v-model:open="dialogOpen">
        <DialogTrigger as-child>
          <button
            type="button"
            class="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3.5 text-sm font-medium text-foreground/80 transition-colors hover:border-primary/40 hover:text-primary"
          >{{ loginLabel ?? componentStrings.WebUserArea.login }}</button>
        </DialogTrigger>
        <DialogPortal>
          <DialogOverlay :class="overlayClass" />
          <DialogContent class="web-dialog fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 outline-none">
            <DialogTitle class="sr-only">{{ componentStrings.WebUserArea.dialogTitle }}</DialogTitle>

            <div class="web-user-area__dialog w-[min(92vw,380px)] rounded-card bg-background p-6 shadow-pop">
              <div class="flex items-start justify-between gap-4">
                <h2 class="text-lg font-bold">{{ componentStrings.WebUserArea.dialogTitle }}</h2>
                <DialogClose as-child>
                  <button
                    type="button"
                    class="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    :aria-label="closeLabel ?? '关闭'"
                  >
                    <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
                  </button>
                </DialogClose>
              </div>
              <form class="mt-5 space-y-4" @submit.prevent="submitLogin">
            <div>
              <label class="mb-1.5 block text-sm font-medium" for="web-user-account">{{ accountLabel ?? componentStrings.WebUserArea.accountPlaceholder }}</label>
              <input
                id="web-user-account"
                v-model="account"
                type="text"
                autocomplete="username"
                class="h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-primary"
              >
            </div>
            <div>
              <label class="mb-1.5 block text-sm font-medium" for="web-user-password">{{ passwordLabel ?? componentStrings.WebUserArea.passwordPlaceholder }}</label>
              <input
                id="web-user-password"
                v-model="password"
                type="password"
                autocomplete="current-password"
                class="h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-primary"
              >
            </div>
            <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
            <button
              type="submit"
              :disabled="submitting"
              class="h-11 w-full rounded-md bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
            >{{ submitting ? componentStrings.WebUserArea.submitting : componentStrings.WebUserArea.submitLogin }}</button>
          </form>
            </div>
          </DialogContent>
        </DialogPortal>
      </DialogRoot>
    </template>

    <!-- 已登录：用户菜单（DropdownMenu 部件内联组装） -->
    <template v-else>
      <DropdownMenuRoot>
        <DropdownMenuTrigger as-child>
          <button type="button" class="inline-flex h-9 items-center gap-2 rounded-full pl-1 pr-3 text-sm font-medium transition-colors hover:bg-muted">
            <span v-if="user.avatar" class="size-7 overflow-hidden rounded-full">
              <img :src="user.avatar" :alt="user.name" class="size-full object-cover">
            </span>
            <span v-else class="grid size-7 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              {{ user.name.slice(0, 1).toUpperCase() }}
            </span>
            {{ user.name }}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuPortal>
          <DropdownMenuContent :side-offset="6" :class="[floatingClass, 'min-w-44 rounded-card border border-border bg-popover p-1.5 shadow-pop']">
            <DropdownMenuItem as-child>
              <a href="#" class="block w-full rounded-sm px-3 py-2 text-sm outline-none hover:bg-muted">{{ componentStrings.WebUserArea.account }}</a>
            </DropdownMenuItem>
            <DropdownMenuItem as-child>
              <button type="button" class="block w-full rounded-sm px-3 py-2 text-left text-sm outline-none hover:bg-muted" @click="onLogout">
                {{ logoutLabel ?? componentStrings.WebUserArea.logout }}
              </button>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenuRoot>
    </template>
  </div>
</template>
