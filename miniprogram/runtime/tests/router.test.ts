import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  collectTabPaths,
  getTabPaths,
  goBack,
  injectAppPagesJson,
  installAppRouteInterceptor,
  isTabPath,
  normalizeAppPath,
  openLink,
  openPath,
  resetAppRouter,
  resolveOpenMethod,
  setupAppRouter,
  toQueryString,
  type AppRouteGuardContext,
} from '../src/router.ts';

interface Call {
  method: string;
  url: string;
}

interface Hooks {
  invoke?: (options: Record<string, unknown>) => unknown;
}

const pagesJson = {
  pages: [{ path: 'pages/index/index' }, { path: 'pages/product/list' }],
  tabBar: {
    list: [
      { pagePath: 'pages/index/index' },
      { pagePath: '/pages/mine/mine' },
      { pagePath: 'pages/index/index' },
      { pagePath: 123 },
    ],
  },
};

let calls: Call[] = [];
let stackDepth = 1;
let interceptors: Record<string, Hooks> = {};

/**
 * 每个用例重置状态并装上假 uni。
 * 假 uni 实现真实语义：interceptor 的 `invoke` 返回 `false` 即取消调用。
 */
function begin(withTabBar = true): void {
  resetAppRouter();
  calls = [];
  stackDepth = 1;
  interceptors = {};

  const dispatch =
    (method: string) =>
    (options: Record<string, unknown> = {}): void => {
      const hooks = interceptors[method];
      if (hooks?.invoke && hooks.invoke(options) === false) return;
      calls.push({ method, url: typeof options.url === 'string' ? options.url : '' });
    };

  (globalThis as unknown as { uni: unknown }).uni = {
    addInterceptor: (type: string, hooks: Hooks) => {
      interceptors[type] = hooks;
    },
    navigateTo: dispatch('navigateTo'),
    redirectTo: dispatch('redirectTo'),
    reLaunch: dispatch('reLaunch'),
    switchTab: dispatch('switchTab'),
    navigateBack: dispatch('navigateBack'),
    getCurrentPages: () => Array.from({ length: stackDepth }, () => ({})),
  };

  if (withTabBar) setupAppRouter({ pagesJson });
}

function removeUni(): void {
  delete (globalThis as unknown as { uni?: unknown }).uni;
}

/** 真实 uni 平台形态：getCurrentPages 是全局函数，不在 uni 对象上。 */
function useGlobalGetCurrentPages(depth: number): void {
  const g = globalThis as unknown as { getCurrentPages?: () => unknown };
  g.getCurrentPages = () => Array.from({ length: depth }, () => ({}));
}

function removeGlobalGetCurrentPages(): void {
  delete (globalThis as unknown as { getCurrentPages?: unknown }).getCurrentPages;
}

test('collectTabPaths：抽取、去重、归一化，忽略非法项', () => {
  assert.deepEqual(collectTabPaths(pagesJson), ['pages/index/index', 'pages/mine/mine']);
  assert.deepEqual(collectTabPaths({ pages: [] }), []);
  assert.deepEqual(collectTabPaths({ tabBar: { list: 'oops' } }), []);
  assert.deepEqual(collectTabPaths(null), []);
});

test('normalizeAppPath：去 query / hash / 斜杠', () => {
  assert.equal(normalizeAppPath('/pages/a/b?id=1'), 'pages/a/b');
  assert.equal(normalizeAppPath('pages/a/b/'), 'pages/a/b');
  assert.equal(normalizeAppPath('/pages/a/b#top'), 'pages/a/b');
  assert.equal(normalizeAppPath(''), '');
});

test('resolveOpenMethod：tab 页走 switchTab，其余走 navigateTo / redirectTo', () => {
  begin();
  assert.equal(resolveOpenMethod('/pages/index/index'), 'switchTab');
  assert.equal(resolveOpenMethod('pages/mine/mine?id=1'), 'switchTab');
  assert.equal(resolveOpenMethod('/pages/product/list'), 'navigateTo');
  assert.equal(resolveOpenMethod('/pages/product/list', { replace: true }), 'redirectTo');
  assert.equal(resolveOpenMethod(''), 'none');
});

test('未注册 tab 页时不会误判（全按普通页跳）', () => {
  begin(false);
  assert.equal(getTabPaths().length, 0);
  assert.equal(isTabPath('/pages/index/index'), false);
  assert.equal(openPath('/pages/index/index'), 'navigateTo');
  assert.deepEqual(calls, [{ method: 'navigateTo', url: '/pages/index/index' }]);
});

test('openPath：tab 页丢弃 query（switchTab 不允许带参）', () => {
  begin();
  assert.equal(openPath('pages/index/index', { from: 'share' }), 'switchTab');
  assert.deepEqual(calls, [{ method: 'switchTab', url: '/pages/index/index' }]);
});

