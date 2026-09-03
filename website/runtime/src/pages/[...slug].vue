<script setup lang="ts">
import { useHead, navigateTo } from 'nuxt/app'
import { useT } from '../composables/useT.ts'
import { useLocale } from '../composables/useLocale.ts'
import { useSiteNavigation } from '../lib/site.ts'
/** 模板：通配路由 —— /about 短链重定向；其余 404。 */

const { t } = useT()
const { logicalPath } = useLocale()
const cfg = useSiteNavigation()

if (logicalPath.value === '/about') {
  await navigateTo(`/about/${cfg.value.defaultAboutSlug}`, { replace: true })
}

useHead({ title: () => t('页面未找到') })
</script>

<template>
  <div class="bg-background">
    <div class="mx-auto flex min-h-[60vh] max-w-site flex-col items-center justify-center px-4 py-24 text-center sm:px-6">
      <p class="web-num text-[7rem] font-bold leading-none tracking-tight text-primary/15 sm:text-[10rem]">404</p>

      <div class="mt-8 space-y-4">
        <h1 class="font-display text-display-md font-bold">{{ t('页面未找到') }}</h1>
        <p class="text-muted-foreground">{{ t('您访问的地址不存在或已被移动，请尝试以下入口。') }}</p>
      </div>

      <nav class="mt-8 flex flex-wrap justify-center gap-3" :aria-label="t('常用入口')">
        <a href="/" class="inline-flex h-10 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground shadow-card transition-colors hover:bg-primary/90">{{ t('返回首页') }}</a>
        <a href="/products" class="inline-flex h-10 items-center rounded-md border border-border bg-card px-5 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary">{{ t('产品中心') }}</a>
        <a :href="`/about/${cfg.defaultAboutSlug}`" class="inline-flex h-10 items-center rounded-md border border-border bg-card px-5 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary">{{ t('关于我们') }}</a>
        <a :href="cfg.contactPath" class="inline-flex h-10 items-center rounded-md border border-border bg-card px-5 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary">{{ t('联系我们') }}</a>
      </nav>
    </div>
  </div>
</template>
