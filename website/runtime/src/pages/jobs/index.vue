<script setup lang="ts">
import { useSiteCollection } from '../../composables/useSite.ts'
import { useT } from '../../composables/useT.ts'
import { useLocale } from '../../composables/useLocale.ts'
import { recordPath } from '../../lib/site.ts'
import { useWebReveal } from '../../composables/useWebReveal.ts'
/** 招聘列表（通用：渠道/部门胶囊筛选 + 职位行卡；?channel=campus 预选校园招聘）。 */
import { computed, ref, watch } from 'vue'
import { navigateTo, useHead, useRoute } from 'nuxt/app'
import { WebBreadcrumbs } from '@edp/website-ui'

const { t } = useT()
const { localePath } = useLocale()
const route = useRoute()

/* 渠道：URL ?channel=campus 预选（校园招聘菜单直达），页面内可切换 */
const activeChannel = ref<'social' | 'campus' | null>(
  route.query.channel === 'campus' ? 'campus' : route.query.channel === 'social' ? 'social' : null,
)

// 一次拉全量，渠道/部门在客户端过滤：胶囊可用性不能依赖筛选后的子集，
// 且切换渠道无需重新请求（服务端 channel 过滤会导致胶囊消失、无法切回）。
const { data: collection } = useSiteCollection({ type: 'job', limit: 100 })
const items = computed(() => collection.value?.items ?? [])

/** 渠道切换同步到 URL（replace 不产生历史记录），保持 ?channel=campus 深链一致。 */
watch(activeChannel, (c) => {
  navigateTo({ query: c ? { channel: c } : {} }, { replace: true })
})

/** 部门筛选：在当前渠道子集内派生唯一值，客户端过滤（职位不走分类命名空间）。 */
const activeDept = ref<string | null>(null)
const channelItems = computed(() =>
  activeChannel.value ? items.value.filter((i) => String(i.values?.channel ?? 'social') === activeChannel.value) : items.value,
)
const departments = computed(() =>
  Array.from(new Set(channelItems.value.map((i) => String(i.values?.department ?? '').trim()).filter(Boolean))),
)
const visibleItems = computed(() =>
  activeDept.value ? channelItems.value.filter((i) => String(i.values?.department ?? '') === activeDept.value) : channelItems.value,
)
// 切渠道后旧部门可能不在新渠道里，重置部门筛选。
watch(activeChannel, () => (activeDept.value = null))

/** 列表入场：进入视口才播放（首屏直出，后续卡片按 index 错峰上浮）；切部门后重扫。 */
const listRef = ref<HTMLElement | null>(null)
useWebReveal(() => listRef.value, { deps: [visibleItems] })

const crumbs = computed(() => [
  { label: t('首页'), href: '/' },
  { label: t('招聘中心'), href: '/jobs' },
])

/** 渠道胶囊：仅在数据里出现过对应渠道时展示（企业未用校招不出现按钮）。 */
const channelPills = computed(() => {
  const has = (c: string) => items.value.some((i) => String(i.values?.channel ?? 'social') === c)
  const pills: Array<{ key: 'social' | 'campus' | null; label: string }> = []
  if (has('social')) pills.push({ key: 'social', label: t('社会招聘') })
  if (has('campus')) pills.push({ key: 'campus', label: t('校园招聘') })
  return pills
})
function setChannel(c: 'social' | 'campus' | null) {
  activeChannel.value = activeChannel.value === c ? null : c
}

useHead({
  title: () => t('招聘中心'),
  meta: [{ name: 'description', content: () => t('加入我们，与团队共同成长。') }],
})

const vals = (item: any): Record<string, any> => item?.values ?? {}
function extractId(key: string, v: Record<string, any> | null): number | string {
  const id = v?.id
  if (id != null && id !== '') return id as number | string
  const tail = String(key).split(':').pop() ?? key
  return /^\d+$/.test(tail) ? Number(tail) : tail
}

