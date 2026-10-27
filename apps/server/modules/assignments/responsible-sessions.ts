import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { canonicalJson, contentHash } from '../../../../contracts/canonical.ts';
import type { VersionRef } from '../../../../contracts/generated-types.ts';
import type { MethodologyGraph } from '../../../../contracts/methodologies.ts';
import { cloneV1, isoV1, recordV1, refV1, uuidV1 } from '../../../../contracts/runtime/validation-v1.ts';
import { AuthFailure, type AuthenticatedIdentity } from '../access/repository.ts';
import { persistProjectReceipt, projectMember, type ProjectCommand } from '../access/project-command.ts';
import { assertKnowledgeTextSafe } from '../knowledge/knowledge-entry.ts';
import type { ProjectMethodologies } from '../methodologies/project-methodologies.ts';
import type { ProjectAssignmentConfirmations } from './project-assignment-confirmations.ts';
import type { ProjectAssignmentDrafts } from './project-assignment-drafts.ts';
import type { ProjectConnectionCandidates } from '../connections/project-candidates.ts';
import {ProjectApprovals} from '../approvals/project-approvals.ts';
import type {ApprovalScope} from '../approvals/approval-input.ts';
import {readApprovalRef} from '../approvals/approval-input.ts';

export const responsibleSessionOperations = ['defineProjectRole', 'bindResponsibleSession'] as const;
/** 승인 대상은 기존 결박의 전체 현재 ref다. payload의 임무/연결 ref를 scope로 승격하지 않는다. */
export async function assertResponsibleSessionApprovalTarget(db:PoolClient,actor:AuthenticatedIdentity,projectId:string,scope:ApprovalScope){
  await projectMember(db,actor,projectId,true);
  if(!responsibleSessionOperations.includes(scope.operation as any)||scope.operation==='defineProjectRole'&&(scope.targetRef!==null||scope.expectedVersion!==0))throw new AuthFailure('APPROVAL_CANDIDATE_MISMATCH',409);
  if(scope.targetRef!==null){
    const rows=(await db.query('SELECT b.* FROM anvil.role_bindings b WHERE b.project_id=$1 AND b.binding_id=$2 ORDER BY b.version DESC LIMIT 1',[projectId,scope.targetRef.id])).rows,b=rows[0];
    if(rows.length!==1||!same(scope.targetRef,{id:b.binding_id,version:Number(b.version),contentHash:b.content_hash})||scope.expectedVersion!==Number(b.version)||contentHash(canonicalJson(b.snapshot_json))!==b.content_hash)throw new AuthFailure('APPROVAL_BASIS_NOT_CURRENT',412);
  }
}
export interface ProjectStageRef { applicationRef: VersionRef; nodeId: string }
export interface ProjectRoleInput {
  kind: 'COORDINATOR' | 'STAGE_OWNER'; stageRef: ProjectStageRef | null; parentRoleRef: VersionRef | null; reason: string;
}
export interface ResponsibleSessionBindingInput {
  assignmentRef: VersionRef; roleRef: VersionRef; connectionRef: VersionRef; existingSessionBindingRef: VersionRef | null; reason: string;
}

