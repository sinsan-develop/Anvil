import { ApiClient, ApiError } from '../../api/client.ts';
import type { DraftMethodSelection } from '../../../../../contracts/project-drafts.ts';

export interface DraftInput { name: string; purpose: string; desiredOutcome: string; sourceMode: 'EMPTY'; methodologySelection: DraftMethodSelection | null; artifactRefs: [] }
export interface DraftResult { draftId: string; version: number; step: number; input: DraftInput; editable?: boolean; consumedProjectId?: string | null }
export interface PendingDraftCommand { draftId: string | null; fingerprint: string; body: Record<string, unknown> }
export interface DraftEditorState { ownerUserId: string | null; input: DraftInput; draftId: string | null; version: number; dirty: boolean; pendingCommand: PendingDraftCommand | null }
export function emptyDraft(): DraftEditorState { return { ownerUserId: null, input: { name: '', purpose: '', desiredOutcome: '', sourceMode: 'EMPTY', methodologySelection: null, artifactRefs: [] }, draftId: null, version: 0, dirty: false, pendingCommand: null }; }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function validSelection(selection: DraftMethodSelection | null) {
  const ref = (value: any) => !!value && Object.keys(value).sort().join(',') === 'contentHash,id,version' && uuid.test(value.id) && Number.isSafeInteger(value.version) && value.version > 0 && /^[0-9a-f]{64}$/.test(value.contentHash);
  if (selection === null) return true;
  if (!selection || typeof selection !== 'object') return false;
  if (selection.kind === 'CONFIRMED_REFERENCE') return Object.keys(selection).sort().join(',') === 'kind,versionRef' && ref(selection.versionRef);
  return selection.kind === 'NEW_PROJECT_DRAFT' && Object.keys(selection).sort().join(',') === 'graph,kind,name,purpose,reviewRefs,sourceRefs' && typeof selection.name === 'string' && typeof selection.purpose === 'string'
    && !!selection.graph && Array.isArray(selection.graph.nodes) && Array.isArray(selection.graph.edges) && typeof selection.graph.entryNodeId === 'string' && Array.isArray(selection.graph.terminalNodeIds)
    && Array.isArray(selection.sourceRefs) && selection.sourceRefs.length <= 200 && selection.sourceRefs.every(ref) && Array.isArray(selection.reviewRefs) && !selection.reviewRefs.length;
}
function draftResult(value: unknown): DraftResult {
  const result = value as DraftResult;
  if (!result || !uuid.test(result.draftId) || !Number.isSafeInteger(result.version) || result.version < 1 || !Number.isInteger(result.step) || result.step < 1 || result.step > 4
    || !result.input || typeof result.input.name !== 'string' || typeof result.input.purpose !== 'string' || typeof result.input.desiredOutcome !== 'string'
    || result.input.sourceMode !== 'EMPTY' || !validSelection(result.input.methodologySelection) || !Array.isArray(result.input.artifactRefs) || result.input.artifactRefs.length) throw new ApiError('RESPONSE_INVALID');
  return result;
}
export async function readProjectDraft(client: ApiClient, draftId: string): Promise<DraftResult> {
  if (!uuid.test(draftId)) throw new ApiError('CLIENT_PATH_INVALID');
  const result = draftResult(await client.get('/api/v1/project-drafts/' + draftId));
  if (result.draftId !== draftId || typeof result.editable !== 'boolean') throw new ApiError('RESPONSE_INVALID');
  return result;
}
export async function writeProjectDraft(client: ApiClient, draftId: string | null, request: unknown, csrf: string): Promise<DraftResult> {
  if (draftId !== null && !uuid.test(draftId)) throw new ApiError('CLIENT_PATH_INVALID');
  if (!/^[A-Za-z0-9_-]{43}$/.test(csrf)) throw new ApiError('AUTH_REQUIRED', 401);
  let response: Response;
  try { response = await client.transport.call(globalThis, '/api/v1/project-drafts' + (draftId ? '/' + draftId : ''), { method: draftId ? 'PATCH' : 'POST', credentials: 'same-origin', redirect: 'error', cache: 'no-store', headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-Anvil-CSRF': csrf }, body: JSON.stringify(request) }); }
  catch { throw new ApiError('CONNECTION_LOST'); }
  let result: unknown;
  try { if (!/^application\/json\b/i.test(response.headers.get('content-type') ?? '')) throw Error(); result = await response.json(); }
  catch { throw new ApiError('RESPONSE_INVALID', response.status); }
  if (!response.ok) {
    const body = result as { code?: unknown };
    throw new ApiError(typeof body?.code === 'string' && /^[A-Z_]{1,64}$/.test(body.code) ? body.code : 'REQUEST_FAILED', response.status);
  }
  return draftResult(result);
}
