<script setup lang="ts">
/** WebRichText —— CMS 富文本渲染（内容源为客户自有后台，受信）。 */
withDefaults(
  defineProps<{
    html?: string | null
    tag?: 'div' | 'article' | 'section'
  }>(),
  { html: null, tag: 'div' },
)
</script>

<template>
  <component :is="tag" class="web-richtext web-prose" v-html="html ?? ''" />
</template>
