import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalJson } from '../../../contracts/canonical.ts';
import { contentHash } from '../../../contracts/canonical.ts';
import { randomBytes, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { AccessRepository } from '../../../apps/server/modules/access/repository.ts';
import { buildApp } from '../../../apps/server/app.ts';
import { ProjectPolicyRepository } from '../../../apps/server/modules/access/project-command.ts';

const subject: any = await import('../../../apps/server/modules/assignments/responsible-sessions.ts').catch((error: NodeJS.ErrnoException) => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {}; throw error;
});
const ref = { id: '11111111-1111-4111-8111-111111111111', version: 1, contentHash: 'a'.repeat(64) };
const role = (input: unknown) => { assert.equal(typeof subject.readProjectRole, 'function'); return subject.readProjectRole(input); };
const binding = (input: unknown) => { assert.equal(typeof subject.readResponsibleSessionBinding, 'function'); return subject.readResponsibleSessionBinding(input); };

test('총괄 역할과 단계 책임 역할을 구분하고 입력을 별도 복제한다', () => {
  assert.deepEqual(role({ kind: 'COORDINATOR', stageRef: null, parentRoleRef: null, reason: '프로젝트 총괄' }),
    { kind: 'COORDINATOR', stageRef: null, parentRoleRef: null, reason: '프로젝트 총괄' });
  const input = { kind: 'STAGE_OWNER', stageRef: { applicationRef: { ...ref }, nodeId: 'IMPLEMENT' }, parentRoleRef: { ...ref }, reason: '구현 단계 책임' };
  const parsed = role(input); input.stageRef.nodeId = 'CHANGED';
  assert.equal(parsed.stageRef.nodeId, 'IMPLEMENT'); assert.equal(parsed.executionAuthorized, undefined);
});

test('총괄에 단계/부모를 붙이거나 단계 책임에 부모/단계를 누락하지 못한다', () => {
  for (const input of [
    { kind: 'COORDINATOR', stageRef: { applicationRef: ref, nodeId: 'N1' }, parentRoleRef: null, reason: '잘못된 단계' },
    { kind: 'COORDINATOR', stageRef: null, parentRoleRef: ref, reason: '잘못된 부모' },
    { kind: 'STAGE_OWNER', stageRef: null, parentRoleRef: ref, reason: '단계 없음' },
    { kind: 'STAGE_OWNER', stageRef: { applicationRef: ref, nodeId: 'N1' }, parentRoleRef: null, reason: '부모 없음' },
    { kind: 'SUBTASK', stageRef: null, parentRoleRef: null, reason: '임의 하위 역할' },
  ]) assert.throws(() => role(input), /PROJECT_ROLE_INPUT_INVALID/);
});

test('정확한 임무/역할/연결 참조로 새 예약 또는 기존 binding 유지를 요청한다', () => {
  const input = { assignmentRef: { ...ref }, roleRef: { ...ref }, connectionRef: { ...ref }, existingSessionBindingRef: null, reason: '책임 세션 예약' };
  assert.deepEqual(binding(input), input);
  const reused = binding({ ...input, existingSessionBindingRef: ref }); assert.deepEqual(reused.existingSessionBindingRef, ref);
  input.assignmentRef.version = 2; assert.equal(reused.assignmentRef.version, 1);
});

test('외부 세션 handle/권한 true/가짜 참조와 위험한 문자열을 입력으로 주입하지 못한다', () => {
  const input = { assignmentRef: ref, roleRef: ref, connectionRef: ref, existingSessionBindingRef: null, reason: '예약' };
  for (const patch of [{ externalSessionHandle: 'provider-session' }, { ready: true }, { executionAuthorized: true },
    { assignmentRef: { ...ref, version: 0 } }, { connectionRef: { ...ref, contentHash: 'bad' } },
    { existingSessionBindingRef: 'not-a-ref' }, { reason: ' ' }, { reason: '\uD800' }, { reason: 'x'.repeat(20001) }]) {
    assert.throws(() => binding({ ...input, ...patch }), /RESPONSIBLE_SESSION_INPUT_INVALID/);
  }
  assert.throws(() => binding({ ...input, reason: 'api_key=DO_NOT_ECHO' }), /RESPONSIBLE_SESSION_SENSITIVE_CONTENT/);
});

