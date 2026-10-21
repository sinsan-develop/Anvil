import assert from 'node:assert/strict';
import test from 'node:test';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import type {DocumentBuffer} from '../../../apps/web/src/features/design-trace/editor-api.ts';
import type {ImportSummary} from '../../../apps/web/src/features/design-trace/materials-api.ts';
import {contentHash} from '../../../contracts/canonical.ts';
const m=await import('../../../apps/web/src/features/design-trace/document-attachments.ts').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return null;throw e;});
const pid='11111111-1111-4111-8111-111111111111',uid='22222222-2222-4222-8222-222222222222',id='33333333-3333-4333-8333-333333333333',aid='44444444-4444-4444-8444-444444444444',text='보관한 첨부 원문',artifact={artifactId:aid,bytes:Buffer.byteLength(text),contentHash:contentHash(Buffer.from(text)),mediaType:'text/plain;charset=utf-8'};
const session={user:{id:uid},clientId:uid,csrfToken:'C'.repeat(43)};
const source:ImportSummary={id,originalRef:artifact,intendedFormRef:null,status:'READY',parserVersion:'UTF8_IDENTITY_1',extractedContentRef:artifact,losses:[],issues:[],createdAt:'2026-10-21T04:00:00Z',integrity:'NOT_RECHECKED'};
function buffer():DocumentBuffer{return{projectId:pid,ownerUserId:uid,documentId:id,baseVersion:1,formRef:{id,version:1,contentHash:'a'.repeat(64)},title:'기존문서',body:'기존본문',mediaType:'text/plain;charset=utf-8',content:{attachments:[],sections:[],sourceRefs:[]},criteria:[],reason:'작성사유',controlGeneration:1,dirty:false,pending:null,savedRef:null,failure:null};}
function client(kind='NORMAL'){const calls:string[]=[];return{calls,api:new ApiClient(async(url:any)=>{calls.push(String(url));return String(url).endsWith('/files/'+aid)?new Response(kind==='HASH'?'바뀐본문':text,{headers:{'Content-Type':'application/octet-stream'}}):kind==='DENIED'?new Response(JSON.stringify({code:'PERMISSION_DENIED'}),{status:403,headers:{'Content-Type':'application/json'}}):Response.json({...source,selections:[]});})};}
test('같은project 고정후보의 원본문/hash를 조회해 첨부한뒤 본문/양식/기준은 보존하고 제외는참조만바꾼다',async()=>{
 assert.equal(typeof m?.readDocumentAttachment,'function');const f=client(),b=buffer(),before=structuredClone(b);
 const choice=await m!.readDocumentAttachment(f.api,pid,source,()=>true);
 assert.deepEqual(f.calls,['/api/v1/projects/'+pid+'/imports/'+id,'/api/v1/projects/'+pid+'/files/'+aid]);
 const next=m!.attachDocumentOriginal(b,session,choice);assert.deepEqual(next.content.attachments,[artifact]);assert.equal(next.body,b.body);assert.deepEqual(next.formRef,b.formRef);assert.equal(next.reason,b.reason);assert.equal(next.dirty,true);assert.equal(next.pending,null);assert.deepEqual(b,before);
 const removed=m!.removeDocumentAttachment(next,session,artifact);assert.deepEqual(removed.content.attachments,[]);assert.deepEqual(next.content.attachments,[artifact]);
});
test('거절/변조 hash/이탈은 첨부가능 원문으로 반환하지 않는다',async()=>{
 assert.equal(typeof m?.readDocumentAttachment,'function');
 for(const kind of ['DENIED','HASH']){const f=client(kind);await assert.rejects(()=>m!.readDocumentAttachment(f.api,pid,source,()=>true),e=>e instanceof Error&&'code'in e&&e.code===(kind==='DENIED'?'PERMISSION_DENIED':'ARTIFACT_INTEGRITY_FAILED'));}
 const f=client();await assert.rejects(()=>m!.readDocumentAttachment(f.api,pid,source,()=>false));assert.deepEqual(f.calls,[]);
});
test('다른project/중복·기존명령/가져오기·제안/다른사용자와원본보존첨부제외는거절한다',()=>{
 assert.equal(typeof m?.attachDocumentOriginal,'function');const b=buffer(),choice={projectId:pid,artifact};
 for(const patch of [{projectId:uid},{pending:{}},{importState:{}},{importPreparationId:'busy'},{proposalState:{}},{workPlanState:{}},{ownerUserId:pid}]){
  const value={...b,...patch} as any,before=structuredClone(value);assert.throws(()=>m!.attachDocumentOriginal(value,session,choice),e=>e instanceof Error&&'code'in e&&e.code==='DOCUMENT_ATTACHMENT_LOCKED');assert.deepEqual(value,before);
 }
 const attached=m!.attachDocumentOriginal(b,session,choice);assert.throws(()=>m!.attachDocumentOriginal(attached,session,choice));
 assert.throws(()=>m!.removeDocumentAttachment({...attached,importCandidateRef:id},session,artifact));
});
