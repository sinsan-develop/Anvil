import assert from 'node:assert/strict';
import test from 'node:test';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { canonicalJson, contentHash } from '../../../contracts/canonical.ts';
import { createControlRequestSnapshot } from '../../../apps/server/modules/control-handoff/control-request-snapshot.ts';

const source: any = await import('../../../apps/server/modules/control-handoff/control-request-read.ts').catch((error: NodeJS.ErrnoException) => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
  throw error;
});
const projectId = '11111111-1111-4111-8111-111111111111';
const otherProject = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const requester = '22222222-2222-4222-8222-222222222222';
const requesterClient = '33333333-3333-4333-8333-333333333333';
const secondClient = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const controller = '44444444-4444-4444-8444-444444444444';
const controllerClient = '55555555-5555-4555-8555-555555555555';
const foreignActor = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const now = '2026-10-25T09:00:00.000Z';
const clone = <T>(value: T): T => structuredClone(value);
const id = (n: number): string => `66666666-6666-4666-8666-${String(n).padStart(12, '0')}`;
const commandId = (n: number): string => `77777777-7777-4777-8777-${String(n).padStart(12, '0')}`;
const basis = { actorId: controller, clientId: controllerClient, generation: 5, version: 8 };
const createdAt = (n: number): string => new Date(Date.parse('2026-10-25T08:00:00.000Z') + n * 1000).toISOString();

function makeBundle(n = 1, actorId = requester, project = projectId,
  madeAt = createdAt(n)): any {
  const clientId = actorId === requester ? requesterClient : secondClient;
  const payload = { targetActorRef: { userId: actorId }, targetClientRef: { userId: actorId, clientId },
    baseControl: clone(basis), reason: `원문 이유 ${n}`, expiresAt: new Date(Date.parse(madeAt) + 30 * 60_000).toISOString() };
  const command = { schemaVersion: 1, operation: 'requestControl', commandId: commandId(n), projectId: project, clientId, payload };
  const snapshot = createControlRequestSnapshot({ id: id(n), projectId: project,
    requestedBy: { actorId, clientId }, input: payload, createdAt: madeAt });
  const request = { ...snapshot, metadata: {
    id: id(n), version: 1, projectId: project, requestedBy: { actorId, clientId },
    targetActorRef: payload.targetActorRef, targetClientRef: payload.targetClientRef,
    baseControl: payload.baseControl, reason: payload.reason, createdAt: madeAt, expiresAt: payload.expiresAt
  } };
  const row = { schemaVersion: 1, operation: 'requestControl', commandId: command.commandId,
    commandHash: contentHash(canonicalJson(command)), payloadHash: contentHash(canonicalJson(payload)),
    projectId: project, actorId, clientId, baseControl: clone(basis), requestRef: snapshot.requestRef, createdAt: madeAt };
  const linked = { schemaVersion: 1, commandId: row.commandId, commandHash: row.commandHash,
    projectId: project, actorId, clientId, requestRef: snapshot.requestRef };
  return { request, command: row, receipts: [{ ...linked, outcome: 'REQUEST_STORED' }],
    audits: [{ ...linked, event: 'CONTROL_REQUEST_STORED' }] };
}

function facts(actorId = requester, clientId = requesterClient): any {
  return { projectId, now, identity: { actorId, clientId, credentialGeneration: 3,
    currentCredentialGeneration: 3, sessionRevokedAt: null, idleExpiresAt: '2026-10-25T10:00:00.000Z',
    absoluteExpiresAt: '2026-10-25T11:00:00.000Z', userActive: true, userRevokedAt: null,
    clientUserId: actorId, clientRevokedAt: null, reauthUntil: null },
    member: { projectId, userId: actorId, participation: 'OWNER', revokedAt: null },
    control: { projectId, ...clone(basis), revokedAt: null } };
}

