import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { canonicalJson, contentHash } from '../../../contracts/canonical.ts';
import { journey } from './normal-request-challenge-fixture.ts';
import { contextSourceFixture } from './normal-start-context-source-fixture.ts';
const { RegisteredStartContextSource } = await import('../../../apps/server/modules/executions/normal-start-context-source.ts');
const accessModule = await import('../../../apps/server/modules/context/read-access.ts');
const {assertReadAccess,isExecutionGrantRead,projectNotArchived} = accessModule;
const { projectMember } = await import('../../../apps/server/modules/access/project-command.ts');
const { executionStartOriginFixture } = await import('../FN09/execution-start-origin-fixture.ts');
const { ProjectApprovals } = await import('../../../apps/server/modules/approvals/project-approvals.ts');
const H = (v: unknown) => contentHash(canonicalJson(v));

test('기존 승인 소비 비INCLUDED 묶음 HUMAN412는 보존하며 등록 없는 grant 읽기는 mint 전에 거절한다',async()=>{
 const f=await executionStartOriginFixture({connectorEnvironment:true,richContext:true,environmentDependencies:true,constitutionContext:true,approvedContext:true,snapshotRoot:true});
 const ref=f.preparation.data.snapshot.intent.contextBundleRef;
 const before=await f.contexts.readStartSource(f.db,f.actor,f.pid,ref).then(()=>({}), (e:any)=>({error:e.message,status:e.statusCode}));
 assert.deepEqual(before,{error:'CONTEXT_SOURCE_UNAVAILABLE',status:412});
 assert.ok(f.trace.some((s:string)=>s.startsWith('SELECT r.*,c.operation')));
 assert.ok(f.trace.some((s:string)=>s.includes('FROM anvil.approval_consumptions ac')));
 let released=0;
 const provider=new RegisteredStartContextSource({pool:{async connect(){return {async query(){return {rows:[]};},release(){released++;}};}} as any,
  contexts:f.contexts});
 await assert.rejects(provider.contextBody({projectId:f.pid,executionId:randomUUID(),executionGeneration:1,commandId:randomUUID(),
  contextBundleRef:ref,sourceBytes:1,contentHash:'a'.repeat(64)},new AbortController().signal),/EXECUTION_GRANT_READ_DENIED/);
 assert.equal(released,1);
});

function recorder(rows: (sql: string, args: unknown[]) => unknown[] = () => [{id:'p',archived_at:null,participation:'OWNER'}]) {
 const calls: {sql:string;args:unknown[]}[] = [];
 return {calls,db:{query:async(sql:string,args:unknown[]=[])=>{calls.push({sql,args});const r=rows(sql,args);return {rows:r,rowCount:r.length};}} as any};
}
const actor = {actorId:randomUUID(),clientId:randomUUID(),serverOwner:false,credentialGeneration:1,reauthUntil:null};
async function withGrant(run:(db:any,grant:any,p:any,h:any)=>Promise<void>) {
 const h=await journey(),p=contextSourceFixture(h.f);
 // 관측 hook은 원 core를 그대로 호출한다. ProjectContexts/resolveRegistered 구현은 대체하지 않는다.
 const reader=(h.f.contexts.sources as any).readers.confirmations,original=reader.readCore;
 let observed=false;
 reader.readCore=async function(db:any,grant:any,...args:any[]) {
  if(!observed){observed=true;await run(db,grant,p,h);}
  return original.call(this,db,grant,...args);
 };
 const source=new RegisteredStartContextSource({pool:p.pool as any,contexts:h.f.contexts});
 try {await source.contextBody(p.scope,new AbortController().signal);assert.equal(observed,true);}
 finally {delete reader.readCore;await h.app.close();}
}

