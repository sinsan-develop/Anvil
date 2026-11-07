import assert from 'node:assert/strict';
import test from 'node:test';
const source: any = await import('../../../apps/server/modules/control-handoff/control-request-input.ts').catch((error: NodeJS.ErrnoException) => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
  throw error;
});
const projectId = '11111111-1111-4111-8111-111111111111';
const actorId = '22222222-2222-4222-8222-222222222222';
const clientId = '33333333-3333-4333-8333-333333333333';
const controllerId = '44444444-4444-4444-8444-444444444444';
const controllerClientId = '55555555-5555-4555-8555-555555555555';
const now = '2026-10-25T08:00:00.000Z';
const later = '2026-10-25T08:30:00.000Z';
const payload = (): any => ({
  targetActorRef: { userId: actorId }, targetClientRef: { userId: actorId, clientId },
  baseControl: { actorId: controllerId, clientId: controllerClientId, generation: 5, version: 8 },
  reason: '  담당자 인수 요청 원문  ', expiresAt: later
});
const facts = (): any => ({
  projectId, now,
  identity: { actorId, clientId, credentialGeneration: 3, currentCredentialGeneration: 3,
    sessionRevokedAt: null, idleExpiresAt: later, absoluteExpiresAt: '2026-10-25T09:00:00.000Z',
    userActive: true, userRevokedAt: null, clientUserId: actorId, clientRevokedAt: null,
    reauthUntil: '2026-10-25T08:00:00.001Z' },
  member: { projectId, userId: actorId, participation: 'OWNER', revokedAt: null },
  control: { projectId, actorId: controllerId, clientId: controllerClientId, generation: 5, version: 8, revokedAt: null }
});
function read(value: unknown = payload(), clock = now) {
  assert.equal(typeof source.readControlRequestInput, 'function');
  return source.readControlRequestInput(value, clock);
}
function check(value: unknown = payload(), observation: any = facts()) {
  assert.equal(typeof source.checkControlRequestSelf, 'function');
  return source.checkControlRequestSelf(read(value, observation.now), observation);
}
test('SELF 원문은 exact payload만 읽고 원본 reason·입력 객체는 바꾸지 않는다', () => {
  const raw = payload(), copy = structuredClone(raw), parsed = read(raw);
  assert.deepEqual(parsed, copy); assert.deepEqual(raw, copy);
  raw.baseControl.generation = 99; raw.reason = 'changed';
  assert.equal(parsed.baseControl.generation, 5); assert.equal(parsed.reason, '  담당자 인수 요청 원문  ');
  for (const extra of [{ projectId }, { requestedBy: actorId }, { token: 'x' }, { commandId: actorId }])
    assert.throws(() => read({ ...payload(), ...extra }));
});
test('객체 모양·참조·raw 숫자와 시각을 엄격히 거절한다', () => {
  for (const bad of [null, [], new Date(now), Object.create({ ...payload() }), { ...payload(), targetActorRef: { userId: actorId, role: 'OWNER' } },
    { ...payload(), targetClientRef: { userId: actorId, clientId: 'wrong' } },
    { ...payload(), baseControl: { ...payload().baseControl, generation: 1.5 } },
    { ...payload(), baseControl: { ...payload().baseControl, generation: '5' } },
    { ...payload(), baseControl: { ...payload().baseControl, generation: [5] } },
    { ...payload(), baseControl: { ...payload().baseControl, version: 0 } },
    { ...payload(), baseControl: { ...payload().baseControl, version: '8' } },
    { ...payload(), baseControl: { ...payload().baseControl, version: [8] } },
    { ...payload(), baseControl: { ...payload().baseControl, actorId: 'x' } },
    { ...payload(), expiresAt: '2026-10-25T08:30:00Z' },
    { ...payload(), expiresAt: '2026-02-30T08:30:00.000Z' }]) assert.throws(() => read(bad));
  const getter = payload(); let calls = 0;
  Object.defineProperty(getter, 'reason', { enumerable: true, get() { calls++; return 'getter'; } });
  assert.throws(() => read(getter)); assert.equal(calls, 0);
  const cycle = payload(); cycle.targetActorRef.self = cycle;
  assert.throws(() => read(cycle));
});
test('이유 UTF16 길이·Unicode·비밀 표식·canonical 2MiB 경계를 검사한다', () => {
  for (const reason of ['', '   ', 'x'.repeat(20_001), '\ud800', 'password=abcd1234', 'access_token: abcd1234', 'secret=abcd1234'])
    assert.throws(() => read({ ...payload(), reason }));
  assert.equal(read({ ...payload(), reason: 'x'.repeat(20_000) }).reason.length, 20_000);
  const huge = payload(); huge.reason = '가'.repeat(20_000);
  assert.equal(read(huge).reason, huge.reason);
  const oversize = payload(); oversize.reason = 'x'.repeat(2 * 1024 * 1024);
  assert.throws(() => read(oversize));
});
test('요청 기한은 now 초과·최대 30분을 밀리초 경계에서 제한한다', () => {
  assert.equal(read(payload()).expiresAt, later);
  assert.equal(read({ ...payload(), expiresAt: '2026-10-25T08:00:00.001Z' }).expiresAt, '2026-10-25T08:00:00.001Z');
  for (const expiresAt of [now, '2026-10-25T07:59:59.999Z', '2026-10-25T08:30:00.001Z'])
    assert.throws(() => read({ ...payload(), expiresAt }));
});
test('현재 OWNER의 다른 client와 HANDOFF_ELIGIBLE만 SELF 요청 후보가 된다', () => {
  assert.equal(check().reason, payload().reason);
  const sameActorOtherClient = facts(); sameActorOtherClient.control.actorId = actorId;
  assert.equal(check({ ...payload(), baseControl: { ...payload().baseControl, actorId } }, sameActorOtherClient).reason, payload().reason);
  const sameActorSameClient = facts(); sameActorSameClient.control.actorId = actorId; sameActorSameClient.control.clientId = clientId;
  assert.throws(() => check({ ...payload(), baseControl: { actorId, clientId, generation: 5, version: 8 } }, sameActorSameClient));
  assert.equal(check(payload(), { ...facts(), member: { ...facts().member, participation: 'HANDOFF_ELIGIBLE' } }).reason, payload().reason);
  for (const participation of ['VIEWER', 'DENIED', 'owner'])
    assert.throws(() => check(payload(), { ...facts(), member: { ...facts().member, participation } }));
  assert.throws(() => check(payload(), { ...facts(), member: null }));
});
test('다른 actor/client·타 프로젝트·회수·만료·옛 제어 기준을 거절한다', () => {
  const f = facts();
  for (const bad of [
    { ...f, identity: { ...f.identity, actorId: controllerId } },
    { ...f, identity: { ...f.identity, clientId: controllerClientId } },
    { ...f, identity: { ...f.identity, clientUserId: controllerId } },
    { ...f, identity: { ...f.identity, currentCredentialGeneration: 4 } },
    { ...f, identity: { ...f.identity, userActive: false } },
    { ...f, identity: { ...f.identity, userRevokedAt: now } },
    { ...f, identity: { ...f.identity, sessionRevokedAt: now } },
    { ...f, identity: { ...f.identity, clientRevokedAt: now } },
    { ...f, identity: { ...f.identity, idleExpiresAt: now } },
    { ...f, identity: { ...f.identity, absoluteExpiresAt: now } },
    { ...f, identity: { ...f.identity, reauthUntil: now } },
    { ...f, identity: { ...f.identity, reauthUntil: null } },
    { ...f, member: { ...f.member, projectId: controllerId } },
    { ...f, member: { ...f.member, userId: controllerId } },
    { ...f, member: { ...f.member, revokedAt: now } },
    { ...f, control: null }, { ...f, control: { ...f.control, projectId: controllerId } },
    { ...f, control: { ...f.control, revokedAt: now } },
    { ...f, control: { ...f.control, generation: 6 } },
    { ...f, control: { ...f.control, version: 9 } },
    { ...f, control: { ...f.control, actorId } },
    { ...f, control: { ...f.control, clientId } },
  ]) assert.throws(() => check(payload(), bad));
  assert.throws(() => check({ ...payload(), targetActorRef: { userId: controllerId } }));
  assert.throws(() => check({ ...payload(), targetClientRef: { userId: actorId, clientId: controllerClientId } }));
  assert.throws(() => check({ ...payload(), baseControl: { ...payload().baseControl, clientId } }));
});
