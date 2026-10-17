import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalJson, contentHash } from '../../../contracts/canonical.ts';
import { ProjectPolicyRepository } from '../../../apps/server/modules/access/project-command.ts';
const id = '11111111-1111-4111-8111-111111111111', cid = '22222222-2222-4222-8222-222222222222';
const actor = { actorId: id, clientId: cid, serverOwner: false, credentialGeneration: 1, reauthUntil: null };
const command: any = { schemaVersion: 1, projectId: id, commandId: id, clientId: cid, controlGeneration: 1, operation: 'prepareAssignment', targetId: null, expectedVersion: 0, baselineRefs: [], approvalRef: null, payload: {} };
function setup(kind = 'AUTO', previous?: any) {
  let called = 0;
  const rules = [{ ruleId: 'qa', subjectRef: { kind: 'HUMAN', userId: id }, operations: ['prepareAssignment'], targetScopes: [{ kind: 'PROJECT', projectId: id }], disposition: kind === 'EXPIRED' ? 'AUTO' : kind, limitPolicyRef: null, expiresAt: new Date(Date.now() + (kind === 'EXPIRED' ? -60000 : 60000)).toISOString() }];
  const db: any = { query: async (sql: string) => {
    if (sql.startsWith('SELECT p.id,p.archived_at')) return { rows: [{ id, archived_at: null, participation: kind === 'VIEWER' ? 'VIEWER' : 'OWNER' }] };
    if (sql.startsWith('SELECT * FROM anvil.project_control')) return { rows: [{ actor_id: id, client_id: cid, generation: kind === 'OLD_GENERATION' ? 2 : 1, revoked_at: kind === 'REVOKED' ? new Date() : null }] };
    if (sql.startsWith('SELECT p.id,p.head_version')) return { rows: kind === 'NO_POLICY' ? [] : [{ id, head_version: 1, rules_json: rules, content_hash: contentHash(canonicalJson({ rules, reason: '명시 QA', reviewRefs: [] })), reason: '명시 QA', review_refs: [], created_at: new Date() }] };
    if (sql.startsWith('SELECT operation,request_hash,result_ref')) return { rows: previous ? [previous] : [] };
    if (sql.startsWith('INSERT INTO anvil.audit_events')) return { rows: [] };
    throw Error('UNEXPECTED_QA_SQL');
  } };
  const access: any = { authenticated: async (_token: string, _csrf: string, callback: any) => callback(db, actor) };
  const repository = new ProjectPolicyRepository(access);
  return { run: () => repository.command('qa', 'qa', command, async () => { called++; return { draftOnly: true }; }), calls: () => called };
}
test('prepareAssignment는 기존 OWNER/현재제어·명시정책 gate를 통과해야 material을 호출한다', async () => {
  const good = setup(); assert.deepEqual(await good.run(), { draftOnly: true }); assert.equal(good.calls(), 1);
  for (const [kind, code] of [['VIEWER', 'PROJECT_WRITE_DENIED'], ['OLD_GENERATION', 'CONTROL_GENERATION_CONFLICT'], ['REVOKED', 'PROJECT_CONTROL_REQUIRED'], ['NO_POLICY', 'PERMISSION_POLICY_UNCONFIGURED'], ['DENY', 'PROJECT_OPERATION_DENIED'], ['REQUIRE_APPROVAL', 'APPROVAL_REQUIRED'], ['EXPIRED', 'PROJECT_OPERATION_DENIED']]) { const q = setup(kind); await assert.rejects(q.run(), error => error instanceof Error && error.message === code, kind); assert.equal(q.calls(), 0, kind); }
});
test('동일 명령은 원결과를 반환하고 다른 hash는 material을 재실행하지 않는다', async () => {
  const result = { persistedDraft: 'original' }, original = { operation: 'prepareAssignment', request_hash: contentHash(canonicalJson(command)), result_ref: result };
  const good = setup('AUTO', original); assert.deepEqual(await good.run(), result); assert.equal(good.calls(), 0);
  const conflict = setup('AUTO', { ...original, request_hash: '0'.repeat(64) }); await assert.rejects(conflict.run(), /IDEMPOTENCY_CONFLICT/); assert.equal(conflict.calls(), 0);
  const deniedReplay = setup('DENY', original); await assert.rejects(deniedReplay.run(), /PROJECT_OPERATION_DENIED/); assert.equal(deniedReplay.calls(), 0);
});
