import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { canonicalJson, contentHash } from '../../../contracts/canonical.ts';
import { Pool } from 'pg';
import { buildApp } from '../../../apps/server/app.ts';
import { AccessRepository } from '../../../apps/server/modules/access/repository.ts';
import { AuthFailure } from '../../../apps/server/modules/access/repository.ts';
import { requestControl, type ControlRequestStorePort,
  type ControlRequestTransaction, type StoredControlRequestCommand } from '../../../apps/server/modules/control-handoff/control-request-store.ts';
import type { ControlRequestRecord } from '../../../apps/server/modules/control-handoff/control-request-snapshot.ts';
import { baseControl, controller, controllerClient, now, observation, prepareCommandId, projectId,
  requestBundle,
  requestCommandId, requestExpiresAt, requester, requesterClient } from './control-handoff-summary-fixture.ts';

const pgPath = '../../../apps/server/modules/control-handoff/control-handoff-pg.ts';
const pg = await import(pgPath).catch((error: NodeJS.ErrnoException) => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
  throw error;
});
const sourceMigrationId = '0041_control_handoff_source';
const sourceMigrationChecksum = 'c6bd081fc7a70f8eaa68ac673cce6f8e41549d98f2c3e5bb3c22833874b0e522';
const token = 't'.repeat(43);
const csrf = 'c'.repeat(43);
const command = () => ({ schemaVersion: 1 as const, operation: 'requestControl' as const,
  commandId: requestCommandId, projectId, clientId: requesterClient,
  payload: { targetActorRef: { userId: requester },
    targetClientRef: { userId: requester, clientId: requesterClient },
    baseControl: structuredClone(baseControl), reason: '인수 요청 원문', expiresAt: requestExpiresAt } });

function fakePool(schemaReady: boolean, commitUnknown = false,
  migrationChecksum: string | null = sourceMigrationChecksum) {
  const statements: string[] = [];
  let connects = 0;
  let releases = 0;
  const db = { async query(sql: string) {
    statements.push(sql);
    if (/^COMMIT\b/i.test(sql) && commitUnknown) throw Error('COMMIT_OUTCOME_UNKNOWN');
    if (/to_regclass|information_schema|pg_class/i.test(sql)) return { rows: [{ ready: schemaReady,
      requests: schemaReady, summaries: schemaReady, commands: schemaReady,
      receipts: schemaReady, audits: schemaReady }] };
    if (/FROM\s+anvil\.schema_migrations\b/i.test(sql)) return { rows: migrationChecksum === null ? []
      : [{ id: sourceMigrationId, checksum: migrationChecksum }] };
    if (/FROM\s+anvil\.projects\b/i.test(sql)) return { rows: [{ id: projectId, archived_at: null }] };
    if (/FROM\s+anvil\.project_members\b/i.test(sql)) return { rows: [{ project_id: projectId,
      user_id: requester, participation: 'HANDOFF_ELIGIBLE', revoked_at: null }] };
    if (/FROM\s+anvil\.project_control\b/i.test(sql)) return { rows: [{ project_id: projectId,
      actor_id: controller, client_id: controllerClient, generation: '5', version: '8',
      revoked_at: null }] };
    if (/clock_timestamp\(\)/i.test(sql)) return { rows: [{ at: new Date(now) }] };
    return { rows: [] };
  }, release() { releases++; } };
  const pool = { async connect() { connects++; return db; },
    async query() { throw Error('POOL_QUERY_FORBIDDEN'); } };
  return { pool, db, statements, get connects() { return connects; }, get releases() { return releases; } };
}

test('schema 미준비면 동일 client에서 rollback하고 source/auth/write를 진행하지 않는다', async () => {
  assert.equal(typeof pg.createControlHandoffPgSource, 'function', 'PG 생성자 export가 있어야 한다');
  const fake = fakePool(false);
  let authCalls = 0;
  const access = { async authenticateInTransaction() { authCalls++; throw Error('AUTH_MUST_NOT_RUN'); },
    signControlRequestCursor() { return 'x'; }, verifyControlRequestCursor() { return false; } };
  const source = pg.createControlHandoffPgSource({ pool: fake.pool, access, enabled: true });
  await assert.rejects(source.forSession(token, csrf, projectId).requestPort.transaction(async () => 'NEVER'),
    (error: unknown) => error instanceof Error && /NOT_CONNECTED/.test(error.message));
  assert.equal(fake.connects, 1);
  assert.equal(fake.releases, 1);
  assert.equal(authCalls, 0);
  assert.match(fake.statements[0] ?? '', /^BEGIN\b/i);
  assert.equal(fake.statements.some(sql => /^COMMIT\b/i.test(sql)), false);
  assert.equal(fake.statements.some(sql => /^ROLLBACK\b/i.test(sql)), true);
  assert.equal(fake.statements.some(sql => /\bINSERT\b|\bUPDATE\b|\bDELETE\b/i.test(sql)), false);
});

