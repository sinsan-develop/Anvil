import test from 'node:test';import assert from 'node:assert/strict';
import {ApiClient} from '../../../apps/web/src/api/client.ts';import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
const m=await import('../../../apps/web/src/features/design-trace/stored-document-attachment.ts').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return null;throw e;});
const pid='11111111-1111-4111-8111-111111111111',did='22222222-2222-4222-8222-222222222222',aid='33333333-3333-4333-8333-333333333333',bid='44444444-4444-4444-8444-444444444444',formRef={id:did,version:1,contentHash:'a'.repeat(64)};
const artifact=(artifactId:string,s:string)=>({artifactId,bytes:Buffer.byteLength(s),contentHash:contentHash(Buffer.from(s)),mediaType:'text/plain;charset=utf-8'}),body=artifact(bid,'본문'),attachment=artifact(aid,'첨부 원문');
const content={body,attachments:[attachment],sections:[],sourceRefs:[]},ref={id:did,version:2,contentHash:contentHash(canonicalJson({title:'문서',formRef,stageNodeRef:null,content}))};
function fixture(mode='NORMAL'){
 const calls:string[]=[];let active=true;const doc={id:did,version:2,title:'문서',formRef,stageNodeRef:null,stageBinding:null,contentHash:ref.contentHash,content,confirmed:false,validation:{validForConfirmation:true,issues:[]},statusHistory:[],contentReviewCriteria:{criteriaVersion:1,formRef,items:[{criterionId:'REQ',title:'요구',reviewCriteria:['대조']}]},contentReviews:[]};
 return{calls,active:()=>active,api:new ApiClient(async(url:any)=>{calls.push(String(url));if(String(url).includes('/documents/')){if(mode==='DENIED')return new Response(JSON.stringify({code:'PERMISSION_DENIED'}),{status:403,headers:{'Content-Type':'application/json'}});if(mode==='LEAVE')active=false;return Response.json(mode==='SNAPSHOT'?{...doc,title:'변조된 문서'}:doc);}return new Response(String(url).endsWith(aid)?mode==='HASH'?'바뀐본문':'첨부 원문':'본문',{headers:{'Content-Type':'application/octet-stream'}});})};
}
test('고정문서 snapshot와 exact첨부귀속을 확인하고 같은project 원문 bytes/hash를 읽는다',async()=>{
 assert.equal(typeof m?.readStoredDocumentAttachment,'function');const f=fixture();assert.equal(await m!.readStoredDocumentAttachment(f.api,pid,ref,attachment,f.active),'첨부 원문');assert.deepEqual(f.calls,['/api/v1/projects/'+pid+'/documents/'+did+'/versions/2','/api/v1/projects/'+pid+'/files/'+bid,'/api/v1/projects/'+pid+'/files/'+aid]);
});
test('다른project·문서변조·첨부불일치·변조본문·거절·이탈은 원문을 반환하지 않는다',async()=>{
 assert.equal(typeof m?.readStoredDocumentAttachment,'function');
 for(const mode of ['DENIED','SNAPSHOT','HASH','LEAVE']){const f=fixture(mode);await assert.rejects(()=>m!.readStoredDocumentAttachment(f.api,pid,ref,attachment,f.active),e=>e instanceof Error&&'code'in e&&e.code===({DENIED:'PERMISSION_DENIED',SNAPSHOT:'DOCUMENT_REFERENCE_CHANGED',HASH:'ARTIFACT_INTEGRITY_FAILED',LEAVE:'DOCUMENT_READ_PAUSED'} as Record<string,string>)[mode]);if(mode!=='HASH')assert.ok(!f.calls.includes('/api/v1/projects/'+pid+'/files/'+aid));}
 const f=fixture();await assert.rejects(()=>m!.readStoredDocumentAttachment(f.api,pid,ref,{...attachment,contentHash:'b'.repeat(64)},f.active),e=>e instanceof Error&&'code'in e&&e.code==='DOCUMENT_ATTACHMENT_REFERENCE_CHANGED');assert.ok(!f.calls.some(s=>s.endsWith('/files/'+aid)));
 const stopped=fixture();await assert.rejects(()=>m!.readStoredDocumentAttachment(stopped.api,pid,ref,attachment,()=>false));assert.deepEqual(stopped.calls,[]);
 const foreign:string[]=[];const other=new ApiClient(async(url:any)=>{foreign.push(String(url));return new Response(JSON.stringify({code:'PERMISSION_DENIED'}),{status:403,headers:{'Content-Type':'application/json'}});});await assert.rejects(()=>m!.readStoredDocumentAttachment(other,aid,ref,attachment),e=>e instanceof Error&&'code'in e&&e.code==='PERMISSION_DENIED');assert.deepEqual(foreign,['/api/v1/projects/'+aid+'/documents/'+did+'/versions/2']);
});
