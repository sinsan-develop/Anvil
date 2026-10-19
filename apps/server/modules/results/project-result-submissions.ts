import type {PoolClient} from 'pg';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {cloneV1,isoV1,recordV1,refV1,uuidV1,type RuntimeRefV1} from '../../../../contracts/runtime/validation-v1.ts';
import {AuthFailure,type AuthenticatedIdentity} from '../access/repository.ts';
import {authorizeMaterial,currentProjectController,persistProjectReceipt,projectMember,type ProjectCommand} from '../access/project-command.ts';
import {prepareSubmittedResult} from './result-submission.ts';
import {readSubmittedResultRecord,type SyntheticSubmittedResult} from './result-submission-store.ts';
import {readPgResultExecution} from './result-execution-pg.ts';
import type {ResultEvidenceScope} from './result-evidence.ts';
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b),hash=(v:unknown)=>contentHash(canonicalJson(v));
const fail=(code:string,status=503):never=>{throw new AuthFailure(code,status);};
/** 0025 결과 테이블을 사용하는 실제 PG adapter. caller의 인증 tx를 재사용한다.
 * Agent 실행기/현재 OS 관측은 연결하지 않으며 기존 합성 실행의 결과 제출도 WORKER_CLAIM으로만 보관한다. */
export class ProjectResultSubmissions{
 async #clock(db:PoolClient){const at=(await db.query('SELECT clock_timestamp() AS at')).rows[0]?.at;if(!(at instanceof Date)||!Number.isFinite(at.getTime()))return fail('RESULT_CLOCK_INVALID');return at.toISOString();}
 async #row(db:PoolClient,projectId:string,id:string){const rows=(await db.query('SELECT * FROM anvil.result_submissions WHERE project_id=$1 AND id=$2 LIMIT 2',[projectId,id])).rows;if(rows.length>1)return fail('RESULT_SUBMISSION_LEDGER_INVALID');return rows[0]??null;}
 #entry(row:any,scope:ResultEvidenceScope,id:string,now:string){
  try{
   const entry=readSubmittedResultRecord({ref:{id:row.id,version:1,contentHash:row.content_hash},snapshot:row.snapshot_json},scope,id,now),s=entry.snapshot;
   if(row.project_id!==scope.projectId||row.execution_id!==scope.executionRef.id||Number(row.generation)!==scope.executionRef.version||!same(row.assignment_ref,scope.assignmentRef)||!same(row.execution_ref,scope.executionRef)||row.manifest_hash!==s.manifestHash||!same(row.manifest_ref,{id,version:1,contentHash:s.manifestHash})||row.submission_state!==s.manifest.submissionState||row.submitted_by!==s.submittedByRef.id||!uuidV1(row.client_id)||!uuidV1(row.command_id)||!(row.submitted_at instanceof Date)||row.submitted_at.toISOString()!==s.submittedAt)return fail('RESULT_SUBMISSION_LEDGER_INVALID');return entry;
  }catch{return fail('RESULT_SUBMISSION_LEDGER_INVALID');}
 }
 async submit(db:PoolClient,actor:AuthenticatedIdentity,request:ProjectCommand,policyRef:RuntimeRefV1){
  request=cloneV1(request);policyRef=cloneV1(policyRef);
  if(request.operation!=='submitResult'||request.approvalRef!==null||request.expectedVersion!==0||request.baselineRefs.length||!recordV1(request.payload,['scope','submissionId','manifest'])||!recordV1(request.payload.scope,['projectId','assignmentRef','executionRef'])||!uuidV1(request.payload.submissionId)||request.targetId!==request.payload.submissionId||request.projectId!==request.payload.scope.projectId)return fail('RESULT_SUBMISSION_INPUT_INVALID',422);
  const prepared=prepareSubmittedResult(request.payload.scope,request.payload.manifest),scope=prepared.scope as ResultEvidenceScope,id=request.payload.submissionId;
  await currentProjectController(db,actor,request);const policy=await authorizeMaterial(db,actor,request);if(policy.approvalRequired||!same(policy.ref,policyRef))return fail('RESULT_SUBMISSION_POLICY_NOT_CURRENT',409);
  const now=await this.#clock(db),session=actor.authSession;
  if(!session||!uuidV1(session.id)||!isoV1(session.idleExpiresAt)||!isoV1(session.absoluteExpiresAt)||Math.min(Date.parse(session.idleExpiresAt),Date.parse(session.absoluteExpiresAt),policy.validUntil)<=Date.parse(now))return fail('RESULT_SUBMISSION_SESSION_NOT_CURRENT',403);
  await readPgResultExecution(db,scope);if(await this.#row(db,scope.projectId,id))return fail('RESULT_SUBMISSION_ID_CONFLICT',409);
  // manifestRef는 receipt에 앞서 확정한다. row snapshot에 receipt를 포함해도 hash 순환이 생기지 않는다.
  const manifestRef={id,version:1,contentHash:prepared.contentHash};
  const receipt=await persistProjectReceipt(db,actor,request,manifestRef,{status:'RESULT_SUBMITTED',manifest:prepared.manifest,sourceKind:'WORKER_CLAIM',completionAccepted:false,executionAuthorized:false,dispatchPerformed:false},policyRef,'EXPLICIT_RESULT_CLAIM_ONLY');
  const submittedByRef={id:actor.actorId,version:actor.credentialGeneration,contentHash:hash({userId:actor.actorId,clientId:actor.clientId,sessionId:session.id,credentialGeneration:actor.credentialGeneration})};
  const snapshot:SyntheticSubmittedResult['snapshot']={transport:'SYNTHETIC_ONLY',scope,submittedByRef,authorizationReceiptRef:receipt.authorizationReceiptRef,manifest:prepared.manifest,manifestHash:prepared.contentHash,submittedAt:receipt.result.serverReceivedAt,sourceKind:'WORKER_CLAIM',evidenceProvenanceVerified:false,completionAccepted:false,formalFailureCounted:false,executionAuthorized:false,dispatchPerformed:false};
  const entry=readSubmittedResultRecord({ref:{id,version:1,contentHash:hash(snapshot)},snapshot},scope,id,await this.#clock(db));
  await db.query("SELECT set_config('anvil.result_session_id',$1,true)",[session.id]);
  await db.query('INSERT INTO anvil.result_submissions(project_id,id,execution_id,generation,assignment_ref,execution_ref,manifest_ref,manifest_hash,submission_state,submitted_by,client_id,command_id,content_hash,snapshot_json,submitted_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)',[scope.projectId,id,scope.executionRef.id,scope.executionRef.version,JSON.stringify(scope.assignmentRef),JSON.stringify(scope.executionRef),JSON.stringify(manifestRef),prepared.contentHash,prepared.manifest.submissionState,actor.actorId,actor.clientId,receipt.id,entry.ref.contentHash,JSON.stringify(snapshot),snapshot.submittedAt]);
  const row=await this.#row(db,scope.projectId,id);if(!row||!same(this.#entry(row,scope,id,await this.#clock(db)),entry))return fail('RESULT_SUBMISSION_WRITE_UNCONFIRMED');
  await currentProjectController(db,actor,request);const final=await authorizeMaterial(db,actor,request);if(final.approvalRequired||!same(final.ref,policyRef)||Date.parse(await this.#clock(db))>=Math.min(final.validUntil,Date.parse(session.idleExpiresAt),Date.parse(session.absoluteExpiresAt)))return fail('RESULT_SUBMISSION_CURRENT_CHANGED',409);
  return cloneV1(receipt.result);
 }
 async read(db:PoolClient,actor:AuthenticatedIdentity,projectId:string,id:string){
  if(!uuidV1(projectId)||!uuidV1(id))return fail('RESULT_SUBMISSION_INPUT_INVALID',400);await projectMember(db,actor,projectId);
  const row=await this.#row(db,projectId,id);if(!row)return fail('NOT_FOUND',404);const scope=row.snapshot_json?.scope;
  if(!scope||scope.projectId!==projectId)return fail('RESULT_SUBMISSION_LEDGER_INVALID');const entry=this.#entry(row,scope,id,await this.#clock(db));await readPgResultExecution(db,entry.snapshot.scope);
  await projectMember(db,actor,projectId);return cloneV1(entry);
 }
}
