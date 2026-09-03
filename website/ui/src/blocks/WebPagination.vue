<script setup lang="ts">
/** WebPagination —— 列表分页。 */
import { computed } from 'vue'
import { cn } from '../lib/cn.ts'
import { componentStrings } from '../componentStrings.ts'

const props = withDefaults(
  defineProps<{
    page?: number
    totalPages?: number
    /** 返回指定页的 href；返回 null 渲染为不可点占位。 */
    makeHref?: (page: number) => string | null
  }>(),
  {
    page: 1,
    totalPages: 1,
    makeHref: () => null,
  },
)

const pages = computed<number[]>(() => {
  const total = Math.max(1, props.totalPages)
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const cur = props.page
  const window = [1, cur - 2, cur - 1, cur, cur + 1, cur + 2, total]
    .filter((p) => p >= 1 && p <= total)
  return [...new Set(window)].sort((a, b) => a - b)
})

function label(page: number): string {
  return componentStrings.WebPagination.page.replace('{page}', String(page))
}
</script>

<template>
  <nav v-if="totalPages > 1" class="web-pagination" :aria-label="componentStrings.WebPagination.status.replace('{total}', String(totalPages))">
    <ul class="web-pagination__list flex items-center justify-center gap-1.5">
      <li :class="cn('web-pagination__item')">
        <a
          v-if="page > 1 && makeHref(page - 1)"
          :href="makeHref(page - 1)!" rel="prev"
          class="web-pagination__link inline-flex h-9 items-center rounded-md border border-border bg-card px-3 text-sm text-foreground transition-colors hover:border-primary/40 hover:text-primary"
        >{{ componentStrings.WebPagination.previous }}</a>
        <span v-else class="inline-flex h-9 items-center rounded-md px-3 text-sm text-muted-foreground/50">{{ componentStrings.WebPagination.previous }}</span>
      </li>

      <template v-for="(p, i) in pages" :key="p">
        <li v-if="i > 0 && p - pages[i - 1]! > 1" class="web-pagination__ellipsis select-none px-1.5 text-sm text-muted-foreground" aria-hidden="true">…</li>
        <li class="web-pagination__item">
          <a
            v-if="p !== page && makeHref(p)"
            :href="makeHref(p)!"
            :aria-label="label(p)"
            class="web-pagination__link web-num inline-flex size-9 items-center justify-center rounded-md border border-border bg-card text-sm transition-colors hover:border-primary/40 hover:text-primary"
          >{{ p }}</a>
          <span
            v-else
            :aria-current="p === page ? 'page' : undefined"
            :class="cn('web-pagination__current web-num inline-flex size-9 items-center justify-center rounded-md text-sm', p === page && 'bg-primary font-semibold text-primary-foreground')"
          >{{ p }}</span>
        </li>
      </template>

      <li class="web-pagination__item">
        <a
          v-if="page < totalPages && makeHref(page + 1)"
          :href="makeHref(page + 1)!" rel="next"
          class="web-pagination__link inline-flex h-9 items-center rounded-md border border-border bg-card px-3 text-sm text-foreground transition-colors hover:border-primary/40 hover:text-primary"
        >{{ componentStrings.WebPagination.next }}</a>
        <span v-else class="inline-flex h-9 items-center rounded-md px-3 text-sm text-muted-foreground/50">{{ componentStrings.WebPagination.next }}</span>
      </li>
    </ul>
  </nav>
</template>
