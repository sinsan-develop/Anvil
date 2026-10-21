import { ApiClient, ApiError } from '../../api/client.ts';
import type { DraftMethodSelection } from '../../../../../contracts/project-drafts.ts';
import type { VersionRef } from '../../../../../contracts/generated-types.ts';
import { reviewRefFor, type ContentReviewRef, type ReviewOutcome } from '../methodologies/forms-api.ts';
import type{SourceDeclaration}from'../../../../server/modules/projects/source-declaration.ts';
export interface SourceDeclarationView{ref:VersionRef;authority:'USER_DECLARED';readiness:'UNVERIFIED';declaration:SourceDeclaration}

export interface DraftInput { name: string; purpose: string; desiredOutcome: string; sourceMode: 'EMPTY'|'EXISTING';sourceDeclaration?:SourceDeclaration; methodologySelection: DraftMethodSelection | null; artifactRefs: [] }
export interface DraftMethodState { ref: VersionRef; validation: { validForConfirmation: boolean; issues: { code: string; severity: string }[] }; contentReviewCriteria: { criteriaVersion: number; items: { criterionId: string; title: string }[] }; contentReviews: { reviewRef: ContentReviewRef; reason: string; reviewerSubjectRef: { kind: 'HUMAN'; userId: string; sameAsTargetRecorder: boolean }; sourceKind: 'HUMAN_REVIEW'; reviewedAt: string }[]; confirmation: { id: string; decidedBy: string; decidedAt: string; reviewRefs: ContentReviewRef[] } | null }
export interface DraftResult { draftId: string; version: number; step: number; input: DraftInput; sourceDeclaration?:SourceDeclarationView;editable?: boolean; consumedProjectId?: string | null; methodologyState?: DraftMethodState | null }
export interface DraftReviewInput { ref: VersionRef; criteriaVersion: number; items: { criterionId: string; outcome: ReviewOutcome; evidenceRefs: []; reason: string }[]; outcome: ReviewOutcome; reason: string; dirty: boolean }
export interface DraftAction { kind: 'review' | 'create'; body: Record<string, unknown>; draftId: string; dispatchId?:string }
export interface CreatedProject { id: string; name: string; purpose: string; desiredOutcome: string; version: number; currentMethodologyRef: VersionRef; baselineRef: null;sourceMode?:'EMPTY'|'EXISTING';sourceDeclaration?:SourceDeclarationView|null; readinessIssues: { code: string }[]; participation: 'OWNER'; controlState: { actorId: string; clientId: string; generation: number; status: 'HELD' } }
export interface PendingDraftCommand { draftId: string | null; fingerprint: string; body: Record<string, unknown>; dispatchId?:string }
export interface DraftEditorState { ownerUserId: string | null; input: DraftInput; draftId: string | null; version: number; dirty: boolean; pendingCommand: PendingDraftCommand | null; methodologyState?: DraftMethodState | null; review?: DraftReviewInput | null; pendingAction?: DraftAction | null; createdProject?: CreatedProject | null }
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
function validSourceDeclaration(v:SourceDeclaration|undefined):v is SourceDeclaration{return!!v&&Object.keys(v).sort().join(',')==='displayName,hostLabel,pathHint,reason'&&(['hostLabel','displayName','pathHint','reason']as const).every(k=>typeof v[k]==='string'&&!!v[k].trim()&&v[k].isWellFormed()&&v[k].length<=(k==='reason'?20000:k==='pathHint'?4096:200)&&(k==='reason'||!/[\u0000-\u001f\u007f]/.test(v[k])));}
async function validSourceView(value:SourceDeclarationView|undefined|null,draftId:string,version:number){
 if(!value||value.authority!=='USER_DECLARED'||value.readiness!=='UNVERIFIED'||!validSourceDeclaration(value.declaration)||!value.ref||value.ref.id!==draftId||value.ref.version!==version||!/^[0-9a-f]{64}$/.test(value.ref.contentHash))throw new ApiError('RESPONSE_INVALID');
 const d=value.declaration,bytes=new TextEncoder().encode(JSON.stringify({displayName:d.displayName,hostLabel:d.hostLabel,pathHint:d.pathHint,reason:d.reason})),hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');if(hash!==value.ref.contentHash)throw new ApiError('RESPONSE_INVALID');return value;
}
async function draftResult(value: unknown):Promise<DraftResult> {
  const result = value as DraftResult;
  if (!result || !uuid.test(result.draftId) || !Number.isSafeInteger(result.version) || result.version < 1 || !Number.isInteger(result.step) || result.step < 1 || result.step > 4
    || !result.input || typeof result.input.name !== 'string' || typeof result.input.purpose !== 'string' || typeof result.input.desiredOutcome !== 'string'
    || !['EMPTY','EXISTING'].includes(result.input.sourceMode) || !validSelection(result.input.methodologySelection) || !Array.isArray(result.input.artifactRefs) || result.input.artifactRefs.length) throw new ApiError('RESPONSE_INVALID');
  if(result.input.sourceMode==='EXISTING'){const source=await validSourceView(result.sourceDeclaration,result.draftId,result.version),input=result.input.sourceDeclaration;if(!validSourceDeclaration(input)||(['hostLabel','displayName','pathHint','reason']as const).some(k=>source.declaration[k]!==input[k]))throw new ApiError('RESPONSE_INVALID');}else if(result.input.sourceDeclaration!==undefined||result.sourceDeclaration!=null)throw new ApiError('RESPONSE_INVALID');
  const state = result.methodologyState;
  if (state != null && (!state.ref || state.ref.id !== result.draftId || state.ref.version !== result.version || !/^[0-9a-f]{64}$/.test(state.ref.contentHash)
    || typeof state.validation?.validForConfirmation !== 'boolean' || !Array.isArray(state.validation.issues)
    || state.contentReviewCriteria?.criteriaVersion !== 1 || !Array.isArray(state.contentReviewCriteria.items) || state.contentReviewCriteria.items.length !== 5
    || new Set(state.contentReviewCriteria.items.map(item => item.criterionId)).size !== 5 || state.contentReviewCriteria.items.some(item => typeof item.criterionId !== 'string' || typeof item.title !== 'string')
    || !Array.isArray(state.contentReviews) || state.contentReviews.some(review => !reviewRefFor(review?.reviewRef, state.ref) || typeof review.reason !== 'string' || review.reviewerSubjectRef?.kind !== 'HUMAN' || !uuid.test(review.reviewerSubjectRef.userId) || typeof review.reviewerSubjectRef.sameAsTargetRecorder !== 'boolean' || review.sourceKind !== 'HUMAN_REVIEW' || !Number.isFinite(Date.parse(review.reviewedAt)))
    || state.confirmation != null && (!uuid.test(state.confirmation.id) || !uuid.test(state.confirmation.decidedBy) || !Number.isFinite(Date.parse(state.confirmation.decidedAt)) || !Array.isArray(state.confirmation.reviewRefs) || !state.confirmation.reviewRefs.length || state.confirmation.reviewRefs.some(ref => !reviewRefFor(ref, state.ref) || ref.outcome !== 'ACCEPTED')))) throw new ApiError('RESPONSE_INVALID');
  return result;
}
export async function readProjectDraft(client: ApiClient, draftId: string): Promise<DraftResult> {
  if (!uuid.test(draftId)) throw new ApiError('CLIENT_PATH_INVALID');
  const result = await draftResult(await client.get('/api/v1/project-drafts/' + draftId));
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

async function actionPost(client: ApiClient, action: DraftAction, csrf: string): Promise<any> {
  if (!uuid.test(action.draftId)) throw new ApiError('CLIENT_PATH_INVALID');
  const request = action.body;
  const keys = action.kind === 'create' ? ['schemaVersion', 'commandId', 'clientId', 'draftId', 'draftVersion'] : ['schemaVersion', 'commandId', 'clientId', 'targetId', 'expectedVersion', 'operation', 'payload'];
  if (!request || Object.keys(request).sort().join(',') !== keys.sort().join(',') || request.schemaVersion !== 1 || typeof request.commandId !== 'string' || !uuid.test(request.commandId) || typeof request.clientId !== 'string' || !uuid.test(request.clientId)
    || (action.kind === 'create' ? request.draftId !== action.draftId || !Number.isSafeInteger(request.draftVersion) || Number(request.draftVersion) < 1 : request.targetId !== action.draftId || !Number.isSafeInteger(request.expectedVersion) || Number(request.expectedVersion) < 1 || !['recordContentReview', 'confirmDraftMethodology'].includes(String(request.operation)) || !request.payload || typeof request.payload !== 'object' || Array.isArray(request.payload))) throw new ApiError('CLIENT_PATH_INVALID');
  if (!/^[A-Za-z0-9_-]{43}$/.test(csrf)) throw new ApiError('AUTH_REQUIRED', 401);
  let response: Response;
  try { response = await client.transport.call(globalThis, action.kind === 'create' ? '/api/v1/projects' : `/api/v1/project-drafts/${action.draftId}/commands`, { method: 'POST', credentials: 'same-origin', redirect: 'error', cache: 'no-store', headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-Anvil-CSRF': csrf }, body: JSON.stringify(action.body) }); }
  catch { throw new ApiError('CONNECTION_LOST'); }
  let value: any;
  try { if (!/^application\/json\b/i.test(response.headers.get('content-type') ?? '')) throw Error(); value = await response.json(); }
  catch { throw new ApiError('RESPONSE_INVALID', response.status); }
  if (!response.ok) throw new ApiError(typeof value?.code === 'string' && /^[A-Z_]{1,64}$/.test(value.code) ? value.code : 'REQUEST_FAILED', response.status);
  return value;
}
export async function runDraftAction(client: ApiClient, action: DraftAction, csrf: string, actorId: string): Promise<CreatedProject | null> {
  const value = await actionPost(client, action, csrf);
  if (action.kind === 'create') {
    if (!value || !uuid.test(value.id) || value.version !== 1 || typeof value.name !== 'string' || typeof value.purpose !== 'string' || typeof value.desiredOutcome !== 'string' || value.participation !== 'OWNER'
      || !value.currentMethodologyRef || !uuid.test(value.currentMethodologyRef.id) || value.currentMethodologyRef.version !== 1 || !/^[0-9a-f]{64}$/.test(value.currentMethodologyRef.contentHash) || value.baselineRef !== null
      || !Array.isArray(value.readinessIssues) || value.readinessIssues.some((issue: { code: string }) => typeof issue?.code !== 'string')
      || value.controlState?.actorId !== actorId || value.controlState?.clientId !== action.body.clientId || value.controlState?.generation !== 1 || value.controlState?.status !== 'HELD') throw new ApiError('RESPONSE_INVALID');
    if(value.sourceMode==='EXISTING'){await validSourceView(value.sourceDeclaration,action.draftId,Number(action.body.draftVersion));if(!value.readinessIssues.some((i:{code:string})=>i.code==='SOURCE_DECLARATION_UNVERIFIED'))throw new ApiError('RESPONSE_INVALID');}else if(value.sourceMode!==undefined&&value.sourceMode!=='EMPTY'||value.sourceDeclaration!=null)throw new ApiError('RESPONSE_INVALID');
    return value;
  }
  const payload = action.body.payload as Record<string, unknown>, ref = action.body.operation === 'recordContentReview' ? payload.targetRef as VersionRef : { id: action.draftId, version: action.body.expectedVersion as number, contentHash: payload.graphHash as string };
  if (!value || value.scopeKind !== 'DRAFT' || value.draftId !== action.draftId || value.targetId !== action.draftId || value.version !== action.body.expectedVersion || value.commandId !== action.body.commandId || value.status !== 'APPLIED'
    || !value.data?.ref || value.data.ref.id !== ref.id || value.data.ref.version !== ref.version || value.data.ref.contentHash !== ref.contentHash
    || (action.body.operation === 'recordContentReview' ? value.data.status !== 'REVIEW_RECORDED' || !reviewRefFor(value.data.reviewRef, ref) || value.data.reviewRef.outcome !== payload.outcome : value.data.status !== 'CONFIRMED' || !uuid.test(value.data.confirmationId))) throw new ApiError('RESPONSE_INVALID');
  return null;
}
