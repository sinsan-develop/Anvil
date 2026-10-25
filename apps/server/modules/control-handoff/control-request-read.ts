import { canonicalJson } from '../../../../contracts/canonical.ts';
import { AuthFailure } from '../access/repository.ts';
import { arrayV1, isoV1, recordV1, refV1, uuidV1 } from '../../../../contracts/runtime/validation-v1.ts';
import { readControlRequestInput, type ControlRequestInput,
  type ControlRequestObservation } from './control-request-input.ts';
import { type ControlRequestRecord, type ControlRequestSnapshot } from './control-request-snapshot.ts';
import { verifyBundle, type ControlRequestBundle, type ControlRequestCommand,
  type ControlRequestStoreObservation } from './control-request-store.ts';
import { openControlRequestCursor, sealControlRequestCursor,
  type ControlRequestCursorBasis, type ControlRequestCursorLast,
  type ControlRequestCursorSigner } from './control-request-cursor.ts';

type RequestRef = ControlRequestRecord['requestRef'];
type View = 'OWN' | 'CONTROLLER';
type BasisState = 'MATCHED' | 'CHANGED' | 'UNVERIFIED';
interface ReadInput { projectId: string; requestRef: RequestRef }
interface ListInput { projectId: string; view: View; limit?: number; cursor?: string }
interface ReadRow { requestRef: RequestRef; createdAt: string; projectId: string;
  requestedBy: { actorId: string; clientId: string } }
interface ListQuery { projectId: string; actorId: string; clientId: string; view: View;
  controllerBasis: ControlRequestCursorBasis | null; limit: number; after: ControlRequestCursorLast | null }
export interface ControlRequestReadTransaction {
  observe(): Promise<ControlRequestStoreObservation>;
  readBundleByRef(ref: RequestRef): Promise<ControlRequestBundle | null>;
  listRows(query: ListQuery): Promise<ReadRow[]>;
}
export interface ControlRequestReadPort {
  readonly sourceMode: 'NOT_CONNECTED' | 'TEST_FAKE' | 'POSTGRES_SOURCE';
  readonly signer?: ControlRequestCursorSigner;
  transaction<T>(work: (tx: ControlRequestReadTransaction) => Promise<T>): Promise<T>;
}
export interface ControlRequestCurrentState { expired: boolean; baseControlState: BasisState }
export interface ControlRequestReadResult {
  projectId: string; requestRef: RequestRef; snapshot: ControlRequestSnapshot;
  observedAt: string; current: ControlRequestCurrentState;
  executionAuthorized: false; controlTransferred: false;
}
export interface ControlRequestListItem {
  requestRef: RequestRef; createdAt: string; expiresAt: string; storedState: 'PENDING';
  current: ControlRequestCurrentState; executionAuthorized: false; controlTransferred: false;
}
export interface ControlRequestListResult {
  projectId: string; view: View; limit: number; observedAt: string;
  items: ControlRequestListItem[]; hasMore: boolean; nextCursor: string | null;
  executionAuthorized: false; controlTransferred: false;
}

/** 내부 조회 실패는 원문·요청 이유·session 정보를 오류에 싣지 않는다. */
export class ControlRequestReadFailure extends Error {
  readonly code: string;
  constructor(code: string) { super(code); this.name = 'ControlRequestReadFailure'; this.code = code; }
}
const fail = (code: string): never => { throw new ControlRequestReadFailure(code); };
const positive = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0;
const same = (a: unknown, b: unknown): boolean => canonicalJson(a) === canonicalJson(b);
const copy = <T>(value: T): T => {
  try { return JSON.parse(canonicalJson(value)) as T; }
  catch { return fail('CONTROL_REQUEST_READ_INVALID'); }
};

function readInput(value: unknown): ReadInput {
  const input = copy(value);
  if (!recordV1(input, ['projectId', 'requestRef']) || !uuidV1(input.projectId)
    || !refV1(input.requestRef) || input.requestRef.version !== 1)
    return fail('CONTROL_REQUEST_READ_INVALID');
  return input as ReadInput;
}
function listInput(value: unknown): { projectId: string; view: View; limit: number; cursor: string | null } {
  const input = copy(value);
  if (!recordV1(input, ['projectId', 'view'])
    && !recordV1(input, ['projectId', 'view', 'limit'])
    && !recordV1(input, ['projectId', 'view', 'cursor'])
    && !recordV1(input, ['projectId', 'view', 'limit', 'cursor']))
    return fail('CONTROL_REQUEST_READ_INVALID');
  if (!uuidV1(input.projectId) || !['OWN', 'CONTROLLER'].includes(input.view)
    || (input.limit !== undefined && (!positive(input.limit) || input.limit > 200))
    || (input.cursor !== undefined && (typeof input.cursor !== 'string' || !input.cursor)))
    return fail('CONTROL_REQUEST_READ_INVALID');
  return { projectId: input.projectId, view: input.view as View, limit: input.limit ?? 50,
    cursor: input.cursor ?? null };
}