/** 截止日期：从 YYYY-MM-DD 前缀取 YYYY/MM/DD。 */
function dateText(v: unknown): string | null {
  if (!v) return null
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[1]}/${m[2]}/${m[3]}` : null
}

/** 部门胶囊按钮：激活=主题色实心；未激活=浅灰底。 */
const pillClass = (active: boolean) =>
  active
    ? 'inline-flex h-9 items-center rounded-full border border-primary bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-all duration-200'
    : 'inline-flex h-9 items-center rounded-full border border-transparent bg-muted px-4 text-sm font-medium text-muted-foreground transition-all duration-200 hover:bg-primary/10 hover:text-primary'
</script>

<template>
  <div>
    <!-- 页头：职位不走分类命名空间，深色带兜底（零 banner 依赖） -->
    <section class="web-band-dark py-14">
      <div class="mx-auto max-w-site px-4 sm:px-6">
        <WebBreadcrumbs :items="crumbs" on-dark />
        <h1 class="mt-4 font-display text-display-md font-bold tracking-tight text-white">{{ t('招聘中心') }}</h1>
        <p v-if="items.length" class="mt-3 max-w-2xl text-sm leading-relaxed text-white/70">{{ t('加入我们，与团队共同成长。') }}</p>
      </div>
    </section>

    <!-- 列表区：渠道/部门筛选 + 职位行卡 -->
    <div class="bg-background pb-12 pt-10 sm:pb-16 sm:pt-14">
      <div class="mx-auto max-w-site px-4 sm:px-6">
        <nav v-if="channelPills.length > 1" class="mb-4 flex flex-wrap items-center gap-2" :aria-label="t('招聘渠道')">
          <button
            v-for="p in channelPills"
            :key="p.key ?? 'all'"
            type="button"
            :class="pillClass(activeChannel === p.key)"
            @click="setChannel(p.key)"
          >{{ p.label }}</button>
        </nav>
        <nav v-if="departments.length > 1" class="mb-8 flex flex-wrap items-center gap-2 sm:mb-10" :aria-label="t('部门筛选')">
          <button
            type="button"
            :class="pillClass(activeDept === null)"
            @click="activeDept = null"
          >{{ t('全部') }}</button>
          <button
            v-for="dept in departments"
            :key="dept"
            type="button"
            :class="pillClass(activeDept === dept)"
            @click="activeDept = activeDept === dept ? null : dept"
          >{{ dept }}</button>
        </nav>

        <div v-if="visibleItems.length" ref="listRef" class="flex flex-col gap-5">
          <a
            v-for="(item, i) in visibleItems"
            :key="String(item.key)"
            :href="localePath(recordPath('job', extractId(String(item.key), vals(item))))"
            data-web-reveal
            :data-web-reveal-delay="`${Math.min(i * 70, 350)}ms`"
            class="group relative flex flex-col gap-4 overflow-hidden rounded-card border border-border/80 bg-card p-5 shadow-card web-motion hover:border-primary/40 sm:flex-row sm:items-center sm:gap-6 sm:p-6"
          >
            <!-- 激活氛围：主色渐变底自左淡入 + 左侧主题条自上展开（与新闻卡片同语言） -->
            <span
              class="pointer-events-none absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/[0.04] to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100"
              aria-hidden="true"
            />
            <span
              class="pointer-events-none absolute left-0 top-0 h-full w-1 origin-top scale-y-0 rounded-r-full bg-gradient-to-b from-primary to-primary/60 transition-transform duration-500 group-hover:scale-y-100"
              aria-hidden="true"
            />

            <!-- 左侧：职位标题 + 部门/地点/类型 meta + 摘要 -->
            <div class="min-w-0 flex-1">
              <h3 class="web-clamp-2 font-display text-lg font-bold leading-snug text-foreground transition-colors duration-300 group-hover:text-primary sm:text-xl">{{ vals(item).title }}</h3>
              <div class="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
                <span v-if="vals(item).department" class="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">{{ vals(item).department }}</span>
                <span v-if="vals(item).location" class="inline-flex items-center gap-1.5">
                  <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                  {{ vals(item).location }}
                </span>
                <span v-if="vals(item).employment_type" class="inline-flex items-center gap-1.5">
                  <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
                  {{ vals(item).employment_type }}
                </span>
              </div>
              <p v-if="vals(item).summary" class="web-clamp-2 mt-2.5 text-sm leading-relaxed text-muted-foreground">{{ vals(item).summary }}</p>
            </div>

            <!-- 右侧：薪资（主题色醒目）+ 截止日期 + 箭头；移动端平铺成一行 -->
            <div class="flex shrink-0 items-center justify-between gap-4 sm:flex-col sm:items-end sm:justify-center sm:gap-2 sm:border-l sm:border-border/60 sm:pl-6">
              <span v-if="vals(item).salary_range" class="web-num font-display text-lg font-bold leading-none tracking-tight text-primary sm:text-xl">{{ vals(item).salary_range }}</span>
              <span v-if="dateText(vals(item).deadline)" class="web-num text-xs text-muted-foreground">{{ t('截止 {date}', { date: dateText(vals(item).deadline) ?? '' }) }}</span>
              <svg
                class="hidden size-5 text-muted-foreground/60 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-primary sm:block"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
              </svg>
            </div>
          </a>
        </div>

        <div v-else class="flex flex-col items-center gap-4 rounded-card border border-dashed border-border bg-card p-16 text-center">
          <div class="grid size-16 place-items-center rounded-full bg-muted">
            <svg class="size-8 text-muted-foreground/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect width="20" height="14" x="2" y="7" rx="2" ry="2"/>
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
            </svg>
          </div>
          <p class="text-sm text-muted-foreground">{{ t('该栏目暂无内容，敬请期待。') }}</p>
        </div>
      </div>
    </div>
  </div>
</template>
