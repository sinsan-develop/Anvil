import test from 'node:test';
import assert from 'node:assert/strict';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {newDocument,prepareDocumentSave} from '../../../apps/web/src/features/design-trace/editor-api.ts';
import {stageDocumentFixture} from './stage-document-fixture.ts';
import type {FormVersion} from '../../../apps/web/src/features/methodologies/forms-api.ts';
import {validateDocumentConfirmation} from '../../../apps/server/modules/documents/document-validation.ts';
const m:any=await import('../../../apps/web/src/features/design-trace/form-content-entry.ts').catch((e:any)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
function fixture(){const f=stageDocumentFixture();const draft=newDocument(f.choice.projectId,f.form as FormVersion,f.session.user.id,7);draft.stageNodeRef={applicationId:f.choice.applicationRef.id,nodeId:f.choice.nodeId};return{...f,draft,client:new ApiClient(async p=>Response.json(String(p).includes('/forms/')?f.form:f.project))};}
test('양식 TEXT·반복행의 사람 입력은 단계·첨부를 유지하고 기존 저장 payload의 실제 본문·시작줄로 이어진다',async()=>{
 assert.equal(typeof m.prepareFormContentEntry,'function');const f=fixture(),before=structuredClone(f.draft);
 const prepared=await m.prepareFormContentEntry(f.client,f.draft,f.session,()=>true);assert.equal(prepared.body,'');assert.deepEqual(f.draft,before);
 const entry=structuredClone(prepared.formEntry),text=entry.form.items.find((i:any)=>i.valueType==='TEXT'),records=entry.form.items.find((i:any)=>i.valueType==='RECORDS');assert(text&&records);
 entry.values[text.itemId]='사용자가 작성한 목적\n상세 범위';entry.values[records.itemId]=[Object.fromEntries(records.fields.map((field:any,i:number)=>[field.fieldId,i===0?'첫 실제 업무':'사용자 입력 '+i]))];
 const value=m.applyFormContentEntry(prepared,entry);assert(value.body.includes('사용자가 작성한 목적\n상세 범위'));assert(value.body.includes('첫 실제 업무'));assert.deepEqual(value.stageNodeRef,f.draft.stageNodeRef);assert.deepEqual(value.content.attachments,[]);assert.equal(value.pending,null);assert.equal(value.savedRef,null);
 for(const section of value.content.sections)assert(value.body.split('\n')[Number(section.anchor.slice(5))-1].includes(section.itemId));
 const pending=await prepareDocumentSave({...value,title:'사람 작성 설계',reason:'항목별 직접 작성'},f.session);assert.equal(pending.body,value.body);assert.deepEqual(pending.content.sections,value.content.sections);assert.deepEqual(pending.stageNodeRef,value.stageNodeRef);assert.equal(prepared.body,'');
});
test('기존 원문·잠긴 초안·제어세대 변경·변조 양식·이탈을 새 양식 입력으로 덮지 않는다',async()=>{
 assert.equal(typeof m.prepareFormContentEntry,'function');const f=fixture();let calls=0;const client=new ApiClient(async()=>{calls++;return Response.json(f.project);});
 for(const patch of [{body:'기존 입력'},{documentId:f.choice.projectId},{importPreparationId:'pending'},{proposalState:{}},{pending:{}}])await assert.rejects(m.prepareFormContentEntry(client,{...f.draft,...patch},f.session,()=>true),{code:'FORM_ENTRY_UNAVAILABLE'});assert.equal(calls,0);
 await assert.rejects(m.prepareFormContentEntry(new ApiClient(async p=>Response.json(String(p).includes('/forms/')?f.form:{...f.project,controlState:{...f.project.controlState,generation:8}})),f.draft,f.session,()=>true),{code:'CONTROL_GENERATION_CONFLICT'});
 await assert.rejects(m.prepareFormContentEntry(new ApiClient(async p=>Response.json(String(p).includes('/forms/')?{...f.form,definition:{...f.form.definition,purpose:'변조'}}:f.project)),f.draft,f.session,()=>true),{code:'RESPONSE_INVALID'});
 let active=true;assert.equal(await m.prepareFormContentEntry(new ApiClient(async()=>{active=false;return Response.json(f.project);}),f.draft,f.session,()=>active),null);
});
test('잘못된 필드·과대 입력·외부에서 바뀐 원문은 적용하지 않고 기존 사람 입력을 보존한다',async()=>{
 assert.equal(typeof m.applyFormContentEntry,'function');const f=fixture(),prepared=await m.prepareFormContentEntry(f.client,f.draft,f.session,()=>true),entry=structuredClone(prepared.formEntry),item=entry.form.items[0];
 assert.throws(()=>m.applyFormContentEntry({...prepared,body:'외부 편집'},entry),{code:'FORM_ENTRY_UNAVAILABLE'});
 entry.values.unknown='허용되지 않은 항목';assert.throws(()=>m.applyFormContentEntry(prepared,entry),{code:'FORM_ENTRY_INPUT_INVALID'});delete entry.values.unknown;
 entry.values[item.itemId]=item.valueType==='TEXT'?'x'.repeat(2097153):[Object.fromEntries(item.fields.map((v:any)=>[v.fieldId,'x'.repeat(2097153)]))];assert.throws(()=>m.applyFormContentEntry(prepared,entry),{code:'FORM_ENTRY_INPUT_INVALID'});assert.equal(prepared.body,'');
});
test('필수 항목을 실제 작성한 반복자료는 기존 서버의 Markdown 표 확인검사를 통과하고 pipe·개행을 구분한다',async()=>{
 const f=fixture(),prepared=await m.prepareFormContentEntry(f.client,f.draft,f.session,()=>true),entry=structuredClone(prepared.formEntry);
 for(const item of entry.form.items)entry.values[item.itemId]=item.valueType==='TEXT'?'사람이 작성한 실제 범위\r두 번째 설명':[Object.fromEntries(item.fields.map((field:any,i:number)=>[field.fieldId,i===0?'업무|01\n추가 설명':'실제 내용 '+i]))];
 const value=m.applyFormContentEntry(prepared,entry);assert.deepEqual(validateDocumentConfirmation(value.body,value.content.sections,entry.form).issues,[]);assert(value.body.includes('업무\\|01<br>추가 설명'));
});
test('허용 바이트 내 많은 줄 입력도 함수 인수 한도 예외 없이 본문과 다음 항목 위치를 만든다',async()=>{
 const f=fixture(),prepared=await m.prepareFormContentEntry(f.client,f.draft,f.session,()=>true),entry=structuredClone(prepared.formEntry),item=entry.form.items.find((i:any)=>i.valueType==='TEXT');entry.values[item.itemId]='실제 내용\n'+'\n'.repeat(150000);const value=m.applyFormContentEntry(prepared,entry);assert(value.body.includes(entry.values[item.itemId]));for(const section of value.content.sections)assert(value.body.split('\n')[Number(section.anchor.slice(5))-1].includes(section.itemId));
});
