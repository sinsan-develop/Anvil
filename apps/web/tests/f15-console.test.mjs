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
  assert.match(oidc, /Database.*UNAVAILABLE.*API 준비 READY.*Migration 0019_oidc_sessions/s);
  assert.doesNotMatch(oidc, /status-ready|HEALTHY/);
  assert.doesNotMatch(oidc, /0016_operations_recovery/);

  const operations = renderToStaticMarkup(React.createElement(card, {
    value: {status:'ready', migration_head:'0016_operations_recovery'},
  }));
  assert.match(operations, /Database.*UNAVAILABLE.*API 준비 READY.*Migration 0016_operations_recovery/s);

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
const jsonResponse = (data, status = 200) => ({ok: status >= 200 && status < 300, status,
  json: async () => data, text: async () => JSON.stringify(data)});

test('non-ok Provider, Alerts, and Health bodies finish without exposing their contents', async () => {
  const secret = 'private-response-body-must-not-render';
  const calls = [];
  const failure = (name, status) => ({ok: false, status,
    text: async () => { calls.push(name); return secret; },
    json: async () => { throw new Error('non-ok JSON must not be parsed'); }});
  const signal = new AbortController().signal;
  const provider = await consoleApp.loadProviderRegistration(signal, async () => failure('provider', 401));
  const alerts = await consoleApp.loadCriticalAlerts(signal, async () => failure('alerts', 403));
  const health = await consoleApp.loadReadiness(signal, async () => failure('health', 503));
  const firstPage = await consoleApp.loadCriticalAlerts(signal,
    async () => jsonResponse(alertResponse([alertRow()], 7)));
  const older = await consoleApp.loadOlderCriticalAlerts(firstPage, signal,
    async () => failure('older-alerts', 401));
  assert.deepEqual(calls, ['provider', 'alerts', 'health', 'older-alerts']);
  assert.deepEqual(provider, {status: 'UNAVAILABLE', registered: null});
  assert.deepEqual(alerts, {status: 'BLOCKED'});
  assert.deepEqual(older, {status: 'UNAVAILABLE'});
  assert.deepEqual(health, {payload: null, checked: 'JUST NOW'});
  const html = [renderToStaticMarkup(React.createElement(consoleApp.ProviderHealthCard, {value: provider})),
    renderToStaticMarkup(React.createElement(consoleApp.CriticalAlertsCard, {value: alerts})),
    renderToStaticMarkup(React.createElement(consoleApp.DatabaseHealthCard, {value: health.payload}))].join('');
  assert.doesNotMatch(html, /private-response-body-must-not-render/);
});

test('Critical Alerts 403 waits for body completion then shows BLOCKED without response contents', async () => {
  let releaseBody;
  const privateBody = 'private-403-response-must-not-render';
  const body = new Promise((resolve) => { releaseBody = resolve; });
  const pending = consoleApp.loadCriticalAlerts(new AbortController().signal,
    async () => ({ok: false, status: 403, text: () => body,
      json: async () => { throw new Error('403 JSON must not be parsed'); }}));
  let settled = false;
  void pending.then(() => { settled = true; });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(settled, false);
  releaseBody(privateBody);
  const state = await pending;
  assert.deepEqual(state, {status: 'BLOCKED'});
  const html = renderToStaticMarkup(React.createElement(consoleApp.CriticalAlertsCard, {value: state}));
  assert.match(html, /Critical Alerts.*BLOCKED.*조회 차단/s);
  assert.doesNotMatch(html, /private-403-response-must-not-render|저장된 Critical 기록 없음/);
});

test('non-ok body read errors and abort remain fail-closed without stale success', async () => {
  const controller = new AbortController();
  const request = async () => ({ok: false, status: 401, text: async () => {
    controller.abort();
    throw new Error('private-body-read-error');
  }});
  assert.deepEqual(await consoleApp.loadProviderRegistration(controller.signal, request),
    {status: 'UNAVAILABLE', registered: null});
  assert.deepEqual(await consoleApp.loadCriticalAlerts(new AbortController().signal, request),
    {status: 'UNAVAILABLE'});
  assert.deepEqual(await consoleApp.loadReadiness(new AbortController().signal, request),
    {payload: null, checked: 'FAILED'});
});

test('non-ok Provider, Alerts, and Health wait for body completion before settling', async () => {
  const cases = [
    [consoleApp.loadProviderRegistration, {status: 'UNAVAILABLE', registered: null}],
    [consoleApp.loadCriticalAlerts, {status: 'UNAVAILABLE'}],
    [consoleApp.loadReadiness, {payload: null, checked: 'JUST NOW'}],
  ];
  for (const [loader, expected] of cases) {
    let finishBody;
    const body = new Promise((resolve) => { finishBody = resolve; });
    const pending = loader(new AbortController().signal,
      async () => ({ok: false, status: 401, text: () => body}));
    let settled = false;
    void pending.then(() => { settled = true; });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(settled, false);
    finishBody('discarded-private-body');
    assert.deepEqual(await pending, expected);
  }
});

test('successful Health retains same-origin request and readiness payload', async () => {
  const controller = new AbortController();
  const expected = {status: 'ready', migration_head: '0019_oidc_sessions'};
  const calls = [];
  const health = await consoleApp.loadReadiness(controller.signal, async (url, options) => {
    calls.push([url, options]);
    return {ok: true, json: async () => expected,
      text: async () => { throw new Error('successful body must not use failure reader'); }};
  });
  assert.deepEqual(health, {payload: expected, checked: 'JUST NOW'});
  assert.equal(calls[0][0], '/api/health/ready');
  assert.equal(calls[0][1].credentials, 'same-origin');
  assert.equal(calls[0][1].signal, controller.signal);
  assert.equal(consoleApp.classifyReadiness(health.payload), 'READY');
});

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
  assert.match(html, /operator-1.*미배정/s);
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
  const responses = [jsonResponse({}, 401), jsonResponse({}, 500),
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
  assert.match(html, /Critical Alerts.*LOADING/s);
  assert.match(html, /실행·승인·비용 read model은 아직 연결되지 않았습니다. UNAVAILABLE/);
  assert.doesNotMatch(html, /알람 read model은 아직 연결되지 않았습니다/);
  assert.match(html, /Database.*LLM Providers/s);
});

