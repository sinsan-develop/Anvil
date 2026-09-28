import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import * as consoleApp from '../src/console/App.tsx';

const {App, classifyReadiness} = consoleApp;

test('operational shell keeps canonical menu order with only the current Dashboard active', () => {
  const html = renderToStaticMarkup(React.createElement(App, {route: '/'}));
  for (const label of ['Dashboard', 'Workbench', 'Projects', 'Runs', 'Reviews', 'Quality',
                       'Knowledge', 'Agents &amp; Automation', 'Environments', 'Operations', 'Settings']) {
    assert.ok(html.includes(label), label);
  }
  assert.equal((html.match(/aria-current="page"/g) || []).length, 1);
  assert.match(html, /NOT CONNECTED/);
  assert.doesNotMatch(html, /localhost:8301|anvil-db:5432|READY · Database/);
});

test('unknown route is a safe route boundary without fake business content', () => {
  const html = renderToStaticMarkup(React.createElement(App, {route: '/not-a-menu'}));
  assert.match(html, /페이지를 사용할 수 없습니다/);
  assert.doesNotMatch(html, /Internal Server Error|stack trace/);
});

test('readiness accepts only confirmed operations or OIDC migration heads', () => {
  assert.equal(classifyReadiness({status:'ready', migration_head:'0019_oidc_sessions'}), 'READY');
  assert.equal(classifyReadiness({status:'ready', migration_head:'0016_operations_recovery'}), 'READY');
  assert.equal(classifyReadiness({status:'ready', migration_head:'0013_task_bootstrap_authority'}), 'NOT CONNECTED');
  assert.equal(classifyReadiness({status:'ready', migration_head:'unknown'}), 'NOT CONNECTED');
  assert.equal(classifyReadiness({status:'not_ready', migration_head:'0019_oidc_sessions'}), 'NOT CONNECTED');
  assert.equal(classifyReadiness({status:'not_ready', reason:'database_unavailable'}), 'NOT CONNECTED');
  assert.equal(classifyReadiness(null), 'NOT CONNECTED');
});

test('Database card shows the server-confirmed head without claiming a different migration', () => {
  const card = consoleApp.DatabaseHealthCard;
  assert.equal(typeof card, 'function');
  const oidc = renderToStaticMarkup(React.createElement(card, {
    value: {status:'ready', migration_head:'0019_oidc_sessions'},
  }));
  assert.match(oidc, /Database.*READY.*Migration 0019_oidc_sessions/s);
  assert.doesNotMatch(oidc, /0016_operations_recovery/);

  const operations = renderToStaticMarkup(React.createElement(card, {
    value: {status:'ready', migration_head:'0016_operations_recovery'},
  }));
  assert.match(operations, /Database.*READY.*Migration 0016_operations_recovery/s);

  const unknown = renderToStaticMarkup(React.createElement(card, {
    value: {status:'ready', migration_head:'unknown'},
  }));
  assert.match(unknown, /Database.*NOT CONNECTED.*연결된 상태 정보가 없습니다/s);
  assert.doesNotMatch(unknown, /Migration /);
});

const providerIds = ['cerebras', 'groq', 'mistral', 'openrouter', 'upstage', 'gemini', 'anthropic', 'openai', 'ollama'];
const providerRows = (registered = []) => providerIds.map((provider_id) => ({
  provider_id,
  credential_status: registered.includes(provider_id) ? 'REGISTERED' : 'MISSING',
  health_status: 'NOT_CHECKED',
  credential: 'secret-must-not-render',
  server_endpoint: 'http://internal-must-not-render:8301',
}));
const jsonResponse = (data, status = 200) => ({ok: status >= 200 && status < 300, status, json: async () => data});

test('Provider card counts only registered credentials and keeps health NOT CHECKED', async () => {
  const requests = [];
  const controller = new AbortController();
  const state = await consoleApp.loadProviderRegistration(controller.signal, async (url, options) => {
    requests.push([url, options]);
    return jsonResponse({data: providerRows(['groq', 'openai'])});
  });
  assert.deepEqual(requests.map(([url]) => url), ['/api/providers']);
  assert.equal(requests[0][1].credentials, 'same-origin');
  assert.equal(requests[0][1].signal, controller.signal);
  assert.deepEqual(state, {status: 'VALID', registered: 2});
  const html = renderToStaticMarkup(React.createElement(consoleApp.ProviderHealthCard, {value: state}));
  assert.match(html, /LLM Providers.*2.*9.*NOT CHECKED/s);
  assert.match(html, /aria-live="polite" aria-atomic="true"/);
  assert.doesNotMatch(html, /READY|secret-must-not-render|internal-must-not-render|DEGRADED/);
});

