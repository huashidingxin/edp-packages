<script setup lang="ts">
/**
 * SiteRecordMedia —— 记录详情媒体区缺省实现：主图 / 视频 / 3D 模型 + 可点击缩略图。
 *
 * 按 mediaBadge 分流：
 *   IMG → <img>；VID → <video controls>；3D → <WebModelViewer>。
 * 站点可在 app/components/site/SiteRecordMedia.vue 同名覆盖（如品牌缺图占位）。
 *
 * 部件变量：--ratio-record（缺省 1/1）、--web-record-media-fit（缺省 cover）。
 */
import { computed, ref, watch } from 'vue'
import {
  mediaBadge,
  mediaSrc,
  mediaThumb,
  normalizeMedia,
  WebModelViewer,
  type MediaItem,
} from '@edp/website-ui'

const props = withDefaults(
  defineProps<{
    cover?: string | null
    gallery?: MediaItem[]
    title?: string | null
  }>(),
  { cover: null, gallery: () => [], title: null },
)

const slides = computed(() => normalizeMedia(props.gallery, props.cover, props.title ?? undefined))
const active = ref(0)
watch(slides, () => {
  active.value = 0
})
const current = computed<MediaItem | null>(() => slides.value[active.value] ?? null)
const currentBadge = computed(() => (current.value ? mediaBadge(current.value) : 'IMG'))
const currentSrc = computed(() => (current.value ? mediaSrc(current.value) : null))
const currentPoster = computed(() => current.value?.poster ?? null)
const hasMedia = computed(() => slides.value.length > 0)

/** 重置视频/模型：切走时暂停上一个。 */
const videoRef = ref<HTMLVideoElement | null>(null)
watch(active, () => {
  const v = videoRef.value
  if (v && !v.paused) v.pause()
})
</script>

<template>
  <div>
    <!-- 主区：按类型分流 -->
    <figure v-if="currentSrc && currentBadge === 'IMG'" class="group overflow-hidden rounded-card bg-white shadow-card">
      <img
        :src="currentSrc"
        :alt="title ?? ''"
        class="aspect-[var(--ratio-record,1/1)] w-full [object-fit:var(--web-record-media-fit,cover)] transition duration-300 ease-out hover:scale-105"
        loading="eager"
      >
    </figure>

    <figure v-else-if="currentSrc && currentBadge === 'VID'" class="overflow-hidden rounded-card bg-black shadow-card">
      <video
        ref="videoRef"
        :src="currentSrc"
        :poster="currentPoster ?? undefined"
        controls
        preload="metadata"
        playsinline
        class="aspect-[var(--ratio-record,1/1)] w-full bg-black [object-fit:var(--web-record-media-fit,contain)]"
      />
    </figure>

    <figure v-else-if="currentSrc && currentBadge === '3D'">
      <WebModelViewer
        :src="currentSrc"
        :poster="currentPoster ?? cover"
        :alt="title"
        :auto-rotate="true"
      />
    </figure>

    <!-- 缩略图行：每条小图 + 类型徽标 -->
    <div v-if="slides.length > 1" class="mt-3 grid grid-cols-5 gap-2.5 sm:grid-cols-6">
      <button
        v-for="(g, i) in slides.slice(0, 12)"
        :key="mediaSrc(g) + i"
        type="button"
        class="relative overflow-hidden rounded-md border-2 bg-white transition-colors"
        :class="i === active ? 'border-primary' : 'border-transparent opacity-80 hover:opacity-100'"
        :aria-label="g.alt ?? String(i + 1)"
        @click="active = i"
      >
        <img :src="mediaThumb(g)" :alt="g.alt ?? ''" class="aspect-square size-full object-cover" loading="lazy">
        <span
          v-if="mediaBadge(g) !== 'IMG'"
          class="absolute bottom-0.5 right-0.5 rounded bg-black/60 px-1 text-[10px] font-bold leading-tight text-white"
        >{{ mediaBadge(g) }}</span>
      </button>
    </div>

    <!-- 兜底：完全无媒体 -->
    <div v-if="!hasMedia" class="grid aspect-[var(--ratio-record,1/1)] w-full place-items-center rounded-card border border-dashed border-border bg-muted text-sm text-muted-foreground">
      {{ title ?? '' }}
    </div>
  </div>
</template>