test('다섯 표만 존재해도 0041 적용 id·정확 checksum이 없으면 fail-closed다', async () => {
  assert.equal(typeof pg.createControlHandoffPgSource, 'function', 'PG 생성자 export가 있어야 한다');
  for (const checksum of [null, '0'.repeat(64)]) {
    const fake = fakePool(true, false, checksum);
    let authCalls = 0;
    const access = { async authenticateInTransaction() { authCalls++; throw Error('AUTH_MUST_NOT_RUN'); },
      signControlRequestCursor() { return 'x'; }, verifyControlRequestCursor() { return false; } };
    const source = pg.createControlHandoffPgSource({ pool: fake.pool, access, enabled: true });
    await assert.rejects(source.forSession(token, csrf, projectId).requestPort.transaction(async () => 'NEVER'),
      (error: unknown) => error instanceof Error && /NOT_CONNECTED/.test(error.message));
    assert.equal(authCalls, 0);
    assert.equal(fake.connects, 1);
    assert.equal(fake.releases, 1);
    assert.equal(fake.statements.some(sql => /FROM\s+anvil\.schema_migrations\b/i.test(sql)), true);
    assert.equal(fake.statements.some(sql => /^ROLLBACK\b/i.test(sql)), true);
    assert.equal(fake.statements.some(sql => /\bINSERT\b|\bUPDATE\b|\bDELETE\b/i.test(sql)), false);
  }
});

test('schema 미준비/0041 checksum 불일치는 requestControl 소비자에서도 NOT_CONNECTED와 원 commandId를 보존한다', async () => {
  assert.equal(typeof pg.createControlHandoffPgSource, 'function', 'PG 생성자 export가 있어야 한다');
  for (const [ready, checksum] of [[false, sourceMigrationChecksum], [true, null], [true, '0'.repeat(64)]] as const) {
    const fake = fakePool(ready, false, checksum);
    const access = { async authenticateInTransaction() { throw Error('AUTH_MUST_NOT_RUN'); },
      signControlRequestCursor() { return 'x'; }, verifyControlRequestCursor() { return false; } };
    const port = pg.createControlHandoffPgSource({ pool: fake.pool, access, enabled: true })
      .forSession(token, csrf, projectId).requestPort;
    await assert.rejects(requestControl(command(), port), (error: unknown) =>
      error instanceof Error && error.message === 'CONTROL_REQUEST_NOT_CONNECTED'
      && 'commandId' in error && error.commandId === requestCommandId);
    assert.equal(fake.connects, 1);
    assert.equal(fake.statements.some(sql => /^ROLLBACK\b/i.test(sql)), true);
  }
});

test('PG read의 정확 없는 ref는 원문 없는 NOT_FOUND404로 보존된다', async () => {
  assert.equal(typeof pg.createControlHandoffPgSource, 'function', 'PG 생성자 export가 있어야 한다');
  const fake = fakePool(true);
  const access = { async authenticateInTransaction() { return {
    actorId: requester, clientId: requesterClient, serverOwner: false,
    credentialGeneration: 3, reauthUntil: new Date(now),
    authSession: { id: requester, idleExpiresAt: '2026-10-25T10:00:00.000Z',
      absoluteExpiresAt: '2026-10-25T11:00:00.000Z' } }; },
    signControlRequestCursor() { return 'x'; }, verifyControlRequestCursor() { return false; } };
  const source = pg.createControlHandoffPgSource({ pool: fake.pool, access, enabled: true });
  const app = buildApp({}, undefined, undefined, undefined, { origin, source, enabled: true });
  const url = `/api/v1/projects/${projectId}/control-requests/${requester}/versions/1?contentHash=${'a'.repeat(64)}`;
  const response = await app.inject({ method: 'GET', url,
    headers: { host: 'anvil.test', 'x-anvil-csrf': csrf, cookie: `__Host-anvil.sid=${token}` } });
  assert.equal(response.statusCode, 404, response.body);
  assert.equal(response.json().code, 'NOT_FOUND');
  assert.equal(response.body.includes('reason'), false);
  await app.close();
});

