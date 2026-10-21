import test from 'node:test';import assert from 'node:assert/strict';
import {emptyFormBuffer,type FormBuffer} from '../../../apps/web/src/features/methodologies/form-editor-state.ts';
const m:any=await import('../../../apps/web/src/features/methodologies/form-editor-state.ts'),uid='11111111-1111-4111-8111-111111111111';
function buffer():FormBuffer{return{...emptyFormBuffer(),ownerUserId:uid,targetId:uid,version:2,itemId:'B',reason:'개정 이유',definition:{formCode:'CUSTOM',name:'내 양식',purpose:'목적',scope:'USER_COMMON',authorRole:'작성',reviewerRole:'검토',confirmerRole:'확정',requiredInputs:['원문'],authoringStandardRef:{id:uid,version:1,contentHash:'a'.repeat(64)},items:['A','B','C'].map(itemId=>({itemId,title:itemId,required:true,valueType:'RECORDS',repeated:true,fields:['F1','F2','F3'].map(fieldId=>({fieldId,title:fieldId,required:fieldId!=='F2',valueType:'TEXT'})),authoringRules:['규칙'],reviewCriteria:['검토']}))}};}
function move(...args:any[]){assert.equal(typeof m.moveFormEntry,'function');return m.moveFormEntry(...args);}
test('선택 항목의 위치만 한 칸 바꾸고 ID·필드·규칙·선택·이유·원버퍼는 보존한다',()=>{
 const b=buffer(),before=structuredClone(b),after=move(b,uid,'B',null,-1);assert.deepEqual(after.definition.items.map((i:any)=>i.itemId),['B','A','C']);assert.deepEqual(after.definition.items[0],before.definition!.items[1]);assert.equal(after.itemId,'B');assert.equal(after.reason,'개정 이유');assert.equal(after.dirty,true);assert.deepEqual(b,before);
});
test('선택 반복 열의 위치만 바꾸며 필수값과 나머지 항목 순서는 보존한다',()=>{
 const b=buffer(),before=structuredClone(b),after=move(b,uid,'B','F2',1);assert.deepEqual(after.definition.items[1].fields.map((f:any)=>f.fieldId),['F1','F3','F2']);assert.deepEqual(after.definition.items[1].fields[2],before.definition!.items[1]!.fields[1]);assert.deepEqual(after.definition.items.map((i:any)=>i.itemId),['A','B','C']);assert.deepEqual(b,before);
});
test('경계 밖 한칸 이동은 원버퍼 그대로이며 빈공간/새ID를 만들지 않는다',()=>{
 const b=buffer();b.itemId='A';assert.equal(move(b,uid,'A',null,-1),b);assert.equal(move(b,uid,'A','F1',-1),b);b.itemId='C';assert.equal(move(b,uid,'C',null,1),b);assert.equal(move(b,uid,'C','F3',1),b);assert.equal(b.dirty,false);
});
test('타주체·동결·다른항목·중복ID·일반항목의열·임의방향은 입력/명령을 바꾸지 않는다',()=>{
 for(const mode of ['OWNER','PENDING','REVIEW','ITEM','DUP_ITEM','DUP_FIELD','TEXT','DIRECTION']){const b=buffer();if(mode==='OWNER')b.ownerUserId='다른사용자';if(mode==='PENDING')b.pending={request:{commandId:'원명령'}} as any;if(mode==='REVIEW')b.review={pending:{commandId:'원검토'}} as any;if(mode==='ITEM')b.itemId='A';if(mode==='DUP_ITEM')b.definition!.items[0]!.itemId='B';if(mode==='DUP_FIELD')b.definition!.items[1]!.fields[0]!.fieldId='F2';if(mode==='TEXT')b.definition!.items[1]!.valueType='TEXT';const before=structuredClone(b);assert.throws(()=>move(b,uid,'B','F2',mode==='DIRECTION'?2:1),{code:'FORM_ENTRY_MOVE_INVALID'});assert.deepEqual(b,before);}
});
