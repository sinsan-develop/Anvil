import { ApiClient, ApiError } from '../../api/client.ts';
import type { DocumentVersion } from './api.ts';
import type { DocumentSession } from './editor-api.ts';
type VersionRef = { id: string; version: number; contentHash: string };
type ReviewRef = { id: string; criteriaVersion: number; targetRef: VersionRef; outcome: string };
export interface DocumentConfirmationCommand {
  schemaVersion: 1; projectId: string; commandId: string; clientId: string; controlGeneration: number;
  operation: 'confirmDocument'; targetId: string; expectedVersion: number; baselineRefs: []; approvalRef: null;
  payload: { versionRef: VersionRef; formRef: VersionRef; reviewRefs: ReviewRef[] };
}
export interface DocumentConfirmationBuffer {
  ownerUserId: string; projectId: string; title: string; ref: VersionRef; formRef: VersionRef; reviewRefs: ReviewRef[];
  controlGeneration: number; acknowledged: boolean; pending: DocumentConfirmationCommand | null; saved: boolean; failure: { code: string; status: number } | null;
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join(',') === [...keys].sort().join(',');
const reference = (r: VersionRef) => r && exact(r, ['id','version','contentHash']) && uuid.test(r.id) && Number.isSafeInteger(r.version) && r.version > 0 && /^[0-9a-f]{64}$/.test(r.contentHash);
const sameRef = (a: VersionRef, b: VersionRef) => reference(a) && reference(b) && a.id === b.id && a.version === b.version && a.contentHash === b.contentHash;
export function latestAcceptedDocumentReview(document: DocumentVersion): ReviewRef | null {
  if (document.confirmed || !document.validation.validForConfirmation) return null;
  const latest = document.contentReviews.reduce<DocumentVersion['contentReviews'][number] | null>((value, item) => !value || item.serverSequence > value.serverSequence ? item : value, null);
  const ids = new Set(document.contentReviewCriteria.items.map(item => item.criterionId));
  if (!latest || latest.ref.outcome !== 'ACCEPTED' || latest.items.length !== ids.size || new Set(latest.items.map(item => item.criterionId)).size !== ids.size || latest.items.some(item => !ids.has(item.criterionId) || item.outcome !== 'ACCEPTED')) return null;
  return latest.ref;
}
export function newDocumentConfirmation(projectId: string, document: DocumentVersion, ownerUserId: string, controlGeneration: number): DocumentConfirmationBuffer {
  const review = latestAcceptedDocumentReview(document); if (!review) throw new ApiError('DOCUMENT_NOT_READY_FOR_CONFIRMATION', 422);
  return { ownerUserId, projectId, title: document.title, ref: { id: document.id, version: document.version, contentHash: document.contentHash }, formRef: { ...document.formRef }, reviewRefs: [structuredClone(review)], controlGeneration, acknowledged: false, pending: null, saved: false, failure: null };
}
function validate(b: DocumentConfirmationBuffer, session: DocumentSession) {
  if (b.ownerUserId !== session.user.id || !uuid.test(b.projectId) || !uuid.test(session.clientId) || !/^[A-Za-z0-9_-]{43}$/.test(session.csrfToken) || !reference(b.ref) || !reference(b.formRef) || !Number.isSafeInteger(b.controlGeneration) || b.controlGeneration < 1 || !Array.isArray(b.reviewRefs) || b.reviewRefs.length !== 1 || b.reviewRefs.some(r => !exact(r, ['id','criteriaVersion','targetRef','outcome']) || !uuid.test(r.id) || r.criteriaVersion !== 1 || r.outcome !== 'ACCEPTED' || !sameRef(r.targetRef, b.ref))) throw new ApiError('CLIENT_PATH_INVALID');
  if (!b.acknowledged) throw new ApiError('DOCUMENT_CONFIRMATION_REQUIRED', 422);
}
export function prepareDocumentConfirmation(b: DocumentConfirmationBuffer, session: DocumentSession): DocumentConfirmationCommand {
  validate(b, session);
  return { schemaVersion: 1, projectId: b.projectId, commandId: crypto.randomUUID(), clientId: session.clientId, controlGeneration: b.controlGeneration, operation: 'confirmDocument', targetId: b.ref.id, expectedVersion: b.ref.version, baselineRefs: [], approvalRef: null, payload: { versionRef: { ...b.ref }, formRef: { ...b.formRef }, reviewRefs: structuredClone(b.reviewRefs) } };
}
export async function sendDocumentConfirmation(client: ApiClient, b: DocumentConfirmationBuffer, session: DocumentSession, active: () => boolean) {
  validate(b, session); const c = b.pending;
  if (!c || !exact(c, ['schemaVersion','projectId','commandId','clientId','controlGeneration','operation','targetId','expectedVersion','baselineRefs','approvalRef','payload']) || c.schemaVersion !== 1 || !uuid.test(c.commandId) || c.projectId !== b.projectId || c.clientId !== session.clientId || c.controlGeneration !== b.controlGeneration || c.operation !== 'confirmDocument' || c.targetId !== b.ref.id || c.expectedVersion !== b.ref.version || !Array.isArray(c.baselineRefs) || c.baselineRefs.length || c.approvalRef !== null || !exact(c.payload, ['versionRef','formRef','reviewRefs']) || !sameRef(c.payload.versionRef, b.ref) || !sameRef(c.payload.formRef, b.formRef) || JSON.stringify(c.payload.reviewRefs) !== JSON.stringify(b.reviewRefs)) throw new ApiError('CLIENT_PATH_INVALID');
  if (!active()) throw new ApiError('DOCUMENT_CONFIRMATION_PAUSED');
  let response: Response;
  try { response = await client.transport.call(globalThis, `/api/v1/projects/${c.projectId}/commands`, { method: 'POST', credentials: 'same-origin', cache: 'no-store', redirect: 'error', headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-Anvil-CSRF': session.csrfToken, 'Idempotency-Key': c.commandId }, body: JSON.stringify(c) }); }
  catch { throw new ApiError('CONNECTION_LOST'); }
  let value: any; try { if (!/^application\/json\b/i.test(response.headers.get('content-type') ?? '')) throw Error(); value = await response.json(); } catch { throw new ApiError('RESPONSE_INVALID', response.status); }
  if (!response.ok) throw new ApiError(typeof value?.code === 'string' && /^[A-Z_]{1,64}$/.test(value.code) ? value.code : 'REQUEST_FAILED', response.status);
  if (!value || value.projectId !== c.projectId || value.commandId !== c.commandId || value.targetId !== b.ref.id || value.version !== b.ref.version || value.status !== 'APPLIED' || !uuid.test(value.operationId) || !Number.isFinite(Date.parse(value.serverReceivedAt)) || value.data?.status !== 'CONFIRMED' || !sameRef(value.data.ref, b.ref) || !uuid.test(value.data.confirmationId)) throw new ApiError('RESPONSE_INVALID');
  return { ref: value.data.ref as VersionRef, confirmationId: value.data.confirmationId as string };
}
