import assert from 'node:assert/strict';
import {test} from 'node:test';
import {newContextPreparation,prepareContextWrite} from '../../../apps/web/src/features/workspace/context-api.ts';
import {readContextPreparationInput} from '../../../apps/server/modules/context/context-input.ts';
import * as source from '../../../apps/web/src/features/workspace/context-source-selection.ts';
const mod:any=source,uid='20000000-0000-4000-8000-000000000002',pid='10000000-0000-4000-8000-000000000001',ref={id:uid,version:1,contentHash:'a'.repeat(64)},session={user:{id:uid},clientId:uid,csrfToken:'C'.repeat(43)};
const item=(n:number)=>({kind:'KNOWLEDGE_VERSION' as const,versionRef:{...ref,id:'30000000-0000-4000-8000-'+String(n).padStart(12,'0')}});
function fixture(){const b=newContextPreparation({projectId:pid,ref,snapshot:{definition:{budgetRef:null},contentConfirmed:true,ready:false,executionAuthorized:false,dispatchPerformed:false}} as any,session,1);b.input.reason='원문 선택 검토';b.input.slots.forEach(s=>s.reason='필수 슬롯 선정 이유');b.input.slots.find(s=>s.code==='CURRENT_POSITION')!.sources=[item(1),item(2),item(3)];return b;}
function remove(...args:any[]){assert.equal(typeof mod.removeContextSourceFromBuffer,'function','정확 원문 참조/현재 버퍼 조건으로 해제하는 구현 누락');return mod.removeContextSourceFromBuffer(...args);}
test('앞 선택 해제 뒤 예전 handler로 두번째 원문을 해제해도 다음 원문은 지우지 않는다',()=>{
 const rendered=fixture(),original=structuredClone(rendered),a=item(1),b=item(2),c=item(3);
 const first=remove(rendered,rendered,session,'CURRENT_POSITION',a),last=remove(first,rendered,session,'CURRENT_POSITION',b);
 assert.deepEqual(last.input.slots.find((s:any)=>s.code==='CURRENT_POSITION').sources,[c]);assert.deepEqual(rendered,original);assert.equal(last.dirty,true);
 assert.equal(remove(first,rendered,session,'CURRENT_POSITION',a),first);
 const payload=readContextPreparationInput(prepareContextWrite(last,session).payload);assert.deepEqual(payload.slots.find(s=>s.code==='CURRENT_POSITION')!.sources,[c]);
 assert.deepEqual(payload.slots.filter(s=>s.code!=='CURRENT_POSITION'),original.input.slots.filter(s=>s.code!=='CURRENT_POSITION'));assert.deepEqual(payload.limits,original.input.limits);assert.equal(payload.reason,original.input.reason);
});
test('같은 ID 다른 버전·종류/슬롯·발언의 대화 fullref는 대신 해제하지 않는다',()=>{
 const b=fixture(),changed={...item(1),versionRef:{...item(1).versionRef,version:2}};
 assert.equal(remove(b,b,session,'CURRENT_POSITION',changed),b);assert.equal(remove(b,b,session,'NEXT_ACTION',item(1)),b);
 assert.equal(remove(b,b,session,'CURRENT_POSITION',{kind:'DOCUMENT_VERSION',versionRef:item(1).versionRef}),b);
 const instruction:any={kind:'USER_INSTRUCTION',conversationId:pid,messageRef:{kind:'CONVERSATION',id:uid,contentHash:'b'.repeat(64)}};
 b.input.slots.find(s=>s.code==='LATEST_INSTRUCTIONS')!.sources=[instruction];
 assert.equal(remove(b,b,session,'LATEST_INSTRUCTIONS',{...instruction,conversationId:uid}),b);
 const next=remove(b,b,session,'LATEST_INSTRUCTIONS',instruction);assert.equal(next.input.slots.find((s:any)=>s.code==='LATEST_INSTRUCTIONS').sources.length,0);assert.equal(b.input.slots.find(s=>s.code==='LATEST_INSTRUCTIONS')!.sources.length,1);
 b.input.slots.find(s=>s.code==='CURRENT_POSITION')!.sources.push(item(1));assert.equal(remove(b,b,session,'CURRENT_POSITION',item(1)),b);
});
test('업데이트 실행 전에 pending·UNKNOWN·저장결과·주체/기기·세대/임무가 바뀌면 원 입력을 보존한다',()=>{
 for(const mutate of [(b:any)=>b.pending={},(b:any)=>b.uncertain=true,(b:any)=>b.resultRef=ref,(b:any)=>b.result={},(b:any)=>b.bindingId='changed',(b:any)=>b.projectId=uid,(b:any)=>b.ownerUserId=pid,(b:any)=>b.ownerClientId=pid,(b:any)=>b.controlGeneration++,(b:any)=>b.assignmentRef={...ref,version:2},(b:any)=>b.input.assignmentRef={...ref,version:2}]){
  const rendered=fixture(),current=structuredClone(rendered);mutate(current);const before=structuredClone(current);
  assert.equal(remove(current,rendered,session,'CURRENT_POSITION',item(2)),current);assert.deepEqual(current,before);
 }
 assert.equal(remove(null,fixture(),session,'CURRENT_POSITION',item(1)),null);
});
test('모호한 슬롯·선택과 잠긴 예전 렌더에서도 다른 원문을 수정하지 않는다',()=>{
 const b=fixture();b.input.slots.push(structuredClone(b.input.slots.find(s=>s.code==='CURRENT_POSITION')!));assert.equal(remove(b,b,session,'CURRENT_POSITION',item(1)),b);
 const rendered=fixture(),current=structuredClone(rendered);rendered.uncertain=true;assert.equal(remove(current,rendered,session,'CURRENT_POSITION',item(1)),current);
});