test('Provider card reports zero registered without implying connection health', async () => {
  const state = await consoleApp.loadProviderRegistration(new AbortController().signal,
    async () => jsonResponse({data: providerRows()}));
  assert.deepEqual(state, {status: 'VALID', registered: 0});
  const html = renderToStaticMarkup(React.createElement(consoleApp.ProviderHealthCard, {value: state}));
  assert.match(html, /0.*9.*NOT CHECKED/s);
  assert.doesNotMatch(html, /READY/);
});

test('Provider card fails closed on auth, server, malformed, incomplete, duplicate and empty responses', async () => {
  const malformed = [null, {}, {data: []}, {data: providerRows().slice(1)},
    {data: [...providerRows().slice(0, 8), providerRows()[0]]},
    {data: providerRows().map((row, index) => index === 0 ? {...row, provider_id: 'unknown'} : row)},
    {data: providerRows().map((row, index) => index === 0 ? {...row, credential_status: 'SECRET'} : row)},
    {data: providerRows().map((row, index) => index === 0 ? {...row, health_status: 'AVAILABLE'} : row)}];
  for (const response of [jsonResponse({}, 401), jsonResponse({}, 403), jsonResponse({}, 500),
    ...malformed.map((body) => jsonResponse(body))]) {
    const state = await consoleApp.loadProviderRegistration(new AbortController().signal, async () => response);
    assert.deepEqual(state, {status: 'UNAVAILABLE', registered: null});
  }
  const html = renderToStaticMarkup(React.createElement(consoleApp.ProviderHealthCard,
    {value: {status: 'UNAVAILABLE', registered: null}}));
  assert.match(html, /LLM Providers.*UNAVAILABLE/s);
  assert.match(html, /aria-live="polite" aria-atomic="true"/);
  assert.doesNotMatch(html, /READY|secret-must-not-render|internal-must-not-render/);
});

test('Provider request and JSON failures never expose raw errors', async () => {
  for (const request of [async () => { throw new Error('secret-must-not-render'); },
    async () => ({ok: true, json: async () => { throw new Error('internal-must-not-render'); }})]) {
    const state = await consoleApp.loadProviderRegistration(new AbortController().signal, request);
    assert.deepEqual(state, {status: 'UNAVAILABLE', registered: null});
  }
});

const alertRow = (overrides = {}) => ({
  alert_id: 'alert-1', sequence: 7, level: 'critical', source: 'worker',
  category: 'availability', code: 'WORKER_LEASE_EXPIRED', related_entity_id: 'run-7',
  dedupe_key: 'private-dedupe-key', detector_rule_revision: 'f13-v1',
  cause: 'Worker lease expiry observed', impact: 'Run ownership cannot be trusted',
  next_action: 'REVIEW_WORKER_TAKEOVER', deep_link: '/operations/workers',
  evidence_hash: 'sha256:private-evidence', status: 'open', owner_id: null,
  observed_at: '2026-09-29T02:00:00+00:00', project_id: 'project-1', environment_id: 'env-1',
  ...overrides,
});
const alertResponse = (alerts, next_before_sequence = null) =>
  ({data: {alerts, next_before_sequence}, request_id: 'request-1'});

test('Critical Alerts reads only stored same-origin records and renders active critical details as text', async () => {
  const calls = [];
  const controller = new AbortController();
  const rows = [alertRow({code: '<img src=x onerror=alert(1)>', source: '<script>bad</script>',
    cause: '<b>unsafe</b>', related_entity_id: '<run-7>'}),
    alertRow({alert_id: 'alert-2', sequence: 8, level: 'warning', code: 'HEALTH_SIGNAL_LATE'}),
    alertRow({alert_id: 'alert-3', sequence: 9, status: 'resolved'}),
    alertRow({alert_id: 'alert-4', sequence: 10, status: 'acknowledged', owner_id: 'operator-1'})];
  const state = await consoleApp.loadCriticalAlerts(controller.signal, async (url, options) => {
    calls.push([url, options]);
    return jsonResponse(alertResponse(rows));
  });
  assert.deepEqual(calls.map(([url]) => url), ['/api/operations/alerts']);
  assert.equal(calls[0][1].credentials, 'same-origin');
  assert.equal(calls[0][1].signal, controller.signal);
  assert.equal(state.status, 'LOADED');
  assert.equal(state.alerts.length, 2);
  const html = renderToStaticMarkup(React.createElement(consoleApp.CriticalAlertsCard, {value: state}));
  assert.match(html, /Critical Alerts.*WORKER_LEASE_EXPIRED|Critical Alerts.*&lt;img/s);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html, /&lt;script&gt;bad&lt;\/script&gt;/);
  assert.match(html, /&lt;b&gt;unsafe&lt;\/b&gt;.*&lt;run-7&gt;/s);
  assert.match(html, /미배정.*operator-1/s);
  assert.doesNotMatch(html, /<script>|<img|HEALTH_SIGNAL_LATE|private-dedupe-key|private-evidence|REVIEW_WORKER_TAKEOVER|href="\/operations\/workers"/);
});

