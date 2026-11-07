import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiClient } from '../../../apps/web/src/api/client.ts';
import { contentHash } from '../../../contracts/canonical.ts';
import type { DocumentBuffer } from '../../../apps/web/src/features/design-trace/editor-api.ts';
import * as imports from '../../../apps/web/src/features/design-trace/import-api.ts';

const project='11111111-1111-4111-8111-111111111111',user='22222222-2222-4222-8222-222222222222',draft='33333333-3333-4333-8333-333333333333',artifact='44444444-4444-4444-8444-444444444444',candidateId='55555555-5555-4555-8555-555555555555';
const session={user:{id:user},clientId:user,csrfToken:'C'.repeat(43)},hint={draftId:draft,artifactId:artifact};
const body='\uFEFF# 원문\r\n<script>자료일뿐</script>\r\n',bytes=new TextEncoder().encode(body),ref={artifactId:artifact,bytes:bytes.length,contentHash:contentHash(bytes),mediaType:'text/markdown;charset=utf-8'};
function buffer():DocumentBuffer{return{ownerUserId:user,projectId:project,documentId:null,baseVersion:0,formRef:{id:user,version:1,contentHash:'a'.repeat(64)},title:'내 제목',body:'내 입력',reason:'내 이유',mediaType:'text/markdown;charset=utf-8',content:{attachments:[],sections:[],sourceRefs:[]},criteria:[],controlGeneration:3,dirty:true,pending:null,savedRef:null,failure:null};}
function fixture(change?:(v:any)=>void){
 const draftView:any={draftId:draft,version:2,step:4,editable:false,consumedProjectId:project,input:{name:'프로젝트',purpose:'목적',desiredOutcome:'결과',sourceMode:'EMPTY',methodologySelection:null,artifactRefs:[ref]},storedArtifacts:[{commandId:user,expectedVersion:1,state:'FINALIZED',ref,artifactState:'READY',projectId:project}]};change?.(draftView);
 const calls:{url:string;method:string;command?:any}[]=[],candidate={id:candidateId,originalRef:ref,extractedContentRef:ref,intendedFormRef:buffer().formRef,parserVersion:'UTF8_IDENTITY_1',status:'READY',losses:[],issues:[]};
 let failPost=false,raw=bytes;
 const client=new ApiClient(async(url:any,options?:RequestInit)=>{const path=String(url),method=options?.method??'GET';calls.push({url:path,method});if(path==='/api/v1/project-drafts/'+draft)return Response.json(draftView);if(path==='/api/v1/projects/'+project+'/files/'+artifact)return new Response(raw,{headers:{'Content-Type':'application/octet-stream'}});if(path==='/api/v1/projects/'+project+'/imports/'+candidateId)return Response.json(candidate);if(path==='/api/v1/projects/'+project+'/commands'){const command=JSON.parse(String(options?.body));calls.at(-1)!.command=command;if(failPost)throw Error('lost');return Response.json({operationId:user,commandId:command.commandId,projectId:project,status:'APPLIED',targetId:artifact,version:null,serverReceivedAt:'2026-10-26T09:00:00Z',data:{status:'IMPORT_CANDIDATE',candidate}});}throw Error('unexpected '+path);});
 return{client,calls,draftView,candidate,lose:()=>{failPost=true;},recover:()=>{failPost=false;},corrupt:()=>{raw=new TextEncoder().encode('손상');}};
}
const prepare=()=>{const fn=(imports as any).prepareCreatedOriginalImport;assert.equal(typeof fn,'function','기존 원문 준비 기능');return fn;};
test('생성귀속 원문은 보호 재조회 후 파일 POST 없이 후보를 만들고 명시 채택 전 원입력을 보존한다',async()=>{
 const b=buffer(),before=structuredClone(b),f=fixture(),s=await prepare()(f.client,b,session,hint,()=>true);assert.deepEqual(b,before);assert.equal(s.upload,null);assert.equal(s.source,'CREATED_ORIGINAL');assert.deepEqual(s.bytes,bytes);assert.equal(s.record.operation,'importDocument');assert.deepEqual(s.record.payload,{fileRef:ref,intendedFormRef:b.formRef,sourceRefs:[]});
 const checkpoints:any[]=[];const result=await imports.continueDocumentImport(f.client,s,b.formRef,session,n=>checkpoints.push(n),()=>true);assert.ok(checkpoints.some(n=>n.uncertain));assert.equal(result.uncertain,false);assert.deepEqual(b,before);assert.equal(f.calls.filter(c=>c.method==='POST').length,1);assert.equal(f.calls.find(c=>c.method==='POST')!.command.operation,'importDocument');
 const adopted=await imports.adoptDocumentImport(f.client,{...b,importState:result},session);assert.equal(adopted.body,body);assert.equal(adopted.title,b.title);assert.equal(adopted.reason,b.reason);assert.deepEqual(adopted.content.attachments,[ref]);assert.equal(adopted.importCandidateRef,candidateId);assert.equal(adopted.pending,null);assert.equal(f.calls.filter(c=>c.method==='POST').length,1);
});
test('다른 귀속·선택 누락·UNKNOWN·격리·ref 변경·원문 손상은 후보나 입력을 만들지 않는다',async()=>{
 const changes=[(v:any)=>v.consumedProjectId=user,(v:any)=>v.storedArtifacts[0].projectId=user,(v:any)=>v.input.artifactRefs=[],(v:any)=>v.storedArtifacts[0].state='UNKNOWN',(v:any)=>v.storedArtifacts[0].artifactState='QUARANTINED',(v:any)=>v.storedArtifacts[0].ref={...ref,bytes:ref.bytes+1}];
 for(const change of changes){const f=fixture(change),b=buffer(),before=structuredClone(b);await assert.rejects(()=>prepare()(f.client,b,session,hint,()=>true));assert.deepEqual(b,before);assert.equal(f.calls.filter(c=>c.method==='POST').length,0);}
 const f=fixture();f.corrupt();await assert.rejects(()=>prepare()(f.client,buffer(),session,hint,()=>true));assert.equal(f.calls.filter(c=>c.method==='POST').length,0);
});
test('미확인 후보 명령은 같은 ID와 payload로만 재확인하고 재업로드하지 않는다',async()=>{
 const f=fixture(),b=buffer(),state=await prepare()(f.client,b,session,hint,()=>true);let saved=state;f.lose();await assert.rejects(()=>imports.continueDocumentImport(f.client,state,b.formRef,session,n=>saved=n,()=>true));assert.equal(saved.uncertain,true);f.recover();const result=await imports.continueDocumentImport(f.client,saved,b.formRef,session,n=>saved=n,()=>true);assert.equal(result.candidate?.id,candidateId);const posts=f.calls.filter(c=>c.method==='POST');assert.equal(posts.length,2);assert.deepEqual(posts[0]!.command,posts[1]!.command);assert.ok(posts.every(c=>c.url.endsWith('/commands')));
});
test('현재성 철회·양식과 주체 변경은 원명령을 보존하고 후속 POST를 중단한다',async()=>{
 const f=fixture(),b=buffer(),state=await prepare()(f.client,b,session,hint,()=>true),before=structuredClone(state);for(const [form,s,active]of[[{...b.formRef,version:2},session,()=>true],[b.formRef,{...session,clientId:artifact},()=>true],[b.formRef,{...session,user:{id:artifact}},()=>true],[b.formRef,session,()=>false]]as const)await assert.rejects(()=>imports.continueDocumentImport(f.client,state,form,s,()=>{},active));assert.deepEqual(state,before);assert.equal(f.calls.filter(c=>c.method==='POST').length,0);
 let active=true;const late=new ApiClient(async()=>{active=false;return Response.json(f.draftView);});await assert.rejects(()=>prepare()(late,b,session,hint,()=>active));
});
test('잘못된 현재 양식·이미 준비 중인 입력은 보호 자료도 읽지 않는다',async()=>{
 for(const patch of[{formRef:{id:user,version:0,contentHash:'a'.repeat(64)}},{formRef:{id:user,version:1,contentHash:'bad'}},{importPreparationId:'other-in-progress'}]){
  const f=fixture(),b={...buffer(),...patch};await assert.rejects(()=>prepare()(f.client,b,session,hint,()=>true));assert.equal(f.calls.length,0);
 }
});
