import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appSite, sourceItemId } from '../src/site.ts';
import { resetAppHttp, setTransport, setupAppHttp } from '../src/request.ts';

test('公开 API 使用应用标识、当前平台和配置语言，不要求网站 Host 或路由', async () => {
  resetAppHttp();
  setupAppHttp({ baseURL: 'https://api.test/api/v1', applicationCode: 'demo', locale: 'en-GB' });
  (globalThis as unknown as { uni: unknown }).uni = { getAppBaseInfo: () => ({ uniPlatform: 'mp-weixin' }) };
  const calls: Array<{ url: string; method: string; data?: unknown; header?: Record<string, string> }> = [];
  setTransport(async (options) => {
    calls.push(options);
    return { statusCode: 200, data: { success: true, data: {} } };
  });
  await appSite.bootstrap();
  await appSite.pageData('home', { card_id: 7 });
  await appSite.collection('product', { page: 2, limit: 6, category_id: 3 });
  await appSite.categories({ type: 'case-study' });
  await appSite.record('product', 'a/b');
  await appSite.form('customization', { locale: 'zh-CN' });
  await appSite.submitForm('customization', { name: '客户' });

  assert.ok(calls.every((call) => call.header?.['X-Application-Code'] === 'demo'));
  const urls = calls.map((call) => new URL(call.url));
  assert.equal(urls[0]!.searchParams.get('include'), 'site,strings');
  assert.equal(urls[1]!.searchParams.get('device'), 'mp-weixin');
  assert.equal(urls[1]!.searchParams.get('locale'), 'en-GB');
  assert.equal(urls[1]!.searchParams.get('card_id'), '7');
  assert.equal(urls[2]!.searchParams.get('page'), '2');
  assert.equal(urls[2]!.searchParams.get('category_id'), '3');
  assert.equal(urls[2]!.searchParams.get('pagination'), 'simple');
  assert.equal(urls[3]!.pathname, '/api/v1/site/categories');
  assert.equal(urls[3]!.searchParams.get('type'), 'case-study');
  assert.equal(urls[3]!.searchParams.get('locale'), 'en-GB');
  assert.equal(urls[4]!.pathname, '/api/v1/site/records/product/a%2Fb');
  assert.equal(urls[5]!.pathname, '/api/v1/site/forms/customization');
  assert.equal(urls[5]!.searchParams.get('locale'), 'zh-CN');
  assert.equal(urls[6]!.pathname, '/api/v1/site/forms/customization/submit');
  assert.equal(calls[6]!.method, 'POST');
  assert.deepEqual(calls[6]!.data, { payload: { name: '客户' }, locale: 'en-GB' });
  assert.ok(urls.every((url) => !url.searchParams.has('host')));
  await appSite.collection('product', { pagination: 'full' });
  assert.equal(new URL(calls.at(-1)!.url).searchParams.get('pagination'), 'full');

  // 数组参数按重复的 key[] 序列化，后端按数组解析（如 category_ids）
  await appSite.collection('case-study', { category_ids: [4, 5], category_id: null });
  const arrayUrl = new URL(calls.at(-1)!.url);
  assert.deepEqual(arrayUrl.searchParams.getAll('category_ids[]'), ['4', '5']);
  assert.equal(arrayUrl.searchParams.has('category_id'), false);
});

test('SourceItem 的记录标识优先使用 values.id，再解析 kind:id', () => {
  assert.equal(sourceItemId({ key: 'product:12', values: {} }), '12');
  assert.equal(sourceItemId({ key: 'product:12', values: { id: 13 } }), '13');
  assert.equal(sourceItemId({ key: 'unknown', values: {} }), null);
});
