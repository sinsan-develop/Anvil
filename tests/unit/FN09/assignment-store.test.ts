import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalJson } from '../../../contracts/canonical.ts';
const module = await import('../../../apps/server/modules/assignments/project-assignment-drafts.ts').catch((error: NodeJS.ErrnoException) => { if (error.code === 'ERR_MODULE_NOT_FOUND') return {}; throw error; });
const pid = '11111111-1111-4111-8111-111111111111', actor = { actorId: pid, clientId: pid, serverOwner: false, credentialGeneration: 1, reauthUntil: null };
const ref = { id: pid, version: 1, contentHash: 'a'.repeat(64) }, applicationRef = { ...ref, id: '22222222-2222-4222-8222-222222222222' }, designRef = { ...ref, id: '33333333-3333-4333-8333-333333333333' };
const input = (): any => ({ baseRef: null, reason: '임무 준비', definition: { taskRef: { planRef: { ...ref }, taskCode: 'FN01', applicationRef: { ...applicationRef }, nodeId: 'N1' }, purpose: '사용자가 개발 주도권 소유', goal: '명시 업무 구현', baselineRefs: [ref, applicationRef, designRef], inputs: ['요구'], outputs: ['코드'], acceptanceCriteria: ['핵심 동작'], verificationRequirements: ['실패 조건'], included: ['구현'], excluded: ['운영'], allowedScopes: [], environmentRef: null, requiredCapabilities: [], budgetRef: null, ownerRole: '책임자', parentAssignmentRef: null, recordingPolicyRef: null, integrationResponsibility: '통합 검수' } });
const command = (payload = input()): any => ({ schemaVersion: 1, projectId: pid, commandId: '44444444-4444-4444-8444-444444444444', clientId: pid, controlGeneration: 1, operation: 'prepareAssignment', targetId: null, expectedVersion: 0, baselineRefs: [], approvalRef: null, payload });
function setup() {
  assert.equal(typeof (module as any).ProjectAssignmentDrafts, 'function');
  const heads = new Map<string, number>(), versions = new Map<string, any>(), receipts = new Map<string, any>(), writes: string[] = [];
  const plan: any = { ref, designRef, tasks: [{ taskCode: 'FN01', title: '기능 구현', allowedFileRefs: ['src/a.ts'] }], relationalProjection: 'STORED' };
  const decision: any = { currentConfirmationValid: true };
  const methods: any = { projectId: pid, applicationRef, snapshot: { graph: { nodes: [{ nodeId: 'N1' }] } } };
  const db: any = { query: async (sql: string, p: any[] = []) => {
    if (sql.startsWith('SELECT p.id,p.archived_at,m.participation')) return { rows: p[0] === pid ? [{ id: pid, participation: 'OWNER' }] : [] };
    if (sql.startsWith('SELECT head_version FROM anvil.assignment_drafts')) return { rows: heads.has(p[1]) ? [{ head_version: heads.get(p[1]) }] : [] };
    if (sql.startsWith('SELECT transaction_timestamp')) return { rows: [{ at: new Date('2026-10-17T22:45:00Z') }] };
    if (sql.startsWith('INSERT INTO anvil.commands')) { receipts.set(p[0], JSON.parse(p[14])); writes.push(sql); return { rows: [] }; }
    if (sql.startsWith('INSERT INTO anvil.assignment_drafts')) { heads.set(p[1], 1); writes.push(sql); return { rows: [] }; }
    if (sql.startsWith('UPDATE anvil.assignment_drafts')) { heads.set(p[1], p[2]); writes.push(sql); return { rows: [] }; }
    if (sql.startsWith('INSERT INTO anvil.assignment_draft_versions')) { versions.set(p[1] + ':' + p[2], { project_id: p[0], draft_id: p[1], version: p[2], content_hash: p[3], version_json: JSON.parse(p[4]), created_by: p[5], client_id: p[6], command_id: p[7] }); writes.push(sql); return { rows: [] }; }
    if (sql.startsWith('SELECT v.*,d.head_version')) { const row = versions.get(p[1] + ':' + p[2]); return { rows: row && row.project_id === p[0] ? [{ ...row, head_version: heads.get(p[1]), result_ref: receipts.get(row.command_id), command_actor: pid, command_client: pid, operation: 'prepareAssignment', state: 'APPLIED', expected_version: p[2] - 1 }] : [] }; }
    if (sql.startsWith('INSERT INTO anvil.authorization_receipts') || sql.startsWith('INSERT INTO anvil.audit_events') || sql.startsWith("SELECT set_config('anvil.actor_id'")) return { rows: [] };
    throw Error('UNEXPECTED_QA_SQL');
  } };
  const parentState: any = { confirmed: null, decision: null };
  const store = new (module as any).ProjectAssignmentDrafts({ read: async () => plan, decision: async () => decision }, { readApplication: async () => methods }, {
    read: async (_db: any, _actor: any, project: string, id: string, version: number) => {
      if (project !== parentState.confirmed?.projectId || id !== parentState.confirmed?.ref.id || version !== parentState.confirmed?.ref.version) throw Error('NOT_FOUND');
      return parentState.confirmed;
    },
    decision: async () => parentState.decision,
  });
  return { store, db, plan, decision, methods, heads, versions, receipts, writes, parentState };
}

