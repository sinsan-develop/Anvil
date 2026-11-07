import assert from 'node:assert/strict';
import test from 'node:test';
import { randomBytes, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { AccessRepository } from '../../../apps/server/modules/access/repository.ts';
import { buildApp } from '../../../apps/server/app.ts';
const id = '11111111-1111-4111-8111-111111111111';
test('임무 초안 GET/명령은 현재 로그인 없이는 DB 연결 전401이며 no-store다', async () => {
  const pool = new Pool({ host: '127.0.0.1', port: 1, connectionTimeoutMillis: 50 });
  const repository = new AccessRepository(pool, { installationId: randomUUID(), key: randomBytes(32) }), app = buildApp({}, undefined, { repository, origin: 'https://localhost:3830' });
  try {
    for (const suffix of ['/assignment-drafts', `/assignment-drafts/${id}/versions/1`, `/assignment-drafts/${id}/versions/1/decision`, `/assignments/${id}/versions/1`]) { const response = await app.inject({ method: 'GET', url: `/api/v1/projects/${id}${suffix}`, headers: { host: 'localhost:3830' } }); assert.equal(response.statusCode, 401, response.body); assert.equal(response.headers['cache-control'], 'no-store'); }
    const command = { schemaVersion: 1, projectId: id, commandId: randomUUID(), clientId: id, controlGeneration: 1, operation: 'prepareAssignment', targetId: null, expectedVersion: 0, baselineRefs: [], approvalRef: null, payload: {} };
    const headers = { host: 'localhost:3830', origin: 'https://localhost:3830', 'x-anvil-csrf': 'C'.repeat(43) };
    assert.equal((await app.inject({ method: 'POST', url: `/api/v1/projects/${id}/commands`, headers, payload: command })).statusCode, 401);
    for (const operation of ['reviewAssignmentContent', 'confirmAssignment']) assert.equal((await app.inject({ method: 'POST', url: `/api/v1/projects/${id}/commands`, headers, payload: { ...command, operation, targetId: id, expectedVersion: 1 } })).statusCode, 401);
    assert.equal((await app.inject({ method: 'POST', url: `/api/v1/projects/${id}/commands`, headers: { ...headers, origin: 'https://other.invalid' }, payload: command })).statusCode, 403);
    assert.equal((await app.inject({ method: 'GET', url: `/api/v1/projects/${id}/assignment-drafts`, headers: { host: 'other.invalid' } })).statusCode, 403);
    assert.equal(pool.totalCount, 0);
  } finally { await app.close(); await pool.end(); }
});
