import assert from 'node:assert/strict';
import test from 'node:test';
import {ApiClient,ApiError} from '../../../apps/web/src/api/client.ts';
import * as api from '../../../apps/web/src/features/methodology-editor/project-api.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
const pid='a6f20000-0000-4000-8000-000000000010',uid='a6f20000-0000-4000-8000-000000000011',cid='a6f20000-0000-4000-8000-000000000012',mid='a6f20000-0000-4000-8000-000000000013',aid='a6f20000-0000-4000-8000-000000000014';
const session={user:{id:uid},clientId:cid,csrfToken:'A'.repeat(43)},graph={nodes:[],edges:[],entryNodeId:'',terminalNodeIds:[]},sourceRef={id:mid,version:2,contentHash:contentHash(canonicalJson(graph))};
const project={id:pid,currentMethodologyRef:null,participation:'OWNER',controlState:{actorId:uid,clientId:cid,generation:7,status:'HELD'}};
function receipt(request:any){const snapshot={name:'확정 절차',purpose:'별도 적용',graph,sourceRef},ref={id:aid,version:1,contentHash:contentHash(canonicalJson(snapshot))};return {operationId:aid,commandId:request.commandId,projectId:pid,status:'APPLIED',targetId:aid,version:1,data:{ref,status:'METHODOLOGY_APPLIED',snapshot,reason:request.payload.reason,previousApplicationRef:null},serverReceivedAt:'2026-10-20T00:00:00.000Z'};}
// 결함 검출: source ref를 적용 ref로 오해, 옛 current/control로 새 명령 전송, 유실 뒤 명령 재발급, 위장 receipt 수용.
test('별도 적용은 관측 세대와 현재 제어를 결박하고 유실 뒤 동일 명령만 재전송한다',async()=>{
 assert.equal(typeof (api as any).prepareMethodApplication,'function');assert.equal(typeof (api as any).writeMethodApplication,'function');
 const sent:any[]=[];let lose=true;
 const client=new ApiClient(async(url,init)=>{if(init?.method==='GET'){assert.equal(url,'/api/v1/projects/'+pid);return Response.json(project);}assert.equal(url,'/api/v1/projects/'+pid+'/commands');assert.equal(init?.credentials,'same-origin');assert.equal(init?.redirect,'error');const request=JSON.parse(String(init?.body));sent.push(request);if(lose){lose=false;throw Error('synthetic-response-lost');}return Response.json(receipt(request));});
 const request=await (api as any).prepareMethodApplication(client,pid,session,sourceRef,null,'사용자 별도 적용');
 assert.equal(request.operation,'applyMethodology');assert.equal(request.targetId,pid);assert.equal(request.expectedVersion,0);assert.equal(request.controlGeneration,7);assert.deepEqual(request.payload,{methodologyRef:sourceRef,expectedApplicationVersion:0,reason:'사용자 별도 적용'});
 await assert.rejects((api as any).writeMethodApplication(client,request,null,session.csrfToken),(e:unknown)=>e instanceof ApiError&&e.code==='CONNECTION_LOST');
 const result=await (api as any).writeMethodApplication(client,request,null,session.csrfToken);assert.equal(result.data.ref.id,aid);assert.notEqual(result.data.ref.id,mid);assert.deepEqual(sent[0],sent[1]);
});
test('관측 적용본 불명/변경과 다른 제어는 POST 없이 거절한다',async()=>{
 assert.equal(typeof (api as any).prepareMethodApplication,'function');let posts=0;
 for(const value of [{...project,currentMethodologyRef:undefined},{...project,currentMethodologyRef:{id:aid,version:1,contentHash:'a'.repeat(64)}},{...project,controlState:{...project.controlState,clientId:mid}}]){
  const client=new ApiClient(async(_url,init)=>{if(init?.method!=='GET')posts++;return Response.json(value);});await assert.rejects((api as any).prepareMethodApplication(client,pid,session,sourceRef,null,'사용자 적용'));
 }assert.equal(posts,0);
});
test('적용 receipt의 source/이유/이전ref/본문 hash 불일치는 성공으로 표시하지 않는다',async()=>{
 assert.equal(typeof (api as any).prepareMethodApplication,'function');assert.equal(typeof (api as any).writeMethodApplication,'function');
 const request=await (api as any).prepareMethodApplication(new ApiClient(async()=>Response.json(project)),pid,session,sourceRef,null,'적용 이유');
 const good=receipt(request),variants=[{...good,commandId:aid},{...good,data:{...good.data,reason:'다른 이유'}},{...good,data:{...good.data,previousApplicationRef:sourceRef}},{...good,data:{...good.data,snapshot:{...good.data.snapshot,name:'다른 본문'}}},{...good,data:{...good.data,snapshot:{...good.data.snapshot,sourceRef:{...sourceRef,version:3}}}}];
 for(const body of variants)await assert.rejects((api as any).writeMethodApplication(new ApiClient(async()=>Response.json(body)),request,null,session.csrfToken),(e:unknown)=>e instanceof ApiError&&e.code==='RESPONSE_INVALID');
 let calls=0;await assert.rejects((api as any).writeMethodApplication(new ApiClient(async()=>{calls++;return Response.json(good);}),{...request,targetId:mid},null,session.csrfToken));assert.equal(calls,0);
});
test('준비 GET 중 선택 객체가 바뀌어도 클릭 당시 원문ref만 명령에 고정한다',async()=>{
 let release!:(value:Response)=>void;const selected=structuredClone(sourceRef);
 const pending=(api as any).prepareMethodApplication(new ApiClient(()=>new Promise(resolve=>{release=resolve;})),pid,session,selected,null,'고정 선택');
 selected.version=9;release(Response.json(project));const request=await pending;assert.deepEqual(request.payload.methodologyRef,sourceRef);
});
test('송신 뒤 caller가 request를 수정해도 실제 전송한 내용으로 receipt를 대조한다',async()=>{
 const request=await (api as any).prepareMethodApplication(new ApiClient(async()=>Response.json(project)),pid,session,sourceRef,null,'송신 당시 이유');let release!:(value:Response)=>void;let sent:any;
 const pending=(api as any).writeMethodApplication(new ApiClient((_url,init)=>{sent=JSON.parse(String(init?.body));return new Promise(resolve=>{release=resolve;});}),request,null,session.csrfToken);
 request.payload.reason='송신 후 변경';release(Response.json(receipt(sent)));const result=await pending;assert.equal(result.data.reason,'송신 당시 이유');
});
