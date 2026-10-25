import { canonicalJson } from '../../../../contracts/canonical.ts';
import { isoV1, recordV1, refV1, uuidV1 } from '../../../../contracts/runtime/validation-v1.ts';

export interface ControlRequestCursorSigner {
  sign(message: string): string;
  verify(message: string, signature: string): boolean;
}
export interface ControlRequestCursorBasis {
  actorId: string; clientId: string; generation: number; version: number;
}
export interface ControlRequestCursorLast {
  requestRef: { id: string; version: number; contentHash: string }; createdAt: string;
}
export interface ControlRequestCursorPayload {
  schemaVersion: 1; actorId: string; clientId: string; credentialGeneration: number;
  projectId: string; view: 'OWN' | 'CONTROLLER'; limit: number;
  controllerBasis: ControlRequestCursorBasis | null; last: ControlRequestCursorLast;
  issuedAt: string; expiresAt: string;
}
export interface ControlRequestCursorExpected {
  actorId: string; clientId: string; credentialGeneration: number; projectId: string;
  view: 'OWN' | 'CONTROLLER'; limit: number; controllerBasis: ControlRequestCursorBasis | null;
  now: string;
}

const domain = 'anvil:fn15-control-request-cursor:v1:';
const tokenLimit = 4096;
const lifetimeMs = 30 * 60_000;
const positive = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0;
const fail = (): never => { throw new ControlRequestCursorFailure(); };
const same = (left: unknown, right: unknown): boolean => canonicalJson(left) === canonicalJson(right);

/** 내부 후보 cursor 오류에는 요청 원문·서명값을 담지 않는다. */
export class ControlRequestCursorFailure extends Error {
  readonly code = 'CONTROL_REQUEST_CURSOR_INVALID';
  constructor() { super('CONTROL_REQUEST_CURSOR_INVALID'); this.name = 'ControlRequestCursorFailure'; }
}

function readBasis(value: unknown): ControlRequestCursorBasis {
  if (!recordV1(value, ['actorId', 'clientId', 'generation', 'version'])
    || !uuidV1(value.actorId) || !uuidV1(value.clientId)
    || !positive(value.generation) || !positive(value.version)) return fail();
  return value as ControlRequestCursorBasis;
}

function readPayload(value: unknown): ControlRequestCursorPayload {
  if (!recordV1(value, ['schemaVersion', 'actorId', 'clientId', 'credentialGeneration',
    'projectId', 'view', 'limit', 'controllerBasis', 'last', 'issuedAt', 'expiresAt'])
    || value.schemaVersion !== 1 || !uuidV1(value.actorId) || !uuidV1(value.clientId)
    || !positive(value.credentialGeneration) || !uuidV1(value.projectId)
    || !['OWN', 'CONTROLLER'].includes(value.view)
    || !positive(value.limit) || value.limit > 200
    || !recordV1(value.last, ['requestRef', 'createdAt'])
    || !refV1(value.last.requestRef) || value.last.requestRef.version !== 1
    || !isoV1(value.last.createdAt) || !isoV1(value.issuedAt) || !isoV1(value.expiresAt)) return fail();
  if (value.view === 'OWN') { if (value.controllerBasis !== null) return fail(); }
  else readBasis(value.controllerBasis);
  const start = Date.parse(value.issuedAt), end = Date.parse(value.expiresAt);
  if (end <= start || end - start > lifetimeMs || Date.parse(value.last.createdAt) > start) return fail();
  return value as ControlRequestCursorPayload;
}

function readExpected(value: unknown): ControlRequestCursorExpected {
  if (!recordV1(value, ['actorId', 'clientId', 'credentialGeneration',
    'projectId', 'view', 'limit', 'controllerBasis', 'now'])
    || !uuidV1(value.actorId) || !uuidV1(value.clientId)
    || !positive(value.credentialGeneration) || !uuidV1(value.projectId)
    || !['OWN', 'CONTROLLER'].includes(value.view)
    || !positive(value.limit) || value.limit > 200 || !isoV1(value.now)) return fail();
  if (value.view === 'OWN') { if (value.controllerBasis !== null) return fail(); }
  else readBasis(value.controllerBasis);
  return value as ControlRequestCursorExpected;
}

/** 실제 키·인증 생산자를 만들지 않는다. 서명 기능은 호출자가 제공하는 port만 사용한다. */
export function sealControlRequestCursor(value: unknown, signer: ControlRequestCursorSigner): string {
  try {
    const payload = readPayload(value);
    const body = canonicalJson(payload);
    const signature = signer?.sign(domain + body);
    if (typeof signature !== 'string' || !/^[A-Za-z0-9_-]+$/.test(signature)) return fail();
    const token = `${Buffer.from(body, 'utf8').toString('base64url')}.${signature}`;
    if (Buffer.byteLength(token, 'utf8') > tokenLimit) return fail();
    return token;
  } catch { return fail(); }
}

/** canonical 원문과 현재 읽기 문맥을 모두 확인한 뒤에만 마지막 keyset을 돌려준다. */
export function openControlRequestCursor(token: unknown, expectedValue: unknown,
  signer: ControlRequestCursorSigner): ControlRequestCursorPayload {
  try {
    const expected = readExpected(expectedValue);
    if (typeof token !== 'string' || Buffer.byteLength(token, 'utf8') > tokenLimit
      || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) return fail();
    const [encoded, signature] = token.split('.');
    if (!encoded || !signature) return fail();
    const bodyBytes = Buffer.from(encoded, 'base64url');
    if (bodyBytes.toString('base64url') !== encoded) return fail();
    const body = bodyBytes.toString('utf8');
    if (!Buffer.from(body, 'utf8').equals(bodyBytes)) return fail();
    const value = JSON.parse(body) as unknown;
    if (canonicalJson(value) !== body || signer?.verify(domain + body, signature) !== true) return fail();
    const payload = readPayload(value);
    if (payload.actorId !== expected.actorId || payload.clientId !== expected.clientId
      || payload.credentialGeneration !== expected.credentialGeneration
      || payload.projectId !== expected.projectId || payload.view !== expected.view
      || payload.limit !== expected.limit || !same(payload.controllerBasis, expected.controllerBasis)
      || Date.parse(payload.issuedAt) > Date.parse(expected.now)
      || Date.parse(payload.expiresAt) <= Date.parse(expected.now)) return fail();
    return payload;
  } catch { return fail(); }
}
