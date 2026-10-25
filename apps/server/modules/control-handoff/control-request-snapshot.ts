import { canonicalJson, contentHash } from '../../../../contracts/canonical.ts';
import { isoV1, recordV1, refV1, uuidV1 } from '../../../../contracts/runtime/validation-v1.ts';
import { AuthFailure } from '../access/repository.ts';
import { readControlRequestInput, type ControlRequestInput } from './control-request-input.ts';

export interface ControlRequestSource {
  id: string;
  projectId: string;
  requestedBy: { actorId: string; clientId: string };
  input: ControlRequestInput;
  createdAt: string;
}
export interface ControlRequestSnapshot {
  id: string; version: 1; projectId: string; requestedBy: { actorId: string; clientId: string };
  targetActorRef: { userId: string }; targetClientRef: { userId: string; clientId: string };
  baseControl: ControlRequestInput['baseControl']; reason: string; createdAt: string; expiresAt: string;
  storedState: 'PENDING'; executionAuthorized: false; controlTransferred: false;
}
export interface ControlRequestRecord {
  requestRef: { id: string; version: number; contentHash: string };
  snapshot: ControlRequestSnapshot;
  metadata: Pick<ControlRequestSnapshot, 'id' | 'version' | 'projectId' | 'requestedBy' |
    'targetActorRef' | 'targetClientRef' | 'baseControl' | 'reason' | 'createdAt' | 'expiresAt'>;
}

const fail = (): never => { throw new AuthFailure('CONTROL_REQUEST_SNAPSHOT_INVALID', 503); };
const sourceKeys = ['id', 'projectId', 'requestedBy', 'input', 'createdAt'];
const bodyKeys = ['id', 'version', 'projectId', 'requestedBy', 'targetActorRef', 'targetClientRef',
  'baseControl', 'reason', 'createdAt', 'expiresAt', 'storedState', 'executionAuthorized', 'controlTransferred'];
const metadataKeys = bodyKeys.filter(key => !['storedState', 'executionAuthorized', 'controlTransferred'].includes(key));
const same = (a: unknown, b: unknown): boolean => canonicalJson(a) === canonicalJson(b);

function copy(value: unknown): unknown {
  try { return JSON.parse(canonicalJson(value)) as unknown; } catch { return fail(); }
}

function bodyFrom(source: unknown): ControlRequestSnapshot {
  const value = copy(source);
  if (!recordV1(value, sourceKeys) || !uuidV1(value.id) || !uuidV1(value.projectId)
    || !recordV1(value.requestedBy, ['actorId', 'clientId'])
    || !uuidV1(value.requestedBy.actorId) || !uuidV1(value.requestedBy.clientId)
    || !isoV1(value.createdAt)) return fail();
  let input: ControlRequestInput;
  try { input = readControlRequestInput(value.input, value.createdAt); } catch { return fail(); }
  if (value.requestedBy.actorId !== input.targetActorRef.userId
    || value.requestedBy.actorId !== input.targetClientRef.userId
    || value.requestedBy.clientId !== input.targetClientRef.clientId) return fail();
  return {
    id: value.id, version: 1, projectId: value.projectId, requestedBy: { actorId: value.requestedBy.actorId, clientId: value.requestedBy.clientId },
    targetActorRef: input.targetActorRef, targetClientRef: input.targetClientRef,
    baseControl: input.baseControl, reason: input.reason, createdAt: value.createdAt, expiresAt: input.expiresAt,
    storedState: 'PENDING', executionAuthorized: false, controlTransferred: false
  };
}

/** 자기 참조를 피하려고 hash는 불변 본문 밖의 ref에 둔다. 제어권을 부여하지 않는다. */
export function createControlRequestSnapshot(source: ControlRequestSource): Pick<ControlRequestRecord, 'requestRef' | 'snapshot'> {
  const snapshot = bodyFrom(source);
  return { requestRef: { id: snapshot.id, version: 1, contentHash: contentHash(canonicalJson(snapshot)) }, snapshot };
}

/** 생성 시점 원자료와 저장 이력을 대조한다. 현재 만료·접근 권한은 별도 트랜잭션에서 검사해야 한다. */
export function verifyControlRequestSnapshot(record: ControlRequestRecord, expected: ControlRequestSource): ControlRequestSnapshot {
  const stored = copy(record);
  if (!recordV1(stored, ['requestRef', 'snapshot', 'metadata']) || !refV1(stored.requestRef)
    || !recordV1(stored.snapshot, bodyKeys) || !recordV1(stored.metadata, metadataKeys)) return fail();
  const expectedBody = bodyFrom(expected);
  const body = stored.snapshot;
  if (stored.requestRef.id !== body.id || stored.requestRef.version !== 1 || body.version !== 1
    || body.storedState !== 'PENDING' || body.executionAuthorized !== false || body.controlTransferred !== false
    || stored.requestRef.contentHash !== contentHash(canonicalJson(body))
    || !same(body, expectedBody)) return fail();
  const metadata = Object.fromEntries(metadataKeys.map(key => [key, (body as unknown as Record<string, unknown>)[key]]));
  if (!same(stored.metadata, metadata)) return fail();
  return body as ControlRequestSnapshot;
}
