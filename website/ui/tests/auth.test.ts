import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MockAuthProvider, createMemoryAuthStorage, AuthError } from '../src/api/auth.ts';

function makeProvider() {
  const storage = createMemoryAuthStorage();
  return { provider: new MockAuthProvider(storage), storage };
}

test('MockAuthProvider: me returns null when not logged in', async () => {
  const { provider } = makeProvider();
  assert.equal(await provider.me(), null);
});

test('MockAuthProvider: login persists session', async () => {
  const { provider } = makeProvider();
  const user = await provider.login({ account: '13800000000', password: 'x' });
  assert.equal(user.phone, '13800000000');
  const me = await provider.me();
  assert.equal(me?.phone, '13800000000');
});

test('MockAuthProvider: login validates input', async () => {
  const { provider } = makeProvider();
  await assert.rejects(
    () => provider.login({ account: '' }),
    (err: unknown) => err instanceof AuthError,
  );
  await assert.rejects(() => provider.login({ account: 'a@b.c' }));
});

test('MockAuthProvider: register + logout', async () => {
  const { provider } = makeProvider();
  await provider.register({ account: 'a@b.com', name: '张三' });
  let me = await provider.me();
  assert.equal(me?.name, '张三');
  await provider.logout();
  me = await provider.me();
  assert.equal(me, null);
});