async function parentSetup() {
  const q = setup(), payload = input();
  payload.definition.allowedScopes = [{ sourceRootRef: ref, mappingRef: null, observationRef: ref, baselineRef: ref, targets: [{relativePath:'src/a.ts', kind:'FILE',access:'WRITE',recursive:false},{relativePath:'src/b.ts',kind:'FILE',access:'READ',recursive:false}] }];
  payload.definition.requiredCapabilities = ['FILE_READ','FILE_WRITE'];
  const parent = await q.store.save(q.db, actor, command(payload), ref);
  const confirmedRef = {...parent.data.ref, contentHash:'c'.repeat(64)};
  q.parentState.confirmed = {projectId:pid,ref:confirmedRef,snapshot:{draftRef:parent.data.ref,definition:structuredClone(payload.definition),contentConfirmed:true,ready:false,executionAuthorized:false,dispatchPerformed:false}};
  q.parentState.decision = {draftRef:parent.data.ref,confirmedRef,latestReviewAccepted:true,currentIssue:null};
  q.plan.tasks.push({...q.plan.tasks[0],taskCode:'FN02'});
  const child = input(); child.definition.parentAssignmentRef=confirmedRef; child.definition.taskRef.taskCode='FN02';
  child.definition.allowedScopes=[{...structuredClone(payload.definition.allowedScopes[0]),targets:[structuredClone(payload.definition.allowedScopes[0].targets[0])]}];
  child.definition.requiredCapabilities=['FILE_WRITE'];
  return {...q,child,parent};
}

test('현재 확정 부모의 부분집합 하위 초안을 저장·개정·조회하고 부모/과거 버전을 보존한다', async () => {
  const q=await parentSetup(), before=canonicalJson(q.versions.get(q.parent.data.ref.id+':1'));
  const saved=await q.store.save(q.db,actor,command(q.child),ref);
  assert.deepEqual(saved.data.snapshot.definition.parentAssignmentRef,q.parentState.confirmed.ref);
  const view=await q.store.read(q.db,actor,pid,saved.data.ref.id,1);
  assert.deepEqual(view.ref,saved.data.ref); assert.equal(view.snapshot.executionAuthorized,false);
  const next=structuredClone(q.child); next.baseRef=saved.data.ref; next.definition.goal='하위 개정';
  const revised=await q.store.save(q.db,actor,{...command(next),targetId:saved.data.ref.id,expectedVersion:1},ref);
  assert.equal(revised.data.ref.version,2); assert.equal((await q.store.read(q.db,actor,pid,saved.data.ref.id,1)).snapshot.definition.goal,'명시 업무 구현');
  assert.equal(canonicalJson(q.versions.get(q.parent.data.ref.id+':1')),before);
  await assert.rejects(q.store.current(q.db,actor,pid,revised.data.ref), /ASSIGNMENT_CHILD_DRAFT_ONLY/);
});

