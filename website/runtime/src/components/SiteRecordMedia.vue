<script setup lang="ts">
/**
 * SiteRecordMedia —— 记录详情媒体区缺省实现:主图 + 可点击缩略图(切换主图/选中态)。
 * 站点可在 app/components/site/SiteRecordMedia.vue 同名覆盖(如品牌缺图占位)。
 */
import { computed, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    cover?: string | null
    gallery?: Array<{ url: string; alt?: string | null }>
    title?: string | null
  }>(),
  { cover: null, gallery: () => [], title: null },
)

const slides = computed(() => {
  const list = props.gallery?.length ? props.gallery : props.cover ? [{ url: props.cover, alt: props.title ?? '' }] : []
  return list.filter((g) => !!g.url)
})
const active = ref(0)
watch(slides, () => {
  active.value = 0
})
const activeUrl = computed(() => slides.value[active.value]?.url ?? null)
</script>

<template>
  <figure v-if="activeUrl" class="group overflow-hidden rounded-card bg-white shadow-card">
    <img :src="activeUrl" :alt="title ?? ''" class="aspect-[var(--ratio-record,1/1)] w-full [object-fit:var(--web-record-media-fit,cover)] transition duration-300 ease-out hover:scale-105" loading="eager">
  </figure>
  <div v-if="slides.length > 1" class="mt-3 grid grid-cols-5 gap-2.5 sm:grid-cols-6">
    <button
      v-for="(g, i) in slides.slice(0, 12)"
      :key="g.url + i"
      type="button"
      class="overflow-hidden rounded-md border-2 bg-white transition-colors"
      :class="i === active ? 'border-primary' : 'border-transparent opacity-80 hover:opacity-100'"
      :aria-label="g.alt ?? String(i + 1)"
      @click="active = i"
    >
      <img :src="g.url" :alt="g.alt ?? ''" class="aspect-square size-full object-cover" loading="lazy">
    </button>
  </div>
</template>
