import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
const load = () => import('../../../scripts/assignment-draft-sql-qa.ts').catch((e: NodeJS.ErrnoException) => { if (e.code === 'ERR_MODULE_NOT_FOUND') return {}; throw e; });
test('FN09 격리 SQL 준비는 정식 DB를 받지 않고 정확47 SQL과 app 읽기/비허가 거절을 만든다', async () => {
  const m: any = await load(); assert.equal(typeof m.buildAssignmentDraftSqlQa, 'function');
  const b = await m.buildAssignmentDraftSqlQa(); assert.equal(b.migrations, 47); assert.equal(b.previousMigrations, 46); assert.match(b.sqlHash, /^[a-f0-9]{64}$/);
  assert.match(b.schema, /^BEGIN;/); assert.match(b.schema, /current_database\(\)='anvil_v3_fn09_draft_qa'/); assert.equal((b.schema.match(/INSERT INTO anvil.schema_migrations\(id,checksum\)/g) ?? []).length, 47);
  assert.equal((b.schema.match(/^COMMIT;$/gm) ?? []).length, 1); assert.equal(b.schema.includes('PASSWORD'), false);
  assert.match(b.readOnly, /^BEGIN READ ONLY;/); assert.match(b.readOnly, /assignment_draft_canonical/); assert.match(b.readOnly, /has_table_privilege/); assert.match(b.readOnly, /schema_migrations/); assert.match(b.deniedWrite, /WHEN insufficient_privilege/);
  // PG의 comma-list는 ANY이므로 필수 권한 각각을 검사하는 SQL을 발행해야 한다.
  for (const [table, grants] of [['assignment_drafts', ['SELECT', 'INSERT', 'UPDATE']], ['assignment_draft_versions', ['SELECT', 'INSERT']]] as const) for (const grant of grants) assert(b.readOnly.includes(`has_table_privilege(current_user,'anvil.${table}','${grant}')`), `${table}:${grant}`);
  assert.equal(/has_table_privilege\([^)]*'(?:SELECT|INSERT|UPDATE),/.test(b.readOnly), false);
  assert.equal(b.actualWorkflowVerified, false); assert.equal(b.formalDbChanges, 0);
});
test('FN09 격리 실행 binding은 한정 UTC창·정확 SHA/SQL·기존 WSL Git 경로만 인정한다', async () => {
  const m: any = await load(); assert.equal(typeof m.assertAssignmentDraftSqlQaBinding, 'function');
  const now = Date.parse('2026-10-17T23:20:00Z'), env = { ANVIL_FN09_DRAFT_QA_APPROVAL: 'AV3-FN09-ASSIGNMENT-DRAFT', ANVIL_FN09_DRAFT_QA_COMMIT: 'a'.repeat(40), ANVIL_FN09_DRAFT_QA_SQL_HASH: 'b'.repeat(64), ANVIL_FN09_DRAFT_QA_EXPIRES_AT: '2026-10-17T23:40:00Z' };
  const valid = () => m.assertAssignmentDraftSqlQaBinding('/home/daon/deploy/anvil-v3', '/home/daon/deploy/anvil-v3/scripts/qa-assignment-draft-sql.ts', env, now);
  assert.doesNotThrow(valid);
  for (const patch of [{ ANVIL_FN09_DRAFT_QA_APPROVAL: '' }, { ANVIL_FN09_DRAFT_QA_EXPIRES_AT: '2026-10-17T23:19:59Z' }, { ANVIL_FN09_DRAFT_QA_EXPIRES_AT: '2026-10-18T01:20:01Z' }, { DOCKER_HOST: 'tcp://not-approved' }, { ANVIL_FN09_DRAFT_QA_COMMIT: 'main' }]) assert.throws(() => m.assertAssignmentDraftSqlQaBinding('/home/daon/deploy/anvil-v3', '/home/daon/deploy/anvil-v3/scripts/qa-assignment-draft-sql.ts', { ...env, ...patch }, now));
  assert.throws(() => m.assertAssignmentDraftSqlQaBinding('/home/daon/deploy/anvil', '/home/daon/deploy/anvil/scripts/qa-assignment-draft-sql.ts', env, now));
});
test('FN09 SQL 결과는 단계별 단일 marker만 허용하고 중복/추가·다른 수치는 거절한다', async () => {
  const m: any = await load(); assert.equal(typeof m.readAssignmentDraftSqlQaResult, 'function');
  const raw = '{"kind":"FN09_DRAFT_SCHEMA_COMMITTED","migrations":47}'; assert.equal(m.readAssignmentDraftSqlQaResult(raw, 'SCHEMA').migrations, 47);
  for (const value of ['', raw + '\n' + raw, raw.replace('47', '46'), '{"kind":"FN09_DRAFT_SCHEMA_COMMITTED","migrations":46,"migrations":47}', raw.replace('47}', '47,"private":"NEVER_REFLECT"}')]) assert.throws(() => m.readAssignmentDraftSqlQaResult(value, 'SCHEMA'), /QA_FN09_RESULT_INVALID/);
  assert.throws(() => m.readAssignmentDraftSqlQaResult(raw, 'READ_ONLY'), /QA_FN09_RESULT_INVALID/);
});
test('FN09 SQL CLI 계획은 고정 tmpfs/미공개 자원만 보고하고 승인없는 run은 자원 생성 없이 거절한다', () => {
  const file = new URL('../../../scripts/qa-assignment-draft-sql.ts', import.meta.url);
  const plan = JSON.parse(execFileSync(process.execPath, [file.pathname.replace(/^\/(.:)/, '$1'), '--plan'], { encoding: 'utf8' }));
  assert.equal(plan.container, 'anvil-v3-fn09-draft-sql-qa-pg'); assert.equal(plan.network, 'anvil-v3-fn09-draft-sql-qa-net'); assert.equal(plan.database, 'anvil_v3_fn09_draft_qa'); assert.equal(plan.hostPublish, false); assert.equal(plan.port, null); assert.equal(plan.actualExecuted, false);
  let failure: any; try { execFileSync(process.execPath, [file.pathname.replace(/^\/(.:)/, '$1'), '--run'], { encoding: 'utf8', env: { ...process.env, ANVIL_FN09_DRAFT_QA_APPROVAL: '' }, stdio: ['pipe', 'pipe', 'pipe'] }); assert.fail('approval absent run accepted'); } catch (e) { failure = e; }
  assert.equal(failure.status, 1); const result = JSON.parse(failure.stdout); assert.equal(result.status, 'FAIL'); assert.equal(result.failure, 'QA_FN09_RUN_BINDING_INVALID'); assert.equal(result.resourceIdentity.containerId, null); assert.equal(result.resourceIdentity.networkId, null); assert.equal(result.formalDbChanges, 0);
});