test('한 PoolClient 인증 뒤 project→member→control 잠금과 DB 시각의 앞뒤 관측을 사용한다', async () => {
  assert.equal(typeof pg.createControlHandoffPgSource, 'function', 'PG 생성자 export가 있어야 한다');
  const fake = fakePool(true);
  let authCalls = 0;
  const access = { async authenticateInTransaction(db: unknown, presentedToken: string, presentedCsrf: string) {
    authCalls++;
    assert.equal(db, fake.db);
    assert.equal(presentedToken, token);
    assert.equal(presentedCsrf, csrf);
    return { actorId: requester, clientId: requesterClient, serverOwner: false,
      credentialGeneration: 3, reauthUntil: new Date('2026-10-25T09:00:10.000Z'),
      authSession: { id: requester, idleExpiresAt: '2026-10-25T10:00:00.000Z',
        absoluteExpiresAt: '2026-10-25T11:00:00.000Z' } };
  }, signControlRequestCursor() { return 'x'; }, verifyControlRequestCursor() { return false; } };
  const source = pg.createControlHandoffPgSource({ pool: fake.pool, access, enabled: true });
  const port = source.forSession(token, csrf, projectId).requestPort;
  assert.equal(port.sourceMode, 'POSTGRES_SOURCE');
  const seen = await port.transaction(async (tx: { observe(): Promise<unknown> }) => {
    const first = await tx.observe();
    const last = await tx.observe();
    assert.deepEqual(first, last);
    return first;
  });
  const expected = observation(requester, requesterClient);
  expected.access.member.participation = 'HANDOFF_ELIGIBLE';
  assert.deepEqual(seen, expected);
  assert.equal(authCalls, 1);
  assert.equal(fake.connects, 1);
  assert.equal(fake.releases, 1);
  const projects = fake.statements.flatMap((sql, index) => /FROM\s+anvil\.projects\b/i.test(sql) ? [index] : []);
  const members = fake.statements.flatMap((sql, index) => /FROM\s+anvil\.project_members\b/i.test(sql) ? [index] : []);
  const controls = fake.statements.flatMap((sql, index) => /FROM\s+anvil\.project_control\b/i.test(sql) ? [index] : []);
  assert.equal(projects.length, 2);
  assert.equal(members.length, 2);
  assert.equal(controls.length, 2);
  for (let i = 0; i < 2; i++) {
    const projectAt = projects[i], memberAt = members[i], controlAt = controls[i];
    assert.ok(projectAt !== undefined && memberAt !== undefined && controlAt !== undefined);
    assert.ok(projectAt < memberAt && memberAt < controlAt);
    for (const position of [projectAt, memberAt, controlAt])
      assert.match(fake.statements[position] ?? '', /FOR UPDATE/i);
  }
  assert.match(fake.statements.at(-1) ?? '', /^COMMIT\b/i);
});

test('작업 오류는 rollback하며 COMMIT 불명은 재시도 없이 단발 보존한다', async () => {
  assert.equal(typeof pg.createControlHandoffPgSource, 'function', 'PG 생성자 export가 있어야 한다');
  for (const commitUnknown of [false, true]) {
    const fake = fakePool(true, commitUnknown);
    const access = { async authenticateInTransaction() { return {
      actorId: requester, clientId: requesterClient, serverOwner: false, credentialGeneration: 3,
      reauthUntil: new Date(now) }; }, signControlRequestCursor() { return 'x'; },
      verifyControlRequestCursor() { return false; } };
    const source = pg.createControlHandoffPgSource({ pool: fake.pool, access, enabled: true });
    const port = source.forSession(token, csrf, projectId).requestPort;
    await assert.rejects(port.transaction(async () => {
      if (!commitUnknown) throw Error('INJECTED_WRITE_FAILURE');
      return 'RESULT';
    }));
    assert.equal(fake.connects, 1);
    assert.equal(fake.releases, 1);
    assert.equal(fake.statements.filter(sql => /^COMMIT\b/i.test(sql)).length, Number(commitUnknown));
    assert.equal(fake.statements.some(sql => /^ROLLBACK\b/i.test(sql)), true);
  }
});

test('POSTGRES_SOURCE 소비자는 원 commandId를 보존하고 불명 결과를 자동 재실행하지 않는다', async () => {
  let attempts = 0;
  const port: ControlRequestStorePort = { sourceMode: 'POSTGRES_SOURCE',
    async transaction<T>(_work: (tx: ControlRequestTransaction) => Promise<T>): Promise<T> {
      attempts++;
      throw Error('COMMIT_OUTCOME_UNKNOWN');
    } };
  await assert.rejects(requestControl(command(), port), (error: unknown) =>
    error instanceof Error && 'commandId' in error && error.commandId === requestCommandId
    && /STORE_FAILED|COMMIT_OUTCOME_UNKNOWN/.test(error.message));
  assert.equal(attempts, 1);
});

