#!/usr/bin/env node
import { createRequire } from 'node:module';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const require = createRequire(import.meta.url);
const playwrightRoot = process.env.ANVIL_PLAYWRIGHT_MODULE
  || path.join(path.dirname(process.execPath), 'node_modules', 'playwright');
const { chromium } = require(playwrightRoot);

function chromiumExecutable() {
  if (process.env.ANVIL_CHROMIUM_EXECUTABLE) return process.env.ANVIL_CHROMIUM_EXECUTABLE;
  const packaged = chromium.executablePath();
  if (fs.existsSync(packaged)) return packaged;
  const browserRoot = path.join(process.env.LOCALAPPDATA || '', 'ms-playwright');
  const candidates = fs.existsSync(browserRoot)
    ? fs.readdirSync(browserRoot).filter((name) => /^chromium_headless_shell-\d+$/.test(name)).sort().reverse()
    : [];
  for (const candidate of candidates) {
    const executable = path.join(browserRoot, candidate, 'chrome-headless-shell-win64', 'chrome-headless-shell.exe');
    if (fs.existsSync(executable)) return executable;
  }
  throw new Error('no approved bundled Chromium executable is available');
}

function parseArgs(argv) {
  const values = { selfTest: false, selfTestCrossOriginRejection: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--self-test') values.selfTest = true;
    else if (value === '--self-test-cross-origin-rejection') values.selfTestCrossOriginRejection = true;
    else if (value.startsWith('--')) values[value.slice(2)] = argv[++index];
    else throw new Error(`unexpected argument: ${value}`);
  }
  return values;
}

function startFixture() {
  const eventId = 'fixture-event-1';
  const server = http.createServer((request, response) => {
    if (request.url === '/') {
      response.writeHead(200, { 'content-type': 'text/html' });
      return response.end('<!doctype html><title>Anvil QA</title>');
    }
    if (request.url === '/auth/session' && request.method === 'POST') {
      response.writeHead(201, {
        'content-type': 'application/json',
        'set-cookie': 'anvil_session=fixture; HttpOnly; SameSite=Strict',
      });
      return response.end('{"data":{"csrf_token":"redacted","expires_in":60}}');
    }
    if (request.url === '/network-failure') {
      request.socket.destroy();
      return;
    }
    if (request.url === '/api/runs/run-qa/events') {
      response.writeHead(200, { 'content-type': 'text/event-stream' });
      return response.end(request.headers['last-event-id'] ? '' : `id: ${eventId}\nevent: TASK_CONFIRMED\ndata: {}\n\n`);
    }
    response.writeHead(404);
    return response.end();
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => {
    const address = server.address();
    resolve({ server, baseUrl: `http://127.0.0.1:${address.port}`, eventId });
  }));
}

async function runProbe({ baseUrl, bootstrapToken, runId, expectedEventId, crossOriginUrl, project }) {
  if (!baseUrl || !bootstrapToken || !runId || !project) throw new Error('base-url, bootstrap-token, run-id and project are required');
  const origin = new URL(baseUrl).origin;
  const ledger = [];
  const browser = await chromium.launch({ headless: true, executablePath: chromiumExecutable() });
  try {
    const page = await browser.newPage();
    page.on('request', (request) => {
      const url = new URL(request.url());
      ledger.push({ phase: 'request', method: request.method(), path: url.pathname, resourceType: request.resourceType(), sameOrigin: url.origin === origin });
    });
    page.on('response', (response) => {
      const url = new URL(response.url());
      ledger.push({ phase: 'response', method: response.request().method(), path: url.pathname, resourceType: response.request().resourceType(), status: response.status(), sameOrigin: url.origin === origin });
    });
    page.on('requestfailed', (request) => {
      const url = new URL(request.url());
      ledger.push({ phase: 'requestfailed', method: request.method(), path: url.pathname, resourceType: request.resourceType(), error: 'NETWORK_FAILURE', sameOrigin: url.origin === origin });
    });
    await page.goto(`${origin}/`, { waitUntil: 'domcontentloaded' });
    const result = await page.evaluate(async ({ token, id, failedUrl }) => {
      const session = await fetch('/auth/session', {
        method: 'POST',
        credentials: 'include',
        headers: { authorization: `Bearer ${token}` },
      });
      const initial = await fetch(`/api/runs/${encodeURIComponent(id)}/events`, {
        credentials: 'include', headers: { accept: 'text/event-stream' },
      });
      const initialBody = await initial.text();
      const match = /^id:\s*(.+)$/m.exec(initialBody);
      const cursor = match?.[1] || '';
      const resumed = await fetch(`/api/runs/${encodeURIComponent(id)}/events`, {
        credentials: 'include',
        headers: { accept: 'text/event-stream', 'last-event-id': cursor },
      });
      await fetch('/network-failure').catch(() => undefined);
      if (failedUrl) await fetch(failedUrl, { mode: 'no-cors' }).catch(() => undefined);
      return {
        sessionStatus: session.status,
        initialStatus: initial.status,
        initialContentType: initial.headers.get('content-type'),
        eventId: cursor,
        resumedStatus: resumed.status,
        resumedBodyBytes: new TextEncoder().encode(await resumed.text()).length,
      };
    }, { token: bootstrapToken, id: runId, failedUrl: crossOriginUrl });
    if (result.sessionStatus !== 201 || result.initialStatus !== 200 || !result.initialContentType?.startsWith('text/event-stream')) throw new Error('auth/SSE contract failed');
    if (!result.eventId || (expectedEventId && result.eventId !== expectedEventId)) throw new Error('initial event identity mismatch');
    if (result.resumedStatus !== 200 || result.resumedBodyBytes !== 0) throw new Error('Last-Event-ID resume contract failed');
    if (ledger.some((entry) => !entry.sameOrigin)) throw new Error('cross-origin browser request observed');
    return { project, evidenceTier: 'PAGE_EVALUATE_FETCH_SCOPE_ONLY', uiClickEvidence: false, ...result, requests: ledger };
  } finally {
    await browser.close();
  }
}

const args = parseArgs(process.argv.slice(2));
let fixture;
try {
  if (args.selfTest || args.selfTestCrossOriginRejection) {
    fixture = await startFixture();
    args['base-url'] = fixture.baseUrl;
    args['bootstrap-token'] = 'fixture-bootstrap-token-not-a-secret';
    args['run-id'] = 'run-qa';
    args['expected-event-id'] = fixture.eventId;
    args.project ||= 'self-test-fixture';
    if (args.selfTestCrossOriginRejection) args['cross-origin-url'] = 'http://127.0.0.1:1/cross-origin-failure';
  }
  try {
    const result = await runProbe({
      baseUrl: args['base-url'],
      bootstrapToken: args['bootstrap-token'] || process.env.ANVIL_TEST_SESSION_BOOTSTRAP_TOKEN,
      runId: args['run-id'] || process.env.ANVIL_TEST_SESSION_RUN_ID,
      expectedEventId: args['expected-event-id'],
      crossOriginUrl: args['cross-origin-url'],
      project: args.project,
    });
    if (args.selfTestCrossOriginRejection) throw new Error('cross-origin attempted URL was not rejected');
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    if (!args.selfTestCrossOriginRejection || !String(error.message).includes('cross-origin browser request observed')) throw error;
    process.stdout.write('{"crossOriginFailedRequestRejected":true}\n');
  }
} finally {
  if (fixture) await new Promise((resolve) => fixture.server.close(resolve));
}
