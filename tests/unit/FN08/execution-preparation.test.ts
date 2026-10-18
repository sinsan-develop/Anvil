import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalJson, contentHash } from '../../../contracts/canonical.ts';
import { randomBytes, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { AccessRepository } from '../../../apps/server/modules/access/repository.ts';
import { buildApp } from '../../../apps/server/app.ts';
const contract: any = await import('../../../contracts/runtime/execution-intent-v1.ts').catch((error: NodeJS.ErrnoException) => { if (error.code === 'ERR_MODULE_NOT_FOUND') return {}; throw error; });
const module: any = await import('../../../apps/server/modules/executions/project-execution-preparations.ts').catch((error: NodeJS.ErrnoException) => { if (error.code === 'ERR_MODULE_NOT_FOUND') return {}; throw error; });
const pid = '11111111-1111-4111-8111-111111111111';
const ref = { id: pid, version: 1, contentHash: 'a'.repeat(64) };
const environmentRef = { ...ref, id: '22222222-2222-4222-8222-222222222222' };
const scope = () => ({ sourceRootRef: ref, mappingRef: null, observationRef: ref, baselineRef: ref, targets: [{ relativePath: 'src/main.ts', kind: 'FILE', access: 'WRITE', recursive: false }] });
const intent = () => ({ projectId: pid, assignmentRef: ref, roleBindingRef: ref, contextBundleRef: ref, connectionRef: ref, environmentRef, capabilityRef: ref, budgetPolicyRef: ref, sourceScopes: [scope()], mode: 'WORK', reason: '내용·기준을 결박한 준비 저장' });
function read(value: unknown) { assert.equal(typeof contract.readExecutionIntentV1, 'function'); return contract.readExecutionIntentV1(value); }

test('실행 준비는 정확 참조·명시 모드·파일 범위를 복제하고 권한을 만들지 않는다', () => {
  const input = intent(), output = read(input); assert.deepEqual(output, input);
  input.sourceScopes[0]!.targets[0]!.relativePath = 'changed.ts'; assert.equal((output as any).sourceScopes[0].targets[0].relativePath, 'src/main.ts');
  assert.equal((output as any).executionAuthorized, undefined); assert.equal(read({ ...intent(), mode: 'CONTEXT_REVIEW' }).mode, 'CONTEXT_REVIEW');
});
test('준비 입력의 권한 true·빈 범위·경로 이탈·옛/위조 ref와 알 수 없는 모드는 거절한다', () => {
  for (const patch of [{ ready: true }, { executionAuthorized: true }, { projectId: 'wrong' }, { assignmentRef: { ...ref, version: 0 } },
    { contextBundleRef: { ...ref, contentHash: 'bad' } }, { sourceScopes: [] }, { mode: 'AUTO' }, { reason: ' ' }, { budgetPolicyRef: null }]) {
    assert.throws(() => read({ ...intent(), ...patch }), /EXECUTION_INTENT_INVALID/);
  }
  const escaped = intent(); escaped.sourceScopes[0]!.targets[0]!.relativePath = '../outside'; assert.throws(() => read(escaped), /EXECUTION_INTENT_INVALID/);
  let calls = 0; const getter: any = intent(); Object.defineProperty(getter,'mode',{enumerable:true,get(){calls++;return 'WORK';}});
  assert.throws(() => read(getter), /EXECUTION_INTENT_INVALID/); assert.equal(calls,0);
});

function fixture() {
  assert.equal(typeof module.ProjectExecutionPreparations, 'function');
  const rows: any[] = [], commands = new Map<string, any>();
  const actor: any = { actorId: pid, clientId: pid, serverOwner: false, credentialGeneration: 1, reauthUntil: null };
  const assignment: any = { projectId: pid, ref, snapshot: { draftRef: ref, definition: { allowedScopes: [scope()], taskRef: { applicationRef: ref, nodeId: 'IMPLEMENT' } }, contentConfirmed: true, ready: false, executionAuthorized: false, dispatchPerformed: false } };
  const draft: any = { projectId: pid, ref, snapshot: { basis: { planRef: ref, designRef: ref, applicationRef: ref } } };
  const binding: any = { projectId: pid, ref, snapshot: { assignmentRef: ref, roleRef: ref, connectionRef: ref, sessionRef: ref, state: 'RESERVED', externalSessionHandleRef: null, executionAuthorized: false, dispatchPerformed: false } };
  const context: any = { projectId: pid, ref, manifest: { assignmentRef: ref, missingRequired: ['LATEST_INSTRUCTIONS'], constitutionRef: ref, latestInstructionRefs: [], baselineRefs: [ref], ready: false, executionAuthorized: false, dispatchPerformed: false }, currentCheck: { state: 'MATCHED_METADATA', issues: [] } };
  const candidate: any = { ref, expired: false, candidate: { kind: 'CONNECTION_CANDIDATE' } };
  let latestBinding = ref, stale = false;
  const db: any = { query: async (sql: string, p: any[] = []) => {
    if (sql.startsWith('SELECT p.id,p.archived_at')) return { rows: p[0] === pid ? [{ id: pid, participation: 'OWNER' }] : [] };
    if (sql.startsWith('SELECT transaction_timestamp')) return { rows: [{ at: new Date('2026-10-19T02:00:00.000Z') }] };
    if (sql.startsWith('SELECT binding_id,version,content_hash FROM anvil.role_bindings')) return { rows: [{ binding_id: latestBinding.id, version: latestBinding.version, content_hash: latestBinding.contentHash }] };
    if (sql.startsWith('SELECT head_version FROM anvil.connection_candidates')) return { rows: [{ head_version: 1 }] };
    if (sql.startsWith('INSERT INTO anvil.commands')) { commands.set(p[0], { result_ref: JSON.parse(p[14]), operation: p[4], state: 'APPLIED', command_actor: p[2], command_client: p[3] }); return { rows: [] }; }
    if (sql.startsWith('INSERT INTO anvil.audit_events') || sql.startsWith('INSERT INTO anvil.authorization_receipts') || sql.startsWith('SELECT set_config')) return { rows: [] };
    if (sql.startsWith('INSERT INTO anvil.execution_preparations')) { rows.push({ project_id: p[0], id: p[1], version: p[2], content_hash: p[3], snapshot_json: JSON.parse(p[4]), created_by: p[5], client_id: p[6], command_id: p[7] }); return { rows: [] }; }
    if (sql.includes('FROM anvil.execution_preparations p')) return { rows: rows.filter(r => r.project_id === p[0] && r.id === p[1] && r.version === p[2]).map(r => ({ ...r,...commands.get(r.command_id) })) };
    throw Error('UNEXPECTED_QA_SQL: '+sql.slice(0,100));
  } };
  const store = new module.ProjectExecutionPreparations(
    { read: async () => assignment }, { current: async () => { if (stale) throw Error('VERSION_CONFLICT'); return draft; } },
    { readBinding: async () => binding }, { read: async () => context },
    { read: async (_db: any,_actor: any,_project: string,id: string,_version: number) => id === environmentRef.id
      ? { ...candidate,ref:environmentRef,candidate:{kind:'ENVIRONMENT_CANDIDATE'} } : candidate });
  const command = (payload: any): any => ({ schemaVersion: 1, projectId: pid, commandId: crypto.randomUUID(), clientId: pid, controlGeneration: 1, operation: 'prepareExecution', targetId: null, expectedVersion: 0, baselineRefs: [], approvalRef: null, payload });
  return { store, db, actor, command, rows, assignment, binding, context, candidate, setStale: () => { stale = true; }, setOldBinding: () => { latestBinding = { ...ref,version:2 }; } };
}

test('내용 확정본을 바꾸지 않고 별도 준비를 저장·재조회하며 누락과 미허가를 보존한다', async () => {
  const q=fixture(), original=canonicalJson(q.assignment.snapshot), input=intent();
  const result=await q.store.save(q.db,q.actor,q.command(input),ref);
  assert.equal(result.data.status,'EXECUTION_PREPARED'); assert.equal(result.data.snapshot.authorizationState,'NOT_AUTHORIZED');
  assert(result.data.snapshot.missingConditions.includes('REQUIRED_CONTEXT_MISSING'));
  assert(result.data.snapshot.missingConditions.includes('CAPABILITY_UNVERIFIED'));
  assert(result.data.snapshot.missingConditions.includes('BUDGET_POLICY_UNVERIFIED'));
  assert.equal(result.data.snapshot.executionAuthorized,false); assert.equal(result.data.snapshot.dispatchPerformed,false);
  assert.equal(canonicalJson(q.assignment.snapshot),original);
  const saved=await q.store.read(q.db,q.actor,pid,result.data.ref.id,1);
  assert.deepEqual(saved.snapshot,result.data.snapshot); assert.equal(contentHash(canonicalJson(saved.snapshot)),saved.ref.contentHash);
  assert.equal(saved.currentness,'NOT_RECHECKED');
});
test('다른 프로젝트/임무·옛 역할 binding·옛 초안과 허용 범위 밖 파일은 준비 저장 전에 거절한다', async () => {
  for (const change of ['project','assignment','binding','draft','scope']) {
    const q=fixture(), input=intent();
    if(change==='project') input.projectId='22222222-2222-4222-8222-222222222222';
    if(change==='assignment') q.binding.snapshot.assignmentRef={...ref,version:2};
    if(change==='binding') q.setOldBinding(); if(change==='draft')q.setStale();
    if(change==='scope')input.sourceScopes[0]!.targets[0]!.relativePath='src/other.ts';
    await assert.rejects(q.store.save(q.db,q.actor,q.command(input),ref)); assert.equal(q.rows.length,0,change);
  }
});
test('저장된 준비의 true 위조와 교차 프로젝트 읽기를 거절한다', async () => {
  const q=fixture(),result=await q.store.save(q.db,q.actor,q.command(intent()),ref);
  await assert.rejects(q.store.read(q.db,q.actor,'22222222-2222-4222-8222-222222222222',result.data.ref.id,1),/NOT_FOUND/);
  q.rows[0].snapshot_json.executionAuthorized=true;
  await assert.rejects(q.store.read(q.db,q.actor,pid,result.data.ref.id,1),/EXECUTION_PREPARATION_INTEGRITY_FAILED/);
});

test('실제 대화 지시 ref는 버전 ref로 바꾸지 않고 종류와 hash를 보존한다',async()=>{
  const q=fixture();q.context.manifest.latestInstructionRefs=[{kind:'CONVERSATION',id:pid,contentHash:'c'.repeat(64)}];
  const result=await q.store.save(q.db,q.actor,q.command(intent()),ref);
  assert.deepEqual(result.data.snapshot.latestInstructionRefs,[{kind:'CONVERSATION',id:pid,contentHash:'c'.repeat(64)}]);
  const saved=await q.store.read(q.db,q.actor,pid,result.data.ref.id,1);assert.deepEqual(saved.snapshot.latestInstructionRefs,result.data.snapshot.latestInstructionRefs);
});
test('WRITE 허가를 READ 허가로 추정하지 않는다',async()=>{
  const q=fixture(),input=intent();input.sourceScopes[0]!.targets[0]!.access='READ';
  await assert.rejects(q.store.save(q.db,q.actor,q.command(input),ref),/EXECUTION_SOURCE_SCOPE_EXCEEDED/);assert.equal(q.rows.length,0);
});

test('준비 저장·조회는 기존 로그인 gate와 no-store를 소비하며 DB 연결을 열지 않는다',async()=>{
  const pool=new Pool({host:'127.0.0.1',port:1,connectionTimeoutMillis:50});
  const repository=new AccessRepository(pool,{installationId:randomUUID(),key:randomBytes(32)});
  const app=buildApp({},undefined,{repository,origin:'https://localhost:3830'});
  try{
    const command={schemaVersion:1,projectId:pid,commandId:randomUUID(),clientId:pid,controlGeneration:1,operation:'prepareExecution',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:intent()};
    const response=await app.inject({method:'POST',url:`/api/v1/projects/${pid}/commands`,headers:{host:'localhost:3830',origin:'https://localhost:3830','x-anvil-csrf':'C'.repeat(43)},payload:command});
    assert.equal(response.statusCode,401,response.body);
    const read=await app.inject({method:'GET',url:`/api/v1/projects/${pid}/execution-preparations/${pid}/versions/1`,headers:{host:'localhost:3830'}});
    assert.equal(read.statusCode,401,read.body);assert.equal(read.headers['cache-control'],'no-store');assert.equal(pool.totalCount,0);
  }finally{await app.close();await pool.end();}
});
