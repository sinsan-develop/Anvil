import { ApiClient, ApiError } from '../../api/client.ts';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/, hash = /^[0-9a-f]{64}$/;
const integer = (value: number) => Number.isSafeInteger(value) && value > 0;
export interface DocumentSummary { id: string; title: string; headVersion: number; confirmedVersion: number | null; updatedAt: string }
export interface DocumentPage { items: DocumentSummary[]; hasMore: boolean; nextCursor: string | null; observedAt: string }
interface ArtifactRef { artifactId: string; bytes: number; contentHash: string; mediaType: string }
interface ReviewRef { id: string; criteriaVersion: number; targetRef: { id: string; version: number; contentHash: string }; outcome: string }
interface ContentReview { ref: ReviewRef; items: { criterionId: string; outcome: string; reason: string }[]; reviewer: { kind: 'HUMAN'; userId: string; sameAsTargetRecorder: boolean }; sourceKind: string; reason: string; reviewedAt: string; serverSequence: number }
export interface DocumentVersion {
  id: string; version: number; title: string; confirmed: boolean; contentHash: string;
  formRef: { id: string; version: number; contentHash: string };
  content: { body: ArtifactRef };
  validation: { validForConfirmation: boolean; issues: { code: string; location: string; severity: string; message: string }[] };
  statusHistory: { kind: string; reason: string; at: string }[];
  contentReviewCriteria: { criteriaVersion: number; formRef: { id: string; version: number; contentHash: string }; items: { criterionId: string; title: string; reviewCriteria: string[] }[] };
  contentReviews: ContentReview[];
}
function projectPath(projectId: string) { if (!uuid.test(projectId)) throw new ApiError('CLIENT_PATH_INVALID'); return '/api/v1/projects/' + projectId; }
export async function listDocuments(client: ApiClient, projectId: string, cursor: string | null): Promise<DocumentPage> {
  const params = new URLSearchParams({ limit: '50' });
  if (cursor !== null) { if (!cursor || cursor.length > 4096) throw new ApiError('CLIENT_PATH_INVALID'); params.set('cursor', cursor); }
  const value = await client.get<DocumentPage>(projectPath(projectId) + '/documents?' + params);
  if (!value || !Array.isArray(value.items) || value.items.length > 50 || typeof value.hasMore !== 'boolean' || value.hasMore !== (typeof value.nextCursor === 'string' && value.nextCursor.length > 0 && value.nextCursor.length <= 4096) || !value.hasMore && value.nextCursor !== null || !Number.isFinite(Date.parse(value.observedAt)) || new Set(value.items.map(item => item?.id)).size !== value.items.length || value.items.some(item => !item || !uuid.test(item.id) || typeof item.title !== 'string' || !integer(item.headVersion) || item.confirmedVersion !== null && (!integer(item.confirmedVersion) || item.confirmedVersion > item.headVersion) || !Number.isFinite(Date.parse(item.updatedAt)))) throw new ApiError('RESPONSE_INVALID');
  return value;
}
export async function readDocument(client: ApiClient, projectId: string, id: string, version: number): Promise<{ document: DocumentVersion; body: string }> {
  if (!uuid.test(id) || !integer(version)) throw new ApiError('CLIENT_PATH_INVALID');
  const base = projectPath(projectId), value = await client.get<DocumentVersion>(`${base}/documents/${id}/versions/${version}`), ref = value?.content?.body;
  if (!value || value.id !== id || value.version !== version || typeof value.title !== 'string' || typeof value.confirmed !== 'boolean' || !hash.test(value.contentHash) || !value.formRef || !uuid.test(value.formRef.id) || !integer(value.formRef.version) || !hash.test(value.formRef.contentHash)
    || !ref || !uuid.test(ref.artifactId) || !Number.isSafeInteger(ref.bytes) || ref.bytes < 0 || ref.bytes > 2 * 1024 * 1024 || !hash.test(ref.contentHash) || !['text/plain;charset=utf-8', 'text/markdown;charset=utf-8'].includes(ref.mediaType)
    || !value.validation || typeof value.validation.validForConfirmation !== 'boolean' || !Array.isArray(value.validation.issues) || value.validation.issues.length > 200 || value.validation.issues.some(issue => !issue || typeof issue.code !== 'string' || typeof issue.location !== 'string' || typeof issue.message !== 'string' || typeof issue.severity !== 'string')
    || !Array.isArray(value.statusHistory) || value.statusHistory.length > 1000 || value.statusHistory.some(event => !event || typeof event.kind !== 'string' || typeof event.reason !== 'string' || !Number.isFinite(Date.parse(event.at)))) throw new ApiError('RESPONSE_INVALID');
  const criteria = value.contentReviewCriteria, outcomes = ['ACCEPTED', 'REWORK', 'BLOCKED', 'NOT_EXECUTED'];
  if (!criteria || criteria.criteriaVersion !== 1 || criteria.formRef?.id !== value.formRef.id || criteria.formRef?.version !== value.formRef.version || criteria.formRef?.contentHash !== value.formRef.contentHash || !Array.isArray(criteria.items) || criteria.items.length > 200 || criteria.items.some(item => !item || typeof item.criterionId !== 'string' || typeof item.title !== 'string' || !Array.isArray(item.reviewCriteria) || item.reviewCriteria.length > 200 || item.reviewCriteria.some(text => typeof text !== 'string'))
    || !Array.isArray(value.contentReviews) || value.contentReviews.length > 200 || value.contentReviews.some(review => !review || !review.ref || !uuid.test(review.ref.id) || review.ref.criteriaVersion !== criteria.criteriaVersion || review.ref.targetRef?.id !== id || review.ref.targetRef?.version !== version || review.ref.targetRef?.contentHash !== value.contentHash || !outcomes.includes(review.ref.outcome) || !review.reviewer || review.reviewer.kind !== 'HUMAN' || !uuid.test(review.reviewer.userId) || typeof review.reviewer.sameAsTargetRecorder !== 'boolean' || review.sourceKind !== 'HUMAN_REVIEW' || typeof review.reason !== 'string' || !Number.isFinite(Date.parse(review.reviewedAt)) || !integer(review.serverSequence) || !Array.isArray(review.items) || review.items.length > 200 || review.items.some(item => !item || typeof item.criterionId !== 'string' || !outcomes.includes(item.outcome) || typeof item.reason !== 'string'))) throw new ApiError('RESPONSE_INVALID');
  let response: Response;
  try { response = await client.transport.call(globalThis, `${base}/files/${ref.artifactId}`, { method: 'GET', credentials: 'same-origin', redirect: 'error', cache: 'no-store', headers: { Accept: 'application/octet-stream' } }); }
  catch { throw new ApiError('CONNECTION_LOST'); }
  if (!response.ok) throw new ApiError('ARTIFACT_READ_FAILED', response.status);
  if (!/^application\/octet-stream\b/i.test(response.headers.get('content-type') ?? '') || !response.body) throw new ApiError('RESPONSE_INVALID');
  const reader = response.body.getReader(), chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) { const item = await reader.read(); if (item.done) break; size += item.value.byteLength; if (size > ref.bytes) { await reader.cancel(); throw new ApiError('ARTIFACT_INTEGRITY_FAILED'); } chunks.push(item.value); }
  } catch (cause) { throw cause instanceof ApiError ? cause : new ApiError('CONNECTION_LOST'); } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(item => item.toString(16).padStart(2, '0')).join('');
  if (size !== ref.bytes || digest !== ref.contentHash) throw new ApiError('ARTIFACT_INTEGRITY_FAILED');
  let body: string; try { body = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); } catch { throw new ApiError('DOCUMENT_UTF8_INVALID'); }
  return { document: value, body };
}
