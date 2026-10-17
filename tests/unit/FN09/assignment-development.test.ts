import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const load = () => import('../../../scripts/assignment-draft-development-guard.ts').catch((e: NodeJS.ErrnoException) => { if (e.code === 'ERR_MODULE_NOT_FOUND') return {}; throw e; });
const input = () => ({ platform: 'linux', uid: 1000, cwd: '/home/daon/deploy/anvil-v3', head: 'a'.repeat(40), origin: 'git@github-sinsan-develop:sinsan-develop/Anvil.git', dirty: '', configPath: '/home/daon/.local/share/anvil-v3-development/migrator.json', approval: 'AV3-FN09-FORMAL-SCHEMA-ONLY', commit: 'a'.repeat(40), sqlHash: 'b'.repeat(64), expiresAt: '2026-10-18T00:30:00Z' });
test('FN09 정식 적용 binding은 새 결정·exact clean Git/대상/유한기한만 허용한다', async () => {
  const m: any = await load(); assert.equal(typeof m.readAssignmentDevelopmentBinding, 'function'); const now = Date.parse('2026-10-18T00:00:00Z');
  assert.equal(m.readAssignmentDevelopmentBinding(input(), now).expiresAtMs, Date.parse('2026-10-18T00:30:00Z'));
  for (const patch of [{ platform: 'win32' }, { uid: 0 }, { dirty: ' M anything' }, { head: 'c'.repeat(40) }, { approval: 'AV3-FN09-ASSIGNMENT-DRAFT' }, { configPath: '/tmp/config' }, { expiresAt: '2026-10-17T23:59:59Z' }, { expiresAt: '2026-10-18T02:00:01Z' }]) assert.throws(() => m.readAssignmentDevelopmentBinding({ ...input(), ...patch }, now));
});
test('FN09 정식 manifest는 기존46 checksum 보존과 신규47 하나만 인정한다', async () => {
  const m: any = await load(); assert.equal(typeof m.assignmentDevelopmentManifest, 'function'); const manifest = await m.assignmentDevelopmentManifest(); assert.equal(manifest.expected.size, 46); assert.equal(manifest.expected.has('0012_assignment_drafts'), false);
  const before = [...manifest.expected].map(([id, checksum]: any) => ({ id, checksum })), after = [...before, { id: '0012_assignment_drafts', checksum: manifest.checksum }];
  m.assertAssignmentDevelopmentManifest(before, manifest, 'BEFORE'); m.assertAssignmentDevelopmentManifest(after, manifest, 'AFTER');
  for (const rows of [before.slice(1), [...before, before[0]], before.map((r, n) => n ? r : { ...r, checksum: '0'.repeat(64) }), after]) assert.throws(() => m.assertAssignmentDevelopmentManifest(rows, manifest, 'BEFORE'));
});
test('FN09 정식 baseline은 기존 행/구조·권한 지문과 신규2표0행만 허용한다', async () => {
  const m: any = await load(); assert.equal(typeof m.assertAssignmentDevelopmentBaseline, 'function');
  const state = (name: string, n = '0') => ({ schema: 'anvil', name, n, fingerprint: 'a'.repeat(32), structureHash: 'b'.repeat(64) });
  const before = m.assignmentDevelopmentBaselineNames.map((key: string) => { const [schema, name] = key.split('.'); return { ...state(name!, name === 'schema_migrations' ? '46' : name === 'users' ? '2' : '0'), schema }; }), after = [...structuredClone(before), state('assignment_drafts'), state('assignment_draft_versions')];
  const migrationIndex = before.findIndex((r: any) => r.name === 'schema_migrations'), userIndex = before.findIndex((r: any) => r.name === 'users'); after[migrationIndex].n = '47'; m.assertAssignmentDevelopmentBaseline(before, after);
  for (const mutate of [(v: any[]) => { v[userIndex].n = '3'; }, (v: any[]) => { v[userIndex].fingerprint = 'c'.repeat(32); }, (v: any[]) => { v[userIndex].structureHash = 'c'.repeat(64); }, (v: any[]) => { v[migrationIndex].fingerprint = 'c'.repeat(32); }, (v: any[]) => { v[81].n = '1'; }, (v: any[]) => { v.push(state('unexpected')); }]) { const values = structuredClone(after); mutate(values); assert.throws(() => m.assertAssignmentDevelopmentBaseline(before, values)); }
});
test('FN09 정식 적용은 관측한 임의 표 개수가 아니라 승인된 기존81표 집합을 DDL 전에 요구한다', async () => {
  const m: any = await load(); const s = (name: string, n: string) => ({ schema: 'anvil', name, n, fingerprint: 'a'.repeat(32), structureHash: 'b'.repeat(64) });
  assert.throws(() => m.assertAssignmentDevelopmentBaseline([s('schema_migrations', '46'), s('users', '2')], [s('schema_migrations', '47'), s('users', '2'), s('assignment_drafts', '0'), s('assignment_draft_versions', '0')]));
  assert.equal(typeof m.assertAssignmentDevelopmentBefore, 'function');
  const before = m.assignmentDevelopmentBaselineNames.map((key: string) => { const [schema, name] = key.split('.'); return { ...s(name!, name === 'schema_migrations' ? '46' : '0'), schema }; }); assert.equal(before.length, 81); m.assertAssignmentDevelopmentBefore(before);
  const replaced = structuredClone(before); replaced[0].name = 'unapproved_same_count';
  for (const rows of [before.slice(1), [...before, s('unexpected', '0')], replaced, [...before.slice(1), before[1]]]) assert.throws(() => m.assertAssignmentDevelopmentBefore(rows), /FN09_DEVELOPMENT_BASELINE_INVALID/);
});
test('FN09 정식 CLI 계획·승인없는 거절은 config/DB 연결보다 먼저다', () => {
  const file = fileURLToPath(new URL('../../../scripts/apply-assignment-draft-development.ts', import.meta.url));
  const plan = JSON.parse(execFileSync(process.execPath, [file, '--plan'], { encoding: 'utf8' })); assert.equal(plan.oldMigrations, 46); assert.equal(plan.appliedMigrations, 47); assert.equal(plan.databaseAccess, 0); assert.equal(plan.secretReads, 0); assert.equal(plan.seeded, 0); assert.equal(plan.serviceChanges, 0);
  let result: any; try { execFileSync(process.execPath, [file, '--apply-schema-only'], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, ANVIL_FN09_APPLY_APPROVAL: '', ANVIL_DB_CONFIG: 'DO_NOT_READ' } }); assert.fail('unapproved apply accepted'); } catch (e: any) { assert.equal(e.status, 1); result = JSON.parse(e.stdout); }
  assert.equal(result.failure, 'FN09_DEVELOPMENT_BINDING_INVALID'); assert.equal(result.databaseConnected, false); assert.equal(result.commitOutcome, 'NOT_SENT'); assert.equal(result.schemaCommitted, false);
});
