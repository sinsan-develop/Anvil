import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { canonicalJson, contentHash } from '../../../../contracts/canonical.ts';
import { isVersionRef } from '../../../../contracts/references.ts';
import type { VersionRef } from '../../../../contracts/generated-types.ts';
import { AuthFailure, type AuthenticatedIdentity } from '../access/repository.ts';
import { persistProjectReceipt, projectMember, type ProjectCommand } from '../access/project-command.ts';
import type { ProjectAssignmentConfirmations } from '../assignments/project-assignment-confirmations.ts';
import { ProjectApprovals } from '../approvals/project-approvals.ts';
import { readApprovalRef, assertApprovalCandidate } from '../approvals/approval-input.ts';
import { uuid, exact } from '../knowledge/knowledge-entry.ts';
import { readContextPreparationInput } from './context-input.ts';
import { buildContextManifest } from './context-manifest.ts';
import type { ProjectContextSources } from './context-sources.ts';

const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
type Manifest = ReturnType<typeof buildContextManifest>['manifest'];
const select = "SELECT b.*,c.operation,c.state,c.expected_version,c.actor_id command_actor,c.client_id command_client,c.command_id command_external_id,c.request_hash,c.control_generation,c.policy_ref,c.payload_ref,c.approval_consumption_id,c.result_ref,c.scope_kind command_scope_kind,c.scope_id command_scope_id,ar.subject_ref authorization_subject_ref,ar.policy_ref authorization_policy_ref,a.scope_digest audit_scope_digest,a.outcome audit_outcome,a.source_kind audit_source_kind,a.approval_ref audit_approval_ref,ar.approval_decision_ref authorization_approval_decision FROM anvil.context_bundles b JOIN anvil.commands c ON c.id=b.command_id AND c.project_id=b.project_id JOIN anvil.authorization_receipts ar ON ar.id=c.authorization_receipt_id AND ar.command_id=c.id AND ar.scope_kind='PROJECT' AND ar.scope_id=c.project_id JOIN anvil.audit_events a ON a.command_id=c.id AND a.project_id=c.project_id AND a.operation_id=c.operation_id AND a.actor_ref=jsonb_build_object('kind','HUMAN','userId',c.actor_id) AND a.client_ref=c.client_id AND a.target_ref=c.result_ref->'data'->'ref' AND a.policy_ref=c.policy_ref AND ar.scope_digest=a.scope_digest ";

