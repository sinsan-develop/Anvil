import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { canonicalJson, contentHash } from '../../../contracts/canonical.ts';
import { executionStartOriginFixture, installExecutionStartOriginMemoryFS } from '../FN09/execution-start-origin-fixture.ts';

await installExecutionStartOriginMemoryFS();
const { assertReadAccess, isExecutionGrantRead, mintExecutionGrantRead, projectNotArchived } = await import('../../../apps/server/modules/context/read-access.ts');
const { projectMember } = await import('../../../apps/server/modules/access/project-command.ts');
const { ProjectApprovals } = await import('../../../apps/server/modules/approvals/project-approvals.ts');
const H = (v: unknown) => contentHash(canonicalJson(v));

function recorder(rows: (sql: string, args: unknown[]) => unknown[] = () => [{ id: 'p', archived_at: null, participation: 'OWNER' }]) {
  const calls: { sql: string; args: unknown[] }[] = [];
  return { calls, db: { query: async (sql: string, args: unknown[] = []) => { calls.push({ sql, args }); const r = rows(sql, args); return { rows: r, rowCount: r.length }; } } as any };
}
const scope = (projectId = randomUUID()) => ({ projectId, executionId: randomUUID(), executionGeneration: 1, grantRef: { id: randomUUID(), version: 1, contentHash: 'a'.repeat(64) } });
const actor = { actorId: randomUUID(), clientId: randomUUID(), serverOwner: false, credentialGeneration: 1, reauthUntil: null };

test('실행 grant 표식은 모듈 발급 원 객체만 인정하고 같은 모양의 위조·복사본은 SQL 없이 거절한다', async () => {
  const s = scope(), grant = mintExecutionGrantRead(s);
  assert.equal(isExecutionGrantRead(grant), true);
  assert.ok(Object.isFrozen(grant));
  const forged = { kind: 'EXECUTION_GRANT', ...s }, copied = structuredClone(grant), spread = { ...grant };
  for (const fake of [forged, copied, spread, null, undefined, {}]) {
    assert.equal(isExecutionGrantRead(fake), false);
    const r = recorder();
    await assert.rejects(assertReadAccess(r.db, fake as any, s.projectId), (e: any) => e.message === 'EXECUTION_GRANT_READ_DENIED' && e.statusCode === 403);
    assert.equal(r.calls.length, 0);
  }
  assert.throws(() => mintExecutionGrantRead({ ...s, executionGeneration: 0 }), /EXECUTION_GRANT_READ_DENIED/);
  assert.throws(() => mintExecutionGrantRead({ ...s, projectId: 'not-a-uuid' }), /EXECUTION_GRANT_READ_DENIED/);
});

test('HUMAN 판별자는 기존 projectMember와 같은 SQL·인자를 그대로 낸다(잠금 유무 포함)', async () => {
  const pid = randomUUID();
  for (const lock of [false, true]) {
    const viaAccess = recorder(), direct = recorder();
    await assertReadAccess(viaAccess.db, { kind: 'HUMAN', actor }, pid, lock);
    await projectMember(direct.db, actor, pid, lock);
    assert.deepEqual(viaAccess.calls, direct.calls);
    assert.equal(viaAccess.calls.length, 1);
  }
  const missing = recorder(() => []);
  await assert.rejects(assertReadAccess(missing.db, { kind: 'HUMAN', actor }, pid), (e: any) => e.message === 'NOT_FOUND' && e.statusCode === 404);
});

test('GRANT 판별자는 회원 조회·잠금 SQL을 내지 않고 다른 프로젝트 범위를 거절한다', async () => {
  const s = scope(), grant = mintExecutionGrantRead(s), r = recorder();
  await assertReadAccess(r.db, grant, s.projectId, true);
  assert.equal(r.calls.length, 0);
  await assert.rejects(assertReadAccess(r.db, grant, randomUUID()), (e: any) => e.message === 'EXECUTION_GRANT_READ_DENIED' && e.statusCode === 403);
  assert.equal(r.calls.length, 0);
});

test('보관 여부 확인은 잠금 없는 단일 SELECT이며 보관·부재 프로젝트를 거절한다', async () => {
  const pid = randomUUID(), live = recorder(() => [{ archived_at: null }]);
  await projectNotArchived(live.db, pid);
  assert.deepEqual(live.calls, [{ sql: 'SELECT archived_at FROM anvil.projects WHERE id=$1', args: [pid] }]);
  await assert.rejects(projectNotArchived(recorder(() => [{ archived_at: new Date() }]).db, pid), (e: any) => e.message === 'PROJECT_ARCHIVED' && e.statusCode === 412);
  await assert.rejects(projectNotArchived(recorder(() => []).db, pid), (e: any) => e.message === 'NOT_FOUND' && e.statusCode === 404);
});

