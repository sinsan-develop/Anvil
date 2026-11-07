import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalJson, contentHash } from '../../../contracts/canonical.ts';
import { baseControl, controller, controllerClient, copy, evidenceRef, now, observation,
  otherProject, prepareCommand, projectId, requestBundle, requester,
  requesterClient } from './control-handoff-summary-fixture.ts';

const module: Record<string, unknown> = await import(
  '../../../apps/server/modules/control-handoff/control-handoff-summary-store.ts'
).catch((error: NodeJS.ErrnoException) => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
  throw error;
});
type Row = Record<string, unknown>;
type Bundle = { summary: Row | null; command: Row | null; receipts: Row[]; audits: Row[] };
const categoryNames = ['activeExecutions', 'pendingCommands', 'pendingApprovals', 'sourceCheckpointRefs'] as const;
const empty = () => ({ status: 'EMPTY_SYNTHETIC', observedAt: now,
  reasonCode: 'SYNTHETIC_EMPTY', refs: [] as Array<{projectId: string; ref: typeof evidenceRef}> });
const state = () => ({ summaries: [] as Row[], commands: [] as Row[],
  receipts: [] as Row[], audits: [] as Row[] });

class FakePort {
  readonly sourceMode = 'TEST_FAKE';
  current = observation();
  request = requestBundle();
  stored = state();
  collections: Record<string, unknown> = Object.fromEntries(categoryNames.map(name => [name, empty()]));
  collectionCalls = 0;
  writeCalls = 0;
  observeCalls = 0;
  transactionCalls = 0;
  onObserve: ((count: number) => void) | null = null;
  onCollect: (() => void) | null = null;
  onReadSummary: ((bundle: Bundle) => void) | null = null;
  failInsert: 'summary' | 'command' | 'receipt' | 'audit' | null = null;
  unknownCommit = false;

  async transaction<T>(work: (tx: Row) => Promise<T>): Promise<T> {
    this.transactionCalls++;
    const working = copy(this.stored);
    const tx = {
      observe: async () => {
        this.observeCalls++;
        this.onObserve?.(this.observeCalls);
        return copy(this.current);
      },
      readRequestBundleByRef: async () => copy(this.request),
      lockCommand: async (commandId: string) => copy(working.commands.find(row => row.commandId === commandId) ?? null),
      lockRequestVersion: async () => working.summaries.length,
      collect: async (category: string) => {
        this.collectionCalls++;
        this.onCollect?.();
        const value = this.collections[category];
        if (value === 'THROW') throw new Error('secret raw collector exception');
        return copy(value);
      },
      insertSummary: async (row: Row) => {
        this.writeCalls++;
        if (this.failInsert === 'summary') throw new Error('secret raw write exception');
        working.summaries.push(copy(row));
      },
      insertCommand: async (row: Row) => {
        this.writeCalls++;
        if (this.failInsert === 'command') throw new Error('secret raw write exception');
        working.commands.push(copy(row));
      },
      insertReceipt: async (row: Row) => {
        this.writeCalls++;
        if (this.failInsert === 'receipt') throw new Error('secret raw write exception');
        working.receipts.push(copy(row));
      },
      insertAudit: async (row: Row) => {
        this.writeCalls++;
        if (this.failInsert === 'audit') throw new Error('secret raw write exception');
        working.audits.push(copy(row));
      },
      readSummaryBundle: async (commandId: string): Promise<Bundle> => {
        const row = working.commands.find(item => item.commandId === commandId) ?? null;
        const summary = working.summaries.find(item =>
          (item.summaryRef as {version?: number} | undefined)?.version ===
          (row?.summaryRef as {version?: number} | undefined)?.version) ?? null;
        const bundle: Bundle = { summary: copy(summary), command: copy(row),
          receipts: copy(working.receipts.filter(item => item.commandId === commandId)),
          audits: copy(working.audits.filter(item => item.commandId === commandId)) };
        this.onReadSummary?.(bundle);
        return bundle;
      },
      readSummaryBundleByRef: async (ref: {id: string; version: number}): Promise<Bundle> => {
        const row = working.commands.find(item =>
          (item.summaryRef as {id?: string; version?: number} | undefined)?.id === ref.id
          && (item.summaryRef as {version?: number} | undefined)?.version === ref.version) ?? null;
        const summary = working.summaries.find(item =>
          (item.summaryRef as {id?: string; version?: number} | undefined)?.id === ref.id
          && (item.summaryRef as {version?: number} | undefined)?.version === ref.version) ?? null;
        const bundle: Bundle = { summary: copy(summary), command: copy(row),
          receipts: copy(working.receipts.filter(item => item.commandId === row?.commandId)),
          audits: copy(working.audits.filter(item => item.commandId === row?.commandId)) };
        this.onReadSummary?.(bundle);
        return bundle;
      }
    };
    const result = await work(tx);
    this.stored = working;
    if (this.unknownCommit) throw new Error('COMMIT_OUTCOME_UNKNOWN');
    return result;
  }
}

