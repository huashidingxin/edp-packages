import type { FormField } from '../contracts/index.ts'
import { evaluateFieldRules } from './rules.ts'

/**
 * 表单纯逻辑：可见性、校验、跨度映射、payload 归一化。
 *
 * 与后端 FormSubmissionValidator / FormSchemaService 语义对齐：
 * - visible_when / required_when / disabled_when 运算符：equals / not_equals / in / not_in / filled / empty
 * - visible_when 支持单条件或复合 { and|or: [cond] }；required_when / disabled_when 同形
 * - checkbox 多选值为数组；consent 为布尔；address 为对象；group / list 为对象数组
 * - 规则引擎（field.rules）：level=1 → errors 阻断提交；level=2 → warnings 仅提示
 */

export type FormValue = string | number | boolean | string[] | null | undefined | FormValue[] | Record<string, unknown>
export type FormValues = Record<string, FormValue>

export interface FormFile {
  name: string
  size: number
  /** 原始 File 对象（浏览器环境存在；提交时透传给 submit 回调 / multipart 上传）。 */
  raw?: File
}

const BASE_SPAN_CLASSES = [
  'col-span-1',
  'col-span-2',
  'col-span-3',
  'col-span-4',
  'col-span-5',
  'col-span-6',
  'col-span-7',
  'col-span-8',
  'col-span-9',
  'col-span-10',
  'col-span-11',
  'col-span-12',
] as const

const MD_SPAN_CLASSES = [
  'md:col-span-1',
  'md:col-span-2',
  'md:col-span-3',
  'md:col-span-4',
  'md:col-span-5',
  'md:col-span-6',
  'md:col-span-7',
  'md:col-span-8',
  'md:col-span-9',
  'md:col-span-10',
  'md:col-span-11',
  'md:col-span-12',
] as const

const LG_SPAN_CLASSES = [
  'lg:col-span-1',
  'lg:col-span-2',
  'lg:col-span-3',
  'lg:col-span-4',
  'lg:col-span-5',
  'lg:col-span-6',
  'lg:col-span-7',
  'lg:col-span-8',
  'lg:col-span-9',
  'lg:col-span-10',
  'lg:col-span-11',
  'lg:col-span-12',
] as const

function clampSpan(span: unknown): number {
  return Math.min(Math.max(Number(span) || 12, 1), 12)
}

/**
 * 字段网格跨度类 —— 后端契约：span=桌面、span_tablet=平板、span_mobile=移动（默认均 12）。
 * 映射：base=`span_mobile`、`md:`=`span_tablet`、`lg:`=`span`；grid 恒为 12 列。
 */
export function spanClass(field: FormField, textarea?: boolean): string {
  if (textarea) return 'col-span-12'
  const layout = (field as Record<string, unknown>).layout as { span?: number; span_tablet?: number; span_mobile?: number } | null | undefined
  const mobile = clampSpan(layout?.span_mobile ?? 12)
  const tablet = clampSpan(layout?.span_tablet ?? 12)
  const desktop = clampSpan(layout?.span ?? 12)
  const parts: string[] = [BASE_SPAN_CLASSES[mobile - 1]!]
  if (tablet !== mobile) parts.push(MD_SPAN_CLASSES[tablet - 1]!)
  if (desktop !== tablet) parts.push(LG_SPAN_CLASSES[desktop - 1]!)
  return parts.join(' ')
}

function isEmpty(value: FormValue): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === 'string') return value.trim() === ''
  if (Array.isArray(value)) return value.length === 0
  return false
}

function scalarEqual(left: FormValue, right: unknown): boolean {
  if (typeof left === 'number' && typeof right === 'number') return left === right
  if (typeof left === 'string' && typeof right === 'string') return left === right
  if (typeof left === 'boolean' && typeof right === 'boolean') return left === right
  return String(left) === String(right)
}

/** 参考字段值是否命中列表（多选任一项命中即可）。 */
export function valueMatchesList(ref: FormValue, list: unknown[]): boolean {
  if (!Array.isArray(list)) return false
  if (Array.isArray(ref)) return ref.some((item) => list.some((expected) => scalarEqual(item as FormValue, expected)))
  return list.some((expected) => scalarEqual(ref, expected))
}

type FieldCondition = { field?: string; operator?: string; value?: unknown }
type ConditionSpec = FieldCondition | { and?: ConditionSpec[]; or?: ConditionSpec[] }

