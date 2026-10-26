import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {ApiClient,ApiError} from '../../../apps/web/src/api/client.ts';
import {newBaselineApproval,prepareBaselineApproval,bindBaselineApproval,checkBaselineApprovalBinding} from '../../../apps/web/src/features/project-create/baseline-approval.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import * as baseline from '../../../apps/web/src/features/project-create/baseline-api.ts';
const session = { user: { id: randomUUID() }, clientId: randomUUID(), csrfToken: 'C'.repeat(43) };
const approval = { requestId: randomUUID(), decisionId: randomUUID(), scopeDigest: 'a'.repeat(64) };
function draft() {
 const b = baseline.newBaselineBuffer(randomUUID(), session, 1, null);
 b.input = { baseRef: null, source: { kind: 'NONE_SELECTED', declarationRef: null, sourceRootRef: null, snapshotRef: null, grantRef: null, unverifiedReason: '실소스 미확인' }, items: [{ itemId: 'FN01', title: '기준선', designRef: null, featureState: 'PARTIAL', evidenceRefs: [], limitations: '실제 미확인', reason: '후보' }], coverageReason: '범위 미확인', reason: '초안' };
 return b;
}
test('결박한 초안 원명령은 재준비와 수동 재확인에서 approvalRef를 유지한다', () => {
 const b = draft(), original = baseline.prepareBaselineCommand(b, session, 'saveBaselineDraft');
 b.pending = { ...original, approvalRef: approval };
 assert.deepEqual(baseline.recheckBaselineCommand(b, session), b.pending);
 assert.deepEqual(baseline.prepareBaselineCommand(b, session, 'saveBaselineDraft'), b.pending);
 assert.deepEqual(b.pending.payload, original.payload);
 assert.throws(() => baseline.recheckBaselineCommand({ ...b, input: { ...b.input, reason: '다른 이유' } }, session));
});
test('응답 유실 뒤412는 같은 원명령 불명 상태를 낮추지 않는다', () => {
 const b = draft(); b.pending = baseline.prepareBaselineCommand(b, session, 'saveBaselineDraft');
 const lost = baseline.baselineMutationFailed(b, false, new ApiError('CONNECTION_LOST'));
 // 실제 분류기는 ApiError code/status를 사용한다. 이 시험은 UNKNOWN의 단조성만 확인한다.
 const uncertain = { ...lost, uncertain: true };
 const next = baseline.baselineMutationFailed(uncertain, true, new ApiError('APPROVAL_REQUIRED',412));
 assert.equal(next.uncertain, true); assert.deepEqual(next.pending, b.pending);
});

test('명확 승인필요만 후보로 준비하고 주체·UNKNOWN·원입력 변경은 조회와 POST 없이 차단한다',async()=>{
 const b=draft();b.pending=baseline.prepareBaselineCommand(b,session,'saveBaselineDraft');b.failure={code:'APPROVAL_REQUIRED',status:412};
 const w=await newBaselineApproval(b,session);assert.deepEqual(w.candidate,b.pending);
 for(const change of [(v:any)=>v.uncertain=true,(v:any)=>v.failure={code:'RESPONSE_INVALID',status:412},(v:any)=>v.ownerClientId=randomUUID(),(v:any)=>v.input.reason='다른 이유']){const other=structuredClone(b);change(other);await assert.rejects(newBaselineApproval(other,session));}
 let calls=0;const client=new ApiClient(async()=>{calls++;throw Error('NO_IO');});await assert.rejects(prepareBaselineApproval(client,w,b,session,()=>false));assert.equal(calls,0);
});