/** 원 #history 무결성 검산을 통과하는 최소 승인 요청 행. operation만 바꿔 grant 범위 거절을 확인한다. */
function approvalRow(pid: string, operation: string, extra: Record<string, unknown> = {}) {
  const id = randomUUID(), createdBy = randomUUID(), clientId = randomUUID(), createdAt = new Date('2026-11-13T00:00:00.000Z'), expiresAt = '2026-11-14T00:00:00.000Z';
  const actionScope = { operation, targetRef: null, expectedVersion: 0, payloadHash: 'b'.repeat(64), baselineRefs: [], environmentRef: null, sourceScopes: [], limitsRef: null, requestedSubjectRef: { kind: 'HUMAN', userId: createdBy, clientId }, controlGeneration: 1 }, scopeDigest = H(actionScope);
  const details = { reason: '맥락 준비 승인', risks: { data: '없음', security: '없음', cost: '없음', interruption: '없음', unverified: '없음' }, rollback: { method: '재준비', limitations: '없음', evidenceRefs: [] }, expiresAt, actionScope, candidateCommandId: randomUUID() }, policyRef = { id: randomUUID(), version: 1, contentHash: 'c'.repeat(64) };
  const requiredDecider = { kind: 'HUMAN', userId: createdBy };
  const snapshot = { projectId: pid, details, scopeDigest, requiredDecider, policyRef, requestedBy: { kind: 'HUMAN', userId: createdBy, clientId }, controlGeneration: 1, ...extra };
  const hash = H(snapshot), request = { id, version: 1, status: 'PENDING', createdAt: createdAt.toISOString(), ...snapshot };
  return { id, row: { id, version: 1, status: 'PENDING', request_json: request, created_at: createdAt, created_by: createdBy, client_id: clientId, actor_id: createdBy, command_client: clientId,
    content_hash: hash, operation: 'requestApproval', result_ref: { status: 'APPLIED', commandId: randomUUID(), data: { status: 'APPROVAL_REQUESTED', ref: { id, version: 1, contentHash: hash }, request } },
    policy_ref: policyRef, details_json: details, candidate_command_id: details.candidateCommandId, action_scope_json: actionScope, scope_digest: scopeDigest, required_decider_ref: requiredDecider, expires_at: new Date(expiresAt) } };
}

test('승인 grant core는 buildTaskContext 외 이력(originReuse·후보 종류)을 actor 의존 분기 전에 거절하고 회원 조회를 내지 않는다', async () => {
  const pid = randomUUID(), grant = mintExecutionGrantRead(scope(pid)), approvals = new ProjectApprovals();
  for (const [operation, extra] of [['queueExecutionCommand', {}], ['saveEnvironment', {}], ['buildTaskContext', { candidateKind: 'ENVIRONMENT_DEFINITION' }], ['buildTaskContext', { originReuseEvidence: {} }]] as const) {
    const { id, row } = approvalRow(pid, operation, extra);
    const r = recorder(sql => sql.startsWith('SELECT r.*,c.operation') ? [row] : []);
    await assert.rejects(approvals.readContextConsumptionForGrant(r.db, grant, pid, id), (e: any) => e.message === 'EXECUTION_GRANT_READ_DENIED' && e.statusCode === 403, operation);
    assert.equal(r.calls.length, 1);
    assert.ok(r.calls[0]!.sql.startsWith('SELECT r.*,c.operation'));
    assert.ok(!r.calls.some(c => /project_members|FOR UPDATE|FOR SHARE/.test(c.sql)));
  }
  // 위조 표식·다른 프로젝트 grant는 SQL 전에 거절한다.
  const { id } = approvalRow(pid, 'buildTaskContext'), none = recorder();
  await assert.rejects(approvals.readContextConsumptionForGrant(none.db, { kind: 'EXECUTION_GRANT', ...scope(pid) } as any, pid, id), /EXECUTION_GRANT_READ_DENIED/);
  await assert.rejects(approvals.readContextConsumptionForGrant(none.db, mintExecutionGrantRead(scope()), pid, id), /EXECUTION_GRANT_READ_DENIED/);
  assert.equal(none.calls.length, 0);
  // 같은 행의 buildTaskContext 이력은 grant로 읽힌다(결정 없음 → PENDING).
  const ok = approvalRow(pid, 'buildTaskContext'), r = recorder(sql => sql.startsWith('SELECT r.*,c.operation') ? [ok.row] : []);
  const read = await approvals.readContextConsumptionForGrant(r.db, grant, pid, ok.id);
  assert.equal(read.storedStatus, 'PENDING');
  assert.equal(read.consumption, null);
  assert.ok(!r.calls.some(c => /project_members|FOR UPDATE|FOR SHARE|INSERT|UPDATE /.test(c.sql)));
});