/** 单条件求值（与后端 FormSubmissionValidator::evalSingleCondition 一致）。 */
function evalSingleCondition(cond: unknown, scope: FormValues): boolean {
  if (!cond || typeof cond !== 'object') return true
  const c = cond as FieldCondition
  if (!c.field) return true
  const ref = scope[c.field] ?? null
  const expected = c.value
  switch (c.operator ?? 'equals') {
    case 'filled':
      return !isEmpty(ref as FormValue)
    case 'empty':
      return isEmpty(ref as FormValue)
    case 'in':
      return valueMatchesList(ref as FormValue, Array.isArray(expected) ? expected : [])
    case 'not_in':
      return !valueMatchesList(ref as FormValue, Array.isArray(expected) ? expected : [])
    case 'not_equals':
      return !scalarEqual(ref as FormValue, expected)
    default:
      return scalarEqual(ref as FormValue, expected)
  }
}

/** 条件树求值：单条件 或 { and|or: [cond] }（裸数组按 AND 处理）。 */
function evalConditionTree(spec: unknown, scope: FormValues): boolean {
  if (!spec || typeof spec !== 'object') return true
  if (Array.isArray(spec)) return spec.every((c) => evalConditionTree(c, scope))
  const s = spec as { and?: unknown; or?: unknown }
  if (Array.isArray(s.and)) return s.and.every((c) => evalConditionTree(c, scope))
  if (Array.isArray(s.or)) return s.or.some((c) => evalConditionTree(c, scope))
  return evalSingleCondition(spec, scope)
}

/**
 * visible_when 求值（与后端 FormSubmissionValidator::isVisible 一致）。
 * - 单条件 `{ field, operator, value }`（向后兼容）
 * - 复合 `{ and|or: [cond, ...] }`
 * @param scope 同级字段值快照
 */
export function isFieldVisible(field: FormField, scope: FormValues): boolean {
  return evalConditionTree((field as Record<string, unknown>).visible_when, scope)
}

/** 必填求值：`field.required` 或 `required_when` 命中。 */
export function isFieldRequired(field: FormField, scope: FormValues = {}): boolean {
  if (field.required) return true
  const spec = (field as Record<string, unknown>).required_when
  if (!spec) return false
  return evalConditionTree(spec, scope)
}

/** 禁用求值：`disabled_when` 命中（用户不可编辑）。缺省为不禁用。 */
export function isFieldDisabled(field: FormField, scope: FormValues = {}): boolean {
  const spec = (field as Record<string, unknown>).disabled_when
  if (!spec) return false
  return evalConditionTree(spec, scope)
}

/** 仅校验值为空时对 required 的判定。file 类型按已选文件列表判定。 */
function isRequiredError(field: FormField, value: FormValue, files: { name: string; size: number }[], scope: FormValues = {}): string | null {
  if (isFieldDisabled(field, scope) || !isFieldRequired(field, scope)) return null
  if (field.type === 'consent') return value === true ? null : 'Form.consentRequired'
  if (field.type === 'file') return (files?.length ?? 0) > 0 ? null : 'Form.required'
  if (field.type === 'checkbox' || field.type === 'group' || field.type === 'list') return isEmpty(value) ? 'Form.required' : null
  return isEmpty(value) ? 'Form.required' : null
}

function lengthOf(value: FormValue): number {
  if (typeof value === 'string') return value.length
  if (Array.isArray(value)) return value.length
  return 0
}

