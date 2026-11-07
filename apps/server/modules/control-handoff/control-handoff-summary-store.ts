import { canonicalJson, contentHash } from '../../../../contracts/canonical.ts';
import { isoV1, recordV1, refV1, uuidV1 } from '../../../../contracts/runtime/validation-v1.ts';
import { AuthFailure } from '../access/repository.ts';
import { canController, checkStable, currentAccess, verifiedBundle } from './control-request-read.ts';
import type { ControlRequestStoreObservation, ControlRequestBundle } from './control-request-store.ts';
import type { ControlRequestRecord, ControlRequestSnapshot } from './control-request-snapshot.ts';
import { createControlHandoffSummary, verifyControlHandoffSummary,
  type HandoffBasis, type HandoffCategory, type HandoffSummaryBody,
  type HandoffSummaryRecord, type HandoffSummarySource } from './control-handoff-summary.ts';

type RequestRef = ControlRequestRecord['requestRef'];
type SummaryRef = HandoffSummaryRecord['summaryRef'];
export interface PrepareControlHandoffCommand { schemaVersion: 1; operation: 'prepareControlHandoff';
  commandId: string; projectId: string; clientId: string; payload: { requestRef: RequestRef } }
export interface StoredHandoffCommand { schemaVersion: 1; operation: 'prepareControlHandoff';
  commandId: string; commandHash: string; payloadHash: string; projectId: string;
  actorId: string; clientId: string; requestRef: RequestRef; summaryRef: SummaryRef;
  baseControl: HandoffBasis; createdAt: string }
export interface HandoffReceipt { schemaVersion: 1; commandId: string; commandHash: string;
  projectId: string; actorId: string; clientId: string; requestRef: RequestRef;
  summaryRef: SummaryRef; outcome: 'SUMMARY_STORED' }
export interface HandoffAudit { schemaVersion: 1; commandId: string; commandHash: string;
  projectId: string; actorId: string; clientId: string; requestRef: RequestRef;
  summaryRef: SummaryRef; event: 'CONTROL_HANDOFF_SUMMARY_STORED' }
export interface HandoffSummaryBundle { summary: HandoffSummaryRecord | null;
  command: StoredHandoffCommand | null; receipts: HandoffReceipt[]; audits: HandoffAudit[] }
export interface HandoffSummaryTransaction {
  observe(): Promise<ControlRequestStoreObservation>;
  readRequestBundleByRef(ref: RequestRef): Promise<ControlRequestBundle | null>;
  lockCommand(commandId: string): Promise<StoredHandoffCommand | null>;
  lockRequestVersion(requestRef: RequestRef): Promise<number>;
  collect(category: HandoffCategory): Promise<unknown>;
  insertSummary(record: HandoffSummaryRecord): Promise<void>;
  insertCommand(command: StoredHandoffCommand): Promise<void>;
  insertReceipt(receipt: HandoffReceipt): Promise<void>;
  insertAudit(audit: HandoffAudit): Promise<void>;
  readSummaryBundle(commandId: string): Promise<HandoffSummaryBundle>;
  readSummaryBundleByRef(summaryRef: SummaryRef): Promise<HandoffSummaryBundle>;
}
export interface HandoffSummaryPort { readonly sourceMode: 'NOT_CONNECTED' | 'TEST_FAKE' | 'POSTGRES_SOURCE';
  transaction<T>(work: (tx: HandoffSummaryTransaction) => Promise<T>): Promise<T> }
export interface HandoffSummaryResult { summaryRef: SummaryRef; body: HandoffSummaryBody; receipt: HandoffReceipt }
export interface HandoffSummaryReadResult { projectId: string; requestRef: RequestRef;
  summaryRef: SummaryRef; body: HandoffSummaryBody; observedAt: string;
  current: { expired: boolean; baseControlState: 'MATCHED' | 'CHANGED' | 'UNVERIFIED' };
  executionAuthorized: false; controlTransferred: false }

