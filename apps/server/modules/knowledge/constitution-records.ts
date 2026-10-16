import type{PoolClient}from'pg';
import{canonicalJson,contentHash}from'../../../../contracts/canonical.ts';
import{AuthFailure}from'../access/repository.ts';
import type{VersionRef}from'../../../../contracts/generated-types.ts';
import{readConstitutionApplication}from'./knowledge-state.ts';
import{isVersionRef}from'../../../../contracts/references.ts';
export async function constitutionRecord(db:PoolClient,pid:string,version:number){
 const row=(await db.query('SELECT a.*,c.state command_state,c.operation,c.actor_id,c.client_id command_client,c.control_generation,c.expected_version,c.policy_ref,c.result_ref FROM anvil.constitution_applications a JOIN anvil.commands c ON c.id=a.command_id AND c.project_id=a.project_id JOIN anvil.authorization_receipts r ON r.id=c.authorization_receipt_id AND r.command_id=c.id AND r.policy_ref=c.policy_ref WHERE a.project_id=$1 AND a.application_version=$2',[pid,version])).rows[0];
 if(!row)throw new AuthFailure('CONSTITUTION_INTEGRITY_FAILED',503);
 const snapshot=row.snapshot_json,ref:VersionRef={id:pid,version,contentHash:row.content_hash},result=row.result_ref;
 try{readConstitutionApplication({versionRef:snapshot?.versionRef,confirmationId:snapshot?.confirmationId,reason:snapshot?.reason,acknowledged:snapshot?.acknowledged});}catch{throw new AuthFailure('CONSTITUTION_INTEGRITY_FAILED',503);}
 if(row.command_state!=='APPLIED')throw new AuthFailure('CONSTITUTION_INTEGRITY_FAILED',503);
 if(contentHash(canonicalJson(snapshot))!==ref.contentHash||snapshot.projectId!==pid||row.operation!=='applyConstitution'||row.actor_id!==row.applied_by||row.command_client!==row.client_id||snapshot.appliedBy?.kind!=='HUMAN'||snapshot.appliedBy.userId!==row.applied_by||snapshot.appliedBy.clientId!==row.client_id||snapshot.controlGeneration!==Number(row.control_generation)||Number(row.expected_version)!==version-1||snapshot.versionRef.id!==row.entry_id||snapshot.versionRef.version!==Number(row.version)||snapshot.confirmationId!==row.confirmation_id||!result||result.status!=='APPLIED'||result.projectId!==pid||result.targetId!==pid||result.version!==version||result.data?.status!=='CONSTITUTION_APPLIED'||canonicalJson(result.data?.ref??null)!==canonicalJson(ref)||canonicalJson(result.data?.application??null)!==canonicalJson(snapshot)||result.serverReceivedAt!==row.created_at.toISOString())throw new AuthFailure('CONSTITUTION_INTEGRITY_FAILED',503);
 if(version===1?snapshot.previousApplicationRef!==null:!isVersionRef(snapshot.previousApplicationRef)||snapshot.previousApplicationRef.id!==pid||snapshot.previousApplicationRef.version!==version-1)throw new AuthFailure('CONSTITUTION_INTEGRITY_FAILED',503);
 return{ref,application:snapshot,appliedAt:row.created_at.toISOString()};
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