/** 类型/格式校验（不含必填、不含规则引擎）。返回错误文案 source key（null 表示通过）。 */
function validateTypeRules(field: FormField, value: FormValue, files: { name: string; size: number }[] = []): string | null {
  const type = field.type
  const validation = (field as Record<string, unknown>).validation as
    | Record<string, unknown>
    | null
    | undefined
  const opts = validation ?? {}

  if (type === 'email') {
    if (typeof value === 'string' && !/^\S+@\S+\.\S+$/.test(value)) return 'Form.emailInvalid'
  }
  if (type === 'url') {
    if (typeof value === 'string' && !/^(https?:\/\/|\/)/i.test(value)) return 'Form.urlInvalid'
  }
  if (type === 'tel') {
    if (typeof value === 'string' && !/^[+\d][\d\s()-]{4,}$/.test(value.trim())) return 'Form.telInvalid'
  }
  if (type === 'number') {
    const n = Number(value)
    if (typeof value !== 'number' && value !== '' && Number.isNaN(n)) return 'Form.numberInvalid'
    if (!Number.isNaN(n)) {
      if (opts.min !== undefined && n < Number(opts.min)) return 'Form.min'
      if (opts.max !== undefined && n > Number(opts.max)) return 'Form.max'
    }
  }
  if (type === 'textarea' || type === 'text') {
    if (opts.min_length !== undefined && lengthOf(value) < Number(opts.min_length)) return 'Form.minLength'
    if (opts.max_length !== undefined && lengthOf(value) > Number(opts.max_length)) return 'Form.maxLength'
  }
  if (typeof value === 'string' && opts.pattern !== undefined) {
    const re = String(opts.pattern)
    if (!new RegExp(re).test(value)) return 'Form.pattern'
  }

  if (type === 'date' && typeof value === 'string') {
    const dateType = String((field as Record<string, unknown>).date_type ?? 'date')
    if (dateType === 'year') {
      if (opts.min_date !== undefined && value < String(opts.min_date).slice(0, 4)) return 'Form.minDate'
      if (opts.max_date !== undefined && value > String(opts.max_date).slice(0, 4)) return 'Form.maxDate'
    } else if (dateType === 'month') {
      if (opts.min_date !== undefined && value < String(opts.min_date).slice(0, 7)) return 'Form.minDate'
      if (opts.max_date !== undefined && value > String(opts.max_date).slice(0, 7)) return 'Form.maxDate'
    } else {
      if (opts.min_date !== undefined && value < String(opts.min_date)) return 'Form.minDate'
      if (opts.max_date !== undefined && value > String(opts.max_date)) return 'Form.maxDate'
    }
  }

  if ((type === 'checkbox' || (type === 'select' && (field as Record<string, unknown>).multiple)) && Array.isArray(value)) {
    if (opts.min_selected !== undefined && value.length < Number(opts.min_selected)) return 'Form.minSelected'
    if (opts.max_selected !== undefined && value.length > Number(opts.max_selected)) return 'Form.maxSelected'
  }

  if ((type === 'radio' || type === 'select' || type === 'checkbox') && Array.isArray(field.options)) {
    const allowed = new Set(field.options.map((o) => o.value))
    const values = Array.isArray(value) ? value : [value]
    if (values.some((v) => !allowed.has(String(v)))) return 'Form.invalidOption'
  }

  if (type === 'file') {
    const minFiles = Number((field as Record<string, unknown>).min_files ?? (field.required ? 1 : 0))
    const maxFiles = Number((field as Record<string, unknown>).max_files ?? 1)
    const maxSize = Number((field as Record<string, unknown>).max_file_size_mb ?? 10) * 1024 * 1024
    if (files.length < minFiles) return 'Form.fileMin'
    if (files.length > maxFiles) return 'Form.fileMax'
    if (files.some((f) => f.size > maxSize)) return 'Form.fileSize'
  }

  return null
}

/**
 * 单字段全量校验，返回 level1 错误（阻断）与 level2 警告（提示）。
 * 与后端 FormSubmissionValidator 校验规则对齐。
 * - disabled 字段跳过必填与规则
 * - 必填（field.required 或 required_when 命中）先行
 * - 空非必填跳过类型/规则校验
 * - 规则引擎（field.rules）按 selectedRuleId 过滤规范（rule_id=0 恒生效 + 匹配项）
 */
export function validateFieldFull(
  field: FormField,
  value: FormValue,
  files: { name: string; size: number }[] = [],
  scope: FormValues = {},
  selectedRuleId: number | null | undefined = undefined,
): { error: string | null; warning: string | null } {
  if (isFieldDisabled(field, scope)) return { error: null, warning: null }

  const requiredError = isRequiredError(field, value, files, scope)
  if (requiredError) return { error: requiredError, warning: null }

  if (field.type !== 'file' && isEmpty(value)) return { error: null, warning: null }

  const typeError = validateTypeRules(field, value, files)
  if (typeError) return { error: typeError, warning: null }

  const rules = (field as Record<string, unknown>).rules
  if (Array.isArray(rules) && rules.length > 0) {
    const { error, warning } = evaluateFieldRules(rules, value, field.type, selectedRuleId)
    if (error) return { error, warning: null }
    if (warning) return { error: null, warning }
  }

  return { error: null, warning: null }
}

/** 单字段校验（向后兼容包装）：返回 level1 错误文案 source key（null 表示通过）。 */
export function validateField(field: FormField, value: FormValue, files: { name: string; size: number }[] = [], scope: FormValues = {}, selectedRuleId?: number | null): string | null {
  return validateFieldFull(field, value, files, scope, selectedRuleId).error
}

