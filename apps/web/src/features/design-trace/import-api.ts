import { ApiClient, ApiError } from '../../api/client.ts';
import { postDocumentCommand, type DocumentBuffer, type DocumentSession, type DocumentWrite } from './editor-api.ts';
import type { ImportCandidate } from '../../../../server/modules/documents/project-imports.ts';
export interface DocumentImportBuffer { ownerUserId: string; name: string; bytes: Uint8Array<ArrayBuffer>; upload: DocumentWrite; record: DocumentWrite | null; recordCommandId: string; attempted: boolean; candidate: ImportCandidate | null; failure: { code: string; status: number } | null }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const normalize = (v: unknown): unknown => Array.isArray(v) ? v.map(normalize) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).sort(([a],[b]) => a.localeCompare(b)).map(([k,value]) => [k,normalize(value)])) : v;
const equal = (a: unknown, b: unknown) => JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
async function digest(bytes: Uint8Array<ArrayBuffer>) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(v => v.toString(16).padStart(2, '0')).join(''); }
export async function prepareDocumentImport(buffer: DocumentBuffer, session: DocumentSession, file: { name: string; bytes: Uint8Array<ArrayBuffer> }): Promise<DocumentImportBuffer> {
  if (buffer.documentId !== null || buffer.pending || buffer.importState || buffer.importCandidateRef || buffer.ownerUserId !== session.user.id || !uuid.test(buffer.projectId) || !uuid.test(session.clientId) || !Number.isSafeInteger(buffer.controlGeneration) || buffer.controlGeneration < 1 || file.bytes.byteLength > 20 * 1024 * 1024 || !file.name || file.name.length > 255) throw new ApiError('IMPORT_INPUT_INVALID');
  const bytes = new Uint8Array(file.bytes), name = file.name;
  const mediaType = /\.md$/i.test(name) ? 'text/markdown;charset=utf-8' : /\.txt$/i.test(name) ? 'text/plain;charset=utf-8' : 'application/octet-stream';
  return { ownerUserId: session.user.id, name, bytes, upload: { schemaVersion: 1, projectId: buffer.projectId, commandId: crypto.randomUUID(), clientId: session.clientId, controlGeneration: buffer.controlGeneration, operation: 'uploadArtifact', targetId: null, expectedVersion: 0, baselineRefs: [], approvalRef: null, payload: { mediaType, bytes: bytes.length, contentHash: await digest(bytes) } }, record: null, recordCommandId: crypto.randomUUID(), attempted: false, candidate: null, failure: null };
}
function validCandidate(candidate: ImportCandidate, state: DocumentImportBuffer) {
  return candidate && uuid.test(candidate.id) && equal(candidate.originalRef, state.record?.payload.fileRef) && equal(candidate.intendedFormRef, state.record?.payload.intendedFormRef) && ['READY','FAILED','UNSUPPORTED'].includes(candidate.status) && Array.isArray(candidate.losses) && candidate.losses.length === 0 && Array.isArray(candidate.issues) && candidate.issues.length <= 200 && candidate.issues.every(i => i && typeof i.code === 'string' && typeof i.message === 'string') && (candidate.status === 'READY' ? candidate.parserVersion === 'UTF8_IDENTITY_1' && equal(candidate.extractedContentRef, candidate.originalRef) && candidate.originalRef.bytes <= 2 * 1024 * 1024 && ['text/plain;charset=utf-8','text/markdown;charset=utf-8'].includes(candidate.originalRef.mediaType) : candidate.extractedContentRef === null);
}
export async function continueDocumentImport(client: ApiClient, state: DocumentImportBuffer, formRef: DocumentBuffer['formRef'], session: DocumentSession, checkpoint: (state: DocumentImportBuffer) => void, active: () => boolean): Promise<DocumentImportBuffer> {
  const u = state.upload;
  if (state.ownerUserId !== session.user.id || u.clientId !== session.clientId || !uuid.test(u.projectId) || !uuid.test(u.commandId) || !uuid.test(state.recordCommandId) || !uuid.test(session.clientId) || !/^[A-Za-z0-9_-]{43}$/.test(session.csrfToken) || u.operation !== 'uploadArtifact' || u.targetId !== null || u.expectedVersion !== 0 || u.schemaVersion !== 1 || u.baselineRefs.length || u.approvalRef !== null || !Number.isSafeInteger(u.controlGeneration) || u.controlGeneration < 1 || u.payload.bytes !== state.bytes.byteLength || state.bytes.byteLength > 20 * 1024 * 1024 || u.payload.contentHash !== await digest(state.bytes) || !['text/plain;charset=utf-8','text/markdown;charset=utf-8','application/octet-stream'].includes(String(u.payload.mediaType))) throw new ApiError('IMPORT_INPUT_INVALID');
  let next = state;
  if (!active()) throw new ApiError('SAVE_CONTINUATION_PAUSED');
  if (!next.record) {
    const response = await postDocumentCommand(client, u, session.csrfToken, state.bytes), a = response.data?.artifactRef;
    if (!a || !uuid.test(a.artifactId) || a.bytes !== u.payload.bytes || a.contentHash !== u.payload.contentHash || a.mediaType !== u.payload.mediaType || response.targetId !== a.artifactId || response.version !== null || response.data.status !== 'ARTIFACT_READY') throw new ApiError('RESPONSE_INVALID');
    next = { ...next, record: { ...u, commandId: state.recordCommandId, operation: 'importDocument', payload: { fileRef: a, intendedFormRef: { ...formRef }, sourceRefs: [] } } }; checkpoint(next);
  }
  const record = next.record!;
  const a = record.payload.fileRef as ImportCandidate['originalRef'];
  if (!a || !uuid.test(a.artifactId) || a.bytes !== u.payload.bytes || a.contentHash !== u.payload.contentHash || a.mediaType !== u.payload.mediaType || record.commandId !== state.recordCommandId || record.projectId !== u.projectId || record.clientId !== u.clientId || record.controlGeneration !== u.controlGeneration || record.operation !== 'importDocument' || record.targetId !== null || record.expectedVersion !== 0 || record.schemaVersion !== 1 || record.approvalRef !== null || record.baselineRefs.length || !equal(record.payload.intendedFormRef, formRef) || !equal(record.payload.sourceRefs, [])) throw new ApiError('IMPORT_INPUT_INVALID');
  if (!active()) throw new ApiError('SAVE_CONTINUATION_PAUSED');
  const response = await postDocumentCommand(client, record, session.csrfToken), candidate = response.data?.candidate as ImportCandidate;
  if (!validCandidate(candidate, next) || response.targetId !== candidate.originalRef.artifactId || response.version !== null || response.data.status !== 'IMPORT_CANDIDATE') throw new ApiError('RESPONSE_INVALID');
  return { ...next, candidate, failure: null };
}
export async function adoptDocumentImport(client: ApiClient, buffer: DocumentBuffer, session: DocumentSession): Promise<DocumentBuffer> {
  const state = buffer.importState;
  if (!state?.candidate || buffer.documentId !== null || buffer.pending || state.ownerUserId !== session.user.id || buffer.ownerUserId !== session.user.id || state.upload.clientId !== session.clientId || state.upload.projectId !== buffer.projectId || !validCandidate(state.candidate, state) || state.candidate.status !== 'READY') throw new ApiError('IMPORT_SELECTION_REQUIRED');
  const candidate = await client.get<ImportCandidate>(`/api/v1/projects/${buffer.projectId}/imports/${state.candidate.id}`);
  if (!validCandidate(candidate, state) || candidate.id !== state.candidate.id || candidate.status !== 'READY' || await digest(state.bytes) !== candidate.originalRef.contentHash || state.bytes.length !== candidate.originalRef.bytes || !equal(candidate.intendedFormRef, buffer.formRef)) throw new ApiError('IMPORT_INTEGRITY_FAILED');
  let body: string; try { body = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(state.bytes); } catch { throw new ApiError('DOCUMENT_UTF8_INVALID'); }
  return { ...buffer, body, mediaType: candidate.originalRef.mediaType, title: buffer.title || state.name, content: { attachments: [candidate.originalRef], sections: [], sourceRefs: [] }, importCandidateRef: candidate.id, importState: null, dirty: true, savedRef: null, failure: null };
}
