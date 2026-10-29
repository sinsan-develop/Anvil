import {assertArtifactBackupReadBudget,isArtifactBackupReadFailure,type ArtifactBackupReadBudget} from '../../storage/artifact-backup-budget-read.ts';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { canonicalJson, contentHash } from '../../../../contracts/canonical.ts';
import type { VersionRef } from '../../../../contracts/generated-types.ts';
import { isVersionRef } from '../../../../contracts/references.ts';
import { AuthFailure, type AuthenticatedIdentity } from '../access/repository.ts';
import {ProjectApprovals} from '../approvals/project-approvals.ts';
import {readApprovalRef,assertApprovalCandidate,type ApprovalDetails} from '../approvals/approval-input.ts';
import { persistProjectReceipt, projectMember, type ProjectCommand } from '../access/project-command.ts';
import { exact, uuid } from '../knowledge/knowledge-entry.ts';
import type { ProjectDocuments } from '../documents/project-documents.ts';
import type { ProjectBaselineSources } from './baseline-sources.ts';
import { readBaselineDraftInput, type BaselineDraftInput } from './baseline-input.ts';
import { readBaselineContentReview, readBaselineConfirmation, type BaselineContentReview } from './baseline-decision-input.ts';
import type { ProjectListCodec } from './service.ts';

const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
const flags = { sourceAuthorizationVerified: false as const, coverageVerified: false as const, executionAuthorized: false as const, dispatchPerformed: false as const };
type BaselineDraftSnapshot = Pick<Awaited<ReturnType<ProjectBaselineSources['resolve']>>, 'input' | 'sourceBinding' | 'evidenceBindings' | 'issues'> & typeof flags & {
 schemaVersion: 1; contentConfirmed: false; recordedBy: { kind: 'HUMAN'; userId: string }; recordedAt: string;
};
type BaselineReviewSnapshot = { input: BaselineContentReview; reviewedBy: { kind: 'HUMAN'; userId: string }; reviewedAt: string; independence: 'NOT_CLAIMED' };
const receiptColumns = ',c.operation,c.state,c.expected_version,c.actor_id command_actor,c.client_id command_client,c.command_id command_external_id,c.request_hash,c.control_generation,c.policy_ref,c.payload_ref,c.approval_consumption_id,c.result_ref,c.scope_kind command_scope_kind,c.scope_id command_scope_id,ar.subject_ref authorization_subject_ref,ar.policy_ref authorization_policy_ref,ar.scope_digest receipt_scope_digest,a.scope_digest audit_scope_digest,a.outcome audit_outcome,a.source_kind audit_source_kind,a.server_sequence,a.approval_ref audit_approval_ref,ar.approval_decision_ref,ac.decision_id baseline_decision_id,ad.request_id baseline_request_id ';
const receiptJoin = (alias: string) => ` JOIN anvil.commands c ON c.id=${alias}.command_id AND c.project_id=${alias}.project_id JOIN anvil.authorization_receipts ar ON ar.id=c.authorization_receipt_id AND ar.command_id=c.id AND ar.scope_kind='PROJECT' AND ar.scope_id=c.project_id JOIN anvil.audit_events a ON a.command_id=c.id AND a.project_id=c.project_id AND a.operation_id=c.operation_id LEFT JOIN anvil.approval_consumptions ac ON ac.id=c.approval_consumption_id AND ac.command_id=c.id AND ac.project_id=c.project_id LEFT JOIN anvil.approval_decisions ad ON ad.id=ac.decision_id AND ad.project_id=c.project_id `;
const draftsSelect = 'SELECT v.*,d.head_version,d.updated_at' + receiptColumns + 'FROM anvil.baseline_draft_versions v JOIN anvil.baseline_drafts d ON d.project_id=v.project_id AND d.id=v.draft_id' + receiptJoin('v');
const reviewsSelect = 'SELECT r.*' + receiptColumns + 'FROM anvil.baseline_content_reviews r' + receiptJoin('r');
// legacy는 receipt가 없으므로 outer join하며 본문을 공개/현재 head로 승격하지 않는다.
const baselinesSelect = 'SELECT b.*' + receiptColumns + 'FROM anvil.project_baselines b' + receiptJoin('b').replaceAll(/(?<!LEFT) JOIN /g, ' LEFT JOIN ');
const at = async (db: PoolClient): Promise<string> => {
 const value = (await db.query('SELECT transaction_timestamp() AS at')).rows[0]?.at;
 if (!(value instanceof Date) || !Number.isFinite(value.getTime())) throw new AuthFailure('BASELINE_INTEGRITY_FAILED', 503);
 return value.toISOString();
};
function size(value: unknown): void { if (Buffer.byteLength(canonicalJson(value), 'utf8') > 2 * 1024 * 1024) throw new AuthFailure('BASELINE_INPUT_INVALID', 422); }
function timestamp(value: unknown): value is string { return typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value; }