class FakeReadPort {
  readonly sourceMode = 'TEST_FAKE';
  readonly signer = {
    sign: (message: string) => createHmac('sha256', 'FN15_TEST_FAKE_ONLY').update(message).digest('base64url'),
    verify: (message: string, signature: string) => {
      const want = createHmac('sha256', 'FN15_TEST_FAKE_ONLY').update(message).digest('base64url');
      const a = Buffer.from(want), b = Buffer.from(signature);
      return a.length === b.length && timingSafeEqual(a, b);
    }
  };
  current = facts();
  project: any = { id: projectId, archivedAt: null };
  bundles = new Map<string, any>();
  rows: any[] = [];
  onSecondObserve: (() => void) | null = null;
  onRead: (() => void) | null = null;
  readLimit = 0;
  lastQuery: any = null;
  observations = 0;
  returnUnsorted = false;
  returnTooMany = false;
  constructor(data: any[] = [makeBundle()]) {
    for (const item of data) {
      this.bundles.set(item.request.requestRef.id, clone(item));
      this.rows.push({ requestRef: clone(item.request.requestRef), createdAt: item.request.snapshot.createdAt,
        projectId: item.request.snapshot.projectId, requestedBy: clone(item.request.snapshot.requestedBy) });
    }
  }
  async transaction<T>(work: (tx: any) => Promise<T>): Promise<T> {
    const tx = {
      observe: async () => { this.observations++; if (this.observations === 2) this.onSecondObserve?.();
        return clone({ project: this.project, access: this.current }); },
      readBundleByRef: async (ref: any) => { this.onRead?.(); return clone(this.bundles.get(ref.id) ?? null); },
      listRows: async (query: any) => {
        this.lastQuery = clone(query);
        this.readLimit = query.limit;
        const sorted = clone(this.rows).sort((a: any, b: any) =>
          b.createdAt.localeCompare(a.createdAt) || b.requestRef.id.localeCompare(a.requestRef.id));
        const last = query.after;
        const selected = last ? sorted.filter((row: any) => row.createdAt < last.createdAt
          || (row.createdAt === last.createdAt && row.requestRef.id < last.requestRef.id)) : sorted;
        this.onRead?.();
        const bounded = selected.slice(0, query.limit + (this.returnTooMany ? 1 : 0));
        return this.returnUnsorted ? bounded.reverse() : bounded;
      }
    };
    return work(tx);
  }
}
const detail = (bundle = makeBundle()) => ({ projectId, requestRef: clone(bundle.request.requestRef) });
async function read(port: FakeReadPort, input = detail()): Promise<any> {
  assert.equal(typeof source.readControlRequest, 'function', '상세 조회 export가 있어야 한다');
  return source.readControlRequest(input, port);
}
async function list(port: FakeReadPort, input: any = { projectId, view: 'OWN' }): Promise<any> {
  assert.equal(typeof source.listControlRequests, 'function', '목록 조회 export가 있어야 한다');
  return source.listControlRequests(input, port);
}

test('기본 조회 port는 미연결이며 실 adapter로 가장하지 않는다', async () => {
  assert.equal(typeof source.readControlRequest, 'function');
  assert.equal(typeof source.listControlRequests, 'function');
  await assert.rejects(source.readControlRequest(detail()), (error: any) => error.code === 'CONTROL_REQUEST_NOT_CONNECTED');
  await assert.rejects(source.listControlRequests({ projectId, view: 'OWN' }),
    (error: any) => error.code === 'CONTROL_REQUEST_NOT_CONNECTED');
});

test('본인 요청은 다른 현재 client에서도 재인증 없이 과거 만료 원문을 읽는다', async () => {
  assert.equal(typeof source.readControlRequest, 'function');
  const port = new FakeReadPort();
  port.current = facts(requester, secondClient);
  port.current.member.participation = 'HANDOFF_ELIGIBLE';
  port.current.control = null;
  const result = await read(port);
  assert.equal(result.snapshot.reason, '원문 이유 1');
  assert.equal(result.snapshot.storedState, 'PENDING');
  assert.equal(result.current.expired, true);
  assert.equal(result.current.baseControlState, 'UNVERIFIED');
  assert.equal(result.projectId, projectId);
  assert.equal(result.observedAt, now);
  assert.equal(result.executionAuthorized, false);
  assert.equal(result.controlTransferred, false);
  assert.equal(port.observations, 2);
});

test('현재 제어자만 CONTROLLER 상세 조회를 할 수 있으며 제어 불명은 거절한다', async () => {
  assert.equal(typeof source.readControlRequest, 'function');
  const port = new FakeReadPort();
  port.current = facts(controller, controllerClient);
  const result = await read(port);
  assert.equal(result.snapshot.reason, '원문 이유 1');
  port.observations = 0; port.current.control = null;
  await assert.rejects(read(port));
});