test('Critical Alerts loads a second stored page with exclusive cursor and newest-first records', async () => {
  const firstRows = Array.from({length: 100}, (_, index) =>
    alertRow({alert_id: `alert-${index + 2}`, sequence: index + 2, code: `CODE_${index + 2}`}));
  const calls = [];
  const request = async (url, options) => {
    calls.push([url, options]);
    return jsonResponse(calls.length === 1
      ? alertResponse(firstRows, 2)
      : alertResponse([alertRow({alert_id: 'alert-1', sequence: 1, code: 'CODE_1'})]));
  };
  const signal = new AbortController().signal;
  const first = await consoleApp.loadCriticalAlerts(signal, request);
  assert.equal(first.status, 'LOADED');
  assert.equal(first.partial, true);
  const second = await consoleApp.loadOlderCriticalAlerts(first, signal, request);
  assert.equal(second.status, 'LOADED');
  assert.equal(second.partial, false);
  assert.equal(second.alerts.length, 101);
  assert.deepEqual(second.alerts.map(({code}) => code),
    Array.from({length: 101}, (_, index) => `CODE_${101 - index}`));
  assert.equal(calls.length, 2);
  assert.deepEqual(calls.map(([url]) => url), ['/api/operations/alerts', '/api/operations/alerts']);
  assert.equal(calls[1][1].credentials, 'same-origin');
  assert.equal(calls[1][1].signal, signal);
  assert.equal(calls[1][1].headers['x-alert-before-sequence'], '2');
  const html = renderToStaticMarkup(React.createElement(consoleApp.CriticalAlertsCard, {value: second}));
  assert.match(html, /저장된 페이지 조회 종료/);
  assert.doesNotMatch(html, /과거 페이지 미조회|부분 결과/);
});

test('Critical Alerts exposes an accessible older-page button only while a cursor remains', async () => {
  const first = await consoleApp.loadCriticalAlerts(new AbortController().signal,
    async () => jsonResponse(alertResponse([alertRow()], 7)));
  const callback = () => {};
  const ready = renderToStaticMarkup(React.createElement(consoleApp.CriticalAlertsCard,
    {value: first, onLoadOlder: callback, loadingOlder: false}));
  assert.match(ready, /<button type="button"[^>]*>과거 저장 경고 더 보기<\/button>/);
  assert.match(ready, /aria-live="polite"/);
  const loading = renderToStaticMarkup(React.createElement(consoleApp.CriticalAlertsCard,
    {value: first, onLoadOlder: callback, loadingOlder: true}));
  assert.match(loading, /<button type="button"[^>]*disabled=""[^>]*>과거 저장 경고 더 보기<\/button>/);
  const ended = await consoleApp.loadCriticalAlerts(new AbortController().signal,
    async () => jsonResponse(alertResponse([alertRow()])));
  assert.doesNotMatch(renderToStaticMarkup(React.createElement(consoleApp.CriticalAlertsCard,
    {value: ended, onLoadOlder: callback})), /과거 저장 경고 더 보기/);
});

test('Critical Alerts allows only one in-flight request for the same older cursor', async () => {
  const first = await consoleApp.loadCriticalAlerts(new AbortController().signal,
    async () => jsonResponse(alertResponse([alertRow({alert_id: 'alert-7'})], 7)));
  const guard = {current: false};
  let release;
  const waitForResponse = new Promise((resolve) => { release = resolve; });
  let calls = 0;
  const request = async () => {
    calls += 1;
    await waitForResponse;
    return jsonResponse(alertResponse([alertRow({alert_id: 'alert-6', sequence: 6})]));
  };
  const signal = new AbortController().signal;
  const pending = consoleApp.loadOlderCriticalAlertsOnce(first, signal, guard, request);
  assert.equal(guard.current, true);
  assert.equal(await consoleApp.loadOlderCriticalAlertsOnce(first, signal, guard, request), null);
  assert.equal(calls, 1);
  release();
  assert.equal((await pending).status, 'LOADED');
  assert.equal(guard.current, false);
});

test('Critical Alerts older-page 403 clears previously loaded records after body completion', async () => {
  const first = await consoleApp.loadCriticalAlerts(new AbortController().signal,
    async () => jsonResponse(alertResponse([alertRow({alert_id: 'alert-7', code: 'OLD_PRIVATE_CODE'})], 7)));
  let releaseBody;
  const body = new Promise((resolve) => { releaseBody = resolve; });
  const pending = consoleApp.loadOlderCriticalAlerts(first, new AbortController().signal,
    async () => ({ok: false, status: 403, text: () => body,
      json: async () => { throw new Error('403 JSON must not be parsed'); }}));
  let settled = false;
  void pending.then(() => { settled = true; });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(settled, false);
  releaseBody('private-older-403-body');
  const next = await pending;
  assert.deepEqual(next, {status: 'BLOCKED'});
  const html = renderToStaticMarkup(React.createElement(consoleApp.CriticalAlertsCard, {value: next}));
  assert.match(html, /Critical Alerts.*BLOCKED.*조회 차단/s);
  assert.doesNotMatch(html, /OLD_PRIVATE_CODE|private-older-403-body|과거 저장 경고 더 보기/);
});

