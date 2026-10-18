import { ApiClient, ApiError } from '../../api/client.ts';
import { postDocumentCommand, type DocumentWrite, type DocumentSession } from '../design-trace/editor-api.ts';
import type { WorkPlanView, PlanRef } from '../design-trace/work-plan-api.ts';
import { ordered } from '../knowledge/review-view.ts';
import type { AssignmentDraftInput, AssignmentDefinition, AssignmentIssue } from '../../../../server/modules/assignments/assignment-input.ts';
import type { AssignmentDecisionBuffer } from './assignment-confirmation-api.ts';
import type { ContextPreparationBuffer } from './context-api.ts';
import type { ResponsibleSessionBuffer } from './responsible-session-api.ts';
import type { RootView } from '../connections/source-roots-api.ts';
import type { SourceReadSnapshotView } from '../connections/source-read-api.ts';

export interface AssignmentSnapshot { definition: AssignmentDefinition; reason: string; previousRef: PlanRef | null; basis: { planRef: PlanRef; applicationRef: PlanRef; designRef: PlanRef; taskCode: string; nodeId: string; taskCardHash: string }; readinessIssues: AssignmentIssue[]; status: 'DRAFT'; ready: false; executionAuthorized: false; dispatchPerformed: false }
export interface AssignmentDraftView { projectId: string; ref: PlanRef; snapshot: AssignmentSnapshot; headVersion: number | null; sourceCurrentness: 'NOT_RECHECKED'; observedAt: string }
export interface AssignmentBuffer { bindingId: string; projectId: string; ownerUserId: string; ownerClientId: string; controlGeneration: number; expectedDesignRef: PlanRef; input: AssignmentDraftInput; ref: PlanRef | null; pending: DocumentWrite | null; result: AssignmentDraftView | null; dirty: boolean; uncertain: boolean; failure: { code: string; status: number } | null; contentDecision?: AssignmentDecisionBuffer | null; contextPreparation?: ContextPreparationBuffer | null; responsibleSession?:ResponsibleSessionBuffer|null }
export interface AssignmentPage { items: { ref: PlanRef; status: 'DRAFT'; goal: string; taskRef: AssignmentDefinition['taskRef']; issueCount: number; updatedAt: string; ready: false; executionAuthorized: false }[]; hasMore: boolean; nextCursor: string | null; observedAt: string }
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
const hash = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v);
const exact = (v: any, keys: string[]) => !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).sort().join(',') === [...keys].sort().join(',');
const reference = (v: any): v is PlanRef => exact(v, ['id', 'version', 'contentHash']) && uuid(v.id) && Number.isSafeInteger(v.version) && v.version > 0 && hash(v.contentHash);
const text = (v: unknown, max = 20000): v is string => typeof v === 'string' && v.isWellFormed() && v.length <= max;
const strings = (v: any) => Array.isArray(v) && v.length <= 200 && v.every((s: unknown) => text(s));
const same = (a: unknown, b: unknown) => ordered(a) === ordered(b);
const task = (v: any) => exact(v, ['planRef', 'taskCode', 'applicationRef', 'nodeId']) && reference(v.planRef) && reference(v.applicationRef) && typeof v.taskCode === 'string' && /^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(v.taskCode) && text(v.nodeId, 2 * 1024 * 1024) && !!v.nodeId.trim();
const textFields = ['purpose', 'goal', 'ownerRole', 'integrationResponsibility'];
const listFields = ['inputs', 'outputs', 'acceptanceCriteria', 'verificationRequirements', 'included', 'excluded', 'requiredCapabilities'];
function definition(v: any) {
  if (!exact(v, ['taskRef', 'baselineRefs', 'allowedScopes', 'environmentRef', 'budgetRef', 'parentAssignmentRef', 'recordingPolicyRef', ...textFields, ...listFields]) || !task(v.taskRef) || !textFields.every(k => text(v[k], k === 'ownerRole' ? 200 : 20000)) || !listFields.every(k => strings(v[k])) || !Array.isArray(v.baselineRefs) || v.baselineRefs.length > 200 || !v.baselineRefs.every(reference) || new Set(v.baselineRefs.map(ordered)).size !== v.baselineRefs.length || !['environmentRef', 'budgetRef', 'recordingPolicyRef'].every(k => v[k] === null || reference(v[k])) || v.parentAssignmentRef !== null || !Array.isArray(v.allowedScopes) || v.allowedScopes.length > 200) return false;
  let targets = 0;
  return v.allowedScopes.every((scope: any) => exact(scope, ['sourceRootRef', 'mappingRef', 'observationRef', 'baselineRef', 'targets']) && ['sourceRootRef', 'observationRef', 'baselineRef'].every(k => reference(scope[k])) && (scope.mappingRef === null || reference(scope.mappingRef)) && Array.isArray(scope.targets) && scope.targets.length > 0 && scope.targets.length <= 200 && scope.targets.every((t: any) => ++targets <= 200 && exact(t, ['relativePath', 'kind', 'access', 'recursive']) && text(t.relativePath, 1024) && !!t.relativePath && t.kind === 'FILE' && ['READ', 'WRITE'].includes(t.access) && t.recursive === false));
}
async function validateSnapshot(s: AssignmentSnapshot, ref: PlanRef) {
  if (!reference(ref) || !exact(s, ['definition', 'reason', 'previousRef', 'basis', 'readinessIssues', 'status', 'ready', 'executionAuthorized', 'dispatchPerformed']) || !definition(s.definition) || !text(s.reason) || !s.reason.trim() || s.previousRef !== null && !reference(s.previousRef) || !exact(s.basis, ['planRef', 'applicationRef', 'designRef', 'taskCode', 'nodeId', 'taskCardHash']) || !reference(s.basis.designRef) || !hash(s.basis.taskCardHash) || !same(s.basis.planRef, s.definition.taskRef.planRef) || !same(s.basis.applicationRef, s.definition.taskRef.applicationRef) || s.basis.taskCode !== s.definition.taskRef.taskCode || s.basis.nodeId !== s.definition.taskRef.nodeId || !Array.isArray(s.readinessIssues) || s.readinessIssues.length > 1000 || s.readinessIssues.some(i => !exact(i, ['code', 'location']) || typeof i.code !== 'string' || !/^[A-Z_]{1,64}$/.test(i.code) || !text(i.location, 200)) || s.status !== 'DRAFT' || s.ready !== false || s.executionAuthorized !== false || s.dispatchPerformed !== false || (ref.version === 1 ? s.previousRef !== null : !s.previousRef || s.previousRef.id !== ref.id || s.previousRef.version !== ref.version - 1)) throw new ApiError('RESPONSE_INVALID');
  const bytes = new TextEncoder().encode(ordered(s)), digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(n => n.toString(16).padStart(2, '0')).join('');
  if (digest !== ref.contentHash) throw new ApiError('ASSIGNMENT_INTEGRITY_FAILED');
}
export function newAssignmentDraft(projectId: string, session: DocumentSession, generation: number, plan: WorkPlanView, taskCode: string, applicationRef: PlanRef, nodeId: string, requiredCapabilities: string[] = []): AssignmentBuffer {
  if (!uuid(projectId) || !uuid(session.user.id) || !uuid(session.clientId) || !Number.isSafeInteger(generation) || generation < 1 || !reference(plan.ref) || !reference(plan.designRef) || !reference(applicationRef)) throw new ApiError('ASSIGNMENT_BINDING_INVALID');
  const card = plan.tasks.find(item => item.taskCode === taskCode); if (!card) throw new ApiError('ASSIGNMENT_INPUT_INVALID');
  const input: AssignmentDraftInput = { baseRef: null, reason: '', definition: { taskRef: { planRef: plan.ref, taskCode, applicationRef, nodeId }, purpose: card.purpose, goal: card.title, baselineRefs: [plan.ref, applicationRef, plan.designRef], inputs: card.inputs, outputs: card.outputs, acceptanceCriteria: card.acceptanceCriteria, verificationRequirements: card.testCases.map(t => t.expected), included: card.included, excluded: card.excluded, allowedScopes: [], environmentRef: null, requiredCapabilities, budgetRef: null, ownerRole: card.ownerRole, parentAssignmentRef: null, recordingPolicyRef: null, integrationResponsibility: '' } };
  if (!definition(input.definition)) throw new ApiError('ASSIGNMENT_INPUT_INVALID');
  return structuredClone({ bindingId: crypto.randomUUID(), projectId, ownerUserId: session.user.id, ownerClientId: session.clientId, controlGeneration: generation, expectedDesignRef: plan.designRef, input, ref: null, pending: null, result: null, dirty: true, uncertain: false, failure: null });
}
/** 기존 hash 검증 API로 읽은 자료의 명시 선택만 초안에 복사한다. 실제 source 허가는 아니다. */
export function selectAssignmentSourceScope(buffer:AssignmentBuffer,session:DocumentSession,baseline:any,root:RootView,observation:SourceReadSnapshotView,selected:{relativePath:string;access:'READ'|'WRITE'}[]):AssignmentBuffer {
  const fail=():never=>{throw new ApiError('ASSIGNMENT_SOURCE_SELECTION_INVALID');};
  if(buffer.ownerUserId!==session.user.id||buffer.ownerClientId!==session.clientId||buffer.pending||buffer.result||buffer.uncertain
    ||baseline?.projectId!==buffer.projectId||baseline.status!=='FEATURE_STATUS_V1'||!reference(baseline.ref)||baseline.contentConfirmed!==true
    ||baseline.currentContentReviewValid!==true||baseline.currentCheck?.state!=='MATCHED_METADATA'||baseline.executionAuthorized!==false
    ||root.projectId!==buffer.projectId||!root.rawAllowed||!reference(root.ref)||root.ref.version!==root.headVersion||root.status!=='DECLARED'||root.executionAuthorized!==false
    ||observation.projectId!==buffer.projectId||!observation.rawAllowed||observation.executionAuthorized!==false||observation.agentDispatchPerformed!==false
    ||!reference(observation.snapshotRef)||!same(observation.sourceRootRef,root.ref)||observation.report.root.state!=='OBSERVED'
    ||!Array.isArray(selected)||!selected.length||selected.length>200||new Set(selected.map(item=>item.relativePath.toUpperCase())).size!==selected.length)return fail();
  const source=baseline.snapshot?.input?.source;
  if(source?.kind!=='ATTRIBUTE_REPORT'||!same(source.sourceRootRef,root.ref)||!same(source.snapshotRef,observation.snapshotRef)||!same(source.grantRef,observation.grantRef))return fail();
  const targets=selected.map(item=>{
    if(!exact(item,['relativePath','access'])||!['READ','WRITE'].includes(item.access)||!observation.report.files.some(file=>file.relativePath===item.relativePath&&file.state==='OBSERVED'))return fail();
    return {relativePath:item.relativePath,kind:'FILE' as const,access:item.access,recursive:false as const};
  });
  const scope={sourceRootRef:root.ref,mappingRef:null,observationRef:observation.snapshotRef,baselineRef:baseline.ref as PlanRef,targets};
  const next=structuredClone(buffer);
  next.input.definition.allowedScopes=[...next.input.definition.allowedScopes.filter(item=>item.sourceRootRef.id!==root.ref.id),structuredClone(scope)];
  if(!definition(next.input.definition))return fail();next.dirty=true;next.failure=null;return next;
}
export function applyAssignmentSourceSelection(buffer:AssignmentBuffer,session:DocumentSession,baseline:any,root:RootView,observation:SourceReadSnapshotView,selected:{relativePath:string;access:'READ'|'WRITE'}[],update:(change:(value:AssignmentBuffer)=>AssignmentBuffer)=>void):void {
  // 예외가 날 수 있는 검증은 이벤트의 오류 처리 안에서 완료한다. React updater는 CAS만 한다.
  const next=selectAssignmentSourceScope(buffer,session,baseline,root,observation,selected);
  update(current=>current===buffer?next:current);
}
export function prepareAssignmentWrite(buffer: AssignmentBuffer, session: DocumentSession): DocumentWrite {
  if (!uuid(buffer.projectId) || buffer.ownerUserId !== session.user.id || buffer.ownerClientId !== session.clientId || !uuid(session.clientId) || !/^[A-Za-z0-9_-]{43}$/.test(session.csrfToken) || !Number.isSafeInteger(buffer.controlGeneration) || buffer.controlGeneration < 1) throw new ApiError('ASSIGNMENT_BINDING_INVALID');
  if (buffer.result || !definition(buffer.input.definition) || !text(buffer.input.reason) || !buffer.input.reason.trim() || !same(buffer.ref, buffer.input.baseRef)) throw new ApiError('ASSIGNMENT_INPUT_INVALID');
  if (buffer.pending) {
    if (buffer.pending.projectId !== buffer.projectId || buffer.pending.clientId !== session.clientId || buffer.pending.controlGeneration !== buffer.controlGeneration || buffer.pending.operation !== 'prepareAssignment' || !same(buffer.pending.payload, buffer.input)) throw new ApiError('ASSIGNMENT_BINDING_INVALID');
    return structuredClone(buffer.pending);
  }
  return structuredClone({ schemaVersion: 1, projectId: buffer.projectId, commandId: crypto.randomUUID(), clientId: session.clientId, controlGeneration: buffer.controlGeneration, operation: 'prepareAssignment', targetId: buffer.ref?.id ?? null, expectedVersion: buffer.ref?.version ?? 0, baselineRefs: [], approvalRef: null, payload: { baseRef: buffer.input.baseRef, definition: buffer.input.definition, reason: buffer.input.reason } });
}
export async function sendAssignmentDraft(client: ApiClient, command: DocumentWrite, expectedDesignRef: PlanRef, csrf: string): Promise<AssignmentDraftView> {
  if (command.operation !== 'prepareAssignment' || !reference(expectedDesignRef) || !/^[A-Za-z0-9_-]{43}$/.test(csrf)) throw new ApiError('ASSIGNMENT_BINDING_INVALID');
  const result = await postDocumentCommand(client, command, csrf), data = result.data;
  if (data?.status !== 'ASSIGNMENT_DRAFT_STORED' || !reference(data.ref) || result.targetId !== data.ref.id || result.version !== data.ref.version || data.ref.version !== command.expectedVersion + 1 || command.targetId !== null && command.targetId !== data.ref.id) throw new ApiError('RESPONSE_INVALID');
  await validateSnapshot(data.snapshot, data.ref);
  if (!same(data.snapshot.definition, command.payload.definition) || data.snapshot.reason !== command.payload.reason || !same(data.snapshot.previousRef, command.payload.baseRef) || !same(data.snapshot.basis.designRef, expectedDesignRef)) throw new ApiError('RESPONSE_INVALID');
  return { projectId: command.projectId, ref: data.ref, snapshot: data.snapshot, headVersion: null, sourceCurrentness: 'NOT_RECHECKED', observedAt: result.serverReceivedAt };
}
export async function readAssignmentDraft(client: ApiClient, projectId: string, ref: PlanRef): Promise<AssignmentDraftView> {
  if (!uuid(projectId) || !reference(ref)) throw new ApiError('CLIENT_PATH_INVALID');
  const value = await client.get<AssignmentDraftView>(`/api/v1/projects/${projectId}/assignment-drafts/${ref.id}/versions/${ref.version}`);
  if (!exact(value, ['projectId', 'ref', 'snapshot', 'headVersion', 'sourceCurrentness', 'observedAt']) || value.projectId !== projectId || !same(value.ref, ref) || !Number.isSafeInteger(value.headVersion) || value.headVersion! < ref.version || value.sourceCurrentness !== 'NOT_RECHECKED' || !Number.isFinite(Date.parse(value.observedAt))) throw new ApiError('RESPONSE_INVALID');
  await validateSnapshot(value.snapshot, ref); return value;
}
export async function listAssignmentDrafts(client: ApiClient, projectId: string, cursor: string | null): Promise<AssignmentPage> {
  if (!uuid(projectId) || cursor !== null && (typeof cursor !== 'string' || !cursor || cursor.length > 4096)) throw new ApiError('CLIENT_PATH_INVALID');
  const query = new URLSearchParams({ limit: '50' }); if (cursor !== null) query.set('cursor', cursor);
  const page = await client.get<AssignmentPage>(`/api/v1/projects/${projectId}/assignment-drafts?${query}`);
  if (!exact(page, ['items', 'hasMore', 'nextCursor', 'observedAt']) || !Array.isArray(page.items) || page.items.length > 50 || typeof page.hasMore !== 'boolean' || (page.hasMore ? typeof page.nextCursor !== 'string' || !page.nextCursor || page.nextCursor.length > 4096 : page.nextCursor !== null) || !Number.isFinite(Date.parse(page.observedAt)) || new Set(page.items.map(i => i.ref?.id)).size !== page.items.length || page.items.some(i => !exact(i, ['ref', 'status', 'goal', 'taskRef', 'issueCount', 'updatedAt', 'ready', 'executionAuthorized']) || !reference(i.ref) || !task(i.taskRef) || !text(i.goal) || i.status !== 'DRAFT' || !Number.isSafeInteger(i.issueCount) || i.issueCount < 0 || !Number.isFinite(Date.parse(i.updatedAt)) || i.ready !== false || i.executionAuthorized !== false)) throw new ApiError('RESPONSE_INVALID');
  return page;
}
