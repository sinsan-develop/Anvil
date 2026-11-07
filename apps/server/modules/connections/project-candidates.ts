import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { AccessRepository, AuthFailure, type AuthenticatedIdentity } from '../access/repository.ts';
import { authorizeMaterial, currentProjectController, persistProjectReceipt, projectMember, projectReplay, recordProjectDenial, type ProjectCommand } from '../access/project-command.ts';
import { canonicalJson, contentHash } from '../../../../contracts/canonical.ts';
import { isVersionRef } from '../../../../contracts/references.ts';
import type { VersionRef } from '../../../../contracts/generated-types.ts';
import type { ProjectListCodec } from '../projects/service.ts';
import { readCandidateInput, candidateReadiness, candidateCapabilities, candidateOperations, type CandidateInput } from './candidate-input.ts';

const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
const uuid = (id: unknown) => isVersionRef({ id, version: 1, contentHash: '0'.repeat(64) });
function rejectUnconnectedReferences(input: CandidateInput) {
  // 현재 신뢰 등록/완성형 환경·실측 저장은 열지 않았다. 후보 ID를 이 참조로 위장하지 않는다.
  for (const [key, value] of Object.entries(input.candidate)) {
    if (['connectorRef', 'environmentRef', 'executionHostRef'].includes(key) || ['sourceRootRefs', 'targetHostRefs', 'commandProfileRefs', 'secretRefs'].includes(key) && (value as unknown[]).length > 0) throw new AuthFailure('CANDIDATE_REFERENCE_NOT_CONNECTED', 412);
  }
}
function snapshot(input: CandidateInput) {
  return { kind: input.kind, input, readiness: candidateReadiness(input), capabilities: candidateCapabilities(input) };
}
export class ProjectConnectionCandidates {
  #access: AccessRepository;
  constructor(access: AccessRepository) { this.#access = access; }
  async command(token: string, csrf: string, request: ProjectCommand) {
    try {
      return await this.#access.authenticated(token, csrf, async (db, actor) => {
        await currentProjectController(db, actor, request);
        if (!candidateOperations.includes(request.operation as typeof candidateOperations[number])) throw new AuthFailure('CANDIDATE_OPERATION_NOT_SUPPORTED', 412);
        if (!actor.reauthUntil || actor.reauthUntil.getTime() <= Date.now()) throw new AuthFailure('REAUTHENTICATION_REQUIRED', 412);
        const policy = await authorizeMaterial(db, actor, request);
        if (request.baselineRefs.length) throw new AuthFailure('REFERENCE_CONNECTION_PENDING', 412);
        const previous = await projectReplay(db, actor, request);
        if (previous !== undefined) {
          const result = previous as { data: { ref: VersionRef; candidate: unknown } };
          if (!isVersionRef(result.data?.ref)) throw new AuthFailure('CANDIDATE_INTEGRITY_FAILED', 503);
          const preserved = await this.read(db, actor, request.projectId, result.data.ref.id, result.data.ref.version);
          if (!same(preserved.ref, result.data.ref) || !same(preserved.candidate, result.data.candidate)) throw new AuthFailure('CANDIDATE_INTEGRITY_FAILED', 503);
          return previous;
        }
        const now = (await db.query('SELECT clock_timestamp() AS at')).rows[0].at as Date;
        if (!Object.hasOwn(request.payload, 'kind')) throw new AuthFailure('COMPLETE_CONNECTION_DEFINITION_NOT_READY', 412);
        const input = readCandidateInput(request.operation, request.payload, { now, policyExpiresAt: new Date(policy.validUntil) });
        if (!same(input.policyRef, policy.ref)) throw new AuthFailure('CANDIDATE_POLICY_CHANGED', 409);
        rejectUnconnectedReferences(input);
        let id: string, version: number;
        if (request.targetId === null) {
          if (request.expectedVersion !== 0 || input.candidateRef !== null) throw new AuthFailure('CANDIDATE_VERSION_CONFLICT', 409);
          id = randomUUID(); version = 1;
        } else {
          if (!uuid(request.targetId) || !Number.isSafeInteger(request.expectedVersion) || request.expectedVersion < 1 || !input.candidateRef || input.candidateRef.id !== request.targetId || input.candidateRef.version !== request.expectedVersion) throw new AuthFailure('CANDIDATE_VERSION_CONFLICT', 409);
          const head = (await db.query('SELECT kind,head_version FROM anvil.connection_candidates WHERE project_id=$1 AND id=$2 FOR UPDATE', [request.projectId, request.targetId])).rows[0];
          if (!head) throw new AuthFailure('NOT_FOUND', 404);
          if (head.kind !== input.kind || Number(head.head_version) !== request.expectedVersion) throw new AuthFailure('CANDIDATE_VERSION_CONFLICT', 409);
          const old = await this.read(db, actor, request.projectId, request.targetId, request.expectedVersion);
          if (!same(old.ref, input.candidateRef)) throw new AuthFailure('CANDIDATE_VERSION_CONFLICT', 409);
          id = request.targetId; version = request.expectedVersion + 1;
          if (!Number.isSafeInteger(version)) throw new AuthFailure('CANDIDATE_VERSION_CONFLICT', 409);
        }
        const candidate = snapshot(input), ref = { id, version, contentHash: contentHash(canonicalJson(candidate)) };
        const receipt = await persistProjectReceipt(db, actor, request, ref, { status: 'CANDIDATE_STORED', candidate, previousRef: input.candidateRef }, policy.ref, 'EXPLICIT_UNVERIFIED_CONNECTION_CANDIDATE');
        if (version === 1) await db.query('INSERT INTO anvil.connection_candidates(id,project_id,kind,head_version,created_by) VALUES($1,$2,$3,1,$4)', [id, request.projectId, input.kind, actor.actorId]);
        else await db.query('UPDATE anvil.connection_candidates SET head_version=$3 WHERE project_id=$1 AND id=$2', [request.projectId, id, version]);
        await db.query('INSERT INTO anvil.connection_candidate_versions(project_id,candidate_id,version,kind,snapshot_json,content_hash,created_by,client_id,command_id,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [request.projectId, id, version, input.kind, JSON.stringify(candidate), ref.contentHash, actor.actorId, actor.clientId, receipt.id, input.expiresAt]);
        return receipt.result;
      });
    } catch (error) { await recordProjectDenial(this.#access, token, request.projectId, error); throw error; }
  }
  async read(db: PoolClient, actor: AuthenticatedIdentity, projectId: string, id: string, version: number) {
    await projectMember(db, actor, projectId);
    if (!uuid(id) || !Number.isSafeInteger(version) || version < 1) throw new AuthFailure('INPUT_INVALID', 400);
    const row = (await db.query("SELECT v.*,c.result_ref,c.actor_id AS command_actor,c.client_id AS command_client,c.operation,c.state,c.expected_version FROM anvil.connection_candidate_versions v JOIN anvil.commands c ON c.id=v.command_id AND c.project_id=v.project_id WHERE v.project_id=$1 AND v.candidate_id=$2 AND v.version=$3", [projectId, id, version])).rows[0];
    if (!row) throw new AuthFailure('NOT_FOUND', 404);
    const candidate = row.snapshot_json, ref = { id, version, contentHash: row.content_hash };
    try {
      if (!candidate || !candidate.input || candidate.kind !== row.kind || candidate.input.kind !== row.kind || contentHash(canonicalJson(candidate)) !== row.content_hash || row.expires_at.toISOString() !== candidate.input.expiresAt || !same(row.result_ref?.data?.ref, ref) || !same(row.result_ref?.data?.candidate, candidate) || row.result_ref?.data?.status !== 'CANDIDATE_STORED' || row.result_ref?.status !== 'APPLIED' || row.state !== 'APPLIED' || Number(row.expected_version) !== version - 1 || row.command_actor !== row.created_by || row.command_client !== row.client_id) throw Error();
      const input = readCandidateInput(row.operation, candidate.input, { now: row.created_at, policyExpiresAt: row.expires_at });
      rejectUnconnectedReferences(input);
      if (!same(candidate, snapshot(input)) || !same(row.result_ref.data.previousRef, input.candidateRef)) throw Error();
    } catch { throw new AuthFailure('CANDIDATE_INTEGRITY_FAILED', 503); }
    return { ref, candidate, expired: row.expires_at.getTime() <= Date.now(), createdAt: row.created_at.toISOString(), recordedBy: row.created_by, executionAuthorized: false as const, observedAt: new Date().toISOString() };
  }
  async list(db: PoolClient, actor: AuthenticatedIdentity, projectId: string, query: Record<string, unknown>, codec: ProjectListCodec) {
    await projectMember(db, actor, projectId);
    if (Object.keys(query).some(k => !['kind', 'limit', 'cursor'].includes(k)) || query.kind !== undefined && (typeof query.kind !== 'string' || !['CONNECTION_CANDIDATE', 'ENVIRONMENT_CANDIDATE'].includes(query.kind)) || query.limit !== undefined && (typeof query.limit !== 'string' || !/^[1-9][0-9]{0,2}$/.test(query.limit) || Number(query.limit) > 200) || query.cursor !== undefined && (typeof query.cursor !== 'string' || query.cursor.length > 4096)) throw new AuthFailure('INPUT_INVALID', 400);
    const kind = query.kind ?? null, limit = query.limit === undefined ? 50 : Number(query.limit), filter = { query: canonicalJson({ projectId, kind }), archived: false, limit };
    let position: { at: string; id: string } | null = null;
    if (query.cursor !== undefined) { try { position = codec.read(query.cursor, actor.actorId, filter); } catch { throw new AuthFailure('CURSOR_INVALID', 400); } }
    const rows = (await db.query("SELECT c.id,c.kind,v.version,v.content_hash,v.snapshot_json->'input'->'candidate'->>'label' AS label,v.expires_at,to_char(c.created_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') cursor_at FROM anvil.connection_candidates c JOIN anvil.connection_candidate_versions v ON v.project_id=c.project_id AND v.candidate_id=c.id AND v.version=c.head_version WHERE c.project_id=$1 AND ($2::text IS NULL OR c.kind=$2) AND ($3::timestamptz IS NULL OR (c.created_at,c.id)<($3::timestamptz,$4::uuid)) ORDER BY c.created_at DESC,c.id DESC LIMIT $5", [projectId, kind, position?.at ?? null, position?.id ?? null, limit + 1])).rows;
    const hasMore = rows.length > limit, last = rows.slice(0, limit).at(-1);
    return { view: 'CANDIDATES_ONLY' as const, items: rows.slice(0, limit).map(row => ({ ref: { id: row.id, version: Number(row.version), contentHash: row.content_hash }, kind: row.kind, label: row.label, readiness: 'NOT_READY', expiresAt: row.expires_at.toISOString(), integrity: 'NOT_RECHECKED' })), hasMore, nextCursor: hasMore ? codec.create(actor.actorId, filter, { at: last!.cursor_at, id: last!.id }) : null, observedAt: new Date().toISOString() };
  }
}
