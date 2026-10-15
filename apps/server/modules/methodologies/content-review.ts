import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { AuthFailure, type AuthenticatedIdentity } from '../access/repository.ts';
import { persistCommonReceipt, type UserCommonCommand } from '../access/common-command.ts';
import { canonicalJson, contentHash } from '../../../../contracts/canonical.ts';
import { isVersionRef } from '../../../../contracts/references.ts';
import { validateMethodologyGraph } from './service.ts';
import type { MethodologyGraph } from '../../../../contracts/methodologies.ts';
import type { VersionRef } from '../../../../contracts/generated-types.ts';
import { officialFormsSourceHash } from '../documents/forms.ts';

export const methodContentReviewCriteria = Object.freeze({ criteriaVersion: 1, items: [
  { criterionId: 'METHOD_PURPOSE_SCOPE', title: '방법론의 목적과 단계별 작업 범위가 분명한가' },
  { criterionId: 'METHOD_FLOW_CONTROL', title: '순서·분기·합류·재작업이 의도한 절차인가' },
  { criterionId: 'METHOD_INPUT_OUTPUT', title: '입력·산출물과 양식의 연결이 충분한가' },
  { criterionId: 'METHOD_COMPLETION_APPROVAL', title: '완료 기준·검수·사람 승인 경계가 충분한가' },
  { criterionId: 'METHOD_RECORD_LIMITS', title: '담당·작업 기록·한도와 미연결 사항을 분명히 했는가' },
] });
const outcomes = ['ACCEPTED', 'REWORK', 'BLOCKED', 'NOT_EXECUTED'];
function object(value: unknown, keys: string[]): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key)); }
function text(value: unknown) { return typeof value === 'string' && !!value.trim() && value.length <= 20_000; }
export async function writeCommonMethodReview(db: PoolClient, actor: AuthenticatedIdentity, request: UserCommonCommand) {
  const p = request.payload, recording = request.operation === 'recordContentReview';
  if (!object(p, recording ? ['targetKind', 'targetRef', 'criteriaVersion', 'items', 'outcome', 'reason'] : ['versionRef', 'reviewRefs'])) throw new AuthFailure('INPUT_INVALID', 400);
  if (recording && p.targetKind !== 'METHODOLOGY') throw new AuthFailure('REVIEW_TARGET_NOT_READY', 412);
  const ref = recording ? p.targetRef : p.versionRef;
  if (!isVersionRef(ref) || request.targetId !== ref.id || request.expectedVersion !== ref.version) throw new AuthFailure('INPUT_INVALID', 400);
  const row = (await db.query("SELECT d.scope,d.head_version,v.graph_json,v.content_hash,v.created_by FROM anvil.methodology_definitions d JOIN anvil.methodology_versions v ON v.definition_id=d.id AND v.version=$2 WHERE d.id=$1 AND (d.scope='SYSTEM' OR d.scope='USER_COMMON' AND d.owner_user_id=$3) FOR UPDATE OF d", [ref.id, ref.version, actor.actorId])).rows[0];
  if (!row) throw new AuthFailure('NOT_FOUND', 404);
  if (row.scope !== 'USER_COMMON') throw new AuthFailure('SYSTEM_IMMUTABLE', 403);
  if (Number(row.head_version) !== ref.version || row.content_hash !== ref.contentHash) throw new AuthFailure('VERSION_CONFLICT', 409);
  if (contentHash(canonicalJson(row.graph_json)) !== ref.contentHash) throw new AuthFailure('METHODOLOGY_INTEGRITY_FAILED', 503);
  const forms = (await db.query("SELECT v.definition_id AS id,v.version,v.content_hash FROM anvil.form_definitions d JOIN anvil.form_versions v ON v.definition_id=d.id WHERE d.scope='SYSTEM' OR d.scope='USER_COMMON' AND d.owner_user_id=$1", [actor.actorId])).rows.map(form => ({ id: form.id, version: Number(form.version), contentHash: form.content_hash }));
  const validation = validateMethodologyGraph(row.graph_json, forms);
  await db.query("SELECT set_config('anvil.actor_id',$1,true)", [actor.actorId]);
  if (recording) {
    if (p.criteriaVersion !== 1 || !Array.isArray(p.items) || !outcomes.includes(String(p.outcome)) || !text(p.reason)) throw new AuthFailure('REVIEW_INPUT_INVALID', 422);
    const expected = new Set(methodContentReviewCriteria.items.map(item => item.criterionId)), seen = new Set<string>();
    for (const item of p.items) {
      if (!object(item, ['criterionId', 'outcome', 'evidenceRefs', 'reason']) || typeof item.criterionId !== 'string' || !expected.has(item.criterionId) || seen.has(item.criterionId)
        || !outcomes.includes(String(item.outcome)) || !text(item.reason) || !Array.isArray(item.evidenceRefs)) throw new AuthFailure('REVIEW_INPUT_INVALID', 422);
      if (item.evidenceRefs.length) throw new AuthFailure('REVIEW_ARTIFACT_STORAGE_NOT_READY', 412);
      seen.add(item.criterionId);
    }
    if (seen.size !== expected.size || p.outcome === 'ACCEPTED' && p.items.some(item => item.outcome !== 'ACCEPTED')) throw new AuthFailure('REVIEW_INCOMPLETE', 422);
    const reviewId = randomUUID(), reviewRef = { id: reviewId, criteriaVersion: 1, targetRef: ref, outcome: p.outcome };
    const result = await persistCommonReceipt(db, actor, request, ref, validation, { status: 'REVIEW_RECORDED', reviewRef });
    const command = (await db.query("SELECT id FROM anvil.commands WHERE scope_kind='USER_COMMON' AND actor_id=$1 AND command_id=$2", [actor.actorId, request.commandId])).rows[0];
    await db.query("INSERT INTO anvil.content_reviews(id,scope_kind,scope_id,owner_user_id,target_kind,target_id,target_version,target_hash,criteria_version,criteria_snapshot_json,items_json,outcome,reviewer_user_id,client_id,reviewer_subject_ref,source_kind,reason,command_id) VALUES($1,'USER_COMMON',$2,$2,'METHODOLOGY',$3,$4,$5,1,$6,$7,$8,$2,$9,$10,'HUMAN_REVIEW',$11,$12)",
      [reviewId, actor.actorId, ref.id, ref.version, ref.contentHash, JSON.stringify(methodContentReviewCriteria), JSON.stringify(p.items), p.outcome, actor.clientId, JSON.stringify({ kind: 'HUMAN', userId: actor.actorId, sameAsTargetRecorder: row.created_by === actor.actorId }), p.reason, command.id]);
    return result;
  }
  if (!validation.validForConfirmation || !Array.isArray(p.reviewRefs) || !p.reviewRefs.length || p.reviewRefs.length > 200) throw new AuthFailure('CONTENT_REVIEW_REQUIRED', 422);
  const latest = (await db.query("SELECT r.id,r.outcome FROM anvil.content_reviews r JOIN anvil.user_common_audit_events a ON a.owner_user_id=r.scope_id AND a.command_id=r.command_id WHERE r.scope_kind='USER_COMMON' AND r.scope_id=$1 AND r.target_kind='METHODOLOGY' AND r.target_id=$2 AND r.target_version=$3 AND r.target_hash=$4 AND r.criteria_version=1 ORDER BY a.server_sequence DESC LIMIT 1", [actor.actorId, ref.id, ref.version, ref.contentHash])).rows[0];
  if (!latest || latest.outcome !== 'ACCEPTED' || !p.reviewRefs.some(value => value?.id === latest.id)) throw new AuthFailure('CONTENT_REVIEW_REQUIRED', 422);
  const seen = new Set<string>();
  for (const review of p.reviewRefs) {
    if (!object(review, ['id', 'criteriaVersion', 'targetRef', 'outcome']) || typeof review.id !== 'string' || !/^[0-9a-f-]{36}$/.test(review.id) || seen.has(review.id) || review.criteriaVersion !== 1 || review.outcome !== 'ACCEPTED' || canonicalJson(review.targetRef) !== canonicalJson(ref)) throw new AuthFailure('CONTENT_REVIEW_REQUIRED', 422);
    seen.add(review.id);
    if (!(await db.query("SELECT 1 FROM anvil.content_reviews WHERE id=$1 AND scope_kind='USER_COMMON' AND scope_id=$2 AND target_kind='METHODOLOGY' AND target_id=$3 AND target_version=$4 AND target_hash=$5 AND criteria_version=1 AND outcome='ACCEPTED' AND source_kind='HUMAN_REVIEW'", [review.id, actor.actorId, ref.id, ref.version, ref.contentHash])).rowCount) throw new AuthFailure('CONTENT_REVIEW_REQUIRED', 422);
  }
  await requirePreparedForms(db, actor.actorId, row.graph_json);
  const confirmationId = randomUUID();
  const result = await persistCommonReceipt(db, actor, request, ref, validation, { status: 'CONFIRMED', confirmationId });
  const command = (await db.query("SELECT id FROM anvil.commands WHERE scope_kind='USER_COMMON' AND actor_id=$1 AND command_id=$2", [actor.actorId, request.commandId])).rows[0];
  await db.query("INSERT INTO anvil.methodology_reviews(id,definition_id,version,target_hash,validation_json,review_refs,decision,decided_by,client_id,command_id) VALUES($1,$2,$3,$4,$5,$6,'CONFIRMED',$7,$8,$9)", [confirmationId, ref.id, ref.version, ref.contentHash, JSON.stringify(validation), JSON.stringify(p.reviewRefs), actor.actorId, actor.clientId, command.id]);
  return result;
}


