import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {newLimitBuffer,freezeLimitCommand,limitCommand,sendLimitCommand,limitPolicyAccess,matchesLimitBuffer,updateLimitApprovalBuffer} from '../../../apps/web/src/features/connections/limit-policy-api.ts';
import {newLimitPolicyApproval,prepareLimitPolicyApproval,bindLimitPolicyApproval,readLimitPolicyApprovalTermination,closeLimitPolicyApproval} from '../../../apps/web/src/features/connections/limit-policy-approval.ts';
const pid='10000000-0000-4000-8000-000000000001',uid='20000000-0000-4000-8000-000000000002',rid='30000000-0000-4000-8000-000000000003',did='40000000-0000-4000-8000-000000000004';
const session:any={user:{id:uid},clientId:uid,csrfToken:'C'.repeat(43)},hash=(v:unknown)=>contentHash(canonicalJson(v)),at='2026-10-27T00:00:00.000Z';
const json=(v:any)=>new Response(JSON.stringify(v),{headers:{'content-type':'application/json'}});
async function fixture(mode='NEW'){
 let b=newLimitBuffer(pid,session,1);b.draft.reason='정확 한도 원명령';
 if(mode!=='NEW'){
  const snapshot:any={limits:b.draft.limits,scope:{kind:'PROJECT',projectId:pid},reason:'기준',policyBaseVersion:0,state:'APPLIED',previousRef:null,decidedBy:{kind:'HUMAN',userId:uid},decidedAt:at,expiresAt:'2026-10-27T02:00:00.000Z',executionAuthorized:false,dispatchPerformed:false};
  b=newLimitBuffer(pid,session,1,{projectId:pid,ref:{id:uid,version:1,contentHash:hash(snapshot)},snapshot});b.draft.reason='정확 한도 원명령';
 }
 await freezeLimitCommand(b,session,mode==='REVOKE'?'revokeLimitPolicy':'applyLimitPolicy');b.failure={code:'APPROVAL_REQUIRED',status:412};return b;
}
async function approved(mode='NEW'){
 const b=await fixture(mode),w=await newLimitPolicyApproval(b,session);
 w.details={reason:'원명령',risks:{data:'자료',security:'보안',cost:'미확인',interruption:'없음',unverified:'실제 실행 제외'},rollback:{method:'후속 개정',limitations:'과금 취소 아님',evidenceRefs:[]},expiresAt:'2098-01-01T00:00:00.000Z'};
 const policy={rules:[{ruleId:'LIMIT',subjectRef:{kind:'HUMAN',userId:uid},operations:['applyLimitPolicy','revokeLimitPolicy'],targetScopes:[{kind:'PROJECT',projectId:pid}],disposition:'REQUIRE_APPROVAL',limitPolicyRef:null,expiresAt:'2099-01-01T00:00:00.000Z'}],reason:'한도 승인',reviewRefs:[]},policyRef={id:uid,version:1,contentHash:hash(policy)};
 let view:any=null,posts=0,generation=1,reads=0,revise=false;
 const client=new ApiClient(async(u,i)=>{if(i?.method==='POST'){posts++;throw Error('UNEXPECTED_POST');}const url=String(u);if(url.endsWith('permission-policy'))return json({configured:true,policy:{ref:{...policyRef,version:revise?2:1},...policy,createdAt:at}});if(url.endsWith('approvals/'+rid)){reads++;return json(view);}return json({id:pid,participation:'OWNER',controlState:{actorId:uid,clientId:uid,generation,status:'HELD'}});});
 const command=await prepareLimitPolicyApproval(client,w,b,session,()=>true),details=command.payload.details,scopeDigest=hash(details.actionScope),snapshot={projectId:pid,details,scopeDigest,requiredDecider:{kind:'HUMAN',userId:uid},policyRef,requestedBy:{kind:'HUMAN',userId:uid,clientId:uid},controlGeneration:1},requestRef={id:rid,version:1,contentHash:hash(snapshot)},request={id:rid,version:1,status:'PENDING',...snapshot,createdAt:at};
 const decisionBody={requestId:rid,requestVersion:1,requestRef,scopeDigest,decision:'APPROVE',reason:'정확 범위 승인',decidedBy:request.requestedBy,controlGeneration:1,policyRef};
 view={request,requestRef,currentVersion:2,storedStatus:'APPROVED',effectiveState:'APPROVED',decision:{id:did,ref:{id:did,version:1,contentHash:hash(decisionBody)},...decisionBody,decidedAt:at},consumption:null,expired:false,basisCurrent:true,executionAuthorized:false,observedAt:at};
 b.limitApproval={request:{...w,resultId:rid},requestId:rid,commandHash:null};
 return{b,w,client,view,command,posts:()=>posts,reads:()=>reads,setGeneration:(v:number)=>generation=v,revise:()=>revise=true};
}
test('명확한 서버412후에만 요청을 준비하며 UNKNOWN 후412·원명령 변경·후보없음을 거절한다',async()=>{
 const b=await fixture(),before=structuredClone(b),w=await newLimitPolicyApproval(b,session);assert.deepEqual(w.candidate,b.pending);assert.deepEqual(b,before);
 for(const change of [(x:any)=>x.uncertain=true,(x:any)=>x.failure={code:'CONNECTION_LOST',status:0},(x:any)=>x.failure.status=500,(x:any)=>x.pending=null,(x:any)=>x.draft.reason='변경']){const x=await fixture();change(x);await assert.rejects(newLimitPolicyApproval(x,session));}
});
for(const mode of ['NEW','REVISE','REVOKE'])test(mode+' 별도승인을 정확 fullref와 원명령에 명시 결박하며 저장POST는 하지 않는다',async()=>{
 const f=await approved(mode),before=structuredClone(f.b),next=await bindLimitPolicyApproval(f.client,f.b,rid,session,()=>true),command=await limitCommand(next,session);
 assert.deepEqual(f.command.payload.details.actionScope.targetRef,before.base?.ref??null);assert.equal(f.command.payload.details.actionScope.limitsRef,null);
 assert.equal(command.commandId,before.pending!.commandId);assert.deepEqual(command.payload,before.pending!.payload);assert.notEqual(command.approvalRef,null);assert.equal(next.pendingHash,hash(command));assert.equal(f.posts(),0);assert.deepEqual(f.b,before);
 const forged=structuredClone(next);forged.pending!.approvalRef=null;forged.pendingHash=hash(forged.pending);await assert.rejects(limitCommand(forged,session));
});
test('다른 기준hash/operation/command/payload·현재정책·다른control은 결박을 거절하고 원문을 보존한다',async()=>{
 for(const change of [(v:any)=>v.request.details.actionScope.operation='revokeLimitPolicy',(v:any)=>v.request.details.candidateCommandId=did,(v:any)=>v.request.details.actionScope.payloadHash='0'.repeat(64)]){const f=await approved();change(f.view);await assert.rejects(bindLimitPolicyApproval(f.client,f.b,rid,session,()=>true));assert.ok(f.b.pending);assert.equal(f.posts(),0);}
 const f=await approved('REVISE');f.b.base!.ref.contentHash='0'.repeat(64);await assert.rejects(bindLimitPolicyApproval(f.client,f.b,rid,session,()=>true));
 const policy=await approved();policy.revise();await assert.rejects(bindLimitPolicyApproval(policy.client,policy.b,rid,session,()=>true));
 const control=await approved();control.setGeneration(2);await assert.rejects(bindLimitPolicyApproval(control.client,control.b,rid,session,()=>true));
});
test('권한 조회는 승인 필요 사실만 반환하고 원명령 전송이나 승인으로 위장하지 않는다',async()=>{const f=await approved();const access=await limitPolicyAccess(f.client,f.b,session,'applyLimitPolicy');assert.equal(access.approvalRequired,true);assert.equal(f.posts(),0);});
for(const state of ['REJECTED','CHANGE_REQUESTED','EXPIRED','REVOKED'])test(state+' 무소비 종결은 보호GET재검사 후 입력·원명령·이력을 보존한다',async()=>{
 const f=await approved();
 if(state==='REJECTED'||state==='CHANGE_REQUESTED'){f.view.decision.decision=state==='REJECTED'?'REJECT':'REQUEST_CHANGE';const {ref,id,decidedAt,...body}=f.view.decision;f.view.decision.ref.contentHash=hash(body);f.view.storedStatus=state;}else if(state==='EXPIRED'){f.view.expired=true;}else{f.revise();f.view.basisCurrent=false;}
 f.view.effectiveState=state;const before=structuredClone(f.b),proof=await readLimitPolicyApprovalTermination(f.client,f.b,session,()=>true),next=await closeLimitPolicyApproval(f.client,f.b,proof,session,()=>true);
 assert.equal(next.pending,null);assert.equal(next.pendingHash,null);assert.deepEqual(next.draft,before.draft);assert.deepEqual(next.closedLimitApprovals![0]!.command,before.pending);assert.equal(f.reads(),2);assert.equal(f.posts(),0);
});
test('현재승인/미확인명령/소비이력/다른제어/이탈은 종결하거나 늦은결과로 잠금을 풀지 않는다',async()=>{
 const approvedState=await approved();await assert.rejects(readLimitPolicyApprovalTermination(approvedState.client,approvedState.b,session,()=>true));
 const unknown=await approved();unknown.b.uncertain=true;await assert.rejects(readLimitPolicyApprovalTermination(unknown.client,unknown.b,session,()=>true));
 const paused=await approved();await assert.rejects(bindLimitPolicyApproval(paused.client,paused.b,rid,session,()=>false),{code:'LIMIT_POLICY_APPROVAL_PAUSED'});assert.equal(paused.reads(),0);
 const control=await approved();control.setGeneration(2);await assert.rejects(readLimitPolicyApprovalTermination(control.client,control.b,session,()=>true));
});
test('승인 결박 뒤 응답유실은 같은 전체 원명령을 그대로 재전송한다',async()=>{
 const f=await approved(),b=await bindLimitPolicyApproval(f.client,f.b,rid,session,()=>true),calls:string[]=[];
 const client=new ApiClient(async(_u,i)=>{calls.push(String(i?.body));throw Error('lost');});await assert.rejects(sendLimitCommand(client,b,session),{code:'CONNECTION_LOST'});await assert.rejects(sendLimitCommand(client,b,session),{code:'CONNECTION_LOST'});assert.equal(calls[0],calls[1]);assert.ok(JSON.parse(calls[0]!).approvalRef);assert.equal(b.pendingHash,hash(b.pending));
});

