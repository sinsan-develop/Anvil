import assert from 'node:assert/strict';
import test from 'node:test';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {reworkFixture} from '../FN12/result-rework-input-fixture.ts';
import {criteriaId as id,criteriaRef as ref} from '../FN12/result-criteria-fixture.ts';
const mod:any=await import('../../../apps/web/src/features/session-detail/result-rework-api.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
function fixture(){const f=reworkFixture(),s=f.sources,session:any={user:{id:id(6)},clientId:id(24),csrfToken:'C'.repeat(43)},response={status:'REWORK_ASSIGNMENT_DRAFT',scope:structuredClone(s.result.snapshot.scope),originalResultRef:structuredClone(s.result.ref),criteriaRef:structuredClone(s.criteria.ref),reviewRef:structuredClone(s.review.ref),responsibleBindingRef:structuredClone(s.binding.ref),roleRef:structuredClone(s.role.ref),stageSessionRef:structuredClone(s.binding.snapshot.sessionRef),missingItems:['save'],preservedItems:[],remainingMissingItems:['denied'],sourceScopes:structuredClone(f.input.sourceScopes),reason:f.input.reason,scopeVerification:'ASSIGNMENT_SUBSET_ONLY_NOT_OS_VERIFIED',preparedAt:f.now,reworkStored:false,currentBindingVerified:false,currentAuthorityVerified:false,completionAccepted:false,formalFailureCounted:false,executionAuthorized:false,dispatchPerformed:false};return{...f,session,response};}
async function prepare(f:ReturnType<typeof fixture>,client:ApiClient,active=()=>true){assert.equal(typeof mod.prepareResultReworkDraft,'function','화면 보완 초안 소비 미구현');return mod.prepareResultReworkDraft(client,f.sources.assignment,f.sources.result,f.sources.review,f.sources.binding,f.input,f.session,active);}
test('사용자 선택 부족항목/허용범위와 같은 예약세션으로만 same-origin 준비를 요청한다',async()=>{const f=fixture(),requests:any[]=[];assert.deepEqual(await prepare(f,new ApiClient(async(url,options)=>{requests.push({url,options});return Response.json(f.response);})),f.response);assert.equal(requests.length,1);const q=requests[0];assert.equal(q.url,`/api/v1/projects/${f.sources.assignment.projectId}/result-reworks/prepare`);assert.equal(q.options.method,'POST');assert.equal(new Headers(q.options.headers).get('x-anvil-csrf'),f.session.csrfToken);assert.deepEqual(JSON.parse(q.options.body),f.input);});
test('다른세션/조건/범위·저장/권한/실행 승격 응답과 미달아닌 선택은 거절한다',async()=>{for(const change of [(v:any)=>v.stageSessionRef=ref(99),(v:any)=>v.missingItems=['denied'],(v:any)=>v.sourceScopes[0].targets[0].access='WRITE',(v:any)=>v.currentBindingVerified=true,(v:any)=>v.reworkStored=true,(v:any)=>v.dispatchPerformed=true]){const f=fixture();change(f.response);await assert.rejects(prepare(f,new ApiClient(async()=>Response.json(f.response))),(e:any)=>e.code==='RESULT_REWORK_RESPONSE_INVALID');}const f=fixture();f.input.missingItems=['unknown'];let calls=0;await assert.rejects(prepare(f,new ApiClient(async()=>{calls++;return Response.json(f.response);})),(e:any)=>e.code==='RESULT_REWORK_INPUT_INVALID');assert.equal(calls,0);});
test('403·화면이탈은 초안을 노출하지 않고 비동기 caller 변경도 원요청과 섞지 않는다',async()=>{const f=fixture();await assert.rejects(prepare(f,new ApiClient(async()=>Response.json({code:'ACCESS_DENIED'},{status:403}))),(e:any)=>e.status===403);let active=true;assert.equal(await prepare(f,new ApiClient(async()=>{active=false;return Response.json(f.response);}),()=>active),null);assert.equal(await prepare(f,new ApiClient(async()=>{throw Error('호출 금지');}),()=>false),null);const g=fixture(),expected=structuredClone(g.response);assert.deepEqual(await prepare(g,new ApiClient(async()=>{g.input.missingItems=['unknown'];g.sources.binding.snapshot.sessionRef=ref(99);return Response.json(expected);})),expected);});

async function registeredFixture(){
 const f=fixture(),{criteriaHash:hash}=await import('../FN12/result-criteria-fixture.ts');
 Object.assign(f.sources.binding.snapshot,{connectionKind:'REGISTERED_DEFINITION',connectionReadiness:'REGISTERED_DEFINITION_ONLY'});
 f.sources.binding.ref.contentHash=hash(f.sources.binding.snapshot);f.input.responsibleBindingRef=structuredClone(f.sources.binding.ref);
 return f;
}
test('등록정의 예약은 기존 서버 pure 준비 계약을 같은 원문 POST로 소비한다',async()=>{
 const f=await registeredFixture(),{prepareResultRework}=await import('../../../apps/server/modules/results/result-rework-input.ts');let posts=0;
 const expected=prepareResultRework(f.sources,f.input,f.now),value=await prepare(f,new ApiClient(async(url,options)=>{
  posts++;assert.equal(url,`/api/v1/projects/${f.sources.assignment.projectId}/result-reworks/prepare`);assert.equal(options?.method,'POST');assert.equal(options?.credentials,'same-origin');assert.equal(new Headers(options?.headers).get('X-Anvil-CSRF'),f.session.csrfToken);
  const input=JSON.parse(String(options?.body));assert.deepEqual(input,f.input);return Response.json(prepareResultRework(f.sources,input,f.now));
 }));
 assert.deepEqual(value,expected);assert.equal(posts,1);assert.equal(value.currentAuthorityVerified,false);assert.equal(value.completionAccepted,false);assert.equal(value.executionAuthorized,false);
});
test('해시가 정상이어도 unknown own kind와 종류·readiness 교차는 준비 POST0이다',async()=>{
 const {criteriaHash:hash}=await import('../FN12/result-criteria-fixture.ts');
 for(const [kind,readiness] of [['REGISTERED_DEFINITION','CANDIDATE_ONLY'],[undefined,'REGISTERED_DEFINITION_ONLY'],['OTHER','CANDIDATE_ONLY'],[null,'CANDIDATE_ONLY']] as const){
  const f=fixture(),snapshot:any=f.sources.binding.snapshot;if(kind!==undefined)snapshot.connectionKind=kind;snapshot.connectionReadiness=readiness;
  f.sources.binding.ref.contentHash=hash(snapshot);f.input.responsibleBindingRef=structuredClone(f.sources.binding.ref);let posts=0;
  await assert.rejects(prepare(f,new ApiClient(async()=>{posts++;return Response.json(f.response);})),(e:any)=>e.code==='RESULT_REWORK_INPUT_INVALID');assert.equal(posts,0);
 }
});
test('등록정의 예약의 true 표식·403·늦은 scope 결과도 권위나 초안으로 채택하지 않는다',async()=>{
 const {criteriaHash:hash}=await import('../FN12/result-criteria-fixture.ts');
 for(const key of ['executionAuthorized','dispatchPerformed'] as const){const f=await registeredFixture();(f.sources.binding.snapshot as any)[key]=true;f.sources.binding.ref.contentHash=hash(f.sources.binding.snapshot);f.input.responsibleBindingRef=structuredClone(f.sources.binding.ref);let posts=0;await assert.rejects(prepare(f,new ApiClient(async()=>{posts++;return Response.json(f.response);})));assert.equal(posts,0);}
 const f=await registeredFixture();await assert.rejects(prepare(f,new ApiClient(async()=>Response.json({code:'ACCESS_DENIED'},{status:403}))),(e:any)=>e.status===403);
 const {prepareResultRework}=await import('../../../apps/server/modules/results/result-rework-input.ts');let active=true;
 assert.equal(await prepare(f,new ApiClient(async()=>{active=false;return Response.json(prepareResultRework(f.sources,f.input,f.now));}),()=>active),null);
});
