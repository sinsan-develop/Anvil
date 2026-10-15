import { ApiClient, ApiError } from '../../api/client.ts';
import type { VersionRef } from '../../../../../contracts/generated-types.ts';
import type { MethodologyGraph } from '../../../../../contracts/methodologies.ts';
import { reviewRefFor, type FormVersion, type ContentReviewRef } from '../methodologies/forms-api.ts';

export interface MethodSummary { ref: VersionRef; name: string; purpose: string; scope: 'SYSTEM' | 'USER_COMMON'; systemCode: string | null; status: 'DRAFT' | 'CONFIRMED'; sourceAvailable: boolean }
export interface MethodPage { items: MethodSummary[]; nextCursor: null; hasMore: false; observedAt: string; baselineVersion: null }
export interface MethodVersion {
  ref: VersionRef; name: string; purpose: string; scope: string; systemCode: string | null; graph: MethodologyGraph;
  confirmation: { id: string; decision: 'CONFIRMED'; decided_at: string; decidedBy: string; reviewRefs: ContentReviewRef[] } | null;
  contentReviewCriteria?: FormVersion['contentReviewCriteria'];
  contentReviews?: FormVersion['contentReviews'];
  validation: { validForConfirmation: boolean; issues: { code: string; location: string; severity: 'ERROR' | 'WARNING'; message: string }[] };
  runtimeReadiness: 'PROJECT_BINDINGS_REQUIRED';
}
const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const validRef = (ref: VersionRef) => !!ref && typeof ref === 'object' && idPattern.test(ref.id) && Number.isSafeInteger(ref.version) && ref.version > 0 && /^[0-9a-f]{64}$/.test(ref.contentHash);
const texts = (value: unknown): value is string[] => Array.isArray(value) && value.every(item => typeof item === 'string');
export async function listMethods(client: ApiClient): Promise<MethodPage> {
  const page = await client.get<MethodPage>('/api/v1/methodologies');
  if (!page || !Array.isArray(page.items) || page.items.length > 200 || page.nextCursor !== null || page.hasMore !== false || page.baselineVersion !== null || !Number.isFinite(Date.parse(page.observedAt))
    || new Set(page.items.map(item => item?.ref?.id)).size !== page.items.length
    || page.items.some(item => !item || !validRef(item.ref) || typeof item.name !== 'string' || typeof item.purpose !== 'string' || !['SYSTEM', 'USER_COMMON'].includes(item.scope) || !['DRAFT', 'CONFIRMED'].includes(item.status) || typeof item.sourceAvailable !== 'boolean' || item.systemCode !== null && typeof item.systemCode !== 'string')) throw new ApiError('RESPONSE_INVALID');
  return page;
}
export async function getMethod(client: ApiClient, selected: MethodSummary): Promise<MethodVersion> {
  if (!validRef(selected.ref)) throw new ApiError('CLIENT_PATH_INVALID');
  const value = await client.get<MethodVersion>(`/api/v1/methodologies/${selected.ref.id}/versions/${selected.ref.version}`);
  if (!value || !validRef(value.ref) || value.ref.id !== selected.ref.id || value.ref.version !== selected.ref.version || value.ref.contentHash !== selected.ref.contentHash || value.name !== selected.name || value.purpose !== selected.purpose || value.scope !== selected.scope || value.systemCode !== selected.systemCode
    || value.runtimeReadiness !== 'PROJECT_BINDINGS_REQUIRED' || !value.validation || typeof value.validation.validForConfirmation !== 'boolean' || !Array.isArray(value.validation.issues)
    || value.validation.issues.some(issue => !issue || typeof issue.code !== 'string' || typeof issue.location !== 'string' || typeof issue.message !== 'string' || !['ERROR', 'WARNING'].includes(issue.severity))
    || value.confirmation !== null && (!value.confirmation || !idPattern.test(value.confirmation.id) || value.confirmation.decision !== 'CONFIRMED' || !Number.isFinite(Date.parse(value.confirmation.decided_at))
      || !idPattern.test(value.confirmation.decidedBy) || !Array.isArray(value.confirmation.reviewRefs) || !value.confirmation.reviewRefs.length || value.confirmation.reviewRefs.some(ref => !reviewRefFor(ref, value.ref) || ref.outcome !== 'ACCEPTED'))) throw new ApiError('RESPONSE_INVALID');
  if (value.contentReviewCriteria !== undefined && (!value.contentReviewCriteria || !Number.isSafeInteger(value.contentReviewCriteria.criteriaVersion) || value.contentReviewCriteria.criteriaVersion < 1 || !Array.isArray(value.contentReviewCriteria.items) || !value.contentReviewCriteria.items.length || value.contentReviewCriteria.items.length > 200
    || new Set(value.contentReviewCriteria.items.map(item => item?.criterionId)).size !== value.contentReviewCriteria.items.length || value.contentReviewCriteria.items.some(item => !item || typeof item.criterionId !== 'string' || typeof item.title !== 'string'))) throw new ApiError('RESPONSE_INVALID');
  if (value.contentReviews !== undefined && (!Array.isArray(value.contentReviews) || value.contentReviews.length > 200 || value.contentReviews.some(review => !review || !reviewRefFor(review.ref, value.ref) || !Array.isArray(review.items)
    || !review.reviewer || review.reviewer.kind !== 'HUMAN' || !idPattern.test(review.reviewer.userId) || typeof review.reviewer.sameAsTargetRecorder !== 'boolean' || review.sourceKind !== 'HUMAN_REVIEW' || typeof review.reason !== 'string' || !Number.isFinite(Date.parse(review.reviewedAt)) || !Number.isSafeInteger(review.serverSequence) || review.serverSequence < 1))) throw new ApiError('RESPONSE_INVALID');
  const graph = value.graph;
  if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges) || typeof graph.entryNodeId !== 'string' || !texts(graph.terminalNodeIds)
    || new Set(graph.nodes.map(node => node?.nodeId)).size !== graph.nodes.length
    || graph.nodes.some(node => !node || typeof node.nodeId !== 'string' || typeof node.name !== 'string' || typeof node.purpose !== 'string' || !['HUMAN', 'AGENT', 'DECISION', 'JOIN'].includes(node.kind)
      || !node.position || !Number.isFinite(node.position.x) || !Number.isFinite(node.position.y) || !texts(node.completionCriteria) || !texts(node.approvalBoundary) || !texts(node.recordRequirements)
      || !Array.isArray(node.inputs) || !Array.isArray(node.outputs) || [...node.inputs, ...node.outputs].some(item => !item || typeof item.itemId !== 'string' || !validRef(item.formRef) || !texts(item.reviewCriteria)))
    || graph.edges.some(edge => !edge || typeof edge.edgeId !== 'string' || typeof edge.fromNodeId !== 'string' || typeof edge.toNodeId !== 'string' || typeof edge.reason !== 'string' || !['SEQUENCE', 'BRANCH', 'JOIN', 'REWORK'].includes(edge.kind))) throw new ApiError('RESPONSE_INVALID');
  return value;
}
