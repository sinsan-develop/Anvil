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
export const documentOperations = ['saveCheckpoint', 'recordCapabilityReport', 'uploadArtifact', 'startStage', 'cancelQueuedRequest', 'saveDocumentDraft', 'detachDocumentSource', 'recordContentReview', 'confirmDocument', 'proposeDocumentChange', 'importDocument', 'indexDesignDocument', 'saveWorkPlanDraft', 'confirmWorkPlan', 'proposeDesignChange', 'reviewChangeImpact', 'activateDesignChange', 'linkTrace', 'requestKnowledgeShare', 'saveKnowledge', 'appendConversation', 'correctKnowledge', 'excludeKnowledge', 'confirmKnowledge', 'applyConstitution', 'requestApproval', 'decideApproval', 'copyMethodology', 'saveMethodologyDraft', 'confirmMethodology', 'applyMethodology', ...candidateOperations, ...trustRegistrationOperations, ...sourceRootOperations, ...sourceReadOperations, ...assignmentDraftOperations, ...assignmentConfirmationOperations, ...contextPreparationOperations, ...baselineOperations, 'defineProjectRole', 'bindResponsibleSession', 'prepareExecution', 'applyLimitPolicy', 'revokeLimitPolicy','reviewUnderstanding','submitResult','saveResultCriteria','evaluateResult','requestRework','markNotificationRead','exportProject','saveBackupReference','revokeBackupReference','manageBackupResource'] as const;
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
export async function persistProjectReceipt(db: PoolClient, actor: AuthenticatedIdentity, request: ProjectCommand, ref: VersionRef | { artifactId: string; bytes: number; contentHash: string; mediaType: string }, data: Record<string, unknown>, policyRef: VersionRef | null, reasonCode: string, reserved?:ActivationReceiptIds) {
  if(reserved&&(request.operation!=='activateDesignChange'||request.approvalRef===null||!activationReservations.has(reserved)))throw new AuthFailure('ACTIVATION_RECEIPT_RESERVATION_INVALID',422);
  if(reserved)activationReservations.delete(reserved);
  const id = reserved?.serverCommandId??randomUUID(), operationId = randomUUID(), receiptId = randomUUID();
  const approval=request.approvalRef===null?null:readApprovalRef(request.approvalRef),consumptionId=approval?(reserved?.consumptionId??randomUUID()):null,payloadRef=approval?{kind:'ONE_TIME_APPROVAL_SCOPE',payloadHash:contentHash(canonicalJson(request.payload)),scopeDigest:approval.scopeDigest}:null;
  const result = { operationId, commandId: request.commandId, projectId: request.projectId, status: 'APPLIED', targetId: 'id' in ref ? ref.id : ref.artifactId, version: 'version' in ref ? ref.version : null, data: { ...('id' in ref ? { ref } : { artifactRef: ref }), ...data }, evidenceRefs: [], warnings: [], serverReceivedAt: (await db.query('SELECT transaction_timestamp() AS at')).rows[0].at.toISOString() };
  const scopeDigest = contentHash(canonicalJson({ projectId: request.projectId, actorId: actor.actorId, clientId: actor.clientId, controlGeneration: request.controlGeneration, requestHash: contentHash(canonicalJson(request)), policyRef, targetRef: ref }));
  await db.query("INSERT INTO anvil.commands(id,scope_kind,scope_id,project_id,actor_id,client_id,operation,command_id,request_hash,operation_id,state,authorization_receipt_id,approval_consumption_id,expected_version,control_generation,policy_ref,payload_ref,result_ref,completed_at) VALUES($1,'PROJECT',$2,$2,$3,$4,$5,$6,$7,$8,'APPLIED',$9,$10,$11,$12,$13,$14,$15,now())", [id, request.projectId, actor.actorId, actor.clientId, request.operation, request.commandId, contentHash(canonicalJson(request)), operationId, receiptId, consumptionId, request.expectedVersion, request.controlGeneration, policyRef ? JSON.stringify(policyRef) : null, payloadRef?JSON.stringify(payloadRef):null, JSON.stringify(result)]);
  await db.query("INSERT INTO anvil.authorization_receipts(id,scope_kind,scope_id,command_id,subject_ref,policy_ref,scope_digest,approval_decision_ref) VALUES($1,'PROJECT',$2,$3,$4,$5,$6,$7)", [receiptId, request.projectId, id, JSON.stringify({ kind: 'HUMAN', userId: actor.actorId, clientId: actor.clientId }), policyRef ? JSON.stringify(policyRef) : null, scopeDigest,approval?.decisionId??null]);
  await db.query("INSERT INTO anvil.audit_events(project_id,server_sequence,event_id,actor_ref,client_ref,command_id,operation_id,target_ref,policy_ref,approval_ref,outcome,reason_code,scope_digest,source_kind) SELECT $1,COALESCE(MAX(server_sequence),0)+1,$2,$3,$4,$5,$6,$7,$8,$9,'APPLIED',$10,$11,'HUMAN_COMMAND' FROM anvil.audit_events WHERE project_id=$1", [request.projectId, randomUUID(), JSON.stringify({ kind: 'HUMAN', userId: actor.actorId }), actor.clientId, id, operationId, JSON.stringify(ref), policyRef ? JSON.stringify(policyRef) : null, approval?JSON.stringify(approval):null,reasonCode, scopeDigest]);
  await db.query("SELECT set_config('anvil.actor_id',$1,true),set_config('anvil.client_id',$2,true),set_config('anvil.command_id',$3,true)", [actor.actorId, actor.clientId, id]);
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
  async command(token: string, csrf: string, request: ProjectCommand, material?: (db: PoolClient, actor: AuthenticatedIdentity, policyRef: VersionRef, deadline?:number) => Promise<unknown>) {
    let exportDeadline=performance.now()+30000,exportStarted=false;
    let notificationDeadline=Infinity,notificationPolicyDeadline=Infinity;
    try {
      const result=await this.#access.authenticated(token, csrf, async (db, actor) => {
        await currentProjectController(db, actor, request);
        if (request.operation !== 'savePermissionPolicy') {
          const policy = await authorizeMaterial(db, actor, request,false,this.#documents);
          const checkExportDeadline=async()=>{if(request.operation!=='exportProject')return;const before=performance.now(),at=(await db.query('SELECT clock_timestamp() AS at')).rows[0]?.at;exportDeadline=Math.min(exportDeadline,notificationSessionDeadline(actor,at,before),before+policy.validUntil-at.getTime());if(performance.now()>=exportDeadline)throw new AuthFailure('EXPORT_TIME_LIMIT',503);};
          await checkExportDeadline();
          const checkCheckpoint=async()=>{if(request.operation!=='saveCheckpoint')return;await currentProjectController(db,actor,request);const current=await authorizeMaterial(db,actor,request,false,this.#documents),at=(await db.query('SELECT clock_timestamp() AS at')).rows[0]?.at,s=actor.authSession;
            if(!(at instanceof Date)||!Number.isFinite(at.getTime())||!s||!uuidV1(s.id)||!isoV1(s.idleExpiresAt)||!isoV1(s.absoluteExpiresAt)||!Number.isFinite(current.validUntil)||Math.min(current.validUntil,Date.parse(s.idleExpiresAt),Date.parse(s.absoluteExpiresAt))<=at.getTime())throw new AuthFailure('CHECKPOINT_CURRENT_REQUIRED',409);
            if(request.baselineRefs.length||request.approvalRef!==null)throw new AuthFailure('CHECKPOINT_INPUT_INVALID',422);
          };await checkCheckpoint();
          const previous = await projectReplay(db, actor, request);
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
          if (previous !== undefined){await checkCheckpoint();return previous;}
          if (request.baselineRefs.length&&(request.operation!=='activateDesignChange'||request.baselineRefs.length!==1||!isVersionRef(request.baselineRefs[0]))) throw new AuthFailure('REFERENCE_CONNECTION_PENDING', 412);
          if (!material) throw new AuthFailure('PROJECT_OPERATION_NOT_READY', 412);
          if(request.operation==='exportProject'){exportStarted=true;await db.query("SELECT set_config('anvil.export_payload',$1,true)",[canonicalJson(request.payload)]);}
          const applied=await material(db, actor, policy.ref,request.operation==='exportProject'?exportDeadline:undefined);
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
