import test from 'node:test';import assert from 'node:assert/strict';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {newCandidate,prepareCandidate,readCandidate} from '../../../apps/web/src/features/connections/api.ts';
import {readCandidateInput,candidateCapabilities,candidateReadiness} from '../../../apps/server/modules/connections/candidate-input.ts';
const module:any=await import('../../../apps/web/src/features/connections/candidate-documentation.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const pid='11111111-1111-4111-8111-111111111111',uid='22222222-2222-4222-8222-222222222222',id='33333333-3333-4333-8333-333333333333',session={user:{id:uid},clientId:uid,csrfToken:'C'.repeat(43)},ref={id,version:1,contentHash:'a'.repeat(64)},now=new Date('2026-10-20T12:00:00.000Z');
const change=(...args:any[])=>{assert.equal(typeof module.changeCandidateDocumentation,'function');return module.changeCandidateDocumentation(...args);};
const doc={source:'https://example.test/reference',observedAt:'2026-10-20T11:00:00.000Z',versionCompatibility:'CONFIRMED'};
function input(candidate:any){return{kind:'CONNECTION_CANDIDATE',candidate,candidateRef:null,policyRef:ref,expiresAt:'2027-01-01T00:00:00.000Z',reason:'문서 근거 보관'};}
test('능력별 문서 근거를 기존 후보 명령/서버 parser/고정 조회에 전달하되 실측·통제는 미확인이다',async()=>{
 const original={label:'설치된 도구',toolVersion:'1.0'},candidate=change(original,'INSTRUCTION_SESSION',doc);assert.deepEqual(original,{label:'설치된 도구',toolVersion:'1.0'});
 assert.deepEqual(candidate.documentation,[{code:'INSTRUCTION_SESSION',...doc}]);const b=newCandidate(pid,session,1,'CONNECTION_CANDIDATE');b.input=input(candidate) as any;
 const command=await prepareCandidate(b,session);assert.deepEqual(command.payload.candidate,candidate);const parsed=readCandidateInput('registerConnection',command.payload,{now,policyExpiresAt:new Date('2027-01-02T00:00:00.000Z')});
 const snapshot={kind:parsed.kind,input:parsed,readiness:candidateReadiness(parsed),capabilities:candidateCapabilities(parsed)},fixed={id,version:1,contentHash:contentHash(canonicalJson(snapshot))};
 const view=await readCandidate(new ApiClient(async(url,init)=>{assert.equal(url,'/api/v1/projects/'+pid+'/connection-candidates/'+id+'/versions/1');assert.equal(init?.method,'GET');return Response.json({ref:fixed,candidate:snapshot,expired:false,createdAt:now.toISOString(),recordedBy:uid,executionAuthorized:false,observedAt:now.toISOString()});}),pid,fixed);
 assert.deepEqual(view.candidate.input.candidate.documentation,[{code:'INSTRUCTION_SESSION',...doc}]);assert.equal(view.candidate.capabilities[0]!.documentation?.sourceKind,'USER_REPORTED');assert.equal(view.candidate.capabilities[0]!.documentation?.versionCompatibility,'CONFIRMED');assert.ok(view.candidate.capabilities.every(c=>c.measurement.state==='UNVERIFIED'&&c.controlLevel==='UNVERIFIED'&&c.measurement.executionRef===null));assert.equal(view.candidate.readiness.state,'NOT_READY');assert.equal(view.executionAuthorized,false);
});
test('개별 근거 수정/해제는 다른 근거·제품·참조를 보존하고 명시 빈 목록과 원본을 구분한다',()=>{
 const first=change({label:'도구',environmentRef:ref},'STOP_RECLAIM',doc),second=change(first,'RESULT_EVIDENCE',{...doc,versionCompatibility:'UNSUPPORTED'}),before=structuredClone(second);
 const revised=change(second,'STOP_RECLAIM',{source:'https://example.test/revised'});assert.deepEqual(second,before);assert.deepEqual(revised.documentation[0],{code:'STOP_RECLAIM',...doc,source:'https://example.test/revised'});assert.deepEqual(revised.documentation[1],before.documentation[1]);assert.deepEqual(revised.environmentRef,ref);
 const removed=change(revised,'STOP_RECLAIM',null);assert.deepEqual(removed.documentation,[before.documentation[1]]);assert.deepEqual(change(removed,'RESULT_EVIDENCE',null).documentation,[]);assert.notEqual(revised.environmentRef,ref);
});
test('모르는 능력/주장 필드·중복은 편집에서 거절하고 비HTTPS·인증정보·미래 확인은 기존 저장 계약이 거절한다',async()=>{
 for(const [candidate,code,patch]of [[{label:'도구'},'UNKNOWN',doc],[{label:'도구'},'STOP_RECLAIM',{measurement:'VERIFIED'}],[{label:'도구',documentation:[{code:'STOP_RECLAIM',...doc},{code:'STOP_RECLAIM',...doc}]},'STOP_RECLAIM',doc]])assert.throws(()=>change(candidate,code,patch),e=>(e as any).code==='CANDIDATE_DOCUMENTATION_EDIT_INVALID');
 for(const source of ['http://example.test/doc','https://user:password@example.test/doc','https://example.test/doc?api_key=not-a-real-key']){const b=newCandidate(pid,session,1,'CONNECTION_CANDIDATE');b.input=input(change({label:'도구'},'STOP_RECLAIM',{...doc,source})) as any;await assert.rejects(prepareCandidate(b,session),e=>(e as any).code==='CANDIDATE_INPUT_INVALID');}
 const future=input(change({label:'도구'},'STOP_RECLAIM',{...doc,observedAt:'2026-10-20T13:00:00.000Z'}));assert.throws(()=>readCandidateInput('registerConnection',future,{now,policyExpiresAt:new Date('2027-01-02T00:00:00.000Z')}),e=>(e as Error).message==='CANDIDATE_DOCUMENTATION_INVALID');
});
