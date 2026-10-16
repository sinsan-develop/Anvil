import { AuthFailure } from '../access/repository.ts';
import { isVersionRef } from '../../../../contracts/references.ts';
import { methodContentReviewCriteria } from './content-review.ts';
import { inspectArtifact } from '../../storage/sensitive-inspection.ts';
export function exactMethodObject(value: unknown, keys: string[]): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
}
function text(value: unknown, max: number) { return typeof value === 'string' && !!value.trim() && value.length <= max && value.isWellFormed(); }
export function readProjectMethodInput(operation: string, value: unknown) {
  const copying = operation === 'copyMethodology';
  if (!['copyMethodology', 'saveMethodologyDraft'].includes(operation) || !exactMethodObject(value, copying ? ['sourceRef', 'name', 'scope', 'reason'] : ['name', 'purpose', 'scope', 'graph', 'reason'])
    || value.scope !== 'PROJECT' || !text(value.name, 200) || !text(value.reason, 20_000) || (copying ? !isVersionRef(value.sourceRef) : !text(value.purpose, 20_000))) throw new AuthFailure('METHOD_INPUT_INVALID', 422);
  if (inspectArtifact(Buffer.from(JSON.stringify(value), 'utf8')).state === 'SUSPECTED') throw new AuthFailure('METHOD_SENSITIVE_CONTENT_SUSPECTED', 412);
  return structuredClone(value);
}
export function readProjectMethodReview(value: unknown) {
  if (!exactMethodObject(value, ['targetKind', 'targetRef', 'criteriaVersion', 'items', 'outcome', 'reason']) || value.targetKind !== 'METHODOLOGY' || !isVersionRef(value.targetRef)
    || value.criteriaVersion !== 1 || !Array.isArray(value.items) || value.items.length !== 5 || !text(value.reason, 20_000)) throw new AuthFailure('REVIEW_INPUT_INVALID', 422);
  const outcomes = ['ACCEPTED', 'REWORK', 'BLOCKED', 'NOT_EXECUTED'], expected = new Set(methodContentReviewCriteria.items.map(item => item.criterionId));
  if (!outcomes.includes(String(value.outcome))) throw new AuthFailure('REVIEW_INPUT_INVALID', 422);
  for (const item of value.items) {
    if (!exactMethodObject(item, ['criterionId', 'outcome', 'evidenceRefs', 'reason']) || typeof item.criterionId !== 'string' || !expected.delete(item.criterionId) || !outcomes.includes(String(item.outcome)) || !text(item.reason, 20_000) || !Array.isArray(item.evidenceRefs)) throw new AuthFailure('REVIEW_INCOMPLETE', 422);
    if (item.evidenceRefs.length) throw new AuthFailure('REVIEW_EVIDENCE_CONNECTION_PENDING', 412);
    if (value.outcome === 'ACCEPTED' && item.outcome !== 'ACCEPTED') throw new AuthFailure('REVIEW_INCOMPLETE', 422);
  }
  if (inspectArtifact(Buffer.from(JSON.stringify(value), 'utf8')).state === 'SUSPECTED') throw new AuthFailure('METHOD_SENSITIVE_CONTENT_SUSPECTED', 412);
  return structuredClone(value);
}