test('Critical Alerts unreadable 403 bodies stay UNAVAILABLE for initial and older pages', async () => {
  const denied = async () => ({ok: false, status: 403,
    text: async () => { throw new Error('private-body-error'); }});
  const signal = new AbortController().signal;
  assert.deepEqual(await consoleApp.loadCriticalAlerts(signal, denied), {status: 'UNAVAILABLE'});
  const first = await consoleApp.loadCriticalAlerts(signal,
    async () => jsonResponse(alertResponse([alertRow({alert_id: 'alert-7'})], 7)));
  assert.deepEqual(await consoleApp.loadOlderCriticalAlerts(first, signal, denied), {status: 'UNAVAILABLE'});
});

test('Critical Alerts drops earlier protected records if an older page is invalid or unavailable', async () => {
  const first = await consoleApp.loadCriticalAlerts(new AbortController().signal,
    async () => jsonResponse(alertResponse([alertRow({alert_id: 'alert-7'})], 7)));
  const responses = [jsonResponse({}, 401), jsonResponse({}, 500),
    jsonResponse(alertResponse([])),
    jsonResponse(alertResponse([alertRow({sequence: 7})])),
    jsonResponse(alertResponse([alertRow({alert_id: 'alert-7', sequence: 6})])),
    jsonResponse(alertResponse([alertRow({sequence: 6})], 7)),
    jsonResponse(alertResponse([alertRow({sequence: 6, cause: '<script>secret</script>', extra: true})])),
    jsonResponse({data: {alerts: null, next_before_sequence: null}})];
  for (const response of responses) {
    const next = await consoleApp.loadOlderCriticalAlerts(first, new AbortController().signal,
      async () => response);
    assert.deepEqual(next, {status: 'UNAVAILABLE'});
  }
  for (const request of [async () => { throw new Error('secret'); },
    async () => ({ok: true, json: async () => { throw new Error('secret'); }})]) {
    assert.deepEqual(await consoleApp.loadOlderCriticalAlerts(first,
      new AbortController().signal, request), {status: 'UNAVAILABLE'});
  }
  const html = renderToStaticMarkup(React.createElement(consoleApp.CriticalAlertsCard,
    {value: {status: 'UNAVAILABLE'}}));
  assert.doesNotMatch(html, /alert-7|secret|<script>/);
});

const dashboardQueueRow = (overrides = {}) => ({
  job_id: 'private-job-id', run_id: 'private-run-id', state: 'PENDING',
  available_at: '2026-09-30T00:00:00+00:00', attempts: 0, max_attempts: 2,
  lease_epoch: 0, lease_expires_at: null, dependency_ids: [], conflict_keys: [],
  priority: 'UNKNOWN', required_capability: 'UNKNOWN', input_verified: true,
  backoff_until: '2026-09-30T00:00:00+00:00', ...overrides,
});
const dashboardSnapshot = (queue = [], gaps = ['queue']) => ({
  observed_at: '2026-09-30T00:00:00+00:00',
  health: Object.fromEntries(['database', 'queue', 'worker', 'provider', 'backend', 'artifact_store']
    .map((component) => [component, {state: 'UNKNOWN', observed_at: null,
      stale_after_seconds: null, last_check: null, error_count: null,
      detail_path: null, evidence_ref: null}])),
  queue, quarantine: [], worker: [], budget: [], reservations: [], providers: [],
  deployments: [], source_gaps: gaps, alerts: [], next_actions: [],
});
const dashboardResponse = (queue = [], gaps = ['queue']) =>
  ({data: dashboardSnapshot(queue, gaps), request_id: 'request-1'});

const observedHealth = (state, overrides = {}) => ({
  state, observed_at: '2026-09-30T00:00:00+00:00', stale_after_seconds: 60,
  last_check: '2026-09-30T00:00:00+00:00', error_count: 2,
  detail_path: '/operations/health', evidence_ref: `sha256:${'a'.repeat(64)}`,
  ...overrides,
});

const renderDatabase = (readiness, operations) => renderToStaticMarkup(
  React.createElement(consoleApp.DatabaseHealthCard, {value: readiness, operations}));

const renderObservationTime = (operations) => renderToStaticMarkup(
  React.createElement(consoleApp.DashboardObservationTime, {value: operations}));

test('Dashboard 429 clears protected state and shows quota across dependent cards without exposing its body', async () => {
  const secret = 'postgresql://quota-secret@internal/private-payload';
  const state = await consoleApp.loadDashboardQueue(new AbortController().signal,
    async (url, options) => {
      assert.equal(url, '/api/dashboard/operations');
      assert.equal(options.credentials, 'same-origin');
      return {ok: false, status: 429, text: async () => secret};
    });
  assert.deepEqual(state, {status: 'QUOTA'});
  const cards = [renderObservationTime(state),
    renderToStaticMarkup(React.createElement(consoleApp.QueueHealthCard, {value: state})),
    renderToStaticMarkup(React.createElement(consoleApp.DatabaseHealthCard,
      {value: {status: 'ready', migration_head: '0019_oidc_sessions'}, operations: state})),
    renderToStaticMarkup(React.createElement(consoleApp.DashboardSignalCard,
      {label: 'Worker', component: 'worker', value: state})),
    renderToStaticMarkup(React.createElement(consoleApp.NextActionsCard, {value: state}))];
  assert.match(cards[0], /대시보드 관측 시각 · 조회 제한/);
  for (const card of cards.slice(1)) assert.match(card, /QUOTA/);
  assert.match(cards[1], /조회 제한/);
  assert.match(cards[2], /API 준비 READY · Migration 0019_oidc_sessions/);
  assert.match(cards[2], /조회 제한 · Database 상태 정보를 표시하지 않습니다/);
  assert.match(cards[3], /조회 제한 · Worker 상태 정보를 표시하지 않습니다/);
  assert.match(cards[4], /조회 제한/);
  for (const card of cards) assert.doesNotMatch(card,
    /private-payload|quota-secret|internal|private-job-id|2026-09-30|0건|href=/);
});

