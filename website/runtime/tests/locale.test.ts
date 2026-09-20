import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  localeCodeFromPath,
  localeShort,
  localizePath,
  prefixLocalePath,
  stripLocalePrefix,
} from '../src/lib/locale.ts';

const CODES = ['zh-CN', 'en-US'];

test('localeShort: 取短码前缀', () => {
  assert.equal(localeShort('zh-CN'), 'zh');
  assert.equal(localeShort('en_US'), 'en');
  assert.equal(localeShort('en'), 'en');
  assert.equal(localeShort(''), '');
});

test('localeCodeFromPath: 只认已启用语言的前缀', () => {
  assert.equal(localeCodeFromPath('/en/articles/qiyexinwen', CODES), 'en-US');
  assert.equal(localeCodeFromPath('/zh-CN/products', CODES), 'zh-CN');
  assert.equal(localeCodeFromPath('/products/chanpinzhanshi', CODES), null);
  // 首段不是语言（未启用 / 长度不符）
  assert.equal(localeCodeFromPath('/english/foo', CODES), null);
  assert.equal(localeCodeFromPath('/fr/foo', CODES), null);
  assert.equal(localeCodeFromPath('/', CODES), null);
});

test('stripLocalePrefix: 去掉语言前缀，未启用前缀原样返回', () => {
  assert.equal(stripLocalePrefix('/en/articles/x', CODES), '/articles/x');
  assert.equal(stripLocalePrefix('/en', CODES), '/');
  assert.equal(stripLocalePrefix('/zh-CN/about/guanyuhaofei', CODES), '/about/guanyuhaofei');
  assert.equal(stripLocalePrefix('/products/petg-film', CODES), '/products/petg-film');
  assert.equal(stripLocalePrefix('/english/foo', CODES), '/english/foo');
});

test('prefixLocalePath: 默认语言无前缀，其他语言加短码', () => {
  assert.equal(prefixLocalePath('/products', 'zh-CN', 'zh-CN'), '/products');
  assert.equal(prefixLocalePath('/', 'zh-CN', 'zh-CN'), '/');
  assert.equal(prefixLocalePath('/products', 'en-US', 'zh-CN'), '/en/products');
  assert.equal(prefixLocalePath('/', 'en-US', 'zh-CN'), '/en');
  assert.equal(prefixLocalePath('', 'en-US', 'zh-CN'), '/en');
});

test('localizePath: 幂等（后端 href 已本地化时不再叠加前缀）', () => {
  // 英文页 + 后端下发的 /en/... href（曾经的 bug 会得到 /en/en/...）
  assert.equal(localizePath('/en/about/guanyuhaofei', 'en-US', 'zh-CN', CODES), '/en/about/guanyuhaofei');
  assert.equal(localizePath('/en', 'en-US', 'zh-CN', CODES), '/en');
  assert.equal(localizePath('/en/products/petg-film#idcl74', 'en-US', 'zh-CN', CODES), '/en/products/petg-film#idcl74');
  // 英文页 + 站点自建逻辑路径仍要加前缀
  assert.equal(localizePath('/articles/815', 'en-US', 'zh-CN', CODES), '/en/articles/815');
  // 中文页 + 后端下发的无前缀 href
  assert.equal(localizePath('/about/guanyuhaofei', 'zh-CN', 'zh-CN', CODES), '/about/guanyuhaofei');
  // 中文页 + 站点自建逻辑路径
  assert.equal(localizePath('/joinus', 'zh-CN', 'zh-CN', CODES), '/joinus');
});

test('localizePath: bootstrap 未加载（无 locales）时不误伤首段', () => {
  // 未加载时无法判定语言前缀：路径原样保留，避免把站点自有首段当成语言剥掉。
  assert.equal(localizePath('/about', 'zh-CN', 'zh-CN', []), '/about');
  assert.equal(localizePath('/en/about', 'zh-CN', 'zh-CN', []), '/en/about');
});
