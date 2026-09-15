<script setup lang="ts">
import { useSiteCollection } from '../../composables/useSite.ts'
import { useT } from '../../composables/useT.ts'
import { useLocale } from '../../composables/useLocale.ts'
import { recordPath } from '../../lib/site.ts'
import { useWebReveal } from '../../composables/useWebReveal.ts'
/** 团队列表（通用：独立 team-member 模型，不走文章分类；肖像网格）。 */
import { computed, ref } from 'vue'
import { useHead } from 'nuxt/app'

const { t } = useT()
const { localePath } = useLocale()

/* 纯函数前置：deps 触发的 setup 期求值先于模板挂载，const 必须先声明（TDZ 即 500）。 */
const vals = (item: any): Record<string, any> => item?.values ?? {}
function extractId(key: string, v: Record<string, any> | null): number | string {
  const id = v?.id
  if (id != null && id !== '') return id as number | string
  const tail = String(key).split(':').pop() ?? key
  return /^\d+$/.test(tail) ? Number(tail) : tail
}
const avatarOf = (v: Record<string, any>): string =>
  String(v.avatar ?? v.image ?? '')

const { data: collection } = useSiteCollection({ type: 'team-member', limit: 100 })
const items = computed(() => collection.value?.items ?? [])

const listRef = ref<HTMLElement | null>(null)
useWebReveal(() => listRef.value, { deps: [items] })

const crumbs = computed(() => [
  { label: t('首页'), href: '/' },
  { label: t('团队成员'), href: '/team' },
])

useHead({
  title: () => t('团队成员'),
  meta: [{ name: 'description', content: () => t('团队成员') }],
})
</script>

<template>
  <div>
    <section class="web-band-dark py-14">
      <div class="mx-auto max-w-site px-4 sm:px-6">
        <WebBreadcrumbs :items="crumbs" on-dark />
        <h1 class="mt-4 font-display text-display-md font-bold tracking-tight text-white">{{ t('团队成员') }}</h1>
      </div>
    </section>

    <div class="bg-background pb-12 pt-10 sm:pb-16 sm:pt-14">
      <div class="mx-auto max-w-site px-4 sm:px-6">
        <div v-if="items.length" ref="listRef" class="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4">
          <a
            v-for="(item, i) in items"
            :key="String(item.key)"
            :href="localePath(recordPath('team', extractId(String(item.key), vals(item))))"
            data-web-reveal
            :data-web-reveal-delay="`${Math.min(i * 60, 300)}ms`"
            class="group overflow-hidden rounded-card border border-border bg-card shadow-card web-motion hover:-translate-y-1 hover:shadow-lift"
          >
            <span class="block overflow-hidden bg-muted">
              <img
                v-if="avatarOf(vals(item))"
                :src="avatarOf(vals(item))"
                :alt="String(vals(item).title ?? vals(item).name ?? '')"
                class="aspect-[3/4] w-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
              >
              <span v-else class="grid aspect-[3/4] w-full place-items-center bg-gradient-to-br from-muted to-accent">
                <svg
                  class="size-10 text-muted-foreground/40"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </span>
            </span>
            <span class="block p-4 text-center">
              <span class="block font-display text-base font-bold tracking-tight group-hover:text-primary">
                {{ vals(item).title ?? vals(item).name }}
              </span>
              <span v-if="vals(item).summary ?? vals(item).role" class="mt-1 line-clamp-2 block text-xs leading-relaxed text-muted-foreground">
                {{ vals(item).summary ?? vals(item).role }}
              </span>
            </span>
          </a>
        </div>
        <div v-else class="flex flex-col items-center gap-4 rounded-card border border-dashed border-border bg-card p-16 text-center">
          <p class="text-sm text-muted-foreground">{{ t('该栏目暂无内容，敬请期待。') }}</p>
        </div>
      </div>
    </div>
  </div>
</template>
