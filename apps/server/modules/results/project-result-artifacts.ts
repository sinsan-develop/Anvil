import type {PoolClient} from 'pg';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {cloneV1,uuidV1,type RuntimeRefV1} from '../../../../contracts/runtime/validation-v1.ts';
import {AuthFailure,type AuthenticatedIdentity} from '../access/repository.ts';
import {projectMember} from '../access/project-command.ts';
import type {ProjectResultSubmissions} from './project-result-submissions.ts';
import {readSubmittedResultRecord} from './result-submission-store.ts';
import type {ArtifactStore} from '../../storage/artifact-store.ts';
import {assertStoredArtifactReadable} from '../../storage/sensitive-inspection.ts';
function fail(code='RESULT_ARTIFACT_INVALID',status=503):never{throw new AuthFailure(code,status);}
/** 제출의 명시 등록 산출물 텍스트만 읽는다. bytes 일치는 실행/시험 출처의 진위가 아니다. */
export class ProjectResultArtifacts{
 readonly results:Pick<ProjectResultSubmissions,'read'>;readonly store:Pick<ArtifactStore,'read'>|null;
 constructor(results:Pick<ProjectResultSubmissions,'read'>,store:Pick<ArtifactStore,'read'>|null){if(typeof results?.read!=='function'||store!==null&&typeof store?.read!=='function')fail('RESULT_ARTIFACT_READER_REQUIRED');this.results=results;this.store=store;}
 async read(db:PoolClient,rawActor:AuthenticatedIdentity,pid:string,id:string,artifactId:string){
  if(![pid,id,artifactId].every(uuidV1))fail('RESULT_ARTIFACT_INPUT_INVALID',400);const actor=cloneV1(rawActor);await projectMember(db,actor,pid);
  const result=cloneV1(await this.results.read(db,actor,pid,id)),at=(await db.query('SELECT clock_timestamp() AS at')).rows[0]?.at;if(!(at instanceof Date)||!Number.isFinite(at.getTime()))fail();
  try{if(result.snapshot.scope.projectId!==pid)fail();readSubmittedResultRecord(result,result.snapshot.scope,id,at.toISOString());}catch{fail();}
  const refs:RuntimeRefV1[]=result.snapshot.manifest.artifactRefs.filter((r:RuntimeRefV1)=>r.id===artifactId);if(refs.length!==1)fail('RESULT_ARTIFACT_NOT_DECLARED',404);const ref=refs[0]!;if(ref.version!==1)fail('RESULT_ARTIFACT_VERSION_UNSUPPORTED',412);
  const row=async()=>{const r=(await db.query('SELECT * FROM anvil.artifacts WHERE id=$1 AND project_id=$2 AND content_hash=$3',[artifactId,pid,ref.contentHash])).rows[0];if(!r)fail('NOT_FOUND',404);if(r.id!==artifactId||r.project_id!==pid||r.content_hash!==ref.contentHash||!Number.isSafeInteger(Number(r.bytes))||Number(r.bytes)<0||r.storage_key!==`blobs/${pid}/${artifactId}`)fail();if(r.state==='QUARANTINED')fail('ARTIFACT_QUARANTINED',412);if(r.state!=='READY')fail('ARTIFACT_NOT_READY',422);if(!['text/plain;charset=utf-8','text/markdown;charset=utf-8'].includes(r.media_type)||Number(r.bytes)>2*1024*1024)fail('RESULT_ARTIFACT_TEXT_UNSUPPORTED',412);return r;};
  const before=await row();if(!this.store)fail('ARTIFACT_STORAGE_UNCONFIGURED',412);const bytes=await this.store.read(pid,artifactId,{bytes:Number(before.bytes),contentHash:ref.contentHash});if(!(bytes instanceof Uint8Array)||bytes.byteLength!==Number(before.bytes)||contentHash(bytes)!==ref.contentHash)fail();assertStoredArtifactReadable(before,bytes);
  let text:string;try{text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);}catch{fail('RESULT_ARTIFACT_UTF8_INVALID',422);}
  const after=await row();if(Number(after.bytes)!==Number(before.bytes)||after.media_type!==before.media_type)fail();assertStoredArtifactReadable(after,bytes);await projectMember(db,actor,pid);
  const value={projectId:pid,resultRef:cloneV1(result.ref),artifactRef:cloneV1(ref),bytes:bytes.byteLength,mediaType:before.media_type as string,text,sourceState:'REGISTERED_BYTES_ONLY' as const,evidenceProvenanceVerified:false as const,completionAccepted:false as const,executionAuthorized:false as const,dispatchPerformed:false as const,observedAt:at.toISOString()};if(Buffer.byteLength(canonicalJson(value))>2*1024*1024)fail('RESULT_ARTIFACT_RESPONSE_LIMIT',412);return value;
 }
}
