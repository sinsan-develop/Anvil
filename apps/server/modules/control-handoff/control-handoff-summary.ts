import { canonicalJson, contentHash } from '../../../../contracts/canonical.ts';
import { arrayV1, hashV1, isoV1, recordV1, refV1, uuidV1 } from '../../../../contracts/runtime/validation-v1.ts';
import type { ControlRequestRecord } from './control-request-snapshot.ts';

export type HandoffCategory = 'activeExecutions' | 'pendingCommands' | 'pendingApprovals' | 'sourceCheckpointRefs';
export type HandoffCategoryStatus = 'SYNTHETIC_OBSERVED' | 'EMPTY_SYNTHETIC' | 'UNVERIFIED';
export interface HandoffEvidence { projectId: string; ref: { id: string; version: number; contentHash: string } }
export interface HandoffCollection { status: HandoffCategoryStatus; observedAt: string;
  reasonCode: string; refs: HandoffEvidence[] }
export interface HandoffBasis { actorId: string; clientId: string; generation: number; version: number }
export interface HandoffSummarySource {
  projectId: string; requestRef: ControlRequestRecord['requestRef']; version: number;
  controller: HandoffBasis; baseControl: HandoffBasis; observedAt: string;
  requestExpiresAt: string; collections: Record<HandoffCategory, unknown>;
}
export interface HandoffSummaryBody {
  projectId: string; requestRef: ControlRequestRecord['requestRef']; version: number;
  controller: HandoffBasis; baseControl: HandoffBasis; observedAt: string; validUntil: string;
  activeExecutions: HandoffCollection; pendingCommands: HandoffCollection;
  pendingApprovals: HandoffCollection; sourceCheckpointRefs: HandoffCollection;
  gaps: string[]; safetyState: 'WAITING' | 'UNVERIFIED'; sourceMode: 'SYNTHETIC_ONLY';
  realCollectorsConnected: false; acceptanceEnabled: false; executionAuthorized: false;
  controlTransferred: false;
}
export interface HandoffSummaryRecord { summaryRef: {id: string; version: number; contentHash: string};
  body: HandoffSummaryBody; metadata: Pick<HandoffSummaryBody,
    'projectId' | 'requestRef' | 'version' | 'controller' | 'baseControl' |
    'observedAt' | 'validUntil' | 'safetyState'> }

const categories: readonly HandoffCategory[] = ['activeExecutions', 'pendingCommands',
  'pendingApprovals', 'sourceCheckpointRefs'];
const bodyKeys = ['projectId', 'requestRef', 'version', 'controller', 'baseControl', 'observedAt',
  'validUntil', ...categories, 'gaps', 'safetyState', 'sourceMode', 'realCollectorsConnected',
  'acceptanceEnabled', 'executionAuthorized', 'controlTransferred'];
const metadataKeys = ['projectId', 'requestRef', 'version', 'controller', 'baseControl',
  'observedAt', 'validUntil', 'safetyState'];
const statusValues: readonly string[] = ['SYNTHETIC_OBSERVED', 'EMPTY_SYNTHETIC', 'UNVERIFIED'];
const reasonValues: readonly string[] = ['SYNTHETIC_REFS', 'SYNTHETIC_EMPTY', 'COLLECTOR_NOT_CONNECTED',
  'COLLECTOR_MISSING', 'COLLECTOR_ERROR', 'COLLECTION_LIMIT_EXCEEDED', 'COLLECTION_PARTIAL'];
const maxBytes = 2 * 1024 * 1024;
const positive = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0;

/** 원문·예외를 반환하지 않는 source 검증 오류다. */
export class HandoffSummaryFailure extends Error {
  readonly code: string;
  constructor(code: string) { super(code); this.name = 'HandoffSummaryFailure'; this.code = code; }
}
const fail = (): never => { throw new HandoffSummaryFailure('HANDOFF_SUMMARY_INVALID'); };
const same = (left: unknown, right: unknown): boolean => canonicalJson(left) === canonicalJson(right);
const clone = <T>(value: T): T => {
  try { return JSON.parse(canonicalJson(value)) as T; } catch { return fail(); }
};
const bytes = (value: unknown): number => {
  try { return Buffer.byteLength(canonicalJson(value), 'utf8'); } catch { return fail(); }
};
function basis(value: unknown): value is HandoffBasis {
  return recordV1(value, ['actorId', 'clientId', 'generation', 'version'])
    && uuidV1(value.actorId) && uuidV1(value.clientId)
    && positive(value.generation) && positive(value.version);
}
function gap(observedAt: string, reasonCode: string): HandoffCollection {
  return { status: 'UNVERIFIED', observedAt, reasonCode, refs: [] };
}
function collection(raw: unknown, projectId: string, observedAt: string): HandoffCollection {
  if (raw === undefined || raw === null) return gap(observedAt, 'COLLECTOR_MISSING');
  if (bytes(raw) > maxBytes) return gap(observedAt, 'COLLECTION_LIMIT_EXCEEDED');
  const value = clone(raw);
  if (!recordV1(value, ['status', 'observedAt', 'reasonCode', 'refs'])
    || !statusValues.includes(value.status) || !isoV1(value.observedAt)
    || Date.parse(value.observedAt) > Date.parse(observedAt)
    || !reasonValues.includes(value.reasonCode) || !Array.isArray(value.refs)) return fail();
  if (value.refs.length > 200) return gap(observedAt, 'COLLECTION_LIMIT_EXCEEDED');
  if (!arrayV1(value.refs, 200)) return fail();
  const refs: HandoffEvidence[] = [];
  for (const item of value.refs) {
    if (!recordV1(item, ['projectId', 'ref']) || item.projectId !== projectId
      || !refV1(item.ref)) return fail();
    refs.push({ projectId, ref: { id: item.ref.id, version: item.ref.version,
      contentHash: item.ref.contentHash } });
  }
  if ((value.status === 'EMPTY_SYNTHETIC' && (refs.length !== 0 || value.reasonCode !== 'SYNTHETIC_EMPTY'))
    || (value.status === 'SYNTHETIC_OBSERVED' && (refs.length === 0 || value.reasonCode !== 'SYNTHETIC_REFS'))
    || (value.status === 'UNVERIFIED' && !['COLLECTOR_NOT_CONNECTED', 'COLLECTOR_MISSING',
      'COLLECTOR_ERROR', 'COLLECTION_LIMIT_EXCEEDED', 'COLLECTION_PARTIAL'].includes(value.reasonCode))
    || (value.status === 'UNVERIFIED' && refs.length > 0 && value.reasonCode !== 'COLLECTION_PARTIAL'))
    return fail();
  return { status: value.status as HandoffCategoryStatus, observedAt: value.observedAt,
    reasonCode: value.reasonCode, refs };
}

