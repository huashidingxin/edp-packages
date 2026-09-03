import type { FormValue } from './form.ts'

/**
 * 表单规则引擎 —— 移植自 zyzz `use-field-rules.js`，适配 edp `FormValue`。
 *
 * 规则结构（与后端 FormSchemaService::normalizeRules 对齐）：
 *   bundle = { rule_id, expr: { connector: 'and'|'or', children: [...] } }
 *   leaf   = { type, value?, message?, level?: 1|2 }
 *
 * level=1 是错误，阻止提交；level=2 是警告，只提示不阻止。
 * And/Or 惰性求值：AND 首个失败即止，OR 首个通过即止。
 * rule_id=0 恒生效（基本校验）；rule_id>0 仅当表单"校验规范"选中该 id 时生效。
 * selectedRuleId 为 null/undefined 时表示不过滤（全部 bundle 生效）。
 */

export type RuleFieldType = string

export interface RuleLeaf {
  type: string
  value?: unknown
  message?: string
  /** 1=错误（阻断提交）；2=警告（仅提示）。缺省按 1 处理。 */
  level?: number
}

export interface RuleNode {
  connector: 'and' | 'or'
  children: RuleExpr[]
}

export type RuleExpr = RuleNode | RuleLeaf

export interface RuleBundle {
  rule_id: number
  expr: RuleNode
  rule_name?: string
  rule_category_name?: string
}

export interface RuleResult {
  pass: boolean
  error: { leaf: RuleLeaf; message: string } | null
}

const NUMERIC_TYPES = new Set(['number', 'digit', 'decimal', 'integer', 'float', 'numeric', 'humidity', 'temperature', 'wind'])

function normalizeFieldType(fieldType: RuleFieldType | { value?: string; type?: string } | undefined): string {
  if (fieldType && typeof fieldType === 'object') {
    return String(fieldType.value || fieldType.type || '').toLowerCase()
  }
  return String(fieldType ?? '').toLowerCase()
}

/** 值是否为空（null/undefined/空串/空数组）。 */
export function isEmptyVal(value: FormValue): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === 'string') return value === ''
  if (Array.isArray(value)) return value.length === 0
  return false
}

/** 将同一 rule_id 的多个规则表达式合并为 AND，兼容旧版扁平叶子。 */
export function normalizeRuleBundles(rules: unknown[] = []): RuleBundle[] {
  const grouped: Record<number, RuleNode[]> = {}
  const metadata: Record<number, Partial<RuleBundle>> = {}

  for (const entry of (rules ?? []) as Array<Record<string, unknown> | undefined | null>) {
    if (!entry || typeof entry !== 'object') continue
    const ruleId = Number(entry.rule_id ?? 0)
    if (!Number.isFinite(ruleId)) continue
    grouped[ruleId] ??= []
    metadata[ruleId] ??= entry as Partial<RuleBundle>

    const expr = entry.expr as RuleNode | undefined
    if (expr && Array.isArray(expr.children)) {
      grouped[ruleId]!.push(expr)
    } else if (typeof entry.type === 'string') {
      // 扁平叶子 → 包成单叶子 AND
      const { rule_id: _omit, ...leaf } = entry as unknown as RuleLeaf & { rule_id?: unknown }
      void _omit
      grouped[ruleId]!.push({ connector: 'and', children: [leaf as RuleLeaf] })
    }
  }

  return Object.entries(grouped).map(([ruleId, exprs]) => ({
    rule_id: Number(ruleId),
    expr: exprs.length === 1 ? exprs[0]! : { connector: 'and', children: exprs },
    rule_name: metadata[Number(ruleId)]?.rule_name ?? metadata[Number(ruleId)]?.rule_name,
    rule_category_name: metadata[Number(ruleId)]?.rule_category_name,
  }))
}

