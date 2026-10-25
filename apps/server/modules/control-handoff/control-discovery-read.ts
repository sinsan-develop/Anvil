import { canonicalJson } from '../../../../contracts/canonical.ts';
import { isoV1, recordV1, refV1, uuidV1 } from '../../../../contracts/runtime/validation-v1.ts';
import { AuthFailure } from '../access/repository.ts';
import { canController, checkStable, currentAccess, verifiedBundle,
  ControlRequestReadFailure } from './control-request-read.ts';
import type { ControlRequestStoreObservation, ControlRequestBundle } from './control-request-store.ts';
import type { ControlRequestRecord } from './control-request-snapshot.ts';
import type { HandoffSummaryRecord } from './control-handoff-summary.ts';

type RequestRef = ControlRequestRecord['requestRef'];
type SummaryRef = HandoffSummaryRecord['summaryRef'];
type Access = ReturnType<typeof currentAccess>;
type Participation = Access['member']['participation'];
type ControlBasis = NonNullable<Access['basis']>;
type ControlState = 'HELD' | 'OTHER_CLIENT' | 'UNASSIGNED' | 'UNVERIFIED';
type HeadRow = { projectId: string; requestRef: RequestRef; summaryRef: SummaryRef };

export interface ControlDiscoveryReadTransaction {
  observe(): Promise<ControlRequestStoreObservation>;
  readRequestBundleByRef(ref: RequestRef): Promise<ControlRequestBundle | null>;
  readHeadSummaryRef(ref: RequestRef): Promise<HeadRow | null>;
}
export interface ControlDiscoveryReadPort {
  readonly sourceMode: 'NOT_CONNECTED' | 'TEST_FAKE' | 'POSTGRES_SOURCE';
  transaction<T>(work: (tx: ControlDiscoveryReadTransaction) => Promise<T>): Promise<T>;
}
export interface ControlStateResult {
  schemaVersion: 1; projectId: string; observedAt: string; actorId: string; clientId: string;
  participation: Participation;
  control: { state: ControlState; basis: ControlBasis | null };
  executionAuthorized: false; controlTransferred: false;
}
export interface HandoffSummaryHeadResult {
  schemaVersion: 1; projectId: string; requestRef: RequestRef; observedAt: string;
  head: { state: 'NONE'; summaryRef: null } | { state: 'AVAILABLE'; summaryRef: SummaryRef };
  executionAuthorized: false; controlTransferred: false;
}

/** 오류에는 원문, 조회된 타인의 행, 원 예외를 넣지 않는다. */
export class ControlDiscoveryFailure extends Error {
  readonly code: string;
  constructor(code: string) { super(code); this.name = 'ControlDiscoveryFailure'; this.code = code; }
}
const fail = (code: string): never => { throw new ControlDiscoveryFailure(code); };
const same = (left: unknown, right: unknown): boolean => canonicalJson(left) === canonicalJson(right);
const positive = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0;
const copy = <T>(value: T): T => {
  try { return JSON.parse(canonicalJson(value)) as T; }
  catch { return fail('CONTROL_DISCOVERY_INPUT_INVALID'); }
};

function projectInput(value: unknown): string {
  const input = copy(value);
  if (!recordV1(input, ['projectId']) || !uuidV1(input.projectId))
    return fail('CONTROL_DISCOVERY_INPUT_INVALID');
  return input.projectId;
}
function headInput(value: unknown): { projectId: string; requestRef: RequestRef } {
  const input = copy(value);
  if (!recordV1(input, ['projectId', 'requestRef']) || !uuidV1(input.projectId)
    || !refV1(input.requestRef) || input.requestRef.version !== 1)
    return fail('CONTROL_DISCOVERY_INPUT_INVALID');
  return { projectId: input.projectId, requestRef: input.requestRef };
}

function stable(before: Access, after: Access, view: 'OWN' | 'CONTROLLER'): void {
  checkStable(before, after, view);
  if (!same(before.control, after.control) || !same(before.basis, after.basis))
    fail('CONTROL_DISCOVERY_READ_DENIED');
}
function controlState(access: Access, projectId: string):
  { state: ControlState; basis: ControlBasis | null } {
  if (access.control === null) return { state: 'UNASSIGNED', basis: null };
  const raw = access.control;
  if (!recordV1(raw, ['projectId', 'actorId', 'clientId', 'generation', 'version', 'revokedAt'])
    || raw.projectId !== projectId || !uuidV1(raw.actorId) || !uuidV1(raw.clientId)
    || !positive(raw.generation) || !positive(raw.version))
    return { state: 'UNVERIFIED', basis: null };
  if (raw.revokedAt !== null) return isoV1(raw.revokedAt)
    && Date.parse(raw.revokedAt) <= Date.parse(access.observedAt)
    ? { state: 'UNASSIGNED', basis: null } : { state: 'UNVERIFIED', basis: null };
  if (access.basis === null) return { state: 'UNVERIFIED', basis: null };
  return { state: raw.actorId === access.identity.actorId && raw.clientId === access.identity.clientId
    ? 'HELD' : 'OTHER_CLIENT', basis: copy(access.basis) };
}
function validHead(value: unknown, projectId: string, requestRef: RequestRef): HeadRow {
  const row = copy(value);
  if (!recordV1(row, ['projectId', 'requestRef', 'summaryRef'])
    || row.projectId !== projectId || !refV1(row.requestRef)
    || !same(row.requestRef, requestRef) || !refV1(row.summaryRef)
    || row.summaryRef.id !== requestRef.id || !positive(row.summaryRef.version))
    return fail('CONTROL_DISCOVERY_INVALID');
  return { projectId, requestRef: copy(requestRef), summaryRef: copy(row.summaryRef) };
}

