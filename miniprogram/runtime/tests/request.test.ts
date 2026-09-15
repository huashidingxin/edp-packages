import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  friendlyMessage,
  http,
  AppRequestError,
  resetAppHttp,
  setTransport,
  setupAppHttp,
} from '../src/request.ts';

interface Call {
  url: string;
  method: string;
  data?: unknown;
  header?: Record<string, string>;
}

const calls: Call[] = [];

const envelope = (data: unknown) => ({ success: true, data });

/** 每个用例都重置单例，避免相互污染。 */
function begin(data: unknown, statusCode = 200): void {
  resetAppHttp();
  calls.length = 0;
  setupAppHttp({ baseURL: 'https://api.test/api/v1', applicationCode: 'demo' });
  setTransport(async (options) => {
    calls.push(options as Call);
    return { statusCode, data };
  });
}

test('拼 URL 与默认 header（空值参数跳过）', async () => {
  begin(envelope({ ok: 1 }));
  await http.get('/site/page-data/home', { locale: 'zh-CN', empty: '', none: null });

  assert.equal(calls[0]!.url, 'https://api.test/api/v1/site/page-data/home?locale=zh-CN');
  assert.equal(calls[0]!.method, 'GET');
  assert.equal(calls[0]!.header?.['X-Application-Code'], 'demo');
  assert.equal(calls[0]!.header?.Accept, 'application/json');
});

test('业务包络解包成 data', async () => {
  begin(envelope({ site: { name: '示例' } }));
  const data = await http.get<{ site: { name: string } }>('/site/bootstrap');
  assert.equal(data.site.name, '示例');
});

test('success=false 抛错并按错误码映射状态', async () => {
  begin({ success: false, error: { code: 'NOT_FOUND', message: '页面不存在' } });
  await assert.rejects(
    () => http.get('/x'),
    (error: unknown) => {
      assert.ok(error instanceof AppRequestError);
      assert.equal(error.statusCode, 404);
      assert.equal(error.message, '页面不存在');
      return true;
    },
  );
});

test('非 2xx 抛错并带状态码', async () => {
  begin({ message: '服务异常' }, 500);
  await assert.rejects(
    () => http.get('/x'),
    (error: unknown) => {
      assert.equal((error as AppRequestError).statusCode, 500);
      assert.equal((error as AppRequestError).message, '服务异常');
      return true;
    },
  );
});

test('custom.raw 返回完整包络', async () => {
  begin(envelope({ n: 1 }));
  const body = await http.get<{ success: boolean }>('/x', undefined, { custom: { raw: true } });
  assert.equal(body.success, true);
});

test('未配置 baseURL 时给出可读错误', async () => {
  resetAppHttp();
  calls.length = 0;
  setTransport(async (options) => {
    calls.push(options as Call);
    return { statusCode: 200, data: envelope({}) };
  });
  await assert.rejects(() => http.get('/x'), /setupAppHttp/);
  assert.equal(calls.length, 0, '不该发出请求');
});

test('请求拦截器可修改 header 与参数', async () => {
  begin(envelope({}));
  http.interceptors.request.use((config) => {
    config.header = { ...(config.header ?? {}), 'X-Extra': '1' };
    config.params = { ...(config.params ?? {}), extra: '2' };
    return config;
  });

  await http.get('/site/bootstrap');
  assert.equal(calls[0]!.header?.['X-Extra'], '1');
  assert.match(calls[0]!.url, /extra=2/);
});

test('失败拦截器可以"吞掉"错误并返回兜底值', async () => {
  begin({ success: false, error: { code: 'BAD', message: '坏了' } });
  http.interceptors.response.use(undefined, () => ({ fallback: true }));

  const data = await http.get<{ fallback: boolean }>('/x');
  assert.equal(data.fallback, true);
});

test('失败请求始终结束，调用方 finally 能清理页面状态', async () => {
  begin({ success: false, error: { code: 'BAD', message: '坏了' } });
  let finalized = false;
  await assert.rejects(http.get('/x', undefined, { custom: { toast: false } }).finally(() => { finalized = true; }));
  assert.equal(finalized, true);
});

test('friendlyMessage：422 取 errors 第一条', () => {
  const error = new AppRequestError(422, 'x', { response: { errors: { phone: ['电话格式不正确'] } } });
  assert.equal(friendlyMessage(error), '电话格式不正确');
});

test('loading 在成功和失败后都关闭，未要求 loading 的请求不关闭别人的提示', async () => {
  const events: string[] = [];
  (globalThis as unknown as { uni: unknown }).uni = {
    showLoading: () => events.push('show'), hideLoading: () => events.push('hide'),
  };
  begin(envelope({ ok: true }));
  await http.get('/x', undefined, { custom: { loading: true } });
  assert.deepEqual(events, ['show', 'hide']);
  await http.get('/x', undefined, { custom: { loading: false } });
  assert.deepEqual(events, ['show', 'hide']);
  begin({ success: false, error: { code: 'BAD', message: '坏了' } });
  await assert.rejects(http.get('/x', undefined, { custom: { loading: true, toast: false } }));
  assert.deepEqual(events, ['show', 'hide', 'show', 'hide']);
});

test('并发 loading 请求由最后一个请求负责关闭', async () => {
  const events: string[] = [];
  (globalThis as unknown as { uni: unknown }).uni = {
    showLoading: () => events.push('show'), hideLoading: () => events.push('hide'),
  };
  begin(envelope({}));
  const resolve: Array<(value: { statusCode: number; data: unknown }) => void> = [];
  setTransport(() => new Promise((done) => { resolve.push(done); }));
  const first = http.get('/first', undefined, { custom: { loading: true } });
  const second = http.get('/second', undefined, { custom: { loading: true } });
  await new Promise(setImmediate);
  resolve[0]!({ statusCode: 200, data: envelope({}) });
  await first;
  assert.deepEqual(events, ['show']);
  resolve[1]!({ statusCode: 200, data: envelope({}) });
  await second;
  assert.deepEqual(events, ['show', 'hide']);
});

test('非 2xx 也保留后端业务错误码与具体提示', async () => {
  begin({ success: false, error: { code: 'CONTENT_INVALID', message: '请填写联系人' } }, 422);
  await assert.rejects(http.post('/x', {}), (error: unknown) => {
    assert.ok(error instanceof AppRequestError);
    assert.equal(error.code, 'CONTENT_INVALID');
    assert.equal(error.message, '请填写联系人');
    assert.equal(friendlyMessage(error), '请填写联系人');
    return true;
  });
});