test('VIEWER·다른 사람·타 프로젝트·회수와 만료 client는 원문 일부도 받지 않는다', async () => {
  assert.equal(typeof source.readControlRequest, 'function');
  const mutators: Array<(port: FakeReadPort) => void> = [
    p => { p.current.member.participation = 'VIEWER'; },
    p => { p.current = facts(foreignActor, secondClient); },
    p => { p.current.projectId = otherProject; },
    p => { p.current.identity.sessionRevokedAt = now; },
    p => { p.current.identity.clientRevokedAt = now; },
    p => { p.current.identity.idleExpiresAt = now; },
    p => { p.current.identity.currentCredentialGeneration = 4; },
  ];
  for (const mutate of mutators) { const port = new FakeReadPort(); mutate(port); await assert.rejects(read(port)); }
  const port = new FakeReadPort();
  await assert.rejects(read(port, { ...detail(), projectId: otherProject }));
});

test('원문 hash·metadata·command·receipt·audit 손상은 전부 거절한다', async () => {
  assert.equal(typeof source.readControlRequest, 'function');
  const mutations: Array<(bundle: any) => void> = [
    b => { b.request.snapshot.reason = '변조'; },
    b => { b.request.metadata.reason = '변조'; },
    b => { b.command.payloadHash = '0'.repeat(64); },
    b => { b.receipts[0].commandHash = '0'.repeat(64); },
    b => { b.audits[0].requestRef.id = id(999); },
    b => { b.receipts = []; },
  ];
  for (const mutate of mutations) {
    const port = new FakeReadPort(); mutate(port.bundles.get(id(1)));
    await assert.rejects(read(port));
  }
  const port = new FakeReadPort();
  const wrong = detail(); wrong.requestRef.contentHash = '0'.repeat(64);
  await assert.rejects(read(port, wrong));
});

test('지연 조회 중 회원·client·제어 세대가 바뀌면 전체 결과를 폐기한다', async () => {
  assert.equal(typeof source.readControlRequest, 'function');
  for (const change of [
    (p: FakeReadPort) => { p.current.member.revokedAt = now; },
    (p: FakeReadPort) => { p.current.identity.clientRevokedAt = now; },
    (p: FakeReadPort) => { p.current.control.generation++; },
  ]) {
    const port = new FakeReadPort();
    port.current = facts(controller, controllerClient);
    port.onSecondObserve = () => change(port);
    await assert.rejects(read(port));
  }
});

test('OWN 목록은 기본 50·최대 200+1만 요구하고 이유 없는 안정 순서를 준다', async () => {
  assert.equal(typeof source.listControlRequests, 'function');
  const port = new FakeReadPort([makeBundle(1), makeBundle(2), makeBundle(3)]);
  const first = await list(port, { projectId, view: 'OWN', limit: 2 });
  assert.deepEqual(port.lastQuery, { projectId, actorId: requester, clientId: requesterClient,
    view: 'OWN', controllerBasis: null, limit: 3, after: null });
  assert.equal(port.readLimit, 3);
  assert.equal(first.projectId, projectId);
  assert.equal(first.limit, 2);
  assert.equal(first.hasMore, true);
  assert.deepEqual(first.items.map((item: any) => item.requestRef.id), [id(3), id(2)]);
  assert.equal(typeof first.nextCursor, 'string');
  assert.ok(first.items.every((item: any) => !('reason' in item) && !('snapshot' in item)
    && item.storedState === 'PENDING' && item.executionAuthorized === false
    && item.controlTransferred === false));
  port.observations = 0;
  const second = await list(port, { projectId, view: 'OWN', limit: 2, cursor: first.nextCursor });
  assert.deepEqual(second.items.map((item: any) => item.requestRef.id), [id(1)]);
  assert.equal(second.hasMore, false);
  assert.equal(second.nextCursor, null);
  const empty = await list(new FakeReadPort([]));
  assert.deepEqual(empty.items, []);
  assert.equal(empty.nextCursor, null);
  assert.equal(empty.hasMore, false);
  const max = new FakeReadPort([]);
  await list(max, { projectId, view: 'OWN', limit: 200 });
  assert.equal(max.readLimit, 201);
  await assert.rejects(list(new FakeReadPort([]), { projectId, view: 'OWN', limit: 201 }));
  await assert.rejects(list(new FakeReadPort([]), { projectId, view: 'OWN', actorId: foreignActor }));
  await assert.rejects(list(new FakeReadPort([]), { projectId, view: 'OWN', clientId: secondClient }));
});

