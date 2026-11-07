import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalJson, contentHash } from '../../../contracts/canonical.ts';
const source: any = await import('../../../apps/server/modules/control-handoff/control-request-snapshot.ts').catch((error: NodeJS.ErrnoException) => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
  throw error;
});
const projectId = '11111111-1111-4111-8111-111111111111';
const actorId = '22222222-2222-4222-8222-222222222222';
const clientId = '33333333-3333-4333-8333-333333333333';
const controllerId = '44444444-4444-4444-8444-444444444444';
const controllerClientId = '55555555-5555-4555-8555-555555555555';
const requestId = '66666666-6666-4666-8666-666666666666';
const createdAt = '2026-10-25T08:00:00.000Z';
const expiresAt = '2026-10-25T08:30:00.000Z';
const input = (): any => ({ targetActorRef: { userId: actorId }, targetClientRef: { userId: actorId, clientId },
  baseControl: { actorId: controllerId, clientId: controllerClientId, generation: 5, version: 8 },
  reason: '원문  보존', expiresAt });
const expected = (): any => ({ id: requestId, projectId, requestedBy: { actorId, clientId }, input: input(), createdAt });
function create(value: any = expected()) {
  assert.equal(typeof source.createControlRequestSnapshot, 'function');
  return source.createControlRequestSnapshot(value);
}
function verify(record: any, sourceFacts: any = expected()) {
  assert.equal(typeof source.verifyControlRequestSnapshot, 'function');
  return source.verifyControlRequestSnapshot(record, sourceFacts);
}
function record(): any {
  const made = create();
  return { ...made, metadata: { id: requestId, version: 1, projectId,
    requestedBy: { actorId, clientId }, targetActorRef: { userId: actorId },
    targetClientRef: { userId: actorId, clientId }, baseControl: input().baseControl,
    reason: input().reason, createdAt, expiresAt } };
}
test('불변 snapshot의 외부 ref가 본문 hash를 소유하고 제어·실행 허가는 false다', () => {
  const original = expected(), saved = structuredClone(original), made = create(original);
  assert.deepEqual(original, saved);
  assert.deepEqual(made.requestRef, { id: requestId, version: 1, contentHash: contentHash(canonicalJson(made.snapshot)) });
  assert.deepEqual(Object.keys(made.snapshot).sort(), ['id','version','projectId','requestedBy','targetActorRef','targetClientRef','baseControl','reason','createdAt','expiresAt','storedState','executionAuthorized','controlTransferred'].sort());
  assert.equal(made.snapshot.id, requestId); assert.equal(made.snapshot.version, 1);
  assert.deepEqual(made.snapshot.requestedBy, saved.requestedBy);
  assert.deepEqual(made.snapshot.targetActorRef, saved.input.targetActorRef);
  assert.deepEqual(made.snapshot.targetClientRef, saved.input.targetClientRef);
  assert.deepEqual(made.snapshot.baseControl, saved.input.baseControl);
  assert.equal(made.snapshot.reason, saved.input.reason); assert.equal(made.snapshot.createdAt, createdAt);
  assert.equal(made.snapshot.expiresAt, expiresAt); assert.equal(made.snapshot.storedState, 'PENDING');
  assert.equal(made.snapshot.executionAuthorized, false); assert.equal(made.snapshot.controlTransferred, false);
  assert.equal(Object.hasOwn(made.snapshot, 'requestRef'), false);
  original.input.baseControl.version = 99; original.input.reason = 'changed';
  assert.equal(made.snapshot.baseControl.version, 8); assert.equal(made.snapshot.reason, saved.input.reason);
});
test('정상 저장 원문·중복 metadata·expected 입력을 독립 대조한다', () => {
  const stored = record(), copy = structuredClone(stored), basis = expected();
  const verified = verify(stored, basis);
  assert.deepEqual(stored, copy); assert.deepEqual(basis, expected());
  assert.equal(verified.reason, input().reason);
  verified.baseControl.generation = 999;
  assert.equal(stored.snapshot.baseControl.generation, 5);
});
test('ref hash·원문·metadata·requestedBy·target·기한 변조는 각각 거절한다', () => {
  const mutations: ((r: any) => void)[] = [
    r => { r.requestRef.id = controllerId; },
    r => { r.requestRef.contentHash = '0'.repeat(64); },
    r => { r.requestRef.version = 2; },
    r => { r.snapshot.reason = 'altered'; },
    r => { r.snapshot.id = controllerId; },
    r => { r.snapshot.projectId = controllerId; },
    r => { r.snapshot.targetActorRef.userId = controllerId; },
    r => { r.snapshot.targetClientRef.clientId = controllerClientId; },
    r => { r.snapshot.requestedBy.clientId = controllerClientId; },
    r => { r.snapshot.storedState = 'ACCEPTED'; },
    r => { r.snapshot.executionAuthorized = true; },
    r => { r.snapshot.controlTransferred = true; },
    r => { r.metadata.reason = 'altered'; },
    r => { r.metadata.id = controllerId; },
    r => { r.metadata.projectId = controllerId; },
    r => { r.metadata.version = 2; },
    r => { r.metadata.requestedBy.actorId = controllerId; },
    r => { r.metadata.targetClientRef.clientId = controllerClientId; },
    r => { r.metadata.baseControl.generation = 6; },
    r => { r.metadata.expiresAt = createdAt; },
  ];
  for (const mutate of mutations) { const row = record(); mutate(row); assert.throws(() => verify(row)); }
  for (const change of [
    { projectId: controllerId }, { requestedBy: { actorId: controllerId, clientId } },
    { requestedBy: { actorId, clientId: controllerClientId } },
    { input: { ...input(), targetActorRef: { userId: controllerId } } },
    { input: { ...input(), baseControl: { ...input().baseControl, version: 9 } } },
  ]) assert.throws(() => verify(record(), { ...expected(), ...change }));
});
test('과거 기한 경과 원문은 createdAt 기준으로 검증하며 현재 접근은 이 verifier가 판정하지 않는다', () => {
  const oldCreated = '2026-10-24T08:00:00.000Z';
  const oldExpires = '2026-10-24T08:30:00.000Z';
  const oldSource = { ...expected(), createdAt: oldCreated, input: { ...input(), expiresAt: oldExpires } };
  const made = create(oldSource);
  const oldRecord = { ...made, metadata: { ...record().metadata, createdAt: oldCreated, expiresAt: oldExpires } };
  assert.equal(verify(oldRecord, oldSource).expiresAt, oldExpires);
  assert.throws(() => create({ ...oldSource, input: { ...oldSource.input, expiresAt: '2026-10-24T08:30:00.001Z' } }));
});
test('비정상 id·원입력·시간·accessor·cycle은 생성·검증에서 fail closed다', () => {
  for (const sourceFacts of [{ ...expected(), id: 'wrong' }, { ...expected(), requestedBy: { actorId, clientId: 'x' } },
    { ...expected(), createdAt: expiresAt }, { ...expected(), input: { ...input(), reason: '' } }])
    assert.throws(() => create(sourceFacts));
  const accessor = record(); let calls = 0;
  Object.defineProperty(accessor.snapshot, 'reason', { enumerable: true, get() { calls++; return 'fake'; } });
  assert.throws(() => verify(accessor)); assert.equal(calls, 0);
  const cycle = record(); cycle.snapshot.self = cycle.snapshot;
  assert.throws(() => verify(cycle));
});
