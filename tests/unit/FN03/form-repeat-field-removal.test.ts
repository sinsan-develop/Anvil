import test from 'node:test';import assert from 'node:assert/strict';
import {emptyFormBuffer,type FormBuffer} from '../../../apps/web/src/features/methodologies/form-editor-state.ts';
import {validateCustomForm} from '../../../apps/server/modules/documents/form-validation.ts';
const m:any=await import('../../../apps/web/src/features/methodologies/form-editor-state.ts');
const uid='11111111-1111-4111-8111-111111111111';
function buffer():FormBuffer{return{...emptyFormBuffer(),ownerUserId:uid,targetId:uid,version:2,itemId:'ROWS',reason:'기존 개정 이유',definition:{formCode:'CUSTOM',name:'내 양식',purpose:'목적',scope:'USER_COMMON',authorRole:'작성',reviewerRole:'검토',confirmerRole:'확정',requiredInputs:['원문'],authoringStandardRef:{id:uid,version:1,contentHash:'a'.repeat(64)},items:[{itemId:'ROWS',title:'요구사항',required:true,valueType:'RECORDS',repeated:true,fields:[{fieldId:'ID',title:'식별자',required:true,valueType:'TEXT'},{fieldId:'NOTE',title:'내용',required:false,valueType:'TEXT'}],authoringRules:['작성 규칙'],reviewCriteria:['검수 기준']}]}};}
function remove(...args:any[]){assert.equal(typeof m.removeFormRepeatField,'function');return m.removeFormRepeatField(...args);}
test('선택한 반복 필드만 제거하며 ID/순서·항목 규칙/이유·원버퍼를 보존한다',()=>{
 const b=buffer(),old=structuredClone(b),after=remove(b,uid,'ROWS','NOTE');assert.deepEqual(after.definition.items[0].fields,[b.definition!.items[0]!.fields[0]]);assert.deepEqual(after.definition.items[0].authoringRules,['작성 규칙']);assert.deepEqual(after.definition.items[0].reviewCriteria,['검수 기준']);assert.equal(after.reason,'기존 개정 이유');assert.equal(after.version,2);assert.equal(after.dirty,true);assert.deepEqual(b,old);
});
test('동결 명령·다른 주체·항목 전환·없는/중복 필드는 변경하지 않는다',()=>{
 for(const mode of ['PENDING','REVIEW_PENDING','OWNER','ITEM','MISSING','DUPLICATE']){const b=buffer();if(mode==='PENDING')b.pending={request:{commandId:'원명령'} as any,name:'내 양식',formCode:'CUSTOM'};if(mode==='REVIEW_PENDING')b.review={pending:{commandId:'원검토'}} as any;if(mode==='OWNER')b.ownerUserId='다른 주체';if(mode==='ITEM')b.itemId='OTHER';if(mode==='MISSING')b.definition!.items[0]!.fields=[];if(mode==='DUPLICATE')b.definition!.items[0]!.fields.push({...b.definition!.items[0]!.fields[1]!});const old=structuredClone(b);assert.throws(()=>remove(b,uid,'ROWS','NOTE'),{code:'FORM_REPEAT_FIELD_REMOVAL_INVALID'});assert.deepEqual(b,old);}
});
test('마지막 반복 필드도 명시 제거하되 RECORDS를 TEXT로 바꾸거나 확정 기준을 낮추지 않는다',()=>{
 let b=buffer();b=remove(b,uid,'ROWS','NOTE');b=remove(b,uid,'ROWS','ID');assert.equal(b.definition!.items[0]!.valueType,'RECORDS');assert.equal(b.definition!.items[0]!.repeated,true);const v=validateCustomForm(b.definition);assert.equal(v.validForConfirmation,false);assert.ok(v.issues.some(i=>i.code==='REPEAT_FIELDS_INVALID'));
});
