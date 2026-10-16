import{randomUUID}from'node:crypto';
import type{PoolClient}from'pg';
import{AuthFailure,type AuthenticatedIdentity}from'../access/repository.ts';
import{authorizeMaterial,currentPolicy,persistProjectReceipt,projectMember,type ProjectCommand}from'../access/project-command.ts';
import{readApprovalDetails}from'./approval-input.ts';
import{canonicalJson,contentHash}from'../../../../contracts/canonical.ts';
import{isVersionRef}from'../../../../contracts/references.ts';
import type{VersionRef}from'../../../../contracts/generated-types.ts';
export class ProjectApprovals{
 async request(db:PoolClient,actor:AuthenticatedIdentity,c:ProjectCommand,policyRef:VersionRef){
  const p=c.payload;if(c.targetId!==null||c.expectedVersion!==0||!p||Object.keys(p).join(',')!=='details')throw new AuthFailure('APPROVAL_INPUT_INVALID',422);
  const now=(await db.query('SELECT clock_timestamp() at')).rows[0].at as Date;
  // 첫 소비 연결은 기존 원문 업로드에 한정한다. 다른 행위/환경을 실행 가능한 승인으로 위장하지 않는다.
  const details=readApprovalDetails(p.details,{actorId:actor.actorId,clientId:actor.clientId,controlGeneration:c.controlGeneration,allowedOperations:['uploadArtifact'],now});
  if(details.candidateCommandId===c.commandId)throw new AuthFailure('APPROVAL_SELF_CANDIDATE_INVALID',422);
  const candidatePolicy=await authorizeMaterial(db,actor,{...c,operation:details.actionScope.operation},true);
  if(!candidatePolicy.approvalRequired)throw new AuthFailure('APPROVAL_NOT_REQUIRED',422);
  if(Date.parse(details.expiresAt)>candidatePolicy.validUntil)throw new AuthFailure('APPROVAL_EXCEEDS_POLICY_EXPIRY',422);
  if((await db.query('SELECT 1 FROM anvil.approval_requests WHERE project_id=$1 AND candidate_command_id=$2',[c.projectId,details.candidateCommandId])).rowCount)throw new AuthFailure('APPROVAL_CANDIDATE_ALREADY_REQUESTED',409);
  if((await db.query("SELECT 1 FROM anvil.commands WHERE project_id=$1 AND actor_id=$2 AND command_id=$3",[c.projectId,actor.actorId,details.candidateCommandId])).rowCount)throw new AuthFailure('APPROVAL_CANDIDATE_ALREADY_APPLIED',409);
  const id=randomUUID(),scopeDigest=contentHash(canonicalJson(details.actionScope)),snapshot={projectId:c.projectId,details,scopeDigest,requiredDecider:{kind:'HUMAN',userId:actor.actorId},policyRef,requestedBy:{kind:'HUMAN',userId:actor.actorId,clientId:actor.clientId},controlGeneration:c.controlGeneration},ref={id,version:1,contentHash:contentHash(canonicalJson(snapshot))},request={id,version:1,status:'PENDING',...snapshot,createdAt:(await db.query('SELECT transaction_timestamp() at')).rows[0].at.toISOString()};
  const receipt=await persistProjectReceipt(db,actor,c,ref,{status:'APPROVAL_REQUESTED',request},policyRef,'EXPLICIT_ONE_TIME_APPROVAL_REQUEST');
  await db.query("INSERT INTO anvil.approval_requests(id,project_id,version,candidate_command_id,action_scope_json,scope_digest,details_json,required_decider_ref,status,expires_at,created_by,client_id,command_id,policy_ref,content_hash,request_json) VALUES($1,$2,1,$3,$4,$5,$6,$7,'PENDING',$8,$9,$10,$11,$12,$13,$14)",[id,c.projectId,details.candidateCommandId,JSON.stringify(details.actionScope),scopeDigest,JSON.stringify(details),JSON.stringify(snapshot.requiredDecider),details.expiresAt,actor.actorId,actor.clientId,receipt.id,JSON.stringify(policyRef),ref.contentHash,JSON.stringify(request)]);
  return receipt.result;
 }
 async read(db:PoolClient,actor:AuthenticatedIdentity,pid:string,id:string){
  await projectMember(db,actor,pid);const row=(await db.query('SELECT r.*,c.operation,c.actor_id,c.client_id command_client,c.result_ref FROM anvil.approval_requests r JOIN anvil.commands c ON c.id=r.command_id AND c.project_id=r.project_id WHERE r.project_id=$1 AND r.id=$2',[pid,id])).rows[0];if(!row)throw new AuthFailure('NOT_FOUND',404);
  const request=row.request_json;if(!request||typeof request!=='object')throw new AuthFailure('APPROVAL_INTEGRITY_FAILED',503);
  const{id:requestId,version,status,createdAt,...snapshot}=request,ref=row.result_ref?.data?.ref;
  if(requestId!==id||version!==1||status!=='PENDING'||createdAt!==row.created_at.toISOString()||snapshot.projectId!==pid||snapshot.requestedBy?.kind!=='HUMAN'||snapshot.requestedBy.userId!==row.created_by||snapshot.requestedBy.clientId!==row.client_id||row.actor_id!==row.created_by||row.command_client!==row.client_id||!isVersionRef(ref)||ref.id!==id||ref.version!==1||ref.contentHash!==row.content_hash||contentHash(canonicalJson(snapshot))!==row.content_hash||row.operation!=='requestApproval'||row.result_ref.status!=='APPLIED'||row.result_ref.data.status!=='APPROVAL_REQUESTED'||canonicalJson(row.result_ref.data.request)!==canonicalJson(request)||canonicalJson(snapshot.policyRef)!==canonicalJson(row.policy_ref)||canonicalJson(snapshot.details)!==canonicalJson(row.details_json)||snapshot.details?.candidateCommandId!==row.candidate_command_id||canonicalJson(snapshot.details?.actionScope)!==canonicalJson(row.action_scope_json)||snapshot.scopeDigest!==row.scope_digest||contentHash(canonicalJson(row.action_scope_json))!==row.scope_digest||canonicalJson(snapshot.requiredDecider)!==canonicalJson(row.required_decider_ref)||row.expires_at.toISOString()!==snapshot.details?.expiresAt)throw new AuthFailure('APPROVAL_INTEGRITY_FAILED',503);
  readApprovalDetails(snapshot.details,{actorId:row.created_by,clientId:row.client_id,controlGeneration:snapshot.controlGeneration,allowedOperations:['uploadArtifact'],now:new Date(0)});
  const now=(await db.query('SELECT clock_timestamp() at')).rows[0].at as Date,policy=await currentPolicy(db,pid),control=(await db.query('SELECT actor_id,client_id,generation,revoked_at FROM anvil.project_control WHERE project_id=$1',[pid])).rows[0];
  const stale=!policy||canonicalJson(policy.ref)!==canonicalJson(row.policy_ref)||!control||control.revoked_at||control.actor_id!==row.created_by||control.client_id!==row.client_id||Number(control.generation)!==snapshot.controlGeneration;
  return{request,requestRef:ref,currentVersion:Number(row.version),storedStatus:row.status,effectiveState:row.expires_at.getTime()<=now.getTime()?'EXPIRED':stale?'REVOKED':row.status,executionAuthorized:false,observedAt:now.toISOString()};
 }
}
