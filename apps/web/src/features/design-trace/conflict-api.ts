import { ApiClient, ApiError } from '../../api/client.ts';
import { listDocuments, readDocument } from './api.ts';
import { documentControl, editDocument, type DocumentBuffer, type DocumentSession } from './editor-api.ts';
import { nullableStageRef, sameStageRef, validStageBinding } from './stage-api.ts';

export interface DocumentConflictComparison {
  ownerUserId: string; projectId: string; rejectedCommandId: string; baseVersion: number;
  latest: Awaited<ReturnType<typeof readDocument>>; controlGeneration: number; compatible: boolean;
}
export function canCompareDocumentConflict(b: DocumentBuffer): boolean {
  return b.failure?.status === 409 && b.failure.code === 'VERSION_CONFLICT' && b.documentId !== null && !!b.pending?.save && b.pending.save.operation === 'saveDocumentDraft' && b.pending.save.commandId === b.pending.saveCommandId && b.pending.save.targetId === b.documentId && b.pending.save.expectedVersion === b.baseVersion;
}
export async function compareDocumentConflict(client: ApiClient, b: DocumentBuffer, session: DocumentSession): Promise<DocumentConflictComparison> {
  if (b.ownerUserId !== session.user.id || !canCompareDocumentConflict(b)) throw new ApiError('DOCUMENT_CONFLICT_COMPARISON_NOT_READY');
  const [generation, first] = await Promise.all([documentControl(client, b.projectId, session), listDocuments(client, b.projectId, null)]);
  let page = first, found = page.items.find(item => item.id === b.documentId);
  // 읽기 범위는 최대200건. 찾지 못하면 추측한 버전으로 저장하지 않는다.
  for (let n = 1; !found && page.hasMore && n < 4; n++) { page = await listDocuments(client, b.projectId, page.nextCursor); found = page.items.find(item => item.id === b.documentId); }
  if (!found) throw new ApiError('DOCUMENT_COMPARISON_WINDOW_EXCEEDED');
  if (found.headVersion <= b.baseVersion) throw new ApiError('DOCUMENT_CONFLICT_NOT_ADVANCED');
  const latest = await readDocument(client, b.projectId, found.id, found.headVersion), d = latest.document;
  const compatible = nullableStageRef(d.stageNodeRef) && sameStageRef(d.stageNodeRef, b.stageNodeRef ?? null) && (d.stageNodeRef === null || validStageBinding(d.stageBinding!, d.stageNodeRef)) && !d.content.sourceRefs.length && d.formRef.id === b.formRef.id && d.formRef.version === b.formRef.version && d.formRef.contentHash === b.formRef.contentHash && d.content.body.mediaType === b.mediaType && JSON.stringify(d.content.attachments) === JSON.stringify(b.content.attachments);
  return { ownerUserId: session.user.id, projectId: b.projectId, rejectedCommandId: b.pending!.saveCommandId, baseVersion: b.baseVersion, latest, controlGeneration: generation, compatible };
}
export function canPrepareManualConflict(comparison: DocumentConflictComparison): boolean {
  const d = comparison.latest.document;
  return nullableStageRef(d.stageNodeRef) && (d.stageNodeRef === null || validStageBinding(d.stageBinding!, d.stageNodeRef)) && !d.content.sourceRefs.length && ['text/plain;charset=utf-8','text/markdown;charset=utf-8'].includes(d.content.body.mediaType);
}
export function adoptDocumentConflict(b: DocumentBuffer, comparison: DocumentConflictComparison, session: DocumentSession, acknowledged: boolean, resolution: 'KEEP_INPUT' | 'LATEST_METADATA' = 'KEEP_INPUT'): DocumentBuffer {
  if (!acknowledged || b.ownerUserId !== session.user.id || !canCompareDocumentConflict(b) || !(resolution === 'KEEP_INPUT' && comparison.compatible || resolution === 'LATEST_METADATA' && canPrepareManualConflict(comparison)) || comparison.ownerUserId !== session.user.id || comparison.projectId !== b.projectId || comparison.rejectedCommandId !== b.pending!.saveCommandId || comparison.baseVersion !== b.baseVersion || comparison.latest.document.id !== b.documentId || comparison.latest.document.version <= b.baseVersion) throw new ApiError('DOCUMENT_CONFLICT_COMPARISON_NOT_READY');
  const next = editDocument(b.projectId, comparison.latest, session.user.id, comparison.controlGeneration);
  const content = resolution === 'LATEST_METADATA' ? { ...next.content, sections: [] } : structuredClone(b.content);
  return { ...next, title: b.title, body: b.body, reason: b.reason, content, dirty: true, reconciliation: { rejectedCommandId: comparison.rejectedCommandId, fromVersion: b.baseVersion, toVersion: comparison.latest.document.version, resolution, rejectedSnapshot: structuredClone(b.pending!) } };
}
