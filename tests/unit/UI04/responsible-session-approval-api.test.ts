import test from 'node:test';

import assert from 'node:assert/strict';

import {newResponsibleSessionBuffer} from '../../../apps/web/src/features/workspace/responsible-session-api.ts';

import {ApiClient} from '../../../apps/web/src/api/client.ts';

const subject:any=await import('../../../apps/web/src/features/workspace/responsible-session-approval.ts').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});

const pid='10000000-0000-4000-8000-000000000001',uid='20000000-0000-4000-8000-000000000002';

const session:any={user:{id:uid},clientId:uid,csrfToken:'C'.repeat(43)};

function fixture(){const b=newResponsibleSessionBuffer({projectId:pid,ref:{id:uid,version:1,contentHash:'a'.repeat(64)},snapshot:{contentConfirmed:true,executionAuthorized:false,dispatchPerformed:false}}as any,session,1);b.reason='총괄 역할';b.dirty=true;b.pending={schemaVersion:1,projectId:pid,commandId:crypto.randomUUID(),clientId:uid,controlGeneration:1,operation:'defineProjectRole',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:{kind:'COORDINATOR',stageRef:null,parentRoleRef:null,reason:b.reason}};b.failure={code:'APPROVAL_REQUIRED',status:412};return b;}

test('명확412 원 총괄 명령만 요청 준비하며 입력/명령을 변경하지 않는다',async()=>{assert.equal(typeof subject.newResponsibleSessionApproval,'function');const b=fixture(),before=structuredClone(b),w=await subject.newResponsibleSessionApproval(b,session);assert.deepEqual(w.candidate,b.pending);assert.deepEqual(b,before);assert.equal(w.pending,null);assert.equal(w.resultId,null);});

test('UNKNOWN 후412·다른주체·다른원입력·실행연산은 요청으로 우회하지 않는다',async()=>{assert.equal(typeof subject.newResponsibleSessionApproval,'function');for(const change of [(b:any)=>b.uncertain=true,(b:any)=>b.ownerClientId=pid,(b:any)=>b.reason='다른이유',(b:any)=>b.pending.operation='prepareExecution',(b:any)=>b.failure.status=500]){const b=fixture();change(b);const before=structuredClone(b);await assert.rejects(subject.newResponsibleSessionApproval(b,session));assert.deepEqual(b,before);}});

test('current callback false는 정책/보호GET/POST를 호출하지 않는다',async()=>{assert.equal(typeof subject.newResponsibleSessionApproval,'function');const b=fixture(),w=await subject.newResponsibleSessionApproval(b,session);let calls=0;const client=new ApiClient((async()=>{calls++;throw Error('UNEXPECTED_TRANSPORT');})as typeof fetch);await assert.rejects(subject.prepareResponsibleSessionApproval(client,w,b,session,()=>false));await assert.rejects(subject.bindResponsibleSessionApproval(client,b,pid,session,()=>false));assert.equal(calls,0);});


