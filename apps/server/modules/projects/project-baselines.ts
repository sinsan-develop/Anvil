import {AccessRepository} from '../access/repository.ts';
import {readDocumentInventoryInput} from '../backups/document-inventory-input.ts';
import {notificationSessionDeadline} from '../notifications/notification-input.ts';
import {createArtifactBackupReadBudget,readArtifactBackupReadUsage,tightenArtifactBackupReadDeadline} from '../../storage/artifact-backup-budget-read.ts';
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

 /** FN16 내부 전용. 원 readDraft의 실제 보호 검사를 전후 RC에서 재사용한다. */
 async readDraftHistoryInventory(access:AccessRepository,token:string,csrf:string,value:unknown,signal:AbortSignal):Promise<Record<string,any>>{
  const request=readDocumentInventoryInput(value),started=performance.now();
  if(!(access instanceof AccessRepository)||!(signal instanceof AbortSignal))throw new AuthFailure('INPUT_INVALID',400);
  const specs:ReadonlyArray<{id:number;sql:string;columns:string[];bigint:string[];dates:string[]}>=[
   {"id":1,"sql":"SELECT p.id,p.archived_at,m.participation FROM anvil.projects p JOIN anvil.project_members m ON m.project_id=p.id WHERE p.id=$1 AND m.user_id=$2 AND m.revoked_at IS NULL ","columns":["id","archived_at","participation"],"bigint":[],"dates":["archived_at"]},
   {"id":2,"sql":"SELECT p.id,p.archived_at,m.participation FROM anvil.projects p JOIN anvil.project_members m ON m.project_id=p.id WHERE p.id=$1 AND m.user_id=$2 AND m.revoked_at IS NULL FOR UPDATE OF p,m","columns":["id","archived_at","participation"],"bigint":[],"dates":["archived_at"]},
   {"id":3,"sql":draftsSelect+'WHERE v.project_id=$1 AND v.draft_id=$2 AND v.version=$3',"columns":["project_id","draft_id","version","content_hash","version_json","created_by","client_id","command_id","created_at","head_version","updated_at","operation","state","expected_version","command_actor","command_client","command_external_id","request_hash","control_generation","policy_ref","payload_ref","approval_consumption_id","result_ref","command_scope_kind","command_scope_id","authorization_subject_ref","authorization_policy_ref","receipt_scope_digest","audit_scope_digest","audit_outcome","audit_source_kind","server_sequence","audit_approval_ref","approval_decision_ref","baseline_decision_id","baseline_request_id"],"bigint":["version","head_version","expected_version","control_generation","server_sequence"],"dates":["created_at","updated_at"]},
   {"id":4,"sql":"SELECT b.*,c.operation,c.state command_state,c.actor_id command_actor,c.client_id command_client,c.result_ref command_result,r.command_id receipt_command\n   FROM anvil.project_source_declarations b LEFT JOIN anvil.commands c ON c.id=b.command_id AND c.project_id=b.project_id\n   LEFT JOIN anvil.authorization_receipts r ON r.id=c.authorization_receipt_id AND r.command_id=c.id\n   WHERE b.project_id=$1 FOR SHARE OF b","columns":["project_id","declaration_id","declaration_version","created_by","client_id","command_id","created_at","operation","command_state","command_actor","command_client","command_result","receipt_command"],"bigint":["declaration_version"],"dates":["created_at"]},
   {"id":5,"sql":"SELECT s.*,c.operation,c.actor_id,c.client_id command_client,c.expected_version,c.result_ref FROM anvil.source_declaration_versions s JOIN anvil.commands c ON c.id=s.command_id AND c.draft_id=s.draft_id JOIN anvil.authorization_receipts r ON r.id=c.authorization_receipt_id AND r.command_id=c.id WHERE s.id=$1 AND s.version=$2","columns":["id","version","draft_id","draft_version","declared_by","client_id","content_hash","declaration_json","authority","readiness","command_id","created_at","operation","actor_id","command_client","expected_version","result_ref"],"bigint":["version","draft_version","expected_version"],"dates":["created_at"]},
   {"id":6,"sql":"SELECT * FROM anvil.source_snapshots WHERE project_id=$1 AND id=$2 AND version=1","columns":["project_id","id","version","grant_id","report_command_id","source_root_id","source_root_version","connector_id","generation","scope_digest","report_json","content_hash","signature","observed_at","finished_at","received_at","evidence_class","os_verification"],"bigint":["source_root_version","generation"],"dates":["observed_at","finished_at","received_at"]},
   {"id":7,"sql":"SELECT g.*,c.operation created_operation,c.state created_state,c.actor_id created_actor,c.client_id created_client,c.expected_version created_expected_version,c.result_ref created_result,v.declaration_json source_declaration_json,v.status source_status,v.authority source_authority,v.readiness source_readiness,v.reason source_reason,v.content_hash source_content_hash,r.head_version source_head_version FROM anvil.source_read_grants g JOIN anvil.commands c ON c.project_id=g.project_id AND c.id=g.created_command_id JOIN anvil.source_root_versions v ON v.project_id=g.project_id AND v.root_id=g.source_root_id AND v.version=g.source_root_version JOIN anvil.source_roots r ON r.project_id=v.project_id AND r.id=v.root_id WHERE g.project_id=$1 AND g.id=$2 ","columns":["project_id","id","version","source_root_id","source_root_version","source_root_hash","connector_id","connector_generation","registration_id","registration_version","requested_by","client_id","session_id","credential_generation","control_generation","policy_ref","scope_json","scope_digest","created_command_id","created_at","expires_at","revoked_at","revoke_command_id","exchange_failures","created_operation","created_state","created_actor","created_client","created_expected_version","created_result","source_declaration_json","source_status","source_authority","source_readiness","source_reason","source_content_hash","source_head_version"],"bigint":["source_root_version","connector_generation","registration_version","credential_generation","control_generation","created_expected_version","source_head_version"],"dates":["created_at","expires_at","revoked_at"]},
   {"id":8,"sql":"SELECT id,project_id,grant_id,connector_id,connector_generation,scope,scope_digest,issued_at,expires_at,consumed_at FROM anvil.source_read_credentials WHERE project_id=$1 AND grant_id=$2","columns":["id","project_id","grant_id","connector_id","connector_generation","scope","scope_digest","issued_at","expires_at","consumed_at"],"bigint":["connector_generation"],"dates":["issued_at","expires_at","consumed_at"]},
   {"id":9,"sql":"SELECT EXISTS(SELECT 1 FROM anvil.audit_events WHERE project_id=$1 AND outcome='APPLIED' AND source_kind='SOURCE_OBSERVATION_PROTOCOL' AND reason_code='SOURCE_READ_REPORT_STORED' AND target_ref=$2::jsonb AND scope_digest=$3 AND actor_ref=$4::jsonb AND client_ref=$5 AND policy_ref=$6::jsonb) ok","columns":["ok"],"bigint":[],"dates":[]},
   {"id":10,"sql":"SELECT * FROM anvil.artifacts WHERE project_id=$1 AND id=$2 FOR SHARE","columns":["id","project_id","draft_id","bytes","content_hash","media_type","storage_key","state","created_by","client_id","command_id","created_at","inspection_json"],"bigint":["bytes"],"dates":["created_at"]},
   {"id":11,"sql":"SELECT v.*,d.confirmed_version FROM anvil.document_versions v JOIN anvil.documents d ON d.id=v.document_id AND d.project_id=v.project_id WHERE v.project_id=$1 AND v.document_id=$2 AND v.version=$3","columns":["stage_application_id","project_id","document_id","version","form_definition_id","form_version","form_hash","stage_ref_json","body_artifact_id","title","source_refs_json","content_json","content_hash","sections_json","author_ref_json","validation_json","reason","client_id","command_id","created_at","confirmed_version"],"bigint":["version","form_version","confirmed_version"],"dates":["created_at"]},
   {"id":12,"sql":"SELECT * FROM anvil.project_methodologies WHERE project_id=$1 AND ($2::uuid IS NULL OR id=$2) ORDER BY application_version DESC LIMIT 1","columns":["id","project_id","application_version","source_definition_id","source_version","source_hash","snapshot_json","snapshot_hash","created_by","created_at","application_command_id"],"bigint":["application_version","source_version"],"dates":["created_at"]},
   {"id":13,"sql":"SELECT * FROM anvil.artifacts WHERE id=$1 AND project_id=$2 AND content_hash=$3 AND bytes=$4 AND media_type=$5","columns":["id","project_id","draft_id","bytes","content_hash","media_type","storage_key","state","created_by","client_id","command_id","created_at","inspection_json"],"bigint":["bytes"],"dates":["created_at"]},
   {"id":14,"sql":"SELECT definition_json FROM anvil.form_versions WHERE definition_id=$1 AND version=$2 AND content_hash=$3","columns":["definition_json"],"bigint":[],"dates":[]},
   {"id":15,"sql":"SELECT r.*,a.server_sequence FROM anvil.content_reviews r JOIN anvil.audit_events a ON a.project_id=r.project_id AND a.command_id=r.command_id WHERE r.scope_kind='PROJECT' AND r.project_id=$1 AND r.target_kind='DOCUMENT' AND r.target_id=$2 AND r.target_version=$3 AND r.target_hash=$4 ORDER BY a.server_sequence DESC LIMIT 200","columns":["id","scope_kind","scope_id","owner_user_id","project_id","draft_id","target_kind","target_id","target_version","target_hash","criteria_version","criteria_snapshot_json","items_json","outcome","reviewer_user_id","client_id","reviewer_subject_ref","source_kind","reason","command_id","created_at","server_sequence"],"bigint":["target_version","criteria_version","server_sequence"],"dates":["created_at"]},
   {"id":16,"sql":"SELECT event_kind,actor_ref,reason,created_at,id FROM anvil.document_version_events WHERE project_id=$1 AND document_id=$2 AND version=$3 UNION ALL SELECT 'CONFIRMED',jsonb_build_object('kind','HUMAN','userId',confirmed_by),'별도 명시 확정',created_at,id FROM anvil.document_confirmations WHERE project_id=$1 AND document_id=$2 AND version=$3 ORDER BY created_at,id","columns":["event_kind","actor_ref","reason","created_at","id"],"bigint":[],"dates":["created_at"]},
   {"id":17,"sql":"SELECT import_id FROM anvil.document_import_selections WHERE project_id=$1 AND document_id=$2 AND version=$3","columns":["import_id"],"bigint":[],"dates":[]},
   {"id":18,"sql":"SELECT p.id FROM anvil.document_proposals p WHERE p.project_id=$1 AND p.document_id=$2 AND (p.base_version=$3 OR EXISTS(SELECT 1 FROM anvil.document_proposal_selections s WHERE s.project_id=p.project_id AND s.proposal_id=p.id AND s.version=$3)) ORDER BY p.created_at,p.id","columns":["id"],"bigint":[],"dates":[]},
   {"id":19,"sql":"SELECT r.*,c.operation,c.actor_id,c.client_id command_client,c.result_ref FROM anvil.approval_requests r JOIN anvil.commands c ON c.id=r.command_id AND c.project_id=r.project_id WHERE r.project_id=$1 AND r.id=$2","columns":["id","project_id","version","candidate_command_id","action_scope_json","scope_digest","details_json","required_decider_ref","status","expires_at","created_by","created_at","client_id","command_id","policy_ref","content_hash","request_json","operation","actor_id","command_client","result_ref"],"bigint":["version"],"dates":["expires_at","created_at"]},
   {"id":20,"sql":"SELECT d.*,c.operation,c.actor_id,c.client_id command_client,c.expected_version,c.result_ref FROM anvil.approval_decisions d JOIN anvil.commands c ON c.id=d.command_id AND c.project_id=d.project_id WHERE d.project_id=$1 AND d.request_id=$2","columns":["id","project_id","request_id","request_version","scope_digest","decision","reason","decided_by","client_id","control_generation","decided_at","command_id","content_hash","decision_json","operation","actor_id","command_client","expected_version","result_ref"],"bigint":["request_version","control_generation","expected_version"],"dates":["decided_at"]},
   {"id":21,"sql":"SELECT ac.*,c.command_id candidate_command_id,c.request_hash,c.actor_id,c.client_id,c.control_generation,c.policy_ref,c.payload_ref,c.state,c.result_ref,c.operation,c.expected_version,c.approval_consumption_id,ar.approval_decision_ref FROM anvil.approval_consumptions ac JOIN anvil.commands c ON c.project_id=ac.project_id AND c.id=ac.command_id JOIN anvil.authorization_receipts ar ON ar.id=c.authorization_receipt_id AND ar.command_id=c.id AND ar.scope_kind='PROJECT' AND ar.scope_id=c.project_id WHERE ac.project_id=$1 AND ac.decision_id=$2","columns":["id","project_id","decision_id","command_id","scope_digest","policy_id","policy_version","consumed_at","candidate_command_id","request_hash","actor_id","client_id","control_generation","policy_ref","payload_ref","state","result_ref","operation","expected_version","approval_consumption_id","approval_decision_ref"],"bigint":["policy_version","control_generation","expected_version"],"dates":["consumed_at"]},
   {"id":22,"sql":"SELECT p.id,p.head_version,v.rules_json,v.content_hash,v.reason,v.review_refs,v.created_at FROM anvil.permission_policies p JOIN anvil.permission_policy_versions v ON v.policy_id=p.id AND v.project_id=p.project_id AND v.version=p.head_version WHERE p.project_id=$1 FOR SHARE OF p","columns":["id","head_version","rules_json","content_hash","reason","review_refs","created_at"],"bigint":["head_version"],"dates":["created_at"]},
   {"id":23,"sql":"SELECT actor_id,client_id,generation,revoked_at FROM anvil.project_control WHERE project_id=$1","columns":["actor_id","client_id","generation","revoked_at"],"bigint":["generation"],"dates":["revoked_at"]},
   {"id":24,"sql":"SELECT clock_timestamp() at","columns":["at"],"bigint":[],"dates":["at"]},
   {"id":25,"sql":"SELECT project_id,id,head_version,created_by,client_id,created_at,updated_at FROM anvil.baseline_drafts WHERE project_id=$1 AND ($2::uuid IS NULL OR id>$2) ORDER BY id LIMIT 200","columns":["project_id","id","head_version","created_by","client_id","created_at","updated_at"],"bigint":["head_version"],"dates":["created_at","updated_at"]},
   {"id":26,"sql":"SELECT project_id,draft_id,version,content_hash,version_json,created_by,client_id,command_id,created_at FROM anvil.baseline_draft_versions WHERE project_id=$1 AND ($2::uuid IS NULL OR (draft_id,version)>($2::uuid,$3::bigint)) ORDER BY draft_id,version LIMIT 200","columns":["project_id","draft_id","version","content_hash","version_json","created_by","client_id","command_id","created_at"],"bigint":["version"],"dates":["created_at"]}
  ];
  const normalize=(s:string)=>s.trim().replace(/\s+/g,' '),bySql=new Map(specs.map(v=>[normalize(v.sql),v]));
  const own=new WeakSet<AuthFailure>();let sticky:AuthFailure|undefined,cleanupUnknown=false,metadataUsed=0,authDeadline=Infinity,identity:AuthenticatedIdentity|undefined,budget:ArtifactBackupReadBudget|undefined,baseFingerprint:string|undefined,proofFingerprint:string|undefined;
  const hash=(v:unknown)=>contentHash(canonicalJson(v));
  const failure=(code='FEATURE_BASELINE_DRAFT_HISTORY_STORAGE_FAILED',status=503)=>{const e=new AuthFailure(code,status);own.add(e);sticky??=e;return e;};
  const fail=(code='FEATURE_BASELINE_DRAFT_HISTORY_STORAGE_FAILED',status=503):never=>{throw failure(code,status);};
  const remaining=()=>Math.floor(Math.min(request.limits.deadlineMs-(performance.now()-started),authDeadline-performance.now(),2147483647));
  const check=()=>{if(cleanupUnknown)fail();if(sticky)throw sticky;if(signal.aborted)fail('FEATURE_BASELINE_DRAFT_HISTORY_CANCELLED',409);if(remaining()<1)fail('FEATURE_BASELINE_DRAFT_HISTORY_DEADLINE',413);};
  const charge=(n:number)=>{check();if(!Number.isSafeInteger(n)||n<0||n>request.limits.metadataBytes-metadataUsed)fail('FEATURE_BASELINE_DRAFT_HISTORY_LIMIT',413);metadataUsed+=n;};
  const artifacts=new Map<string,{artifactId:string;bytes:number;contentHash:string;mediaType:string}>();let declaredBytes=0;
  const artifact=(v:any)=>{if(!v||!uuid(v.artifactId)||!Number.isSafeInteger(v.bytes)||v.bytes<0||v.bytes>20*1024*1024||typeof v.contentHash!=='string'||!/^[a-f0-9]{64}$/.test(v.contentHash)||typeof v.mediaType!=='string'||!v.mediaType||v.mediaType.length>200)fail('FEATURE_BASELINE_DRAFT_HISTORY_INTEGRITY_FAILED');const ref={artifactId:v.artifactId,bytes:v.bytes,contentHash:v.contentHash,mediaType:v.mediaType},prior=artifacts.get(ref.artifactId);if(prior){if(!same(prior,ref))fail('FEATURE_BASELINE_DRAFT_HISTORY_INTEGRITY_FAILED');return;}if(artifacts.size>=request.limits.fileCount||ref.bytes>request.limits.inputBytes-declaredBytes)fail('FEATURE_BASELINE_DRAFT_HISTORY_LIMIT',413);declaredBytes+=ref.bytes;artifacts.set(ref.artifactId,ref);};
  async function acquire():Promise<PoolClient>{check();const pending=access.pool.connect();return new Promise((resolve,reject)=>{let done=false;const clean=()=>{clearTimeout(timer);signal.removeEventListener('abort',stop);},stop=()=>{if(done)return;done=true;clean();cleanupUnknown=true;reject(failure());},timer=setTimeout(stop,Math.max(1,remaining()));signal.addEventListener('abort',stop,{once:true});pending.then(db=>{if(done){try{db.release(new Error('FEATURE_BASELINE_LATE_CONNECTION'));}catch{}return;}done=true;clean();resolve(db);},()=>{if(done)return;done=true;clean();reject(failure());});if(signal.aborted)stop();});}
  const rawRows=new WeakMap<object,Record<string,unknown>>(),metadataObservations:Array<{phase:number;query:number;rawHash:string}>=[];let phaseNumber=0;
  const verifyRows=(heads:any[],versions:any[])=>{
   const hm=new Map<string,any>(),vm=new Map<string,any>();for(const h of heads){if(h.project_id!==request.projectId||!uuid(h.id)||!Number.isSafeInteger(Number(h.head_version))||Number(h.head_version)<1||hm.has(h.id))fail('FEATURE_BASELINE_DRAFT_HISTORY_INTEGRITY_FAILED');hm.set(h.id,h);}
   for(const v of versions){const n=Number(v.version),key=v.draft_id+':'+n;if(v.project_id!==request.projectId||!hm.has(v.draft_id)||!Number.isSafeInteger(n)||n<1||vm.has(key)||hash(v.version_json)!==v.content_hash)fail('FEATURE_BASELINE_DRAFT_HISTORY_INTEGRITY_FAILED');const parsed=readBaselineDraftInput(v.version_json.input);if(n===1?parsed.input.baseRef!==null:!parsed.input.baseRef||parsed.input.baseRef.id!==v.draft_id||parsed.input.baseRef.version!==n-1)fail('FEATURE_BASELINE_DRAFT_HISTORY_INTEGRITY_FAILED');if(n>1){const previous=vm.get(v.draft_id+':'+(n-1));if(!previous||parsed.input.baseRef!.contentHash!==previous.content_hash)fail('FEATURE_BASELINE_DRAFT_HISTORY_INTEGRITY_FAILED');}vm.set(key,v);}
   for(const h of heads){const ownVersions=versions.filter(v=>v.draft_id===h.id);if(ownVersions.length!==Number(h.head_version)||!vm.has(h.id+':'+h.head_version))fail('FEATURE_BASELINE_DRAFT_HISTORY_INTEGRITY_FAILED');}
  };
  const rawStored=(h:any[],v:any[])=>({heads:h.map(row=>rawRows.get(row)),versions:v.map(row=>rawRows.get(row))});
  let finalHeads:any[]=[],finalVersions:any[]=[],finalChecks:Record<string,string>={};
  const self=this;
  async function phase(rr:boolean):Promise<void>{
   const phaseId=++phaseNumber,db=await acquire();let released=false,began=false,inTransaction=false,unknown=false,authenticating=false;const phaseProof:any[]=[];
   const discard=()=>{if(released)return;released=true;try{db.release(new Error('FEATURE_BASELINE_OUTCOME_UNKNOWN'));}catch{unknown=true;}};
   async function tracked<T>(pending:Promise<T>,cleanup=false):Promise<T>{return new Promise((resolve,reject)=>{let done=false;const clean=()=>{clearTimeout(timer);if(!cleanup)signal.removeEventListener('abort',stop);},stop=()=>{if(done)return;done=true;unknown=true;cleanupUnknown=true;clean();discard();reject(failure());},timer=setTimeout(stop,Math.max(1,remaining()));if(!cleanup)signal.addEventListener('abort',stop,{once:true});pending.then(v=>{if(done)return;done=true;clean();resolve(v);},e=>{if(done)return;done=true;clean();reject(e);});if(remaining()<1||!cleanup&&signal.aborted)stop();});}
   async function plain(sql:string,values:any[]=[]):Promise<{rows:any[]}>{check();if(inTransaction){await tracked(db.query("SELECT set_config('statement_timeout',$1,true)",[String(Math.max(1,remaining()))]));check();}let result:any;try{result=await tracked(db.query(sql,values));}catch(e){if(own.has(e as AuthFailure))throw e;throw failure();}check();return result;}
   async function data(sql:string,values:any[]=[]):Promise<{rows:any[]}>{
    if(authenticating)return plain(sql,values);check();const found=bySql.get(normalize(sql));if(!found)throw failure('FEATURE_BASELINE_DRAFT_HISTORY_QUERY_UNSUPPORTED');const spec=found;
    const remainingBytes=request.limits.metadataBytes-metadataUsed;if(remainingBytes<1)fail('FEATURE_BASELINE_DRAFT_HISTORY_LIMIT',413);
    let projection=spec.columns.map(c=>spec.bigint.includes(c)?`fn16_source.${c}::text AS ${c}`:spec.dates.includes(c)?`CASE WHEN fn16_source.${c} IS NULL THEN NULL WHEN EXTRACT(YEAR FROM fn16_source.${c} AT TIME ZONE 'UTC') BETWEEN 1 AND 9999 THEN to_char(fn16_source.${c} AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') ELSE 'OUT_OF_RANGE' END AS ${c}`:`fn16_source.${c}`).join(',');
    // Q18 originally orders by a non-returned timestamptz. Keep that SQL type/order internally, then remove it before the legacy row/JSON boundary.
    const sourceSql=spec.id===18?sql.replace('SELECT p.id FROM','SELECT p.id,p.created_at AS fn16_proposal_created_at FROM'):sql;
    if(spec.id===18)projection+=',fn16_source.fn16_proposal_created_at';
    const payloadJson=spec.id===18?"(to_jsonb(fn16_projected)-'fn16_proposal_created_at')":'to_jsonb(fn16_projected)';
    const ordering:Record<number,string>={15:'fn16_projected.server_sequence::numeric DESC',16:'fn16_projected.created_at,fn16_projected.id',18:'fn16_projected.fn16_proposal_created_at,fn16_projected.id',25:'fn16_projected.id',26:'fn16_projected.draft_id,fn16_projected.version::numeric'};
    const ordinal=ordering[spec.id]?`ORDER BY ${ordering[spec.id]}`:'';
    const bounded=`/*FN16_FEATURE_Q${spec.id}*/ WITH fn16_source AS (${sourceSql}), fn16_projected AS (SELECT ${projection} FROM fn16_source), fn16_payload AS (SELECT ROW_NUMBER() OVER(${ordinal}) AS fn16_ordinal,${payloadJson} AS inventory_data,octet_length(${payloadJson}::text) AS row_bytes FROM fn16_projected), fn16_totals AS (SELECT *,SUM(row_bytes::numeric) OVER(ORDER BY fn16_ordinal ROWS UNBOUNDED PRECEDING) AS fn16_total FROM fn16_payload) SELECT CASE WHEN fn16_total<=$${values.length+1}::bigint THEN inventory_data ELSE NULL END AS inventory_data,row_bytes::text AS row_bytes FROM fn16_totals WHERE fn16_total-row_bytes<=$${values.length+1}::bigint ORDER BY fn16_ordinal`;
    const result=await plain(bounded,[...values,remainingBytes]);if(!Array.isArray(result.rows))fail();const rows:any[]=[];
    for(const envelope of result.rows){const size=typeof envelope?.row_bytes==='string'&&/^[0-9]+$/.test(envelope.row_bytes)?Number(envelope.row_bytes):NaN;if(!Number.isSafeInteger(size)||size<1)fail();charge(size);const raw=envelope.inventory_data;if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).length!==spec.columns.length||spec.columns.some(c=>!Object.hasOwn(raw,c)))fail('FEATURE_BASELINE_DRAFT_HISTORY_INTEGRITY_FAILED');
     // Only the finite data queries contribute. Authentication rows never enter data(); historical session/credential identifiers are also excluded here.
     const observationRow={...raw};if(spec.id===7)delete observationRow.session_id;if(spec.id===8)delete observationRow.id;
     const observed={phase:phaseId,query:spec.id,rawHash:hash(observationRow)};charge(Buffer.byteLength(canonicalJson(observed)));metadataObservations.push(observed);
     const row={...raw};for(const c of spec.bigint){if(row[c]===null){if(spec.id===11&&c==='confirmed_version')continue;fail('FEATURE_BASELINE_DRAFT_HISTORY_INTEGRITY_FAILED');}if(typeof row[c]!=='string'||!/^[-]?(?:0|[1-9][0-9]*)$/.test(row[c]))fail('FEATURE_BASELINE_DRAFT_HISTORY_INTEGRITY_FAILED');}for(const c of spec.dates){if(row[c]===null){if(c==='archived_at'||c==='revoked_at')continue;fail('FEATURE_BASELINE_DRAFT_HISTORY_INTEGRITY_FAILED');}if(typeof row[c]!=='string'||!/^([0-9]{4})-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3,6}Z$/.test(row[c])||Number(row[c].slice(0,4))<1||!Number.isFinite(Date.parse(row[c])))fail('FEATURE_BASELINE_DRAFT_HISTORY_INTEGRITY_FAILED');const parsedDate=new Date(row[c]);if(parsedDate.toISOString().slice(0,23)!==row[c].slice(0,23))fail('FEATURE_BASELINE_DRAFT_HISTORY_INTEGRITY_FAILED');row[c]=parsedDate;}
     if([3,19,20,21].includes(spec.id))phaseProof.push({query:spec.id,row:raw});rawRows.set(row,raw);rows.push(row);
    }
    if(spec.id===11)for(const row of rows){const formRef={id:row.form_definition_id,version:Number(row.form_version),contentHash:row.form_hash};if(hash({title:row.title,formRef,stageNodeRef:row.stage_ref_json,content:row.content_json})!==row.content_hash)fail('FEATURE_BASELINE_DRAFT_HISTORY_INTEGRITY_FAILED');artifact(row.content_json?.body);}
    if(spec.id===10||spec.id===13)for(const row of rows){if(row.project_id!==request.projectId)fail('FEATURE_BASELINE_DRAFT_HISTORY_INTEGRITY_FAILED');artifact({artifactId:row.id,bytes:Number(row.bytes),contentHash:row.content_hash,mediaType:row.media_type});}
    check();return{rows};
   }
   async function snapshot(){const heads:any[]=[],versions:any[]=[];let last:string|null=null;for(;;){const rows:any[]=(await data(specs[24]!.sql,[request.projectId,last])).rows;if(rows.length>200)fail();for(const row of rows){if(last!==null&&row.id<=last)fail();heads.push(row);last=row.id;}if(rows.length<200)break;}
    let did:string|null=null,version='0';for(;;){const rows:any[]=(await data(specs[25]!.sql,[request.projectId,did,version])).rows;if(rows.length>200)fail();for(const row of rows){if(did!==null&&(row.draft_id<did||row.draft_id===did&&BigInt(row.version)<=BigInt(version)))fail();versions.push(row);did=row.draft_id;version=String(row.version);}if(rows.length<200)break;}verifyRows(heads,versions);return{heads,versions};}
   try{
    check();began=true;await tracked(db.query(rr?'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY':'BEGIN ISOLATION LEVEL READ COMMITTED'));inTransaction=true;
    let a:AuthenticatedIdentity;if(rr){if(!identity)fail();a=identity!;}else{authenticating=true;try{a=await access.authenticateInTransaction({query:data}as unknown as PoolClient,token,csrf);}finally{authenticating=false;}if(identity&&(a.actorId!==identity.actorId||a.clientId!==identity.clientId||a.credentialGeneration!==identity.credentialGeneration||a.authSession?.id!==identity.authSession?.id))fail('AUTH_REQUIRED',401);identity??=a;}
    const beforeClock=performance.now(),clock=(await plain('SELECT clock_timestamp() AS at')).rows[0]?.at;if(!(clock instanceof Date))fail();authDeadline=Math.min(authDeadline,notificationSessionDeadline(a!,clock,beforeClock));check();
    if(!budget)budget=createArtifactBackupReadBudget({maxBytes:request.limits.inputBytes,deadlineMs:remaining()},signal);else tightenArtifactBackupReadDeadline(budget,remaining());
    const owner=(await data(specs[0]!.sql,[request.projectId,a!.actorId])).rows;if(owner.length!==1||owner[0].id!==request.projectId||owner[0].archived_at!==null||owner[0].participation!=='OWNER')fail('NOT_FOUND',404);
    const tx=(await plain(rr?"SELECT current_setting('transaction_isolation') AS isolation,current_setting('transaction_read_only') AS read_only,pg_current_snapshot()::text AS snapshot":"SELECT current_setting('transaction_isolation') AS isolation")).rows[0];if(!tx||tx.isolation!==(rr?'repeatable read':'read committed')||rr&&(tx.read_only!=='on'||typeof tx.snapshot!=='string'))fail();
    const collected=await snapshot(),storedHash=hash(rawStored(collected.heads,collected.versions));if(baseFingerprint!==undefined&&storedHash!==baseFingerprint)fail('FEATURE_BASELINE_DRAFT_HISTORY_CHANGED');baseFingerprint??=storedHash;
    if(!rr){
     // All known input artifacts and raw document body metadata are counted before exact reads.
     for(const v of collected.versions){const parsed=readBaselineDraftInput(v.version_json.input);for(const item of parsed.input.items){for(const ref of item.evidenceRefs)artifact(ref);if(item.designRef)await data(specs[10]!.sql,[request.projectId,item.designRef.id,item.designRef.version]);}}
     for(const v of collected.versions){let actual:any;try{actual=await self.readDraft({query:data}as unknown as PoolClient,a!,request.projectId,v.draft_id,Number(v.version),budget);}catch(e){check();throw e;}check();if(!same(actual.ref,{id:v.draft_id,version:Number(v.version),contentHash:v.content_hash})||!same(actual.snapshot,v.version_json))fail('FEATURE_BASELINE_DRAFT_HISTORY_CHANGED');charge(Buffer.byteLength(canonicalJson(actual)));check();finalChecks[v.draft_id+':'+v.version]=actual.currentCheck.state;}
     const proof=hash(phaseProof);if(proofFingerprint!==undefined&&proof!==proofFingerprint)fail('FEATURE_BASELINE_DRAFT_HISTORY_CHANGED');proofFingerprint??=proof;finalHeads=collected.heads;finalVersions=collected.versions;
    }else{const end=(await plain("SELECT current_setting('transaction_isolation') AS isolation,current_setting('transaction_read_only') AS read_only,pg_current_snapshot()::text AS snapshot")).rows[0];if(end?.snapshot!==tx.snapshot||end?.isolation!=='repeatable read'||end?.read_only!=='on')fail();}
    check();await tracked(db.query(rr?'ROLLBACK':'COMMIT'));inTransaction=false;began=false;released=true;db.release();check();
   }catch(error){if(!released){if(began)try{await tracked(db.query('ROLLBACK'),true);}catch{unknown=true;cleanupUnknown=true;}if(unknown)discard();else{released=true;try{db.release();}catch{unknown=true;cleanupUnknown=true;}}}if(unknown||cleanupUnknown)throw failure();if(sticky)throw sticky;if(isArtifactBackupReadFailure(error))throw error;if(error instanceof AuthFailure&&['AUTH_REQUIRED','CSRF_INVALID','NOT_FOUND','BASELINE_INTEGRITY_FAILED','ARTIFACT_INTEGRITY_FAILED','SOURCE_READ_INTEGRITY_FAILED','DOCUMENT_INTEGRITY_FAILED','FORM_INTEGRITY_FAILED'].includes(error.message))throw error;throw failure();}
  }
  await phase(false);await phase(true);await phase(false);check();
  const heads=finalHeads.map(h=>({id:h.id,headVersion:Number(h.head_version),metadataHash:hash(rawRows.get(h))})),versions=finalVersions.map(v=>({ref:{id:v.draft_id,version:Number(v.version),contentHash:v.content_hash},provenanceHash:hash({projectId:v.project_id,actorId:v.created_by,clientId:v.client_id,commandId:v.command_id}),currentCheck:finalChecks[v.draft_id+':'+v.version],state:'STORED_DRAFT',contentConfirmed:false,sourceAuthorizationVerified:false,coverageVerified:false,executionAuthorized:false,dispatchPerformed:false}));
  const projection={projectId:request.projectId,heads,versions,selectedEvidenceHash:proofFingerprint,metadataObservationHash:hash(metadataObservations),scope:'FEATURE_BASELINE_DRAFT_HISTORY_ONLY',notCollected:['PROJECT_DRAFT_ATTACHMENTS_CONTROL_HANDOFF_BASELINE_DRAFTS','FEATURE_BASELINE_REVIEWS_AND_ADOPTIONS','FULL_PROJECT_AND_SOURCE_BYTES'],atomicSnapshotVerified:false,fullProjectCoverage:false,restorable:false,authorizationRestoration:false,executionAuthorized:false,dispatchPerformed:false};charge(Buffer.byteLength(canonicalJson(projection)));check();
  const result:any={kind:'FEATURE_BASELINE_DRAFT_HISTORY_INVENTORY_V1',...projection,inventoryHash:hash(projection),usage:{metadataBytes:0,inputBytes:readArtifactBackupReadUsage(budget!).inputBytes,fileCount:artifacts.size}};
  for(let i=0;i<17;i++){const n=Buffer.byteLength(canonicalJson(result));check();if(n>request.limits.metadataBytes-metadataUsed)fail('FEATURE_BASELINE_DRAFT_HISTORY_LIMIT',413);const total=metadataUsed+n;if(result.usage.metadataBytes===total){check();return result;}result.usage.metadataBytes=total;}return fail();
 }

 listDrafts(db: PoolClient, actor: AuthenticatedIdentity, pid: string, query: Record<string, unknown>, codec: ProjectListCodec) { return this.#list(db, actor, pid, query, codec, 'DRAFTS'); }
 list(db: PoolClient, actor: AuthenticatedIdentity, pid: string, query: Record<string, unknown>, codec: ProjectListCodec) { return this.#list(db, actor, pid, query, codec, 'ADOPTIONS'); }
}
