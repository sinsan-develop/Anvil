import assert from 'node:assert/strict';
import test from 'node:test';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {criteriaFixture,criteriaHash,criteriaId} from '../FN12/result-criteria-fixture.ts';
import {saveCriteriaRegistration,prepareCriteriaRevision} from '../../../apps/web/src/features/session-detail/result-criteria-api.ts';

const at='2026-10-27T10:02:00.000Z';
const flags={registryStored:true,reviewStored:false,completionAccepted:false,executionAuthorized:false,dispatchPerformed:false} as const;
function projection(assignment:any,input:any){
 return {snapshot:{assignmentRef:input.assignmentRef,baselineRefs:assignment.snapshot.definition.baselineRefs,items:input.items.map((i:any)=>({criterionId:i.criterionId,testId:i.testId,kind:i.kind,environmentRef:i.environmentRef,required:true}))},sourceBindings:input.items.map((i:any)=>({criterionId:i.criterionId,sources:i.sources}))};
}
function fixture(){
 const f=criteriaFixture(),session={user:{id:criteriaId(6)},clientId:criteriaId(8),csrfToken:'A'.repeat(43)};
 // 기존 서버가 허용하는 한 기준의 다중 원조건을 그대로 보존한다.
 const original={...structuredClone(f.input),items:[{...structuredClone(f.input.items[0]),sources:f.input.items.flatMap((i:any)=>structuredClone(i.sources))}]};
 const initial=projection(f.assignment,original),base={projectId:f.assignment.projectId,ref:{id:criteriaId(9),version:1,contentHash:criteriaHash(initial.snapshot)},...initial,input:original,createdBy:session.user.id,registeredAt:'2026-10-19T10:02:00.000Z',...flags,observedAt:at};
 const payload={...structuredClone(original),baseRef:structuredClone(base.ref),reason:'저장 검수 기준 시험 개정'};
 payload.items[0].testId='SAVE-02';
 // 신규 준비 함수 존재 여부가 아니라 기존 저장 함수의 정상 개정 소비를 검증한다.
 const pending:any={ownerUserId:session.user.id,assignment:structuredClone(f.assignment),base:structuredClone(base),command:{schemaVersion:1,projectId:f.assignment.projectId,commandId:criteriaId(12),clientId:session.clientId,controlGeneration:3,operation:'saveResultCriteria',targetId:base.ref.id,expectedVersion:base.ref.version,baselineRefs:[],approvalRef:null,payload}};
 const expected=projection(f.assignment,payload),ref={id:base.ref.id,version:2,contentHash:criteriaHash(expected.snapshot)},data={ref,status:'RESULT_CRITERIA_STORED',...expected,...flags};
 const receipt={commandId:pending.command.commandId,operationId:criteriaId(10),projectId:f.assignment.projectId,targetId:ref.id,version:2,status:'APPLIED',serverReceivedAt:at,data};
 const view={projectId:f.assignment.projectId,ref,...expected,input:structuredClone(payload),createdBy:session.user.id,registeredAt:at,...flags,observedAt:at};
 return {f,session,base,pending,receipt,view};
}

test('정확 직전 ref의 다중 source 개정은 원 POST 한 번과 같은 ID v2 영수증 및 동적 정확 GET으로 확인한다',async()=>{
 const {f,session,base,pending,receipt,view}=fixture(),before=structuredClone(pending),baseBefore=structuredClone(base),calls:any[]=[];
 const client=new ApiClient(async(url,opt)=>{
  calls.push({url:String(url),method:opt?.method,body:opt?.body,credentials:opt?.credentials});
  if(opt?.method==='POST'){
   assert.equal((opt.headers as any)['Idempotency-Key'],pending.command.commandId);
   assert.equal((opt.headers as any)['X-Anvil-CSRF'],session.csrfToken);
   return Response.json(receipt);
  }
  return Response.json(view);
 });
 const actual=await saveCriteriaRegistration(client,pending,session,()=>true);
 assert.deepEqual(actual,view);
 assert.deepEqual(calls.map(c=>[c.url,c.method,c.credentials]),[[`/api/v1/projects/${f.assignment.projectId}/commands`,'POST','same-origin'],[`/api/v1/projects/${f.assignment.projectId}/result-criteria/${base.ref.id}/versions/2`,'GET','same-origin']]);
 assert.deepEqual(JSON.parse(calls[0].body),pending.command);
 assert.equal(actual!.ref.id,base.ref.id);assert.equal(actual!.ref.version,base.ref.version+1);
 assert.deepEqual(actual!.input.items[0]!.sources,base.input.items[0].sources);
 assert.equal(actual!.input.items[0]!.sources.length,2);
 assert.deepEqual(actual!.sourceBindings[0]!.sources,base.sourceBindings[0].sources);
 assert.equal(pending.command.approvalRef,null);assert.deepEqual(pending.command.baselineRefs,[]);
 for(const [key,value] of Object.entries(flags))assert.equal((actual as any)[key],value);
 assert.deepEqual(pending,before);assert.deepEqual(base,baseBefore);
});

