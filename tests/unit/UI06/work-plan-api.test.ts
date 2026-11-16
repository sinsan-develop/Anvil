import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {documentDraftHash} from '../../../apps/web/src/features/design-trace/editor-api.ts';
import {prepareStoredWorkPlan,prepareWorkPlan} from '../../../apps/web/src/features/design-trace/work-plan-api.ts';
const pid='51c0439f-791e-4bb5-8471-70938d6afaf1',id='a6f30000-0000-4000-8000-000000000090',planId='a6f30000-0000-4000-8000-000000000091',user='32b5f276-13e6-4d8a-b93f-27a15d21c788',ref={id,version:1,contentHash:'a'.repeat(64)};
test('작업계획 읽기는 정확 버전/hash와 미연결 실행 상태만 채택하고 위조 완료를 거절한다',async()=>{
  const module=await import('../../../apps/web/src/features/design-trace/work-plan-api.ts').catch(()=>null);assert.ok(module,'실제 작업계획 Web 클라이언트가 필요하다');
  const snapshot={documentRef:ref,designRef:ref,screenReviewRefs:[],tasks:[],dependencies:[],reason:'초안',issues:[],relationalProjection:'STORED'},planRef={id:planId,version:1,contentHash:contentHash(canonicalJson(snapshot))};
  let value:any={ref:planRef,status:'DRAFT',...snapshot,executionEvidence:'NOT_CONNECTED',observedAt:'2026-10-16T05:00:00Z'},calls:string[]=[];
  const client=new ApiClient(async(path:any)=>{calls.push(String(path));return new Response(JSON.stringify(value),{headers:{'content-type':'application/json'}});});
  assert.equal((await module.readWorkPlan(client,pid,planRef)).status,'DRAFT');assert.equal(calls[0],`/api/v1/projects/${pid}/work-plans/${planId}/versions/1`);
  value={...value,status:'COMPLETED'};await assert.rejects(module.readWorkPlan(client,pid,planRef));value={...value,status:'DRAFT',reason:'변조'};await assert.rejects(module.readWorkPlan(client,pid,planRef));
  const fakeSnapshot={...snapshot,tasks:[{taskCode:'FN01',status:'COMPLETED'}]},fakeRef={...planRef,contentHash:contentHash(canonicalJson(fakeSnapshot))};value={...value,...fakeSnapshot,ref:fakeRef};await assert.rejects(module.readWorkPlan(client,pid,fakeRef),'해시만 맞춘 가짜 완료 카드는 실제 계획이 아니다');
});
test('작업계획 쓰기는 다른 주체·중단 화면·변조 명령을 전송하지 않는다',async()=>{
  const module=await import('../../../apps/web/src/features/design-trace/work-plan-api.ts').catch(()=>null);assert.ok(module,'실제 작업계획 Web 클라이언트가 필요하다');
  const session={user:{id:user},clientId:user,csrfToken:'C'.repeat(43)};
  const b:any={ownerUserId:user,projectId:pid,documentId:id,baseVersion:1,baseHash:ref.contentHash,controlGeneration:1,pending:null};b.workPlanState=module.newWorkPlan(b);b.workPlanState.input.designRef=ref;b.workPlanState.input.reason='초안 준비';
  assert.throws(()=>module.prepareWorkPlan(b,{...session,user:{id:planId}}));b.workPlanState.pending=module.prepareWorkPlan(b,session);
  let calls=0;const client=new ApiClient(async()=>{calls++;throw Error('전송 금지');});
  await assert.rejects(module.sendWorkPlan(client,b,session,()=>false));assert.equal(calls,0);b.workPlanState.pending.operation='confirmDocument';await assert.rejects(module.sendWorkPlan(client,b,session,()=>true));assert.equal(calls,0);
});
test('보관 계획 목록은 읽기만 수행하고 cursor/문서 조건을 보존한다',async()=>{
  const module=await import('../../../apps/web/src/features/design-trace/work-plan-api.ts');let path='';const client=new ApiClient(async(p:any)=>{path=String(p);return new Response(JSON.stringify({items:[],hasMore:false,nextCursor:null,observedAt:'2026-10-16T05:00:00Z'}),{headers:{'content-type':'application/json'}});});
  assert.equal(typeof module.listWorkPlans,'function','보관 계획의 Web 목록 경로가 필요하다');await module.listWorkPlans(client,pid,'cursor_value',id);assert.match(path,/cursor=cursor_value/);assert.match(path,new RegExp('documentId='+id));
});