const hash=(v:unknown)=>contentHash(canonicalJson(v)),at='2026-10-27T00:00:00.000Z';
const flags={sourceAuthorizationVerified:false as const,coverageVerified:false as const,executionAuthorized:false as const,dispatchPerformed:false as const};
function snapshot(b:baseline.BaselineBuffer){return{schemaVersion:1,input:structuredClone(b.input),sourceBinding:{kind:'NONE_SELECTED',declaration:null,observation:null,declarationReportRelation:'UNVERIFIED'},evidenceBindings:b.input.items.map(i=>({itemId:i.itemId,evidenceRefs:i.evidenceRefs})),issues:[{code:'CONTENT_REVIEW_REQUIRED',location:'items'},{code:'SOURCE_UNVERIFIED',location:'source'},{code:'COVERAGE_UNVERIFIED',location:'coverageReason'},{code:'EXECUTION_NOT_CONNECTED',location:'execution'}],recordedBy:{kind:'HUMAN',userId:session.user.id},recordedAt:at,contentConfirmed:false,...flags};}
function prepared(operation:baseline.BaselineOperation){
 let b=draft();
 if(operation!=='saveBaselineDraft'){
  const snap=snapshot(b),ref={id:randomUUID(),version:1,contentHash:hash(snap)};b=baseline.restoreBaselineDraft(b,session,{projectId:b.projectId,ref,snapshot:snap,headVersion:1,currentCheck:{state:'MATCHED_METADATA',issues:[]},contentConfirmed:false,observedAt:at});b=baseline.beginBaselineReview(b,session);b.review!.items[0]!.outcome='ACCEPTED';b.review!.items[0]!.reason='부분 구현 내용 확인';b.review!.coverage={outcome:'ACCEPTED',reason:'범위 확인'};b.review!.outcome='ACCEPTED';b.review!.reason='내용 적합';
  if(operation==='confirmBaseline'){
   b.reviewDirty=false;b.confirmation={reason:'분류만 채택',acknowledged:true};const rs={input:b.review!,reviewedBy:{kind:'HUMAN' as const,userId:session.user.id},reviewedAt:at,independence:'NOT_CLAIMED' as const};
   b.pending=baseline.prepareBaselineAdoption(b,session,{projectId:b.projectId,draftRef:ref,reviews:[{ref:{id:randomUUID(),version:1,contentHash:hash(rs)},snapshot:rs,serverSequence:1}],hasMoreReviews:false,latestReviewAccepted:true,adoptedRef:null,draftIsHead:true,currentCheck:{state:'MATCHED_METADATA',issues:[]},contentConfirmed:false,observedAt:at});
  }
 }
 if(!b.pending)b.pending=baseline.prepareBaselineCommand(b,session,operation);b.failure={code:'APPROVAL_REQUIRED',status:412};return b;
}
function apiFixture(b:baseline.BaselineBuffer){
 let view:any,posts=0,generation=1;const policyBody={rules:[{ruleId:'BASELINE',subjectRef:{kind:'HUMAN',userId:session.user.id},operations:['saveBaselineDraft','reviewBaselineContent','confirmBaseline'],targetScopes:[{kind:'PROJECT',projectId:b.projectId}],disposition:'REQUIRE_APPROVAL',limitPolicyRef:null,expiresAt:'2099-01-01T00:00:00.000Z'}],reason:'각 원명령',reviewRefs:[]},policyRef={id:randomUUID(),version:1,contentHash:hash(policyBody)};
 const client=new ApiClient(async(url,init)=>{
  if(init?.method==='POST'){
   posts++;const c=JSON.parse(String(init.body));assert.deepEqual(c.approvalRef,{requestId:view.request.id,decisionId:view.decision.id,scopeDigest:view.request.scopeDigest});let snap:any,status:string;
   if(c.operation==='saveBaselineDraft'){snap=snapshot(b);status='BASELINE_DRAFT_STORED';}
   else if(c.operation==='reviewBaselineContent'){snap={input:c.payload,reviewedBy:{kind:'HUMAN',userId:session.user.id},reviewedAt:at,independence:'NOT_CLAIMED'};status='BASELINE_CONTENT_REVIEWED';}
   else{snap={schemaVersion:1,kind:'FEATURE_STATUS_V1',draftRef:b.saved!.ref,input:b.input,sourceBinding:b.saved!.snapshot.sourceBinding,evidenceBindings:b.saved!.snapshot.evidenceBindings,reviewRefs:c.payload.reviewRefs,previousBaselineRef:null,reason:c.payload.reason,acknowledged:true,adoptedBy:{kind:'HUMAN',userId:session.user.id},adoptedAt:at,contentConfirmed:true,...flags};status='FEATURE_BASELINE_ADOPTED';}
   const ref={id:randomUUID(),version:1,contentHash:hash(snap)};return Response.json({commandId:c.commandId,projectId:b.projectId,status:'APPLIED',operationId:randomUUID(),targetId:ref.id,version:1,serverReceivedAt:at,data:{status,ref,snapshot:snap}});
  }
  if(String(url).endsWith('/permission-policy'))return Response.json({configured:true,policy:{ref:policyRef,...policyBody,createdAt:at}});
  if(String(url).includes('/approvals/'))return Response.json(view);
  return Response.json({id:b.projectId,participation:'OWNER',controlState:{status:'HELD',actorId:session.user.id,clientId:session.clientId,generation}});
 });
 function approved(c:any,choice='APPROVE'){
  const id=randomUUID(),did=randomUUID(),details=c.payload.details,scopeDigest=hash(details.actionScope),body={projectId:b.projectId,details,scopeDigest,requiredDecider:{kind:'HUMAN',userId:session.user.id},policyRef,requestedBy:{kind:'HUMAN',userId:session.user.id,clientId:session.clientId},controlGeneration:1},requestRef={id,version:1,contentHash:hash(body)},dbody={requestId:id,requestVersion:1,requestRef,scopeDigest,decision:choice,reason:'명시 확인',decidedBy:body.requestedBy,controlGeneration:1,policyRef};
  view={request:{id,version:1,status:'PENDING',...body,createdAt:at},requestRef,currentVersion:2,storedStatus:choice==='APPROVE'?'APPROVED':'REJECTED',effectiveState:choice==='APPROVE'?'APPROVED':'REJECTED',decision:{ref:{id:did,version:1,contentHash:hash(dbody)},id:did,...dbody,decidedAt:at},consumption:null,expired:false,basisCurrent:true,executionAuthorized:false,observedAt:at};return view;
 }
 return{client,approved,posts:()=>posts,stale:()=>generation++};
}
for(const operation of ['saveBaselineDraft','reviewBaselineContent','confirmBaseline'] as const)test(operation+' 준비는 POST0·명시 결박 후 같은 원명령만 별도 전송한다',async()=>{
 const b=prepared(operation),before=structuredClone(b),w=await newBaselineApproval(b,session),f=apiFixture(b);
 w.details={reason:'해당 원명령',risks:{data:'이력',security:'현재 권한',cost:'없음',interruption:'없음',unverified:'실소스 미확인'},rollback:{method:'후속 버전',limitations:'원문 보존',evidenceRefs:[]},expiresAt:new Date(Date.now()+60000).toISOString()};
 const request=await prepareBaselineApproval(f.client,w,b,session,()=>true);assert.equal(f.posts(),0);assert.equal(request.payload.details.actionScope.operation,operation);assert.equal(request.payload.details.candidateCommandId,b.pending!.commandId);
 const view=f.approved(request),bound=await bindBaselineApproval(f.client,b,view.request.id,session,()=>true);assert.equal(f.posts(),0);assert.equal(bound.pending!.commandId,b.pending!.commandId);assert.deepEqual(bound.pending!.payload,b.pending!.payload);assert.deepEqual(b,before);
 assert.deepEqual(baseline.recheckBaselineCommand(bound,session),bound.pending);await checkBaselineApprovalBinding(bound,session);const tampered=structuredClone(bound);(tampered.pending!.approvalRef as any).decisionId=randomUUID();await assert.rejects(checkBaselineApprovalBinding(tampered,session));await baseline.sendBaselineCommand(f.client,baseline.recheckBaselineCommand(bound,session),session);assert.equal(f.posts(),1);
 f.approved(request,'REJECT');await assert.rejects(bindBaselineApproval(f.client,b,view.request.id,session,()=>true));f.approved(request);f.stale();await assert.rejects(bindBaselineApproval(f.client,b,view.request.id,session,()=>true));
});

