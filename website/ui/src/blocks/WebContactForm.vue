<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type { FormSchema, FormField } from '../contracts/index.ts'
import { cn } from '../lib/cn.ts'
import { componentStrings } from '../componentStrings.ts'
import {
  buildPayload,
  defaultFor,
  groupDefaultItems,
  isFieldDisabled,
  isFieldRequired,
  isFieldVisible,
  isRepeatable,
  spanClass,
  validateFieldFull,
  validateForm,
  type FormFile,
  type FormValue,
  type FormValues,
} from '../lib/form.ts'
import FormFieldControl from './WebFormFieldControl.vue'

/**
 * 通用表单 —— 按平台 FormSchema 动态渲染全部字段类型并提交。
 *
 * - 字段类型：text/email/tel/url/number/radio/checkbox/select/textarea/
 *   file/date/time/datetime/address/consent/group（堆叠）/list（子表网格）
 * - 字段依赖：visible_when / required_when / disabled_when（单条件或复合 and|or）
 * - 规则引擎：field.rules，level=1 阻断提交 / level=2 仅提示；schema.settings.rule_spec 控制是否显示规范选择器
 * - 校验语义与后端 FormSubmissionValidator 对齐（前端先行提示，后端权威）。
 * - 文案默认值登记在 componentStrings.WebContactForm；可注入 t 函数做多语言。
 */

export type { FormValue, FormValues }

export interface FormT {
  (source: string, vars?: Record<string, string | number | undefined>): string
}

const props = withDefaults(defineProps<{
  schema?: FormSchema | null
  t?: FormT
  /** ruleSpecId：规范选择器当前选中 id（未启用时 undefined）；multipart 文件列表值为 FormFile（含 raw）。 */
  submit?: (payload: Record<string, unknown>, files: Record<string, FormFile[]>, ruleSpecId?: number | null) => Promise<unknown>
  class?: string
}>(), {
  schema: null,
  t: undefined,
  submit: undefined,
  class: '',
})

const t = (source: string, vars?: Record<string, string | number | undefined>): string => {
  if (props.t) return props.t(source, vars)
  if (!vars) return componentStrings.WebContactForm[source.replace(/^Form./, '') as keyof typeof componentStrings.WebContactForm] as string ?? source
  const template = componentStrings.WebContactForm[source.replace(/^Form./, '') as keyof typeof componentStrings.WebContactForm] as string | undefined
  return (template ?? source).replace(/\{(\w+)\}/g, (m, name: string) => {
    const v = vars[name]
    return v !== undefined ? String(v) : m
  })
}

const fields = computed<FormField[]>(() => props.schema?.fields ?? [])
const layout = computed(() => (props.schema?.layout as { label_position?: string; submit_align?: string; gap?: string } | null) ?? {})
const labelPosition = computed(() => layout.value.label_position ?? 'top')
const submitAlign = computed(() => layout.value.submit_align ?? 'left')
const gap = computed(() => layout.value.gap ?? 'md')

const settings = computed(() => (props.schema as Record<string, unknown> | null)?.settings as
  | { rule_spec?: { enabled?: boolean; options?: { rule_id: number; label?: string }[] } }
  | undefined)
const ruleSpec = computed(() => settings.value?.rule_spec)
const ruleSpecEnabled = computed(() => Boolean(ruleSpec.value?.enabled))
const ruleSpecOptions = computed(() => ruleSpec.value?.options ?? [])

const values = reactive<FormValues>({})
const files = reactive<Record<string, FormFile[]>>({})
const errors = reactive<Record<string, string>>({})
const warnings = reactive<Record<string, string>>({})
// 规范选择：rule_spec 未启用时为 undefined（全部 bundle 生效）；启用时默认 0（仅 rule_id=0 恒生效）
const selectedRuleId = ref<number | null>(0)
const effectiveSpecId = computed(() => (ruleSpecEnabled.value ? selectedRuleId.value : undefined))
const submitting = ref(false)
const submitError = ref<string | null>(null)
const done = ref(false)

