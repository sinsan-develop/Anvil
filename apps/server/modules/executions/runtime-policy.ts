import {ProjectApprovals} from '../approvals/project-approvals.ts';
import type {ApprovalScope} from '../approvals/approval-input.ts';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { canonicalJson, contentHash } from '../../../../contracts/canonical.ts';
import type { VersionRef } from '../../../../contracts/generated-types.ts';
import { cloneV1, isoV1, recordV1, refV1, uuidV1 } from '../../../../contracts/runtime/validation-v1.ts';
import { AuthFailure, type AuthenticatedIdentity } from '../access/repository.ts';
import { currentPolicy, currentProjectController, persistProjectReceipt, projectMember, runtimeOperations, type ExecutionRule, type ProjectCommand } from '../access/project-command.ts';
import { readSourceScopesV1, type SourceScopeV1 } from '../../../../contracts/runtime/source-scope-v1.ts';
import { assertKnowledgeTextSafe } from '../knowledge/knowledge-entry.ts';

export interface ExecutionLimits {
  maxAttempts: number; maxElapsedMs: number; maxCalls: number; maxConcurrentAssignments: number;
  maxSpoolBytes: number; maxOfflineMs: number; maxCost?: number; currency?: string;
}
export type LimitScope = { kind: 'PROJECT'; projectId: string }
  | { kind: 'EXECUTION'; projectId: string; executionId: string; generation: number };
export interface LimitPolicyInput { limits: ExecutionLimits; scope: LimitScope; reason: string; policyBaseVersion: number }
export type LimitPolicyRevokeInput = Omit<LimitPolicyInput, 'limits'>;
interface LimitPolicySnapshot extends LimitPolicyInput {
  state: 'APPLIED' | 'REVOKED'; previousRef: VersionRef | null; decidedBy: { kind: 'HUMAN'; userId: string };
  decidedAt: string; expiresAt: string; executionAuthorized: false; dispatchPerformed: false;
}
export interface LimitPolicyRecord { projectId: string; ref: VersionRef; snapshot: LimitPolicySnapshot }

function copied(value: unknown): any {
  try { const bytes = canonicalJson(value); if (Buffer.byteLength(bytes, 'utf8') > 2 * 1024 * 1024) throw Error(); return JSON.parse(bytes); }
  catch { throw new AuthFailure('LIMIT_POLICY_INPUT_INVALID', 422); }
}
const integer = (v: unknown, max: number, min = 1): v is number => Number.isSafeInteger(v) && Number(v) >= min && Number(v) <= max;
function scopeValid(value: unknown): value is LimitScope {
  return recordV1(value, ['kind','projectId']) && value.kind === 'PROJECT' && uuidV1(value.projectId)
    || recordV1(value, ['kind','projectId','executionId','generation']) && value.kind === 'EXECUTION'
      && uuidV1(value.projectId) && uuidV1(value.executionId) && integer(value.generation, Number.MAX_SAFE_INTEGER);
}
function limitsValid(value: unknown): value is ExecutionLimits {
  const keys = ['maxAttempts','maxElapsedMs','maxCalls','maxConcurrentAssignments','maxSpoolBytes','maxOfflineMs'];
  if (!recordV1(value, keys) && !recordV1(value, [...keys,'maxCost','currency'])) return false;
  return integer(value.maxAttempts, 3) && integer(value.maxElapsedMs, 7_200_000) && integer(value.maxCalls, 50)
    && value.maxConcurrentAssignments === 1 && integer(value.maxSpoolBytes, 1_073_741_824) && integer(value.maxOfflineMs, Math.min(300_000, value.maxElapsedMs), 0)
    && (!Object.hasOwn(value, 'maxCost') || typeof value.maxCost === 'number' && Number.isFinite(value.maxCost) && value.maxCost >= 0
      && value.maxCost <= Number.MAX_SAFE_INTEGER && typeof value.currency === 'string' && /^[A-Z]{3}$/.test(value.currency));
}
function readInput(value: unknown, revoke: boolean): LimitPolicyInput | LimitPolicyRevokeInput {
  const input = copied(value);
  if (!recordV1(input, revoke ? ['scope','reason','policyBaseVersion'] : ['limits','scope','reason','policyBaseVersion'])
    || !scopeValid(input.scope) || !integer(input.policyBaseVersion, Number.MAX_SAFE_INTEGER - 1, 0)
    || !revoke && !limitsValid(input.limits) || typeof input.reason !== 'string' || !input.reason.trim() || input.reason.length > 20_000) {
    throw new AuthFailure('LIMIT_POLICY_INPUT_INVALID', 422);
  }
  try { assertKnowledgeTextSafe(input.reason); } catch { throw new AuthFailure('LIMIT_POLICY_SENSITIVE_CONTENT', 412); }
  return input as unknown as LimitPolicyInput | LimitPolicyRevokeInput;
}
export const readLimitPolicyInput = (value: unknown) => readInput(value, false) as LimitPolicyInput;
export const readRevokeLimitPolicyInput = (value: unknown) => readInput(value, true) as LimitPolicyRevokeInput;
const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
const select = `SELECT v.*,c.result_ref,c.operation,c.state,c.actor_id command_actor,c.client_id command_client,c.request_hash,c.command_id command_key,c.control_generation,c.id server_command_id,c.operation_id,c.authorization_receipt_id,c.approval_consumption_id,c.policy_ref,c.payload_ref,c.expected_version,
 (SELECT COALESCE(jsonb_agg(to_jsonb(ar)),'[]'::jsonb) FROM anvil.authorization_receipts ar WHERE ar.command_id=c.id) receipt_rows,
 (SELECT COALESCE(jsonb_agg(to_jsonb(a)),'[]'::jsonb) FROM anvil.audit_events a WHERE a.command_id=c.id) audit_rows,
 (SELECT COALESCE(jsonb_agg(jsonb_build_object('id',ac.id,'requestId',d.request_id,'decisionId',ac.decision_id)),'[]'::jsonb) FROM anvil.approval_consumptions ac LEFT JOIN anvil.approval_decisions d ON d.id=ac.decision_id AND d.project_id=ac.project_id WHERE ac.command_id=c.id) approval_rows
 FROM anvil.limit_policy_versions v LEFT JOIN anvil.commands c ON c.project_id=v.project_id AND c.id=v.command_id `;

