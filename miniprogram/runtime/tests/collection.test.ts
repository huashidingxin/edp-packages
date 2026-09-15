import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ref } from 'vue';
import { useAppCollection } from '../src/collection.ts';
import { resetAppHttp, setTransport, setupAppHttp } from '../src/request.ts';

const item = (id: number) => ({ key: `product:${id}`, values: { id } });
const response = (items: ReturnType<typeof item>[], page: number, totalPages = 2) => ({
  statusCode: 200,
  data: { success: true, data: { items, meta: { page, per_page: 2, total: 4, total_pages: totalPages } } },
});
function begin() {
  resetAppHttp();
  setupAppHttp({ baseURL: 'https://api.test/api/v1', applicationCode: 'demo' });
}

test('免 COUNT 分页按 has_more 停止，末页刚好满页也不会多请求一次', async () => {
  begin();
  const pages: number[] = [];
  setTransport(async ({ url }) => {
    const page = Number(new URL(url).searchParams.get('page'));
    pages.push(page);
    return {
      statusCode: 200,
      data: { success: true, data: { items: [item(page * 2 - 1), item(page * 2)], meta: { page, per_page: 2, has_more: page === 1 } } },
    };
  });
  const list = useAppCollection('product', { limit: 2 });
  await list.reload();
  assert.equal(list.hasMore.value, true);
  await list.loadMore();
  assert.equal(list.hasMore.value, false);
  await list.loadMore();
  assert.deepEqual(pages, [1, 2]);
  assert.equal(list.items.value.length, 4);
});

test('触底合并分页并去重；重复触底合并为一个请求；最后一页停止', async () => {
  begin();
  const pages: number[] = [];
  setTransport(async ({ url }) => {
    const page = Number(new URL(url).searchParams.get('page'));
    pages.push(page);
    return response(page === 1 ? [item(1), item(2)] : [item(2), item(3)], page);
  });
  const list = useAppCollection('product', { limit: 2 });
  await list.reload();
  await Promise.all([list.loadMore(), list.loadMore()]);
  await list.loadMore();
  assert.deepEqual(pages, [1, 2]);
  assert.deepEqual(list.items.value.map((record) => record.values.id), [1, 2, 3]);
  assert.equal(list.hasMore.value, false);
});

test('筛选条件改变后旧分页响应不能混入新列表', async () => {
  begin();
  let finish!: (result: ReturnType<typeof response>) => void;
  setTransport(() => new Promise((resolve) => { finish = resolve; }));
  const params = ref({ category_id: 1, limit: 2 });
  const list = useAppCollection('product', params);
  const old = list.reload();
  await new Promise(setImmediate);
  params.value.category_id = 2;
  setTransport(async () => response([item(20)], 1, 1));
  await list.reload();
  finish(response([item(1)], 1));
  await old;
  assert.deepEqual(list.items.value.map((record) => record.values.id), [20]);
  assert.equal(list.loading.value, false);
});

test('加载下一页失败保留列表和页码，重试仍请求失败的页', async () => {
  begin();
  setTransport(async () => response([item(1), item(2)], 1));
  const list = useAppCollection('product', { limit: 2 });
  await list.reload();
  setTransport(async () => ({ statusCode: 500, data: { message: '暂时不可用' } }));
  await list.loadMore();
  assert.equal(list.page.value, 1);
  assert.equal(list.items.value.length, 2);
  assert.equal(list.loading.value, false);
  assert.equal(list.error.value, '暂时不可用');
  setTransport(async ({ url }) => {
    assert.equal(new URL(url).searchParams.get('page'), '2');
    return response([item(3), item(4)], 2);
  });
  await list.loadMore();
  assert.equal(list.items.value.length, 4);
  assert.equal(list.error.value, null);
});

test('已到末页后刷新失败，重试仍能重新加载第一页', async () => {
  begin();
  setTransport(async () => response([item(1)], 1, 1));
  const list = useAppCollection('product');
  await list.reload();
  assert.equal(list.hasMore.value, false);
  setTransport(async () => ({ statusCode: 500, data: { message: '刷新失败' } }));
  await list.reload();
  setTransport(async ({ url }) => {
    assert.equal(new URL(url).searchParams.get('page'), '1');
    return response([item(2)], 1, 1);
  });
  await list.loadMore();
  assert.equal(list.error.value, null);
  assert.deepEqual(list.items.value.map((record) => record.values.id), [2]);
});