interface Access { observedAt: string; identity: ControlRequestObservation['identity'];
  member: NonNullable<ControlRequestObservation['member']>;
  control: ControlRequestObservation['control']; basis: ControlRequestCursorBasis | null }
function currentBasis(value: unknown, projectId: string): ControlRequestCursorBasis | null {
  if (!recordV1(value, ['projectId', 'actorId', 'clientId', 'generation', 'version', 'revokedAt'])
    || value.projectId !== projectId || !uuidV1(value.actorId) || !uuidV1(value.clientId)
    || !positive(value.generation) || !positive(value.version) || value.revokedAt !== null) return null;
  return { actorId: value.actorId, clientId: value.clientId,
    generation: value.generation, version: value.version };
}
export function currentAccess(observation: unknown, projectId: string): Access {
  const seen = copy(observation);
  if (!recordV1(seen, ['project', 'access'])
    || !recordV1(seen.project, ['id', 'archivedAt'])
    || seen.project.id !== projectId || seen.project.archivedAt !== null
    || !recordV1(seen.access, ['projectId', 'now', 'identity', 'member', 'control'])
    || seen.access.projectId !== projectId || !isoV1(seen.access.now))
    return fail('CONTROL_REQUEST_READ_DENIED');
  const access = seen.access as ControlRequestObservation;
  const identity = access.identity;
  if (!recordV1(identity, ['actorId', 'clientId', 'credentialGeneration', 'currentCredentialGeneration',
    'sessionRevokedAt', 'idleExpiresAt', 'absoluteExpiresAt', 'userActive', 'userRevokedAt',
    'clientUserId', 'clientRevokedAt', 'reauthUntil'])
    || !uuidV1(identity.actorId) || !uuidV1(identity.clientId) || !uuidV1(identity.clientUserId)
    || !positive(identity.credentialGeneration)
    || identity.credentialGeneration !== identity.currentCredentialGeneration
    || identity.sessionRevokedAt !== null || identity.userActive !== true
    || identity.userRevokedAt !== null || identity.clientRevokedAt !== null
    || identity.clientUserId !== identity.actorId
    || !isoV1(identity.idleExpiresAt) || !isoV1(identity.absoluteExpiresAt)
    || (identity.reauthUntil !== null && !isoV1(identity.reauthUntil))
    || Date.parse(identity.idleExpiresAt) <= Date.parse(access.now)
    || Date.parse(identity.absoluteExpiresAt) <= Date.parse(access.now))
    return fail('CONTROL_REQUEST_READ_DENIED');
  const member = access.member;
  if (!recordV1(member, ['projectId', 'userId', 'participation', 'revokedAt'])
    || member.projectId !== projectId || member.userId !== identity.actorId
    || member.revokedAt !== null
    || !['OWNER', 'HANDOFF_ELIGIBLE'].includes(member.participation))
    return fail('CONTROL_REQUEST_READ_DENIED');
  return { observedAt: access.now, identity, member,
    control: access.control, basis: currentBasis(access.control, projectId) };
}
export function canController(access: Access): boolean {
  return access.member.participation === 'OWNER' && access.basis !== null
    && access.basis.actorId === access.identity.actorId
    && access.basis.clientId === access.identity.clientId;
}
function checkView(access: Access, view: View): void {
  if (view === 'CONTROLLER' && !canController(access)) fail('CONTROL_REQUEST_READ_DENIED');
}
export function checkStable(before: Access, after: Access, view: View): void {
  checkView(after, view);
  if (!same(before.identity, after.identity) || !same(before.member, after.member)
    || (view === 'CONTROLLER' && !same(before.basis, after.basis)))
    fail('CONTROL_REQUEST_READ_DENIED');
}
function readState(snapshot: ControlRequestSnapshot, access: Access): ControlRequestCurrentState {
  return { expired: Date.parse(snapshot.expiresAt) <= Date.parse(access.observedAt),
    baseControlState: access.basis === null ? 'UNVERIFIED'
      : same(access.basis, snapshot.baseControl) ? 'MATCHED' : 'CHANGED' };
}

