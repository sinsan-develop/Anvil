import assert from 'node:assert/strict';
import test from 'node:test';
import {ApiClient,ApiError} from '../../../apps/web/src/api/client.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {documentDraftHash,editDocument,prepareDocumentSave,continueDocumentSave,type DocumentContent} from '../../../apps/web/src/features/design-trace/editor-api.ts';
import {readDocumentSourceRefs,readDocumentSource,documentSourceKey} from '../../../apps/web/src/features/design-trace/document-source-refs.ts';
import {readDocument} from '../../../apps/web/src/features/design-trace/api.ts';
const id=(n:number)=>'a6f30000-0000-4000-8000-'+String(n).padStart(12,'0'),pid=id(1),uid=id(2),cid=id(3);
const session={user:{id:uid},clientId:cid,csrfToken:'a'.repeat(43)},body='고정 문서 원문😀',at='2026-11-08T00:00:00.000Z';
const refs=[{kind:'DOCUMENT_VERSION',id:id(10),version:2,contentHash:'a'.repeat(64)},{kind:'CONVERSATION',id:id(11),contentHash:'b'.repeat(64)},{kind:'USER_INSTRUCTION',id:id(12),contentHash:'c'.repeat(64)},{kind:'ARTIFACT',id:id(13),contentHash:'d'.repeat(64)}];
function wire(sources:any[]=refs):any{
 const formRef={id:id(4),version:1,contentHash:'e'.repeat(64)},content={body:{artifactId:id(5),bytes:Buffer.byteLength(body),contentHash:contentHash(Buffer.from(body)),mediaType:'text/plain;charset=utf-8'},attachments:[],sections:[],sourceRefs:sources};
 return {id:id(6),version:2,title:'보관 문서',confirmed:false,formRef,stageNodeRef:null,content,sourceRefs:structuredClone(sources),contentHash:contentHash(canonicalJson({title:'보관 문서',formRef,stageNodeRef:null,content})),validation:{validForConfirmation:false,issues:[]},statusHistory:[],contentReviewCriteria:{criteriaVersion:1,formRef,items:[]},contentReviews:[]};
}
const response=(v:unknown,status=200)=>Response.json(v,{status});
test('4종 문서의 고정 GET과 편집 pending은 같은 refs/hash를 보존한다',async()=>{
 const doc=wire(),calls:string[]=[],client=new ApiClient(async path=>{calls.push(String(path));return String(path).includes('/files/')?new Response(Buffer.from(body),{headers:{'content-type':'application/octet-stream'}}):response(doc);});
 const view=await readDocument(client,pid,doc.id,2,{expectedContentHash:doc.contentHash});
 assert.deepEqual(view.document.content.sourceRefs,refs);
 const b=editDocument(pid,view,uid,1);b.reason='출처 보존';b.dirty=true;
 const pending=await prepareDocumentSave(b,session);assert.deepEqual(pending.content.sourceRefs,refs);
 const input={...doc.content,sourceRefs:refs} as DocumentContent;
 assert.equal(await documentDraftHash(doc.title,doc.formRef,input),doc.contentHash);
 (b.content.sourceRefs as any[])[0].contentHash='f'.repeat(64);assert.deepEqual(pending.content.sourceRefs,refs);assert.equal(calls.length,2);
});
test('원 refs는 save 원명령/hash에 포함되고 응답 유실 후 같은 packet만 재확인한다',async()=>{
 const d=wire(),b=editDocument(pid,{document:d,body},uid,1);b.reason='명시 저장';b.dirty=true;let pending=await prepareDocumentSave(b,session);
 const packets:any[]=[];let lost=true;
 const client=new ApiClient(async(_path,init)=>{
  const u=init?.headers as Record<string,string>,raw=typeof init?.body==='string'?init.body:u['X-Anvil-Command'];assert.ok(typeof raw==='string');const c=JSON.parse(raw);packets.push(c);
  if(c.operation==='uploadArtifact'){const artifactRef={artifactId:id(7),...c.payload};return response({commandId:c.commandId,projectId:pid,status:'APPLIED',operationId:id(8),targetId:artifactRef.artifactId,version:null,serverReceivedAt:at,data:{artifactRef,status:'ARTIFACT_READY'}});}
  assert.deepEqual(c.payload.content.sourceRefs,refs);if(lost){lost=false;throw Error('합성 응답 유실');}
  const ref={id:d.id,version:3,contentHash:contentHash(canonicalJson({title:c.payload.title,formRef:c.payload.formRef,stageNodeRef:null,content:c.payload.content}))};
  return response({commandId:c.commandId,projectId:pid,status:'APPLIED',operationId:id(8),targetId:d.id,version:3,serverReceivedAt:at,data:{ref,status:'DRAFT'}});
 });
 await assert.rejects(continueDocumentSave(client,pending,session,p=>{pending=p;},()=>true),{code:'CONNECTION_LOST'});
 const before=structuredClone(pending);assert.equal(packets.length,2);const ref=await continueDocumentSave(client,pending,session,p=>{pending=p;},()=>true);
 assert.equal(ref.version,3);assert.deepEqual(pending,before);assert.deepEqual(packets[2],packets[1]);assert.equal(packets.filter(p=>p.operation==='uploadArtifact').length,1);
});


