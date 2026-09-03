import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPayload,
  defaultFor,
  defaultGroupItem,
  groupDefaultItems,
  isFieldDisabled,
  isFieldRequired,
  isFieldVisible,
  isRepeatable,
  spanClass,
  validateField,
  validateFieldFull,
  validateForm,
  valueMatchesList,
  type FormValues,
} from '../src/lib/form.ts';
import { buildRuleEvaluator, evaluateFieldRules } from '../src/lib/rules.ts';
import type { FormField } from '../src/index.ts';

const field = (overrides: Partial<FormField> & { name: string; type: string }): FormField => ({
  label: overrides.name,
  ...overrides,
} as FormField);

test('isFieldVisible: 无 visible_when 恒可见', () => {
  const f = field({ name: 'a', type: 'text' });
  assert.equal(isFieldVisible(f, {}), true);
});

test('isFieldVisible: equals / not_equals / filled / empty / in', () => {
  const eq = field({ name: 'b', type: 'text', visible_when: { field: 'a', operator: 'equals', value: 'x' } } as never);
  assert.equal(isFieldVisible(eq, { a: 'x' }), true);
  assert.equal(isFieldVisible(eq, { a: 'y' }), false);

  const neq = field({ name: 'c', type: 'text', visible_when: { field: 'a', operator: 'not_equals', value: 'x' } } as never);
  assert.equal(isFieldVisible(neq, { a: 'y' }), true);

  const filled = field({ name: 'd', type: 'text', visible_when: { field: 'a', operator: 'filled' } } as never);
  assert.equal(isFieldVisible(filled, { a: 'zz' }), true);
  assert.equal(isFieldVisible(filled, { a: '' }), false);

  const inn = field({ name: 'e', type: 'text', visible_when: { field: 'a', operator: 'in', value: ['x', 'z'] } } as never);
  assert.equal(isFieldVisible(inn, { a: 'z' }), true);
  assert.equal(isFieldVisible(inn, { a: 'q' }), false);
});

test('valueMatchesList: checkbox 数组命中列表', () => {
  assert.equal(valueMatchesList(['a', 'b'], ['b', 'c']), true);
  assert.equal(valueMatchesList(['a'], ['b']), false);
});

test('validateField: required / email / tel / url / number min-max', () => {
  const req = field({ name: 'x', type: 'text', required: true });
  assert.equal(validateField(req, ''), 'Form.required');
  assert.equal(validateField(req, 'v'), null);

  const email = field({ name: 'e', type: 'email' });
  assert.equal(validateField(email, 'bad'), 'Form.emailInvalid');
  assert.equal(validateField(email, 'a@b.com'), null);

  const tel = field({ name: 'p', type: 'tel' });
  assert.equal(validateField(tel, 'abc'), 'Form.telInvalid');
  assert.equal(validateField(tel, '13800138000'), null);

  const url = field({ name: 'u', type: 'url' });
  assert.equal(validateField(url, 'not-a-url'), 'Form.urlInvalid');
  assert.equal(validateField(url, 'https://x.com'), null);

  const num = field({ name: 'n', type: 'number', validation: { min: 1, max: 10 } } as never);
  assert.equal(validateField(num, 'abc'), 'Form.numberInvalid');
  assert.equal(validateField(num, 0), 'Form.min');
  assert.equal(validateField(num, 11), 'Form.max');
  assert.equal(validateField(num, 5), null);
});

test('validateField: length / pattern / select 白名单 / 多选数量', () => {
  const len = field({ name: 'l', type: 'text', validation: { min_length: 2, max_length: 5 } } as never);
  assert.equal(validateField(len, 'a'), 'Form.minLength');
  assert.equal(validateField(len, 'abcdef'), 'Form.maxLength');
  assert.equal(validateField(len, 'abc'), null);

  const pat = field({ name: 'p', type: 'text', validation: { pattern: '^\\d{4}$' } } as never);
  assert.equal(validateField(pat, 'abcd'), 'Form.pattern');
  assert.equal(validateField(pat, '1234'), null);

  const sel = field({ name: 's', type: 'select', options: [{ label: 'A', value: 'a' }, { label: 'B', value: 'b' }] });
  assert.equal(validateField(sel, 'c'), 'Form.invalidOption');
  assert.equal(validateField(sel, 'a'), null);

  const ck = field({ name: 'c', type: 'checkbox', options: [{ label: 'A', value: 'a' }], validation: { min_selected: 1, max_selected: 1 } } as never);
  assert.equal(validateField(ck, []), null);
  const err = validateField(ck, ['a', 'b']);
  assert.ok(err !== null && err.length > 0);
});

test('validateField: consent 必选', () => {
  const consent = field({ name: 'agree', type: 'consent', required: true });
  assert.equal(validateField(consent, false), 'Form.consentRequired');
  assert.equal(validateField(consent, true), null);
});