test('임의 인증 예외 원문은 TEST_FAKE와 POSTGRES_SOURCE 모두 저장 오류로 감추고 안전 인증 code만 통과한다', async () => {
  for (const mode of ['TEST_FAKE', 'POSTGRES_SOURCE'] as const) {
    const port: ControlRequestStorePort = { sourceMode: mode,
      async transaction<T>(_work: (tx: ControlRequestTransaction) => Promise<T>): Promise<T> {
        throw new AuthFailure('SECRET_IN_AUTH_EXCEPTION', 403);
      } };
    await assert.rejects(requestControl(command(), port), (error: unknown) =>
      error instanceof Error && error.message === 'CONTROL_REQUEST_STORE_FAILED'
      && !error.message.includes('SECRET_IN_AUTH_EXCEPTION'));
  }
  const port: ControlRequestStorePort = { sourceMode: 'POSTGRES_SOURCE',
    async transaction<T>(_work: (tx: ControlRequestTransaction) => Promise<T>): Promise<T> {
      throw new AuthFailure('AUTH_REQUIRED', 401);
    } };
  await assert.rejects(requestControl(command(), port), (error: unknown) =>
    error instanceof AuthFailure && error.message === 'AUTH_REQUIRED' && error.statusCode === 401);
});

type DbRow = Record<string, unknown>;
type Tables = Record<string, Map<string, DbRow>>;
const tableNames = ['control_handoff_source_requests', 'control_handoff_source_summaries',
  'control_handoff_source_commands', 'control_handoff_source_receipts',
  'control_handoff_source_audits'] as const;
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const requesterToken = 'r'.repeat(43), controllerToken = 'o'.repeat(43);
const requesterCsrf = 's'.repeat(43), controllerCsrf = 'p'.repeat(43);
const origin = 'https://anvil.test';