test('Dashboard observation time shows only the validated operations timestamp and keeps Queue unchanged', async () => {
  const snapshot = dashboardSnapshot([dashboardQueueRow()], []);
  const state = await consoleApp.loadDashboardQueue(new AbortController().signal,
    async () => jsonResponse({data: snapshot, request_id: 'request-1'}));
  assert.equal(state.observedAt, '2026-09-30T00:00:00+00:00');
  assert.match(renderObservationTime(state), /aria-live="polite" aria-atomic="true"[^>]*>대시보드 관측 시각 · 2026-09-30T00:00:00\+00:00/);
  assert.match(renderToStaticMarkup(React.createElement(consoleApp.QueueHealthCard, {value: state})),
    /범위 내 관측 1건/);
  assert.doesNotMatch(renderObservationTime(state), /JUST NOW|private-job-id|private-run-id/);
});

test('Dashboard observation time distinguishes loading, denied, unavailable and future snapshots', async () => {
  assert.match(renderObservationTime({status: 'LOADING'}), /대시보드 관측 시각 · 조회 중/);
  for (const status of [401, 403, 503]) {
    const state = await consoleApp.loadDashboardQueue(new AbortController().signal,
      async () => ({ok: false, status, text: async () => 'private-secret'}));
    assert.match(renderObservationTime(state), status === 503
      ? /대시보드 관측 시각 · 확인 불가/ : /대시보드 관측 시각 · 조회 차단/);
    assert.doesNotMatch(renderObservationTime(state), /private-secret|JUST NOW|2026-09-30/);
  }
  for (const observed_at of ['2999-01-01T00:00:00+00:00', 'invalid']) {
    const snapshot = {...dashboardSnapshot([], []), observed_at};
    const state = await consoleApp.loadDashboardQueue(new AbortController().signal,
      async () => jsonResponse({data: snapshot, request_id: 'request-1'}));
    assert.match(renderObservationTime(state), /대시보드 관측 시각 · 확인 불가/);
    assert.doesNotMatch(renderObservationTime(state), /2999|invalid|JUST NOW/);
  }
  const html = renderToStaticMarkup(React.createElement(App, {route: '/'}));
  assert.match(html, /마지막 확인 · NOT REQUESTED/);
  assert.match(html, /대시보드 관측 시각 · 조회 중/);
});

test('Database card uses the existing operations request for health and keeps migration readiness separate', async () => {
  for (const status of ['HEALTHY', 'LATE', 'EXPIRED']) {
    const snapshot = dashboardSnapshot([dashboardQueueRow()], []);
    snapshot.health.database = observedHealth(status);
    snapshot.health.worker = observedHealth('HEALTHY');
    let calls = 0;
    const operations = await consoleApp.loadDashboardQueue(new AbortController().signal,
      async (url, options) => {
        calls += 1;
        assert.equal(url, '/api/dashboard/operations');
        assert.equal(options.credentials, 'same-origin');
        return jsonResponse({data: snapshot, request_id: 'request-1'});
      });
    assert.equal(calls, 1);
    const html = renderDatabase({status: 'ready', migration_head: '0019_oidc_sessions'}, operations);
    assert.match(html, new RegExp(`Database.*${status}.*API 준비 READY.*Migration 0019_oidc_sessions.*마지막 점검 2026-09-30T00:00:00\\+00:00.*오류 2건`, 's'));
    assert.doesNotMatch(html, /sha256:|\/operations\/health|private-job-id|private-run-id|href=/);
    assert.match(renderToStaticMarkup(React.createElement(consoleApp.QueueHealthCard, {value: operations})),
      /범위 내 관측 1건/);
    assert.match(renderToStaticMarkup(React.createElement(consoleApp.DashboardSignalCard,
      {label: 'Worker', component: 'worker', value: operations})), /HEALTHY/);
  }
});

test('Database readiness failure never upgrades a healthy observation', async () => {
  const snapshot = dashboardSnapshot([], []);
  snapshot.health.database = observedHealth('HEALTHY');
  const operations = await consoleApp.loadDashboardQueue(new AbortController().signal,
    async () => jsonResponse({data: snapshot, request_id: 'request-1'}));
  for (const readiness of [null, {status: 'not_ready', migration_head: '0019_oidc_sessions'}]) {
    const html = renderDatabase(readiness, operations);
    assert.match(html, /Database.*NOT CONNECTED.*연결된 상태 정보가 없습니다/s);
    assert.doesNotMatch(html, /HEALTHY|API 준비 READY|Migration 0019|마지막 점검|오류 2건/);
  }
});

test('Database UNKNOWN and source gap remain unknown while other cards and Queue retain observations', async () => {
  for (const gap of [false, true]) {
    const snapshot = dashboardSnapshot([dashboardQueueRow()], gap ? ['database'] : []);
    if (gap) snapshot.health.database = observedHealth('HEALTHY');
    snapshot.health.worker = observedHealth('LATE');
    const operations = await consoleApp.loadDashboardQueue(new AbortController().signal,
      async () => jsonResponse({data: snapshot, request_id: 'request-1'}));
    const html = renderDatabase({status: 'ready', migration_head: '0016_operations_recovery'}, operations);
    assert.match(html, /Database.*UNKNOWN.*API 준비 READY.*Migration 0016_operations_recovery/s);
    assert.doesNotMatch(html, /HEALTHY|sha256:|\/operations\/health/);
    assert.match(renderToStaticMarkup(React.createElement(consoleApp.DashboardSignalCard,
      {label: 'Worker', component: 'worker', value: operations})), /LATE/);
    assert.match(renderToStaticMarkup(React.createElement(consoleApp.QueueHealthCard, {value: operations})),
      /범위 내 관측 1건/);
  }
});

