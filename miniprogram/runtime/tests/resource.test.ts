import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resetAppHttp, setTransport, setupAppHttp } from '../src/request.ts';
import { Resource } from '../src/resource.ts';

test('Resource 映射到 RESTful 方法与路径', async () => {
  const calls: Array<{ method: string; url: string }> = [];
  resetAppHttp();
  setupAppHttp({ baseURL: 'https://api.test/api/v1' });
  setTransport(async (options) => {
    calls.push({ method: options.method, url: options.url });
    return { statusCode: 200, data: { success: true, data: {} } };
  });

  const product = new Resource('/admin/products');
  await product.list({ page: 1 });
  await product.get(12);
  await product.store({ title: 'x' });
  await product.update(12, { title: 'y' });
  await product.destroy(12);

  assert.deepEqual(calls, [
    { method: 'GET', url: 'https://api.test/api/v1/admin/products?page=1' },
    { method: 'GET', url: 'https://api.test/api/v1/admin/products/12' },
    { method: 'POST', url: 'https://api.test/api/v1/admin/products' },
    { method: 'PUT', url: 'https://api.test/api/v1/admin/products/12' },
    { method: 'DELETE', url: 'https://api.test/api/v1/admin/products/12' },
  ]);

  // URI 规范化：自动补前导斜杠；绝对地址直通
  assert.equal(new Resource('site/x').uri, '/site/x');
  assert.equal(new Resource('https://a.com/x').uri, 'https://a.com/x');
});