async function requirePreparedForms(db: PoolClient, owner: string, graph: MethodologyGraph) {
  const refs = new Map<string, VersionRef>();
  for (const node of graph.nodes) for (const item of [...node.inputs, ...node.outputs]) refs.set(canonicalJson(item.formRef), item.formRef);
  for (const ref of refs.values()) {
    const form = (await db.query("SELECT d.scope,v.definition_json,v.content_hash,v.origin_ref_json FROM anvil.form_definitions d JOIN anvil.form_versions v ON v.definition_id=d.id AND v.version=$2 WHERE d.id=$1 AND (d.scope='SYSTEM' OR d.scope='USER_COMMON' AND d.owner_user_id=$3) FOR SHARE OF d", [ref.id, ref.version, owner])).rows[0];
    if (!form || form.content_hash !== ref.contentHash || contentHash(canonicalJson(form.definition_json)) !== ref.contentHash) throw new AuthFailure('FORM_SOURCE_NOT_READY', 422);
    if (form.scope === 'SYSTEM') {
      if (form.origin_ref_json?.kind !== 'P01_APPROVED_SOURCE' || form.origin_ref_json?.sourceHash !== officialFormsSourceHash || form.origin_ref_json?.productAcceptance !== false) throw new AuthFailure('FORM_SOURCE_NOT_READY', 422);
      continue;
    }
    const confirmed = await db.query("SELECT 1 FROM anvil.form_reviews r JOIN anvil.commands c ON c.id=r.command_id WHERE r.definition_id=$1 AND r.version=$2 AND r.target_hash=$3 AND r.decision='CONFIRMED' AND c.scope_kind='USER_COMMON' AND c.scope_id=$4", [ref.id, ref.version, ref.contentHash, owner]);
    const latest = (await db.query("SELECT r.outcome FROM anvil.content_reviews r JOIN anvil.user_common_audit_events a ON a.command_id=r.command_id AND a.owner_user_id=r.scope_id WHERE r.scope_kind='USER_COMMON' AND r.scope_id=$1 AND r.target_kind='FORM' AND r.target_id=$2 AND r.target_version=$3 AND r.target_hash=$4 AND r.criteria_version=1 ORDER BY a.server_sequence DESC LIMIT 1", [owner, ref.id, ref.version, ref.contentHash])).rows[0];
    if (!confirmed.rowCount || latest?.outcome !== 'ACCEPTED') throw new AuthFailure('FORM_SOURCE_NOT_READY', 422);
  }
}
