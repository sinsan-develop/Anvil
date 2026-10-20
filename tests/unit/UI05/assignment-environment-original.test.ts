import assert from 'node:assert/strict';
import test from 'node:test';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {environmentOriginal,environmentProject as pid,environmentId} from './environment-original-fixture.ts';
const module:any=await import('../../../apps/web/src/features/session-detail/assignment-environment-original.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const assignmentRef={id:pid,version:3,contentHash:'b'.repeat(64)};
test('임무에 고정된 과거 환경 후보를 정확 GET으로 읽고 만료/미확인·비실행을 유지한다',async()=>{
 assert.equal(typeof module.readAssignmentEnvironmentOriginal,'function');const v=environmentOriginal(),calls:unknown[]=[];
 const result=await module.readAssignmentEnvironmentOriginal(new ApiClient(async(url,init)=>{calls.push([url,init?.method]);return Response.json(v);}),pid,assignmentRef,v.ref);
 assert.deepEqual(calls,[[`/api/v1/projects/${pid}/connection-candidates/${environmentId}/versions/2`,'GET']]);assert.deepEqual(result,v);assert.equal(result.expired,true);assert.equal(result.executionAuthorized,false);
});
test('다른 종류/hash·403과 잘못된 임무ref는 원문으로 채택하지 않는다',async()=>{
 assert.equal(typeof module.readAssignmentEnvironmentOriginal,'function');
 for(const mode of ['KIND','HASH','DENIED','REF']){const value=environmentOriginal(mode==='KIND'?'CONNECTION_CANDIDATE':'ENVIRONMENT_CANDIDATE'),selected={...value.ref};if(mode==='HASH')selected.contentHash='0'.repeat(64);let calls=0;
 await assert.rejects(module.readAssignmentEnvironmentOriginal(new ApiClient(async()=>{calls++;return mode==='DENIED'?Response.json({code:'ACCESS_DENIED'},{status:403}):Response.json(value);}),pid,mode==='REF'?{...assignmentRef,id:'../other'}:assignmentRef,selected));if(mode==='REF')assert.equal(calls,0);
 }
});
test('닫기·임무 교체 이후 지연 응답과 요청 전 이탈은 반영하지 않는다',async()=>{
 assert.equal(typeof module.readAssignmentEnvironmentOriginal,'function');const value=environmentOriginal();let active=true,reads=0,release:()=>void=()=>{};const pending=new Promise<void>(r=>release=r);
 const client=new ApiClient(async()=>{reads++;await pending;return Response.json(value);});
 const result=module.readAssignmentEnvironmentOriginal(client,pid,assignmentRef,value.ref,()=>active);active=false;release();assert.equal(await result,null);assert.equal(reads,1);
 assert.equal(await module.readAssignmentEnvironmentOriginal(client,pid,assignmentRef,value.ref,()=>false),null);assert.equal(reads,1);
});
