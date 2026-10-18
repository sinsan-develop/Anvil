import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {newContextPreparation,prepareContextWrite} from '../../../apps/web/src/features/workspace/context-api.ts';
import {buildContextManifest} from '../../../apps/server/modules/context/context-manifest.ts';
import {planContextText} from '../../../apps/server/modules/context/context-text-plan.ts';
const url=new URL('../../../apps/web/src/features/workspace/context-reuse.ts',import.meta.url),subject=existsSync(url)?await import(url.href):{};
const pid='10000000-0000-4000-8000-000000000001',uid='20000000-0000-4000-8000-000000000002',ref={id:uid,version:1,contentHash:'a'.repeat(64)},session={user:{id:uid},clientId:uid,csrfToken:'C'.repeat(43)};
const confirmed:any={projectId:pid,ref,snapshot:{definition:{budgetRef:null},contentConfirmed:true,ready:false,executionAuthorized:false,dispatchPerformed:false}};
function source(){const b=newContextPreparation(confirmed,session,1);b.input.reason='원 저장이유';b.input.slots[0]!.sources=[{kind:'KNOWLEDGE_VERSION',versionRef:{...ref,version:3}}];b.input.slots[0]!.reason='보존할 목적선택이유';b.input.limits={maxPartBytes:64,maxParts:20};const selections=b.input.slots.map(slot=>({slot,selection:slot.sources[0]??null,itemId:slot.code+(slot.sources.length?'_1':'')}));const plan=planContextText(selections.map(({slot,selection,itemId})=>({itemId,category:slot.code,required:true,sourceRef:selection?.kind==='KNOWLEDGE_VERSION'?selection.versionRef:null,reason:slot.reason,state:'MISSING',bodyRef:null,body:null})),b.input.limits);const prepared:any={preparationInput:b.input,assignmentRef:ref,baselineRefs:[ref],constitutionRef:null,budgetRef:null,bindings:selections.map(({selection,itemId})=>({itemId,selection,bodyRef:null,sourceState:selection?'UNAVAILABLE':'NOT_SELECTED'})),...plan,unverified:[]};return{projectId:pid,...buildContextManifest(pid,pid,prepared),currentCheck:{state:'UNAVAILABLE',issues:['CURRENT_SOURCE_OR_BASIS_UNAVAILABLE']},ready:false,executionAuthorized:false,dispatchPerformed:false,observedAt:'2026-10-19T00:00:00Z'};}
const control={id:pid,participation:'OWNER',controlState:{actorId:uid,clientId:uid,generation:7,status:'HELD'}};
function reuse(...args:any[]){assert.equal(typeof subject.reuseContextPreparationInput,'function');return subject.reuseContextPreparationInput(...args);}
test('저장준비 exact GET와 현재제어 GET만 사용해 선택/이유/한도를 새미저장입력에깊은복사한다',async()=>{
 const value=source(),original=structuredClone(value),calls:unknown[]=[];const client=new ApiClient(async(path,init)=>{calls.push([path,init?.method]);return Response.json(String(path).includes('/context/')?value:control);});
 const next=await reuse(client,confirmed,session,value.ref,()=>true);assert.deepEqual(calls,[[`/api/v1/projects/${pid}/context/${pid}/versions/1`,'GET'],[`/api/v1/projects/${pid}`,'GET']]);assert.equal(next.projectId,pid);assert.equal(next.ownerUserId,uid);assert.equal(next.ownerClientId,uid);assert.equal(next.controlGeneration,7);assert.deepEqual(next.input.slots,original.manifest.preparationInput.slots);assert.deepEqual(next.input.limits,{maxPartBytes:64,maxParts:20});assert.equal(next.input.reason,'');assert.equal(next.pending,null);assert.equal(next.resultRef,null);assert.equal(next.result,null);assert.equal(next.dirty,true);assert.equal(next.uncertain,false);assert.throws(()=>prepareContextWrite(next,session),{code:'CONTEXT_INPUT_INVALID'});next.input.reason='새 준비 이유';assert.equal(prepareContextWrite(next,session).operation,'buildTaskContext');next.input.slots[0].reason='새 선택이유';assert.deepEqual(value,original);
});
test('다른임무/예산·변조manifest·제어권거절에서 새로운 입력을 만들지 않는다',async()=>{
 for(const active of [{...confirmed,ref:{...ref,version:2}},{...confirmed,snapshot:{...confirmed.snapshot,definition:{budgetRef:ref}}}]){const value=source();let calls=0;await assert.rejects(reuse(new ApiClient(async()=>{calls++;return Response.json(value);}),active,session,value.ref,()=>true),{code:'CONTEXT_ASSIGNMENT_INVALID'});assert.equal(calls,1);}
 const changed=source();changed.manifest.preparationInput.limits.maxParts=21;await assert.rejects(reuse(new ApiClient(async()=>Response.json(changed)),confirmed,session,changed.ref,()=>true),{code:'RESPONSE_INVALID'});
 const tampered=source();tampered.manifest.preparationInput.reason='내용만 변조';await assert.rejects(reuse(new ApiClient(async()=>Response.json(tampered)),confirmed,session,tampered.ref,()=>true),{code:'CONTEXT_INTEGRITY_FAILED'});
 const value=source();await assert.rejects(reuse(new ApiClient(async path=>Response.json(String(path).includes('/context/')?value:{...control,participation:'VIEWER'})),confirmed,session,value.ref,()=>true),{code:'PROJECT_CONTROL_REQUIRED'});
});
test('시작전취소와 지연401/제어조회중취소는 입력/인증callback을만들지않고 결과를버린다',async()=>{
 const value=source();let active=false,calls=0;const none=new ApiClient(async()=>{calls++;throw Error('호출금지');});assert.equal(await reuse(none,confirmed,session,value.ref,()=>active),null);assert.equal(calls,0);
 active=true;const expired=new ApiClient(async()=>{active=false;return Response.json({code:'AUTH_REQUIRED'},{status:401});});assert.equal(await reuse(expired,confirmed,session,value.ref,()=>active),null);
 await assert.rejects(reuse(new ApiClient(async()=>Response.json({code:'AUTH_REQUIRED'},{status:401})),confirmed,session,value.ref,()=>true),{code:'AUTH_REQUIRED'});
 active=true;const delayed=new ApiClient(async path=>{if(String(path).includes('/context/'))return Response.json(value);active=false;return Response.json(control);});assert.equal(await reuse(delayed,confirmed,session,value.ref,()=>active),null);
});
