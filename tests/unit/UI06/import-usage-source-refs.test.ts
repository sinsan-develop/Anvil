import assert from 'node:assert/strict';
import test from 'node:test';
import {ApiClient,ApiError} from '../../../apps/web/src/api/client.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {readImportUsageDocument,type StoredImportView} from '../../../apps/web/src/features/design-trace/materials-api.ts';

// import-usage-original.spec.ts의 기존 candidate/selection/원본첨부 계약을 메모리로 구성한다.
// 실제 ApiClient·readStoredImport·readDocument를 소비하며 DB/served UI 증거는 아니다.
const id=(n:number)=>'a6f60000-0000-4000-8000-'+String(n).padStart(12,'0');
const pid=id(1),uid=id(2),did=id(3),candidateId=id(4),at='2026-11-08T00:00:00Z';
const originalText='보존한 가져오기 원문',body='편집한 사용 문서\r\n<script>실행하지 않는다</script>';
const artifact=(n:number,text:string)=>({artifactId:id(n),bytes:Buffer.byteLength(text),contentHash:contentHash(Buffer.from(text)),mediaType:'text/plain;charset=utf-8'});
const original=artifact(5,originalText),edited=artifact(6,body),formRef={id:id(7),version:1,contentHash:'a'.repeat(64)};
const fourSources=[{kind:'DOCUMENT_VERSION',id:id(8),version:2,contentHash:'b'.repeat(64)},{kind:'CONVERSATION',id:id(9),contentHash:'c'.repeat(64)},{kind:'USER_INSTRUCTION',id:id(10),contentHash:'d'.repeat(64)},{kind:'ARTIFACT',id:id(11),contentHash:'e'.repeat(64)}];
function fixture(sources:unknown[]=fourSources,mutate:(kind:string,value:any)=>any=(_k,v)=>v){
 const selection={documentId:did,version:3,selectedBy:uid,at};
 const candidate={id:candidateId,originalRef:original,extractedContentRef:original,intendedFormRef:formRef,parserVersion:'UTF8_IDENTITY_1',losses:[],issues:[],status:'READY' as const,createdAt:at,selections:[selection]};
 const content={body:edited,attachments:[original],sections:[],sourceRefs:structuredClone(sources)},title='출처가 있는 사용 문서';
 const document={id:did,version:3,title,formRef,stageNodeRef:null,content,sourceRefs:structuredClone(sources),contentHash:contentHash(canonicalJson({title,formRef,stageNodeRef:null,content})),confirmed:false,validation:{validForConfirmation:false,issues:[]},statusHistory:[],contentReviewCriteria:{criteriaVersion:1,formRef,items:[]},contentReviews:[],importCandidateRefs:[candidateId]};
 const calls:string[]=[],client=new ApiClient(async(url,init)=>{
  const path=String(url);calls.push(path);assert.equal(init?.method,'GET');assert.equal(init?.credentials,'same-origin');
  if(path===`/api/v1/projects/${pid}/imports/${candidateId}`)return Response.json(mutate('candidate',candidate));
  if(path===`/api/v1/projects/${pid}/documents/${did}/versions/3`)return Response.json(mutate('document',document));
  if(path===`/api/v1/projects/${pid}/files/${original.artifactId}`)return new Response(Buffer.from(mutate('original',originalText)),{headers:{'content-type':'application/octet-stream'}});
  if(path===`/api/v1/projects/${pid}/files/${edited.artifactId}`)return new Response(Buffer.from(mutate('body',body)),{headers:{'content-type':'application/octet-stream'}});
  throw Error('UNMODELED_IMPORT_USAGE_REQUEST');
 });
 const view:StoredImportView={candidate:structuredClone(candidate),body:originalText};
 return{client,calls,view,selection,document};
}
test('정상4종 출처와 빈 출처 사용문서는 정확 candidate/selection/원본첨부·전체 hash로 읽는다',async()=>{
 for(const sources of [fourSources,[]]){const f=fixture(sources),value=await readImportUsageDocument(f.client,pid,f.view,f.selection,()=>true);assert.equal(value.body,body);assert.deepEqual(value.document.content.sourceRefs,sources);assert.equal(value.document.contentHash,f.document.contentHash);assert.deepEqual(f.calls,[`/api/v1/projects/${pid}/imports/${candidateId}`,`/api/v1/projects/${pid}/files/${original.artifactId}`,`/api/v1/projects/${pid}/documents/${did}/versions/3`,`/api/v1/projects/${pid}/files/${edited.artifactId}`]);assert.equal(Object.hasOwn(f.view.candidate,'sourceRefs'),false);}
});