test('openPath：普通页拼 query，空值跳过', () => {
  begin();
  assert.equal(openPath('/pages/product/list', { page: 2, from: '', none: null, ok: 'y' }), 'navigateTo');
  assert.deepEqual(calls, [{ method: 'navigateTo', url: '/pages/product/list?page=2&ok=y' }]);
});

test('toQueryString：无有效项时为空', () => {
  assert.equal(toQueryString(), '');
  assert.equal(toQueryString({ a: undefined, b: '', c: null }), '');
  assert.equal(toQueryString({ keyword: '中文 词' }), '?keyword=%E4%B8%AD%E6%96%87%20%E8%AF%8D');
});

test('goBack：栈内可回则回退', () => {
  begin();
  stackDepth = 2;
  goBack();
  assert.deepEqual(calls, [{ method: 'navigateBack', url: '' }]);
});

test('goBack：分享直达（栈内一页）回落兜底页，且兜底是 tab 页则走 switchTab', () => {
  begin();
  stackDepth = 1;
  goBack('/pages/index/index');
  assert.deepEqual(calls, [{ method: 'switchTab', url: '/pages/index/index' }]);
});

test('无 uni 环境（单测 / 非 uni 容器）不抛错、不发跳转', () => {
  begin();
  removeUni();
  assert.equal(openPath('/pages/product/list'), 'navigateTo');
  assert.equal(calls.length, 0);
  goBack();
  assert.equal(calls.length, 0);
  installAppRouteInterceptor();
  openLink('https://example.com');
  assert.equal(calls.length, 0);
});

test('setupAppRouter：显式 tabPaths 优先于 pagesJson，并归一化', () => {
  begin(false);
  setupAppRouter({ pagesJson, tabPaths: ['/pages/mine/mine/'] });
  assert.deepEqual(getTabPaths(), ['pages/mine/mine']);
  assert.equal(isTabPath('pages/mine/mine'), true);
  assert.equal(isTabPath('pages/index/index'), false);
});

test('拦截器：navigateTo 打到 tab 页 → 自动改走 switchTab', () => {
  begin();
  installAppRouteInterceptor();
  (globalThis as unknown as { uni: { navigateTo: (o: unknown) => void } }).uni.navigateTo({
    url: '/pages/index/index?from=x',
  });
  assert.deepEqual(calls, [{ method: 'switchTab', url: '/pages/index/index' }]);
});

test('拦截器：switchTab 打到非 tab 页 → 自动改走 navigateTo', () => {
  begin();
  installAppRouteInterceptor();
  (globalThis as unknown as { uni: { switchTab: (o: unknown) => void } }).uni.switchTab({
    url: '/pages/product/list?id=1',
  });
  assert.deepEqual(calls, [{ method: 'navigateTo', url: '/pages/product/list?id=1' }]);
});

test('拦截器：redirectTo 打到 tab 页改走 switchTab；reLaunch 不纠正（平台允许）', () => {
  begin();
  installAppRouteInterceptor();
  const u = (globalThis as unknown as {
    uni: { redirectTo: (o: unknown) => void; reLaunch: (o: unknown) => void };
  }).uni;

  u.redirectTo({ url: '/pages/mine/mine' });
  u.reLaunch({ url: '/pages/mine/mine' });
  assert.deepEqual(calls, [
    { method: 'switchTab', url: '/pages/mine/mine' },
    { method: 'reLaunch', url: '/pages/mine/mine' },
  ]);
});

test('拦截器：navigateBack 栈内一页 → 回落兜底首页；栈内多页 → 原样', () => {
  begin();
  installAppRouteInterceptor();
  const u = (globalThis as unknown as { uni: { navigateBack: (o?: unknown) => void } }).uni;

  stackDepth = 1;
  u.navigateBack({ delta: 1 });
  assert.deepEqual(calls, [{ method: 'switchTab', url: '/pages/index/index' }]);

  calls = [];
  stackDepth = 3;
  u.navigateBack({ delta: 1 });
  assert.deepEqual(calls, [{ method: 'navigateBack', url: '' }]);
});

test('拦截器：真实平台形态（getCurrentPages 挂全局）多页放行、一页回落（回归：返回被劫持到首页）', () => {
  begin();
  // 假 uni 摘掉 uni.getCurrentPages，只留全局形态 —— 复现真机：栈深曾恒为 0，所有返回都被回首页
  delete (globalThis as unknown as { uni: Record<string, unknown> }).uni.getCurrentPages;
  installAppRouteInterceptor();
  const u = (globalThis as unknown as { uni: { navigateBack: (o?: unknown) => void } }).uni;

  useGlobalGetCurrentPages(3);
  u.navigateBack({ delta: 1 });
  assert.deepEqual(calls, [{ method: 'navigateBack', url: '' }], '栈内多页必须原样返回');

  calls = [];
  useGlobalGetCurrentPages(1);
  u.navigateBack({ delta: 1 });
  assert.deepEqual(calls, [{ method: 'switchTab', url: '/pages/index/index' }], '分享直达（栈内一页）才回落兜底首页');

  removeGlobalGetCurrentPages();
});

