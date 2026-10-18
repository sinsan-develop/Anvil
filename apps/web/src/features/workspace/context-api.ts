import { ApiClient, ApiError } from '../../api/client.ts';
import { postDocumentCommand, type DocumentSession, type DocumentWrite } from '../design-trace/editor-api.ts';
import type { PlanRef } from '../design-trace/work-plan-api.ts';
import { ordered } from '../knowledge/review-view.ts';
import type { ConfirmedAssignmentView } from './assignment-confirmation-api.ts';
import type { ContextPreparationInput } from '../../../../server/modules/context/context-input.ts';
import type { buildContextManifest } from '../../../../server/modules/context/context-manifest.ts';

type Manifest = ReturnType<typeof buildContextManifest>['manifest'];
export const contextCodes = ['PURPOSE_REASON', 'RULES_SCOPE', 'LATEST_INSTRUCTIONS', 'DECISIONS_REASON', 'CURRENT_POSITION', 'ACTUAL_GAPS', 'NEXT_ACTION'] as const;
export interface ContextPreparationBuffer {
 bindingId: string; projectId: string; ownerUserId: string; ownerClientId: string; controlGeneration: number; assignmentRef: PlanRef; budgetRef: PlanRef | null;
 input: ContextPreparationInput; pending: DocumentWrite | null; resultRef: PlanRef | null; result: ContextPreparationView | null; dirty: boolean; uncertain: boolean; failure: { code: string; status: number } | null;
}
interface CurrentCheck { state: 'MATCHED_METADATA' | 'CHANGED' | 'UNAVAILABLE'; issues: string[] }
export interface ContextPreparationView { projectId: string; ref: PlanRef; manifest: Manifest; currentCheck: CurrentCheck; ready: false; executionAuthorized: false; dispatchPerformed: false; observedAt: string }
export interface ContextPreparationPage { projectId: string; assignmentRef: PlanRef; items: { ref: PlanRef; missingRequired: string[]; excluded: string[]; currentCheck: CurrentCheck }[]; hasMore: boolean; limit: number; ready: false; executionAuthorized: false; dispatchPerformed: false; observedAt: string }
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
const hash = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v);
const exact = (v: any, keys: string[]) => !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).sort().join(',') === [...keys].sort().join(',');
const reference = (v: any): v is PlanRef => exact(v, ['id', 'version', 'contentHash']) && uuid(v.id) && Number.isSafeInteger(v.version) && v.version > 0 && hash(v.contentHash);
const same = (a: unknown, b: unknown) => ordered(a) === ordered(b);
const text = (v: unknown): v is string => typeof v === 'string' && v.isWellFormed() && !!v.trim() && v.length <= 20000;
const ids = (v: any) => Array.isArray(v) && v.length <= 207 && v.every(i => typeof i === 'string' && /^[A-Z_]+(?:_[1-9][0-9]*)?$/.test(i)) && new Set(v).size === v.length;
const flags = (v: any) => v.ready === false && v.executionAuthorized === false && v.dispatchPerformed === false;
function inputValid(v: any): v is ContextPreparationInput {
 if (!exact(v, ['assignmentRef', 'budgetRef', 'slots', 'limits', 'reason']) || !reference(v.assignmentRef) || v.budgetRef !== null && !reference(v.budgetRef) || !text(v.reason)
  || !exact(v.limits, ['maxPartBytes', 'maxParts']) || !Number.isSafeInteger(v.limits.maxPartBytes) || v.limits.maxPartBytes < 1 || v.limits.maxPartBytes > 2097152 || !Number.isSafeInteger(v.limits.maxParts) || v.limits.maxParts < 1 || v.limits.maxParts > 200
  || !Array.isArray(v.slots) || v.slots.length !== 7 || new Set(v.slots.map((slot: any) => slot?.code)).size !== 7) return false;
 let count = 0;
 for (const slot of v.slots) {
  if (!exact(slot, ['code', 'sources', 'reason']) || !contextCodes.includes(slot.code) || !text(slot.reason) || !Array.isArray(slot.sources) || (count += slot.sources.length) > 200 || ['PURPOSE_REASON', 'RULES_SCOPE'].includes(slot.code) && slot.sources.length > 1 || new Set(slot.sources.map(ordered)).size !== slot.sources.length) return false;
  for (const source of slot.sources) {
   if (exact(source, ['kind', 'versionRef']) && reference(source.versionRef) && (source.kind === 'KNOWLEDGE_VERSION' && slot.code !== 'LATEST_INSTRUCTIONS' || source.kind === 'DOCUMENT_VERSION' && ['CURRENT_POSITION', 'ACTUAL_GAPS', 'NEXT_ACTION'].includes(slot.code))) continue;
   if (!exact(source, ['kind', 'conversationId', 'messageRef']) || source.kind !== 'USER_INSTRUCTION' || slot.code !== 'LATEST_INSTRUCTIONS' || !uuid(source.conversationId) || !exact(source.messageRef, ['kind', 'id', 'contentHash']) || source.messageRef.kind !== 'CONVERSATION' || !uuid(source.messageRef.id) || !hash(source.messageRef.contentHash)) return false;
  }
 }
 return new TextEncoder().encode(ordered(v)).length <= 2097152;
}
function check(v: any): v is CurrentCheck { return exact(v, ['state', 'issues']) && ['MATCHED_METADATA', 'CHANGED', 'UNAVAILABLE'].includes(v.state) && Array.isArray(v.issues) && v.issues.length <= 1 && (v.state === 'MATCHED_METADATA' ? v.issues.length === 0 : v.issues.length === 1 && v.issues[0] === (v.state === 'CHANGED' ? 'CURRENT_SOURCE_OR_BASIS_CHANGED' : 'CURRENT_SOURCE_OR_BASIS_UNAVAILABLE')); }
function commandValid(v: any): v is DocumentWrite { return exact(v, ['schemaVersion', 'projectId', 'commandId', 'clientId', 'controlGeneration', 'operation', 'targetId', 'expectedVersion', 'baselineRefs', 'approvalRef', 'payload']) && v.schemaVersion === 1 && uuid(v.projectId) && uuid(v.commandId) && uuid(v.clientId) && Number.isSafeInteger(v.controlGeneration) && v.controlGeneration > 0 && v.operation === 'buildTaskContext' && v.targetId === null && v.expectedVersion === 0 && Array.isArray(v.baselineRefs) && v.baselineRefs.length === 0 && v.approvalRef === null && inputValid(v.payload); }
function bound(b: ContextPreparationBuffer, s: DocumentSession) {
 if (!uuid(b.bindingId) || !uuid(b.projectId) || !uuid(s.user.id) || !uuid(s.clientId) || b.ownerUserId !== s.user.id || b.ownerClientId !== s.clientId || !Number.isSafeInteger(b.controlGeneration) || b.controlGeneration < 1 || !/^[A-Za-z0-9_-]{43}$/.test(s.csrfToken)) throw new ApiError('CONTEXT_BINDING_INVALID');
}
export function newContextPreparation(assignment: ConfirmedAssignmentView, session: DocumentSession, generation: number): ContextPreparationBuffer {
 if (!uuid(assignment.projectId) || !reference(assignment.ref) || assignment.snapshot.contentConfirmed !== true || !flags(assignment.snapshot) || assignment.snapshot.definition.budgetRef !== null && !reference(assignment.snapshot.definition.budgetRef)) throw new ApiError('CONTEXT_ASSIGNMENT_INVALID');
 const buffer: ContextPreparationBuffer = { bindingId: crypto.randomUUID(), projectId: assignment.projectId, ownerUserId: session.user.id, ownerClientId: session.clientId, controlGeneration: generation, assignmentRef: assignment.ref, budgetRef: assignment.snapshot.definition.budgetRef,
  input: { assignmentRef: assignment.ref, budgetRef: assignment.snapshot.definition.budgetRef, slots: contextCodes.map(code => ({ code, sources: [], reason: '자료 미선택·내용 미확인' })), limits: { maxPartBytes: 32768, maxParts: 200 }, reason: '' }, pending: null, resultRef: null, result: null, dirty: true, uncertain: false, failure: null };
 bound(buffer, session); return structuredClone(buffer);
}
export function prepareContextWrite(b: ContextPreparationBuffer, session: DocumentSession): DocumentWrite {
 bound(b, session);
 if (!inputValid(b.input) || !same(b.input.assignmentRef, b.assignmentRef) || !same(b.input.budgetRef, b.budgetRef) || b.resultRef) throw new ApiError('CONTEXT_INPUT_INVALID');
 if (b.pending) {
  const p = b.pending;
  if (!commandValid(p) || p.projectId !== b.projectId || p.clientId !== session.clientId || p.controlGeneration !== b.controlGeneration || !same(p.payload, b.input)) throw new ApiError('CONTEXT_BINDING_INVALID');
  return structuredClone(p);
 }
 if (b.uncertain) throw new ApiError('CONTEXT_PENDING_COMMAND_MISSING');
 return { schemaVersion: 1, projectId: b.projectId, commandId: crypto.randomUUID(), clientId: session.clientId, controlGeneration: b.controlGeneration, operation: 'buildTaskContext', targetId: null, expectedVersion: 0, baselineRefs: [], approvalRef: null, payload: structuredClone(b.input) as unknown as Record<string, unknown> };
}
export async function sendContextPreparation(client: ApiClient, command: DocumentWrite, csrf: string): Promise<PlanRef> {
 if (!commandValid(command) || !/^[A-Za-z0-9_-]{43}$/.test(csrf)) throw new ApiError('CONTEXT_BINDING_INVALID');
 const result = await postDocumentCommand(client, command, csrf), data = result.data;
 if (!exact(data, ['ref', 'status', 'ready', 'executionAuthorized', 'dispatchPerformed']) || data.status !== 'CONTEXT_PREPARED' || !reference(data.ref) || data.ref.version !== 1 || result.targetId !== data.ref.id || result.version !== 1 || !flags(data)) throw new ApiError('RESPONSE_INVALID');
 return structuredClone(data.ref);
}
async function manifestValid(v: any, projectId: string, ref: PlanRef) {
 if (!exact(v, ['id', 'projectId', 'version', 'preparationInput', 'assignmentRef', 'baselineRefs', 'purposeRef', 'constitutionRef', 'latestInstructionRefs', 'currentPositionRef', 'items', 'sourceBindings', 'missingRequired', 'excluded', 'deliveryPlan', 'budgetRef', 'unverified', 'sourceAuthorizationVerified', 'budgetVerified', 'ready', 'executionAuthorized', 'dispatchPerformed']) || v.id !== ref.id || v.projectId !== projectId || v.version !== 1 || !flags(v) || v.sourceAuthorizationVerified !== false || v.budgetVerified !== false || !inputValid(v.preparationInput) || !same(v.assignmentRef, v.preparationInput.assignmentRef) || !same(v.budgetRef, v.preparationInput.budgetRef)
  || !Array.isArray(v.baselineRefs) || v.baselineRefs.length > 200 || !v.baselineRefs.every(reference) || !ids(v.missingRequired) || !ids(v.excluded) || !Array.isArray(v.items) || v.items.length < 7 || v.items.length > 207 || !Array.isArray(v.sourceBindings) || v.sourceBindings.length !== v.items.length
  || !exact(v.deliveryPlan, ['state', 'parts', 'multipartRequired', 'limits']) || v.deliveryPlan.state !== 'PREPARATION_ONLY' || !same(v.deliveryPlan.limits, v.preparationInput.limits) || !Array.isArray(v.deliveryPlan.parts) || v.deliveryPlan.parts.length > v.preparationInput.limits.maxParts || v.deliveryPlan.multipartRequired !== (v.deliveryPlan.parts.length > 1)
  || v.items.some((item: any) => !exact(item, ['itemId', 'category', 'required', 'sourceRef', 'sourceHash', 'reason', 'includedState', 'deliveryParts', 'issue']) || item.required !== true || !contextCodes.includes(item.category) || !text(item.reason) || !['INCLUDED', 'MISSING', 'REDACTED', 'EXCLUDED'].includes(item.includedState) || !Array.isArray(item.deliveryParts))
  || v.sourceBindings.some((binding: any) => !exact(binding, ['itemId', 'selection', 'bodyRef', 'sourceState']))
  || v.deliveryPlan.parts.some((part: any, index: number) => !exact(part, ['partId', 'itemId', 'sourceRef', 'bodyRef', 'order', 'byteOffset', 'utf8Bytes', 'contentHash']) || part.order !== index + 1 || !Number.isSafeInteger(part.byteOffset) || part.byteOffset < 0 || !Number.isSafeInteger(part.utf8Bytes) || part.utf8Bytes < 1 || part.utf8Bytes > v.preparationInput.limits.maxPartBytes || !hash(part.contentHash))) throw new ApiError('RESPONSE_INVALID');
 const encoded = new TextEncoder().encode(ordered(v)); if (encoded.length > 2097152) throw new ApiError('RESPONSE_INVALID');
 const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', encoded))].map(n => n.toString(16).padStart(2, '0')).join('');
 if (digest !== ref.contentHash) throw new ApiError('CONTEXT_INTEGRITY_FAILED');
}
export async function readContextPreparation(client: ApiClient, projectId: string, ref: PlanRef): Promise<ContextPreparationView> {
 if (!uuid(projectId) || !reference(ref) || ref.version !== 1) throw new ApiError('CLIENT_PATH_INVALID');
 const v = await client.get<ContextPreparationView>(`/api/v1/projects/${projectId}/context/${ref.id}/versions/1`);
 if (!exact(v, ['projectId', 'ref', 'manifest', 'currentCheck', 'ready', 'executionAuthorized', 'dispatchPerformed', 'observedAt']) || v.projectId !== projectId || !same(v.ref, ref) || !flags(v) || !check(v.currentCheck) || !Number.isFinite(Date.parse(v.observedAt))) throw new ApiError('RESPONSE_INVALID');
 await manifestValid(v.manifest, projectId, ref); return v;
}
export async function listContextPreparations(client: ApiClient, projectId: string, assignmentRef: PlanRef): Promise<ContextPreparationPage> {
 if (!uuid(projectId) || !reference(assignmentRef)) throw new ApiError('CLIENT_PATH_INVALID');
 const query = new URLSearchParams({ assignmentId: assignmentRef.id, assignmentVersion: String(assignmentRef.version), assignmentHash: assignmentRef.contentHash, limit: '50' });
 const v = await client.get<ContextPreparationPage>(`/api/v1/projects/${projectId}/context?${query}`);
 if (!exact(v, ['projectId', 'assignmentRef', 'items', 'hasMore', 'limit', 'ready', 'executionAuthorized', 'dispatchPerformed', 'observedAt']) || v.projectId !== projectId || !same(v.assignmentRef, assignmentRef) || !Array.isArray(v.items) || v.items.length > 50 || v.limit !== 50 || typeof v.hasMore !== 'boolean' || !flags(v) || !Number.isFinite(Date.parse(v.observedAt))
  || new Set(v.items.map(item => item.ref?.id)).size !== v.items.length || v.items.some(item => !exact(item, ['ref', 'missingRequired', 'excluded', 'currentCheck']) || !reference(item.ref) || item.ref.version !== 1 || !ids(item.missingRequired) || !ids(item.excluded) || !check(item.currentCheck))) throw new ApiError('RESPONSE_INVALID');
 return v;
}
