<script setup lang="ts">
import { computed } from 'vue'
import type { FormField } from '../contracts/index.ts'
import { componentStrings } from '../componentStrings.ts'
import type { FormT } from './WebContactForm.vue'
import type { FormValue, FormFile, FormValues } from '../lib/form.ts'
import { defaultGroupItem, isFieldDisabled, isFieldRequired } from '../lib/form.ts'

/**
 * 单字段渲染控制 —— 覆盖全部 FormSchema 字段类型，支持 group / list 递归。
 * 由 Form.vue 使用；不直接对外。
 */

const props = withDefaults(defineProps<{
  field: FormField
  modelValue?: FormValue
  files?: FormFile[]
  t?: FormT
  isChild?: boolean
  /** 同级字段值快照，供 visible_when / required_when / disabled_when 求值。 */
  scope?: FormValues
  /** 父级强制禁用（级联到子字段）。 */
  disabled?: boolean
}>(), {
  modelValue: '',
  files: () => [],
  t: undefined,
  isChild: false,
  scope: () => ({}),
  disabled: false,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: FormValue): void
  (e: 'update:files', value: FormFile[]): void
}>()

const t = (source: string, vars?: Record<string, string | number | undefined>): string => {
  if (props.t) return props.t(source, vars)
  if (!vars) return componentStrings.WebContactForm[source.replace(/^Form./, '') as keyof typeof componentStrings.WebContactForm] as string ?? source
  const template = componentStrings.WebContactForm[source.replace(/^Form./, '') as keyof typeof componentStrings.WebContactForm] as string | undefined
  return (template ?? source).replace(/\{(\w+)\}/g, (m, name: string) => {
    const v = vars[name]
    return v !== undefined ? String(v) : m
  })
}

const field = computed(() => props.field)
const value = computed<FormValue>(() => props.modelValue ?? '')
const fileList = computed<FormFile[]>(() => props.files ?? [])
const scope = computed<FormValues>(() => props.scope ?? {})

function update(v: FormValue) {
  emit('update:modelValue', v)
}

function updateFiles(list: FormFile[]) {
  emit('update:files', list)
}

const isRequired = computed(() => isFieldRequired(field.value, scope.value))
const isDisabled = computed(() => Boolean(props.disabled) || isFieldDisabled(field.value, scope.value))
const isMultiple = computed(() => Boolean((field.value as Record<string, unknown>).multiple))
const label = computed(() => field.value.label ?? field.value.name)
const placeholder = computed(() => field.value.placeholder ?? field.value.label ?? field.value.name)
const rows = computed(() => Number((field.value as Record<string, unknown>).rows ?? 5))
const acceptAttr = computed(() => ((field.value as Record<string, unknown>).accept as string[] | undefined ?? []).join(','))
const maxFiles = computed(() => Number((field.value as Record<string, unknown>).max_files ?? 1))
const maxSizeMb = computed(() => Number((field.value as Record<string, unknown>).max_file_size_mb ?? 10))
const checkboxValues = computed<string[]>(() => (Array.isArray(value.value) ? value.value as string[] : []))
const groupChildren = computed<FormField[]>(() => (field.value as Record<string, unknown>).fields as FormField[] ?? [])
const groupItems = computed<FormValue[]>(() => (Array.isArray(value.value) ? value.value : []))
const groupMinItems = computed(() => ((field.value as Record<string, unknown>).repeatable as { min_items?: number } | null | undefined)?.min_items ?? 0)
const groupMaxItems = computed(() => ((field.value as Record<string, unknown>).repeatable as { max_items?: number } | null | undefined)?.max_items ?? 10)

const addressValue = computed<Record<string, unknown>>(() => (value.value && typeof value.value === 'object' && !Array.isArray(value.value) ? value.value as Record<string, unknown> : {}))
const ADDRESS_KEYS = ['country', 'province', 'city', 'district', 'town'] as const

const inputClass = 'w-full rounded-md border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:opacity-50'
const textClass = `${inputClass} h-11 px-3.5`

