import assert from 'node:assert/strict';
import test from 'node:test';
import {ApiClient,ApiError} from '../../../apps/web/src/api/client.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {designChangeFixture,projectId,changeId} from './design-change-fixture.ts';
const module=await import(new URL('../../../apps/web/src/features/design-change/stored-change-document-source.ts',import.meta.url).href).catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
const read=()=>{assert.equal(typeof module.readStoredChangeDocumentSource,'function');return module.readStoredChangeDocumentSource;};
const documentId='77777777-7777-4777-8777-777777777777',artifactId='88888888-8888-4888-8888-888888888888',body='\uFEFF# 변경의 근거\r\n<script>not-executed</script>',formRef={id:projectId,version:1,contentHash:'b'.repeat(64)};
function fixture(mutate:(kind:string,value:any)=>any=(_k,v)=>v,sources:any[]=[]){
 const document={sourceRefs:structuredClone(sources),id:documentId,version:2,title:'변경 근거 고정 문서',formRef,stageNodeRef:null,content:{body:{artifactId,bytes:Buffer.byteLength(body),contentHash:contentHash(Buffer.from(body)),mediaType:'text/markdown;charset=utf-8'},attachments:[],sections:[],sourceRefs:structuredClone(sources)}};
 const documentHash=contentHash(canonicalJson({title:document.title,formRef,content:document.content,stageNodeRef:null})),source={kind:'DOCUMENT_VERSION',id:documentId,version:2,contentHash:documentHash};
 const page:any=designChangeFixture();page.change.sourceRefs=[source];
 const {ref,status,requestedBy,createdAt,...snapshot}=page.change;page.change.ref.contentHash=contentHash(canonicalJson(snapshot));
 // 요청 참조 변경에 맞춰 기계·사람 영향의 불변 hash도 다시 구성한다.
 for(const impact of [...page.impactVersions].reverse()){
  impact.changeRef=page.change.ref;
  if(impact.sourceKind==='HUMAN_REVIEW')impact.baseImpactRef=page.impactVersions[1].ref;
  const {ref,observedAt,...data}=impact;impact.ref={...ref,contentHash:contentHash(canonicalJson(data))};
 }
 page.latestImpactRef=page.impactVersions[0].ref;
 const calls:string[]=[];
 const client=new ApiClient(async(url,init)=>{
  const path=String(url);calls.push(path);assert.equal(init?.method,'GET');assert.ok(path.startsWith('/api/v1/projects/'+projectId+'/'));
  if(path.includes('/design-changes/'))return Response.json(mutate('change',page));
  if(path.includes('/documents/'))return Response.json(mutate('document',{...document,contentHash:documentHash,confirmed:false,validation:{validForConfirmation:false,issues:[]},statusHistory:[],contentReviewCriteria:{criteriaVersion:1,formRef,items:[]},contentReviews:[]}));
  if(path.includes('/files/'))return new Response(Buffer.from(mutate('body',body)),{headers:{'content-type':'application/octet-stream'}});
  throw Error('UNEXPECTED_CALL');
 });
 return {client,calls,selection:{projectId,userId:projectId,clientId:projectId,changeRef:structuredClone(page.change.ref),source:structuredClone(source)}};
}
test('보관 요청의 정확 문서 출처 귀속·snapshot·본문을 기존 보호 GET만으로 읽는다',async()=>{
 const f=fixture(),value=await read()(f.client,f.selection,()=>true);assert.equal(value.body,body);assert.equal(value.document.id,documentId);assert.equal(value.document.version,2);assert.deepEqual(f.calls,[`/api/v1/projects/${projectId}/design-changes/${changeId}?limit=10`,`/api/v1/projects/${projectId}/documents/${documentId}/versions/2`,`/api/v1/projects/${projectId}/files/${artifactId}`]);
});
test('미귀속·다른 버전/hash·미지원 출처는 문서 원문으로 대체하지 않는다',async()=>{
 const fn=read();for(const patch of [{id:changeId},{version:3},{contentHash:'e'.repeat(64)},{kind:'USER_INSTRUCTION'}]){const f=fixture();await assert.rejects(fn(f.client,{...f.selection,source:{...f.selection.source,...patch}},()=>true),ApiError);assert.equal(f.calls.some(p=>p.includes('/documents/')),false);}
});
test('변경요청·문서 metadata·본문 변조와 접근 거절은 원문으로 채택하지 않는다',async()=>{
 const fn=read();for(const change of [(k:string,v:any)=>k==='change'?{...v,change:{...v.change,reason:'tampered'}}:v,(k:string,v:any)=>k==='document'?{...v,title:'tampered metadata'}:v,(k:string,v:any)=>k==='document'?{...v,contentHash:'f'.repeat(64)}:v,(k:string,v:any)=>k==='document'?{...v,content:{...v.content,sourceRefs:[{kind:'DOCUMENT_VERSION',id:projectId,version:1,contentHash:'f'.repeat(64)}]}}:v,(k:string,v:any)=>k==='body'?'tampered body':v]){const f=fixture(change);await assert.rejects(fn(f.client,f.selection,()=>true),ApiError);}
 const f=fixture(),client=new ApiClient(async()=>Response.json({code:'PROJECT_ACCESS_DENIED'},{status:403}));await assert.rejects(fn(client,f.selection,()=>true),(e:any)=>e.status===403);
});
test('닫기/전환 뒤 결과를 버리고 후속 읽기를 막으며 선택 참조를 복사해 사용한다',async()=>{
 const fn=read();let active=true;const f=fixture((k,v)=>{if(k==='change')active=false;return v;});await assert.rejects(fn(f.client,f.selection,()=>active),ApiError);assert.equal(f.calls.length,1);
 const g=fixture();await assert.rejects(fn(g.client,g.selection,()=>false),ApiError);assert.equal(g.calls.length,0);
 const h=fixture(),request=fn(h.client,h.selection,()=>true);h.selection.source.id=changeId;assert.equal((await request).document.id,documentId);
 let open=true;const j=fixture((k,v)=>{if(k==='body')open=false;return v;});await assert.rejects(fn(j.client,j.selection,()=>open),ApiError);
});

