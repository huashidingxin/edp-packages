<script setup lang="ts">
/** WebGrid —— 响应式栅格组合。 */
import { computed } from 'vue'
import { cn } from '../lib/cn.ts'

const props = withDefaults(
  defineProps<{
    cols?: 1 | 2 | 3 | 4 | 5 | 6
    gap?: 'sm' | 'md' | 'lg'
  }>(),
  { cols: 3, gap: 'md' },
)

const GAP = { sm: 'gap-3', md: 'gap-5', lg: 'gap-8' } as const

const GRID_LADDER: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-2 lg:grid-cols-4',
  5: 'grid-cols-2 md:grid-cols-3 xl:grid-cols-5',
  6: 'grid-cols-2 md:grid-cols-3 xl:grid-cols-6',
}

const rootClass = computed(() =>
  cn('web-grid grid', GRID_LADDER[props.cols], GAP[props.gap]),
)
</script>

<template>
  <div :class="rootClass" :data-cols="cols">
    <slot />
  </div>
</template>
