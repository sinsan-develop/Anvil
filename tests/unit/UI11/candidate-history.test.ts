import test from 'node:test';import assert from 'node:assert/strict';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {candidateCapabilities,candidateReadiness} from '../../../apps/server/modules/connections/candidate-input.ts';
const module:any=await import('../../../apps/web/src/features/connections/candidate-history.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const pid='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222',uid='33333333-3333-4333-8333-333333333333',policyRef={id:uid,version:1,contentHash:'a'.repeat(64)};
function fixture(kind:'CONNECTION_CANDIDATE'|'ENVIRONMENT_CANDIDATE'='CONNECTION_CANDIDATE'){
 const input={kind,candidate:{label:'처음 보관한 후보'},candidateRef:null,policyRef,expiresAt:'2026-10-17T01:00:00.000Z',reason:'역사 보존'},candidate={kind,input,readiness:candidateReadiness(input),capabilities:candidateCapabilities(input)},ref={id,version:1,contentHash:contentHash(canonicalJson(candidate))};
 const parent={ref,candidate,expired:true,createdAt:'2026-10-17T00:00:00.000Z',recordedBy:uid,executionAuthorized:false,observedAt:'2026-10-20T00:00:00.000Z'},childCandidate={...candidate,kind:'CONNECTION_CANDIDATE',input:{...input,kind:'CONNECTION_CANDIDATE',candidate:{label:'개정 후보'},candidateRef:ref}},child={...parent,candidate:childCandidate,ref:{id,version:2,contentHash:contentHash(canonicalJson(childCandidate))}};return{parent,child};
}
const read=(...args:any[])=>{assert.equal(typeof module.readPreviousCandidate,'function');return module.readPreviousCandidate(...args);};
test('정확 동일 후보의 직전 버전/hash만 기존 보호 GET으로 읽으며 만료 이력도 실행 불가로 보존한다',async()=>{
 const f=fixture(),before=structuredClone(f.child),calls:any[]=[];
 const value=await read(new ApiClient(async(url,init)=>{calls.push([url,init?.method,init?.credentials]);return Response.json(f.parent);}),pid,f.child,()=>true);
 assert.deepEqual(calls,[['/api/v1/projects/'+pid+'/connection-candidates/'+id+'/versions/1','GET','same-origin']]);assert.deepEqual(value,f.parent);assert.deepEqual(f.child,before);assert.equal(value.expired,true);assert.equal(value.executionAuthorized,false);assert.equal(value.candidate.readiness.state,'NOT_READY');
});
test('자기/다른 후보·건너뛴 버전·이상 참조는 조회 전 거절하고 최초 버전·이탈은 조회하지 않는다',async()=>{
 for(const parent of [{id,version:2,contentHash:'a'.repeat(64)},{id:uid,version:1,contentHash:'a'.repeat(64)},{id,version:0,contentHash:'a'.repeat(64)},null,{id,version:1,contentHash:'bad'}]){const f=fixture();(f.child.candidate.input as any).candidateRef=parent;await assert.rejects(read(new ApiClient(async()=>assert.fail('GET')),pid,f.child,()=>true),e=>(e as any).code==='CANDIDATE_HISTORY_REFERENCE_INVALID');}
 const f=fixture();assert.equal(await read(new ApiClient(async()=>assert.fail('GET')),pid,f.parent,()=>true),null);assert.equal(await read(new ApiClient(async()=>assert.fail('GET')),pid,f.child,()=>false),null);
});
test('이전 원문 403·다른 hash/종류는 채택하지 않고 지연 이탈 응답도 버린다',async()=>{
 const f=fixture();await assert.rejects(read(new ApiClient(async()=>Response.json({code:'PROJECT_READ_DENIED'},{status:403})),pid,f.child,()=>true),e=>(e as any).code==='PROJECT_READ_DENIED');
 await assert.rejects(read(new ApiClient(async()=>Response.json({...f.parent,ref:{...f.parent.ref,contentHash:'b'.repeat(64)}})),pid,f.child,()=>true),e=>(e as any).code==='RESPONSE_INVALID');
 const wrong=fixture('ENVIRONMENT_CANDIDATE');await assert.rejects(read(new ApiClient(async()=>Response.json(wrong.parent)),pid,wrong.child,()=>true),e=>(e as any).code==='CANDIDATE_HISTORY_KIND_MISMATCH');
 let active=true;assert.equal(await read(new ApiClient(async()=>{active=false;return Response.json(f.parent);}),pid,f.child,()=>active),null);
});