function prepare(value: unknown, port: unknown): Promise<Row> {
  const fn = module.prepareControlHandoff as (command: unknown, port: unknown) => Promise<Row>;
  return fn(value, port);
}
function read(value: unknown, port: FakePort): Promise<Row> {
  const fn = module.readControlHandoffSummary as (input: unknown, port: unknown) => Promise<Row>;
  return fn(value, port);
}
const readInput = (port: FakePort, ref?: {id: string; version: number; contentHash: string}) =>
  ({ projectId, requestRef: copy(port.request.request.requestRef),
    summaryRef: copy(ref ?? port.stored.summaries[0]?.summaryRef) });

test('기본 adapter는 미연결이고 정확 현재 제어자만 요약을 만든다', async () => {
  assert.equal(typeof module.prepareControlHandoff, 'function');
  await assert.rejects(prepare(prepareCommand(), { sourceMode: 'NOT_CONNECTED' }));
  const port = new FakePort();
  const result = await prepare(prepareCommand(), port);
  assert.equal(result.body && (result.body as Row).safetyState, 'UNVERIFIED');
  assert.equal((result.body as Row).sourceMode, 'SYNTHETIC_ONLY');
  assert.equal((result.body as Row).acceptanceEnabled, false);
  assert.equal((result.body as Row).executionAuthorized, false);
  assert.equal((result.body as Row).controlTransferred, false);
  assert.equal(port.collectionCalls, 4);
  assert.equal(port.stored.summaries.length, 1);
  assert.equal(port.stored.commands.length, 1);
  assert.equal(port.stored.receipts.length, 1);
  assert.equal(port.stored.audits.length, 1);
  assert.deepEqual(port.current.access.control, { projectId, ...baseControl, revokedAt: null });
});

test('요청자·적격 참여자는 읽을 수 있어도 요약 생성권을 얻지 못한다', async () => {
  assert.equal(typeof module.prepareControlHandoff, 'function');
  for (const role of ['OWNER', 'HANDOFF_ELIGIBLE'] as const) {
    const port = new FakePort();
    port.current = observation(requester, requesterClient);
    port.current.access.member.participation = role;
    await assert.rejects(prepare(prepareCommand(), port));
    assert.equal(port.collectionCalls, 0);
    assert.deepEqual(port.stored, state());
  }
});

test('명령·원 요청 참조의 내재 UUID/hash와 exact shape를 검사한다', async () => {
  assert.equal(typeof module.prepareControlHandoff, 'function');
  const original = prepareCommand();
  for (const changed of [
    { ...original, commandId: 'not-a-uuid' },
    { ...original, payload: { requestRef: { ...original.payload.requestRef, id: 'not-a-uuid' } } },
    { ...original, payload: { requestRef: { ...original.payload.requestRef, contentHash: 'bad' } } },
    { ...original, payload: { requestRef: original.payload.requestRef, extra: 'unsafe' } },
    { ...original, operation: 'acceptControl' }
  ]) {
    const port = new FakePort();
    await assert.rejects(prepare(changed, port));
    assert.deepEqual(port.stored, state());
  }
});