test('실행 grant 표식은 검증된 공급자 원 객체만 인정하고 위조·복사본·외부 mint를 거절한다',async()=>{
 assert.equal('mintExecutionGrantRead' in accessModule,false);
 await withGrant(async(db,grant,p)=>{
  assert.equal(isExecutionGrantRead(grant),true);assert.ok(Object.isFrozen(grant));
  for(const fake of [{kind:'EXECUTION_GRANT',...p.scope},structuredClone(grant),{...grant},null,undefined,{}]) {
   assert.equal(isExecutionGrantRead(fake),false);const n=p.calls.length;
   await assert.rejects(assertReadAccess(db,fake as any,p.scope.projectId),(e:any)=>e.message==='EXECUTION_GRANT_READ_DENIED'&&e.statusCode===403);
   assert.equal(p.calls.length,n);
  }
 });
});

test('HUMAN 판별자는 기존 projectMember와 같은 SQL·인자를 그대로 낸다(잠금 유무 포함)',async()=>{
 const pid=randomUUID();
 for(const lock of [false,true]) {
  const a=recorder(),b=recorder();
  await assertReadAccess(a.db,{kind:'HUMAN',actor},pid,lock);await projectMember(b.db,actor,pid,lock);
  assert.deepEqual(a.calls,b.calls);assert.equal(a.calls.length,1);
 }
 await assert.rejects(assertReadAccess(recorder(()=>[]).db,{kind:'HUMAN',actor},pid),(e:any)=>e.message==='NOT_FOUND'&&e.statusCode===404);
});

test('GRANT는 회원 SQL 없이 같은 DB·project·등록묶음에만 유효하고 거래후 재사용을 거절한다',async()=>{
 let saved:any;
 await withGrant(async(db,grant,p,h)=>{
  saved={db,grant,p};const n=p.calls.length;
  await assertReadAccess(db,grant,p.scope.projectId,true);assert.equal(p.calls.length,n);
  await assert.rejects(assertReadAccess(db,grant,randomUUID()),/EXECUTION_GRANT_READ_DENIED/);
  await assert.rejects(assertReadAccess(recorder().db,grant,p.scope.projectId),/EXECUTION_GRANT_READ_DENIED/);
  await assert.rejects(assertReadAccess(null as any,grant,p.scope.projectId),/EXECUTION_GRANT_READ_DENIED/);
  await assert.rejects(assertReadAccess(db,grant,''),/EXECUTION_GRANT_READ_DENIED/);
  await assert.rejects(h.f.contexts.readRegisteredStartSource(db,grant,p.scope.projectId,{...p.scope.contextBundleRef,id:randomUUID()}),/EXECUTION_GRANT_READ_DENIED/);
  assert.equal(p.calls.length,n);
 });
 assert.equal(isExecutionGrantRead(saved.grant),false);
 const n=saved.p.calls.length;
 await assert.rejects(assertReadAccess(saved.db,saved.grant,saved.p.scope.projectId),/EXECUTION_GRANT_READ_DENIED/);
 await assert.rejects(saved.db.query('SELECT 1'),/EXECUTION_GRANT_READ_DENIED/);
 assert.equal(saved.p.calls.length,n);
});

test('실제 등록 provider는 하위 grantCore 부재에 도달해 412로 거절한다',async()=>{
 const h=await journey(),p=contextSourceFixture(h.f);
 const reader=(h.f.contexts.sources as any).readers.confirmations;
 const previous=Object.getOwnPropertyDescriptor(reader,'readCore');
 let reached=0;
 Object.defineProperty(reader,'readCore',{configurable:true,get(){reached++;return undefined;}});
 try {
  const provider=new RegisteredStartContextSource({pool:p.pool as any,contexts:h.f.contexts});
  await assert.rejects(provider.contextBody(p.scope,new AbortController().signal),
   (e:any)=>e.message==='CONTEXT_SOURCE_READER_NOT_CONNECTED'&&e.statusCode===412);
  assert.equal(reached,1);
  assert.ok(p.calls.some((s:string)=>s.startsWith('SELECT g.id AS grant_id')));
  assert.ok(p.calls.some((s:string)=>s.includes('FROM anvil.context_bundles')));
  assert.equal(p.calls.at(-1),'ROLLBACK');assert.equal(p.releases.length,1);
 } finally {
  if(previous)Object.defineProperty(reader,'readCore',previous);else delete reader.readCore;
  await h.app.close();
 }
});

