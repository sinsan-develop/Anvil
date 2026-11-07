import assert from 'node:assert/strict';
import { test } from 'node:test';
import { draftArtifactFixture, draftId } from '../../support/draft-artifact-fixture.ts';
import { ProjectsRepository } from '../../../apps/server/modules/projects/repository.ts';
import { DraftArtifacts } from '../../../apps/server/modules/projects/draft-artifacts.ts';
import { AuthFailure } from '../../../apps/server/modules/access/repository.ts';
const bytes=Buffer.from('합성 원문 <script>실행하지 않음</script>');
async function uploaded(){const f=draftArtifactFixture(),command=f.command(bytes),receipt=await f.service.finishUpload(f.token,f.csrf,f.did,command,bytes);return{f,command,receipt};}
async function selected(){const v=await uploaded(),{f,receipt}=v,repository=new ProjectsRepository(f.access,f.service);const save={schemaVersion:1 as const,commandId:draftId(30),clientId:f.clientId,expectedVersion:1,step:2,input:{...f.input,artifactRefs:[receipt.data.artifactRef]}};const saved=await repository.saveDraft(f.token,f.csrf,f.did,save);return{...v,repository,save,saved};}
test('실제 서비스/저장 repository는 보관→명시 선택/새 버전→동일 명령 replay→생성을 연결하고 원 upload provenance를 보존한다',async()=>{
 const{f,command,receipt,repository,save,saved}=await selected();assert.equal(saved.version,2);assert.deepEqual(saved.input.artifactRefs,[receipt.data.artifactRef]);assert.equal(f.state().selections.length,1);
 assert.deepEqual(await f.service.finishUpload(f.token,f.csrf,f.did,command,bytes),receipt,'v1 완료 명령은 현재 v2에서 같은 receipt');
 assert.equal(f.state().uploads.length,1);assert.equal(f.state().artifacts.length,1);assert.deepEqual(await repository.saveDraft(f.token,f.csrf,f.did,save),saved);
 const request={schemaVersion:1 as const,commandId:draftId(40),clientId:f.clientId,draftId:f.did,draftVersion:2};const project=await repository.createProject(f.token,f.csrf,request) as any;
 assert.equal(f.state().projects.length,1);assert.equal(f.state().adoptions.length,1);assert.equal(f.state().artifacts[0].command_id,f.state().uploads[0].server_command_id);assert.equal(f.state().artifacts[0].id,receipt.data.artifactRef.artifactId);assert.equal(f.state().artifacts[0].project_id,project.id);
 assert.deepEqual(f.projectBodies.get(receipt.data.artifactRef.artifactId),bytes);assert.equal(f.fileBodies.size,0);assert.equal(f.state().quotaBytes,0);
 assert.deepEqual(await repository.createProject(f.token,f.csrf,request),project);assert.deepEqual(await f.service.finishUpload(f.token,f.csrf,f.did,command,bytes),receipt);
 assert.equal(f.state().adoptions.length,1);await assert.rejects(f.service.read(f.token,f.did,receipt.data.artifactRef.artifactId),e=>e instanceof AuthFailure&&e.statusCode===404);
 const firstFile=f.events.indexOf('FILE_UPLOAD');assert(f.events.slice(0,firstFile).includes('COMMIT'));assert(!f.active());
});
test('publish 뒤 DB commit 실패는 바이트/예약/동일 UUID를 보존하며 같은 명령으로 재확정한다',async()=>{
 const f=draftArtifactFixture(),command=f.command(bytes);f.control.rejectNextCommitAfter='fn01_finalize_upload';await assert.rejects(f.service.finishUpload(f.token,f.csrf,f.did,command,bytes),/SYNTHETIC_COMMIT_LOST/);
 assert.equal(f.state().uploads[0].state,'UNKNOWN');assert.equal(f.state().artifacts.length,0);assert.equal(f.fileBodies.size,1);assert.equal(f.state().quotaBytes,bytes.length*2);const id=f.state().uploads[0].artifact_id,cmd=f.state().uploads[0].server_command_id;
 const result=await f.service.finishUpload(f.token,f.csrf,f.did,command,bytes);assert.equal(result.data.artifactRef.artifactId,id);assert.equal(f.state().artifacts[0].command_id,cmd);assert.equal(f.state().artifacts.length,1);assert(f.events.includes('ROLLBACK'));
});
test('파일 I/O 중 버전 변경은 최종 효과를 거절하고 UNKNOWN 원문·예약을 보존한다',async()=>{
 const f=draftArtifactFixture(),command=f.command(bytes);f.control.onFiles=()=>{f.control.onFiles=null;f.draft().version=2;};await assert.rejects(f.service.finishUpload(f.token,f.csrf,f.did,command,bytes),e=>e instanceof AuthFailure&&e.message==='VERSION_CONFLICT');assert.equal(f.state().uploads[0].state,'UNKNOWN');assert.equal(f.state().artifacts.length,0);assert.equal(f.fileBodies.size,1);assert.equal(f.state().quotaBytes,bytes.length*2);
});
test('타 사용자/client·다른 body·stale 신규 명령·격리 자료의 선택은 거절한다',async()=>{
 const{f,command,receipt}=await uploaded();const before=f.state().uploads.length;f.control.client=draftId(90);await assert.rejects(f.service.finishUpload(f.token,f.csrf,f.did,command,bytes),/CLIENT_SCOPE_MISMATCH/);f.control.client=f.clientId;f.control.actor=draftId(91);await assert.rejects(f.service.finishUpload(f.token,f.csrf,f.did,command,bytes),/NOT_FOUND/);f.control.actor=f.owner;
 await assert.rejects(f.service.finishUpload(f.token,f.csrf,f.did,command,Buffer.from('다른 본문')),/ARTIFACT_BYTES_MISMATCH/);f.draft().version=2;await assert.rejects(f.service.finishUpload(f.token,f.csrf,f.did,{...command,commandId:draftId(92)},bytes),/VERSION_CONFLICT/);assert.equal(f.state().uploads.length,before);
 f.state().artifacts[0].state='QUARANTINED';await assert.rejects(f.service.prepareSelection(f.token,f.csrf,f.did,2,f.clientId,[receipt.data.artifactRef]),/NOT_FOUND/);
});
test('생성 복사 실패는 project/부분귀속을 만들지 않고 원 자료와 예약을 남긴다',async()=>{
 const{f,repository,receipt}=await selected();f.control.fileFailure='COPY';await assert.rejects(repository.createProject(f.token,f.csrf,{schemaVersion:1,commandId:draftId(40),clientId:f.clientId,draftId:f.did,draftVersion:2}),/SYNTHETIC_COPY_LOST/);assert.equal(f.state().projects.length,0);assert.equal(f.state().adoptions.length,0);assert.equal(f.state().creations[0].state,'UNKNOWN');assert.equal(f.state().artifacts[0].draft_id,f.did);assert.deepEqual(f.fileBodies.get(receipt.data.artifactRef.artifactId),bytes);assert.equal(f.state().quotaBytes,bytes.length*3);
});
test('root가 없어도 귀속 자료의 과거 draft GET/save replay는 현재 프로젝트 회수시 전체를 닫는다',async()=>{
 const{f,repository,save}=await selected();await repository.createProject(f.token,f.csrf,{schemaVersion:1,commandId:draftId(40),clientId:f.clientId,draftId:f.did,draftVersion:2});const historical=structuredClone(f.draft().input_json);f.control.projectRead=false;const rootless=new ProjectsRepository(f.access,new DraftArtifacts(f.access));
 await assert.rejects(rootless.getDraft(f.token,f.did),/NOT_FOUND/);await assert.rejects(rootless.saveDraft(f.token,f.csrf,f.did,save),/NOT_FOUND/);assert.deepEqual(f.draft().input_json,historical);
});
test('생성에 선택하지 않은 원문은 소비 뒤에도 원 초안 owner 보호 GET으로 남는다',async()=>{
 const{f,repository}=await selected(),extra=Buffer.from('선택하지 않은 보관 원문'),command=f.command(extra,55);const receipt=await f.service.finishUpload(f.token,f.csrf,f.did,command,extra);await repository.createProject(f.token,f.csrf,{schemaVersion:1,commandId:draftId(40),clientId:f.clientId,draftId:f.did,draftVersion:2});f.control.projectRead=false;assert.deepEqual(await f.service.read(f.token,f.did,receipt.data.artifactRef.artifactId),extra);assert.equal(f.state().quotaBytes,extra.length*2);
});
test('0-byte 원문도 quota 예약·개수를 소비하고 서비스가 DB 한도 거절 뒤 파일을 만들지 않는다',async()=>{
 const f=draftArtifactFixture();for(let n=0;n<20;n++)await f.service.finishUpload(f.token,f.csrf,f.did,f.command(Buffer.alloc(0),100+n),Buffer.alloc(0));assert.equal(f.state().quotaCount,40);assert.equal(f.fileBodies.size,20);await assert.rejects(f.service.finishUpload(f.token,f.csrf,f.did,f.command(Buffer.alloc(0),130),Buffer.alloc(0)),/DRAFT_QUOTA_EXCEEDED/);assert.equal(f.fileBodies.size,20);
});

