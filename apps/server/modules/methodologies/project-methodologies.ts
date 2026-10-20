import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { AuthFailure, type AuthenticatedIdentity } from '../access/repository.ts';
import { currentProjectController, persistProjectReceipt, projectMember, type ProjectCommand } from '../access/project-command.ts';
import { canonicalJson, contentHash } from '../../../../contracts/canonical.ts';
import { isVersionRef } from '../../../../contracts/references.ts';
import type { VersionRef } from '../../../../contracts/generated-types.ts';
import type { MethodologyGraph } from '../../../../contracts/methodologies.ts';
import { validateMethodologyGraph } from './service.ts';
import { methodContentReviewCriteria, requirePreparedForms } from './content-review.ts';
import { exactMethodObject, readProjectMethodInput, readProjectMethodReview } from './project-input.ts';
import { readApplicationSnapshot } from './application-snapshot.ts';
import {inspectArtifact} from '../../storage/sensitive-inspection.ts';

async function formsFor(db: PoolClient, actorId: string) {
  return (await db.query("SELECT v.definition_id AS id,v.version,v.content_hash FROM anvil.form_definitions d JOIN anvil.form_versions v ON v.definition_id=d.id WHERE d.scope='SYSTEM' OR d.scope='USER_COMMON' AND d.owner_user_id=$1", [actorId])).rows.map(r => ({ id: r.id, version: Number(r.version), contentHash: r.content_hash }));
}
export class ProjectMethodologies {
  async readApplication(db: PoolClient, actor: AuthenticatedIdentity, projectId: string, raw: Record<string, unknown> = {}) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) || Object.keys(raw).length) throw new AuthFailure('INPUT_INVALID', 400);
    await projectMember(db, actor, projectId);
    const rows = (await db.query('SELECT id,project_id,application_version,source_definition_id,source_version,source_hash,snapshot_json,snapshot_hash FROM anvil.project_methodologies WHERE project_id=$1 ORDER BY application_version DESC LIMIT 1', [projectId])).rows;
    return readApplicationSnapshot(projectId, rows);
  }
  async list(db: PoolClient, actor: AuthenticatedIdentity, projectId: string, raw: Record<string, unknown>) {
    await projectMember(db, actor, projectId);
    if (Object.keys(raw).some(key => !['limit', 'afterId'].includes(key)) || raw.limit !== undefined && (typeof raw.limit !== 'string' || !/^[1-9][0-9]?$/.test(raw.limit)) || raw.afterId !== undefined && (typeof raw.afterId !== 'string' || !/^[0-9a-f-]{36}$/.test(raw.afterId))) throw new AuthFailure('INPUT_INVALID', 400);
    const limit = raw.limit === undefined ? 20 : Number(raw.limit);
    if (limit > 50) throw new AuthFailure('INPUT_INVALID', 400);
    const rows = (await db.query("SELECT d.id,d.head_version,v.name,v.purpose,v.content_hash FROM anvil.methodology_definitions d JOIN anvil.methodology_versions v ON v.definition_id=d.id AND v.version=d.head_version WHERE d.scope='PROJECT' AND d.project_id=$1 AND ($2::uuid IS NULL OR d.id>$2) ORDER BY d.id LIMIT $3", [projectId, raw.afterId ?? null, limit + 1])).rows;
    const page = rows.slice(0, limit), hasMore = rows.length > limit;
    return { projectId, items: page.map(r => ({ ref: { id: r.id, version: Number(r.head_version), contentHash: r.content_hash }, name: r.name, purpose: r.purpose, scope: 'PROJECT' })), hasMore, nextAfterId: hasMore ? page.at(-1)!.id : null, observedAt: new Date().toISOString(), applicationTransition: 'EXECUTION_STATE_UNVERIFIED' };
  }
  async row(db: PoolClient, projectId: string, id: string, version: number, lock = false) {
    const row = (await db.query(`SELECT v.*,d.head_version FROM anvil.methodology_definitions d JOIN anvil.methodology_versions v ON v.definition_id=d.id AND v.version=$3 WHERE d.id=$2 AND d.project_id=$1 AND d.scope='PROJECT' ${lock ? 'FOR UPDATE OF d' : ''}`, [projectId, id, version])).rows[0];
    if (!row) throw new AuthFailure('NOT_FOUND', 404);
    if (contentHash(canonicalJson(row.graph_json)) !== row.content_hash) throw new AuthFailure('METHODOLOGY_INTEGRITY_FAILED', 503);
    const ref = { id, version, contentHash: row.content_hash };
    const proofs = (await db.query("SELECT c.actor_id,c.result_ref,r.subject_ref FROM anvil.commands c JOIN anvil.authorization_receipts r ON r.command_id=c.id AND r.id=c.authorization_receipt_id AND r.scope_id=c.project_id WHERE c.project_id=$1 AND c.scope_kind='PROJECT' AND c.operation IN('copyMethodology','saveMethodologyDraft') AND c.state='APPLIED' AND c.result_ref->'data'->'ref'=$2::jsonb", [projectId, JSON.stringify(ref)])).rows;
    if (proofs.length) {
      const snapshot = { name: row.name, purpose: row.purpose, graph: row.graph_json, origin: row.origin_ref_json, reason: row.reason };
      if (proofs.length !== 1 || proofs[0].actor_id !== row.created_by || proofs[0].subject_ref?.userId !== row.created_by || canonicalJson(proofs[0].result_ref?.data?.snapshot) !== canonicalJson(snapshot)) throw new AuthFailure('METHODOLOGY_INTEGRITY_FAILED', 503);
    } else {
      const initial = (await db.query('SELECT snapshot_json,snapshot_hash FROM anvil.project_methodologies WHERE project_id=$1 AND source_definition_id=$2 AND source_version=$3 AND source_hash=$4 AND application_version=1', [projectId, id, version, row.content_hash])).rows[0];
      if (version !== 1 || row.origin_ref_json?.kind !== 'DRAFT_CONFIRMED_SOURCE' || !initial || contentHash(canonicalJson(initial.snapshot_json)) !== initial.snapshot_hash || initial.snapshot_json.name !== row.name || initial.snapshot_json.purpose !== row.purpose || canonicalJson(initial.snapshot_json.graph) !== canonicalJson(row.graph_json)) throw new AuthFailure('METHODOLOGY_INTEGRITY_FAILED', 503);
    }
    return row;
  }
  async read(db: PoolClient, actor: AuthenticatedIdentity, projectId: string, id: string, version: number) {
    await projectMember(db, actor, projectId);
    const row = await this.row(db, projectId, id, version), ref = { id, version, contentHash: row.content_hash };
    const reviews = (await db.query("SELECT r.*,a.server_sequence,c.result_ref FROM anvil.content_reviews r JOIN anvil.audit_events a ON a.command_id=r.command_id AND a.project_id=r.project_id JOIN anvil.commands c ON c.id=r.command_id WHERE r.scope_kind='PROJECT' AND r.project_id=$1 AND r.target_kind='METHODOLOGY' AND r.target_id=$2 AND r.target_version=$3 AND r.target_hash=$4 ORDER BY a.server_sequence DESC LIMIT 201", [projectId, id, version, ref.contentHash])).rows;
    if (reviews.length > 200) throw new AuthFailure('METHOD_REVIEW_PAGINATION_NOT_READY', 412);
    for (const r of reviews) if (canonicalJson(r.result_ref?.data?.review) !== canonicalJson({ targetKind: 'METHODOLOGY', targetRef: ref, criteriaVersion: Number(r.criteria_version), items: r.items_json, outcome: r.outcome, reason: r.reason }) || r.result_ref?.data?.reviewRef?.id !== r.id || canonicalJson(r.criteria_snapshot_json) !== canonicalJson(methodContentReviewCriteria)) throw new AuthFailure('METHODOLOGY_INTEGRITY_FAILED', 503);
    const confirmed = (await db.query("SELECT r.*,c.result_ref FROM anvil.methodology_reviews r JOIN anvil.commands c ON c.id=r.command_id JOIN anvil.audit_events a ON a.command_id=c.id AND a.project_id=c.project_id WHERE r.project_id=$1 AND r.definition_id=$2 AND r.version=$3 AND r.target_hash=$4 AND r.decision='CONFIRMED' ORDER BY a.server_sequence DESC LIMIT 1", [projectId, id, version, ref.contentHash])).rows[0];
    if (confirmed && (confirmed.result_ref?.data?.confirmationId !== confirmed.id || canonicalJson(confirmed.result_ref?.data?.reviewRefs) !== canonicalJson(confirmed.review_refs))) throw new AuthFailure('METHODOLOGY_INTEGRITY_FAILED', 503);
    return { projectId, ref, headVersion: Number(row.head_version), name: row.name, purpose: row.purpose, scope: 'PROJECT', systemCode: null, graph: row.graph_json, sourceApproval: row.origin_ref_json, reason: row.reason, createdAt: row.created_at.toISOString(), contentReviewCriteria: methodContentReviewCriteria,
      contentReviews: reviews.map(r => ({ ref: { id: r.id, criteriaVersion: Number(r.criteria_version), targetRef: ref, outcome: r.outcome }, items: r.items_json, reviewer: r.reviewer_subject_ref, sourceKind: r.source_kind, reason: r.reason, reviewedAt: r.created_at.toISOString(), serverSequence: Number(r.server_sequence) })),
      confirmation: confirmed ? { id: confirmed.id, decision: 'CONFIRMED', decidedBy: confirmed.decided_by, decided_at: confirmed.decided_at.toISOString(), reviewRefs: confirmed.review_refs } : null,
      validation: validateMethodologyGraph(row.graph_json, await formsFor(db, actor.actorId)), runtimeReadiness: 'PROJECT_BINDINGS_REQUIRED', applicationTransition: 'EXECUTION_STATE_UNVERIFIED' };
  }
  async save(db: PoolClient, actor: AuthenticatedIdentity, request: ProjectCommand, policyRef: VersionRef) {
    const input = readProjectMethodInput(request.operation, request.payload);
    let id = request.targetId, version = 1, name = input.name as string, purpose: string, graph: unknown, origin: unknown;
    if (request.operation === 'copyMethodology') {
      if (id !== null || request.expectedVersion !== 0 || !isVersionRef(input.sourceRef)) throw new AuthFailure('INPUT_INVALID', 422);
      const ref = input.sourceRef;
      const source = (await db.query("SELECT v.* FROM anvil.methodology_versions v JOIN anvil.methodology_definitions d ON d.id=v.definition_id WHERE d.id=$1 AND v.version=$2 AND (d.scope='SYSTEM' OR d.scope='USER_COMMON' AND d.owner_user_id=$3 OR d.scope='PROJECT' AND d.project_id=$4) FOR SHARE OF d", [ref.id, ref.version, actor.actorId, request.projectId])).rows[0];
      if (!source) throw new AuthFailure('NOT_FOUND', 404);
      if (source.content_hash !== ref.contentHash || contentHash(canonicalJson(source.graph_json)) !== ref.contentHash) throw new AuthFailure('SOURCE_VERSION_CONFLICT', 409);
      id = randomUUID(); purpose = source.purpose; graph = source.graph_json; origin = { kind: 'COPY', parentRef: ref };
    } else {
      purpose = input.purpose as string; graph = input.graph;
      if (id === null) { if (request.expectedVersion !== 0) throw new AuthFailure('VERSION_CONFLICT', 409); id = randomUUID(); origin = { kind: 'USER_AUTHORED' }; }
      else {
        const previous = await this.row(db, request.projectId, id, request.expectedVersion, true);
        if (Number(previous.head_version) !== request.expectedVersion || request.expectedVersion >= Number.MAX_SAFE_INTEGER) throw new AuthFailure('VERSION_CONFLICT', 409);
        version = request.expectedVersion + 1; origin = { kind: 'REVISION', parentRef: { id, version: request.expectedVersion, contentHash: previous.content_hash } };
      }
    }
    const validation = validateMethodologyGraph(graph, await formsFor(db, actor.actorId));
    if (validation.issues.some(item => item.code === 'INPUT_INVALID')) throw new AuthFailure('GRAPH_INPUT_INVALID', 422);
    const ref = { id, version, contentHash: contentHash(canonicalJson(graph)) }, snapshot = { name, purpose, graph, origin, reason: input.reason };
    const receipt = await persistProjectReceipt(db, actor, request, ref, { status: 'DRAFT', validation, snapshot }, policyRef, 'EXPLICIT_PROJECT_METHODOLOGY_REVISION');
    await db.query("SELECT set_config('anvil.methodology_command','PROJECT',true)");
    if (version === 1) await db.query("INSERT INTO anvil.methodology_definitions(id,scope,project_id,name,purpose,head_version) VALUES($1,'PROJECT',$2,$3,$4,1)", [id, request.projectId, name, purpose]);
    await db.query('INSERT INTO anvil.methodology_versions(definition_id,version,name,purpose,graph_json,content_hash,origin_ref_json,reason,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)', [id, version, name, purpose, JSON.stringify(graph), ref.contentHash, JSON.stringify(origin), input.reason, actor.actorId]);
    if (version > 1) await db.query('UPDATE anvil.methodology_definitions SET head_version=$2 WHERE id=$1', [id, version]);
    return receipt.result;
  }
  async review(db: PoolClient, actor: AuthenticatedIdentity, request: ProjectCommand, policyRef: VersionRef) {
    const recording = request.operation === 'recordContentReview', input = recording ? readProjectMethodReview(request.payload) : request.payload;
    if (!recording && !exactMethodObject(input, ['versionRef', 'reviewRefs'])) throw new AuthFailure('INPUT_INVALID', 422);
    const ref = recording ? input.targetRef : input.versionRef;
    if (!isVersionRef(ref) || request.targetId !== ref.id || request.expectedVersion !== ref.version) throw new AuthFailure('INPUT_INVALID', 422);
    const row = await this.row(db, request.projectId, ref.id, ref.version, true);
    if (Number(row.head_version) !== ref.version || row.content_hash !== ref.contentHash) throw new AuthFailure('VERSION_CONFLICT', 409);
    const validation = validateMethodologyGraph(row.graph_json, await formsFor(db, actor.actorId));
    if (recording) {
      const id = randomUUID(), reviewRef = { id, criteriaVersion: 1, targetRef: ref, outcome: input.outcome };
      const receipt = await persistProjectReceipt(db, actor, request, ref, { status: 'REVIEW_RECORDED', reviewRef, review: input }, policyRef, 'EXPLICIT_PROJECT_METHODOLOGY_REVIEW');
      await db.query("INSERT INTO anvil.content_reviews(id,scope_kind,scope_id,project_id,target_kind,target_id,target_version,target_hash,criteria_version,criteria_snapshot_json,items_json,outcome,reviewer_user_id,client_id,reviewer_subject_ref,source_kind,reason,command_id) VALUES($1,'PROJECT',$2,$2,'METHODOLOGY',$3,$4,$5,1,$6,$7,$8,$9,$10,$11,'HUMAN_REVIEW',$12,$13)", [id, request.projectId, ref.id, ref.version, ref.contentHash, JSON.stringify(methodContentReviewCriteria), JSON.stringify(input.items), input.outcome, actor.actorId, actor.clientId, JSON.stringify({ kind: 'HUMAN', userId: actor.actorId, sameAsTargetRecorder: row.created_by === actor.actorId }), input.reason, receipt.id]);
      return receipt.result;
    }
    const view = await this.read(db, actor, request.projectId, ref.id, ref.version);
    if (!validation.validForConfirmation || !Array.isArray(input.reviewRefs) || !input.reviewRefs.length || input.reviewRefs.length > 200 || view.contentReviews[0]?.ref.outcome !== 'ACCEPTED') throw new AuthFailure('CONTENT_REVIEW_REQUIRED', 422);
    const actual = view.contentReviews.filter(item => item.ref.outcome === 'ACCEPTED').map(item => canonicalJson(item.ref)), selected = input.reviewRefs.map(value => canonicalJson(value));
    if (new Set(selected).size !== selected.length || selected.some(value => !actual.includes(value)) || !selected.includes(canonicalJson(view.contentReviews[0]!.ref))) throw new AuthFailure('CONTENT_REVIEW_REQUIRED', 422);
    await requirePreparedForms(db, actor.actorId, row.graph_json as MethodologyGraph);
    const confirmationId = randomUUID();
    const receipt = await persistProjectReceipt(db, actor, request, ref, { status: 'CONFIRMED', confirmationId, reviewRefs: input.reviewRefs, validation }, policyRef, 'EXPLICIT_PROJECT_METHODOLOGY_CONFIRMATION');
    await db.query('INSERT INTO anvil.methodology_reviews(id,project_id,definition_id,version,target_hash,validation_json,review_refs,decision,decided_by,client_id,command_id) VALUES($1,$2,$3,$4,$5,$6,$7,\'CONFIRMED\',$8,$9,$10)', [confirmationId, request.projectId, ref.id, ref.version, ref.contentHash, JSON.stringify(validation), JSON.stringify(input.reviewRefs), actor.actorId, actor.clientId, receipt.id]);
    return receipt.result;
  }
  /** 기존 command transaction 안에서만 사용한다. 이력이 한 건이라도 있으면 기존 영향/안전 절차가 필요하다. */
  async apply(db?:PoolClient,actor?:AuthenticatedIdentity,request?:ProjectCommand,policyRef?:VersionRef) {
    if(!db||!actor||!request||!policyRef)throw new AuthFailure('EXECUTION_STATE_UNVERIFIED',412);
    const p=request.payload;
    if(request.operation!=='applyMethodology'||request.targetId!==request.projectId||!exactMethodObject(p,['methodologyRef','expectedApplicationVersion','reason'])||!isVersionRef(p.methodologyRef)||!Number.isSafeInteger(p.expectedApplicationVersion)||Number(p.expectedApplicationVersion)<0||Number(p.expectedApplicationVersion)>=Number.MAX_SAFE_INTEGER||request.expectedVersion!==p.expectedApplicationVersion||typeof p.reason!=='string'||!p.reason.trim()||p.reason.length>20000||!p.reason.isWellFormed())throw new AuthFailure('METHOD_APPLICATION_INPUT_INVALID',422);
    if(request.baselineRefs.length||request.approvalRef!==null)throw new AuthFailure('METHOD_APPLICATION_REFERENCE_NOT_CONNECTED',412);
    if(inspectArtifact(Buffer.from(canonicalJson(p),'utf8')).state==='SUSPECTED')throw new AuthFailure('METHOD_SENSITIVE_CONTENT_SUSPECTED',412);
    await currentProjectController(db,actor,request);
    const empty=(await db.query('SELECT NOT ('+[
      'assignment_drafts','execution_preparations','agent_sessions','executions','execution_grants','writer_claims','execution_commands'
    ].map(table=>`EXISTS(SELECT 1 FROM anvil.${table} WHERE project_id=$1)`).join(' OR ')+') AS assignment_history_empty',[request.projectId])).rows;
    if(empty.length!==1||empty[0]?.assignment_history_empty!==true)throw new AuthFailure('EXECUTION_STATE_UNVERIFIED',412);
    const application=await this.readApplication(db,actor,request.projectId);
    if((application.applicationRef?.version??0)!==p.expectedApplicationVersion)throw new AuthFailure('VERSION_CONFLICT',409);
    const ref=p.methodologyRef,row=await this.row(db,request.projectId,ref.id,ref.version,true),view=await this.read(db,actor,request.projectId,ref.id,ref.version);
    if(Number(row.head_version)!==ref.version||row.content_hash!==ref.contentHash||view.headVersion!==ref.version||canonicalJson(view.ref)!==canonicalJson(ref))throw new AuthFailure('VERSION_CONFLICT',409);
    const latest=view.contentReviews[0]?.ref;
    if(!view.validation.validForConfirmation||!view.confirmation||latest?.outcome!=='ACCEPTED'||!view.confirmation.reviewRefs.some((value:unknown)=>canonicalJson(value)===canonicalJson(latest)))throw new AuthFailure('CONTENT_REVIEW_REQUIRED',422);
    await requirePreparedForms(db,actor.actorId,view.graph as MethodologyGraph);
    if(application.snapshot&&canonicalJson(application.snapshot.sourceRef)===canonicalJson(ref))throw new AuthFailure('METHODOLOGY_ALREADY_APPLIED',409);
    const snapshot={name:view.name,purpose:view.purpose,graph:view.graph,sourceRef:ref},next={id:randomUUID(),version:Number(p.expectedApplicationVersion)+1,contentHash:contentHash(canonicalJson(snapshot))};
    const receipt=await persistProjectReceipt(db,actor,request,next,{status:'METHODOLOGY_APPLIED',snapshot,reason:p.reason,previousApplicationRef:application.applicationRef},policyRef,'EXPLICIT_EMPTY_PROJECT_METHODOLOGY_APPLICATION');
    await db.query('INSERT INTO anvil.project_methodologies(id,project_id,application_version,source_definition_id,source_version,source_hash,snapshot_json,snapshot_hash,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[next.id,request.projectId,next.version,ref.id,ref.version,ref.contentHash,JSON.stringify(snapshot),next.contentHash,actor.actorId]);
    return receipt.result;
  }
}