test('hash-valid 미지원 출처종류·추가키·분리열불일치는 사용문서 파일 GET0이다',async()=>{
 for(const patch of [{kind:'REMOTE_FILE'},{extra:'unexpected'},{kind:'USER_INSTRUCTION',version:1}]){const sources=structuredClone(fourSources);sources[0]={...sources[0]!,...patch};const f=fixture(sources);await assert.rejects(readImportUsageDocument(f.client,pid,f.view,f.selection,()=>true),ApiError);assert.equal(f.calls.some(p=>p.endsWith('/'+edited.artifactId)),false);}
 const f=fixture(fourSources,(k,v)=>k==='document'?{...v,sourceRefs:[]}:v);await assert.rejects(readImportUsageDocument(f.client,pid,f.view,f.selection,()=>true),ApiError);assert.equal(f.calls.some(p=>p.endsWith('/'+edited.artifactId)),false);
});
test('출처 hash·candidate 귀속·원본첨부·선택변조는 정상 원문으로 대체하지 않는다',async()=>{
 for(const mutate of [(k:string,v:any)=>k==='document'?{...v,content:{...v.content,sourceRefs:[]},sourceRefs:[]}:v,(k:string,v:any)=>k==='document'?{...v,importCandidateRefs:[]}:v,(k:string,v:any)=>k==='document'?{...v,content:{...v.content,attachments:[]}}:v,(k:string,v:any)=>k==='document'?{...v,id:id(90)}:v,(k:string,v:any)=>k==='body'?'손상된 원문':v]){const f=fixture(fourSources,mutate);await assert.rejects(readImportUsageDocument(f.client,pid,f.view,f.selection,()=>true),ApiError);}
 const f=fixture();await assert.rejects(readImportUsageDocument(f.client,pid,f.view,{...f.selection,version:4},()=>true),{code:'IMPORT_USAGE_CHANGED'});assert.equal(f.calls.length,0);
 const g=fixture(fourSources,(k,v)=>k==='candidate'?{...v,selections:[]}:v);await assert.rejects(readImportUsageDocument(g.client,pid,g.view,g.selection,()=>true),{code:'IMPORT_USAGE_CHANGED'});assert.equal(g.calls.some(p=>p.includes('/documents/')),false);
});
test('중간 scope 이탈·선택 ABA는 후속 GET/본문채택을 막고 보호403도 그대로 거절한다',async()=>{
 for(const stage of ['candidate','original','document','body']){let active=true;const f=fixture(fourSources,(k,v)=>{if(k===stage)active=false;return v;});await assert.rejects(readImportUsageDocument(f.client,pid,f.view,f.selection,()=>active),ApiError);assert.equal(f.calls.length,{candidate:1,original:2,document:3,body:4}[stage]);}
 let epoch=1;const ticket=epoch;const f=fixture(fourSources,(k,v)=>{if(k==='document'){epoch++;epoch++;}return v;});await assert.rejects(readImportUsageDocument(f.client,pid,f.view,f.selection,()=>epoch===ticket),ApiError);assert.equal(f.calls.some(p=>p.endsWith('/'+edited.artifactId)),false);
 const g=fixture(),client=new ApiClient(async()=>Response.json({code:'ACCESS_DENIED'},{status:403}));await assert.rejects(readImportUsageDocument(client,pid,g.view,g.selection,()=>true),(e:any)=>e.status===403);
 const h=fixture();await assert.rejects(readImportUsageDocument(h.client,id(99),h.view,h.selection,()=>false),{code:'IMPORT_USAGE_READ_PAUSED'});assert.equal(h.calls.length,0);
});
