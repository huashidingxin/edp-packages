<script setup lang="ts">
import { submitForm, useBootstrapSite, useSiteClient, useSiteRecord } from '../../composables/useSite.ts'
import { useT } from '../../composables/useT.ts'
import { useLocale } from '../../composables/useLocale.ts'
import { useLocaleLight } from '../../composables/useLocaleLight.ts'
import { recordPath, useSiteNavigation } from '../../lib/site.ts'
/** 招聘详情（通用：职位 meta + 富文本描述 + 申请表单/mailto 投递 + 上下职位）。 */
import { computed, ref, watch } from 'vue'
import { navigateTo, useHead, useRoute } from 'nuxt/app'
import { WebBreadcrumbs, WebContactForm, WebRichText } from '@edp/website-ui'
import type { FormSchema } from '@edp/website-ui/contracts'

const route = useRoute()
const { t } = useT()
const { localePath } = useLocale()
const cfg = useSiteNavigation()
const site = useBootstrapSite()

const slug = computed(() => String(route.params.slug ?? ''))
const isDetail = computed(() => /^\d+$/.test(slug.value))
if (!isDetail.value) {
  await navigateTo('/jobs', { replace: true })
}

const { data: record } = useSiteRecord({
  type: 'job',
  id: computed(() => (isDetail.value ? Number(slug.value) : null)),
})

const recValues = computed<any>(() => record.value?.record?.values ?? null)
const contact = computed(() => site.value.branding?.contact ?? null)

const crumbs = computed(() => [
  { label: t('首页'), href: '/' },
  { label: t('招聘中心'), href: '/jobs' },
  { label: recValues.value?.title ?? t('职位详情') },
])

/* ---- 申请表单（表单关联，三级回落）：职位级 apply_form_code
 * → 站点渠道默认（campus → applyFormCodeCampus，否则 applyFormCode）
 * → 都不配则回 mailto CTA（零配置站点不被破坏）。---- */
const channel = computed<'social' | 'campus'>(() => (recValues.value?.channel === 'campus' ? 'campus' : 'social'))
const applyFormCode = computed<string | undefined>(() => {
  const job = String(recValues.value?.apply_form_code ?? '').trim()
  if (job) return job
  const siteCode = channel.value === 'campus'
    ? (cfg.value.applyFormCodeCampus ?? cfg.value.applyFormCode)
    : cfg.value.applyFormCode
  return siteCode || undefined
})

const formSchema = ref<FormSchema | null>(null)
watch([applyFormCode, recValues], () => {
  const code = applyFormCode.value
  if (!code) {
    formSchema.value = null
    return
  }
  useSiteClient().formSchema(code, { locale: useLocaleLight().locale.value || undefined })
    .then((s) => (formSchema.value = s))
    .catch(() => (formSchema.value = null))
}, { immediate: true })

const jobId = computed(() => (isDetail.value ? Number(slug.value) : null))
const applySubmitter = async (payload: Record<string, unknown>, files: Record<string, { raw?: File }[]>) => {
  const code = applyFormCode.value
  if (!code) throw new Error(t('未配置申请表单'))
  const raw: Record<string, File[]> = Object.fromEntries(
    Object.entries(files).map(([k, list]) => [k, list.map((f) => f.raw).filter((f): f is File => !!f)]),
  )
  // job_id 只传 id，职位标题/部门由服务端回查注入（防伪造）
  await submitForm(code, payload, { files: raw, context: { job_id: jobId.value } })
}

