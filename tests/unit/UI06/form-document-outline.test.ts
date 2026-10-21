import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {ApiClient} from '../../../apps/web/src/api/client.ts';import {buildOfficialForms} from '../../../apps/server/modules/documents/forms.ts';
const m:any=await import('../../../apps/web/src/features/design-trace/form-document-outline.ts').catch((e:any)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const pid='10000000-0000-4000-8000-000000000001',uid='20000000-0000-4000-8000-000000000002',session={user:{id:uid},clientId:uid,csrfToken:'C'.repeat(43)};
const catalog=buildOfficialForms(await readFile(new URL('../../../docs/design/공식산출물_양식정의.md',import.meta.url)),await readFile(new URL('../../../docs/design/문서작성_공통기준.md',import.meta.url)));
const form=(i=0)=>({...catalog.forms[i]!,authoringStandard:{ref:catalog.standard.ref,content:catalog.standard.body.toString('utf8')},validation:{formatOnly:true,contentReview:'NOT_PERFORMED',userAcceptance:'NOT_PERFORMED'}});
function prepare(...args:any[]){assert.equal(typeof m.prepareFormDocumentOutline,'function');return m.prepareFormDocumentOutline(...args);}
const control={id:pid,participation:'OWNER',controlState:{actorId:uid,clientId:uid,generation:3,status:'HELD'}};
test('공식8종의 정확 양식 항목/빈 반복표/시작줄을 미저장 초안으로 준비하고 값·검토·확정을 만들지 않는다',async()=>{
 for(let i=0;i<catalog.forms.length;i++){const f=form(i),before=structuredClone(f),calls:string[]=[],v=await prepare(new ApiClient(async(p,init)=>{assert.equal(init?.method,'GET');calls.push(String(p));return Response.json(String(p).includes('/forms/')?f:control);}),pid,f.ref,session,()=>true);
 assert(v);assert.equal(v.pending,null);assert.equal(v.savedRef,null);assert.equal(v.documentId,null);assert.equal(v.dirty,true);assert.equal(v.reason,'');assert.deepEqual(v.formRef,f.ref);assert.equal(v.content.sections.length,f.definition.items.length);const lines=v.body.split('\n');for(const item of f.definition.items){const section=v.content.sections.find((s:any)=>s.itemId===item.itemId);assert(lines[Number(section.anchor.slice(5))-1].includes(item.itemId));if(item.valueType==='RECORDS')assert(v.body.includes('| '+item.fields.map(field=>field.title).join(' | ')+' |'));}assert.equal(calls.length,2);assert.deepEqual(f,before);
 }
});
test('다른 제어·양식 내용/hash변조와 조회중 이탈을 준비 성공으로 바꾸지 않는다',async()=>{
 const f=form();await assert.rejects(prepare(new ApiClient(async()=>Response.json({...control,participation:'VIEWER'})),pid,f.ref,session,()=>true),{code:'PROJECT_CONTROL_REQUIRED'});
 for(const changed of [{...f,definition:{...f.definition,name:'변조'}},{...f,authoringStandard:{...f.authoringStandard,content:'변조'}}])await assert.rejects(prepare(new ApiClient(async p=>Response.json(String(p).includes('/forms/')?changed:control)),pid,f.ref,session,()=>true));
 let active=true,calls=0;assert.equal(await prepare(new ApiClient(async()=>{calls++;active=false;return Response.json(control);}),pid,f.ref,session,()=>active),null);assert.equal(calls,1);
});