/** 명령 식별자만 보존하고 원 예외·명령 본문은 노출하지 않는다. */
export class HandoffSummaryStoreFailure extends Error {
  readonly code: string;
  readonly commandId: string | null;
  constructor(code: string, commandId: string | null) {
    super(code); this.name = 'HandoffSummaryStoreFailure'; this.code = code;
    this.commandId = commandId;
  }
}
const fail = (code: string, commandId: string | null): never => {
  throw new HandoffSummaryStoreFailure(code, commandId);
};
const copy = <T>(value: T, commandId: string | null): T => {
  try { return JSON.parse(canonicalJson(value)) as T; }
  catch { return fail('HANDOFF_SUMMARY_INVALID', commandId); }
};
const same = (a: unknown, b: unknown): boolean => canonicalJson(a) === canonicalJson(b);
const positive = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0;
const categories: readonly HandoffCategory[] = ['activeExecutions', 'pendingCommands',
  'pendingApprovals', 'sourceCheckpointRefs'];

function commandInput(value: unknown): PrepareControlHandoffCommand {
  const input = copy(value, null);
  if (!recordV1(input, ['schemaVersion', 'operation', 'commandId', 'projectId', 'clientId', 'payload'])
    || input.schemaVersion !== 1 || input.operation !== 'prepareControlHandoff'
    || !uuidV1(input.commandId) || !uuidV1(input.projectId) || !uuidV1(input.clientId)
    || !recordV1(input.payload, ['requestRef']) || !refV1(input.payload.requestRef)
    || input.payload.requestRef.version !== 1) return fail('HANDOFF_COMMAND_INVALID', null);
  return input as PrepareControlHandoffCommand;
}
type Access = ReturnType<typeof currentAccess>;
function controllerAccess(observation: unknown, command: PrepareControlHandoffCommand,
  snapshot: ControlRequestSnapshot): Access {
  const access = currentAccess(observation, command.projectId);
  if (!canController(access) || access.identity.clientId !== command.clientId
    || access.basis === null || !same(access.basis, snapshot.baseControl)
    || !isoV1(access.identity.reauthUntil)
    || Date.parse(access.identity.reauthUntil) <= Date.parse(access.observedAt)
    || snapshot.storedState !== 'PENDING'
    || Date.parse(snapshot.expiresAt) <= Date.parse(access.observedAt))
    return fail('HANDOFF_ACCESS_DENIED', command.commandId);
  return access;
}
function requestFrom(value: unknown, command: PrepareControlHandoffCommand):
  { requestRef: RequestRef; snapshot: ControlRequestSnapshot } {
  const request = verifiedBundle(value, command.payload.requestRef, command.projectId);
  if (!same(request.requestRef, command.payload.requestRef))
    return fail('HANDOFF_REQUEST_INVALID', command.commandId);
  return request;
}
async function current(tx: HandoffSummaryTransaction, command: PrepareControlHandoffCommand):
  Promise<{access: Access; request: {requestRef: RequestRef; snapshot: ControlRequestSnapshot}}> {
  const observation = await tx.observe();
  const request = requestFrom(await tx.readRequestBundleByRef(command.payload.requestRef), command);
  return { access: controllerAccess(observation, command, request.snapshot), request };
}
function rowFor(command: PrepareControlHandoffCommand, actorId: string, basis: HandoffBasis,
  summaryRef: SummaryRef, createdAt: string): StoredHandoffCommand {
  return { schemaVersion: 1, operation: 'prepareControlHandoff', commandId: command.commandId,
    commandHash: contentHash(canonicalJson(command)),
    payloadHash: contentHash(canonicalJson(command.payload)), projectId: command.projectId,
    actorId, clientId: command.clientId, requestRef: copy(command.payload.requestRef, command.commandId),
    summaryRef: copy(summaryRef, command.commandId), baseControl: copy(basis, command.commandId), createdAt };
}
function receiptFor(row: StoredHandoffCommand): HandoffReceipt {
  return { schemaVersion: 1, commandId: row.commandId, commandHash: row.commandHash,
    projectId: row.projectId, actorId: row.actorId, clientId: row.clientId,
    requestRef: copy(row.requestRef, row.commandId), summaryRef: copy(row.summaryRef, row.commandId),
    outcome: 'SUMMARY_STORED' };
}
function auditFor(row: StoredHandoffCommand): HandoffAudit {
  return { schemaVersion: 1, commandId: row.commandId, commandHash: row.commandHash,
    projectId: row.projectId, actorId: row.actorId, clientId: row.clientId,
    requestRef: copy(row.requestRef, row.commandId), summaryRef: copy(row.summaryRef, row.commandId),
    event: 'CONTROL_HANDOFF_SUMMARY_STORED' };
}
function checkedRow(value: unknown, commandId: string | null): StoredHandoffCommand {
  const row = copy(value, commandId);
  if (!recordV1(row, ['schemaVersion', 'operation', 'commandId', 'commandHash', 'payloadHash',
    'projectId', 'actorId', 'clientId', 'requestRef', 'summaryRef', 'baseControl', 'createdAt'])
    || row.schemaVersion !== 1 || row.operation !== 'prepareControlHandoff'
    || !uuidV1(row.commandId) || !uuidV1(row.projectId) || !uuidV1(row.actorId)
    || !uuidV1(row.clientId) || !refV1(row.requestRef) || row.requestRef.version !== 1
    || !refV1(row.summaryRef) || row.summaryRef.id !== row.requestRef.id
    || !recordV1(row.baseControl, ['actorId', 'clientId', 'generation', 'version'])
    || !uuidV1(row.baseControl.actorId) || !uuidV1(row.baseControl.clientId)
    || !positive(row.baseControl.generation) || !positive(row.baseControl.version)
    || row.actorId !== row.baseControl.actorId || row.clientId !== row.baseControl.clientId
    || !isoV1(row.createdAt)) return fail('HANDOFF_BUNDLE_INVALID', commandId);
  return row as StoredHandoffCommand;
}
function sourceFor(record: HandoffSummaryRecord, row: StoredHandoffCommand,
  request: ControlRequestSnapshot): HandoffSummarySource {
  const body = record.body;
  if (!recordV1(body, ['projectId', 'requestRef', 'version', 'controller', 'baseControl',
    'observedAt', 'validUntil', ...categories, 'gaps', 'safetyState', 'sourceMode',
    'realCollectorsConnected', 'acceptanceEnabled', 'executionAuthorized', 'controlTransferred']))
    return fail('HANDOFF_BUNDLE_INVALID', row.commandId);
  return { projectId: row.projectId, requestRef: row.requestRef, version: row.summaryRef.version,
    controller: row.baseControl, baseControl: request.baseControl,
    observedAt: row.createdAt, requestExpiresAt: request.expiresAt,
    collections: { activeExecutions: body.activeExecutions, pendingCommands: body.pendingCommands,
      pendingApprovals: body.pendingApprovals, sourceCheckpointRefs: body.sourceCheckpointRefs } };
}