test('Database malformed or future signal fails closed without changing the three R14 cards or Queue', async () => {
  const invalid = [null, {state: 'DEGRADED'}, {observed_at: '2999-01-01T00:00:00+00:00'},
    {last_check: null}, {stale_after_seconds: 0}, {error_count: -1}, {error_count: 1.5},
    {evidence_ref: 'secret://private'}, {detail_path: '//internal/private'},
    {detail_path: 'http://internal/private'}, {extra: 'private-payload'}];
  for (const change of invalid) {
    const snapshot = dashboardSnapshot([dashboardQueueRow()], []);
    snapshot.health.database = change === null ? null : observedHealth('HEALTHY', change);
    snapshot.health.worker = observedHealth('HEALTHY');
    snapshot.health.backend = observedHealth('LATE');
    snapshot.health.artifact_store = observedHealth('EXPIRED');
    const operations = await consoleApp.loadDashboardQueue(new AbortController().signal,
      async () => jsonResponse({data: snapshot, request_id: 'request-1'}));
    const html = renderDatabase({status: 'ready', migration_head: '0019_oidc_sessions'}, operations);
    assert.match(html, /Database.*UNAVAILABLE.*API 준비 READY/s);
    assert.doesNotMatch(html, /HEALTHY|private|internal|secret|sha256:|마지막 점검|오류 2건/);
    for (const [component, expected] of [['worker', 'HEALTHY'], ['backend', 'LATE'],
      ['artifact_store', 'EXPIRED']]) {
      assert.match(renderToStaticMarkup(React.createElement(consoleApp.DashboardSignalCard,
        {label: component, component, value: operations})), new RegExp(expected));
    }
    assert.match(renderToStaticMarkup(React.createElement(consoleApp.QueueHealthCard, {value: operations})),
      /범위 내 관측 1건/);
  }
  const snapshot = {...dashboardSnapshot([], []), observed_at: '2999-01-01T00:00:00+00:00'};
  const operations = await consoleApp.loadDashboardQueue(new AbortController().signal,
    async () => jsonResponse({data: snapshot, request_id: 'request-1'}));
  assert.match(renderDatabase({status: 'ready', migration_head: '0019_oidc_sessions'}, operations),
    /Database.*UNAVAILABLE.*API 준비 READY/s);
});

test('Database operations auth, server and transport errors are safe while readiness stays separate', async () => {
  const privateBody = 'postgresql://secret@internal/private-payload';
  for (const status of [401, 403, 500, 503]) {
    let reads = 0;
    const operations = await consoleApp.loadDashboardQueue(new AbortController().signal,
      async () => ({ok: false, status, text: async () => { reads += 1; return privateBody; }}));
    assert.equal(reads, 1);
    const html = renderDatabase({status: 'ready', migration_head: '0019_oidc_sessions'}, operations);
    assert.match(html, new RegExp(`Database.*${status < 500 ? 'BLOCKED' : 'UNAVAILABLE'}.*API 준비 READY`, 's'));
    assert.doesNotMatch(html, /private-payload|postgresql:|secret|internal|HEALTHY/);
  }
  for (const request of [async () => { throw new Error(privateBody); },
    async () => jsonResponse({data: {health: {}}, request_id: 'request-1'})]) {
    const operations = await consoleApp.loadDashboardQueue(new AbortController().signal, request);
    assert.match(renderDatabase({status: 'ready', migration_head: '0019_oidc_sessions'}, operations),
      /Database.*UNAVAILABLE.*API 준비 READY/s);
  }
});

test('Dashboard renders three observed Health signals from one existing same-origin request', async () => {
  const snapshot = dashboardSnapshot([dashboardQueueRow()], []);
  snapshot.health.worker = observedHealth('HEALTHY');
  snapshot.health.backend = observedHealth('LATE');
  snapshot.health.artifact_store = observedHealth('EXPIRED');
  let calls = 0;
  const state = await consoleApp.loadDashboardQueue(new AbortController().signal,
    async (url, options) => {
      calls += 1;
      assert.equal(url, '/api/dashboard/operations');
      assert.equal(options.credentials, 'same-origin');
      return jsonResponse({data: snapshot, request_id: 'request-1'});
    });
  assert.equal(calls, 1);
  for (const [component, label, status] of [
    ['worker', 'Worker', 'HEALTHY'], ['backend', 'Execution Backends', 'LATE'],
    ['artifact_store', 'Artifact Store', 'EXPIRED'],
  ]) {
    const html = renderToStaticMarkup(React.createElement(consoleApp.DashboardSignalCard,
      {label, component, value: state}));
    assert.match(html, new RegExp(`${label}.*${status}.*2026-09-30T00:00:00\\+00:00.*오류 2건`, 's'));
    assert.doesNotMatch(html, /sha256:|\/operations\/health|private-job-id|private-run-id/);
  }
  const queue = renderToStaticMarkup(React.createElement(consoleApp.QueueHealthCard, {value: state}));
  assert.match(queue, /범위 내 관측 1건/);
});

test('Dashboard Health cards keep source gaps and UNKNOWN signals unknown without leaking evidence', async () => {
  const snapshot = dashboardSnapshot([], ['worker']);
  snapshot.health.worker = observedHealth('HEALTHY', {detail_path: '/private/internal',
    evidence_ref: `sha256:${'f'.repeat(64)}`});
  snapshot.health.backend = observedHealth('UNKNOWN');
  const state = await consoleApp.loadDashboardQueue(new AbortController().signal,
    async () => jsonResponse({data: snapshot, request_id: 'request-1'}));
  for (const [component, label] of [['worker', 'Worker'], ['backend', 'Execution Backends'],
    ['artifact_store', 'Artifact Store']]) {
    const html = renderToStaticMarkup(React.createElement(consoleApp.DashboardSignalCard,
      {label, component, value: state}));
    assert.match(html, /UNKNOWN/);
    assert.doesNotMatch(html, /HEALTHY|\/private\/internal|sha256:|null|undefined/);
  }
});

