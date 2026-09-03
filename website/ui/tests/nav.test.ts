import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isActivePath } from '../src/lib/nav.ts';

test('isActivePath: exact match', () => {
  assert.equal(isActivePath('/products', '/products'), true);
  assert.equal(isActivePath('/', '/'), true);
});

test('isActivePath: prefix at segment boundary', () => {
  assert.equal(isActivePath('/products/42', '/products'), true);
  assert.equal(isActivePath('/products/42/spec', '/products/42'), true);
  assert.equal(isActivePath('/productsfoo', '/products'), false);
  assert.equal(isActivePath('/products-abc', '/products'), false);
});

test('isActivePath: root only matches exactly', () => {
  assert.equal(isActivePath('/about/x', '/'), false);
});

test('isActivePath: query/hash stripped', () => {
  assert.equal(isActivePath('/products?x=1#top', '/products'), true);
});
