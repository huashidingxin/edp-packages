<script setup lang="ts">
import { useSiteNavigation } from '../../lib/site.ts'
/** 模板：/gallery → 站点默认图集栏目。 */
import { navigateTo } from 'nuxt/app'

const cfg = useSiteNavigation()
await navigateTo(`/gallery/${cfg.value.defaultGallerySlug}`, { replace: true })
</script>

<template>
  <div />
</template>
