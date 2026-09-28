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