test('예약 후 본문 hash 불일치는 파일 attempt가 전혀 없을 때만 예약을 종결하고 해제한다',async()=>{
 const f=draftArtifactFixture(),command=f.command(bytes);await f.service.reserveUpload(f.token,f.csrf,f.did,command);await assert.rejects(f.service.finishUpload(f.token,f.csrf,f.did,command,Buffer.alloc(bytes.length)),/ARTIFACT_BYTES_MISMATCH/);
 assert.equal(f.state().uploads[0].state,'REJECTED');assert.equal(f.state().uploads[0].attempt,0);assert.equal(f.state().quotaBytes,0);assert.equal(f.state().quotaCount,0);assert.equal(f.fileBodies.size,0);assert.equal(f.state().commands.length,0);
});
test('정확한 DB 거절만 알려진 충돌·한도로 매핑하며 다른 저장 오류를 숨기지 않는다',async()=>{
 for(const fault of [{at:'fn01_reserve_upload',code:'P0001',message:'FN01_DRAFT_QUOTA_EXCEEDED',expected:413},{at:'fn01_reserve_upload',code:'P0001',message:'FN01_COMMAND_CONFLICT',expected:409},{at:'fn01_reserve_creation',code:'P0001',message:'FN01_PENDING_CREATION_CONFLICT',expected:409}]){
  const f=draftArtifactFixture();f.control.sqlFailure=fault;const run=fault.at.endsWith('upload')?()=>f.service.reserveUpload(f.token,f.csrf,f.did,f.command(bytes)):()=>f.service.prepareCreation(f.token,f.csrf,{draftId:f.did,draftVersion:1,clientId:f.clientId,commandId:draftId(51)});await assert.rejects(run(),e=>e instanceof AuthFailure&&e.statusCode===fault.expected);assert.equal(f.fileBodies.size,0);
 }
 const f=draftArtifactFixture();f.control.sqlFailure={at:'fn01_reserve_upload',code:'23505',message:'unrelated_unique_failure'};await assert.rejects(f.service.reserveUpload(f.token,f.csrf,f.did,f.command(bytes)),e=>!(e instanceof AuthFailure)&&e instanceof Error&&e.message==='unrelated_unique_failure');
});

