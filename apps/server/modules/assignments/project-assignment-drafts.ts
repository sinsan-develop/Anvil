import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { canonicalJson, contentHash } from '../../../../contracts/canonical.ts';
import { isVersionRef } from '../../../../contracts/references.ts';
import type { VersionRef } from '../../../../contracts/generated-types.ts';
import type { MethodologyGraph } from '../../../../contracts/methodologies.ts';
import { AuthFailure, type AuthenticatedIdentity } from '../access/repository.ts';
import { persistProjectReceipt, projectMember, type ProjectCommand } from '../access/project-command.ts';
import type { ProjectWorkPlans } from '../traceability/work-plans.ts';
import { ProjectMethodologies } from '../methodologies/project-methodologies.ts';
import type { ProjectListCodec } from '../projects/service.ts';
import { assertAssignmentRoot, readAssignmentDraftInput, type AssignmentDraftInput } from './assignment-input.ts';
import { ProjectAssignmentConfirmations } from './project-assignment-confirmations.ts';
import { inspectSourceScopeContainment } from './source-scope-containment.ts';

const same = (one: unknown, two: unknown) => canonicalJson(one) === canonicalJson(two);
const uuid = (id: unknown) => isVersionRef({ id, version: 1, contentHash: '0'.repeat(64) });
const select = 'SELECT v.*,d.head_version,d.updated_at,c.result_ref,c.operation,c.state,c.expected_version,c.actor_id command_actor,c.client_id command_client,' +
  `to_char(d.updated_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') cursor_at FROM anvil.assignment_draft_versions v JOIN anvil.assignment_drafts d ON d.project_id=v.project_id AND d.id=v.draft_id JOIN anvil.commands c ON c.project_id=v.project_id AND c.id=v.command_id `;