/** YYYY-MM-DD 前缀 → YYYY/MM/DD；格式不符返回 null。 */
function dateText(v: unknown): string | null {
  if (!v) return null
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[1]}/${m[2]}/${m[3]}` : null
}

const dateOf = computed(() => {
  const v = recValues.value?.published_at
  if (!v) return null
  const d = new Date(v as string)
  return Number.isNaN(d.getTime()) ? null : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})

useHead({
  title: () => recValues.value?.title || t('职位详情'),
  meta: [{ name: 'description', content: () => recValues.value?.summary || '' }],
})
</script>

<template>
  <div v-if="record?.record">
    <!-- 面包屑带 -->
    <section class="bg-secondary text-secondary-foreground">
      <div class="mx-auto max-w-site px-4 py-8 sm:px-6 sm:py-10">
        <WebBreadcrumbs :items="crumbs" :min-levels="2" on-dark />
      </div>
    </section>

    <!-- 详情主体 -->
    <div class="bg-background py-12 sm:py-16">
      <div class="mx-auto max-w-site px-4 sm:px-6">
        <article class="mx-auto max-w-4xl">
          <h1 class="font-display text-display-md font-bold leading-tight">{{ recValues?.title }}</h1>

          <!-- 职位 meta：部门/地点/类型胶囊 + 薪资/截止/发布 -->
          <div class="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2.5 text-sm text-muted-foreground">
            <span v-if="recValues?.department" class="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">{{ recValues.department }}</span>
            <span v-if="recValues?.location" class="inline-flex items-center gap-1.5">
              <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
              {{ recValues.location }}
            </span>
            <span v-if="recValues?.employment_type" class="inline-flex items-center gap-1.5">
              <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
              {{ recValues.employment_type }}
            </span>
            <span v-if="recValues?.salary_range" class="web-num inline-flex items-center gap-1.5 font-display text-lg font-bold text-primary">
              <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              {{ recValues.salary_range }}
            </span>
            <span v-if="dateText(recValues?.deadline)" class="web-num inline-flex items-center gap-1.5">
              <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              {{ t('截止 {date}', { date: dateText(recValues?.deadline) ?? '' }) }}
            </span>
            <span v-if="dateOf" class="web-num inline-flex items-center gap-1.5">
              <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
              {{ t('发布于 {date}', { date: dateOf }) }}
            </span>
          </div>

          <WebRichText v-if="recValues?.body" :html="recValues.body" tag="section" class="mt-8" />

          <!-- 投递：申请表单（表单关联，企业自定义字段）或 mailto CTA 兜底 -->
          <WebContactForm
            v-if="applyFormCode && formSchema"
            :schema="formSchema"
            :t="t"
            :submit="applySubmitter"
            class="mt-10"
          />
          <div v-else class="mt-10 rounded-card border border-border bg-card p-6 shadow-card sm:p-8">
            <h2 class="font-display text-lg font-bold text-foreground">{{ t('投递简历') }}</h2>
            <p class="mt-1.5 text-sm leading-relaxed text-muted-foreground">{{ t('对该职位感兴趣？欢迎通过以下方式联系我们，期待你的加入。') }}</p>
            <div class="mt-5 flex flex-wrap items-center gap-4">
              <a
                v-if="contact?.email"
                :href="`mailto:${contact.email}`"
                class="inline-flex h-11 items-center gap-2 rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground shadow-card transition-colors hover:bg-primary/90"
              >
                <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4Z"/></svg>
                {{ t('投递简历') }}
              </a>
              <a
                v-else
                :href="localePath(cfg.contactPath)"
                class="inline-flex h-11 items-center gap-2 rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground shadow-card transition-colors hover:bg-primary/90"
              >
                <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4Z"/></svg>
                {{ t('联系我们') }}
              </a>
              <div class="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                <a v-if="contact?.phone" :href="`tel:${contact.phone}`" class="web-num inline-flex items-center gap-1.5 text-foreground transition-colors hover:text-primary">
                  <svg class="size-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                  {{ contact.phone }}
                </a>
              </div>
            </div>
          </div>

          <!-- 上/下职位切换 -->
          <nav class="mt-12 grid gap-4 border-t border-border pt-8 sm:grid-cols-2" :aria-label="t('职位切换')">
            <a
              v-if="record?.navigation?.previous"
              :href="localePath(recordPath('job', record.navigation.previous.id))"
              class="group rounded-card bg-card p-5 shadow-card web-motion hover:-translate-y-1 hover:shadow-lift"
            >
              <p class="text-xs text-muted-foreground">{{ t('上一个职位') }}</p>
              <p class="web-clamp-2 mt-1 text-sm font-medium group-hover:text-primary">{{ record.navigation.previous.title }}</p>
            </a>
            <span v-else aria-hidden="true" />
            <a
              v-if="record?.navigation?.next"
              :href="localePath(recordPath('job', record.navigation.next.id))"
              class="group rounded-card bg-card p-5 text-right shadow-card web-motion hover:-translate-y-1 hover:shadow-lift sm:col-start-2"
            >
              <p class="text-xs text-muted-foreground">{{ t('下一个职位') }}</p>
              <p class="web-clamp-2 mt-1 text-sm font-medium group-hover:text-primary">{{ record.navigation.next.title }}</p>
            </a>
          </nav>
        </article>
      </div>
    </div>
  </div>

  <!-- 记录不存在 / 未发布：与列表页一致的空态 -->
  <div v-else class="bg-background">
    <div class="mx-auto flex min-h-[50vh] max-w-site flex-col items-center justify-center px-4 py-24 text-center sm:px-6">
      <div class="grid size-16 place-items-center rounded-full bg-muted">
        <svg class="size-8 text-muted-foreground/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect width="20" height="14" x="2" y="7" rx="2" ry="2"/>
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
        </svg>
      </div>
      <p class="mt-6 text-sm text-muted-foreground">{{ t('该职位不存在或已下架。') }}</p>
      <a :href="localePath('/jobs')" class="mt-6 inline-flex h-10 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground shadow-card transition-colors hover:bg-primary/90">{{ t('返回招聘中心') }}</a>
    </div>
  </div>
</template>
