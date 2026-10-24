import { ApiClient, ApiError } from '../../api/client.ts';
import { postDocumentCommand, type DocumentSession, type DocumentWrite } from '../design-trace/editor-api.ts';
import type { PlanRef } from '../design-trace/work-plan-api.ts';
import { ordered } from '../knowledge/review-view.ts';
import { validateDesignChangePage, type DesignChangePage } from './api.ts';
export type ChangeRequestSource=(PlanRef & {kind:'DOCUMENT_VERSION'})|{kind:'ARTIFACT';id:string;contentHash:string}|{kind:'CONVERSATION';id:string;contentHash:string}|{kind:'USER_INSTRUCTION';id:string;contentHash:string};
export interface ChangeRequestBuffer { bindingId: string; projectId: string; ownerUserId: string; ownerClientId: string; controlGeneration: number; beforeRef: PlanRef; proposalId: string; reason: string; sourceRefs: ChangeRequestSource[]; pending: DocumentWrite | null; result: DesignChangePage | null; dirty: boolean; uncertain: boolean; failure: { code: string; status: number } | null }
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
const ref = (v: any): v is PlanRef => !!v && Object.keys(v).sort().join(',') === 'contentHash,id,version' && uuid(v.id) && Number.isSafeInteger(v.version) && v.version > 0 && typeof v.contentHash === 'string' && /^[0-9a-f]{64}$/.test(v.contentHash);
const same = (a: unknown, b: unknown) => ordered(a) === ordered(b);
export function newDesignChangeRequest(projectId: string, session: DocumentSession, generation: number, beforeRef: PlanRef, proposalId: string): ChangeRequestBuffer {
  if (!uuid(projectId) || !uuid(session.user.id) || !uuid(session.clientId) || !Number.isSafeInteger(generation) || generation < 1 || !ref(beforeRef) || !uuid(proposalId)) throw new ApiError('DESIGN_CHANGE_BINDING_INVALID');
  return { bindingId: crypto.randomUUID(), projectId, ownerUserId: session.user.id, ownerClientId: session.clientId, controlGeneration: generation, beforeRef: structuredClone(beforeRef), proposalId, reason: '', sourceRefs:[], pending: null, result: null, dirty: true, uncertain: false, failure: null };
}
export function prepareDesignChangeRequest(buffer: ChangeRequestBuffer, session: DocumentSession, acknowledged: boolean): DocumentWrite {
  if (!acknowledged) throw new ApiError('DESIGN_CHANGE_CONFIRM_REQUIRED');
  if (!uuid(buffer.bindingId) || !uuid(buffer.projectId) || buffer.ownerUserId !== session.user.id || buffer.ownerClientId !== session.clientId || !uuid(session.user.id) || !uuid(session.clientId) || !/^[A-Za-z0-9_-]{43}$/.test(session.csrfToken) || !Number.isSafeInteger(buffer.controlGeneration) || buffer.controlGeneration < 1 || !ref(buffer.beforeRef) || !uuid(buffer.proposalId) || buffer.result) throw new ApiError('DESIGN_CHANGE_BINDING_INVALID');
  if (typeof buffer.reason !== 'string' || !buffer.reason.trim() || buffer.reason.length > 20000 || !buffer.reason.isWellFormed()) throw new ApiError('DESIGN_CHANGE_REASON_REQUIRED');
  if(!Array.isArray(buffer.sourceRefs)||buffer.sourceRefs.length>200||new Set(buffer.sourceRefs.map(ordered)).size!==buffer.sourceRefs.length||buffer.sourceRefs.some(r=>!r||!(r.kind==='DOCUMENT_VERSION'?Object.keys(r).sort().join(',')==='contentHash,id,kind,version'&&ref({id:r.id,version:r.version,contentHash:r.contentHash}):['ARTIFACT','CONVERSATION','USER_INSTRUCTION'].includes(r.kind)&&Object.keys(r).sort().join(',')==='contentHash,id,kind'&&ref({id:r.id,version:1,contentHash:r.contentHash}))))throw new ApiError('DESIGN_CHANGE_SOURCE_INVALID');
  const input = { beforeRef: buffer.beforeRef, afterProposalRef: buffer.proposalId, reason: buffer.reason, sourceRefs: buffer.sourceRefs };
  if (buffer.pending) {
    const c = buffer.pending;
    if (Object.keys(c).sort().join(',') !== 'approvalRef,baselineRefs,clientId,commandId,controlGeneration,expectedVersion,operation,payload,projectId,schemaVersion,targetId' || c.schemaVersion !== 1 || !uuid(c.commandId) || c.projectId !== buffer.projectId || c.clientId !== buffer.ownerClientId || c.controlGeneration !== buffer.controlGeneration || c.operation !== 'proposeDesignChange' || c.targetId !== null || c.expectedVersion !== 0 || !same(c.baselineRefs, []) || c.approvalRef !== null || !same(c.payload, input)) throw new ApiError('DESIGN_CHANGE_PENDING_MISMATCH');
    return structuredClone(c);
  }
  return { schemaVersion: 1, projectId: buffer.projectId, commandId: crypto.randomUUID(), clientId: session.clientId, controlGeneration: buffer.controlGeneration, operation: 'proposeDesignChange', targetId: null, expectedVersion: 0, baselineRefs: [], approvalRef: null, payload: structuredClone(input) };
}
export async function sendDesignChangeRequest(client: ApiClient, buffer: ChangeRequestBuffer, session: DocumentSession): Promise<DesignChangePage> {
  if (!buffer.pending) throw new ApiError('DESIGN_CHANGE_PENDING_REQUIRED');
  const command = prepareDesignChangeRequest(buffer, session, true), receipt = await postDocumentCommand(client, command, session.csrfToken), data = receipt.data;
  if (data?.status !== 'DESIGN_CHANGE_PROPOSED' || data.activatedAsBaseline !== false || !ref(data.ref) || data.ref.version !== 1 || receipt.targetId !== data.ref.id || receipt.version !== 1 || !same(data.change?.ref, data.ref) || !same(data.change?.beforeRef, buffer.beforeRef) || data.change?.afterProposalRef !== buffer.proposalId || data.change?.reason !== buffer.reason || !same(data.change?.sourceRefs, buffer.sourceRefs) || data.change?.requestedBy?.kind !== 'HUMAN' || data.change?.requestedBy?.userId !== session.user.id || data.impact?.sourceKind !== 'MECHANICAL_TRACE' || data.impact?.ref?.version !== 1) throw new ApiError('RESPONSE_INVALID');
  return validateDesignChangePage({ change: data.change, impactVersions: [data.impact], latestImpactRef: data.impact.ref, hasMoreImpacts: false, nextBeforeVersion: null, activatedAsBaseline: false, observedAt: receipt.serverReceivedAt }, data.ref.id, null);
}
