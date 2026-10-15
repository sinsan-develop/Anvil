import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomBytes, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { buildApp } from '../../../apps/server/app.ts';
import { AccessRepository } from '../../../apps/server/modules/access/repository.ts';

test('공식 양식 목록·버전도 익명 세션을 허용하지 않고 다른 Origin/잘못된 필터를 거절한다', async () => {
  // 익명 요청은 DB 접속 전에 거절해야 한다. 실제 DB 연결을 만들지 않는다.
  const pool = new Pool({ connectionTimeoutMillis: 1 });
  const app = buildApp({}, undefined, { repository: new AccessRepository(pool, { installationId: randomUUID(), key: randomBytes(32) }), origin: 'https://localhost:3830' });
  try {
    for (const url of ['/api/v1/forms', '/api/v1/forms/a6f30000-0000-4000-8000-000000000001/versions/1']) {
      const response = await app.inject({ method: 'GET', url, headers: { host: 'localhost:3830' } });
      assert.equal(response.statusCode, 401);
      assert.equal(response.json().code, 'AUTH_REQUIRED');
      assert.equal((await app.inject({ method: 'GET', url, headers: { host: 'evil.example' } })).statusCode, 403);
    }
    assert.equal((await app.inject({ method: 'GET', url: '/api/v1/forms?scope=PROJECT', headers: { host: 'localhost:3830' } })).statusCode, 400);
  } finally { await app.close(); await pool.end(); }
});
