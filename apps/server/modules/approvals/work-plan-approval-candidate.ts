import type { PoolClient } from 'pg';
import { AuthFailure, type AuthenticatedIdentity } from '../access/repository.ts';
import { projectMember, type ProjectCommand } from '../access/project-command.ts';
import type { ApprovalDetails, ApprovalScope } from './approval-input.ts';
import type { VersionRef } from '../../../../contracts/generated-types.ts';
import { canonicalJson, contentHash } from '../../../../contracts/canonical.ts';
import { isVersionRef } from '../../../../contracts/references.ts';
import { exactKeys, planText, analyzeWorkPlanCards, type TaskCard } from '../traceability/work-plan-card.ts';
import { documentReviews } from '../documents/project-content-review.ts';

export interface WorkPlanApprovalPayload { documentRef: VersionRef; designRef: VersionRef; screenReviewRefs: unknown[]; tasks: TaskCard[]; reason: string }
export interface WorkPlanApprovalMeta { serverCommandId: string; createdBy: string; clientId: string; controlGeneration: number; policyRef: VersionRef; details: ApprovalDetails }
const unavailable = () => new AuthFailure('WORK_PLAN_APPROVAL_STORAGE_UNAVAILABLE', 503);
const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);

/** 정규화한 분석 결과로 원 입력을 교체하지 않는다. 내용 부족은 기존 save의 issues로 남는다. */
export function readWorkPlanApprovalPayload(value: unknown, expectedHash: string): WorkPlanApprovalPayload {
  try {
    if (!exactKeys(value, ['documentRef', 'designRef', 'screenReviewRefs', 'tasks', 'reason'])
      || !isVersionRef(value.documentRef) || !isVersionRef(value.designRef)
      || !Array.isArray(value.screenReviewRefs) || value.screenReviewRefs.length > 200
      || !value.screenReviewRefs.every(r => exactKeys(r, ['id', 'targetRef', 'criteriaVersion', 'outcome'])
        && isVersionRef({ id: r.id, version: 1, contentHash: '0'.repeat(64) }) && isVersionRef(r.targetRef) && r.criteriaVersion === 1 && r.outcome === 'ACCEPTED')
      || !planText(value.reason) || !value.reason.trim()) throw Error();
    analyzeWorkPlanCards(value.tasks);
  } catch { throw new AuthFailure('APPROVAL_INPUT_INVALID', 422); }
  if (!/^[a-f0-9]{64}$/.test(expectedHash) || contentHash(canonicalJson(value)) !== expectedHash) throw new AuthFailure('APPROVAL_CANDIDATE_MISMATCH', 409);
  return structuredClone(value) as WorkPlanApprovalPayload;
}