/** 네 종류 원문, 명령 ID 자체, ref와 요약 본문을 양방향으로 재검사한다. */
function verifiedSummaryBundle(value: unknown, request: ControlRequestSnapshot,
  expectedCommand: PrepareControlHandoffCommand, expectedRef: SummaryRef | null): HandoffSummaryResult {
  const bundle = copy(value, expectedCommand.commandId);
  if (!recordV1(bundle, ['summary', 'command', 'receipts', 'audits'])
    || !Array.isArray(bundle.receipts) || bundle.receipts.length !== 1
    || !Array.isArray(bundle.audits) || bundle.audits.length !== 1
    || !bundle.summary || !bundle.command) return fail('HANDOFF_BUNDLE_INVALID', expectedCommand.commandId);
  const row = checkedRow(bundle.command, expectedCommand.commandId);
  const want = rowFor(expectedCommand, row.actorId, request.baseControl, row.summaryRef, row.createdAt);
  if (!same(row, want) || !same(bundle.receipts[0], receiptFor(want))
    || !same(bundle.audits[0], auditFor(want))
    || (expectedRef !== null && !same(row.summaryRef, expectedRef)))
    return fail('HANDOFF_BUNDLE_INVALID', expectedCommand.commandId);
  const record = copy(bundle.summary, expectedCommand.commandId) as HandoffSummaryRecord;
  let body: HandoffSummaryBody;
  try { body = verifyControlHandoffSummary(record, sourceFor(record, row, request)); }
  catch { return fail('HANDOFF_BUNDLE_INVALID', expectedCommand.commandId); }
  if (!same(record.summaryRef, row.summaryRef)) return fail('HANDOFF_BUNDLE_INVALID', expectedCommand.commandId);
  return { summaryRef: copy(row.summaryRef, row.commandId), body,
    receipt: copy(bundle.receipts[0], row.commandId) as HandoffReceipt };
}

/** 실제 연결·수집자·제어 갱신은 이 포트에 포함하지 않는다. */
export const defaultHandoffSummaryPort: HandoffSummaryPort = {
  sourceMode: 'NOT_CONNECTED',
  async transaction<T>(): Promise<T> { return fail('HANDOFF_NOT_CONNECTED', null); }
};

