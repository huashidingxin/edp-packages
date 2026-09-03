<script setup lang="ts">
/**
 * 公共 layout 兜底 —— 站点无本地 layouts/default.vue 时启用。
 *
 * 接线职责：bootstrap → WebHeader / WebFooter / 主题变量 / 有状态挂件（chat）。
 * 视觉定制：站点用 web-header / web-footer 语义类覆盖，或整体替换本文件。
 */
import { computed, useSlots, watch } from 'vue'
import { useAppConfig, useHead, useState, useRuntimeConfig } from 'nuxt/app'
import { tokensToCssVariables, resolveStylesheet, WebChatWidget, WebHeader, WebFooter, WebUserArea, WebServiceSidebar } from '@edp/website-ui'
// 注意：本 layout 会被复制进 .nuxt 虚拟目录执行 —— 禁止相对路径 import，
// composables 走 '@edp/website-runtime/composables' 包入口。
import { useSiteBootstrap, useT, useLocale, useSiteNavigation } from '@edp/website-runtime/composables'
import { applyMenuEnhancements } from '@edp/website-runtime/composables'

const { data: bootstrap, error: bootstrapError } = useSiteBootstrap()
const { t } = useT()

// bootstrap 写入共享 state，供 useLocale / useBootstrapSite 等派生
useState('web:bootstrap:data', () => bootstrap.value)
watch(bootstrap, (v) => {
  useState<unknown>('web:bootstrap:data').value = v
})

const siteInfo = computed(() => (bootstrap.value as any)?.site ?? {})
const { locale, localeLinks, logicalPath } = useLocale()
const nav = useSiteNavigation()

// 主题 CSS 变量（可选能力；后端不下发样式时为空串）
const themeCss = computed(() => tokensToCssVariables((bootstrap.value as any)?.theme?.tokens ?? null))
const themeStylesheet = computed(() => {
  const s = (bootstrap.value as any)?.theme?.stylesheet
  return resolveStylesheet(s).url ?? '' as string
})

useHead({
  htmlAttrs: { lang: computed(() => locale.value.split('-')[0] ?? 'zh') },
  style: () => [{ innerHTML: themeCss.value || '', key: 'web-theme' }],
  link: () => themeStylesheet.value ? [{ rel: 'stylesheet', href: themeStylesheet.value }] : [],
})

const config = useRuntimeConfig()
const chatEnabled = computed(() =>
  config.public.chatWidget !== false && !!siteInfo.value.ai_chat?.enabled,
)
const userWidgetEnabled = computed(() => config.public.userWidget === true)

// dev 专用:后端不可达时显式提示(生产静态站构建期已取数,不渲染)
const isDev = import.meta.dev
const devApiBase = computed(() => String(config.apiBase || config.public.apiBase || ''))

/** 透传给 WebHeader 的站点具名插槽（actions/header-actions 由 layout 显式处理，排除之）。 */
const slots = useSlots()
const headerPassthroughSlots = computed(() =>
  Object.keys(slots).filter((n) => n !== 'actions' && n !== 'actions-extra' && !n.startsWith('footer-')))
/** 透传给 WebFooter 的站点插槽（约定前缀 footer-，内部名去掉前缀）。 */
const footerPassthroughSlots = computed(() =>
  Object.keys(slots)
    .filter((n) => n.startsWith('footer-'))
    .map((n) => ({ site: n, internal: n.slice('footer-'.length) })))

const appConfig = useAppConfig() as any
const headerMenus = computed(() => ({
  header: applyMenuEnhancements(
    (bootstrap.value as any)?.menus?.header ?? [],
    appConfig?.website?.menuEnhancements,
  ),
  footer: (bootstrap.value as any)?.menus?.footer ?? [],
}))

const headerProps = computed(() => ({
  menus: headerMenus.value,
  branding: siteInfo.value.branding ?? {},
  currentPath: logicalPath.value,
  locale: locale.value,
  localeLinks: localeLinks.value,
  siteName: siteInfo.value.name ?? '',
}))
</script>

<template>
  <div class="website-site flex min-h-screen flex-col bg-background text-foreground antialiased">
    <a class="web-skip-link" href="#main">{{ t('跳到主内容') }}</a>

    <WebHeader v-bind="headerProps">
      <!-- 不接管 #actions：WebHeader 缺省操作区包含语言切换/联系按钮，
           一旦覆盖语言切换在 PC 端就消失。会员挂件走 #actions-extra 追加在缺省操作区之后。 -->
      <template #actions-extra>
        <WebUserArea v-if="userWidgetEnabled" class="hidden lg:block" />
      </template>
      <!-- 其余具名插槽透传给站点（如 #mega-extra 推广位）；actions 已显式处理 -->
      <template v-for="name in headerPassthroughSlots" :key="name" #[name]="slotProps">
        <slot :name="name" v-bind="(slotProps ?? {})" />
      </template>
    </WebHeader>

    <main id="main" class="site-main flex-1">
      <slot />
    </main>

    <WebFooter
      :menus="(bootstrap as any)?.menus ?? {}"
      :branding="siteInfo.branding ?? {}"
      :site-name="siteInfo.name ?? ''"
      :contact="siteInfo.branding?.contact ?? null"
    >
      <template v-for="{ site, internal } in footerPassthroughSlots" :key="site" #[internal]="slotProps">
        <slot :name="site" v-bind="(slotProps ?? {})" />
      </template>
    </WebFooter>

    <!-- 有状态全局挂件挂载点：实例不随路由重建 -->
    <slot name="widgets" />
    <!-- 客服入口由 WebChatWidget 自带悬浮球承担（常驻右下角）；sidebar 只补回到顶部 -->
    <WebServiceSidebar />
    <WebChatWidget v-if="chatEnabled" :config="siteInfo.ai_chat" />
  </div>
</template>
