import { AuthFailure } from '../access/repository.ts';
import type { VersionRef } from '../../../../contracts/generated-types.ts';
import type { PoolClient } from 'pg';
import type { AuthenticatedIdentity } from '../access/repository.ts';
import { projectMember } from '../access/project-command.ts';
import { canonicalJson, contentHash } from '../../../../contracts/canonical.ts';
import { isVersionRef } from '../../../../contracts/references.ts';
import type { MethodologyGraph } from '../../../../contracts/methodologies.ts';
export interface StageNodeRef { applicationId: string; nodeId: string }
export function readStageNodeRef(value: unknown): StageNodeRef | null {
  if (value === null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join(',') !== 'applicationId,nodeId') throw new AuthFailure('DOCUMENT_STAGE_INPUT_INVALID', 422);
  const ref = value as Record<string, unknown>;
  if (typeof ref.applicationId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(ref.applicationId) || typeof ref.nodeId !== 'string' || !ref.nodeId.trim() || ref.nodeId.length > 200 || !ref.nodeId.isWellFormed() || /[\u0000-\u001f\u007f]/.test(ref.nodeId)) throw new AuthFailure('DOCUMENT_STAGE_INPUT_INVALID', 422);
  return { applicationId: ref.applicationId, nodeId: ref.nodeId };
}
export function nodeUsesForm(node: { inputs: { formRef: VersionRef }[]; outputs: { formRef: VersionRef }[] }, ref: VersionRef): ('INPUT' | 'OUTPUT')[] {
  return (['INPUT', 'OUTPUT'] as const).filter(kind => node[kind === 'INPUT' ? 'inputs' : 'outputs'].some(item => item.formRef.id === ref.id && item.formRef.version === ref.version && item.formRef.contentHash === ref.contentHash));
}
async function application(db: PoolClient, projectId: string, id: string | null) {
  const row = (await db.query('SELECT * FROM anvil.project_methodologies WHERE project_id=$1 AND ($2::uuid IS NULL OR id=$2) ORDER BY application_version DESC LIMIT 1', [projectId, id])).rows[0];
  if (!row) { if (id) throw new AuthFailure('NOT_FOUND', 404); return null; }
  const snapshot = row.snapshot_json;
  if (!snapshot || typeof snapshot.name !== 'string' || typeof snapshot.purpose !== 'string' || !isVersionRef(snapshot.sourceRef) || snapshot.sourceRef.id !== row.source_definition_id || snapshot.sourceRef.version !== Number(row.source_version) || snapshot.sourceRef.contentHash !== row.source_hash || contentHash(canonicalJson(snapshot)) !== row.snapshot_hash || contentHash(canonicalJson(snapshot.graph)) !== row.source_hash || !Array.isArray(snapshot.graph?.nodes) || !Array.isArray(snapshot.graph?.edges)) throw new AuthFailure('METHODOLOGY_APPLICATION_INTEGRITY_FAILED', 503);
  return { ref: { id: row.id, version: Number(row.application_version), contentHash: row.snapshot_hash }, name: snapshot.name as string, graph: snapshot.graph as MethodologyGraph };
}
export async function documentStageBinding(db: PoolClient, projectId: string, raw: unknown, formRef: VersionRef, requireCurrent: boolean) {
  const ref = readStageNodeRef(raw); if (!ref) return null;
  const applied = (await application(db, projectId, ref.applicationId))!;
  if (requireCurrent) { const current = await application(db, projectId, null); if (current?.ref.id !== applied.ref.id) throw new AuthFailure('METHODOLOGY_APPLICATION_CHANGED', 409); }
  const node = applied.graph.nodes.find(item => item.nodeId === ref.nodeId);
  if (!node) throw new AuthFailure('DOCUMENT_STAGE_NODE_INVALID', requireCurrent ? 422 : 503);
  const uses = nodeUsesForm(node, formRef);
  if (!uses.length) throw new AuthFailure('DOCUMENT_STAGE_FORM_MISMATCH', requireCurrent ? 422 : 503);
  return { applicationRef: applied.ref, methodologyName: applied.name, nodeId: node.nodeId, nodeName: node.name, uses };
}
export async function documentStageOptions(db: PoolClient, actor: AuthenticatedIdentity, projectId: string, raw: Record<string, unknown>) {
  await projectMember(db, actor, projectId);
  if (Object.keys(raw).sort().join(',') !== 'formHash,formId,formVersion' || typeof raw.formVersion !== 'string' || !/^[1-9][0-9]{0,14}$/.test(raw.formVersion)) throw new AuthFailure('INPUT_INVALID', 400);
  const ref = { id: raw.formId, version: Number(raw.formVersion), contentHash: raw.formHash };
  if (!isVersionRef(ref)) throw new AuthFailure('INPUT_INVALID', 400);
  const form = (await db.query("SELECT v.definition_json,v.content_hash FROM anvil.form_definitions d JOIN anvil.form_versions v ON v.definition_id=d.id AND v.version=$2 WHERE d.id=$1 AND (d.scope='SYSTEM' OR d.scope='USER_COMMON' AND d.owner_user_id=$3)", [ref.id, ref.version, actor.actorId])).rows[0];
  if (!form || form.content_hash !== ref.contentHash || contentHash(canonicalJson(form.definition_json)) !== ref.contentHash) throw new AuthFailure('FORM_REFERENCE_INVALID', 422);
  const applied = await application(db, projectId, null);
  const items = applied ? applied.graph.nodes.flatMap(node => { const uses = nodeUsesForm(node, ref); return uses.length ? [{ stageNodeRef: { applicationId: applied.ref.id, nodeId: node.nodeId }, nodeName: node.name, nodeKind: node.kind, uses }] : []; }) : [];
  return { projectId, formRef: ref, applicationRef: applied?.ref ?? null, methodologyName: applied?.name ?? null, items, status: !applied ? 'NO_APPLICATION' : items.length ? 'READY' : 'FORM_NOT_LINKED', observedAt: new Date().toISOString() };
}
