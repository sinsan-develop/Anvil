import { ApiClient, ApiError } from '../../api/client.ts';
import type { VersionRef } from '../../../../../contracts/generated-types.ts';
import type { SourceDeclarationView } from '../project-create/api.ts';

export interface WorkspaceProject {
  id: string; name: string; purpose: string; desiredOutcome: string; version: number; createdAt: string; updatedAt: string;
  currentMethodologyRef: VersionRef | null; baselineRef: null; sourceMode: 'EMPTY' | 'EXISTING'; sourceDeclaration: SourceDeclarationView | null;
  readinessIssues: { code: string }[]; viewerPermissions: ['READ_PROJECT']; participation: 'OWNER' | 'VIEWER' | 'HANDOFF_ELIGIBLE';
  controlState: { actorId: string | null; clientId: string | null; generation: number | null; status: 'HELD' | 'OTHER_CLIENT' | 'UNASSIGNED' };
}
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
const positive = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
const text = (value: unknown): value is string => typeof value === 'string' && value.isWellFormed() && value.length <= 2 * 1024 * 1024;
const time = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value));
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
