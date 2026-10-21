import test from 'node:test';import assert from 'node:assert/strict';
import { ApiClient } from '../../../apps/web/src/api/client.ts';
import { newWorkPlan, prepareWorkPlan, sendWorkPlan, blankPlanTask } from '../../../apps/web/src/features/design-trace/work-plan-api.ts';
import { canonicalJson, contentHash } from '../../../contracts/canonical.ts';
import {canReopenRejectedWorkPlan,reopenRejectedWorkPlan} from '../../../apps/web/src/features/design-trace/rejected-work-plan.ts';
const pid='11111111-1111-4111-8111-111111111111',uid='22222222-2222-4222-8222-222222222222',rid='33333333-3333-4333-8333-333333333333',did='44444444-4444-4444-8444-444444444444';
const session={user:{id:uid},clientId:uid,csrfToken:'C'.repeat(43)},ref={id:rid,version:1,contentHash:'a'.repeat(64)},hash=(v:unknown)=>contentHash(canonicalJson(v));
async function api(){const m=await import('../../../apps/web/src/features/decisions/work-plan-approval-api.ts').catch(()=>null);assert.ok(m,'작업계획 정확 입력의 승인 준비/결박 consumer가 필요하다');return m;}
function fixture(){
 const b:any={ownerUserId:uid,projectId:pid,documentId:rid,baseVersion:1,baseHash:ref.contentHash,controlGeneration:1,pending:null};
 b.workPlanState=newWorkPlan(b);b.workPlanState.input={documentRef:ref,designRef:ref,screenReviewRefs:[],tasks:[],reason:' 원 입력 '};b.workPlanState.pending=prepareWorkPlan(b,session);
 const expiresAt=new Date(Date.now()+120000).toISOString(),rules=[{ruleId:'SAVE',subjectRef:{kind:'HUMAN',userId:uid},operations:['saveWorkPlanDraft'],targetScopes:[{kind:'PROJECT',projectId:pid}],disposition:'REQUIRE_APPROVAL',limitPolicyRef:null,expiresAt}],policy={rules,reason:'일회',reviewRefs:[]},policyRef={id:uid,version:1,contentHash:hash(policy)};
 let view:any=null,posts=0,generation=1;
 const client=new ApiClient(async(path,options)=>{assert.notEqual(options?.method,'POST');if(options?.method==='POST')posts++;const p=String(path);if(p.endsWith('/permission-policy'))return Response.json({configured:true,policy:{ref:policyRef,...policy,createdAt:new Date().toISOString()}});if(p.includes('/approvals/'))return Response.json(view);return Response.json({id:pid,participation:'OWNER',controlState:{status:'HELD',actorId:uid,clientId:uid,generation}});});
 const approve=(request:any)=>{const details=request.payload.details,scopeDigest=hash(details.actionScope),body={projectId:pid,details,scopeDigest,requiredDecider:{kind:'HUMAN',userId:uid},policyRef,requestedBy:{kind:'HUMAN',userId:uid,clientId:uid},controlGeneration:1},requestRef={id:rid,version:1,contentHash:hash(body)},d={requestId:rid,requestVersion:1,requestRef,scopeDigest,decision:'APPROVE',reason:'확인',decidedBy:{kind:'HUMAN',userId:uid,clientId:uid},controlGeneration:1,policyRef},at=new Date().toISOString();
 view={request:{id:rid,version:1,status:'PENDING',...body,createdAt:at},requestRef,currentVersion:2,storedStatus:'APPROVED',effectiveState:'APPROVED',decision:{ref:{id:did,version:1,contentHash:hash(d)},id:did,...d,decidedAt:at},consumption:null,expired:false,basisCurrent:true,executionAuthorized:false,observedAt:at,candidatePlan:{candidateCommandId:details.candidateCommandId,payloadHash:details.actionScope.payloadHash,payload:structuredClone(request.payload.candidatePayload)}};return view;};
 return{b,client,approve,posts:()=>posts,stale:()=>{generation++;}};
}
function fill(w:any){w.details={reason:'이 초안 저장',risks:{data:'초안',security:'확인',cost:'없음',interruption:'없음',unverified:'실DB 제외'},rollback:{method:'과거 보존',limitations:'삭제 아님',evidenceRefs:[]},expiresAt:new Date(Date.now()+60000).toISOString()};return w;}
test('정확 신규/개정 명령은 요청 준비만으로 저장되지 않으며 raw payload와 전체 target을 보존한다',async()=>{
 const m=await api();for(const revision of [false,true]){const f=fixture();if(revision){f.b.workPlanState.planRef=ref;f.b.workPlanState.pending=null;f.b.workPlanState.pending=prepareWorkPlan(f.b,session);}const before=structuredClone(f.b),w=fill(m.newWorkPlanApprovalRequest(f.b,session)),c=await m.prepareWorkPlanApprovalRequest(f.client,w,f.b,session,()=>true);assert.deepEqual(f.b,before);assert.equal(f.posts(),0);assert.deepEqual(c.payload.candidatePayload,f.b.workPlanState.input);assert.equal(c.payload.details.actionScope.payloadHash,hash(f.b.workPlanState.input));assert.deepEqual(c.payload.details.actionScope.targetRef,revision?ref:null);assert.notEqual(c.commandId,w.candidate.commandId);}
});
test('별도 APPROVE의 원문을 재해시한 뒤 미전송 후보만 결박하고 유실/전송 명령은 바꾸지 않는다',async()=>{
 const m=await api(),f=fixture(),w=fill(m.newWorkPlanApprovalRequest(f.b,session)),c=await m.prepareWorkPlanApprovalRequest(f.client,w,f.b,session,()=>true),view=f.approve(c),before=structuredClone(f.b);
 const next=await m.bindWorkPlanApproval(f.client,f.b,rid,session,()=>true);assert.equal(f.posts(),0);assert.deepEqual(f.b,before);assert.equal(next.workPlanState!.pending!.commandId,w.candidate.commandId);assert.deepEqual(next.workPlanState!.pending!.payload,w.candidate.payload);assert.deepEqual(next.workPlanState!.pending!.approvalRef,{requestId:rid,decisionId:did,scopeDigest:view.request.scopeDigest});
 for(const change of [{sent:true},{uncertain:true}]){const b=structuredClone(f.b);Object.assign(b.workPlanState,change);assert.throws(()=>m.newWorkPlanApprovalRequest(b,session));await assert.rejects(m.bindWorkPlanApproval(f.client,b,rid,session,()=>true));}
 view.candidatePlan.payload.reason='변조';await assert.rejects(m.bindWorkPlanApproval(f.client,f.b,rid,session,()=>true));assert.deepEqual(f.b,before);
});
test('늦은 주체 전환·옛세대·거절은 결박하지 않고 입력과 후보를 보존한다',async()=>{
 const m=await api(),f=fixture(),w=fill(m.newWorkPlanApprovalRequest(f.b,session)),c=await m.prepareWorkPlanApprovalRequest(f.client,w,f.b,session,()=>true),v=f.approve(c),before=structuredClone(f.b);
 await assert.rejects(m.bindWorkPlanApproval(f.client,f.b,rid,session,()=>false));
 v.basisCurrent=false;v.effectiveState='REVOKED';await assert.rejects(m.bindWorkPlanApproval(f.client,f.b,rid,session,()=>true));f.approve(c);f.stale();await assert.rejects(m.bindWorkPlanApproval(f.client,f.b,rid,session,()=>true));assert.deepEqual(f.b,before);
});
test('결박한 exact 명령은 별도 저장 전송을 허용하지만 hash 변경은 POST0이다',async()=>{
 const m=await api(),f=fixture(),w=fill(m.newWorkPlanApprovalRequest(f.b,session)),c=await m.prepareWorkPlanApprovalRequest(f.client,w,f.b,session,()=>true);f.approve(c);
 const b=await m.bindWorkPlanApproval(f.client,f.b,rid,session,()=>true);let posts=0;
 const client=new ApiClient(async(_path,options)=>{assert.equal(options?.method,'POST');posts++;return Response.json({code:'PROJECT_OPERATION_DENIED'},{status:403});});
 await assert.rejects(sendWorkPlan(client,b,session,()=>true),{code:'PROJECT_OPERATION_DENIED'});assert.equal(posts,1);
 b.workPlanState!.pending!.approvalRef={requestId:rid,decisionId:uid,scopeDigest:'b'.repeat(64)};
 await assert.rejects(sendWorkPlan(client,b,session,()=>true));assert.equal(posts,1);
});
test('서버의 거절·수정요청을 읽은 뒤 원 입력과 과거승인을 남기고 새 후보만 준비한다',async()=>{
 const m=await api(),f=fixture(),w=fill(m.newWorkPlanApprovalRequest(f.b,session)),c=await m.prepareWorkPlanApprovalRequest(f.client,w,f.b,session,()=>true),v=f.approve(c);
 f.b.workPlanState.approval={request:{...w,resultId:rid},requestId:rid,commandHash:null};const before=structuredClone(f.b);
 await assert.rejects(m.reopenRejectedWorkPlanApproval(f.client,f.b,session,()=>true));
 const {ref:oldRef,id:oldId,decidedAt,...body}=v.decision;body.decision='REQUEST_CHANGE';v.decision={ref:{...oldRef,contentHash:hash(body)},id:oldId,decidedAt,...body};v.storedStatus='CHANGE_REQUESTED';v.effectiveState='CHANGE_REQUESTED';
 const next=await m.reopenRejectedWorkPlanApproval(f.client,f.b,session,()=>true);assert.deepEqual(f.b,before);assert.equal(next.workPlanState!.pending,null);assert.equal(next.workPlanState!.approval,undefined);assert.deepEqual(next.workPlanState!.input,before.workPlanState.input);assert.equal(next.workPlanState!.approvalHistory!.length,1);assert.notEqual(prepareWorkPlan(next,session).commandId,w.candidate.commandId);assert.equal(f.posts(),0);
});
test('결박 후 첫 저장이 명확히 만료 거절되면 승인 이력을 남겨 재편집하고 유실이면 막는다',async()=>{
 const m=await api(),f=fixture(),w=fill(m.newWorkPlanApprovalRequest(f.b,session)),c=await m.prepareWorkPlanApprovalRequest(f.client,w,f.b,session,()=>true);f.approve(c);
 const b=await m.bindWorkPlanApproval(f.client,f.b,rid,session,()=>true);Object.assign(b.workPlanState!,{sent:true,uncertain:false,failure:{code:'APPROVAL_NOT_USABLE',status:412}});
 assert.equal(canReopenRejectedWorkPlan(b,pid,session),true);const next=reopenRejectedWorkPlan(b,pid,session);assert.equal(next.workPlanState!.pending,null);assert.equal(next.workPlanState!.approval,undefined);assert.equal(next.workPlanState!.approvalHistory!.length,1);assert.deepEqual(next.workPlanState!.input,b.workPlanState!.input);assert.notEqual(prepareWorkPlan(next,session).commandId,b.workPlanState!.pending!.commandId);
 b.workPlanState!.uncertain=true;assert.equal(canReopenRejectedWorkPlan(b,pid,session),false);
});
test('요청 봉투가 2MiB를 넘으면 기준을 늘리거나 입력을 자르지 않고 요청 전 거절한다',async()=>{
 const m=await api(),f=fixture();f.b.workPlanState.pending=null;
 f.b.workPlanState.input.tasks=[{...blankPlanTask(),taskCode:'FN01',title:'보존',inputs:Array.from({length:100},()=> 'x'.repeat(20000))}];
 f.b.workPlanState.pending=prepareWorkPlan(f.b,session);const before=structuredClone(f.b),w=fill(m.newWorkPlanApprovalRequest(f.b,session));
 w.details.reason='r'.repeat(20000);for(const key of ['data','security','cost','interruption','unverified'])w.details.risks[key]='r'.repeat(20000);
 await assert.rejects(m.prepareWorkPlanApprovalRequest(f.client,w,f.b,session,()=>true),{code:'WORK_PLAN_INPUT_TOO_LARGE',status:413});assert.deepEqual(f.b,before);assert.equal(f.posts(),0);
});