/** 저장 당시의 네 종류 원문을 기존 2A 검증기로 대조한다. 현재 기한/재인증을 새 작성처럼 검사하지 않는다. */
export function verifiedBundle(value: unknown, expectedRef: RequestRef, projectId: string):
  { requestRef: RequestRef; snapshot: ControlRequestSnapshot } {
  const bundle = copy(value);
  if (!recordV1(bundle, ['request', 'command', 'receipts', 'audits'])
    || !recordV1(bundle.command, ['schemaVersion', 'operation', 'commandId', 'commandHash',
      'payloadHash', 'projectId', 'actorId', 'clientId', 'baseControl', 'requestRef', 'createdAt'])
    || !uuidV1(bundle.command.commandId)
    || !recordV1(bundle.request, ['requestRef', 'snapshot', 'metadata'])
    || !recordV1(bundle.request.snapshot, ['id', 'version', 'projectId', 'requestedBy',
      'targetActorRef', 'targetClientRef', 'baseControl', 'reason', 'createdAt', 'expiresAt',
      'storedState', 'executionAuthorized', 'controlTransferred'])
    || !same(bundle.request.requestRef, expectedRef)
    || !same(bundle.command.requestRef, expectedRef)
    || bundle.command.projectId !== projectId || bundle.request.snapshot.projectId !== projectId
    || !isoV1(bundle.command.createdAt)) return fail('CONTROL_REQUEST_READ_INVALID');
  const snapshot = bundle.request.snapshot;
  const payload = { targetActorRef: snapshot.targetActorRef, targetClientRef: snapshot.targetClientRef,
    baseControl: snapshot.baseControl, reason: snapshot.reason, expiresAt: snapshot.expiresAt };
  let input: ControlRequestInput;
  try { input = readControlRequestInput(payload, bundle.command.createdAt); }
  catch { return fail('CONTROL_REQUEST_READ_INVALID'); }
  const command: ControlRequestCommand = { schemaVersion: 1, operation: 'requestControl',
    commandId: bundle.command.commandId, projectId, clientId: bundle.command.clientId, payload: input };
  try {
    const result = verifyBundle(bundle, command, input, bundle.command.actorId,
      expectedRef, bundle.command.createdAt);
    return { requestRef: result.requestRef, snapshot: result.snapshot };
  } catch { return fail('CONTROL_REQUEST_READ_INVALID'); }
}

function readRow(value: unknown, projectId: string, view: View, actorId: string): ReadRow {
  const row = copy(value);
  if (!recordV1(row, ['requestRef', 'createdAt', 'projectId', 'requestedBy'])
    || !refV1(row.requestRef) || row.requestRef.version !== 1
    || !isoV1(row.createdAt) || row.projectId !== projectId
    || !recordV1(row.requestedBy, ['actorId', 'clientId'])
    || !uuidV1(row.requestedBy.actorId) || !uuidV1(row.requestedBy.clientId)
    || (view === 'OWN' && row.requestedBy.actorId !== actorId))
    return fail('CONTROL_REQUEST_READ_INVALID');
  return row as ReadRow;
}
function older(row: ReadRow, last: ControlRequestCursorLast): boolean {
  return row.createdAt < last.createdAt
    || (row.createdAt === last.createdAt && row.requestRef.id < last.requestRef.id);
}
function runRead<T>(port: ControlRequestReadPort, work: (tx: ControlRequestReadTransaction) => Promise<T>): Promise<T> {
  if (port?.sourceMode !== 'TEST_FAKE' && port?.sourceMode !== 'POSTGRES_SOURCE')
    return Promise.reject(new ControlRequestReadFailure('CONTROL_REQUEST_NOT_CONNECTED'));
  try {
    return port.transaction(work).catch(error => {
      if (error instanceof ControlRequestReadFailure) throw error;
      if (port.sourceMode === 'POSTGRES_SOURCE' && error instanceof AuthFailure
        && error.message === 'CONTROL_REQUEST_NOT_CONNECTED' && error.statusCode === 503)
        throw new ControlRequestReadFailure('CONTROL_REQUEST_NOT_CONNECTED');
      if (port.sourceMode === 'POSTGRES_SOURCE' && error instanceof AuthFailure
        && ((error.message === 'AUTH_REQUIRED' && error.statusCode === 401)
          || (error.message === 'CSRF_INVALID' && error.statusCode === 403))) throw error;
      throw new ControlRequestReadFailure('CONTROL_REQUEST_READ_FAILED');
    });
  } catch { return Promise.reject(new ControlRequestReadFailure('CONTROL_REQUEST_READ_FAILED')); }
}
export const defaultControlRequestReadPort: ControlRequestReadPort = {
  sourceMode: 'NOT_CONNECTED',
  async transaction<T>(): Promise<T> { return fail('CONTROL_REQUEST_NOT_CONNECTED'); }
};

