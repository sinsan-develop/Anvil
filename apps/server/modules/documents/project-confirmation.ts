import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { AuthFailure, type AuthenticatedIdentity } from '../access/repository.ts';
import { persistProjectReceipt, type ProjectCommand } from '../access/project-command.ts';
import { canonicalJson, contentHash } from '../../../../contracts/canonical.ts';
import { isVersionRef } from '../../../../contracts/references.ts';
import type { VersionRef } from '../../../../contracts/generated-types.ts';
import { officialFormsSourceHash } from './forms.ts';

function exact(value: unknown, keys: string[]): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join(',') === [...keys].sort().join(','); }
export async function confirmProjectDocument(db: PoolClient, actor: AuthenticatedIdentity, request: ProjectCommand, policyRef: VersionRef, document: { formRef: VersionRef; contentHash: string; validation: { validForConfirmation: boolean } }) {
  const p = request.payload;
  if (!exact(p, ['versionRef','formRef','reviewRefs']) || !isVersionRef(p.versionRef) || !isVersionRef(p.formRef) || request.targetId !== p.versionRef.id || request.expectedVersion !== p.versionRef.version) throw new AuthFailure('DOCUMENT_CONFIRMATION_INPUT_INVALID', 422);
  const ref = p.versionRef;
  const head = (await db.query('SELECT head_version,confirmed_version FROM anvil.documents WHERE project_id=$1 AND id=$2 FOR UPDATE', [request.projectId, ref.id])).rows[0];
  if (!head) throw new AuthFailure('NOT_FOUND', 404);
  if (Number(head.head_version) !== ref.version || document.contentHash !== ref.contentHash) throw new AuthFailure('VERSION_CONFLICT', 409);
  if (canonicalJson(p.formRef) !== canonicalJson(document.formRef)) throw new AuthFailure('FORM_REFERENCE_INVALID', 422);
  if (!document.validation.validForConfirmation) throw new AuthFailure('DOCUMENT_CONTENT_INCOMPLETE', 422);
  const form = (await db.query("SELECT d.scope,v.definition_json,v.content_hash,v.origin_ref_json FROM anvil.form_definitions d JOIN anvil.form_versions v ON v.definition_id=d.id AND v.version=$2 WHERE d.id=$1 AND (d.scope='SYSTEM' OR d.scope='USER_COMMON' AND d.owner_user_id=$3) FOR SHARE OF d", [p.formRef.id, p.formRef.version, actor.actorId])).rows[0];
  if (!form || form.content_hash !== p.formRef.contentHash || contentHash(canonicalJson(form.definition_json)) !== p.formRef.contentHash) throw new AuthFailure('FORM_SOURCE_NOT_READY', 422);
  if (form.scope === 'SYSTEM') {
    if (form.origin_ref_json?.kind !== 'P01_APPROVED_SOURCE' || form.origin_ref_json?.sourceHash !== officialFormsSourceHash || form.origin_ref_json?.productAcceptance !== false) throw new AuthFailure('FORM_SOURCE_NOT_READY', 422);
  } else {
    const confirmed = await db.query("SELECT 1 FROM anvil.form_reviews r JOIN anvil.commands c ON c.id=r.command_id WHERE r.definition_id=$1 AND r.version=$2 AND r.target_hash=$3 AND r.decision='CONFIRMED' AND c.scope_kind='USER_COMMON' AND c.scope_id=$4", [p.formRef.id, p.formRef.version, p.formRef.contentHash, actor.actorId]);
    const latestForm = (await db.query("SELECT r.outcome FROM anvil.content_reviews r JOIN anvil.user_common_audit_events a ON a.command_id=r.command_id AND a.owner_user_id=r.scope_id WHERE r.scope_kind='USER_COMMON' AND r.scope_id=$1 AND r.target_kind='FORM' AND r.target_id=$2 AND r.target_version=$3 AND r.target_hash=$4 AND r.criteria_version=1 ORDER BY a.server_sequence DESC LIMIT 1", [actor.actorId, p.formRef.id, p.formRef.version, p.formRef.contentHash])).rows[0];
    if (!confirmed.rowCount || latestForm?.outcome !== 'ACCEPTED') throw new AuthFailure('FORM_SOURCE_NOT_READY', 422);
  }
  if (!Array.isArray(p.reviewRefs) || !p.reviewRefs.length || p.reviewRefs.length > 200) throw new AuthFailure('CONTENT_REVIEW_REQUIRED', 422);
  const latest = (await db.query("SELECT r.id,r.outcome FROM anvil.content_reviews r JOIN anvil.audit_events a ON a.project_id=r.project_id AND a.command_id=r.command_id WHERE r.scope_kind='PROJECT' AND r.project_id=$1 AND r.target_kind='DOCUMENT' AND r.target_id=$2 AND r.target_version=$3 AND r.target_hash=$4 AND r.criteria_version=1 AND r.source_kind='HUMAN_REVIEW' ORDER BY a.server_sequence DESC LIMIT 1", [request.projectId, ref.id, ref.version, ref.contentHash])).rows[0];
  const seen = new Set<string>();
  for (const review of p.reviewRefs) {
    if (!exact(review, ['id','criteriaVersion','targetRef','outcome']) || typeof review.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(review.id) || seen.has(review.id) || review.criteriaVersion !== 1 || review.outcome !== 'ACCEPTED' || !isVersionRef(review.targetRef) || canonicalJson(review.targetRef) !== canonicalJson(ref)) throw new AuthFailure('CONTENT_REVIEW_REQUIRED', 422);
    seen.add(review.id);
    if (!(await db.query("SELECT 1 FROM anvil.content_reviews WHERE id=$1 AND scope_kind='PROJECT' AND project_id=$2 AND target_kind='DOCUMENT' AND target_id=$3 AND target_version=$4 AND target_hash=$5 AND criteria_version=1 AND outcome='ACCEPTED' AND source_kind='HUMAN_REVIEW'", [review.id, request.projectId, ref.id, ref.version, ref.contentHash])).rowCount) throw new AuthFailure('CONTENT_REVIEW_REQUIRED', 422);
  }
  if (!latest || latest.outcome !== 'ACCEPTED' || !seen.has(latest.id)) throw new AuthFailure('CONTENT_REVIEW_REQUIRED', 422);
  if (Number(head.confirmed_version) === ref.version) throw new AuthFailure('DOCUMENT_ALREADY_CONFIRMED', 409);
  const id = randomUUID(), receipt = await persistProjectReceipt(db, actor, request, ref, { status: 'CONFIRMED', confirmationId: id }, policyRef, 'EXPLICIT_DOCUMENT_CONFIRMATION');
  await db.query('INSERT INTO anvil.document_confirmations(id,project_id,document_id,version,target_hash,form_ref,review_refs,validation_json,confirmed_by,client_id,command_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)', [id, request.projectId, ref.id, ref.version, ref.contentHash, JSON.stringify(p.formRef), JSON.stringify(p.reviewRefs), JSON.stringify(document.validation), actor.actorId, actor.clientId, receipt.id]);
  await db.query('UPDATE anvil.documents SET confirmed_version=$3,updated_at=now() WHERE project_id=$1 AND id=$2', [request.projectId, ref.id, ref.version]);
  return receipt.result;
}
