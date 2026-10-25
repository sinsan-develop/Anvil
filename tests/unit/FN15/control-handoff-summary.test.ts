import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalJson, contentHash } from '../../../contracts/canonical.ts';
import { baseControl, controller, controllerClient, copy, evidenceRef, now,
  otherProject, projectId, requestBundle, requestExpiresAt } from './control-handoff-summary-fixture.ts';

const module: Record<string, unknown> = await import(
  '../../../apps/server/modules/control-handoff/control-handoff-summary.ts'
).catch((error: NodeJS.ErrnoException) => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
  throw error;
});
const categories = ['activeExecutions', 'pendingCommands', 'pendingApprovals', 'sourceCheckpointRefs'] as const;
const empty = () => ({ status: 'EMPTY_SYNTHETIC', observedAt: now,
  reasonCode: 'SYNTHETIC_EMPTY', refs: [] as Array<{projectId: string; ref: typeof evidenceRef}> });
const source = () => ({ projectId, requestRef: copy(requestBundle().request.requestRef), version: 1,
  controller: { actorId: controller, clientId: controllerClient,
    generation: baseControl.generation, version: baseControl.version },
  baseControl: copy(baseControl), observedAt: now, requestExpiresAt,
  collections: { activeExecutions: empty(), pendingCommands: empty(),
    pendingApprovals: empty(), sourceCheckpointRefs: empty() } });

function create(value: unknown): unknown {
  const fn = module.createControlHandoffSummary as (input: unknown) => unknown;
  return fn(value);
}
function verify(value: unknown, basis: unknown): unknown {
  const fn = module.verifyControlHandoffSummary as (record: unknown, expected: unknown) => unknown;
  return fn(value, basis);
}

test('합성 빈 관측도 SAFE가 아니며 실수집과 대상 자격의 gap을 보존한다', () => {
  assert.equal(typeof module.createControlHandoffSummary, 'function');
  const made = create(source()) as { summaryRef: { id: string; version: number; contentHash: string };
    body: Record<string, unknown>; metadata: Record<string, unknown> };
  assert.equal(made.summaryRef.id, requestBundle().request.requestRef.id);
  assert.equal(made.summaryRef.version, 1);
  assert.equal(made.summaryRef.contentHash, contentHash(canonicalJson(made.body)));
  assert.equal(made.body.safetyState, 'UNVERIFIED');
  assert.equal(made.body.sourceMode, 'SYNTHETIC_ONLY');
  for (const flag of ['realCollectorsConnected', 'acceptanceEnabled',
    'executionAuthorized', 'controlTransferred']) assert.equal(made.body[flag], false);
  const gaps = made.body.gaps as string[];
  assert.ok(gaps.includes('REAL_COLLECTOR_NOT_CONNECTED'));
  assert.ok(gaps.includes('TARGET_ELIGIBILITY_UNVERIFIED'));
  assert.equal(made.body.validUntil, requestExpiresAt);
  assert.deepEqual(verify(made, source()), made.body);
});

test('알려진 미결 ref는 WAITING이며 네 범주를 각각 보존한다', () => {
  assert.equal(typeof module.createControlHandoffSummary, 'function');
  const input = source();
  input.collections.activeExecutions = { status: 'SYNTHETIC_OBSERVED', observedAt: now,
    reasonCode: 'SYNTHETIC_REFS', refs: [{ projectId, ref: copy(evidenceRef) }] };
  const made = create(input) as { body: Record<string, unknown> };
  assert.equal(made.body.safetyState, 'WAITING');
  for (const category of categories) {
    const part = made.body[category] as { status: string; observedAt: string; refs: unknown[] };
    assert.equal(part.observedAt, now);
    assert.equal(part.status, category === 'activeExecutions' ? 'SYNTHETIC_OBSERVED' : 'EMPTY_SYNTHETIC');
  }
  assert.deepEqual((made.body.activeExecutions as {refs: unknown[]}).refs,
    [{ projectId, ref: evidenceRef }]);
});

test('체크포인트 참조만 있을 때는 미결 실행으로 추론하지 않는다', () => {
  assert.equal(typeof module.createControlHandoffSummary, 'function');
  const input = source();
  input.collections.sourceCheckpointRefs = { status: 'SYNTHETIC_OBSERVED', observedAt: now,
    reasonCode: 'SYNTHETIC_REFS', refs: [{ projectId, ref: copy(evidenceRef) }] };
  const made = create(input) as { body: Record<string, unknown> };
  assert.equal(made.body.safetyState, 'UNVERIFIED');
});

test('유효한 부분 참조는 보존하되 누락을 명시하고 WAITING으로 분류한다', () => {
  assert.equal(typeof module.createControlHandoffSummary, 'function');
  const input = source();
  input.collections.pendingApprovals = { status: 'UNVERIFIED', observedAt: now,
    reasonCode: 'COLLECTION_PARTIAL', refs: [{ projectId, ref: copy(evidenceRef) }] };
  const made = create(input) as { body: Record<string, unknown> };
  assert.equal(made.body.safetyState, 'WAITING');
  assert.ok((made.body.gaps as string[]).includes('COLLECTION_PARTIAL'));
  assert.deepEqual((made.body.pendingApprovals as {refs: unknown[]}).refs,
    [{ projectId, ref: evidenceRef }]);
});