test('Dashboard Health rejects malformed, future and secret-bearing signal rows without changing Queue count', async () => {
  const invalid = [
    {observed_at: '2999-01-01T00:00:00+00:00'}, {last_check: '2026-09-29T00:00:00+00:00'},
    {stale_after_seconds: 0}, {error_count: -1}, {error_count: 1.5},
    {detail_path: '//internal/secret'}, {detail_path: 'http://internal/secret'},
    {evidence_ref: 'secret://internal'}, {extra: 'private-payload'},
  ];
  for (const change of invalid) {
    const snapshot = dashboardSnapshot([dashboardQueueRow()], []);
    snapshot.health.worker = observedHealth('HEALTHY', change);
    const state = await consoleApp.loadDashboardQueue(new AbortController().signal,
      async () => jsonResponse({data: snapshot, request_id: 'request-1'}));
    const html = renderToStaticMarkup(React.createElement(consoleApp.DashboardSignalCard,
      {label: 'Worker', component: 'worker', value: state}));
    assert.match(html, /UNAVAILABLE/);
    assert.doesNotMatch(html, /private-payload|secret|internal|sha256:|HEALTHY|오류 2건/);
    const queue = renderToStaticMarkup(React.createElement(consoleApp.QueueHealthCard, {value: state}));
    assert.match(queue, Object.hasOwn(change, 'extra') ? /UNAVAILABLE/ : /범위 내 관측 1건/);
  }
});

test('Dashboard Health cards block on auth and fail closed on server, transport and malformed snapshots', async () => {
  const privateBody = 'postgresql://secret@internal/private-payload';
  for (const status of [401, 403, 500, 503]) {
    let reads = 0;
    const state = await consoleApp.loadDashboardQueue(new AbortController().signal,
      async () => ({ok: false, status, text: async () => {reads += 1; return privateBody;}}));
    assert.equal(reads, 1);
    for (const [component, label] of [['worker', 'Worker'], ['backend', 'Execution Backends'],
      ['artifact_store', 'Artifact Store']]) {
      const html = renderToStaticMarkup(React.createElement(consoleApp.DashboardSignalCard,
        {label, component, value: state}));
      assert.match(html, new RegExp(status < 500 ? 'BLOCKED' : 'UNAVAILABLE'));
      assert.doesNotMatch(html, /secret|internal|private-payload/);
    }
  }
  for (const request of [async () => {throw new Error(privateBody);},
    async () => jsonResponse({data: {health: {}}, request_id: 'request-1'})]) {
    const state = await consoleApp.loadDashboardQueue(new AbortController().signal, request);
    const html = renderToStaticMarkup(React.createElement(consoleApp.DashboardSignalCard,
      {label: 'Worker', component: 'worker', value: state}));
    assert.match(html, /UNAVAILABLE/);
    assert.doesNotMatch(html, /secret|internal|private-payload/);
  }
});

test('Dashboard Health does not trust a future snapshot timestamp even for UNKNOWN rows', async () => {
  const snapshot = {...dashboardSnapshot([], []), observed_at: '2999-01-01T00:00:00+00:00'};
  const state = await consoleApp.loadDashboardQueue(new AbortController().signal,
    async () => jsonResponse({data: snapshot, request_id: 'request-1'}));
  for (const [component, label] of [['worker', 'Worker'], ['backend', 'Execution Backends'],
    ['artifact_store', 'Artifact Store']]) {
    const html = renderToStaticMarkup(React.createElement(consoleApp.DashboardSignalCard,
      {label, component, value: state}));
    assert.match(html, /UNAVAILABLE/);
    assert.doesNotMatch(html, /UNKNOWN|HEALTHY/);
  }
});

test('Dashboard Queue uses same-origin authenticated GET and shows only scoped observed row count', async () => {
  const controller = new AbortController();
  const calls = [];
  const state = await consoleApp.loadDashboardQueue(controller.signal, async (url, options) => {
    calls.push([url, options]);
    return jsonResponse(dashboardResponse([dashboardQueueRow()]));
  });
  assert.equal(calls[0][0], '/api/dashboard/operations');
  assert.equal(calls[0][1].credentials, 'same-origin');
  assert.equal(calls[0][1].headers.Accept, 'application/json');
  assert.equal(calls[0][1].signal, controller.signal);
  const html = renderToStaticMarkup(React.createElement(consoleApp.QueueHealthCard, {value: state}));
  assert.match(html, /Queue.*UNKNOWN.*범위 내 관측 1건/s);
  assert.doesNotMatch(html, /private-job-id|private-run-id|PENDING|HEALTHY|성공률|전체 Queue/);
});

test('Dashboard Queue zero and absent gap remain observed-only, never healthy or complete', async () => {
  for (const [rows, gaps, count] of [[[], ['queue'], 0], [[], [], 0],
    [[dashboardQueueRow()], [], 1]]) {
    const state = await consoleApp.loadDashboardQueue(new AbortController().signal,
      async () => jsonResponse(dashboardResponse(rows, gaps)));
    const html = renderToStaticMarkup(React.createElement(consoleApp.QueueHealthCard, {value: state}));
    assert.match(html, new RegExp(`범위 내 관측 ${count}건`));
    assert.match(html, /UNKNOWN/);
    assert.doesNotMatch(html, /HEALTHY|전체.*0건|실제.*0건|성공률/);
    if (gaps.length === 0) assert.match(html, /완전성은 확인되지 않았습니다/);
  }
});