/** SQL을 실제로 실행하지 않는 단일 PoolClient. INSERT/SELECT는 0041 전용 다섯 표만 보관한다. */
class FakeSourceClient {
  statements: Array<{ sql: string; values: unknown[] }> = [];
  rows: Tables = Object.fromEntries(tableNames.map(name => [name, new Map<string, DbRow>()])) as Tables;
  staged: Tables | null = null;
  released = 0;
  memberRevoked = false;
  controlGeneration = 5;
  failReceipt = false;
  observeCount = 0;
  async query(sql: string, values: unknown[] = []): Promise<{ rows: DbRow[] }> {
    this.statements.push({ sql, values: structuredClone(values) });
    if (/^BEGIN\b/i.test(sql)) { this.staged = structuredClone(this.rows); return { rows: [] }; }
    if (/^ROLLBACK\b/i.test(sql)) { this.staged = null; return { rows: [] }; }
    if (/^COMMIT\b/i.test(sql)) {
      if (this.staged === null) throw Error('NO_TRANSACTION');
      this.rows = this.staged; this.staged = null; return { rows: [] };
    }
    if (/to_regclass/i.test(sql)) return { rows: [{ ready: true, requests: true,
      summaries: true, commands: true, receipts: true, audits: true }] };
    if (/FROM\s+anvil\.schema_migrations\b/i.test(sql))
      return { rows: [{ id: sourceMigrationId, checksum: sourceMigrationChecksum }] };
    if (/FROM\s+anvil\.auth_sessions\b/i.test(sql)) {
      const isRequester = values[0] === digest(requesterToken);
      const isController = values[0] === digest(controllerToken);
      if (!isRequester && !isController) return { rows: [] };
      const actor = isRequester ? requester : controller;
      return { rows: [{ id: actor, uid: actor, client_id: isRequester ? requesterClient : controllerClient,
        server_owner: false, user_status: 'ACTIVE', revoked_at: null,
        user_revoked_at: null, client_revoked_at: null,
        credential_generation: '3', current_generation: '3',
        csrf_digest: digest(isRequester ? requesterCsrf : controllerCsrf),
        idle_expires_at: new Date('2026-10-25T10:00:00.000Z'),
        absolute_expires_at: new Date('2026-10-25T11:00:00.000Z'),
        reauth_until: new Date('2026-10-25T09:00:10.000Z') }] };
    }
    if (/pg_current_xact_id_if_assigned/i.test(sql))
      return { rows: [{ at: new Date(now), transaction_id: '1' }] };
    if (/FROM\s+anvil\.projects\b/i.test(sql))
      return { rows: values.includes(projectId) ? [{ id: projectId, archived_at: null }] : [] };
    if (/FROM\s+anvil\.project_members\b/i.test(sql)) {
      const actor = values.find(value => value === requester || value === controller);
      return { rows: actor && values.includes(projectId) ? [{ project_id: projectId, user_id: actor,
        participation: actor === controller ? 'OWNER' : 'HANDOFF_ELIGIBLE',
        revoked_at: this.memberRevoked && actor === requester ? new Date(now) : null }] : [] };
    }
    if (/FROM\s+anvil\.project_control\b/i.test(sql))
      return { rows: values.includes(projectId) ? [{ project_id: projectId, actor_id: controller,
        client_id: controllerClient, generation: String(this.controlGeneration), version: '8',
        revoked_at: null }] : [] };
    if (/clock_timestamp\(\)/i.test(sql)) { this.observeCount++; return { rows: [{ at: new Date(now) }] }; }
    const inserted = /INSERT\s+INTO\s+anvil\.(control_handoff_source_\w+)\s*\(([^)]+)\)/i.exec(sql);
    if (inserted) {
      const table = inserted[1], columns = inserted[2]?.split(',').map(value => value.trim());
      assert.ok(table && columns && this.staged?.[table]);
      if (this.failReceipt && table === 'control_handoff_source_receipts') throw Error('INJECTED_WRITE_FAILURE');
      assert.equal(columns.length, values.length);
      const row = Object.fromEntries(columns.map((column, index) => [column, values[index]]));
      const key = table === 'control_handoff_source_requests'
        ? `${row.project_id}:${row.id}:${row.version}`
        : table === 'control_handoff_source_summaries'
          ? `${row.project_id}:${row.request_id}:${row.version}` : String(row.command_id);
      if (this.staged[table].has(key)) throw Error('DUPLICATE_ROW');
      this.staged[table].set(key, row);
      return { rows: [] };
    }
    const selected = /FROM\s+anvil\.(control_handoff_source_\w+)/i.exec(sql);
    if (selected) {
      const table = selected[1];
      assert.ok(table && this.staged?.[table]);
      let rows = [...this.staged[table].values()];
      for (const match of sql.matchAll(/(?:WHERE|AND)\s+(?:\w+\.)?(project_id|command_id|id|request_id|version|content_hash|request_hash|summary_hash|requested_by)\s*=\s*\$(\d+)/gi)) {
        const column = match[1], index = Number(match[2]) - 1;
        assert.ok(column);
        rows = rows.filter(row => row[column] === values[index]);
      }
      if (table === 'control_handoff_source_requests') {
        const ownPredicate = /\(\$2='CONTROLLER' OR requested_by=\$3\)/i.test(sql);
        if (ownPredicate && values[1] === 'OWN')
          rows = rows.filter(row => row.requested_by === values[2]);
        const keysetPredicate = /\$4::timestamptz IS NULL OR created_at<\$4 OR \(created_at=\$4 AND id<\$5\)/i.test(sql);
        const afterAt = values[3], afterId = values[4];
        if (keysetPredicate && typeof afterAt === 'string' && typeof afterId === 'string')
          rows = rows.filter(row => String(row.created_at) < afterAt
            || (row.created_at === afterAt && String(row.id) < afterId));
      }
      if (/ORDER\s+BY[^;]*created_at\s+DESC/i.test(sql))
        rows.sort((left, right) => String(right.created_at).localeCompare(String(left.created_at))
          || String(right.id).localeCompare(String(left.id)));
      if (/ORDER\s+BY[^;]*version\s+DESC/i.test(sql))
        rows.sort((left, right) => Number(right.version) - Number(left.version));
      const limit = /LIMIT\s+\$(\d+)/i.exec(sql);
      if (limit) rows = rows.slice(0, Number(values[Number(limit[1]) - 1]));
      return { rows: structuredClone(rows) };
    }
    throw Error(`UNEXPECTED_SQL:${sql.slice(0, 100)}`);
  }
  release() { this.released++; }
  count(table: typeof tableNames[number]) { return this.rows[table]?.size ?? 0; }
}

