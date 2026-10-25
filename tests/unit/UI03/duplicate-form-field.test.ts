import assert from 'node:assert/strict';
import {test} from 'node:test';
import {emptyFormBuffer,removeDuplicateFormRepeatField,removeFormRepeatField,type DuplicateFormFieldSelection,type FormBuffer} from '../../../apps/web/src/features/methodologies/form-editor-state.ts';

function seed():FormBuffer{return {...emptyFormBuffer(),ownerUserId:'owner',targetId:'saved-form',version:7,itemId:'A',reason:'정정 이유',definition:{formCode:'USER01',name:'내 양식',purpose:'목적',scope:'USER_COMMON',authorRole:'작성',reviewerRole:'검토',confirmerRole:'확정',requiredInputs:['입력'],authoringStandardRef:{id:'standard',version:1,contentHash:'hash'},items:[
 {itemId:'A',title:'반복 항목',required:true,valueType:'RECORDS',repeated:true,authoringRules:['작성 규칙'],reviewCriteria:['검토 규칙'],fields:[{fieldId:'DUP',title:'첫째',required:true,valueType:'TEXT'},{fieldId:'DUP',title:'둘째',required:false,valueType:'TEXT'},{fieldId:'OTHER',title:'다른 필드',required:false,valueType:'TEXT'}]},
 {itemId:'B',title:'다른 항목',required:false,valueType:'TEXT',repeated:false,fields:[],authoringRules:['다른 작성'],reviewCriteria:['다른 검토']}]}};}
function select(buffer:FormBuffer,index=1):DuplicateFormFieldSelection{const fields=buffer.definition!.items[0]!.fields,field=fields[index]!;return {buffer,itemId:'A',fields,index,field,fingerprint:JSON.stringify(field),contextFingerprint:JSON.stringify(buffer)};}

test('중복 복구는 정확한 둘째 정의만 제거하고 원본·규칙·다른 정의를 보존한다',()=>{
 const original=seed(),before=structuredClone(original),selection=select(original),result=removeDuplicateFormRepeatField(original,'owner',selection);
 assert.deepEqual(original,before);assert.equal(result.dirty,true);assert.equal(result.definition!.items[0]!.fields.length,2);
 assert.deepEqual(result.definition!.items[0]!.fields,[before.definition!.items[0]!.fields[0],before.definition!.items[0]!.fields[2]]);
 assert.equal(result.definition!.items[1],original.definition!.items[1]);assert.equal(result.definition!.items[0]!.authoringRules,original.definition!.items[0]!.authoringRules);assert.equal(result.definition!.items[0]!.reviewCriteria,original.definition!.items[0]!.reviewCriteria);
 assert.deepEqual({...result,dirty:false,definition:original.definition},original);
});
test('복구는 마지막 고유 정의를 거절하고 기존 ID 기반 중복 제거 거절을 유지한다',()=>{
 const original=seed();assert.throws(()=>removeFormRepeatField(original,'owner','A','DUP'),{code:'FORM_REPEAT_FIELD_REMOVAL_INVALID'});
 const repaired=removeDuplicateFormRepeatField(original,'owner',select(original));assert.throws(()=>removeDuplicateFormRepeatField(repaired,'owner',select(repaired,0)),{code:'FORM_DUPLICATE_FIELD_REMOVAL_INVALID'});
 assert.equal(removeFormRepeatField(repaired,'owner','A','DUP').definition!.items[0]!.fields.length,1);
});
test('소유자·미확인 저장/검토·다른 선택 항목·다른 scope·중복 상위 항목은 변경하지 않는다',()=>{
 for(const change of [(b:FormBuffer)=>{b.ownerUserId='other';},(b:FormBuffer)=>{b.pending={request:{commandId:'pending'} as any,name:'대기',formCode:'USER01'};},(b:FormBuffer)=>{b.review={pending:{commandId:'review'}} as any;},(b:FormBuffer)=>{b.itemId='B';},(b:FormBuffer)=>{b.definition!.scope='SYSTEM';},(b:FormBuffer)=>{b.definition!.items.push(structuredClone(b.definition!.items[0]!));},(b:FormBuffer)=>{b.definition!.items[0]!.repeated=false;},(b:FormBuffer)=>{b.definition!.items[0]!.valueType='TEXT';}]){
  const buffer=seed();change(buffer);const before=structuredClone(buffer);assert.throws(()=>removeDuplicateFormRepeatField(buffer,'owner',select(buffer)),{code:'FORM_DUPLICATE_FIELD_REMOVAL_INVALID'});assert.deepEqual(buffer,before);
 }
});
test('같은 내용의 교체 버퍼·배열·필드 객체와 잘못된 index는 원 선택으로 제거할 수 없다',()=>{
 const buffer=seed(),selection=select(buffer);assert.throws(()=>removeDuplicateFormRepeatField(structuredClone(buffer),'owner',selection),{code:'FORM_DUPLICATE_FIELD_REMOVAL_INVALID'});
 for(const patch of [{fields:[...selection.fields]},{field:{...selection.field}},{index:-1},{index:0},{index:1.5},{fingerprint:'다른 내용'},{contextFingerprint:'다른 맥락'}])assert.throws(()=>removeDuplicateFormRepeatField(buffer,'owner',{...selection,...patch}),{code:'FORM_DUPLICATE_FIELD_REMOVAL_INVALID'});
});
test('원 객체를 유지한 채 선택 필드나 다른 입력이 바뀌어도 과거 선택을 적용하지 않는다',()=>{
 for(const mutate of [(b:FormBuffer)=>{b.definition!.items[0]!.fields[1]!.required=true;},(b:FormBuffer)=>{b.reason='다른 이유';},(b:FormBuffer)=>{b.definition!.items[1]!.title='다른 항목 새 입력';},(b:FormBuffer)=>{b.definition!.items[0]!.fields.reverse();}]){
  const buffer=seed(),selection=select(buffer);mutate(buffer);const before=structuredClone(buffer);assert.throws(()=>removeDuplicateFormRepeatField(buffer,'owner',selection),{code:'FORM_DUPLICATE_FIELD_REMOVAL_INVALID'});assert.deepEqual(buffer,before);
 }
});