function inputType(): string {
  switch (field.value.type) {
    case 'email': return 'email'
    case 'tel': return 'tel'
    case 'url': return 'url'
    case 'number': return 'number'
    case 'date': {
      const dt = String((field.value as Record<string, unknown>).date_type ?? 'date')
      return dt === 'year' ? 'month' : dt === 'month' ? 'month' : 'date'
    }
    case 'time': return 'time'
    case 'datetime': return 'datetime-local'
    default: return 'text'
  }
}

const validation = computed<Record<string, unknown>>(() => (field.value as Record<string, unknown>).validation as Record<string, unknown> ?? {})

function onCheckboxToggle(optionValue: string, checked: boolean) {
  const current = [...checkboxValues.value]
  const idx = current.indexOf(optionValue)
  if (checked && idx === -1) current.push(optionValue)
  if (!checked && idx !== -1) current.splice(idx, 1)
  update(current)
}

function onSelectToggle(optionValue: string, checked: boolean) {
  const current = [...checkboxValues.value]
  const idx = current.indexOf(optionValue)
  if (checked && idx === -1) current.push(optionValue)
  if (!checked && idx !== -1) current.splice(idx, 1)
  update(current)
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  updateFiles(Array.from(input.files ?? []).map((f) => ({ name: f.name, size: f.size, raw: f })))
}

function removeFile(index: number) {
  const next = [...fileList.value]
  next.splice(index, 1)
  updateFiles(next)
}

function setAddress(key: string, val: string) {
  update({ ...addressValue.value, [key]: val })
}

function setChildValue(index: number, name: string, v: FormValue) {
  const items = [...groupItems.value]
  const item = ((items[index] ?? {}) as Record<string, unknown>) ?? {}
  item[name] = v
  items[index] = item as FormValue
  update(items)
}

function onGroupAdd() {
  update([...groupItems.value, defaultGroupItem(groupChildren.value)])
}

function onGroupRemove(index: number) {
  const next = [...groupItems.value]
  next.splice(index, 1)
  update(next)
}

function groupItemLabel(index: number): string {
  const label = ((field.value as Record<string, unknown>).repeatable as { item_label?: string } | null | undefined)?.item_label
    ?? componentStrings.WebContactForm.itemLabel
  return label.replace(/\{index\}/g, String(index + 1))
}

function groupAddText(): string {
  return ((field.value as Record<string, unknown>).repeatable as { add_text?: string } | null | undefined)?.add_text
    ?? componentStrings.WebContactForm.addItem
}

function groupRemoveText(): string {
  return ((field.value as Record<string, unknown>).repeatable as { remove_text?: string } | null | undefined)?.remove_text
    ?? componentStrings.WebContactForm.removeItem
}

const addressPlaceholder = (key: string): string => {
  const map: Record<string, string> = {
    country: componentStrings.WebContactForm.addressCountry,
    province: componentStrings.WebContactForm.addressProvince,
    city: componentStrings.WebContactForm.addressCity,
    district: componentStrings.WebContactForm.addressDistrict,
    town: componentStrings.WebContactForm.addressTown,
  }
  return map[key] ?? key
}
</script>