import {newResponsibleSessionApproval,prepareResponsibleSessionApproval,bindResponsibleSessionApproval,checkResponsibleSessionApprovalBinding,readResponsibleSessionApprovalTermination,closeResponsibleSessionApproval,responsibleSessionCommand} from '../../../apps/web/src/features/workspace/responsible-session-approval.ts';
import {sendResponsibleSessionAction,updateResponsibleSessionApprovalBuffer} from '../../../apps/web/src/features/workspace/responsible-session-api.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
const hash=(v:unknown)=>contentHash(canonicalJson(v)),at='2026-10-27T00:00:00.000Z';
async function approvedFixture(){
 const b=fixture();const original=structuredClone(b.pending),w=await newResponsibleSessionApproval(b,session);w.details={reason:'원명령',risks:{data:'자료',security:'보안',cost:'비용',interruption:'중단',unverified:'미확인'},rollback:{method:'보존',limitations:'별도',evidenceRefs:[]},expiresAt:'2098-01-01T00:00:00.000Z'};
 const policyBody={rules:[{ruleId:'CONTEXT',subjectRef:{kind:'HUMAN',userId:uid},operations:['defineProjectRole'],targetScopes:[{kind:'PROJECT',projectId:pid}],disposition:'REQUIRE_APPROVAL',limitPolicyRef:null,expiresAt:'2099-01-01T00:00:00.000Z'}],reason:'원명령',reviewRefs:[]},policyRef={id:uid,version:1,contentHash:hash(policyBody)};let view:any=null,posts=0,generation=1,deny=false,approvalReads=0,policyVersion=1;
 const client=new ApiClient((async(url,init)=>{
  if(init?.method==='POST'){posts++;const c=JSON.parse(String(init.body));assert.deepEqual(c, {...original,approvalRef:{requestId:pid,decisionId:uid,scopeDigest:view.request.scopeDigest}});const snapshot={...c.payload,definedBy:{kind:'HUMAN',userId:uid},definedAt:at},ref={id:uid,version:1,contentHash:hash(snapshot)};return Response.json({commandId:c.commandId,projectId:pid,status:'APPLIED',operationId:uid,targetId:uid,version:1,serverReceivedAt:at,data:{ref,status:'PROJECT_ROLE_DEFINED',snapshot}});}
  if(String(url).endsWith('/permission-policy')){const current=policyVersion===1?policyBody:{...policyBody,rules:[...policyBody.rules,{...policyBody.rules[0]!,ruleId:'OTHER',operations:['saveKnowledge'],disposition:'AUTO'}]};return Response.json({configured:true,policy:{ref:{id:policyRef.id,version:policyVersion,contentHash:hash(current)},...current,createdAt:at}});}
  if(String(url).includes('/approvals/')){approvalReads++;return deny?Response.json({code:'PROJECT_WRITE_DENIED'},{status:403}):Response.json(view);}
  return Response.json({id:pid,participation:'OWNER',controlState:{status:'HELD',actorId:uid,clientId:uid,generation}});
 }) as typeof fetch);
 const requestCommand=await prepareResponsibleSessionApproval(client,w,b,session,()=>true),details=requestCommand.payload.details,scopeDigest=hash(details.actionScope),body={projectId:pid,details,scopeDigest,requiredDecider:{kind:'HUMAN',userId:uid},policyRef,requestedBy:{kind:'HUMAN',userId:uid,clientId:uid},controlGeneration:1},requestRef={id:pid,version:1,contentHash:hash(body)},request={id:pid,version:1,status:'PENDING',...body,createdAt:at},decisionBody={requestId:pid,requestVersion:1,requestRef,scopeDigest,decision:'APPROVE',reason:'직접 확인',decidedBy:{kind:'HUMAN',userId:uid,clientId:uid},controlGeneration:1,policyRef},decisionRef={id:uid,version:1,contentHash:hash(decisionBody)};
 view={request,requestRef,currentVersion:2,storedStatus:'APPROVED',effectiveState:'APPROVED',decision:{ref:decisionRef,id:uid,...decisionBody,decidedAt:at},consumption:null,expired:false,basisCurrent:true,executionAuthorized:false,observedAt:at};
 return{b,original,w,client,requestCommand,get view(){return view;},posts:()=>posts,approvalReads:()=>approvalReads,revisePolicy:()=>policyVersion++,setGeneration:(n:number)=>generation=n,deny:()=>deny=true};
}
test('정상 요청/결박은 저장0·원 payload/hash를 보존하고 같은 원명령으로만 별도 저장한다',async()=>{const f=await approvedFixture();assert.equal(f.posts(),0);assert.equal(f.requestCommand.payload.details.actionScope.targetRef,null);assert.equal(f.requestCommand.payload.details.actionScope.expectedVersion,0);assert.equal(f.requestCommand.payload.details.actionScope.payloadHash,hash(f.original!.payload));const b=await bindResponsibleSessionApproval(f.client,f.b,pid,session,()=>true);assert.equal(f.posts(),0);assert.equal(b.pending!.commandId,f.original!.commandId);assert.deepEqual(b.pending!.payload,f.original!.payload);await checkResponsibleSessionApprovalBinding(b,session);const command=responsibleSessionCommand(b,session);await sendResponsibleSessionAction(f.client,command,session);assert.equal(f.posts(),1);assert.deepEqual(responsibleSessionCommand(b,session),command);});
test('보호GET 거절·현재제어 변경·소비/기한/다른후보는 결박과 저장0으로 차단한다',async()=>{const denied=await approvedFixture();denied.deny();await assert.rejects(bindResponsibleSessionApproval(denied.client,denied.b,pid,session,()=>true),{code:'PROJECT_WRITE_DENIED',status:403});assert.equal(denied.posts(),0);const changed=await approvedFixture();changed.setGeneration(2);await assert.rejects(bindResponsibleSessionApproval(changed.client,changed.b,pid,session,()=>true),{code:'CONTROL_GENERATION_CONFLICT'});for(const change of [(v:any)=>v.basisCurrent=false,(v:any)=>{v.expired=true;v.effectiveState='EXPIRED';},(v:any)=>v.request.details.candidateCommandId=uid]){const f=await approvedFixture();change(f.view);await assert.rejects(bindResponsibleSessionApproval(f.client,f.b,pid,session,()=>true));assert.equal(f.posts(),0);}});
test('결박 후 원명령/payload/approval 참조 변조는 명시 전송 전 digest검사에서 거절한다',async()=>{const f=await approvedFixture(),b=await bindResponsibleSessionApproval(f.client,f.b,pid,session,()=>true);for(const change of [(x:any)=>x.pending.commandId=pid,(x:any)=>x.pending.approvalRef.decisionId=pid,(x:any)=>x.responsibleApproval.commandHash='0'.repeat(64)]){const x=structuredClone(b);change(x);await assert.rejects(checkResponsibleSessionApprovalBinding(x,session));}assert.equal(f.posts(),0);});

