import { canonicalJson } from '../../../../contracts/canonical.ts';
import type { VersionRef } from '../../../../contracts/generated-types.ts';
import { isVersionRef } from '../../../../contracts/references.ts';
import { AuthFailure } from '../access/repository.ts';
import { assertKnowledgeTextSafe, exact, uuid } from '../knowledge/knowledge-entry.ts';
import type { BaselineEvidenceRef, BaselineFeatureState } from './baseline-input.ts';

export type BaselineReviewOutcome = 'ACCEPTED' | 'REWORK' | 'BLOCKED' | 'NOT_EXECUTED';
export interface BaselineCoreEvidence {
 basis: 'ACTUAL' | 'MOCK' | 'STATIC' | 'NOT_EXECUTED' | 'UNKNOWN'; environment: string; checkedAt: string;
 normalFlow: BaselineEvidenceRef[]; storageRead: BaselineEvidenceRef[]; importantFailure: BaselineEvidenceRef[];
}
export interface BaselineContentReview {
 draftRef: VersionRef; criteriaVersion: 1; reviewerKind: 'HUMAN';
 items: { itemId: string; featureState: BaselineFeatureState; outcome: BaselineReviewOutcome; reason: string; evidenceRefs: BaselineEvidenceRef[]; coreEvidence: BaselineCoreEvidence | null }[];
 coverage: { outcome: BaselineReviewOutcome; reason: string }; outcome: BaselineReviewOutcome; reason: string;
}
export interface BaselineConfirmation { draftRef: VersionRef; reviewRefs: VersionRef[]; reason: string; acknowledged: true }
const text = (value: unknown, max = 20000, noControl = false): value is string => typeof value === 'string' && value.isWellFormed() && !!value.trim() && value.length <= max && (!noControl || !/[\u0000-\u001f\u007f]/.test(value));
const outcome = (value: unknown): value is BaselineReviewOutcome => typeof value === 'string' && ['ACCEPTED', 'REWORK', 'BLOCKED', 'NOT_EXECUTED'].includes(value);
function copy(value: unknown, error: string): unknown {
 try { const json = canonicalJson(value); if (Buffer.byteLength(json, 'utf8') > 2 * 1024 * 1024) throw Error(); return JSON.parse(json); }
 catch { throw new AuthFailure(error, 422); }
}
function safe(value: unknown): void {
 if (typeof value === 'string') { try { assertKnowledgeTextSafe(value); } catch { throw new AuthFailure('BASELINE_SENSITIVE_CONTENT_SUSPECTED', 412); } }
 else if (value && typeof value === 'object') for (const item of Object.values(value)) safe(item);
}
function evidenceList(value: unknown): value is BaselineEvidenceRef[] {
 if (!Array.isArray(value) || value.length > 200) return false;
 const ids = new Set<string>();
 for (const ref of value) {
  if (!exact(ref, ['artifactId', 'bytes', 'contentHash', 'mediaType']) || !uuid(ref.artifactId) || ids.has(ref.artifactId)
   || !Number.isSafeInteger(ref.bytes) || Number(ref.bytes) < 0 || Number(ref.bytes) > 20 * 1024 * 1024
   || typeof ref.contentHash !== 'string' || !/^[0-9a-f]{64}$/.test(ref.contentHash) || !text(ref.mediaType, 200, true)) return false;
  ids.add(ref.artifactId);
 }
 return true;
}
function core(value: unknown, evidenceRefs: BaselineEvidenceRef[]): value is BaselineCoreEvidence {
 if (!exact(value, ['basis', 'environment', 'checkedAt', 'normalFlow', 'storageRead', 'importantFailure'])
  || typeof value.basis !== 'string' || !['ACTUAL', 'MOCK', 'STATIC', 'NOT_EXECUTED', 'UNKNOWN'].includes(value.basis) || !text(value.environment)
  || typeof value.checkedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value.checkedAt)
  || !Number.isFinite(Date.parse(value.checkedAt)) || new Date(value.checkedAt).toISOString() !== value.checkedAt
  || !evidenceList(value.normalFlow) || !evidenceList(value.storageRead) || !evidenceList(value.importantFailure)) return false;
 const selected = new Set(evidenceRefs.map(ref => canonicalJson(ref)));
 return [...value.normalFlow, ...value.storageRead, ...value.importantFailure].every(ref => selected.has(canonicalJson(ref)));
}
export function readBaselineContentReview(value: unknown): BaselineContentReview {
 const input = copy(value, 'BASELINE_REVIEW_INPUT_INVALID');
 const invalid = (): never => { throw new AuthFailure('BASELINE_REVIEW_INPUT_INVALID', 422); };
 if (!exact(input, ['draftRef', 'criteriaVersion', 'reviewerKind', 'items', 'coverage', 'outcome', 'reason']) || !isVersionRef(input.draftRef)
  || input.criteriaVersion !== 1 || input.reviewerKind !== 'HUMAN' || !text(input.reason) || !outcome(input.outcome)
  || !exact(input.coverage, ['outcome', 'reason']) || !outcome(input.coverage.outcome) || !text(input.coverage.reason)
  || !Array.isArray(input.items) || input.items.length < 1 || input.items.length > 200) return invalid();
 const ids = new Set<string>(); let count = 0;
 for (const item of input.items) {
  if (!exact(item, ['itemId', 'featureState', 'outcome', 'reason', 'evidenceRefs', 'coreEvidence']) || !text(item.itemId, 200, true) || ids.has(item.itemId)
   || typeof item.featureState !== 'string' || !['IMPLEMENTED_CORE_CHECKED', 'IMPLEMENTED_UNCHECKED', 'PARTIAL', 'NOT_IMPLEMENTED'].includes(item.featureState)
   || !outcome(item.outcome) || !text(item.reason) || !evidenceList(item.evidenceRefs)
   || item.coreEvidence !== null && !core(item.coreEvidence, item.evidenceRefs)) return invalid();
  ids.add(item.itemId); count += item.evidenceRefs.length;
  if (count > 200) return invalid();
  if (item.featureState === 'IMPLEMENTED_CORE_CHECKED' && item.outcome === 'ACCEPTED') {
   if (!core(item.coreEvidence, item.evidenceRefs) || item.coreEvidence.basis !== 'ACTUAL'
    || !item.coreEvidence.normalFlow.length || !item.coreEvidence.storageRead.length || !item.coreEvidence.importantFailure.length) return invalid();
  }
 }
 if (input.outcome === 'ACCEPTED' && (input.coverage.outcome !== 'ACCEPTED' || input.items.some(item => item.outcome !== 'ACCEPTED'))) return invalid();
 safe(input); return input as unknown as BaselineContentReview;
}
export function readBaselineConfirmation(value: unknown): BaselineConfirmation {
 const input = copy(value, 'BASELINE_CONFIRMATION_INPUT_INVALID');
 if (!exact(input, ['draftRef', 'reviewRefs', 'reason', 'acknowledged']) || !isVersionRef(input.draftRef) || !text(input.reason) || input.acknowledged !== true
  || !Array.isArray(input.reviewRefs) || input.reviewRefs.length < 1 || input.reviewRefs.length > 200 || !input.reviewRefs.every(isVersionRef)
  || new Set(input.reviewRefs.map(ref => canonicalJson(ref))).size !== input.reviewRefs.length) throw new AuthFailure('BASELINE_CONFIRMATION_INPUT_INVALID', 422);
 safe(input); return input as unknown as BaselineConfirmation;
}
