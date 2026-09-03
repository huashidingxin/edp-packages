import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyMenuEnhancements, type WebMenuEnhancements } from '../src/lib/menus.ts';

const tree = [
  { id: 2, title: '产品中心', children: [
    { id: 21, title: '丹顶鹤' },
    { id: 22, title: 'WGW' },
  ] },
  { id: 3, title: '新闻资讯' },
] as any;

test('applyMenuEnhancements: empty/null -> same tree (zero-copy path)', () => {
  assert.equal(applyMenuEnhancements(tree, undefined), tree);
  assert.equal(applyMenuEnhancements(tree, {}), tree);
  assert.deepEqual(applyMenuEnhancements(null as any, undefined), []);
});

test('applyMenuEnhancements: by title -> mega + child description/image', () => {
  const enh: WebMenuEnhancements = {
    '产品中心': { mega: true, children: { '丹顶鹤': { description: '高强度切割系列', image: '/a.jpg' } } },
  };
  const out = applyMenuEnhancements(tree, enh);
  assert.equal(out[0]!.mega, true);
  assert.equal((out[0] as any)!.children![0]!.description, '高强度切割系列');
  assert.equal((out[0] as any)!.children![0]!.image, '/a.jpg');
  assert.equal((out[0] as any)!.children![1]!.description, undefined);
  // 原树不被修改
  assert.equal((tree[0] as any).mega, undefined);
});

test('applyMenuEnhancements: by id also matches', () => {
  const out = applyMenuEnhancements(tree, { '3': { mega: true } });
  assert.equal(out[1]!.mega, true);
  assert.equal(out[0]!.mega, undefined);
});

test('applyMenuEnhancements: id wins over title (i18n-safe keying)', () => {
  // id=2 是"产品中心";若某语言下 title 变为 Products,按 id 仍命中
  const byId = applyMenuEnhancements(tree, { '2': { mega: true } });
  assert.equal(byId[0]!.mega, true);
});

test('applyMenuEnhancements: unknown keys -> untouched clone', () => {
  const out = applyMenuEnhancements(tree, { '不存在': { mega: true } });
  assert.equal(out[0]!.mega, undefined);
  assert.notEqual(out, tree);
});
