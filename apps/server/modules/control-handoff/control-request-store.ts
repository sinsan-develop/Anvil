import { canonicalJson, contentHash } from '../../../../contracts/canonical.ts';
import { isoV1, recordV1, refV1, uuidV1 } from '../../../../contracts/runtime/validation-v1.ts';
import { AuthFailure } from '../access/repository.ts';
import { checkControlRequestSelf, readControlRequestInput,
  type ControlRequestInput, type ControlRequestObservation } from './control-request-input.ts';
import { createControlRequestSnapshot, verifyControlRequestSnapshot,
  type ControlRequestRecord, type ControlRequestSnapshot, type ControlRequestSource } from './control-request-snapshot.ts';

export interface ControlRequestCommand {
  schemaVersion: 1; operation: 'requestControl'; commandId: string; projectId: string;
  clientId: string; payload: ControlRequestInput;
}
export interface ControlRequestStoreObservation {
  project: { id: string; archivedAt: string | null } | null;
  access: ControlRequestObservation;
}
export interface StoredControlRequestCommand {
  schemaVersion: 1; operation: 'requestControl'; commandId: string; commandHash: string;
  payloadHash: string; projectId: string; actorId: string; clientId: string;
  baseControl: ControlRequestInput['baseControl']; requestRef: ControlRequestRecord['requestRef']; createdAt: string;
}
export interface ControlRequestReceipt {
  schemaVersion: 1; commandId: string; commandHash: string; projectId: string;
  actorId: string; clientId: string; requestRef: ControlRequestRecord['requestRef'];
  outcome: 'REQUEST_STORED';
}
export interface ControlRequestAudit {
  schemaVersion: 1; commandId: string; commandHash: string; projectId: string;
  actorId: string; clientId: string; requestRef: ControlRequestRecord['requestRef'];
  event: 'CONTROL_REQUEST_STORED';
}
export interface ControlRequestBundle {
  request: ControlRequestRecord | null; command: StoredControlRequestCommand | null;
  receipts: ControlRequestReceipt[]; audits: ControlRequestAudit[];
}
export interface ControlRequestTransaction {
  observe(): Promise<ControlRequestStoreObservation>;
  lockCommand(commandId: string): Promise<StoredControlRequestCommand | null>;
  allocateRequestId(): Promise<string>;
  insertRequest(record: ControlRequestRecord): Promise<void>;
  insertCommand(command: StoredControlRequestCommand): Promise<void>;
  insertReceipt(receipt: ControlRequestReceipt): Promise<void>;
  insertAudit(audit: ControlRequestAudit): Promise<void>;
  readBundle(commandId: string): Promise<ControlRequestBundle>;
}
export interface ControlRequestStorePort {
  readonly sourceMode: 'NOT_CONNECTED' | 'TEST_FAKE' | 'POSTGRES_SOURCE';
  transaction<T>(work: (tx: ControlRequestTransaction) => Promise<T>): Promise<T>;
}
export interface ControlRequestStoreResult {
  requestRef: ControlRequestRecord['requestRef']; snapshot: ControlRequestSnapshot; receipt: ControlRequestReceipt;
}

/** 원문·사유를 예외에 싣지 않는다. 확정 결과 불명도 자동 재시도하지 않는다. */
export class ControlRequestStoreFailure extends Error {
  readonly code: string;
  readonly commandId: string | null;
  constructor(code: string, commandId: string | null) {
    super(code); this.name = 'ControlRequestStoreFailure'; this.code = code; this.commandId = commandId;
  }
}

const fail = (code: string, commandId: string | null): never => { throw new ControlRequestStoreFailure(code, commandId); };
const clone = <T>(value: T, commandId: string | null): T => {
  try { return JSON.parse(canonicalJson(value)) as T; }
  catch { return fail('CONTROL_REQUEST_STORE_INVALID', commandId); }
};
const same = (left: unknown, right: unknown): boolean => canonicalJson(left) === canonicalJson(right);
const unit1Codes = new Set(['CONTROL_REQUEST_INPUT_INVALID', 'CONTROL_REQUEST_ACCESS_DENIED',
  'CONTROL_REQUEST_SNAPSHOT_INVALID']);
function fromUnit1<T>(commandId: string, action: () => T): T {
  try { return action(); }
  catch (error) {
    if (error instanceof AuthFailure && unit1Codes.has(error.message))
      return fail(error.message, commandId);
    throw error;
  }
}