test('getter와 알 수 없는 필드를 평가하거나 보존하지 않는다', () => {
  let calls = 0;
  const input: any = { kind: 'COORDINATOR', stageRef: null, parentRoleRef: null };
  Object.defineProperty(input, 'reason', { enumerable: true, get() { calls++; return '위장'; } });
  assert.throws(() => role(input), /PROJECT_ROLE_INPUT_INVALID/); assert.equal(calls, 0);
  assert.throws(() => role({ kind: 'COORDINATOR', stageRef: null, parentRoleRef: null, reason: '예약', projectId: ref.id }), /PROJECT_ROLE_INPUT_INVALID/);
});

test('기존 방법론에서 정상인 한글·64자 초과 단계 ID를 그대로 수용한다', () => {
  for (const nodeId of ['설계검토','implementation_'.repeat(6)]) {
    const parsed=role({kind:'STAGE_OWNER',stageRef:{applicationRef:ref,nodeId},parentRoleRef:ref,reason:'기존 단계 유지'});
    assert.equal(parsed.stageRef.nodeId,nodeId);
  }
});

const pid = ref.id, actor: any = { actorId: pid, clientId: pid, serverOwner: false, credentialGeneration: 1, reauthUntil: null };
function storeFixture() {
  assert.equal(typeof subject.ResponsibleSessions, 'function');
  const roles: any[] = [], bindings: any[] = [], sessions: any[] = [], commands = new Map<string, any>();
  const application: any = { projectId: pid, applicationRef: ref, snapshot: { graph: { nodes: [{ nodeId: 'IMPLEMENT', kind: 'AGENT', role: 'STAGE_OWNER' }] } } };
  const assignment: any = { projectId: pid, ref, snapshot: { draftRef: { ...ref, contentHash: 'b'.repeat(64) }, definition: { taskRef: { applicationRef: ref, nodeId: 'IMPLEMENT' } }, contentConfirmed: true, ready: false, executionAuthorized: false, dispatchPerformed: false } };
  let current = true;
  const connection: any = { ref, expired: false, candidate: { kind: 'CONNECTION_CANDIDATE' }, executionAuthorized: false, headVersion: 1 };
  const db: any = { query: async (sql: string, p: any[] = []) => {
    if (sql.startsWith('SELECT p.id,p.archived_at,m.participation')) return { rows: p[0] === pid ? [{ id: pid, participation: 'OWNER' }] : [] };
    if (sql.startsWith('SELECT transaction_timestamp')) return { rows: [{ at: new Date('2026-10-19T01:00:00.000Z') }] };
    if (sql.startsWith('SELECT head_version FROM anvil.connection_candidates')) return { rows: [{ head_version: connection.headVersion }] };
    if (sql.startsWith('INSERT INTO anvil.commands')) { commands.set(p[0], { result_ref: JSON.parse(p[14]), operation: p[4], state: 'APPLIED', expected_version: p[10], command_actor: p[2], command_client: p[3] }); return { rows: [] }; }
    if (sql.startsWith('INSERT INTO anvil.authorization_receipts') || sql.startsWith('INSERT INTO anvil.audit_events') || sql.startsWith('SELECT set_config')) return { rows: [] };
    if (sql.startsWith('INSERT INTO anvil.project_roles')) { roles.push({ project_id: p[0], role_id: p[1], version: p[2], content_hash: p[3], snapshot_json: JSON.parse(p[4]), created_by: p[5], client_id: p[6], command_id: p[7] }); return { rows: [] }; }
    if (sql.startsWith('INSERT INTO anvil.agent_sessions')) { sessions.push({ project_id: p[0], session_id: p[1], version: p[2], content_hash: p[3], snapshot_json: JSON.parse(p[4]), created_by: p[5], client_id: p[6], command_id: p[7] }); return { rows: [] }; }
    if (sql.startsWith('INSERT INTO anvil.role_bindings')) { bindings.push({ project_id: p[0], binding_id: p[1], version: p[2], role_id: p[3], session_id: p[4], content_hash: p[5], snapshot_json: JSON.parse(p[6]), created_by: p[7], client_id: p[8], command_id: p[9] }); return { rows: [] }; }
    if (sql.includes('FROM anvil.project_roles r')) return { rows: roles.filter(r => r.project_id === p[0] && (sql.includes('r.role_id=$2') ? r.role_id === p[1] && r.version === p[2] : true)).map(r => ({ ...r, ...commands.get(r.command_id) })) };
    if (sql.includes('FROM anvil.role_bindings b')) return { rows: bindings.filter(r => r.project_id === p[0] && (sql.includes('b.binding_id=$2') ? r.binding_id === p[1] && r.version === p[2] : r.role_id === p[1])).sort((a,b) => b.version-a.version).slice(0,1).map(r => ({ ...r, ...commands.get(r.command_id) })) };
    if (sql.includes('FROM anvil.agent_sessions s')) return { rows: sessions.filter(r => r.project_id === p[0] && r.session_id === p[1] && r.version === p[2]).map(r => ({ ...r, ...commands.get(r.command_id) })) };
    throw Error('UNEXPECTED_QA_SQL: ' + sql.slice(0,100));
  } };
  const store = new subject.ResponsibleSessions({ readApplication: async () => application },
    { read: async (_db: any, _actor: any, project: string, id: string, version: number) => { if (project !== pid || id !== ref.id || version !== ref.version) throw Error('NOT_FOUND'); return assignment; } },
    { current: async (_db: any, _actor: any, project: string, requested: any) => { if (project !== pid || !current || canonicalJson(requested) !== canonicalJson(assignment.snapshot.draftRef)) throw Error('VERSION_CONFLICT'); return { projectId: pid }; } },
    { read: async () => connection });
  const command = (operation: string, payload: any): any => ({ schemaVersion: 1, projectId: pid, commandId: crypto.randomUUID(), clientId: pid, controlGeneration: 1, operation, targetId: null, expectedVersion: 0, baselineRefs: [], approvalRef: null, payload });
  const define = async () => {
    const root = await store.define(db, actor, command('defineProjectRole', { kind: 'COORDINATOR', stageRef: null, parentRoleRef: null, reason: '총괄' }), ref);
    return store.define(db, actor, command('defineProjectRole', { kind: 'STAGE_OWNER', stageRef: { applicationRef: ref, nodeId: 'IMPLEMENT' }, parentRoleRef: root.data.ref, reason: '단계 책임' }), ref);
  };
  return { store, db, command, define, roles, bindings, sessions, connection, application, assignment, setStale: () => { current = false; } };
}