watch(fields, (list) => {
  for (const field of list) {
    if (!(field.name in values)) {
      values[field.name] = isRepeatable(field) ? groupDefaultItems(field) : defaultFor(field)
    }
    if (field.type === 'file' && !(field.name in files)) files[field.name] = []
  }
}, { immediate: true })

const visibleFields = computed<FormField[]>(() => fields.value.filter((f) => isFieldVisible(f, values)))

function hasValue(v: FormValue): boolean {
  if (v === null || v === undefined) return false
  if (typeof v === 'string') return v.trim() !== ''
  if (Array.isArray(v)) return v.length > 0
  return true
}

function setFieldValue(field: FormField, v: FormValue) {
  values[field.name] = v
  delete errors[field.name]
  delete warnings[field.name]
}

function setFieldFiles(field: FormField, list: FormFile[]) {
  files[field.name] = list
  const full = validateFieldFull(field, values[field.name], list, values, effectiveSpecId.value)
  if (full.error) errors[field.name] = t(full.error)
  else delete errors[field.name]
  if (full.warning) warnings[field.name] = t('Form.warningHint', { message: full.warning })
  else delete warnings[field.name]
}

/** 规范切换后：清空提示，仅对有值字段重新校验（避免空必填噪音）。 */
function revalidate() {
  for (const k of Object.keys(errors)) delete errors[k]
  for (const k of Object.keys(warnings)) delete warnings[k]
  for (const field of visibleFields.value) {
    if (!hasValue(values[field.name] as FormValue)) continue
    const full = validateFieldFull(field, values[field.name] as FormValue, files[field.name] ?? [], values, effectiveSpecId.value)
    if (full.error) errors[field.name] = t(full.error)
    else if (full.warning) warnings[field.name] = t('Form.warningHint', { message: full.warning })
  }
}

function onSpecChange(v: number | null) {
  selectedRuleId.value = v
  revalidate()
}

async function onSubmit() {
  const { errors: errs, warnings: warns } = validateForm(fields.value, values, files, effectiveSpecId.value)
  for (const k of Object.keys(errors)) delete errors[k]
  for (const k of Object.keys(warnings)) delete warnings[k]
  for (const [name, key] of Object.entries(errs)) errors[name] = t(key)
  for (const [name, msg] of Object.entries(warns)) warnings[name] = t('Form.warningHint', { message: msg })
  if (Object.keys(errs).length > 0) return
  if (!props.submit) return
  submitting.value = true
  submitError.value = null
  try {
    await props.submit(buildPayload(fields.value, values), { ...files }, ruleSpecEnabled.value ? selectedRuleId.value : undefined)
    done.value = true
  } catch (e) {
    submitError.value = e instanceof Error ? e.message : t('Form.submitFailed')
  } finally {
    submitting.value = false
  }
}

const successTitle = computed(() => props.schema?.title ?? componentStrings.WebContactForm.successTitle)
const successMessage = computed(() => props.schema?.success_message ?? componentStrings.WebContactForm.successDefault)
const submitText = computed(() => props.schema?.submit_text || componentStrings.WebContactForm.submit)

function fieldLabel(field: FormField): string {
  return field.label ?? field.name
}

function fieldDisabled(field: FormField): boolean {
  return isFieldDisabled(field, values)
}

function fieldRequired(field: FormField): boolean {
  return isFieldRequired(field, values) && !fieldDisabled(field)
}
</script>