async function run<T>(port: ControlDiscoveryReadPort,
  work: (tx: ControlDiscoveryReadTransaction) => Promise<T>): Promise<T> {
  if (port?.sourceMode !== 'TEST_FAKE' && port?.sourceMode !== 'POSTGRES_SOURCE')
    return fail('CONTROL_DISCOVERY_NOT_CONNECTED');
  try { return await port.transaction(work); }
  catch (error) {
    if (error instanceof ControlDiscoveryFailure) throw error;
    if (error instanceof ControlRequestReadFailure) {
      if (error.code === 'CONTROL_REQUEST_NOT_FOUND') return fail('CONTROL_DISCOVERY_NOT_FOUND');
      if (error.code === 'CONTROL_REQUEST_READ_DENIED') return fail('CONTROL_DISCOVERY_READ_DENIED');
      return fail('CONTROL_DISCOVERY_INVALID');
    }
    if (port.sourceMode === 'POSTGRES_SOURCE' && error instanceof AuthFailure) {
      if (error.message === 'CONTROL_REQUEST_NOT_CONNECTED' && error.statusCode === 503)
        return fail('CONTROL_DISCOVERY_NOT_CONNECTED');
      if ((error.message === 'AUTH_REQUIRED' && error.statusCode === 401)
        || (error.message === 'CSRF_INVALID' && error.statusCode === 403)) throw error;
    }
    return fail('CONTROL_DISCOVERY_FAILED');
  }
}

export const defaultControlDiscoveryReadPort: ControlDiscoveryReadPort = {
  sourceMode: 'NOT_CONNECTED',
  async transaction<T>(): Promise<T> { return fail('CONTROL_DISCOVERY_NOT_CONNECTED'); }
};

/** 현재 관측값만 반환한다. POST 권한은 매번 별도 재검증한다. */
export async function readControlState(value: unknown,
  port: ControlDiscoveryReadPort = defaultControlDiscoveryReadPort): Promise<ControlStateResult> {
  const projectId = projectInput(value);
  return run(port, async tx => {
    const before = currentAccess(await tx.observe(), projectId);
    const control = controlState(before, projectId);
    const after = currentAccess(await tx.observe(), projectId);
    stable(before, after, 'OWN');
    return { schemaVersion: 1, projectId, observedAt: after.observedAt,
      actorId: after.identity.actorId, clientId: after.identity.clientId,
      participation: after.member.participation, control,
      executionAuthorized: false, controlTransferred: false };
  });
}

/** 고정 원 요청의 최신 불변 참조만 찾는다. 본문과 현재 기한은 fixed GET으로 다시 조회한다. */
export async function readHandoffSummaryHead(value: unknown,
  port: ControlDiscoveryReadPort = defaultControlDiscoveryReadPort): Promise<HandoffSummaryHeadResult> {
  const input = headInput(value);
  return run(port, async tx => {
    const before = currentAccess(await tx.observe(), input.projectId);
    const request = verifiedBundle(await tx.readRequestBundleByRef(input.requestRef),
      input.requestRef, input.projectId);
    const view = request.snapshot.requestedBy.actorId === before.identity.actorId ? 'OWN' : 'CONTROLLER';
    if (view === 'CONTROLLER' && !canController(before)) fail('CONTROL_DISCOVERY_READ_DENIED');
    const pointer = await tx.readHeadSummaryRef(input.requestRef);
    const head: HandoffSummaryHeadResult['head'] = pointer === null
      ? { state: 'NONE', summaryRef: null }
      : { state: 'AVAILABLE', summaryRef: validHead(pointer, input.projectId, input.requestRef).summaryRef };
    const again = verifiedBundle(await tx.readRequestBundleByRef(input.requestRef),
      input.requestRef, input.projectId);
    if (!same(again, request)) fail('CONTROL_DISCOVERY_INVALID');
    const after = currentAccess(await tx.observe(), input.projectId);
    stable(before, after, view);
    if (view === 'OWN' && request.snapshot.requestedBy.actorId !== after.identity.actorId)
      fail('CONTROL_DISCOVERY_READ_DENIED');
    return { schemaVersion: 1, projectId: input.projectId, requestRef: copy(input.requestRef),
      observedAt: after.observedAt, head, executionAuthorized: false, controlTransferred: false };
  });
}
