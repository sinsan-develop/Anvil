import assert from 'node:assert/strict';
import test from 'node:test';
import {ApiClient,ApiError} from '../../../apps/web/src/api/client.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
const module=await import(new URL('../../../apps/web/src/features/methodology-editor/common-method-version-read.ts',import.meta.url).href).catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return null;throw e;});
const id='a6f20390-0000-4000-8000-000000000001',graph={nodes:[],edges:[],entryNodeId:'',terminalNodeIds:[]};
const value={ref:{id,version:1,contentHash:contentHash(canonicalJson(graph))},name:'과거 이름',purpose:'과거 목적',scope:'USER_COMMON',systemCode:null,graph,confirmation:null,validation:{validForConfirmation:false,issues:[]},runtimeReadiness:'PROJECT_BINDINGS_REQUIRED'};
const selected={ref:{id,version:2,contentHash:'a'.repeat(64)},name:'현재 이름',purpose:'현재 목적',scope:'USER_COMMON' as const,systemCode:null,status:'DRAFT' as const,sourceAvailable:false};
test('공통 과거 원본의 id/버전/scope·그래프hash를 확인하고 이름/목적 개정은 허용한다',async()=>{
 assert.equal(typeof module?.readCommonMethodAtVersion,'function');let calls=0;const client=new ApiClient(async(path,init)=>{calls++;assert.equal(path,`/api/v1/methodologies/${id}/versions/1`);assert.equal(init?.method,'GET');return Response.json(value);});assert.deepEqual(await module!.readCommonMethodAtVersion(client,selected,1),value);assert.equal(calls,1);
});
test('위장 id/버전/scope/systemCode·hash변조·본문 불일치와 서버거절은 성공으로 표시하지 않는다',async()=>{
 assert.equal(typeof module?.readCommonMethodAtVersion,'function');
 for(const patch of [{ref:{...value.ref,id:'a6f20390-0000-4000-8000-000000000002'}},{ref:{...value.ref,version:2}},{scope:'PROJECT'},{systemCode:'SYS-M01'},{ref:{...value.ref,contentHash:'0'.repeat(64)}},{graph:{...graph,entryNodeId:'changed'}}])await assert.rejects(module!.readCommonMethodAtVersion(new ApiClient(async()=>Response.json({...value,...patch})),selected,1));
 await assert.rejects(module!.readCommonMethodAtVersion(new ApiClient(async()=>Response.json({code:'ACCESS_DENIED'},{status:403})),selected,1),(e:unknown)=>e instanceof ApiError&&e.status===403);
});
test('선택 목록 버전 밖·별칭id·scope는 조회 전에 거절한다',async()=>{
 assert.equal(typeof module?.readCommonMethodAtVersion,'function');let calls=0;const client=new ApiClient(async()=>{calls++;return Response.json(value);});for(const n of [0,-1,1.5,3,NaN])await assert.rejects(module!.readCommonMethodAtVersion(client,selected,n));await assert.rejects(module!.readCommonMethodAtVersion(client,{...selected,ref:{...selected.ref,id:'../other'}},1));await assert.rejects(module!.readCommonMethodAtVersion(client,{...selected,scope:'PROJECT'},1));assert.equal(calls,0);
});
test('목록과 같은 버전은 다른 본문에 재계산한 hash나 다른 이름·목적을 붙여도 수용하지 않는다',async()=>{
 assert.equal(typeof module?.readCommonMethodAtVersion,'function');
 const stable={...value,name:selected.name,purpose:selected.purpose,ref:{...value.ref,version:2}},known={...selected,ref:stable.ref},changedGraph={...graph,entryNodeId:'changed'};
 assert.deepEqual(await module!.readCommonMethodAtVersion(new ApiClient(async()=>Response.json(stable)),known,2),stable);
 for(const altered of [{...stable,graph:changedGraph,ref:{...stable.ref,contentHash:contentHash(canonicalJson(changedGraph))}},{...stable,name:'동일 버전 이름 변조'},{...stable,purpose:'동일 버전 목적 변조'}])await assert.rejects(module!.readCommonMethodAtVersion(new ApiClient(async()=>Response.json(altered)),known,2));
});