test('재인증 경계·회수·제어 version·원 요청 기한을 수집 전 거절한다', async () => {
  assert.equal(typeof module.prepareControlHandoff, 'function');
  for (const change of [
    (port: FakePort) => { port.current.access.identity.reauthUntil = now; },
    (port: FakePort) => { port.current.access.identity.clientRevokedAt = now; },
    (port: FakePort) => { port.current.access.member.revokedAt = now; },
    (port: FakePort) => { port.current.access.control!.version++; },
    (port: FakePort) => { port.current.access.now = '2026-10-25T09:00:20.000Z'; }
  ]) {
    const port = new FakePort(); change(port);
    await assert.rejects(prepare(prepareCommand(), port));
    assert.equal(port.collectionCalls, 0);
    assert.deepEqual(port.stored, state());
  }
});

test('실수집 미연결·누락·예외·한도 초과는 각각 gap이며 빈 안전 관측이 아니다', async () => {
  assert.equal(typeof module.prepareControlHandoff, 'function');
  const port = new FakePort();
  port.collections.activeExecutions = undefined;
  port.collections.pendingCommands = 'THROW';
  port.collections.pendingApprovals = { status: 'SYNTHETIC_OBSERVED', observedAt: now,
    reasonCode: 'SYNTHETIC_REFS', refs: Array.from({ length: 201 }, () =>
      ({ projectId, ref: copy(evidenceRef) })) };
  const result = await prepare(prepareCommand(), port);
  const body = result.body as Row;
  assert.equal(body.safetyState, 'UNVERIFIED');
  assert.equal((body.activeExecutions as Row).status, 'UNVERIFIED');
  assert.equal((body.pendingCommands as Row).status, 'UNVERIFIED');
  assert.equal((body.pendingApprovals as Row).status, 'UNVERIFIED');
  const gaps = body.gaps as string[];
  for (const code of ['REAL_COLLECTOR_NOT_CONNECTED', 'TARGET_ELIGIBILITY_UNVERIFIED',
    'COLLECTOR_MISSING', 'COLLECTOR_ERROR', 'COLLECTION_LIMIT_EXCEEDED'])
    assert.ok(gaps.includes(code), `gap ${code}`);
  assert.equal(JSON.stringify(result).includes('secret raw collector exception'), false);
});

test('수집 원자료 전체가 2MiB를 넘으면 원문을 저장하지 않고 한도 gap으로 축약한다', async () => {
  assert.equal(typeof module.prepareControlHandoff, 'function');
  const port = new FakePort();
  port.collections.pendingCommands = 'x'.repeat(2 * 1024 * 1024 + 1);
  const result = await prepare(prepareCommand(), port);
  const body = result.body as Row;
  assert.equal((body.pendingCommands as Row).status, 'UNVERIFIED');
  assert.ok((body.gaps as string[]).includes('COLLECTION_LIMIT_EXCEEDED'));
  assert.equal(JSON.stringify(port.stored).includes('xxxx'), false);
});

test('유효한 합성 미결은 WAITING, 체크포인트만 있으면 UNVERIFIED다', async () => {
  assert.equal(typeof module.prepareControlHandoff, 'function');
  const pending = new FakePort();
  pending.collections.pendingCommands = { status: 'SYNTHETIC_OBSERVED', observedAt: now,
    reasonCode: 'SYNTHETIC_REFS', refs: [{ projectId, ref: copy(evidenceRef) }] };
  assert.equal(((await prepare(prepareCommand(), pending)).body as Row).safetyState, 'WAITING');
  const checkpoint = new FakePort();
  checkpoint.collections.sourceCheckpointRefs = { status: 'SYNTHETIC_OBSERVED', observedAt: now,
    reasonCode: 'SYNTHETIC_REFS', refs: [{ projectId, ref: copy(evidenceRef) }] };
  assert.equal(((await prepare(prepareCommand(), checkpoint)).body as Row).safetyState, 'UNVERIFIED');
});

