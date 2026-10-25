import assert from 'node:assert/strict';
import test from 'node:test';
import { buildApp } from '../../../apps/server/app.ts';
import { canonicalJson, contentHash } from '../../../contracts/canonical.ts';
import { createControlHandoffSummary } from '../../../apps/server/modules/control-handoff/control-handoff-summary.ts';
import { baseControl, controller, controllerClient, copy, now, otherProject,
  projectId, requestBundle, requester, requesterClient } from '../../../tests/unit/FN15/control-handoff-summary-fixture.ts';

const loaded: Record<string, unknown> = await import(
  '../../../apps/server/modules/control-handoff/control-handoff-pg.ts'
).catch((error: NodeJS.ErrnoException) => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
  throw error;
});
const checksum = 'c6bd081fc7a70f8eaa68ac673cce6f8e41549d98f2c3e5bb3c22833874b0e522';
const origin = 'https://anvil.test';
const requesterToken = 'r'.repeat(43);
const controllerToken = 'o'.repeat(43);
const csrf = 'c'.repeat(43);
const stored = requestBundle();
const ref = stored.request.requestRef;
const summary = createControlHandoffSummary({ projectId, requestRef: ref, version: 2,
  controller: baseControl, baseControl, observedAt: '2026-10-25T08:59:00.000Z',
  requestExpiresAt: stored.request.snapshot.expiresAt,
  collections: { activeExecutions: null, pendingCommands: null,
    pendingApprovals: null, sourceCheckpointRefs: null } });
const summaryRef = summary.summaryRef;
const summaryCommandId = '88888888-8888-4888-8888-000000000002';
const summaryWire = { schemaVersion: 1, operation: 'prepareControlHandoff', commandId: summaryCommandId,
  projectId, clientId: controllerClient, payload: { requestRef: ref } };
const summaryCommandHash = contentHash(canonicalJson(summaryWire));
const summaryPayloadHash = contentHash(canonicalJson(summaryWire.payload));
const linkedSummary = { schemaVersion: 1, commandId: summaryCommandId,
  commandHash: summaryCommandHash, projectId, actorId: controller, clientId: controllerClient,
  requestRef: ref, summaryRef };
type Row = Record<string, unknown>;

class FakePoolClient {
  readonly statements: Array<{ sql: string; values: readonly unknown[] }> = [];
  connects = 0;
  releases = 0;
  generation = 5;
  memberRevoked = false;
  summaryRows: Row[] = [];
  observed = 0;
  memberReads = 0;
  onSecondMemberRead: (() => void) | null = null;