test('오염 sourceRefs·별도열 불일치·hash-valid 잘못된 종류는 본문 GET 전에 거절한다',async()=>{
 const bad=[null,[{...refs[0],verified:true}],[{...refs[0],version:0}],[{...refs[0],kind:'REMOTE_FILE'}],[refs[0],refs[0]],Array.from({length:201},(_,i)=>({...refs[0],id:id(1000+i)}))];
 for(const value of bad){const d=wire();d.content.sourceRefs=value;d.sourceRefs=value;d.contentHash=contentHash(canonicalJson({title:d.title,formRef:d.formRef,stageNodeRef:null,content:d.content}));let files=0;
  const c=new ApiClient(async path=>{if(String(path).includes('/files/'))files++;return response(d);});await assert.rejects(readDocument(c,pid,d.id,2,{expectedContentHash:d.contentHash}),ApiError);assert.equal(files,0);
 }
 for(const mode of ['mismatch','missing','hash'] as const){const d=wire();if(mode==='mismatch')d.sourceRefs=[];if(mode==='missing')delete d.sourceRefs;if(mode==='hash')d.contentHash='f'.repeat(64);let files=0;const c=new ApiClient(async path=>{if(String(path).includes('/files/'))files++;return response(d);});await assert.rejects(readDocument(c,pid,d.id,2,{expectedContentHash:d.contentHash}),ApiError);assert.equal(files,0);}
 let getters=0;assert.throws(()=>readDocumentSourceRefs([{kind:'ARTIFACT',id:id(13),get contentHash(){getters++;return 'd'.repeat(64);}}]));assert.equal(getters,0);
 assert.equal(documentSourceKey(refs[0] as any),documentSourceKey({...refs[0]} as any));
});
test('정확 발언/실지시 종류와 같은프로젝트 범위를 검산하고 지식 GET을 호출하지 않는다',async()=>{
 const cid=id(30),text='대화 원문',artifact={artifactId:id(31),bytes:Buffer.byteLength(text),contentHash:contentHash(Buffer.from(text)),mediaType:'text/plain;charset=utf-8'};
 const view=(kind:string,project=pid)=>{const message={kind,bodyRef:artifact,attachmentRefs:[],replyTo:null,supersedesInstructionRef:null,effectiveScope:{projectId:project,stageRefs:[],taskRefs:[]}},authorRef={kind:'HUMAN',userId:uid},snapshot={conversationId:cid,targetRoleRef:null,message,sourceRefs:[],serverSequence:1,authorRef};return {sourceRef:{kind:'CONVERSATION',id:id(32),contentHash:contentHash(canonicalJson(snapshot))},conversationId:cid,serverSequence:1,authorRef,message,body:text,deliveryState:'STORED',redactionState:'NOT_REDACTED',sensitiveInspection:'KNOWN_PATTERNS_ONLY',recordedAt:at};};
 for(const kind of ['USER_MESSAGE','USER_INSTRUCTION']){const v=view(kind),calls:string[]=[];const c=new ApiClient(async p=>{calls.push(String(p));return response(v);});const ref={...v.sourceRef,kind:kind==='USER_INSTRUCTION'?'USER_INSTRUCTION':'CONVERSATION'} as any;assert.equal((await readDocumentSource(c,pid,ref,{conversationId:cid})).body,text);assert.deepEqual(calls,[`/api/v1/projects/${pid}/conversations/${cid}/messages/${ref.id}`]);}
 for(const mode of ['kind','scope','body'] as const){const v=view(mode==='kind'?'USER_MESSAGE':'USER_INSTRUCTION',mode==='scope'?id(99):pid);if(mode==='body')v.body='다른 원문';const c=new ApiClient(async()=>response(v));await assert.rejects(readDocumentSource(c,pid,{...v.sourceRef,kind:'USER_INSTRUCTION'} as any,{conversationId:cid}),ApiError);}
 let reads=0;await assert.rejects(readDocumentSource(new ApiClient(async()=>{reads++;return response({});}),pid,{kind:'CONVERSATION',id:id(32),contentHash:'a'.repeat(64)}),{code:'DOCUMENT_SOURCE_LOCATION_REQUIRED'});assert.equal(reads,0);
});
test('보관 READY UTF8 2MiB만 원import/바이트를 읽고 오염·403·늦은scope는 선택하지 않는다',async()=>{
 const text='선택할 보관 원문',artifact={artifactId:id(50),bytes:Buffer.byteLength(text),contentHash:contentHash(Buffer.from(text)),mediaType:'text/plain;charset=utf-8'},ref={kind:'ARTIFACT',id:artifact.artifactId,contentHash:artifact.contentHash} as const;
 const candidate={id:id(51),originalRef:artifact,extractedContentRef:artifact,intendedFormRef:null,parserVersion:'UTF8_IDENTITY_1',status:'READY',losses:[],issues:[],createdAt:at,selections:[]},summary={...candidate,integrity:'NOT_RECHECKED'} as any;
 let calls:string[]=[];const c=new ApiClient(async p=>{calls.push(String(p));return String(p).includes('/files/')?new Response(Buffer.from(text),{headers:{'content-type':'application/octet-stream'}}):response(candidate);});assert.equal((await readDocumentSource(c,pid,ref,{import:summary})).body,text);assert.equal(calls.length,2);
 for(const patch of [{status:'UNSUPPORTED'},{originalRef:{...artifact,bytes:2*1024*1024+1}},{originalRef:{...artifact,mediaType:'image/png'}},{originalRef:{...artifact,contentHash:'f'.repeat(64)}}]){calls=[];await assert.rejects(readDocumentSource(c,pid,ref,{import:{...summary,...patch}}),ApiError);assert.deepEqual(calls,[]);}
 await assert.rejects(readDocumentSource(new ApiClient(async()=>response({code:'ACCESS_DENIED'},403)),pid,ref,{import:summary}),{status:403});
 let active=true,files=0;const stale=new ApiClient(async p=>{if(String(p).includes('/files/'))files++;active=false;return response(candidate);});await assert.rejects(readDocumentSource(stale,pid,ref,{import:summary},()=>active),ApiError);assert.equal(files,0);
});
