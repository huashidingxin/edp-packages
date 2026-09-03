<script setup lang="ts">
/** WebBreadcrumbs —— 面包屑导航(onDark 用于深色带;相邻同名自动去重)。
 *
 * 不再硬编码前置「首页」：i18n 由调用方负责（t('首页') 在 zh-CN / en-US 下分别落到「首页」/「Home」），
 * 组件只负责渲染传入的 items + 相邻去重 + 最少层级闸门。
 */
import { computed } from 'vue'
import { cn } from '../lib/cn.ts'
import { componentStrings } from '../componentStrings.ts'

export interface WebBreadcrumbEntry {
  label: string
  href?: string | null
}

const props = withDefaults(
  defineProps<{
    items?: WebBreadcrumbEntry[]
    /** 深色带模式:链接/分隔符/当前级转白(默认 current 用 foreground,暗底不可读)。 */
    onDark?: boolean
    /** 最少层级:不足则整体不渲染——「首页/当前页」两层无导航价值。 */
    minLevels?: number
  }>(),
  {
    items: () => [],
    onDark: false,
    minLevels: 3,
  },
)

const crumbs = computed(() => {
  const list = props.items.map((i) => ({ label: i.label, href: i.href ?? null }))
  // 相邻同名校验(防御上游重复前置「首页」)
  return list.filter((c, i) => i === 0 || c.label !== list[i - 1]!.label)
})
</script>

<template>
  <nav v-if="crumbs.length >= props.minLevels" class="web-breadcrumbs" :aria-label="componentStrings.WebBreadcrumbs.label">
    <ol class="web-breadcrumbs__list flex flex-wrap items-center gap-x-2 gap-y-1 text-sm" :class="onDark ? 'text-white/60' : 'text-muted-foreground'">
      <li
        v-for="(crumb, i) in crumbs"
        :key="`${crumb.label}-${i}`"
        class="web-breadcrumbs__item flex items-center gap-2"
      >
        <span v-if="i > 0" class="web-breadcrumbs__sep select-none" :class="onDark ? 'text-white/40' : 'text-border'" aria-hidden="true">/</span>
        <a
          v-if="crumb.href && i < crumbs.length - 1"
          :href="crumb.href"
          :class="cn('web-breadcrumbs__link transition-colors', onDark ? 'text-white/70 hover:text-white' : 'hover:text-primary')"
        >{{ crumb.label }}</a>
        <span
          v-else
          :class="cn('web-breadcrumbs__current font-medium', onDark ? 'text-white' : 'text-foreground')"
          :aria-current="i === crumbs.length - 1 ? 'page' : undefined"
        >{{ crumb.label }}</span>
      </li>
    </ol>
  </nav>
</template>