test('拦截器：栈深未知（getCurrentPages 不可用）→ navigateBack 放行，不劫持回首页', () => {
  begin();
  delete (globalThis as unknown as { uni: Record<string, unknown> }).uni.getCurrentPages;
  removeGlobalGetCurrentPages();
  installAppRouteInterceptor();
  const u = (globalThis as unknown as { uni: { navigateBack: (o?: unknown) => void } }).uni;

  u.navigateBack({ delta: 1 });
  assert.deepEqual(calls, [{ method: 'navigateBack', url: '' }]);
});

test('拦截器：守卫在纠正之后判定，一次跳转只调用一次；返回 false 取消跳转', () => {
  begin();
  const seen: AppRouteGuardContext[] = [];
  installAppRouteInterceptor({
    guard: (context) => {
      seen.push(context);
      return false;
    },
  });

  (globalThis as unknown as { uni: { navigateTo: (o: unknown) => void } }).uni.navigateTo({
    url: '/pages/index/index?from=x',
  });

  assert.deepEqual(calls, [], '守卫拒绝后不应发生任何跳转');
  assert.equal(seen.length, 1, '纠正后守卫只应被调用一次');
  assert.equal(seen[0]!.method, 'switchTab');
  assert.equal(seen[0]!.path, 'pages/index/index');
  assert.deepEqual(seen[0]!.query, { from: 'x' });
});

test('拦截器：重复安装不叠加；守卫放行则正常跳转', () => {
  begin();
  installAppRouteInterceptor({ guard: () => true });
  installAppRouteInterceptor({ guard: () => true });
  (globalThis as unknown as { uni: { navigateTo: (o: unknown) => void } }).uni.navigateTo({
    url: '/pages/product/list',
  });
  assert.deepEqual(calls, [{ method: 'navigateTo', url: '/pages/product/list' }]);
});

test('openLink：外链走 webviewPath（未配置则视为不支持）', () => {
  begin();
  assert.equal(openLink('https://example.com/a?b=1'), false, '未配置 webviewPath 时不处理');
  assert.deepEqual(calls, []);

  setupAppRouter({ pagesJson, webviewPath: '/pages/webview/index' });
  assert.equal(openLink('https://example.com/a?b=1'), true);
  assert.deepEqual(calls, [
    { method: 'navigateTo', url: '/pages/webview/index?url=https%3A%2F%2Fexample.com%2Fa%3Fb%3D1' },
  ]);
});

test('openLink：应用内页面交给 openPath（含 tab 判定）', () => {
  begin();
  assert.equal(openLink('/pages/index/index'), true);
  assert.equal(openLink('pages/product/list'), true);
  assert.deepEqual(calls, [
    { method: 'switchTab', url: '/pages/index/index' },
    { method: 'navigateTo', url: '/pages/product/list' },
  ]);
});

test('openLink：站内相对路径 / 其他 scheme / 空值 → 不猜，交应用处理', () => {
  begin();
  assert.equal(openLink('/products/abc'), false);
  assert.equal(openLink('tel:10086'), false);
  assert.equal(openLink('#'), false);
  assert.equal(openLink(''), false);
  assert.equal(openLink(null), false);
  assert.deepEqual(calls, []);
});

test('兼容没有 tabBar 的应用：tab 集合为空，跳转全走 navigateTo', () => {
  begin(false);
  setupAppRouter({ pagesJson: { pages: [{ path: 'pages/index/index' }] } });

  assert.deepEqual(getTabPaths(), []);
  assert.equal(isTabPath('/pages/index/index'), false);
  assert.equal(openPath('/pages/index/index'), 'navigateTo');
  assert.deepEqual(calls, [{ method: 'navigateTo', url: '/pages/index/index' }]);
});

test('setupAppRouter 不传任何参数也能跑（无 pagesJson、无 tabBar）', () => {
  begin(false);
  assert.doesNotThrow(() => setupAppRouter());
  assert.deepEqual(getTabPaths(), []);
  assert.equal(resolveOpenMethod('/pages/index/index'), 'navigateTo');
  assert.equal(isTabPath(''), false);
});

test('注入应用 pages.json 后，不传参即可拿到 tab 页集合（包入口的默认路径）', () => {
  begin(false);
  injectAppPagesJson(pagesJson);

  setupAppRouter();
  assert.deepEqual([...getTabPaths()], ['pages/index/index', 'pages/mine/mine']);
  assert.equal(isTabPath('pages/index/index'), true);

  // 显式传参优先于注入值（pages.json 带注释无法被 import 时的逃生口）
  setupAppRouter({ pagesJson: { tabBar: { list: [{ pagePath: 'pages/other/other' }] } } });
  assert.deepEqual([...getTabPaths()], ['pages/other/other']);

  resetAppRouter();
});