test('Editor 연속 pending→uncertain→saved는 같은 원명령에서 통과하며 저장용 전체 CAS와 다른 요청 보호는 유지한다',async()=>{
 const f=await approved(),original=structuredClone(f.b),initial=original.limitApproval!.request!;
 let state=structuredClone(original);const pending={...initial,resultId:null,pending:f.command},uncertain={...pending,uncertain:true},saved={...uncertain,pending:null,resultId:rid,uncertain:false};
 const replace=(before:any,next:any)=>{state=updateLimitApprovalBuffer(state,original,b=>hash(b.limitApproval!.request)===hash(before)?{...b,limitApproval:{...b.limitApproval!,request:next}}:b)!;};
 replace(initial,pending);assert.deepEqual(state.limitApproval!.request,pending);assert.equal(matchesLimitBuffer(state,original),false,'저장/늦은결과의 전체 request CAS는 여전히 거절한다');
 replace(pending,uncertain);assert.deepEqual(state.limitApproval!.request,uncertain);replace(uncertain,saved);assert.deepEqual(state.limitApproval!.request,saved);
 const before=state;replace(pending,{...pending,failure:{code:'LATE',status:0}});assert.equal(state,before,'이전 request 단계의 늦은 응답은 정확 reducer CAS로 거절한다');
 for(const mutate of [(b:any)=>b.bufferId=did,(b:any)=>b.ownerUserId=did,(b:any)=>b.ownerClientId=did,(b:any)=>b.projectId=did,(b:any)=>b.controlGeneration++,(b:any)=>b.pendingHash='0'.repeat(64),(b:any)=>b.pending.commandId=did,(b:any)=>b.draft.reason='다른 원입력',(b:any)=>b.base={ref:{}},(b:any)=>b.uncertain=true]){
  const changed=structuredClone(state);mutate(changed);let calls=0;assert.equal(updateLimitApprovalBuffer(changed,original,b=>{calls++;return b;}),changed);assert.equal(calls,0);
 }
});