/** 같은 transaction의 잠금·롤백은 TEST_FAKE 구현의 책임이다. */
export async function prepareControlHandoff(value: unknown,
  port: HandoffSummaryPort = defaultHandoffSummaryPort): Promise<HandoffSummaryResult> {
  const command = commandInput(value);
  if (port?.sourceMode !== 'TEST_FAKE' && port?.sourceMode !== 'POSTGRES_SOURCE')
    return fail('HANDOFF_NOT_CONNECTED', command.commandId);
  try {
    return await port.transaction(async tx => {
      const first = await current(tx, command);
      const existing = await tx.lockCommand(command.commandId);
      if (existing !== null) {
        const old = checkedRow(existing, command.commandId);
        if (!same(old, rowFor(command, first.access.identity.actorId,
          first.request.snapshot.baseControl, old.summaryRef, old.createdAt)))
          return fail('HANDOFF_COMMAND_CONFLICT', command.commandId);
        const result = verifiedSummaryBundle(await tx.readSummaryBundle(command.commandId),
          first.request.snapshot, command, old.summaryRef);
        const last = await current(tx, command);
        checkStable(first.access, last.access, 'CONTROLLER');
        if (!same(first.request, last.request)) return fail('HANDOFF_REQUEST_INVALID', command.commandId);
        return result;
      }
      const previous = await tx.lockRequestVersion(command.payload.requestRef);
      if (!Number.isSafeInteger(previous) || previous < 0 || previous >= Number.MAX_SAFE_INTEGER)
        return fail('HANDOFF_VERSION_INVALID', command.commandId);
      const collected = {} as Record<HandoffCategory, unknown>;
      for (const category of categories) {
        try {
          const raw = await tx.collect(category);
          collected[category] = raw === undefined ? null : raw;
        } catch {
          collected[category] = { status: 'UNVERIFIED', observedAt: first.access.observedAt,
            reasonCode: 'COLLECTOR_ERROR', refs: [] };
        }
      }
      const last = await current(tx, command);
      checkStable(first.access, last.access, 'CONTROLLER');
      if (!same(first.request, last.request)) return fail('HANDOFF_REQUEST_INVALID', command.commandId);
      const source: HandoffSummarySource = {
        projectId: command.projectId, requestRef: copy(command.payload.requestRef, command.commandId),
        version: previous + 1, controller: last.access.basis as HandoffBasis,
        baseControl: copy(last.request.snapshot.baseControl, command.commandId),
        observedAt: last.access.observedAt, requestExpiresAt: last.request.snapshot.expiresAt,
        collections: collected
      };
      const summary = createControlHandoffSummary(source);
      const row = rowFor(command, last.access.identity.actorId, last.request.snapshot.baseControl,
        summary.summaryRef, summary.body.observedAt);
      await tx.insertSummary(summary);
      await tx.insertCommand(row);
      await tx.insertReceipt(receiptFor(row));
      await tx.insertAudit(auditFor(row));
      return verifiedSummaryBundle(await tx.readSummaryBundle(command.commandId),
        last.request.snapshot, command, summary.summaryRef);
    });
  } catch (error) {
    if (error instanceof HandoffSummaryStoreFailure) throw error;
    if (port.sourceMode === 'POSTGRES_SOURCE' && error instanceof AuthFailure
      && error.message === 'CONTROL_REQUEST_NOT_CONNECTED' && error.statusCode === 503)
      return fail('HANDOFF_NOT_CONNECTED', command.commandId);
    if (port.sourceMode === 'POSTGRES_SOURCE' && error instanceof AuthFailure
      && ((error.message === 'AUTH_REQUIRED' && error.statusCode === 401)
        || (error.message === 'CSRF_INVALID' && error.statusCode === 403))) throw error;
    throw new HandoffSummaryStoreFailure('HANDOFF_STORE_FAILED', command.commandId);
  }
}

