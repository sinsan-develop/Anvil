import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalJson, contentHash } from '../../../contracts/canonical.ts';

const source: any = await import('../../../apps/server/modules/control-handoff/control-request-store.ts').catch((error: NodeJS.ErrnoException) => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
  throw error;
});
const projectId = '11111111-1111-4111-8111-111111111111';
const actorId = '22222222-2222-4222-8222-222222222222';
const clientId = '33333333-3333-4333-8333-333333333333';
const controllerId = '44444444-4444-4444-8444-444444444444';
const controllerClientId = '55555555-5555-4555-8555-555555555555';
const requestId = '66666666-6666-4666-8666-666666666666';
const commandId = '77777777-7777-4777-8777-777777777777';
const now = '2026-10-25T08:00:00.000Z';
const expiresAt = '2026-10-25T08:30:00.000Z';
const clone = <T>(value: T): T => structuredClone(value);
const payload = (): any => ({
  targetActorRef: { userId: actorId }, targetClientRef: { userId: actorId, clientId },
  baseControl: { actorId: controllerId, clientId: controllerClientId, generation: 5, version: 8 },
  reason: '  인수 요청 원문  ', expiresAt
});
const command = (): any => ({ schemaVersion: 1, operation: 'requestControl', commandId, projectId, clientId, payload: payload() });
const facts = (): any => ({
  projectId, now,
  identity: { actorId, clientId, credentialGeneration: 3, currentCredentialGeneration: 3,
    sessionRevokedAt: null, idleExpiresAt: expiresAt, absoluteExpiresAt: '2026-10-25T09:00:00.000Z',
    userActive: true, userRevokedAt: null, clientUserId: actorId, clientRevokedAt: null,
    reauthUntil: '2026-10-25T09:00:00.000Z' },
  member: { projectId, userId: actorId, participation: 'OWNER', revokedAt: null },
  control: { projectId, actorId: controllerId, clientId: controllerClientId, generation: 5, version: 8, revokedAt: null }
});
type Rows = { requests: Map<string, any>; commands: Map<string, any>; receipts: any[]; audits: any[] };
const emptyRows = (): Rows => ({ requests: new Map(), commands: new Map(), receipts: [], audits: [] });
const copyRows = (rows: Rows): Rows => ({
  requests: new Map([...rows.requests].map(([key, value]) => [key, clone(value)])),
  commands: new Map([...rows.commands].map(([key, value]) => [key, clone(value)])),
  receipts: clone(rows.receipts), audits: clone(rows.audits)
});

/** 외부 DB가 아니라 같은 트랜잭션의 직렬화·rollback 경계를 흉내 내는 시험 포트다. */
class FakePort {
  readonly sourceMode = 'TEST_FAKE';
  rows: Rows = emptyRows();
  current = facts();
  project: any = { id: projectId, archivedAt: null };
  failAt: string | null = null;
  onFinalObserve: (() => void) | null = null;
  onBundle: ((bundle: any) => void) | null = null;
  writes = 0;
  attempts = 0;
  private chain: Promise<void> = Promise.resolve();