test('PG 문맥은 lockCommand 한 ID만 보관하고 잠금 없는 INSERT·다른 ID 명령 쓰기를 거절한다', async () => {
  assert.equal(typeof pg.createControlHandoffPgSource, 'function', 'PG 생성자 export가 있어야 한다');
  const db = new FakeSourceClient();
  const pool = { async connect() { return db; }, async query() { throw Error('POOL_QUERY_FORBIDDEN'); } };
  const access = new AccessRepository(new Pool(), { installationId: projectId, key: Buffer.alloc(32, 7) });
  const port = pg.createControlHandoffPgSource({ pool, access, enabled: true })
    .forSession(requesterToken, requesterCsrf, projectId).requestPort;
  const stored = requestBundle();
  const record: ControlRequestRecord = { ...stored.request,
    metadata: { ...stored.request.metadata, version: 1 } };
  const row: StoredControlRequestCommand = { ...stored.command,
    schemaVersion: 1, operation: 'requestControl' };
  await assert.rejects(port.transaction(async (tx: ControlRequestTransaction) => {
    await tx.insertRequest(record);
  }));
  assert.deepEqual(tableNames.map(name => db.count(name)), [0, 0, 0, 0, 0]);
  await assert.rejects(port.transaction(async (tx: ControlRequestTransaction) => {
    await tx.lockCommand(requestCommandId);
    await tx.lockCommand(prepareCommandId);
  }));
  await assert.rejects(port.transaction(async (tx: ControlRequestTransaction) => {
    await tx.lockCommand(requestCommandId);
    await tx.insertRequest(record);
    const changed = { ...command(), commandId: prepareCommandId };
    const changedHash = contentHash(canonicalJson(changed));
    assert.notEqual(changedHash, row.commandHash);
    await tx.insertCommand({ ...row, commandId: prepareCommandId, commandHash: changedHash });
  }));
  assert.deepEqual(tableNames.map(name => db.count(name)), [0, 0, 0, 0, 0]);
  assert.ok(db.statements.filter(item => /^ROLLBACK\b/i.test(item.sql)).length >= 3);
  await access.pool.end();
});

test('합성 HTTP 다섯 경로가 같은 PG 전용 다섯 표의 저장·조회·미확인 요약을 소비한다', async () => {
  assert.equal(typeof pg.createControlHandoffPgSource, 'function', 'PG 생성자 export가 있어야 한다');
  const db = new FakeSourceClient();
  const pool = { async connect() { return db; }, async query() { throw Error('POOL_QUERY_FORBIDDEN'); } };
  const access = new AccessRepository(new Pool(), { installationId: projectId, key: Buffer.alloc(32, 7) });
  const source = pg.createControlHandoffPgSource({ pool, access, enabled: true });
  const app = buildApp({}, undefined, undefined, undefined, { origin, source, enabled: true });
  await app.ready();
  const base = `/api/v1/projects/${projectId}/control-requests`;
  const headers = (controllerSession = false) => ({ host: 'anvil.test', origin,
    'content-type': 'application/json', 'x-anvil-csrf': controllerSession ? controllerCsrf : requesterCsrf,
    cookie: `__Host-anvil.sid=${controllerSession ? controllerToken : requesterToken}` });
  const created = await app.inject({ method: 'POST', url: base, headers: headers(), payload: command() });
  assert.equal(created.statusCode, 201, created.body);
  const request = created.json();
  assert.equal(request.snapshot.reason, command().payload.reason);
  assert.equal(request.snapshot.storedState, 'PENDING');
  assert.equal(request.snapshot.executionAuthorized, false);
  assert.equal(request.snapshot.controlTransferred, false);
  const ref = request.requestRef;
  assert.equal(ref.version, 1);
  const foreignId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
  const foreignKey = `${projectId}:${foreignId}:1`;
  db.rows.control_handoff_source_requests?.set(foreignKey, { project_id: projectId,
    id: foreignId, version: 1, content_hash: 'a'.repeat(64), created_at: now,
    requested_by: controller, client_id: controllerClient, source_command_id: prepareCommandId });
  const listed = await app.inject({ method: 'GET', url: `${base}?view=OWN&limit=1`, headers: headers() });
  assert.equal(listed.statusCode, 200, listed.body);
  assert.deepEqual(listed.json().items.map((item: { requestRef: unknown }) => item.requestRef), [ref]);
  assert.equal(listed.body.includes(command().payload.reason), false);
  db.rows.control_handoff_source_requests?.delete(foreignKey);
  const extraQuery = await app.inject({ method: 'GET', url: `${base}?view=OWN&unexpected=1`, headers: headers() });
  assert.equal(extraQuery.statusCode, 400);
  const duplicateQuery = await app.inject({ method: 'GET', url: `${base}?view=OWN&view=CONTROLLER`, headers: headers() });
  assert.equal(duplicateQuery.statusCode, 400);
  const path = `${base}/${ref.id}/versions/${ref.version}`;
  const read = await app.inject({ method: 'GET', url: `${path}?contentHash=${ref.contentHash}`, headers: headers() });
  assert.equal(read.statusCode, 200, read.body);
  assert.deepEqual(read.json().requestRef, ref);
  const prepared = await app.inject({ method: 'POST', url: `${path}/handoff-summaries`,
    headers: headers(true), payload: { schemaVersion: 1, operation: 'prepareControlHandoff',
      commandId: prepareCommandId, projectId, clientId: controllerClient, payload: { requestRef: ref } } });
  assert.equal(prepared.statusCode, 201, prepared.body);
  const summary = prepared.json();
  assert.equal(summary.body.safetyState, 'UNVERIFIED');
  assert.equal(summary.body.sourceMode, 'SYNTHETIC_ONLY');
  assert.equal(summary.body.realCollectorsConnected, false);
  assert.equal(summary.body.acceptanceEnabled, false);
  assert.equal(summary.body.executionAuthorized, false);
  assert.equal(summary.body.controlTransferred, false);
  assert.ok(summary.body.gaps.includes('REAL_COLLECTOR_NOT_CONNECTED'));
  const summaryRead = await app.inject({ method: 'GET',
    url: `${path}/handoff-summaries/${summary.summaryRef.version}?requestHash=${ref.contentHash}&summaryHash=${summary.summaryRef.contentHash}`,
    headers: headers() });
  assert.equal(summaryRead.statusCode, 200, summaryRead.body);
  assert.deepEqual(summaryRead.json().summaryRef, summary.summaryRef);
  assert.equal(summaryRead.json().current.expired, false);
  assert.equal(summaryRead.json().body.validUntil, summary.body.validUntil);
  assert.deepEqual(tableNames.map(name => db.count(name)), [1, 1, 2, 2, 2]);
  assert.equal(db.statements.some(item => /anvil\.(?:commands|authorization_receipts|audit_events)\b/i.test(item.sql)), false);
  assert.ok(db.observeCount >= 10, '각 consumer의 전후 DB 시각 재관측');
  const replay = await app.inject({ method: 'POST', url: base, headers: headers(), payload: command() });
  assert.equal(replay.statusCode, 201, replay.body);
  assert.deepEqual(replay.json().requestRef, ref);
  assert.deepEqual(tableNames.map(name => db.count(name)), [1, 1, 2, 2, 2]);
  const second = await app.inject({ method: 'POST', url: base, headers: headers(),
    payload: { ...command(), commandId: '77777777-7777-4777-8777-000000000002' } });
  assert.equal(second.statusCode, 201, second.body);
  const page = await app.inject({ method: 'GET', url: `${base}?view=OWN&limit=1`, headers: headers() });
  assert.equal(page.statusCode, 200, page.body);
  assert.equal(page.json().hasMore, true);
  assert.equal(typeof page.json().nextCursor, 'string');
  const cursor = encodeURIComponent(page.json().nextCursor);
  const next = await app.inject({ method: 'GET',
    url: `${base}?view=OWN&limit=1&cursor=${cursor}`, headers: headers() });
  assert.equal(next.statusCode, 200, next.body);
  assert.equal(next.json().hasMore, false);
  assert.equal(next.json().nextCursor, null);
  assert.equal(next.json().items.length, 1);
  const pageRefs = [page.json().items[0].requestRef.id, next.json().items[0].requestRef.id];
  assert.equal(new Set(pageRefs).size, 2);
  assert.deepEqual(new Set(pageRefs), new Set([ref.id, second.json().requestRef.id]));
  const wrongView = await app.inject({ method: 'GET',
    url: `${base}?view=CONTROLLER&limit=1&cursor=${cursor}`, headers: headers(true) });
  assert.ok([400, 403, 409].includes(wrongView.statusCode));
  assert.equal(wrongView.body.includes(command().payload.reason), false);
  const wrongLimit = await app.inject({ method: 'GET',
    url: `${base}?view=OWN&limit=2&cursor=${cursor}`, headers: headers() });
  assert.ok([400, 403, 409].includes(wrongLimit.statusCode));
  await app.close();
  await access.pool.end();
});

