<script setup lang="ts">
import { useSiteNavigation } from '../../lib/site.ts'
/** 模板：/articles → 站点默认文章栏目。 */
import { navigateTo } from 'nuxt/app'

const cfg = useSiteNavigation()
await navigateTo(`/articles/${cfg.value.defaultArticlesSlug}`, { replace: true })
</script>

<template>
  <div />
</template>