/** 기존 ProjectPolicyRepository.command transaction에서만 저장한다. 전달·실행 허가는 생성하지 않는다. */
export class ProjectContexts {
 readonly sources: Pick<ProjectContextSources, 'resolve'>;
 readonly assignments: Pick<ProjectAssignmentConfirmations, 'read'>;
 constructor(sources: Pick<ProjectContextSources, 'resolve'>, assignments: Pick<ProjectAssignmentConfirmations, 'read'>) { this.sources = sources; this.assignments = assignments; }
 async save(db: PoolClient, actor: AuthenticatedIdentity, request: ProjectCommand, policyRef: VersionRef) {
  if (request.operation !== 'buildTaskContext' || request.targetId !== null || request.expectedVersion !== 0) throw new AuthFailure('VERSION_CONFLICT', 409);
  if (request.baselineRefs.length) throw new AuthFailure('REFERENCE_CONNECTION_PENDING', 412);
  if(request.approvalRef!==null)readApprovalRef(request.approvalRef);
  const input = readContextPreparationInput(request.payload);
  const prepared = await this.sources.resolve(db, actor, request.projectId, input), id = randomUUID();
  const { manifest, ref } = buildContextManifest(id, request.projectId, prepared);
  if(request.approvalRef!==null)await db.query("SELECT set_config('anvil.context_payload',$1,true)",[canonicalJson(request.payload)]);
  const receipt = await persistProjectReceipt(db, actor, request, ref, { status: 'CONTEXT_PREPARED', ready: false, executionAuthorized: false, dispatchPerformed: false }, policyRef, 'EXPLICIT_CONTEXT_PREPARATION');
  await db.query('INSERT INTO anvil.context_bundles(project_id,id,version,assignment_id,assignment_version,assignment_hash,assignment_ref,baseline_refs,budget_ref,manifest_json,content_hash,created_by,client_id,command_id,request_payload) VALUES($1,$2,1,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)', [request.projectId, id, input.assignmentRef.id, input.assignmentRef.version, input.assignmentRef.contentHash, JSON.stringify(input.assignmentRef), JSON.stringify(manifest.baselineRefs), JSON.stringify(manifest.budgetRef), JSON.stringify(manifest), ref.contentHash, actor.actorId, actor.clientId, receipt.id, canonicalJson(request.payload)]);
  for (const item of manifest.items) await db.query('INSERT INTO anvil.context_items(project_id,bundle_id,bundle_version,item_id,category,required,source_ref,source_hash,included_state,reason,delivery_parts,issue) VALUES($1,$2,1,$3,$4,true,$5,$6,$7,$8,$9,$10)', [request.projectId, id, item.itemId, item.category, JSON.stringify(item.sourceRef), item.sourceHash, item.includedState, item.reason, JSON.stringify(item.deliveryParts), item.issue]);
  return receipt.result;
 }
 async #stored(db:PoolClient,actor:AuthenticatedIdentity,row: any) {
  try {
   const manifest = row.manifest_json as Manifest, ref = { id: row.id, version: Number(row.version), contentHash: row.content_hash };
   let approvalRef=null;
   if(row.approval_consumption_id!==null){
    const a=readApprovalRef(row.audit_approval_ref),v=await new ProjectApprovals().readContextConsumption(db,actor,row.project_id,a.requestId),used=v.consumption;
    if(!used||v.storedStatus!=='CONSUMED'||v.currentVersion!==3||v.decision?.decision!=='APPROVE'||v.decision.id!==a.decisionId||v.request.scopeDigest!==a.scopeDigest||used.id!==row.approval_consumption_id||used.serverCommandId!==row.command_id||used.commandId!==row.command_external_id||used.requestHash!==row.request_hash||!same(used.policyRef,row.policy_ref)||row.authorization_approval_decision!==a.decisionId||!same(row.payload_ref,{kind:'ONE_TIME_APPROVAL_SCOPE',payloadHash:contentHash(canonicalJson(row.request_payload)),scopeDigest:a.scopeDigest}))throw Error();
    approvalRef=a;
    assertApprovalCandidate(v.request.details,{schemaVersion:1,projectId:row.project_id,commandId:row.command_external_id,clientId:row.command_client,controlGeneration:Number(row.control_generation),operation:'buildTaskContext',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef,payload:row.request_payload},row.command_actor,row.project_id);
   }else if(row.payload_ref!==null||row.audit_approval_ref!=null||row.authorization_approval_decision!=null)throw Error();
   const expectedRequest = { schemaVersion: 1, projectId: row.project_id, commandId: row.command_external_id, clientId: row.command_client, controlGeneration: Number(row.control_generation), operation: 'buildTaskContext', targetId: null, expectedVersion: 0, baselineRefs: [], approvalRef, payload: row.request_payload };
   const scope = contentHash(canonicalJson({ projectId: row.project_id, actorId: row.command_actor, clientId: row.command_client, controlGeneration: Number(row.control_generation), requestHash: row.request_hash, policyRef: row.policy_ref, targetRef: ref }));
   if (!isVersionRef(ref) || ref.version !== 1 || row.operation !== 'buildTaskContext' || row.state !== 'APPLIED' || Number(row.expected_version) !== 0
    || row.command_scope_kind !== 'PROJECT' || row.command_scope_id !== row.project_id || row.command_actor !== row.created_by || row.command_client !== row.client_id
    || !same(row.authorization_subject_ref, { kind: 'HUMAN', userId: row.created_by, clientId: row.client_id }) || !same(row.authorization_policy_ref, row.policy_ref)
    || row.audit_outcome !== 'APPLIED' || row.audit_source_kind !== 'HUMAN_COMMAND' || row.audit_scope_digest !== scope
    || manifest.id !== row.id || manifest.projectId !== row.project_id || manifest.version !== 1 || manifest.ready !== false || manifest.executionAuthorized !== false || manifest.dispatchPerformed !== false
    || !same(manifest.assignmentRef, { id: row.assignment_id, version: Number(row.assignment_version), contentHash: row.assignment_hash }) || !same(manifest.assignmentRef, row.assignment_ref) || !same(manifest.baselineRefs, row.baseline_refs) || !same(manifest.budgetRef, row.budget_ref)
    || contentHash(canonicalJson(manifest)) !== ref.contentHash || row.request_hash !== contentHash(canonicalJson(expectedRequest))
    || row.result_ref?.status !== 'APPLIED' || row.result_ref?.projectId !== row.project_id || row.result_ref?.targetId !== row.id || row.result_ref?.version !== 1
    || row.result_ref?.data?.status !== 'CONTEXT_PREPARED' || !same(row.result_ref.data.ref, ref) || row.result_ref.data.ready !== false || row.result_ref.data.executionAuthorized !== false || row.result_ref.data.dispatchPerformed !== false) throw Error();
   if (!same(readContextPreparationInput(row.request_payload), manifest.preparationInput)) throw Error();
   return { manifest: structuredClone(manifest), ref };
  } catch { throw new AuthFailure('CONTEXT_INTEGRITY_FAILED', 503); }
 }
 async read(db: PoolClient, actor: AuthenticatedIdentity, projectId: string, id: string, version: number) {
  await projectMember(db, actor, projectId);
  if (!uuid(id) || version !== 1) throw new AuthFailure('INPUT_INVALID', 400);
  const rows = (await db.query(select + 'WHERE b.project_id=$1 AND b.id=$2 AND b.version=$3', [projectId, id, version])).rows;
  if (!rows.length) throw new AuthFailure('NOT_FOUND', 404);
  if (rows.length !== 1) throw new AuthFailure('CONTEXT_INTEGRITY_FAILED', 503);
  const stored = await this.#stored(db,actor,rows[0]);
  const items = (await db.query('SELECT item_id,category,required,source_ref,source_hash,included_state,reason,delivery_parts,issue FROM anvil.context_items WHERE project_id=$1 AND bundle_id=$2 AND bundle_version=$3 ORDER BY item_id', [projectId, id, version])).rows;
  if (items.length !== stored.manifest.items.length || new Set(items.map(item => item.item_id)).size !== items.length || items.some(item => !stored.manifest.items.some(expected => same(expected, { itemId: item.item_id, category: item.category, required: item.required, sourceRef: item.source_ref, sourceHash: item.source_hash, includedState: item.included_state, reason: item.reason, deliveryParts: item.delivery_parts, issue: item.issue })))) throw new AuthFailure('CONTEXT_INTEGRITY_FAILED', 503);
  let currentCheck: { state: 'MATCHED_METADATA' | 'CHANGED' | 'UNAVAILABLE'; issues: string[] };
  try {
   const current = await this.sources.resolve(db, actor, projectId, stored.manifest.preparationInput), currentManifest = buildContextManifest(id, projectId, current);
   currentCheck = currentManifest.ref.contentHash === stored.ref.contentHash ? { state: 'MATCHED_METADATA', issues: [] } : { state: 'CHANGED', issues: ['CURRENT_SOURCE_OR_BASIS_CHANGED'] };
  } catch (error) {
   if (!(error instanceof AuthFailure) || error.statusCode !== 409 && error.statusCode !== 412) throw error;
   currentCheck = { state: 'UNAVAILABLE', issues: ['CURRENT_SOURCE_OR_BASIS_UNAVAILABLE'] };
  }
  return { projectId, ...stored, currentCheck, ready: false, executionAuthorized: false, dispatchPerformed: false, observedAt: new Date().toISOString() };
 }
 async list(db: PoolClient, actor: AuthenticatedIdentity, projectId: string, query: Record<string, unknown>) {
  await projectMember(db, actor, projectId);
  if (!exact(query, ['assignmentId', 'assignmentVersion', 'assignmentHash']) && !exact(query, ['assignmentId', 'assignmentVersion', 'assignmentHash', 'limit'])) throw new AuthFailure('INPUT_INVALID', 400);
  if (typeof query.assignmentVersion !== 'string' || !/^[1-9][0-9]{0,14}$/.test(query.assignmentVersion) || query.limit !== undefined && (typeof query.limit !== 'string' || !/^(?:[1-9]|[1-4][0-9]|50)$/.test(query.limit))) throw new AuthFailure('INPUT_INVALID', 400);
  const ref = { id: query.assignmentId, version: Number(query.assignmentVersion), contentHash: query.assignmentHash }, limit = Number(query.limit ?? 20);
  if (!isVersionRef(ref)) throw new AuthFailure('INPUT_INVALID', 400);
  const assignment = await this.assignments.read(db, actor, projectId, ref.id, ref.version);
  if (assignment.projectId !== projectId || !same(assignment.ref, ref)) throw new AuthFailure('VERSION_CONFLICT', 409);
  const rows = (await db.query('SELECT id,version FROM anvil.context_bundles WHERE project_id=$1 AND assignment_id=$2 AND assignment_version=$3 AND assignment_hash=$4 ORDER BY created_at DESC,id DESC LIMIT $5', [projectId, ref.id, ref.version, ref.contentHash, limit + 1])).rows;
  const items = [];
  for (const row of rows.slice(0, limit)) { const read = await this.read(db, actor, projectId, row.id, Number(row.version)); items.push({ ref: read.ref, missingRequired: read.manifest.missingRequired, excluded: read.manifest.excluded, currentCheck: read.currentCheck }); }
  return { projectId, assignmentRef: ref, items, hasMore: rows.length > limit, limit, ready: false, executionAuthorized: false, dispatchPerformed: false, observedAt: new Date().toISOString() };
 }
}