test('합성 HTTP가 경로·본문·hash·인증 문맥·현재성·부분쓰기 고아를 성공으로 바꾸지 않는다', async () => {
  assert.equal(typeof pg.createControlHandoffPgSource, 'function', 'PG 생성자 export가 있어야 한다');
  const db = new FakeSourceClient();
  const pool = { async connect() { return db; }, async query() { throw Error('POOL_QUERY_FORBIDDEN'); } };
  const access = new AccessRepository(new Pool(), { installationId: projectId, key: Buffer.alloc(32, 7) });
  const source = pg.createControlHandoffPgSource({ pool, access, enabled: true });
  const app = buildApp({}, undefined, undefined, undefined, { origin, source, enabled: true });
  await app.ready();
  const base = `/api/v1/projects/${projectId}/control-requests`;
  const headers = (controllerSession = false) => ({ host: 'anvil.test', origin,
    'content-type': 'application/json', 'x-anvil-csrf': controllerSession ? controllerCsrf : requesterCsrf,
    cookie: `__Host-anvil.sid=${controllerSession ? controllerToken : requesterToken}` });
  const checkNoSecret = (body: string) => {
    for (const secret of [requesterToken, controllerToken, requesterCsrf, controllerCsrf,
      command().payload.reason]) assert.equal(body.includes(secret), false);
  };
  const wrongProject = await app.inject({ method: 'POST', url: base, headers: headers(),
    payload: { ...command(), projectId: controller } });
  assert.equal(wrongProject.statusCode, 400);
  checkNoSecret(wrongProject.body);
  const wrongClient = await app.inject({ method: 'POST', url: base, headers: headers(),
    payload: { ...command(), clientId: controllerClient } });
  assert.equal(wrongClient.statusCode, 403);
  const otherActor = await app.inject({ method: 'POST', url: base, headers: headers(),
    payload: { ...command(), payload: { ...command().payload,
      targetActorRef: { userId: controller }, targetClientRef: { userId: controller, clientId: requesterClient } } } });
  assert.equal(otherActor.statusCode, 403);
  const badOrigin = await app.inject({ method: 'POST', url: base,
    headers: { ...headers(), origin: 'https://other.test' }, payload: command() });
  assert.equal(badOrigin.statusCode, 403);
  const badType = await app.inject({ method: 'POST', url: base,
    headers: { ...headers(), 'content-type': 'text/plain' }, payload: JSON.stringify(command()) });
  assert.equal(badType.statusCode, 403);
  const noCsrfGet = await app.inject({ method: 'GET', url: `${base}?view=OWN`,
    headers: { host: 'anvil.test', cookie: `__Host-anvil.sid=${requesterToken}` } });
  assert.equal(noCsrfGet.statusCode, 403);
  assert.deepEqual(tableNames.map(name => db.count(name)), [0, 0, 0, 0, 0]);
  const created = await app.inject({ method: 'POST', url: base, headers: headers(), payload: command() });
  assert.equal(created.statusCode, 201, created.body);
  const ref = created.json().requestRef;
  const path = `${base}/${ref.id}/versions/${ref.version}`;
  const badHash = await app.inject({ method: 'GET',
    url: `${path}?contentHash=${'b'.repeat(64)}`, headers: headers() });
  assert.ok([400, 404, 409].includes(badHash.statusCode));
  checkNoSecret(badHash.body);
  const foreignProject = await app.inject({ method: 'GET',
    url: `/api/v1/projects/${controller}/control-requests/${ref.id}/versions/1?contentHash=${ref.contentHash}`,
    headers: headers() });
  assert.ok([403, 404].includes(foreignProject.statusCode));
  const wrongRef = await app.inject({ method: 'POST', url: `${path}/handoff-summaries`,
    headers: headers(true), payload: { schemaVersion: 1, operation: 'prepareControlHandoff',
      commandId: prepareCommandId, projectId, clientId: controllerClient,
      payload: { requestRef: { ...ref, contentHash: 'b'.repeat(64) } } } });
  assert.ok([400, 404, 409].includes(wrongRef.statusCode));
  assert.equal(db.count('control_handoff_source_summaries'), 0);
  db.controlGeneration = 6;
  const stale = await app.inject({ method: 'POST', url: `${path}/handoff-summaries`,
    headers: headers(true), payload: { schemaVersion: 1, operation: 'prepareControlHandoff',
      commandId: prepareCommandId, projectId, clientId: controllerClient,
      payload: { requestRef: ref } } });
  assert.ok([403, 409, 412].includes(stale.statusCode));
  assert.equal(db.count('control_handoff_source_summaries'), 0);
  db.controlGeneration = 5;
  db.memberRevoked = true;
  const revoked = await app.inject({ method: 'GET',
    url: `${path}?contentHash=${ref.contentHash}`, headers: headers() });
  assert.ok([403, 404].includes(revoked.statusCode));
  assert.equal(revoked.body.includes(command().payload.reason), false);
  db.memberRevoked = false;
  db.failReceipt = true;
  const newCommand = { ...command(), commandId: '77777777-7777-4777-8777-000000000002' };
  const partial = await app.inject({ method: 'POST', url: base, headers: headers(), payload: newCommand });
  assert.equal(partial.statusCode, 503);
  assert.equal(db.count('control_handoff_source_requests'), 1);
  assert.equal(db.count('control_handoff_source_commands'), 1);
  assert.equal(db.count('control_handoff_source_receipts'), 1);
  assert.equal(db.count('control_handoff_source_audits'), 1);
  checkNoSecret(partial.body);
  db.failReceipt = false;
  db.rows.control_handoff_source_receipts?.delete(requestCommandId);
  const orphan = await app.inject({ method: 'GET',
    url: `${path}?contentHash=${ref.contentHash}`, headers: headers() });
  assert.equal(orphan.statusCode, 503);
  assert.equal(orphan.body.includes(command().payload.reason), false);
  await app.close();
  await access.pool.end();
});
