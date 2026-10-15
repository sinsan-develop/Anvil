import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomBytes, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { buildApp } from '../../../apps/server/app.ts';
import { AccessRepository } from '../../../apps/server/modules/access/repository.ts';

test('방법론 목록·버전도 인증 전에는 DB를 읽지 않고 다른 Host/프로젝트 scope를 거절한다', async () => {
  const pool = new Pool({ connectionTimeoutMillis: 1 });
  const app = buildApp({}, undefined, { repository: new AccessRepository(pool, { installationId: randomUUID(), key: randomBytes(32) }), origin: 'https://localhost:3830' });
  try {
    for (const url of ['/api/v1/methodologies', '/api/v1/methodologies/a6f20000-0000-4000-8000-000000000001/versions/1']) {
      assert.equal((await app.inject({ method: 'GET', url, headers: { host: 'localhost:3830' } })).statusCode, 401);
      assert.equal((await app.inject({ method: 'GET', url, headers: { host: 'unapproved.example' } })).statusCode, 403);
    }
    assert.equal((await app.inject({ method: 'GET', url: '/api/v1/methodologies?scope=PROJECT', headers: { host: 'localhost:3830' } })).statusCode, 400);
    const command = { schemaVersion: 1, commandId: randomUUID(), operation: 'copyMethodology', targetId: null, expectedVersion: 0, clientId: randomUUID(), payload: { sourceRef: { id: randomUUID(), version: 1, contentHash: 'a'.repeat(64) }, name: '복사', scope: 'USER_COMMON', reason: '공통본' } };
    const headers = { host: 'localhost:3830', origin: 'https://localhost:3830', 'x-anvil-csrf': 'x'.repeat(43) };
    assert.equal((await app.inject({ method: 'POST', url: '/api/v1/user-common/commands', headers, payload: command })).statusCode, 401);
    assert.equal((await app.inject({ method: 'POST', url: '/api/v1/user-common/commands', headers: { ...headers, origin: 'https://unapproved.example' }, payload: command })).statusCode, 403);
    assert.equal((await app.inject({ method: 'POST', url: '/api/v1/user-common/commands', headers, payload: { ...command, ownerUserId: randomUUID() } })).statusCode, 400);
  } finally { await app.close(); await pool.end(); }
});
