import assert from 'node:assert/strict';
import test from 'node:test';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {criteriaFixture,criteriaHash as hash,criteriaId as id} from '../FN12/result-criteria-fixture.ts';
import {resultFixture} from './result-view-fixture.ts';
const mod:any=await import('../../../apps/web/src/features/session-detail/result-review-write-api.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
function fixture(){const f=criteriaFixture(),r=resultFixture();r.entry.snapshot.scope.projectId=f.assignment.projectId;r.entry.snapshot.scope.assignmentRef=f.assignment.ref;r.entry.snapshot.manifest.assignmentRef=f.assignment.ref;r.entry.snapshot.manifestHash=hash(r.entry.snapshot.manifest);r.entry.ref.contentHash=hash(r.entry.snapshot);const snapshot={assignmentRef:f.assignment.ref,baselineRefs:f.d.baselineRefs,items:[{criterionId:'save',testId:'SAVE-01',kind:'BROWSER',environmentRef:f.d.environmentRef,required:true}]},criteria:any={projectId:f.assignment.projectId,ref:{id:id(9),version:1,contentHash:hash(snapshot)},snapshot,registryStored:true,reviewStored:false,completionAccepted:false,executionAuthorized:false,dispatchPerformed:false},session={user:{id:id(6),displayName:'합성'},clientId:id(7),csrfToken:'A'.repeat(43)},input={resultRef:r.entry.ref,criteriaRef:criteria.ref,outcome:'REWORK',items:[{criterionId:'save',outcome:'REWORK',evidenceRefs:[],reason:'실제 화면 미실행'}],reason:'누락 근거 보완'};return{result:r.entry,criteria,session,input};}
async function prepare(f:ReturnType<typeof fixture>){assert.equal(typeof mod.prepareResultReviewWrite,'function','검수 기록 화면 저장 준비 미구현');return mod.prepareResultReviewWrite(f.result,f.criteria,f.input,f.session,3);}
function response(p:any,f:ReturnType<typeof fixture>){const at='2026-10-20T00:00:00.000Z',snapshot={scope:f.result.snapshot.scope,input:structuredClone(p.command.payload),reviewedBy:{kind:'HUMAN',userId:f.session.user.id,clientId:f.session.clientId},sameAsSubmitter:f.result.snapshot.submittedByRef.id===f.session.user.id,reviewedAt:at,evidenceProvenanceVerified:false,completionAccepted:false,formalFailureCounted:false,executionAuthorized:false,dispatchPerformed:false},ref={id:id(30),version:1,contentHash:hash(snapshot)},data={ref,status:'RESULT_REVIEW_RECORDED',snapshot,reviewStored:true,completionAccepted:false,formalFailureCounted:false,evidenceProvenanceVerified:false,executionAuthorized:false,dispatchPerformed:false};return{receipt:{commandId:p.command.commandId,operationId:id(31),projectId:p.command.projectId,status:'APPLIED',targetId:ref.id,version:1,data,serverReceivedAt:at},view:{projectId:p.command.projectId,ref,snapshot,reviewStored:true,completionAccepted:false,formalFailureCounted:false,evidenceProvenanceVerified:false,executionAuthorized:false,dispatchPerformed:false,observedAt:at}};}
test('보완/차단만 명시 준비하고 sameorigin 단일명령→고정GET로 저장을 확인한다',async()=>{const f=fixture(),p=await prepare(f),v=response(p,f),calls:any[]=[];const stored=await mod.saveResultReviewWrite(new ApiClient(async(url,o)=>{calls.push([String(url),o?.method,o?.credentials]);if(o?.method==='POST'){assert.equal(new Headers(o.headers).get('Idempotency-Key'),p.command.commandId);assert(typeof o.body==='string');assert.deepEqual(JSON.parse(o.body),p.command);return Response.json(v.receipt);}return Response.json(v.view);}),p,f.session,()=>true);assert.deepEqual(stored,v.view);assert.equal(stored.completionAccepted,false);assert.deepEqual(calls,[[`/api/v1/projects/${p.command.projectId}/commands`,'POST','same-origin'],[`/api/v1/projects/${p.command.projectId}/result-reviews/${v.view.ref.id}`,'GET','same-origin']]);});
test('준비에서 합격/다른ref·누락을 막고 위조 저장·다른주체·승격flag를 거절한다',async()=>{for(const change of [(f:any)=>f.input.outcome='ACCEPTED',(f:any)=>f.input.items[0].evidenceRefs=[f.criteria.ref],(f:any)=>f.input.items=[],(f:any)=>f.input.resultRef={...f.input.resultRef,id:id(99)}]){const f=fixture();change(f);await assert.rejects(prepare(f),(e:any)=>e.code==='RESULT_REVIEW_INPUT_INVALID');}for(const change of [(v:any)=>v.snapshot.reviewedBy.userId=id(99),(v:any)=>v.snapshot.completionAccepted=true,(v:any)=>v.snapshot.sameAsSubmitter=!v.snapshot.sameAsSubmitter,(v:any)=>v.snapshot.input.reason='다른 이유']){const f=fixture(),p=await prepare(f),v=response(p,f);change(v.view);await assert.rejects(mod.saveResultReviewWrite(new ApiClient(async(_u,o)=>Response.json(o?.method==='POST'?v.receipt:v.view)),p,f.session,()=>true),(e:any)=>e.code==='RESULT_REVIEW_RESPONSE_INVALID');}});
test('APPLIED 후 GET403·응답변형을 저장 거절로 바꾸지 않고 원 명령과 조회 증빙을 보존한다',async()=>{const f=fixture(),p=await prepare(f),v=response(p,f);await assert.rejects(mod.saveResultReviewWrite(new ApiClient(async(_u,o)=>o?.method==='POST'?Response.json(v.receipt):Response.json({code:'ACCESS_DENIED'},{status:403})),p,f.session,()=>true),(e:any)=>e.writeMayHaveApplied===true&&e.status===403);const broken={...v.view,completionAccepted:true};await assert.rejects(mod.saveResultReviewWrite(new ApiClient(async(_u,o)=>Response.json(o?.method==='POST'?v.receipt:broken)),p,f.session,()=>true),(e:any)=>e.writeMayHaveApplied===true);let active=true,calls=0;assert.equal(await mod.saveResultReviewWrite(new ApiClient(async()=>{calls++;active=false;return Response.json(v.receipt);}),p,f.session,()=>active),null);assert.equal(calls,1);assert.deepEqual(p.command.payload,f.input);await assert.rejects(mod.saveResultReviewWrite(new ApiClient(async()=>{throw Error('MUST_NOT_SEND');}),p,{...f.session,clientId:id(98)},()=>true),(e:any)=>e.code==='RESULT_REVIEW_BINDING_INVALID');});

test('해시 검산 중 transport/CSRF 교체는 원 POST와 새 POST 모두 0이다',async()=>{
 for(const mode of ['transport','csrf'] as const){
  const f=fixture(),pending=await prepare(f),v=response(pending,f);let calls=0;
  const transport:typeof fetch=async()=>{calls++;return Response.json(v.receipt);};
  const client=new ApiClient(transport);
  const saving=mod.saveResultReviewWrite(client,pending,f.session,()=>true);
  if(mode==='transport')client.transport=async(...args)=>transport(...args);
  else f.session.csrfToken='B'.repeat(43);
  assert.equal(await saving,null);assert.equal(calls,0,mode);
 }
});

test('POST 응답 본문을 읽는 동안 현재성이 바뀌면 늦은 401 및 새 readback이 없다',async()=>{
 for(const mode of ['401','APPLIED'] as const){
  const f=fixture(),pending=await prepare(f),v=response(pending,f);let calls=0,nextCalls=0;
  const client=new ApiClient(async()=>{
   calls++;
   const result=mode==='401'?Response.json({code:'AUTH_REQUIRED'},{status:401}):Response.json(v.receipt),json=result.json.bind(result);
   result.json=async()=>{client.transport=async()=>{nextCalls++;return Response.json(v.view);};return json();};
   return result;
  });
  assert.equal(await mod.saveResultReviewWrite(client,pending,f.session,()=>true),null,mode);
  assert.equal(calls,1);assert.equal(nextCalls,0);
 }
});

async function confirmedReadback(f=fixture()){
 const pending=await prepare(f),v=response(pending,f);let failure:any;
 await assert.rejects(mod.saveResultReviewWrite(new ApiClient(async(_u,o)=>o?.method==='POST'?Response.json(v.receipt):Response.json({code:'ACCESS_DENIED'},{status:403})),pending,f.session,()=>true),(e:any)=>{failure=e;return e.writeMayHaveApplied===true;});
 assert(failure.confirmed,'검산된 APPLIED 영수증의 exact 조회 증빙을 보존해야 한다');
 return{f,pending,v,confirmed:failure.confirmed};
}

test('검산된 APPLIED 뒤 실패는 원 ref의 명시 GET만으로 복구하고 POST를 반복하지 않는다',async()=>{
 const {f,pending,v,confirmed}=await confirmedReadback(),calls:any[]=[];
 const result=await mod.readConfirmedResultReview(new ApiClient(async(url,o)=>{calls.push([String(url),o?.method]);return Response.json(v.view);}),pending,confirmed,f.session,()=>true);
 assert.deepEqual(result,v.view);assert.deepEqual(calls,[[`/api/v1/projects/${pending.command.projectId}/result-reviews/${v.view.ref.id}`,'GET']]);
 assert.equal(result.completionAccepted,false);assert.equal(result.executionAuthorized,false);
});

test('응답 유실과 위조 APPLIED에는 고정 GET 복구 증빙을 발급하지 않는다',async()=>{
 for(const kind of ['loss','hash','command','scope']){
  const f=fixture(),pending=await prepare(f),v=response(pending,f);let calls=0;
  if(kind==='hash')v.receipt.data.ref.contentHash='b'.repeat(64);
  if(kind==='command')v.receipt.commandId=id(98);
  if(kind==='scope')v.receipt.data.snapshot.scope={...v.receipt.data.snapshot.scope,projectId:id(98)};
  await assert.rejects(mod.saveResultReviewWrite(new ApiClient(async()=>{calls++;if(kind==='loss')throw Error('synthetic loss');return Response.json(v.receipt);}),pending,f.session,()=>true),(e:any)=>!e.confirmed);
  assert.equal(calls,1);
 }
});

test('복구 증빙의 복제·타 명령·다른 주체는 GET 전에 거절한다',async()=>{
 const {f,pending,v,confirmed}=await confirmedReadback();let calls=0;
 const client=new ApiClient(async()=>{calls++;return Response.json(v.view);});
 for(const [p,c,s]of [[pending,structuredClone(confirmed),f.session],[{...pending,command:{...pending.command,commandId:id(98)}},confirmed,f.session],[pending,confirmed,{...f.session,clientId:id(98)}]]){
  await assert.rejects(mod.readConfirmedResultReview(client,p,c,s,()=>true));
 }
 assert.equal(calls,0);
});

test('명시 복구의 이탈·transport/인증 변경은 늦은 성공과 401을 폐기한다',async()=>{
 for(const change of ['inactive','transport','csrf'])for(const status of [200,401]){
  const {f,pending,v,confirmed}=await confirmedReadback();let active=true,calls=0;
  const client=new ApiClient(async()=>{calls++;const out=status===200?Response.json(v.view):Response.json({code:'AUTH_REQUIRED'},{status});const json=out.json.bind(out);out.json=async()=>{if(change==='inactive')active=false;if(change==='transport')client.transport=async()=>{throw Error('새 연결 호출 금지');};if(change==='csrf')f.session.csrfToken='B'.repeat(43);return json();};return out;});
  assert.equal(await mod.readConfirmedResultReview(client,pending,confirmed,f.session,()=>active),null);assert.equal(calls,1);
 }
});

test('고정 재조회는 현재 권한 오류와 다른 ref·원문·승격 응답을 거절하고 증빙을 바꾸지 않는다',async()=>{
 const {f,pending,v,confirmed}=await confirmedReadback(),before=structuredClone(confirmed);
 await assert.rejects(mod.readConfirmedResultReview(new ApiClient(async()=>Response.json({code:'ACCESS_DENIED'},{status:403})),pending,confirmed,f.session,()=>true),(e:any)=>e.status===403);
 for(const mutate of [(x:any)=>x.ref.id=id(99),(x:any)=>x.ref.contentHash='c'.repeat(64),(x:any)=>x.snapshot.input.reason='다른 원문',(x:any)=>x.completionAccepted=true]){
  const bad=structuredClone(v.view);mutate(bad);
  await assert.rejects(mod.readConfirmedResultReview(new ApiClient(async()=>Response.json(bad)),pending,confirmed,f.session,()=>true),(e:any)=>e.code==='RESULT_REVIEW_RESPONSE_INVALID');
 }
 assert.deepEqual(confirmed,before);
 let calls=0;assert.equal(await mod.readConfirmedResultReview(new ApiClient(async()=>{calls++;return Response.json(v.view);}),pending,confirmed,f.session,()=>false),null);assert.equal(calls,0);
});