/** 是否可重复（group 堆叠卡片 / list 子表格网格，存储同为对象数组）。 */
export function isRepeatable(field: FormField): boolean {
  return field.type === 'group' || field.type === 'list'
}

/**
 * 全表单校验：返回 errors（level1，阻断）与 warnings（level2，仅提示）。
 * key 形如 `name` 或 `list.{index}.{child}`（可重复字段组内）。
 */
export function validateForm(
  fields: FormField[],
  values: FormValues,
  files: Record<string, { name: string; size: number }[]> = {},
  selectedRuleId: number | null | undefined = undefined,
): { errors: Record<string, string>; warnings: Record<string, string> } {
  const errors: Record<string, string> = {}
  const warnings: Record<string, string> = {}
  const walk = (list: FormField[], scope: FormValues, prefix = '') => {
    for (const field of list) {
      const key = prefix ? `${prefix}.${field.name}` : field.name
      if (!isFieldVisible(field, scope)) continue
      const full = validateFieldFull(field, scope[field.name] as FormValue, files[field.name] ?? [], scope, selectedRuleId)
      if (full.error) errors[key] = full.error
      if (full.warning) warnings[key] = full.warning
      if (isRepeatable(field)) {
        const items = (scope[field.name] as FormValue[] | undefined) ?? []
        items.forEach((item, i) => {
          const childScope = (item as Record<string, unknown>) as FormValues
          walk((field as Record<string, unknown>).fields as FormField[] ?? [], childScope, `${key}.${i}`)
        })
      }
    }
  }
  walk(fields, values)
  return { errors, warnings }
}

/** 布尔化后的默认值（checkbox→[]、consent→false、group/list→[]、其余→null）。 */
export function defaultFor(field: FormField): FormValue {
  if (field.default !== undefined && field.default !== null) {
    return field.default as FormValue
  }
  if (field.type === 'checkbox' || field.type === 'group' || field.type === 'list') return []
  if (field.type === 'consent') return false
  if (field.type === 'address') return {}
  return ''
}

/** 归一化 group 默认项。 */
export function groupDefaultItems(field: FormField): FormValue[] {
  const defaults = Array.isArray(field.default) ? field.default : []
  const repeatable = (field as Record<string, unknown>).repeatable as
    | { min_items?: number; max_items?: number }
    | null
    | undefined
  const min = repeatable?.min_items ?? 0
  const items: FormValue[] = defaults.map((d) => d as FormValue)
  while (items.length < min) {
    items.push(defaultGroupItem((field as Record<string, unknown>).fields as FormField[] ?? []))
  }
  return items
}

/** 生成单个空 group 项。 */
export function defaultGroupItem(fields: FormField[]): FormValue {
  const item: Record<string, unknown> = {}
  for (const child of fields) {
    item[child.name] = defaultFor(child)
  }
  return item
}

/**
 * 归一化提交 payload：剔除空值；checkbox 数组、consent 布尔、
 * address 对象、group 数组保持结构化。与后端 payload 约定一致。
 */
export function buildPayload(fields: FormField[], values: FormValues): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  const walk = (list: FormField[], scope: FormValues, target: Record<string, unknown>) => {
    for (const field of list) {
      const value = scope[field.name]
      if (isRepeatable(field)) {
        const items = Array.isArray(value) ? value : []
        const normalizedItems = items
          .map((item) => {
            const o: Record<string, unknown> = {}
            walk((field as Record<string, unknown>).fields as FormField[] ?? [], (item as Record<string, unknown>) as FormValues, o)
            return o
          })
          .filter((o) => Object.keys(o).length > 0)
        if (normalizedItems.length > 0) target[field.name] = normalizedItems
        continue
      }
      if (field.type === 'address' && value && typeof value === 'object') {
        const region = value as Record<string, unknown>
        const cleaned: Record<string, unknown> = {}
        for (const key of ['country', 'province', 'city', 'district', 'town', 'full_region']) {
          const v = region[key]
          if (typeof v === 'string' && v.trim() !== '') cleaned[key] = v.trim()
        }
        if (Object.keys(cleaned).length > 0) target[field.name] = cleaned
        continue
      }
      if (Array.isArray(value)) {
        if (value.length > 0) target[field.name] = value
        continue
      }
      if (value === true || (value !== '' && value !== null && value !== undefined)) {
        target[field.name] = value
      }
    }
  }
  walk(fields, values, out)
  return out
}
