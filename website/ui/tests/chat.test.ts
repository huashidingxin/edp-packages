import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildVisitorId, parseSseEvent, splitSseFrames, renderMarkdown, formatTime, clampWindowToViewport } from '../src/lib/chat.ts';

test('splitSseFrames: 按空行分帧，兼容 \\r\\n，过滤空帧', () => {
  const raw = [
    'data: {"type":"start","session_id":7}',
    '',
    'data: {"type":"chunk","content":"你好"}',
    '',
    '',
    'data: {"type":"end","session_id":7}',
    '',
  ].join('\r\n');
  const frames = splitSseFrames(raw);
  assert.equal(frames.length, 3);
  assert.match(frames[0]!, /session_id/);
  assert.match(frames[1]!, /你好/);
});

test('splitSseFrames: reader 切分时残留半帧作为末帧返回（调用方 pop 回 buffer）', () => {
  const raw = 'data: {"type":"chunk","content":"ab"\n\ndata: {"type":"chu';
  const frames = splitSseFrames(raw);
  assert.equal(frames.length, 2);
  assert.match(frames[0]!, /"ab"/);
  // 末帧是残留半帧，本轮解析为 null，交由调用方拼接下一块
  assert.equal(parseSseEvent(frames[1]!), null);
});

test('parseSseEvent: 正常事件 / 非 data 行 / [DONE] / 坏 JSON 均容错', () => {
  const start = parseSseEvent('data: {"type":"start","session_id":3}');
  assert.deepEqual(start, { type: 'start', session_id: 3 });

  const chunk = parseSseEvent('data: {"type":"chunk","content":"hi"}');
  assert.deepEqual(chunk, { type: 'chunk', content: 'hi' });

  const err = parseSseEvent('data: {"type":"error","code":"QUOTA_EXCEEDED","message":"额度不足"}');
  assert.equal(err?.type, 'error');
  assert.equal(err?.code, 'QUOTA_EXCEEDED');

  assert.equal(parseSseEvent('event: message'), null);
  assert.equal(parseSseEvent('data: [DONE]'), null);
  assert.equal(parseSseEvent('data: {bad json'), null);
  assert.equal(parseSseEvent(''), null);
});

test('parseSseEvent: 未知 type 返回 null', () => {
  assert.equal(parseSseEvent('data: {"type":"ping"}'), null);
});

test('buildVisitorId: 持久化且跨调用稳定', () => {
  // node 环境无 window → 返回空串，测试保护路径
  assert.equal(buildVisitorId(), '');
});

test('formatTime: HH:MM 补零', () => {
  const d = new Date(2026, 0, 1, 9, 5, 0);
  assert.equal(formatTime(d.getTime()), '09:05');
  const d2 = new Date(2026, 0, 1, 23, 59, 0);
  assert.equal(formatTime(d2.getTime()), '23:59');
});

test('renderMarkdown: 标题/粗体/斜体/行内代码/链接/列表/引用', () => {
  const md = '# 标题\n\n这是 **粗体** 与 *斜体* 与 `code`\n\n- 项一\n- 项二\n\n> 引用语';
  const html = renderMarkdown(md);
  assert.match(html, /<h1>标题<\/h1>/);
  assert.match(html, /<strong>粗体<\/strong>/);
  assert.match(html, /<em>斜体<\/em>/);
  assert.match(html, /<code>code<\/code>/);
  assert.match(html, /<li>项一<\/li>/);
  assert.match(html, /<blockquote>引用语<\/blockquote>/);
});

test('renderMarkdown: 代码块 / 链接 target=_blank / 图片', () => {
  const md = '```js\nconst a = 1\n```\n\n[官网](https://x.com) 与 ![图](/img.png)';
  const html = renderMarkdown(md);
  assert.match(html, /<pre><code>const a = 1<\/code><\/pre>/);
  assert.match(html, /<a href="https:\/\/x.com" target="_blank"/);
  assert.match(html, /<img src="\/img.png"/);
});

test('renderMarkdown: XSS 转义与 URL 白名单', () => {
  const html = renderMarkdown('<script>alert(1)</script> [bad](javascript:alert(1))');
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.match(html, /href="#"/);
});

test('clampWindowToViewport: 越界钳制回视口内', () => {
  assert.deepEqual(clampWindowToViewport({ left: -50, top: -30, width: 380, height: 600 }, { width: 1440, height: 900 }), { left: 12, top: 12 });
  assert.deepEqual(clampWindowToViewport({ left: 1300, top: 700, width: 380, height: 600 }, { width: 1440, height: 900 }), { left: 1048, top: 288 });
  assert.deepEqual(clampWindowToViewport({ left: 100, top: 100, width: 380, height: 600 }, { width: 1440, height: 900 }), { left: 100, top: 100 });
});
