import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lstat, realpath, readdir, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { buildApp } from '../../../apps/server/app.ts';
import { ApiClient } from '../../../apps/web/src/api/client.ts';
import { readProjectDraft, writeProjectDraft, runDraftAction } from '../../../apps/web/src/features/project-create/api.ts';
import { prepareDraftUpload, uploadDraftArtifact, readDraftArtifactBytes } from '../../../apps/web/src/features/project-create/draft-artifact-api.ts';
import { draftArtifactFixture, draftId } from '../../support/draft-artifact-fixture.ts';
const registeredRoot=resolve('D:/tmp/anvil-v3-stage-b/fn01-draft-artifact-storage-20261026-01');
function transport(app:ReturnType<typeof buildApp>,f:ReturnType<typeof draftArtifactFixture>):typeof fetch{return async(path,init)=>{
 const headers=Object.fromEntries(new Headers(init?.headers).entries());const reply=await app.inject({method:(init?.method??'GET') as 'GET'|'POST'|'PATCH',url:String(path),headers:{...headers,host:'anvil.invalid',origin:'https://anvil.invalid',cookie:'__Host-anvil.sid='+f.token},...(init?.body!==undefined?{payload:typeof init.body==='string'?init.body:Buffer.from(init.body as Uint8Array)}:{})});
 return new Response(Uint8Array.from(reply.rawPayload),{status:reply.statusCode,headers:reply.headers as Record<string,string>});
};}
test('root 미설정의 실제 DRAFT 업로드는 인증 뒤 fail-closed하며 초안·예약·원문을 만들지 않는다',async()=>{
 const f=draftArtifactFixture(),app=buildApp({},undefined,{repository:f.access,origin:'https://anvil.invalid'}),client=new ApiClient(transport(app,f));
 try{const before=await readProjectDraft(client,f.did);assert.equal(before.editable,true);const b=await prepareDraftUpload(f.owner,f.clientId,f.did,1,new File(['root 없는 합성 원문'],'empty-root.txt',{type:'text/plain'}));await assert.rejects(uploadDraftArtifact(client,f.csrf,b),e=>!!e&&typeof e==='object'&&'code'in e&&e.code==='ARTIFACT_STORAGE_UNCONFIGURED');assert.equal(f.state().uploads.length,0);assert.deepEqual(f.draft().input_json,before.input);assert.equal(f.draft().version,1);assert(f.queries.some(sql=>sql.includes('FROM anvil.auth_sessions')));}finally{await app.close();}
});
test('실제 저장 초안을 조회한 뒤 명시 DRAFT 업로드는 원문을 보관하고 선택·버전을 자동 변경하지 않는다',async()=>{
 assert.equal(process.env.ANVIL_FN01_ARTIFACT_QA,'1','Main 사전 등록 후에만 실제 파일 시험을 실행');assert.equal(resolve(process.env.ANVIL_FN01_ARTIFACT_QA_ROOT??''),registeredRoot);assert.equal(process.env.USERDOMAIN+'\\'+process.env.USERNAME,'SINSAN\\cyhuh');
 const info=await lstat(registeredRoot);assert(info.isDirectory()&&!info.isSymbolicLink());assert.equal((await realpath(registeredRoot)).toLowerCase(),registeredRoot.toLowerCase());assert.deepEqual(await readdir(registeredRoot),[],'Main이 새로 등록한 빈 root만 사용');
 const f=draftArtifactFixture(),app=buildApp({},undefined,{repository:f.access,origin:'https://anvil.invalid',artifactRoot:registeredRoot}),client=new ApiClient(transport(app,f));
 try{
  const before=await readProjectDraft(client,f.did);assert.equal(before.editable,true);assert.equal(before.version,1);assert.deepEqual(before.input,f.input);
  const bytes=Buffer.from('명시 선택 전 보관하는 합성 원문 <script>실행 금지</script>');const upload=await prepareDraftUpload(f.owner,f.clientId,f.did,before.version,new File([bytes],'실제 선택한 원문.txt',{type:'text/plain'}));
  const receipt=await uploadDraftArtifact(client,f.csrf,upload),ref=receipt.data.artifactRef;assert.equal(receipt.status,'APPLIED');assert.equal(receipt.version,1);assert.equal(f.state().artifacts.length,1);const originalCommand=f.state().artifacts[0].command_id;
  const after=await readProjectDraft(client,f.did);assert.equal(after.version,before.version,'업로드는 초안 버전을 발급하지 않는다');assert.deepEqual(after.input.artifactRefs,[],'업로드 완료를 첨부 선택으로 바꾸지 않는다');assert.deepEqual(after.storedArtifacts?.[0]?.ref,ref);assert.deepEqual(Buffer.from(await readDraftArtifactBytes(client,f.did,ref)),bytes);
  const save={schemaVersion:1,commandId:draftId(30),clientId:f.clientId,expectedVersion:1,step:2,input:{...after.input,artifactRefs:[ref]}};const saved=await writeProjectDraft(client,f.did,save,f.csrf);assert.equal(saved.version,2);assert.deepEqual(saved.input.artifactRefs,[ref]);assert.deepEqual(await uploadDraftArtifact(client,f.csrf,upload),receipt,'업로드 v1의 완료 replay는 선택 저장 v2 뒤에도 원 receipt');
  const action={kind:'create' as const,draftId:f.did,body:{schemaVersion:1,commandId:draftId(40),clientId:f.clientId,draftId:f.did,draftVersion:2}};const project=await runDraftAction(client,action,f.csrf,f.owner);assert(project);
  assert.equal(f.state().adoptions.length,1);assert.equal(f.state().artifacts[0].id,ref.artifactId);assert.equal(f.state().artifacts[0].command_id,originalCommand);assert.equal(f.state().artifacts[0].draft_id,null);assert.equal(f.state().artifacts[0].project_id,project.id);
  assert.deepEqual(Buffer.from(await readDraftArtifactBytes(client,f.did,ref,project.id)),bytes,'기존 PROJECT GET route와 실제 ArtifactStore를 그대로 소비');assert.deepEqual(await readFile(join(registeredRoot,'blobs',project.id,ref.artifactId)),bytes);assert.deepEqual(await uploadDraftArtifact(client,f.csrf,upload),receipt);assert.deepEqual(await runDraftAction(client,action,f.csrf,f.owner),project);assert.equal(f.state().adoptions.length,1);
  const snapshot=structuredClone(f.draft().input_json),originalReceipt=structuredClone(f.state().uploads[0].result_json);f.control.projectRead=false;
  await assert.rejects(readProjectDraft(client,f.did));await assert.rejects(writeProjectDraft(client,f.did,save,f.csrf));await assert.rejects(readDraftArtifactBytes(client,f.did,ref,project.id));await assert.rejects(uploadDraftArtifact(client,f.csrf,upload));assert.deepEqual(f.draft().input_json,snapshot);assert.deepEqual(f.state().uploads[0].result_json,originalReceipt);
 }finally{await app.close();}
});
