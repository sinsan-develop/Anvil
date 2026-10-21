import { ApiClient, ApiError } from '../../api/client.ts';
import type { DocumentVersion } from './api.ts';
import type { FormVersion } from '../methodologies/forms-api.ts';
import type { DocumentImportBuffer } from './import-api.ts';
import type { DocumentProposalBuffer } from './proposal-api.ts';
import type { DesignIndexBuffer } from './design-index-api.ts';
import type { WorkPlanBuffer } from './work-plan-api.ts';
import { nullableStageRef, sameStageRef, validStageBinding, type StageNodeRef } from './stage-api.ts';

type VersionRef = { id: string; version: number; contentHash: string };
type ArtifactRef = { artifactId: string; bytes: number; contentHash: string; mediaType: string };
export interface DocumentContent { body: ArtifactRef; attachments: ArtifactRef[]; sections: { itemId: string; anchor: string }[]; sourceRefs: [] }
export interface DocumentWrite { schemaVersion: 1; projectId: string; commandId: string; clientId: string; controlGeneration: number; operation: 'cancelQueuedRequest' | 'submitResult' | 'defineProjectRole' | 'bindResponsibleSession' | 'prepareExecution' | 'saveBaselineDraft' | 'reviewBaselineContent' | 'confirmBaseline' | 'uploadArtifact' | 'saveDocumentDraft' | 'detachDocumentSource' | 'importDocument' | 'proposeDocumentChange' | 'proposeDesignChange' | 'reviewChangeImpact' | 'indexDesignDocument' | 'saveWorkPlanDraft' | 'prepareAssignment' | 'reviewAssignmentContent' | 'confirmAssignment' | 'buildTaskContext' | 'linkTrace' | 'saveKnowledge' | 'appendConversation' | 'excludeKnowledge' | 'correctKnowledge' | 'recordContentReview' | 'confirmKnowledge' | 'confirmWorkPlan' | 'applyConstitution'; targetId: string | null; expectedVersion: number; baselineRefs: []; approvalRef: null | {requestId:string;decisionId:string;scopeDigest:string}; payload: Record<string, unknown> }
export interface PendingDocumentSave { body: string; upload: DocumentWrite; save: DocumentWrite | null; saveCommandId: string; title: string; formRef: VersionRef; documentId: string | null; baseVersion: number; content: Omit<DocumentContent, 'body'>; reason: string; importCandidateRef?: string | null; stageNodeRef?: StageNodeRef | null }
export interface DocumentBuffer {
  ownerUserId: string; projectId: string; documentId: string | null; baseVersion: number; formRef: VersionRef;
  title: string; body: string; mediaType: string; content: Omit<DocumentContent, 'body'>; criteria: DocumentVersion['contentReviewCriteria']['items'];
reason: string; controlGeneration: number; dirty: boolean; pending: PendingDocumentSave | null; savedRef: VersionRef | null; failure: { code: string; status: number; quarantinedArtifactId?:string } | null;
  reconciliation?: { rejectedCommandId: string; fromVersion: number; toVersion: number; resolution?: 'KEEP_INPUT' | 'LATEST_METADATA'; rejectedSnapshot?: PendingDocumentSave };
  importState?: DocumentImportBuffer | null; importCandidateRef?: string | null; importPreparationId?: string | null;
  baseHash?: string; baseTitle?: string; proposalState?: DocumentProposalBuffer | null;
  designIndexState?:DesignIndexBuffer|null;
  workPlanState?:WorkPlanBuffer|null;
  stageNodeRef?: StageNodeRef | null;
  baseStageNodeRef?: StageNodeRef | null;
}
export interface DocumentSession { user: { id: string }; clientId: string; csrfToken: string }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/, hash = /^[0-9a-f]{64}$/;
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join(',') === [...keys].sort().join(',');
const artifact = (ref: ArtifactRef) => ref && exact(ref, ['artifactId','bytes','contentHash','mediaType']) && uuid.test(ref.artifactId) && Number.isSafeInteger(ref.bytes) && ref.bytes >= 0 && ref.bytes <= 20 * 1024 * 1024 && hash.test(ref.contentHash) && typeof ref.mediaType === 'string';
const versionRef = (ref: VersionRef) => ref && exact(ref, ['id','version','contentHash']) && uuid.test(ref.id) && Number.isSafeInteger(ref.version) && ref.version > 0 && hash.test(ref.contentHash);
async function digest(bytes: Uint8Array<ArrayBuffer>) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(value => value.toString(16).padStart(2, '0')).join(''); }
export async function documentDraftHash(title: string, formRef: VersionRef, content: DocumentContent, selectedStage: StageNodeRef | null = null): Promise<string> {
  // 저장 계약의 제한된 문서 자료만 canonical key 순서로 만든다. 임의 객체/스크립트는 받지 않는다.
  const file = (ref: ArtifactRef) => ({ artifactId: ref.artifactId, bytes: ref.bytes, contentHash: ref.contentHash, mediaType: ref.mediaType });
  if (!nullableStageRef(selectedStage)) throw new ApiError('DOCUMENT_STAGE_INPUT_INVALID');
  const stageNodeRef = selectedStage === null ? null : { applicationId: selectedStage.applicationId, nodeId: selectedStage.nodeId };
  return digest(new TextEncoder().encode(JSON.stringify({ content: { attachments: content.attachments.map(file), body: file(content.body), sections: content.sections.map(section => ({ anchor: section.anchor, itemId: section.itemId })), sourceRefs: [] }, formRef: { contentHash: formRef.contentHash, id: formRef.id, version: formRef.version }, stageNodeRef, title })));
}
export async function documentControl(client: ApiClient, projectId: string, session: DocumentSession): Promise<number> {
  if (!uuid.test(projectId)) throw new ApiError('CLIENT_PATH_INVALID');
  const value = await client.get<{ id: string; participation: string; controlState: { actorId: string; clientId: string; generation: number; status: string } }>(`/api/v1/projects/${projectId}`), state = value?.controlState;
  if (value?.id !== projectId || !state || !Number.isSafeInteger(state.generation) || state.generation < 1) throw new ApiError('RESPONSE_INVALID');
  if (value.participation !== 'OWNER' || state.status !== 'HELD' || state.actorId !== session.user.id || state.clientId !== session.clientId) throw new ApiError('PROJECT_CONTROL_REQUIRED', 403);
  return state.generation;
}
export function editDocument(projectId: string, value: { document: DocumentVersion; body: string }, ownerUserId: string, controlGeneration: number): DocumentBuffer {
  const d = value.document;
  if (!nullableStageRef(d.stageNodeRef) || d.stageNodeRef !== null && !validStageBinding(d.stageBinding!, d.stageNodeRef) || d.content.sourceRefs.length) throw new ApiError('DOCUMENT_REFERENCE_CONNECTION_PENDING', 412);
  return { ownerUserId, projectId, stageNodeRef: structuredClone(d.stageNodeRef as StageNodeRef | null), documentId: d.id, baseVersion: d.version, baseHash: d.contentHash, baseTitle: d.title, baseStageNodeRef: structuredClone(d.stageNodeRef as StageNodeRef | null), formRef: { ...d.formRef }, title: d.title, body: value.body, mediaType: d.content.body.mediaType, content: { attachments: structuredClone(d.content.attachments), sections: structuredClone(d.content.sections), sourceRefs: [] }, criteria: structuredClone(d.contentReviewCriteria.items), reason: '', controlGeneration, dirty: false, pending: null, savedRef: null, failure: null };
}
export function newDocument(projectId: string, form: FormVersion, ownerUserId: string, controlGeneration: number): DocumentBuffer {
  return { ownerUserId, projectId, stageNodeRef: null, documentId: null, baseVersion: 0, formRef: { ...form.ref }, title: '', body: '', mediaType: 'text/markdown;charset=utf-8', content: { attachments: [], sections: [], sourceRefs: [] }, criteria: form.definition.items.map(item => ({ criterionId: item.itemId, title: item.title, reviewCriteria: [...item.reviewCriteria] })), reason: '', controlGeneration, dirty: false, pending: null, savedRef: null, failure: null };
}
export async function prepareDocumentSave(buffer: DocumentBuffer, session: DocumentSession): Promise<PendingDocumentSave> {
  if (!nullableStageRef(buffer.stageNodeRef ?? null)) throw new ApiError('DOCUMENT_STAGE_INPUT_INVALID');
  if(buffer.designIndexState||buffer.workPlanState) throw new ApiError('DOCUMENT_PENDING_RESULT');
  if (buffer.proposalState) throw new ApiError('PROPOSAL_PENDING_RESULT');
  if (buffer.importPreparationId || buffer.importState || buffer.importCandidateRef != null && !uuid.test(buffer.importCandidateRef)) throw new ApiError('IMPORT_SELECTION_REQUIRED');
  if (buffer.ownerUserId !== session.user.id || !uuid.test(buffer.projectId) || buffer.documentId !== null && !uuid.test(buffer.documentId) || buffer.documentId === null && buffer.baseVersion !== 0 || buffer.documentId !== null && buffer.baseVersion < 1 || !uuid.test(session.clientId) || !versionRef(buffer.formRef) || !Number.isSafeInteger(buffer.baseVersion) || !Number.isSafeInteger(buffer.baseVersion + 1) || !Number.isSafeInteger(buffer.controlGeneration) || buffer.controlGeneration < 1) throw new ApiError('CLIENT_PATH_INVALID');
  if (!buffer.title.trim() || buffer.title.length > 200 || !buffer.title.isWellFormed() || !buffer.body.isWellFormed() || !buffer.reason.trim() || buffer.reason.length > 20_000 || !['text/plain;charset=utf-8','text/markdown;charset=utf-8'].includes(buffer.mediaType)) throw new ApiError('DOCUMENT_INPUT_INVALID');
  if (buffer.content.sourceRefs.length || !Array.isArray(buffer.content.attachments) || buffer.content.attachments.length > 200 || !buffer.content.attachments.every(artifact) || !Array.isArray(buffer.content.sections) || buffer.content.sections.length > 200 || new Set(buffer.content.sections.map(item => item.itemId)).size !== buffer.content.sections.length || buffer.content.sections.some(item => !exact(item, ['itemId','anchor']) || typeof item.itemId !== 'string' || typeof item.anchor !== 'string' || !/^line:[1-9][0-9]{0,7}$/.test(item.anchor))) throw new ApiError('DOCUMENT_INPUT_INVALID');
  const bytes = new TextEncoder().encode(buffer.body); if (bytes.length > 2 * 1024 * 1024) throw new ApiError('DOCUMENT_BODY_TOO_LARGE');
  const upload: DocumentWrite = { schemaVersion: 1, projectId: buffer.projectId, commandId: crypto.randomUUID(), clientId: session.clientId, controlGeneration: buffer.controlGeneration, operation: 'uploadArtifact', targetId: null, expectedVersion: 0, baselineRefs: [], approvalRef: null, payload: { mediaType: buffer.mediaType, bytes: bytes.length, contentHash: await digest(bytes) } };
  return { stageNodeRef: structuredClone(buffer.stageNodeRef ?? null), body: buffer.body, upload, save: null, saveCommandId: crypto.randomUUID(), title: buffer.title, formRef: { ...buffer.formRef }, documentId: buffer.documentId, baseVersion: buffer.baseVersion, content: structuredClone(buffer.content), reason: buffer.reason, importCandidateRef: buffer.importCandidateRef ?? null };
}
export async function postDocumentCommand(client: ApiClient, command: DocumentWrite, csrf: string, bytes?: Uint8Array<ArrayBuffer>) {
  let response: Response;
  try { response = await client.transport.call(globalThis, `/api/v1/projects/${command.projectId}/${bytes ? 'files' : 'commands'}`, { method: 'POST', credentials: 'same-origin', redirect: 'error', cache: 'no-store', headers: { Accept: 'application/json', 'Content-Type': bytes ? 'application/octet-stream' : 'application/json', 'X-Anvil-CSRF': csrf, 'Idempotency-Key': command.commandId, ...(bytes ? { 'X-Anvil-Command': JSON.stringify(command) } : {}) }, body: bytes ?? JSON.stringify(command) }); }
  catch { throw new ApiError('CONNECTION_LOST'); }
  let value: any; try { if (!/^application\/json\b/i.test(response.headers.get('content-type') ?? '')) throw Error(); value = await response.json(); } catch { throw new ApiError('RESPONSE_INVALID', response.status); }
  if (!response.ok) throw new ApiError(typeof value?.code === 'string' && /^[A-Z_]{1,64}$/.test(value.code) ? value.code : 'REQUEST_FAILED', response.status);
  if (!value || value.commandId !== command.commandId || value.projectId !== command.projectId || value.status !== 'APPLIED' || !uuid.test(value.operationId) || !Number.isFinite(Date.parse(value.serverReceivedAt))) throw new ApiError('RESPONSE_INVALID');
  if(bytes&&value.data?.status==='ARTIFACT_QUARANTINED'){
    const r=value.data.artifactRef,i=value.data.inspection,allowed=['PRIVATE_KEY_MARKER','BEARER_TOKEN_MARKER','SECRET_ASSIGNMENT_MARKER'];
    if(command.operation!=='uploadArtifact'||!artifact(r)||r.bytes!==command.payload.bytes||r.contentHash!==command.payload.contentHash||r.mediaType!==command.payload.mediaType||value.targetId!==r.artifactId||value.version!==null||!i||i.policyVersion!==1||i.method!=='KNOWN_PATTERNS_RAW_BYTES'||i.complete!==false||i.state!=='SUSPECTED'||!Array.isArray(i.reasonCodes)||!i.reasonCodes.length||i.reasonCodes.length>3||new Set(i.reasonCodes).size!==i.reasonCodes.length||i.reasonCodes.some((reason:unknown)=>typeof reason!=='string'||!allowed.includes(reason)))throw new ApiError('RESPONSE_INVALID');
    throw new ApiError('ARTIFACT_QUARANTINED',412,r.artifactId);
  }
  return value;
}
export async function continueDocumentSave(client: ApiClient, pending: PendingDocumentSave, session: DocumentSession, checkpoint: (value: PendingDocumentSave) => void, active: () => boolean): Promise<VersionRef> {
  const u = pending.upload;
  if (!nullableStageRef(pending.stageNodeRef ?? null)) throw new ApiError('DOCUMENT_STAGE_INPUT_INVALID');
  if (!exact(u, ['schemaVersion','projectId','commandId','clientId','controlGeneration','operation','targetId','expectedVersion','baselineRefs','approvalRef','payload']) || u.schemaVersion !== 1 || !uuid.test(u.projectId) || !uuid.test(u.commandId) || u.clientId !== session.clientId || !uuid.test(session.clientId) || !/^[A-Za-z0-9_-]{43}$/.test(session.csrfToken) || !Number.isSafeInteger(u.controlGeneration) || u.controlGeneration < 1 || u.operation !== 'uploadArtifact' || u.targetId !== null || u.expectedVersion !== 0 || !Array.isArray(u.baselineRefs) || u.baselineRefs.length || u.approvalRef !== null || pending.documentId !== null && !uuid.test(pending.documentId) || pending.documentId === null && pending.baseVersion !== 0 || pending.documentId !== null && (!Number.isSafeInteger(pending.baseVersion) || pending.baseVersion < 1) || !uuid.test(pending.saveCommandId) || !versionRef(pending.formRef)) throw new ApiError('CLIENT_PATH_INVALID');
  const bytes = new TextEncoder().encode(pending.body);
  if (!pending.body.isWellFormed() || bytes.length > 2 * 1024 * 1024 || !exact(u.payload, ['bytes','contentHash','mediaType']) || u.payload.bytes !== bytes.length || u.payload.contentHash !== await digest(bytes) || !['text/plain;charset=utf-8','text/markdown;charset=utf-8'].includes(String(u.payload.mediaType))) throw new ApiError('DOCUMENT_INPUT_INVALID');
  let next = pending;
  if (!active()) throw new ApiError('SAVE_CONTINUATION_PAUSED');
  if (!next.save) {
    const response = await postDocumentCommand(client, u, session.csrfToken, bytes), ref = response.data?.artifactRef as ArtifactRef;
    if (!artifact(ref) || ref.bytes !== u.payload.bytes || ref.contentHash !== u.payload.contentHash || ref.mediaType !== u.payload.mediaType || response.targetId !== ref.artifactId || response.version !== null || response.data.status !== 'ARTIFACT_READY') throw new ApiError('RESPONSE_INVALID');
    const save: DocumentWrite = { ...u, commandId: pending.saveCommandId, operation: 'saveDocumentDraft', targetId: pending.documentId, expectedVersion: pending.baseVersion, payload: { title: pending.title, formRef: pending.formRef, stageNodeRef: pending.stageNodeRef ?? null, content: { body: ref, ...pending.content }, importCandidateRef: pending.importCandidateRef ?? null, reason: pending.reason } };
    next = { ...pending, save }; checkpoint(next);
  }
  if (!active()) throw new ApiError('SAVE_CONTINUATION_PAUSED');
  const s = next.save!;
  if (!exact(s, ['schemaVersion','projectId','commandId','clientId','controlGeneration','operation','targetId','expectedVersion','baselineRefs','approvalRef','payload']) || s.schemaVersion !== 1 || !Array.isArray(s.baselineRefs) || s.baselineRefs.length || s.approvalRef !== null || s.projectId !== u.projectId || s.clientId !== u.clientId || s.controlGeneration !== u.controlGeneration || s.operation !== 'saveDocumentDraft' || s.commandId !== pending.saveCommandId || s.targetId !== pending.documentId || s.expectedVersion !== pending.baseVersion || !exact(s.payload, ['title','formRef','stageNodeRef','content','importCandidateRef','reason']) || s.payload.title !== pending.title || s.payload.reason !== pending.reason || JSON.stringify(s.payload.formRef) !== JSON.stringify(pending.formRef) || !sameStageRef(s.payload.stageNodeRef, pending.stageNodeRef ?? null) || s.payload.importCandidateRef !== (pending.importCandidateRef ?? null) || pending.importCandidateRef != null && !uuid.test(pending.importCandidateRef)) throw new ApiError('CLIENT_PATH_INVALID');
  const content = s.payload.content as DocumentContent;
  if (!artifact(content?.body) || content.body.contentHash !== u.payload.contentHash || content.body.bytes !== bytes.length || content.body.mediaType !== u.payload.mediaType || JSON.stringify({ attachments: content.attachments, sections: content.sections, sourceRefs: content.sourceRefs }) !== JSON.stringify(pending.content)) throw new ApiError('DOCUMENT_INPUT_INVALID');
  const response = await postDocumentCommand(client, s, session.csrfToken), ref = response.data?.ref;
  if (!versionRef(ref) || pending.documentId !== null && ref.id !== pending.documentId || ref.version !== pending.baseVersion + 1 || ref.contentHash !== await documentDraftHash(pending.title, pending.formRef, content, pending.stageNodeRef ?? null) || response.targetId !== ref.id || response.version !== ref.version || response.data.status !== 'DRAFT') throw new ApiError('RESPONSE_INVALID');
  return ref;
}