function readCommand(value: unknown): ControlRequestCommand {
  const command = clone(value, null);
  if (!recordV1(command, ['schemaVersion', 'operation', 'commandId', 'projectId', 'clientId', 'payload'])
    || command.schemaVersion !== 1 || command.operation !== 'requestControl'
    || !uuidV1(command.commandId) || !uuidV1(command.projectId) || !uuidV1(command.clientId))
    return fail('CONTROL_REQUEST_COMMAND_INVALID', null);
  return command as ControlRequestCommand;
}

function currentInput(command: ControlRequestCommand, observation: unknown): { input: ControlRequestInput; facts: ControlRequestObservation } {
  const seen = clone(observation, command.commandId);
  if (!recordV1(seen, ['project', 'access']) || !recordV1(seen.project, ['id', 'archivedAt'])
    || seen.project.id !== command.projectId || seen.project.archivedAt !== null
    || !recordV1(seen.access, ['projectId', 'now', 'identity', 'member', 'control'])
    || seen.access.projectId !== command.projectId || seen.access.identity?.clientId !== command.clientId)
    return fail('CONTROL_REQUEST_ACCESS_DENIED', command.commandId);
  const facts = seen.access as ControlRequestObservation;
  const input = fromUnit1(command.commandId, () => readControlRequestInput(command.payload, facts.now));
  return { input: fromUnit1(command.commandId, () => checkControlRequestSelf(input, facts)), facts };
}

function requestMetadata(snapshot: ControlRequestSnapshot): ControlRequestRecord['metadata'] {
  return {
    id: snapshot.id, version: snapshot.version, projectId: snapshot.projectId,
    requestedBy: snapshot.requestedBy, targetActorRef: snapshot.targetActorRef,
    targetClientRef: snapshot.targetClientRef, baseControl: snapshot.baseControl,
    reason: snapshot.reason, createdAt: snapshot.createdAt, expiresAt: snapshot.expiresAt
  };
}

function storedCommand(command: ControlRequestCommand, input: ControlRequestInput,
  actorId: string, requestRef: ControlRequestRecord['requestRef'], createdAt: string): StoredControlRequestCommand {
  return {
    schemaVersion: 1, operation: 'requestControl', commandId: command.commandId,
    commandHash: contentHash(canonicalJson(command)), payloadHash: contentHash(canonicalJson(input)),
    projectId: command.projectId, actorId, clientId: command.clientId,
    baseControl: clone(input.baseControl, command.commandId), requestRef: clone(requestRef, command.commandId), createdAt
  };
}

function expectedReceipt(row: StoredControlRequestCommand): ControlRequestReceipt {
  return { schemaVersion: 1, commandId: row.commandId, commandHash: row.commandHash,
    projectId: row.projectId, actorId: row.actorId, clientId: row.clientId,
    requestRef: clone(row.requestRef, row.commandId), outcome: 'REQUEST_STORED' };
}
function expectedAudit(row: StoredControlRequestCommand): ControlRequestAudit {
  return { schemaVersion: 1, commandId: row.commandId, commandHash: row.commandHash,
    projectId: row.projectId, actorId: row.actorId, clientId: row.clientId,
    requestRef: clone(row.requestRef, row.commandId), event: 'CONTROL_REQUEST_STORED' };
}

/** transaction 내부의 4종 원문과 양방향 참조만 검증한다. 실제 DB 제약의 증거는 아니다. */
export function verifyBundle(value: unknown, command: ControlRequestCommand, input: ControlRequestInput,
  actorId: string, requestRef: ControlRequestRecord['requestRef'], createdAt: string): ControlRequestStoreResult {
  const bundle = clone(value, command.commandId);
  if (!recordV1(bundle, ['request', 'command', 'receipts', 'audits'])
    || !Array.isArray(bundle.receipts) || bundle.receipts.length !== 1
    || !Array.isArray(bundle.audits) || bundle.audits.length !== 1
    || !bundle.request || !bundle.command) return fail('CONTROL_REQUEST_BUNDLE_INVALID', command.commandId);
  const expectedRow = storedCommand(command, input, actorId, requestRef, createdAt);
  if (!same(bundle.command, expectedRow)
    || !same(bundle.receipts[0], expectedReceipt(expectedRow))
    || !same(bundle.audits[0], expectedAudit(expectedRow)))
    return fail('CONTROL_REQUEST_BUNDLE_INVALID', command.commandId);
  const basis: ControlRequestSource = {
    id: requestRef.id, projectId: command.projectId,
    requestedBy: { actorId, clientId: command.clientId }, input, createdAt
  };
  const snapshot = fromUnit1(command.commandId, () => verifyControlRequestSnapshot(bundle.request, basis));
  if (!same(bundle.request.requestRef, requestRef)) return fail('CONTROL_REQUEST_BUNDLE_INVALID', command.commandId);
  return { requestRef: clone(requestRef, command.commandId), snapshot,
    receipt: clone(bundle.receipts[0], command.commandId) as ControlRequestReceipt };
}

