<script setup lang="ts">
import { useSiteRecord } from '../../composables/useSite.ts'
import { useT } from '../../composables/useT.ts'
import { useLocale } from '../../composables/useLocale.ts'
import { recordPath } from '../../lib/site.ts'
import { cleanBio, degreeOf, expertiseList, introOf, phoneOf, videoOf } from '../../lib/profile.ts'
/** 团队成员详情（通用：独立 team-member 模型；档案卡 + 简介 + 视频 + 正文 + 上下成员）。 */
import { computed } from 'vue'
import { navigateTo, useHead, useRoute } from 'nuxt/app'
import { WebBreadcrumbs, WebRichText, WebShare } from '@edp/website-ui'

const route = useRoute()
const { t } = useT()
const { localePath } = useLocale()

const id = computed(() => {
  const raw = String(route.params.id ?? '')
  return /^\d+$/.test(raw) ? Number(raw) : null
})
if (id.value === null) {
  await navigateTo('/team', { replace: true })
}

const { data: record } = useSiteRecord({
  type: 'team-member',
  id,
})

const recValues = computed<any>(() => record.value?.record?.values ?? null)
const body = computed(() => String(recValues.value?.bio ?? recValues.value?.body ?? ''))
const avatar = computed(() => String(recValues.value?.avatar ?? recValues.value?.image ?? ''))
const displayName = computed(() => String(recValues.value?.title ?? recValues.value?.name ?? ''))
const role = computed(() => String(recValues.value?.summary ?? recValues.value?.role ?? ''))
const degree = computed(() => degreeOf(body.value, displayName.value))
const memberPhone = computed(() => phoneOf(body.value) || String(recValues.value?.phone ?? ''))
const memberEmail = computed(() => String(recValues.value?.email ?? ''))
const intro = computed(() => introOf(body.value))
const chips = computed(() => expertiseList(body.value, role.value))
const introVideo = computed(() => videoOf(body.value))
const detailBio = computed(() => cleanBio(body.value))

const crumbs = computed(() => [
  { label: t('首页'), href: '/' },
  { label: t('团队成员'), href: '/team' },
  { label: displayName.value || t('成员详情'), href: null as string | null },
])

useHead({
  title: () => displayName.value || t('成员详情'),
  meta: [{ name: 'description', content: () => role.value.slice(0, 120) }],
})

/** 上下成员：后端 record_navigation 只含 {title, id, slug}，path 由前端按 kind 拼接。 */
const previous = computed(() => record.value?.navigation?.previous ?? null)
const next = computed(() => record.value?.navigation?.next ?? null)
</script>

<template>
  <div>
    <section class="web-band-dark py-14">
      <div class="mx-auto max-w-site px-4 sm:px-6">
        <WebBreadcrumbs :items="crumbs" on-dark />
      </div>
    </section>

    <div class="bg-background py-12 sm:py-16">
      <div class="mx-auto max-w-site px-4 sm:px-6">
        <div class="flex flex-col gap-10 lg:flex-row">
          <!-- 档案卡 -->
          <div class="w-full shrink-0 lg:w-80">
            <figure class="overflow-hidden rounded-card border border-border bg-card shadow-card lg:sticky lg:top-20">
              <div class="bg-muted">
                <img
                  v-if="avatar"
                  :src="avatar"
                  :alt="displayName"
                  class="aspect-[3/4] w-full object-cover object-top"
                  loading="eager"
                >
                <span v-else class="grid aspect-[3/4] w-full place-items-center bg-gradient-to-br from-muted to-accent">
                  <svg
                    class="size-16 text-muted-foreground/40"
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
              </div>
              <figcaption class="p-5">
                <p class="font-display text-xl font-bold tracking-tight">{{ displayName }}</p>
                <p v-if="degree" class="mt-1 text-sm text-muted-foreground">{{ degree }}</p>
                <div v-if="chips.length" class="mt-3 flex flex-wrap gap-1.5">
                  <span v-for="chip in chips" :key="chip" class="inline-flex h-6 items-center rounded-full border border-primary/30 bg-accent/60 px-2.5 text-[11px] font-medium text-accent-foreground">{{ chip }}</span>
                </div>
                <div v-if="memberPhone || memberEmail" class="mt-4 flex flex-col gap-2">
                  <a
                    v-if="memberPhone"
                    :href="`tel:${memberPhone.replace(/[\s-]/g, '')}`"
                    class="web-num inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5"
                  >{{ memberPhone }}</a>
                  <a
                    v-if="memberEmail"
                    :href="`mailto:${memberEmail}`"
                    class="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border px-4 text-sm font-semibold transition-colors hover:border-primary hover:text-primary"
                  >{{ memberEmail }}</a>
                </div>
              </figcaption>
            </figure>
          </div>

          <!-- 简介 + 视频 + 正文 -->
          <article class="min-w-0 flex-1">
            <section v-if="intro" :aria-label="t('个人简介')">
              <h2 class="font-display text-lg font-bold">{{ t('个人简介') }}</h2>
              <p class="mt-3 text-[15px] leading-relaxed text-muted-foreground">{{ intro }}</p>
            </section>

            <section v-if="introVideo" class="mt-8" :aria-label="t('视频介绍')">
              <h2 class="font-display text-lg font-bold">{{ t('视频介绍') }}</h2>
              <figure class="mt-3 overflow-hidden rounded-card border border-border shadow-card">
                <video :src="introVideo" controls preload="metadata" playsinline class="aspect-video w-full bg-black" />
              </figure>
            </section>

            <section v-if="detailBio" class="mt-8" :aria-label="t('详细介绍')">
              <h2 class="font-display text-lg font-bold">{{ t('详细介绍') }}</h2>
              <WebRichText :html="detailBio" tag="div" class="mt-3" />
            </section>

            <div class="mt-8">
              <WebShare :title="displayName" :summary="role.slice(0, 120)" />
            </div>

            <nav class="mt-10 grid gap-4 border-t border-border pt-8 sm:grid-cols-2" :aria-label="t('成员切换')">
              <a
                v-if="previous"
                :href="localePath(recordPath('team', previous.id))"
                class="group rounded-card border border-border bg-card p-5 shadow-card web-motion hover:-translate-y-1 hover:shadow-lift"
              >
                <p class="text-xs text-muted-foreground">{{ t('上一个') }}</p>
                <p class="mt-1 line-clamp-2 text-sm font-medium group-hover:text-primary">{{ previous.title }}</p>
              </a>
              <span v-else aria-hidden="true" />
              <a
                v-if="next"
                :href="localePath(recordPath('team', next.id))"
                class="group rounded-card border border-border bg-card p-5 text-right shadow-card web-motion hover:-translate-y-1 hover:shadow-lift sm:col-start-2"
              >
                <p class="text-xs text-muted-foreground">{{ t('下一个') }}</p>
                <p class="mt-1 line-clamp-2 text-sm font-medium group-hover:text-primary">{{ next.title }}</p>
              </a>
            </nav>
            <a :href="localePath('/team')" class="mt-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-primary">
              {{ t('返回团队') }}
            </a>
          </article>
        </div>
      </div>
    </div>
  </div>
</template>