test('하위 개정으로 부모를 제거·교체해 root 후속 권한 경로를 열지 못한다', async () => {
  for(const parent of [null,ref]) {
    const q=await parentSetup(), first=await q.store.save(q.db,actor,command(q.child),ref), next=structuredClone(q.child), before=q.writes.length;
    next.baseRef=first.data.ref; next.definition.parentAssignmentRef=parent;
    await assert.rejects(q.store.save(q.db,actor,{...command(next),targetId:first.data.ref.id,expectedVersion:1},ref),Error);
    assert.equal(q.writes.length,before); assert.equal(q.heads.get(first.data.ref.id),1);
  }
});

test('부모 불일치·stale·다른project·하위의하위·범위확대는 영수증 전에 거절한다', async () => {
  for(const kind of ['hash','head','project','review','confirmation','nested','environment','budget','recording','application','plan','node','baseline','capability','path','access','binding','self']) {
    const q=await parentSetup(), d=q.child.definition, before=q.writes.length;
    if(kind==='hash') d.parentAssignmentRef={...d.parentAssignmentRef,contentHash:'f'.repeat(64)};
    if(kind==='head') q.heads.set(q.parent.data.ref.id,2);
    if(kind==='project') q.parentState.confirmed.projectId=applicationRef.id;
    if(kind==='review') q.parentState.decision.latestReviewAccepted=false;
    if(kind==='confirmation') q.parentState.decision.confirmedRef={...d.parentAssignmentRef,contentHash:'f'.repeat(64)};
    if(kind==='nested') q.parentState.confirmed.snapshot.definition.parentAssignmentRef=ref;
    if(kind==='environment') d.environmentRef=ref;
    if(kind==='budget') d.budgetRef=ref;
    if(kind==='recording') d.recordingPolicyRef=ref;
    if(kind==='application') d.taskRef.applicationRef=ref;
    if(kind==='plan') d.taskRef.planRef=applicationRef;
    if(kind==='node') {d.taskRef.nodeId='N2';q.methods.snapshot.graph.nodes.push({nodeId:'N2'});}
    if(kind==='baseline') d.baselineRefs.push({...ref,id:'99999999-9999-4999-8999-999999999999'});
    if(kind==='capability') d.requiredCapabilities.push('EXECUTE');
    if(kind==='path') d.allowedScopes[0].targets[0].relativePath='src/other.ts';
    if(kind==='access') d.allowedScopes[0].targets[0].access='READ';
    if(kind==='binding') d.allowedScopes[0].observationRef=applicationRef;
    const request=kind==='self'?{...command(q.child),targetId:q.parent.data.ref.id,expectedVersion:1}:command(q.child);
    const errors:Record<string,string>={hash:'ASSIGNMENT_PARENT_INVALID',head:'ASSIGNMENT_PARENT_NOT_CURRENT',project:'NOT_FOUND',review:'ASSIGNMENT_PARENT_NOT_CURRENT',confirmation:'ASSIGNMENT_PARENT_NOT_CURRENT',nested:'ASSIGNMENT_CHILD_DRAFT_ONLY',application:'METHODOLOGY_APPLICATION_CHANGED',plan:'VERSION_CONFLICT',baseline:'ASSIGNMENT_BASELINE_MISMATCH',self:'ASSIGNMENT_PARENT_INVALID'};
    await assert.rejects(q.store.save(q.db,actor,request,ref), (error:Error)=>error.message===(errors[kind]??'ASSIGNMENT_PARENT_SCOPE_MISMATCH'),kind); assert.equal(q.writes.length,before,kind);
  }
});
test('정확한 현재 계획/단계의 초안은 receipt·불변 버전으로 저장하되 시작하지 않는다', async () => {
  const q = setup(), result = await q.store.save(q.db, actor, command(), ref);
  assert.equal(result.data.status, 'ASSIGNMENT_DRAFT_STORED'); assert.equal(result.data.snapshot.status, 'DRAFT'); assert.equal(result.data.snapshot.ready, false); assert.equal(result.data.snapshot.executionAuthorized, false);
  const stored = await q.store.read(q.db, actor, pid, result.data.ref.id, 1); assert.deepEqual(stored.ref, result.data.ref); assert.equal(stored.snapshot.definition.goal, '명시 업무 구현');
  assert(q.writes.some(sql => sql.startsWith('INSERT INTO anvil.commands'))); assert(q.writes.some(sql => sql.startsWith('INSERT INTO anvil.assignment_draft_versions'))); assert.equal(q.writes.some(sql => /executions|delivery_outbox/.test(sql)), false);
});
test('개정은 정확한 base hash/version·현재 head를 요구하고 과거 버전을 보존한다', async () => {
  const q = setup(), first = await q.store.save(q.db, actor, command(), ref), before = canonicalJson(q.versions.get(first.data.ref.id + ':1'));
  const payload = input(); payload.baseRef = first.data.ref; payload.definition.goal = '개정 목표'; const request = { ...command(payload), commandId: '55555555-5555-4555-8555-555555555555', targetId: first.data.ref.id, expectedVersion: 1 };
  const second = await q.store.save(q.db, actor, request, ref); assert.equal(second.data.ref.version, 2); assert.equal(canonicalJson(q.versions.get(first.data.ref.id + ':1')), before);
  await assert.rejects(q.store.save(q.db, actor, request, ref), /VERSION_CONFLICT/);
});
test('변조 base·미확정/다른 적용·없는 node/업무는 receipt 쓰기 전에 거절한다', async () => {
  for (const change of ['plan', 'application', 'node', 'task']) {
    const q = setup(); if (change === 'plan') q.decision.currentConfirmationValid = false; if (change === 'application') q.methods.applicationRef = { ...applicationRef, version: 2 }; if (change === 'node') q.methods.snapshot.graph.nodes = []; if (change === 'task') q.plan.tasks = [];
    await assert.rejects(q.store.save(q.db, actor, command(), ref)); assert.equal(q.writes.length, 0);
  }
  const q = setup(), first = await q.store.save(q.db, actor, command(), ref), payload = input(); payload.baseRef = { ...first.data.ref, contentHash: 'b'.repeat(64) }; const before = q.writes.length;
  await assert.rejects(q.store.save(q.db, actor, { ...command(payload), targetId: first.data.ref.id, expectedVersion: 1 }, ref), /VERSION_CONFLICT/); assert.equal(q.writes.length, before);
});
test('읽기는 현재 회원·project를 대조하고 snapshot/receipt 변조를 정상 원문으로 표시하지 않는다', async () => {
  const q = setup(), result = await q.store.save(q.db, actor, command(), ref), id = result.data.ref.id;
  await assert.rejects(q.store.read(q.db, actor, applicationRef.id, id, 1), /NOT_FOUND/);
  q.versions.get(id + ':1').version_json.definition.goal = '변조'; await assert.rejects(q.store.read(q.db, actor, pid, id, 1), /ASSIGNMENT_INTEGRITY_FAILED/);
});

test('내용 검토 선행은 현재 head·전체 hash·현재 계획과 업무 원본을 재확인한다', async () => {
  const q = setup(), result = await q.store.save(q.db, actor, command(), ref);
  assert.equal(typeof q.store.current, 'function');
  const current = await q.store.current(q.db, actor, pid, result.data.ref);
  assert.deepEqual(current.ref, result.data.ref);
  await assert.rejects(q.store.current(q.db, actor, pid, { ...result.data.ref, contentHash: 'b'.repeat(64) }), /VERSION_CONFLICT/);
  q.plan.tasks[0].title = '기준 변경'; await assert.rejects(q.store.current(q.db, actor, pid, result.data.ref), /ASSIGNMENT_BASIS_CHANGED/);
  q.decision.currentConfirmationValid = false; await assert.rejects(q.store.current(q.db, actor, pid, result.data.ref), /ASSIGNMENT_PLAN_NOT_CURRENT/);
});