test('실제 DRAFT route의 parser 413·hash 거절은 미시작 예약을 회수하며 시도한 불명 원문 예약은 보존한다',async()=>{
 const {default:Fastify}=await import('fastify');const {Readable}=await import('node:stream');const {registerDraftArtifactRoutes}=await import('../../../apps/server/modules/projects/draft-artifact-routes.ts');
 const f=draftArtifactFixture(),app=Fastify({logger:false});registerDraftArtifactRoutes(app,'https://anvil.invalid',f.service);
 const headers=(c:any)=>({host:'anvil.invalid',origin:'https://anvil.invalid',cookie:'__Host-anvil.sid='+f.token,'x-anvil-csrf':f.csrf,'x-anvil-command':JSON.stringify(c),'content-type':'application/octet-stream','transfer-encoding':'chunked'});
 try{
  const c=f.command(bytes);const bad=await app.inject({method:'POST',url:`/api/v1/project-drafts/${f.did}/files`,headers:headers(c),payload:Readable.from([Buffer.alloc(bytes.length)])});assert.equal(bad.statusCode,409);assert.equal(f.state().uploads[0].state,'REJECTED');assert.equal(f.state().quotaCount,0);
  const max=Buffer.alloc(20*1024*1024),big=f.command(max,21);const rejected=await app.inject({method:'POST',url:`/api/v1/project-drafts/${f.did}/files`,headers:headers(big),payload:Readable.from([max,Buffer.from([0])])});assert.equal(rejected.statusCode,413);assert.equal(f.state().uploads[1].state,'REJECTED');assert.equal(f.state().quotaCount,0);assert.equal(f.fileBodies.size,0);
  const uncertain=f.command(bytes,22);await f.service.reserveUpload(f.token,f.csrf,f.did,uncertain);f.state().uploads[2].attempt=1;f.fileBodies.set(f.state().uploads[2].artifact_id,bytes);await f.service.abortUpload(f.token,f.csrf,f.did,uncertain);assert.equal(f.state().uploads[2].state,'UNKNOWN');assert.equal(f.state().quotaCount,2);assert.equal(f.state().quotaBytes,bytes.length*2);assert.equal(f.fileBodies.size,1);
  await f.service.abortUpload(f.token,f.csrf,f.did,{...uncertain,commandId:draftId(99)});assert.equal(f.state().quotaCount,2);
 }finally{await app.close();}
});

test('미시작 거절 21회의 원 이력은 보존하며 보관 자료 조회에는 활성 원문만 최대 20개 반환한다',async()=>{
 const f=draftArtifactFixture();for(let n=100;n<121;n++){const command=f.command(bytes,n);await f.service.reserveUpload(f.token,f.csrf,f.did,command);await f.service.abortUpload(f.token,f.csrf,f.did,command);}
 const repository=new ProjectsRepository(f.access,f.service),history=structuredClone(f.state().uploads);const {ApiClient}=await import('../../../apps/web/src/api/client.ts');const {readProjectDraft}=await import('../../../apps/web/src/features/project-create/api.ts');const client=new ApiClient(async()=>Response.json(await repository.getDraft(f.token,f.did)));
 const before=await readProjectDraft(client,f.did);assert.deepEqual(before.storedArtifacts,[]);assert.equal(f.state().quotaCount,0);assert.deepEqual(f.state().uploads,history);
 const receipt=await f.service.finishUpload(f.token,f.csrf,f.did,f.command(bytes,121),bytes);const after=await readProjectDraft(client,f.did);assert.equal(after.storedArtifacts?.length,1);assert.deepEqual(after.storedArtifacts?.[0]?.ref,receipt.data.artifactRef);assert.deepEqual(after.input.artifactRefs,[]);assert.deepEqual(f.state().uploads.slice(0,21),history);
});
