import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalJson, contentHash } from '../../../contracts/canonical.ts';
import { readAssignmentDraftInput } from '../../../apps/server/modules/assignments/assignment-input.ts';
const module: any = await import('../../../apps/server/modules/assignments/project-assignment-confirmations.ts').catch((e: NodeJS.ErrnoException) => { if (e.code === 'ERR_MODULE_NOT_FOUND') return {}; throw e; });
const pid = '11111111-1111-4111-8111-111111111111', id = '22222222-2222-4222-8222-222222222222';
const actor: any = { actorId: pid, clientId: pid, serverOwner: false, credentialGeneration: 1, reauthUntil: null };
const ref = { id, version: 1, contentHash: 'a'.repeat(64) }, policyRef = { ...ref, id: pid };
const criteria = ['PURPOSE_SCOPE', 'BASELINE_TASK', 'INPUT_OUTPUT', 'COMPLETION_VERIFICATION', 'BOUNDARIES', 'RECORD_RECOVERY'];
function setup() {
  assert.equal(typeof module.ProjectAssignmentConfirmations, 'function');
  const definition: any = { taskRef: { planRef: ref, taskCode: 'FN01', applicationRef: ref, nodeId: 'N1' }, purpose: '주도권 보존', goal: '기능 구현', baselineRefs: [ref], inputs: ['요구'], outputs: ['결과'], acceptanceCriteria: ['정상 흐름'], verificationRequirements: ['핵심 실패'], included: ['개발'], excluded: ['운영'], allowedScopes: [{ sourceRootRef: ref, mappingRef: null, observationRef: ref, baselineRef: ref, targets: [{ relativePath: 'src/a.ts', kind: 'FILE', access: 'WRITE', recursive: false }] }], environmentRef: null, requiredCapabilities: ['코드 수정'], budgetRef: null, ownerRole: '단계책임자', parentAssignmentRef: null, recordingPolicyRef: null, integrationResponsibility: '검수·통합' };
  const draft: any = { projectId: pid, ref, snapshot: { definition, readinessIssues: readAssignmentDraftInput({ baseRef: null, definition, reason: '준비' }).readinessIssues }, headVersion: 1 };
  const reviews: any[] = [], versions: any[] = [], commands = new Map<string, any>(); let sequence = 0;
  const db: any = { query: async (sql: string, p: any[] = []) => {
    if (sql.startsWith('SELECT p.id,p.archived_at,m.participation')) return { rows: p[0] === pid ? [{ id: pid, participation: 'OWNER' }] : [] };
    if (sql.startsWith('SELECT transaction_timestamp')) return { rows: [{ at: new Date('2026-10-18T01:40:00Z') }] };
    if (sql.startsWith('INSERT INTO anvil.commands')) { commands.set(p[0], { result_ref: JSON.parse(p[14]), operation: p[4], state: 'APPLIED', expected_version: p[10], command_actor: p[2], command_client: p[3] }); return { rows: [] }; }
    if (sql.startsWith('INSERT INTO anvil.audit_events')) { sequence++; return { rows: [] }; }
    if (sql.startsWith('INSERT INTO anvil.authorization_receipts') || sql.startsWith('SELECT set_config')) return { rows: [] };
    if (sql.startsWith('INSERT INTO anvil.assignment_content_reviews')) { reviews.push({ project_id: p[0], review_id: p[1], draft_id: p[2], draft_version: p[3], draft_hash: p[4], content_hash: p[5], review_json: JSON.parse(p[6]), created_by: p[7], client_id: p[8], command_id: p[9], server_sequence: sequence }); return { rows: [] }; }
    if (sql.startsWith('INSERT INTO anvil.assignment_versions')) { versions.push({ project_id: p[0], assignment_id: p[1], version: p[2], content_hash: p[3], version_json: JSON.parse(p[4]), created_by: p[5], client_id: p[6], command_id: p[7], confirmation_id: p[8] }); return { rows: [] }; }
    if (sql.includes('FROM anvil.assignment_content_reviews r')) return { rows: reviews.filter(r => r.project_id === p[0] && (sql.includes('r.review_id=$2') ? r.review_id === p[1] : r.draft_id === p[1] && r.draft_version === p[2])).sort((a,b) => b.server_sequence-a.server_sequence).map(r => ({ ...r, draft_author: pid, ...commands.get(r.command_id) })) };
    if (sql.includes('FROM anvil.assignment_versions v')) return { rows: versions.filter(r => r.project_id === p[0] && r.assignment_id === p[1] && r.version === p[2]).map(r => ({ ...r, ...commands.get(r.command_id) })) };
    throw Error('UNEXPECTED_QA_SQL: ' + sql.slice(0, 100));
  } };
  const store = new module.ProjectAssignmentConfirmations({ current: async (_db: any, _a: any, project: string, requested: any) => { if (project !== pid) throw Error('NOT_FOUND'); if (canonicalJson(requested) !== canonicalJson(ref) || draft.headVersion !== 1) throw Error('VERSION_CONFLICT'); return draft; }, read: async () => draft });
  const command = (operation: string, payload: any): any => ({ schemaVersion: 1, projectId: pid, commandId: crypto.randomUUID(), clientId: pid, controlGeneration: 1, operation, targetId: id, expectedVersion: 1, baselineRefs: [], approvalRef: null, payload });
  const reviewInput = (outcome = 'ACCEPTED') => ({ draftRef: ref, criteriaVersion: 1, items: criteria.map(criterionId => ({ criterionId, outcome, reason: '사람이 내용 검토', evidenceRefs: [] })), outcome, reason: '내용 검토이고 실행 미승인' });
  return { db, store, draft, reviews, versions, commands, command, reviewInput };
}
test('사람 검토와 별도 확정은 불변 원문·영수증으로 보관하고 실행은 미허가다', async () => {
  const q = setup(), review = await q.store.review(q.db, actor, q.command('reviewAssignmentContent', q.reviewInput()), policyRef);
  assert.equal(review.data.status, 'ASSIGNMENT_CONTENT_REVIEWED'); assert.equal(q.reviews.length, 1);
  const result = await q.store.confirm(q.db, actor, q.command('confirmAssignment', { draftRef: ref, reviewRefs: [review.data.ref], reason: '내용만 확정', acknowledged: true }), policyRef);
  assert.equal(result.data.status, 'ASSIGNMENT_CONTENT_CONFIRMED'); assert.notEqual(result.data.ref.contentHash, ref.contentHash);
  assert.equal(result.data.snapshot.contentConfirmed, true); assert.equal(result.data.snapshot.ready, false); assert.equal(result.data.snapshot.executionAuthorized, false); assert.equal(result.data.snapshot.dispatchPerformed, false);
  assert(result.data.snapshot.readinessIssues.some((v: any) => v.code === 'BUDGET_UNVERIFIED'));
  const read = await q.store.read(q.db, actor, pid, id, 1); assert.deepEqual(read.ref, result.data.ref); assert.deepEqual(read.snapshot.draftRef, ref);
  assert.equal(contentHash(canonicalJson(read.snapshot)), read.ref.contentHash);
  await assert.rejects(q.store.confirm(q.db, actor, q.command('confirmAssignment', { draftRef: ref, reviewRefs: [review.data.ref], reason: '중복', acknowledged: true }), policyRef), /VERSION_CONFLICT/);
});
test('옛 적합이 있어도 최신 감사 판단이 부적합이면 확정하지 않는다', async () => {
  const q = setup(), accepted = await q.store.review(q.db, actor, q.command('reviewAssignmentContent', q.reviewInput()), policyRef);
  await q.store.review(q.db, actor, q.command('reviewAssignmentContent', q.reviewInput('REWORK')), policyRef);
  await assert.rejects(q.store.confirm(q.db, actor, q.command('confirmAssignment', { draftRef: ref, reviewRefs: [accepted.data.ref], reason: '옛 판단 시도', acknowledged: true }), policyRef), /ASSIGNMENT_REVIEW_REQUIRED/); assert.equal(q.versions.length, 0);
});
test('내용 누락·빈 소스 범위·검토 ref 변조·옛 head는 확정 전에 거절한다', async () => {
  for (const kind of ['missing', 'scope', 'reviewHash', 'head']) {
    const q = setup(), result = await q.store.review(q.db, actor, q.command('reviewAssignmentContent', q.reviewInput()), policyRef);
    if (kind === 'missing') q.draft.snapshot.definition.outputs = [];
    if (kind === 'scope') q.draft.snapshot.definition.allowedScopes = [];
    if (kind === 'head') q.draft.headVersion = 2;
    const reviewRef = kind === 'reviewHash' ? { ...result.data.ref, contentHash: 'f'.repeat(64) } : result.data.ref;
    await assert.rejects(q.store.confirm(q.db, actor, q.command('confirmAssignment', { draftRef: ref, reviewRefs: [reviewRef], reason: '확인', acknowledged: true }), policyRef)); assert.equal(q.versions.length, 0);
  }
});
test('저장된 확정 snapshot/영수증의 변조와 교차 프로젝트는 원문으로 읽지 않는다', async () => {
  const q = setup(), result = await q.store.review(q.db, actor, q.command('reviewAssignmentContent', q.reviewInput()), policyRef);
  await q.store.confirm(q.db, actor, q.command('confirmAssignment', { draftRef: ref, reviewRefs: [result.data.ref], reason: '확정', acknowledged: true }), policyRef);
  await assert.rejects(q.store.read(q.db, actor, id, id, 1), /NOT_FOUND/);
  q.versions[0].version_json.ready = true; await assert.rejects(q.store.read(q.db, actor, pid, id, 1), /ASSIGNMENT_CONFIRMATION_INTEGRITY_FAILED/);
});