test('Critical Alerts empty page states only that this stored page has no critical records', async () => {
  const state = await consoleApp.loadCriticalAlerts(new AbortController().signal,
    async () => jsonResponse(alertResponse([])));
  const html = renderToStaticMarkup(React.createElement(consoleApp.CriticalAlertsCard, {value: state}));
  assert.match(html, /이 페이지에 저장된 Critical 기록 없음/);
  assert.doesNotMatch(html, /전체.*0건|정상|안전|detector.*실행/);
});

test('Critical Alerts marks older pages unread even when this page has no critical records', async () => {
  const state = await consoleApp.loadCriticalAlerts(new AbortController().signal,
    async () => jsonResponse(alertResponse([alertRow({level: 'warning'})], 7)));
  const html = renderToStaticMarkup(React.createElement(consoleApp.CriticalAlertsCard, {value: state}));
  assert.match(html, /이 페이지에 저장된 Critical 기록 없음/);
  assert.match(html, /과거 페이지.*미조회|부분 결과/);
  assert.doesNotMatch(html, /전체.*0건|정상|안전/);
});

test('Critical Alerts rejects auth, transport, malformed, duplicate and forged pages as UNAVAILABLE', async () => {
  const badBodies = [null, {}, {data: {alerts: []}},
    alertResponse([alertRow({status: 'unknown'})]),
    alertResponse([alertRow({level: 'ok'})]),
    alertResponse([alertRow({observed_at: 'not-a-time'})]),
    alertResponse([alertRow({owner_id: 7})]),
    alertResponse([alertRow(), alertRow({sequence: 8})]),
    alertResponse(Array.from({length: 101}, (_, index) => alertRow({alert_id: `alert-${index}`, sequence: index + 1}))),
    alertResponse([alertRow()], 0), alertResponse([alertRow()], 8),
    alertResponse([alertRow({secret: 'must-not-render'})]),
    {...alertResponse([alertRow()]), admin: true}];
  const responses = [jsonResponse({}, 401), jsonResponse({}, 403), jsonResponse({}, 500),
    ...badBodies.map((body) => jsonResponse(body))];
  for (const response of responses) {
    const state = await consoleApp.loadCriticalAlerts(new AbortController().signal, async () => response);
    assert.equal(state.status, 'UNAVAILABLE');
  }
  for (const request of [async () => { throw new Error('secret-must-not-render'); },
    async () => ({ok: true, json: async () => { throw new Error('internal-must-not-render'); }})]) {
    const state = await consoleApp.loadCriticalAlerts(new AbortController().signal, request);
    assert.equal(state.status, 'UNAVAILABLE');
  }
  const html = renderToStaticMarkup(React.createElement(consoleApp.CriticalAlertsCard,
    {value: {status: 'UNAVAILABLE'}}));
  assert.match(html, /Critical Alerts.*UNAVAILABLE/s);
  assert.doesNotMatch(html, /정상|안전|secret-must-not-render|internal-must-not-render/);
});

test('Dashboard includes Critical Alerts while unrelated operating state stays UNAVAILABLE', () => {
  const html = renderToStaticMarkup(React.createElement(App, {route: '/'}));
  assert.match(html, /Critical Alerts.*UNAVAILABLE/s);
  assert.match(html, /실행·승인·비용 read model은 아직 연결되지 않았습니다. UNAVAILABLE/);
  assert.doesNotMatch(html, /알람 read model은 아직 연결되지 않았습니다/);
  assert.match(html, /Database.*LLM Providers/s);
});
