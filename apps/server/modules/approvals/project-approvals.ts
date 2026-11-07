import {ProjectStorageQuota} from '../projects/project-storage-quota.ts';
import {createMembershipApprovalCandidate,readStoredMembershipCandidate,assertCurrentMembershipCandidate,membershipCandidateCurrent,verifyMembershipApprovalRequest} from './project-membership-approval-target.ts';
import {copyControlData,findCurrentControlGrant,ordinaryDocumentOperations} from '../control-handoff/control-grant.ts';
import {recordV1,refV1,isoV1} from '../../../../contracts/runtime/validation-v1.ts';
import {EnvironmentApprovalCandidates} from '../connections/project-environments.ts';
import {environmentWriteOperations} from '../../../../contracts/runtime/environment-configuration-v1.ts';
import {BackupPolicyApprovalCandidates} from './backup-policy-approval-candidate.ts';
import {UnderstandingReviewApprovalCandidates} from './understanding-review-approval-candidate.ts';
const samePreparationPayload=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
import {ExecutionPreparationApprovalCandidates} from './execution-preparation-approval-candidate.ts';
import {recordApprovalRequestNotification} from '../notifications/approval-notification-producer.ts';
import {notificationFromRow} from '../notifications/notification-input.ts';
import {ExecutionStartOriginStore} from '../executions/execution-start-origin-store.ts';
const readStoredOrigin=ExecutionStartOriginStore.prototype.read;
import {ProjectLimitPolicies} from '../executions/runtime-policy.ts';
import {assertResponsibleSessionApprovalTarget} from '../assignments/responsible-sessions.ts';
import{randomUUID}from'node:crypto';
import type{PoolClient}from'pg';
import{AuthFailure,type AuthenticatedIdentity,type AccessRepository}from'../access/repository.ts';
import{authorizeMaterial,currentPolicy,persistProjectReceipt,projectMember,reserveOriginReuseRequestReceiptIds,reserveRegisteredPreparationApprovalRequestReceiptIds,reserveRegisteredPreparationApprovalDecisionReceiptIds,type ProjectCommand}from'../access/project-command.ts';
import{readApprovalDetails,readApprovalDecision,readApprovalRef,assertApprovalCandidate,readApprovalListQuery,readOriginReuseApprovalRequest}from'./approval-input.ts';
import type{ProjectListCodec}from'../projects/service.ts';
import{canonicalJson,contentHash}from'../../../../contracts/canonical.ts';
import{isVersionRef}from'../../../../contracts/references.ts';
import type{VersionRef}from'../../../../contracts/generated-types.ts';
import { candidateOperations } from '../connections/candidate-input.ts';
import { trustRegistrationOperations } from '../connections/trust-registration-input.ts';
import {assertSourceDetachApprovalTarget} from './source-detach-approval-target.ts';
import type {ProjectDocuments} from '../documents/project-documents.ts';
import {DesignActivationApprovalCandidates} from './design-activation-approval-candidate.ts';
import { WorkPlanApprovalCandidates } from './work-plan-approval-candidate.ts';
export const consumableOperations = ['saveProjectMembership','prepareNativeBoundary','establishProjectWriterBoundary','revokeProjectWriterAuthority',...environmentWriteOperations.filter(op=>op!=='saveEnvironment'),'saveBackupPolicy','reviewUnderstanding','prepareExecution','defineProjectRole','bindResponsibleSession','applyLimitPolicy','revokeLimitPolicy','startStage', 'buildTaskContext', 'saveBaselineDraft','reviewBaselineContent','confirmBaseline', 'exportProject', 'uploadArtifact', 'detachDocumentSource', 'linkDocumentSource', 'proposeDocumentSourceChange', 'saveWorkPlanDraft', 'activateDesignChange', ...candidateOperations, ...trustRegistrationOperations, 'saveBackupReference', 'revokeBackupReference', 'manageBackupResource'];
export class ProjectApprovals{
 #documents?:ProjectDocuments;readonly #registeredQuota?:ProjectStorageQuota;constructor(documents?:ProjectDocuments,registeredAccess?:AccessRepository){this.#documents=documents;this.#registeredQuota=registeredAccess?new ProjectStorageQuota(registeredAccess):undefined;}
 async list(db:PoolClient,actor:AuthenticatedIdentity,pid:string,q:Record<string,unknown>,codec:ProjectListCodec){
  const member=await projectMember(db,actor,pid);const input=readApprovalListQuery(q),filter={query:canonicalJson({projectId:pid,status:input.status,targetId:input.targetId}),archived:false,limit:input.limit};
  let pos:{at:string;id:string}|null=null;if(input.cursor!==undefined){try{pos=codec.read(input.cursor,actor.actorId,filter);}catch{throw new AuthFailure('CURSOR_INVALID',400);}}
  let ordinaryGrant:{actorId:string;clientId:string;generation:number;version:number}|null=null;
  // 목록 접근자는 기존 member다. 요청의 현재성은 그 접근자가 아니라 실제 controller/요청 주체로 계산한다.
  if(!member.archived_at){await projectMember(db,actor,pid,true);const pc=(await db.query('SELECT pc.*,m.participation FROM anvil.project_control pc JOIN anvil.project_members m ON m.project_id=pc.project_id AND m.user_id=pc.actor_id AND m.revoked_at IS NULL WHERE pc.project_id=$1 FOR UPDATE OF pc,m',[pid])).rows[0];
   if(pc&&pc.participation==='HANDOFF_ELIGIBLE'&&pc.revoked_at===null&&Number.isSafeInteger(Number(pc.generation))&&Number.isSafeInteger(Number(pc.version))){const current={actorId:pc.actor_id as string,clientId:pc.client_id as string,generation:Number(pc.generation),version:Number(pc.version),revoked_at:null as null};if(await findCurrentControlGrant(db,pid,current))ordinaryGrant={actorId:current.actorId,clientId:current.clientId,generation:current.generation,version:current.version};}
  }
  // 정적 operation 집합과 같은 Tx의 물리 grant만 사용한다. public OWNER/특수 승인 분기는 그대로다.
  const memberPredicate=ordinaryGrant?"(pm.participation='OWNER' OR(pm.participation='HANDOFF_ELIGIBLE' AND r.created_by=$8::uuid AND r.client_id=$9::uuid AND pc.generation=$10::bigint AND pc.version=$11::bigint AND r.action_scope_json->>'operation' IN("+ordinaryDocumentOperations.map(op=>"'"+op+"'").join(',')+")))":"pm.participation='OWNER'";
  const now=(await db.query('SELECT clock_timestamp() at')).rows[0].at as Date;
  const rows=(await db.query(`WITH visible AS(SELECT r.id,r.version,r.status,r.scope_digest,r.action_scope_json,r.expires_at,r.created_at,
   CASE WHEN r.status IN('PENDING','APPROVED') AND r.expires_at<=$7::timestamptz THEN 'EXPIRED'
   WHEN r.status IN('PENDING','APPROVED') AND (r.policy_ref IS NULL OR pp.id IS NULL OR pv.content_hash IS DISTINCT FROM r.policy_ref->>'contentHash' OR pp.id::text IS DISTINCT FROM r.policy_ref->>'id' OR pp.head_version::text IS DISTINCT FROM r.policy_ref->>'version' OR pc.project_id IS NULL OR pc.revoked_at IS NOT NULL OR pc.actor_id IS DISTINCT FROM r.created_by OR pc.client_id IS DISTINCT FROM r.client_id OR pc.generation::text IS DISTINCT FROM r.request_json->>'controlGeneration' OR pm.user_id IS NULL OR u.id IS NULL) THEN 'REVOKED' ELSE r.status END effective_state
   FROM anvil.approval_requests r LEFT JOIN anvil.permission_policies pp ON pp.project_id=r.project_id LEFT JOIN anvil.permission_policy_versions pv ON pv.project_id=pp.project_id AND pv.policy_id=pp.id AND pv.version=pp.head_version LEFT JOIN anvil.project_control pc ON pc.project_id=r.project_id LEFT JOIN anvil.project_members pm ON pm.project_id=r.project_id AND pm.user_id=r.created_by AND ${memberPredicate} AND pm.revoked_at IS NULL LEFT JOIN anvil.users u ON u.id=r.created_by AND u.status='ACTIVE' WHERE r.project_id=$1)
   SELECT *,to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') cursor_at FROM visible WHERE ($2::text IS NULL OR effective_state=$2) AND ($3::text IS NULL OR action_scope_json->'targetRef'->>'id'=$3) AND ($4::timestamptz IS NULL OR (created_at,id)<($4::timestamptz,$5::uuid)) ORDER BY created_at DESC,id DESC LIMIT $6`,[pid,input.status,input.targetId,pos?.at??null,pos?.id??null,input.limit+1,now.toISOString(),...(ordinaryGrant?[ordinaryGrant.actorId,ordinaryGrant.clientId,ordinaryGrant.generation,ordinaryGrant.version]:[])])).rows;
  const hasMore=rows.length>input.limit,last=rows.slice(0,input.limit).at(-1);
  return{items:rows.slice(0,input.limit).map(r=>({id:r.id,currentVersion:Number(r.version),storedStatus:r.status,effectiveState:r.effective_state,operation:r.action_scope_json?.operation??null,targetRef:r.action_scope_json?.targetRef??null,scopeDigest:r.scope_digest,expiresAt:r.expires_at.toISOString(),createdAt:r.created_at.toISOString(),integrity:'NOT_RECHECKED'})),hasMore,nextCursor:hasMore?codec.create(actor.actorId,filter,{at:last!.cursor_at,id:last!.id}):null,observedAt:now.toISOString()};
 }
 async authorize(db:PoolClient,actor:AuthenticatedIdentity,c:ProjectCommand,policyRef:VersionRef):Promise<{requestId:string;decisionId:string;scopeDigest:string;replay:boolean}>{
  const approval=readApprovalRef(c.approvalRef),view=await this.read(db,actor,c.projectId,approval.requestId),r=view.request;
  assertApprovalCandidate(r.details,c,actor.actorId,c.projectId);
  if(c.operation==='saveProjectMembership'){const stored=await(view.storedStatus==='CONSUMED'?readStoredMembershipCandidate(db,actor,c.projectId,r.details,r.membershipCandidate):assertCurrentMembershipCandidate(db,actor,c.projectId,r.details,r.membershipCandidate));if(canonicalJson(stored.command)!==canonicalJson({...c,approvalRef:null}))throw new AuthFailure('APPROVAL_CANDIDATE_MISMATCH',409);}
  if(r.candidateKind==='ENVIRONMENT_DEFINITION'&&(!view.candidateEnvironment||!samePreparationPayload(view.candidateEnvironment.payload,c.payload)))throw new AuthFailure('APPROVAL_CANDIDATE_MISMATCH',409);
  if(c.operation==='reviewUnderstanding'&&(!view.candidateUnderstanding||canonicalJson(view.candidateUnderstanding.command)!==canonicalJson({...c,approvalRef:null})))throw new AuthFailure('APPROVAL_CANDIDATE_MISMATCH',409);
  if(approval.scopeDigest!==r.scopeDigest||!view.decision||view.decision.id!==approval.decisionId||view.decision.decision!=='APPROVE')throw new AuthFailure('APPROVAL_NOT_GRANTED',412);
  if(!view.basisCurrent||canonicalJson(r.policyRef)!==canonicalJson(policyRef))throw new AuthFailure('APPROVAL_BASIS_NOT_CURRENT',412);
  if(view.storedStatus==='CONSUMED'){
   if(!view.consumption||view.consumption.commandId!==c.commandId||view.consumption.requestHash!==contentHash(canonicalJson(c)))throw new AuthFailure('APPROVAL_ALREADY_CONSUMED',409);
   return{...approval,replay:true};
  }
  if(view.storedStatus!=='APPROVED'||view.currentVersion!==2||view.expired||view.consumption)throw new AuthFailure('APPROVAL_NOT_USABLE',412);
  if(['saveBackupReference','revokeBackupReference'].includes(c.operation))await (await import('../backups/backup-reference-store.ts')).assertBackupReferenceApprovalTarget(db,actor,c.projectId,r.details.actionScope);
  if(environmentWriteOperations.includes(c.operation as any)&&c.operation!=='saveEnvironment')await (await import('../connections/project-environment-resources.ts')).assertEnvironmentApprovalTarget(db,actor,c.projectId,r.details.actionScope);
  if(['defineProjectRole','bindResponsibleSession'].includes(c.operation))await assertResponsibleSessionApprovalTarget(db,actor,c.projectId,r.details.actionScope);
  if(['applyLimitPolicy','revokeLimitPolicy'].includes(c.operation))await new ProjectLimitPolicies().assertApprovalTarget(db,actor,c.projectId,r.details.actionScope);
  if(c.operation==='activateDesignChange')await new DesignActivationApprovalCandidates().assertCurrent(db,actor,c.projectId,r.details.actionScope,view.candidateActivation?.payload,this.#documents);
  if(c.operation==='saveWorkPlanDraft')await new WorkPlanApprovalCandidates().assertCurrent(db,c.projectId,r.details.actionScope,view.candidatePlan?.payload);
  if(c.operation==='saveBackupPolicy'){if(!view.candidateBackupPolicy||canonicalJson(view.candidateBackupPolicy.payload)!==canonicalJson(c.payload))throw new AuthFailure('APPROVAL_CANDIDATE_MISMATCH',409);await new BackupPolicyApprovalCandidates().assertCurrent(db,actor,c.projectId,r.details.actionScope,view.candidateBackupPolicy.payload);}
  if(c.operation==='prepareExecution'){if(!view.candidatePreparation||!samePreparationPayload(view.candidatePreparation.payload,c.payload))throw new AuthFailure('APPROVAL_CANDIDATE_MISMATCH',409);await new ExecutionPreparationApprovalCandidates().assertCurrent(db,actor,c.projectId,r.details.actionScope,view.candidatePreparation.payload);}
  if(r.candidateKind==='ENVIRONMENT_DEFINITION')await new EnvironmentApprovalCandidates().assertCurrent(db,actor,c.projectId,r.details.actionScope,view.candidateEnvironment?.payload);
  return{...approval,replay:false};
 }
 async consume(db:PoolClient,actor:AuthenticatedIdentity,c:ProjectCommand,policyRef:VersionRef,serverCommandId:string,consumptionId:string):Promise<void>{
  const approval=await this.authorize(db,actor,c,policyRef);if(approval.replay)throw new AuthFailure('APPROVAL_ALREADY_CONSUMED',409);
  await db.query('INSERT INTO anvil.approval_consumptions(id,project_id,decision_id,command_id,scope_digest,policy_id,policy_version) VALUES($1,$2,$3,$4,$5,$6,$7)',[consumptionId,c.projectId,approval.decisionId,serverCommandId,approval.scopeDigest,policyRef.id,policyRef.version]);
  const updated=await db.query("UPDATE anvil.approval_requests SET status='CONSUMED',version=3 WHERE project_id=$1 AND id=$2 AND version=2 AND status='APPROVED'",[c.projectId,approval.requestId]);if(updated.rowCount!==1)throw new AuthFailure('VERSION_CONFLICT',409);
 }
 async request(db:PoolClient,actor:AuthenticatedIdentity,c:ProjectCommand,policyRef:VersionRef,originSource?:import('../executions/execution-start-origin-reuse.ts').OriginReuseRequestSource){
  const initialRequestPolicy=await authorizeMaterial(db,actor,c);
  if(canonicalJson(initialRequestPolicy.ref)!==canonicalJson(policyRef))throw new AuthFailure('APPROVAL_BASIS_NOT_CURRENT',412);
  const p=c.payload;if(c.targetId!==null||c.expectedVersion!==0||!p)throw new AuthFailure('APPROVAL_INPUT_INVALID',422);
  const now=(await db.query('SELECT clock_timestamp() at')).rows[0].at as Date;
  // 요청 지원과 실제 소비는 별개다. 분리의 새 저장 보호/소비 연결 완료 전 실제 실행은 거절한다.
  const proposed=p.details as {actionScope?:{operation?:unknown}}|null|undefined;
  if(proposed?.actionScope?.operation==='queueExecutionCommand'){
   if(c.approvalRef!==null||c.baselineRefs.length)throw new AuthFailure('APPROVAL_INPUT_INVALID',422);
   const parsed=readOriginReuseApprovalRequest(p,{actorId:actor.actorId,clientId:actor.clientId,controlGeneration:c.controlGeneration,now},c.commandId);
   const {matchesOriginReuseRequestSource}=await import('../executions/execution-start-origin-reuse.ts');
   if(!this.#registeredQuota||!matchesOriginReuseRequestSource(originSource,db,actor,c))throw new AuthFailure('ORIGIN_REUSE_APPROVAL_NOT_CONNECTED',412);
   const source=originSource,query=db.query;
   const check=()=>{if(db.query!==query||!matchesOriginReuseRequestSource(source,db,actor,c))throw new AuthFailure('ORIGIN_REUSE_REQUEST_OUTCOME_UNKNOWN',503);};
   const send=async(sql:string,args?:unknown[])=>{check();const result=await Reflect.apply(query,db,[sql,args]);check();return result;};
   if((await send('SELECT 1 FROM anvil.approval_requests WHERE project_id=$1 AND candidate_command_id=$2',[c.projectId,parsed.details.candidateCommandId])).rowCount)throw new AuthFailure('APPROVAL_CANDIDATE_ALREADY_REQUESTED',409);
   if((await send('SELECT 1 FROM anvil.commands WHERE project_id=$1 AND actor_id=$2 AND command_id=$3',[c.projectId,actor.actorId,parsed.details.candidateCommandId])).rowCount)throw new AuthFailure('APPROVAL_CANDIDATE_ALREADY_APPLIED',409);
   const details=parsed.details,id=randomUUID(),scopeDigest=contentHash(canonicalJson(details.actionScope));
   const snapshot={projectId:c.projectId,details,scopeDigest,requiredDecider:{kind:'HUMAN',userId:actor.actorId},policyRef,requestedBy:{kind:'HUMAN',userId:actor.actorId,clientId:actor.clientId},controlGeneration:c.controlGeneration,originReuseEvidence:source.evidence};
   const ref={id,version:1,contentHash:contentHash(canonicalJson(snapshot))},createdAt=(await send('SELECT transaction_timestamp() at')).rows[0].at.toISOString();
   const request={id,version:1,status:'PENDING',...snapshot,createdAt},ids=await reserveOriginReuseRequestReceiptIds(db,actor,c);check();
   const result={operationId:ids.operationId,commandId:c.commandId,projectId:c.projectId,status:'APPLIED',targetId:id,version:1,data:{ref,status:'APPROVAL_REQUESTED',request},evidenceRefs:[],warnings:[],serverReceivedAt:createdAt};
   const lease=await this.#registeredQuota.reserveOriginReuseApprovalRequest(db,actor,c,ref,request,policyRef,ids,result,source.until);check();
   const receipt=await persistProjectReceipt(db,actor,c,ref,{status:'APPROVAL_REQUESTED',request},policyRef,'EXPLICIT_ONE_TIME_APPROVAL_REQUEST',ids);check();
   await send("INSERT INTO anvil.approval_requests(id,project_id,version,candidate_command_id,action_scope_json,scope_digest,details_json,required_decider_ref,status,expires_at,created_by,client_id,command_id,policy_ref,content_hash,request_json,created_at) VALUES($1,$2,1,$3,$4,$5,$6,$7,'PENDING',$8,$9,$10,$11,$12,$13,$14,$15)",[id,c.projectId,details.candidateCommandId,JSON.stringify(details.actionScope),scopeDigest,JSON.stringify(details),JSON.stringify(snapshot.requiredDecider),details.expiresAt,actor.actorId,actor.clientId,receipt.id,JSON.stringify(policyRef),ref.contentHash,JSON.stringify(request),createdAt]);
   await recordApprovalRequestNotification(db,actor,{command:c,request,receipt,initialPolicyValidUntil:Math.min(initialRequestPolicy.validUntil,source.until)});check();
   await this.#registeredQuota.settleOriginReuseApprovalRequest(db,actor,lease,receipt);check();return receipt.result;
  }
  const details=readApprovalDetails(p.details,{actorId:actor.actorId,clientId:actor.clientId,controlGeneration:c.controlGeneration,allowedOperations:consumableOperations,now});
  const membership=details.actionScope.operation==='saveProjectMembership';
  const environment=details.actionScope.operation==='saveEnvironment'&&Object.hasOwn(p,'candidatePayload');
  const backupPolicy=details.actionScope.operation==='saveBackupPolicy',plan=details.actionScope.operation==='saveWorkPlanDraft',activation=details.actionScope.operation==='activateDesignChange',preparation=details.actionScope.operation==='prepareExecution',understanding=details.actionScope.operation==='reviewUnderstanding';
  if(Object.keys(p).sort().join(',')!==(environment||backupPolicy||plan||activation||preparation||understanding||membership?'candidatePayload,details':'details'))throw new AuthFailure('APPROVAL_INPUT_INVALID',422);
  if(['detachDocumentSource','proposeDocumentSourceChange'].includes(details.actionScope.operation))await assertSourceDetachApprovalTarget(db,actor,c.projectId,details.actionScope.targetRef!);
  if(details.candidateCommandId===c.commandId)throw new AuthFailure('APPROVAL_SELF_CANDIDATE_INVALID',422);
  if(environment)await new EnvironmentApprovalCandidates().assertCurrent(db,actor,c.projectId,details.actionScope,p.candidatePayload);
  const understandingCommand=understanding?await new UnderstandingReviewApprovalCandidates().assertCurrent(db,actor,c.projectId,details.actionScope,p.candidatePayload):null;
  if(understandingCommand&&(understandingCommand.commandId!==details.candidateCommandId||understandingCommand.controlGeneration!==c.controlGeneration))throw new AuthFailure('APPROVAL_CANDIDATE_MISMATCH',409);
  const membershipCandidate=membership?await createMembershipApprovalCandidate(db,actor,c.projectId,details,p.candidatePayload):null;
  const candidatePolicy=await authorizeMaterial(db,actor,membershipCandidate?.command??understandingCommand??{...c,operation:details.actionScope.operation},true,this.#documents);
  if(!candidatePolicy.approvalRequired)throw new AuthFailure('APPROVAL_NOT_REQUIRED',422);
  if(Date.parse(details.expiresAt)>candidatePolicy.validUntil)throw new AuthFailure('APPROVAL_EXCEEDS_POLICY_EXPIRY',422);
  if(['saveBackupReference','revokeBackupReference'].includes(details.actionScope.operation))await (await import('../backups/backup-reference-store.ts')).assertBackupReferenceApprovalTarget(db,actor,c.projectId,details.actionScope);
  if(environmentWriteOperations.includes(details.actionScope.operation as any)&&details.actionScope.operation!=='saveEnvironment')await (await import('../connections/project-environment-resources.ts')).assertEnvironmentApprovalTarget(db,actor,c.projectId,details.actionScope);
  if(['defineProjectRole','bindResponsibleSession'].includes(details.actionScope.operation))await assertResponsibleSessionApprovalTarget(db,actor,c.projectId,details.actionScope);
  if(['applyLimitPolicy','revokeLimitPolicy'].includes(details.actionScope.operation))await new ProjectLimitPolicies().assertApprovalTarget(db,actor,c.projectId,details.actionScope);
  if(activation)await new DesignActivationApprovalCandidates().assertCurrent(db,actor,c.projectId,details.actionScope,p.candidatePayload,this.#documents);
  if(plan)await new WorkPlanApprovalCandidates().assertCurrent(db,c.projectId,details.actionScope,p.candidatePayload);
  if(backupPolicy)await new BackupPolicyApprovalCandidates().assertCurrent(db,actor,c.projectId,details.actionScope,p.candidatePayload);
  if(preparation)await new ExecutionPreparationApprovalCandidates().assertCurrent(db,actor,c.projectId,details.actionScope,p.candidatePayload);
  const registeredPreparation=preparation&&(p.candidatePayload as any)?.connectionKind==='REGISTERED_DEFINITION';
  if(registeredPreparation&&!this.#registeredQuota)throw new AuthFailure('SOURCE_VERIFIER_NOT_CONNECTED',412);
  const registeredSource=registeredPreparation?await this.#registeredQuota!.prepareRegisteredPreparationApprovalSource(db,actor,p.candidatePayload):null;
  if((await db.query('SELECT 1 FROM anvil.approval_requests WHERE project_id=$1 AND candidate_command_id=$2',[c.projectId,details.candidateCommandId])).rowCount)throw new AuthFailure('APPROVAL_CANDIDATE_ALREADY_REQUESTED',409);
  if((await db.query("SELECT 1 FROM anvil.commands WHERE project_id=$1 AND actor_id=$2 AND command_id=$3",[c.projectId,actor.actorId,details.candidateCommandId])).rowCount)throw new AuthFailure('APPROVAL_CANDIDATE_ALREADY_APPLIED',409);
  const id=randomUUID(),scopeDigest=contentHash(canonicalJson(details.actionScope)),snapshot={projectId:c.projectId,details,scopeDigest,requiredDecider:{kind:'HUMAN',userId:actor.actorId},policyRef,requestedBy:{kind:'HUMAN',userId:actor.actorId,clientId:actor.clientId},controlGeneration:c.controlGeneration,...(environment?{candidateKind:'ENVIRONMENT_DEFINITION'}:{}),...(membershipCandidate?{membershipCandidate}:{})},ref={id,version:1,contentHash:contentHash(canonicalJson(snapshot))},request={id,version:1,status:'PENDING',...snapshot,createdAt:(await db.query('SELECT transaction_timestamp() at')).rows[0].at.toISOString()};
  const registeredIds=registeredPreparation?reserveRegisteredPreparationApprovalRequestReceiptIds():undefined;
  const registeredLease=registeredIds?await this.#registeredQuota!.reserveRegisteredPreparationApprovalRequest(db,actor,c,ref,request,policyRef,registeredIds,registeredSource!):null;
  const receipt=await persistProjectReceipt(db,actor,c,ref,{status:'APPROVAL_REQUESTED',request},policyRef,'EXPLICIT_ONE_TIME_APPROVAL_REQUEST',registeredIds);
  if(environment)await new EnvironmentApprovalCandidates().capture(db,actor,{command:c,requestId:id,serverCommandId:receipt.id,policyRef,details,payload:p.candidatePayload});
  await db.query("INSERT INTO anvil.approval_requests(id,project_id,version,candidate_command_id,action_scope_json,scope_digest,details_json,required_decider_ref,status,expires_at,created_by,client_id,command_id,policy_ref,content_hash,request_json,created_at) VALUES($1,$2,1,$3,$4,$5,$6,$7,'PENDING',$8,$9,$10,$11,$12,$13,$14,$15)",[id,c.projectId,details.candidateCommandId,JSON.stringify(details.actionScope),scopeDigest,JSON.stringify(details),JSON.stringify(snapshot.requiredDecider),details.expiresAt,actor.actorId,actor.clientId,receipt.id,JSON.stringify(policyRef),ref.contentHash,JSON.stringify(request),request.createdAt]);
  if(activation)await new DesignActivationApprovalCandidates().capture(db,actor,{command:c,requestId:id,serverCommandId:receipt.id,policyRef,details,payload:p.candidatePayload});
  if(plan)await new WorkPlanApprovalCandidates().capture(db,actor,{command:c,requestId:id,serverCommandId:receipt.id,policyRef,details,payload:p.candidatePayload});
  if(understanding)await new UnderstandingReviewApprovalCandidates().capture(db,actor,{command:c,requestId:id,serverCommandId:receipt.id,policyRef,details,payload:p.candidatePayload});
  if(backupPolicy)await new BackupPolicyApprovalCandidates().capture(db,actor,{command:c,requestId:id,serverCommandId:receipt.id,policyRef,details,payload:p.candidatePayload});
  if(preparation)await new ExecutionPreparationApprovalCandidates().capture(db,actor,{command:c,requestId:id,serverCommandId:receipt.id,policyRef,details,payload:p.candidatePayload});
  await recordApprovalRequestNotification(db,actor,{command:c,request,receipt,initialPolicyValidUntil:initialRequestPolicy.validUntil});
  if(registeredLease)await this.#registeredQuota!.settleRegisteredPreparationApproval(db,actor,registeredLease,receipt);
  return receipt.result;
 }
 async decide(db:PoolClient,actor:AuthenticatedIdentity,c:ProjectCommand,policyRef:VersionRef){
  const p=readApprovalDecision(c.payload);if(c.targetId!==p.requestId||c.expectedVersion!==p.expectedVersion)throw new AuthFailure('APPROVAL_DECISION_INPUT_INVALID',422);
  const view=await this.read(db,actor,c.projectId,p.requestId),r=view.request;
  if(r.details.actionScope.operation==='queueExecutionCommand')throw new AuthFailure('ORIGIN_REUSE_APPROVAL_NOT_CONNECTED',412);
  if(canonicalJson(r.requiredDecider)!==canonicalJson({kind:'HUMAN',userId:actor.actorId})||r.requestedBy.clientId!==actor.clientId||r.controlGeneration!==c.controlGeneration)throw new AuthFailure('APPROVAL_DECIDER_DENIED',403);
  if(view.currentVersion!==p.expectedVersion||view.storedStatus!=='PENDING'||view.decision)throw new AuthFailure('VERSION_CONFLICT',409);
  if(p.scopeDigest!==r.scopeDigest)throw new AuthFailure('APPROVAL_SCOPE_MISMATCH',409);
  if(view.effectiveState!=='PENDING'||canonicalJson(policyRef)!==canonicalJson(r.policyRef))throw new AuthFailure('APPROVAL_BASIS_NOT_CURRENT',412);
  if(environmentWriteOperations.includes(r.details.actionScope.operation as any)&&r.details.actionScope.operation!=='saveEnvironment')await (await import('../connections/project-environment-resources.ts')).assertEnvironmentApprovalTarget(db,actor,c.projectId,r.details.actionScope);
  if(['defineProjectRole','bindResponsibleSession'].includes(r.details.actionScope.operation))await assertResponsibleSessionApprovalTarget(db,actor,c.projectId,r.details.actionScope);
  if(['applyLimitPolicy','revokeLimitPolicy'].includes(r.details.actionScope.operation))await new ProjectLimitPolicies().assertApprovalTarget(db,actor,c.projectId,r.details.actionScope);
  if(r.candidateKind==='ENVIRONMENT_DEFINITION')await new EnvironmentApprovalCandidates().assertCurrent(db,actor,c.projectId,r.details.actionScope,view.candidateEnvironment?.payload);
  if(r.details.actionScope.operation==='activateDesignChange')await new DesignActivationApprovalCandidates().assertCurrent(db,actor,c.projectId,r.details.actionScope,view.candidateActivation?.payload,this.#documents);
  if(r.details.actionScope.operation==='saveWorkPlanDraft')await new WorkPlanApprovalCandidates().assertCurrent(db,c.projectId,r.details.actionScope,view.candidatePlan?.payload);
  if(r.details.actionScope.operation==='saveProjectMembership')await assertCurrentMembershipCandidate(db,actor,c.projectId,r.details,r.membershipCandidate);
  const registeredPreparation=r.details.actionScope.operation==='prepareExecution'&&(view.candidatePreparation?.payload as any)?.connectionKind==='REGISTERED_DEFINITION';
  if(registeredPreparation&&!this.#registeredQuota)throw new AuthFailure('SOURCE_VERIFIER_NOT_CONNECTED',412);
  const registeredSource=registeredPreparation?await this.#registeredQuota!.prepareRegisteredPreparationApprovalSource(db,actor,view.candidatePreparation!.payload,view.requestRef):null;
  const snapshot={requestId:p.requestId,requestVersion:p.expectedVersion,requestRef:view.requestRef,scopeDigest:p.scopeDigest,decision:p.decision,reason:p.reason,decidedBy:{kind:'HUMAN',userId:actor.actorId,clientId:actor.clientId},controlGeneration:c.controlGeneration,policyRef},ref={id:randomUUID(),version:1,contentHash:contentHash(canonicalJson(snapshot))},decision={id:ref.id,...snapshot,decidedAt:(await db.query('SELECT transaction_timestamp() at')).rows[0].at.toISOString()};
  const registeredIds=registeredPreparation?reserveRegisteredPreparationApprovalDecisionReceiptIds():undefined;
  const registeredLease=registeredIds?await this.#registeredQuota!.reserveRegisteredPreparationApprovalDecision(db,actor,c,ref,decision,policyRef,registeredIds,r.details.expiresAt,registeredSource!):null;
  const receipt=await persistProjectReceipt(db,actor,c,ref,{status:'APPROVAL_DECIDED',decision},policyRef,'EXPLICIT_HUMAN_APPROVAL_DECISION',registeredIds);
  await db.query('INSERT INTO anvil.approval_decisions(id,project_id,request_id,request_version,scope_digest,decision,reason,decided_by,client_id,control_generation,decided_at,command_id,content_hash,decision_json) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)',[ref.id,c.projectId,p.requestId,p.expectedVersion,p.scopeDigest,p.decision,p.reason,actor.actorId,actor.clientId,c.controlGeneration,decision.decidedAt,receipt.id,ref.contentHash,JSON.stringify(decision)]);
  const status={APPROVE:'APPROVED',REJECT:'REJECTED',REQUEST_CHANGE:'CHANGE_REQUESTED'}[p.decision];
  const updated=await db.query('UPDATE anvil.approval_requests SET status=$3,version=version+1 WHERE project_id=$1 AND id=$2 AND version=$4 AND status=\'PENDING\'',[c.projectId,p.requestId,status,p.expectedVersion]);if(updated.rowCount!==1)throw new AuthFailure('VERSION_CONFLICT',409);if(registeredLease)await this.#registeredQuota!.settleRegisteredPreparationApproval(db,actor,registeredLease,receipt);return receipt.result;
 }
 async read(db:PoolClient,actor:AuthenticatedIdentity,pid:string,id:string){
  return this.#read(db,actor,pid,id,consumableOperations);
 }
 /** 불변 당시 소비만 검증한다. 현재 정책/제어의 진행은 역사 위조가 아니다. */
 /** writer 원장 내부의 정확 원command 소비 검산이며 공개 승인 원문 getter가 아니다. */
 async verifyWriterAuthorityConsumption(db:PoolClient,actor:AuthenticatedIdentity,c:ProjectCommand,serverCommandId:string,originalActorId:string,policyRef:VersionRef){
  const member=await projectMember(db,actor,c.projectId,true);if(member.participation!=='OWNER'||member.archived_at)throw new AuthFailure('NOT_FOUND',404);
  const approval=readApprovalRef(c.approvalRef),history=await this.#history(db,actor,c.projectId,approval.requestId,['establishProjectWriterBoundary','revokeProjectWriterAuthority','prepareNativeBoundary']);
  verifyWriterAuthorityConsumptionCore(c,serverCommandId,originalActorId,policyRef,history);
 }
 async readBackupPolicyConsumption(db:PoolClient,actor:AuthenticatedIdentity,pid:string,id:string){
  const member=await projectMember(db,actor,pid,true);
  if(member.participation!=='OWNER'||member.archived_at)throw new AuthFailure('NOT_FOUND',404);
  const {row,...history}=await this.#history(db,actor,pid,id,['saveBackupPolicy'],true);
  if(history.storedStatus!=='CONSUMED'||!history.consumption)throw new AuthFailure('APPROVAL_CONSUMPTION_INTEGRITY_FAILED',503);
  return history;
 }
 async readEnvironmentConsumption(db:PoolClient,actor:AuthenticatedIdentity,pid:string,id:string){const {row,...history}=await this.#history(db,actor,pid,id,environmentWriteOperations,true);return history;}
 async readResponsibleSessionConsumption(db:PoolClient,actor:AuthenticatedIdentity,pid:string,id:string){
  const {row,...history}=await this.#history(db,actor,pid,id,['defineProjectRole','bindResponsibleSession']);return history;
 }
 async readLimitPolicyConsumption(db:PoolClient,actor:AuthenticatedIdentity,pid:string,id:string){
  const {row,...history}=await this.#history(db,actor,pid,id,['applyLimitPolicy','revokeLimitPolicy']);return history;
 }
 async readStageStartConsumption(db:PoolClient,actor:AuthenticatedIdentity,pid:string,id:string){
  const {row,...history}=await this.#history(db,actor,pid,id,['startStage']);return history;
 }
 async readContextConsumption(db:PoolClient,actor:AuthenticatedIdentity,pid:string,id:string){
  const {row,...history}=await this.#history(db,actor,pid,id,['buildTaskContext']);return history;
 }
 /** 준비의 보관 소비 이력만 읽는다. 일반 승인 발급/authorize/consume allowlist는 넓히지 않는다. */
 async readOwnershipPreparationConsumption(db:PoolClient,actor:AuthenticatedIdentity,pid:string,id:string){
  try{
   const member=await projectMember(db,actor,pid,true);
   if(member.participation!=='OWNER'||member.archived_at!==null)throw Error();
   const v=await this.#read(db,actor,pid,id,['prepareOwnershipAnchor']),r=v.request,s=r.details.actionScope,used=v.consumption,d=v.decision;
   if(v.storedStatus!=='CONSUMED'||v.currentVersion!==3||!v.basisCurrent||v.expired||!used||!d||d.decision!=='APPROVE'||r.requestedBy.userId!==actor.actorId||r.requestedBy.clientId!==actor.clientId||s.operation!=='prepareOwnershipAnchor'||s.targetRef!==null||s.expectedVersion!==0)throw Error();
   const commandRef={id:used.serverCommandId,version:1,contentHash:used.requestHash};
   if(!isVersionRef(commandRef)||!isVersionRef(v.requestRef)||!isVersionRef(d.ref)||!isVersionRef({id:used.id,version:1,contentHash:used.scopeDigest})||!Number.isFinite(Date.parse(used.consumedAt))||Date.parse(used.consumedAt)<Date.parse(r.createdAt)||Date.parse(used.consumedAt)<Date.parse(d.decidedAt)||Date.parse(used.consumedAt)>Date.parse(v.observedAt))throw Error();
   const finalAt=(await db.query('SELECT clock_timestamp() at')).rows[0]?.at;
   if(!(finalAt instanceof Date)||!Number.isFinite(finalAt.getTime())||finalAt.getTime()<Date.parse(v.observedAt)||finalAt.getTime()>=Date.parse(r.details.expiresAt))throw Error();
   return{purpose:'OWNERSHIP_PREPARATION_APPROVAL_HISTORY_ONLY' as const,projectId:pid,requestRef:v.requestRef,decisionRef:d.ref,consumptionId:used.id,commandRef,candidateCommandId:used.commandId,scopeDigest:used.scopeDigest,payloadHash:s.payloadHash,policyRef:used.policyRef,controlGeneration:r.controlGeneration,consumedAt:used.consumedAt,observedAt:finalAt.toISOString(),expiresAt:r.details.expiresAt,missingEvidence:['AUTHENTICATED_PREPARATION_COMMAND','ORIGINAL_RECEIPT_LINK','VERIFIED_WRITER_NONE_OR_RECLAIM','CANDIDATE_PROVENANCE'] as const,preparationAuthorized:false as const,observationRequestAuthorized:false as const,executionAuthorized:false as const,dispatchPerformed:false as const};
  }catch{throw new AuthFailure('OWNERSHIP_APPROVAL_HISTORY_UNAVAILABLE',412);}
 }
 async #history(db:PoolClient,actor:AuthenticatedIdentity,pid:string,id:string,allowedOperations:readonly string[],backupPolicyHistory=false){
  await projectMember(db,actor,pid);const row=(await db.query('SELECT r.*,c.operation,c.actor_id,c.client_id command_client,c.result_ref FROM anvil.approval_requests r JOIN anvil.commands c ON c.id=r.command_id AND c.project_id=r.project_id WHERE r.project_id=$1 AND r.id=$2',[pid,id])).rows[0];if(!row)throw new AuthFailure('NOT_FOUND',404);
  const request=row.request_json;if(!request||typeof request!=='object')throw new AuthFailure('APPROVAL_INTEGRITY_FAILED',503);
  const{id:requestId,version,status,createdAt,...snapshot}=request,ref=row.result_ref?.data?.ref;
  if(requestId!==id||version!==1||status!=='PENDING'||createdAt!==row.created_at.toISOString()||snapshot.projectId!==pid||snapshot.requestedBy?.kind!=='HUMAN'||snapshot.requestedBy.userId!==row.created_by||snapshot.requestedBy.clientId!==row.client_id||row.actor_id!==row.created_by||row.command_client!==row.client_id||!isVersionRef(ref)||ref.id!==id||ref.version!==1||ref.contentHash!==row.content_hash||contentHash(canonicalJson(snapshot))!==row.content_hash||row.operation!=='requestApproval'||row.result_ref.status!=='APPLIED'||row.result_ref.data.status!=='APPROVAL_REQUESTED'||canonicalJson(row.result_ref.data.request)!==canonicalJson(request)||canonicalJson(snapshot.policyRef)!==canonicalJson(row.policy_ref)||canonicalJson(snapshot.details)!==canonicalJson(row.details_json)||snapshot.details?.candidateCommandId!==row.candidate_command_id||canonicalJson(snapshot.details?.actionScope)!==canonicalJson(row.action_scope_json)||snapshot.scopeDigest!==row.scope_digest||contentHash(canonicalJson(row.action_scope_json))!==row.scope_digest||canonicalJson(snapshot.requiredDecider)!==canonicalJson(row.required_decider_ref)||row.expires_at.toISOString()!==snapshot.details?.expiresAt)throw new AuthFailure('APPROVAL_INTEGRITY_FAILED',503);
  const originReuse=snapshot.details?.actionScope?.operation==='queueExecutionCommand';
  if(originReuse){
   if(actor.actorId!==row.created_by||actor.clientId!==row.client_id)throw new AuthFailure('NOT_FOUND',404);
   if(Number(row.version)!==1||row.status!=='PENDING')throw new AuthFailure('ORIGIN_REUSE_APPROVAL_NOT_CONNECTED',412);
   const e=snapshot.originReuseEvidence;
   if(!e||e.purpose!=='FN09_ORIGIN_REUSE_SYNTHETIC_START_V1'||e.projectId!==pid||e.candidateCommandId!==snapshot.details.candidateCommandId
    ||e.candidatePayloadHash!==snapshot.details.actionScope.payloadHash||contentHash(canonicalJson(e.candidatePayload))!==e.candidatePayloadHash
    ||canonicalJson(e.p2Ref)!==canonicalJson(row.policy_ref)||e.subject?.userId!==actor.actorId||e.subject?.clientId!==actor.clientId)throw new AuthFailure('APPROVAL_INTEGRITY_FAILED',503);
   readOriginReuseApprovalRequest({details:snapshot.details,candidatePayload:e.candidatePayload},{actorId:actor.actorId,clientId:actor.clientId,controlGeneration:snapshot.controlGeneration,now:new Date(0)},row.result_ref.commandId);
   const readPolicy=await authorizeMaterial(db,actor,{schemaVersion:1,projectId:pid,commandId:id,clientId:actor.clientId,controlGeneration:snapshot.controlGeneration,operation:'readExecutionStartOrigins',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:{}},true);
   if(readPolicy.approvalRequired)throw new AuthFailure('APPROVAL_REQUIRED',412);
   const origin=await readStoredOrigin.call(new ExecutionStartOriginStore(),db,pid,e.originRef.id,e.originRef.version),s=origin.value.snapshot;
   if(!samePreparationPayload(origin.value.ref,e.originRef)||!samePreparationPayload(origin.value.reservation.ref,e.reservationRef)
    ||!samePreparationPayload(e.originCommand,{serverCommandId:origin.serverCommandId,commandId:origin.request.commandId,requestHash:contentHash(canonicalJson(origin.request))})
    ||!samePreparationPayload(e.subject,s.subject)||!samePreparationPayload(e.execution,s.execution)||!samePreparationPayload(e.p1Ref,s.observedPolicyRef))throw new AuthFailure('APPROVAL_INTEGRITY_FAILED',503);
   for(const key of ['stageRequestRef','assignmentRef','roleBindingRef','sessionBindingRef','preparationRef','connectionRef','environmentRef','contextBundleRef','sourceScopes','budgetPolicyRef'] as const)
    if(!samePreparationPayload(e[key],s[key]))throw new AuthFailure('APPROVAL_INTEGRITY_FAILED',503);
   const proof=(await db.query('SELECT c.*, (SELECT jsonb_agg(to_jsonb(a)) FROM anvil.authorization_receipts a WHERE a.command_id=c.id) reuse_receipts, (SELECT jsonb_agg(to_jsonb(a)) FROM anvil.audit_events a WHERE a.project_id=c.project_id AND a.command_id=c.id) reuse_audits, (SELECT jsonb_agg(to_jsonb(n)) FROM anvil.notifications n WHERE n.project_id=c.project_id AND n.source_command_id=c.id) reuse_notifications FROM anvil.commands c WHERE c.project_id=$1 AND c.id=$2',[pid,row.command_id])).rows[0];
   const original={schemaVersion:1,projectId:pid,commandId:row.result_ref.commandId,clientId:row.client_id,controlGeneration:snapshot.controlGeneration,operation:'requestApproval',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:{details:snapshot.details,candidatePayload:e.candidatePayload}};
   const digest=contentHash(canonicalJson({projectId:pid,actorId:row.created_by,clientId:row.client_id,controlGeneration:snapshot.controlGeneration,requestHash:contentHash(canonicalJson(original)),policyRef:row.policy_ref,targetRef:ref}));
   const receipts=proof?.reuse_receipts,audits=proof?.reuse_audits,notifications=proof?.reuse_notifications,receipt=receipts?.[0],audit=audits?.[0],notification=notifications?.[0];
   if(!proof||proof.state!=='APPLIED'||proof.operation!=='requestApproval'||proof.actor_id!==row.created_by||proof.client_id!==row.client_id||proof.command_id!==original.commandId||proof.request_hash!==contentHash(canonicalJson(original))||proof.approval_consumption_id!==null||proof.payload_ref!==null
    ||!samePreparationPayload(proof.result_ref,row.result_ref)||receipts?.length!==1||audits?.length!==1||notifications?.length!==1
    ||receipt.id!==proof.authorization_receipt_id||receipt.command_id!==proof.id||receipt.scope_kind!=='PROJECT'||receipt.scope_id!==pid||receipt.scope_digest!==digest||receipt.approval_decision_ref!==null
    ||!samePreparationPayload(receipt.subject_ref,{kind:'HUMAN',userId:row.created_by,clientId:row.client_id})||!samePreparationPayload(receipt.policy_ref,row.policy_ref)
    ||audit.command_id!==proof.id||audit.project_id!==pid||audit.operation_id!==proof.operation_id||audit.scope_digest!==digest||audit.outcome!=='APPLIED'||audit.source_kind!=='HUMAN_COMMAND'||audit.reason_code!=='EXPLICIT_ONE_TIME_APPROVAL_REQUEST'||audit.approval_ref!==null
    ||!samePreparationPayload(audit.actor_ref,{kind:'HUMAN',userId:row.created_by})||audit.client_ref!==row.client_id||!samePreparationPayload(audit.target_ref,ref)||!samePreparationPayload(audit.policy_ref,row.policy_ref)
    ||notification.approval_request_id!==id||notification.source_command_id!==proof.id||notification.request_content_hash!==ref.contentHash||Number(notification.request_version)!==1||notification.recipient_user_id!==row.created_by||notification.event_kind!=='APPROVAL_REQUESTED'||notification.channel!=='IN_APP'||notification.delivery_state!=='STORED_IN_APP')throw new AuthFailure('APPROVAL_INTEGRITY_FAILED',503);
   notificationFromRow({...notification,created_at:new Date(notification.created_at),read_at:null});
  }else readApprovalDetails(snapshot.details,{actorId:row.created_by,clientId:row.client_id,controlGeneration:snapshot.controlGeneration,allowedOperations,now:new Date(0)});
  if(snapshot.details.actionScope.operation==='saveProjectMembership'){const candidate=await readStoredMembershipCandidate(db,actor,pid,snapshot.details,snapshot.membershipCandidate);await verifyMembershipApprovalRequest(db,pid,row,candidate);}
  else if(Object.hasOwn(snapshot,'membershipCandidate'))throw new AuthFailure('APPROVAL_INTEGRITY_FAILED',503);
  if(snapshot.candidateKind!==undefined&&snapshot.candidateKind!=='ENVIRONMENT_DEFINITION'||snapshot.candidateKind==='ENVIRONMENT_DEFINITION'&&snapshot.details.actionScope.operation!=='saveEnvironment')throw new AuthFailure('APPROVAL_INTEGRITY_FAILED',503);
  const candidateEnvironment=snapshot.candidateKind==='ENVIRONMENT_DEFINITION'?await new EnvironmentApprovalCandidates().read(db,actor,pid,id,{serverCommandId:row.command_id,createdBy:row.created_by,clientId:row.client_id,controlGeneration:snapshot.controlGeneration,policyRef:row.policy_ref,details:snapshot.details}):undefined;
  const candidateActivation=snapshot.details.actionScope.operation==='activateDesignChange'?await new DesignActivationApprovalCandidates().read(db,actor,pid,id,{serverCommandId:row.command_id,createdBy:row.created_by,clientId:row.client_id,controlGeneration:snapshot.controlGeneration,policyRef:row.policy_ref,details:snapshot.details}):undefined;
  const candidatePlan=snapshot.details.actionScope.operation==='saveWorkPlanDraft'?await new WorkPlanApprovalCandidates().read(db,actor,pid,id,{serverCommandId:row.command_id,createdBy:row.created_by,clientId:row.client_id,controlGeneration:snapshot.controlGeneration,policyRef:row.policy_ref,details:snapshot.details}):undefined;
  const candidateBackupPolicy=snapshot.details.actionScope.operation==='saveBackupPolicy'?await new BackupPolicyApprovalCandidates()[backupPolicyHistory?'readPolicyHistory':'read'](db,actor,pid,id,{serverCommandId:row.command_id,createdBy:row.created_by,clientId:row.client_id,controlGeneration:snapshot.controlGeneration,policyRef:row.policy_ref,details:snapshot.details}):undefined;
  const candidatePreparation=snapshot.details.actionScope.operation==='prepareExecution'?await new ExecutionPreparationApprovalCandidates().read(db,actor,pid,id,{serverCommandId:row.command_id,createdBy:row.created_by,clientId:row.client_id,controlGeneration:snapshot.controlGeneration,policyRef:row.policy_ref,details:snapshot.details}):undefined;
  const candidateUnderstanding=snapshot.details.actionScope.operation==='reviewUnderstanding'?await new UnderstandingReviewApprovalCandidates().read(db,actor,pid,id,{serverCommandId:row.command_id,createdBy:row.created_by,clientId:row.client_id,controlGeneration:snapshot.controlGeneration,policyRef:row.policy_ref,details:snapshot.details}):undefined;
  const saved=(await db.query('SELECT d.*,c.operation,c.actor_id,c.client_id command_client,c.expected_version,c.result_ref FROM anvil.approval_decisions d JOIN anvil.commands c ON c.id=d.command_id AND c.project_id=d.project_id WHERE d.project_id=$1 AND d.request_id=$2',[pid,id])).rows[0],used=saved?(await db.query("SELECT ac.*,c.command_id candidate_command_id,c.request_hash,c.actor_id,c.client_id,c.control_generation,c.policy_ref,c.payload_ref,c.state,c.result_ref,c.operation,c.expected_version,c.approval_consumption_id,ar.approval_decision_ref FROM anvil.approval_consumptions ac JOIN anvil.commands c ON c.project_id=ac.project_id AND c.id=ac.command_id JOIN anvil.authorization_receipts ar ON ar.id=c.authorization_receipt_id AND ar.command_id=c.id AND ar.scope_kind='PROJECT' AND ar.scope_id=c.project_id WHERE ac.project_id=$1 AND ac.decision_id=$2",[pid,saved.id])).rows[0]:null;let decision=null,consumption=null;
  if(saved){const d=saved.decision_json;if(!d||typeof d!=='object')throw new AuthFailure('APPROVAL_DECISION_INTEGRITY_FAILED',503);const{id:decisionId,decidedAt,...body}=d,decisionRef=saved.result_ref?.data?.ref,state={APPROVE:'APPROVED',REJECT:'REJECTED',REQUEST_CHANGE:'CHANGE_REQUESTED'}[saved.decision as 'APPROVE'|'REJECT'|'REQUEST_CHANGE'];
   if(!state||Number(row.version)!==(used?3:2)||row.status!==(used?'CONSUMED':state)||decisionId!==saved.id||decidedAt!==saved.decided_at.toISOString()||body.requestId!==id||body.requestVersion!==1||Number(saved.request_version)!==1||body.scopeDigest!==row.scope_digest||saved.scope_digest!==row.scope_digest||body.decision!==saved.decision||body.reason!==saved.reason||canonicalJson(body.requestRef)!==canonicalJson(ref)||canonicalJson(body.policyRef)!==canonicalJson(row.policy_ref)||canonicalJson(body.decidedBy)!==canonicalJson({kind:'HUMAN',userId:saved.decided_by,clientId:saved.client_id})||saved.decided_by!==row.created_by||saved.client_id!==row.client_id||saved.actor_id!==saved.decided_by||saved.command_client!==saved.client_id||Number(saved.control_generation)!==snapshot.controlGeneration||body.controlGeneration!==snapshot.controlGeneration||Number(saved.expected_version)!==1||saved.operation!=='decideApproval'||!isVersionRef(decisionRef)||decisionRef.id!==decisionId||decisionRef.version!==1||decisionRef.contentHash!==saved.content_hash||contentHash(canonicalJson(body))!==saved.content_hash||saved.result_ref.status!=='APPLIED'||saved.result_ref.data.status!=='APPROVAL_DECIDED'||canonicalJson(saved.result_ref.data.decision)!==canonicalJson(d))throw new AuthFailure('APPROVAL_DECISION_INTEGRITY_FAILED',503);decision={ref:decisionRef,...d};
  }else if(Number(row.version)!==1||row.status!=='PENDING')throw new AuthFailure('APPROVAL_DECISION_INTEGRITY_FAILED',503);
  if(used){
   if(!saved||saved.decision!=='APPROVE'||used.scope_digest!==row.scope_digest||used.decision_id!==saved.id||used.candidate_command_id!==snapshot.details.candidateCommandId||used.actor_id!==row.created_by||used.client_id!==row.client_id||Number(used.control_generation)!==snapshot.controlGeneration||used.policy_id!==row.policy_ref.id||Number(used.policy_version)!==row.policy_ref.version||canonicalJson(used.policy_ref)!==canonicalJson(row.policy_ref)||used.state!=='APPLIED'||used.result_ref?.status!=='APPLIED'||used.operation!==snapshot.details.actionScope.operation||Number(used.expected_version)!==snapshot.details.actionScope.expectedVersion||used.approval_consumption_id!==used.id||used.approval_decision_ref!==saved.id||!isVersionRef({id:used.candidate_command_id,version:1,contentHash:used.request_hash})||canonicalJson(used.payload_ref)!==canonicalJson({kind:'ONE_TIME_APPROVAL_SCOPE',payloadHash:snapshot.details.actionScope.payloadHash,scopeDigest:row.scope_digest}))throw new AuthFailure('APPROVAL_CONSUMPTION_INTEGRITY_FAILED',503);
   if(snapshot.details.actionScope.operation==='reviewUnderstanding'&&(!candidateUnderstanding||used.request_hash!==contentHash(canonicalJson({...candidateUnderstanding.command,approvalRef:{requestId:id,decisionId:saved.id,scopeDigest:row.scope_digest}}))))throw new AuthFailure('APPROVAL_CONSUMPTION_INTEGRITY_FAILED',503);
   if(snapshot.details.actionScope.operation==='saveBackupPolicy'){const s=snapshot.details.actionScope,original={schemaVersion:1,projectId:pid,commandId:snapshot.details.candidateCommandId,clientId:row.client_id,controlGeneration:snapshot.controlGeneration,operation:'saveBackupPolicy',targetId:s.targetRef?.id??null,expectedVersion:s.expectedVersion,baselineRefs:[],approvalRef:{requestId:id,decisionId:saved.id,scopeDigest:row.scope_digest},payload:candidateBackupPolicy?.payload};if(!candidateBackupPolicy||used.request_hash!==contentHash(canonicalJson(original)))throw new AuthFailure('APPROVAL_CONSUMPTION_INTEGRITY_FAILED',503);}
   consumption={id:used.id,status:'CONSUMED',commandId:used.candidate_command_id,serverCommandId:used.command_id,requestHash:used.request_hash,scopeDigest:used.scope_digest,policyRef:used.policy_ref,consumedAt:used.consumed_at.toISOString()};
  }
  return{row,request,requestRef:ref,currentVersion:Number(row.version),storedStatus:row.status,decision,consumption,candidateEnvironment,candidatePlan,candidateActivation,candidatePreparation,candidateUnderstanding,candidateBackupPolicy};
 }
 async #read(db:PoolClient,actor:AuthenticatedIdentity,pid:string,id:string,allowedOperations:readonly string[]){
  const {row,request,requestRef:ref,currentVersion,storedStatus,decision,consumption,candidateEnvironment,candidatePlan,candidateActivation,candidatePreparation,candidateUnderstanding,candidateBackupPolicy}=await this.#history(db,actor,pid,id,allowedOperations),snapshot=request;
  const now=(await db.query('SELECT clock_timestamp() at')).rows[0].at as Date,policy=await currentPolicy(db,pid),control=(await db.query('SELECT actor_id,client_id,generation,revoked_at FROM anvil.project_control WHERE project_id=$1',[pid])).rows[0];
  let stale=!policy||canonicalJson(policy.ref)!==canonicalJson(row.policy_ref)||!control||control.revoked_at||control.actor_id!==row.created_by||control.client_id!==row.client_id||Number(control.generation)!==snapshot.controlGeneration;
  if(snapshot.details.actionScope.operation==='saveProjectMembership'&&['PENDING','APPROVED'].includes(storedStatus)&&!stale)stale=!await membershipCandidateCurrent(db,actor,snapshot.membershipCandidate);
  const expired=row.expires_at.getTime()<=now.getTime(),effectiveState=['PENDING','APPROVED'].includes(row.status)?expired?'EXPIRED':stale?'REVOKED':row.status:row.status;
  return{request,requestRef:ref,currentVersion:Number(row.version),storedStatus:row.status,effectiveState,decision,consumption,expired,basisCurrent:!stale,executionAuthorized:false,observedAt:now.toISOString(),...(candidateEnvironment?{candidateEnvironment}:{}),...(candidatePlan?{candidatePlan}:{}),...(candidateActivation?{candidateActivation}:{}),...(candidatePreparation?{candidatePreparation}:{}),...(candidateUnderstanding?{candidateUnderstanding}:{}),...(candidateBackupPolicy?{candidateBackupPolicy}:{})};
 }
}

/** 기존 승인 DTO/원 actionScope를 그대로 소비하는 source-only writer 결박 검사. */
export function checkWriterAuthorityApproval(command:ProjectCommand,value:unknown,disposition:'AUTO'|'REQUIRE_APPROVAL'|'DENY',now:number,subject:{userId:string;clientId:string}):void{
 const fail=():never=>{throw Error('WRITER_APPROVAL_INVALID');};
 if(disposition==='AUTO'){if(command.approvalRef!==null||value!==null)fail();return;}
 if(disposition!=='REQUIRE_APPROVAL'||!recordV1(value,['requestRef','request','decision','consumption']))return fail();
 const approval=readApprovalRef(command.approvalRef),request=value.request,decision=value.decision;
 if(!refV1(value.requestRef)||!request||typeof request!=='object'||!decision||typeof decision!=='object')return fail();
 const {id,version,status,createdAt,...snapshot}=request;
 if(id!==approval.requestId||version!==1||status!=='PENDING'||!isoV1(createdAt)||value.requestRef.id!==id||value.requestRef.version!==1||value.requestRef.contentHash!==contentHash(canonicalJson(snapshot))||snapshot.projectId!==command.projectId||snapshot.requestedBy?.kind!=='HUMAN'||snapshot.requestedBy.userId!==subject.userId||snapshot.requestedBy.clientId!==subject.clientId||snapshot.scopeDigest!==approval.scopeDigest||contentHash(canonicalJson(snapshot.details?.actionScope))!==approval.scopeDigest||decision.id!==approval.decisionId||decision.decision!=='APPROVE'||decision.requestId!==id||decision.scopeDigest!==approval.scopeDigest||value.consumption!==null)fail();
 readApprovalDetails(snapshot.details,{actorId:subject.userId,clientId:subject.clientId,controlGeneration:command.controlGeneration,allowedOperations:[command.operation],now:new Date(now)});
 assertApprovalCandidate(snapshot.details,command,subject.userId,command.projectId);
}

/** 소비 전 일반 검사는 유지하고, 같은 원명령의 실제 저장 proof에 결박된 자기소비만 postcheck한다. */
export function checkWriterAuthorityConsumedApproval(command:ProjectCommand,value:unknown,before:unknown,proof:{commandRef:VersionRef;authorizationReceiptRef:VersionRef;auditRef:VersionRef},now:number,subject:{userId:string;clientId:string}):void{
 const fail=():never=>{throw Error('WRITER_APPROVAL_INVALID');};if(!recordV1(value,['requestRef','request','decision','consumption'])||!recordV1(before,['requestRef','request','decision','consumption'])||before.consumption!==null||!refV1(proof.commandRef)||proof.commandRef.contentHash!==contentHash(canonicalJson(command))||!refV1(proof.authorizationReceiptRef)||!refV1(proof.auditRef))return fail();
 const u=value.consumption,approval=readApprovalRef(command.approvalRef);if(!recordV1(u,['id','status','commandId','serverCommandId','requestHash','scopeDigest','policyRef','consumedAt'])||!isVersionRef({id:u.id,version:1,contentHash:'0'.repeat(64)})||u.status!=='CONSUMED'||u.commandId!==command.commandId||u.serverCommandId!==proof.commandRef.id||u.requestHash!==contentHash(canonicalJson(command))||u.scopeDigest!==approval.scopeDigest||canonicalJson(u.policyRef)!==canonicalJson(before.request.policyRef)||!isoV1(u.consumedAt)||Date.parse(u.consumedAt)>now)return fail();
 const original={...value,consumption:null};if(canonicalJson(original)!==canonicalJson(before))return fail();checkWriterAuthorityApproval(command,original,'REQUIRE_APPROVAL',now,subject);
}

/** 원 command의 저장된 승인소비 관계만 검산한다. 현재 caller 권한을 발급하지 않는다. */
export function verifyWriterAuthorityConsumptionCore(c:ProjectCommand,serverCommandId:string,originalActorId:string,policyRef:VersionRef,history:{request:any;consumption:any;decision:any;storedStatus:string;currentVersion:number}):void{
 const approval=readApprovalRef(c.approvalRef);
  const r=history.request,u=history.consumption,d=history.decision;if(history.storedStatus!=='CONSUMED'||history.currentVersion!==3||!u||!d||d.id!==approval.decisionId||d.decision!=='APPROVE'||r.scopeDigest!==approval.scopeDigest||r.requestedBy.userId!==originalActorId||r.requestedBy.clientId!==c.clientId||canonicalJson(r.policyRef)!==canonicalJson(policyRef)||u.serverCommandId!==serverCommandId||u.commandId!==c.commandId||u.requestHash!==contentHash(canonicalJson(c))||u.scopeDigest!==approval.scopeDigest)throw new AuthFailure('APPROVAL_CONSUMPTION_INTEGRITY_FAILED',503);
  assertApprovalCandidate(r.details,c,originalActorId,c.projectId);
}
/** FN15 고정 SQL reader가 읽은 세 원행의 hash·원 주체·command 소비를 검산한다. */
export function verifyFn15WriterApprovalRows(value:unknown,c:ProjectCommand,serverCommandId:string,originalActorId:string,policyRef:VersionRef){
 const data=copyControlData(value);if(!recordV1(data,['row','saved','used'])||!data.row||!data.saved||!data.used)throw new AuthFailure('APPROVAL_CONSUMPTION_INTEGRITY_FAILED',503);
 const row=data.row,saved=data.saved,used=data.used,pid=c.projectId,id=readApprovalRef(c.approvalRef).requestId,allowedOperations=['establishProjectWriterBoundary','revokeProjectWriterAuthority','prepareNativeBoundary'];
 for(const [v,key]of [[row,'created_at'],[row,'expires_at'],[saved,'decided_at'],[used,'consumed_at']]as const){if(!isoV1(v[key]))throw new AuthFailure('APPROVAL_CONSUMPTION_INTEGRITY_FAILED',503);v[key]=new Date(v[key]);}
 let decision=null,consumption=null;
  const request=row.request_json;if(!request||typeof request!=='object')throw new AuthFailure('APPROVAL_INTEGRITY_FAILED',503);
  const{id:requestId,version,status,createdAt,...snapshot}=request,ref=row.result_ref?.data?.ref;
  if(requestId!==id||version!==1||status!=='PENDING'||createdAt!==row.created_at.toISOString()||snapshot.projectId!==pid||snapshot.requestedBy?.kind!=='HUMAN'||snapshot.requestedBy.userId!==row.created_by||snapshot.requestedBy.clientId!==row.client_id||row.actor_id!==row.created_by||row.command_client!==row.client_id||!isVersionRef(ref)||ref.id!==id||ref.version!==1||ref.contentHash!==row.content_hash||contentHash(canonicalJson(snapshot))!==row.content_hash||row.operation!=='requestApproval'||row.result_ref.status!=='APPLIED'||row.result_ref.data.status!=='APPROVAL_REQUESTED'||canonicalJson(row.result_ref.data.request)!==canonicalJson(request)||canonicalJson(snapshot.policyRef)!==canonicalJson(row.policy_ref)||canonicalJson(snapshot.details)!==canonicalJson(row.details_json)||snapshot.details?.candidateCommandId!==row.candidate_command_id||canonicalJson(snapshot.details?.actionScope)!==canonicalJson(row.action_scope_json)||snapshot.scopeDigest!==row.scope_digest||contentHash(canonicalJson(row.action_scope_json))!==row.scope_digest||canonicalJson(snapshot.requiredDecider)!==canonicalJson(row.required_decider_ref)||row.expires_at.toISOString()!==snapshot.details?.expiresAt)throw new AuthFailure('APPROVAL_INTEGRITY_FAILED',503);
  readApprovalDetails(snapshot.details,{actorId:row.created_by,clientId:row.client_id,controlGeneration:snapshot.controlGeneration,allowedOperations,now:new Date(0)});

  if(saved){const d=saved.decision_json;if(!d||typeof d!=='object')throw new AuthFailure('APPROVAL_DECISION_INTEGRITY_FAILED',503);const{id:decisionId,decidedAt,...body}=d,decisionRef=saved.result_ref?.data?.ref,state={APPROVE:'APPROVED',REJECT:'REJECTED',REQUEST_CHANGE:'CHANGE_REQUESTED'}[saved.decision as 'APPROVE'|'REJECT'|'REQUEST_CHANGE'];
   if(!state||Number(row.version)!==(used?3:2)||row.status!==(used?'CONSUMED':state)||decisionId!==saved.id||decidedAt!==saved.decided_at.toISOString()||body.requestId!==id||body.requestVersion!==1||Number(saved.request_version)!==1||body.scopeDigest!==row.scope_digest||saved.scope_digest!==row.scope_digest||body.decision!==saved.decision||body.reason!==saved.reason||canonicalJson(body.requestRef)!==canonicalJson(ref)||canonicalJson(body.policyRef)!==canonicalJson(row.policy_ref)||canonicalJson(body.decidedBy)!==canonicalJson({kind:'HUMAN',userId:saved.decided_by,clientId:saved.client_id})||saved.decided_by!==row.created_by||saved.client_id!==row.client_id||saved.actor_id!==saved.decided_by||saved.command_client!==saved.client_id||Number(saved.control_generation)!==snapshot.controlGeneration||body.controlGeneration!==snapshot.controlGeneration||Number(saved.expected_version)!==1||saved.operation!=='decideApproval'||!isVersionRef(decisionRef)||decisionRef.id!==decisionId||decisionRef.version!==1||decisionRef.contentHash!==saved.content_hash||contentHash(canonicalJson(body))!==saved.content_hash||saved.result_ref.status!=='APPLIED'||saved.result_ref.data.status!=='APPROVAL_DECIDED'||canonicalJson(saved.result_ref.data.decision)!==canonicalJson(d))throw new AuthFailure('APPROVAL_DECISION_INTEGRITY_FAILED',503);decision={ref:decisionRef,...d};
  }else if(Number(row.version)!==1||row.status!=='PENDING')throw new AuthFailure('APPROVAL_DECISION_INTEGRITY_FAILED',503);
  if(used){
   if(!saved||saved.decision!=='APPROVE'||used.scope_digest!==row.scope_digest||used.decision_id!==saved.id||used.candidate_command_id!==snapshot.details.candidateCommandId||used.actor_id!==row.created_by||used.client_id!==row.client_id||Number(used.control_generation)!==snapshot.controlGeneration||used.policy_id!==row.policy_ref.id||Number(used.policy_version)!==row.policy_ref.version||canonicalJson(used.policy_ref)!==canonicalJson(row.policy_ref)||used.state!=='APPLIED'||used.result_ref?.status!=='APPLIED'||used.operation!==snapshot.details.actionScope.operation||Number(used.expected_version)!==snapshot.details.actionScope.expectedVersion||used.approval_consumption_id!==used.id||used.approval_decision_ref!==saved.id||!isVersionRef({id:used.candidate_command_id,version:1,contentHash:used.request_hash})||canonicalJson(used.payload_ref)!==canonicalJson({kind:'ONE_TIME_APPROVAL_SCOPE',payloadHash:snapshot.details.actionScope.payloadHash,scopeDigest:row.scope_digest}))throw new AuthFailure('APPROVAL_CONSUMPTION_INTEGRITY_FAILED',503);
   consumption={id:used.id,status:'CONSUMED',commandId:used.candidate_command_id,serverCommandId:used.command_id,requestHash:used.request_hash,scopeDigest:used.scope_digest,policyRef:used.policy_ref,consumedAt:used.consumed_at.toISOString()};
  }
 verifyWriterAuthorityConsumptionCore(c,serverCommandId,originalActorId,policyRef,{request,consumption,decision,storedStatus:row.status,currentVersion:Number(row.version)});
 return [used];
}
