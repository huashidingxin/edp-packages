import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SiteClient, SiteClientError } from '../src/api/client.ts';
import { designPreviewTokenForHost } from '../src/api/preview.ts';
import { tokensToCssVariables } from '../src/api/theme.ts';
import type { ApiEnvelope, BootstrapResponse, PageDataResponse, CollectionResponse } from '../src/contracts/index.ts';

function makeFetcher<TEnv>(env: TEnv, calls: Array<{ url: string; query?: Record<string, unknown>; method?: string; body?: unknown }> = []) {
  const fetcher = async <T = unknown>(url: string, options?: Record<string, unknown>): Promise<T> => {
    calls.push({ url, query: options?.query as Record<string, unknown> | undefined, method: options?.method as string | undefined, body: options?.body });
    return env as unknown as T;
  };
  return { fetcher, calls };
}

test('designPreviewTokenForHost: matches subdomain of preview domain', () => {
  assert.equal(designPreviewTokenForHost('abc123.edp.hsdxchina.com', 'edp.hsdxchina.com'), 'abc123');
  assert.equal(designPreviewTokenForHost('edp.hsdxchina.com', 'edp.hsdxchina.com'), null);
  // Note: lfscmj.edp.hsdxchina.com is itself an Application domain; this function does NOT
  // have a blacklist, so callers (the Nuxt bootstrap composable) must disable preview-mode
  // behavior by leaving `previewDomain` blank or by checking the resolved token against the
  // configured Application domain whitelist before sending it to v2 API.
  assert.equal(designPreviewTokenForHost('lfscmj.edp.hsdxchina.com', 'edp.hsdxchina.com'), 'lfscmj');
});

test('designPreviewTokenForHost: returns null when not preview domain', () => {
  assert.equal(designPreviewTokenForHost('lfscmj.edp.example.cn', 'edp.hsdxchina.com'), null);
  assert.equal(designPreviewTokenForHost('', 'edp.hsdxchina.com'), null);
  assert.equal(designPreviewTokenForHost('lfscmj.edp.hsdxchina.com', ''), null);
});

test('SiteClient.bootstrap: host always on query, locale optional', async () => {
  const calls: Array<{ url: string; query?: Record<string, unknown> }> = [];
  const env: ApiEnvelope<BootstrapResponse> = {
    success: true,
    data: {
      site: { application_id: 2, name: '廊坊', default_locale: 'zh-CN', enabled_locales: ['zh-CN'], tenant_id: 2, timezone: 'Asia/Shanghai', branding: { logo: null, logo_alt: 'L', favicon: null, show_name: true, copyright: null }, locales: [], ai_chat: { enabled: false } },
      theme: { tokens: {}, version: '1', stylesheet: {} },
      menus: { header: [], footer: [] },
      strings: {},
    },
  };
  const fetcher = async <T = unknown>(url: string, options?: Record<string, unknown>): Promise<T> => {
    calls.push({ url, query: options?.query as Record<string, unknown> | undefined });
    return env as unknown as T;
  };
  const client = new SiteClient({ apiBase: 'http://127.0.0.1:8787', host: 'lfscmj.edp.hsdxchina.com', fetch: fetcher });
  const r = await client.bootstrap();
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.url, 'http://127.0.0.1:8787/api/v1/site/bootstrap');
  assert.equal(calls[0]?.query?.host, 'lfscmj.edp.hsdxchina.com');
  assert.equal(r.site.application_id, 2);
});

test('SiteClient.pageData: code path + id on query when record', async () => {
  const calls: Array<{ url: string; query?: Record<string, unknown> }> = [];
  const env: ApiEnvelope<PageDataResponse> = {
    success: true,
    data: {
      page: { id: 1, code: 'product', slug: null, title: 'P', type: 'detail', locale: 'zh-CN' },
      locale: 'zh-CN',
      banner: null,
      content: null,
      sections: {},
    },
  };
  const fetcher = async <T = unknown>(url: string, options?: Record<string, unknown>): Promise<T> => {
    calls.push({ url, query: options?.query as Record<string, unknown> | undefined });
    return env as unknown as T;
  };
  const client = new SiteClient({ apiBase: 'http://localhost:8787', host: 'lfscmj.edp', fetch: fetcher });
  await client.pageData('product', { id: 42, locale: 'zh-CN', device: 'web' });
  assert.equal(calls[0]?.url, 'http://localhost:8787/api/v1/site/page-data/product');
  assert.equal(calls[0]?.query?.host, 'lfscmj.edp');
  assert.equal(calls[0]?.query?.id, '42');
  assert.equal(calls[0]?.query?.device, 'web');
  assert.equal(calls[0]?.query?.locale, 'zh-CN');
});

test('SiteClient error wraps envelope.error', async () => {
  const env: ApiEnvelope = { success: false, error: { code: 'NOT_FOUND', message: 'missing' } };
  const client = new SiteClient({ apiBase: 'http://localhost:8787', host: 'lfscmj.edp', fetch: makeFetcher(env).fetcher });
  await assert.rejects(() => client.bootstrap(), (err: unknown) => {
    assert.ok(err instanceof SiteClientError);
    assert.equal((err as SiteClientError).statusCode, 404);
    return true;
  });
});

test('tokensToCssVariables: shadcn semantic + namespace', () => {
  const css = tokensToCssVariables({
    color: { background: '#fff', primary: '#1e3a8a' },
    radius: { card: '10px' },
    background: '#ffffff',
    foreground: '#0f172a',
    spacing: { section: '96px' },
    shadow: { card: '0 1px 3px rgba(0,0,0,.1)' },
    text: '#000',
  } as Record<string, unknown>);
  // Allow optional whitespace after the colon (CSS min/diff tolerances).
  assert.match(css, /--color-background:\s*#fff;/);
  assert.match(css, /--color-background:\s*#ffffff;/); // later entry overrides earlier
  assert.match(css, /--color-foreground:\s*#0f172a;/);
  assert.match(css, /--color-primary:\s*#1e3a8a;/);
  assert.match(css, /--color-text:\s*#000;/);
  assert.match(css, /--radius-card:\s*10px;/);
  assert.match(css, /--spacing-section:\s*96px;/);
  assert.match(css, /--shadow-card:\s*0 1px 3px/);
});

test('tokensToCssVariables: null returns empty string', () => {
  assert.equal(tokensToCssVariables(null), '');
  assert.equal(tokensToCssVariables(undefined), '');
});
