import assert from 'node:assert/strict';
import {test} from 'node:test';
import {newContextPreparation,prepareContextWrite} from '../../../apps/web/src/features/workspace/context-api.ts';
import {readContextPreparationInput} from '../../../apps/server/modules/context/context-input.ts';
import * as source from '../../../apps/web/src/features/workspace/context-source-selection.ts';
const mod:any=source,uid='20000000-0000-4000-8000-000000000002',pid='10000000-0000-4000-8000-000000000001',ref={id:uid,version:1,contentHash:'a'.repeat(64)},session={user:{id:uid},clientId:uid,csrfToken:'C'.repeat(43)};
const item=(n:number)=>({kind:'KNOWLEDGE_VERSION' as const,versionRef:{...ref,id:'30000000-0000-4000-8000-'+String(n).padStart(12,'0')}});
function fixture(){const b=newContextPreparation({projectId:pid,ref,snapshot:{definition:{budgetRef:null},contentConfirmed:true,ready:false,executionAuthorized:false,dispatchPerformed:false}} as any,session,1);b.input.reason='원문 선택 검토';b.input.slots.forEach(s=>s.reason='선정 이유');b.dirty=false;return b;}
function append(...args:any[]){assert.equal(typeof mod.appendContextSourceToBuffer,'function','원문 추가에도 현재 버퍼 상태 재검사가 필요');return mod.appendContextSourceToBuffer(...args);}
test('같은 현재 입력에만 원문을 추가하고 기존 명령입력·이유·한도와 선택의 바이트를 보존한다',()=>{
 const rendered=fixture(),original=structuredClone(rendered),selection=item(1),next=append(rendered,rendered,session,'CURRENT_POSITION',selection);
 assert.equal(next.dirty,true);assert.deepEqual(rendered,original);assert.notEqual(next,rendered);selection.versionRef.contentHash='b'.repeat(64);
 assert.deepEqual(next.input.slots.find((s:any)=>s.code==='CURRENT_POSITION').sources,[item(1)]);
 assert.equal(append(next,rendered,session,'CURRENT_POSITION',item(1)),next);
 const payload=readContextPreparationInput(prepareContextWrite(next,session).payload);assert.deepEqual(payload.slots.find(s=>s.code==='CURRENT_POSITION')!.sources,[item(1)]);assert.deepEqual(payload.limits,original.input.limits);assert.equal(payload.reason,original.input.reason);
});
test('원문 조회 후 현재 pending·UNKNOWN·저장결과·소유/기기·세대/임무가 바뀌면 추가하지 않는다',()=>{
 for(const mutate of [(b:any)=>b.pending={},(b:any)=>b.uncertain=true,(b:any)=>b.resultRef=ref,(b:any)=>b.result={},(b:any)=>b.bindingId='changed',(b:any)=>b.projectId=uid,(b:any)=>b.ownerUserId=pid,(b:any)=>b.ownerClientId=pid,(b:any)=>b.controlGeneration++,(b:any)=>b.assignmentRef={...ref,version:2},(b:any)=>b.input.assignmentRef={...ref,version:2}]){
  const rendered=fixture(),current=structuredClone(rendered);mutate(current);const before=structuredClone(current);assert.equal(append(current,rendered,session,'CURRENT_POSITION',item(1)),current);assert.deepEqual(current,before);
 }
 const rendered=fixture(),current=structuredClone(rendered);rendered.uncertain=true;assert.equal(append(current,rendered,session,'CURRENT_POSITION',item(1)),current);assert.equal(append(null,fixture(),session,'CURRENT_POSITION',item(1)),null);
});
test('현재 슬롯의 중복·단일 선택·전체200한도와 종류 제한을 우회하지 않는다',()=>{
 const b=fixture(),doc={kind:'DOCUMENT_VERSION',versionRef:ref};assert.equal(append(b,b,session,'PURPOSE_REASON',doc),b);
 const first=append(b,b,session,'PURPOSE_REASON',item(1));assert.equal(append(first,b,session,'PURPOSE_REASON',item(2)),first);
 b.input.slots.find(s=>s.code==='CURRENT_POSITION')!.sources=Array.from({length:200},(_,n)=>item(n+1));assert.equal(append(b,b,session,'ACTUAL_GAPS',item(201)),b);
 assert.equal(b.dirty,false);assert.equal(b.input.slots.find(s=>s.code==='ACTUAL_GAPS')!.sources.length,0);
});