function readInput(value: unknown): { projectId: string; requestRef: RequestRef; summaryRef: SummaryRef } {
  const input = copy(value, null);
  if (!recordV1(input, ['projectId', 'requestRef', 'summaryRef']) || !uuidV1(input.projectId)
    || !refV1(input.requestRef) || input.requestRef.version !== 1
    || !refV1(input.summaryRef) || input.summaryRef.id !== input.requestRef.id)
    return fail('HANDOFF_READ_INVALID', null);
  return input as {projectId: string; requestRef: RequestRef; summaryRef: SummaryRef};
}
/** 과거 만료/기준 변화는 원문 상태와 분리하여 표시한다. */
export async function readControlHandoffSummary(value: unknown,
  port: HandoffSummaryPort = defaultHandoffSummaryPort): Promise<HandoffSummaryReadResult> {
  const input = readInput(value);
  if (port?.sourceMode !== 'TEST_FAKE' && port?.sourceMode !== 'POSTGRES_SOURCE')
    return fail('HANDOFF_NOT_CONNECTED', null);
  try {
    return await port.transaction(async tx => {
      const before = currentAccess(await tx.observe(), input.projectId);
      const request = verifiedBundle(await tx.readRequestBundleByRef(input.requestRef),
        input.requestRef, input.projectId);
      const view = request.snapshot.requestedBy.actorId === before.identity.actorId ? 'OWN' : 'CONTROLLER';
      if (view === 'CONTROLLER' && !canController(before)) return fail('HANDOFF_READ_DENIED', null);
      const stored = await tx.readSummaryBundleByRef(input.summaryRef);
      const row = checkedRow(stored.command, null);
      const command = commandInput({ schemaVersion: 1, operation: 'prepareControlHandoff',
        commandId: row.commandId, projectId: row.projectId, clientId: row.clientId,
        payload: { requestRef: row.requestRef } });
      const result = verifiedSummaryBundle(stored, request.snapshot, command, input.summaryRef);
      if (!same(row.requestRef, input.requestRef) || row.projectId !== input.projectId
        || Date.parse(result.body.observedAt) > Date.parse(before.observedAt))
        return fail('HANDOFF_READ_INVALID', null);
      const again = verifiedBundle(await tx.readRequestBundleByRef(input.requestRef),
        input.requestRef, input.projectId);
      if (!same(again, request)) return fail('HANDOFF_READ_INVALID', null);
      const after = currentAccess(await tx.observe(), input.projectId);
      checkStable(before, after, view);
      if (view === 'OWN' && request.snapshot.requestedBy.actorId !== after.identity.actorId)
        return fail('HANDOFF_READ_DENIED', null);
      const currentState = { expired: Date.parse(request.snapshot.expiresAt) <= Date.parse(after.observedAt),
        baseControlState: after.basis === null ? 'UNVERIFIED' as const
          : same(after.basis, request.snapshot.baseControl) ? 'MATCHED' as const : 'CHANGED' as const };
      return { projectId: input.projectId, requestRef: copy(input.requestRef, null),
        summaryRef: result.summaryRef, body: result.body, observedAt: after.observedAt,
        current: currentState, executionAuthorized: false, controlTransferred: false };
    });
  } catch (error) {
    if (error instanceof HandoffSummaryStoreFailure) throw error;
    if (port.sourceMode === 'POSTGRES_SOURCE' && error instanceof AuthFailure
      && error.message === 'CONTROL_REQUEST_NOT_CONNECTED' && error.statusCode === 503)
      return fail('HANDOFF_NOT_CONNECTED', null);
    if (port.sourceMode === 'POSTGRES_SOURCE' && error instanceof AuthFailure
      && ((error.message === 'AUTH_REQUIRED' && error.statusCode === 401)
        || (error.message === 'CSRF_INVALID' && error.statusCode === 403))) throw error;
    throw new HandoffSummaryStoreFailure('HANDOFF_READ_FAILED', null);
  }
}

/** 내부 역사 수집의 원 bundle 검산만 수행한다. 현재 권한·실행 허가는 발급하지 않는다. */
export function verifyStoredControlHandoffHistoryBundle(value:unknown,request:ControlRequestSnapshot,expectedRef:SummaryRef):HandoffSummaryResult {
 const bundle=copy(value,null);if(!recordV1(bundle,['summary','command','receipts','audits']))return fail('HANDOFF_BUNDLE_INVALID',null);
 const row=checkedRow(bundle.command,null),command=commandInput({schemaVersion:1,operation:'prepareControlHandoff',commandId:row.commandId,projectId:row.projectId,clientId:row.clientId,payload:{requestRef:row.requestRef}});
 return verifiedSummaryBundle(bundle,request,command,expectedRef);
}
