<script setup lang="ts">
/** WebHeader —— 站点页头：品牌 / 导航（含子菜单）/ 语言切换 / 操作区 / 移动端抽屉。 */
import { computed, ref } from 'vue'
import {
  DialogClose,
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuRoot,
  NavigationMenuTrigger,
  PopoverContent,
  PopoverPortal,
  PopoverRoot,
  PopoverTrigger,
} from 'reka-ui'
import type { ClassValue } from 'clsx'
import { cn } from '../lib/cn.ts'
import { floatingClass, overlayClass } from '../lib/ui.ts'
import { isActivePath } from '../lib/nav.ts'
import { componentStrings } from '../componentStrings.ts'

export interface WebHeaderMenuItem {
  id: number | string
  title: string
  url?: string
  href?: string
  /** 子项描述（mega 面板展示；任一子项携带即触发 mega 形态）。 */
  description?: string
  /** 子项缩略图（mega 面板）。 */
  image?: string
  children?: WebHeaderMenuItem[]
}

export interface WebHeaderLocaleLink {
  locale: string
  label?: string
  native_label?: string
  path: string
}

const props = withDefaults(
  defineProps<{
    menus?: { header?: WebHeaderMenuItem[] } | null
    branding?: { logo?: string | null; logo_alt?: string; show_name?: boolean } | null
    siteName?: string
    currentPath?: string
    localeLinks?: WebHeaderLocaleLink[]
    contactHref?: string | null
    contactLabel?: string | null
    loginHref?: string | null
    loginLabel?: string | null
    /** 当前语言码（语言切换按钮短标显示）。 */
    locale?: string | null
    class?: ClassValue
  }>(),
  {
    menus: null,
    branding: null,
    siteName: '',
    currentPath: '/',
    localeLinks: () => [],
    contactHref: null,
    contactLabel: null,
    loginHref: null,
    loginLabel: null,
    locale: null,
    class: undefined,
  },
)

defineOptions({ inheritAttrs: false })

const items = computed<WebHeaderMenuItem[]>(() => props.menus?.header ?? [])
const mobileOpen = ref(false)

const isExternal = (item: WebHeaderMenuItem): boolean => /^https?:\/\//.test(item.href ?? item.url ?? '')
const linkOf = (item: WebHeaderMenuItem): string => item.href || item.url || '#'

function linkClass(active: boolean): string {
  return cn(
    'web-header__nav-link text-sm transition-colors',
    active ? 'web-header__nav-link--active font-semibold text-primary' : 'text-foreground/80 hover:text-primary',
  )
}

/** mega 形态判定：显式声明(mega/meta.mega) 或 任一子项带描述/缩略图。 */
function isMega(item: WebHeaderMenuItem): boolean {
  return (item as { mega?: boolean }).mega === true
    || (item as { meta?: { mega?: boolean } }).meta?.mega === true
    || (item.children ?? []).some((c) => !!c.description || !!c.image)
}

const activeLocale = computed(
  () => props.locale ?? props.localeLinks.find((l) => l.path === props.currentPath)?.locale ?? props.localeLinks[0]?.locale ?? '',
)
</script>