test('CONTROLLER 목록은 관측한 제어자·client·세대·version을 포트 조회 범위에 결박한다', async () => {
  assert.equal(typeof source.listControlRequests, 'function');
  const port = new FakeReadPort([makeBundle(1, foreignActor)]);
  port.current = facts(controller, controllerClient);
  const result = await list(port, { projectId, view: 'CONTROLLER', limit: 1 });
  assert.equal(result.items.length, 1);
  assert.deepEqual(port.lastQuery, { projectId, actorId: controller, clientId: controllerClient,
    view: 'CONTROLLER', controllerBasis: basis, limit: 2, after: null });
});

test('같은 createdAt의 두 요청도 id DESC keyset으로 중복·누락 없이 넘긴다', async () => {
  assert.equal(typeof source.listControlRequests, 'function');
  const tiedAt = '2026-10-25T08:00:00.000Z';
  const port = new FakeReadPort([
    makeBundle(1, requester, projectId, tiedAt),
    makeBundle(2, requester, projectId, tiedAt)
  ]);
  const first = await list(port, { projectId, view: 'OWN', limit: 1 });
  assert.deepEqual(first.items.map((item: any) => item.requestRef.id), [id(2)]);
  assert.equal(first.hasMore, true);
  assert.equal(typeof first.nextCursor, 'string');
  port.observations = 0;
  const second = await list(port, { projectId, view: 'OWN', limit: 1, cursor: first.nextCursor });
  assert.deepEqual(second.items.map((item: any) => item.requestRef.id), [id(1)]);
  assert.equal(second.hasMore, false);
  assert.equal(second.nextCursor, null);
});

test('목록 port의 foreign·중복·역순·과다 항목을 필터링해 성공시키지 않는다', async () => {
  assert.equal(typeof source.listControlRequests, 'function');
  const port = new FakeReadPort([makeBundle(1), makeBundle(2)]);
  const original = clone(port.rows);
  const changes: Array<(p: FakeReadPort) => void> = [
    p => { p.rows[0].projectId = otherProject; },
    p => { p.rows[0].requestedBy.actorId = foreignActor; },
    p => { p.rows.push(clone(p.rows[0])); },
    p => { p.rows[0].requestRef.contentHash = '0'.repeat(64); },
  ];
  for (const mutate of changes) { port.rows = clone(original); port.observations = 0; mutate(port); await assert.rejects(list(port)); }
  const unsorted = new FakeReadPort([makeBundle(1), makeBundle(2)]);
  unsorted.returnUnsorted = true;
  await assert.rejects(list(unsorted));
  const tooMany = new FakeReadPort([makeBundle(1), makeBundle(2), makeBundle(3)]);
  tooMany.returnTooMany = true;
  await assert.rejects(list(tooMany, { projectId, view: 'OWN', limit: 1 }));
});

test('목록 지연 중 권한 회수 또는 현재 제어 기준 변경은 부분 목록을 돌려주지 않는다', async () => {
  assert.equal(typeof source.listControlRequests, 'function');
  const port = new FakeReadPort([makeBundle(1), makeBundle(2)]);
  port.current = facts(controller, controllerClient);
  port.onSecondObserve = () => { port.current.control.version++; };
  await assert.rejects(list(port, { projectId, view: 'CONTROLLER', limit: 1 }));
  const own = new FakeReadPort([makeBundle(1), makeBundle(2)]);
  own.onSecondObserve = () => { own.current.identity.sessionRevokedAt = now; };
  await assert.rejects(list(own));
});

test('네 종류의 commandId와 hash가 함께 바뀌어도 잘못된 UUID는 원문 조회에서 거절한다', async () => {
  assert.equal(typeof source.readControlRequest, 'function');
  const port = new FakeReadPort();
  const bundle = port.bundles.get(id(1));
  const originalRequest = clone(bundle.request);
  const snapshot = bundle.request.snapshot;
  const invalidCommandId = 'not-a-uuid';
  const payload = { targetActorRef: snapshot.targetActorRef, targetClientRef: snapshot.targetClientRef,
    baseControl: snapshot.baseControl, reason: snapshot.reason, expiresAt: snapshot.expiresAt };
  const commandHash = contentHash(canonicalJson({ schemaVersion: 1, operation: 'requestControl',
    commandId: invalidCommandId, projectId, clientId: requesterClient, payload }));
  bundle.command.commandId = invalidCommandId;
  bundle.command.commandHash = commandHash;
  for (const linked of [...bundle.receipts, ...bundle.audits]) {
    linked.commandId = invalidCommandId;
    linked.commandHash = commandHash;
  }
  await assert.rejects(read(port), (error: any) => error.code === 'CONTROL_REQUEST_READ_INVALID');
  assert.deepEqual(bundle.request, originalRequest);
});