/** 비실행 작성 경로. 현재 HUMAN 제어·명시 정책 transaction 안에서 사용하며 예산 예약/실행 허가를 발급하지 않는다. */
export class ProjectLimitPolicies {
  #scope(scope: LimitScope, projectId: string) {
    if (scope.projectId !== projectId) throw new AuthFailure('LIMIT_POLICY_SCOPE_MISMATCH', 422);
    // executions의 정확 현재 세대 resolver를 연결하기 전 호출자 선언만으로 실행 범위를 만들지 않는다.
    if (scope.kind === 'EXECUTION') throw new AuthFailure('LIMIT_POLICY_EXECUTION_SCOPE_NOT_CONNECTED', 412);
  }
  async #view(db: PoolClient, actor: AuthenticatedIdentity, row: any): Promise<LimitPolicyRecord> {
    try {
      const s = row.snapshot_json, ref = { id: row.policy_id, version: Number(row.version), contentHash: row.content_hash };
      if (!uuidV1(row.project_id) || !refV1(ref) || !recordV1(s, ['limits','scope','reason','policyBaseVersion','state','previousRef','decidedBy','decidedAt','expiresAt','executionAuthorized','dispatchPerformed'])
        || !limitsValid(s.limits) || !scopeValid(s.scope) || s.scope.projectId !== row.project_id || s.scope.kind !== 'PROJECT'
        || s.policyBaseVersion !== ref.version - 1 || !['APPLIED','REVOKED'].includes(s.state)
        || typeof s.reason !== 'string' || !s.reason.trim() || s.reason.length > 20_000 || !isoV1(s.decidedAt) || !isoV1(s.expiresAt)
        || s.executionAuthorized !== false || s.dispatchPerformed !== false || !same(s.decidedBy, { kind: 'HUMAN', userId: row.created_by })
        || (ref.version === 1 ? s.previousRef !== null || s.state !== 'APPLIED' : !refV1(s.previousRef) || s.previousRef.id !== ref.id || s.previousRef.version !== ref.version - 1)
        || s.state === 'APPLIED' && Date.parse(s.expiresAt) !== Date.parse(s.decidedAt) + s.limits.maxElapsedMs
        || contentHash(canonicalJson(s)) !== ref.contentHash || row.state !== 'APPLIED' || row.command_actor !== row.created_by || row.command_client !== row.client_id
        || row.operation !== (s.state === 'APPLIED' ? 'applyLimitPolicy' : 'revokeLimitPolicy')
        || row.result_ref?.projectId !== row.project_id || row.result_ref?.status !== 'APPLIED'
        || row.result_ref?.data?.status !== (s.state === 'APPLIED' ? 'LIMIT_POLICY_APPLIED' : 'LIMIT_POLICY_REVOKED')
        || !same(row.result_ref?.data?.ref, ref) || !same(row.result_ref?.data?.snapshot, s)) throw Error();
      const payload = { ...(s.state === 'APPLIED' ? { limits: s.limits } : {}), scope: s.scope, reason: s.reason, policyBaseVersion: s.policyBaseVersion };
      if(!Array.isArray(row.receipt_rows)||row.receipt_rows.length!==1||!Array.isArray(row.audit_rows)||row.audit_rows.length!==1||!Array.isArray(row.approval_rows))throw Error();
      const ar=row.receipt_rows[0],audit=row.audit_rows[0];let approvalRef=null;
      if(row.approval_consumption_id!==null){
        if(row.approval_rows.length!==1||row.approval_rows[0].id!==row.approval_consumption_id)throw Error();
        const link=row.approval_rows[0],history=await new ProjectApprovals().readLimitPolicyConsumption(db,actor,row.project_id,link.requestId),r=history.request,used=history.consumption;
        approvalRef={requestId:link.requestId,decisionId:link.decisionId,scopeDigest:r.scopeDigest};
        if(history.storedStatus!=='CONSUMED'||!used||history.decision?.decision!=='APPROVE'||history.decision.id!==link.decisionId
          ||used.id!==row.approval_consumption_id||used.serverCommandId!==row.command_id||used.commandId!==row.command_key||used.requestHash!==row.request_hash
          ||r.details.candidateCommandId!==row.command_key||r.details.actionScope.operation!==row.operation||!same(r.details.actionScope.targetRef,s.previousRef)
          ||r.details.actionScope.expectedVersion!==s.policyBaseVersion||r.details.actionScope.payloadHash!==contentHash(canonicalJson(payload))
          ||!same(r.requestedBy,{kind:'HUMAN',userId:row.created_by,clientId:row.client_id})||r.controlGeneration!==Number(row.control_generation)
          ||!same(r.policyRef,row.policy_ref)||!same(row.payload_ref,{kind:'ONE_TIME_APPROVAL_SCOPE',payloadHash:contentHash(canonicalJson(payload)),scopeDigest:r.scopeDigest})
          ||Date.parse(used.consumedAt)<Date.parse(history.decision.decidedAt)||Date.parse(used.consumedAt)>=Date.parse(r.details.expiresAt))throw Error();
      }else if(row.approval_rows.length||row.payload_ref!==null)throw Error();
      const request={schemaVersion:1,projectId:row.project_id,commandId:row.command_key,clientId:row.client_id,controlGeneration:Number(row.control_generation),operation:row.operation,targetId:s.previousRef?.id??null,expectedVersion:s.policyBaseVersion,baselineRefs:[],approvalRef,payload};
      const scopeDigest=contentHash(canonicalJson({projectId:row.project_id,actorId:row.created_by,clientId:row.client_id,controlGeneration:Number(row.control_generation),requestHash:row.request_hash,policyRef:row.policy_ref,targetRef:ref}));
      if(row.request_hash!==contentHash(canonicalJson(request))||Number(row.expected_version)!==s.policyBaseVersion||row.server_command_id!==row.command_id
        ||row.result_ref.commandId!==row.command_key||row.result_ref.operationId!==row.operation_id||row.result_ref.targetId!==ref.id||row.result_ref.version!==ref.version
        ||ar.id!==row.authorization_receipt_id||ar.command_id!==row.command_id||ar.scope_kind!=='PROJECT'||ar.scope_id!==row.project_id||!same(ar.subject_ref,{kind:'HUMAN',userId:row.created_by,clientId:row.client_id})
        ||!same(ar.policy_ref,row.policy_ref)||ar.scope_digest!==scopeDigest||ar.approval_decision_ref!==(approvalRef?.decisionId??null)
        ||audit.project_id!==row.project_id||audit.command_id!==row.command_id||audit.operation_id!==row.operation_id||audit.outcome!=='APPLIED'||audit.source_kind!=='HUMAN_COMMAND'
        ||!same(audit.actor_ref,{kind:'HUMAN',userId:row.created_by})||audit.client_ref!==row.client_id||!same(audit.policy_ref,row.policy_ref)||!same(audit.target_ref,ref)||audit.scope_digest!==scopeDigest||!same(audit.approval_ref,approvalRef))throw Error();
      return { projectId: row.project_id, ref, snapshot: cloneV1(s) as LimitPolicySnapshot };
    } catch { throw new AuthFailure('LIMIT_POLICY_INTEGRITY_FAILED', 503); }
  }
  async #head(db: PoolClient, actor: AuthenticatedIdentity, projectId: string, scope: LimitScope) {
    const row = (await db.query(select + 'WHERE v.project_id=$1 AND v.scope_json=$2::jsonb ORDER BY v.version DESC LIMIT 1', [projectId, JSON.stringify(scope)])).rows[0];
    return row ? this.#view(db, actor, row) : null;
  }
  /** 현재 승인 대상만 검사한다. 역사 소비 reader는 현재 head/권한을 재인가하지 않는다. */
  async assertApprovalTarget(db: PoolClient,actor: AuthenticatedIdentity,projectId: string,scope: ApprovalScope){
    if(!['applyLimitPolicy','revokeLimitPolicy'].includes(scope.operation))throw new AuthFailure('APPROVAL_CANDIDATE_MISMATCH',409);
    await projectMember(db,actor,projectId,true);
    const head=await this.#head(db,actor,projectId,{kind:'PROJECT',projectId});
    if(!same(scope.targetRef,head?.ref??null)||scope.expectedVersion!==(head?.ref.version??0)
      ||scope.operation==='revokeLimitPolicy'&&(!head||head.snapshot.state!=='APPLIED'))throw new AuthFailure('APPROVAL_BASIS_NOT_CURRENT',412);
    return head;
  }
  async #write(db: PoolClient, actor: AuthenticatedIdentity, request: ProjectCommand, policyRef: VersionRef, revoke: boolean) {
    const input = readInput(request.payload, revoke), operation = revoke ? 'revokeLimitPolicy' : 'applyLimitPolicy';
    this.#scope(input.scope, request.projectId);
    if (request.operation !== operation || request.clientId !== actor.clientId || request.baselineRefs.length) throw new AuthFailure('LIMIT_POLICY_INPUT_INVALID', 422);
    const member = await projectMember(db, actor, request.projectId, true);
    if (member.archived_at) throw new AuthFailure('PROJECT_ARCHIVED', 412);
    const head = await this.#head(db, actor, request.projectId, input.scope);
    if (input.policyBaseVersion !== (head?.ref.version ?? 0) || request.expectedVersion !== input.policyBaseVersion || request.targetId !== (head?.ref.id ?? null)
      || revoke && (!head || head.snapshot.state === 'REVOKED')) throw new AuthFailure('VERSION_CONFLICT', 409);
    const at = (await db.query('SELECT transaction_timestamp() AS at')).rows[0].at.toISOString();
    const limits = revoke ? head!.snapshot.limits : (input as LimitPolicyInput).limits;
    const snapshot: LimitPolicySnapshot = { ...input, limits, state: revoke ? 'REVOKED' : 'APPLIED', previousRef: head?.ref ?? null,
      decidedBy: { kind: 'HUMAN', userId: actor.actorId }, decidedAt: at,
      expiresAt: revoke ? head!.snapshot.expiresAt : new Date(Date.parse(at) + limits.maxElapsedMs).toISOString(), executionAuthorized: false, dispatchPerformed: false };
    const ref = { id: head?.ref.id ?? randomUUID(), version: input.policyBaseVersion + 1, contentHash: contentHash(canonicalJson(snapshot)) };
    if(request.approvalRef!==null)await new ProjectApprovals().authorize(db,actor,request,policyRef);
    await db.query("SELECT set_config('anvil.limit_policy_payload',$1,true)",[canonicalJson(request.payload)]);
    const receipt = await persistProjectReceipt(db, actor, request, ref, { status: revoke ? 'LIMIT_POLICY_REVOKED' : 'LIMIT_POLICY_APPLIED', snapshot }, policyRef, 'EXPLICIT_LIMIT_POLICY_AUTHORING');
    await db.query('INSERT INTO anvil.limit_policy_versions(project_id,policy_id,version,content_hash,snapshot_json,created_by,client_id,command_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
      [request.projectId, ref.id, ref.version, ref.contentHash, JSON.stringify(snapshot), actor.actorId, actor.clientId, receipt.id]);
    return receipt.result;
  }
  apply(db: PoolClient, actor: AuthenticatedIdentity, request: ProjectCommand, policyRef: VersionRef) { return this.#write(db, actor, request, policyRef, false); }
  revoke(db: PoolClient, actor: AuthenticatedIdentity, request: ProjectCommand, policyRef: VersionRef) { return this.#write(db, actor, request, policyRef, true); }
  async read(db: PoolClient, actor: AuthenticatedIdentity, projectId: string, id: string, version: number): Promise<LimitPolicyRecord> {
    if (!uuidV1(projectId) || !uuidV1(id) || !integer(version, Number.MAX_SAFE_INTEGER)) throw new AuthFailure('INPUT_INVALID', 400);
    await projectMember(db, actor, projectId);
    const row = (await db.query(select + 'WHERE v.project_id=$1 AND v.policy_id=$2 AND v.version=$3', [projectId,id,version])).rows[0];
    if (!row) throw new AuthFailure('NOT_FOUND', 404);
    return this.#view(db, actor, row);
  }
  /** 현재 정책 원문 확인일 뿐이다. 누적/예약/비용·OS 허가 검사는 후속 실행 transaction이 별도로 수행한다. */
  async resolveCurrent(db: PoolClient, actor: AuthenticatedIdentity, projectId: string, ref: VersionRef, scope: LimitScope): Promise<LimitPolicyRecord> {
    if (!refV1(ref) || !scopeValid(scope)) throw new AuthFailure('LIMIT_POLICY_INPUT_INVALID', 422);
    this.#scope(scope, projectId);
    const member = await projectMember(db, actor, projectId, true);
    if (member.archived_at) throw new AuthFailure('PROJECT_ARCHIVED', 412);
    const head = await this.#head(db, actor, projectId, scope);
    if (!head || !same(head.ref, ref)) throw new AuthFailure('LIMIT_POLICY_NOT_CURRENT', 409);
    if (head.snapshot.state !== 'APPLIED') throw new AuthFailure('LIMIT_POLICY_REVOKED', 412);
    const at = (await db.query('SELECT clock_timestamp() AS at')).rows[0].at.getTime();
    if (!Number.isFinite(at) || Date.parse(head.snapshot.expiresAt) <= at) throw new AuthFailure('LIMIT_POLICY_EXPIRED', 412);
    return head;
  }
}

export interface RuntimeAuthorizationInput {
  executionId: string; executionGeneration: number; permissionPolicyRef: VersionRef; budgetPolicyRef: VersionRef; sourceScopes: SourceScopeV1[];
}
function runtimeInput(value: unknown): RuntimeAuthorizationInput {
  try {
    if (!recordV1(value, ['executionId','executionGeneration','permissionPolicyRef','budgetPolicyRef','sourceScopes']) || !uuidV1(value.executionId)
      || !integer(value.executionGeneration, Number.MAX_SAFE_INTEGER) || !refV1(value.permissionPolicyRef) || !refV1(value.budgetPolicyRef)) throw Error();
    readSourceScopesV1(value.sourceScopes);
    if (Buffer.byteLength(canonicalJson(value),'utf8') > 2 * 1024 * 1024) throw Error();
    return cloneV1(value) as RuntimeAuthorizationInput;
  } catch { throw new AuthFailure('RUNTIME_SCOPE_INVALID', 422); }
}
function targetMatches(granted: SourceScopeV1, asked: SourceScopeV1, target: SourceScopeV1['targets'][number], denial = false) {
  // DENY는 같은 root의 대소문자 별칭/버전 변경으로 우회하지 못한다. 허용은 모든 ref·경로·접근을 정확히 대조한다.
  if (denial ? granted.sourceRootRef.id !== asked.sourceRootRef.id : !same(
    {sourceRootRef:granted.sourceRootRef,mappingRef:granted.mappingRef,observationRef:granted.observationRef,baselineRef:granted.baselineRef},
    {sourceRootRef:asked.sourceRootRef,mappingRef:asked.mappingRef,observationRef:asked.observationRef,baselineRef:asked.baselineRef})) return false;
  return granted.targets.some(t => (denial ? t.relativePath.toUpperCase() === target.relativePath.toUpperCase() : t.relativePath === target.relativePath)
    && t.kind === target.kind && t.access === target.access && t.recursive === target.recursive);
}
/** 현재 HUMAN 정책 범위만 검사한다. DB grant/원자 예약·queue와 OS/wire 허가를 대신하지 않는다. */
export async function authorizeRuntimePolicy(db: PoolClient, actor: AuthenticatedIdentity, request: ProjectCommand, value: RuntimeAuthorizationInput,
  budgets: Pick<ProjectLimitPolicies, 'resolveCurrent'> = new ProjectLimitPolicies()) {
  const input = runtimeInput(value);
  await currentProjectController(db, actor, request);
  const policy = await currentPolicy(db, request.projectId);
  if (!policy) throw new AuthFailure('PERMISSION_POLICY_UNCONFIGURED', 412);
  if (!same(input.permissionPolicyRef,policy.ref)) throw new AuthFailure('RUNTIME_POLICY_NOT_CURRENT', 409);
  if (!(runtimeOperations as readonly string[]).includes(request.operation)) throw new AuthFailure('RUNTIME_OPERATION_DENIED', 403);
  const at = (await db.query('SELECT clock_timestamp() AS at')).rows[0].at.getTime();
  if (!Number.isFinite(at)) throw new AuthFailure('RUNTIME_CLOCK_INVALID', 503);
  const candidates = policy.rules.filter((r): r is ExecutionRule => r.limitPolicyRef !== null && r.subjectRef.kind === 'HUMAN' && r.subjectRef.userId === actor.actorId
    && r.operations.includes(request.operation) && Date.parse(r.expiresAt) > at && r.targetScopes.length === 1 && r.targetScopes[0].kind === 'EXECUTION'
    && r.targetScopes[0].projectId === request.projectId && r.targetScopes[0].executionId === input.executionId && r.targetScopes[0].executionGeneration === input.executionGeneration);
  const overlaps = (r:ExecutionRule) => input.sourceScopes.some(s => s.targets.some(t => r.targetScopes[0].sourceScopes.some(g => targetMatches(g,s,t,true))));
  if (candidates.some(r => r.disposition === 'DENY' && overlaps(r))) throw new AuthFailure('RUNTIME_OPERATION_DENIED',403);
  const allowed = candidates.filter(r => r.disposition !== 'DENY' && same(r.limitPolicyRef,input.budgetPolicyRef));
  if (!input.sourceScopes.every(s => s.targets.every(t => allowed.some(r => r.targetScopes[0].sourceScopes.some(g => targetMatches(g,s,t)))))) throw new AuthFailure('RUNTIME_OPERATION_DENIED',403);
  if (allowed.some(r => r.disposition === 'REQUIRE_APPROVAL' && overlaps(r))) throw new AuthFailure('EXECUTION_APPROVAL_NOT_CONNECTED',412);
  if (request.approvalRef !== null) throw new AuthFailure('APPROVAL_NOT_REQUIRED',422);
  const budget = await budgets.resolveCurrent(db,actor,request.projectId,input.budgetPolicyRef,{kind:'PROJECT',projectId:request.projectId});
  const validUntil = Math.min(Date.parse(budget.snapshot.expiresAt), ...allowed.map(r => Date.parse(r.expiresAt)));
  if (!Number.isFinite(validUntil) || validUntil <= at) throw new AuthFailure('RUNTIME_OPERATION_DENIED',403);
  return {policyRef:policy.ref,budgetPolicyRef:budget.ref,validUntil,executionAuthorized:false as const,dispatchPerformed:false as const};
}
