import test from 'node:test';import assert from 'node:assert/strict';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {nextActionFixture} from './next-action-basis-fixture.ts';
const m:any=await import('../../../apps/web/src/features/session-detail/next-action-basis-api.ts');
function read(client:ApiClient,f:ReturnType<typeof nextActionFixture>,active=()=>true){return m.readNextActionBasis(client,f.result,f.assignment,f.review,active);}
function basis(f:ReturnType<typeof nextActionFixture>){return{projectId:f.pid,resultRef:f.result.ref,reviewRef:f.review.ref,assignmentRef:f.assignment.ref,applicationRef:f.application.applicationRef,nodeId:'review',nodeName:'개발 검토',action:f.review.snapshot.input.outcome==='REWORK'?'REVIEW_REWORK_FOR_SELECTED_STAGE':'WAIT_HUMAN_UNBLOCK_DECISION',reviewOutcome:f.review.snapshot.input.outcome,sourceAssurance:'SERVER_STORED_REVIEW_WITH_CURRENT_METHODOLOGY',resultTransport:'SYNTHETIC_ONLY',reviewObservedAt:'2026-10-20T00:00:00.000Z',applicationObservedAt:'2026-10-20T00:00:00.000Z',reasonCodes:['COMPLETION_NOT_ACCEPTED','RUNTIME_STATE_NOT_VERIFIED','CURRENT_AUTHORITY_BUDGET_NOT_REVALIDATED'],completionAccepted:false,runtimeStateVerified:false,automaticTransitionPerformed:false,executionAuthorized:false,dispatchPerformed:false};}
test('선택 검수의 서버 근거 GET만 소비하며 보완/차단을 실행 허가로 승격하지 않는다',async()=>{
 for(const outcome of ['REWORK','BLOCKED']as const){const f=nextActionFixture(outcome),calls:string[]=[],v=await read(new ApiClient(async(url,options)=>{calls.push(String(url));assert.equal(options?.method,'GET');assert.equal(options.credentials,'same-origin');assert.equal(options.cache,'no-store');return Response.json(basis(f));}),f);
  assert.equal(v.action,outcome==='REWORK'?'REVIEW_REWORK_FOR_SELECTED_STAGE':'WAIT_HUMAN_UNBLOCK_DECISION');assert.equal(v.nodeId,'review');for(const flag of ['completionAccepted','executionAuthorized','dispatchPerformed','runtimeStateVerified','automaticTransitionPerformed'])assert.equal(v[flag],false);assert.deepEqual(calls,[`/api/v1/projects/${f.pid}/result-reviews/${f.review.ref.id}/next-action-basis`]);
 }
});
test('변조·다른 임무/원결과·완료승격은 조회전 거절하고 다른 적용본 응답은 사용하지 않는다',async()=>{
 for(const change of [(f:any)=>f.assignment.ref.contentHash='f'.repeat(64),(f:any)=>f.review.completionAccepted=true,(f:any)=>f.result.snapshot.scope.assignmentRef.id=f.id(99),(f:any)=>f.result.snapshot.sourceKind='다른원문',(f:any)=>f.review.snapshot.input.outcome='ACCEPTED']){const f=nextActionFixture();change(f);let calls=0;await assert.rejects(read(new ApiClient(async()=>{calls++;throw Error('NETWORK_FORBIDDEN');}),f));assert.equal(calls,0);}
 const f=nextActionFixture(),v=basis(f);v.applicationRef={...v.applicationRef,id:f.id(80)};await assert.rejects(read(new ApiClient(async()=>Response.json(v)),f),(e:any)=>e.code==='NEXT_ACTION_BASIS_INVALID');
});
test('다른 선택/ref·판정·source 승격·시간/추가필드는 서버 근거로 채택하지 않는다',async()=>{
 for(const mutate of [(v:any,f:any)=>v.reviewRef={...v.reviewRef,contentHash:'f'.repeat(64)},(v:any,f:any)=>v.resultRef={...v.resultRef,id:f.id(99)},(v:any)=>v.nodeId='other',(v:any)=>v.action='WAIT_HUMAN_UNBLOCK_DECISION',(v:any)=>v.sourceAssurance='RUNTIME_VERIFIED',(v:any)=>v.resultTransport='REAL_PROVIDER',(v:any)=>v.reviewObservedAt='not-time',(v:any)=>v.extra='PRIVATE_TOKEN',(v:any)=>v.reasonCodes=[]]){const f=nextActionFixture(),v=basis(f);mutate(v,f);await assert.rejects(read(new ApiClient(async()=>Response.json(v)),f),(e:any)=>e.code==='NEXT_ACTION_BASIS_INVALID');}
 for(const flag of ['completionAccepted','runtimeStateVerified','automaticTransitionPerformed','executionAuthorized','dispatchPerformed']){const f=nextActionFixture(),v:any=basis(f);v[flag]=true;await assert.rejects(read(new ApiClient(async()=>Response.json(v)),f));}
});
test('인증 거절·이탈·제공자 실패는 옛 두 GET로 우회하거나 이전 결과를 반환하지 않는다',async()=>{
 const f=nextActionFixture();let errors=0;await assert.rejects(read(new ApiClient(async()=>{errors++;return Response.json({code:'ACCESS_DENIED'},{status:403});}),f),(e:any)=>e.status===403);assert.equal(errors,1);
 let active=true,calls=0;assert.equal(await read(new ApiClient(async()=>{calls++;active=false;return Response.json(basis(f));}),f,()=>active),null);assert.equal(calls,1);assert.equal(await read(new ApiClient(async()=>{throw Error('FORBIDDEN');}),f,()=>false),null);
});
test('조회 중 caller 변경은 고정 원문과 분리하며 없는 단계는 정상 진행으로 바꾸지 않는다',async()=>{
 const f=nextActionFixture(),response=basis(f);const value=await read(new ApiClient(async()=>{f.assignment.snapshot.definition.taskRef.nodeId='다른단계';return Response.json(response);}),f);assert.equal(value.nodeId,'review');
 const g=nextActionFixture(),v=basis(g);v.nodeId='missing';await assert.rejects(read(new ApiClient(async()=>Response.json(v)),g),(e:any)=>e.code==='NEXT_ACTION_BASIS_INVALID');
});
