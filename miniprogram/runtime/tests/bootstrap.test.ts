import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prefetchAppBootstrap, resetAppBootstrap, useAppBootstrap } from '../src/bootstrap.ts';
import { resetAppHttp, setTransport, setupAppHttp } from '../src/request.ts';

const CACHE_KEY = 'edp:bootstrap:v1:demo';
const CONFIG = { baseURL: 'https://api.test/api/v1', applicationCode: 'demo' };

const remote = { site: { name: '服务端站点' }, menus: {}, navigation: {}, strings: {} };

/** 合法缓存记录（可逐项覆盖，用于校验用例）。 */
const cacheRecord = (overrides: Record<string, unknown> = {}) => ({
  applicationCode: 'demo',
  apiBase: CONFIG.baseURL,
  savedAt: Date.now(),
  data: { site: { name: '缓存站点' }, menus: {}, navigation: {}, strings: {} },
  ...overrides,
});

let storage: Record<string, unknown> = {};
let requests: string[] = [];

function sleep(ms = 1): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 重置环境并装上假 uni（storage 三件套）。注意 seed 缓存要在 begin() 之后。 */
function begin(): void {
  storage = {};
  requests = [];
  resetAppHttp();

  (globalThis as unknown as { uni: unknown }).uni = {
    getStorageSync: (key: string) => storage[key],
    setStorageSync: (key: string, value: unknown) => {
      storage[key] = value;
    },
    removeStorageSync: (key: string) => {
      delete storage[key];
    },
  };

  setupAppHttp(CONFIG);
  setTransport(async (options) => {
    requests.push(options.url);
    return { statusCode: 200, data: { success: true, data: remote } };
  });

  resetAppBootstrap(); // 清内存 + 清 storage，必须在 seed 之前
}

test('冷启动：先渲染缓存，同时仍发请求覆盖（stale-while-revalidate）', async () => {
  begin();
  storage[CACHE_KEY] = cacheRecord();

  const { site } = useAppBootstrap({ auto: false });
  assert.equal(site.value?.name, '缓存站点', '首帧应直接用缓存，不等网络');
  assert.deepEqual(requests, [], '读缓存本身不应发起请求');

  prefetchAppBootstrap();
  await sleep();

  assert.equal(requests.length, 1, '缓存不该阻止 revalidate');
  assert.equal(site.value?.name, '服务端站点', '请求成功后应被覆盖');
});

test('缓存校验：应用标识 / API 地址 / TTL / 结构任一不符即忽略', () => {
  begin();
  storage[CACHE_KEY] = cacheRecord({ applicationCode: 'other' });
  assert.equal(useAppBootstrap({ auto: false }).site.value, null, '应用标识不符应忽略');

  begin();
  storage[CACHE_KEY] = cacheRecord({ apiBase: 'https://prod.example.com/api/v1' });
  assert.equal(useAppBootstrap({ auto: false }).site.value, null, 'API 地址不符应忽略');

  begin();
  storage[CACHE_KEY] = cacheRecord({ savedAt: Date.now() - 8 * 24 * 60 * 60 * 1000 });
  assert.equal(useAppBootstrap({ auto: false }).site.value, null, '超过 TTL 应忽略');

  begin();
  storage[CACHE_KEY] = 'not-json';
  assert.equal(useAppBootstrap({ auto: false }).site.value, null, '损坏缓存应忽略且不抛错');

  begin();
  storage[CACHE_KEY] = { applicationCode: 'demo', apiBase: CONFIG.baseURL, savedAt: Date.now() };
  assert.equal(useAppBootstrap({ auto: false }).site.value, null, '缺 data 应忽略');
});

test('请求成功后写缓存；resetAppBootstrap 同时清内存与本地缓存', async () => {
  begin();

  prefetchAppBootstrap();
  await sleep();

  const record = storage[CACHE_KEY] as {
    applicationCode: string;
    apiBase: string;
    savedAt: number;
    data: { site: { name: string } };
  };
  assert.ok(record, '成功返回后应写入缓存');
  assert.equal(record.applicationCode, 'demo');
  assert.equal(record.apiBase, CONFIG.baseURL);
  assert.equal(typeof record.savedAt, 'number');
  assert.equal(record.data.site.name, '服务端站点');

  resetAppBootstrap();
  assert.equal(storage[CACHE_KEY], undefined, 'reset 应清掉本地缓存');
  assert.equal(useAppBootstrap({ auto: false }).site.value, null, 'reset 应清掉内存状态');
});

test('请求失败时保留缓存继续展示，并记录 error', async () => {
  begin();
  storage[CACHE_KEY] = cacheRecord();
  setTransport(async () => ({ statusCode: 500, data: { message: '服务异常' } }));

  const { site, error } = useAppBootstrap({ auto: false });
  prefetchAppBootstrap();
  await sleep();

  assert.equal(site.value?.name, '缓存站点', '失败时用缓存兜底');
  assert.equal(error.value, '服务异常');
});

test('bootstrap 只请求基础信息与词条', async () => {
  begin();
  await useAppBootstrap({ auto: false }).reload();
  const url = new URL(requests[0]!);
  assert.equal(url.searchParams.get('include'), 'site,strings');
});

test('reset 后已在途的旧响应不能恢复已清空的状态', async () => {
  begin();
  let finish!: (value: { statusCode: number; data: unknown }) => void;
  setTransport(() => new Promise((done) => { finish = done; }));
  const pending = useAppBootstrap({ auto: false }).reload();
  await new Promise(setImmediate);
  resetAppBootstrap();
  finish({ statusCode: 200, data: { success: true, data: remote } });
  await pending;
  assert.equal(useAppBootstrap({ auto: false }).site.value, null);
  assert.equal(storage[CACHE_KEY], undefined);
});

test('切换应用时重新取数，旧响应不能覆盖新应用', async () => {
  begin();
  let finishOld!: (value: { statusCode: number; data: unknown }) => void;
  setTransport(() => new Promise((done) => { finishOld = done; }));
  const old = useAppBootstrap({ auto: false }).reload();
  await new Promise(setImmediate);
  setupAppHttp({ ...CONFIG, applicationCode: 'other' });
  setTransport(async () => ({ statusCode: 200, data: { success: true, data: { ...remote, site: { name: '新应用' } } } }));
  const current = useAppBootstrap({ auto: false });
  assert.equal(Boolean(current.site.value), false);
  await current.reload();
  finishOld({ statusCode: 200, data: { success: true, data: remote } });
  await old;
  assert.equal(current.site.value?.name, '新应用');
});