test('이미 존재하는 nonnull 하위 확정본도 책임 세션 배정 근거가 되지 않는다', async () => {
  const q = storeFixture(), role = await q.define();
  q.assignment.snapshot.definition.parentAssignmentRef = { ...ref, version: 2 };
  const rolesBefore = q.roles.length;
  await assert.rejects(q.store.bind(q.db, actor, q.command('bindResponsibleSession', { assignmentRef: ref, roleRef: role.data.ref, connectionRef: ref, existingSessionBindingRef: null, reason: '하위 배정 금지' }), ref), /ASSIGNMENT_CHILD_DRAFT_ONLY/);
  assert.equal(q.sessions.length, 0); assert.equal(q.bindings.length, 0); assert.equal(q.roles.length, rolesBefore);
});

test('역할 저장·고정 조회와 책임 세션 예약을 연결하되 외부 세션을 만들지 않는다', async () => {
  const q = storeFixture(), result = await q.define();
  const saved = await q.store.readRole(q.db, actor, pid, result.data.ref.id, 1);
  assert.equal(saved.snapshot.kind, 'STAGE_OWNER'); assert.deepEqual(saved.ref, result.data.ref);
  const input = { assignmentRef: ref, roleRef: result.data.ref, connectionRef: ref, existingSessionBindingRef: null, reason: '임무에 책임 세션 예약' };
  const reserved = await q.store.bind(q.db, actor, q.command('bindResponsibleSession', input), ref);
  assert.equal(reserved.data.snapshot.state, 'RESERVED'); assert.equal(reserved.data.snapshot.externalSessionHandleRef, null);
  assert.equal(reserved.data.snapshot.executionAuthorized, false); assert.equal(reserved.data.snapshot.dispatchPerformed, false);
  const read = await q.store.readBinding(q.db, actor, pid, reserved.data.ref.id, 1);
  assert.deepEqual(read.snapshot, reserved.data.snapshot); assert.equal(q.sessions.length, 1);
  assert.equal(read.snapshot.connectionReadiness, 'CANDIDATE_ONLY');
  const repeat = q.command('bindResponsibleSession', { ...input, existingSessionBindingRef: reserved.data.ref, reason: '재작업은 같은 세션 유지' });
  repeat.targetId = reserved.data.ref.id; repeat.expectedVersion = 1;
  const reused = await q.store.bind(q.db, actor, repeat, ref);
  assert.deepEqual(reused.data.snapshot.sessionRef, read.snapshot.sessionRef); assert.equal(q.sessions.length, 1);
  assert.equal(reused.data.ref.version, 2); assert.equal(q.bindings.length, 2);
});

