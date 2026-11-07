import assert from 'node:assert/strict';
import test from 'node:test';
import { createHmac } from 'node:crypto';
import { canonicalJson, contentHash } from '../../../contracts/canonical.ts';
import { ProjectListCodec } from '../../../apps/server/modules/projects/service.ts';
import { readAssignmentDraftInput } from '../../../apps/server/modules/assignments/assignment-input.ts';
import { ProjectAssignmentDrafts } from '../../../apps/server/modules/assignments/project-assignment-drafts.ts';
const pid = 'a6f20900-0000-4000-8000-000000000201', user = 'a6f20900-0000-4000-8000-000000000101', cid = 'a6f20900-0000-4000-8000-000000000102', actor = { actorId: user, clientId: cid, serverOwner: false, credentialGeneration: 1, reauthUntil: null };
const ref = { id: pid, version: 1, contentHash: 'a'.repeat(64) }, codec = new ProjectListCodec(text => createHmac('sha256', 'synthetic-test-key-not-a-runtime-secret').update(text).digest('hex'));
function row(id: string, at: string) {
  const d = { taskRef: { planRef: ref, applicationRef: ref, taskCode: 'FN01', nodeId: '요구검토' }, purpose: '통제', goal: '초안 조회', baselineRefs: [ref], inputs: [], outputs: [], acceptanceCriteria: [], verificationRequirements: [], included: [], excluded: [], requiredCapabilities: [], allowedScopes: [], environmentRef: null, budgetRef: null, recordingPolicyRef: null, parentAssignmentRef: null, ownerRole: '단계책임자', integrationResponsibility: '' };
  const analysis = readAssignmentDraftInput({ baseRef: null, definition: d, reason: '준비' }), snapshot = { definition: d, reason: '준비', previousRef: null, basis: { planRef: ref, applicationRef: ref, designRef: ref, taskCode: 'FN01', nodeId: '요구검토', taskCardHash: 'b'.repeat(64) }, readinessIssues: analysis.readinessIssues, status: 'DRAFT', ready: false, executionAuthorized: false, dispatchPerformed: false }, reference = { id, version: 1, contentHash: contentHash(canonicalJson(snapshot)) };
  return { project_id: pid, draft_id: id, version: 1, head_version: 1, content_hash: reference.contentHash, version_json: snapshot, operation: 'prepareAssignment', state: 'APPLIED', expected_version: 0, command_actor: user, created_by: user, command_client: cid, client_id: cid, updated_at: new Date(at), cursor_at: at, result_ref: { status: 'APPLIED', data: { status: 'ASSIGNMENT_DRAFT_STORED', ref: reference, snapshot } } };
}
function setup() {
  const rows = [row('a6f20900-0000-4000-8000-000000000302', '2026-10-17T23:20:00.123456Z'), row('a6f20900-0000-4000-8000-000000000301', '2026-10-17T23:19:00.123456Z')], queries: { sql: string; params: any[] }[] = [];
  let member = true;
  const db: any = { query: async (sql: string, params: any[]) => { if (sql.startsWith('SELECT p.id,p.archived_at,m.participation')) return { rows: member ? [{ id: params[0], participation: 'VIEWER' }] : [] }; queries.push({ sql, params }); if (!sql.startsWith('SELECT v.*,d.head_version')) throw Error('UNEXPECTED_QA_SQL'); assert.equal(params[0], pid); return { rows: params[1] === null ? rows : [rows[1]] }; } };
  const store = new ProjectAssignmentDrafts({ read: async () => { throw Error('LIST_MUST_NOT_CLAIM_CURRENT_BASIS'); }, decision: async () => { throw Error('LIST_MUST_NOT_CLAIM_CURRENT_BASIS'); } } as any);
  return { store, db, rows, queries, revoke: () => { member = false; } };
}
test('임무 목록은 검증된 고정head 요약과 actor/project/limit 서명 cursor만 반환한다', async () => {
  const q = setup(), first = await q.store.list(q.db, actor, pid, { limit: '1' }, codec); assert.equal(first.items.length, 1); assert.equal(first.items[0]!.ref.id, q.rows[0]!.draft_id); assert.equal(first.items[0]!.ready, false); assert.equal(first.hasMore, true); assert.equal(Object.hasOwn(first.items[0]!, 'snapshot'), false);
  const next = await q.store.list(q.db, actor, pid, { limit: '1', cursor: first.nextCursor! }, codec); assert.equal(next.items[0]!.ref.id, q.rows[1]!.draft_id); assert.equal(next.hasMore, false); assert.equal(next.nextCursor, null); assert.deepEqual(q.queries[1]!.params, [pid, '2026-10-17T23:20:00.123456Z', q.rows[0]!.draft_id, 2]);
  assert.match(q.queries[0]!.sql, /v.version=d.head_version/); assert.match(q.queries[0]!.sql, /ORDER BY d.updated_at DESC,d.id DESC LIMIT \$4/);
  for (const [other, project, query] of [[{ ...actor, actorId: cid }, pid, { limit: '1', cursor: first.nextCursor! }], [actor, cid, { limit: '1', cursor: first.nextCursor! }], [actor, pid, { limit: '2', cursor: first.nextCursor! }]] as const) await assert.rejects(q.store.list(q.db, other, project, query, codec), /CURSOR_INVALID/);
  assert.equal(q.queries.length, 2);
});
test('목록 현재 회원 회수·잘못된 query·변조 snapshot은 목록 성공으로 반영하지 않는다', async () => {
  const q = setup(); q.revoke(); await assert.rejects(q.store.list(q.db, actor, pid, {}, codec), /NOT_FOUND/); assert.equal(q.queries.length, 0);
  const p = setup(); for (const query of [{ limit: '201' }, { limit: '0' }, { cursor: 'bad.signature' }, { includeBody: 'true' }]) await assert.rejects(p.store.list(p.db, actor, pid, query, codec)); assert.equal(p.queries.length, 0);
  p.rows[0]!.version_json.definition.goal = '변조'; await assert.rejects(p.store.list(p.db, actor, pid, {}, codec), /ASSIGNMENT_INTEGRITY_FAILED/);
});
