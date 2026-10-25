import assert from 'node:assert/strict';
import test from 'node:test';
import { baseControl, controller, controllerClient, copy, now, observation,
  otherProject, projectId, requestBundle, requester, requesterClient } from '../../../tests/unit/FN15/control-handoff-summary-fixture.ts';

const loaded: Record<string, unknown> = await import(
  '../../../apps/server/modules/control-handoff/control-discovery-read.ts'
).catch((error: NodeJS.ErrnoException) => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
  throw error;
});
const original = requestBundle();
const requestRef = copy(original.request.requestRef);
const nextRef = { id: requestRef.id, version: 2, contentHash: 'b'.repeat(64) };
type Ref = { id: string; version: number; contentHash: string };
type HeadRow = { projectId: string; requestRef: Ref; summaryRef: Ref };

class FakeDiscoveryPort {
  readonly sourceMode = 'TEST_FAKE';
  current = observation();
  request = copy(original);
  head: HeadRow | null = null;
  reads = 0;
  observations = 0;
  headReads = 0;
  onSecondObserve: (() => void) | null = null;

  async transaction<T>(work: (tx: {
    observe(): Promise<unknown>;
    readRequestBundleByRef(ref: Ref): Promise<unknown>;
    readHeadSummaryRef(ref: Ref): Promise<unknown>;
  }) => Promise<T>): Promise<T> {
    return work({
      observe: async () => {
        this.observations++;
        if (this.observations === 2) this.onSecondObserve?.();
        return copy(this.current);
      },
      readRequestBundleByRef: async ref => {
        this.reads++;
        return ref.id === requestRef.id && ref.version === requestRef.version
          && ref.contentHash === requestRef.contentHash ? copy(this.request) : null;
      },
      readHeadSummaryRef: async ref => {
        this.headReads++;
        assert.deepEqual(ref, requestRef);
        return copy(this.head);
      }
    });
  }
}

function state(port: FakeDiscoveryPort, input: unknown = { projectId }): Promise<unknown> {
  assert.equal(typeof loaded.readControlState, 'function', 'control-state export가 있어야 한다');
  const callback = loaded.readControlState;
  if (typeof callback !== 'function') throw Error('MISSING_CONTROL_STATE_EXPORT');
  return Promise.resolve(callback(input, port));
}
function head(port: FakeDiscoveryPort, input: unknown = { projectId, requestRef }): Promise<unknown> {
  assert.equal(typeof loaded.readHandoffSummaryHead, 'function', 'head export가 있어야 한다');
  const callback = loaded.readHandoffSummaryHead;
  if (typeof callback !== 'function') throw Error('MISSING_HEAD_EXPORT');
  return Promise.resolve(callback(input, port));
}
function errorCode(value: unknown, code: string): boolean {
  return value instanceof Error && 'code' in value && value.code === code;
}

test('현재 제어 조회는 정확 version·시각·false flags를 반환하고 재인증 만료를 요구하지 않는다', async () => {
  const port = new FakeDiscoveryPort();
  port.current.access.identity.reauthUntil = '2026-10-25T08:00:00.000Z';
  const result = await state(port);
  assert.deepEqual(result, { schemaVersion: 1, projectId, observedAt: now,
    actorId: controller, clientId: controllerClient, participation: 'OWNER',
    control: { state: 'HELD', basis: baseControl },
    executionAuthorized: false, controlTransferred: false });
  assert.equal(port.observations, 2);
  assert.equal(port.reads, 0);
});

test('다른 현재 client, 정상 부재, 유효 회수, 손상은 서로 구분하고 basis를 만들지 않는다', async () => {
  const other = new FakeDiscoveryPort();
  other.current = observation(requester, requesterClient);
  other.current.access.member.participation = 'HANDOFF_ELIGIBLE';
  const otherResult = await state(other) as { control: { state: string; basis: unknown } };
  assert.equal(otherResult.control.state, 'OTHER_CLIENT');
  assert.deepEqual(otherResult.control.basis, baseControl);

  const absent = new FakeDiscoveryPort();
  absent.current.access.control = null;
  assert.deepEqual((await state(absent) as { control: unknown }).control,
    { state: 'UNASSIGNED', basis: null });

  const revoked = new FakeDiscoveryPort();
  if (revoked.current.access.control) revoked.current.access.control.revokedAt = now;
  assert.deepEqual((await state(revoked) as { control: unknown }).control,
    { state: 'UNASSIGNED', basis: null });

  const corrupt = new FakeDiscoveryPort();
  if (corrupt.current.access.control) corrupt.current.access.control.version = 0;
  await state(corrupt).then(value => {
    const control = (value as { control: { state: string; basis: unknown } }).control;
    assert.equal(control.state, 'UNVERIFIED');
    assert.equal(control.basis, null);
  }, error => assert.ok(errorCode(error, 'CONTROL_DISCOVERY_INVALID')
    || errorCode(error, 'CONTROL_DISCOVERY_FAILED')));
});

