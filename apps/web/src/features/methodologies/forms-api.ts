import { ApiClient, ApiError } from '../../api/client.ts';
import type { VersionRef } from '../../../../../contracts/generated-types.ts';
import type { FormDefinition } from '../../../../server/modules/documents/forms.ts';

export interface FormSummary { ref: VersionRef; formCode: string; name: string; scope: 'SYSTEM' | 'USER_COMMON' }
export interface FormsPage { items: FormSummary[]; nextCursor: null; hasMore: false; observedAt: string; baselineVersion: null }
export interface FormVersion {
  ref: VersionRef; definition: FormDefinition;
  authoringStandard: { ref: VersionRef; content: string };
  validation: { formatOnly: true; contentReview: 'NOT_PERFORMED' | 'RECORDED'; userAcceptance: 'NOT_PERFORMED' | 'CONFIRMED' };
  contentReviewCriteria?: { criteriaVersion: number; items: { criterionId: string; title: string }[] };
  contentReviews?: { ref: ContentReviewRef; items: { criterionId: string; outcome: ReviewOutcome; evidenceRefs: []; reason: string }[]; reviewer: { kind: 'HUMAN'; userId: string; sameAsTargetRecorder: boolean }; sourceKind: 'HUMAN_REVIEW'; reason: string; reviewedAt: string; serverSequence: number }[];
  confirmation?: { id: string; decidedBy: string; decidedAt: string; reviewRefs: ContentReviewRef[] } | null;
}
export type ReviewOutcome = 'ACCEPTED' | 'REWORK' | 'BLOCKED' | 'NOT_EXECUTED';
export interface ContentReviewRef { id: string; criteriaVersion: number; targetRef: VersionRef; outcome: ReviewOutcome }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function validRef(value: unknown): value is VersionRef {
  const ref = value as VersionRef;
  return !!ref && typeof ref === 'object' && Object.keys(ref).sort().join(',') === 'contentHash,id,version'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(ref.id)
    && Number.isSafeInteger(ref.version) && ref.version > 0 && /^[0-9a-f]{64}$/.test(ref.contentHash);
}
function sameRef(first: VersionRef, second: VersionRef) { return validRef(first) && validRef(second) && first.id === second.id && first.version === second.version && first.contentHash === second.contentHash; }
export function reviewRefFor(value: unknown, target: VersionRef): value is ContentReviewRef {
  const ref = value as ContentReviewRef;
  return !!ref && uuid.test(ref.id) && Number.isSafeInteger(ref.criteriaVersion) && ref.criteriaVersion > 0 && sameRef(ref.targetRef, target) && ['ACCEPTED', 'REWORK', 'BLOCKED', 'NOT_EXECUTED'].includes(ref.outcome);
}
function texts(value: unknown, draft = false): value is string[] { return Array.isArray(value) && (draft || value.length > 0) && value.length <= 200 && value.every(item => typeof item === 'string' && (draft || item.length > 0)); }
export async function listForms(client: ApiClient): Promise<FormsPage> {
  const page = await client.get<FormsPage>('/api/v1/forms');
  if (!page || !Array.isArray(page.items) || page.items.length > 200 || page.hasMore !== false || page.nextCursor !== null || page.baselineVersion !== null || !Number.isFinite(Date.parse(page.observedAt))
    || new Set(page.items.map(item => item?.ref?.id)).size !== page.items.length
    || page.items.some(item => !item || !validRef(item.ref) || !['SYSTEM', 'USER_COMMON'].includes(item.scope) || typeof item.formCode !== 'string' || typeof item.name !== 'string' || !item.name.trim())) throw new ApiError('RESPONSE_INVALID');
  return page;
}
export async function getForm(client: ApiClient, summary: FormSummary): Promise<FormVersion> {
  if (!validRef(summary.ref)) throw new ApiError('CLIENT_PATH_INVALID');
  const data = await client.get<FormVersion>(`/api/v1/forms/${summary.ref.id}/versions/${summary.ref.version}`);
  return readFormVersion(data, summary);
}
export async function getPinnedForm(client: ApiClient, ref: VersionRef): Promise<FormVersion> {
  if (!validRef(ref)) throw new ApiError('CLIENT_PATH_INVALID');
  const data = await client.get<FormVersion>(`/api/v1/forms/${ref.id}/versions/${ref.version}`);
  if (!data?.definition || !['SYSTEM','USER_COMMON'].includes(data.definition.scope) || typeof data.definition.name !== 'string' || !data.definition.name.trim() || typeof data.definition.formCode !== 'string' || !data.definition.formCode.trim()) throw new ApiError('RESPONSE_INVALID');
  return readFormVersion(data, { ref, name: data.definition.name, formCode: data.definition.formCode, scope: data.definition.scope as FormSummary['scope'] });
}
function readFormVersion(data: FormVersion, summary: FormSummary): FormVersion {
  const form = data?.definition;
  const draft = summary.scope === 'USER_COMMON';
  if (!data || !sameRef(data.ref, summary.ref) || !form || form.name !== summary.name || form.formCode !== summary.formCode || form.scope !== summary.scope
    || !texts(form.requiredInputs, draft) || typeof form.purpose !== 'string' || !draft && !form.purpose || typeof form.authorRole !== 'string' || typeof form.reviewerRole !== 'string' || typeof form.confirmerRole !== 'string'
    || !Array.isArray(form.items) || !draft && !form.items.length || form.items.length > 200 || new Set(form.items.map(item => item?.itemId)).size !== form.items.length
    || form.items.some(item => !item || typeof item.itemId !== 'string' || typeof item.title !== 'string' || typeof item.required !== 'boolean' || typeof item.repeated !== 'boolean'
      || !['TEXT', 'RECORDS'].includes(item.valueType) || !texts(item.authoringRules, draft) || !texts(item.reviewCriteria, draft) || !Array.isArray(item.fields) || item.fields.length > 200
      || item.fields.some(field => !field || typeof field.fieldId !== 'string' || typeof field.title !== 'string' || typeof field.required !== 'boolean' || field.valueType !== 'TEXT'))
    || !data.authoringStandard || !sameRef(form.authoringStandardRef, data.authoringStandard.ref) || typeof data.authoringStandard.content !== 'string' || data.authoringStandard.content.length > 2 * 1024 * 1024
    || data.validation?.formatOnly !== true || !(draft ? ['NOT_PERFORMED', 'RECORDED'] : ['NOT_PERFORMED']).includes(data.validation.contentReview) || !(draft ? ['NOT_PERFORMED', 'CONFIRMED'] : ['NOT_PERFORMED']).includes(data.validation.userAcceptance)) throw new ApiError('RESPONSE_INVALID');
  if (data.contentReviewCriteria !== undefined && (!Number.isSafeInteger(data.contentReviewCriteria.criteriaVersion) || data.contentReviewCriteria.criteriaVersion < 1 || !Array.isArray(data.contentReviewCriteria.items) || !data.contentReviewCriteria.items.length || data.contentReviewCriteria.items.length > 200
    || new Set(data.contentReviewCriteria.items.map(item => item?.criterionId)).size !== data.contentReviewCriteria.items.length || data.contentReviewCriteria.items.some(item => !item || typeof item.criterionId !== 'string' || typeof item.title !== 'string'))) throw new ApiError('RESPONSE_INVALID');
  if (data.contentReviews !== undefined && (!Array.isArray(data.contentReviews) || data.contentReviews.length > 200 || data.contentReviews.some(review => !review || !reviewRefFor(review.ref, data.ref) || !Array.isArray(review.items)
    || !review.reviewer || review.reviewer.kind !== 'HUMAN' || !uuid.test(review.reviewer.userId) || typeof review.reviewer.sameAsTargetRecorder !== 'boolean' || review.sourceKind !== 'HUMAN_REVIEW' || typeof review.reason !== 'string' || !Number.isFinite(Date.parse(review.reviewedAt)) || !Number.isSafeInteger(review.serverSequence) || review.serverSequence < 1))) throw new ApiError('RESPONSE_INVALID');
  if (data.validation.userAcceptance === 'CONFIRMED' && (!data.confirmation || !uuid.test(data.confirmation.id) || !uuid.test(data.confirmation.decidedBy) || !Number.isFinite(Date.parse(data.confirmation.decidedAt)) || !Array.isArray(data.confirmation.reviewRefs) || !data.confirmation.reviewRefs.length
    || data.confirmation.reviewRefs.some(ref => !reviewRefFor(ref, data.ref) || ref.outcome !== 'ACCEPTED'))) throw new ApiError('RESPONSE_INVALID');
  if (data.validation.userAcceptance === 'NOT_PERFORMED' && data.confirmation != null) throw new ApiError('RESPONSE_INVALID');
  return data;
}
