import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  aboutFeatureCols,
  aboutFeatureIndex,
  aboutHeadClass,
  aboutMediaOrderClass,
  aboutMediaRatioClass,
  aboutTitleClass,
  normalizeAboutFeatures,
  normalizeAboutStats,
  summarizeHtml,
} from '../src/lib/about.ts';

test('aboutTitleClass: maps size to display token', () => {
  assert.equal(aboutTitleClass('sm'), 'text-display-sm');
  assert.equal(aboutTitleClass('md'), 'text-display-md');
  assert.equal(aboutTitleClass('lg'), 'text-display-lg');
});

test('aboutTitleClass: unknown size falls back to md', () => {
  assert.equal(aboutTitleClass('xl' as never), 'text-display-md');
});

test('aboutHeadClass: center aligns and constrains width', () => {
  const center = aboutHeadClass('center', 'lg');
  assert.match(center, /mx-auto/);
  assert.match(center, /text-center/);
  assert.match(center, /--web-about-head-mb,3\.5rem/);
});

test('aboutHeadClass: left keeps single column width', () => {
  const left = aboutHeadClass('left', 'sm');
  assert.doesNotMatch(left, /text-center/);
  assert.doesNotMatch(left, /mx-auto/);
  assert.match(left, /--web-about-head-mb,1\.75rem/);
});

test('aboutMediaRatioClass: per variant with var override hook', () => {
  assert.equal(aboutMediaRatioClass('split'), 'aspect-[var(--web-about-media-ratio,4/3)]');
  assert.equal(aboutMediaRatioClass('narrative'), 'aspect-[var(--web-about-media-ratio,21/9)]');
  assert.equal(aboutMediaRatioClass('timeline'), 'aspect-[var(--web-about-media-ratio,4/3)]');
});

test('aboutMediaOrderClass: only end side reorders', () => {
  assert.equal(aboutMediaOrderClass('start'), '');
  assert.equal(aboutMediaOrderClass('end'), 'lg:order-last');
});

test('aboutFeatureCols: responsive columns with fallback', () => {
  assert.equal(aboutFeatureCols(2), 'sm:grid-cols-2');
  assert.equal(aboutFeatureCols(3), 'sm:grid-cols-2 lg:grid-cols-3');
  assert.equal(aboutFeatureCols(4), 'sm:grid-cols-2 lg:grid-cols-4');
  assert.equal(aboutFeatureCols(9), 'sm:grid-cols-2 lg:grid-cols-3');
});

test('aboutFeatureIndex: zero pads from one', () => {
  assert.equal(aboutFeatureIndex(0), '01');
  assert.equal(aboutFeatureIndex(8), '09');
  assert.equal(aboutFeatureIndex(11), '12');
  assert.equal(aboutFeatureIndex(-3), '01');
});

test('summarizeHtml: strips tags and entities', () => {
  assert.equal(summarizeHtml('<p>品质  为先</p>'), '品质 为先');
  assert.equal(summarizeHtml('a &amp; b'), 'a & b');
});

test('summarizeHtml: truncates long text', () => {
  const out = summarizeHtml(`<p>${'x'.repeat(200)}</p>`, 20);
  assert.equal(out?.length, 21);
  assert.match(out ?? '', /…$/);
});

test('summarizeHtml: empty or non-string yields null', () => {
  assert.equal(summarizeHtml(null), null);
  assert.equal(summarizeHtml('   '), null);
  assert.equal(summarizeHtml(42), null);
});

test('normalizeAboutFeatures: drops junk and maps aliases', () => {
  const out = normalizeAboutFeatures([
    { title: ' 区域授权 ', summary: '按区域授予经销权。' },
    { label: '品牌物料', description: '提供展架、画册。' },
    { name: '技术协同', body: '<p>工程师协助选型。</p>' },
    { summary: '无标题项' },
    null,
    'string',
  ]);
  assert.deepEqual(out, [
    { title: '区域授权', summary: '按区域授予经销权。', icon: null, href: null },
    { title: '品牌物料', summary: '提供展架、画册。', icon: null, href: null },
    { title: '技术协同', summary: '工程师协助选型。', icon: null, href: null },
  ]);
});

test('normalizeAboutFeatures: keeps icon and href', () => {
  const out = normalizeAboutFeatures([{ title: '官网', icon: '★', url: '/products' }]);
  assert.deepEqual(out, [{ title: '官网', summary: null, icon: '★', href: '/products' }]);
});

test('normalizeAboutFeatures: non-array yields empty', () => {
  assert.deepEqual(normalizeAboutFeatures(null), []);
  assert.deepEqual(normalizeAboutFeatures({ title: 'x' }), []);
});

test('normalizeAboutStats: maps value/label aliases and numbers', () => {
  const out = normalizeAboutStats([
    { value: '50M+', label: '年产能（片）' },
    { number: 30, name: '出口国家' },
    { label: '缺值项' },
    undefined,
  ]);
  assert.deepEqual(out, [
    { value: '50M+', label: '年产能（片）' },
    { value: '30', label: '出口国家' },
  ]);
});
