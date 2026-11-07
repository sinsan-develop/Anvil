import type {OriginReuseStartLease} from '../executions/execution-start-origin-reuse.ts';
import {ProjectMemberships} from '../projects/project-memberships.ts';
import {recordV1} from '../../../../contracts/runtime/validation-v1.ts';
import {readCurrentControlGrant,ordinaryDocumentOperations,isOrdinaryControlOperation,copyControlData} from '../control-handoff/control-grant.ts';
import {writerOperations} from '../../../../contracts/runtime/project-writer-authority-v1.ts';
import {environmentWriteOperations,environmentReadOperations} from '../../../../contracts/runtime/environment-configuration-v1.ts';
import type {ProjectAssignmentConfirmations} from '../assignments/project-assignment-confirmations.ts';
import type {ProjectDocuments} from '../documents/project-documents.ts';
import {notificationSessionDeadline} from '../notifications/notification-input.ts';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { AccessRepository, AuthFailure, type AuthenticatedIdentity } from './repository.ts';
import { canonicalJson, contentHash } from '../../../../contracts/canonical.ts';
import {isVersionRef} from '../../../../contracts/references.ts';
import type { VersionRef } from '../../../../contracts/generated-types.ts';
import{ProjectApprovals}from'../approvals/project-approvals.ts';
import{readApprovalRef}from'../approvals/approval-input.ts';
import { candidateOperations } from '../connections/candidate-input.ts';
import { trustRegistrationOperations } from '../connections/trust-registration-input.ts';
import { sourceRootOperations } from '../connections/source-root-input.ts';
import { sourceReadOperations } from '../connections/source-read-input.ts';
import { assignmentDraftOperations } from '../assignments/assignment-input.ts';
import { assignmentConfirmationOperations } from '../assignments/assignment-confirmation-input.ts';
import { contextPreparationOperations } from '../context/context-input.ts';
import { baselineOperations } from '../projects/baseline-operations.ts';
import { readSourceScopesV1, type SourceScopeV1 } from '../../../../contracts/runtime/source-scope-v1.ts';
import { cloneV1, refV1, uuidV1, isoV1 } from '../../../../contracts/runtime/validation-v1.ts';

