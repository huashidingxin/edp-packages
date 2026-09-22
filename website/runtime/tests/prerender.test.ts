import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SECTION_MODE,
  createPaginationPrerenderFilter,
  createSectionPrerenderFilter,
  normalizeLocalePrefixes,
  paginationRouteModes,
  resolvePaginationPolicy,
  resolveSectionPolicies,
  sectionRouteModes,
} from '../src/lib/prerender.ts';

test('resolveSectionPolicies: 空配置 -> 无策略', () => {
  assert.deepEqual(resolveSectionPolicies(undefined), []);
  assert.deepEqual(resolveSectionPolicies({}), []);
});

test('resolveSectionPolicies: true 用默认值，对象可覆盖页数与模式', () => {
  const [articles, products] = resolveSectionPolicies({
    articles: true,
    products: { listSsgPages: 3, mode: 'isr' },
  });
  assert.deepEqual(articles, { base: '/articles', listSsgPages: 10, mode: DEFAULT_SECTION_MODE });
  assert.deepEqual(products, { base: '/products', listSsgPages: 3, mode: 'isr' });
});

test('resolveSectionPolicies: 支持前导斜杠、false 跳过、非法页数回落默认', () => {
  const policies = resolveSectionPolicies({ '/articles': true, cases: false, gallery: { listSsgPages: 0 } });
  assert.deepEqual(policies.map((p) => p.base), ['/articles', '/gallery']);
  assert.equal(policies[1].listSsgPages, 10);
});

test('sectionRouteModes: 默认加 /en 前缀变体，显式空数组表示单语言', () => {
  const policies = resolveSectionPolicies({ articles: true });
  assert.deepEqual(sectionRouteModes(policies), {
    '/articles/**': 'swr',
    '/en/articles/**': 'swr',
  });
  assert.deepEqual(sectionRouteModes(policies, []), { '/articles/**': 'swr' });
});

test('normalizeLocalePrefixes: 去斜杠/小写/去重', () => {
  assert.deepEqual(normalizeLocalePrefixes(undefined), ['en']);
  assert.deepEqual(normalizeLocalePrefixes(['/EN/', 'en', 'ja']), ['en', 'ja']);
  assert.deepEqual(normalizeLocalePrefixes([]), []);
});

test('createSectionPrerenderFilter: 无策略 -> null（不注入 ignore）', () => {
  assert.equal(createSectionPrerenderFilter([]), null);
});

test('createSectionPrerenderFilter: 详情与深分页排除，列表前 10 页保留', () => {
  const filter = createSectionPrerenderFilter(resolveSectionPolicies({ articles: { listSsgPages: 10 } }));
  assert.ok(filter);
  const excluded = [
    '/articles/802',
    '/en/articles/802',
    '/articles/qiyexinwen/page/11',
    '/articles/qiyexinwen/page/23',
    '/en/articles/qiyexinwen/page/12',
    '/articles/page/11',
  ];
  const kept = [
    '/',
    '/en',
    '/articles',
    '/articles/qiyexinwen',
    '/articles/qiyexinwen/page/1',
    '/articles/qiyexinwen/page/10',
    '/en/articles/qiyexinwen',
    '/en/articles/qiyexinwen/page/3',
    '/products/657',
    '/about/guanyuhaofei',
    '/technology',
    '/joinus',
  ];
  for (const path of excluded) assert.equal(filter(path), true, `${path} 应排除预渲染`);
  for (const path of kept) assert.equal(filter(path), false, `${path} 应保持预渲染`);
});

test('createSectionPrerenderFilter: 只作用于声明区段', () => {
  const filter = createSectionPrerenderFilter(resolveSectionPolicies({ articles: true }));
  assert.ok(filter);
  // 产品/团队区段未声明 -> 明细照旧预渲染
  assert.equal(filter('/products/657'), false);
  assert.equal(filter('/team/12'), false);
  assert.equal(filter('/products/product-center/page/99'), false);
});

test('createSectionPrerenderFilter: 区段根路径与尾部斜杠', () => {
  const filter = createSectionPrerenderFilter(resolveSectionPolicies({ articles: true }));
  assert.ok(filter);
  assert.equal(filter('/articles/802/'), true);
  assert.equal(filter('/articles/qiyexinwen/page/11/'), true);
  assert.equal(filter('/articles/'), false);
  assert.equal(filter('/articlesqiyexinwen/802'), false);
});

test('resolvePaginationPolicy: 未配置 -> null，true 用默认，可覆盖页数与模式', () => {
  assert.equal(resolvePaginationPolicy(undefined), null);
  assert.equal(resolvePaginationPolicy(false), null);
  assert.deepEqual(resolvePaginationPolicy(true), { ssgPages: 10, mode: DEFAULT_SECTION_MODE });
  assert.deepEqual(resolvePaginationPolicy({ ssgPages: 3, mode: 'isr' }), { ssgPages: 3, mode: 'isr' });
  assert.deepEqual(resolvePaginationPolicy({ ssgPages: 0 }), { ssgPages: 10, mode: DEFAULT_SECTION_MODE });
});

test('paginationRouteModes: 一条 /** 覆盖所有语言前缀，未启用则空', () => {
  assert.deepEqual(paginationRouteModes(resolvePaginationPolicy(true)), { '/**': 'swr' });
  assert.deepEqual(paginationRouteModes(null), {});
});

test('createPaginationPrerenderFilter: 不限区段/模型与语言前缀', () => {
  const filter = createPaginationPrerenderFilter(resolvePaginationPolicy({ ssgPages: 10 }));
  assert.ok(filter);
  const excluded = [
    '/articles/qiyexinwen/page/11',
    '/en/articles/qiyexinwen/page/12',
    '/products/page/11',
    '/products/shengchanxian/page/15',
    '/gallery/page/11',
    '/cases/anli/page/11',
    '/jobs/page/11',
    '/team/page/11',
    '/zh-CN/news/page/11',
    '/articles/qiyexinwen/page/11/',
  ];
  const kept = [
    '/',
    '/en',
    '/articles/qiyexinwen',
    '/articles/qiyexinwen/page/1',
    '/articles/qiyexinwen/page/10',
    '/en/products/shengchanxian/page/10',
    '/products/page/2',
    '/products/657',
    '/articles/802',
    '/about/guanyuhaofei',
    '/technology/page/11x',
  ];
  for (const path of excluded) assert.equal(filter(path), true, `${path} 应排除预渲染`);
  for (const path of kept) assert.equal(filter(path), false, `${path} 应保持预渲染`);
});

test('createPaginationPrerenderFilter: 与 section 过滤器叠加时更紧的阈值生效', () => {
  const sectionFilter = createSectionPrerenderFilter(resolveSectionPolicies({ products: { listSsgPages: 5 } }));
  const paginationFilter = createPaginationPrerenderFilter(resolvePaginationPolicy({ ssgPages: 10 }));
  assert.ok(sectionFilter && paginationFilter);
  const excluded = (path: string) => sectionFilter(path) || paginationFilter(path);
  // products 区段被 section 收紧到 5 页
  assert.equal(excluded('/products/shengchanxian/page/6'), true);
  // 其他区段仍按全局 10 页
  assert.equal(excluded('/articles/qiyexinwen/page/6'), false);
  assert.equal(excluded('/articles/qiyexinwen/page/11'), true);
});
