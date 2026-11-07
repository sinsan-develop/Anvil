import { ApiClient, ApiError } from '../../api/client.ts';
import { readDocument } from '../design-trace/api.ts';
import type { WorkPlanView, PlanRef } from '../design-trace/work-plan-api.ts';
export type AssignmentBasisKind = 'PLAN_DOCUMENT' | 'DESIGN_DOCUMENT';
export async function readAssignmentBasisDocument(client: ApiClient, projectId: string, plan: Pick<WorkPlanView, 'documentRef' | 'designRef'>, kind: AssignmentBasisKind) {
 const ref = kind === 'PLAN_DOCUMENT' ? plan?.documentRef : kind === 'DESIGN_DOCUMENT' ? plan?.designRef : null;
 if (!ref || Object.keys(ref).sort().join(',') !== 'contentHash,id,version' || typeof ref.contentHash !== 'string' || !/^[0-9a-f]{64}$/.test(ref.contentHash)) throw new ApiError('ASSIGNMENT_BASIS_INVALID');
 const pinned: PlanRef = { ...ref };
 const value = await readDocument(client, projectId, pinned.id, pinned.version);
 if (value.document.contentHash !== pinned.contentHash) throw new ApiError('ASSIGNMENT_BASIS_CHANGED', 409);
 return { ...value, ref: pinned, kind };
}