<template>
  <div>
    <!-- 文本类输入 -->
    <input
      v-if="['text', 'email', 'tel', 'url', 'number'].includes(field.type)"
      :id="'web-f-' + field.name"
      :type="inputType()"
      :value="String(value ?? '')"
      :placeholder="placeholder"
      :min="field.type === 'number' ? (validation.min as string | number | undefined) : undefined"
      :max="field.type === 'number' ? (validation.max as string | number | undefined) : undefined"
      :minlength="validation.min_length as number | undefined"
      :maxlength="validation.max_length as number | undefined"
      :required="isRequired"
      :disabled="isDisabled"
      :class="textClass"
      @input="update(($event.target as HTMLInputElement).value)"
    />

    <!-- 日期 / 时间 -->
    <input
      v-else-if="['date', 'time', 'datetime'].includes(field.type)"
      :id="'web-f-' + field.name"
      :type="inputType()"
      :value="String(value ?? '')"
      :required="isRequired"
      :disabled="isDisabled"
      :min="validation.min_date as string | undefined"
      :max="validation.max_date as string | undefined"
      :class="textClass"
      @input="update(($event.target as HTMLInputElement).value)"
    />

    <!-- 多行文本 -->
    <textarea
      v-else-if="field.type === 'textarea'"
      :id="'web-f-' + field.name"
      :value="String(value ?? '')"
      :placeholder="placeholder"
      :rows="rows"
      :required="isRequired"
      :disabled="isDisabled"
      :minlength="validation.min_length as number | undefined"
      :maxlength="validation.max_length as number | undefined"
      :class="`${inputClass} px-3.5 py-2.5`"
      @input="update(($event.target as HTMLTextAreaElement).value)"
    />

    <!-- 单选框组 -->
    <div v-else-if="field.type === 'radio'" class="flex flex-wrap gap-4 pt-1">
      <label v-for="opt in field.options" :key="opt.value" class="inline-flex items-center gap-2 text-sm" :class="{ 'opacity-60': isDisabled }">
        <input
          type="radio"
          :name="'web-f-' + field.name"
          :value="opt.value"
          :checked="String(value ?? '') === opt.value"
          :required="isRequired"
          :disabled="isDisabled"
          class="size-4 border-input text-primary focus-visible:ring-ring"
          @change="update(opt.value)"
        />
        <span>{{ opt.label }}</span>
      </label>
    </div>

    <!-- 复选框组（多选数组） -->
    <div v-else-if="field.type === 'checkbox'" class="flex flex-wrap gap-4 pt-1">
      <label v-for="opt in field.options" :key="opt.value" class="inline-flex items-center gap-2 text-sm" :class="{ 'opacity-60': isDisabled }">
        <input
          type="checkbox"
          :value="opt.value"
          :checked="checkboxValues.includes(opt.value)"
          :disabled="isDisabled"
          class="size-4 rounded border-input text-primary focus-visible:ring-ring"
          @change="onCheckboxToggle(opt.value, ($event.target as HTMLInputElement).checked)"
        />
        <span>{{ opt.label }}</span>
      </label>
    </div>

    <!-- 下拉（单选 / 多选） -->
    <div v-else-if="field.type === 'select'">
      <select
        v-if="isMultiple"
        :id="'web-f-' + field.name"
        :required="isRequired"
        :disabled="isDisabled"
        class="h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
        @change="update(Array.from(($event.target as HTMLSelectElement).selectedOptions).map((o) => o.value))"
      >
        <option
          v-for="opt in field.options"
          :key="opt.value"
          :value="opt.value"
          :selected="checkboxValues.includes(opt.value)"
        >
          {{ opt.label }}
        </option>
      </select>
      <select
        v-else
        :id="'web-f-' + field.name"
        :required="isRequired"
        :disabled="isDisabled"
        :value="String(value ?? '')"
        class="h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
        @change="update(($event.target as HTMLSelectElement).value)"
      >
        <option v-if="!value" value="" disabled selected>{{ placeholder }}</option>
        <option
          v-for="opt in field.options"
          :key="opt.value"
          :value="opt.value"
          :selected="String(value ?? '') === opt.value"
        >
          {{ opt.label }}
        </option>
      </select>
    </div>

    <!-- 文件上传 -->
    <div v-else-if="field.type === 'file'" class="space-y-2">
      <input
        :id="'web-f-' + field.name"
        type="file"
        :accept="acceptAttr"
        :multiple="maxFiles > 1"
        :required="isRequired && fileList.length === 0"
        :disabled="isDisabled"
        class="block w-full text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary disabled:opacity-60"
        @change="onFileChange"
      />
      <p class="text-xs text-muted-foreground">{{ t('Form.fileHint', { max: String(maxSizeMb) }) }}</p>
      <ul v-if="fileList.length > 0" class="space-y-1">
        <li v-for="(f, i) in fileList" :key="i" class="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-2.5 py-1.5 text-sm">
          <span class="truncate text-foreground">{{ f.name }}</span>
          <button v-if="!isDisabled" type="button" class="text-xs text-destructive" @click="removeFile(i)">{{ t('Form.removeFile') }}</button>
        </li>
      </ul>
    </div>

    <!-- 同意条款（布尔） -->
    <label v-else-if="field.type === 'consent'" class="inline-flex items-start gap-2 pt-1 text-sm" :class="{ 'opacity-60': isDisabled }">
      <input
        type="checkbox"
        :id="'web-f-' + field.name"
        :checked="value === true"
        :required="isRequired"
        :disabled="isDisabled"
        class="mt-0.5 size-4 rounded border-input text-primary focus-visible:ring-ring"
        @change="update(($event.target as HTMLInputElement).checked)"
      />
      <span>{{ label }}<span v-if="isRequired" class="text-destructive"> *</span></span>
    </label>

    <!-- 地址 -->
    <div v-else-if="field.type === 'address'" class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      <input
        v-for="key in ADDRESS_KEYS"
        :key="key"
        type="text"
        :value="String(addressValue[key] ?? '')"
        :placeholder="addressPlaceholder(key)"
        :disabled="isDisabled"
        :class="textClass"
        @input="setAddress(key, ($event.target as HTMLInputElement).value)"
      />
    </div>

    <!-- 可重复子表（紧凑网格） -->
    <div v-else-if="field.type === 'list'" class="space-y-3 rounded-md border border-border p-4">
      <div class="flex items-center justify-between">
        <span class="text-sm font-medium text-foreground">{{ label }}<span v-if="isRequired" class="text-destructive"> *</span></span>
        <button
          v-if="groupItems.length < groupMaxItems && !isDisabled"
          type="button"
          class="inline-flex items-center gap-1.5 rounded-md border border-dashed border-input px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          @click="onGroupAdd"
        >
          <svg class="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
          {{ t('Form.addRow') }}
        </button>
      </div>
      <div v-for="(item, index) in groupItems" :key="index" class="rounded-md bg-muted/30 p-3">
        <div class="mb-2 flex items-center justify-between">
          <span class="text-xs font-medium text-muted-foreground">{{ groupItemLabel(index) }}</span>
          <button
            v-if="groupItems.length > groupMinItems && !isDisabled"
            type="button"
            class="text-xs text-destructive"
            @click="onGroupRemove(index)"
          >
            {{ t('Form.removeRow') }}
          </button>
        </div>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <FormFieldControl
            v-for="child in groupChildren"
            :key="child.name"
            :field="child"
            :model-value="(item as Record<string, unknown>)[child.name] as FormValue ?? ''"
            :t="t"
            :scope="(item as Record<string, unknown>) as FormValues"
            :disabled="isDisabled"
            is-child
            @update:model-value="setChildValue(index, child.name, $event)"
          />
        </div>
      </div>
      <div v-if="groupItems.length === 0" class="py-6 text-center text-sm text-muted-foreground">
        {{ t('Form.emptyList', { action: t('Form.addRow') }) }}
      </div>
    </div>

    <!-- 可重复字段组（堆叠卡片） -->
    <div v-else-if="field.type === 'group'" class="space-y-3">
      <div
        v-for="(item, index) in groupItems"
        :key="index"
        class="space-y-3 rounded-md border border-border p-4"
      >
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium text-foreground">{{ groupItemLabel(index) }}</span>
          <button
            v-if="groupItems.length > groupMinItems && !isDisabled"
            type="button"
            class="text-xs text-destructive"
            @click="onGroupRemove(index)"
          >
            {{ groupRemoveText() }}
          </button>
        </div>
        <FormFieldControl
          v-for="child in groupChildren"
          :key="child.name"
          :field="child"
          :model-value="(item as Record<string, unknown>)[child.name] as FormValue ?? ''"
          :t="t"
          :scope="(item as Record<string, unknown>) as FormValues"
          :disabled="isDisabled"
          is-child
          @update:model-value="setChildValue(index, child.name, $event)"
        />
      </div>
      <button
        v-if="groupItems.length < groupMaxItems && !isDisabled"
        type="button"
        class="inline-flex items-center gap-1.5 rounded-md border border-dashed border-input px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
        @click="onGroupAdd"
      >
        <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
        {{ groupAddText() }}
      </button>
    </div>

    <!-- 未知类型兜底 -->
    <input
      v-else
      :id="'web-f-' + field.name"
      type="text"
      :value="String(value ?? '')"
      :placeholder="placeholder"
      :disabled="isDisabled"
      :class="textClass"
      @input="update(($event.target as HTMLInputElement).value)"
    />
  </div>
</template>