test('VIEWER·회원 회수·만료 세션·인증 세대 변경과 전후 제어 경합은 부분 결과 없이 거절한다', async () => {
  const viewer = new FakeDiscoveryPort();
  Object.assign(viewer.current.access.member, { participation: 'VIEWER' });
  await assert.rejects(state(viewer));
  const revoked = new FakeDiscoveryPort();
  revoked.current.access.member.revokedAt = now;
  await assert.rejects(state(revoked));
  const expired = new FakeDiscoveryPort();
  expired.current.access.identity.idleExpiresAt = now;
  await assert.rejects(state(expired));
  const generation = new FakeDiscoveryPort();
  generation.onSecondObserve = () => { generation.current.access.identity.currentCredentialGeneration = 4; };
  await assert.rejects(state(generation));
  const raced = new FakeDiscoveryPort();
  raced.onSecondObserve = () => {
    if (raced.current.access.control) raced.current.access.control.version = 9;
  };
  await assert.rejects(state(raced));
});

test('head는 정확 원요청이 있고 요약행이 확인된 부재에서만 NONE이다', async () => {
  const port = new FakeDiscoveryPort();
  port.current = observation(requester, requesterClient);
  port.current.access.member.participation = 'HANDOFF_ELIGIBLE';
  port.current.access.control = null;
  port.current.access.identity.reauthUntil = null;
  const result = await head(port);
  assert.deepEqual(result, { schemaVersion: 1, projectId, requestRef,
    observedAt: now, head: { state: 'NONE', summaryRef: null },
    executionAuthorized: false, controlTransferred: false });
  assert.equal(port.reads, 2);
  assert.equal(port.headReads, 1);
  assert.equal(port.observations, 2);
});

test('본인의 다른 client와 현재 제어자는 과거 base가 달라도 최신 불변 ref만 찾는다', async () => {
  for (const [actorId, clientId] of [[requester, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'],
    [controller, controllerClient]] as const) {
    const port = new FakeDiscoveryPort();
    port.current = observation(actorId, clientId);
    port.current.access.control = { projectId, actorId: controller, clientId: controllerClient,
      generation: 6, version: 9, revokedAt: null };
    port.head = { projectId, requestRef, summaryRef: nextRef };
    const result = await head(port) as { head: { state: string; summaryRef: Ref } };
    assert.equal(result.head.state, 'AVAILABLE');
    assert.deepEqual(result.head.summaryRef, nextRef);
  }
});

test('타인·타 프로젝트·위조 hash·손상 포인터·조회 중 제어 변경은 ref를 노출하지 않는다', async () => {
  const stranger = new FakeDiscoveryPort();
  stranger.current = observation('cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd');
  stranger.head = { projectId, requestRef, summaryRef: nextRef };
  await assert.rejects(head(stranger));
  await assert.rejects(head(new FakeDiscoveryPort(), { projectId: otherProject, requestRef }));
  await assert.rejects(head(new FakeDiscoveryPort(), { projectId,
    requestRef: { ...requestRef, contentHash: '0'.repeat(64) } }));
  const corrupt = new FakeDiscoveryPort();
  corrupt.head = { projectId: otherProject, requestRef, summaryRef: nextRef };
  await assert.rejects(head(corrupt));
  const raced = new FakeDiscoveryPort();
  raced.head = { projectId, requestRef, summaryRef: nextRef };
  raced.onSecondObserve = () => {
    if (raced.current.access.control) raced.current.access.control.version = 9;
  };
  await assert.rejects(head(raced));
});

test('미연결과 임의 source 예외는 NONE이나 원 예외로 둔갑하지 않는다', async () => {
  assert.equal(typeof loaded.readHandoffSummaryHead, 'function', 'head export가 있어야 한다');
  const callback = loaded.readHandoffSummaryHead;
  if (typeof callback !== 'function') throw Error('MISSING_HEAD_EXPORT');
  await assert.rejects(Promise.resolve(callback({ projectId, requestRef },
    { sourceMode: 'NOT_CONNECTED', async transaction() { throw Error('MUST_NOT_RUN'); } })),
  error => errorCode(error, 'CONTROL_DISCOVERY_NOT_CONNECTED'));
  await assert.rejects(Promise.resolve(callback({ projectId, requestRef },
    { sourceMode: 'TEST_FAKE', async transaction() { throw Error('raw secret'); } })),
  error => error instanceof Error && !error.message.includes('raw secret'));
});
