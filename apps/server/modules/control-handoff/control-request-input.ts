import { canonicalJson } from '../../../../contracts/canonical.ts';
import { isoV1, recordV1, uuidV1 } from '../../../../contracts/runtime/validation-v1.ts';
import { AuthFailure } from '../access/repository.ts';
import { inspectArtifact } from '../../storage/sensitive-inspection.ts';

export interface ControlRequestInput {
  targetActorRef: { userId: string };
  targetClientRef: { userId: string; clientId: string };
  baseControl: { actorId: string; clientId: string; generation: number; version: number };
  reason: string;
  expiresAt: string;
}

/** 향후 트랜잭션 포트가 확보할 내부 관측 형식이다. 이 객체만으로 세션 인증이나 요청 허가가 성립하지 않는다. */
export interface ControlRequestObservation {
  projectId: string;
  now: string;
  identity: {
    actorId: string; clientId: string; credentialGeneration: number; currentCredentialGeneration: number;
    sessionRevokedAt: string | null; idleExpiresAt: string; absoluteExpiresAt: string;
    userActive: boolean; userRevokedAt: string | null; clientUserId: string; clientRevokedAt: string | null;
    reauthUntil: string | null;
  };
  member: { projectId: string; userId: string; participation: 'OWNER' | 'HANDOFF_ELIGIBLE'; revokedAt: string | null } | null;
  control: { projectId: string; actorId: string; clientId: string; generation: number; version: number; revokedAt: string | null } | null;
}

const inputKeys = ['targetActorRef', 'targetClientRef', 'baseControl', 'reason', 'expiresAt'];
const positive = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0;
const failInput = (): never => { throw new AuthFailure('CONTROL_REQUEST_INPUT_INVALID', 422); };
const failAccess = (): never => { throw new AuthFailure('CONTROL_REQUEST_ACCESS_DENIED', 403); };

/** 기존 canonical JSON 검사로 일반 객체 형식·접근자·순환·Unicode 오류를 차단한다. */
function copyJson(value: unknown): unknown {
  try {
    const body = canonicalJson(value);
    if (Buffer.byteLength(body, 'utf8') > 2 * 1024 * 1024) return failInput();
    return JSON.parse(body) as unknown;
  } catch { return failInput(); }
}

export function readControlRequestInput(value: unknown, now: string): ControlRequestInput {
  if (!isoV1(now)) return failInput();
  const input = copyJson(value);
  if (!recordV1(input, inputKeys)
    || !recordV1(input.targetActorRef, ['userId']) || !uuidV1(input.targetActorRef.userId)
    || !recordV1(input.targetClientRef, ['userId', 'clientId'])
    || !uuidV1(input.targetClientRef.userId) || !uuidV1(input.targetClientRef.clientId)
    || input.targetClientRef.userId !== input.targetActorRef.userId
    || !recordV1(input.baseControl, ['actorId', 'clientId', 'generation', 'version'])
    || !uuidV1(input.baseControl.actorId) || !uuidV1(input.baseControl.clientId)
    || !positive(input.baseControl.generation) || !positive(input.baseControl.version)
    || typeof input.reason !== 'string' || !input.reason.trim() || input.reason.length > 20_000
    || !isoV1(input.expiresAt)) return failInput();
  const start = Date.parse(now), end = Date.parse(input.expiresAt);
  if (end <= start || end - start > 30 * 60_000) return failInput();
  if (inspectArtifact(Buffer.from(canonicalJson(input), 'utf8')).state === 'SUSPECTED') return failInput();
  return input as ControlRequestInput;
}

/** 신뢰된 관측값의 순수 대조다. 향후 트랜잭션 포트가 관측값을 직접 얻고 재확인해야 한다. */
export function checkControlRequestSelf(input: ControlRequestInput, facts: ControlRequestObservation): ControlRequestInput {
  const seen = copyJson(facts);
  if (!recordV1(seen, ['projectId', 'now', 'identity', 'member', 'control'])
    || !uuidV1(seen.projectId) || !isoV1(seen.now)) return failAccess();
  const request = readControlRequestInput(input, seen.now);
  const identity = seen.identity, member = seen.member, control = seen.control;
  if (!recordV1(identity, ['actorId', 'clientId', 'credentialGeneration', 'currentCredentialGeneration',
    'sessionRevokedAt', 'idleExpiresAt', 'absoluteExpiresAt', 'userActive', 'userRevokedAt',
    'clientUserId', 'clientRevokedAt', 'reauthUntil'])
    || !uuidV1(identity.actorId) || !uuidV1(identity.clientId) || !uuidV1(identity.clientUserId)
    || !positive(identity.credentialGeneration) || identity.credentialGeneration !== identity.currentCredentialGeneration
    || identity.userActive !== true || identity.sessionRevokedAt !== null || identity.userRevokedAt !== null
    || identity.clientRevokedAt !== null || identity.clientUserId !== identity.actorId
    || !isoV1(identity.idleExpiresAt) || !isoV1(identity.absoluteExpiresAt) || !isoV1(identity.reauthUntil)
    || Date.parse(identity.idleExpiresAt) <= Date.parse(seen.now)
    || Date.parse(identity.absoluteExpiresAt) <= Date.parse(seen.now)
    || Date.parse(identity.reauthUntil) <= Date.parse(seen.now)) return failAccess();
  if (!recordV1(member, ['projectId', 'userId', 'participation', 'revokedAt'])
    || member.projectId !== seen.projectId || member.userId !== identity.actorId || member.revokedAt !== null
    || !['OWNER', 'HANDOFF_ELIGIBLE'].includes(member.participation)) return failAccess();
  if (!recordV1(control, ['projectId', 'actorId', 'clientId', 'generation', 'version', 'revokedAt'])
    || control.projectId !== seen.projectId || !uuidV1(control.actorId) || !uuidV1(control.clientId)
    || !positive(control.generation) || !positive(control.version) || control.revokedAt !== null
    || control.actorId !== request.baseControl.actorId || control.clientId !== request.baseControl.clientId
    || control.generation !== request.baseControl.generation || control.version !== request.baseControl.version
    || (control.actorId === identity.actorId && control.clientId === identity.clientId)) return failAccess();
  if (request.targetActorRef.userId !== identity.actorId || request.targetClientRef.userId !== identity.actorId
    || request.targetClientRef.clientId !== identity.clientId) return failAccess();
  return request;
}
