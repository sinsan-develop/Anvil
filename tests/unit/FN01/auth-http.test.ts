import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomBytes, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { buildApp } from '../../../apps/server/app.ts';
import { AccessRepository } from '../../../apps/server/modules/access/repository.ts';

test('인증 없는 조회·다른 Origin·추가 입력은 DB 인증 처리 전에 거절한다', async () => {
  // 사전 거절 경로는 실제 DB가 없어도 동작해야 한다. DB를 쓰면 이 검사는 실패한다.
  const pool = new Pool({ host: 'invalid.invalid', connectionTimeoutMillis: 20, max: 1 });
  const repository = new AccessRepository(pool, { installationId: randomUUID(), key: randomBytes(32) });
  const app = Reflect.apply(buildApp, undefined, [{}, undefined, { repository, origin: 'https://localhost:3830' }]) as ReturnType<typeof buildApp>;
  try {
    const noLogin = await app.inject({ method: 'GET', url: '/api/v1/session', headers: { host: 'localhost:3830' } });
    assert.equal(noLogin.statusCode, 401);
    assert.equal(noLogin.json().code, 'AUTH_REQUIRED');
    assert.equal(noLogin.headers['cache-control'], 'no-store');
    const otherOrigin = await app.inject({ method: 'POST', url: '/api/v1/auth/login', headers: { host: 'localhost:3830', origin: 'https://other.invalid' }, payload: { loginName: 'someone', password: 'synthetic passphrase', clientLabel: 'QA' } });
    assert.equal(otherOrigin.statusCode, 403);
    const extraField = await app.inject({ method: 'POST', url: '/api/v1/auth/login', headers: { host: 'localhost:3830', origin: 'https://localhost:3830' }, payload: { loginName: 'someone', password: 'synthetic passphrase', clientLabel: 'QA', serverOwner: true } });
    assert.equal(extraField.statusCode, 400);
    for (const [url, payload] of [
      ['/api/v1/auth/reauthenticate', { password: 'synthetic passphrase' }],
      ['/api/v1/auth/password', { currentPassword: 'synthetic passphrase', newPassword: 'synthetic new passphrase', commandId: randomUUID() }],
    ]) {
      const response = await app.inject({ method: 'POST', url: String(url), headers: { host: 'localhost:3830', origin: 'https://localhost:3830', 'x-anvil-csrf': 'A'.repeat(43) }, payload });
      assert.equal(response.statusCode, 401);
    }
  } finally { await app.close(); await pool.end(); }
});