/** 상세 원문은 현재 본인 요청자 또는 정확한 현재 제어자에게만 결과 전체로 반환한다. */
export async function readControlRequest(value: unknown,
  port: ControlRequestReadPort = defaultControlRequestReadPort): Promise<ControlRequestReadResult> {
  const input = readInput(value);
  return runRead(port, async tx => {
    const before = currentAccess(await tx.observe(), input.projectId);
    const stored = verifiedBundle(await tx.readBundleByRef(input.requestRef), input.requestRef, input.projectId);
    const view: View = stored.snapshot.requestedBy.actorId === before.identity.actorId ? 'OWN' : 'CONTROLLER';
    checkView(before, view);
    const after = currentAccess(await tx.observe(), input.projectId);
    checkStable(before, after, view);
    if (view === 'OWN' && stored.snapshot.requestedBy.actorId !== after.identity.actorId)
      return fail('CONTROL_REQUEST_READ_DENIED');
    return { projectId: input.projectId, requestRef: stored.requestRef, snapshot: stored.snapshot,
      observedAt: after.observedAt, current: readState(stored.snapshot, after),
      executionAuthorized: false, controlTransferred: false };
  });
}

/** keyset 목록은 모두 검증한 후 최소 metadata만 반환한다. reason·본문은 담지 않는다. */
export async function listControlRequests(value: unknown,
  port: ControlRequestReadPort = defaultControlRequestReadPort): Promise<ControlRequestListResult> {
  const input = listInput(value);
  return runRead(port, async tx => {
    const before = currentAccess(await tx.observe(), input.projectId);
    checkView(before, input.view);
    const controllerBasis = input.view === 'CONTROLLER' ? before.basis : null;
    let afterKey: ControlRequestCursorLast | null = null;
    if (input.cursor !== null) {
      if (!port.signer) return fail('CONTROL_REQUEST_CURSOR_INVALID');
      try {
        afterKey = openControlRequestCursor(input.cursor, {
          actorId: before.identity.actorId, clientId: before.identity.clientId,
          credentialGeneration: before.identity.credentialGeneration, projectId: input.projectId,
          view: input.view, limit: input.limit, controllerBasis, now: before.observedAt
        }, port.signer).last;
      } catch { return fail('CONTROL_REQUEST_CURSOR_INVALID'); }
    }
    const query: ListQuery = { projectId: input.projectId, actorId: before.identity.actorId,
      clientId: before.identity.clientId, view: input.view, controllerBasis,
      limit: input.limit + 1, after: afterKey };
    const rawRows = await tx.listRows(query);
    if (!arrayV1(rawRows, input.limit + 1)) return fail('CONTROL_REQUEST_READ_INVALID');
    const rows = rawRows.map(row => readRow(row, input.projectId, input.view, before.identity.actorId));
    const seenIds = new Set<string>();
    let previous: ReadRow | null = null;
    for (const row of rows) {
      if (seenIds.has(row.requestRef.id) || (previous !== null && !older(row, previous))
        || (afterKey !== null && !older(row, afterKey))
        || Date.parse(row.createdAt) > Date.parse(before.observedAt))
        return fail('CONTROL_REQUEST_READ_INVALID');
      seenIds.add(row.requestRef.id);
      previous = row;
    }
    const stored = [] as Array<{ row: ReadRow; snapshot: ControlRequestSnapshot }>;
    for (const row of rows) {
      const checked = verifiedBundle(await tx.readBundleByRef(row.requestRef), row.requestRef, input.projectId);
      if (checked.snapshot.createdAt !== row.createdAt
        || !same(checked.snapshot.requestedBy, row.requestedBy)
        || (input.view === 'OWN' && checked.snapshot.requestedBy.actorId !== before.identity.actorId))
        return fail('CONTROL_REQUEST_READ_INVALID');
      stored.push({ row, snapshot: checked.snapshot });
    }
    const after = currentAccess(await tx.observe(), input.projectId);
    checkStable(before, after, input.view);
    const selected = stored.slice(0, input.limit);
    const items: ControlRequestListItem[] = selected.map(({ row, snapshot }) => ({
      requestRef: row.requestRef, createdAt: row.createdAt, expiresAt: snapshot.expiresAt,
      storedState: 'PENDING', current: readState(snapshot, after),
      executionAuthorized: false, controlTransferred: false
    }));
    const hasMore = stored.length > input.limit;
    let nextCursor: string | null = null;
    if (hasMore) {
      const last = selected.at(-1);
      if (!port.signer || !last) return fail('CONTROL_REQUEST_CURSOR_INVALID');
      try {
        nextCursor = sealControlRequestCursor({ schemaVersion: 1,
          actorId: after.identity.actorId, clientId: after.identity.clientId,
          credentialGeneration: after.identity.credentialGeneration, projectId: input.projectId,
          view: input.view, limit: input.limit, controllerBasis,
          last: { requestRef: last.row.requestRef, createdAt: last.row.createdAt },
          issuedAt: after.observedAt,
          expiresAt: new Date(Date.parse(after.observedAt) + 30 * 60_000).toISOString()
        }, port.signer);
      } catch { return fail('CONTROL_REQUEST_CURSOR_INVALID'); }
    }
    return { projectId: input.projectId, view: input.view, limit: input.limit,
      observedAt: after.observedAt, items, hasMore, nextCursor,
      executionAuthorized: false, controlTransferred: false };
  });
}
