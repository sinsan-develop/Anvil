import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import type { AuthenticatedIdentity } from '../access/repository.ts';
import { AuthFailure } from '../access/repository.ts';
import { canonicalJson, contentHash } from '../../../../contracts/canonical.ts';
import { validateMethodologyGraph } from '../methodologies/service.ts';
import { methodContentReviewCriteria, requirePreparedForms } from '../methodologies/content-review.ts';
import type { DraftMethodSelection } from '../../../../contracts/project-drafts.ts';

export interface DraftOperation { schemaVersion: 1; commandId: string; clientId: string; targetId: string; expectedVersion: number; operation: 'recordContentReview' | 'confirmDraftMethodology'; payload: Record<string, unknown> }
export interface StoredDraft { id: string; owner_user_id: string; client_id: string; version: string; consumed_project_id: string | null; input_json: { methodologySelection?: DraftMethodSelection | null } }
function exact(value: unknown, keys: string[]): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key)); }
const nonempty = (value: unknown) => typeof value === 'string' && !!value.trim() && value.length <= 20_000;
const outcomes = ['ACCEPTED', 'REWORK', 'BLOCKED', 'NOT_EXECUTED'];
async function validation(db: PoolClient, draft: StoredDraft) {
  const selected = draft.input_json.methodologySelection;
  if (selected?.kind !== 'NEW_PROJECT_DRAFT') throw new AuthFailure('DRAFT_METHODOLOGY_REQUIRED', 422);
  const forms = (await db.query("SELECT v.definition_id AS id,v.version,v.content_hash FROM anvil.form_definitions d JOIN anvil.form_versions v ON v.definition_id=d.id WHERE d.scope='SYSTEM' OR d.scope='USER_COMMON' AND d.owner_user_id=$1", [draft.owner_user_id])).rows.map(row => ({ id: row.id, version: Number(row.version), contentHash: row.content_hash }));
  return { selected, ref: { id: draft.id, version: Number(draft.version), contentHash: contentHash(canonicalJson(selected.graph)) }, validation: validateMethodologyGraph(selected.graph, forms) };
}
async function reviews(db: PoolClient, draft: StoredDraft, hash: string) {
  return (await db.query("SELECT r.*,a.server_sequence FROM anvil.content_reviews r JOIN anvil.draft_audit_events a ON a.command_id=r.command_id AND a.draft_id=r.draft_id WHERE r.scope_kind='DRAFT' AND r.scope_id=$1 AND r.target_kind='DRAFT_METHODOLOGY' AND r.target_id=$1 AND r.target_version=$2 AND r.target_hash=$3 AND r.criteria_version=1 ORDER BY a.server_sequence DESC", [draft.id, draft.version, hash])).rows;
}
export async function draftMethodologyState(db: PoolClient, draft: StoredDraft) {
  if (draft.input_json.methodologySelection?.kind !== 'NEW_PROJECT_DRAFT') return null;
  const state = await validation(db, draft), rows = await reviews(db, draft, state.ref.contentHash);
  const confirmation = (await db.query('SELECT * FROM anvil.draft_methodology_reviews WHERE draft_id=$1 AND version=$2 AND graph_hash=$3 ORDER BY decided_at DESC,id DESC LIMIT 1', [draft.id, draft.version, state.ref.contentHash])).rows[0];
  return { ref: state.ref, validation: state.validation, contentReviewCriteria: methodContentReviewCriteria,
    contentReviews: rows.map(row => ({ reviewRef: { id: row.id, targetRef: state.ref, criteriaVersion: 1, outcome: row.outcome }, items: row.items_json, reason: row.reason, reviewerSubjectRef: row.reviewer_subject_ref, sourceKind: row.source_kind, reviewedAt: row.created_at.toISOString() })),
    confirmation: confirmation && rows[0]?.outcome === 'ACCEPTED' && confirmation.review_refs.some((ref: { id: string }) => ref.id === rows[0].id) ? { id: confirmation.id, decidedBy: confirmation.decided_by, decidedAt: confirmation.decided_at.toISOString(), reviewRefs: confirmation.review_refs } : null };
}
export async function requireDraftConfirmation(db: PoolClient, draft: StoredDraft) {
  const state = await draftMethodologyState(db, draft);
  if (!state?.confirmation || !state.validation.validForConfirmation) throw new AuthFailure('DRAFT_METHODOLOGY_CONFIRMATION_REQUIRED', 422);
  const selected = draft.input_json.methodologySelection;
  if (selected?.kind !== 'NEW_PROJECT_DRAFT') throw new AuthFailure('DRAFT_METHODOLOGY_REQUIRED', 422);
  await requirePreparedForms(db, draft.owner_user_id, selected.graph);
  return state;
}
export async function writeDraftReview(db: PoolClient, actor: AuthenticatedIdentity, draft: StoredDraft, request: DraftOperation, persist: (result: unknown) => Promise<unknown>) {
  const { selected, ref, validation: checked } = await validation(db, draft), p = request.payload, recording = request.operation === 'recordContentReview';
  if (!exact(p, recording ? ['targetKind', 'targetRef', 'criteriaVersion', 'items', 'outcome', 'reason'] : ['draftVersion', 'graphHash', 'reviewRefs'])) throw new AuthFailure('INPUT_INVALID', 400);
  if (recording && (p.targetKind !== 'DRAFT_METHODOLOGY' || canonicalJson(p.targetRef) !== canonicalJson(ref))) throw new AuthFailure('VERSION_CONFLICT', 409);
  if (!recording && (p.draftVersion !== ref.version || p.graphHash !== ref.contentHash)) throw new AuthFailure('VERSION_CONFLICT', 409);
  await db.query("SELECT set_config('anvil.actor_id',$1,true)", [actor.actorId]);
  const result = (data: Record<string, unknown>) => ({ scopeKind: 'DRAFT', draftId: draft.id, targetId: draft.id, version: ref.version, commandId: request.commandId, status: 'APPLIED', data: { ref, validation: checked, ...data }, evidenceRefs: [] });
  if (recording) {
    if (p.criteriaVersion !== 1 || !Array.isArray(p.items) || !outcomes.includes(String(p.outcome)) || !nonempty(p.reason)) throw new AuthFailure('REVIEW_INPUT_INVALID', 422);
    const expected = new Set(methodContentReviewCriteria.items.map(item => item.criterionId)), seen = new Set<string>();
    for (const item of p.items) {
      if (!exact(item, ['criterionId', 'outcome', 'evidenceRefs', 'reason']) || typeof item.criterionId !== 'string' || !expected.has(item.criterionId) || seen.has(item.criterionId) || !outcomes.includes(String(item.outcome)) || !nonempty(item.reason) || !Array.isArray(item.evidenceRefs)) throw new AuthFailure('REVIEW_INPUT_INVALID', 422);
      if (item.evidenceRefs.length) throw new AuthFailure('REVIEW_ARTIFACT_STORAGE_NOT_READY', 412);
      seen.add(item.criterionId);
    }
    if (seen.size !== expected.size || p.outcome === 'ACCEPTED' && p.items.some(item => item.outcome !== 'ACCEPTED')) throw new AuthFailure('REVIEW_INCOMPLETE', 422);
    const reviewId = randomUUID(), reviewRef = { id: reviewId, criteriaVersion: 1, targetRef: ref, outcome: p.outcome };
    const response = await persist(result({ status: 'REVIEW_RECORDED', reviewRef }));
    const command = (await db.query("SELECT id FROM anvil.commands WHERE draft_id=$1 AND actor_id=$2 AND command_id=$3 AND operation='recordContentReview'", [draft.id, actor.actorId, request.commandId])).rows[0];
    await db.query("INSERT INTO anvil.content_reviews(id,scope_kind,scope_id,draft_id,target_kind,target_id,target_version,target_hash,criteria_version,criteria_snapshot_json,items_json,outcome,reviewer_user_id,client_id,reviewer_subject_ref,source_kind,reason,command_id) VALUES($1,'DRAFT',$2,$2,'DRAFT_METHODOLOGY',$2,$3,$4,1,$5,$6,$7,$8,$9,$10,'HUMAN_REVIEW',$11,$12)", [reviewId, draft.id, ref.version, ref.contentHash, JSON.stringify(methodContentReviewCriteria), JSON.stringify(p.items), p.outcome, actor.actorId, actor.clientId, JSON.stringify({ kind: 'HUMAN', userId: actor.actorId, sameAsTargetRecorder: true }), p.reason, command.id]);
    return response;
  }
  if (!nonempty(selected.name) || !nonempty(selected.purpose) || !checked.validForConfirmation || !Array.isArray(p.reviewRefs) || !p.reviewRefs.length || p.reviewRefs.length > 200) throw new AuthFailure('CONTENT_REVIEW_REQUIRED', 422);
  const rows = await reviews(db, draft, ref.contentHash), latest = rows[0], seen = new Set<string>();
  if (latest?.outcome !== 'ACCEPTED' || !p.reviewRefs.some(item => item?.id === latest.id)) throw new AuthFailure('CONTENT_REVIEW_REQUIRED', 422);
  for (const item of p.reviewRefs) {
    if (!exact(item, ['id', 'targetRef', 'criteriaVersion', 'outcome']) || typeof item.id !== 'string' || seen.has(item.id) || item.criteriaVersion !== 1 || item.outcome !== 'ACCEPTED' || canonicalJson(item.targetRef) !== canonicalJson(ref) || !rows.some(row => row.id === item.id && row.outcome === 'ACCEPTED' && row.source_kind === 'HUMAN_REVIEW')) throw new AuthFailure('CONTENT_REVIEW_REQUIRED', 422);
    seen.add(item.id);
  }
  await requirePreparedForms(db, actor.actorId, selected.graph);
  const confirmationId = randomUUID(), response = await persist(result({ status: 'CONFIRMED', confirmationId }));
  const command = (await db.query("SELECT id FROM anvil.commands WHERE draft_id=$1 AND actor_id=$2 AND command_id=$3 AND operation='confirmDraftMethodology'", [draft.id, actor.actorId, request.commandId])).rows[0];
  await db.query('INSERT INTO anvil.draft_methodology_reviews(id,draft_id,version,graph_hash,graph_json,review_refs,validation_json,decided_by,client_id,command_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [confirmationId, draft.id, ref.version, ref.contentHash, JSON.stringify(selected.graph), JSON.stringify(p.reviewRefs), JSON.stringify(checked), actor.actorId, actor.clientId, command.id]);
  return response;
}
