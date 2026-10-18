import { ApiClient, ApiError } from '../../api/client.ts';
import type { VersionRef } from '../../../../../contracts/generated-types.ts';
import type { SourceDeclarationView } from '../project-create/api.ts';
import type { MethodologyGraph } from '../../../../../contracts/methodologies.ts';
import { ordered } from '../knowledge/review-view.ts';

export interface WorkspaceProject {
  id: string; name: string; purpose: string; desiredOutcome: string; version: number; createdAt: string; updatedAt: string;
  currentMethodologyRef: VersionRef | null; baselineRef: null; sourceMode: 'EMPTY' | 'EXISTING'; sourceDeclaration: SourceDeclarationView | null;
  readinessIssues: { code: string }[]; viewerPermissions: ['READ_PROJECT']; participation: 'OWNER' | 'VIEWER' | 'HANDOFF_ELIGIBLE';
  controlState: { actorId: string | null; clientId: string | null; generation: number | null; status: 'HELD' | 'OTHER_CLIENT' | 'UNASSIGNED' };
}
export interface WorkspaceStageSelection { applicationId: string; nodeId: string; nodeName: string; requiredCapabilities?: string[] }
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
const positive = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
const text = (value: unknown): value is string => typeof value === 'string' && value.isWellFormed() && value.length <= 2 * 1024 * 1024;
const time = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value));
const exact = (value: unknown, keys: string[]) => !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join(',') === [...keys].sort().join(',');
const validRef = (value: VersionRef | null) => !!value && exact(value, ['id', 'version', 'contentHash']) && uuid(value.id) && positive(value.version) && typeof value.contentHash === 'string' && /^[0-9a-f]{64}$/.test(value.contentHash);
export interface WorkspaceMethodology {
  projectId: string; applicationRef: VersionRef | null; observedAt: string; executionState: 'NOT_CONNECTED';
  snapshot: { name: string; purpose: string; graph: MethodologyGraph; sourceRef: VersionRef; draftConfirmationRef?: { draftRef: VersionRef; confirmationId: string } } | null;
}
export async function readWorkspaceMethodology(client: ApiClient, projectId: string, expected: VersionRef | null): Promise<WorkspaceMethodology> {
  if (!uuid(projectId) || expected !== null && !validRef(expected)) throw new ApiError('CLIENT_PATH_INVALID');
  const value = await client.get<WorkspaceMethodology>(`/api/v1/projects/${projectId}/methodology-application`);
  const invalid = () => { throw new ApiError('METHODOLOGY_APPLICATION_INTEGRITY_FAILED'); };
  if (!exact(value, ['projectId', 'applicationRef', 'snapshot', 'observedAt', 'executionState']) || value.projectId !== projectId || !time(value.observedAt) || value.executionState !== 'NOT_CONNECTED'
    || (value.applicationRef === null) !== (value.snapshot === null) || value.applicationRef !== null && !validRef(value.applicationRef)) invalid();
  const snapshot = value.snapshot;
  if (snapshot !== null) {
    if (!exact(snapshot, ['name', 'purpose', 'graph', 'sourceRef', ...(snapshot.draftConfirmationRef !== undefined ? ['draftConfirmationRef'] : [])]) || !text(snapshot.name) || snapshot.name.length > 200 || !text(snapshot.purpose) || snapshot.purpose.length > 20000 || !validRef(snapshot.sourceRef)) invalid();
    const draft = snapshot.draftConfirmationRef;
    if (draft !== undefined && (!exact(draft, ['draftRef', 'confirmationId']) || !validRef(draft.draftRef) || draft.draftRef.contentHash !== snapshot.sourceRef.contentHash || !uuid(draft.confirmationId))) invalid();
    const graph = snapshot.graph, texts = (value: unknown) => Array.isArray(value) && value.every(text);
    if (!exact(graph, ['nodes', 'edges', 'entryNodeId', 'terminalNodeIds']) || !Array.isArray(graph.nodes) || !graph.nodes.length || !Array.isArray(graph.edges) || !texts(graph.terminalNodeIds) || !graph.terminalNodeIds.length) invalid();
    const ids = new Set(graph.nodes.map(node => node?.nodeId));
    if (ids.size !== graph.nodes.length || !ids.has(graph.entryNodeId) || new Set(graph.terminalNodeIds).size !== graph.terminalNodeIds.length || graph.terminalNodeIds.some(id => !ids.has(id))
      || graph.nodes.some(node => !node || !text(node.nodeId) || !node.nodeId.trim() || !text(node.name) || !text(node.purpose) || !['HUMAN', 'AGENT', 'DECISION', 'JOIN'].includes(node.kind) || !['USER', 'COORDINATOR', 'STAGE_OWNER'].includes(node.role) || !['AUTO', 'CASE_BY_CASE'].includes(node.mode)
        || !node.position || !Number.isFinite(node.position.x) || !Number.isFinite(node.position.y) || !texts(node.completionCriteria) || !texts(node.approvalBoundary) || !texts(node.recordRequirements) || !node.taskScope || !texts(node.taskScope.included) || !texts(node.taskScope.excluded) || node.limitPolicyRef !== null && !validRef(node.limitPolicyRef)
        || !Array.isArray(node.inputs) || !Array.isArray(node.outputs) || [...node.inputs, ...node.outputs].some(item => !item || !text(item.itemId) || !validRef(item.formRef) || typeof item.required !== 'boolean' || !texts(item.reviewCriteria) || item.sourceNodeId !== undefined && !ids.has(item.sourceNodeId))
        || node.requirements !== undefined && (!node.requirements || !texts(node.requirements.capabilities) || !texts(node.requirements.environment)))
      || new Set(graph.edges.map(edge => edge?.edgeId)).size !== graph.edges.length || graph.edges.some(edge => !edge || !text(edge.edgeId) || !ids.has(edge.fromNodeId) || !ids.has(edge.toNodeId) || !['SEQUENCE', 'BRANCH', 'JOIN', 'REWORK'].includes(edge.kind) || !text(edge.reason) || edge.condition !== null && (typeof edge.condition !== 'object' || Array.isArray(edge.condition)))) invalid();
    const digest = async (input: unknown) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ordered(input))))].map(byte => byte.toString(16).padStart(2, '0')).join('');
    const [snapshotHash, graphHash] = await Promise.all([digest(snapshot), digest(graph)]);
    if (snapshotHash !== value.applicationRef!.contentHash || graphHash !== snapshot.sourceRef.contentHash) invalid();
  }
  if (expected === null ? value.applicationRef !== null : value.applicationRef === null || value.applicationRef.id !== expected.id || value.applicationRef.version !== expected.version || value.applicationRef.contentHash !== expected.contentHash) throw new ApiError('METHODOLOGY_APPLICATION_CHANGED');
  return value;
}
export async function readWorkspaceProject(client: ApiClient, projectId: string): Promise<WorkspaceProject> {
  if (!uuid(projectId)) throw new ApiError('CLIENT_PATH_INVALID');
  const value = await client.get<WorkspaceProject>(`/api/v1/projects/${projectId}`), ref = value?.currentMethodologyRef, control = value?.controlState;
  if (!value || value.id !== projectId || !text(value.name) || !text(value.purpose) || !text(value.desiredOutcome) || !positive(value.version) || !time(value.createdAt) || !time(value.updatedAt)
    || value.baselineRef !== null || !['EMPTY', 'EXISTING'].includes(value.sourceMode) || !['OWNER', 'VIEWER', 'HANDOFF_ELIGIBLE'].includes(value.participation)
    || !Array.isArray(value.viewerPermissions) || value.viewerPermissions.length !== 1 || value.viewerPermissions[0] !== 'READ_PROJECT'
    || ref !== null && (!ref || !uuid(ref.id) || !positive(ref.version) || typeof ref.contentHash !== 'string' || !/^[0-9a-f]{64}$/.test(ref.contentHash))
    || !control || !['HELD', 'OTHER_CLIENT', 'UNASSIGNED'].includes(control.status) || control.actorId !== null && !uuid(control.actorId) || control.clientId !== null && !uuid(control.clientId)
    || control.generation !== null && !positive(control.generation) || control.status !== 'UNASSIGNED' && (!control.actorId || !control.clientId || !positive(control.generation))
    || !Array.isArray(value.readinessIssues) || value.readinessIssues.length > 200 || value.readinessIssues.some(item => !item || typeof item.code !== 'string' || !/^[A-Z][A-Z0-9_]{0,63}$/.test(item.code))) throw new ApiError('RESPONSE_INVALID');
  const source = value.sourceDeclaration;
  if (value.sourceMode === 'EMPTY' || value.participation !== 'OWNER') {
    if (source !== null) throw new ApiError('RESPONSE_INVALID');
  } else {
    const declaration = source?.declaration, ref = source?.ref;
    if (!source || source.authority !== 'USER_DECLARED' || source.readiness !== 'UNVERIFIED' || !ref || !uuid(ref.id) || !positive(ref.version) || !/^[0-9a-f]{64}$/.test(ref.contentHash)
      || !declaration || Object.keys(declaration).sort().join(',') !== 'displayName,hostLabel,pathHint,reason'
      || (['hostLabel', 'displayName', 'pathHint', 'reason'] as const).some(key => !text(declaration[key]) || !declaration[key].trim() || declaration[key].length > (key === 'reason' ? 20000 : key === 'pathHint' ? 4096 : 200) || key !== 'reason' && /[\u0000-\u001f\u007f]/.test(declaration[key]))) throw new ApiError('RESPONSE_INVALID');
    const bytes = new TextEncoder().encode(JSON.stringify({ displayName: declaration.displayName, hostLabel: declaration.hostLabel, pathHint: declaration.pathHint, reason: declaration.reason }));
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(byte => byte.toString(16).padStart(2, '0')).join('');
    if (hash !== ref.contentHash) throw new ApiError('RESPONSE_INVALID');
  }
  return value;
}