async function revisionFixture(){
 const at='2026-11-17T00:00:00.000Z',formRef={id:user,version:1,contentHash:'c'.repeat(64)},session={user:{id:user},clientId:user,csrfToken:'C'.repeat(43)};
 const body='FN01 선택한 계획 원문',content={body:{artifactId:user,bytes:Buffer.byteLength(body),contentHash:contentHash(Buffer.from(body)),mediaType:'text/markdown;charset=utf-8'},attachments:[],sections:[],sourceRefs:[]};
 const document={id,version:2,title:'계획 새 원문',contentHash:await documentDraftHash('계획 새 원문',formRef,content,null),formRef,stageNodeRef:null,content,confirmed:false,validation:{validForConfirmation:false,issues:[]},statusHistory:[],contentReviewCriteria:{criteriaVersion:1,formRef,items:[]},contentReviews:[]};
 const snapshot={documentRef:ref,designRef:ref,screenReviewRefs:[],tasks:[],dependencies:[],reason:'원 계획 이유',issues:[],relationalProjection:'STORED'},plan={ref:{id:planId,version:3,contentHash:contentHash(canonicalJson(snapshot))},status:'DRAFT',...snapshot,executionEvidence:'NOT_CONNECTED',observedAt:at};
 const form={ref:formRef,definition:{scope:'USER_COMMON',formCode:'AF04',name:'계획',purpose:'작성',requiredInputs:[],authorRole:'작성',reviewerRole:'검토',confirmerRole:'사용자',items:[],authoringStandardRef:formRef},authoringStandard:{ref:formRef,content:'기준'},validation:{formatOnly:true,contentReview:'NOT_PERFORMED',userAcceptance:'NOT_PERFORMED'}};
 const calls:string[]=[],controls={head:2,missing:false,document,form,after:(_path:string)=>{}};
 const client=new ApiClient(async(p,init)=>{assert.equal(init?.method,'GET');const path=String(p);calls.push(path);controls.after(path);
  if(path.includes('/work-plans/'))return Response.json(plan);
  if(path.includes('/documents?'))return Response.json({items:controls.missing?[]:[{id,title:'계획',headVersion:controls.head,confirmedVersion:null,updatedAt:at}],hasMore:false,nextCursor:null,observedAt:at});
  if(path.includes('/documents/'))return Response.json(path.endsWith('/1')?{...controls.document,version:1,contentHash:ref.contentHash}:controls.document);
  if(path.includes('/files/'))return new Response(Buffer.from(body),{headers:{'content-type':'application/octet-stream'}});
  if(path.includes('/forms/'))return Response.json(controls.form);
  if(path.includes('/design-index?'))return Response.json({documentRef:ref,items:[],screenRegions:[],status:'NOT_INDEXED',observedAt:at});
  return Response.json({id:pid,participation:'OWNER',controlState:{actorId:user,clientId:user,generation:7,status:'HELD'}});
 });
 return{client,calls,controls,session,plan,document};
}
test('보관 계획의 명시 원문 v2 선택은 동일 계획 CAS와 새 원문 fullref를 결박하고 POST하지 않는다',async()=>{
 const f=await revisionFixture(),before=structuredClone(f.plan);
 const b=await prepareStoredWorkPlan(f.client,pid,f.plan.ref,f.session,'REVISION',{documentVersion:2});
 assert.equal(b.baseVersion,2);assert.equal(b.body,'FN01 선택한 계획 원문');assert.equal(b.baseHash,f.document.contentHash);
 assert.deepEqual(b.workPlanState?.planRef,f.plan.ref);assert.deepEqual(b.workPlanState?.input.documentRef,{id,version:2,contentHash:f.document.contentHash});
 const command=prepareWorkPlan(b,f.session);assert.equal(command.targetId,planId);assert.equal(command.expectedVersion,3);assert.deepEqual(command.payload.documentRef,b.workPlanState!.input.documentRef);assert.deepEqual(f.plan,before);
 assert(f.calls.some(p=>p.includes('/documents?')));assert(f.calls.some(p=>p.endsWith('/versions/2')));assert(!f.calls.some(p=>p.endsWith('/documents/'+id+'/versions/1')));
});
for(const failure of ['HASH','ID','VERSION','FORM','HEAD','MISSING','TRACE']as const)test('명시 원문 개정의 '+failure+' 불일치를 준비로 채택하지 않는다',async()=>{
 const f=await revisionFixture();if(failure==='HASH')f.controls.document.contentHash='b'.repeat(64);if(failure==='ID')f.controls.document.id=planId;if(failure==='VERSION')f.controls.document.version=3;if(failure==='FORM')f.controls.form.definition.formCode='AF03';if(failure==='HEAD')f.controls.head=3;if(failure==='MISSING')f.controls.missing=true;
 await assert.rejects(prepareStoredWorkPlan(f.client,pid,f.plan.ref,f.session,failure==='TRACE'?'TRACE':'REVISION',{documentVersion:2}));
});
test('기본 개정과 TRACE는 현재 head로 치환하지 않고 보관 원문을 유지한다',async()=>{
 for(const mode of ['REVISION','TRACE']as const){const f=await revisionFixture(),b=await prepareStoredWorkPlan(f.client,pid,f.plan.ref,f.session,mode);assert.equal(b.baseVersion,1);assert.deepEqual(b.workPlanState?.input.documentRef,ref);assert.equal(b.workPlanState?.result?.ref.id,mode==='TRACE'?planId:undefined);assert(!f.calls.some(p=>p.includes('/documents?')));}
});
test('단계 사이 주체·transport·화면 수명이 바뀌면 후속 GET과 준비를 중단한다',async()=>{
 for(const change of ['USER','TRANSPORT','ACTIVE']){const f=await revisionFixture();let active=true;f.controls.after=path=>{if(path.includes('/work-plans/')){if(change==='USER')f.session.user.id=planId;if(change==='TRANSPORT')f.client.transport=async()=>{throw Error('새 transport 호출 금지');};if(change==='ACTIVE')active=false;}};
 await assert.rejects(prepareStoredWorkPlan(f.client,pid,f.plan.ref,f.session,'REVISION',{documentVersion:2,active:()=>active}));assert.equal(f.calls.length,1);}
});
test('잘못된 명시 버전은 GET 전에 거절하고 선택 버전을 최신 head로 치환하지 않는다',async()=>{
 for(const documentVersion of [0,-1,1.5,NaN,Number.MAX_SAFE_INTEGER+1]){const f=await revisionFixture();await assert.rejects(prepareStoredWorkPlan(f.client,pid,f.plan.ref,f.session,'REVISION',{documentVersion}));assert.equal(f.calls.length,0);}
 const f=await revisionFixture();f.controls.head=3;await assert.rejects(prepareStoredWorkPlan(f.client,pid,f.plan.ref,f.session,'REVISION',{documentVersion:2}),{code:'VERSION_CONFLICT',status:409});assert(!f.calls.some(p=>p.endsWith('/documents/'+id+'/versions/3')));
});
test('현재 문서 목록은 최대 4페이지이며 찾지 못한 버전을 추정하지 않는다',async()=>{
 const f=await revisionFixture(),original=f.client.transport;let pages=0;f.client.transport=async(p,init)=>String(p).includes('/documents?')?(pages++,Response.json({items:[],hasMore:true,nextCursor:'page_'+pages,observedAt:'2026-11-17T00:00:00.000Z'})):original(p,init);
 await assert.rejects(prepareStoredWorkPlan(f.client,pid,f.plan.ref,f.session,'REVISION',{documentVersion:2}),{code:'DOCUMENT_COMPARISON_WINDOW_EXCEEDED'});assert.equal(pages,4);
});