/** 单个叶子求值：通过返回 true，失败返回提示文本。 */
export function checkLeaf(leaf: RuleLeaf, value: FormValue, fieldType: RuleFieldType = 'text'): true | string {
  const type = leaf.type
  const message = leaf.message || '格式有误'
  const numeric = NUMERIC_TYPES.has(normalizeFieldType(fieldType))
  const text = (): string => (value === null || value === undefined ? '' : String(value))

  switch (type) {
    case 'required': {
      if (fieldType !== 'switch' && !numeric) {
        if (value === null || value === undefined) return message
        if (Array.isArray(value)) return value.length > 0 ? true : message
        if (typeof value === 'string') return value.trim().length > 0 ? true : message
        if (typeof value === 'boolean') return value ? true : message
        return value ? true : message
      }
      return value !== undefined && value !== null ? true : message
    }
    case 'eq':
      return String(value) === String(leaf.value) ? true : message
    case 'ne':
      return String(value) === String(leaf.value) ? message : true
    case 'min':
    case 'minLength': {
      if (numeric) return Number(value) >= Number.parseFloat(String(leaf.value)) ? true : message
      return text().length >= Number(leaf.value) ? true : message
    }
    case 'max':
    case 'maxLength': {
      if (numeric) return Number(value) <= Number.parseFloat(String(leaf.value)) ? true : message
      return text().length <= Number(leaf.value) ? true : message
    }
    case 'gt':
      return Number(value) > Number.parseFloat(String(leaf.value)) ? true : message
    case 'lt':
      return Number(value) < Number.parseFloat(String(leaf.value)) ? true : message
    case 'ge':
      return Number(value) >= Number.parseFloat(String(leaf.value)) ? true : message
    case 'le':
      return Number(value) <= Number.parseFloat(String(leaf.value)) ? true : message
    case 'range': {
      const range = Array.isArray(leaf.value) ? leaf.value : String(leaf.value).split('-')
      const n = Number(value)
      return n >= Number.parseFloat(String(range[0])) && n <= Number.parseFloat(String(range[1])) ? true : message
    }
    case 'contains':
      return text().includes(String(leaf.value)) ? true : message
    case 'not_contains':
      return text().includes(String(leaf.value)) ? message : true
    case 'starts_with':
      return text().startsWith(String(leaf.value)) ? true : message
    case 'not_starts_with':
      return text().startsWith(String(leaf.value)) ? message : true
    case 'ends_with':
      return text().endsWith(String(leaf.value)) ? true : message
    case 'not_ends_with':
      return text().endsWith(String(leaf.value)) ? message : true
    case 'in': {
      const values = Array.isArray(leaf.value)
        ? leaf.value.map(String)
        : String(leaf.value ?? '').split(/[,，]/).map((s) => s.trim()).filter(Boolean)
      if (Array.isArray(value)) {
        return value.length > 0 && value.every((item) => values.includes(String(item))) ? true : message
      }
      return values.includes(String(value)) ? true : message
    }
    case 'not_in': {
      const values = Array.isArray(leaf.value)
        ? leaf.value.map(String)
        : String(leaf.value ?? '').split(/[,，]/).map((s) => s.trim()).filter(Boolean)
      if (Array.isArray(value)) {
        return value.every((item) => !values.includes(String(item))) ? true : message
      }
      return !values.includes(String(value)) ? true : message
    }
    default:
      return true
  }
}

/** 递归惰性求值，返回 { pass, error: { leaf, message } | null }。 */
export function evalNode(node: RuleExpr, value: FormValue, fieldType: RuleFieldType = 'text'): RuleResult {
  if (node && Array.isArray((node as RuleNode).children)) {
    const n = node as RuleNode
    const isAnd = n.connector !== 'or'
    let firstError: RuleResult['error'] = null
    for (const child of n.children) {
      const result = evalNode(child, value, fieldType)
      if (result.pass) {
        if (!isAnd) return { pass: true, error: null }
      } else {
        firstError ??= result.error
        if (isAnd) return { pass: false, error: firstError }
      }
    }
    return isAnd ? { pass: true, error: null } : { pass: false, error: firstError }
  }

  if (node && typeof (node as RuleLeaf).type === 'string') {
    const leaf = node as RuleLeaf
    // 非必填字段为空时跳过普通规则；required 仍校验。
    if (isEmptyVal(value) && leaf.type !== 'required') return { pass: true, error: null }
    const result = checkLeaf(leaf, value, fieldType)
    if (result === true) return { pass: true, error: null }
    return { pass: false, error: { leaf, message: result } }
  }

  return { pass: true, error: null }
}

/**
 * 构造字段求值函数。
 * @param selectedRuleId null/undefined=不过滤（全部生效）；number=只保留 rule_id=0 + 匹配项
 */
export function buildRuleEvaluator(
  rules: unknown[] = [],
  fieldType: RuleFieldType = 'text',
  selectedRuleId?: number | null,
): (value: FormValue) => RuleResult {
  const bundles = normalizeRuleBundles(rules)
  const active = bundles.filter((bundle) =>
    selectedRuleId === null || selectedRuleId === undefined
      ? true
      : Number(bundle.rule_id || 0) === 0 || String(bundle.rule_id) === String(selectedRuleId),
  )
  const root: RuleNode = { connector: 'and', children: active.map((bundle) => bundle.expr) }
  return (value: FormValue) => evalNode(root, value, fieldType)
}

/** 按等级拆分（保留给需要枚举所有失败规则的调用方）。 */
export function splitByLevel(rules: Array<RuleLeaf & { _level?: number }> = []): { errors: RuleLeaf[]; warnings: RuleLeaf[] } {
  const result = { errors: [] as RuleLeaf[], warnings: [] as RuleLeaf[] }
  for (const rule of rules ?? []) {
    ;(Number((rule as { _level?: number })._level) === 2 ? result.warnings : result.errors).push(rule)
  }
  return result
}

/**
 * 字段规则全量求值，拆出 level1 错误（阻断）与 level2 警告（提示）。
 * 沿用 zyzz 语义：整棵规则树作为 AND 求值，取首个失败叶子按其 level 分类。
 */
export function evaluateFieldRules(
  rules: unknown[] = [],
  value: FormValue,
  fieldType: RuleFieldType = 'text',
  selectedRuleId?: number | null,
): { error: string | null; warning: string | null } {
  const evaluate = buildRuleEvaluator(rules, fieldType, selectedRuleId)
  const result = evaluate(value)
  if (result.pass || !result.error) return { error: null, warning: null }
  if (Number(result.error.leaf.level) === 2) return { error: null, warning: result.error.message }
  return { error: result.error.message, warning: null }
}
