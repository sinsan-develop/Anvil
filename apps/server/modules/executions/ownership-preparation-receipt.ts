import type {PoolClient} from 'pg';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {cloneV1,isoV1,recordV1,refV1,uuidV1} from '../../../../contracts/runtime/validation-v1.ts';
import {readOwnershipEventV1} from '../../../../contracts/runtime/ownership-ledger-v1.ts';
import {AccessRepository,AuthFailure} from '../access/repository.ts';
import {readOwnershipHumanPolicyRegistrationBasis} from './ownership-human-basis.ts';

const fail=():never=>{throw new AuthFailure('OWNERSHIP_PREPARATION_RECEIPT_UNAVAILABLE',412);};
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b),hash=(v:unknown)=>contentHash(canonicalJson(v));
const date=(v:unknown):v is Date=>v instanceof Date&&Number.isFinite(v.getTime());

/** 호출자 소유 인증 transaction의 읽기 source. 현재 AUTO 원기록만 대조한다.
 * REQUIRE_APPROVAL은 소비 verifier 연결 전 거절한다. writer/실회수·provenance·원자 발급/송신 권위가 아니다. */
export async function readOwnershipPreparationReceiptBasis(db:PoolClient,access:AccessRepository,token:string,csrf:string,scopeValue:unknown,preparationRefValue:unknown){
 try{
  const scope=cloneV1(scopeValue),ref=cloneV1(preparationRefValue);
  if(!recordV1(scope,['installationId','projectId','executionId','executionGeneration'])||!['installationId','projectId','executionId'].every(k=>uuidV1(scope[k]))||!Number.isSafeInteger(scope.executionGeneration)||scope.executionGeneration<1||!refV1(ref)||ref.version!==1||access.installationId!==scope.installationId)return fail();
  const row=(await db.query('SELECT project_id,execution_id,execution_generation,event_id,version,content_hash,snapshot_json FROM anvil.execution_ownership_events WHERE project_id=$1 AND execution_id=$2 AND execution_generation=$3 AND event_id=$4 AND version=$5',[scope.projectId,scope.executionId,scope.executionGeneration,ref.id,ref.version])).rows[0];
  if(!row||row.project_id!==scope.projectId||row.execution_id!==scope.executionId||Number(row.execution_generation)!==scope.executionGeneration)return fail();
  const prep=readOwnershipEventV1({ref:{id:row.event_id,version:Number(row.version),contentHash:row.content_hash},snapshot:row.snapshot_json}),p=prep.snapshot;
  if(!same(prep.ref,ref)||!same(p.scope,scope)||p.kind!=='PREPARATION_GRANTED')return fail();
  const first=await readOwnershipHumanPolicyRegistrationBasis(db,access,token,csrf,prep);
  // 기존 범용 승인 등록부를 넓히지 않는다. 미연결 소비를 AUTO로 우회하지 않는다.
  if(first.approvalRequired)return fail();
  // app에서 불변인 receipt/audit에는 UPDATE 권한을 요구하는 행 잠금을 걸지 않는다.
  const c=(await db.query('SELECT c.*,r.id AS receipt_id,r.scope_kind AS receipt_scope_kind,r.scope_id AS receipt_scope_id,r.command_id AS receipt_command_id,r.subject_ref AS receipt_subject_ref,r.policy_ref AS receipt_policy_ref,r.scope_digest AS receipt_scope_digest,r.approval_decision_ref AS receipt_approval_decision_ref,r.authorized_at AS receipt_authorized_at FROM anvil.commands c JOIN anvil.authorization_receipts r ON r.id=c.authorization_receipt_id AND r.command_id=c.id WHERE c.project_id=$1 AND c.id=$2 AND r.id=$3 FOR SHARE OF c',[scope.projectId,p.commandRef.id,p.authorizationReceiptRef.id])).rows[0];
  if(!c||c.id!==p.commandRef.id||p.commandRef.version!==1||c.request_hash!==p.commandRef.contentHash||c.scope_kind!=='PROJECT'||c.scope_id!==scope.projectId||c.project_id!==scope.projectId||c.draft_id!==null||c.actor_id!==p.subject.userId||c.client_id!==p.subject.clientId||c.operation!=='prepareOwnershipAnchor'||c.state!=='APPLIED'||Number(c.expected_version)!==0||Number(c.control_generation)!==p.subject.controlGeneration||!same(c.policy_ref,first.policyRef)||!uuidV1(c.command_id)||!uuidV1(c.operation_id)||c.approval_consumption_id!==null||c.payload_ref!==null||c.receipt_approval_decision_ref!==null)return fail();
  if(c.authorization_receipt_id!==p.authorizationReceiptRef.id||c.receipt_id!==p.authorizationReceiptRef.id||p.authorizationReceiptRef.version!==1||c.receipt_scope_kind!=='PROJECT'||c.receipt_scope_id!==scope.projectId||c.receipt_command_id!==c.id||!same(c.receipt_subject_ref,{kind:'HUMAN',userId:p.subject.userId,clientId:p.subject.clientId})||!same(c.receipt_policy_ref,first.policyRef)||c.receipt_scope_digest!==p.authorizationReceiptRef.contentHash)return fail();
  if(!date(c.received_at)||!date(c.completed_at)||!date(c.receipt_authorized_at)||c.received_at.getTime()>c.completed_at.getTime()||c.receipt_authorized_at.getTime()>c.completed_at.getTime()||c.completed_at.getTime()>Date.parse(p.at))return fail();
  const result=cloneV1(c.result_ref);
  if(!recordV1(result,['operationId','commandId','projectId','status','targetId','version','data','evidenceRefs','warnings','serverReceivedAt'])||result.operationId!==c.operation_id||result.commandId!==c.command_id||result.projectId!==scope.projectId||result.status!=='APPLIED'||result.version!==1||!same(result.evidenceRefs,[])||!same(result.warnings,[])||result.serverReceivedAt!==c.received_at.toISOString()||!recordV1(result.data,['ref','status','intent','commandSnapshot'])||result.data.status!=='OWNERSHIP_PREPARATION_INTENT_RECORDED'||!refV1(result.data.ref)||result.data.ref.version!==1||result.targetId!==result.data.ref.id)return fail();
  // intent는 미래 event/command/receipt/audit ref를 포함하지 않아 self-hash 순환이 없다.
  const intent={schemaVersion:1,purpose:'OWNERSHIP_PREPARATION_INTENT',scope:cloneV1(p.scope),subject:cloneV1(p.subject),registrationRef:cloneV1(p.registrationRef),details:cloneV1(p.payload),at:p.at,expiresAt:p.expiresAt,executionAuthorized:false,dispatchPerformed:false};
  if(!same(result.data.intent,intent)||hash(intent)!==result.data.ref.contentHash)return fail();
  const request=result.data.commandSnapshot;
  if(!recordV1(request,['schemaVersion','projectId','commandId','clientId','controlGeneration','operation','targetId','expectedVersion','baselineRefs','approvalRef','payload'])||request.schemaVersion!==1||request.projectId!==scope.projectId||request.commandId!==c.command_id||request.clientId!==p.subject.clientId||request.controlGeneration!==p.subject.controlGeneration||request.operation!=='prepareOwnershipAnchor'||request.targetId!==null||request.expectedVersion!==0||!same(request.baselineRefs,[])||request.approvalRef!==null||!same(request.payload,{intent})||hash(request)!==c.request_hash)return fail();
  const scopeDigest=hash({projectId:scope.projectId,actorId:p.subject.userId,clientId:p.subject.clientId,controlGeneration:p.subject.controlGeneration,requestHash:c.request_hash,policyRef:first.policyRef,targetRef:result.data.ref});
  if(scopeDigest!==c.receipt_scope_digest)return fail();
  const a=(await db.query('SELECT project_id,server_sequence,event_id,actor_ref,client_ref,command_id,operation_id,target_ref,policy_ref,approval_ref,outcome,reason_code,scope_digest,recorded_at,source_kind,correction_of FROM anvil.audit_events WHERE project_id=$1 AND event_id=$2',[scope.projectId,p.auditRef.id])).rows[0];
  if(!a||p.auditRef.version!==1||a.project_id!==scope.projectId||a.event_id!==p.auditRef.id||!Number.isSafeInteger(Number(a.server_sequence))||Number(a.server_sequence)<1||!same(a.actor_ref,{kind:'HUMAN',userId:p.subject.userId})||a.client_ref!==p.subject.clientId||a.command_id!==c.id||a.operation_id!==c.operation_id||!same(a.target_ref,result.data.ref)||!same(a.policy_ref,first.policyRef)||a.approval_ref!==null||a.outcome!=='APPLIED'||a.reason_code!=='EXPLICIT_OWNERSHIP_PREPARATION_INTENT'||a.scope_digest!==scopeDigest||!date(a.recorded_at)||a.recorded_at.getTime()<c.receipt_authorized_at.getTime()||a.recorded_at.getTime()>Date.parse(p.at)||a.source_kind!=='HUMAN_COMMAND'||a.correction_of!==null)return fail();
  const auditSnapshot={projectId:a.project_id,serverSequence:Number(a.server_sequence),eventId:a.event_id,actorRef:a.actor_ref,clientRef:a.client_ref,commandId:a.command_id,operationId:a.operation_id,targetRef:a.target_ref,policyRef:a.policy_ref,approvalRef:a.approval_ref,outcome:a.outcome,reasonCode:a.reason_code,scopeDigest:a.scope_digest,recordedAt:a.recorded_at.toISOString(),sourceKind:a.source_kind,correctionOf:a.correction_of};
  if(hash(auditSnapshot)!==p.auditRef.contentHash)return fail();
  const last=await readOwnershipHumanPolicyRegistrationBasis(db,access,token,csrf,prep);
  for(const k of ['scope','subject','preparationRef','policyRef','registrationRef','publicKeySpki','approvalRequired'] as const)if(!same(last[k],first[k]))return fail();
  if(!isoV1(last.checkedAt)||Date.parse(last.checkedAt)<Date.parse(first.checkedAt))return fail();
  const expiresAt=new Date(Math.min(Date.parse(first.expiresAt),Date.parse(last.expiresAt),Date.parse(p.expiresAt))).toISOString();
  if(Date.parse(last.checkedAt)>=Date.parse(expiresAt))return fail();
  return{...last,purpose:'OWNERSHIP_PREPARATION_RECEIPT_BASIS_ONLY' as const,intentRef:cloneV1(result.data.ref),commandRef:cloneV1(p.commandRef),authorizationReceiptRef:cloneV1(p.authorizationReceiptRef),auditRef:cloneV1(p.auditRef),approvalState:'NOT_REQUIRED' as const,expiresAt,missingEvidence:['VERIFIED_WRITER_NONE_OR_RECLAIM','CANDIDATE_PROVENANCE'] as const,preparationAuthorized:false as const,observationRequestAuthorized:false as const,executionAuthorized:false as const,dispatchPerformed:false as const};
 }catch{return fail();}
}