<template>
  <header :class="cn('web-header sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur', props.class)">
    <div class="web-header__bar mx-auto flex h-[var(--web-header-h,72px)] max-w-site items-center justify-between gap-6 px-4 sm:px-6">
      <!-- #brand 替换 -->
      <slot name="brand" :site-name="siteName" :branding="branding">
        <a href="/" class="web-header__brand flex items-center gap-2.5" :aria-label="siteName">
          <img v-if="branding?.logo" :src="branding.logo" :alt="branding.logo_alt || siteName" class="h-[var(--web-header-logo-h,2.25rem)] w-auto">
          <span v-if="branding?.show_name !== false && siteName" class="text-base font-bold tracking-tight">{{ siteName }}</span>
        </a>
      </slot>

      <!-- 桌面导航：reka NavigationMenu（navigation 角色，hover 意图 + 漫游焦点）。
           面板锚定触发项下方：简单下拉 = 紧凑竖列（w-max）；mega = 多列 + 描述/缩略图 + 可选推广位。 -->
      <nav class="web-header__nav relative hidden lg:block" :aria-label="componentStrings.WebHeader.mainNav">
        <NavigationMenuRoot :delay-duration="150">
          <NavigationMenuList class="web-header__nav-list flex items-center gap-7">
            <template v-for="item in items" :key="String(item.id)">
              <!-- 有子项：Trigger + Content 面板 -->
              <NavigationMenuItem v-if="item.children?.length" class="relative">
                <NavigationMenuTrigger
                  :class="cn(
                    'web-header__nav-link web-header__nav-trigger inline-flex items-center gap-1 bg-transparent text-sm data-[state=open]:text-primary',
                    item.children.some((c) => isActivePath(currentPath, linkOf(c)))
                      ? 'font-semibold text-primary'
                      : 'text-foreground/80 hover:text-primary',
                  )"
                >
                  <slot name="item-label" :item="item" :active="item.children.some((c) => isActivePath(currentPath, linkOf(c)))">
                    {{ item.title }}
                  </slot>
                  <svg class="size-3.5 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
                </NavigationMenuTrigger>

                <!-- 简单下拉:壳持定位/圆角/阴影,宽度与内容体走 #dropdown 缺省或自定义 -->
                <NavigationMenuContent
                  v-if="!isMega(item)"
                  class="web-header__dropdown absolute left-1/2 top-full z-50 mt-2 -translate-x-1/2 rounded-card border border-border bg-popover shadow-pop"
                >
                  <slot name="dropdown" :item="item" :children="item.children">
                    <div class="w-max min-w-[10rem] max-w-[calc(100vw-2rem)] p-1.5">
                      <NavigationMenuLink
                        v-for="child in item.children"
                        :key="String(child.id)"
                        as-child
                        :active="isActivePath(currentPath, linkOf(child))"
                      >
                        <a
                          :href="linkOf(child)"
                          :target="isExternal(child) ? '_blank' : undefined"
                          :rel="isExternal(child) ? 'noopener' : undefined"
                          :class="cn(
                            'block whitespace-nowrap rounded-md px-3 py-2 text-sm outline-none transition-colors',
                            isActivePath(currentPath, linkOf(child))
                              ? 'bg-primary/10 font-semibold text-primary'
                              : 'text-foreground/85 hover:bg-muted hover:text-primary',
                          )"
                        >{{ child.title }}</a>
                      </NavigationMenuLink>
                    </div>
                  </slot>
                </NavigationMenuContent>

                <!-- Mega 面板:壳同上;内容体缺省 = 双列卡片(标题+描述±缩略图)+ #mega-extra 推广位;#mega 整体替换 -->
                <NavigationMenuContent
                  v-else
                  class="web-header__mega absolute left-1/2 top-full z-50 mt-2 -translate-x-1/2 rounded-card border border-border bg-popover shadow-pop"
                >
                  <slot name="mega" :item="item" :children="item.children">
                    <div class="w-[min(92vw,var(--web-header-mega-w,640px))] p-4">
                      <div :class="cn('grid gap-x-6 gap-y-1', $slots['mega-extra'] ? 'lg:grid-cols-[1fr_15rem]' : 'sm:grid-cols-2')">
                        <div class="grid gap-0.5">
                          <NavigationMenuLink
                            v-for="child in item.children"
                            :key="String(child.id)"
                            as-child
                            :active="isActivePath(currentPath, linkOf(child))"
                          >
                            <a
                              :href="linkOf(child)"
                              :target="isExternal(child) ? '_blank' : undefined"
                              :rel="isExternal(child) ? 'noopener' : undefined"
                              :class="cn(
                                'group flex gap-3 rounded-lg p-2.5 outline-none transition-colors',
                                isActivePath(currentPath, linkOf(child))
                                  ? 'bg-primary/10'
                                  : 'hover:bg-muted',
                              )"
                            >
                              <img
                                v-if="child.image"
                                :src="child.image"
                                :alt="child.title"
                                class="h-10 w-14 shrink-0 rounded-md object-cover"
                                loading="lazy"
                              >
                              <span class="min-w-0">
                                <span
                                  :class="cn(
                                    'block text-sm font-medium',
                                    isActivePath(currentPath, linkOf(child)) ? 'text-primary' : 'text-foreground group-hover:text-primary',
                                  )"
                                >{{ child.title }}</span>
                                <span v-if="child.description" class="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-muted-foreground">{{ child.description }}</span>
                              </span>
                            </a>
                          </NavigationMenuLink>
                        </div>
                        <slot name="mega-extra" :item="item" />
                      </div>
                    </div>
                  </slot>
                </NavigationMenuContent>
              </NavigationMenuItem>

              <!-- 叶子项:Link(active → aria-current) -->
              <NavigationMenuItem v-else>
                <NavigationMenuLink as-child :active="isActivePath(currentPath, linkOf(item))">
                  <a
                    :href="linkOf(item)"
                    :target="isExternal(item) ? '_blank' : undefined"
                    :rel="isExternal(item) ? 'noopener' : undefined"
                    :class="linkClass(isActivePath(currentPath, linkOf(item)))"
                  ><slot name="item-label" :item="item" :active="isActivePath(currentPath, linkOf(item))">{{ item.title }}</slot></a>
                </NavigationMenuLink>
              </NavigationMenuItem>
            </template>
          </NavigationMenuList>
        </NavigationMenuRoot>
      </nav>

      <!-- 操作区 -->
      <div class="web-header__actions flex items-center gap-3">
        <slot name="actions">
          <!-- 语言切换：Popover 部件内联组装 -->
          <PopoverRoot v-if="localeLinks.length > 1">
            <PopoverTrigger as-child>
              <button
                type="button"
                class="web-header__locale inline-flex h-9 items-center gap-1 rounded-md border border-border px-2.5 text-xs font-medium uppercase tracking-wide text-foreground/80 transition-colors hover:border-primary/40 hover:text-primary"
                :aria-label="componentStrings.WebHeader.switchLocale"
              >
                <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z"/></svg>
                {{ activeLocale.slice(0, 2).toUpperCase() }}
              </button>
            </PopoverTrigger>
            <PopoverPortal>
              <PopoverContent :side-offset="6" :class="floatingClass">
                <div class="min-w-36 rounded-card border border-border bg-popover p-1.5 shadow-pop">
                  <a
                    v-for="l in localeLinks"
                    :key="l.locale"
                    :href="l.path"
                    class="block rounded-sm px-3 py-2 text-sm text-foreground/85 transition-colors hover:bg-muted hover:text-primary"
                  >{{ l.native_label || l.label || l.locale }}</a>
                </div>
              </PopoverContent>
            </PopoverPortal>
          </PopoverRoot>

          <a
            v-if="loginHref"
            :href="loginHref"
            class="web-header__login hidden text-sm font-medium text-foreground/80 transition-colors hover:text-primary lg:inline-flex"
          >{{ loginLabel ?? componentStrings.WebUserArea.login }}</a>

          <a
            v-if="contactHref"
            :href="contactHref"
            class="web-header__contact hidden h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 lg:inline-flex"
          >{{ contactLabel }}</a>
          <!-- 追加式操作位：不清空缺省操作区（语言切换/联系按钮）的前提下挂载额外部件 -->
          <slot name="actions-extra" />
        </slot>

        <!-- 移动端抽屉：Dialog 部件内联（右侧滑出形态） -->
        <DialogRoot v-model:open="mobileOpen">
          <DialogTrigger as-child>
            <button
              type="button"
              class="web-header__burger inline-flex size-10 items-center justify-center rounded-md border border-border text-foreground lg:hidden"
              :aria-label="mobileOpen ? componentStrings.WebHeader.closeMenu : componentStrings.WebHeader.openMenu"
            >
              <svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
            </button>
          </DialogTrigger>
          <DialogPortal>
            <DialogOverlay :class="overlayClass" />
            <DialogContent class="web-sheet fixed inset-y-0 right-0 z-50 outline-none">
              <DialogTitle class="sr-only">{{ componentStrings.WebHeader.mainNav }}</DialogTitle>
              <div class="web-header__mobile h-full w-80 max-w-[85vw] overflow-y-auto bg-background p-6">
                <div class="mb-4 flex justify-end">
                  <DialogClose as-child>
                    <button
                      type="button"
                      class="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      :aria-label="componentStrings.WebHeader.closeMenu"
                    >
                      <svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
                    </button>
                  </DialogClose>
                </div>
                <nav class="flex flex-col gap-1" :aria-label="componentStrings.WebHeader.mainNav">
                  <slot name="mobile-nav" :items="items">
                    <template v-for="item in items" :key="`m-${String(item.id)}`">
                      <a
                        :href="linkOf(item)"
                        :class="cn('rounded-md px-3 py-2.5 text-base', isActivePath(currentPath, linkOf(item)) ? 'bg-muted font-semibold text-primary' : 'text-foreground/85')"
                      >{{ item.title }}</a>
                      <a
                        v-for="child in item.children ?? []"
                        :key="`m-${String(child.id)}`"
                        :href="linkOf(child)"
                        class="ml-4 rounded-md border-l border-border px-3 py-2 text-sm text-muted-foreground"
                      >{{ child.title }}</a>
                    </template>
                  </slot>
                </nav>
                <div class="mt-6 space-y-2 border-t border-border pt-5">
                  <a
                    v-for="l in localeLinks"
                    :key="`ml-${l.locale}`"
                    :href="l.path"
                    class="block rounded-md px-3 py-2 text-sm text-foreground/80"
                  >{{ l.native_label || l.label || l.locale }}</a>
                </div>
                <a
                  v-if="contactHref"
                  :href="contactHref"
                  class="mt-4 inline-flex h-11 w-full items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground"
                >{{ contactLabel }}</a>
              </div>
            </DialogContent>
          </DialogPortal>
        </DialogRoot>
      </div>
    </div>
  </header>
</template>

<style scoped>
/* 移动端抽屉：右侧滑入/滑出（respect prefers-reduced-motion） */
.web-sheet[data-state='open'] {
  animation: web-header-sheet-in 0.26s var(--web-motion-ease, cubic-bezier(0.22, 1, 0.36, 1));
}
.web-sheet[data-state='closed'] {
  animation: web-header-sheet-out 0.2s var(--web-motion-ease, cubic-bezier(0.22, 1, 0.36, 1));
}
@keyframes web-header-sheet-in {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}
@keyframes web-header-sheet-out {
  from { transform: translateX(0); }
  to { transform: translateX(100%); }
}
@media (prefers-reduced-motion: reduce) {
  .web-sheet[data-state='open'],
  .web-sheet[data-state='closed'] {
    animation: none;
  }
}
</style>
