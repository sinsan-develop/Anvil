import { ApiClient, ApiError } from '../../api/client.ts';
import type { DocumentVersion } from './api.ts';
import type { DocumentSession } from './editor-api.ts';
import { isKnownDocumentRejection } from './mutation-result.ts';

type VersionRef = { id: string; version: number; contentHash: string };
type Outcome = 'ACCEPTED' | 'REWORK' | 'BLOCKED' | 'NOT_EXECUTED';
type Item = { criterionId: string; outcome: Outcome; evidenceRefs: []; reason: string };
export interface DocumentReviewCommand {
  schemaVersion: 1; projectId: string; commandId: string; clientId: string; controlGeneration: number;
  operation: 'recordContentReview'; targetId: string; expectedVersion: number; baselineRefs: []; approvalRef: null;
  payload: { targetKind: 'DOCUMENT'; targetRef: VersionRef; criteriaVersion: 1; items: Item[]; outcome: Outcome; reason: string };
}
export interface DocumentReviewBuffer {
  ownerUserId: string; projectId: string; title: string; ref: VersionRef; controlGeneration: number;
  criteria: DocumentVersion['contentReviewCriteria']['items']; items: Item[]; outcome: Outcome; reason: string;
  dirty: boolean; pending: DocumentReviewCommand | null; saved: boolean; failure: { code: string; status: number } | null;
  uncertain?: boolean; rejectedAttempts?: { title: string; command: DocumentReviewCommand; failure: { code: string; status: number } }[];
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const outcomes = ['ACCEPTED', 'REWORK', 'BLOCKED', 'NOT_EXECUTED'];
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join(',') === [...keys].sort().join(',');
const reference = (r: VersionRef) => r && exact(r, ['id','version','contentHash']) && uuid.test(r.id) && Number.isSafeInteger(r.version) && r.version > 0 && /^[0-9a-f]{64}$/.test(r.contentHash);
const reason = (v: string) => typeof v === 'string' && !!v.trim() && v.length <= 20_000 && v.isWellFormed();
function validate(buffer: DocumentReviewBuffer, session: DocumentSession) {
  if (buffer.ownerUserId !== session.user.id || !uuid.test(buffer.projectId) || !uuid.test(session.clientId) || !/^[A-Za-z0-9_-]{43}$/.test(session.csrfToken) || !reference(buffer.ref) || !Number.isSafeInteger(buffer.controlGeneration) || buffer.controlGeneration < 1) throw new ApiError('CLIENT_PATH_INVALID');
  const expected = new Set(buffer.criteria.map(item => item.criterionId));
  if (!expected.size || expected.size > 200 || expected.size !== buffer.criteria.length || !Array.isArray(buffer.items) || buffer.items.length !== expected.size || new Set(buffer.items.map(item => item.criterionId)).size !== expected.size || !outcomes.includes(buffer.outcome) || !reason(buffer.reason) || buffer.items.some(item => !exact(item, ['criterionId','outcome','evidenceRefs','reason']) || !expected.has(item.criterionId) || !outcomes.includes(item.outcome) || !reason(item.reason) || !Array.isArray(item.evidenceRefs) || item.evidenceRefs.length)) throw new ApiError('REVIEW_INPUT_INVALID');
  if (buffer.outcome === 'ACCEPTED' && buffer.items.some(item => item.outcome !== 'ACCEPTED')) throw new ApiError('REVIEW_INCOMPLETE', 422);
}
export function newDocumentReview(projectId: string, document: DocumentVersion, ownerUserId: string, controlGeneration: number): DocumentReviewBuffer {
  return { ownerUserId, projectId, title: document.title, ref: { id: document.id, version: document.version, contentHash: document.contentHash }, controlGeneration, criteria: structuredClone(document.contentReviewCriteria.items), items: document.contentReviewCriteria.items.map(item => ({ criterionId: item.criterionId, outcome: 'NOT_EXECUTED', evidenceRefs: [], reason: '' })), outcome: 'NOT_EXECUTED', reason: '', dirty: false, pending: null, saved: false, failure: null };
}
export function prepareDocumentReview(buffer: DocumentReviewBuffer, session: DocumentSession): DocumentReviewCommand {
  validate(buffer, session);
  const command: DocumentReviewCommand = { schemaVersion: 1, projectId: buffer.projectId, commandId: crypto.randomUUID(), clientId: session.clientId, controlGeneration: buffer.controlGeneration, operation: 'recordContentReview', targetId: buffer.ref.id, expectedVersion: buffer.ref.version, baselineRefs: [], approvalRef: null, payload: { targetKind: 'DOCUMENT', targetRef: { ...buffer.ref }, criteriaVersion: 1, items: structuredClone(buffer.items), outcome: buffer.outcome, reason: buffer.reason } };
  if (new TextEncoder().encode(JSON.stringify(command)).length > 2 * 1024 * 1024) throw new ApiError('REVIEW_INPUT_TOO_LARGE');
  return command;
}
export function retireRejectedDocumentReview(buffer: DocumentReviewBuffer, session: DocumentSession): DocumentReviewBuffer {
  validate(buffer, session); const c = buffer.pending;
  if (buffer.uncertain || buffer.saved || !c || !isKnownDocumentRejection(buffer.failure) || c.projectId !== buffer.projectId || c.clientId !== session.clientId || c.operation !== 'recordContentReview' || c.targetId !== buffer.ref.id || c.payload.targetRef.contentHash !== buffer.ref.contentHash || c.expectedVersion !== buffer.ref.version) throw new ApiError('REVIEW_REJECTION_NOT_CONFIRMED');
  return { ...buffer, pending: null, dirty: true, saved: false, failure: null, uncertain: false, rejectedAttempts: [...(buffer.rejectedAttempts ?? []), { title: buffer.title, command: structuredClone(c), failure: { ...buffer.failure! } }] };
}
export async function sendDocumentReview(client: ApiClient, buffer: DocumentReviewBuffer, session: DocumentSession, active: () => boolean) {
  validate(buffer, session); const c = buffer.pending;
  if (!c || !exact(c, ['schemaVersion','projectId','commandId','clientId','controlGeneration','operation','targetId','expectedVersion','baselineRefs','approvalRef','payload']) || c.schemaVersion !== 1 || !uuid.test(c.commandId) || c.operation !== 'recordContentReview' || c.projectId !== buffer.projectId || c.clientId !== session.clientId || c.controlGeneration !== buffer.controlGeneration || c.targetId !== buffer.ref.id || c.expectedVersion !== buffer.ref.version || !Array.isArray(c.baselineRefs) || c.baselineRefs.length || c.approvalRef !== null || !exact(c.payload, ['targetKind','targetRef','criteriaVersion','items','outcome','reason']) || c.payload.targetKind !== 'DOCUMENT' || c.payload.criteriaVersion !== 1 || !reference(c.payload.targetRef) || c.payload.targetRef.id !== buffer.ref.id || c.payload.targetRef.version !== buffer.ref.version || c.payload.targetRef.contentHash !== buffer.ref.contentHash || JSON.stringify(c.payload.items) !== JSON.stringify(buffer.items) || c.payload.outcome !== buffer.outcome || c.payload.reason !== buffer.reason) throw new ApiError('CLIENT_PATH_INVALID');
  const body = JSON.stringify(c); if (new TextEncoder().encode(body).length > 2 * 1024 * 1024) throw new ApiError('REVIEW_INPUT_TOO_LARGE');
  if (!active()) throw new ApiError('REVIEW_CONTINUATION_PAUSED');
  let response: Response;
  try { response = await client.transport.call(globalThis, `/api/v1/projects/${c.projectId}/commands`, { method: 'POST', credentials: 'same-origin', cache: 'no-store', redirect: 'error', headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-Anvil-CSRF': session.csrfToken, 'Idempotency-Key': c.commandId }, body }); }
  catch { throw new ApiError('CONNECTION_LOST'); }
  let value: any; try { if (!/^application\/json\b/i.test(response.headers.get('content-type') ?? '')) throw Error(); value = await response.json(); } catch { throw new ApiError('RESPONSE_INVALID', response.status); }
  if (!response.ok) throw new ApiError(typeof value?.code === 'string' && /^[A-Z_]{1,64}$/.test(value.code) ? value.code : 'REQUEST_FAILED', response.status);
  const r = value?.data?.reviewRef;
  if (!value || value.commandId !== c.commandId || value.projectId !== c.projectId || value.targetId !== c.targetId || value.version !== c.expectedVersion || value.status !== 'APPLIED' || !uuid.test(value.operationId) || !Number.isFinite(Date.parse(value.serverReceivedAt)) || value.data?.status !== 'REVIEW_RECORDED' || !r || !uuid.test(r.id) || r.criteriaVersion !== 1 || !reference(r.targetRef) || r.targetRef.id !== buffer.ref.id || r.targetRef.version !== buffer.ref.version || r.targetRef.contentHash !== buffer.ref.contentHash || r.outcome !== buffer.outcome) throw new ApiError('RESPONSE_INVALID');
  return r as { id: string; criteriaVersion: 1; targetRef: VersionRef; outcome: Outcome };
}
