import { canonicalJson } from '../../../../contracts/canonical.ts';
import { isVersionRef } from '../../../../contracts/references.ts';
import type { VersionRef } from '../../../../contracts/generated-types.ts';
import { AuthFailure } from '../access/repository.ts';
import { assertKnowledgeTextSafe } from '../knowledge/knowledge-entry.ts';

export const assignmentConfirmationOperations = ['reviewAssignmentContent', 'confirmAssignment'] as const;
export const assignmentContentCriteria = ['PURPOSE_SCOPE', 'BASELINE_TASK', 'INPUT_OUTPUT', 'COMPLETION_VERIFICATION', 'BOUNDARIES', 'RECORD_RECOVERY'] as const;
export type AssignmentReviewOutcome = 'ACCEPTED' | 'REWORK' | 'BLOCKED' | 'NOT_EXECUTED';
export interface AssignmentContentReview {
  draftRef: VersionRef; criteriaVersion: 1;
  items: { criterionId: typeof assignmentContentCriteria[number]; outcome: AssignmentReviewOutcome; reason: string; evidenceRefs: [] }[];
  outcome: AssignmentReviewOutcome; reason: string;
}
export interface AssignmentConfirmation { draftRef: VersionRef; reviewRefs: VersionRef[]; reason: string; acknowledged: true }
const exact = (value: unknown, keys: readonly string[]): value is Record<string, any> => !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join(',') === [...keys].sort().join(',');
const reason = (value: unknown): value is string => typeof value === 'string' && value.isWellFormed() && value.length <= 20000 && !!value.trim();
const outcome = (value: unknown): value is AssignmentReviewOutcome => typeof value === 'string' && ['ACCEPTED', 'REWORK', 'BLOCKED', 'NOT_EXECUTED'].includes(value);
function copy(value: unknown, error: string): unknown {
  try { const bytes = canonicalJson(value); if (Buffer.byteLength(bytes, 'utf8') > 2 * 1024 * 1024) throw Error(); return JSON.parse(bytes); }
  catch { throw new AuthFailure(error, 422); }
}
function safe(value: unknown): void {
  if (typeof value === 'string') { try { assertKnowledgeTextSafe(value); } catch { throw new AuthFailure('ASSIGNMENT_SENSITIVE_CONTENT_SUSPECTED', 412); } }
  else if (value && typeof value === 'object') for (const item of Object.values(value)) safe(item);
}
export function readAssignmentContentReview(value: unknown): AssignmentContentReview {
  const parsed = copy(value, 'ASSIGNMENT_REVIEW_INPUT_INVALID');
  if (!exact(parsed, ['draftRef', 'criteriaVersion', 'items', 'outcome', 'reason']) || !isVersionRef(parsed.draftRef) || parsed.criteriaVersion !== 1 || !reason(parsed.reason) || !outcome(parsed.outcome)
    || !Array.isArray(parsed.items) || parsed.items.length !== assignmentContentCriteria.length || new Set(parsed.items.map((item: any) => item?.criterionId)).size !== assignmentContentCriteria.length
    || parsed.items.some((item: unknown) => !exact(item, ['criterionId', 'outcome', 'reason', 'evidenceRefs']) || !assignmentContentCriteria.includes(item.criterionId) || !outcome(item.outcome) || !reason(item.reason) || !Array.isArray(item.evidenceRefs) || item.evidenceRefs.length !== 0)
    || parsed.outcome === 'ACCEPTED' && parsed.items.some((item: any) => item.outcome !== 'ACCEPTED')) throw new AuthFailure('ASSIGNMENT_REVIEW_INPUT_INVALID', 422);
  safe(parsed); return parsed as unknown as AssignmentContentReview;
}
export function readAssignmentConfirmation(value: unknown): AssignmentConfirmation {
  const parsed = copy(value, 'ASSIGNMENT_CONFIRMATION_INPUT_INVALID');
  if (!exact(parsed, ['draftRef', 'reviewRefs', 'reason', 'acknowledged']) || !isVersionRef(parsed.draftRef) || !reason(parsed.reason) || parsed.acknowledged !== true
    || !Array.isArray(parsed.reviewRefs) || parsed.reviewRefs.length < 1 || parsed.reviewRefs.length > 200 || !parsed.reviewRefs.every(isVersionRef)
    || new Set(parsed.reviewRefs.map((ref: VersionRef) => canonicalJson(ref))).size !== parsed.reviewRefs.length) throw new AuthFailure('ASSIGNMENT_CONFIRMATION_INPUT_INVALID', 422);
  safe(parsed); return parsed as unknown as AssignmentConfirmation;
}
