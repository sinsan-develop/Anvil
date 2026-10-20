import{randomUUID}from'node:crypto';
import type{PoolClient}from'pg';
import{AuthFailure,type AuthenticatedIdentity}from'../access/repository.ts';
import{authorizeMaterial,currentPolicy,persistProjectReceipt,projectMember,type ProjectCommand}from'../access/project-command.ts';
import{readApprovalDetails,readApprovalDecision,readApprovalRef,assertApprovalCandidate,readApprovalListQuery}from'./approval-input.ts';
import type{ProjectListCodec}from'../projects/service.ts';
import{canonicalJson,contentHash}from'../../../../contracts/canonical.ts';
import{isVersionRef}from'../../../../contracts/references.ts';
import type{VersionRef}from'../../../../contracts/generated-types.ts';
import { candidateOperations } from '../connections/candidate-input.ts';
import { trustRegistrationOperations } from '../connections/trust-registration-input.ts';
import {assertSourceDetachApprovalTarget} from './source-detach-approval-target.ts';
const consumableOperations = ['uploadArtifact', 'detachDocumentSource', ...candidateOperations, ...trustRegistrationOperations];
export class ProjectApprovals{
 async list(db:PoolClient,actor:AuthenticatedIdentity,pid:string,q:Record<string,unknown>,codec:ProjectListCodec){
  await projectMember(db,actor,pid);const input=readApprovalListQuery(q),filter={query:canonicalJson({projectId:pid,status:input.status,targetId:input.targetId}),archived:false,limit:input.limit};
  let pos:{at:string;id:string}|null=null;if(input.cursor!==undefined){try{pos=codec.read(input.cursor,actor.actorId,filter);}catch{throw new AuthFailure('CURSOR_INVALID',400);}}
  const now=(await db.query('SELECT clock_timestamp() at')).rows[0].at as Date;
  const rows=(await db.query(`WITH visible AS(SELECT r.id,r.version,r.status,r.scope_digest,r.action_scope_json,r.expires_at,r.created_at,
   CASE WHEN r.status IN('PENDING','APPROVED') AND r.expires_at<=$7::timestamptz THEN 'EXPIRED'
   WHEN r.status IN('PENDING','APPROVED') AND (r.policy_ref IS NULL OR pp.id IS NULL OR pv.content_hash IS DISTINCT FROM r.policy_ref->>'contentHash' OR pp.id::text IS DISTINCT FROM r.policy_ref->>'id' OR pp.head_version::text IS DISTINCT FROM r.policy_ref->>'version' OR pc.project_id IS NULL OR pc.revoked_at IS NOT NULL OR pc.actor_id IS DISTINCT FROM r.created_by OR pc.client_id IS DISTINCT FROM r.client_id OR pc.generation::text IS DISTINCT FROM r.request_json->>'controlGeneration' OR pm.user_id IS NULL OR u.id IS NULL) THEN 'REVOKED' ELSE r.status END effective_state
   FROM anvil.approval_requests r LEFT JOIN anvil.permission_policies pp ON pp.project_id=r.project_id LEFT JOIN anvil.permission_policy_versions pv ON pv.project_id=pp.project_id AND pv.policy_id=pp.id AND pv.version=pp.head_version LEFT JOIN anvil.project_control pc ON pc.project_id=r.project_id LEFT JOIN anvil.project_members pm ON pm.project_id=r.project_id AND pm.user_id=r.created_by AND pm.participation='OWNER' AND pm.revoked_at IS NULL LEFT JOIN anvil.users u ON u.id=r.created_by AND u.status='ACTIVE' WHERE r.project_id=$1)
   SELECT *,to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') cursor_at FROM visible WHERE ($2::text IS NULL OR effective_state=$2) AND ($3::text IS NULL OR action_scope_json->'targetRef'->>'id'=$3) AND ($4::timestamptz IS NULL OR (created_at,id)<($4::timestamptz,$5::uuid)) ORDER BY created_at DESC,id DESC LIMIT $6`,[pid,input.status,input.targetId,pos?.at??null,pos?.id??null,input.limit+1,now.toISOString()])).rows;
  const hasMore=rows.length>input.limit,last=rows.slice(0,input.limit).at(-1);
  return{items:rows.slice(0,input.limit).map(r=>({id:r.id,currentVersion:Number(r.version),storedStatus:r.status,effectiveState:r.effective_state,operation:r.action_scope_json?.operation??null,targetRef:r.action_scope_json?.targetRef??null,scopeDigest:r.scope_digest,expiresAt:r.expires_at.toISOString(),createdAt:r.created_at.toISOString(),integrity:'NOT_RECHECKED'})),hasMore,nextCursor:hasMore?codec.create(actor.actorId,filter,{at:last!.cursor_at,id:last!.id}):null,observedAt:now.toISOString()};
 }
 async authorize(db:PoolClient,actor:AuthenticatedIdentity,c:ProjectCommand,policyRef:VersionRef):Promise<{requestId:string;decisionId:string;scopeDigest:string;replay:boolean}>{
  const approval=readApprovalRef(c.approvalRef),view=await this.read(db,actor,c.projectId,approval.requestId),r=view.request;
  assertApprovalCandidate(r.details,c,actor.actorId,c.projectId);
  if(approval.scopeDigest!==r.scopeDigest||!view.decision||view.decision.id!==approval.decisionId||view.decision.decision!=='APPROVE')throw new AuthFailure('APPROVAL_NOT_GRANTED',412);
  if(!view.basisCurrent||canonicalJson(r.policyRef)!==canonicalJson(policyRef))throw new AuthFailure('APPROVAL_BASIS_NOT_CURRENT',412);
  if(view.storedStatus==='CONSUMED'){
   if(!view.consumption||view.consumption.commandId!==c.commandId||view.consumption.requestHash!==contentHash(canonicalJson(c)))throw new AuthFailure('APPROVAL_ALREADY_CONSUMED',409);
   return{...approval,replay:true};
  }
  if(view.storedStatus!=='APPROVED'||view.currentVersion!==2||view.expired||view.consumption)throw new AuthFailure('APPROVAL_NOT_USABLE',412);
  return{...approval,replay:false};
 }
 async consume(db:PoolClient,actor:AuthenticatedIdentity,c:ProjectCommand,policyRef:VersionRef,serverCommandId:string,consumptionId:string):Promise<void>{
  const approval=await this.authorize(db,actor,c,policyRef);if(approval.replay)throw new AuthFailure('APPROVAL_ALREADY_CONSUMED',409);
  await db.query('INSERT INTO anvil.approval_consumptions(id,project_id,decision_id,command_id,scope_digest,policy_id,policy_version) VALUES($1,$2,$3,$4,$5,$6,$7)',[consumptionId,c.projectId,approval.decisionId,serverCommandId,approval.scopeDigest,policyRef.id,policyRef.version]);
  const updated=await db.query("UPDATE anvil.approval_requests SET status='CONSUMED',version=3 WHERE project_id=$1 AND id=$2 AND version=2 AND status='APPROVED'",[c.projectId,approval.requestId]);if(updated.rowCount!==1)throw new AuthFailure('VERSION_CONFLICT',409);
 }
 async request(db:PoolClient,actor:AuthenticatedIdentity,c:ProjectCommand,policyRef:VersionRef){
  const p=c.payload;if(c.targetId!==null||c.expectedVersion!==0||!p||Object.keys(p).join(',')!=='details')throw new AuthFailure('APPROVAL_INPUT_INVALID',422);
  const now=(await db.query('SELECT clock_timestamp() at')).rows[0].at as Date;
  // 요청 지원과 실제 소비는 별개다. 분리의 새 저장 보호/소비 연결 완료 전 실제 실행은 거절한다.
  const details=readApprovalDetails(p.details,{actorId:actor.actorId,clientId:actor.clientId,controlGeneration:c.controlGeneration,allowedOperations:consumableOperations,now});
  if(details.actionScope.operation==='detachDocumentSource')await assertSourceDetachApprovalTarget(db,actor,c.projectId,details.actionScope.targetRef!);
  if(details.candidateCommandId===c.commandId)throw new AuthFailure('APPROVAL_SELF_CANDIDATE_INVALID',422);
  const candidatePolicy=await authorizeMaterial(db,actor,{...c,operation:details.actionScope.operation},true);
  if(!candidatePolicy.approvalRequired)throw new AuthFailure('APPROVAL_NOT_REQUIRED',422);
  if(Date.parse(details.expiresAt)>candidatePolicy.validUntil)throw new AuthFailure('APPROVAL_EXCEEDS_POLICY_EXPIRY',422);
  if((await db.query('SELECT 1 FROM anvil.approval_requests WHERE project_id=$1 AND candidate_command_id=$2',[c.projectId,details.candidateCommandId])).rowCount)throw new AuthFailure('APPROVAL_CANDIDATE_ALREADY_REQUESTED',409);
  if((await db.query("SELECT 1 FROM anvil.commands WHERE project_id=$1 AND actor_id=$2 AND command_id=$3",[c.projectId,actor.actorId,details.candidateCommandId])).rowCount)throw new AuthFailure('APPROVAL_CANDIDATE_ALREADY_APPLIED',409);
  const id=randomUUID(),scopeDigest=contentHash(canonicalJson(details.actionScope)),snapshot={projectId:c.projectId,details,scopeDigest,requiredDecider:{kind:'HUMAN',userId:actor.actorId},policyRef,requestedBy:{kind:'HUMAN',userId:actor.actorId,clientId:actor.clientId},controlGeneration:c.controlGeneration},ref={id,version:1,contentHash:contentHash(canonicalJson(snapshot))},request={id,version:1,status:'PENDING',...snapshot,createdAt:(await db.query('SELECT transaction_timestamp() at')).rows[0].at.toISOString()};
  const receipt=await persistProjectReceipt(db,actor,c,ref,{status:'APPROVAL_REQUESTED',request},policyRef,'EXPLICIT_ONE_TIME_APPROVAL_REQUEST');
  await db.query("INSERT INTO anvil.approval_requests(id,project_id,version,candidate_command_id,action_scope_json,scope_digest,details_json,required_decider_ref,status,expires_at,created_by,client_id,command_id,policy_ref,content_hash,request_json,created_at) VALUES($1,$2,1,$3,$4,$5,$6,$7,'PENDING',$8,$9,$10,$11,$12,$13,$14,$15)",[id,c.projectId,details.candidateCommandId,JSON.stringify(details.actionScope),scopeDigest,JSON.stringify(details),JSON.stringify(snapshot.requiredDecider),details.expiresAt,actor.actorId,actor.clientId,receipt.id,JSON.stringify(policyRef),ref.contentHash,JSON.stringify(request),request.createdAt]);
  return receipt.result;
 }
 async decide(db:PoolClient,actor:AuthenticatedIdentity,c:ProjectCommand,policyRef:VersionRef){
  const p=readApprovalDecision(c.payload);if(c.targetId!==p.requestId||c.expectedVersion!==p.expectedVersion)throw new AuthFailure('APPROVAL_DECISION_INPUT_INVALID',422);
  const view=await this.read(db,actor,c.projectId,p.requestId),r=view.request;
  if(canonicalJson(r.requiredDecider)!==canonicalJson({kind:'HUMAN',userId:actor.actorId})||r.requestedBy.clientId!==actor.clientId||r.controlGeneration!==c.controlGeneration)throw new AuthFailure('APPROVAL_DECIDER_DENIED',403);
  if(view.currentVersion!==p.expectedVersion||view.storedStatus!=='PENDING'||view.decision)throw new AuthFailure('VERSION_CONFLICT',409);
  if(p.scopeDigest!==r.scopeDigest)throw new AuthFailure('APPROVAL_SCOPE_MISMATCH',409);
  if(view.effectiveState!=='PENDING'||canonicalJson(policyRef)!==canonicalJson(r.policyRef))throw new AuthFailure('APPROVAL_BASIS_NOT_CURRENT',412);
  const snapshot={requestId:p.requestId,requestVersion:p.expectedVersion,requestRef:view.requestRef,scopeDigest:p.scopeDigest,decision:p.decision,reason:p.reason,decidedBy:{kind:'HUMAN',userId:actor.actorId,clientId:actor.clientId},controlGeneration:c.controlGeneration,policyRef},ref={id:randomUUID(),version:1,contentHash:contentHash(canonicalJson(snapshot))},decision={id:ref.id,...snapshot,decidedAt:(await db.query('SELECT transaction_timestamp() at')).rows[0].at.toISOString()};
  const receipt=await persistProjectReceipt(db,actor,c,ref,{status:'APPROVAL_DECIDED',decision},policyRef,'EXPLICIT_HUMAN_APPROVAL_DECISION');
  await db.query('INSERT INTO anvil.approval_decisions(id,project_id,request_id,request_version,scope_digest,decision,reason,decided_by,client_id,control_generation,decided_at,command_id,content_hash,decision_json) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)',[ref.id,c.projectId,p.requestId,p.expectedVersion,p.scopeDigest,p.decision,p.reason,actor.actorId,actor.clientId,c.controlGeneration,decision.decidedAt,receipt.id,ref.contentHash,JSON.stringify(decision)]);
  const status={APPROVE:'APPROVED',REJECT:'REJECTED',REQUEST_CHANGE:'CHANGE_REQUESTED'}[p.decision];
  const updated=await db.query('UPDATE anvil.approval_requests SET status=$3,version=version+1 WHERE project_id=$1 AND id=$2 AND version=$4 AND status=\'PENDING\'',[c.projectId,p.requestId,status,p.expectedVersion]);if(updated.rowCount!==1)throw new AuthFailure('VERSION_CONFLICT',409);return receipt.result;
 }
 async read(db:PoolClient,actor:AuthenticatedIdentity,pid:string,id:string){
  await projectMember(db,actor,pid);const row=(await db.query('SELECT r.*,c.operation,c.actor_id,c.client_id command_client,c.result_ref FROM anvil.approval_requests r JOIN anvil.commands c ON c.id=r.command_id AND c.project_id=r.project_id WHERE r.project_id=$1 AND r.id=$2',[pid,id])).rows[0];if(!row)throw new AuthFailure('NOT_FOUND',404);
  const request=row.request_json;if(!request||typeof request!=='object')throw new AuthFailure('APPROVAL_INTEGRITY_FAILED',503);
  const{id:requestId,version,status,createdAt,...snapshot}=request,ref=row.result_ref?.data?.ref;
  if(requestId!==id||version!==1||status!=='PENDING'||createdAt!==row.created_at.toISOString()||snapshot.projectId!==pid||snapshot.requestedBy?.kind!=='HUMAN'||snapshot.requestedBy.userId!==row.created_by||snapshot.requestedBy.clientId!==row.client_id||row.actor_id!==row.created_by||row.command_client!==row.client_id||!isVersionRef(ref)||ref.id!==id||ref.version!==1||ref.contentHash!==row.content_hash||contentHash(canonicalJson(snapshot))!==row.content_hash||row.operation!=='requestApproval'||row.result_ref.status!=='APPLIED'||row.result_ref.data.status!=='APPROVAL_REQUESTED'||canonicalJson(row.result_ref.data.request)!==canonicalJson(request)||canonicalJson(snapshot.policyRef)!==canonicalJson(row.policy_ref)||canonicalJson(snapshot.details)!==canonicalJson(row.details_json)||snapshot.details?.candidateCommandId!==row.candidate_command_id||canonicalJson(snapshot.details?.actionScope)!==canonicalJson(row.action_scope_json)||snapshot.scopeDigest!==row.scope_digest||contentHash(canonicalJson(row.action_scope_json))!==row.scope_digest||canonicalJson(snapshot.requiredDecider)!==canonicalJson(row.required_decider_ref)||row.expires_at.toISOString()!==snapshot.details?.expiresAt)throw new AuthFailure('APPROVAL_INTEGRITY_FAILED',503);
  readApprovalDetails(snapshot.details,{actorId:row.created_by,clientId:row.client_id,controlGeneration:snapshot.controlGeneration,allowedOperations:consumableOperations,now:new Date(0)});
  const saved=(await db.query('SELECT d.*,c.operation,c.actor_id,c.client_id command_client,c.expected_version,c.result_ref FROM anvil.approval_decisions d JOIN anvil.commands c ON c.id=d.command_id AND c.project_id=d.project_id WHERE d.project_id=$1 AND d.request_id=$2',[pid,id])).rows[0],used=saved?(await db.query("SELECT ac.*,c.command_id candidate_command_id,c.request_hash,c.actor_id,c.client_id,c.control_generation,c.policy_ref,c.payload_ref,c.state,c.result_ref,c.operation,c.expected_version,c.approval_consumption_id,ar.approval_decision_ref FROM anvil.approval_consumptions ac JOIN anvil.commands c ON c.project_id=ac.project_id AND c.id=ac.command_id JOIN anvil.authorization_receipts ar ON ar.id=c.authorization_receipt_id AND ar.command_id=c.id AND ar.scope_kind='PROJECT' AND ar.scope_id=c.project_id WHERE ac.project_id=$1 AND ac.decision_id=$2",[pid,saved.id])).rows[0]:null;let decision=null,consumption=null;
  if(saved){const d=saved.decision_json;if(!d||typeof d!=='object')throw new AuthFailure('APPROVAL_DECISION_INTEGRITY_FAILED',503);const{id:decisionId,decidedAt,...body}=d,decisionRef=saved.result_ref?.data?.ref,state={APPROVE:'APPROVED',REJECT:'REJECTED',REQUEST_CHANGE:'CHANGE_REQUESTED'}[saved.decision as 'APPROVE'|'REJECT'|'REQUEST_CHANGE'];
   if(!state||Number(row.version)!==(used?3:2)||row.status!==(used?'CONSUMED':state)||decisionId!==saved.id||decidedAt!==saved.decided_at.toISOString()||body.requestId!==id||body.requestVersion!==1||Number(saved.request_version)!==1||body.scopeDigest!==row.scope_digest||saved.scope_digest!==row.scope_digest||body.decision!==saved.decision||body.reason!==saved.reason||canonicalJson(body.requestRef)!==canonicalJson(ref)||canonicalJson(body.policyRef)!==canonicalJson(row.policy_ref)||canonicalJson(body.decidedBy)!==canonicalJson({kind:'HUMAN',userId:saved.decided_by,clientId:saved.client_id})||saved.decided_by!==row.created_by||saved.client_id!==row.client_id||saved.actor_id!==saved.decided_by||saved.command_client!==saved.client_id||Number(saved.control_generation)!==snapshot.controlGeneration||body.controlGeneration!==snapshot.controlGeneration||Number(saved.expected_version)!==1||saved.operation!=='decideApproval'||!isVersionRef(decisionRef)||decisionRef.id!==decisionId||decisionRef.version!==1||decisionRef.contentHash!==saved.content_hash||contentHash(canonicalJson(body))!==saved.content_hash||saved.result_ref.status!=='APPLIED'||saved.result_ref.data.status!=='APPROVAL_DECIDED'||canonicalJson(saved.result_ref.data.decision)!==canonicalJson(d))throw new AuthFailure('APPROVAL_DECISION_INTEGRITY_FAILED',503);decision={ref:decisionRef,...d};
  }else if(Number(row.version)!==1||row.status!=='PENDING')throw new AuthFailure('APPROVAL_DECISION_INTEGRITY_FAILED',503);
  if(used){
   if(!saved||saved.decision!=='APPROVE'||used.scope_digest!==row.scope_digest||used.decision_id!==saved.id||used.candidate_command_id!==snapshot.details.candidateCommandId||used.actor_id!==row.created_by||used.client_id!==row.client_id||Number(used.control_generation)!==snapshot.controlGeneration||used.policy_id!==row.policy_ref.id||Number(used.policy_version)!==row.policy_ref.version||canonicalJson(used.policy_ref)!==canonicalJson(row.policy_ref)||used.state!=='APPLIED'||used.result_ref?.status!=='APPLIED'||used.operation!==snapshot.details.actionScope.operation||Number(used.expected_version)!==snapshot.details.actionScope.expectedVersion||used.approval_consumption_id!==used.id||used.approval_decision_ref!==saved.id||!isVersionRef({id:used.candidate_command_id,version:1,contentHash:used.request_hash})||canonicalJson(used.payload_ref)!==canonicalJson({kind:'ONE_TIME_APPROVAL_SCOPE',payloadHash:snapshot.details.actionScope.payloadHash,scopeDigest:row.scope_digest}))throw new AuthFailure('APPROVAL_CONSUMPTION_INTEGRITY_FAILED',503);
   consumption={id:used.id,status:'CONSUMED',commandId:used.candidate_command_id,serverCommandId:used.command_id,requestHash:used.request_hash,scopeDigest:used.scope_digest,policyRef:used.policy_ref,consumedAt:used.consumed_at.toISOString()};
  }
  const now=(await db.query('SELECT clock_timestamp() at')).rows[0].at as Date,policy=await currentPolicy(db,pid),control=(await db.query('SELECT actor_id,client_id,generation,revoked_at FROM anvil.project_control WHERE project_id=$1',[pid])).rows[0];
  const stale=!policy||canonicalJson(policy.ref)!==canonicalJson(row.policy_ref)||!control||control.revoked_at||control.actor_id!==row.created_by||control.client_id!==row.client_id||Number(control.generation)!==snapshot.controlGeneration;
  const expired=row.expires_at.getTime()<=now.getTime(),effectiveState=['PENDING','APPROVED'].includes(row.status)?expired?'EXPIRED':stale?'REVOKED':row.status:row.status;
  return{request,requestRef:ref,currentVersion:Number(row.version),storedStatus:row.status,effectiveState,decision,consumption,expired,basisCurrent:!stale,executionAuthorized:false,observedAt:now.toISOString()};
 }
}
