import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  REVALIDATE_ROUTE,
  buildRevalidateCanonical,
  cacheKeyMatchesPath,
  cacheKeyMatchesPrefix,
  expandLocalePaths,
  expandPurgeTargets,
  normalizeLogicalPath,
  parseRevalidatePayload,
  resolvePageCodePaths,
  sha256Hex,
  signRevalidateRequest,
  verifyRevalidateSignature,
  type PageCodePaths,
} from '../src/lib/revalidate.ts';

const SECRET = 'test-secret';
const BODY = JSON.stringify({ application_code: 'haofei', type: 'article', id: 802, category: 'qiyexinwen' });

function signedHeaders(overrides: Partial<{ timestamp: number; nonce: string; body: string; secret: string }> = {}) {
  const timestamp = overrides.timestamp ?? Math.floor(Date.now() / 1000);
  const nonce = overrides.nonce ?? 'a1b2c3d4e5f60718';
  const body = overrides.body ?? BODY;
  return {
    body,
    timestamp,
    nonce,
    signature: signRevalidateRequest({ secret: overrides.secret ?? SECRET, rawBody: body, timestamp, nonce }),
  };
}

test('parseRevalidatePayload: 归一化与必填校验', () => {
  const ok = parseRevalidatePayload({ application_code: 'haofei', type: 'article', id: '802', category: 'qiyexinwen' });
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.deepEqual(ok.payload, {
      application_code: 'haofei',
      scope: 'record',
      type: 'article',
      id: 802,
      category: 'qiyexinwen',
    });
  }

  const cases: Array<[unknown, string]> = [
    [null, 'invalid_body'],
    [{}, 'missing_application_code'],
    [{ application_code: 'x' }, 'missing_type'],
    [{ application_code: 'x', type: 'article', scope: 'nope' }, 'invalid_scope'],
    [{ application_code: 'x', type: 'article', id: 'abc' }, 'invalid_id'],
    [{ application_code: 'x', type: 'article' }, 'missing_target'],
    [{ application_code: 'x', type: 'article', id: 1, paths: 'x' }, 'invalid_paths'],
  ];
  for (const [input, reason] of cases) {
    const res = parseRevalidatePayload(input);
    assert.equal(res.ok, false, JSON.stringify(input));
    if (!res.ok) assert.equal(res.reason, reason, JSON.stringify(input));
  }

  // site scope 不需要 type；paths 需以 / 开头
  const site = parseRevalidatePayload({ application_code: 'x', scope: 'site' });
  assert.equal(site.ok, true);
  assert.equal(parseRevalidatePayload({ application_code: 'x', type: 'article', id: 1, paths: ['a'] }).ok, false);
});

test('normalizeLogicalPath: 去语言前缀/查询串/尾斜杠，拒绝站外路径', () => {
  assert.equal(normalizeLogicalPath('/articles/qiyexinwen/'), '/articles/qiyexinwen');
  assert.equal(normalizeLogicalPath('/en/articles/802?x=1'), '/articles/802');
  assert.equal(normalizeLogicalPath('/'), '/');
  assert.equal(normalizeLogicalPath('https://evil.com/x'), null);
  assert.equal(normalizeLogicalPath('//evil.com/x'), null);
});

test('expandPurgeTargets: record 用精确页 + 分页前缀（不枚举页数）', () => {
  const parsed = parseRevalidatePayload({
    application_code: 'haofei',
    type: 'article',
    id: 802,
    category: 'qiyexinwen',
  });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  const targets = expandPurgeTargets(parsed.payload);
  // 固定页精确匹配；栏目分页族与总览分页族按前缀清（覆盖任意页数，新增导致的位移也清得掉）
  assert.deepEqual(targets.paths, ['/', '/articles', '/articles/802', '/articles/qiyexinwen']);
  assert.deepEqual(targets.prefixes, ['/articles/page', '/articles/qiyexinwen']);
  assert.equal(targets.all, false);
});

test('expandPurgeTargets: record 无栏目时整段失效，paths 可精确补充', () => {
  const noCategory = parseRevalidatePayload({ application_code: 'haofei', type: 'product', id: 657 });
  assert.equal(noCategory.ok, true);
  if (noCategory.ok) {
    const targets = expandPurgeTargets(noCategory.payload);
    assert.deepEqual(targets.paths, ['/', '/products', '/products/657']);
    assert.deepEqual(targets.prefixes, ['/products']);
  }
  const withPaths = parseRevalidatePayload({ application_code: 'haofei', type: 'article', id: 1, paths: ['/', '/technology'] });
  assert.equal(withPaths.ok, true);
  if (withPaths.ok) {
    assert.deepEqual(expandPurgeTargets(withPaths.payload).paths, ['/', '/articles', '/articles/1', '/technology']);
  }
});