const validReason = (value: unknown): value is string => typeof value === 'string' && value.isWellFormed() && !!value.trim() && value.length <= 20000;
function copyInput(value: unknown, code: string): unknown {
  try { const bytes = canonicalJson(value); if (Buffer.byteLength(bytes, 'utf8') > 2 * 1024 * 1024) throw Error(); return JSON.parse(bytes); }
  catch { throw new AuthFailure(code, 422); }
}
function safeReason(value: string) {
  try { assertKnowledgeTextSafe(value); } catch { throw new AuthFailure('RESPONSIBLE_SESSION_SENSITIVE_CONTENT', 412); }
}
export function readProjectRole(value: unknown): ProjectRoleInput {
  const input = copyInput(value, 'PROJECT_ROLE_INPUT_INVALID');
  if (!recordV1(input, ['kind', 'stageRef', 'parentRoleRef', 'reason']) || !validReason(input.reason)
    || !['COORDINATOR', 'STAGE_OWNER'].includes(input.kind)) throw new AuthFailure('PROJECT_ROLE_INPUT_INVALID', 422);
  if (input.kind === 'COORDINATOR') {
    if (input.stageRef !== null || input.parentRoleRef !== null) throw new AuthFailure('PROJECT_ROLE_INPUT_INVALID', 422);
  } else if (!recordV1(input.stageRef, ['applicationRef', 'nodeId']) || !refV1(input.stageRef.applicationRef)
    || typeof input.stageRef.nodeId !== 'string' || !input.stageRef.nodeId.trim() || !input.stageRef.nodeId.isWellFormed() || !refV1(input.parentRoleRef)) {
    throw new AuthFailure('PROJECT_ROLE_INPUT_INVALID', 422);
  }
  safeReason(input.reason); return cloneV1(input) as unknown as ProjectRoleInput;
}
export function readResponsibleSessionBinding(value: unknown): ResponsibleSessionBindingInput {
  const input = copyInput(value, 'RESPONSIBLE_SESSION_INPUT_INVALID');
  if (!recordV1(input, ['assignmentRef', 'roleRef', 'connectionRef', 'existingSessionBindingRef', 'reason'])
    || !refV1(input.assignmentRef) || !refV1(input.roleRef) || !refV1(input.connectionRef)
    || input.existingSessionBindingRef !== null && !refV1(input.existingSessionBindingRef) || !validReason(input.reason)) {
    throw new AuthFailure('RESPONSIBLE_SESSION_INPUT_INVALID', 422);
  }
  safeReason(input.reason); return cloneV1(input) as unknown as ResponsibleSessionBindingInput;
}

const same = (left: unknown, right: unknown) => canonicalJson(left) === canonicalJson(right);
const commandColumns = `,c.result_ref,c.operation,c.state,c.actor_id command_actor,c.client_id command_client,c.request_hash,c.command_id command_key,c.control_generation,c.id server_command_id,c.operation_id,c.authorization_receipt_id,c.approval_consumption_id,c.policy_ref,c.payload_ref,c.expected_version,
 (SELECT COALESCE(jsonb_agg(to_jsonb(ar)),'[]'::jsonb) FROM anvil.authorization_receipts ar WHERE ar.command_id=c.id) receipt_rows,
 (SELECT COALESCE(jsonb_agg(to_jsonb(a)),'[]'::jsonb) FROM anvil.audit_events a WHERE a.command_id=c.id) audit_rows,
 (SELECT COALESCE(jsonb_agg(jsonb_build_object('id',ac.id,'requestId',d.request_id,'decisionId',ac.decision_id)),'[]'::jsonb) FROM anvil.approval_consumptions ac LEFT JOIN anvil.approval_decisions d ON d.id=ac.decision_id AND d.project_id=ac.project_id WHERE ac.command_id=c.id) approval_rows `;
const roleSelect = 'SELECT r.*' + commandColumns + 'FROM anvil.project_roles r LEFT JOIN anvil.commands c ON c.project_id=r.project_id AND c.id=r.command_id ';
const bindingSelect = 'SELECT b.*' + commandColumns + 'FROM anvil.role_bindings b LEFT JOIN anvil.commands c ON c.project_id=b.project_id AND c.id=b.command_id ';
const sessionSelect = 'SELECT s.*' + commandColumns + 'FROM anvil.agent_sessions s LEFT JOIN anvil.commands c ON c.project_id=s.project_id AND c.id=s.command_id ';