/** 기본값은 명시적 미연결이다. 이 모듈은 실제 adapter·제어 전환을 제공하지 않는다. */
export const defaultControlRequestStorePort: ControlRequestStorePort = {
  sourceMode: 'NOT_CONNECTED',
  async transaction<T>(): Promise<T> { return fail('CONTROL_REQUEST_NOT_CONNECTED', null); }
};

/** 현재 사실의 생산자는 port다. 같은 port의 transaction·잠금·rollback은 port 구현의 책임이다. */
export async function requestControl(value: unknown,
  port: ControlRequestStorePort = defaultControlRequestStorePort): Promise<ControlRequestStoreResult> {
  const command = readCommand(value);
  if (port?.sourceMode !== 'TEST_FAKE' && port?.sourceMode !== 'POSTGRES_SOURCE')
    return fail('CONTROL_REQUEST_NOT_CONNECTED', command.commandId);
  try {
    return await port.transaction(async tx => {
      const first = currentInput(command, await tx.observe());
      const existing = await tx.lockCommand(command.commandId);
      let requestRef: ControlRequestRecord['requestRef'];
      let createdAt: string;
      if (existing !== null) {
        const prior = clone(existing, command.commandId);
        if (!recordV1(prior, ['schemaVersion', 'operation', 'commandId', 'commandHash', 'payloadHash',
          'projectId', 'actorId', 'clientId', 'baseControl', 'requestRef', 'createdAt'])
          || !refV1(prior.requestRef) || !isoV1(prior.createdAt))
          return fail('CONTROL_REQUEST_COMMAND_CONFLICT', command.commandId);
        requestRef = prior.requestRef;
        createdAt = prior.createdAt;
        if (!same(prior, storedCommand(command, first.input, first.facts.identity.actorId, requestRef, createdAt)))
          return fail('CONTROL_REQUEST_COMMAND_CONFLICT', command.commandId);
      } else {
        const id = await tx.allocateRequestId();
        if (!uuidV1(id)) return fail('CONTROL_REQUEST_STORE_INVALID', command.commandId);
        createdAt = first.facts.now;
        const basis: ControlRequestSource = {
          id, projectId: command.projectId,
          requestedBy: { actorId: first.facts.identity.actorId, clientId: command.clientId },
          input: first.input, createdAt
        };
        const made = fromUnit1(command.commandId, () => createControlRequestSnapshot(basis));
        requestRef = made.requestRef;
        const record: ControlRequestRecord = { ...made, metadata: requestMetadata(made.snapshot) };
        const row = storedCommand(command, first.input, first.facts.identity.actorId, requestRef, createdAt);
        await tx.insertRequest(record);
        await tx.insertCommand(row);
        await tx.insertReceipt(expectedReceipt(row));
        await tx.insertAudit(expectedAudit(row));
      }
      const bundle = await tx.readBundle(command.commandId);
      const last = currentInput(command, await tx.observe());
      if (!same(last.input, first.input)) return fail('CONTROL_REQUEST_ACCESS_DENIED', command.commandId);
      return verifyBundle(bundle, command, last.input, last.facts.identity.actorId, requestRef, createdAt);
    });
  } catch (error) {
    if (error instanceof ControlRequestStoreFailure) throw error;
    if (port.sourceMode === 'POSTGRES_SOURCE' && error instanceof AuthFailure
      && error.message === 'CONTROL_REQUEST_NOT_CONNECTED' && error.statusCode === 503)
      return fail('CONTROL_REQUEST_NOT_CONNECTED', command.commandId);
    if (port.sourceMode === 'POSTGRES_SOURCE' && error instanceof AuthFailure
      && ((error.message === 'AUTH_REQUIRED' && error.statusCode === 401)
        || (error.message === 'CSRF_INVALID' && error.statusCode === 403))) throw error;
    // 인증·저장 구현의 원 예외와 요청 이유를 전달하거나 기록하지 않는다.
    throw new ControlRequestStoreFailure('CONTROL_REQUEST_STORE_FAILED', command.commandId);
  }
}