export class WorkPlanApprovalCandidates {
  async capture(db: PoolClient, actor: AuthenticatedIdentity, input: {
    command: ProjectCommand; requestId: string; serverCommandId: string; policyRef: VersionRef; details: ApprovalDetails; payload: unknown;
  }) {
    const { command: c, details: d } = input, member = await projectMember(db, actor, c.projectId);
    if (member.participation !== 'OWNER' || c.operation !== 'requestApproval' || d.actionScope.operation !== 'saveWorkPlanDraft'
      || d.actionScope.requestedSubjectRef.userId !== actor.actorId || c.clientId !== actor.clientId
      || d.actionScope.requestedSubjectRef.clientId !== actor.clientId || d.actionScope.controlGeneration !== c.controlGeneration)
      throw new AuthFailure('NOT_FOUND', 404);
    const payload = readWorkPlanApprovalPayload(input.payload, d.actionScope.payloadHash);
    if (!same(c.payload, { details: d, candidatePayload: payload }) || c.targetId !== null || c.expectedVersion !== 0
      || c.baselineRefs.length || c.approvalRef !== null) throw new AuthFailure('APPROVAL_CANDIDATE_MISMATCH', 409);
    try {
      await db.query(`INSERT INTO anvil.work_plan_approval_candidates(project_id,request_id,request_command_id,candidate_command_id,payload_hash,payload_json,target_ref,created_by,client_id,control_generation,policy_ref)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, [c.projectId, input.requestId, input.serverCommandId, d.candidateCommandId, d.actionScope.payloadHash,
        JSON.stringify(payload), JSON.stringify(d.actionScope.targetRef), actor.actorId, actor.clientId, c.controlGeneration, JSON.stringify(input.policyRef)]);
    } catch { throw unavailable(); }
  }

  async read(db: PoolClient, actor: AuthenticatedIdentity, pid: string, id: string, meta: WorkPlanApprovalMeta) {
    const member = await projectMember(db, actor, pid);
    if (member.participation !== 'OWNER' || meta.createdBy !== actor.actorId) throw new AuthFailure('NOT_FOUND', 404);
    let rows: Record<string, any>[];
    try {
      rows = (await db.query(`SELECT b.*,c.command_id request_key,c.request_hash,c.operation request_operation,c.actor_id request_actor,c.client_id request_client
        FROM anvil.work_plan_approval_candidates b JOIN anvil.commands c ON c.project_id=b.project_id AND c.id=b.request_command_id
        WHERE b.project_id=$1 AND b.request_id=$2`, [pid, id])).rows;
    } catch { throw unavailable(); }
    try {
      if (rows.length !== 1) throw Error(); const row = rows[0]!, d = meta.details;
      if (d.actionScope.operation !== 'saveWorkPlanDraft' || row.project_id !== pid || row.request_id !== id || row.request_command_id !== meta.serverCommandId
        || row.candidate_command_id !== d.candidateCommandId || row.payload_hash !== d.actionScope.payloadHash || !same(row.target_ref, d.actionScope.targetRef)
        || row.created_by !== meta.createdBy || row.client_id !== meta.clientId || Number(row.control_generation) !== meta.controlGeneration
        || !same(row.policy_ref, meta.policyRef) || row.request_operation !== 'requestApproval' || row.request_actor !== meta.createdBy || row.request_client !== meta.clientId)
        throw Error();
      const payload = readWorkPlanApprovalPayload(row.payload_json, row.payload_hash);
      const original = { schemaVersion: 1, projectId: pid, commandId: row.request_key, clientId: meta.clientId, controlGeneration: meta.controlGeneration,
        operation: 'requestApproval', targetId: null, expectedVersion: 0, baselineRefs: [], approvalRef: null, payload: { details: d, candidatePayload: payload } };
      if (row.request_hash !== contentHash(canonicalJson(original))) throw Error();
      return { candidateCommandId: d.candidateCommandId, payloadHash: d.actionScope.payloadHash, payload };
    } catch { throw unavailable(); }
  }

  async assertCurrent(db: PoolClient, pid: string, scope: ApprovalScope, value: unknown) {
    const payload = readWorkPlanApprovalPayload(value, scope.payloadHash);
    if (scope.operation !== 'saveWorkPlanDraft' || (scope.targetRef === null ? scope.expectedVersion !== 0 : scope.targetRef.version !== scope.expectedVersion))
      throw new AuthFailure('APPROVAL_INPUT_INVALID', 422);
    try {
    const screens = payload.screenReviewRefs as { id: string; targetRef: VersionRef; criteriaVersion: number; outcome: string }[];
    const screenRefs = new Map<string, VersionRef>();
    for (const task of payload.tasks) for (const r of task.screenRefs) screenRefs.set(canonicalJson(r.versionRef), r.versionRef);
    const reviewed = new Set<string>();
    for (const r of screens) {
      const key = canonicalJson(r.targetRef);
      if (!screenRefs.has(key) || reviewed.has(key)) throw new AuthFailure('SCREEN_REVIEW_REFERENCE_INVALID', 422);
      reviewed.add(key);
    }
    const sources: [VersionRef, string, boolean][] = [[payload.documentRef, 'AF04', true], [payload.designRef, 'AF02', false], ...[...screenRefs.values()].map(ref => [ref, 'AF03', false] as [VersionRef, string, boolean])];
    for (const [ref, kind, current] of sources) {
      const rows = (await db.query(`SELECT d.head_version,v.content_hash,f.definition_json->>'formCode' form_code,a.state artifact_state
        FROM anvil.documents d JOIN anvil.document_versions v ON v.project_id=d.project_id AND v.document_id=d.id AND v.version=$3
        JOIN anvil.form_versions f ON f.definition_id=v.form_definition_id AND f.version=v.form_version AND f.content_hash=v.form_hash
        JOIN anvil.artifacts a ON a.project_id=v.project_id AND a.id=v.body_artifact_id
        WHERE d.project_id=$1 AND d.id=$2 FOR SHARE OF d,v,a`, [pid, ref.id, ref.version])).rows;
      if (!rows.length) throw new AuthFailure('NOT_FOUND', 404); if (rows.length !== 1) throw unavailable(); const row = rows[0];
      if (row.content_hash !== ref.contentHash || row.form_code !== kind || current && Number(row.head_version) !== ref.version)
        throw new AuthFailure('APPROVAL_TARGET_CHANGED', 409);
      if (row.artifact_state === 'QUARANTINED') throw new AuthFailure('ARTIFACT_QUARANTINED', 412);
      if (row.artifact_state !== 'READY') throw new AuthFailure('ARTIFACT_NOT_READY', 422);
    }
    for (const screen of screens) {
      const reviews = await documentReviews(db, pid, screen.targetRef);
      // 기존 초안은 고정 과거 검토를 보존하고 최신 부적합은 issues로 남긴다.
      if (!reviews.some(review => same(review.ref, screen))) throw new AuthFailure('APPROVAL_TARGET_CHANGED', 409);
    }
    if (payload.tasks.some(task => task.designRefs.length || task.screenRefs.length)) {
      const args = [pid, payload.designRef.id, payload.designRef.version];
      const items = (await db.query('SELECT item_json FROM anvil.design_items WHERE project_id=$1 AND design_document_id=$2 AND document_version=$3 ORDER BY local_code', args)).rows.map(row => row.item_json);
      const regions = (await db.query('SELECT s.region_json FROM anvil.screen_regions s JOIN anvil.design_items d ON d.project_id=s.project_id AND d.id=s.design_item_id WHERE d.project_id=$1 AND d.design_document_id=$2 AND d.document_version=$3 ORDER BY s.screen_code', args)).rows.map(row => row.region_json);
      for (const task of payload.tasks) for (const link of [...task.designRefs, ...task.screenRefs]) {
        const design = link.kind === 'DESIGN_ITEM', row = (design ? items : regions).find(row => row.id === link.id);
        if (!row) throw new AuthFailure('NOT_FOUND', 404);
        const data = design ? { documentRef: row.documentRef, localCode: row.localCode, title: row.title, anchor: row.anchor }
          : { designItemId: row.designItemId, screenCode: row.screenCode, documentRef: row.documentRef, artifactRef: row.artifactRef, anchor: row.anchor };
        if (contentHash(canonicalJson(data)) !== (design ? row.itemHash : row.regionHash)) throw unavailable();
        if (!same(link.versionRef, row.documentRef) || link.localCode !== (design ? row.localCode : row.screenCode) || link.anchor !== row.anchor
          || design && !same(row.documentRef, payload.designRef)) throw new AuthFailure('TRACE_REFERENCE_MISMATCH', 409);
      }
    }
    if (scope.targetRef) {
      const rows = (await db.query(`SELECT w.head_version,v.content_hash FROM anvil.work_plans w
        JOIN anvil.work_plan_versions v ON v.project_id=w.project_id AND v.plan_id=w.id AND v.version=$3
        WHERE w.project_id=$1 AND w.id=$2 FOR UPDATE OF w`, [pid, scope.targetRef.id, scope.targetRef.version])).rows;
      if (rows.length !== 1 || Number(rows[0].head_version) !== scope.expectedVersion || rows[0].content_hash !== scope.targetRef.contentHash)
        throw new AuthFailure('APPROVAL_TARGET_CHANGED', 409);
    }
    return payload;
    } catch (error) {
      if (error instanceof AuthFailure) throw error;
      throw unavailable();
    }
  }
}