test('위조 base 결박·원조건 변형·다른 주체는 전송 전에 거절한다',async()=>{
 const changes=[
  (p:any)=>{p.command.targetId=criteriaId(13);},
  (p:any)=>{p.command.expectedVersion=2;},
  (p:any)=>{p.command.payload.baseRef.contentHash='f'.repeat(64);},
  (p:any)=>{p.command.payload.assignmentRef.id=criteriaId(13);},
  (p:any)=>{p.command.payload.items[0].sources.pop();},
  (p:any)=>{p.command.payload.items[0].sources[0].contentHash='f'.repeat(64);},
  (p:any)=>{p.command.payload.items[0].environmentRef.id=criteriaId(13);}
 ];
 for(const change of changes){const {pending,session}=fixture();change(pending);let calls=0;
  await assert.rejects(saveCriteriaRegistration(new ApiClient(async()=>{calls++;throw Error('전송 금지');}),pending,session,()=>true),(e:any)=>e.code==='RESULT_CRITERIA_BINDING_INVALID');
  assert.equal(calls,0);
 }
 for(const alter of [(s:any)=>{s.user.id=criteriaId(13);},(s:any)=>{s.clientId=criteriaId(13);}]){
  const {pending,session}=fixture();alter(session);let calls=0;
  await assert.rejects(saveCriteriaRegistration(new ApiClient(async()=>{calls++;throw Error('전송 금지');}),pending,session,()=>true),(e:any)=>e.code==='RESULT_CRITERIA_BINDING_INVALID');assert.equal(calls,0);
 }
});

test('개정 영수증의 다른 ID·건너뛴 버전·원문 source 누락은 저장 확인으로 받지 않는다',async()=>{
 for(const change of [
  (r:any,_v:any)=>{r.targetId=criteriaId(13);r.data.ref.id=criteriaId(13);},
  (r:any,_v:any)=>{r.version=3;r.data.ref.version=3;},
  (_r:any,v:any)=>{v.input.items[0].sources.pop();},
  (_r:any,v:any)=>{v.completionAccepted=true;}
 ]){const {pending,session,receipt,view}=fixture();change(receipt,view);
  await assert.rejects(saveCriteriaRegistration(new ApiClient(async(_u,o)=>Response.json(o?.method==='POST'?receipt:view)),pending,session,()=>true),(e:any)=>e.code==='RESULT_CRITERIA_RESPONSE_INVALID');
 }
});

test('APPLIED 뒤 GET 실패는 개정 원명령과 저장 가능성을 보존하며 명시 재확인은 같은 명령이다',async()=>{
 const {pending,session,receipt,view}=fixture(),before=structuredClone(pending),posts:any[]=[];let failRead=true;
 const client=new ApiClient(async(_u,o)=>{
  if(o?.method==='POST'){posts.push(JSON.parse(String(o.body)));return Response.json(receipt);}
  return failRead?Response.json({code:'ACCESS_DENIED'},{status:403}):Response.json(view);
 });
 await assert.rejects(saveCriteriaRegistration(client,pending,session,()=>true),(e:any)=>e.code==='ACCESS_DENIED'&&e.status===403&&e.writeMayHaveApplied===true);
 assert.deepEqual(pending,before);assert.equal(posts.length,1);
 failRead=false;assert.deepEqual(await saveCriteriaRegistration(client,pending,session,()=>true),view);
 assert.equal(posts.length,2);assert.deepEqual(posts[0],posts[1]);assert.deepEqual(pending,before);
});

