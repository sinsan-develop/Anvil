import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { AuthFailure, type AuthenticatedIdentity } from '../access/repository.ts';
import { persistProjectReceipt, type ProjectCommand } from '../access/project-command.ts';
import { canonicalJson, contentHash } from '../../../../contracts/canonical.ts';
import { isVersionRef } from '../../../../contracts/references.ts';
import type { VersionRef } from '../../../../contracts/generated-types.ts';
import type { FormDefinition } from './forms.ts';

const outcomes = ['ACCEPTED', 'REWORK', 'BLOCKED', 'NOT_EXECUTED'];
function exact(value: unknown, keys: string[]): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join(',') === [...keys].sort().join(','); }
function reason(value: unknown) { return typeof value === 'string' && !!value.trim() && value.length <= 20_000; }
export function documentReviewCriteria(formRef: VersionRef, definition: FormDefinition) {
  return { criteriaVersion: 1, formRef, items: definition.items.map(item => ({ criterionId: item.itemId, title: item.title, reviewCriteria: item.reviewCriteria })) };
}
export async function documentReviews(db: PoolClient, projectId: string, ref: VersionRef) {
  const rows = (await db.query("SELECT r.*,a.server_sequence FROM anvil.content_reviews r JOIN anvil.audit_events a ON a.project_id=r.project_id AND a.command_id=r.command_id WHERE r.scope_kind='PROJECT' AND r.project_id=$1 AND r.target_kind='DOCUMENT' AND r.target_id=$2 AND r.target_version=$3 AND r.target_hash=$4 ORDER BY a.server_sequence DESC LIMIT 200", [projectId, ref.id, ref.version, ref.contentHash])).rows;
  return rows.map(row => ({ ref: { id: row.id, targetRef: ref, criteriaVersion: Number(row.criteria_version), outcome: row.outcome }, items: row.items_json, reviewer: row.reviewer_subject_ref, sourceKind: row.source_kind, reason: row.reason, reviewedAt: row.created_at.toISOString(), serverSequence: Number(row.server_sequence) }));
}
export async function writeDocumentReview(db: PoolClient, actor: AuthenticatedIdentity, request: ProjectCommand, policyRef: VersionRef) {
  const p = request.payload;
  if (!exact(p, ['targetKind', 'targetRef', 'criteriaVersion', 'items', 'outcome', 'reason']) || p.targetKind !== 'DOCUMENT' || !isVersionRef(p.targetRef) || request.targetId !== p.targetRef.id || request.expectedVersion !== p.targetRef.version) throw new AuthFailure('REVIEW_INPUT_INVALID', 422);
  const ref = p.targetRef;
  const row = (await db.query('SELECT d.head_version,v.*,f.definition_json FROM anvil.documents d JOIN anvil.document_versions v ON v.project_id=d.project_id AND v.document_id=d.id AND v.version=$3 JOIN anvil.form_versions f ON f.definition_id=v.form_definition_id AND f.version=v.form_version AND f.content_hash=v.form_hash WHERE d.project_id=$1 AND d.id=$2 FOR UPDATE OF d', [request.projectId, ref.id, ref.version])).rows[0];
  if (!row) throw new AuthFailure('NOT_FOUND', 404);
  if (Number(row.head_version) !== ref.version || row.content_hash !== ref.contentHash) throw new AuthFailure('VERSION_CONFLICT', 409);
  const formRef = { id: row.form_definition_id, version: Number(row.form_version), contentHash: row.form_hash };
  if (contentHash(canonicalJson(row.definition_json)) !== formRef.contentHash) throw new AuthFailure('FORM_INTEGRITY_FAILED', 503);
  const criteria = documentReviewCriteria(formRef, row.definition_json);
  if (p.criteriaVersion !== 1 || !Array.isArray(p.items) || p.items.length > 200 || !outcomes.includes(String(p.outcome)) || !reason(p.reason)) throw new AuthFailure('REVIEW_INPUT_INVALID', 422);
  const expected = new Set(criteria.items.map(item => item.criterionId)), seen = new Set<string>();
  for (const item of p.items) {
    if (!exact(item, ['criterionId', 'outcome', 'evidenceRefs', 'reason']) || typeof item.criterionId !== 'string' || !expected.has(item.criterionId) || seen.has(item.criterionId) || !outcomes.includes(String(item.outcome)) || !reason(item.reason) || !Array.isArray(item.evidenceRefs)) throw new AuthFailure('REVIEW_INPUT_INVALID', 422);
    if (item.evidenceRefs.length) throw new AuthFailure('REVIEW_EVIDENCE_CONNECTION_PENDING', 412);
    seen.add(item.criterionId);
  }
  if (seen.size !== expected.size || p.outcome === 'ACCEPTED' && p.items.some(item => item.outcome !== 'ACCEPTED')) throw new AuthFailure('REVIEW_INCOMPLETE', 422);
  const id = randomUUID(), reviewRef = { id, criteriaVersion: 1, targetRef: ref, outcome: p.outcome };
  const receipt = await persistProjectReceipt(db, actor, request, ref, { status: 'REVIEW_RECORDED', reviewRef }, policyRef, 'EXPLICIT_DOCUMENT_CONTENT_REVIEW');
  const reviewer = { kind: 'HUMAN', userId: actor.actorId, sameAsTargetRecorder: row.author_ref_json?.kind === 'HUMAN' && row.author_ref_json?.userId === actor.actorId };
  await db.query("INSERT INTO anvil.content_reviews(id,scope_kind,scope_id,project_id,target_kind,target_id,target_version,target_hash,criteria_version,criteria_snapshot_json,items_json,outcome,reviewer_user_id,client_id,reviewer_subject_ref,source_kind,reason,command_id) VALUES($1,'PROJECT',$2,$2,'DOCUMENT',$3,$4,$5,1,$6,$7,$8,$9,$10,$11,'HUMAN_REVIEW',$12,$13)", [id, request.projectId, ref.id, ref.version, ref.contentHash, JSON.stringify(criteria), JSON.stringify(p.items), p.outcome, actor.actorId, actor.clientId, JSON.stringify(reviewer), p.reason, receipt.id]);
  return receipt.result;
}
