import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { AccessRepository } from '../../../apps/server/modules/access/repository.ts';
import { buildApp } from '../../../apps/server/app.ts';
const id = '11111111-1111-4111-8111-111111111111';
test('기준선 초안·검토·채택/현재/목록은 인증 전401/no-store·외부 origin 거절이며 DB 연결을 만들지 않는다', async () => {
 const pool = new Pool({ host: '127.0.0.1', port: 1, connectionTimeoutMillis: 50 }), repository = new AccessRepository(pool, { installationId: randomUUID(), key: randomBytes(32) });
 const app = buildApp({}, undefined, { repository, origin: 'https://localhost:3830' });
 try {
  for (const suffix of ['/baseline-drafts', `/baseline-drafts/${id}/versions/1`, `/baseline-drafts/${id}/versions/1/decision`, '/baselines', `/baselines/${id}/versions/1`, '/baseline-current']) {
   const response = await app.inject({ method: 'GET', url: `/api/v1/projects/${id}${suffix}`, headers: { host: 'localhost:3830' } });
   assert.equal(response.statusCode, 401, response.body); assert.equal(response.headers['cache-control'], 'no-store');
  }
  for (const operation of ['saveBaselineDraft', 'reviewBaselineContent', 'confirmBaseline']) {
   const payload = { schemaVersion: 1, projectId: id, commandId: randomUUID(), clientId: id, controlGeneration: 1, operation, targetId: null, expectedVersion: 0, baselineRefs: [], approvalRef: null, payload: {} };
   const headers = { host: 'localhost:3830', origin: 'https://localhost:3830', 'x-anvil-csrf': 'C'.repeat(43) };
   assert.equal((await app.inject({ method: 'POST', url: `/api/v1/projects/${id}/commands`, headers, payload })).statusCode, 401);
   assert.equal((await app.inject({ method: 'POST', url: `/api/v1/projects/${id}/commands`, headers: { ...headers, origin: 'https://other.invalid' }, payload })).statusCode, 403);
  }
  assert.equal(pool.totalCount, 0);
 } finally { await app.close(); await pool.end(); }
});