test('단절과 늦은 POST·GET 응답은 원명령을 유지하고 이탈 후 결과를 적용하지 않는다',async()=>{
 const {pending,session,receipt,view}=fixture(),before=structuredClone(pending);let calls=0;
 await assert.rejects(saveCriteriaRegistration(new ApiClient(async()=>{calls++;throw Error('offline');}),pending,session,()=>true),(e:any)=>e.code==='CONNECTION_LOST');
 assert.equal(calls,1);assert.deepEqual(pending,before);
 assert.equal(await saveCriteriaRegistration(new ApiClient(async()=>{throw Error('비활성 전송 금지');}),pending,session,()=>false),null);
 for(const leaveAt of ['POST','GET']){
  let active=true;const methods:string[]=[];
  const value=await saveCriteriaRegistration(new ApiClient(async(_u,o)=>{
   methods.push(String(o?.method));if(o?.method===leaveAt)active=false;
   return Response.json(o?.method==='POST'?receipt:view);
  }),pending,session,()=>active);
  assert.equal(value,null);assert.deepEqual(methods,leaveAt==='POST'?['POST']:['POST','GET']);assert.deepEqual(pending,before);
 }
});


test('개정 준비는 원본을 검증하고 편집 가능 항목만 변경하며 v2에서 v3도 정확 결박한다',async()=>{
 const {f,session,base,view}=fixture(),before=structuredClone(base);
 const items=structuredClone(base.input.items);items[0].criterionId='revised';items[0].testId='REV-02';items[0].kind='UNIT';
 const first=await prepareCriteriaRevision(f.assignment,base,items,'명시 개정',session,3);
 assert.deepEqual(first.base,base);assert.deepEqual(first.command.payload.items,items);assert.deepEqual(first.command.payload.baseRef,base.ref);
 assert.equal(first.command.targetId,base.ref.id);assert.equal(first.command.expectedVersion,1);assert.deepEqual(base,before);
 const second=await prepareCriteriaRevision(f.assignment,view,view.input.items,'다음 명시 개정',session,3);
 assert.equal(second.command.expectedVersion,2);assert.deepEqual(second.command.payload.baseRef,view.ref);
 const snapshot=projection(f.assignment,second.command.payload),ref={...view.ref,version:3,contentHash:criteriaHash(snapshot.snapshot)},next={...view,...snapshot,ref,input:second.command.payload};
 const receipt={commandId:second.command.commandId,operationId:criteriaId(14),projectId:f.assignment.projectId,targetId:ref.id,version:3,status:'APPLIED',serverReceivedAt:at,data:{ref,status:'RESULT_CRITERIA_STORED',...snapshot,...flags}},urls:string[]=[];
 assert.deepEqual(await saveCriteriaRegistration(new ApiClient(async(url,o)=>{urls.push(String(url));return Response.json(o?.method==='POST'?receipt:next);}),second,session,()=>true),next);
 assert.equal(urls.at(-1),'/api/v1/projects/'+f.assignment.projectId+'/result-criteria/'+ref.id+'/versions/3');
});
test('개정 준비는 재해시된 다른 임무·기준·환경·source 누락·변조 원문을 거절한다',async()=>{
 for(const change of [
  (b:any)=>{b.ref.contentHash='f'.repeat(64);},
  (b:any)=>{b.input.assignmentRef.id=criteriaId(14);},
  (b:any)=>{b.snapshot.baselineRefs=[];b.ref.contentHash=criteriaHash(b.snapshot);},
  (b:any)=>{b.input.items[0].sources.pop();b.sourceBindings[0].sources=structuredClone(b.input.items[0].sources);},
  (b:any)=>{b.input.items[0].environmentRef.id=criteriaId(14);b.snapshot.items[0].environmentRef=b.input.items[0].environmentRef;b.ref.contentHash=criteriaHash(b.snapshot);},
  (b:any)=>{b.input.items[0].sources[0].contentHash='f'.repeat(64);b.sourceBindings[0].sources=structuredClone(b.input.items[0].sources);}
 ]){const {f,session,base}=fixture();change(base);await assert.rejects(prepareCriteriaRevision(f.assignment,base,base.input.items,'변조 거절',session,3),(e:any)=>e.code==='RESULT_CRITERIA_BINDING_INVALID');}
});