test('옛 단계·다른 단계/부모·중복 역할·옛 임무·연결 변조는 저장 전에 거절한다', async () => {
  const q = storeFixture(), result = await q.define();
  await assert.rejects(q.define(), /PROJECT_ROLE_ALREADY_DEFINED/);
  const input = { assignmentRef: ref, roleRef: result.data.ref, connectionRef: ref, existingSessionBindingRef: null, reason: '예약' };
  q.assignment.snapshot.definition.taskRef.nodeId = 'OTHER';
  await assert.rejects(q.store.bind(q.db, actor, q.command('bindResponsibleSession', input), ref), /ROLE_STAGE_MISMATCH/);
  q.assignment.snapshot.definition.taskRef.nodeId = 'IMPLEMENT'; q.connection.ref = { ...ref, contentHash: 'c'.repeat(64) };
  await assert.rejects(q.store.bind(q.db, actor, q.command('bindResponsibleSession', input), ref), /VERSION_CONFLICT/);
  q.connection.ref = ref; q.setStale();
  await assert.rejects(q.store.bind(q.db, actor, q.command('bindResponsibleSession', input), ref), /VERSION_CONFLICT/);
  assert.equal(q.bindings.length, 0); assert.equal(q.sessions.length, 0);
  q.application.applicationRef = { ...ref, version: 2 };
  await assert.rejects(q.store.define(q.db, actor, q.command('defineProjectRole', { kind: 'STAGE_OWNER', stageRef: { applicationRef: ref, nodeId: 'IMPLEMENT' }, parentRoleRef: result.data.ref, reason: '옛 적용본' }), ref), /ROLE_STAGE_NOT_CURRENT/);
});

test('이미 예약한 역할의 세션 무단 교체·binding 변조·교차 프로젝트를 거절한다', async () => {
  const q = storeFixture(), role = await q.define(), input = { assignmentRef: ref, roleRef: role.data.ref, connectionRef: ref, existingSessionBindingRef: null, reason: '예약' };
  const first = await q.store.bind(q.db, actor, q.command('bindResponsibleSession', input), ref);
  await assert.rejects(q.store.bind(q.db, actor, q.command('bindResponsibleSession', input), ref), /SESSION_REPLACEMENT_REQUIRED/);
  await assert.rejects(q.store.readBinding(q.db, actor, '22222222-2222-4222-8222-222222222222', first.data.ref.id, 1), /NOT_FOUND/);
  q.bindings[0].snapshot_json.executionAuthorized = true;
  await assert.rejects(q.store.readBinding(q.db, actor, pid, first.data.ref.id, 1), /RESPONSIBLE_SESSION_INTEGRITY_FAILED/);
  assert.equal(q.sessions.length, 1);
});

test('이미 개정된 연결 후보의 과거 버전은 새 예약에 재사용하지 않는다', async () => {
  const q = storeFixture(), role = await q.define(); q.connection.headVersion = 2;
  await assert.rejects(q.store.bind(q.db, actor, q.command('bindResponsibleSession', {
    assignmentRef: ref, roleRef: role.data.ref, connectionRef: ref, existingSessionBindingRef: null, reason: '옛 후보 재사용 차단',
  }), ref), /CONNECTION_CANDIDATE_NOT_CURRENT/);
  assert.equal(q.sessions.length, 0); assert.equal(q.bindings.length, 0);
});