test('보관 출처 문서 metadata 응답 중 이탈하면 후속 파일 GET을 시작하지 않는다',async()=>{
 let active=true;const f=fixture((kind,value)=>{if(kind==='document')active=false;return value;});
 await assert.rejects(read()(f.client,f.selection,()=>active),ApiError);
 assert.equal(f.calls.filter(path=>path.includes('/files/')).length,0);
});

const fourSources=[{kind:'DOCUMENT_VERSION',id:projectId,version:2,contentHash:'b'.repeat(64)},{kind:'CONVERSATION',id:projectId,contentHash:'c'.repeat(64)},{kind:'USER_INSTRUCTION',id:projectId,contentHash:'d'.repeat(64)},{kind:'ARTIFACT',id:projectId,contentHash:'e'.repeat(64)}];
test('정상4종 문서출처를 가진 보관 변경요청도 정확 귀속·원 hash·원문으로 재조회한다',async()=>{
 const f=fixture(undefined,fourSources),value=await read()(f.client,f.selection,()=>true);assert.equal(value.body,body);assert.deepEqual(value.document.content.sourceRefs,fourSources);assert.equal(value.document.contentHash,f.selection.source.contentHash);assert.equal(f.calls.length,3);
});

test('4종 보관출처의 hash-valid 미지원종류·추가키·분리열오염은 문서 본문 GET0이다',async()=>{
 for(const patch of [{kind:'REMOTE_FILE'},{extra:'unexpected'},{kind:'USER_INSTRUCTION',version:1}]){const sources=structuredClone(fourSources);sources[0]={...sources[0]!,...patch};const f=fixture(undefined,sources);await assert.rejects(read()(f.client,f.selection,()=>true),ApiError);assert.equal(f.calls.some(p=>p.includes('/files/')),false);}
 const f=fixture((k,v)=>k==='document'?{...v,sourceRefs:[]}:v,fourSources);await assert.rejects(read()(f.client,f.selection,()=>true),ApiError);assert.equal(f.calls.some(p=>p.includes('/files/')),false);
});
test('4종 보관출처도 원 요청 귀속과 문서 hash·현재성을 유지하며 늦은 ABA 결과를 폐기한다',async()=>{
 const f=fixture(undefined,fourSources);await assert.rejects(read()(f.client,{...f.selection,source:{...f.selection.source,version:3}},()=>true),ApiError);assert.equal(f.calls.some(p=>p.includes('/documents/')),false);
 const g=fixture((k,v)=>k==='document'?{...v,content:{...v.content,sourceRefs:[]},sourceRefs:[]}:v,fourSources);await assert.rejects(read()(g.client,g.selection,()=>true),ApiError);assert.equal(g.calls.some(p=>p.includes('/files/')),false);
 let scope='A',epoch=1;const ticket=epoch;const h=fixture((k,v)=>{if(k==='document'){scope='B';epoch++;scope='A';epoch++;}return v;},fourSources);await assert.rejects(read()(h.client,h.selection,()=>scope==='A'&&epoch===ticket),ApiError);assert.equal(h.calls.some(p=>p.includes('/files/')),false);
});
