import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify from 'fastify';
import { buildApp } from '../../../apps/server/app.ts';
import { requestControl } from '../../../apps/server/modules/control-handoff/control-request-store.ts';
import { projectId, requester, requesterClient, baseControl, requestExpiresAt,
  requestCommandId } from './control-handoff-summary-fixture.ts';

const pgPath = '../../../apps/server/modules/control-handoff/control-handoff-pg.ts';
const routePath = '../../../apps/server/modules/control-handoff/routes.ts';
const pg = await import(pgPath).catch((error: NodeJS.ErrnoException) => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
  throw error;
});
const routes = await import(routePath).catch((error: NodeJS.ErrnoException) => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
  throw error;
});
const origin = 'https://anvil.test';
const token = 't'.repeat(43);
const csrf = 'c'.repeat(43);
const command = () => ({ schemaVersion: 1 as const, operation: 'requestControl' as const,
  commandId: requestCommandId, projectId, clientId: requesterClient,
  payload: { targetActorRef: { userId: requester },
    targetClientRef: { userId: requester, clientId: requesterClient },
    baseControl: structuredClone(baseControl), reason: '인수 요청', expiresAt: requestExpiresAt } });

test('PG 생성자 기본 OFF는 요청을 거절하고 pool.connect/query를 호출하지 않는다', async () => {
  assert.equal(typeof pg.createControlHandoffPgSource, 'function', 'PG 생성자 export가 있어야 한다');
  let connects = 0;
  let queries = 0;
  const pool = { async connect() { connects++; throw Error('POOL_MUST_NOT_CONNECT'); },
    async query() { queries++; throw Error('POOL_MUST_NOT_QUERY'); } };
  const access = { async authenticateInTransaction() { throw Error('AUTH_MUST_NOT_RUN'); },
    signControlRequestCursor() { throw Error('SIGN_MUST_NOT_RUN'); },
    verifyControlRequestCursor() { throw Error('VERIFY_MUST_NOT_RUN'); } };
  const source = pg.createControlHandoffPgSource({ pool, access });
  const session = source.forSession(token, csrf, projectId);
  assert.equal(session.requestPort.sourceMode, 'NOT_CONNECTED');
  assert.equal(session.readPort.sourceMode, 'NOT_CONNECTED');
  assert.equal(session.summaryPort.sourceMode, 'NOT_CONNECTED');
  await assert.rejects(requestControl(command(), session.requestPort),
    (error: unknown) => error instanceof Error && error.message === 'CONTROL_REQUEST_NOT_CONNECTED');
  assert.equal(connects, 0);
  assert.equal(queries, 0);
});

test('route 등록 기본 OFF는 다섯 경로를 만들지 않고 기존 buildApp 기본 응답을 유지한다', async () => {
  assert.equal(typeof routes.registerControlHandoffRoutes, 'function', 'route export가 있어야 한다');
  let sourceCalls = 0;
  const source = { forSession() { sourceCalls++; throw Error('SOURCE_MUST_NOT_RUN'); } };
  const app = buildApp();
  routes.registerControlHandoffRoutes(app, { origin, source });
  await app.ready();
  const health = await app.inject({ method: 'GET', url: '/api/v1/health' });
  assert.equal(health.statusCode, 200);
  assert.deepEqual(health.json(), { status: 'ok', scope: 'process', version: '0.1.0' });
  const base = `/api/v1/projects/${projectId}/control-requests`;
  const paths = [base, `${base}/${requester}/versions/1`,
    `${base}/${requester}/versions/1/handoff-summaries`,
    `${base}/${requester}/versions/1/handoff-summaries/1`];
  for (const url of paths) {
    const response = await app.inject({ method: 'GET', url, headers: { host: 'anvil.test' } });
    assert.equal(response.statusCode, 404);
    assert.equal(response.json().code, 'NOT_FOUND');
  }
  assert.equal(sourceCalls, 0);
  await app.close();
});