test('역할/책임 세션 명령과 조회는 로그인 전에 DB를 열지 않으며 다른 origin은 차단한다', async () => {
  const pool = new Pool({ host: '127.0.0.1', port: 1, connectionTimeoutMillis: 50 });
  const repository = new AccessRepository(pool, { installationId: randomUUID(), key: randomBytes(32) });
  const app = buildApp({}, undefined, { repository, origin: 'https://localhost:3830' });
  try {
    const headers = { host: 'localhost:3830', origin: 'https://localhost:3830', 'x-anvil-csrf': 'C'.repeat(43) };
    for (const operation of ['defineProjectRole','bindResponsibleSession']) {
      const payload = { schemaVersion: 1, projectId: pid, commandId: randomUUID(), clientId: pid, controlGeneration: 1, operation, targetId: null, expectedVersion: 0, baselineRefs: [], approvalRef: null, payload: {} };
      const response = await app.inject({ method: 'POST', url: `/api/v1/projects/${pid}/commands`, headers, payload });
      assert.equal(response.statusCode, 401, response.body);
      assert.equal((await app.inject({ method: 'POST', url: `/api/v1/projects/${pid}/commands`, headers: { ...headers, origin: 'https://other.invalid' }, payload })).statusCode, 403);
    }
    for (const path of [`project-roles/${pid}/versions/1`,`role-bindings/${pid}/versions/1`]) {
      const response = await app.inject({ method: 'GET', url: `/api/v1/projects/${pid}/${path}`, headers: { host: 'localhost:3830' } });
      assert.equal(response.statusCode, 401, response.body); assert.equal(response.headers['cache-control'], 'no-store');
    }
    assert.equal(pool.totalCount, 0);
  } finally { await app.close(); await pool.end(); }
});

test('새 비실행 명령은 명시 정책/현재 제어를 요구하고 거절·옛 세대·다른 hash 재사용을 통과시키지 않는다', async () => {
  for (const operation of ['defineProjectRole','bindResponsibleSession']) {
    for (const condition of ['AUTO','DENY','NO_POLICY','EXPIRED','OLD_CONTROL','REPLAY','CONFLICT','APPROVAL_REQUIRED']) {
      let writes = 0;
      const request: any = { schemaVersion: 1, projectId: pid, commandId: pid, clientId: pid, controlGeneration: 1, operation, targetId: null, expectedVersion: 0, baselineRefs: [], approvalRef: null, payload: {} };
      const rules = [{ ruleId: 'explicit', subjectRef: { kind: 'HUMAN', userId: pid }, operations: [operation], targetScopes: [{ kind: 'PROJECT', projectId: pid }], disposition: condition === 'DENY' ? 'DENY' : condition === 'APPROVAL_REQUIRED' ? 'REQUIRE_APPROVAL' : 'AUTO', limitPolicyRef: null, expiresAt: new Date(Date.now() + (condition === 'EXPIRED' ? -60000 : 60000)).toISOString() }];
      const db: any = { query: async (sql: string) => {
        if (sql.startsWith('SELECT p.id,p.archived_at')) return { rows: [{ id: pid, archived_at: null, participation: 'OWNER' }] };
        if (sql.startsWith('SELECT * FROM anvil.project_control')) return { rows: [{ actor_id: pid, client_id: pid, generation: condition === 'OLD_CONTROL' ? 2 : 1, revoked_at: null }] };
        if (sql.startsWith('SELECT p.id,p.head_version')) return { rows: condition === 'NO_POLICY' ? [] : [{ id: pid, head_version: 1, rules_json: rules, content_hash: contentHash(canonicalJson({ rules, reason: '명시 정책', reviewRefs: [] })), reason: '명시 정책', review_refs: [], created_at: new Date() }] };
        if (sql.startsWith('SELECT operation,request_hash,result_ref')) return { rows: ['REPLAY','CONFLICT'].includes(condition) ? [{ operation, request_hash: condition === 'REPLAY' ? contentHash(canonicalJson(request)) : '0'.repeat(64), result_ref: { original: true } }] : [] };
        if (sql.startsWith('INSERT INTO anvil.audit_events')) return { rows: [] };
        throw Error('UNEXPECTED_QA_SQL');
      } };
      const policies = new ProjectPolicyRepository({ authenticated: async (_token: any, _csrf: any, callback: any) => callback(db, actor) } as any);
      const promise = policies.command('synthetic','synthetic',request, async () => { writes++; return { reserved: true }; });
      if (condition === 'AUTO') { assert.deepEqual(await promise, { reserved: true }); assert.equal(writes,1); }
      else if (condition === 'REPLAY') { assert.deepEqual(await promise, { original: true }); assert.equal(writes,0); }
      else if (condition === 'APPROVAL_REQUIRED') { await assert.rejects(promise,/EXECUTION_PREPARATION_APPROVAL_NOT_CONNECTED/);assert.equal(writes,0); }
      else { await assert.rejects(promise); assert.equal(writes,0); }
    }
  }
});
