import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cn } from '../src/lib/cn.ts';

test('cn merges Tailwind class conflict, later wins', () => {
  assert.equal(cn('px-2 py-1', 'px-4'), 'py-1 px-4');
});

test('cn handles conditional object and array inputs', () => {
  // clsx result before twMerge: "a b c b"
  assert.equal(cn(['a', 'b', 'c'], { b: true, d: false }), 'a b c b');
  // twMerge keeps conflicting Tailwind classes resolved (no Tailwind classes here, both kept).
});

test('cn keeps non-conflicting Tailwind classes', () => {
  assert.equal(cn('flex', 'flex-col', 'text-xs'), 'flex flex-col text-xs');
});

test('cn resolves conflicting Tailwind width class', () => {
  assert.equal(cn('w-4', 'w-8'), 'w-8');
});