<template>
  <div :class="cn('web-form rounded-card border border-border bg-card p-6 shadow-card sm:p-8', $props.class)">
    <div v-if="done" class="flex flex-col items-center gap-4 py-10 text-center">
      <span class="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <svg class="size-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <path d="m9 11 3 3L22 4" />
        </svg>
      </span>
      <div class="space-y-1">
        <h3 class="text-lg font-bold text-foreground">{{ successTitle }}</h3>
        <p v-if="successMessage" class="text-sm text-muted-foreground">{{ successMessage }}</p>
      </div>
    </div>

    <form v-else novalidate class="space-y-4" @submit.prevent="onSubmit">
      <!-- 校验规范选择器（schema.settings.rule_spec.enabled 时显示） -->
      <div
        v-if="ruleSpecEnabled && ruleSpecOptions.length > 0"
        class="flex flex-wrap items-center gap-3 rounded-md border border-border bg-muted/30 px-3 py-2.5"
      >
        <span class="text-sm font-medium text-foreground">{{ t('Form.specLabel') }}</span>
        <select
          :value="selectedRuleId"
          class="h-9 rounded-md border border-input bg-background px-2.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          @change="onSpecChange(Number(($event.target as HTMLSelectElement).value))"
        >
          <option :value="0">{{ t('Form.specDefault') }}</option>
          <option v-for="opt in ruleSpecOptions" :key="opt.rule_id" :value="opt.rule_id">
            {{ opt.label ?? `#${opt.rule_id}` }}
          </option>
        </select>
      </div>

      <div
        :class="[
          labelPosition === 'left' ? '' : 'grid grid-cols-12',
          gap === 'sm' ? 'gap-3' : gap === 'lg' ? 'gap-6' : 'gap-4',
        ]"
      >
        <div
          v-for="field in visibleFields"
          :key="field.name"
          :class="labelPosition === 'left' ? '' : spanClass(field, field.type === 'textarea')"
        >
          <div v-if="labelPosition === 'left'" class="grid gap-3 sm:grid-cols-[180px_1fr] sm:items-start">
            <label :for="'web-f-' + field.name" class="pt-3 text-right text-sm font-medium text-foreground">
              {{ fieldLabel(field) }}
              <span v-if="fieldRequired(field)" class="text-destructive"> *</span>
            </label>
            <div>
              <FormFieldControl
                :field="field"
                :model-value="values[field.name]"
                :files="files[field.name] ?? []"
                :t="t"
                :scope="values"
                :disabled="fieldDisabled(field)"
                @update:model-value="setFieldValue(field, $event)"
                @update:files="setFieldFiles(field, $event)"
              />
              <p v-if="errors[field.name]" class="mt-1.5 text-sm text-destructive">{{ errors[field.name] }}</p>
              <p v-if="warnings[field.name]" class="mt-1.5 text-sm text-amber-600 dark:text-amber-400">{{ warnings[field.name] }}</p>
              <p v-if="field.help" class="mt-1.5 text-xs text-muted-foreground">{{ field.help }}</p>
            </div>
          </div>

          <template v-else>
            <label
              v-if="labelPosition === 'top' && field.type !== 'consent'"
              :for="'web-f-' + field.name"
              class="mb-1.5 block text-sm font-medium text-foreground"
            >
              {{ fieldLabel(field) }}
              <span v-if="fieldRequired(field)" class="text-destructive"> *</span>
            </label>
            <FormFieldControl
              :field="field"
              :model-value="values[field.name]"
              :files="files[field.name] ?? []"
              :t="t"
              :scope="values"
              :disabled="fieldDisabled(field)"
              @update:model-value="setFieldValue(field, $event)"
              @update:files="setFieldFiles(field, $event)"
            />
            <p v-if="errors[field.name]" class="mt-1.5 text-sm text-destructive">{{ errors[field.name] }}</p>
            <p v-if="warnings[field.name]" class="mt-1.5 text-sm text-amber-600 dark:text-amber-400">{{ warnings[field.name] }}</p>
            <p v-if="field.help" class="mt-1.5 text-xs text-muted-foreground">{{ field.help }}</p>
          </template>
        </div>
      </div>

      <div
        :class="[
          'flex flex-wrap items-center gap-4 pt-1',
          submitAlign === 'center' ? 'justify-center' : submitAlign === 'right' ? 'justify-end' : submitAlign === 'stretch' ? '' : '',
        ]"
      >
        <button
          type="submit"
          :disabled="submitting"
          :class="[
            'inline-flex h-11 items-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 transition-colors hover:bg-primary/90 disabled:opacity-60',
            submitAlign === 'stretch' ? 'w-full justify-center' : '',
          ]"
        >
          {{ submitting ? t('Form.submitting') : submitText }}
        </button>
        <p v-if="submitError" class="text-sm text-destructive">{{ submitError }}</p>
      </div>
    </form>
  </div>
</template>