/** 후보 쓰기는 기존 ProjectPolicyRepository.command 인증 transaction 안에서만 호출한다. */
export class ProjectBaselines {
 readonly sources: Pick<ProjectBaselineSources, 'resolve'>;
 readonly documents: Pick<ProjectDocuments, 'version' | 'originalText'>;
 constructor(sources: Pick<ProjectBaselineSources, 'resolve'>, documents: Pick<ProjectDocuments, 'version' | 'originalText'>) { this.sources = sources; this.documents = documents; }
 #envelope(request: ProjectCommand, operation: string, targetId: string | null, expectedVersion: number) {
  if (request.operation !== operation || request.targetId !== targetId || request.expectedVersion !== expectedVersion) throw new AuthFailure('VERSION_CONFLICT', 409);
  if (request.baselineRefs.length) throw new AuthFailure('BASELINE_APPROVAL_NOT_CONNECTED', 412);
  if(request.approvalRef!==null)readApprovalRef(request.approvalRef);
 }
 async #basis(db: PoolClient, actor: AuthenticatedIdentity, pid: string, input: BaselineDraftInput, backupBudget?: ArtifactBackupReadBudget) {
  if(backupBudget!==undefined)assertArtifactBackupReadBudget(backupBudget);
  const resolved = await (backupBudget===undefined?this.sources.resolve(db, actor, pid, input):this.sources.resolve(db, actor, pid, input,backupBudget));
  if(backupBudget!==undefined)assertArtifactBackupReadBudget(backupBudget);
  for (const item of input.items) if (item.designRef) {
   const doc = await (backupBudget===undefined?this.documents.version(db, actor, pid, item.designRef.id, item.designRef.version):this.documents.version(db, actor, pid, item.designRef.id, item.designRef.version,backupBudget));
   if(backupBudget!==undefined)assertArtifactBackupReadBudget(backupBudget);
   if (!same({ id: doc.id, version: doc.version, contentHash: doc.contentHash }, item.designRef)) throw new AuthFailure('BASELINE_DESIGN_MISMATCH', 409);
   if(backupBudget===undefined)await this.documents.originalText(db, pid, doc.content.body);else await this.documents.originalText(db, pid, doc.content.body,backupBudget);
   if(backupBudget!==undefined)assertArtifactBackupReadBudget(backupBudget);
  }
  if(backupBudget!==undefined)assertArtifactBackupReadBudget(backupBudget);
  return { input: resolved.input, sourceBinding: resolved.sourceBinding, evidenceBindings: resolved.evidenceBindings, issues: resolved.issues };
 }
 async #receipt(db:PoolClient,actor:AuthenticatedIdentity,row: any, ref: VersionRef, snapshot: any, operation: string, status: string, payload: unknown, targetId: string | null, expectedVersion: number) {
  let approvalRef=null,approvalDetails:ApprovalDetails|null=null;
  if(row.approval_consumption_id!==null){
   const view=await new ProjectApprovals().read(db,actor,row.project_id,row.baseline_request_id);
   if(!view.consumption||view.storedStatus!=='CONSUMED'||view.consumption.id!==row.approval_consumption_id||view.consumption.serverCommandId!==row.command_id||view.consumption.requestHash!==row.request_hash||view.consumption.commandId!==row.command_external_id||view.decision?.id!==row.baseline_decision_id||row.approval_decision_ref!==row.baseline_decision_id||!same(view.request.policyRef,row.policy_ref))throw Error('BASELINE_APPROVAL_RECEIPT_INVALID');
   approvalDetails=view.request.details;approvalRef=readApprovalRef({requestId:view.request.id,decisionId:view.decision.id,scopeDigest:view.request.scopeDigest});
   if(!same(row.audit_approval_ref,approvalRef)||!same(row.payload_ref,{kind:'ONE_TIME_APPROVAL_SCOPE',payloadHash:contentHash(canonicalJson(payload)),scopeDigest:approvalRef.scopeDigest}))throw Error('BASELINE_APPROVAL_RECEIPT_INVALID');
  }else if(row.payload_ref!==null||row.approval_decision_ref!=null||row.audit_approval_ref!=null)throw Error('BASELINE_APPROVAL_RECEIPT_INVALID');
  const request:ProjectCommand = { schemaVersion: 1, projectId: row.project_id, commandId: row.command_external_id, clientId: row.command_client, controlGeneration: Number(row.control_generation), operation, targetId, expectedVersion, baselineRefs: [], approvalRef, payload:payload as Record<string,unknown> };
  if(approvalDetails)assertApprovalCandidate(approvalDetails,request,row.command_actor,row.project_id);
  const scope = contentHash(canonicalJson({ projectId: row.project_id, actorId: row.command_actor, clientId: row.command_client, controlGeneration: Number(row.control_generation), requestHash: row.request_hash, policyRef: row.policy_ref, targetRef: ref }));
  if (!isVersionRef(ref) || !uuid(row.created_by) || !uuid(row.client_id) || row.operation !== operation || row.state !== 'APPLIED' || Number(row.expected_version) !== expectedVersion
   || row.command_actor !== row.created_by || row.command_client !== row.client_id || row.command_scope_kind !== 'PROJECT' || row.command_scope_id !== row.project_id
   || !same(row.authorization_subject_ref, { kind: 'HUMAN', userId: row.created_by, clientId: row.client_id })
   || !same(row.authorization_policy_ref, row.policy_ref) || row.receipt_scope_digest !== scope || row.audit_scope_digest !== scope || row.audit_outcome !== 'APPLIED' || row.audit_source_kind !== 'HUMAN_COMMAND'
   || !Number.isSafeInteger(Number(row.server_sequence)) || Number(row.server_sequence) < 1 || row.request_hash !== contentHash(canonicalJson(request))
   || contentHash(canonicalJson(snapshot)) !== ref.contentHash || row.result_ref?.status !== 'APPLIED' || row.result_ref.projectId !== row.project_id || row.result_ref.targetId !== ref.id || row.result_ref.version !== ref.version
   || row.result_ref.data?.status !== status || !same(row.result_ref.data.ref, ref) || !same(row.result_ref.data.snapshot, snapshot)) throw Error('BASELINE_RECEIPT_INVALID');
 }
 async #draft(db:PoolClient,actor:AuthenticatedIdentity,row: any, pid: string, id: string, version: number) {
  try {
   const snapshot = row.version_json, ref = { id, version, contentHash: row.content_hash }, analysis = readBaselineDraftInput(snapshot.input);
   if (row.project_id !== pid || row.draft_id !== id || Number(row.version) !== version || Number(row.head_version) < version
    || !exact(snapshot, ['schemaVersion', 'input', 'sourceBinding', 'evidenceBindings', 'issues', 'recordedBy', 'recordedAt', 'contentConfirmed', ...Object.keys(flags)])
    || snapshot.schemaVersion !== 1 || snapshot.contentConfirmed !== false || Object.keys(flags).some(key => snapshot[key] !== false)
    || !same(snapshot.issues, analysis.issues) || !same(snapshot.recordedBy, { kind: 'HUMAN', userId: row.created_by }) || !timestamp(snapshot.recordedAt)
    || (version === 1 ? analysis.input.baseRef !== null : !analysis.input.baseRef || analysis.input.baseRef.id !== id || analysis.input.baseRef.version !== version - 1)
    || !same(snapshot.evidenceBindings, analysis.input.items.map(item => ({ itemId: item.itemId, evidenceRefs: item.evidenceRefs })))) throw Error();
   await this.#receipt(db,actor,row, ref, snapshot, 'saveBaselineDraft', 'BASELINE_DRAFT_STORED', analysis.input, version === 1 ? null : id, version - 1);
   return { projectId: pid, ref, snapshot: structuredClone(snapshot) as BaselineDraftSnapshot, headVersion: Number(row.head_version) };
  } catch { throw new AuthFailure('BASELINE_INTEGRITY_FAILED', 503); }
 }
 async #loadDraft(db: PoolClient, actor: AuthenticatedIdentity, pid: string, id: string, version: number) {
  await projectMember(db, actor, pid);
  if (!uuid(id) || !Number.isSafeInteger(version) || version < 1) throw new AuthFailure('INPUT_INVALID', 400);
  const rows = (await db.query(draftsSelect + 'WHERE v.project_id=$1 AND v.draft_id=$2 AND v.version=$3', [pid, id, version])).rows;
  if (!rows.length) throw new AuthFailure('NOT_FOUND', 404);
  if (rows.length !== 1) throw new AuthFailure('BASELINE_INTEGRITY_FAILED', 503);
  return this.#draft(db,actor,rows[0], pid, id, version);
 }
 async #currentDraft(db: PoolClient, actor: AuthenticatedIdentity, pid: string, ref: VersionRef, checkBasis = true) {
  const row = (await db.query('SELECT head_version FROM anvil.baseline_drafts WHERE project_id=$1 AND id=$2 FOR UPDATE', [pid, ref.id])).rows[0];
  if (!row) throw new AuthFailure('NOT_FOUND', 404);
  if (Number(row.head_version) !== ref.version) throw new AuthFailure('VERSION_CONFLICT', 409);
  const stored = await this.#loadDraft(db, actor, pid, ref.id, ref.version);
  if (!same(stored.ref, ref)) throw new AuthFailure('VERSION_CONFLICT', 409);
  if (checkBasis) {
   const basis = await this.#basis(db, actor, pid, stored.snapshot.input);
   if (!same(basis.sourceBinding, stored.snapshot.sourceBinding) || !same(basis.evidenceBindings, stored.snapshot.evidenceBindings)) throw new AuthFailure('BASELINE_SOURCE_CHANGED', 409);
  }
  return stored;
 }
 async #currentCheck(db: PoolClient, actor: AuthenticatedIdentity, pid: string, snapshot: any, backupBudget?: ArtifactBackupReadBudget) {
  if(backupBudget!==undefined)assertArtifactBackupReadBudget(backupBudget);
  try {
   const basis = await (backupBudget===undefined?this.#basis(db, actor, pid, snapshot.input):this.#basis(db, actor, pid, snapshot.input,backupBudget));
   if(backupBudget!==undefined)assertArtifactBackupReadBudget(backupBudget);
   return same(basis.sourceBinding, snapshot.sourceBinding) && same(basis.evidenceBindings, snapshot.evidenceBindings)
    ? { state: 'MATCHED_METADATA' as const, issues: [] as string[] } : { state: 'CHANGED' as const, issues: ['CURRENT_SOURCE_OR_EVIDENCE_CHANGED'] };
  } catch (error) {
   if(isArtifactBackupReadFailure(error))throw error;
   if (!(error instanceof AuthFailure) || error.statusCode >= 500) throw error;
   return { state: error.statusCode === 409 ? 'CHANGED' as const : 'UNAVAILABLE' as const, issues: ['CURRENT_SOURCE_OR_EVIDENCE_UNAVAILABLE'] };
  }
 }
 async save(db: PoolClient, actor: AuthenticatedIdentity, request: ProjectCommand, policyRef: VersionRef) {
  const input = readBaselineDraftInput(request.payload).input;
  this.#envelope(request, 'saveBaselineDraft', input.baseRef?.id ?? null, input.baseRef?.version ?? 0);
  // 개정 전 이력의 접근불가가 새 입력에서 해당 근거를 제거하는 보완까지 막지는 않는다.
  if (input.baseRef) await this.#currentDraft(db, actor, request.projectId, input.baseRef, false);
  const basis = await this.#basis(db, actor, request.projectId, input), id = request.targetId ?? randomUUID(), version = request.expectedVersion + 1;
  if (!Number.isSafeInteger(version)) throw new AuthFailure('VERSION_CONFLICT', 409);
  const snapshot = { schemaVersion: 1, ...basis, recordedBy: { kind: 'HUMAN', userId: actor.actorId }, recordedAt: await at(db), contentConfirmed: false, ...flags }; size(snapshot);
  const ref = { id, version, contentHash: contentHash(canonicalJson(snapshot)) };
  const receipt = await persistProjectReceipt(db, actor, request, ref, { status: 'BASELINE_DRAFT_STORED', snapshot }, policyRef, 'EXPLICIT_FEATURE_BASELINE_DRAFT');
  if (version === 1) await db.query('INSERT INTO anvil.baseline_drafts(project_id,id,head_version,created_by,client_id) VALUES($1,$2,1,$3,$4)', [request.projectId, id, actor.actorId, actor.clientId]);
  else await db.query('UPDATE anvil.baseline_drafts SET head_version=$3,updated_at=now() WHERE project_id=$1 AND id=$2', [request.projectId, id, version]);
  await db.query('INSERT INTO anvil.baseline_draft_versions(project_id,draft_id,version,content_hash,version_json,created_by,client_id,command_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)', [request.projectId, id, version, ref.contentHash, JSON.stringify(snapshot), actor.actorId, actor.clientId, receipt.id]);
  return receipt.result;
 }
 #reviewAlignment(input: BaselineContentReview, draft: BaselineDraftInput, reviewedAt: string) {
  if (input.items.length !== draft.items.length || input.items.some(item => {
   const original = draft.items.find(candidate => candidate.itemId === item.itemId);
   return !original || original.featureState !== item.featureState || original.evidenceRefs.some(ref => !item.evidenceRefs.some(selected => same(ref, selected)))
    || item.coreEvidence !== null && item.coreEvidence.checkedAt > reviewedAt;
  })) throw new AuthFailure('BASELINE_REVIEW_MISMATCH', 422);
 }
 async #reviewSources(db: PoolClient, actor: AuthenticatedIdentity, pid: string, draft: BaselineDraftInput, input: BaselineContentReview) {
  const reviewed = structuredClone(draft);
  reviewed.items = reviewed.items.map(item => ({ ...item, evidenceRefs: input.items.find(candidate => candidate.itemId === item.itemId)!.evidenceRefs }));
  await this.#basis(db, actor, pid, reviewed);
 }
 async #review(db:PoolClient,actor:AuthenticatedIdentity,row: any) {
  try {
   const snapshot = row.review_json, input = readBaselineContentReview(snapshot.input), ref = { id: row.review_id, version: 1, contentHash: row.content_hash };
   if (!exact(snapshot, ['input', 'reviewedBy', 'reviewedAt', 'independence']) || !same(input.draftRef, { id: row.draft_id, version: Number(row.draft_version), contentHash: row.draft_hash })
    || !same(snapshot.reviewedBy, { kind: 'HUMAN', userId: row.created_by }) || !timestamp(snapshot.reviewedAt) || snapshot.independence !== 'NOT_CLAIMED') throw Error();
   await this.#receipt(db,actor,row, ref, snapshot, 'reviewBaselineContent', 'BASELINE_CONTENT_REVIEWED', input, input.draftRef.id, input.draftRef.version);
   return { ref, snapshot: structuredClone(snapshot) as BaselineReviewSnapshot, serverSequence: Number(row.server_sequence) };
  } catch { throw new AuthFailure('BASELINE_REVIEW_INTEGRITY_FAILED', 503); }
 }
 async #reviews(db: PoolClient, actor:AuthenticatedIdentity,pid: string, ref: VersionRef) {
  return Promise.all((await db.query(reviewsSelect + 'WHERE r.project_id=$1 AND r.draft_id=$2 AND r.draft_version=$3 ORDER BY a.server_sequence DESC LIMIT 201', [pid, ref.id, ref.version])).rows.map(row => this.#review(db,actor,row)));
 }
 async #referencedReview(db: PoolClient, actor:AuthenticatedIdentity,pid: string, ref: VersionRef) {
  const rows = (await db.query(reviewsSelect + 'WHERE r.project_id=$1 AND r.review_id=$2', [pid, ref.id])).rows;
  if (!rows.length) throw new AuthFailure('NOT_FOUND', 404);
  if (rows.length !== 1) throw new AuthFailure('BASELINE_REVIEW_INTEGRITY_FAILED', 503);
  const stored = await this.#review(db,actor,rows[0]);
  if (!same(stored.ref, ref)) throw new AuthFailure('VERSION_CONFLICT', 409);
  return stored;
 }
 async review(db: PoolClient, actor: AuthenticatedIdentity, request: ProjectCommand, policyRef: VersionRef) {
  const input = readBaselineContentReview(request.payload); this.#envelope(request, 'reviewBaselineContent', input.draftRef.id, input.draftRef.version);
  const draft = await this.#currentDraft(db, actor, request.projectId, input.draftRef), reviewedAt = await at(db);
  this.#reviewAlignment(input, draft.snapshot.input, reviewedAt); await this.#reviewSources(db, actor, request.projectId, draft.snapshot.input, input);
  const snapshot = { input, reviewedBy: { kind: 'HUMAN', userId: actor.actorId }, reviewedAt, independence: 'NOT_CLAIMED' }; size(snapshot);
  const ref = { id: randomUUID(), version: 1, contentHash: contentHash(canonicalJson(snapshot)) };
  const receipt = await persistProjectReceipt(db, actor, request, ref, { status: 'BASELINE_CONTENT_REVIEWED', snapshot }, policyRef, 'EXPLICIT_FEATURE_BASELINE_REVIEW');
  await db.query('INSERT INTO anvil.baseline_content_reviews(project_id,review_id,draft_id,draft_version,draft_hash,content_hash,review_json,created_by,client_id,command_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [request.projectId, ref.id, input.draftRef.id, input.draftRef.version, input.draftRef.contentHash, ref.contentHash, JSON.stringify(snapshot), actor.actorId, actor.clientId, receipt.id]);
  return receipt.result;
 }
 async confirm(db: PoolClient, actor: AuthenticatedIdentity, request: ProjectCommand, policyRef: VersionRef) {
  const input = readBaselineConfirmation(request.payload); this.#envelope(request, 'confirmBaseline', input.draftRef.id, input.draftRef.version);
  const pid = request.projectId, draft = await this.#currentDraft(db, actor, pid, input.draftRef);
  if ((await db.query(baselinesSelect + 'WHERE b.project_id=$1 AND b.draft_id=$2 AND b.draft_version=$3', [pid, input.draftRef.id, input.draftRef.version])).rows.length) throw new AuthFailure('VERSION_CONFLICT', 409);
  const latest = (await this.#reviews(db, actor,pid, input.draftRef))[0];
  if (!latest || latest.snapshot.input.outcome !== 'ACCEPTED' || !input.reviewRefs.some(ref => same(ref, latest.ref))) throw new AuthFailure('BASELINE_REVIEW_REQUIRED', 422);
  for (const ref of input.reviewRefs) {
   const review = await this.#referencedReview(db, actor,pid, ref);
   if (!same(review.snapshot.input.draftRef, input.draftRef) || review.snapshot.input.outcome !== 'ACCEPTED') throw new AuthFailure('BASELINE_REVIEW_REQUIRED', 422);
   this.#reviewAlignment(review.snapshot.input, draft.snapshot.input, review.snapshot.reviewedAt);
   await this.#reviewSources(db, actor, pid, draft.snapshot.input, review.snapshot.input);
  }
  const head = (await db.query('SELECT * FROM anvil.baseline_heads WHERE project_id=$1 FOR UPDATE', [pid])).rows[0];
  const previousBaselineRef = head ? { id: head.baseline_id, version: Number(head.baseline_version), contentHash: head.baseline_hash } : null;
  if (previousBaselineRef) { const previous = await this.read(db, actor, pid, previousBaselineRef.id, previousBaselineRef.version); if (!same(previous.ref, previousBaselineRef) || previous.status !== 'FEATURE_STATUS_V1') throw new AuthFailure('BASELINE_INTEGRITY_FAILED', 503); }
  const version = Number((await db.query('SELECT COALESCE(MAX(version),0) version FROM anvil.project_baselines WHERE project_id=$1', [pid])).rows[0].version) + 1;
  if (!Number.isSafeInteger(version)) throw new AuthFailure('VERSION_CONFLICT', 409);
  const snapshot = { schemaVersion: 1, kind: 'FEATURE_STATUS_V1', draftRef: input.draftRef, input: draft.snapshot.input, sourceBinding: draft.snapshot.sourceBinding, evidenceBindings: draft.snapshot.evidenceBindings,
   reviewRefs: input.reviewRefs, previousBaselineRef, reason: input.reason, acknowledged: true, adoptedBy: { kind: 'HUMAN', userId: actor.actorId }, adoptedAt: await at(db), contentConfirmed: true, ...flags }; size(snapshot);
  const ref = { id: randomUUID(), version, contentHash: contentHash(canonicalJson(snapshot)) };
  const receipt = await persistProjectReceipt(db, actor, request, ref, { status: 'FEATURE_BASELINE_ADOPTED', snapshot }, policyRef, 'EXPLICIT_FEATURE_BASELINE_CONTENT_ONLY');
  const source = (draft.snapshot.input as BaselineDraftInput).source.snapshotRef;
  await db.query("INSERT INTO anvil.project_baselines(id,project_id,version,source_snapshot_ref,content_json,content_hash,created_by,baseline_kind,draft_id,draft_version,command_id,client_id,source_snapshot_version,source_snapshot_hash) VALUES($1,$2,$3,$4,$5,$6,$7,'FEATURE_STATUS_V1',$8,$9,$10,$11,$12,$13)", [ref.id, pid, version, source?.id ?? null, JSON.stringify(snapshot), ref.contentHash, actor.actorId, input.draftRef.id, input.draftRef.version, receipt.id, actor.clientId, source?.version ?? null, source?.contentHash ?? null]);
  if (head) await db.query('UPDATE anvil.baseline_heads SET baseline_id=$2,baseline_version=$3,baseline_hash=$4 WHERE project_id=$1', [pid, ref.id, version, ref.contentHash]);
  else await db.query('INSERT INTO anvil.baseline_heads(project_id,baseline_id,baseline_version,baseline_hash) VALUES($1,$2,$3,$4)', [pid, ref.id, version, ref.contentHash]);
  return receipt.result;
 }
 async readDraft(db: PoolClient, actor: AuthenticatedIdentity, pid: string, id: string, version: number, backupBudget?: ArtifactBackupReadBudget) {
  if(backupBudget!==undefined){
   assertArtifactBackupReadBudget(backupBudget);
   const stored=await this.#loadDraft(db,actor,pid,id,version);assertArtifactBackupReadBudget(backupBudget);
   const currentCheck=await this.#currentCheck(db,actor,pid,stored.snapshot,backupBudget);assertArtifactBackupReadBudget(backupBudget);
   const result={...stored,currentCheck,contentConfirmed:false,...flags,observedAt:new Date().toISOString()};assertArtifactBackupReadBudget(backupBudget);return result;
  }
  const stored = await this.#loadDraft(db, actor, pid, id, version);
  return { ...stored, currentCheck: await this.#currentCheck(db, actor, pid, stored.snapshot), contentConfirmed: false, ...flags, observedAt: new Date().toISOString() };
 }
 async read(db: PoolClient, actor: AuthenticatedIdentity, pid: string, id: string, version: number) {
  await projectMember(db, actor, pid);
  if (!uuid(id) || !Number.isSafeInteger(version) || version < 1) throw new AuthFailure('INPUT_INVALID', 400);
  const rows = (await db.query(baselinesSelect + 'WHERE b.project_id=$1 AND b.id=$2 AND b.version=$3', [pid, id, version])).rows;
  if (!rows.length) throw new AuthFailure('NOT_FOUND', 404);
  if (rows.length !== 1) throw new AuthFailure('BASELINE_INTEGRITY_FAILED', 503);
  const row = rows[0];
  if (row.baseline_kind === null) return { projectId: pid, status: 'LEGACY_UNVERIFIED' as const, ref: null, legacyRef: { id, version, contentHash: row.content_hash }, snapshot: null, contentConfirmed: false, currentCheck: { state: 'UNAVAILABLE', issues: ['LEGACY_BINDING_MISSING'] }, ...flags };
  let stored: { ref: VersionRef; snapshot: any };
  const evidenceReviews: BaselineContentReview[] = [];
  try {
   const snapshot = row.content_json, ref = { id, version, contentHash: row.content_hash }, input = readBaselineConfirmation({ draftRef: snapshot.draftRef, reviewRefs: snapshot.reviewRefs, reason: snapshot.reason, acknowledged: snapshot.acknowledged });
   if (row.project_id !== pid || row.id !== id || Number(row.version) !== version || row.baseline_kind !== 'FEATURE_STATUS_V1'
    || !exact(snapshot, ['schemaVersion', 'kind', 'draftRef', 'input', 'sourceBinding', 'evidenceBindings', 'reviewRefs', 'previousBaselineRef', 'reason', 'acknowledged', 'adoptedBy', 'adoptedAt', 'contentConfirmed', ...Object.keys(flags)])
    || snapshot.schemaVersion !== 1 || snapshot.kind !== 'FEATURE_STATUS_V1' || snapshot.contentConfirmed !== true || Object.keys(flags).some(key => snapshot[key] !== false)
    || !same(snapshot.adoptedBy, { kind: 'HUMAN', userId: row.created_by }) || !timestamp(snapshot.adoptedAt) || !(snapshot.previousBaselineRef === null || isVersionRef(snapshot.previousBaselineRef))
    || row.draft_id !== input.draftRef.id || Number(row.draft_version) !== input.draftRef.version) throw Error();
   await this.#receipt(db,actor,row, ref, snapshot, 'confirmBaseline', 'FEATURE_BASELINE_ADOPTED', input, input.draftRef.id, input.draftRef.version);
   const draft = await this.#loadDraft(db, actor, pid, input.draftRef.id, input.draftRef.version);
   if (!same(draft.ref, input.draftRef) || !same(draft.snapshot.input, snapshot.input) || !same(draft.snapshot.sourceBinding, snapshot.sourceBinding) || !same(draft.snapshot.evidenceBindings, snapshot.evidenceBindings)) throw Error();
   const source = (snapshot.input as BaselineDraftInput).source.snapshotRef;
   if (row.source_snapshot_ref !== (source?.id ?? null) || (row.source_snapshot_version === null ? null : Number(row.source_snapshot_version)) !== (source?.version ?? null) || (row.source_snapshot_hash ?? null) !== (source?.contentHash ?? null)) throw Error();
   for (const reviewRef of input.reviewRefs) { const review = await this.#referencedReview(db, actor,pid, reviewRef); if (!same(review.snapshot.input.draftRef, draft.ref) || review.snapshot.input.outcome !== 'ACCEPTED') throw Error(); this.#reviewAlignment(review.snapshot.input, draft.snapshot.input, review.snapshot.reviewedAt); evidenceReviews.push(review.snapshot.input); }
   stored = { ref, snapshot: structuredClone(snapshot) };
  } catch { throw new AuthFailure('BASELINE_INTEGRITY_FAILED', 503); }
  const latest = (await this.#reviews(db, actor,pid, stored.snapshot.draftRef))[0];
  let currentCheck = await this.#currentCheck(db, actor, pid, stored.snapshot);
  if (currentCheck.state === 'MATCHED_METADATA') try {
   for (const input of evidenceReviews) await this.#reviewSources(db, actor, pid, stored.snapshot.input, input);
  } catch (error) {
   if (!(error instanceof AuthFailure) || error.statusCode >= 500) throw error;
   currentCheck = { state: error.statusCode === 409 ? 'CHANGED' : 'UNAVAILABLE', issues: ['CURRENT_REVIEW_EVIDENCE_UNAVAILABLE'] };
  }
  const currentContentReviewValid = currentCheck.state === 'MATCHED_METADATA' && latest?.snapshot.input.outcome === 'ACCEPTED' && stored.snapshot.reviewRefs.some((ref: VersionRef) => same(ref, latest.ref));
  return { projectId: pid, status: 'FEATURE_STATUS_V1' as const, ...stored, currentCheck, currentContentReviewValid, contentConfirmed: true, ...flags, observedAt: new Date().toISOString() };
 }
 async decision(db: PoolClient, actor: AuthenticatedIdentity, pid: string, id: string, version: number) {
  const draft = await this.readDraft(db, actor, pid, id, version), reviews = await this.#reviews(db, actor,pid, draft.ref);
  const adoptedRows = (await db.query(baselinesSelect + 'WHERE b.project_id=$1 AND b.draft_id=$2 AND b.draft_version=$3', [pid, id, version])).rows;
  if (adoptedRows.length > 1) throw new AuthFailure('BASELINE_INTEGRITY_FAILED', 503);
  const adopted = adoptedRows.length ? await this.read(db, actor, pid, adoptedRows[0].id, Number(adoptedRows[0].version)) : null;
  return { projectId: pid, draftRef: draft.ref, criteriaVersion: 1, reviews: reviews.slice(0, 200), hasMoreReviews: reviews.length > 200,
   latestReviewAccepted: reviews[0]?.snapshot.input.outcome === 'ACCEPTED', adoptedRef: adopted?.ref ?? null,
   draftIsHead: draft.ref.version === draft.headVersion, currentCheck: draft.currentCheck, contentConfirmed: adopted?.contentConfirmed ?? false, ...flags, observedAt: new Date().toISOString() };
 }
 async current(db: PoolClient, actor: AuthenticatedIdentity, pid: string) {
  await projectMember(db, actor, pid);
  const rows = (await db.query('SELECT * FROM anvil.baseline_heads WHERE project_id=$1', [pid])).rows;
  if (!rows.length) return { projectId: pid, status: 'UNCONFIRMED' as const, ref: null, contentConfirmed: false, ...flags };
  if (rows.length !== 1) throw new AuthFailure('BASELINE_INTEGRITY_FAILED', 503);
  const head = rows[0], ref = { id: head.baseline_id, version: Number(head.baseline_version), contentHash: head.baseline_hash };
  if (head.project_id !== pid || !isVersionRef(ref)) throw new AuthFailure('BASELINE_INTEGRITY_FAILED', 503);
  const adopted = await this.read(db, actor, pid, ref.id, ref.version);
  if (adopted.status !== 'FEATURE_STATUS_V1' || !same(adopted.ref, ref)) throw new AuthFailure('BASELINE_INTEGRITY_FAILED', 503);
  return adopted;
 }
 async #list(db: PoolClient, actor: AuthenticatedIdentity, pid: string, query: Record<string, unknown>, codec: ProjectListCodec, kind: 'DRAFTS' | 'ADOPTIONS') {
  await projectMember(db, actor, pid);
  if (Object.keys(query).some(key => !['limit', 'cursor'].includes(key)) || query.limit !== undefined && (typeof query.limit !== 'string' || !/^(?:[1-9]|[1-4][0-9]|50)$/.test(query.limit))
   || query.cursor !== undefined && (typeof query.cursor !== 'string' || query.cursor.length > 4096)) throw new AuthFailure('INPUT_INVALID', 400);
  const limit = Number(query.limit ?? 20), filter = { query: canonicalJson({ projectId: pid, kind: 'BASELINE_' + kind }), archived: false, limit };
  let position: { at: string; id: string } | null = null;
  if (query.cursor !== undefined) try { position = codec.read(query.cursor as string, actor.actorId, filter); } catch { throw new AuthFailure('CURSOR_INVALID', 400); }
  const table = kind === 'DRAFTS' ? 'baseline_drafts' : 'project_baselines', timeColumn = kind === 'DRAFTS' ? 'updated_at' : 'created_at';
  const rows = (await db.query(`SELECT id,${kind === 'DRAFTS' ? 'head_version version,NULL::text baseline_kind' : 'version,baseline_kind'},${kind === 'DRAFTS' ? '(SELECT content_hash FROM anvil.baseline_draft_versions v WHERE v.project_id=t.project_id AND v.draft_id=t.id AND v.version=t.head_version)' : 'content_hash'} content_hash,to_char(${timeColumn} AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') cursor_at FROM anvil.${table} t WHERE project_id=$1 AND ($2::timestamptz IS NULL OR (${timeColumn},id)<($2::timestamptz,$3::uuid)) ORDER BY ${timeColumn} DESC,id DESC LIMIT $4`, [pid, position?.at ?? null, position?.id ?? null, limit + 1])).rows;
  const visible = rows.slice(0, limit), items = visible.map(row => {
   const ref = { id: row.id, version: Number(row.version), contentHash: row.content_hash };
   if (!isVersionRef(ref) || kind === 'ADOPTIONS' && ![null, 'FEATURE_STATUS_V1'].includes(row.baseline_kind)) throw new AuthFailure('BASELINE_INTEGRITY_FAILED', 503);
   return kind === 'ADOPTIONS' && row.baseline_kind === null ? { ref: null, legacyRef: ref, status: 'LEGACY_UNVERIFIED' } : { ref, status: kind === 'DRAFTS' ? 'DRAFT' : 'STORED_ADOPTION_NOT_RECHECKED' };
  }), last = visible.at(-1), hasMore = rows.length > limit;
  return { projectId: pid, items, hasMore, nextCursor: hasMore ? codec.create(actor.actorId, filter, { at: last!.cursor_at, id: last!.id }) : null, metadataIntegrity: 'NOT_RECHECKED', ...flags };
 }
 listDrafts(db: PoolClient, actor: AuthenticatedIdentity, pid: string, query: Record<string, unknown>, codec: ProjectListCodec) { return this.#list(db, actor, pid, query, codec, 'DRAFTS'); }
 list(db: PoolClient, actor: AuthenticatedIdentity, pid: string, query: Record<string, unknown>, codec: ProjectListCodec) { return this.#list(db, actor, pid, query, codec, 'ADOPTIONS'); }
}
