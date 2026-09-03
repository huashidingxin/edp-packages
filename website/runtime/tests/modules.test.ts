import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveModulesOptions } from '../src/lib/modules.ts';

test('resolveModulesOptions: undefined -> all defaults on', () => {
  const r = resolveModulesOptions(undefined);
  assert.equal(r.home, true);
  assert.equal(r.productsListing, 'sidebar');
  assert.equal(r.productsDetail, true);
  assert.equal(r.articles && r.gallery && r.cases && r.jobs && r.about, true);
});

test('resolveModulesOptions: module off -> listing null & detail false', () => {
  const r = resolveModulesOptions({ products: false });
  assert.equal(r.productsListing, null);
  assert.equal(r.productsDetail, false);
});

test('resolveModulesOptions: products variant override', () => {
  const r = resolveModulesOptions({ products: { listing: 'chips' } });
  assert.equal(r.productsListing, 'chips');
  assert.equal(r.productsDetail, true);
});

test('resolveModulesOptions: disable single modules', () => {
  const r = resolveModulesOptions({ gallery: false, cases: false });
  assert.equal(r.gallery, false);
  assert.equal(r.cases, false);
  assert.equal(r.articles, true);
});

test('resolveModulesOptions: jobs off -> false, others keep defaults', () => {
  const r = resolveModulesOptions({ jobs: false });
  assert.equal(r.jobs, false);
  assert.equal(r.articles, true);
  assert.equal(r.productsListing, 'sidebar');
});

test('resolveModulesOptions: gallery sources option', () => {
  const r = resolveModulesOptions({ gallery: { sources: ['hezuohuoban', ''] } });
  assert.equal(r.gallery, true);
  assert.deepEqual(r.gallerySources, ['hezuohuoban']);
});

test('resolveModulesOptions: gallery boolean keeps sources empty', () => {
  assert.deepEqual(resolveModulesOptions({ gallery: true }).gallerySources, []);
  assert.deepEqual(resolveModulesOptions({ gallery: false }).gallerySources, []);
  assert.deepEqual(resolveModulesOptions(undefined).gallerySources, []);
});