test('expandPurgeTargets: model 走区段前缀，site 全量', () => {
  const model = parseRevalidatePayload({ application_code: 'haofei', type: 'product', scope: 'model' });
  assert.equal(model.ok, true);
  if (model.ok) {
    assert.deepEqual(expandPurgeTargets(model.payload), { paths: [], prefixes: ['/products'], all: false });
  }
  const site = parseRevalidatePayload({ application_code: 'haofei', scope: 'site' });
  assert.equal(site.ok, true);
  if (site.ok) assert.deepEqual(expandPurgeTargets(site.payload), { paths: [], prefixes: [], all: true });
  // 无标准路由的模型（qa/honor…）在 model scope 下降级为全量
  const other = parseRevalidatePayload({ application_code: 'haofei', type: 'qa', scope: 'model' });
  assert.equal(other.ok, true);
  if (other.ok) assert.equal(expandPurgeTargets(other.payload).all, true);
});

test('expandPurgeTargets: 后端真实 type 键（gallery-item / case-study / team-member）也能落到区段', () => {
  const cases = parseRevalidatePayload({ application_code: 'x', type: 'case-study', id: 12, category: 'gongcheng' });
  assert.equal(cases.ok, true);
  if (cases.ok) {
    const targets = expandPurgeTargets(cases.payload);
    assert.deepEqual(targets.paths, ['/', '/cases', '/cases/12', '/cases/gongcheng']);
    assert.deepEqual(targets.prefixes, ['/cases/gongcheng', '/cases/page']);
  }
  for (const [type, section] of [['gallery-item', '/gallery'], ['team-member', '/team']] as const) {
    const parsed = parseRevalidatePayload({ application_code: 'x', type, id: 7 });
    assert.equal(parsed.ok, true);
    if (parsed.ok) assert.ok(expandPurgeTargets(parsed.payload).prefixes.includes(section), type);
  }
});

test('resolvePageCodePaths: 精确 + 动态段模式', () => {
  const map: PageCodePaths = {
    exact: { home: '/', technology: '/technology' },
    patterns: [{ codePrefix: 'about-', pathPrefix: '/about/' }],
  };
  assert.deepEqual(
    resolvePageCodePaths(['home', 'technology', 'about-guanyuhaofei', 'unknown'], map),
    ['/', '/technology', '/about/guanyuhaofei'],
  );
});

test('expandLocalePaths: 默认语言无前缀，其余加前缀', () => {
  assert.deepEqual(expandLocalePaths(['/', '/articles'], ['en']), ['/', '/en', '/articles', '/en/articles']);
  assert.deepEqual(expandLocalePaths(['/articles'], []), ['/articles']);
});

test('签名：正确签名通过，篡改/过期/重放场景可判', () => {
  const config = { secret: SECRET, rawBody: BODY };
  const { timestamp, nonce, signature } = signedHeaders();
  const okRes = verifyRevalidateSignature({ ...config, timestamp: String(timestamp), nonce, signature });
  assert.equal(okRes.ok, true);

  assert.equal(
    verifyRevalidateSignature({ ...config, timestamp: String(timestamp), nonce, signature: signature.replace(/.$/, '0') }).ok,
    false,
  );
  // 时间戳超出容差
  const stale = signedHeaders({ timestamp: Math.floor(Date.now() / 1000) - 601 });
  const staleRes = verifyRevalidateSignature({ ...config, timestamp: String(stale.timestamp), nonce: stale.nonce, signature: stale.signature });
  assert.equal(staleRes.ok, false);
  if (!staleRes.ok) assert.equal(staleRes.reason, 'stale_timestamp');
  // 改了 body 但沿用旧签名
  const tampered = verifyRevalidateSignature({
    secret: SECRET,
    rawBody: BODY.replace('802', '803'),
    timestamp: String(timestamp),
    nonce,
    signature,
  });
  assert.equal(tampered.ok, false);
  if (!tampered.ok) assert.equal(tampered.reason, 'invalid_signature');
  // 头缺失 / 格式非法
  assert.equal(verifyRevalidateSignature({ ...config }).ok, false);
  assert.equal(
    verifyRevalidateSignature({ ...config, timestamp: String(timestamp), nonce, signature: 'ZZ' }).ok,
    false,
  );
});

test('canonical 与摘要：与后端语言无关的确定性输入', () => {
  assert.equal(sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(
    buildRevalidateCanonical({ timestamp: 1, nonce: 'n', bodyHash: 'h' }),
    `POST\n${REVALIDATE_ROUTE}\n1\nn\nh`,
  );
});

test('缓存键匹配：路径前缀截断到 16 字符，宁可多清不可漏清', () => {
  const key = (path: string) => `nitro/routes:_:${path.replace(/\W/g, '').slice(0, 16)}.deadbeef.json`;
  assert.equal(cacheKeyMatchesPath(key('/articles/qiyexinwen'), '/articles/qiyexinwen'), true);
  assert.equal(cacheKeyMatchesPath(key('/en/articles/qiyexinwen'), '/en/articles/qiyexinwen'), true);
  assert.equal(cacheKeyMatchesPath(key('/articles/802'), '/articles/802'), true);
  assert.equal(cacheKeyMatchesPath(key('/articles/802'), '/articles/803'), false);
  assert.equal(cacheKeyMatchesPrefix(key('/articles/qiyexinwen/page/12'), '/articles'), true);
  // 语言前缀键与带前缀的前缀匹配（handler 两侧都会展开前缀，不会混用）
  assert.equal(cacheKeyMatchesPrefix(key('/en/articles/802'), '/en/articles'), true);
  assert.equal(cacheKeyMatchesPrefix(key('/products/657'), '/articles'), false);
});
