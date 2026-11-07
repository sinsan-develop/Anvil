import test from 'node:test';import assert from 'node:assert/strict';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {contextOriginalFixture} from '../../fixtures/context-original.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
const m:any=await import('../../../apps/web/src/features/workspace/context-original.ts').catch((e:any)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
function read(...args:any[]){assert.equal(typeof m.readContextKnowledgeOriginal,'function');return m.readContextKnowledgeOriginal(...args);}
test('저장 맥락 재조회→선택된 고정 지식/본문hash만 읽고 입력·기준·전달 상태를 바꾸지 않는다',async()=>{
 const f=contextOriginalFixture(),before=structuredClone(f),calls:string[]=[],client=new ApiClient(async(path,init)=>{assert.equal(init?.method,'GET');calls.push(String(path));return Response.json(String(path).includes('/context/')?f.view:f.knowledge);});
 const v=await read(client,f.projectId,f.view.ref,f.assignmentRef,'PURPOSE_REASON_1',()=>true);assert.equal(v.body,f.body);assert.deepEqual(v.sourceRef,f.knowledge.ref);assert.equal(v.executionAuthorized,false);assert.equal(v.dispatchPerformed,false);assert.deepEqual(calls,[`/api/v1/projects/${f.projectId}/context/${f.view.ref.id}/versions/1`,`/api/v1/projects/${f.projectId}/knowledge/${f.knowledge.ref.id}/versions/1`]);assert.deepEqual(f,before);
});
test('다른 임무/누락·제외/중복항목·변조원문/권한거절·취소를 대체 성공으로 만들지 않는다',async()=>{
 const f=contextOriginalFixture();let calls=0;const client=new ApiClient(async path=>{calls++;return Response.json(String(path).includes('/context/')?f.view:f.knowledge);});
 await assert.rejects(read(client,f.projectId,f.view.ref,{...f.assignmentRef,version:2},'PURPOSE_REASON_1',()=>true));assert.equal(calls,1);
 await assert.rejects(read(client,f.projectId,f.view.ref,f.assignmentRef,'RULES_SCOPE_1',()=>true));assert.equal(calls,2);
 assert.equal(await read(client,f.projectId,f.view.ref,f.assignmentRef,'PURPOSE_REASON_1',()=>false),null);assert.equal(calls,2);
 for(const status of [401,403,404,503])await assert.rejects(read(new ApiClient(async()=>Response.json({code:'ACCESS_DENIED'},{status})),f.projectId,f.view.ref,f.assignmentRef,'PURPOSE_REASON_1',()=>true),(e:any)=>e.status===status);
 const changed={...f.knowledge,body:'바뀐 원문'};await assert.rejects(read(new ApiClient(async p=>Response.json(String(p).includes('/context/')?f.view:changed)),f.projectId,f.view.ref,f.assignmentRef,'PURPOSE_REASON_1',()=>true));
 for(const change of [(v:any)=>{v.manifest.items.push(structuredClone(v.manifest.items[0]));v.manifest.sourceBindings.push(structuredClone(v.manifest.sourceBindings[0]));},(v:any)=>{v.manifest.items[0].includedState='EXCLUDED';},(v:any)=>{v.manifest.sourceBindings[0].bodyRef.contentHash='f'.repeat(64);}]){const value=structuredClone(f.view);change(value);value.ref.contentHash=contentHash(canonicalJson(value.manifest));await assert.rejects(read(new ApiClient(async p=>Response.json(String(p).includes('/context/')?value:f.knowledge)),f.projectId,value.ref,f.assignmentRef,'PURPOSE_REASON_1',()=>true));}
 let active=true;assert.equal(await read(new ApiClient(async()=>{active=false;return Response.json({code:'AUTH_REQUIRED'},{status:401});}),f.projectId,f.view.ref,f.assignmentRef,'PURPOSE_REASON_1',()=>active),null);
});
test('지식 원문 응답 중 선택이 닫히면 실제 body/hash 처리 뒤에도 이전 원문을 돌려주지 않는다',async()=>{
 const f=contextOriginalFixture();let active=true,knowledgeCalls=0;
 const client=new ApiClient(async path=>{if(String(path).includes('/context/'))return Response.json(f.view);knowledgeCalls++;active=false;return Response.json(f.knowledge);});
 assert.equal(await read(client,f.projectId,f.view.ref,f.assignmentRef,'PURPOSE_REASON_1',()=>active),null);assert.equal(knowledgeCalls,1);
});
test('저장 맥락 성공 응답 중 닫히면 실제 manifest hash 대조 후에도 지식 GET을 시작하지 않는다',async()=>{
 const f=contextOriginalFixture();let active=true,calls=0;
 const client=new ApiClient(async()=>{calls++;active=false;return Response.json(f.view);});
 assert.equal(await read(client,f.projectId,f.view.ref,f.assignmentRef,'PURPOSE_REASON_1',()=>active),null);assert.equal(calls,1);
});