export interface ProjectCommand { schemaVersion: 1; projectId: string; commandId: string; clientId: string; controlGeneration: number; operation: string; targetId: string | null; expectedVersion: number; baselineRefs: unknown[]; approvalRef: unknown; payload: Record<string, unknown> }
export const documentOperations = ['registerExecutionStartOrigin','readExecutionStartOrigins','recordNodeDecision','revokeNodeDecision','readNodeDecisions','prepareNativeReceiveWindow','offerNativeReceiveCommand','closeNativeReceiveWindow','readNativeChannelProfile','readNativeReceiveWindow','readNativeReceiveOffer','prepareNativeBoundary','readNativePreparationAuthority',...writerOperations,...environmentWriteOperations.filter(op=>op!=='saveEnvironment'),...environmentReadOperations,'readProjectSetupCopy','readConnectionDefinition','createTransferPreparationRecord','readTransferPreparationRecord','saveBackupPolicy','saveCheckpoint', 'recordCapabilityReport', 'uploadArtifact', 'startStage', 'cancelQueuedRequest', 'saveDocumentDraft', 'detachDocumentSource', 'linkDocumentSource', 'proposeDocumentSourceChange', 'recordContentReview', 'confirmDocument', 'proposeDocumentChange', 'importDocument', 'indexDesignDocument', 'saveWorkPlanDraft', 'confirmWorkPlan', 'proposeDesignChange', 'reviewChangeImpact', 'activateDesignChange', 'linkTrace', 'requestKnowledgeShare', 'saveKnowledge', 'appendConversation', 'correctKnowledge', 'excludeKnowledge', 'confirmKnowledge', 'applyConstitution', 'requestApproval', 'decideApproval', 'copyMethodology', 'saveMethodologyDraft', 'confirmMethodology', 'applyMethodology', ...candidateOperations, ...trustRegistrationOperations, ...sourceRootOperations, ...sourceReadOperations, ...assignmentDraftOperations, ...assignmentConfirmationOperations, ...contextPreparationOperations, ...baselineOperations, 'defineProjectRole', 'bindResponsibleSession', 'prepareExecution', 'applyLimitPolicy', 'revokeLimitPolicy','reviewUnderstanding','submitResult','saveResultCriteria','evaluateResult','requestRework','markNotificationRead','saveProjectMembership','exportProject','saveBackupReference','revokeBackupReference','manageBackupResource'] as const;
export interface MaterialRule { ruleId: string; subjectRef: { kind: 'HUMAN'; userId: string }; operations: string[]; targetScopes: { kind: 'PROJECT'; projectId: string }[]; disposition: 'AUTO' | 'REQUIRE_APPROVAL' | 'DENY'; limitPolicyRef: null; expiresAt: string }
export const runtimeOperations = ['authorizeExecution','queueExecutionCommand','revokeExecutionGrant','requestExecutionStop','authorizeExecutionRecovery'] as const;
export interface ExecutionRule extends Omit<MaterialRule, 'targetScopes' | 'limitPolicyRef'> {
  targetScopes: [{ kind: 'EXECUTION'; projectId: string; executionId: string; executionGeneration: number; sourceScopes: SourceScopeV1[] }];
  limitPolicyRef: VersionRef;
}
export type ProjectPermissionRule = MaterialRule | ExecutionRule;
function exact(value: unknown, keys: string[]): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join(',') === [...keys].sort().join(','); }
export function materialRules(value: unknown, projectId: string, actorId: string, now = new Date()): ProjectPermissionRule[] {
  if (!Array.isArray(value) || value.length > 200) throw new AuthFailure('POLICY_INPUT_INVALID', 422);
  const seen = new Set<string>();
  for (const rule of value) {
    if (!exact(rule, ['ruleId', 'subjectRef', 'operations', 'targetScopes', 'disposition', 'limitPolicyRef', 'expiresAt']) || typeof rule.ruleId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(rule.ruleId) || seen.has(rule.ruleId)
      || !exact(rule.subjectRef, ['kind', 'userId']) || rule.subjectRef.kind !== 'HUMAN' || rule.subjectRef.userId !== actorId
      || !Array.isArray(rule.targetScopes) || rule.targetScopes.length !== 1
      || !Array.isArray(rule.operations) || !rule.operations.length || rule.operations.length > 200 || rule.operations.some(item => typeof item !== 'string') || new Set(rule.operations).size !== rule.operations.length
      || typeof rule.disposition !== 'string' || !['AUTO', 'REQUIRE_APPROVAL', 'DENY'].includes(rule.disposition) || !isoV1(rule.expiresAt) || Date.parse(rule.expiresAt) <= now.getTime()) throw new AuthFailure('POLICY_INPUT_INVALID', 422);
    const scope = rule.targetScopes[0];
    if (rule.operations.includes('reuseExecutionStartOrigin')) {
      if (exact(scope, ['kind','projectId']) && scope.kind === 'PROJECT' && scope.projectId === projectId)
        throw new AuthFailure('POLICY_SCOPE_NOT_READY', 412);
      // 정책 전용 목적은 이 분기에서만 정확한 EXECUTION 범위를 확인하고 수락한다.
      if (!exact(scope, ['kind','projectId','executionId','executionGeneration','sourceScopes']) || scope.kind !== 'EXECUTION' || scope.projectId !== projectId
        || !uuidV1(scope.executionId) || !Number.isSafeInteger(scope.executionGeneration) || Number(scope.executionGeneration) < 1)
        throw new AuthFailure('POLICY_INPUT_INVALID', 422);
      try { readSourceScopesV1(scope.sourceScopes); } catch { throw new AuthFailure('POLICY_INPUT_INVALID', 422); }
      if (!refV1(rule.limitPolicyRef) || rule.operations.some(item => item !== 'reuseExecutionStartOrigin' && !(runtimeOperations as readonly string[]).includes(item)))
        throw new AuthFailure('POLICY_SCOPE_NOT_READY', 412);
      seen.add(rule.ruleId);
      continue;
    }
    if (exact(scope, ['kind','projectId']) && scope.kind === 'PROJECT' && scope.projectId === projectId) {
      if (rule.operations.some(item => !documentOperations.includes(item as typeof documentOperations[number])) || rule.limitPolicyRef !== null) throw new AuthFailure('POLICY_SCOPE_NOT_READY', 412);
    } else {
      if (!exact(scope, ['kind','projectId','executionId','executionGeneration','sourceScopes']) || scope.kind !== 'EXECUTION' || scope.projectId !== projectId
        || !uuidV1(scope.executionId) || !Number.isSafeInteger(scope.executionGeneration) || Number(scope.executionGeneration) < 1) throw new AuthFailure('POLICY_INPUT_INVALID', 422);
      try { readSourceScopesV1(scope.sourceScopes); } catch { throw new AuthFailure('POLICY_INPUT_INVALID', 422); }
      if (!refV1(rule.limitPolicyRef) || rule.operations.some(item => !(runtimeOperations as readonly string[]).includes(item))) throw new AuthFailure('POLICY_SCOPE_NOT_READY', 412);
    }
    if(rule.disposition==='REQUIRE_APPROVAL'&&rule.operations.some(op=>['requestApproval','decideApproval'].includes(op)))throw new AuthFailure('APPROVAL_POLICY_RECURSION_INVALID',422);
    seen.add(rule.ruleId);
  }
  return cloneV1(value) as ProjectPermissionRule[];
}
export async function projectMember(db: PoolClient, actor: AuthenticatedIdentity, projectId: string, lock = false) {
  const row = (await db.query(`SELECT p.id,p.archived_at,m.participation FROM anvil.projects p JOIN anvil.project_members m ON m.project_id=p.id WHERE p.id=$1 AND m.user_id=$2 AND m.revoked_at IS NULL ${lock ? 'FOR UPDATE OF p,m' : ''}`, [projectId, actor.actorId])).rows[0];
  if (!row) throw new AuthFailure('NOT_FOUND', 404);
  return row;
}
export async function currentProjectController(db: PoolClient, actor: AuthenticatedIdentity, request: ProjectCommand) {
  const member = await projectMember(db, actor, request.projectId, true);
  if (member.archived_at) throw new AuthFailure('PROJECT_ARCHIVED', 412);
  if (member.participation !== 'OWNER' || request.clientId !== actor.clientId) throw new AuthFailure('PROJECT_WRITE_DENIED', 403);
  const control = (await db.query('SELECT * FROM anvil.project_control WHERE project_id=$1 FOR UPDATE', [request.projectId])).rows[0];
  if (!control || control.revoked_at || control.actor_id !== actor.actorId || control.client_id !== actor.clientId) throw new AuthFailure('PROJECT_CONTROL_REQUIRED', 403);
  if (Number(control.generation) !== request.controlGeneration) throw new AuthFailure('CONTROL_GENERATION_CONFLICT', 409);
  return control;
}
const fn15DocumentOperations=new Set(['saveDocumentDraft','recordContentReview','confirmDocument','proposeDocumentChange','importDocument','uploadArtifact','requestApproval','decideApproval']);
const fn15HeActors=new WeakSet<object>();
type Fn15DocumentContext={actor:AuthenticatedIdentity;actorId:string;clientId:string;session:AuthenticatedIdentity['authSession'];credentialGeneration:number;request:ProjectCommand;requestHash:string;used:boolean};
const fn15DocumentContexts=new WeakMap<PoolClient,Fn15DocumentContext>();
const originReuseAuthentication=AccessRepository.prototype.authenticated;
const originReuseObservationContexts=new WeakMap<PoolClient,{access:AccessRepository;query:PoolClient['query'];transactionId?:string}>();
function originReuseAuthenticationMatches(access:AccessRepository){
 const method=Object.getOwnPropertyDescriptor(AccessRepository.prototype,'authenticated');
 return Object.getPrototypeOf(access)===AccessRepository.prototype&&!Object.hasOwn(access,'authenticated')
  &&method!==undefined&&'value'in method&&method.value===originReuseAuthentication;
}
function isOriginReuseObservationRequest(request:ProjectCommand){
 if(request.operation!=='requestApproval')return false;
 const details=request.payload?.details as {actionScope?:{operation?:unknown}}|null|undefined,candidate=request.payload?.candidatePayload;
 return details?.actionScope?.operation==='queueExecutionCommand'||!!candidate&&typeof candidate==='object'&&Object.hasOwn(candidate,'originReuse');
}
/** 현재 원 인증 거래와 고정 명령의 일치만 확인한다. */
export function matchesOriginReuseObservationContext(access:AccessRepository,db:PoolClient,actor:AuthenticatedIdentity,request:ProjectCommand,transactionId?:string){
 const live=originReuseObservationContexts.get(db),context=fn15DocumentContexts.get(db);
 return live?.access===access&&live.query===db.query&&originReuseAuthenticationMatches(access)
  &&(transactionId===undefined||transactionId===live.transactionId)
  &&context?.actor===actor&&context.actorId===actor.actorId&&context.clientId===actor.clientId
  &&context.session===actor.authSession&&context.credentialGeneration===actor.credentialGeneration
  &&(isOriginReuseObservationRequest(request)||request.operation==='decideApproval')&&context.requestHash===contentHash(canonicalJson(copyControlData(request,2097152)));
}
/** 실제 인증 callback 안에서만 생산한다. 외부 setter나 caller verified flag는 없다. */
async function withFn15DocumentContext<T>(db:PoolClient,actor:AuthenticatedIdentity,request:ProjectCommand,work:()=>Promise<T>):Promise<T>{
 if(!fn15DocumentOperations.has(request.operation))return work();
 if(fn15DocumentContexts.has(db))throw new AuthFailure('DOCUMENT_CONTEXT_CONFLICT',409);
 const fixed=copyControlData(request,2097152),binding:Fn15DocumentContext={actor,actorId:actor.actorId,clientId:actor.clientId,session:actor.authSession,credentialGeneration:actor.credentialGeneration,request:fixed,requestHash:contentHash(canonicalJson(fixed)),used:false};
 fn15DocumentContexts.set(db,binding);try{return await work();}finally{if(fn15DocumentContexts.get(db)===binding)fn15DocumentContexts.delete(db);}
}
function consumeFn15DocumentContext(db:PoolClient,actor:AuthenticatedIdentity,request:ProjectCommand):string|null{
 const binding=fn15DocumentContexts.get(db);
 if(binding&&(binding.actor!==actor||binding.requestHash!==contentHash(canonicalJson(copyControlData(request,2097152)))))throw new AuthFailure('DOCUMENT_CONTEXT_INVALID',403);
 if(!fn15DocumentOperations.has(request.operation))return null;
 if(!fn15HeActors.has(actor))return null;
 const session=actor.authSession;
 if(!binding||binding.used||binding.actor!==actor||binding.actorId!==actor.actorId||binding.clientId!==actor.clientId||binding.session!==session||binding.credentialGeneration!==actor.credentialGeneration||!session||!uuidV1(session.id)||!isoV1(session.idleExpiresAt)||!isoV1(session.absoluteExpiresAt)||!Number.isSafeInteger(actor.credentialGeneration)||actor.credentialGeneration<1||binding.requestHash!==contentHash(canonicalJson(copyControlData(request,2097152))))throw new AuthFailure('DOCUMENT_CONTEXT_INVALID',403);
 const wire=canonicalJson({schemaVersion:1,purpose:'FN15_ORDINARY_DOCUMENT_WRITE',sessionId:session.id,credentialGeneration:actor.credentialGeneration,request:binding.request});
 if(Buffer.byteLength(wire,'utf8')>2097314)throw new AuthFailure('DOCUMENT_CONTEXT_INVALID',403);binding.used=true;return wire;
}
/** 일반문서/새 일반승인에만 별도 grant 소비를 연결한다. 원 OWNER helper는 보존한다. */
export async function currentGeneralProjectController(db:PoolClient,actor:AuthenticatedIdentity,request:ProjectCommand){
 try{return await currentProjectController(db,actor,request);}catch(error){if(!isOrdinaryControlOperation(request.operation)||!(error instanceof AuthFailure)||error.message!=='PROJECT_WRITE_DENIED')throw error;}
 const member=await projectMember(db,actor,request.projectId,true);if(member.archived_at||member.participation!=='HANDOFF_ELIGIBLE'||request.clientId!==actor.clientId)throw new AuthFailure('PROJECT_WRITE_DENIED',403);
 if(request.operation==='recordContentReview'){const p=copyControlData(request.payload);if(!recordV1(p,['targetKind','targetRef','criteriaVersion','items','outcome','reason'])||p.targetKind!=='DOCUMENT'||!isVersionRef(p.targetRef)||p.targetRef.id!==request.targetId||p.targetRef.version!==request.expectedVersion)throw new AuthFailure('PROJECT_WRITE_DENIED',403);}
 const control=(await db.query('SELECT * FROM anvil.project_control WHERE project_id=$1 FOR UPDATE',[request.projectId])).rows[0];
 if(!control||control.revoked_at||control.actor_id!==actor.actorId||control.client_id!==actor.clientId)throw new AuthFailure('PROJECT_CONTROL_REQUIRED',403);
 if(Number(control.generation)!==request.controlGeneration)throw new AuthFailure('CONTROL_GENERATION_CONFLICT',409);
 await readCurrentControlGrant(db,request.projectId,{actorId:actor.actorId,clientId:actor.clientId,generation:Number(control.generation),version:Number(control.version),revoked_at:null});
 fn15HeActors.add(actor);
 if(request.operation==='requestApproval'){
  const p=copyControlData(request.payload);if(!recordV1(p,['details'])||!recordV1(p.details,Object.keys(p.details??{}))||!recordV1(p.details.actionScope,Object.keys(p.details.actionScope??{})))throw new AuthFailure('PROJECT_WRITE_DENIED',403);const op=p.details.actionScope.operation;if(typeof op!=='string'||!(ordinaryDocumentOperations as readonly string[]).includes(op))throw new AuthFailure('PROJECT_WRITE_DENIED',403);
 }
 if(request.operation==='decideApproval'){
  const rows=(await db.query('SELECT action_scope_json,created_by,client_id,request_json FROM anvil.approval_requests WHERE project_id=$1 AND id=$2 FOR SHARE',[request.projectId,request.targetId])).rows;
  if(rows.length!==1||!(ordinaryDocumentOperations as readonly string[]).includes(rows[0].action_scope_json?.operation)||rows[0].created_by!==actor.actorId||rows[0].client_id!==actor.clientId||rows[0].request_json?.controlGeneration!==request.controlGeneration)throw new AuthFailure('APPROVAL_DECIDER_DENIED',403);
 }
 return control;
}
/** 소스 후보의 준비조회 predicate다. 가짜 ProjectCommand/승인 소비를 만들지 않는다. */
export async function currentGeneralProjectSelectionController(db:PoolClient,actor:AuthenticatedIdentity,projectId:string,operation:string){
 if(!(ordinaryDocumentOperations as readonly string[]).includes(operation))throw new AuthFailure('PROJECT_WRITE_DENIED',403);
 const member=await projectMember(db,actor,projectId,true);if(member.archived_at||!['OWNER','HANDOFF_ELIGIBLE'].includes(member.participation))throw new AuthFailure('PROJECT_WRITE_DENIED',403);
 const control=(await db.query('SELECT * FROM anvil.project_control WHERE project_id=$1 FOR UPDATE',[projectId])).rows[0];if(!control||control.revoked_at||control.actor_id!==actor.actorId||control.client_id!==actor.clientId)throw new AuthFailure('PROJECT_CONTROL_REQUIRED',403);
 if(member.participation==='HANDOFF_ELIGIBLE')await readCurrentControlGrant(db,projectId,{actorId:actor.actorId,clientId:actor.clientId,generation:Number(control.generation),version:Number(control.version),revoked_at:null});return control;
}
export async function currentPolicy(db: PoolClient, projectId: string) {
  const row = (await db.query('SELECT p.id,p.head_version,v.rules_json,v.content_hash,v.reason,v.review_refs,v.created_at FROM anvil.permission_policies p JOIN anvil.permission_policy_versions v ON v.policy_id=p.id AND v.project_id=p.project_id AND v.version=p.head_version WHERE p.project_id=$1 FOR SHARE OF p', [projectId])).rows[0];
  if (!row) return null;
  if (!Array.isArray(row.rules_json) || row.rules_json.some((rule: {disposition?: unknown} | null) => !rule || typeof rule.disposition !== 'string' || !['AUTO','REQUIRE_APPROVAL','DENY'].includes(rule.disposition))) throw new AuthFailure('POLICY_INTEGRITY_FAILED', 503);
  if (contentHash(canonicalJson({ rules: row.rules_json, reason: row.reason, reviewRefs: row.review_refs })) !== row.content_hash) throw new AuthFailure('POLICY_INTEGRITY_FAILED', 503);
  return { ref: { id: row.id, version: Number(row.head_version), contentHash: row.content_hash }, rules: row.rules_json as ProjectPermissionRule[], reason: row.reason, reviewRefs: row.review_refs, createdAt: row.created_at.toISOString() };
}
export async function authorizeMaterial(db: PoolClient, actor: AuthenticatedIdentity, request: ProjectCommand, inspectPending=false, documents?:ProjectDocuments) {
  const policy = await currentPolicy(db, request.projectId);
  if (!policy) throw new AuthFailure('PERMISSION_POLICY_UNCONFIGURED', 412);
  if (!documentOperations.includes(request.operation as typeof documentOperations[number])) throw new AuthFailure('PROJECT_OPERATION_DENIED', 403);
  const matched = policy.rules.filter(rule => rule.subjectRef.kind === 'HUMAN' && rule.subjectRef.userId === actor.actorId && rule.targetScopes.some(scope => scope.kind === 'PROJECT' && scope.projectId === request.projectId) && rule.operations.includes(request.operation) && Date.parse(rule.expiresAt) > Date.now());
  if (!matched.length || matched.some(rule => rule.disposition === 'DENY')) throw new AuthFailure('PROJECT_OPERATION_DENIED', 403);
  const approvalRequired=matched.some(rule => rule.disposition === 'REQUIRE_APPROVAL');
  if(['recordNodeDecision','revokeNodeDecision','readNodeDecisions'].includes(request.operation)&&(approvalRequired||request.approvalRef!==null))throw new AuthFailure('NODE_DECISION_APPROVAL_NOT_CONNECTED',412);
  if(request.operation==='recordCapabilityReport'&&(approvalRequired||request.approvalRef!==null))throw new AuthFailure('CAPABILITY_APPROVAL_NOT_CONNECTED',412);
  if(request.operation==='requestKnowledgeShare'&&(approvalRequired||request.approvalRef!==null))throw new AuthFailure('KNOWLEDGE_SHARE_APPROVAL_NOT_CONNECTED',412);
  if(request.operation==='activateDesignChange'&&!approvalRequired)throw new AuthFailure('APPROVAL_REQUIRED',412);
  if (request.operation === 'cancelQueuedRequest' && (approvalRequired || request.approvalRef !== null)) throw new AuthFailure('STAGE_QUEUE_APPROVAL_NOT_CONNECTED',412);
  // 준비본·사람 이해검토 저장만 exact 승인에 연결한다. 실제 실행 허가는 열지 않는다.
  if (request.operation==='reviewUnderstanding' && (!uuidV1(request.targetId)||!Number.isSafeInteger(request.expectedVersion)||request.expectedVersion<1)) throw new AuthFailure('EXECUTION_PREPARATION_APPROVAL_NOT_CONNECTED',412);
  if(request.operation==='markNotificationRead'&&(approvalRequired||request.approvalRef!==null))throw new AuthFailure('NOTIFICATION_READ_APPROVAL_NOT_CONNECTED',412);
  if(request.operation==='saveCheckpoint'&&(approvalRequired||request.approvalRef!==null))throw new AuthFailure('CHECKPOINT_APPROVAL_NOT_CONNECTED',412);
  if(!inspectPending){
    if(approvalRequired){if(request.approvalRef===null)throw new AuthFailure('APPROVAL_REQUIRED',412);await new ProjectApprovals(documents).authorize(db,actor,request,policy.ref);}
    else if(request.approvalRef!==null)throw new AuthFailure('APPROVAL_NOT_REQUIRED',422);
  }
  return {...policy,approvalRequired,validUntil:Math.min(...matched.map(rule=>Date.parse(rule.expiresAt)))};
}
export async function projectReplay(db: PoolClient, actor: AuthenticatedIdentity, request: ProjectCommand) {
  const rows = (await db.query("SELECT operation,request_hash,result_ref FROM anvil.commands WHERE scope_kind='PROJECT' AND project_id=$1 AND actor_id=$2 AND command_id=$3", [request.projectId, actor.actorId, request.commandId])).rows;
  if (!rows.length) return undefined;
  if (rows.length !== 1 || rows[0].operation !== request.operation || rows[0].request_hash !== contentHash(canonicalJson(request))) throw new AuthFailure('IDEMPOTENCY_CONFLICT', 409);
  return rows[0].result_ref;
}
export interface ActivationReceiptIds{readonly serverCommandId:string;readonly consumptionId:string;readonly documents?:ProjectDocuments}
const activationReservations=new WeakSet<object>();
export function reserveActivationReceiptIds(documents?:ProjectDocuments):ActivationReceiptIds{const value=Object.freeze({serverCommandId:randomUUID(),consumptionId:randomUUID(),documents});activationReservations.add(value);return value;}
export interface RegisteredPreparationReceiptIds extends ActivationReceiptIds {readonly operationId:string;readonly authorizationReceiptId:string;readonly auditEventId:string}
const registeredPreparationReceiptReservations=new WeakSet<object>();
/** 서버 내부 식별자 선점이다. 권한/승인/저장 성공을 발급하지 않는다. */
export function reserveRegisteredPreparationReceiptIds():RegisteredPreparationReceiptIds{
  const ids=Object.freeze({serverCommandId:randomUUID(),consumptionId:randomUUID(),operationId:randomUUID(),authorizationReceiptId:randomUUID(),auditEventId:randomUUID()});
  registeredPreparationReceiptReservations.add(ids);return ids;
}
export function isRegisteredPreparationReceiptIds(value:unknown):value is RegisteredPreparationReceiptIds{
  return !!value&&typeof value==='object'&&registeredPreparationReceiptReservations.has(value);
}
const registeredApprovalReceiptReservations=new WeakMap<object,'REQUEST'|'DECISION'>();
function reserveRegisteredApprovalReceiptIds(purpose:'REQUEST'|'DECISION'):RegisteredPreparationReceiptIds{
 const ids=Object.freeze({serverCommandId:randomUUID(),consumptionId:randomUUID(),operationId:randomUUID(),authorizationReceiptId:randomUUID(),auditEventId:randomUUID()});registeredApprovalReceiptReservations.set(ids,purpose);return ids;
}
export const reserveRegisteredPreparationApprovalRequestReceiptIds=()=>reserveRegisteredApprovalReceiptIds('REQUEST');
export const reserveRegisteredPreparationApprovalDecisionReceiptIds=()=>reserveRegisteredApprovalReceiptIds('DECISION');
export function isRegisteredPreparationApprovalReceiptIds(value:unknown,purpose:'REQUEST'|'DECISION'):value is RegisteredPreparationReceiptIds{return !!value&&typeof value==='object'&&registeredApprovalReceiptReservations.get(value)===purpose;}
export interface NodeDecisionReceiptIds extends RegisteredPreparationReceiptIds {readonly transactionId:string}
type NodeReceiptState={db:PoolClient;query:PoolClient['query'];actor:AuthenticatedIdentity;actorId:string;clientId:string;generation:number;sessionId:string;requestHash:string;used:boolean};
const nodeReceiptReservations=new WeakMap<object,NodeReceiptState>();
/** 권한을 발급하지 않고 원 FN10 요청의 내부 식별자만 미리 고정한다. */
export async function reserveNodeDecisionReceiptIds(db:PoolClient,actor:AuthenticatedIdentity,request:ProjectCommand):Promise<NodeDecisionReceiptIds>{
 if(!['recordNodeDecision','revokeNodeDecision'].includes(request.operation)||request.clientId!==actor.clientId||request.approvalRef!==null||!uuidV1(actor.authSession?.id))throw new AuthFailure('NODE_DECISION_RECEIPT_INVALID',422);
 const query=db.query,row=(await db.query('SELECT txid_current()::text AS transaction_id')).rows[0];
 if(db.query!==query||!row||!/^[1-9][0-9]{0,18}$/.test(row.transaction_id))throw new AuthFailure('NODE_DECISION_OUTCOME_UNKNOWN',503);
 const ids=Object.freeze({serverCommandId:randomUUID(),consumptionId:randomUUID(),operationId:randomUUID(),authorizationReceiptId:randomUUID(),auditEventId:randomUUID(),transactionId:row.transaction_id});
 nodeReceiptReservations.set(ids,{db,query,actor,actorId:actor.actorId,clientId:actor.clientId,generation:actor.credentialGeneration,sessionId:actor.authSession!.id,requestHash:contentHash(canonicalJson(request)),used:false});return ids;
}
export function isNodeDecisionReceiptIds(value:unknown,db:PoolClient,actor:AuthenticatedIdentity,request:ProjectCommand):value is NodeDecisionReceiptIds{
 if(!value||typeof value!=='object')return false;const s=nodeReceiptReservations.get(value);
 return !!s&&!s.used&&s.db===db&&s.query===db.query&&s.actor===actor&&s.actorId===actor.actorId&&s.clientId===actor.clientId&&s.generation===actor.credentialGeneration&&s.sessionId===actor.authSession?.id&&s.requestHash===contentHash(canonicalJson(request));
}
export interface ExecutionStartOriginReceiptIds extends RegisteredPreparationReceiptIds {readonly transactionId:string}
type OriginReceiptState={db:PoolClient;query:PoolClient['query'];actor:AuthenticatedIdentity;identity:string;requestHash:string;used:boolean;start?:{lease:OriginReuseStartLease;matches:typeof import('../executions/execution-start-origin-reuse.ts').originReuseStartMatches}};
const originReceiptReservations=new WeakMap<object,OriginReceiptState>();
const originReceiptIdentity=(actor:AuthenticatedIdentity)=>canonicalJson({actorId:actor.actorId,clientId:actor.clientId,credentialGeneration:actor.credentialGeneration,session:actor.authSession});
/** 같은 원자료 저장 Tx의 내부 ID만 고정한다. 실행 허가나 credential을 발급하지 않는다. */
export async function reserveExecutionStartOriginReceiptIds(db:PoolClient,actor:AuthenticatedIdentity,raw:ProjectCommand):Promise<ExecutionStartOriginReceiptIds>{
 const request=copyControlData(raw,2097152) as ProjectCommand,query=db.query,identity=originReceiptIdentity(actor);
 if(request.operation!=='registerExecutionStartOrigin'||request.clientId!==actor.clientId||request.approvalRef!==null||!uuidV1(actor.authSession?.id))throw new AuthFailure('EXECUTION_START_ORIGIN_RECEIPT_INVALID',422);
 const rows=(await db.query('SELECT txid_current()::text AS transaction_id')).rows;
 if(db.query!==query||originReceiptIdentity(actor)!==identity||rows.length!==1||typeof rows[0]?.transaction_id!=='string'||!/^[1-9][0-9]{0,18}$/.test(rows[0].transaction_id))throw new AuthFailure('EXECUTION_START_ORIGIN_OUTCOME_UNKNOWN',503);
 const ids=Object.freeze({serverCommandId:randomUUID(),consumptionId:randomUUID(),operationId:randomUUID(),authorizationReceiptId:randomUUID(),auditEventId:randomUUID(),transactionId:rows[0].transaction_id});
 originReceiptReservations.set(ids,{db,query,actor,identity,requestHash:contentHash(canonicalJson(request)),used:false});return ids;
}
export function isExecutionStartOriginReceiptIds(value:unknown,db:PoolClient,actor:AuthenticatedIdentity,request:ProjectCommand):value is ExecutionStartOriginReceiptIds{
 if(!value||typeof value!=='object')return false;const s=originReceiptReservations.get(value);
 return !!s&&!s.used&&request.operation==='registerExecutionStartOrigin'&&s.db===db&&s.query===db.query&&s.actor===actor&&s.identity===originReceiptIdentity(actor)&&s.requestHash===contentHash(canonicalJson(copyControlData(request,2097152)));
}
export interface OriginReuseRequestReceiptIds extends RegisteredPreparationReceiptIds {readonly transactionId:string}
export interface OriginReuseConsumptionReceiptIds extends OriginReuseRequestReceiptIds {readonly writerClaimId:string;readonly outboxId:string}
const reuseReceiptReservations=new WeakMap<object,OriginReceiptState>();
export async function reserveOriginReuseRequestReceiptIds(db:PoolClient,actor:AuthenticatedIdentity,request:ProjectCommand):Promise<OriginReuseRequestReceiptIds>{
 const live=originReuseObservationContexts.get(db),query=db.query,identity=originReceiptIdentity(actor);
 if(!live||!matchesOriginReuseObservationContext(live.access,db,actor,request,live.transactionId))throw new AuthFailure('ORIGIN_REUSE_APPROVAL_NOT_CONNECTED',412);
 const rows=(await Reflect.apply(query,db,['SELECT txid_current()::text AS transaction_id'])).rows;
 if(rows.length!==1||rows[0]?.transaction_id!==live.transactionId||db.query!==query||identity!==originReceiptIdentity(actor))throw new AuthFailure('ORIGIN_REUSE_REQUEST_OUTCOME_UNKNOWN',503);
 const ids=Object.freeze({serverCommandId:randomUUID(),consumptionId:randomUUID(),operationId:randomUUID(),authorizationReceiptId:randomUUID(),auditEventId:randomUUID(),transactionId:live.transactionId!});
 reuseReceiptReservations.set(ids,{db,query,actor,identity,requestHash:contentHash(canonicalJson(request)),used:false});return ids;
}
export function isOriginReuseRequestReceiptIds(value:unknown,db:PoolClient,actor:AuthenticatedIdentity,request:ProjectCommand):value is OriginReuseRequestReceiptIds{
 if(!value||typeof value!=='object')return false;const s=reuseReceiptReservations.get(value);
 return !!s&&!s.used&&s.db===db&&s.query===db.query&&s.actor===actor&&s.identity===originReceiptIdentity(actor)
  &&(isOriginReuseObservationRequest(request)||request.operation==='decideApproval'||request.operation==='queueExecutionCommand'&&!!s.start&&s.start.matches(s.start.lease,db,actor,request))&&s.requestHash===contentHash(canonicalJson(request));
}
/** 원 queue 인증 콜백의 목적 lease만 내부 식별자를 예약한다. */
export async function reserveOriginReuseConsumptionReceiptIds(db:PoolClient,actor:AuthenticatedIdentity,request:ProjectCommand,lease:OriginReuseStartLease):Promise<OriginReuseConsumptionReceiptIds>{
 const query=db.query,identity=originReceiptIdentity(actor),requestHash=contentHash(canonicalJson(copyControlData(request,2097152)));
 const {originReuseStartMatches,originReuseStartState}=await import('../executions/execution-start-origin-reuse.ts');
 if(query!==db.query||identity!==originReceiptIdentity(actor)||requestHash!==contentHash(canonicalJson(copyControlData(request,2097152))))throw new AuthFailure('ORIGIN_REUSE_REQUEST_OUTCOME_UNKNOWN',503);
 if(!originReuseStartMatches(lease,db,actor,request)||request.operation!=='queueExecutionCommand')throw new AuthFailure('ORIGIN_REUSE_START_NOT_CONNECTED',412);
 const observed=await originReuseStartState(lease,db,actor,request);
 const rows=(await Reflect.apply(query,db,['SELECT txid_current()::text AS transaction_id'])).rows;await originReuseStartState(lease,db,actor,request);if(rows.length!==1||rows[0]?.transaction_id!==observed.transactionId||query!==db.query||identity!==originReceiptIdentity(actor)||requestHash!==contentHash(canonicalJson(copyControlData(request,2097152)))||!originReuseStartMatches(lease,db,actor,request))throw new AuthFailure('ORIGIN_REUSE_REQUEST_OUTCOME_UNKNOWN',503);
 const ids=Object.freeze({serverCommandId:randomUUID(),consumptionId:randomUUID(),operationId:randomUUID(),authorizationReceiptId:randomUUID(),auditEventId:randomUUID(),writerClaimId:randomUUID(),outboxId:randomUUID(),transactionId:rows[0].transaction_id});reuseReceiptReservations.set(ids,{db,query,actor,identity,requestHash,used:false,start:{lease,matches:originReuseStartMatches}});return ids;
}
export async function persistProjectReceipt(db: PoolClient, actor: AuthenticatedIdentity, request: ProjectCommand, ref: VersionRef | { artifactId: string; bytes: number; contentHash: string; mediaType: string }, data: Record<string, unknown>, policyRef: VersionRef | null, reasonCode: string, reserved?:ActivationReceiptIds) {
  const documentContext=consumeFn15DocumentContext(db,actor,request);
  const nodeIds=isNodeDecisionReceiptIds(reserved,db,actor,request)?reserved:null;
  if(nodeIds)nodeReceiptReservations.get(nodeIds)!.used=true;
  const originIds=isExecutionStartOriginReceiptIds(reserved,db,actor,request)?reserved:null;
  const reuseIds=isOriginReuseRequestReceiptIds(reserved,db,actor,request)?reserved:null;
  if((isOriginReuseObservationRequest(request)||request.operation==='queueExecutionCommand'&&Object.hasOwn(request.payload,'originReuse'))&&!reuseIds)throw new AuthFailure('ORIGIN_REUSE_APPROVAL_NOT_CONNECTED',412);
  const reuseState=reuseIds?reuseReceiptReservations.get(reuseIds)!:null;
  const receiptQuery=async(sql:string,args?:unknown[])=>{
    if(!reuseState)return db.query(sql,args);
    const check=()=>{if(reuseState.query!==db.query||reuseState.identity!==originReceiptIdentity(actor))throw new AuthFailure('ORIGIN_REUSE_REQUEST_OUTCOME_UNKNOWN',503);};
    check();const result=await Reflect.apply(reuseState.query,db,[sql,args]);check();return result;
  };
  if(reuseState)reuseState.used=true;
  if(request.operation==='registerExecutionStartOrigin'&&!originIds)throw new AuthFailure('EXECUTION_START_ORIGIN_RECEIPT_INVALID',422);
  if(originIds){const query=db.query,rows=(await db.query('SELECT txid_current()::text AS transaction_id')).rows;if(db.query!==query||rows.length!==1||rows[0]?.transaction_id!==originIds.transactionId||!isExecutionStartOriginReceiptIds(originIds,db,actor,request))throw new AuthFailure('EXECUTION_START_ORIGIN_OUTCOME_UNKNOWN',503);originReceiptReservations.get(originIds)!.used=true;}
  const registeredPurpose=isRegisteredPreparationReceiptIds(reserved)?'PREPARE':isRegisteredPreparationApprovalReceiptIds(reserved,'REQUEST')?'REQUEST':isRegisteredPreparationApprovalReceiptIds(reserved,'DECISION')?'DECISION':null;
  const registeredIds=registeredPurpose?reserved as RegisteredPreparationReceiptIds:null;
  if(registeredIds){
    const valid=registeredPurpose==='PREPARE'?request.operation==='prepareExecution'&&request.payload.connectionKind==='REGISTERED_DEFINITION'&&request.payload.optionsFormat==='CLAUDE_QUERY_DATA_V1':registeredPurpose==='REQUEST'?request.operation==='requestApproval'&&(request.payload.candidatePayload as any)?.connectionKind==='REGISTERED_DEFINITION'&&(request.payload.details as any)?.actionScope?.operation==='prepareExecution':request.operation==='decideApproval';
    if(!valid)throw new AuthFailure('EXECUTION_PREPARATION_RECEIPT_RESERVATION_INVALID',422);
    registeredPreparationReceiptReservations.delete(registeredIds);registeredApprovalReceiptReservations.delete(registeredIds);
  }else if(!nodeIds&&!originIds&&!reuseIds){
    if(reserved&&(request.operation!=='activateDesignChange'||request.approvalRef===null||!activationReservations.has(reserved)))throw new AuthFailure('ACTIVATION_RECEIPT_RESERVATION_INVALID',422);
    if(reserved)activationReservations.delete(reserved);
  }
  const id = reserved?.serverCommandId??randomUUID(), operationId = (reuseIds??originIds??nodeIds??registeredIds)?.operationId??randomUUID(), receiptId = (reuseIds??originIds??nodeIds??registeredIds)?.authorizationReceiptId??randomUUID();
  const approval=request.approvalRef===null?null:readApprovalRef(request.approvalRef),consumptionId=approval?(reserved?.consumptionId??randomUUID()):null,payloadRef=approval?{kind:'ONE_TIME_APPROVAL_SCOPE',payloadHash:contentHash(canonicalJson(request.payload)),scopeDigest:approval.scopeDigest}:null;
  const result = { operationId, commandId: request.commandId, projectId: request.projectId, status: 'APPLIED', targetId: 'id' in ref ? ref.id : ref.artifactId, version: 'version' in ref ? ref.version : null, data: { ...('id' in ref ? { ref } : { artifactRef: ref }), ...data }, evidenceRefs: [], warnings: [], serverReceivedAt: (await receiptQuery('SELECT transaction_timestamp() AS at')).rows[0].at.toISOString() };
  const scopeDigest = contentHash(canonicalJson({ projectId: request.projectId, actorId: actor.actorId, clientId: actor.clientId, controlGeneration: request.controlGeneration, requestHash: contentHash(canonicalJson(request)), policyRef, targetRef: ref }));
  await receiptQuery("INSERT INTO anvil.commands(id,scope_kind,scope_id,project_id,actor_id,client_id,operation,command_id,request_hash,operation_id,state,authorization_receipt_id,approval_consumption_id,expected_version,control_generation,policy_ref,payload_ref,result_ref,completed_at) VALUES($1,'PROJECT',$2,$2,$3,$4,$5,$6,$7,$8,'APPLIED',$9,$10,$11,$12,$13,$14,$15,now())", [id, request.projectId, actor.actorId, actor.clientId, request.operation, request.commandId, contentHash(canonicalJson(request)), operationId, receiptId, consumptionId, request.expectedVersion, request.controlGeneration, policyRef ? JSON.stringify(policyRef) : null, payloadRef?JSON.stringify(payloadRef):null, JSON.stringify(result)]);
  await receiptQuery("INSERT INTO anvil.authorization_receipts(id,scope_kind,scope_id,command_id,subject_ref,policy_ref,scope_digest,approval_decision_ref) VALUES($1,'PROJECT',$2,$3,$4,$5,$6,$7)", [receiptId, request.projectId, id, JSON.stringify({ kind: 'HUMAN', userId: actor.actorId, clientId: actor.clientId }), policyRef ? JSON.stringify(policyRef) : null, scopeDigest,approval?.decisionId??null]);
  await receiptQuery("INSERT INTO anvil.audit_events(project_id,server_sequence,event_id,actor_ref,client_ref,command_id,operation_id,target_ref,policy_ref,approval_ref,outcome,reason_code,scope_digest,source_kind) SELECT $1,COALESCE(MAX(server_sequence),0)+1,$2,$3,$4,$5,$6,$7,$8,$9,'APPLIED',$10,$11,'HUMAN_COMMAND' FROM anvil.audit_events WHERE project_id=$1", [request.projectId, (reuseIds??originIds??nodeIds??registeredIds)?.auditEventId??randomUUID(), JSON.stringify({ kind: 'HUMAN', userId: actor.actorId }), actor.clientId, id, operationId, JSON.stringify(ref), policyRef ? JSON.stringify(policyRef) : null, approval?JSON.stringify(approval):null,reasonCode, scopeDigest]);
  if(documentContext!==null)await receiptQuery("SELECT set_config('anvil.actor_id',$1,true),set_config('anvil.client_id',$2,true),set_config('anvil.command_id',$3,true),set_config('anvil.fn15_document_context',$4,true)",[actor.actorId,actor.clientId,id,documentContext]);
  else await receiptQuery("SELECT set_config('anvil.actor_id',$1,true),set_config('anvil.client_id',$2,true),set_config('anvil.command_id',$3,true)", [actor.actorId, actor.clientId, id]);
  if(approval&&consumptionId){if(!policyRef)throw new AuthFailure('APPROVAL_POLICY_REQUIRED',412);await new ProjectApprovals(reserved?.documents).consume(db,actor,request,policyRef,id,consumptionId);}
  // 실행 봉투는 실제 저장된 receipt의 불변 scope digest를 참조한다. 일반 API result의 의미는 바꾸지 않는다.
  return { result, id, authorizationReceiptRef: {id:receiptId,version:1,contentHash:scopeDigest} };
}
export async function recordProjectDenial(access: AccessRepository, token: string, projectId: string, error: unknown) {
  if (!(error instanceof AuthFailure) || error.statusCode < 400 || error.statusCode >= 500 || error.statusCode === 404 || error.statusCode === 401) return;
  await access.authenticated(token, null, async (db, actor) => {
    await projectMember(db, actor, projectId, true);
    await db.query("INSERT INTO anvil.audit_events(project_id,server_sequence,event_id,actor_ref,client_ref,target_ref,outcome,reason_code,source_kind) SELECT $1,COALESCE(MAX(server_sequence),0)+1,$2,$3,$4,$5,'DENIED',$6,'SERVER_DENIAL' FROM anvil.audit_events WHERE project_id=$1", [projectId, randomUUID(), JSON.stringify({ kind: 'HUMAN', userId: actor.actorId }), actor.clientId, JSON.stringify({ id: projectId }), error.message]);
  });
}
export class ProjectPolicyRepository {
  #access: AccessRepository;#documents?:ProjectDocuments;
  constructor(access: AccessRepository,documents?:ProjectDocuments) { this.#access = access;this.#documents=documents; }
  /** 파일 handler의 원 replay/IO 순서를 보존한다. DB/actor/session은 실제 인증 callback에서만 받는다. */
  async uploadTransaction<T>(token:string,csrf:string,request:ProjectCommand,work:(db:PoolClient,actor:AuthenticatedIdentity)=>Promise<T>):Promise<T>{
    const fixed=copyControlData(request,2097152);if(fixed.operation!=='uploadArtifact')throw new AuthFailure('PROJECT_OPERATION_DENIED',403);
    return this.#access.authenticated(token,csrf,(db,actor)=>withFn15DocumentContext(db,actor,fixed,()=>work(db,actor)));
  }
  async read(token: string, projectId: string) {
    return this.#access.authenticated(token, null, async (db, actor) => { await projectMember(db, actor, projectId); const policy = await currentPolicy(db, projectId); return { configured: !!policy, policy }; });
  }
  /** HUMAN 내용 두 operation만의 보호 소비선. 일반 replay는 원형을 유지한다. */
  async assignmentContentCommand(token:string,csrf:string,request:ProjectCommand,contents:ProjectAssignmentConfirmations) {
    if(!['reviewAssignmentContent','confirmAssignment'].includes(request.operation))throw new AuthFailure('PROJECT_OPERATION_DENIED',403);
    const original=cloneV1(request);
    try{return await this.#access.authenticated(token,csrf,async(db,actor)=>{
      await currentProjectController(db,actor,original);
      const policy=await authorizeMaterial(db,actor,original,false,this.#documents);
      const check=async()=>{
        await currentProjectController(db,actor,original);
        const current=await authorizeMaterial(db,actor,original,false,this.#documents);
        const at=(await db.query('SELECT clock_timestamp() AS at')).rows[0]?.at,session=actor.authSession;
        if(!(at instanceof Date)||!Number.isFinite(at.getTime())||!session||!uuidV1(session.id)||!isoV1(session.idleExpiresAt)||!isoV1(session.absoluteExpiresAt)||Math.min(Date.parse(session.idleExpiresAt),Date.parse(session.absoluteExpiresAt))<=at.getTime())throw new AuthFailure('AUTH_REQUIRED',401);
        if(!Number.isFinite(policy.validUntil)||Math.min(policy.validUntil,current.validUntil)<=at.getTime()||canonicalJson(policy.ref)!==canonicalJson(current.ref))throw new AuthFailure('PROJECT_OPERATION_DENIED',403);
      };
      await check();
      const previous=await projectReplay(db,actor,original);
      const result=previous!==undefined?await contents.replayContent(db,actor,original,previous):original.operation==='reviewAssignmentContent'?await contents.reviewContent(db,actor,original,policy.ref):await contents.confirmContent(db,actor,original,policy.ref);
      await check();return result;
    });}catch(error){await recordProjectDenial(this.#access,token,original.projectId,error);throw error;}
  }
  async command(token: string, csrf: string, request: ProjectCommand, material?: (db: PoolClient, actor: AuthenticatedIdentity, policyRef: VersionRef, deadline?:number) => Promise<unknown>, registeredPreparationReplay?: (db:PoolClient,actor:AuthenticatedIdentity,request:ProjectCommand,result:unknown)=>Promise<void>, originReuseCapability?: import('../executions/execution-start-origin-reuse.ts').OriginReuseApprovalCapability) {
    const observeReuse=isOriginReuseObservationRequest(request),inspectReuseDecision=request.operation==='decideApproval'&&originReuseCapability!==undefined,boundReuse=observeReuse||inspectReuseDecision;
    if(boundReuse){
      if(!originReuseAuthenticationMatches(this.#access))throw new AuthFailure('ORIGIN_REUSE_APPROVAL_NOT_CONNECTED',412);
      request=copyControlData(request,2097152);
    }
    let exportDeadline=performance.now()+30000,exportStarted=false;
    let notificationDeadline=Infinity,notificationPolicyDeadline=Infinity;
    try {
      const commandInTransaction=(db:PoolClient,actor:AuthenticatedIdentity)=>withFn15DocumentContext(db,actor,request,async()=>{
        const observationQuery=boundReuse?db.query:undefined;
        if(boundReuse&&!originReuseAuthenticationMatches(this.#access))throw new AuthFailure('ORIGIN_REUSE_APPROVAL_NOT_CONNECTED',412);
        let transactionId:string|undefined;
        if(observationQuery&&originReuseCapability!==undefined){
          const {rows}=await Reflect.apply(observationQuery,db,['SELECT pg_current_xact_id_if_assigned()::text AS transaction_id, clock_timestamp() AS auth_observed_at']);
          const xid=rows[0]?.transaction_id;
          if(db.query!==observationQuery||!originReuseAuthenticationMatches(this.#access)||rows.length!==1||typeof xid!=='string'||!/^[1-9][0-9]*$/.test(xid))throw new AuthFailure('ORIGIN_REUSE_APPROVAL_NOT_CONNECTED',412);
          transactionId=xid;
        }
        await currentGeneralProjectController(db, actor, request);
        if(request.operation==='saveProjectMembership'&&(!actor.reauthUntil||actor.reauthUntil.getTime()<=Date.now()))throw new AuthFailure('REAUTHENTICATION_REQUIRED',412);
        if (request.operation !== 'savePermissionPolicy') {
          const policy = await authorizeMaterial(db, actor, request,false,this.#documents);
          const checkExportDeadline=async()=>{if(request.operation!=='exportProject')return;const before=performance.now(),at=(await db.query('SELECT clock_timestamp() AS at')).rows[0]?.at;exportDeadline=Math.min(exportDeadline,notificationSessionDeadline(actor,at,before),before+policy.validUntil-at.getTime());if(performance.now()>=exportDeadline)throw new AuthFailure('EXPORT_TIME_LIMIT',503);};
          await checkExportDeadline();
          const checkCheckpoint=async()=>{if(request.operation!=='saveCheckpoint')return;await currentProjectController(db,actor,request);const current=await authorizeMaterial(db,actor,request,false,this.#documents),at=(await db.query('SELECT clock_timestamp() AS at')).rows[0]?.at,s=actor.authSession;
            if(!(at instanceof Date)||!Number.isFinite(at.getTime())||!s||!uuidV1(s.id)||!isoV1(s.idleExpiresAt)||!isoV1(s.absoluteExpiresAt)||!Number.isFinite(current.validUntil)||Math.min(current.validUntil,Date.parse(s.idleExpiresAt),Date.parse(s.absoluteExpiresAt))<=at.getTime())throw new AuthFailure('CHECKPOINT_CURRENT_REQUIRED',409);
            if(request.baselineRefs.length||request.approvalRef!==null)throw new AuthFailure('CHECKPOINT_INPUT_INVALID',422);
          };await checkCheckpoint();
          const previous = await projectReplay(db, actor, request);
          let reuseDecision=false;
          if(inspectReuseDecision){
            if(!observationQuery||db.query!==observationQuery)throw new AuthFailure('ORIGIN_REUSE_APPROVAL_NOT_CONNECTED',412);
            const beforePurpose=await Reflect.apply(observationQuery,db,['SELECT pg_current_xact_id_if_assigned()::text AS transaction_id, clock_timestamp() AS auth_observed_at']);
            if(db.query!==observationQuery||beforePurpose.rows.length!==1||beforePurpose.rows[0]?.transaction_id!==transactionId)throw new AuthFailure('ORIGIN_REUSE_APPROVAL_NOT_CONNECTED',412);
            const target=await Reflect.apply(observationQuery,db,['SELECT action_scope_json FROM anvil.approval_requests WHERE project_id=$1 AND id=$2 FOR UPDATE',[request.projectId,request.targetId]]);
            if(db.query!==observationQuery||!originReuseAuthenticationMatches(this.#access))throw new AuthFailure('ORIGIN_REUSE_APPROVAL_NOT_CONNECTED',412);
            reuseDecision=target.rows.length===1&&target.rows[0]?.action_scope_json?.operation==='queueExecutionCommand';
          }
          if(observeReuse||reuseDecision){
            if(!observationQuery||db.query!==observationQuery||!originReuseAuthenticationMatches(this.#access)||originReuseObservationContexts.has(db))throw new AuthFailure('ORIGIN_REUSE_APPROVAL_NOT_CONNECTED',412);
            const {observeOriginReuseApprovalRequest}=await import('../executions/execution-start-origin-reuse.ts');
            if(db.query!==observationQuery||!originReuseAuthenticationMatches(this.#access)||originReuseObservationContexts.has(db))throw new AuthFailure('ORIGIN_REUSE_APPROVAL_NOT_CONNECTED',412);
            originReuseObservationContexts.set(db,{access:this.#access,query:observationQuery,transactionId});
            try{return await observeOriginReuseApprovalRequest(originReuseCapability,this.#access,db,actor,request,policy.ref,previous);}
            finally{originReuseObservationContexts.delete(db);}
          }
          const checkNotificationDeadline=async()=>{
            if(request.operation!=='markNotificationRead')return;
            const before=performance.now(),at=(await db.query('SELECT clock_timestamp() AS at')).rows[0]?.at;
            notificationDeadline=Math.min(notificationDeadline,notificationSessionDeadline(actor,at,before));
            // 최종 DB 시각에도 같은 주체/operation/project의 현재 규칙만 대조한다.
            // 복수 AUTO 중 하나의 만료가 다른 유효 AUTO까지 회수하지 않는다.
            const matched=policy.rules.filter(rule=>rule.subjectRef.kind==='HUMAN'&&rule.subjectRef.userId===actor.actorId&&rule.targetScopes.some(scope=>scope.kind==='PROJECT'&&scope.projectId===request.projectId)&&rule.operations.includes(request.operation)&&Date.parse(rule.expiresAt)>at.getTime());
            if(!matched.length||matched.some(rule=>rule.disposition==='DENY'))throw new AuthFailure('PROJECT_OPERATION_DENIED',403);
            if(matched.some(rule=>rule.disposition==='REQUIRE_APPROVAL'))throw new AuthFailure('NOTIFICATION_READ_APPROVAL_NOT_CONNECTED',412);
            const validUntil=Math.max(...matched.map(rule=>Date.parse(rule.expiresAt)));
            notificationPolicyDeadline=Math.min(notificationPolicyDeadline,before+validUntil-at.getTime());
            if(!Number.isFinite(notificationPolicyDeadline)||performance.now()>=notificationPolicyDeadline)throw new AuthFailure('PROJECT_OPERATION_DENIED',403);
          };
          await checkNotificationDeadline();
          if (previous !== undefined){await checkCheckpoint();if(request.operation==='saveProjectMembership')await new ProjectMemberships().verifyReplay(db,actor,request,previous);
            if(request.operation==='prepareExecution' && request.payload.connectionKind==='REGISTERED_DEFINITION'){
              if(!registeredPreparationReplay)throw new AuthFailure('SOURCE_VERIFIER_NOT_CONNECTED',412);
              const result=await registeredPreparationReplay(db,actor,JSON.parse(canonicalJson(request)),JSON.parse(canonicalJson(previous)));
              if(result!==undefined)throw new AuthFailure('EXECUTION_PREPARATION_INTEGRITY_FAILED',503);
            }
            return previous;}
          if (request.baselineRefs.length&&(request.operation!=='activateDesignChange'||request.baselineRefs.length!==1||!isVersionRef(request.baselineRefs[0]))) throw new AuthFailure('REFERENCE_CONNECTION_PENDING', 412);
          if (!material) throw new AuthFailure('PROJECT_OPERATION_NOT_READY', 412);
          if(request.operation==='exportProject'){exportStarted=true;await db.query("SELECT set_config('anvil.export_payload',$1,true)",[canonicalJson(request.payload)]);}
          const applied=await material(db, actor, policy.ref,request.operation==='exportProject'?exportDeadline:undefined);
          if(isOrdinaryControlOperation(request.operation)){await currentGeneralProjectController(db,actor,request);const finalPolicy=await authorizeMaterial(db,actor,request,false,this.#documents);if(canonicalJson(finalPolicy.ref)!==canonicalJson(policy.ref))throw new AuthFailure('PROJECT_OPERATION_DENIED',403);}
          await checkExportDeadline();
          await checkNotificationDeadline();await checkCheckpoint();return applied;
        }
        if (!actor.reauthUntil || actor.reauthUntil.getTime() <= Date.now()) throw new AuthFailure('REAUTHENTICATION_REQUIRED', 412);
        const previous = await projectReplay(db, actor, request); if (previous !== undefined) return previous;
        if (request.baselineRefs.length || request.approvalRef !== null) throw new AuthFailure('REFERENCE_CONNECTION_PENDING', 412);
        const p = request.payload;
        if (!exact(p, ['rules', 'reason', 'reviewRefs']) || typeof p.reason !== 'string' || !p.reason.trim() || p.reason.length > 20_000 || !Array.isArray(p.reviewRefs)) throw new AuthFailure('INPUT_INVALID', 422);
        if (p.reviewRefs.length) throw new AuthFailure('REVIEW_ARTIFACT_STORAGE_NOT_READY', 412);
        const rules = materialRules(p.rules, request.projectId, actor.actorId), current = await currentPolicy(db, request.projectId);
        if (current ? request.targetId !== current.ref.id || request.expectedVersion !== current.ref.version : request.targetId !== null || request.expectedVersion !== 0) throw new AuthFailure('VERSION_CONFLICT', 409);
        // 같은 project/control 잠금 안에서 현재 예산을 확인한다. 문서 PROJECT/null 규칙에는 적용하지 않는다.
        if (rules.some(rule => rule.limitPolicyRef !== null)) {
          const { ProjectLimitPolicies } = await import('../executions/runtime-policy.ts');
          const budgets = new ProjectLimitPolicies();
          for (const rule of rules) if (rule.limitPolicyRef !== null) {
            const budget = await budgets.resolveCurrent(db, actor, request.projectId, rule.limitPolicyRef, {kind:'PROJECT',projectId:request.projectId});
            if (Date.parse(rule.expiresAt) > Date.parse(budget.snapshot.expiresAt)) throw new AuthFailure('RUNTIME_POLICY_EXCEEDS_BUDGET_EXPIRY', 422);
          }
        }
        const version = request.expectedVersion + 1, id = current?.ref.id ?? randomUUID();
        if (!Number.isSafeInteger(version)) throw new AuthFailure('VERSION_CONFLICT', 409);
        const ref = { id, version, contentHash: contentHash(canonicalJson({ rules, reason: p.reason, reviewRefs: [] })) };
        const receipt = await persistProjectReceipt(db, actor, request, ref, { status: 'POLICY_SAVED' }, current?.ref ?? null, current ? 'EXPLICIT_POLICY_REVISION' : 'OWNER_REAUTHENTICATED_INITIAL_POLICY');
        this.#access.installationKeyRegistry?.invalidateProject(request.projectId);
        if (!current) await db.query('INSERT INTO anvil.permission_policies(id,project_id,head_version,created_by) VALUES($1,$2,1,$3)', [id, request.projectId, actor.actorId]);
        else await db.query('UPDATE anvil.permission_policies SET head_version=$2 WHERE id=$1', [id, version]);
        await db.query('INSERT INTO anvil.permission_policy_versions(project_id,policy_id,version,rules_json,content_hash,reason,review_refs,created_by,client_id,command_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [request.projectId, id, version, JSON.stringify(rules), ref.contentHash, p.reason, '[]', actor.actorId, actor.clientId, receipt.id]);
        return receipt.result;
      });
      const result=await (boundReuse
        ?originReuseAuthentication.bind(this.#access)(token,csrf,commandInTransaction)
        :this.#access.authenticated(token,csrf,commandInTransaction));
      // COMMIT 뒤 기한 초과는 이미 반영됐을 수 있다. 새 명령 대신 재인증 후 원 commandId로 조정한다.
      if(request.operation==='exportProject'&&performance.now()>=exportDeadline)throw new AuthFailure('EXPORT_RESULT_UNCERTAIN',503);
      if(request.operation==='markNotificationRead'&&(performance.now()>=notificationDeadline||performance.now()>=notificationPolicyDeadline))throw new AuthFailure('NOTIFICATION_READ_RESULT_UNCERTAIN',503);
      return result;
    } catch (error) {
      if(request.operation==='exportProject'&&exportStarted&&(!(error instanceof AuthFailure)||performance.now()>=exportDeadline))throw new AuthFailure('EXPORT_RESULT_UNCERTAIN',503);
      // 보이는 프로젝트의 거절만 별도 transaction에 남긴다. 도메인 rollback과 분리한다.
      await recordProjectDenial(this.#access, token, request.projectId, error);
      throw error;
    }
  }
}
