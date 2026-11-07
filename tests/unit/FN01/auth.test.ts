import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hashPassword, verifyPassword, sessionIsActive } from '../../../apps/server/modules/access/service.ts';

test('비밀번호는 개별 salt의 Argon2id로 검증하고 공백/대소문자를 조용히 바꾸지 않는다', async () => {
  const password = '  My secure passphrase 123  ';
  const one = await hashPassword(password);
  const two = await hashPassword(password);
  assert.notEqual(one, two);
  assert.match(one, /^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
  assert(!one.includes(password));
  assert.equal(await verifyPassword(password, one), true);
  assert.equal(await verifyPassword(password.trim(), one), false);
  assert.equal(await verifyPassword(password.toLowerCase(), one), false);
});

test('짧거나 초과·잘못된 Unicode 비밀번호와 무제한/변조된 저장 hash를 거절한다', async () => {
  for (const value of ['short', 'x'.repeat(129), '\ud800'.repeat(20)]) {
    await assert.rejects(hashPassword(value), /PASSWORD_POLICY/);
  }
  assert.equal(await verifyPassword('correct length passphrase', 'plain-text-password'), false);
  assert.equal(await verifyPassword('correct length passphrase', '$argon2id$v=19$m=999999999,t=2,p=1$AAAA$AAAA'), false);
});

test('로그인 session의 idle/절대기한·사용자 자격세대·회수 상태를 독립적으로 집행한다', () => {
  const now = new Date('2026-10-16T01:00:00Z');
  const state = { idleExpiresAt: new Date('2026-10-16T01:10:00Z'), absoluteExpiresAt: new Date('2026-10-16T02:00:00Z'), revokedAt: null, userRevokedAt: null, clientRevokedAt: null, credentialGeneration: 1, currentCredentialGeneration: 1 };
  assert.equal(sessionIsActive(state, now), true);
  assert.equal(sessionIsActive({ ...state, idleExpiresAt: now }, now), false);
  assert.equal(sessionIsActive({ ...state, absoluteExpiresAt: now }, now), false);
  assert.equal(sessionIsActive({ ...state, currentCredentialGeneration: 2 }, now), false);
  for (const key of ['revokedAt', 'userRevokedAt', 'clientRevokedAt'] as const) assert.equal(sessionIsActive({ ...state, [key]: now }, now), false);
});