function source(value: unknown): HandoffSummarySource {
  const input = clone(value);
  if (!recordV1(input, ['projectId', 'requestRef', 'version', 'controller', 'baseControl',
    'observedAt', 'requestExpiresAt', 'collections'])
    || !uuidV1(input.projectId) || !refV1(input.requestRef) || input.requestRef.version !== 1
    || !positive(input.version) || !basis(input.controller) || !basis(input.baseControl)
    || !same(input.controller, input.baseControl)
    || !isoV1(input.observedAt) || !isoV1(input.requestExpiresAt)
    || Date.parse(input.observedAt) >= Date.parse(input.requestExpiresAt)
    || !recordV1(input.collections, categories)) return fail();
  return input as HandoffSummarySource;
}
function metadata(body: HandoffSummaryBody): HandoffSummaryRecord['metadata'] {
  return { projectId: body.projectId, requestRef: clone(body.requestRef), version: body.version,
    controller: clone(body.controller), baseControl: clone(body.baseControl),
    observedAt: body.observedAt, validUntil: body.validUntil, safetyState: body.safetyState };
}

/** 합성 자료도 실제 안전 증거로 승격하지 않는다. 원문은 언제나 독립 복제한다. */
export function createControlHandoffSummary(value: unknown): HandoffSummaryRecord {
  const input = source(value);
  const parts = Object.fromEntries(categories.map(category => [category,
    collection(input.collections[category], input.projectId, input.observedAt)])) as Record<HandoffCategory, HandoffCollection>;
  const gaps = ['REAL_COLLECTOR_NOT_CONNECTED', 'TARGET_ELIGIBILITY_UNVERIFIED'];
  for (const category of categories) if (parts[category].status === 'UNVERIFIED')
    gaps.push(parts[category].reasonCode);
  const waiting = categories.slice(0, 3).some(category => parts[category].refs.length > 0);
  const validUntil = new Date(Math.min(Date.parse(input.observedAt) + 30_000,
    Date.parse(input.requestExpiresAt))).toISOString();
  const body: HandoffSummaryBody = {
    projectId: input.projectId, requestRef: clone(input.requestRef), version: input.version,
    controller: clone(input.controller), baseControl: clone(input.baseControl),
    observedAt: input.observedAt, validUntil,
    activeExecutions: parts.activeExecutions, pendingCommands: parts.pendingCommands,
    pendingApprovals: parts.pendingApprovals, sourceCheckpointRefs: parts.sourceCheckpointRefs,
    gaps, safetyState: waiting ? 'WAITING' : 'UNVERIFIED', sourceMode: 'SYNTHETIC_ONLY',
    realCollectorsConnected: false, acceptanceEnabled: false, executionAuthorized: false,
    controlTransferred: false
  };
  if (bytes(body) > maxBytes) return fail();
  return { summaryRef: { id: input.requestRef.id, version: input.version,
    contentHash: contentHash(canonicalJson(body)) }, body: clone(body), metadata: metadata(body) };
}

/** 저장된 본문·ref·중복 metadata와 불변 안전 경계를 함께 다시 계산한다. */
export function verifyControlHandoffSummary(value: unknown, expected: unknown): HandoffSummaryBody {
  const record = clone(value);
  if (!recordV1(record, ['summaryRef', 'body', 'metadata']) || !refV1(record.summaryRef)
    || !recordV1(record.body, bodyKeys) || !recordV1(record.metadata, metadataKeys)
    || !hashV1(record.summaryRef.contentHash)) return fail();
  const want = createControlHandoffSummary(expected);
  if (!same(record, want)) return fail();
  return clone(want.body);
}