test('타 프로젝트·잘못된 ref/형식은 조용히 필터링하지 않고 transaction 전체를 거절한다', async () => {
  assert.equal(typeof module.prepareControlHandoff, 'function');
  for (const value of [
    { status: 'SYNTHETIC_OBSERVED', observedAt: now, reasonCode: 'SYNTHETIC_REFS',
      refs: [{ projectId: otherProject, ref: evidenceRef }] },
    { status: 'SYNTHETIC_OBSERVED', observedAt: now, reasonCode: 'SYNTHETIC_REFS',
      refs: [{ projectId, ref: { ...evidenceRef, version: 0 } }] },
    { status: 'SAFE', observedAt: now, reasonCode: 'SYNTHETIC_REFS', refs: [] }
  ]) {
    const port = new FakePort();
    port.collections.activeExecutions = value;
    await assert.rejects(prepare(prepareCommand(), port));
    assert.deepEqual(port.stored, state());
  }
});

test('수집 중 현재 actor/client/reauth/요청 원문이 변하면 전체 rollback한다', async () => {
  assert.equal(typeof module.prepareControlHandoff, 'function');
  for (const change of [
    (port: FakePort) => { port.current.access.identity.clientRevokedAt = now; },
    (port: FakePort) => { port.current.access.identity.reauthUntil = now; },
    (port: FakePort) => { port.current.access.control!.generation++; },
    (port: FakePort) => { port.request.request.snapshot.reason = '변조'; }
  ]) {
    const port = new FakePort();
    port.onCollect = () => { if (port.collectionCalls === 1) change(port); };
    await assert.rejects(prepare(prepareCommand(), port));
    assert.deepEqual(port.stored, state());
  }
});

test('새 명령은 요청별 version을 증가시키고 구버전 원문을 그대로 둔다', async () => {
  assert.equal(typeof module.prepareControlHandoff, 'function');
  const port = new FakePort();
  const first = await prepare(prepareCommand(), port);
  const old = copy(port.stored.summaries[0]);
  const next = { ...prepareCommand(), commandId: '88888888-8888-4888-8888-000000000002' };
  const second = await prepare(next, port);
  assert.equal((first.summaryRef as Row).version, 1);
  assert.equal((second.summaryRef as Row).version, 2);
  assert.deepEqual(port.stored.summaries[0], old);
  assert.equal(port.stored.summaries.length, 2);
  assert.equal((second.body as Row).validUntil, (first.body as Row).validUntil);
});

test('동일 명령은 권한 재검사 후 원 결과만 반환하고 수집·쓰기·기한 연장하지 않는다', async () => {
  assert.equal(typeof module.prepareControlHandoff, 'function');
  const port = new FakePort();
  const first = await prepare(prepareCommand(), port);
  const calls = [port.collectionCalls, port.writeCalls];
  const second = await prepare(prepareCommand(), port);
  assert.deepEqual(second, first);
  assert.deepEqual([port.collectionCalls, port.writeCalls], calls);
  port.current.access.identity.reauthUntil = now;
  await assert.rejects(prepare(prepareCommand(), port));
  assert.deepEqual([port.collectionCalls, port.writeCalls], calls);
});

test('같은 ID의 다른 payload·client·현재 기준 재사용을 거절한다', async () => {
  assert.equal(typeof module.prepareControlHandoff, 'function');
  const port = new FakePort();
  await prepare(prepareCommand(), port);
  const changed = prepareCommand();
  changed.payload.requestRef = { ...changed.payload.requestRef, contentHash: 'b'.repeat(64) };
  await assert.rejects(prepare(changed, port));
  port.current.access.control!.version++;
  await assert.rejects(prepare(prepareCommand(), port));
  assert.equal(port.stored.summaries.length, 1);
});