test('validateField: file 数量与大小', () => {
  const file = field({ name: 'f', type: 'file', required: true, min_files: 1, max_files: 2, max_file_size_mb: 1 });
  assert.equal(validateField(file, null, []), 'Form.required');
  assert.equal(validateField(file, null, [{ name: 'a.jpg', size: 10 }]), null);
  assert.equal(validateField(file, null, [{ name: 'a.jpg', size: 10 }, { name: 'b.jpg', size: 10 }, { name: 'c.jpg', size: 10 }]), 'Form.fileMax');
  assert.equal(validateField(file, null, [{ name: 'big.jpg', size: 2 * 1024 * 1024 }]), 'Form.fileSize');
});

test('validateForm: 全表单含 group 嵌套', () => {
  const fields = [
    field({ name: 'name', type: 'text', required: true }),
    field({
      name: 'items',
      type: 'group',
      fields: [
        field({ name: 'qty', type: 'number', required: true }),
        field({ name: 'note', type: 'text' }),
      ],
    } as never),
  ] as FormField[];
  const values: FormValues = {
    name: '',
    items: [
      { qty: '', note: 'x' },
      { qty: 3, note: 'y' },
    ],
  };
  const errors = validateForm(fields, values).errors;
  assert.equal(errors['name'], 'Form.required');
  assert.equal(errors['items.0.qty'], 'Form.required');
  assert.equal(errors['items.1.qty'], undefined);
  assert.equal(errors['items.0.note'], undefined);
});

test('isRepeatable: group / list 为可重复，其余 false', () => {
  assert.equal(isRepeatable(field({ name: 'g', type: 'group' })), true);
  assert.equal(isRepeatable(field({ name: 'l', type: 'list' })), true);
  assert.equal(isRepeatable(field({ name: 't', type: 'text' })), false);
});

test('validateForm: list 子表嵌套校验', () => {
  const fields = [
    field({
      name: 'rows',
      type: 'list',
      fields: [
        field({ name: 'qty', type: 'number', required: true }),
        field({ name: 'note', type: 'text' }),
      ],
    } as never),
  ] as FormField[];
  const values: FormValues = {
    rows: [
      { qty: '', note: 'a' },
      { qty: 2, note: 'b' },
    ],
  };
  const errors = validateForm(fields, values).errors;
  assert.equal(errors['rows.0.qty'], 'Form.required');
  assert.equal(errors['rows.1.qty'], undefined);
});

test('validateForm: 警告（level2）不阻断，错误（level1）阻断', () => {
  const fields = [
    field({
      name: 'n',
      type: 'number',
      rules: [
        {
          rule_id: 0,
          expr: {
            connector: 'and',
            children: [
              { type: 'min', value: 10, message: '不能小于10', level: 1 },
              { type: 'max', value: 100, message: '建议不超过100', level: 2 },
            ],
          },
        },
      ],
    } as never),
  ] as FormField[];

  // 值 5：命中 level1 错误（阻断）
  const r1 = validateForm(fields, { n: 5 });
  assert.equal(r1.errors['n'], '不能小于10');
  assert.equal(r1.warnings['n'], undefined);

  // 值 150：仅命中 level2 警告（不阻断）
  const r2 = validateForm(fields, { n: 150 });
  assert.equal(r2.errors['n'], undefined);
  assert.equal(r2.warnings['n'], '建议不超过100');

  // 值 50：全部通过
  const r3 = validateForm(fields, { n: 50 });
  assert.equal(r3.errors['n'], undefined);
  assert.equal(r3.warnings['n'], undefined);
});

test('规则引擎: AND/OR 短路 + 规范选择激活', () => {
  const rules = [
    { rule_id: 0, expr: { connector: 'and', children: [{ type: 'min', value: 1, message: 'a', level: 1 }] } },
    { rule_id: 7, expr: { connector: 'or', children: [
      { type: 'eq', value: 10, message: 'must be 10', level: 1 },
      { type: 'eq', value: 20, message: 'must be 10 or 20', level: 1 },
    ] } },
  ];
  // 未选规范（undefined）：rule_id=0 与 7 都生效；值 20 → OR 通过、AND 通过
  assert.equal(buildRuleEvaluator(rules, 'number', undefined)(20).pass, true);
  // 选规范 0：仅 rule_id=0 生效；值 0 → min 失败
  assert.equal(buildRuleEvaluator(rules, 'number', 0)(0).pass, false);
  // 选规范 7：仅 rule_id=7 生效；值 5 → OR 两枝都失败
  assert.equal(buildRuleEvaluator(rules, 'number', 7)(5).pass, false);
  // 选规范 7：值 10 → OR 首枝通过（短路）
  assert.equal(buildRuleEvaluator(rules, 'number', 7)(10).pass, true);
});

test('evaluateFieldRules: 非必填空值跳过普通规则', () => {
  const rules = [{ rule_id: 0, expr: { connector: 'and', children: [{ type: 'min', value: 10, message: '太小', level: 1 }] } }];
  // 空值：跳过 min，无 error
  assert.equal(evaluateFieldRules(rules, '', 'number').error, null);
  assert.equal(evaluateFieldRules(rules, 5, 'number').error, '太小');
});

