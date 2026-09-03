import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findLayoutNuxtLayoutUsage, extractVueTemplate } from '../src/lib/layoutLint.ts';

test('findLayoutNuxtLayoutUsage: unnamed <NuxtLayout> -> self', () => {
  const r = findLayoutNuxtLayoutUsage({
    'default.vue': `<template>
  <div class="site">
    <NuxtLayout><slot /></NuxtLayout>
  </div>
</template>`,
  });
  const [first] = r;
  assert.ok(first);
  assert.equal(first.file, 'default.vue');
  assert.equal(first.kind, 'self');
});

test('findLayoutNuxtLayoutUsage: name pointing to itself -> self', () => {
  const r = findLayoutNuxtLayoutUsage({
    'two.vue': `<template><div><NuxtLayout name="two"><slot /></NuxtLayout></div></template>`,
  });
  const [first] = r;
  assert.ok(first);
  assert.equal(first.kind, 'self');
});

test('findLayoutNuxtLayoutUsage: kebab-case <nuxt-layout> detected', () => {
  const r = findLayoutNuxtLayoutUsage({
    'default.vue': `<template><nuxt-layout /></template>`,
  });
  const [first] = r;
  assert.ok(first);
  assert.equal(first.kind, 'self');
});

test('findLayoutNuxtLayoutUsage: commented-out usage not flagged', () => {
  const r = findLayoutNuxtLayoutUsage({
    'default.vue': `<template>
  <!-- <NuxtLayout> 曾导致自递归,勿恢复 -->
  <div><slot /></div>
</template>`,
  });
  assert.deepEqual(r, []);
});

test('findLayoutNuxtLayoutUsage: usage inside script only not flagged', () => {
  const r = findLayoutNuxtLayoutUsage({
    'default.vue': `<script setup lang="ts">
// <NuxtLayout> 见注释;模板内没有
</script>
<template><div><slot /></div></template>`,
  });
  assert.deepEqual(r, []);
});

test('findLayoutNuxtLayoutUsage: named other layout -> nested', () => {
  const r = findLayoutNuxtLayoutUsage({
    'custom.vue': `<template><NuxtLayout name="default"><slot /></NuxtLayout></template>`,
  });
  const [first] = r;
  assert.ok(first);
  assert.equal(first.kind, 'nested');
});

test('findLayoutNuxtLayoutUsage: prefixed names not matched', () => {
  const r = findLayoutNuxtLayoutUsage({
    'a.vue': `<template><NuxtLayoutFoo /><nuxt-layout-legacy /></template>`,
  });
  assert.deepEqual(r, []);
});

test('findLayoutNuxtLayoutUsage: self-closing with attrs', () => {
  const r = findLayoutNuxtLayoutUsage({
    'default.vue': `<template><NuxtLayout class="wrapper" /></template>`,
  });
  const [first] = r;
  assert.ok(first);
  assert.equal(first.kind, 'self');
});

test('findLayoutNuxtLayoutUsage: multiple files mixed', () => {
  const r = findLayoutNuxtLayoutUsage({
    'a.vue': `<template><NuxtLayout><slot /></NuxtLayout></template>`,
    'b.vue': `<template><div><slot /></div></template>`,
  });
  assert.equal(r.length, 1);
  assert.equal(r[0]?.file, 'a.vue');
});

test('extractVueTemplate: spans root template incl. nested template tags', () => {
  const src = `<script setup>const x = 1</script>
<template>
  <div><template #s>inner</template>body</div>
</template>`;
  const tpl = extractVueTemplate(src);
  assert.ok(tpl.startsWith('<template'));
  assert.ok(tpl.endsWith('</template>'));
  assert.ok(tpl.includes('#s'));
  assert.ok(!tpl.includes('<script'));
});

test('extractVueTemplate: no template -> empty', () => {
  assert.equal(extractVueTemplate('<script setup>ok</script>'), '');
});
