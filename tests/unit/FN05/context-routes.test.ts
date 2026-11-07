import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { Pool } from 'pg';
import { AccessRepository } from '../../../apps/server/modules/access/repository.ts';
import { buildApp } from '../../../apps/server/app.ts';
const id = '10000000-0000-4000-8000-000000000001';
test('맥락 준비 명령·목록·exact GET은 인증 전 DB 연결 없이401/no-store이며 외부 origin을 거절한다', async () => {
 const pool = new Pool({ host: '127.0.0.1', port: 1, connectionTimeoutMillis: 50 });
 const repository = new AccessRepository(pool, { installationId: randomUUID(), key: randomBytes(32) }), app = buildApp({}, undefined, { repository, origin: 'https://localhost:3830' });
 try {
  for (const path of [`/context/${id}/versions/1`, `/context?assignmentId=${id}&assignmentVersion=1&assignmentHash=${'a'.repeat(64)}`]) {
   const response = await app.inject({ method: 'GET', url: `/api/v1/projects/${id}${path}`, headers: { host: 'localhost:3830' } }); assert.equal(response.statusCode, 401, response.body); assert.equal(response.headers['cache-control'], 'no-store');
  }
  const headers = { host: 'localhost:3830', origin: 'https://localhost:3830', 'x-anvil-csrf': 'C'.repeat(43) };
  const payload = { schemaVersion: 1, projectId: id, commandId: randomUUID(), clientId: id, controlGeneration: 1, operation: 'buildTaskContext', targetId: null, expectedVersion: 0, baselineRefs: [], approvalRef: null, payload: {} };
  assert.equal((await app.inject({ method: 'POST', url: `/api/v1/projects/${id}/commands`, headers, payload })).statusCode, 401);
  assert.equal((await app.inject({ method: 'POST', url: `/api/v1/projects/${id}/commands`, headers: { ...headers, origin: 'https://other.invalid' }, payload })).statusCode, 403);
  assert.equal((await app.inject({ method: 'GET', url: `/api/v1/projects/${id}/context/${id}/versions/1`, headers: { host: 'other.invalid' } })).statusCode, 403);
  assert.equal(pool.totalCount, 0);
 } finally { await app.close(); await pool.end(); }
});