async function terminalFixture(state:'REJECTED'|'CHANGE_REQUESTED'|'EXPIRED'='REJECTED'){
 const f=await approvedFixture(),v=f.view;
 if(state==='EXPIRED'){v.request.createdAt='2026-10-25T00:00:00.000Z';v.request.details.expiresAt='2026-10-26T00:00:00.000Z';v.expired=true;v.effectiveState='EXPIRED';}
 else{v.storedStatus=state;v.effectiveState=state;v.decision.decision=state==='REJECTED'?'REJECT':'REQUEST_CHANGE';}
 const {id,version,status,createdAt,...requestBody}=v.request;v.requestRef.contentHash=hash(requestBody);v.decision.requestRef=structuredClone(v.requestRef);
 const {ref,id:decisionId,decidedAt,...decisionBody}=v.decision;v.decision.ref.contentHash=hash(decisionBody);
 f.w.resultId=pid;f.b.responsibleApproval={request:structuredClone(f.w),requestId:pid,commandHash:null};return f;
}
for(const state of ['REJECTED','CHANGE_REQUESTED','EXPIRED'] as const)test(state+' 정확 보호종결 조회 뒤 명시종료는 원입력/원명령/요청·종결 이력을 보존하고 POST하지 않는다',async()=>{
 const f=await terminalFixture(state),before=structuredClone(f.b),proof=await readResponsibleSessionApprovalTermination(f.client,f.b,session,()=>true);assert.deepEqual(f.b,before);assert.equal(f.posts(),0);
 // 현재 관측 시각만 합법적으로 진행해도 고정 종결 이력을 바꾼 것은 아니다.
 f.view.observedAt='2026-10-27T00:00:01.000Z';const next=await closeResponsibleSessionApproval(f.client,f.b,proof,session,()=>true);
 assert.deepEqual(next.reason,before.reason);assert.equal(next.pending,null);assert.equal(next.responsibleApproval,undefined);assert.equal(next.uncertain,false);assert.equal(next.dirty,true);assert.equal(next.closedResponsibleApprovals!.length,1);assert.deepEqual(next.closedResponsibleApprovals![0]!.command,before.pending);assert.deepEqual(next.closedResponsibleApprovals![0]!.request,before.responsibleApproval!.request);assert.equal(next.closedResponsibleApprovals![0]!.view.effectiveState,state);assert.equal(f.posts(),0);assert.equal(f.approvalReads(),2);
});
test('PENDING/APPROVED/CONSUMED/UNKNOWN·다른주체·조회거절과종료직전scope변경은 현재 원명령을 해제하지 않는다',async()=>{
 const approved=await approvedFixture();approved.w.resultId=pid;approved.b.responsibleApproval={request:approved.w,requestId:pid,commandHash:null};await assert.rejects(readResponsibleSessionApprovalTermination(approved.client,approved.b,session,()=>true),{code:'RESPONSIBLE_SESSION_APPROVAL_NOT_TERMINAL'});
 for(const state of ['PENDING','CONSUMED'] as const){const f=await terminalFixture();f.view.storedStatus=state;f.view.effectiveState=state;if(state==='PENDING'){f.view.currentVersion=1;f.view.decision=null;}else{f.view.currentVersion=3;f.view.decision.decision='APPROVE';const {ref,id,decidedAt,...decisionBody}=f.view.decision;f.view.decision.ref.contentHash=hash(decisionBody);f.view.consumption={id:uid,status:'CONSUMED',commandId:f.b.pending!.commandId,serverCommandId:pid,requestHash:hash(f.b.pending),scopeDigest:f.view.request.scopeDigest,policyRef:f.view.request.policyRef,consumedAt:at};}await assert.rejects(readResponsibleSessionApprovalTermination(f.client,f.b,session,()=>true));assert.ok(f.b.pending);}
 for(const change of [(b:any)=>b.uncertain=true,(b:any)=>b.responsibleApproval.request.uncertain=true,(b:any)=>b.ownerClientId=pid,(b:any)=>b.reason='다른 입력']){const f=await terminalFixture();change(f.b);await assert.rejects(readResponsibleSessionApprovalTermination(f.client,f.b,session,()=>true));assert.ok(f.b.pending);}
 const denied=await terminalFixture();denied.deny();await assert.rejects(readResponsibleSessionApprovalTermination(denied.client,denied.b,session,()=>true),{code:'PROJECT_WRITE_DENIED',status:403});
 const changed=await terminalFixture(),proof=await readResponsibleSessionApprovalTermination(changed.client,changed.b,session,()=>true);changed.view.request.details.candidateCommandId=uid;await assert.rejects(closeResponsibleSessionApproval(changed.client,changed.b,proof,session,()=>true));assert.ok(changed.b.pending);assert.equal(changed.posts(),0);
 const paused=await terminalFixture();await assert.rejects(readResponsibleSessionApprovalTermination(paused.client,paused.b,session,()=>false),{code:'RESPONSIBLE_SESSION_APPROVAL_PAUSED'});assert.ok(paused.b.pending);
});
test('현재 control이 바뀐 REVOKED 이력은 위조로 단정하지 않지만 다른 제어세대에서 잠금을 풀지 않는다',async()=>{
 const f=await terminalFixture();f.view.storedStatus='APPROVED';f.view.decision.decision='APPROVE';const {ref,id,decidedAt,...body}=f.view.decision;f.view.decision.ref.contentHash=hash(body);f.view.basisCurrent=false;f.view.effectiveState='REVOKED';f.setGeneration(2);await assert.rejects(readResponsibleSessionApprovalTermination(f.client,f.b,session,()=>true),{code:'CONTROL_GENERATION_CONFLICT'});assert.ok(f.b.pending);assert.equal(f.posts(),0);
});

