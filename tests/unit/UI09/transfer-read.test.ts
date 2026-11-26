import assert from 'node:assert/strict';
import test from 'node:test';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {transferFixture,pid} from './transfer-fixture.ts';
const mod:any=await import('../../../apps/web/src/features/transfers/transfer-read.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
function fixture(){const f=transferFixture(),calls:string[]=[];let after=()=>{};const client=new ApiClient(async(url,options)=>{assert.equal(options?.method??'GET','GET');const path=new URL(String(url),'https://localhost:3830').pathname;calls.push(path);const value=f.responses[path.slice(('/api/v1/projects/'+pid+'/').length)];assert(value,'정의되지 않은 요청');after();return Response.json(value);});return{...f,client,calls,after:(fn:()=>void)=>after=fn};}
test('인계 기록은 기존 고정 임무와 그 확정본의 맥락 목록만 읽으며 누락·미확인 그대로 반환한다',async()=>{assert.equal(typeof mod.readTransferRecords,'function');const f=fixture(),v=await mod.readTransferRecords(f.client,pid,f.draft.ref);assert.equal(f.calls.length,5);assert.deepEqual(v.detail.draft,f.draft);assert.deepEqual(v.contexts.assignmentRef,f.confirmed.ref);assert.equal(v.contexts.items[0].missingRequired.length,7);assert.equal(v.contexts.hasMore,true);assert.equal(v.contexts.ready,false);});
test('선택 이탈 뒤 후속 맥락 조회를 시작하지 않으며 다른 임무 맥락 원문도 거절한다',async()=>{assert.equal(typeof mod.readTransferRecords,'function');assert.equal(typeof mod.readTransferContext,'function');const f=fixture();let active=true;f.after(()=>active=false);assert.equal(await mod.readTransferRecords(f.client,pid,f.draft.ref,()=>active),null);assert.equal(f.calls.length,1);const g=fixture();await assert.rejects(mod.readTransferContext(g.client,pid,{...g.confirmed.ref,contentHash:'f'.repeat(64)},g.context.ref),{code:'TRANSFER_CONTEXT_ASSIGNMENT_MISMATCH'});assert.equal(g.calls.length,1);});
test('인계 원문 무결성·권한 거절을 정상이나 빈 목록으로 바꾸지 않는다',async()=>{assert.equal(typeof mod.readTransferContext,'function');const f=fixture();(f.context.manifest as any).preparationInput.reason='변조';await assert.rejects(mod.readTransferContext(f.client,pid,f.confirmed.ref,f.context.ref),{code:'CONTEXT_INTEGRITY_FAILED'});const denied=new ApiClient(async()=>Response.json({code:'ACCESS_DENIED'},{status:403}));await assert.rejects(mod.readTransferRecords(denied,pid,f.draft.ref),{status:403});});

test('인계 기록은 과거 등록형 정의를 같은 원본으로 가져오고 이탈한 경우 후속 맥락을 읽지 않는다',async()=>{
 for(const leaves of [false,true]){
  const f=fixture(),hash=(v:unknown)=>contentHash(canonicalJson(v)),at=f.draft.observedAt,reference=f.draft.ref;
  const definition={id:'55555555-5555-4555-8555-555555555555',version:1,status:'NOT_READY',label:'과거 인계 연결',toolProduct:'합성 등록 도구',toolVersion:'v1',adapterKind:'CLI',connectorId:null,accountRef:null,modelOptions:{},environmentRef:null,policyRef:reference,capabilityReportRef:null};
  const ref={id:definition.id,version:1,contentHash:hash(definition)},role={kind:'COORDINATOR',stageRef:null,parentRoleRef:null,reason:'총괄',definedBy:{kind:'HUMAN',userId:pid},definedAt:at};
  const roleRef={...reference,contentHash:hash(role)},binding={assignmentRef:f.confirmed.ref,roleRef,connectionKind:'REGISTERED_DEFINITION',connectionRef:ref,existingSessionBindingRef:null,reason:'이전 도구 예약',sessionRef:reference,generation:1,state:'RESERVED',externalSessionHandleRef:null,connectionReadiness:'REGISTERED_DEFINITION_ONLY',executionAuthorized:false,dispatchPerformed:false,boundBy:{kind:'HUMAN',userId:pid},boundAt:at};
  Object.assign(f.state,{roles:[{projectId:pid,ref:roleRef,snapshot:role}],bindings:[{projectId:pid,ref:{id:'66666666-6666-4666-8666-666666666666',version:1,contentHash:hash(binding)},snapshot:binding}]});
  const path=`connections/${ref.id}/versions/1`,definitionView={projectId:pid,ref,definition,observedAt:at,currentStatus:{headVersion:2,configurationCurrent:false,support:'UNVERIFIED',executionAuthorized:false}};
  f.responses[path]=definitionView;
  let active=true;
  f.after(()=>{if(leaves&&f.calls.at(-1)?.endsWith(path))active=false;});
  const result=await mod.readTransferRecords(f.client,pid,f.draft.ref,()=>active);
  assert.equal(f.calls.filter(p=>p.endsWith(path)).length,1);
  assert.equal(f.calls.some(p=>p.includes('/connection-candidates/')),false);
  if(leaves){assert.equal(result,null);assert.equal(f.calls.length,5);}
  else{assert.deepEqual(result.detail.tools,[{kind:'REGISTERED_DEFINITION',connectionRef:ref,value:definitionView,error:null}]);assert.deepEqual(result.contexts.assignmentRef,f.confirmed.ref);assert.equal(f.calls.length,6);}
 }
});
