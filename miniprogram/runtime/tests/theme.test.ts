import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultTokens, tokensToCssVars, tokensToUpColorMap, type ThemeTokens } from '../src/theme/tokens.ts';

test('每个令牌都映射到 CSS 变量（数量一致，防漏）', () => {
  const vars = tokensToCssVars(defaultTokens);
  assert.ok(Object.keys(vars).length > 0);
  // 值必须来自令牌本体（不串位）
  assert.equal(vars['--color-primary'], defaultTokens.primary);
  assert.equal(vars['--color-muted-foreground'], defaultTokens.mutedForeground);
  assert.equal(vars['--radius-card'], defaultTokens.radiusCard);
});

test('结构令牌使用 rpx 单位', () => {
  const vars = tokensToCssVars(defaultTokens);
  for (const name of ['--radius-card', '--radius-md', '--mp-page-px', '--mp-tabbar-h']) {
    assert.match(vars[name]!, /rpx$/, `${name} 必须是 rpx`);
  }
});

test('覆盖品牌色后 CSS 变量跟着变', () => {
  const tokens: ThemeTokens = { ...defaultTokens, primary: '#c8401f' };
  assert.equal(tokensToCssVars(tokens)['--color-primary'], '#c8401f');
});

test('uview 色板跟随品牌色，但不覆盖语义反馈色', () => {
  const map = tokensToUpColorMap({ ...defaultTokens, primary: '#c8401f', foreground: '#16202a' });
  assert.equal(map['up-primary'], '#c8401f');
  assert.equal(map['up-main-color'], '#16202a');
  for (const key of Object.keys(map)) {
    assert.ok(!/^up-(success|warning|error|info)/.test(key), `不应映射语义反馈色：${key}`);
  }
});
