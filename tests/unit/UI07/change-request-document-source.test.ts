import test from 'node:test';
import assert from 'node:assert/strict';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {newDesignChangeRequest} from '../../../apps/web/src/features/design-change/request-api.ts';
const mod:any=await import(new URL('../../../apps/web/src/features/design-change/change-request-document-source.ts',import.meta.url).href).catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
const id='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',session={user:{id},clientId:id,csrfToken:'C'.repeat(43)},ref={id,version:1,contentHash:'a'.repeat(64)};
function fixture(change:(stage:string)=>void=()=>{},sources:any[]=[]){
 const body='고정된 변경 근거',bytes=Buffer.from(body),formRef=ref,content={body:{artifactId:other,bytes:bytes.length,contentHash:contentHash(bytes),mediaType:'text/plain;charset=utf-8'},attachments:[],sections:[],sourceRefs:structuredClone(sources)};
 const document={sourceRefs:structuredClone(sources),id,version:1,title:'근거',formRef,stageNodeRef:null,content,contentHash:contentHash(canonicalJson({title:'근거',formRef,stageNodeRef:null,content})),confirmed:false,validation:{validForConfirmation:false,issues:[]},statusHistory:[],contentReviewCriteria:{criteriaVersion:1,formRef,items:[]},contentReviews:[]};
 const calls:string[]=[],client=new ApiClient(async url=>{calls.push(String(url));const stage=String(url).includes('/documents/')?'metadata':'body';change(stage);return stage==='metadata'?Response.json(document):new Response(bytes,{headers:{'content-type':'application/octet-stream'}});});
 return{body,document,client,calls,buffer:newDesignChangeRequest(id,session,3,ref,other)};
}
const fn=(name:string)=>{assert.equal(typeof mod[name],'function',name+' 누락');return mod[name];};
test('고정 문서 원문을 읽고 같은 미동결 요청에만 출처를 복사하며 중복은 보존한다',async()=>{
 const f=fixture(),value=await fn('readChangeRequestDocumentSource')(f.client,id,id,1,()=>true);assert.equal(value.body,f.body);assert.equal(f.calls.length,2);
 const source={kind:'DOCUMENT_VERSION',id,version:1,contentHash:f.document.contentHash},append=fn('attachChangeRequestDocumentSource'),next=append(f.buffer,f.buffer,session,source);
 assert.deepEqual(next.sourceRefs,[source]);assert.equal(f.buffer.sourceRefs.length,0);assert.equal(append(next,f.buffer,session,source),next);
});
test('읽기 전·metadata 뒤·body 뒤 이탈은 후속 GET과 원문 채택을 막는다',async()=>{
 for(const stage of ['before','metadata','body']){let active=stage!=='before';const f=fixture(s=>{if(s===stage)active=false;});await assert.rejects(fn('readChangeRequestDocumentSource')(f.client,id,id,1,()=>active));assert.equal(f.calls.length,stage==='before'?0:stage==='metadata'?1:2);}
});
test('같은 bindingId라도 주체·세대·제안·설계·pending/result/uncertain 변경이면 연결하지 않는다',()=>{
 const f=fixture(),append=fn('attachChangeRequestDocumentSource'),source={kind:'DOCUMENT_VERSION',id,version:1,contentHash:f.document.contentHash};
 for(const patch of [{projectId:other},{ownerUserId:other},{ownerClientId:other},{controlGeneration:4},{proposalId:id},{beforeRef:{...ref,version:2}},{pending:{}},{result:{}},{uncertain:true}]){const current={...f.buffer,...patch};assert.equal(append(current,f.buffer,session,source),current);assert.equal(fn('changeRequestSourceBindingMatches')(current,f.buffer,session),false);}
 assert.equal(append(f.buffer,{...f.buffer,ownerUserId:other},session,source),f.buffer);
 assert.equal(append(f.buffer,f.buffer,session,{...source,version:0}),f.buffer);
});
test('문서 metadata 내용hash 변조는 본문이 맞아도 출처로 채택하지 않는다',async()=>{
 const f=fixture();f.document.title='변조된 제목';await assert.rejects(fn('readChangeRequestDocumentSource')(f.client,id,id,1,()=>true));
});

const fourSources=[{kind:'DOCUMENT_VERSION',id:other,version:2,contentHash:'b'.repeat(64)},{kind:'CONVERSATION',id:other,contentHash:'c'.repeat(64)},{kind:'USER_INSTRUCTION',id:other,contentHash:'d'.repeat(64)},{kind:'ARTIFACT',id:other,contentHash:'e'.repeat(64)}];
test('정상4종 문서출처는 변경요청의 단일 DOCUMENT_VERSION으로만 명시 연결한다',async()=>{
 const f=fixture(undefined,fourSources),value=await fn('readChangeRequestDocumentSource')(f.client,id,id,1,()=>true);assert.deepEqual(value.document.content.sourceRefs,fourSources);assert.equal(value.body,f.body);
 const source={kind:'DOCUMENT_VERSION',id,version:1,contentHash:f.document.contentHash},next=fn('attachChangeRequestDocumentSource')(f.buffer,f.buffer,session,source);assert.deepEqual(next.sourceRefs,[source]);assert.equal(f.buffer.sourceRefs.length,0);assert.equal(f.calls.length,2);
});

test('4종 문서의 미지원종류·추가키·분리출처 불일치는 파일 GET 전에 거절한다',async()=>{
 for(const patch of [{kind:'REMOTE_FILE'},{extra:'unexpected'},{kind:'USER_INSTRUCTION',version:1}]){const bad=structuredClone(fourSources);bad[0]={...bad[0]!,...patch};const f=fixture(undefined,bad);await assert.rejects(fn('readChangeRequestDocumentSource')(f.client,id,id,1,()=>true));assert.equal(f.calls.length,1);}
 const f=fixture(undefined,fourSources);f.document.sourceRefs=[];await assert.rejects(fn('readChangeRequestDocumentSource')(f.client,id,id,1,()=>true));assert.equal(f.calls.length,1);
 const g=fixture(undefined,fourSources);g.document.content.sourceRefs=[];g.document.sourceRefs=[];await assert.rejects(fn('readChangeRequestDocumentSource')(g.client,id,id,1,()=>true));assert.equal(g.calls.length,2);
});
test('4종 출처의 metadata/body 이탈도 결과를 채택하지 않으며 다른 요청 binding에는 연결하지 않는다',async()=>{
 for(const stage of ['metadata','body']){let active=true;const f=fixture(s=>{if(s===stage)active=false;},fourSources);await assert.rejects(fn('readChangeRequestDocumentSource')(f.client,id,id,1,()=>active));assert.equal(f.calls.length,stage==='metadata'?1:2);}
 const f=fixture(undefined,fourSources),source={kind:'DOCUMENT_VERSION',id,version:1,contentHash:f.document.contentHash},next={...f.buffer,bindingId:other};assert.equal(fn('attachChangeRequestDocumentSource')(next,f.buffer,session,source),next);
});