for(const state of ['REVOKED','REJECTED','CHANGE_REQUESTED'] as const)test(state+' 동일 소유·제어에서 다른 operation 정책 개정 뒤에도 무소비 종결을 명시 종료한다',async()=>{
 const f=await terminalFixture(state==='CHANGE_REQUESTED'?'CHANGE_REQUESTED':'REJECTED');f.revisePolicy();
 if(state==='REVOKED'){f.view.storedStatus='APPROVED';f.view.decision.decision='APPROVE';const {ref,id,decidedAt,...body}=f.view.decision;f.view.decision.ref.contentHash=hash(body);f.view.effectiveState='REVOKED';}
 f.view.basisCurrent=false;const before=structuredClone(f.b),proof=await readResponsibleSessionApprovalTermination(f.client,f.b,session,()=>true),next=await closeResponsibleSessionApproval(f.client,f.b,proof,session,()=>true);
 assert.deepEqual(next.reason,before.reason);assert.equal(next.pending,null);assert.equal(next.closedResponsibleApprovals![0]!.view.basisCurrent,false);assert.deepEqual(next.closedResponsibleApprovals![0]!.command,before.pending);assert.equal(f.posts(),0);assert.equal(f.approvalReads(),2);
 // 종료 허용은 원 승인 결박/실행 허용이 아니다.
 await assert.rejects(bindResponsibleSessionApproval(f.client,before,pid,session,()=>true));assert.equal(f.posts(),0);
});

