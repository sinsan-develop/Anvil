import type { FormDefinition } from '../../../../server/modules/documents/forms.ts';
import type { MethodCommand } from '../methodology-editor/common-api.ts';
import type { FormVersion } from './forms-api.ts';
import type { VersionRef } from '../../../../../contracts/generated-types.ts';
import type { ReviewOutcome } from './forms-api.ts';

export interface FormReviewWork {
  ref: VersionRef; criteriaVersion: number; criteria: { criterionId: string; title: string }[];
  items: { criterionId: string; outcome: ReviewOutcome; evidenceRefs: []; reason: string }[];
  outcome: ReviewOutcome; reason: string; dirty: boolean; pending: MethodCommand | null;
}

export interface FormBuffer {
  ownerUserId: string | null; targetId: string | null; version: number; definition: FormDefinition | null;
  itemId: string; reason: string; dirty: boolean;
  pending: { request: MethodCommand; name: string; formCode: string } | null;
  review: FormReviewWork | null;
}
export function emptyFormBuffer(): FormBuffer { return { ownerUserId: null, targetId: null, version: 0, definition: null, itemId: '', reason: '', dirty: false, pending: null, review: null }; }
export function formBuffer(value: FormVersion, ownerUserId: string): FormBuffer {
  return { ownerUserId, targetId: value.ref.id, version: value.ref.version, definition: structuredClone(value.definition), itemId: value.definition.items[0]?.itemId ?? '', reason: '', dirty: false, pending: null, review: null };
}