test('Dashboard Queue auth denial is BLOCKED, server and transport errors are UNAVAILABLE without body leak', async () => {
  const privateBody = 'postgresql://secret:credential@internal/private-payload';
  for (const status of [401, 403, 500, 503]) {
    let reads = 0;
    const state = await consoleApp.loadDashboardQueue(new AbortController().signal,
      async () => ({ok: false, status, text: async () => { reads += 1; return privateBody; },
        json: async () => { throw new Error('non-ok JSON must not be parsed'); }}));
    assert.equal(reads, 1);
    assert.deepEqual(state, {status: status < 500 ? 'BLOCKED' : 'UNAVAILABLE'});
    const html = renderToStaticMarkup(React.createElement(consoleApp.QueueHealthCard, {value: state}));
    assert.doesNotMatch(html, /secret|credential|internal|private-payload/);
  }
  for (const request of [async () => { throw new Error(privateBody); },
    async () => ({ok: true, json: async () => { throw new Error(privateBody); }})]) {
    assert.deepEqual(await consoleApp.loadDashboardQueue(new AbortController().signal, request),
      {status: 'UNAVAILABLE'});
  }
});

test('Dashboard Queue rejects malformed envelope, snapshot, rows and source gaps before counting', async () => {
  const row = dashboardQueueRow();
  const good = dashboardSnapshot([row]);
  const malformed = [null, {}, {data: good, request_id: ''},
    {data: {...good, secret: 'private-payload'}},
    {data: {...good, queue: null}},
    {data: {...good, queue: Array.from({length: 101}, () => row)}},
    {data: {...good, queue: [{...row, payload: 'private-payload'}]}},
    {data: {...good, queue: [{...row, attempts: -1}]}},
    {data: {...good, queue: [row, {...row}]}},
    {data: {...good, source_gaps: ['queue', 'queue']}},
    {data: {...good, source_gaps: ['private-payload']}},
    {data: {...good, health: {...good.health, queue: null}}},
    {data: {...good, observed_at: 'not-a-time'}}];
  for (const body of malformed) {
    const completeEnvelope = body && typeof body === 'object' && Object.hasOwn(body, 'data')
      && !Object.hasOwn(body, 'request_id') ? {...body, request_id: 'request-1'} : body;
    const state = await consoleApp.loadDashboardQueue(new AbortController().signal,
      async () => jsonResponse(completeEnvelope));
    assert.deepEqual(state, {status: 'UNAVAILABLE'});
    const html = renderToStaticMarkup(React.createElement(consoleApp.QueueHealthCard, {value: state}));
    assert.doesNotMatch(html, /private-payload|범위 내 관측/);
  }
});

test('Dashboard preserves existing health cards and unrelated operating paths', () => {
  const html = renderToStaticMarkup(React.createElement(App, {route: '/'}));
  assert.match(html, /Database.*Queue.*Worker.*LLM Providers.*Execution Backends.*Artifact Store/s);
  assert.match(html, /Queue.*LOADING.*Worker.*LOADING/s);
  assert.match(html, /Critical Alerts.*LOADING/s);
  assert.match(html, /실행·승인·비용 read model은 아직 연결되지 않았습니다. UNAVAILABLE/);
  assert.doesNotMatch(html, /private-job-id|private-run-id|HEALTHY/);
});

test('independent Provider and Critical Alerts reads begin with accessible LOADING states', () => {
  const html = renderToStaticMarkup(React.createElement(App, {route: '/'}));
  for (const [label, component, props] of [
    ['LLM Providers', consoleApp.ProviderHealthCard, {value: {status: 'LOADING'}}],
    ['Critical Alerts', consoleApp.CriticalAlertsCard, {value: {status: 'LOADING'}}],
  ]) {
    const card = renderToStaticMarkup(React.createElement(component, props));
    assert.match(card, new RegExp(`${label}.*aria-live="polite" aria-atomic="true".*LOADING.*조회 중`, 's'));
    assert.doesNotMatch(card, /UNAVAILABLE|BLOCKED|VALID|등록 0|기록 없음|status-unavailable/);
    assert.ok(html.includes(card), `${label} first render`);
  }
});

test('Database distinguishes independent readiness and operations completion in either order', () => {
  const ready = {status: 'ready', migration_head: '0019_oidc_sessions'};
  const healthy = {status: 'LOADED', database: {status: 'HEALTHY', lastCheck: null, errorCount: 0}};
  const pending = {status: 'LOADING'};
  const stages = [
    [null, true, pending, 'LOADING'],
    [ready, false, pending, 'LOADING'],
    [null, true, healthy, 'LOADING'],
    [ready, false, healthy, 'HEALTHY'],
    [null, false, healthy, 'NOT CONNECTED'],
    [{status: 'not_ready'}, false, pending, 'NOT CONNECTED'],
  ];
  for (const [value, readinessPending, operations, expected] of stages) {
    const card = renderToStaticMarkup(React.createElement(consoleApp.DatabaseHealthCard,
      {value, readinessPending, operations}));
    assert.match(card, new RegExp(`Database.*aria-live="polite" aria-atomic="true".*${expected}`, 's'));
    if (expected === 'LOADING') {
      assert.match(card, /조회 중/);
      assert.doesNotMatch(card, /status-unavailable|HEALTHY|NOT CONNECTED|오류 0건/);
    }
  }
  const html = renderToStaticMarkup(React.createElement(App, {route: '/'}));
  assert.match(html, /Database.*LOADING.*Queue/s);
  assert.doesNotMatch(html, /Database.*HEALTHY.*Queue/s);
});