test('보관 여부 확인은 잠금 없는 단일 SELECT이며 보관·부재 프로젝트를 거절한다',async()=>{
 const pid=randomUUID(),live=recorder(()=>[{archived_at:null}]);await projectNotArchived(live.db,pid);
 assert.deepEqual(live.calls,[{sql:'SELECT archived_at FROM anvil.projects WHERE id=$1',args:[pid]}]);
 await assert.rejects(projectNotArchived(recorder(()=>[{archived_at:new Date()}]).db,pid),(e:any)=>e.message==='PROJECT_ARCHIVED'&&e.statusCode===412);
 await assert.rejects(projectNotArchived(recorder(()=>[]).db,pid),(e:any)=>e.message==='NOT_FOUND'&&e.statusCode===404);
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


test('승인 grant core는 buildTaskContext 외 이력을 actor 의존 분기 전에 거절한다',async()=>{
 await withGrant(async(db,grant,p)=>{
  const pid=p.scope.projectId,approvals=new ProjectApprovals();
  for(const [operation,extra] of [['queueExecutionCommand',{}],['saveEnvironment',{}],['buildTaskContext',{candidateKind:'ENVIRONMENT_DEFINITION'}],['buildTaskContext',{originReuseEvidence:{}}]] as const) {
   const {id,row}=approvalRow(pid,operation,extra),n=p.calls.length;
   p.setQueryOverride((sql:string)=>sql.startsWith('SELECT r.*,c.operation')?{rows:[row]}:undefined);
   await assert.rejects(approvals.readContextConsumptionForGrant(db,grant,pid,id),(e:any)=>e.message==='EXECUTION_GRANT_READ_DENIED'&&e.statusCode===403,operation);
   assert.equal(p.calls.length,n+1);
  }
  const {id,row}=approvalRow(pid,'buildTaskContext');
  const n=p.calls.length;
  await assert.rejects(approvals.readContextConsumptionForGrant(db,{...grant},pid,id),/EXECUTION_GRANT_READ_DENIED/);
  await assert.rejects(approvals.readContextConsumptionForGrant(db,grant,randomUUID(),id),/EXECUTION_GRANT_READ_DENIED/);
  assert.equal(p.calls.length,n);
  p.setQueryOverride((sql:string)=>sql.startsWith('SELECT r.*,c.operation')?{rows:[row]}:/anvil.approval_decisions|anvil.approval_consumptions/.test(sql)?{rows:[]}:undefined);
  const read=await approvals.readContextConsumptionForGrant(db,grant,pid,id);
  assert.equal(read.storedStatus,'PENDING');assert.equal(read.consumption,null);
  p.setQueryOverride(undefined);
 });
});

test('grant 결박 readRegisteredStartSource는 HUMAN과 같은 재조립 결과이며 회원·잠금·쓰기가 없다',async()=>{
 await withGrant(async(db,grant,p,h)=>{
  const human=await h.f.contexts.readStartSource(h.f.db,h.f.actor,h.f.pid,p.scope.contextBundleRef);
  assert.ok(h.f.trace.some((s:string)=>s.includes('FOR UPDATE OF p,m')));
  assert.ok(h.f.trace.includes('SELECT head_version FROM anvil.assignment_drafts WHERE project_id=$1 AND id=$2 FOR UPDATE'));
  assert.ok(h.f.trace.some((s:string)=>s.includes('FROM anvil.documents WHERE project_id=$1 AND id=$2 FOR SHARE')));
  const actual=await h.f.contexts.readRegisteredStartSource(db,grant,h.f.pid,p.scope.contextBundleRef);
  assert.deepEqual(actual,human);assert.ok(human.manifest.items.length>3);
  assert.deepEqual(p.calls.filter((s:string)=>/FOR UPDATE|FOR SHARE|project_members|^\s*(INSERT|UPDATE|DELETE)\b/.test(s)),[]);
  assert.ok(p.calls.includes('SELECT head_version FROM anvil.assignment_drafts WHERE project_id=$1 AND id=$2'));
  assert.ok(p.calls.includes('SELECT head_version,confirmed_version FROM anvil.documents WHERE project_id=$1 AND id=$2'));
 });
});
