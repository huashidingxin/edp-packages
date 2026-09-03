import { test } from 'node:test';
import assert from 'node:assert/strict';
import { qrSvg } from '../src/lib/qr.ts';

test('qrSvg: short url produces square matrix path', () => {
  const out = qrSvg('https://example.com/a');
  assert.ok(out);
  assert.ok(out!.size >= 21 + 4); // v1 最小 21 模块 + 双侧 quiet zone
  assert.match(out!.d, /^M\d+ \d+h1v1h-1z/);
});

test('qrSvg: longer url auto-selects larger version', () => {
  const short = qrSvg('https://e.co')!;
  const long = qrSvg(`https://example.com/${'x'.repeat(200)}`)!;
  assert.ok(long.size > short.size);
});

test('qrSvg: quiet zone offsets modules', () => {
  const out = qrSvg('https://example.com', 3)!;
  assert.ok(out.d.startsWith('M3 3'));
});

test('qrSvg: empty or blank input yields null', () => {
  assert.equal(qrSvg(''), null);
  assert.equal(qrSvg('   '), null);
});

test('qrSvg: oversized payload falls back to null', () => {
  assert.equal(qrSvg('x'.repeat(3000)), null);
});