test('타 프로젝트·잘못된 참조·미래 관측과 알 수 없는 상태를 거절한다', () => {
  assert.equal(typeof module.createControlHandoffSummary, 'function');
  for (const mutate of [
    (input: ReturnType<typeof source>) => { input.collections.pendingCommands.refs =
      [{ projectId: otherProject, ref: copy(evidenceRef) }]; },
    (input: ReturnType<typeof source>) => { input.collections.pendingCommands.refs =
      [{ projectId, ref: { ...copy(evidenceRef), id: 'not-a-uuid' } }]; },
    (input: ReturnType<typeof source>) => { input.collections.pendingCommands.refs =
      [{ projectId, ref: { ...copy(evidenceRef), contentHash: 'bad' } }]; },
    (input: ReturnType<typeof source>) => { input.collections.pendingCommands.observedAt =
      '2026-10-25T09:00:01.000Z'; },
    (input: ReturnType<typeof source>) => { input.collections.pendingCommands.status = 'SAFE'; }
  ]) {
    const input = source(); mutate(input);
    assert.throws(() => create(input));
  }
});

test('범주당 200과 전체 2MiB를 넘기면 안전 빈 결과로 바꾸지 않는다', () => {
  assert.equal(typeof module.createControlHandoffSummary, 'function');
  const tooMany = source();
  tooMany.collections.pendingCommands.refs = Array.from({ length: 201 }, () =>
    ({ projectId, ref: copy(evidenceRef) }));
  const result = create(tooMany) as { body: Record<string, unknown> };
  const part = result.body.pendingCommands as { status: string; reasonCode: string; refs: unknown[] };
  assert.equal(part.status, 'UNVERIFIED');
  assert.equal(part.reasonCode, 'COLLECTION_LIMIT_EXCEEDED');
  assert.equal(part.refs.length, 0);
  assert.ok((result.body.gaps as string[]).includes('COLLECTION_LIMIT_EXCEEDED'));
});

test('한 범주 과다는 다른 범주의 미결 참조를 지우지 않고 WAITING을 유지한다', () => {
  assert.equal(typeof module.createControlHandoffSummary, 'function');
  const input = source();
  input.collections.activeExecutions = { status: 'SYNTHETIC_OBSERVED', observedAt: now,
    reasonCode: 'SYNTHETIC_REFS', refs: [{ projectId, ref: copy(evidenceRef) }] };
  const oversized = { ...input, collections: { ...input.collections,
    pendingCommands: 'x'.repeat(2 * 1024 * 1024 + 1) } };
  const result = create(oversized) as { body: Record<string, unknown> };
  assert.equal(result.body.safetyState, 'WAITING');
  assert.deepEqual((result.body.activeExecutions as {refs: unknown[]}).refs,
    [{ projectId, ref: evidenceRef }]);
  assert.equal((result.body.pendingCommands as {status: string}).status, 'UNVERIFIED');
  assert.ok((result.body.gaps as string[]).includes('COLLECTION_LIMIT_EXCEEDED'));
});

test('한 범주 과다는 다른 범주의 타 프로젝트 참조를 검증 전에 숨기지 않는다', () => {
  assert.equal(typeof module.createControlHandoffSummary, 'function');
  const input = source();
  input.collections.pendingApprovals = { status: 'SYNTHETIC_OBSERVED', observedAt: now,
    reasonCode: 'SYNTHETIC_REFS', refs: [{ projectId: otherProject, ref: copy(evidenceRef) }] };
  const oversized = { ...input, collections: { ...input.collections,
    pendingCommands: 'x'.repeat(2 * 1024 * 1024 + 1) } };
  assert.throws(() => create(oversized));
});

test('한 범주 과다는 다른 범주의 잘못된 참조 형식을 검증 전에 숨기지 않는다', () => {
  assert.equal(typeof module.createControlHandoffSummary, 'function');
  const input = source();
  input.collections.pendingApprovals = { status: 'SYNTHETIC_OBSERVED', observedAt: now,
    reasonCode: 'SYNTHETIC_REFS', refs: [{ projectId,
      ref: { ...copy(evidenceRef), id: 'not-a-uuid' } }] };
  const oversized = { ...input, collections: { ...input.collections,
    pendingCommands: 'x'.repeat(2 * 1024 * 1024 + 1) } };
  assert.throws(() => create(oversized));
});

test('본문·metadata·ref를 같은 값으로 다시 hash한 변조도 원 요청 관계에서 거절한다', () => {
  assert.equal(typeof module.verifyControlHandoffSummary, 'function');
  const input = source();
  const original = create(input);
  assert.deepEqual(verify(original, input), (original as {body: unknown}).body);
  const bodyChanged = copy(original) as { body: Record<string, unknown>;
    summaryRef: {id: string; version: number; contentHash: string}; metadata: Record<string, unknown> };
  bodyChanged.body.acceptanceEnabled = true;
  bodyChanged.summaryRef.contentHash = contentHash(canonicalJson(bodyChanged.body));
  assert.throws(() => verify(bodyChanged, input));
  const idChanged = copy(original) as typeof bodyChanged;
  idChanged.summaryRef.id = 'not-a-uuid';
  idChanged.body.requestRef = { ...requestBundle().request.requestRef, id: 'not-a-uuid' };
  idChanged.metadata.requestRef = copy(idChanged.body.requestRef);
  idChanged.summaryRef.contentHash = contentHash(canonicalJson(idChanged.body));
  assert.throws(() => verify(idChanged, input));
});
