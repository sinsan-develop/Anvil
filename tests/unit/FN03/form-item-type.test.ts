import test from 'node:test';import assert from 'node:assert/strict';
import {emptyFormBuffer,type FormBuffer} from '../../../apps/web/src/features/methodologies/form-editor-state.ts';
import {validateCustomForm} from '../../../apps/server/modules/documents/form-validation.ts';
const m:any=await import('../../../apps/web/src/features/methodologies/form-editor-state.ts'),uid='11111111-1111-4111-8111-111111111111';
function buffer():FormBuffer{return{...emptyFormBuffer(),ownerUserId:uid,targetId:uid,version:2,itemId:'ROWS',reason:'기존 개정 이유',definition:{formCode:'CUSTOM',name:'내 양식',purpose:'목적',scope:'USER_COMMON',authorRole:'작성',reviewerRole:'검토',confirmerRole:'확정',requiredInputs:['원문'],authoringStandardRef:{id:uid,version:1,contentHash:'a'.repeat(64)},items:[{itemId:'ROWS',title:'요구사항',required:true,valueType:'RECORDS',repeated:true,fields:[{fieldId:'ID',title:'식별자',required:true,valueType:'TEXT'}],authoringRules:['작성 규칙'],reviewCriteria:['검수 기준']}]}};}
function change(...args:any[]){assert.equal(typeof m.changeFormItemType,'function');return m.changeFormItemType(...args);}
test('필드가 있는 반복항목의 텍스트 전환은 확인 없으면 원본 불변이며 명시 확인 뒤에만 초안 필드를 비운다',()=>{
 const b=buffer(),before=structuredClone(b);assert.throws(()=>change(b,uid,'ROWS','TEXT',false),{code:'FORM_ITEM_TYPE_CONFIRMATION_REQUIRED'});assert.deepEqual(b,before);
 const after=change(b,uid,'ROWS','TEXT',true);assert.deepEqual(after.definition.items[0],{...before.definition!.items[0],valueType:'TEXT',repeated:false,fields:[]});assert.equal(after.dirty,true);assert.equal(after.version,2);assert.equal(after.reason,'기존 개정 이유');assert.deepEqual(b,before);
});
test('반복필드0인 항목도 명시 전환하고 TEXT에서 반복형으로 변경하면 필드누락을 그대로 검사한다',()=>{
 const b=buffer();b.definition!.items[0]!.fields=[];const plain=change(b,uid,'ROWS','TEXT',false);assert.equal(validateCustomForm(plain.definition).validForConfirmation,true);
 const records=change(plain,uid,'ROWS','RECORDS',false);assert.equal(records.definition.items[0].repeated,true);assert.deepEqual(records.definition.items[0].fields,[]);assert.ok(validateCustomForm(records.definition).issues.some(i=>i.code==='REPEAT_FIELDS_INVALID'));assert.equal(validateCustomForm(records.definition).validForConfirmation,false);
});
test('동결 명령·타주체/항목·비공통본·중복항목·알수없는형식은 입력/명령을 바꾸지 않는다',()=>{
 for(const mode of ['PENDING','REVIEW','OWNER','ITEM','SCOPE','DUPLICATE','TYPE']){const b=buffer();if(mode==='PENDING')b.pending={request:{commandId:'원명령'} as any,name:'내 양식',formCode:'CUSTOM'};if(mode==='REVIEW')b.review={pending:{commandId:'원검토'}} as any;if(mode==='OWNER')b.ownerUserId='다른주체';if(mode==='ITEM')b.itemId='OTHER';if(mode==='SCOPE')b.definition!.scope='SYSTEM';if(mode==='DUPLICATE')b.definition!.items.push(structuredClone(b.definition!.items[0]!));const old=structuredClone(b);assert.throws(()=>change(b,uid,'ROWS',mode==='TYPE'?'SCRIPT':'TEXT',true),{code:'FORM_ITEM_TYPE_INVALID'});assert.deepEqual(b,old);}
});
test('이미 같은 형식이면 재초기화·필드 삭제·dirty 변경 없이 원버퍼를 반환한다',()=>{
 const b=buffer();assert.equal(change(b,uid,'ROWS','RECORDS',false),b);assert.equal(b.dirty,false);assert.equal(b.definition!.items[0]!.fields.length,1);
});
