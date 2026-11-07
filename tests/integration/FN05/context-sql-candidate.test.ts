// 미실행 후보: 별도 사전등록·승인된 새 격리 DB의 READ ONLY 검증. 자원/계정/SQL을 생성·적용하지 않는다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import { Pool, type PoolClient } from 'pg';
import { contentHash } from '../../../contracts/canonical.ts';
import { contextSlotCodes } from '../../../apps/server/modules/context/context-input.ts';
import { planContextText } from '../../../apps/server/modules/context/context-text-plan.ts';
import { buildContextManifest } from '../../../apps/server/modules/context/context-manifest.ts';
test('격리 DB의 정확0014에서 실제 생성 manifest·SQL 정수 null/문자열/누락/경계를 READ ONLY 검사', { timeout: 30000 }, async () => {
 const deadline = Date.parse(process.env.ANVIL_CONTEXT_SQL_QA_EXPIRES_AT ?? ''), host = process.env.ANVIL_CONTEXT_SQL_QA_HOST ?? '';
 if (process.platform !== 'linux' || process.getuid?.() !== 1000 || process.env.ANVIL_CONTEXT_SQL_QA_APPROVAL !== 'READ_ONLY_CONTEXT_VALIDATION_01'
  || !Number.isFinite(deadline) || deadline <= Date.now() || deadline > Date.now() + 600000 || !/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(host)
  || process.env.ANVIL_DB_CONFIG || process.env.ANVIL_MIGRATOR_CONFIG || await realpath(process.cwd()) !== '/home/daon/deploy/anvil-v3') throw Error('CONTEXT_SQL_EXACT_ISOLATED_QA_APPROVAL_REQUIRED');
 const password = process.env.ANVIL_CONTEXT_SQL_QA_APP_PASSWORD ?? ''; if (!/^[0-9a-f]{64}$/.test(password)) throw Error('CONTEXT_SQL_QA_CREDENTIAL_REQUIRED');
 const pool = new Pool({ host, port: 5432, database: 'anvil_v3_fn05_context_validation_qa_01', user: 'anvil_v3_app', password, connectionTimeoutMillis: 3000, query_timeout: 5000, application_name: 'anvil-v3-fn05-context-validation-01' });
 let client: PoolClient | null = null;
 try {
  client = await pool.connect(); await client.query('BEGIN READ ONLY');
  assert.equal((await client.query('SELECT current_database() name')).rows[0].name, 'anvil_v3_fn05_context_validation_qa_01');
  const expected = contentHash(await readFile(new URL('../../../db/migrations/0014_context_preparation.sql', import.meta.url)));
  assert.equal((await client.query("SELECT checksum FROM anvil.schema_migrations WHERE id='0014_context_preparation'")).rows[0]?.checksum, expected);
  for (const [value, maximum, accepted] of [[1, 200, true], [200, 200, true], [2097152, 2097152, true], [null, 200, false], ['1', 200, false], ['200', 200, false], [true, 200, false], [0, 200, false], [-1, 200, false], [1.5, 200, false], [201, 200, false]] as const) {
   assert(Date.now() < deadline); assert.equal((await client.query('SELECT anvil.context_positive_integer($1::jsonb,$2) valid', [JSON.stringify(value), maximum])).rows[0].valid, accepted);
  }
  assert.equal((await client.query('SELECT anvil.context_positive_integer(NULL,200) valid')).rows[0].valid, false);
  const id = randomUUID(), projectId = randomUUID(), ref = { id, version: 1, contentHash: 'a'.repeat(64) };
  assert.equal((await client.query('SELECT count(*)::int n FROM anvil.projects WHERE id=$1', [projectId])).rows[0].n, 0);
  const input: any = { assignmentRef: ref, budgetRef: null, slots: contextSlotCodes.map(code => ({ code, sources: [], reason: '명시 미선택' })), limits: { maxPartBytes: 4096, maxParts: 200 }, reason: 'SQL 검증용 준비 후보' };
  const planned = planContextText(contextSlotCodes.map(code => ({ itemId: code, category: code, required: true, sourceRef: null, reason: '명시 미선택', state: 'MISSING', bodyRef: null, body: null })), input.limits);
  const prepared: any = { preparationInput: input, assignmentRef: ref, baselineRefs: [ref], constitutionRef: null, budgetRef: null, bindings: contextSlotCodes.map(itemId => ({ itemId, selection: null, bodyRef: null, sourceState: 'NOT_SELECTED' })), ...planned, unverified: [] };
  const { manifest } = buildContextManifest(id, projectId, prepared);
  assert.equal((await client.query('SELECT anvil.context_preparation_manifest_valid($1,$2::jsonb) valid', [projectId, JSON.stringify(manifest)])).rows[0].valid, true);
  for (const mutate of [
   (m: any) => { m.preparationInput.limits.maxPartBytes = null; }, (m: any) => { m.preparationInput.limits.maxParts = null; },
   (m: any) => { m.preparationInput.limits.maxPartBytes = '4096'; }, (m: any) => { m.preparationInput.limits.maxParts = '200'; },
   (m: any) => { delete m.preparationInput.limits.maxParts; }, (m: any) => { m.preparationInput.limits.maxPartBytes = 0; },
   (m: any) => { m.preparationInput.limits.maxPartBytes = 2097153; }, (m: any) => { m.preparationInput.limits.maxParts = 201; }, (m: any) => { m.items[0].extra = '거절'; }
  ]) { assert(Date.now() < deadline); const changed = structuredClone(manifest); mutate(changed); changed.deliveryPlan.limits = changed.preparationInput.limits; assert.equal((await client.query('SELECT anvil.context_preparation_manifest_valid($1,$2::jsonb) valid', [projectId, JSON.stringify(changed)])).rows[0].valid, false); }
 } catch (error) {
  if (error instanceof assert.AssertionError) throw error;
  const code = error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' && /^[A-Z0-9_]{1,20}$/.test(error.code) ? error.code : 'UNCLASSIFIED';
  throw Error('CONTEXT_SQL_QA_FAILED:' + code);
 } finally { if (client) { try { await client.query('ROLLBACK'); } finally { client.release(); } } await pool.end(); }
});
