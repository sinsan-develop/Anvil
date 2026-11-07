import { ApiClient, ApiError } from '../../api/client.ts';
import type { MethodologyGraph } from '../../../../../contracts/methodologies.ts';
import type { VersionRef } from '../../../../../contracts/generated-types.ts';
import type { MethodVersion } from './api.ts';
import type { FormReviewWork } from '../methodologies/form-editor-state.ts';
import type { MethodApplicationCommand } from './project-api.ts';

export interface MethodApplicationWork {
  ownerUserId:string;clientId:string;reason:string;preparationId:string|null;
  pending:{request:MethodApplicationCommand;previous:VersionRef|null;uncertain:boolean}|null;verifiedRef:VersionRef|null;
}

export interface MethodCommand { schemaVersion: 1; commandId: string; operation: 'copyMethodology' | 'saveMethodologyDraft' | 'copyForm' | 'saveFormDraft' | 'recordContentReview' | 'confirmForm' | 'confirmMethodology'; targetId: string | null; expectedVersion: number; clientId: string; payload: Record<string, unknown>; projectId?: string; controlGeneration?: number; baselineRefs?: []; approvalRef?: null }
export interface MethodGateway { prepare: (request: MethodCommand) => Promise<MethodCommand>; write: (request: MethodCommand) => Promise<CommonCommandReceipt>; read: (ref: VersionRef, name: string, purpose: string) => Promise<MethodVersion> }
export interface MethodBuffer {
  ownerUserId: string | null;
  targetId: string | null; version: number; name: string; purpose: string; reason: string;
  graph: MethodologyGraph; nodeId: string; dirty: boolean;
  validation: MethodVersion['validation'] | null;
  pending: { request: MethodCommand; name: string; purpose: string } | null;
  review: FormReviewWork | null;
  application?:MethodApplicationWork;
  preparationId?:string|null;
}
export function emptyMethodBuffer(): MethodBuffer { return { ownerUserId: null, targetId: null, version: 0, name: '', purpose: '', reason: '', graph: { nodes: [], edges: [], entryNodeId: '', terminalNodeIds: [] }, nodeId: '', dirty: false, pending: null, validation: null, review: null }; }
export function methodBuffer(value: MethodVersion, ownerUserId: string): MethodBuffer {
  return { ownerUserId, targetId: value.ref.id, version: value.ref.version, name: value.name, purpose: value.purpose, reason: '', graph: structuredClone(value.graph), nodeId: value.graph.entryNodeId, dirty: false, pending: null, validation: value.validation, review: null };
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export interface CommonCommandReceipt { targetId: string; version: number; data: { ref: VersionRef; status: 'DRAFT' | 'REVIEW_RECORDED' | 'CONFIRMED'; reviewRef?: unknown; confirmationId?: string } }
export async function writeCommonCommand(client: ApiClient, request: MethodCommand, csrf: string, ownerId: string): Promise<CommonCommandReceipt> {
  if (!uuid.test(request.commandId) || !uuid.test(request.clientId) || !uuid.test(ownerId) || !/^[A-Za-z0-9_-]{43}$/.test(csrf)) throw new ApiError('AUTH_REQUIRED', 401);
  let response: Response;
  try { response = await client.transport.call(globalThis, '/api/v1/user-common/commands', { method: 'POST', credentials: 'same-origin', redirect: 'error', cache: 'no-store',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-Anvil-CSRF': csrf }, body: JSON.stringify(request) }); }
  catch { throw new ApiError('CONNECTION_LOST'); }
  let body: any;
  try { if (!/^application\/json\b/i.test(response.headers.get('content-type') ?? '')) throw Error(); body = await response.json(); }
  catch { throw new ApiError('RESPONSE_INVALID', response.status); }
  if (!response.ok) throw new ApiError(typeof body?.code === 'string' && /^[A-Z_]{1,64}$/.test(body.code) ? body.code : 'REQUEST_FAILED', response.status);
  const ref = body?.data?.ref;
  const confirming = request.operation === 'confirmForm' || request.operation === 'confirmMethodology';
  const expectedVersion = request.operation === 'recordContentReview' || confirming ? request.expectedVersion : request.expectedVersion + 1;
  const status = request.operation === 'recordContentReview' ? 'REVIEW_RECORDED' : confirming ? 'CONFIRMED' : 'DRAFT';
  if (!body || typeof body !== 'object' || body.scopeKind !== 'USER_COMMON' || body.ownerUserId !== ownerId || body.commandId !== request.commandId || body.status !== 'APPLIED' || !uuid.test(body.operationId)
    || !body.data || body.data.status !== status || !ref || !uuid.test(ref.id) || !Number.isSafeInteger(ref.version) || ref.version !== expectedVersion || !/^[0-9a-f]{64}$/.test(ref.contentHash)
    || body.targetId !== ref.id || body.version !== ref.version || request.targetId !== null && request.targetId !== ref.id || !Number.isFinite(Date.parse(body.serverReceivedAt))) throw new ApiError('RESPONSE_INVALID');
  return body;
}
export async function writeCommonMethod(client: ApiClient, request: MethodCommand, csrf: string, ownerId: string): Promise<VersionRef> {
  if (!['copyMethodology', 'saveMethodologyDraft', 'copyForm', 'saveFormDraft'].includes(request.operation)) throw new ApiError('CLIENT_PATH_INVALID');
  return (await writeCommonCommand(client, request, csrf, ownerId)).data.ref;
}
