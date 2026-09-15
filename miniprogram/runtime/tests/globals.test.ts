import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installAppGlobals, type AppGlobalApi } from '../src/globals.ts';
import { http } from '../src/request.ts';
import { Resource } from '../src/resource.ts';
import { goBack, openLink, openPath } from '../src/router.ts';

function withFakeUni(): Record<string, unknown> {
  const uni = {};
  (globalThis as unknown as { uni: unknown }).uni = uni;
  return uni;
}

function removeUni(): void {
  delete (globalThis as unknown as { uni?: unknown }).uni;
}

test('installAppGlobals：挂到 uni.$edp 与 uni.Resource，且都是同一份引用', () => {
  const uni = withFakeUni();
  const api = installAppGlobals();

  assert.equal(uni.Resource, Resource, 'uni.Resource 必须是导出本体，不是副本');
  assert.equal(api?.Resource, Resource);

  const globals = uni.$edp as AppGlobalApi;
  assert.equal(globals.Resource, Resource);
  assert.equal(globals.http, http);
  assert.equal(globals.openPath, openPath);
  assert.equal(globals.openLink, openLink);
  assert.equal(globals.goBack, goBack);
  assert.equal(globals.Resource, uni.Resource, '两个入口指向同一引用');

  removeUni();
});

test('installAppGlobals：重复调用幂等（引用不变）', () => {
  const uni = withFakeUni();
  const first = installAppGlobals();
  const second = installAppGlobals();
  assert.equal(first?.openPath, second?.openPath);
  assert.equal(uni.$edp, second, '后一次挂载覆盖为同一份实现');
  removeUni();
});

test('installAppGlobals：无 uni 环境不抛错、返回 undefined', () => {
  removeUni();
  assert.equal(installAppGlobals(), undefined);
});