  async transaction<T>(work: (tx: any) => Promise<T>): Promise<T> {
    let release!: () => void;
    const prior = this.chain;
    this.chain = new Promise<void>(resolve => { release = resolve; });
    await prior;
    this.attempts++;
    const staged = copyRows(this.rows);
    let observed = 0;
    let stagedWrites = 0;
    const inject = (step: string): void => { if (this.failAt === step) throw new Error(`INJECTED_${step}`); };
    const tx = {
      observe: async () => {
        observed++;
        if (observed > 1) this.onFinalObserve?.();
        inject('observe');
        return clone({ project: this.project, access: this.current });
      },
      lockCommand: async (id: string) => { inject('lockCommand'); return clone(staged.commands.get(id) ?? null); },
      allocateRequestId: async () => { inject('allocateRequestId'); return requestId; },
      insertRequest: async (row: any) => {
        inject('insertRequest');
        if (staged.requests.has(row.requestRef.id)) throw new Error('REQUEST_ID_CONFLICT');
        staged.requests.set(row.requestRef.id, clone(row)); stagedWrites++;
      },
      insertCommand: async (row: any) => {
        inject('insertCommand');
        if (staged.commands.has(row.commandId)) throw new Error('COMMAND_ID_CONFLICT');
        staged.commands.set(row.commandId, clone(row)); stagedWrites++;
      },
      insertReceipt: async (row: any) => {
        inject('insertReceipt');
        if (staged.receipts.some(item => item.commandId === row.commandId)) throw new Error('RECEIPT_ID_CONFLICT');
        staged.receipts.push(clone(row)); stagedWrites++;
      },
      insertAudit: async (row: any) => {
        inject('insertAudit');
        if (staged.audits.some(item => item.commandId === row.commandId)) throw new Error('AUDIT_ID_CONFLICT');
        staged.audits.push(clone(row)); stagedWrites++;
      },
      readBundle: async (id: string) => {
        inject('readBundle');
        const saved = staged.commands.get(id);
        const bundle = { request: saved ? staged.requests.get(saved.requestRef.id) ?? null : null,
          command: saved ?? null, receipts: staged.receipts.filter(item => item.commandId === id),
          audits: staged.audits.filter(item => item.commandId === id) };
        this.onBundle?.(bundle);
        return clone(bundle);
      }
    };
    try {
      const result = await work(tx);
      inject('commit');
      this.rows = staged;
      this.writes += stagedWrites;
      // 응답만 유실된 확정 결과를 별도로 모사한다. 다음 시도는 호출자가 명시해야 한다.
      inject('commitUnknown');
      return result;
    } finally { release(); }
  }
}

async function run(port?: FakePort, value: any = command()): Promise<any> {
  assert.equal(typeof source.requestControl, 'function');
  return source.requestControl(value, port);
}
async function saved(): Promise<FakePort> { const port = new FakePort(); await run(port); return port; }
const rowCount = (port: FakePort) => [port.rows.requests.size, port.rows.commands.size, port.rows.receipts.length, port.rows.audits.length];

test('실제 저장 adapter의 기본값은 미연결이고 호출 명령 식별자를 오류에 남긴다', async () => {
  assert.equal(typeof source.requestControl, 'function');
  await assert.rejects(run(undefined), (error: any) => error.code === 'CONTROL_REQUEST_NOT_CONNECTED' && error.commandId === commandId);
});

test('현재 OWNER 또는 적격 참여자의 SELF 요청만 네 종류의 불변 원문으로 저장한다', async () => {
  assert.equal(typeof source.requestControl, 'function');
  for (const role of ['OWNER', 'HANDOFF_ELIGIBLE']) {
    const port = new FakePort(); port.current.member.participation = role;
    const beforeControl = clone(port.current.control), raw = command(), beforeCommand = clone(raw);
    const result = await run(port, raw);
    assert.deepEqual(rowCount(port), [1, 1, 1, 1]);
    assert.deepEqual(port.current.control, beforeControl); assert.deepEqual(raw, beforeCommand);
    assert.deepEqual(result.requestRef, { id: requestId, version: 1,
      contentHash: contentHash(canonicalJson(result.snapshot)) });
    assert.equal(result.snapshot.reason, raw.payload.reason);
    assert.equal(result.snapshot.storedState, 'PENDING');
    assert.equal(result.snapshot.executionAuthorized, false); assert.equal(result.snapshot.controlTransferred, false);
    assert.equal(port.rows.commands.get(commandId).commandId, commandId);
    assert.equal(port.rows.receipts[0].requestRef.id, requestId);
    assert.equal(port.rows.audits[0].requestRef.id, requestId);
  }
});

test('현재 project 실존·archived null과 내부 command의 정확 스키마를 강제한다', async () => {
  assert.equal(typeof source.requestControl, 'function');
  for (const project of [null, { id: projectId, archivedAt: now }, { id: controllerId, archivedAt: null }]) {
    const port = new FakePort(); port.project = project;
    await assert.rejects(run(port)); assert.deepEqual(rowCount(port), [0, 0, 0, 0]);
  }
  for (const value of [
    { ...command(), schemaVersion: 2 }, { ...command(), operation: 'acceptControl' },
    { ...command(), commandId: 'wrong' }, { ...command(), projectId: controllerId },
    { ...command(), clientId: controllerClientId }, { ...command(), actorId },
    { ...command(), payload: { ...payload(), projectId } },
  ]) { const port = new FakePort(); await assert.rejects(run(port, value)); assert.deepEqual(rowCount(port), [0, 0, 0, 0]); }
});