test('Editor 순차 pending→uncertain→saved reducer는 안정 원명령 경계와 각 before 상태로 보존된다',async()=>{
 const original=fixture(),request=await newResponsibleSessionApproval(original,session);original.responsibleApproval={request,requestId:'',commandHash:null};let current=structuredClone(original);
 const replace=(before:any,next:any)=>{current=updateResponsibleSessionApprovalBuffer(current,original,b=>JSON.stringify(b.responsibleApproval?.request)===JSON.stringify(before)?{...b,responsibleApproval:{...b.responsibleApproval!,request:next}}:b)!;};
 const pending={...request,pending:{operation:'requestApproval'}};replace(request,pending);const unknown={...pending,uncertain:true};replace(pending,unknown);const saved={...unknown,pending:null,uncertain:false,resultId:pid};replace(unknown,saved);assert.equal(current.responsibleApproval!.request!.resultId,pid);
 const changed=structuredClone(current);changed.reason='다른 입력';assert.strictEqual(updateResponsibleSessionApprovalBuffer(changed,original,()=>original),changed);const newer=structuredClone(current);newer.pending!.commandId=crypto.randomUUID();assert.strictEqual(updateResponsibleSessionApprovalBuffer(newer,original,()=>original),newer);
});

import {ordered} from '../../../apps/web/src/features/knowledge/review-view.ts';
test('종결 결과의 선택 속성은 ownkey 없이 제거되어 원명령 CAS 직렬화와 다음 명령 준비를 보존한다',async()=>{
 const f=await terminalFixture(),proof=await readResponsibleSessionApprovalTermination(f.client,f.b,session,()=>true),next=await closeResponsibleSessionApproval(f.client,f.b,proof,session,()=>true);
 assert.doesNotThrow(()=>ordered(next));assert.equal(Object.hasOwn(next,'responsibleApproval'),false);const following={...next,pending:structuredClone(f.original!),failure:{code:'APPROVAL_REQUIRED',status:412}};assert.doesNotThrow(()=>ordered(following));const request=await newResponsibleSessionApproval(following,session);assert.deepEqual(request.candidate,f.original);assert.equal(next.closedResponsibleApprovals!.length,1);
});

import {markResponsibleSessionDispatch,settleResponsibleSessionWrite} from '../../../apps/web/src/features/workspace/responsible-session-approval.ts';
test('전송·영수증 저장 상태의 전체 CAS는 선택 ownkey 없이 직렬화되고 다음 원명령을 보존한다',async()=>{
 const b=fixture(),request=await newResponsibleSessionApproval(b,session),receipt={ref:{id:uid,version:1,contentHash:'a'.repeat(64)},snapshot:{kind:'COORDINATOR'}};b.responsibleApproval={request,requestId:pid,commandHash:null};b.savedReceipt=receipt;
 let current=structuredClone(b);const apply=(before:any,next:any)=>{if(ordered(current)===ordered(before))current=next;};
 const sent=markResponsibleSessionDispatch(b,b.pending!);assert.equal(Object.hasOwn(sent,'savedReceipt'),false);assert.equal(sent.uncertain,true);assert.doesNotThrow(()=>apply(b,sent));assert.deepEqual(current.pending,b.pending);
 const saved=settleResponsibleSessionWrite(sent,receipt);assert.equal(Object.hasOwn(saved,'responsibleApproval'),false);assert.doesNotThrow(()=>apply(sent,saved));assert.deepEqual(current.savedReceipt,receipt);assert.equal(current.pending,null);
 const command={...b.pending!,commandId:crypto.randomUUID()},following=markResponsibleSessionDispatch(saved,command);assert.equal(Object.hasOwn(following,'savedReceipt'),false);assert.doesNotThrow(()=>ordered(following));assert.deepEqual(following.pending,command);assert.notEqual(following.pending!.commandId,b.pending!.commandId);assert.equal(Object.hasOwn(following,'responsibleApproval'),false);
});