  async query(sql: string, values: readonly unknown[] = []): Promise<{ rows: Row[] }> {
    this.statements.push({ sql, values: copy(values) });
    if (/^(BEGIN|COMMIT|ROLLBACK)\b/i.test(sql)) return { rows: [] };
    if (/to_regclass/i.test(sql)) return { rows: [{ ready: true }] };
    if (/FROM\s+anvil\.schema_migrations\b/i.test(sql))
      return { rows: values[0] === '0041_control_handoff_source'
        ? [{ id: values[0], checksum }] : [] };
    if (/FROM\s+anvil\.projects\b/i.test(sql))
      return { rows: values[0] === projectId ? [{ id: projectId, archived_at: null }] : [] };
    if (/FROM\s+anvil\.project_members\b/i.test(sql)) {
      this.memberReads++;
      if (this.memberReads === 2) this.onSecondMemberRead?.();
      const actor = values[1];
      return { rows: values[0] === projectId && (actor === requester || actor === controller)
        ? [{ project_id: projectId, user_id: actor,
          participation: actor === controller ? 'OWNER' : 'HANDOFF_ELIGIBLE',
          revoked_at: this.memberRevoked ? new Date(now) : null }] : [] };
    }
    if (/FROM\s+anvil\.project_control\b/i.test(sql))
      return { rows: values[0] === projectId ? [{ project_id: projectId, actor_id: controller,
        client_id: controllerClient, generation: String(this.generation), version: '8',
        revoked_at: null }] : [] };
    if (/clock_timestamp\(\)/i.test(sql)) {
      this.observed++;
      return { rows: [{ at: new Date(now) }] };
    }
    if (/FROM\s+anvil\.control_handoff_source_requests\b/i.test(sql)) {
      assert.match(sql, /project_id\s*=\s*\$1/i);
      assert.match(sql, /(?:\bid|request_id)\s*=\s*\$2/i);
      assert.match(sql, /version\s*=\s*\$3/i);
      assert.match(sql, /content_hash\s*=\s*\$4/i);
      if (values[0] !== projectId || values[1] !== ref.id || values[2] !== ref.version
        || values[3] !== ref.contentHash) return { rows: [] };
      if (/SELECT\s+source_command_id/i.test(sql))
        return { rows: [{ source_command_id: stored.command.commandId }] };
      return { rows: [{ id: ref.id, version: ref.version, content_hash: ref.contentHash,
        snapshot_json: copy(stored.request.snapshot), metadata_json: copy(stored.request.metadata) }] };
    }
    if (/FROM\s+anvil\.control_handoff_source_commands\b/i.test(sql)) {
      if (values[0] === summaryCommandId) return { rows: [{ command_id: summaryCommandId,
        command_hash: summaryCommandHash, payload_hash: summaryPayloadHash,
        operation: 'prepareControlHandoff', project_id: projectId, actor_id: controller,
        client_id: controllerClient, base_control_json: copy(baseControl),
        request_id: ref.id, request_version: ref.version, request_hash: ref.contentHash,
        summary_version: summaryRef.version, summary_hash: summaryRef.contentHash,
        created_at: new Date(summary.body.observedAt) }] };
      if (values[0] !== stored.command.commandId) return { rows: [] };
      return { rows: [{ command_id: stored.command.commandId,
        command_hash: stored.command.commandHash, payload_hash: stored.command.payloadHash,
        operation: 'requestControl', project_id: projectId, actor_id: requester,
        client_id: requesterClient, base_control_json: copy(baseControl),
        request_id: ref.id, request_version: ref.version, request_hash: ref.contentHash,
        created_at: new Date(stored.command.createdAt) }] };
    }
    if (/FROM\s+anvil\.control_handoff_source_receipts\b/i.test(sql))
      return { rows: values[0] !== projectId ? []
        : values[1] === stored.command.commandId ? [{ body_json: copy(stored.receipts[0]) }]
          : values[1] === summaryCommandId
            ? [{ body_json: { ...copy(linkedSummary), outcome: 'SUMMARY_STORED' } }] : [] };
    if (/FROM\s+anvil\.control_handoff_source_audits\b/i.test(sql))
      return { rows: values[0] !== projectId ? []
        : values[1] === stored.command.commandId ? [{ body_json: copy(stored.audits[0]) }]
          : values[1] === summaryCommandId
            ? [{ body_json: { ...copy(linkedSummary), event: 'CONTROL_HANDOFF_SUMMARY_STORED' } }] : [] };
    if (/FROM\s+anvil\.control_handoff_source_summaries\b/i.test(sql)) {
      assert.match(sql, /project_id\s*=\s*\$1/i);
      assert.match(sql, /request_id\s*=\s*\$2/i);
      const fixed = /content_hash\s*=\s*\$4/i.test(sql);
      if (fixed) {
        if (values[0] !== projectId || values[1] !== ref.id
          || values[2] !== summaryRef.version || values[3] !== summaryRef.contentHash)
          return { rows: [] };
        if (/SELECT\s+source_command_id/i.test(sql))
          return { rows: [{ source_command_id: summaryCommandId }] };
        return { rows: [{ request_id: ref.id, version: summaryRef.version,
          content_hash: summaryRef.contentHash, body_json: copy(summary.body),
          metadata_json: copy(summary.metadata) }] };
      }
      assert.match(sql, /request_version\s*=\s*\$3/i);
      assert.match(sql, /request_hash\s*=\s*\$4/i);
      assert.match(sql, /ORDER\s+BY\s+version\s+DESC\s+LIMIT\s+1\b/i);
      const matching = this.summaryRows.filter(row => row.project_id === values[0]
        && row.request_id === values[1] && row.request_version === values[2]
        && row.request_hash === values[3]);
      matching.sort((left, right) => Number(right.version) - Number(left.version));
      return { rows: matching.slice(0, 1).map(copy) };
    }
    throw Error('UNEXPECTED_TEST_SQL');
  }
  release(): void { this.releases++; }
}

function headers(token = requesterToken): Record<string, string> {
  return { host: 'anvil.test', origin, 'x-anvil-csrf': csrf,
    cookie: `__Host-anvil.sid=${token}` };
}
function sourceWith(db: FakePoolClient, enabled = true) {
  assert.equal(typeof loaded.createControlHandoffPgSource, 'function', 'PG 생성자 export가 있어야 한다');
  const callback = loaded.createControlHandoffPgSource;
  if (typeof callback !== 'function') throw Error('MISSING_PG_SOURCE_EXPORT');
  const pool = { async connect() { db.connects++; return db; },
    async query() { throw Error('POOL_QUERY_FORBIDDEN'); } };
  const access = { async authenticateInTransaction(_db: unknown, token: string, presentedCsrf: string) {
    assert.equal(presentedCsrf, csrf);
    const actorId = token === controllerToken ? controller : requester;
    return { actorId, clientId: token === controllerToken ? controllerClient : requesterClient,
      serverOwner: false, credentialGeneration: 3, reauthUntil: null,
      authSession: { id: actorId, idleExpiresAt: '2026-10-25T10:00:00.000Z',
        absoluteExpiresAt: '2026-10-25T11:00:00.000Z' } };
  }, signControlRequestCursor() { throw Error('SIGN_FORBIDDEN'); },
    verifyControlRequestCursor() { throw Error('VERIFY_FORBIDDEN'); } };
  return callback({ pool, access, enabled });
}