test('동일 command의 정확 replay는 새 원문·receipt·audit 없이 현재 사실을 다시 확인한다', async () => {
  assert.equal(typeof source.requestControl, 'function');
  const port = await saved(); const before = copyRows(port.rows), writes = port.writes;
  const second = await run(port);
  assert.deepEqual(second.requestRef, port.rows.requests.get(requestId).requestRef);
  assert.deepEqual(port.rows, before); assert.equal(port.writes, writes);
  for (const alter of [
    { ...command(), payload: { ...payload(), reason: '변조' } },
    { ...command(), clientId: controllerClientId },
    { ...command(), payload: { ...payload(), baseControl: { ...payload().baseControl, generation: 6 } } },
  ]) await assert.rejects(run(port, alter));
  assert.deepEqual(port.rows, before); assert.equal(port.writes, writes);
  port.current.identity.sessionRevokedAt = now;
  await assert.rejects(run(port));
  port.current.identity.sessionRevokedAt = null; port.current.now = expiresAt;
  await assert.rejects(run(port));
  assert.deepEqual(port.rows, before); assert.equal(port.writes, writes);
});

test('같은 port의 동시 동일 명령은 직렬 잠금으로 네 종류를 한 번만 기록한다', async () => {
  assert.equal(typeof source.requestControl, 'function');
  const port = new FakePort();
  const results = await Promise.all([run(port), run(port)]);
  assert.deepEqual(results[0], results[1]);
  assert.deepEqual(rowCount(port), [1, 1, 1, 1]); assert.equal(port.writes, 4);
});

test('저장된 원문·metadata·명령 결박·receipt·audit의 누락과 변조를 replay에서 거절한다', async () => {
  assert.equal(typeof source.requestControl, 'function');
  const corruptions: ((port: FakePort) => void)[] = [
    port => { port.rows.requests.get(requestId).snapshot.reason = '변조'; },
    port => { port.rows.requests.get(requestId).metadata.reason = '변조'; },
    port => { port.rows.requests.get(requestId).requestRef.contentHash = '0'.repeat(64); },
    port => { port.rows.commands.get(commandId).commandHash = '0'.repeat(64); },
    port => { port.rows.commands.get(commandId).requestRef.id = controllerId; },
    port => { port.rows.receipts[0].requestRef.id = controllerId; },
    port => { port.rows.audits[0].commandHash = '0'.repeat(64); },
    port => { port.rows.receipts.length = 0; },
    port => { port.rows.audits.length = 0; },
    port => { port.rows.receipts.push(clone(port.rows.receipts[0])); },
    port => { port.rows.audits.push(clone(port.rows.audits[0])); },
    port => { port.rows.requests.delete(requestId); },
  ];
  for (const corrupt of corruptions) {
    const port = await saved(); corrupt(port); const before = copyRows(port.rows), writes = port.writes;
    await assert.rejects(run(port));
    assert.deepEqual(port.rows, before); assert.equal(port.writes, writes);
  }
});

test('중간 삽입·최종 bundle 확인·확정 commit 실패는 부분 저장을 남기지 않는다', async () => {
  assert.equal(typeof source.requestControl, 'function');
  for (const stage of ['allocateRequestId', 'insertRequest', 'insertCommand', 'insertReceipt', 'insertAudit', 'readBundle', 'commit']) {
    const port = new FakePort(); port.failAt = stage;
    await assert.rejects(run(port), (error: any) => error.commandId === commandId);
    assert.deepEqual(rowCount(port), [0, 0, 0, 0]); assert.equal(port.writes, 0); assert.equal(port.attempts, 1);
  }
});

