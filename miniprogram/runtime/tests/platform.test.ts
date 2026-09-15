import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getPlatformDevice } from '../src/platform.ts';

function withUni(uni: Record<string, unknown> | undefined): void {
  if (uni === undefined) {
    delete (globalThis as unknown as { uni?: unknown }).uni;
    return;
  }
  (globalThis as unknown as { uni: unknown }).uni = uni;
}

test('getPlatformDevice：按平台推导（小程序 / H5 / APP）', () => {
  withUni({ getAppBaseInfo: () => ({ uniPlatform: 'mp-weixin' }) });
  assert.equal(getPlatformDevice(), 'mp-weixin');

  withUni({ getSystemInfoSync: () => ({ uniPlatform: 'web' }) });
  assert.equal(getPlatformDevice(), 'web', 'H5 用 web，与后端默认值一致');

  withUni({ getSystemInfoSync: () => ({ uniPlatform: 'app' }) });
  assert.equal(getPlatformDevice(), 'app');

  withUni({ getAppBaseInfo: () => ({ uniPlatform: 'mp-alipay' }) });
  assert.equal(getPlatformDevice(), 'mp-alipay');

  withUni(undefined);
});

test('getPlatformDevice：取不到平台信息时回落 web，不抛错', () => {
  withUni({});
  assert.equal(getPlatformDevice(), 'web');

  withUni({ getSystemInfoSync: () => ({}) });
  assert.equal(getPlatformDevice(), 'web');

  withUni(undefined);
  assert.equal(getPlatformDevice(), 'web');
});
