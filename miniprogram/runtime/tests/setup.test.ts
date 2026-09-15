import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupAppRuntime } from '../src/setup.ts';
import { resetAppBootstrap } from '../src/bootstrap.ts';
import { getHttpConfig, resetAppHttp, setTransport } from '../src/request.ts';
import { getTabPaths, resetAppRouter } from '../src/router.ts';
import { appTokens, setupAppTheme } from '../src/theme/runtime.ts';

interface Call {
  url: string;
}

const pagesJson = {
  pages: [{ path: 'pages/index/index' }],
  tabBar: { list: [{ pagePath: 'pages/index/index' }, { pagePath: 'pages/mine/mine' }] },
};

let calls: Call[] = [];
let upColors: Record<string, string> = {};
let interceptorTypes: string[] = [];
/** 安装拦截器那一刻已注册的 tab 页数量：用于锁"路由配置先于拦截器"的顺序契约。 */
let tabPathsWhenInterceptorInstalled = -1;

/** 装上假 uni（含 uview 的 `$u.setConfig`），并清空各单例。 */
function begin(): void {
  resetAppHttp();
  resetAppRouter();
  resetAppBootstrap();
  calls = [];
  upColors = {};
  interceptorTypes = [];
  tabPathsWhenInterceptorInstalled = -1;

  (globalThis as unknown as { uni: unknown }).uni = {
    $u: {
      setConfig: (config: { color?: Record<string, string> }) => {
        upColors = config.color ?? {};
      },
    },
    addInterceptor: (type: string) => {
      interceptorTypes.push(type);
      if (tabPathsWhenInterceptorInstalled === -1) {
        tabPathsWhenInterceptorInstalled = getTabPaths().length;
      }
    },
    navigateTo: (options: Call) => calls.push(options),
    getCurrentPages: () => [{}],
  };

  setupAppTheme({}) // 主题单例跨用例残留，重置回默认令牌

  setTransport(async (options) => {
    calls.push(options as Call);
    return { statusCode: 200, data: { success: true, data: { site: { name: '示例' } } } };
  });
}

function removeUni(): void {
  delete (globalThis as unknown as { uni?: unknown }).uni;
}

test('setupAppRuntime：一次调用完成主题 / 请求 / 路由 / 拦截器 / 全局入口装配', async () => {
  begin();

  setupAppRuntime({
    theme: { primary: '#c8401f' },
    http: { baseURL: 'https://api.test/api/v1', applicationCode: 'demo' },
    pagesJson,
  });

  // 主题：内部令牌 + uview 色板都跟着变
  assert.equal(appTokens.value.primary, '#c8401f');
  assert.equal(upColors['up-primary'], '#c8401f');

  // 请求：可被读到（页面直接 http.get 时用的是同一份）
  assert.equal(getHttpConfig().applicationCode, 'demo');

  // 路由：tab 页集合来自 pagesJson
  assert.deepEqual([...getTabPaths()], ['pages/index/index', 'pages/mine/mine']);

  // 拦截器：5 个路由 API 都装上
  assert.deepEqual(interceptorTypes.sort(), [
    'navigateBack',
    'navigateTo',
    'reLaunch',
    'redirectTo',
    'switchTab',
  ]);
  assert.equal(
    tabPathsWhenInterceptorInstalled,
    2,
    '拦截器必须在路由配置之后安装（否则 tab 集合为空、跳转纠正失效）',
  );

  // 全局入口：默认挂载
  const uni = (globalThis as unknown as { uni: Record<string, unknown> }).uni;
  assert.ok(uni.$edp, 'uni.$edp 应已挂载');
  assert.ok(uni.Resource, 'uni.Resource 应已挂载');

  // 兜底首页与 tab 判定生效（navigateTo 打 tab 页应被纠正为 switchTab）
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.ok(
    calls.some((call) => call.url.includes('/site/bootstrap')),
    '默认应预取 bootstrap',
  );

  removeUni();
});

test('setupAppRuntime：globals / prefetch 可关，theme / http 可省', async () => {
  begin();

  setupAppRuntime({
    http: { baseURL: 'https://api.test/api/v1', applicationCode: 'demo' },
    pagesJson,
    globals: false,
    prefetch: false,
  });

  const uni = (globalThis as unknown as { uni: Record<string, unknown> }).uni;
  assert.equal(uni.$edp, undefined, 'globals: false 不应挂载');
  assert.equal(appTokens.value.primary, '#2563eb', '未传 theme 时保持默认令牌');

  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(calls, [], 'prefetch: false 不应发起请求');

  removeUni();
});

test('setupAppRuntime：无 uni 环境不抛错', () => {
  resetAppHttp();
  resetAppRouter();
  removeUni();
  assert.doesNotThrow(() => setupAppRuntime({ theme: { primary: '#000000' } }));
});
