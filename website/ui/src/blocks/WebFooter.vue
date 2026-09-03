<script setup lang="ts">
/** WebFooter —— 站点页脚：品牌联系 / 菜单列 / 版权与备案。 */
import { computed } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '../lib/cn.ts'
import { componentStrings } from '../componentStrings.ts'

export interface WebFooterMenuLink {
  id?: number | string
  title: string
  url?: string
  href?: string
}

const props = withDefaults(
  defineProps<{
    menus?: { footer?: Array<{ id: number | string; title: string; children?: WebFooterMenuLink[] }> } | null
    branding?: { logo?: string | null; logo_alt?: string; copyright?: string | null } | null
    siteName?: string
    contact?: {
      phone?: string | null
      email?: string | null
      address?: string | null
      qr_image?: string | null
      qr_label?: string | null
      icp?: string | null
      icp_url?: string | null
      company?: string | null
    } | null
    /** 显式列定义，优先于 menus.footer。 */
    columns?: Array<{ title: string; links: Array<{ label: string; href: string }> }> | null
    class?: ClassValue
  }>(),
  {
    menus: null,
    branding: null,
    siteName: '',
    contact: null,
    columns: null,
    class: undefined,
  },
)

defineOptions({ inheritAttrs: false })

interface FooterColumn {
  title: string
  links: Array<{ label: string; href: string }>
}

const cols = computed<FooterColumn[]>(() => {
  if (props.columns?.length) return props.columns
  return (props.menus?.footer ?? [])
    .filter((m) => m.children?.length)
    .map((m) => ({
      title: m.title,
      links: (m.children ?? []).map((c) => ({ label: c.title, href: c.href || c.url || '#' })),
    }))
})

const year = new Date().getFullYear()
const copyrightText = computed(
  () => props.branding?.copyright ?? `${componentStrings.WebFooter.allRightsReserved}`,
)
</script>

<template>
  <footer :class="cn('web-footer bg-secondary text-secondary-foreground', props.class)">
    <div class="mx-auto max-w-site px-4 py-14 sm:px-6">
      <!-- 主内容区：品牌 + 菜单列 + 二维码 -->
      <div class="web-footer__grid grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
        <!-- 品牌与联系 -->
        <div class="web-footer__brand space-y-5 sm:col-span-2 lg:col-span-1">
          <slot name="brand" :site-name="siteName" :branding="branding" :contact="contact">
            <a href="/" class="inline-flex items-center gap-2.5">
              <img v-if="branding?.logo" :src="branding.logo" :alt="branding.logo_alt || siteName" class="h-9 w-auto" style="filter: var(--web-footer-logo-filter, none)">
              <span v-if="siteName" class="text-base font-bold tracking-tight">{{ siteName }}</span>
            </a>
            <div v-if="contact" class="web-footer__contact space-y-2.5 text-sm text-secondary-foreground/70">
              <p v-if="contact.phone" class="flex items-center gap-2.5">
                <svg class="size-4 shrink-0 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.08 4.18 2 2 0 0 1 4.06 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.68 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.2a2 2 0 0 1 2.11-.45c.91.32 1.85.55 2.81.68A2 2 0 0 1 22 16.92Z"/></svg>
                {{ contact.phone }}
              </p>
              <p v-if="contact.email" class="flex items-center gap-2.5">
                <svg class="size-4 shrink-0 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg>
                {{ contact.email }}
              </p>
              <p v-if="contact.address" class="flex items-start gap-2.5">
                <svg class="mt-0.5 size-4 shrink-0 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                {{ contact.address }}
              </p>
            </div>
          </slot>
        </div>

        <!-- 菜单列:#columns 整体替换 -->
        <slot name="columns" :cols="cols">
          <nav
            v-for="col in cols"
            :key="col.title"
            class="web-footer__col"
            :aria-label="col.title"
          >
            <h3 class="web-footer__col-title text-sm font-semibold uppercase tracking-wider text-secondary-foreground/90">{{ col.title }}</h3>
            <ul class="mt-4 space-y-2.5">
              <li v-for="link in col.links" :key="link.href + link.label">
                <a :href="link.href" class="web-footer__col-link text-sm text-secondary-foreground/60 transition-colors hover:text-secondary-foreground">{{ link.label }}</a>
              </li>
            </ul>
          </nav>
        </slot>

        <!-- 二维码:#qr 替换 -->
        <slot name="qr" :contact="contact">
          <div v-if="contact?.qr_image" class="web-footer__qr justify-self-start md:justify-self-end">
            <img :src="contact.qr_image" :alt="contact.qr_label ?? componentStrings.WebFooter.contact" class="size-28 rounded-md bg-white p-1">
            <p v-if="contact.qr_label" class="mt-2 text-xs text-secondary-foreground/50">{{ contact.qr_label }}</p>
          </div>
        </slot>
      </div>

      <slot name="extra" />

      <!-- 底栏:#bottom 整体替换 -->
      <slot name="bottom" :year="year" :site-name="siteName" :copyright="copyrightText" :contact="contact">
        <div class="web-footer__bottom mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-secondary-foreground/10 pt-6 text-xs text-secondary-foreground/50">
          <p class="web-footer__copyright">© {{ year }} {{ contact?.company || siteName }} · {{ copyrightText }}</p>
          <a
            v-if="contact?.icp"
            :href="contact.icp_url || 'https://beian.miit.gov.cn'"
            target="_blank"
            rel="noopener"
            class="web-footer__icp transition-colors hover:text-secondary-foreground"
          >{{ contact.icp }}</a>
        </div>
      </slot>
    </div>
  </footer>
</template>
