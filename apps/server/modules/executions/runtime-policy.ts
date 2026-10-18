import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { canonicalJson, contentHash } from '../../../../contracts/canonical.ts';
import type { VersionRef } from '../../../../contracts/generated-types.ts';
import { cloneV1, isoV1, recordV1, refV1, uuidV1 } from '../../../../contracts/runtime/validation-v1.ts';
import { AuthFailure, type AuthenticatedIdentity } from '../access/repository.ts';
import { persistProjectReceipt, projectMember, type ProjectCommand } from '../access/project-command.ts';
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
const select = 'SELECT v.*,c.result_ref,c.operation,c.state,c.actor_id command_actor,c.client_id command_client,c.request_hash,c.command_id command_key,c.control_generation FROM anvil.limit_policy_versions v JOIN anvil.commands c ON c.project_id=v.project_id AND c.id=v.command_id ';

/** 비실행 작성 경로. 현재 HUMAN 제어·명시 정책 transaction 안에서 사용하며 예산 예약/실행 허가를 발급하지 않는다. */
export class ProjectLimitPolicies {
  #scope(scope: LimitScope, projectId: string) {
    if (scope.projectId !== projectId) throw new AuthFailure('LIMIT_POLICY_SCOPE_MISMATCH', 422);
    // executions의 정확 현재 세대 resolver를 연결하기 전 호출자 선언만으로 실행 범위를 만들지 않는다.
    if (scope.kind === 'EXECUTION') throw new AuthFailure('LIMIT_POLICY_EXECUTION_SCOPE_NOT_CONNECTED', 412);
  }
  #view(row: any): LimitPolicyRecord {
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
      if (row.request_hash !== contentHash(canonicalJson({ schemaVersion: 1, projectId: row.project_id, commandId: row.command_key, clientId: row.client_id,
        controlGeneration: Number(row.control_generation), operation: row.operation, targetId: s.previousRef?.id ?? null, expectedVersion: s.policyBaseVersion,
        baselineRefs: [], approvalRef: null, payload }))) throw Error();
      return { projectId: row.project_id, ref, snapshot: cloneV1(s) as LimitPolicySnapshot };
    } catch { throw new AuthFailure('LIMIT_POLICY_INTEGRITY_FAILED', 503); }
  }
  async #head(db: PoolClient, projectId: string, scope: LimitScope) {
    const row = (await db.query(select + 'WHERE v.project_id=$1 AND v.scope_json=$2::jsonb ORDER BY v.version DESC LIMIT 1', [projectId, JSON.stringify(scope)])).rows[0];
    return row ? this.#view(row) : null;
  }
  async #write(db: PoolClient, actor: AuthenticatedIdentity, request: ProjectCommand, policyRef: VersionRef, revoke: boolean) {
    const input = readInput(request.payload, revoke), operation = revoke ? 'revokeLimitPolicy' : 'applyLimitPolicy';
    this.#scope(input.scope, request.projectId);
    if (request.operation !== operation || request.clientId !== actor.clientId || request.baselineRefs.length) throw new AuthFailure('LIMIT_POLICY_INPUT_INVALID', 422);
    if (request.approvalRef !== null) throw new AuthFailure('LIMIT_POLICY_APPROVAL_NOT_CONNECTED', 412);
    const member = await projectMember(db, actor, request.projectId, true);
    if (member.archived_at) throw new AuthFailure('PROJECT_ARCHIVED', 412);
    const head = await this.#head(db, request.projectId, input.scope);
    if (input.policyBaseVersion !== (head?.ref.version ?? 0) || request.expectedVersion !== input.policyBaseVersion || request.targetId !== (head?.ref.id ?? null)
      || revoke && (!head || head.snapshot.state === 'REVOKED')) throw new AuthFailure('VERSION_CONFLICT', 409);
    const at = (await db.query('SELECT transaction_timestamp() AS at')).rows[0].at.toISOString();
    const limits = revoke ? head!.snapshot.limits : (input as LimitPolicyInput).limits;
    const snapshot: LimitPolicySnapshot = { ...input, limits, state: revoke ? 'REVOKED' : 'APPLIED', previousRef: head?.ref ?? null,
      decidedBy: { kind: 'HUMAN', userId: actor.actorId }, decidedAt: at,
      expiresAt: revoke ? head!.snapshot.expiresAt : new Date(Date.parse(at) + limits.maxElapsedMs).toISOString(), executionAuthorized: false, dispatchPerformed: false };
    const ref = { id: head?.ref.id ?? randomUUID(), version: input.policyBaseVersion + 1, contentHash: contentHash(canonicalJson(snapshot)) };
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
    return this.#view(row);
  }
  /** 현재 정책 원문 확인일 뿐이다. 누적/예약/비용·OS 허가 검사는 후속 실행 transaction이 별도로 수행한다. */
  async resolveCurrent(db: PoolClient, actor: AuthenticatedIdentity, projectId: string, ref: VersionRef, scope: LimitScope): Promise<LimitPolicyRecord> {
    if (!refV1(ref) || !scopeValid(scope)) throw new AuthFailure('LIMIT_POLICY_INPUT_INVALID', 422);
    this.#scope(scope, projectId);
    const member = await projectMember(db, actor, projectId, true);
    if (member.archived_at) throw new AuthFailure('PROJECT_ARCHIVED', 412);
    const head = await this.#head(db, projectId, scope);
    if (!head || !same(head.ref, ref)) throw new AuthFailure('LIMIT_POLICY_NOT_CURRENT', 409);
    if (head.snapshot.state !== 'APPLIED') throw new AuthFailure('LIMIT_POLICY_REVOKED', 412);
    const at = (await db.query('SELECT clock_timestamp() AS at')).rows[0].at.getTime();
    if (!Number.isFinite(at) || Date.parse(head.snapshot.expiresAt) <= at) throw new AuthFailure('LIMIT_POLICY_EXPIRED', 412);
    return head;
  }
}