test('확정 결과 불명은 자동 재시도하지 않고 commandId를 남기며 명시 재확인만 같은 bundle을 반환한다', async () => {
  assert.equal(typeof source.requestControl, 'function');
  const port = new FakePort(); port.failAt = 'commitUnknown';
  await assert.rejects(run(port), (error: any) => error.commandId === commandId);
  assert.deepEqual(rowCount(port), [1, 1, 1, 1]);
  assert.equal(port.writes, 4); assert.equal(port.attempts, 1);
  const before = copyRows(port.rows);
  port.failAt = null;
  const confirmation = await run(port);
  assert.deepEqual(confirmation.requestRef, before.requests.get(requestId).requestRef);
  assert.deepEqual(port.rows, before); assert.equal(port.writes, 4); assert.equal(port.attempts, 2);
});

test('고아 요청·명령·receipt·audit는 같은 ID의 새 기록으로 덮거나 채우지 않고 원문을 보존한다', async () => {
  assert.equal(typeof source.requestControl, 'function');
  const orphans: ((rows: Rows) => void)[] = [
    rows => { rows.commands.clear(); rows.receipts = []; rows.audits = []; },
    rows => { rows.requests.clear(); },
    rows => { rows.requests.clear(); rows.commands.clear(); rows.audits = []; },
    rows => { rows.requests.clear(); rows.commands.clear(); rows.receipts = []; },
  ];
  for (const orphan of orphans) {
    const port = await saved(); orphan(port.rows);
    const before = copyRows(port.rows), writes = port.writes;
    await assert.rejects(run(port), (error: any) => error.commandId === commandId);
    assert.deepEqual(port.rows, before); assert.equal(port.writes, writes);
  }
});

test('마지막 재관측에서 인증 회수·제어 기준 변경·project 폐기를 발견하면 rollback한다', async () => {
  assert.equal(typeof source.requestControl, 'function');
  for (const change of [
    (port: FakePort) => { port.current.identity.userActive = false; },
    (port: FakePort) => { port.current.identity.reauthUntil = now; },
    (port: FakePort) => { port.current.control.generation = 6; },
    (port: FakePort) => { port.project.archivedAt = now; },
  ]) {
    const port = new FakePort(); port.onFinalObserve = () => { change(port); port.onFinalObserve = null; };
    await assert.rejects(run(port));
    assert.deepEqual(rowCount(port), [0, 0, 0, 0]); assert.equal(port.writes, 0);
  }
});

test('TEST_FAKE 이외 sourceMode·누락 mode는 transaction을 호출하지 않고 미연결로 닫는다', async () => {
  assert.equal(typeof source.requestControl, 'function');
  for (const mode of ['CONNECTED', '', null, undefined]) {
    const port: any = new FakePort();
    if (mode === undefined) delete port.sourceMode;
    else port.sourceMode = mode;
    await assert.rejects(run(port), (error: any) =>
      error.code === 'CONTROL_REQUEST_NOT_CONNECTED' && error.commandId === commandId);
    assert.equal(port.attempts, 0); assert.deepEqual(rowCount(port), [0, 0, 0, 0]);
  }
});

test('단위1의 허용된 입력·접근·snapshot 원인 코드만 원문 없이 보존한다', async () => {
  assert.equal(typeof source.requestControl, 'function');
  const cases: { expected: string; prepare: (port: FakePort) => any }[] = [
    { expected: 'CONTROL_REQUEST_INPUT_INVALID', prepare: () =>
      ({ ...command(), payload: { ...payload(), reason: 'password=abcd1234' } }) },
    { expected: 'CONTROL_REQUEST_ACCESS_DENIED', prepare: port => {
      port.current.identity.sessionRevokedAt = now; return command();
    } },
    { expected: 'CONTROL_REQUEST_SNAPSHOT_INVALID', prepare: port => {
      port.onBundle = bundle => { bundle.request.snapshot.reason = '변조된 저장 원문'; };
      return command();
    } },
  ];
  for (const item of cases) {
    const port = new FakePort(); const value = item.prepare(port);
    await assert.rejects(run(port, value), (error: any) => {
      assert.equal(error.code, item.expected);
      assert.equal(error.commandId, commandId);
      assert.equal(error.message, item.expected);
      assert.equal(Object.hasOwn(error, 'cause'), false);
      assert.equal(error.message.includes('password=abcd1234'), false);
      assert.equal(error.message.includes(payload().reason), false);
      return true;
    });
    assert.deepEqual(rowCount(port), [0, 0, 0, 0]);
  }
});
