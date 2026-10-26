import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiClient } from '../../../apps/web/src/api/client.ts';
import { prepareDraftUpload, uploadDraftArtifact, readDraftArtifactBytes } from '../../../apps/web/src/features/project-create/draft-artifact-api.ts';
import { draftId as id } from '../../support/draft-artifact-fixture.ts';
const csrf='C'.repeat(43);
async function prepared(){return prepareDraftUpload(id(1),id(2),id(3),1,new File(['합성 원문 <script>'], '실제 선택명.txt',{type:'text/plain'}));}
function receipt(b:any){return {scopeKind:'DRAFT',draftId:b.draftId,commandId:b.command.commandId,clientId:b.command.clientId,version:b.command.expectedVersion,status:'APPLIED',data:{artifactRef:{artifactId:id(6),...b.command.payload},status:'ARTIFACT_READY',inspection:{policyVersion:1,complete:false,method:'KNOWN_PATTERNS_RAW_BYTES',state:'NO_KNOWN_MARKER',reasonCodes:[]}}};}
test('실제 파일명은 브라우저 버퍼에만 남고 업로드는 고정 바이트·strict header를 상대 경로로 전송한다',async()=>{
 const b=await prepared(),original=structuredClone(b),calls:any[]=[];const client=new ApiClient(async(path,init)=>{calls.push({path,init});return Response.json(receipt(b));});
 assert.equal(b.filename,'실제 선택명.txt');assert.equal(b.command.payload.mediaType,'text/plain;charset=utf-8');assert.equal('filename'in b.command,false);
 const result=await uploadDraftArtifact(client,csrf,b);assert.deepEqual(b,original);assert.deepEqual(result,receipt(b));assert.equal(calls.length,1);
 const {path,init}=calls[0];assert.equal(path,`/api/v1/project-drafts/${id(3)}/files`);assert.equal(init.credentials,'same-origin');assert.equal(init.redirect,'error');assert.equal(init.cache,'no-store');assert.deepEqual(init.body,b.bytes);assert.deepEqual(JSON.parse(init.headers['X-Anvil-Command']),b.command);assert.equal(init.headers['X-Anvil-CSRF'],csrf);
});
test('전송 결과 유실 뒤 같은 명령·원 바이트를 재사용하고 응답 version/ref 손상은 거절한다',async()=>{
 const b=await prepared(),calls:any[]=[];let lost=true;const client=new ApiClient(async(_path,init)=>{calls.push(init);if(lost){lost=false;throw Error('lost');}return Response.json(receipt(b));});
 await assert.rejects(uploadDraftArtifact(client,csrf,b),/연결|CONNECTION|처리/);await uploadDraftArtifact(client,csrf,b);assert.deepEqual(calls[0],calls[1]);assert.equal(b.command.expectedVersion,1);
 for(const bad of [{...receipt(b),version:2},{...receipt(b),data:{...receipt(b).data,artifactRef:{...receipt(b).data.artifactRef,bytes:0}}}])await assert.rejects(uploadDraftArtifact(new ApiClient(async()=>Response.json(bad)),csrf,b));
});
test('원 바이트 변조·없는 CSRF·잘못된 ID는 네트워크 전에 거절한다',async()=>{
 const b=await prepared();let calls=0;const client=new ApiClient(async()=>{calls++;throw Error();});await assert.rejects(uploadDraftArtifact(client,'',b));await assert.rejects(uploadDraftArtifact(client,csrf,{...b,draftId:'https://invalid/'}));const changed=structuredClone(b);changed.bytes[0]=changed.bytes[0]!^1;await assert.rejects(uploadDraftArtifact(client,csrf,changed));assert.equal(calls,0);
});
test('보호 읽기는 DRAFT/PROJECT 실제 경로와 bytes/hash를 검증하고 HTML을 실행하지 않는다',async()=>{
 const b=await prepared(),ref=receipt(b).data.artifactRef,paths:string[]=[];const client=new ApiClient(async(path)=>{paths.push(String(path));return new Response(b.bytes,{headers:{'content-type':'application/octet-stream'}});});
 assert.deepEqual(await readDraftArtifactBytes(client,id(3),ref),b.bytes);assert.deepEqual(await readDraftArtifactBytes(client,id(3),ref,id(9)),b.bytes);assert.deepEqual(paths,[`/api/v1/project-drafts/${id(3)}/files/${id(6)}`,`/api/v1/projects/${id(9)}/files/${id(6)}`]);
 for(const response of [new Response(b.bytes,{headers:{'content-type':'text/html'}}),new Response(new Uint8Array(b.bytes.length),{headers:{'content-type':'application/octet-stream'}}),new Response(new Uint8Array(b.bytes.length+1),{headers:{'content-type':'application/octet-stream'}}),Response.json({code:'ACCESS_DENIED'},{status:403})])await assert.rejects(readDraftArtifactBytes(new ApiClient(async()=>response),id(3),ref));
});



test('업로드 function transport는 native fetch와 같은 globalThis 수신자로 호출한다',async()=>{
 const b=await prepared();const client=new ApiClient(async function(this:unknown,_path,_init){assert.equal(this,globalThis);return Response.json(receipt(b));});await uploadDraftArtifact(client,csrf,b);
});
test('보호 GET function transport는 native fetch와 같은 globalThis 수신자로 호출한다',async()=>{
 const b=await prepared();const client=new ApiClient(async function(this:unknown,_path,_init){assert.equal(this,globalThis);return new Response(b.bytes,{headers:{'content-type':'application/octet-stream'}});});assert.deepEqual(await readDraftArtifactBytes(client,b.draftId,receipt(b).data.artifactRef),b.bytes);
});

test('단계 검토의 표시 권한이 없으면 원 선택 ref/hash를 숨기되 편집 버퍼는 보존한다',async()=>{
 const {createElement}=await import('react');const {renderToStaticMarkup}=await import('react-dom/server');const {DraftWizardReview}=await import('../../../apps/web/src/features/project-create/DraftWizardReview.ts');const {emptyDraft}=await import('../../../apps/web/src/features/project-create/api.ts');const b=await prepared(),ref=receipt(b).data.artifactRef,buffer={...emptyDraft(),input:{...emptyDraft().input,artifactRefs:[ref]},draftId:b.draftId,version:2,wizardStep:4},before=structuredClone(buffer);
 const hidden=renderToStaticMarkup(createElement(DraftWizardReview,{buffer,step:4,artifactRefsVisible:false}));assert(!hidden.includes(ref.artifactId));assert(!hidden.includes(ref.contentHash));assert.match(hidden,/현재 보호 자료 조회 전/);assert.deepEqual(buffer,before);
 const visible=renderToStaticMarkup(createElement(DraftWizardReview,{buffer,step:4,artifactRefsVisible:true}));assert(visible.includes(ref.artifactId));assert(visible.includes(ref.contentHash));assert.deepEqual(buffer,before);
});
