import type{PoolClient}from'pg';
import{canonicalJson,contentHash}from'../../../../contracts/canonical.ts';
import{AuthFailure,type AuthenticatedIdentity}from'../access/repository.ts';
import type{ProjectCommand}from'../access/project-command.ts';
import type{VersionRef}from'../../../../contracts/generated-types.ts';
import{readConstitutionApplication}from'./knowledge-state.ts';
import{isVersionRef}from'../../../../contracts/references.ts';
async function readConstitutionEvidence(db:PoolClient,pid:string,version:number){
 const rows=(await db.query('SELECT a.*,c.state command_state,c.operation,c.actor_id,c.client_id command_client,c.control_generation,c.expected_version,c.policy_ref,c.result_ref,c.command_id external_command_id,c.request_hash,c.scope_kind command_scope_kind,c.scope_id command_scope_id,c.operation_id command_operation_id,r.scope_kind receipt_scope_kind,r.scope_id receipt_scope_id,r.subject_ref receipt_subject,r.scope_digest receipt_scope_digest FROM anvil.constitution_applications a JOIN anvil.commands c ON c.id=a.command_id AND c.project_id=a.project_id JOIN anvil.authorization_receipts r ON r.id=c.authorization_receipt_id AND r.command_id=c.id AND r.policy_ref=c.policy_ref WHERE a.project_id=$1 AND a.application_version=$2',[pid,version])).rows;
 if(rows.length!==1)throw new AuthFailure('CONSTITUTION_INTEGRITY_FAILED',503);
 const row=rows[0];
 if(!row)throw new AuthFailure('CONSTITUTION_INTEGRITY_FAILED',503);
 const snapshot=row.snapshot_json,ref:VersionRef={id:pid,version,contentHash:row.content_hash},result=row.result_ref;
 try{readConstitutionApplication({versionRef:snapshot?.versionRef,confirmationId:snapshot?.confirmationId,reason:snapshot?.reason,acknowledged:snapshot?.acknowledged});}catch{throw new AuthFailure('CONSTITUTION_INTEGRITY_FAILED',503);}
 if(row.command_state!=='APPLIED')throw new AuthFailure('CONSTITUTION_INTEGRITY_FAILED',503);
 if(contentHash(canonicalJson(snapshot))!==ref.contentHash||snapshot.projectId!==pid||row.operation!=='applyConstitution'||row.actor_id!==row.applied_by||row.command_client!==row.client_id||snapshot.appliedBy?.kind!=='HUMAN'||snapshot.appliedBy.userId!==row.applied_by||snapshot.appliedBy.clientId!==row.client_id||snapshot.controlGeneration!==Number(row.control_generation)||Number(row.expected_version)!==version-1||snapshot.versionRef.id!==row.entry_id||snapshot.versionRef.version!==Number(row.version)||snapshot.confirmationId!==row.confirmation_id||!result||result.status!=='APPLIED'||result.projectId!==pid||result.targetId!==pid||result.version!==version||result.data?.status!=='CONSTITUTION_APPLIED'||canonicalJson(result.data?.ref??null)!==canonicalJson(ref)||canonicalJson(result.data?.application??null)!==canonicalJson(snapshot)||result.serverReceivedAt!==row.created_at.toISOString())throw new AuthFailure('CONSTITUTION_INTEGRITY_FAILED',503);
 if(version===1?snapshot.previousApplicationRef!==null:!isVersionRef(snapshot.previousApplicationRef)||snapshot.previousApplicationRef.id!==pid||snapshot.previousApplicationRef.version!==version-1)throw new AuthFailure('CONSTITUTION_INTEGRITY_FAILED',503);
 return{record:{ref,application:snapshot,appliedAt:row.created_at.toISOString()},row};
}
export async function constitutionRecord(db:PoolClient,pid:string,version:number){return(await readConstitutionEvidence(db,pid,version)).record;}
/** 원 적용과 바로 전 불변 참조만 검산한다. 현재 head/원문 상태를 과거 결과에 다시 적용하지 않는다. */
export async function verifyConstitutionReplay(db:PoolClient,actor:AuthenticatedIdentity,c:ProjectCommand,result:unknown):Promise<void>{
 try{
  if(c.operation!=='applyConstitution'||c.targetId!==c.projectId||c.clientId!==actor.clientId||!Number.isSafeInteger(c.expectedVersion)||c.expectedVersion<0||!Number.isSafeInteger(c.expectedVersion+1))throw Error();
  const input=readConstitutionApplication(c.payload),{record,row}=await readConstitutionEvidence(db,c.projectId,c.expectedVersion+1);
  if(row.external_command_id!==c.commandId||row.actor_id!==actor.actorId||row.command_client!==actor.clientId||row.command_scope_kind!=='PROJECT'||row.command_scope_id!==c.projectId||Number(row.control_generation)!==c.controlGeneration||row.request_hash!==contentHash(canonicalJson(c))
   ||row.result_ref.commandId!==c.commandId||row.result_ref.operationId!==row.command_operation_id||canonicalJson(row.result_ref)!==canonicalJson(result)||!isVersionRef(row.policy_ref)
   ||canonicalJson(input)!==canonicalJson({versionRef:record.application.versionRef,confirmationId:record.application.confirmationId,reason:record.application.reason,acknowledged:record.application.acknowledged})
   ||row.receipt_scope_kind!=='PROJECT'||row.receipt_scope_id!==c.projectId||canonicalJson(row.receipt_subject)!==canonicalJson({kind:'HUMAN',userId:actor.actorId,clientId:actor.clientId})
   ||row.receipt_scope_digest!==contentHash(canonicalJson({projectId:c.projectId,actorId:actor.actorId,clientId:actor.clientId,controlGeneration:c.controlGeneration,requestHash:contentHash(canonicalJson(c)),policyRef:row.policy_ref,targetRef:record.ref})))throw Error();
  if(record.ref.version>1){const previous=await constitutionRecord(db,c.projectId,record.ref.version-1);if(canonicalJson(previous.ref)!==canonicalJson(record.application.previousApplicationRef))throw Error();}
 }catch{throw new AuthFailure('CONSTITUTION_INTEGRITY_FAILED',503);}
}
export async function currentConstitutionRecord(db:PoolClient,pid:string){
 const pointer=(await db.query('SELECT application_version,application_hash,entry_id,version FROM anvil.project_constitutions WHERE project_id=$1',[pid])).rows[0];
 if(!pointer)return null;
 const record=await constitutionRecord(db,pid,Number(pointer.application_version));
 if(record.ref.contentHash!==pointer.application_hash||record.application.versionRef.id!==pointer.entry_id||record.application.versionRef.version!==Number(pointer.version))throw new AuthFailure('CONSTITUTION_INTEGRITY_FAILED',503);
 const latest=(await db.query('SELECT max(application_version) version FROM anvil.constitution_applications WHERE project_id=$1',[pid])).rows[0];if(Number(latest.version)!==record.ref.version)throw new AuthFailure('CONSTITUTION_INTEGRITY_FAILED',503);
 if(record.ref.version>1){const previous=await constitutionRecord(db,pid,record.ref.version-1);if(canonicalJson(previous.ref)!==canonicalJson(record.application.previousApplicationRef))throw new AuthFailure('CONSTITUTION_INTEGRITY_FAILED',503);}
 return record;
}