const settle = (p: Promise<unknown>) => p.then(ok => ({ ok }), (e: any) => ({ error: e?.message, status: e?.statusCode }));
const forbiddenSql = (trace: string[]) => trace.filter(sql => /FOR UPDATE|FOR SHARE|^\s*(INSERT|UPDATE|DELETE)\b|project_members/i.test(sql));

test('grant 결박 readRegisteredStartSource는 기존 START 맥락 묶음을 잠금·쓰기·회원 조회 없이 같은 결과로 재조립한다', async () => {
  const f = await executionStartOriginFixture({ normalExecutionId: randomUUID(), connectorEnvironment: true, richContext: true, constitutionContext: true, environmentDependencies: true, snapshotRoot: true, originConsumptionStorage: true, budgetElapsedMs: 3600000 });
  const ref = f.preparation.data.snapshot.intent.contextBundleRef;
  f.trace.length = 0;
  const human = await f.contexts.readStartSource(f.db, f.actor, f.pid, ref);
  // 대조군: 기존 HUMAN 경로는 회원 확인과 행 잠금을 낸다(필터가 실제 문장을 잡는지 확인).
  assert.ok(f.trace.some((sql: string) => /project_members/.test(sql) && /FOR UPDATE OF p,m/.test(sql)));
  assert.ok(f.trace.includes('SELECT head_version FROM anvil.assignment_drafts WHERE project_id=$1 AND id=$2 FOR UPDATE'));
  assert.ok(f.trace.some((sql: string) => sql.includes('FROM anvil.documents WHERE project_id=$1 AND id=$2 FOR SHARE')));
  assert.ok(human.manifest.items.length > 3 && human.manifest.items.every((i: any) => i.includedState === 'INCLUDED'));
  f.trace.length = 0;
  const grant = mintExecutionGrantRead(scope(f.pid));
  const viaGrant = await f.contexts.readRegisteredStartSource(f.db, grant, f.pid, ref);
  assert.deepEqual(viaGrant, human);
  assert.ok(f.trace.length > 0);
  assert.deepEqual(forbiddenSql(f.trace), []);
  assert.ok(f.trace.includes('SELECT head_version FROM anvil.assignment_drafts WHERE project_id=$1 AND id=$2'));
  assert.ok(f.trace.includes('SELECT head_version,confirmed_version FROM anvil.documents WHERE project_id=$1 AND id=$2'));
  // 위조 표식·다른 프로젝트 grant는 조회 전에 거절한다.
  f.trace.length = 0;
  await assert.rejects(f.contexts.readRegisteredStartSource(f.db, { kind: 'EXECUTION_GRANT', ...scope(f.pid) } as any, f.pid, ref), /EXECUTION_GRANT_READ_DENIED/);
  await assert.rejects(f.contexts.readRegisteredStartSource(f.db, mintExecutionGrantRead(scope()), f.pid, ref), /EXECUTION_GRANT_READ_DENIED/);
  assert.equal(f.trace.length, 0);
});

test('승인 소비가 있는 맥락 묶음도 grant 경로가 같은 승인 검산·재조립을 거쳐 HUMAN 경로와 같은 판정을 낸다', async () => {
  // 이 fixture 조합의 저장 묶음은 비INCLUDED 항목이 있어 두 경로 모두 마지막 412 판정에 이른다(재조립·manifest 대조 뒤).
  const f = await executionStartOriginFixture({ connectorEnvironment: true, richContext: true, environmentDependencies: true, constitutionContext: true, approvedContext: true, snapshotRoot: true });
  const ref = f.preparation.data.snapshot.intent.contextBundleRef;
  f.trace.length = 0;
  const human = await settle(f.contexts.readStartSource(f.db, f.actor, f.pid, ref));
  // 두 경로가 같은 이른 단계에서 우연히 같이 실패하는 경우와 구분하도록 마지막 판정 코드를 고정한다.
  assert.deepEqual(human, { error: 'CONTEXT_SOURCE_UNAVAILABLE', status: 412 });
  assert.ok(f.trace.some((sql: string) => sql.startsWith('SELECT r.*,c.operation')));
  f.trace.length = 0;
  const viaGrant = await settle(f.contexts.readRegisteredStartSource(f.db, mintExecutionGrantRead(scope(f.pid)), f.pid, ref));
  assert.deepEqual(viaGrant, human);
  assert.ok(f.trace.some((sql: string) => sql.startsWith('SELECT r.*,c.operation')));
  assert.ok(f.trace.some((sql: string) => sql.includes('FROM anvil.approval_consumptions ac')));
  assert.deepEqual(forbiddenSql(f.trace), []);
});
