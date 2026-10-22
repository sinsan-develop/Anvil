import assert from 'node:assert/strict';
import {test} from 'node:test';
import {existsSync} from 'node:fs';
import {newContextPreparation,prepareContextWrite} from '../../../apps/web/src/features/workspace/context-api.ts';
import {readContextPreparationInput} from '../../../apps/server/modules/context/context-input.ts';
const url=new URL('../../../apps/web/src/features/workspace/context-preparation-edit.ts',import.meta.url),mod:any=existsSync(url)?await import(url.href):{};
const uid='20000000-0000-4000-8000-000000000002',pid='10000000-0000-4000-8000-000000000001',ref={id:uid,version:1,contentHash:'a'.repeat(64)},session={user:{id:uid},clientId:uid,csrfToken:'C'.repeat(43)};
function fixture(){const b=newContextPreparation({projectId:pid,ref,snapshot:{definition:{budgetRef:null},contentConfirmed:true,ready:false,executionAuthorized:false,dispatchPerformed:false}} as any,session,1);b.input.reason='준비 이유';b.input.slots.forEach(s=>s.reason='선정 이유');b.input.slots[0]!.sources=[{kind:'KNOWLEDGE_VERSION',versionRef:ref}];b.dirty=false;return b;}
function edit(...args:any[]){assert.equal(typeof mod.editContextPreparationBuffer,'function','현재 버퍼의 편집 전용 조건 필요');return mod.editContextPreparationBuffer(...args);}
test('이유 편집은 지정 필드만 바꾸고 원문·다른 슬롯·한도/바인딩을 보존한다',()=>{
 const b=fixture(),original=structuredClone(b),a=edit(b,b,session,{kind:'PREPARATION_REASON',value:'새 준비 이유'}),z=edit(a,b,session,{kind:'SLOT_REASON',code:'NEXT_ACTION',value:'선정한 다음 행동'});
 assert.equal(z.input.reason,'새 준비 이유');assert.equal(z.input.slots.find((s:any)=>s.code==='NEXT_ACTION').reason,'선정한 다음 행동');assert.equal(z.dirty,true);assert.deepEqual(b,original);
 assert.deepEqual(z.input.slots.filter((s:any)=>s.code!=='NEXT_ACTION'),b.input.slots.filter(s=>s.code!=='NEXT_ACTION'));assert.deepEqual(z.input.limits,b.input.limits);assert.equal(z.bindingId,b.bindingId);
 const payload=readContextPreparationInput(prepareContextWrite(z,session).payload);assert.equal(payload.reason,'새 준비 이유');assert.equal(payload.slots.find(s=>s.code==='NEXT_ACTION')!.reason,'선정한 다음 행동');
});
test('예전 렌더의 두 한도 변경은 각각 변경한 필드만 현재값에 병합한다',()=>{
 const b=fixture(),limits=b.input.limits;
 const first=edit(b,b,session,{kind:'DELIVERY_LIMIT',field:'maxPartBytes',value:64}),last=edit(first,b,session,{kind:'DELIVERY_LIMIT',field:'maxParts',value:100});
 assert.deepEqual(last.input.limits,{maxPartBytes:64,maxParts:100});assert.deepEqual(b.input.limits,limits);assert.equal(edit(last,b,session,{kind:'DELIVERY_LIMIT',field:'maxParts',value:100}),last);
 const reverted=edit(last,b,session,{kind:'DELIVERY_LIMIT',field:'maxPartBytes',value:limits.maxPartBytes});assert.deepEqual(reverted.input.limits,{maxPartBytes:limits.maxPartBytes,maxParts:100});
 const payload=readContextPreparationInput(prepareContextWrite(last,session).payload);assert.deepEqual(payload.limits,{maxPartBytes:64,maxParts:100});
 const invalid=edit(last,last,session,{kind:'DELIVERY_LIMIT',field:'maxPartBytes',value:0});assert.equal(invalid.input.limits.maxPartBytes,0);assert.throws(()=>prepareContextWrite(invalid,session));
});
test('이유/한도 이벤트 이후 잠금·owner/client/세대/임무가 바뀌면 현재 입력을 덮지 않는다',()=>{
 for(const change of [{kind:'PREPARATION_REASON',value:'바뀐 이유'},{kind:'SLOT_REASON',code:'NEXT_ACTION',value:'바뀐 이유'},{kind:'DELIVERY_LIMIT',field:'maxParts',value:100}])for(const mutate of [(b:any)=>b.pending={},(b:any)=>b.uncertain=true,(b:any)=>b.resultRef=ref,(b:any)=>b.ownerUserId=pid,(b:any)=>b.ownerClientId=pid,(b:any)=>b.controlGeneration++,(b:any)=>b.assignmentRef={...ref,version:2},(b:any)=>b.bindingId='changed']){
  const b=fixture(),current=structuredClone(b);mutate(current);const original=structuredClone(current);assert.equal(edit(current,b,session,change),current);assert.deepEqual(current,original);
 }
});