test('부분 쓰기·고아·4종 변조는 결과가 아니라 rollback으로 끝난다', async () => {
  assert.equal(typeof module.prepareControlHandoff, 'function');
  for (const kind of ['summary', 'command', 'receipt', 'audit'] as const) {
    const port = new FakePort(); port.failInsert = kind;
    await assert.rejects(prepare(prepareCommand(), port));
    assert.deepEqual(port.stored, state());
  }
  for (const mutate of [
    (bundle: Bundle) => { bundle.receipts = []; },
    (bundle: Bundle) => { bundle.audits[0]!.commandHash = 'b'.repeat(64); },
    (bundle: Bundle) => { bundle.command = null; },
    (bundle: Bundle) => { if (bundle.summary) bundle.summary.summaryRef =
      { ...(bundle.summary.summaryRef as Row), id: 'not-a-uuid' }; }
  ]) {
    const port = new FakePort(); port.onReadSummary = mutate;
    await assert.rejects(prepare(prepareCommand(), port));
    assert.deepEqual(port.stored, state());
  }
});

test('원 요청의 commandId와 연결 4종을 일관되게 변조해도 내재 UUID에서 거절한다', async () => {
  assert.equal(typeof module.prepareControlHandoff, 'function');
  const port = new FakePort();
  const badId = 'not-a-uuid';
  const row = port.request.command;
  row.commandId = badId;
  row.commandHash = contentHash(canonicalJson({ schemaVersion: 1, operation: 'requestControl',
    commandId: badId, projectId, clientId: requesterClient,
    payload: { targetActorRef: port.request.request.snapshot.targetActorRef,
      targetClientRef: port.request.request.snapshot.targetClientRef,
      baseControl: baseControl, reason: port.request.request.snapshot.reason,
      expiresAt: port.request.request.snapshot.expiresAt } }));
  for (const item of [...port.request.receipts, ...port.request.audits]) {
    item.commandId = badId;
    item.commandHash = row.commandHash;
  }
  await assert.rejects(prepare(prepareCommand(), port));
  assert.deepEqual(port.stored, state());
});

test('commit 결과 불명은 단발 실패와 원 commandId로 남고 자동 재실행하지 않는다', async () => {
  assert.equal(typeof module.prepareControlHandoff, 'function');
  const port = new FakePort(); port.unknownCommit = true;
  await assert.rejects(prepare(prepareCommand(), port), (error: unknown) => {
    const failure = error as {commandId?: string; message?: string};
    assert.equal(failure.commandId, prepareCommand().commandId);
    assert.equal(failure.message?.includes('secret'), false);
    return true;
  });
  assert.equal(port.transactionCalls, 1);
  assert.equal(port.stored.summaries.length, 1);
});

test('고정 summary 읽기는 본인 요청자·현재 제어자만 전체 조회한다', async () => {
  assert.equal(typeof module.readControlHandoffSummary, 'function');
  const port = new FakePort();
  await prepare(prepareCommand(), port);
  const input = readInput(port);
  const byController = await read(input, port);
  assert.equal((byController.body as Row).safetyState, 'UNVERIFIED');
  port.current = observation(requester, requesterClient);
  port.current.access.identity.reauthUntil = null;
  port.current.access.control = null;
  port.current.access.now = '2026-10-25T09:00:21.000Z';
  const byRequester = await read(input, port);
  assert.equal((byRequester.current as Row).expired, true);
  assert.equal((byRequester.current as Row).baseControlState, 'UNVERIFIED');
  assert.equal((byRequester.body as Row).acceptanceEnabled, false);
});

test('summary 읽기 전후 권한 회수·ref/4종 변조는 부분 결과 없이 거절한다', async () => {
  assert.equal(typeof module.readControlHandoffSummary, 'function');
  const port = new FakePort();
  await prepare(prepareCommand(), port);
  port.observeCalls = 0;
  port.onObserve = count => { if (count === 2) port.current.access.identity.clientRevokedAt = now; };
  await assert.rejects(read(readInput(port), port));
  port.onObserve = null; port.current = observation();
  await assert.rejects(read(readInput(port,
    { ...(port.stored.summaries[0]!.summaryRef as {id: string; version: number; contentHash: string}),
      contentHash: 'b'.repeat(64) }), port));
  port.onReadSummary = bundle => { bundle.audits = []; };
  await assert.rejects(read(readInput(port), port));
});