test('Dashboard pending operations read shows LOADING in all five cards without false failure or zero', () => {
  const html = renderToStaticMarkup(React.createElement(App, {route: '/'}));
  const loading = {status: 'LOADING'};
  const cards = [
    ['Queue', consoleApp.QueueHealthCard, {value: loading}],
    ['Worker', consoleApp.DashboardSignalCard, {label: 'Worker', component: 'worker', value: loading}],
    ['Execution Backends', consoleApp.DashboardSignalCard,
      {label: 'Execution Backends', component: 'backend', value: loading}],
    ['Artifact Store', consoleApp.DashboardSignalCard,
      {label: 'Artifact Store', component: 'artifact_store', value: loading}],
    ['Next Actions', consoleApp.NextActionsCard, {value: loading}],
  ];
  for (const [label, component, props] of cards) {
    const card = renderToStaticMarkup(React.createElement(component, props));
    assert.match(card, new RegExp(`${label}.*aria-live="polite" aria-atomic="true".*LOADING.*조회 중`, 's'));
    assert.doesNotMatch(card, /UNAVAILABLE|BLOCKED|HEALTHY|0건|조회 차단|확인할 수 없습니다|status-unavailable/);
    assert.ok(html.includes(card), `${label} first render`);
  }
});

test('Dashboard exposes a keyboard-operable manual refresh that waits during the initial read', () => {
  const html = renderToStaticMarkup(React.createElement(App, {route: '/'}));
  assert.match(html, /<button[^>]*type="button"[^>]*disabled=""[^>]*>대시보드 새로고침<\/button>/);
  assert.match(html, /대시보드 관측 시각 · 조회 중/);
  assert.doesNotMatch(html, /Next Actions.*private-job-id|대시보드 관측 시각 · JUST NOW/s);
});

test('Dashboard Next Actions renders validated rows from the existing operations read', async () => {
  const snapshot = dashboardSnapshot([], []);
  snapshot.next_actions = [{priority: 'critical', reason: '<script>cause</script>',
    target: 'run-1', action: '검토', deep_link: '/operations'}];
  const state = await consoleApp.loadDashboardQueue(new AbortController().signal,
    async () => jsonResponse({data: snapshot, request_id: 'request-1'}));
  assert.deepEqual(state.nextActions?.status, 'LOADED');
  const html = renderToStaticMarkup(React.createElement(consoleApp.NextActionsCard, {value: state}));
  assert.match(html, /Next Actions.*critical.*&lt;script&gt;cause&lt;\/script&gt;.*run-1.*검토/s);
  assert.match(html, /href="\/operations"/);
  assert.doesNotMatch(html, /<script>|private-job-id|private-run-id/);
});

test('Dashboard Next Actions empty response is an observed zero, not a global absence', async () => {
  const state = await consoleApp.loadDashboardQueue(new AbortController().signal,
    async () => jsonResponse(dashboardResponse()));
  const html = renderToStaticMarkup(React.createElement(consoleApp.NextActionsCard, {value: state}));
  assert.match(html, /Next Actions.*현재 관측된 다음 조치 0건/s);
  assert.doesNotMatch(html, /전체.*0건|href=/);
});

test('Dashboard Next Actions auth and source failures remain blocked or unavailable without body leak', async () => {
  const secret = 'postgresql://secret@internal/private-payload';
  for (const status of [401, 403, 500, 503]) {
    const state = await consoleApp.loadDashboardQueue(new AbortController().signal,
      async () => ({ok: false, status, text: async () => secret}));
    const html = renderToStaticMarkup(React.createElement(consoleApp.NextActionsCard, {value: state}));
    assert.match(html, new RegExp(status < 500 ? 'BLOCKED' : 'UNAVAILABLE'));
    assert.doesNotMatch(html, /postgresql:|secret|internal|private-payload|href=/);
  }
  const state = await consoleApp.loadDashboardQueue(new AbortController().signal,
    async () => {throw new Error(secret);});
  assert.match(renderToStaticMarkup(React.createElement(consoleApp.NextActionsCard, {value: state})),
    /UNAVAILABLE/);
});

test('Dashboard Next Actions malformed rows fail closed while Queue and Health remain observed', async () => {
  const valid = {priority: 'warning', reason: '원인', target: 'run-1',
    action: '검토', deep_link: '/runs'};
  const badRows = [null, {...valid, reason: ''}, {...valid, priority: 'secret'},
    {...valid, action: null}, {...valid, extra: 'private-payload'},
    Array.from({length: 101}, () => valid)];
  for (const bad of badRows) {
    const snapshot = dashboardSnapshot([dashboardQueueRow()], []);
    snapshot.next_actions = Array.isArray(bad) ? bad : [bad];
    snapshot.health.worker = observedHealth('HEALTHY');
    const state = await consoleApp.loadDashboardQueue(new AbortController().signal,
      async () => jsonResponse({data: snapshot, request_id: 'request-1'}));
    const html = renderToStaticMarkup(React.createElement(consoleApp.NextActionsCard, {value: state}));
    assert.match(html, /UNAVAILABLE/);
    assert.doesNotMatch(html, /private-payload|run-1|href=/);
    assert.match(renderToStaticMarkup(React.createElement(consoleApp.QueueHealthCard, {value: state})),
      /범위 내 관측 1건/);
    assert.match(renderToStaticMarkup(React.createElement(consoleApp.DashboardSignalCard,
      {label: 'Worker', component: 'worker', value: state})), /HEALTHY/);
  }
});

test('Dashboard Next Actions never navigates unsafe or unimplemented deep links', async () => {
  for (const deepLink of ['javascript:alert(1)', 'https://evil.example', '//evil.example',
    '/operations?token=private', '/operations#private', '/operations\\bad', '/not-implemented']) {
    const snapshot = dashboardSnapshot([], []);
    snapshot.next_actions = [{priority: 'warning', reason: '원인', target: 'run-1',
      action: '검토', deep_link: deepLink}];
    const state = await consoleApp.loadDashboardQueue(new AbortController().signal,
      async () => jsonResponse({data: snapshot, request_id: 'request-1'}));
    const html = renderToStaticMarkup(React.createElement(consoleApp.NextActionsCard, {value: state}));
    assert.match(html, /검토/);
    assert.doesNotMatch(html, /href=|evil\.example|private|javascript:/);
  }
});