/** 기존 HUMAN 명령의 현재 제어/명시 정책 transaction 안에서만 호출한다. 예약은 실행 허가가 아니다. */
export class ResponsibleSessions {
  readonly methods: Pick<ProjectMethodologies, 'readApplication'>;
  readonly assignments: Pick<ProjectAssignmentConfirmations, 'read'>;
  readonly drafts: Pick<ProjectAssignmentDrafts, 'current'>;
  readonly connections: Pick<ProjectConnectionCandidates, 'read'>;
  constructor(methods: Pick<ProjectMethodologies, 'readApplication'>, assignments: Pick<ProjectAssignmentConfirmations, 'read'>,
    drafts: Pick<ProjectAssignmentDrafts, 'current'>, connections: Pick<ProjectConnectionCandidates, 'read'>) {
    this.methods = methods; this.assignments = assignments; this.drafts = drafts; this.connections = connections;
  }
  #envelope(request: ProjectCommand, operation: string, previous: VersionRef | null) {
    if (request.operation !== operation || request.targetId !== (previous?.id ?? null) || request.expectedVersion !== (previous?.version ?? 0)) throw new AuthFailure('VERSION_CONFLICT', 409);
    if (request.approvalRef !== null) readApprovalRef(request.approvalRef);
    if (request.baselineRefs.length) throw new AuthFailure('RESPONSIBLE_SESSION_INPUT_INVALID', 422);
  }
  async #verifyReceipt(db:PoolClient,actor:AuthenticatedIdentity,row: any, ref: VersionRef, snapshot: any, operation: string, status: string) {
    if (!refV1(ref) || row.operation !== operation || row.state !== 'APPLIED' || row.command_actor !== row.created_by || row.command_client !== row.client_id
      || row.result_ref?.projectId !== row.project_id || row.result_ref?.status !== 'APPLIED' || row.result_ref?.data?.status !== status
      || !same(row.result_ref?.data?.ref, ref) || !same(row.result_ref?.data?.snapshot, snapshot) || contentHash(canonicalJson(snapshot)) !== ref.contentHash) throw Error('INTEGRITY');
    const payload=operation==='defineProjectRole'?readProjectRole({kind:snapshot.kind,stageRef:snapshot.stageRef,parentRoleRef:snapshot.parentRoleRef,reason:snapshot.reason}):readResponsibleSessionBinding({assignmentRef:snapshot.assignmentRef,roleRef:snapshot.roleRef,connectionRef:snapshot.connectionRef,existingSessionBindingRef:snapshot.existingSessionBindingRef,reason:snapshot.reason});
    const target=operation==='defineProjectRole'?null:(payload as ResponsibleSessionBindingInput).existingSessionBindingRef,expected=target?.version??0;
    if(!Array.isArray(row.receipt_rows)||row.receipt_rows.length!==1||!Array.isArray(row.audit_rows)||row.audit_rows.length!==1||!Array.isArray(row.approval_rows))throw Error('INTEGRITY');
    const ar=row.receipt_rows[0],audit=row.audit_rows[0];let approvalRef=null;
    if(row.approval_consumption_id!==null){
      if(row.approval_rows.length!==1||row.approval_rows[0].id!==row.approval_consumption_id)throw Error('INTEGRITY');
      const link=row.approval_rows[0],history=await new ProjectApprovals().readResponsibleSessionConsumption(db,actor,row.project_id,link.requestId),r=history.request,used=history.consumption;
      approvalRef={requestId:link.requestId,decisionId:link.decisionId,scopeDigest:r.scopeDigest};
      if(history.storedStatus!=='CONSUMED'||!used||history.decision?.decision!=='APPROVE'||history.decision.id!==link.decisionId
        ||used.id!==row.approval_consumption_id||used.serverCommandId!==row.server_command_id||used.commandId!==row.command_key||used.requestHash!==row.request_hash
        ||r.details.candidateCommandId!==row.command_key||r.details.actionScope.operation!==operation||!same(r.details.actionScope.targetRef,target)
        ||r.details.actionScope.expectedVersion!==expected||r.details.actionScope.payloadHash!==contentHash(canonicalJson(payload))
        ||!same(r.requestedBy,{kind:'HUMAN',userId:row.created_by,clientId:row.client_id})||r.controlGeneration!==Number(row.control_generation)
        ||!same(r.policyRef,row.policy_ref)||!same(row.payload_ref,{kind:'ONE_TIME_APPROVAL_SCOPE',payloadHash:contentHash(canonicalJson(payload)),scopeDigest:r.scopeDigest})
        ||Date.parse(used.consumedAt)<Date.parse(history.decision.decidedAt)||Date.parse(used.consumedAt)>=Date.parse(r.details.expiresAt))throw Error('INTEGRITY');
    }else if(row.approval_rows.length||row.payload_ref!==null)throw Error('INTEGRITY');
    const request={schemaVersion:1,projectId:row.project_id,commandId:row.command_key,clientId:row.client_id,controlGeneration:Number(row.control_generation),operation,targetId:target?.id??null,expectedVersion:expected,baselineRefs:[],approvalRef,payload};
    const scopeDigest=contentHash(canonicalJson({projectId:row.project_id,actorId:row.created_by,clientId:row.client_id,controlGeneration:Number(row.control_generation),requestHash:row.request_hash,policyRef:row.policy_ref,targetRef:ref}));
    if(row.request_hash!==contentHash(canonicalJson(request))||Number(row.expected_version)!==expected||row.server_command_id!==row.command_id
      ||row.result_ref.commandId!==row.command_key||row.result_ref.operationId!==row.operation_id||row.result_ref.targetId!==ref.id||row.result_ref.version!==ref.version
      ||ar.id!==row.authorization_receipt_id||ar.command_id!==row.command_id||ar.scope_kind!=='PROJECT'||ar.scope_id!==row.project_id||!same(ar.subject_ref,{kind:'HUMAN',userId:row.created_by,clientId:row.client_id})
      ||!same(ar.policy_ref,row.policy_ref)||ar.scope_digest!==scopeDigest||ar.approval_decision_ref!==(approvalRef?.decisionId??null)
      ||audit.project_id!==row.project_id||audit.command_id!==row.command_id||audit.operation_id!==row.operation_id||audit.outcome!=='APPLIED'||audit.source_kind!=='HUMAN_COMMAND'
      ||!same(audit.actor_ref,{kind:'HUMAN',userId:row.created_by})||audit.client_ref!==row.client_id||!same(audit.policy_ref,row.policy_ref)||!same(audit.target_ref,ref)||audit.scope_digest!==scopeDigest||!same(audit.approval_ref,approvalRef))throw Error('INTEGRITY');
  }
  async #currentStage(db: PoolClient, actor: AuthenticatedIdentity, projectId: string, stage: ProjectStageRef) {
    const application = await this.methods.readApplication(db, actor, projectId);
    const graph = application.snapshot?.graph as MethodologyGraph | undefined;
    if (!same(application.applicationRef, stage.applicationRef) || !graph?.nodes.some(node => node.nodeId === stage.nodeId && node.role === 'STAGE_OWNER')) {
      throw new AuthFailure('ROLE_STAGE_NOT_CURRENT', 409);
    }
  }
  async define(db: PoolClient, actor: AuthenticatedIdentity, request: ProjectCommand, policyRef: VersionRef) {
    const input = readProjectRole(request.payload); this.#envelope(request, 'defineProjectRole', null);
    await projectMember(db, actor, request.projectId, true);
    if (input.stageRef) {
      await this.#currentStage(db, actor, request.projectId, input.stageRef);
      const parent = await this.readRole(db, actor, request.projectId, input.parentRoleRef!.id, input.parentRoleRef!.version);
      if (!same(parent.ref, input.parentRoleRef) || parent.snapshot.kind !== 'COORDINATOR') throw new AuthFailure('ROLE_PARENT_INVALID', 422);
    }
    const existing = (await db.query(roleSelect + 'WHERE r.project_id=$1', [request.projectId])).rows;
    for (const row of existing) {
      const view = await this.#roleView(db,actor,row);
      if (view.snapshot.kind === input.kind && (input.kind === 'COORDINATOR' || same(view.snapshot.stageRef, input.stageRef))) throw new AuthFailure('PROJECT_ROLE_ALREADY_DEFINED', 409);
    }
    const at = (await db.query('SELECT transaction_timestamp() AS at')).rows[0].at.toISOString();
    const snapshot = { ...input, definedBy: { kind: 'HUMAN', userId: actor.actorId }, definedAt: at };
    const ref = { id: randomUUID(), version: 1, contentHash: contentHash(canonicalJson(snapshot)) };
    if(request.approvalRef!==null)await new ProjectApprovals().authorize(db,actor,request,policyRef);
    await db.query("SELECT set_config('anvil.responsible_session_payload',$1,true)",[canonicalJson(request.payload)]);
    const receipt = await persistProjectReceipt(db, actor, request, ref, { status: 'PROJECT_ROLE_DEFINED', snapshot }, policyRef, 'EXPLICIT_PROJECT_ROLE');
    await db.query('INSERT INTO anvil.project_roles(project_id,role_id,version,content_hash,snapshot_json,created_by,client_id,command_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
      [request.projectId, ref.id, ref.version, ref.contentHash, JSON.stringify(snapshot), actor.actorId, actor.clientId, receipt.id]);
    return receipt.result;
  }
  async #roleView(db:PoolClient,actor:AuthenticatedIdentity,row: any) {
    try {
      const ref = { id: row.role_id, version: Number(row.version), contentHash: row.content_hash }, snapshot = row.snapshot_json;
      await this.#verifyReceipt(db,actor,row, ref, snapshot, 'defineProjectRole', 'PROJECT_ROLE_DEFINED');
      readProjectRole({ kind: snapshot.kind, stageRef: snapshot.stageRef, parentRoleRef: snapshot.parentRoleRef, reason: snapshot.reason });
      if (!recordV1(snapshot, ['kind','stageRef','parentRoleRef','reason','definedBy','definedAt']) || !isoV1(snapshot.definedAt)
        || !same(snapshot.definedBy, { kind: 'HUMAN', userId: row.created_by }) || ref.version !== 1) throw Error();
      return { ref, snapshot: snapshot as ProjectRoleInput & { definedBy: { kind: 'HUMAN'; userId: string }; definedAt: string } };
    } catch { throw new AuthFailure('PROJECT_ROLE_INTEGRITY_FAILED', 503); }
  }
  async readRole(db: PoolClient, actor: AuthenticatedIdentity, projectId: string, id: string, version: number) {
    await projectMember(db, actor, projectId);
    if (!uuidV1(id) || version !== 1) throw new AuthFailure('INPUT_INVALID', 400);
    const row = (await db.query(roleSelect + 'WHERE r.project_id=$1 AND r.role_id=$2 AND r.version=$3', [projectId, id, version])).rows[0];
    if (!row) throw new AuthFailure('NOT_FOUND', 404);
    return { projectId, ...await this.#roleView(db,actor,row) };
  }
  async #bindingView(db:PoolClient,actor:AuthenticatedIdentity,row: any) {
    try {
      const ref = { id: row.binding_id, version: Number(row.version), contentHash: row.content_hash }, snapshot = row.snapshot_json;
      await this.#verifyReceipt(db,actor,row, ref, snapshot, 'bindResponsibleSession', 'RESPONSIBLE_SESSION_RESERVED');
      readResponsibleSessionBinding({ assignmentRef: snapshot.assignmentRef, roleRef: snapshot.roleRef, connectionRef: snapshot.connectionRef, existingSessionBindingRef: snapshot.existingSessionBindingRef, reason: snapshot.reason });
      if (!recordV1(snapshot, ['assignmentRef','roleRef','connectionRef','existingSessionBindingRef','reason','sessionRef','generation','state','externalSessionHandleRef','connectionReadiness','executionAuthorized','dispatchPerformed','boundBy','boundAt'])
        || !refV1(snapshot.sessionRef) || snapshot.sessionRef.id !== row.session_id || snapshot.roleRef.id !== row.role_id || snapshot.generation !== ref.version
        || snapshot.state !== 'RESERVED' || snapshot.externalSessionHandleRef !== null || snapshot.connectionReadiness !== 'CANDIDATE_ONLY'
        || snapshot.executionAuthorized !== false || snapshot.dispatchPerformed !== false || !isoV1(snapshot.boundAt)
        || !same(snapshot.boundBy, { kind: 'HUMAN', userId: row.created_by })) throw Error();
      return { ref, snapshot };
    } catch { throw new AuthFailure('RESPONSIBLE_SESSION_INTEGRITY_FAILED', 503); }
  }
  async readBinding(db: PoolClient, actor: AuthenticatedIdentity, projectId: string, id: string, version: number) {
    await projectMember(db, actor, projectId);
    if (!uuidV1(id) || !Number.isSafeInteger(version) || version < 1) throw new AuthFailure('INPUT_INVALID', 400);
    const row = (await db.query(bindingSelect + 'WHERE b.project_id=$1 AND b.binding_id=$2 AND b.version=$3', [projectId, id, version])).rows[0];
    if (!row) throw new AuthFailure('NOT_FOUND', 404);
    const view = await this.#bindingView(db,actor,row), sessionRef = view.snapshot.sessionRef;
    const session = (await db.query(sessionSelect + 'WHERE s.project_id=$1 AND s.session_id=$2 AND s.version=$3', [projectId, sessionRef.id, sessionRef.version])).rows[0];
    try {
      const snapshot = session?.snapshot_json;
      if(session){const data=session.result_ref?.data;await this.#verifyReceipt(db,actor,session,data?.ref,data?.snapshot,'bindResponsibleSession','RESPONSIBLE_SESSION_RESERVED');}
      if (!session || !same(sessionRef, { id: session.session_id, version: Number(session.version), contentHash: session.content_hash })
        || contentHash(canonicalJson(snapshot)) !== sessionRef.contentHash || !recordV1(snapshot, ['roleRef','connectionRef','state','externalSessionHandleRef','reservedBy','reservedAt'])
        || !same(snapshot.roleRef, view.snapshot.roleRef) || !same(snapshot.connectionRef, view.snapshot.connectionRef)
        || snapshot.state !== 'RESERVED' || snapshot.externalSessionHandleRef !== null || !isoV1(snapshot.reservedAt)
        || !same(snapshot.reservedBy, { kind: 'HUMAN', userId: session.created_by }) || session.state !== 'APPLIED' || session.operation !== 'bindResponsibleSession'
        || session.command_actor !== session.created_by || session.command_client !== session.client_id || session.result_ref?.projectId !== projectId
        || !same(session.result_ref?.data?.snapshot?.sessionRef, sessionRef) || session.result_ref?.data?.status !== 'RESPONSIBLE_SESSION_RESERVED') throw Error();
    } catch { throw new AuthFailure('RESPONSIBLE_SESSION_INTEGRITY_FAILED', 503); }
    return { projectId, ...view };
  }
  async bind(db: PoolClient, actor: AuthenticatedIdentity, request: ProjectCommand, policyRef: VersionRef) {
    const input = readResponsibleSessionBinding(request.payload); this.#envelope(request, 'bindResponsibleSession', input.existingSessionBindingRef);
    await projectMember(db, actor, request.projectId, true);
    const assignment = await this.assignments.read(db, actor, request.projectId, input.assignmentRef.id, input.assignmentRef.version);
    if (assignment.snapshot.definition.parentAssignmentRef != null) throw new AuthFailure('ASSIGNMENT_CHILD_DRAFT_ONLY', 412);
    if (!same(assignment.ref, input.assignmentRef) || assignment.snapshot.contentConfirmed !== true || assignment.snapshot.executionAuthorized !== false || assignment.snapshot.dispatchPerformed !== false) throw new AuthFailure('VERSION_CONFLICT', 409);
    await this.drafts.current(db, actor, request.projectId, assignment.snapshot.draftRef);
    const role = await this.readRole(db, actor, request.projectId, input.roleRef.id, input.roleRef.version);
    if (!same(role.ref, input.roleRef)) throw new AuthFailure('VERSION_CONFLICT', 409);
    if (role.snapshot.stageRef) {
      await this.#currentStage(db, actor, request.projectId, role.snapshot.stageRef);
      const task = assignment.snapshot.definition.taskRef;
      if (!same(task.applicationRef, role.snapshot.stageRef.applicationRef) || task.nodeId !== role.snapshot.stageRef.nodeId) throw new AuthFailure('ROLE_STAGE_MISMATCH', 422);
    }
    const connection = await this.connections.read(db, actor, request.projectId, input.connectionRef.id, input.connectionRef.version);
    if (!same(connection.ref, input.connectionRef)) throw new AuthFailure('VERSION_CONFLICT', 409);
    const connectionHead = (await db.query('SELECT head_version FROM anvil.connection_candidates WHERE project_id=$1 AND id=$2 FOR SHARE', [request.projectId, input.connectionRef.id])).rows[0];
    if (connection.expired || connection.candidate.kind !== 'CONNECTION_CANDIDATE' || Number(connectionHead?.head_version) !== input.connectionRef.version) throw new AuthFailure('CONNECTION_CANDIDATE_NOT_CURRENT', 412);
    const latest = (await db.query(bindingSelect + 'WHERE b.project_id=$1 AND b.role_id=$2 ORDER BY b.version DESC LIMIT 1', [request.projectId, input.roleRef.id])).rows[0];
    let previous: Awaited<ReturnType<ResponsibleSessions['readBinding']>> | null = null;
    if (latest) {
      const view = await this.#bindingView(db,actor,latest);
      if (!input.existingSessionBindingRef || !same(view.ref, input.existingSessionBindingRef) || !same(view.snapshot.connectionRef, input.connectionRef)) throw new AuthFailure('SESSION_REPLACEMENT_REQUIRED', 409);
      previous = await this.readBinding(db, actor, request.projectId, view.ref.id, view.ref.version);
    } else if (input.existingSessionBindingRef !== null) throw new AuthFailure('VERSION_CONFLICT', 409);
    const at = (await db.query('SELECT transaction_timestamp() AS at')).rows[0].at.toISOString();
    const session = { roleRef: input.roleRef, connectionRef: input.connectionRef, state: 'RESERVED', externalSessionHandleRef: null, reservedBy: { kind: 'HUMAN', userId: actor.actorId }, reservedAt: at };
    const sessionRef = previous?.snapshot.sessionRef ?? { id: randomUUID(), version: 1, contentHash: contentHash(canonicalJson(session)) };
    const version = (previous?.ref.version ?? 0) + 1;
    const snapshot = { ...input, sessionRef, generation: version, state: 'RESERVED', externalSessionHandleRef: null, connectionReadiness: 'CANDIDATE_ONLY', executionAuthorized: false, dispatchPerformed: false, boundBy: { kind: 'HUMAN', userId: actor.actorId }, boundAt: at };
    const ref = { id: previous?.ref.id ?? randomUUID(), version, contentHash: contentHash(canonicalJson(snapshot)) };
    if(request.approvalRef!==null)await new ProjectApprovals().authorize(db,actor,request,policyRef);
    await db.query("SELECT set_config('anvil.responsible_session_payload',$1,true)",[canonicalJson(request.payload)]);
    const receipt = await persistProjectReceipt(db, actor, request, ref, { status: 'RESPONSIBLE_SESSION_RESERVED', snapshot }, policyRef, 'EXPLICIT_SESSION_RESERVATION_ONLY');
    if (!previous) await db.query('INSERT INTO anvil.agent_sessions(project_id,session_id,version,content_hash,snapshot_json,created_by,client_id,command_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)', [request.projectId, sessionRef.id, sessionRef.version, sessionRef.contentHash, JSON.stringify(session), actor.actorId, actor.clientId, receipt.id]);
    await db.query('INSERT INTO anvil.role_bindings(project_id,binding_id,version,role_id,session_id,content_hash,snapshot_json,created_by,client_id,command_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [request.projectId, ref.id, ref.version, input.roleRef.id, sessionRef.id, ref.contentHash, JSON.stringify(snapshot), actor.actorId, actor.clientId, receipt.id]);
    return receipt.result;
  }
}