export class ProjectAssignmentDrafts {
  readonly plans: Pick<ProjectWorkPlans, 'read' | 'decision'>;
  readonly methods: Pick<ProjectMethodologies, 'readApplication'>;
  readonly parents: Pick<ProjectAssignmentConfirmations, 'read' | 'decision'>;
  constructor(plans: Pick<ProjectWorkPlans, 'read' | 'decision'>, methods: Pick<ProjectMethodologies, 'readApplication'> = new ProjectMethodologies(), parents?: Pick<ProjectAssignmentConfirmations, 'read' | 'decision'>) {
    this.plans = plans; this.methods = methods; this.parents = parents ?? new ProjectAssignmentConfirmations(this);
  }
  async #parent(db: PoolClient, actor: AuthenticatedIdentity, request: Pick<ProjectCommand, 'projectId' | 'targetId'>, input: AssignmentDraftInput) {
    const child = input.definition, ref = child.parentAssignmentRef;
    if (ref === null) return;
    if (ref.id === request.targetId) throw new AuthFailure('ASSIGNMENT_PARENT_INVALID', 422);
    // 부모 검토/개정도 이 head를 잠근다. 같은 transaction의 COMMIT까지 보유한다.
    const head = (await db.query('SELECT head_version FROM anvil.assignment_drafts WHERE project_id=$1 AND id=$2 FOR UPDATE', [request.projectId, ref.id])).rows[0];
    if (!head || Number(head.head_version) !== ref.version) throw new AuthFailure('ASSIGNMENT_PARENT_NOT_CURRENT', 409);
    const parent = await this.parents.read(db, actor, request.projectId, ref.id, ref.version);
    if (parent.projectId !== request.projectId || !same(parent.ref, ref) || parent.snapshot.contentConfirmed !== true
      || parent.snapshot.ready !== false || parent.snapshot.executionAuthorized !== false || parent.snapshot.dispatchPerformed !== false)
      throw new AuthFailure('ASSIGNMENT_PARENT_INVALID', 409);
    const original = parent.snapshot.definition;
    assertAssignmentRoot(original);
    const draft = await this.current(db, actor, request.projectId, parent.snapshot.draftRef);
    if (!same(original, draft.snapshot.definition)) throw new AuthFailure('ASSIGNMENT_PARENT_INVALID', 409);
    const decision = await this.parents.decision(db, actor, request.projectId, ref.id, ref.version);
    if (decision.currentIssue !== null || !decision.latestReviewAccepted || !same(decision.draftRef, draft.ref) || !same(decision.confirmedRef, ref))
      throw new AuthFailure('ASSIGNMENT_PARENT_NOT_CURRENT', 409);
    if (!same(child.taskRef.planRef, original.taskRef.planRef) || !same(child.taskRef.applicationRef, original.taskRef.applicationRef)
      || child.taskRef.nodeId !== original.taskRef.nodeId
      || (['environmentRef', 'budgetRef', 'recordingPolicyRef'] as const).some(field => !same(child[field], original[field]))
      || child.baselineRefs.some(item => !original.baselineRefs.some((base: VersionRef) => same(item, base)))
      || child.requiredCapabilities.some(item => !original.requiredCapabilities.includes(item))
      || (child.allowedScopes.length > 0 && !inspectSourceScopeContainment(original.allowedScopes, child.allowedScopes).scopeContained))
      throw new AuthFailure('ASSIGNMENT_PARENT_SCOPE_MISMATCH', 422);
  }
  async #basis(db: PoolClient, actor: AuthenticatedIdentity, projectId: string, input: AssignmentDraftInput) {
    const task = input.definition.taskRef;
    const plan = await this.plans.read(db, actor, projectId, task.planRef.id, task.planRef.version);
    if (!same(plan.ref, task.planRef)) throw new AuthFailure('VERSION_CONFLICT', 409);
    const decision = await this.plans.decision(db, actor, projectId, task.planRef.id, task.planRef.version);
    if (!decision.currentConfirmationValid || plan.relationalProjection !== 'STORED') throw new AuthFailure('ASSIGNMENT_PLAN_NOT_CURRENT', 412);
    const card = plan.tasks.find((item: any) => item.taskCode === task.taskCode);
    if (!card) throw new AuthFailure('NOT_FOUND', 404);
    const application = await this.methods.readApplication(db, actor, projectId);
    if (!same(application.applicationRef, task.applicationRef)) throw new AuthFailure('METHODOLOGY_APPLICATION_CHANGED', 409);
    const graph = application.snapshot?.graph as MethodologyGraph | undefined;
    if (!graph?.nodes.some(node => node.nodeId === task.nodeId)) throw new AuthFailure('NOT_FOUND', 404);
    const allowed = [task.planRef, task.applicationRef, plan.designRef];
    if (input.definition.baselineRefs.some(ref => !allowed.some(candidate => same(candidate, ref)))) throw new AuthFailure('ASSIGNMENT_BASELINE_MISMATCH', 409);
    return { planRef: task.planRef, applicationRef: task.applicationRef, designRef: plan.designRef, taskCode: task.taskCode, nodeId: task.nodeId, taskCardHash: contentHash(canonicalJson(card)) };
  }
  /** 기존 ProjectPolicyRepository.command의 인증/현재제어/정책/중복검사 안에서만 호출한다. */
  async save(db: PoolClient, actor: AuthenticatedIdentity, request: ProjectCommand, policyRef: VersionRef) {
    if (request.operation !== 'prepareAssignment') throw new AuthFailure('ASSIGNMENT_INPUT_INVALID', 422);
    if (request.approvalRef !== null) throw new AuthFailure('ASSIGNMENT_APPROVAL_NOT_CONNECTED', 412);
    const analysis = readAssignmentDraftInput(request.payload), input = analysis.input;
    const basis = await this.#basis(db, actor, request.projectId, input);
    await this.#parent(db, actor, request, input);
    let previousRef: VersionRef | null = null;
    if (request.targetId === null) {
      if (request.expectedVersion !== 0 || input.baseRef !== null) throw new AuthFailure('VERSION_CONFLICT', 409);
    } else {
      if (!input.baseRef || input.baseRef.id !== request.targetId || input.baseRef.version !== request.expectedVersion) throw new AuthFailure('VERSION_CONFLICT', 409);
      const head = (await db.query('SELECT head_version FROM anvil.assignment_drafts WHERE project_id=$1 AND id=$2 FOR UPDATE', [request.projectId, request.targetId])).rows[0];
      if (!head) throw new AuthFailure('NOT_FOUND', 404);
      if (Number(head.head_version) !== request.expectedVersion) throw new AuthFailure('VERSION_CONFLICT', 409);
      const old = await this.read(db, actor, request.projectId, request.targetId, request.expectedVersion);
      if (!same(old.ref, input.baseRef)) throw new AuthFailure('VERSION_CONFLICT', 409);
      if (!same(old.snapshot.definition.parentAssignmentRef, input.definition.parentAssignmentRef)) throw new AuthFailure('ASSIGNMENT_PARENT_BINDING_CHANGED', 409);
      previousRef = old.ref;
    }
    const id = request.targetId ?? randomUUID(), version = request.expectedVersion + 1;
    if (!Number.isSafeInteger(version)) throw new AuthFailure('VERSION_CONFLICT', 409);
    const readinessIssues = [...analysis.readinessIssues];
    if (!input.definition.baselineRefs.some(ref => same(ref, basis.designRef))) readinessIssues.push({ code: 'BASELINE_REFERENCE_MISSING', location: 'baselineRefs' });
    const snapshot = { definition: input.definition, reason: input.reason, previousRef, basis, readinessIssues, status: 'DRAFT', ready: false, executionAuthorized: false, dispatchPerformed: false };
    const ref = { id, version, contentHash: contentHash(canonicalJson(snapshot)) };
    const receipt = await persistProjectReceipt(db, actor, request, ref, { status: 'ASSIGNMENT_DRAFT_STORED', snapshot }, policyRef, 'EXPLICIT_ASSIGNMENT_DRAFT_ONLY');
    if (version === 1) await db.query('INSERT INTO anvil.assignment_drafts(project_id,id,head_version,created_by,client_id) VALUES($1,$2,1,$3,$4)', [request.projectId, id, actor.actorId, actor.clientId]);
    else await db.query('UPDATE anvil.assignment_drafts SET head_version=$3,updated_at=now() WHERE project_id=$1 AND id=$2', [request.projectId, id, version]);
    await db.query('INSERT INTO anvil.assignment_draft_versions(project_id,draft_id,version,content_hash,version_json,created_by,client_id,command_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)', [request.projectId, id, version, ref.contentHash, JSON.stringify(snapshot), actor.actorId, actor.clientId, receipt.id]);
    return receipt.result;
  }
  #view(row: any, projectId: string, id: string, version: number) {
    const ref = { id, version, contentHash: row.content_hash }, snapshot = row.version_json, data = row.result_ref?.data;
    try {
      if (row.project_id !== projectId || row.draft_id !== id || Number(row.version) !== version || Number(row.head_version) < version || row.operation !== 'prepareAssignment' || row.state !== 'APPLIED' || Number(row.expected_version) !== version - 1 || row.command_actor !== row.created_by || row.command_client !== row.client_id || row.result_ref?.status !== 'APPLIED' || data?.status !== 'ASSIGNMENT_DRAFT_STORED' || !same(data.ref, ref) || !same(data.snapshot, snapshot) || contentHash(canonicalJson(snapshot)) !== ref.contentHash) throw Error();
      if (Object.keys(snapshot).sort().join(',') !== ['definition', 'reason', 'previousRef', 'basis', 'readinessIssues', 'status', 'ready', 'executionAuthorized', 'dispatchPerformed'].sort().join(',') || snapshot.status !== 'DRAFT' || snapshot.ready !== false || snapshot.executionAuthorized !== false || snapshot.dispatchPerformed !== false) throw Error();
      const analysis = readAssignmentDraftInput({ baseRef: snapshot.previousRef, definition: snapshot.definition, reason: snapshot.reason });
      const task = analysis.input.definition.taskRef, basis = snapshot.basis;
      if (!basis || Object.keys(basis).sort().join(',') !== ['planRef', 'applicationRef', 'designRef', 'taskCode', 'nodeId', 'taskCardHash'].sort().join(',') || !same(basis.planRef, task.planRef) || !same(basis.applicationRef, task.applicationRef) || basis.taskCode !== task.taskCode || basis.nodeId !== task.nodeId || !isVersionRef(basis.designRef) || !/^[0-9a-f]{64}$/.test(basis.taskCardHash)) throw Error();
      const issues = [...analysis.readinessIssues];
      if (!analysis.input.definition.baselineRefs.some(ref => same(ref, basis.designRef))) issues.push({ code: 'BASELINE_REFERENCE_MISSING', location: 'baselineRefs' });
      if (!same(issues, snapshot.readinessIssues) || (version === 1 ? snapshot.previousRef !== null : !isVersionRef(snapshot.previousRef) || snapshot.previousRef.id !== id || snapshot.previousRef.version !== version - 1)) throw Error();
    } catch { throw new AuthFailure('ASSIGNMENT_INTEGRITY_FAILED', 503); }
    return { projectId, ref, snapshot, headVersion: Number(row.head_version), sourceCurrentness: 'NOT_RECHECKED', observedAt: new Date().toISOString() };
  }
  async read(db: PoolClient, actor: AuthenticatedIdentity, projectId: string, id: string, version: number) {
    await projectMember(db, actor, projectId);
    if (!uuid(id) || !Number.isSafeInteger(version) || version < 1) throw new AuthFailure('INPUT_INVALID', 400);
    const row = (await db.query(select + 'WHERE v.project_id=$1 AND v.draft_id=$2 AND v.version=$3', [projectId, id, version])).rows[0];
    if (!row) throw new AuthFailure('NOT_FOUND', 404);
    return this.#view(row, projectId, id, version);
  }
  /** 검토·확정의 현재성 검사. 기존 읽기 응답이나 초안 snapshot은 바꾸지 않는다. */
  async current(db: PoolClient, actor: AuthenticatedIdentity, projectId: string, ref: VersionRef) {
    await projectMember(db, actor, projectId);
    const head = (await db.query('SELECT head_version FROM anvil.assignment_drafts WHERE project_id=$1 AND id=$2 FOR UPDATE', [projectId, ref.id])).rows[0];
    if (!head) throw new AuthFailure('NOT_FOUND', 404);
    if (Number(head.head_version) !== ref.version) throw new AuthFailure('VERSION_CONFLICT', 409);
    const draft = await this.read(db, actor, projectId, ref.id, ref.version);
    if (!same(draft.ref, ref)) throw new AuthFailure('VERSION_CONFLICT', 409);
    assertAssignmentRoot(draft.snapshot.definition);
    const basis = await this.#basis(db, actor, projectId, { baseRef: draft.snapshot.previousRef, definition: draft.snapshot.definition, reason: draft.snapshot.reason });
    if (!same(draft.snapshot.basis, basis)) throw new AuthFailure('ASSIGNMENT_BASIS_CHANGED', 409);
    return draft;
  }
  /** HUMAN 내용쓰기 전용: 부모 잠금 뒤 child를 다시 읽고 원 기준을 대조한다. */
  async currentForContent(db: PoolClient, actor: AuthenticatedIdentity, projectId: string, ref: VersionRef) {
    await projectMember(db, actor, projectId, true);
    const discovery = await this.read(db, actor, projectId, ref.id, ref.version);
    if (!same(discovery.ref, ref)) throw new AuthFailure('VERSION_CONFLICT', 409);
    if (discovery.snapshot.definition.parentAssignmentRef === null) return this.current(db, actor, projectId, ref);
    const input = { baseRef: discovery.snapshot.previousRef, definition: discovery.snapshot.definition, reason: discovery.snapshot.reason };
    await this.#parent(db, actor, { projectId, targetId: ref.id }, input);
    const head = (await db.query('SELECT head_version FROM anvil.assignment_drafts WHERE project_id=$1 AND id=$2 FOR UPDATE', [projectId, ref.id])).rows[0];
    if (!head || Number(head.head_version) !== ref.version) throw new AuthFailure('VERSION_CONFLICT', 409);
    const draft = await this.read(db, actor, projectId, ref.id, ref.version);
    if (!same(draft.ref, ref) || !same(draft.snapshot, discovery.snapshot)) throw new AuthFailure('VERSION_CONFLICT', 409);
    if (!same(draft.snapshot.basis, await this.#basis(db, actor, projectId, input))) throw new AuthFailure('ASSIGNMENT_BASIS_CHANGED', 409);
    return draft;
  }
  async list(db: PoolClient, actor: AuthenticatedIdentity, projectId: string, query: Record<string, unknown>, codec: ProjectListCodec) {
    await projectMember(db, actor, projectId);
    if (!query || Object.keys(query).some(key => !['limit', 'cursor'].includes(key)) || query.limit !== undefined && (typeof query.limit !== 'string' || !/^[1-9][0-9]{0,2}$/.test(query.limit) || Number(query.limit) > 200) || query.cursor !== undefined && (typeof query.cursor !== 'string' || query.cursor.length > 4096)) throw new AuthFailure('INPUT_INVALID', 400);
    const limit = query.limit === undefined ? 50 : Number(query.limit), filter = { query: canonicalJson({ projectId, kind: 'ASSIGNMENT_DRAFTS' }), archived: false, limit };
    let position: { at: string; id: string } | null = null;
    if (query.cursor !== undefined) { try { position = codec.read(String(query.cursor), actor.actorId, filter); } catch { throw new AuthFailure('CURSOR_INVALID', 400); } }
    const rows = (await db.query(select + 'WHERE v.project_id=$1 AND v.version=d.head_version AND ($2::timestamptz IS NULL OR (d.updated_at,d.id)<($2::timestamptz,$3::uuid)) ORDER BY d.updated_at DESC,d.id DESC LIMIT $4', [projectId, position?.at ?? null, position?.id ?? null, limit + 1])).rows;
    const visible = rows.slice(0, limit), hasMore = rows.length > limit, last = visible.at(-1);
    const items = visible.map(row => { const view = this.#view(row, projectId, row.draft_id, Number(row.version)); return { ref: view.ref, status: 'DRAFT', goal: view.snapshot.definition.goal, taskRef: view.snapshot.definition.taskRef, issueCount: view.snapshot.readinessIssues.length, updatedAt: row.updated_at.toISOString(), ready: false, executionAuthorized: false }; });
    return { items, hasMore, nextCursor: hasMore ? codec.create(actor.actorId, filter, { at: last!.cursor_at, id: last!.draft_id }) : null, observedAt: new Date().toISOString() };
  }
}
