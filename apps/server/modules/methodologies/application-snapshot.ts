import type { QueryResultRow } from 'pg';
import type { MethodologyGraph } from '../../../../contracts/methodologies.ts';
import { canonicalJson, contentHash } from '../../../../contracts/canonical.ts';
import { isVersionRef } from '../../../../contracts/references.ts';
import { AuthFailure } from '../access/repository.ts';
import { exactMethodObject } from './project-input.ts';
import { validateMethodologyGraph } from './service.ts';

// 같은 SQL snapshot에서 얻은 행에도 기존 적용본 GET과 동일한 무결성 기준을 적용한다.
export function readApplicationSnapshot(projectId: string, rows: QueryResultRow[]) {
  const base = { projectId, observedAt: new Date().toISOString(), executionState: 'NOT_CONNECTED' as const };
  if (!rows.length) return { ...base, applicationRef: null, snapshot: null };
  try {
    const row = rows[0]!, snapshot = row.snapshot_json;
    const applicationRef = { id: row.id, version: Number(row.application_version), contentHash: row.snapshot_hash };
    const keys = ['name', 'purpose', 'graph', 'sourceRef', ...(snapshot?.draftConfirmationRef !== undefined ? ['draftConfirmationRef'] : [])];
    if (rows.length !== 1 || row.project_id !== projectId || !isVersionRef(applicationRef) || !exactMethodObject(snapshot, keys)
      || typeof snapshot.name !== 'string' || snapshot.name.length > 200 || !snapshot.name.isWellFormed() || typeof snapshot.purpose !== 'string' || snapshot.purpose.length > 20000 || !snapshot.purpose.isWellFormed()
      || !isVersionRef(snapshot.sourceRef) || snapshot.sourceRef.id !== row.source_definition_id || snapshot.sourceRef.version !== Number(row.source_version) || snapshot.sourceRef.contentHash !== row.source_hash
      || contentHash(canonicalJson(snapshot)) !== row.snapshot_hash || contentHash(canonicalJson(snapshot.graph)) !== row.source_hash) throw Error('invalid');
    const draft = snapshot.draftConfirmationRef;
    if (draft !== undefined && (!exactMethodObject(draft, ['draftRef', 'confirmationId']) || !isVersionRef(draft.draftRef) || draft.draftRef.contentHash !== row.source_hash || !isVersionRef({ id: draft.confirmationId, version: 1, contentHash: row.source_hash }))) throw Error('invalid');
    if (validateMethodologyGraph(snapshot.graph, []).issues.some(issue => issue.code === 'INPUT_INVALID')) throw Error('invalid');
    const graph = snapshot.graph as MethodologyGraph;
    const declaredForms = graph.nodes.flatMap(node => [...node.inputs, ...node.outputs].map(item => item.formRef));
    if (!validateMethodologyGraph(graph, declaredForms).validForConfirmation) throw Error('invalid');
    return { ...base, applicationRef, snapshot };
  } catch { throw new AuthFailure('METHODOLOGY_APPLICATION_INTEGRITY_FAILED', 503); }
}