test('같은 원명령의 승인 요청 pending→uncertain→저장 결과 연속 갱신은 허용하고 주체·세대·명령 교체는 거절한다',async()=>{
 const expected=prepared('saveBaselineDraft'),request=await newBaselineApproval(expected,session);expected.baselineApproval={request,requestId:'',commandHash:null};
 const first={...request,pending:{...expected.pending!,operation:'requestApproval',commandId:randomUUID()} as any};
 const apply=(previous:baseline.BaselineBuffer|null,before:any,next:any)=>baseline.mergeBaselineBuffer(previous,expected,b=>b.baselineApproval?.request===before?{...b,baselineApproval:{...b.baselineApproval!,request:next}}:b);
 const pending=apply(expected,request,first)!;assert.notEqual(pending,expected);assert.equal(pending.baselineApproval!.request,first);
 const sending={...first,uncertain:true};const uncertain=apply(pending,first,sending)!;assert.equal(uncertain.baselineApproval!.request,sending);
 const saved={...sending,pending:null,uncertain:false,resultId:randomUUID()},done=apply(uncertain,sending,saved)!;assert.equal(done.baselineApproval!.request!.resultId,saved.resultId);
 for(const previous of [{...uncertain,bindingId:randomUUID()},{...uncertain,ownerUserId:randomUUID()},{...uncertain,ownerClientId:randomUUID()},{...uncertain,controlGeneration:2},{...uncertain,pending:{...uncertain.pending!,commandId:randomUUID()}},{...uncertain,pending:{...uncertain.pending!,approvalRef:approval}}])assert.equal(apply(previous,sending,saved),previous);
 assert.equal(apply(done,sending,{...saved,resultId:randomUUID()}),done);
});