test('선택 등록한 route는 정확 다섯 경로만 인식하고 GET에도 CSRF를 요구한다', async () => {
  assert.equal(typeof routes.registerControlHandoffRoutes, 'function', 'route export가 있어야 한다');
  let sourceCalls = 0;
  const source = { forSession() { sourceCalls++; throw Error('SOURCE_MUST_NOT_RUN'); } };
  const app = Fastify({ logger: false });
  routes.registerControlHandoffRoutes(app, { origin, source, enabled: true });
  await app.ready();
  const base = `/api/v1/projects/${projectId}/control-requests`;
  const ref = `${base}/${requester}/versions/1`;
  const headers = { host: 'anvil.test', cookie: `__Host-anvil.sid=${token}` };
  const candidates = [
    { method: 'POST' as const, url: base, body: command() },
    { method: 'GET' as const, url: `${base}?view=OWN` },
    { method: 'GET' as const, url: `${ref}?contentHash=${'a'.repeat(64)}` },
    { method: 'POST' as const, url: `${ref}/handoff-summaries`, body: {
      schemaVersion: 1, operation: 'prepareControlHandoff', commandId: requester,
      projectId, clientId: requesterClient,
      payload: { requestRef: { id: requester, version: 1, contentHash: 'a'.repeat(64) } } } },
    { method: 'GET' as const, url: `${ref}/handoff-summaries/1?requestHash=${'a'.repeat(64)}&summaryHash=${'b'.repeat(64)}` }
  ];
  for (const item of candidates) {
    const response = await app.inject({ method: item.method, url: item.url,
      headers: { ...headers, ...(item.method === 'POST' ? { origin, 'content-type': 'application/json' } : {}) },
      ...(item.method === 'POST' ? { payload: JSON.stringify(item.body) } : {}) });
    assert.equal(response.statusCode, 403, `${item.method} ${item.url}`);
    assert.equal(response.json().code, 'CSRF_INVALID');
  }
  const extra = await app.inject({ method: 'GET', url: `${ref}/extra`, headers });
  assert.equal(extra.statusCode, 404);
  assert.equal(sourceCalls, 0);
  await app.close();
});

test('malformed JSON은 고정 INPUT_INVALID400과 non-retry만 내고 source를 호출하지 않는다', async () => {
  assert.equal(typeof routes.registerControlHandoffRoutes, 'function', 'route export가 있어야 한다');
  let calls = 0;
  const source = { forSession() { calls++; throw Error('SOURCE_MUST_NOT_RUN'); } };
  const app = Fastify({ logger: false });
  routes.registerControlHandoffRoutes(app, { origin, source, enabled: true });
  const response = await app.inject({ method: 'POST',
    url: `/api/v1/projects/${projectId}/control-requests`,
    headers: { host: 'anvil.test', origin, 'content-type': 'application/json',
      'x-anvil-csrf': csrf, cookie: `__Host-anvil.sid=${token}` },
    payload: '{"schemaVersion":1,' });
  assert.equal(response.statusCode, 400, response.body);
  assert.equal(response.json().code, 'INPUT_INVALID');
  assert.equal(response.json().retryDisposition, 'not-retryable');
  assert.equal(calls, 0);
  await app.close();
});

test('2MiB를 넘는 FN15 POST는 PAYLOAD_TOO_LARGE413 non-retry이며 source를 호출하지 않는다', async () => {
  assert.equal(typeof routes.registerControlHandoffRoutes, 'function', 'route export가 있어야 한다');
  let calls = 0;
  const source = { forSession() { calls++; throw Error('SOURCE_MUST_NOT_RUN'); } };
  const app = buildApp({}, undefined, undefined, undefined, { origin, source, enabled: true });
  const oversized = JSON.stringify({ ...command(), payload: { ...command().payload,
    reason: 'x'.repeat(2 * 1024 * 1024) } });
  assert.ok(Buffer.byteLength(oversized, 'utf8') > 2 * 1024 * 1024);
  const response = await app.inject({ method: 'POST',
    url: `/api/v1/projects/${projectId}/control-requests`,
    headers: { host: 'anvil.test', origin, 'content-type': 'application/json',
      'x-anvil-csrf': csrf, cookie: `__Host-anvil.sid=${token}` },
    payload: oversized });
  assert.equal(response.statusCode, 413, response.body);
  assert.equal(response.json().code, 'PAYLOAD_TOO_LARGE');
  assert.equal(response.json().retryDisposition, 'not-retryable');
  assert.equal(calls, 0);
  assert.equal(response.body.includes('x'.repeat(100)), false);
  await app.close();
});
