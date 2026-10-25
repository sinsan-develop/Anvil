import assert from 'node:assert/strict';
import test from 'node:test';
import {ApiClient,ApiError} from '../../../apps/web/src/api/client.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
const module=await import(new URL('../../../apps/web/src/features/project-create/pinned-method-requirements-read.ts',import.meta.url).href).catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND')return null;throw error;});
const id='a6f20390-0000-4000-8000-000000000001';
const graph={nodes:[{nodeId:'N1',name:'구현',purpose:'요구 확인',kind:'HUMAN',position:{x:0,y:0},role:'USER',mode:'CASE_BY_CASE',inputs:[],outputs:[],taskScope:{included:[],excluded:[]},completionCriteria:[],approvalBoundary:[],limitPolicyRef:null,recordRequirements:[],requirements:{capabilities:['코딩 능력'],environment:['Windows']}}],edges:[],entryNodeId:'N1',terminalNodeIds:['N1']};
const value={ref:{id,version:2,contentHash:contentHash(canonicalJson(graph))},name:'고정 이름',purpose:'고정 목적',scope:'USER_COMMON',systemCode:null,graph,confirmation:null,validation:{validForConfirmation:false,issues:[]},runtimeReadiness:'PROJECT_BINDINGS_REQUIRED'};
function reader(){assert.equal(typeof module?.readPinnedMethodRequirements,'function');return module!.readPinnedMethodRequirements;}
const invalid=(cause:unknown)=>cause instanceof ApiError&&cause.code==='RESPONSE_INVALID';

test('고정 ref만으로 정확 버전 GET을 사용하고 요구 원문·입력·POST0을 보존한다',async()=>{
 const read=reader(),before=structuredClone(value),calls:string[]=[];
 const client=new ApiClient(async(path,init)=>{calls.push(`${init?.method} ${path}`);return Response.json(value);});
 assert.deepEqual(await read(client,value.ref),value);
 assert.deepEqual(calls,[`GET /api/v1/methodologies/${id}/versions/2`]);assert.deepEqual(value,before);
 assert.deepEqual(await read(new ApiClient(async()=>Response.json({...value,scope:'SYSTEM',systemCode:'SYS-M01'})),value.ref),{...value,scope:'SYSTEM',systemCode:'SYS-M01'});
});

test('위장 경로·버전·hash와 추가 ref 필드는 GET 전에 거절한다',async()=>{
 const read=reader();let calls=0;const client=new ApiClient(async()=>{calls++;return Response.json(value);});
 for(const ref of [null,{...value.ref,id:'../other'},{...value.ref,version:0},{...value.ref,version:1.5},{...value.ref,contentHash:'bad'},{...value.ref,url:'https://invalid.test'}])await assert.rejects(read(client,ref));
 assert.equal(calls,0);
});

test('응답 exact ref·scope/systemCode·기존 graph shape와 canonical hash 불일치는 원문으로 채택하지 않는다',async()=>{
 const read=reader();
 for(const patch of [{ref:{...value.ref,id:'a6f20390-0000-4000-8000-000000000002'}},{ref:{...value.ref,version:3}},{ref:{...value.ref,contentHash:'0'.repeat(64)}},{scope:'PROJECT'},{scope:'SYSTEM',systemCode:null},{scope:'USER_COMMON',systemCode:'SYS-M01'},{scope:'SYSTEM',systemCode:''},{name:null},{purpose:null},{graph:{...graph,entryNodeId:'changed'}},{graph:{...graph,nodes:[{...graph.nodes[0],requirements:{capabilities:null,environment:[]}}]}}])await assert.rejects(read(new ApiClient(async()=>Response.json({...value,...patch})),value.ref),invalid);
});

test('403/404/401을 성공 원문으로 바꾸거나 재조회하지 않는다',async()=>{
 const read=reader();
 for(const status of [403,404,401]){let calls=0;await assert.rejects(read(new ApiClient(async()=>{calls++;return Response.json({code:status===401?'AUTH_REQUIRED':'ACCESS_DENIED'},{status});}),value.ref),(cause:unknown)=>cause instanceof ApiError&&cause.status===status);assert.equal(calls,1);}
});

test('문맥이 끝난 뒤의 늦은 JSON은 hash를 시작하지 않고 결과를 폐기한다',async()=>{
 const read=reader();let active=true,release!:()=>void,jsonStarted!:()=>void;const started=new Promise<void>(resolve=>jsonStarted=resolve),wait=new Promise<void>(resolve=>release=resolve);
 const client=new ApiClient(async()=>{const response=Response.json(value);response.json=async()=>{jsonStarted();await wait;return value;};return response;});
 const original=crypto.subtle.digest;let digests=0;crypto.subtle.digest=(...args)=>{digests++;return original.apply(crypto.subtle,args);};
 try{const pending=read(client,value.ref,()=>active);await started;active=false;release();assert.equal(await pending,null);assert.equal(digests,0);}finally{crypto.subtle.digest=original;}
});

test('늦은 hash도 폐기하고 같은 ref 재진입은 이전 attempt를 수용하지 않는다',async()=>{
 const read=reader();let attempt=1,release!:(value:ArrayBuffer)=>void,digestStarted!:()=>void;const started=new Promise<void>(resolve=>digestStarted=resolve),original=crypto.subtle.digest;
 crypto.subtle.digest=async(...args)=>{const hash=await original.apply(crypto.subtle,args);digestStarted();return new Promise<ArrayBuffer>(resolve=>release=()=>resolve(hash));};
 try{const pending=read(new ApiClient(async()=>Response.json(value)),value.ref,()=>attempt===1);await started;attempt=2;release(new ArrayBuffer(0));assert.equal(await pending,null);}finally{crypto.subtle.digest=original;}
 const client=new ApiClient(async()=>Response.json(value));assert.deepEqual(await read(client,value.ref,()=>attempt===2),value);let calls=0;assert.equal(await read(new ApiClient(async()=>{calls++;return Response.json(value);}),value.ref,()=>false),null);assert.equal(calls,0);
});