test('기본 OFF 조회 2개는 route 미등록·pool 접속 0이다', async () => {
  const db = new FakePoolClient();
  const source = sourceWith(db, false);
  const session = source.forSession(requesterToken, csrf, projectId);
  assert.equal(session.discoveryPort.sourceMode, 'NOT_CONNECTED');
  const app = buildApp();
  const control = await app.inject({ method: 'GET',
    url: `/api/v1/projects/${projectId}/control-state`, headers: headers() });
  const head = await app.inject({ method: 'GET',
    url: `/api/v1/projects/${projectId}/control-requests/${ref.id}/versions/1/handoff-summaries/head?requestHash=${ref.contentHash}`,
    headers: headers() });
  assert.equal(control.statusCode, 404);
  assert.equal(head.statusCode, 404);
  assert.equal(db.connects, 0);
  assert.equal(db.statements.length, 0);
  await app.close();
});

test('선택 등록 HTTP가 정확 control.version과 NONE→최신 ref를 읽고 쓰기 없이 끝난다', async () => {
  const db = new FakePoolClient();
  const source = sourceWith(db);
  const app = buildApp({}, undefined, undefined, undefined, { origin, source, enabled: true });
  const base = `/api/v1/projects/${projectId}`;
  const path = `${base}/control-requests/${ref.id}/versions/1/handoff-summaries/head`;
  const control = await app.inject({ method: 'GET', url: `${base}/control-state`,
    headers: headers(controllerToken) });
  assert.equal(control.statusCode, 200, control.body);
  assert.deepEqual(control.json().control, { state: 'HELD', basis: baseControl });
  const none = await app.inject({ method: 'GET', url: `${path}?requestHash=${ref.contentHash}`,
    headers: headers() });
  assert.equal(none.statusCode, 200, none.body);
  assert.deepEqual(none.json().head, { state: 'NONE', summaryRef: null });
  db.summaryRows.push({ project_id: projectId, request_id: ref.id,
    request_version: ref.version, request_hash: ref.contentHash,
    version: 1, content_hash: 'a'.repeat(64) },
  { project_id: projectId, request_id: ref.id, request_version: ref.version,
    request_hash: ref.contentHash, version: 2, content_hash: summaryRef.contentHash },
  { project_id: otherProject, request_id: ref.id, request_version: ref.version,
    request_hash: ref.contentHash, version: 3, content_hash: 'c'.repeat(64) });
  const available = await app.inject({ method: 'GET',
    url: `${path}?requestHash=${ref.contentHash}`, headers: headers() });
  assert.equal(available.statusCode, 200, available.body);
  assert.deepEqual(available.json().head, { state: 'AVAILABLE', summaryRef });
  const wrong = await app.inject({ method: 'GET',
    url: `${path}?requestHash=${'0'.repeat(64)}`, headers: headers() });
  assert.notEqual(wrong.statusCode, 200);
  const duplicate = await app.inject({ method: 'GET',
    url: `${path}?requestHash=${ref.contentHash}&requestHash=${ref.contentHash}`,
    headers: headers() });
  assert.equal(duplicate.statusCode, 400);
  const numeric = await app.inject({ method: 'GET',
    url: `${base}/control-requests/${ref.id}/versions/1/handoff-summaries/2?requestHash=${ref.contentHash}&summaryHash=${summaryRef.contentHash}`,
    headers: headers() });
  assert.equal(numeric.statusCode, 200, numeric.body);
  assert.deepEqual(numeric.json().summaryRef, summaryRef);
  assert.equal(numeric.json().body.validUntil, summary.body.validUntil);
  assert.equal(numeric.json().body.safetyState, 'UNVERIFIED');
  assert.equal(numeric.json().current.expired, false);
  assert.ok(db.connects >= 3);
  assert.equal(db.connects, db.releases);
  assert.equal(db.statements.some(item => /^\s*(?:INSERT|UPDATE|DELETE)\b|\bnextval\s*\(/i.test(item.sql)), false);
  await app.close();
});

test('조회 중 회원 회수는 응답을 차단하고 원자료·원예외를 공개하지 않는다', async () => {
  const db = new FakePoolClient();
  const app = buildApp({}, undefined, undefined, undefined,
    { origin, source: sourceWith(db), enabled: true });
  const url = `/api/v1/projects/${projectId}/control-state`;
  const baseline = await app.inject({ method: 'GET', url, headers: headers() });
  assert.equal(baseline.statusCode, 200, baseline.body);
  assert.deepEqual(baseline.json().control, { state: 'OTHER_CLIENT', basis: baseControl });
  assert.equal(db.observed, 2);
  assert.equal(db.memberReads, 2);
  db.observed = 0;
  db.memberReads = 0;
  db.onSecondMemberRead = () => { db.memberRevoked = true; };
  const result = await app.inject({ method: 'GET',
    url, headers: headers() });
  assert.equal(db.observed, 2);
  assert.equal(db.memberReads, 2);
  assert.equal(result.statusCode, 403, result.body);
  assert.equal(result.json().code, 'ACCESS_DENIED');
  assert.equal(result.body.includes('"control"'), false);
  assert.equal(result.body.includes(requesterToken), false);
  assert.equal(result.body.includes('UNEXPECTED_TEST_SQL'), false);
  assert.equal(db.connects, db.releases);
  await app.close();
});