test('字段依赖: 复合 visible_when (and/or) + required_when + disabled_when', () => {
  const scope: FormValues = { a: 'x', b: 'yes' };
  // 复合 and：a=='x' 且 b filled → 可见
  const fAnd = field({ name: 'c', type: 'text', visible_when: { and: [
    { field: 'a', operator: 'equals', value: 'x' },
    { field: 'b', operator: 'filled' },
  ] } } as never);
  assert.equal(isFieldVisible(fAnd, scope), true);
  assert.equal(isFieldVisible(fAnd, { a: 'x', b: '' }), false);

  // 复合 or：a=='x' 或 a=='z' → 可见
  const fOr = field({ name: 'd', type: 'text', visible_when: { or: [
    { field: 'a', operator: 'equals', value: 'z' },
    { field: 'a', operator: 'equals', value: 'x' },
  ] } } as never);
  assert.equal(isFieldVisible(fOr, { a: 'x' }), true);
  assert.equal(isFieldVisible(fOr, { a: 'y' }), false);

  // required_when：b filled 时 c 必填
  const fReq = field({ name: 'e', type: 'text', required_when: { field: 'b', operator: 'filled' } } as never);
  assert.equal(isFieldRequired(fReq, { b: 'yes' }), true);
  assert.equal(isFieldRequired(fReq, { b: '' }), false);

  // disabled_when：a=='locked' 时禁用
  const fDis = field({ name: 'f', type: 'text', disabled_when: { field: 'a', operator: 'equals', value: 'locked' } } as never);
  assert.equal(isFieldDisabled(fDis, { a: 'locked' }), true);
  assert.equal(isFieldDisabled(fDis, { a: 'x' }), false);

  // validateFieldFull：禁用字段跳过必填
  const fReqAndDis = field({ name: 'g', type: 'text', required: true, disabled_when: { field: 'a', operator: 'equals', value: 'locked' } } as never);
  assert.equal(validateFieldFull(fReqAndDis, '', [], { a: 'locked' }).error, null);
  assert.equal(validateFieldFull(fReqAndDis, '', [], { a: 'x' }).error, 'Form.required');
});

test('buildPayload: list 行数组归一化（剔除空行内空值）', () => {
  const fields = [
    field({
      name: 'rows',
      type: 'list',
      fields: [field({ name: 'q', type: 'text' }), field({ name: 'n', type: 'number' })],
    } as never),
  ] as FormField[];
  const values: FormValues = {
    rows: [
      { q: 'x', n: 1 },
      { q: '', n: 2 },
    ],
  };
  const payload = buildPayload(fields, values);
  assert.deepEqual(payload, {
    rows: [
      { n: 1, q: 'x' },
      { n: 2 },
    ],
  });
});

test('defaultFor / groupDefaultItems / defaultGroupItem', () => {
  assert.equal((defaultFor(field({ name: 'a', type: 'checkbox' })) as string[]).length, 0);
  assert.equal(defaultFor(field({ name: 'b', type: 'consent' })), false);
  assert.equal(defaultFor(field({ name: 'c', type: 'text' })), '');
  assert.deepEqual(defaultFor(field({ name: 'd', type: 'text', default: 'x' })), 'x');

  const g = field({ name: 'g', type: 'group', repeatable: { min_items: 2 }, fields: [field({ name: 'q', type: 'text' })] } as never);
  const items = groupDefaultItems(g);
  assert.equal(items.length, 2);
  assert.deepEqual(defaultGroupItem([field({ name: 'q', type: 'text' })]), { q: '' });
});

test('buildPayload: 剔除空值、结构化 checkbox/address/group', () => {
  const fields = [
    field({ name: 'name', type: 'text' }),
    field({ name: 'tags', type: 'checkbox', options: [] }),
    field({ name: 'addr', type: 'address' }),
    field({ name: 'agree', type: 'consent' }),
    field({ name: 'items', type: 'group', fields: [field({ name: 'q', type: 'text' })] } as never),
  ] as FormField[];
  const values: FormValues = {
    name: '',
    tags: ['a'],
    addr: { province: '河北', city: '' },
    agree: true,
    items: [{ q: 'x' }, { q: '' }],
  };
  const payload = buildPayload(fields, values);
  assert.deepEqual(payload, {
    tags: ['a'],
    addr: { province: '河北' },
    agree: true,
    items: [{ q: 'x' }],
  });
});

test('spanClass: 桌面 span / 平板 span_tablet / 移动 span_mobile', () => {
  assert.equal(spanClass(field({ name: 'a', type: 'text', layout: { span: 12 } })), 'col-span-12');
  assert.equal(spanClass(field({ name: 'b', type: 'text', layout: { span: 6 } })), 'col-span-12 lg:col-span-6');
  assert.equal(spanClass(field({ name: 'c', type: 'text', layout: { span: 4, span_tablet: 6, span_mobile: 12 } })), 'col-span-12 md:col-span-6 lg:col-span-4');
  assert.equal(spanClass(field({ name: 'd', type: 'textarea', layout: { span: 6 } }), true), 'col-span-12');
  assert.equal(spanClass(field({ name: 'e', type: 'text', layout: { span: 6, span_tablet: 6, span_mobile: 12 } })), 'col-span-12 md:col-span-6');
});
