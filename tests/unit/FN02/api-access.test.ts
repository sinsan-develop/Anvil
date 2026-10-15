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
  } finally { await app.close(); await pool.end(); }
});
