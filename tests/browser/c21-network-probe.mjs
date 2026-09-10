#!/usr/bin/env node
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const require = createRequire(import.meta.url);
const playwrightRoot = process.env.ANVIL_PLAYWRIGHT_MODULE
  || path.join(path.dirname(process.execPath), 'node_modules', 'playwright');
let chromium;
function playwrightChromium() {
  if (!chromium) ({ chromium } = require(playwrightRoot));
  return chromium;
}

function chromiumExecutable() {
  if (process.env.ANVIL_CHROMIUM_EXECUTABLE) return process.env.ANVIL_CHROMIUM_EXECUTABLE;
  const packaged = playwrightChromium().executablePath();
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
  const values = { selfTest: false, selfTestCrossOriginRejection: false, workbenchSelfTest: false, wslWorkbenchAuthSelfTest: false, wslWorkbenchAuth: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--self-test') values.selfTest = true;
    else if (value === '--self-test-cross-origin-rejection') values.selfTestCrossOriginRejection = true;
    else if (value === '--workbench-self-test') values.workbenchSelfTest = true;
    else if (value === '--wsl-workbench-auth-self-test') values.wslWorkbenchAuthSelfTest = true;
    else if (value === '--wsl-workbench-auth') values.wslWorkbenchAuth = true;
    else if (value.startsWith('--')) values[value.slice(2)] = argv[++index];
    else throw new Error(`unexpected argument: ${value}`);
  }
  return values;
}

const wslAuthViewports = [
  { name: 'desktop-1920x1080', width: 1920, height: 1080 },
  { name: 'desktop-1440x900', width: 1440, height: 900 },
  { name: 'mobile-430x844', width: 430, height: 844 },
];

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function lastEventIdMatches(initialEventId, resumedHeader) {
  return typeof initialEventId === 'string' && initialEventId.length > 0 && resumedHeader === initialEventId;
}

function runWslWorkbenchAuthSelfTest() {
  const sample = Buffer.from('schema-only-screenshot');
  return {
    schemaVersion: '1.0.0',
    project: 'c21-workbench-ui-wsl-auth-browser-probe',
    result: 'SCHEMA_ONLY_PASS',
    credentialInput: 'ENVIRONMENT_ONLY',
    runtimeExecution: 'NOT_EXECUTED',
    screenshotPolicy: { rootInput: 'FAIL_CLOSED_IF_SUPPLIED', storage: 'MEMORY_ONLY' },
    filesystemMutation: { storage: 'MEMORY_ONLY', filesCreated: 0, directoriesCreated: 0, residueCount: 0 },
    lastEventIdNegativeCases: {
      missingRejected: !lastEventIdMatches('event-1', ''),
      staleRejected: !lastEventIdMatches('event-2', 'event-1'),
      wrongRejected: !lastEventIdMatches('event-1', 'wrong-event'),
    },
    viewports: wslAuthViewports.map((viewport) => ({
      ...viewport,
      providerListVisible: true,
      providerDetailVisible: true,
      runEventActionVisible: true,
      statusAlertVisible: true,
      documentHorizontalOverflowZero: true,
      keyboardTabFocusVisible: true,
      buttonAccessibleNames: true,
      sseInitialConnected: true,
      lastEventIdReconnect: true,
      screenshot: {
        relativeName: `${viewport.name}.png`,
        bytes: sample.byteLength,
        sha256: crypto.createHash('sha256').update(sample).digest('hex'),
      },
    })),
    requestContract: {
      providerReadGetOnly: true,
      providerWriteCount: 0,
      crossOriginCount: 0,
      fixtureApiCount: 0,
    },
    secretSafety: {
      sentinelOccurrences: 0,
      authorizationHeaderOccurrences: 0,
      cookieOccurrences: 0,
      rawUrlOccurrences: 0,
    },
  };
}

function safeWslAuthFailure(result) {
  return {
    schemaVersion: '1.0.0',
    project: 'c21-workbench-ui-wsl-auth-browser-probe',
    result,
    credentialInput: 'ENVIRONMENT_ONLY',
    runtimeExecution: 'NOT_EXECUTED',
    viewports: [],
    requestContract: { providerReadGetOnly: false, providerWriteCount: 0, crossOriginCount: 0, fixtureApiCount: 0 },
    secretSafety: { sentinelOccurrences: 0, authorizationHeaderOccurrences: 0, cookieOccurrences: 0, rawUrlOccurrences: 0 },
    screenshotPolicy: { rootInput: 'FAIL_CLOSED_IF_SUPPLIED', storage: 'MEMORY_ONLY' },
    filesystemMutation: { storage: 'MEMORY_ONLY', filesCreated: 0, directoriesCreated: 0, residueCount: 0 },
  };
}

function wslAuthEnvironment() {
  const names = [
    'ANVIL_WSL_WORKBENCH_BASE_URL',
    'ANVIL_TEST_SESSION_BOOTSTRAP_TOKEN',
    'ANVIL_TEST_SESSION_RUN_ID',
  ];
  if (names.some((name) => !process.env[name]) || process.env.ANVIL_SCREENSHOT_ROOT || process.env.ANVIL_WSL_WORKBENCH_SCREENSHOT_DIR) return null;
  let parsed;
  try { parsed = new URL(process.env.ANVIL_WSL_WORKBENCH_BASE_URL); } catch { return null; }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) return null;
  return {
    origin: parsed.origin,
    bootstrapToken: process.env.ANVIL_TEST_SESSION_BOOTSTRAP_TOKEN,
    runId: process.env.ANVIL_TEST_SESSION_RUN_ID,
    sentinel: process.env.ANVIL_TEST_SESSION_SECRET_SENTINEL || '',
  };
}

async function runWslWorkbenchAuthProbe(environment) {
  const ledger = [];
  const browser = await playwrightChromium().launch({ headless: true, executablePath: chromiumExecutable() });
  try {
    const context = await browser.newContext();
    const authenticate = await context.newPage();
    await authenticate.goto(`${environment.origin}/`, { waitUntil: 'domcontentloaded' });
    const sessionStatus = await authenticate.evaluate(async (token) => {
      const response = await fetch('/auth/session', {
        method: 'POST', credentials: 'include', headers: { authorization: `Bearer ${token}` },
      });
      return response.status;
    }, environment.bootstrapToken);
    await authenticate.close();
    if (sessionStatus !== 201) throw new Error('SESSION_BOOTSTRAP_REJECTED');

    const viewportResults = [];
    for (const viewport of wslAuthViewports) {
      const page = await context.newPage();
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const localLedger = [];
      page.on('request', (request) => {
        const target = new URL(request.url());
        const row = {
          method: request.method(),
          path: target.pathname,
          sameOrigin: target.origin === environment.origin,
          lastEventIdPresent: Boolean(request.headers()['last-event-id']),
          lastEventId: request.headers()['last-event-id'] || '',
        };
        ledger.push(row); localLedger.push(row);
      });
      await page.goto(`${environment.origin}/`, { waitUntil: 'domcontentloaded' });
      await page.locator('#state-badge').waitFor();
      await page.locator('.provider-status').first().waitFor();
      const providerListVisible = await page.locator('.provider-status').count() === 9
        && await page.locator('.provider-status').first().isVisible();
      await page.locator('[data-provider-id="groq"]').click();
      await page.locator('#detail-title').getByText('GROQ', { exact: true }).waitFor();
      const providerDetailVisible = await page.locator('#provider-detail').isVisible();
      const runEventActionVisible = await page.locator('#connect-stream').isVisible();
      const statusAlertVisible = await page.locator('#state-badge').isVisible() && await page.locator('#message').isVisible();
      await page.locator('#run-id').fill(environment.runId);
      await page.locator('#connect-stream').click();
      await page.waitForFunction(() => document.querySelector('#last-event-id')?.textContent !== 'NOT AVAILABLE');
      const eventId = (await page.locator('#last-event-id').textContent())?.trim() || '';
      const sseInitialConnected = Boolean(eventId) && eventId !== 'NOT AVAILABLE';
      await page.locator('#connect-stream').click();
      await page.getByText('새 Event가 없습니다.', { exact: true }).waitFor();
      const eventRequests = localLedger.filter((row) => row.path === `/api/runs/${encodeURIComponent(environment.runId)}/events`);
      const lastEventIdReconnect = eventRequests.length === 2 && !eventRequests[0].lastEventIdPresent
        && lastEventIdMatches(eventId, eventRequests[1].lastEventId);
      const documentHorizontalOverflowZero = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
      await page.locator('body').click({ position: { x: 1, y: 1 } });
      let keyboardTabFocusVisible = false;
      for (let attempt = 0; attempt < 30 && !keyboardTabFocusVisible; attempt += 1) {
        await page.keyboard.press('Tab');
        keyboardTabFocusVisible = await page.evaluate(() => {
          const active = document.activeElement;
          return active instanceof HTMLElement && active.matches(':focus-visible') && ['BUTTON', 'INPUT', 'A'].includes(active.tagName);
        });
      }
      const buttonAccessibleNames = await page.locator('button:visible').evaluateAll((buttons) => buttons.every((button) => {
        const name = button.getAttribute('aria-label') || button.textContent || button.getAttribute('title') || '';
        return name.trim().length > 0;
      }));
      const relativeName = `${viewport.name}.png`;
      const screenshot = await page.screenshot({ fullPage: true });
      viewportResults.push({
        ...viewport,
        providerListVisible,
        providerDetailVisible,
        runEventActionVisible,
        statusAlertVisible,
        documentHorizontalOverflowZero,
        keyboardTabFocusVisible,
        buttonAccessibleNames,
        sseInitialConnected,
        lastEventIdReconnect,
        screenshot: { relativeName, bytes: screenshot.byteLength, sha256: crypto.createHash('sha256').update(screenshot).digest('hex') },
      });
      await page.close();
    }
    await context.close();
    const providerRequests = ledger.filter((row) => /^\/api\/providers(?:\/[^/]+(?:\/models)?)?$/.test(row.path));
    const providerWriteCount = providerRequests.filter((row) => row.method !== 'GET').length;
    const requestContract = {
      providerReadGetOnly: providerRequests.length > 0 && providerWriteCount === 0,
      providerWriteCount,
      crossOriginCount: ledger.filter((row) => !row.sameOrigin).length,
      fixtureApiCount: ledger.filter((row) => row.path.startsWith('/api/workbench/')).length,
      lastEventIdExactMatch: viewportResults.every((row) => row.lastEventIdReconnect),
    };
    const secretSafety = { sentinelOccurrences: 0, authorizationHeaderOccurrences: 0, cookieOccurrences: 0, rawUrlOccurrences: 0 };
    const accepted = viewportResults.every((row) => [
      row.providerListVisible, row.providerDetailVisible, row.runEventActionVisible, row.statusAlertVisible,
      row.documentHorizontalOverflowZero, row.keyboardTabFocusVisible, row.buttonAccessibleNames,
      row.sseInitialConnected, row.lastEventIdReconnect,
    ].every(Boolean)) && requestContract.providerReadGetOnly && requestContract.providerWriteCount === 0
      && requestContract.crossOriginCount === 0 && requestContract.fixtureApiCount === 0;
    const receipt = {
      schemaVersion: '1.0.0', project: 'c21-workbench-ui-wsl-auth-browser-probe',
      result: accepted ? 'PASS' : 'ACCEPTANCE_FAILED', credentialInput: 'ENVIRONMENT_ONLY',
      runtimeExecution: 'EXECUTED', viewports: viewportResults, requestContract, secretSafety,
      screenshotPolicy: { rootInput: 'FAIL_CLOSED_IF_SUPPLIED', storage: 'MEMORY_ONLY' },
      filesystemMutation: { storage: 'MEMORY_ONLY', filesCreated: 0, directoriesCreated: 0, residueCount: 0 },
    };
    const rendered = JSON.stringify(receipt);
    for (const forbidden of [environment.bootstrapToken, environment.sentinel, environment.origin].filter(Boolean)) {
      if (rendered.includes(forbidden)) throw new Error('SECRET_SAFETY_VIOLATION');
    }
    return receipt;
  } finally {
    await browser.close();
  }
}

const providerIds = ['cerebras','groq','mistral','openrouter','upstage','gemini','anthropic','openai','ollama'];
function providerRow(providerId) {
  return {
    provider_id: providerId,
    display_name: providerId.toUpperCase(),
    primary: providerId === 'upstage',
    status: providerId === 'upstage' ? 'DEGRADED' : 'NOT_CONFIGURED',
    credential_status: providerId === 'upstage' ? 'REGISTERED' : 'MISSING',
    health_status: 'NOT_CHECKED',
    latency_ms: null,
    last_error: null,
    models: [],
    moa_eligible: providerId === 'upstage',
  };
}

function startWorkbenchApiFixture() {
  const requests = [];
  const server = http.createServer((request, response) => {
    requests.push({ method: request.method, path: request.url, lastEventId: request.headers['last-event-id'] || '' });
    const pathname = new URL(request.url, 'http://fixture.invalid').pathname;
    const json = (payload) => {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify(payload));
    };
    if (request.method !== 'GET') {
      response.writeHead(405, { 'content-type': 'application/json' });
      return response.end('{"message":"GET only"}');
    }
    if (pathname === '/api/providers') return json({ data: providerIds.map(providerRow) });
    const models = /^\/api\/providers\/([^/]+)\/models$/.exec(pathname);
    if (models) return json({ data: { provider_id: models[1], models: models[1] === 'upstage' ? ['solar-pro'] : [], moa_eligible: models[1] === 'upstage' } });
    const detail = /^\/api\/providers\/([^/]+)$/.exec(pathname);
    if (detail && providerIds.includes(detail[1])) return json({ data: providerRow(detail[1]) });
    if (pathname === '/api/runs/run-ui/events') {
      response.writeHead(200, { 'content-type': 'text/event-stream' });
      return response.end(request.headers['last-event-id'] ? '' : 'id: event-ui-1\nevent: TASK_CONFIRMED\ndata: {}\n\n');
    }
    response.writeHead(404, { 'content-type': 'application/json' });
    return response.end('{"message":"not found"}');
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, requests, origin: `http://127.0.0.1:${server.address().port}` })));
}

async function runWorkbenchSelfTest() {
  const fixture = await startWorkbenchApiFixture();
  let runtime;
  const ledger = [];
  try {
    process.env.ANVIL_API_UPSTREAM = fixture.origin;
    const module = await import(`../../apps/web/server.mjs?workbench-self-test=${Date.now()}`);
    runtime = await module.startWorkbenchServer({ host: '127.0.0.1', port: 0 });
    const browser = await playwrightChromium().launch({ headless: true, executablePath: chromiumExecutable() });
    try {
      const page = await browser.newPage();
      page.on('request', (request) => {
        const url = new URL(request.url());
        ledger.push({ method: request.method(), path: url.pathname, sameOrigin: url.origin === runtime.origin, lastEventId: request.headers()['last-event-id'] || '' });
      });
      await page.goto(`${runtime.origin}/`, { waitUntil: 'domcontentloaded' });
      await page.locator('#state-badge').getByText('READY', { exact: true }).waitFor();
      await page.locator('[data-provider-id="groq"]').click();
      await page.locator('#detail-title').getByText('GROQ', { exact: true }).waitFor();
      await page.locator('#run-id').fill('run-ui');
      await page.locator('#connect-stream').click();
      await page.locator('#last-event-id').getByText('event-ui-1', { exact: true }).waitFor();
      await page.locator('#connect-stream').click();
      await page.getByText('새 Event가 없습니다.', { exact: true }).waitFor();
      const disabledActions = await page.locator('#configure-provider:disabled,#test-provider:disabled,#refresh-provider:disabled').count();
      if (disabledActions !== 3) throw new Error('unavailable Provider actions are not disabled');
      const apiRequests = ledger.filter((entry) => entry.path.startsWith('/api/'));
      if (ledger.some((entry) => !entry.sameOrigin)) throw new Error('cross-origin browser request observed');
      if (apiRequests.some((entry) => entry.method !== 'GET')) throw new Error('non-GET production workbench request observed');
      if (apiRequests.some((entry) => entry.path.startsWith('/api/workbench/'))) throw new Error('fixture workbench API request observed');
      const eventRequests = apiRequests.filter((entry) => entry.path === '/api/runs/run-ui/events');
      if (eventRequests.length !== 2 || eventRequests[0].lastEventId || eventRequests[1].lastEventId !== 'event-ui-1') throw new Error('Last-Event-ID UI reconnect contract failed');
      return { project: 'workbench-ui-self-test', evidenceTier: 'ACTUAL_HEADLESS_CHROMIUM_CLICK_AND_NETWORK', uiClickEvidence: true, disabledActions, requests: apiRequests };
    } finally {
      await browser.close();
    }
  } finally {
    delete process.env.ANVIL_API_UPSTREAM;
    if (runtime) await runtime.close();
    fixture.server.closeAllConnections();
    await new Promise((resolve) => fixture.server.close(resolve));
  }
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
  const browser = await playwrightChromium().launch({ headless: true, executablePath: chromiumExecutable() });
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

const rawArgs = process.argv.slice(2);
const wslAuthRequested = rawArgs.includes('--wsl-workbench-auth');
const wslAuthInputRejected = wslAuthRequested && (rawArgs.length !== 1 || rawArgs[0] !== '--wsl-workbench-auth');
const args = wslAuthInputRejected ? { wslWorkbenchAuth: true } : parseArgs(rawArgs);
let fixture;
try {
  if (wslAuthInputRejected) {
    process.stdout.write(`${canonicalJson(safeWslAuthFailure('INPUT_REJECTED'))}\n`);
    process.exitCode = 2;
  } else if (args.wslWorkbenchAuth) {
    const environment = wslAuthEnvironment();
    if (!environment) {
      process.stdout.write(`${canonicalJson(safeWslAuthFailure('ENVIRONMENT_ERROR'))}\n`);
      process.exitCode = 2;
    } else {
      try {
        const receipt = await runWslWorkbenchAuthProbe(environment);
        process.stdout.write(`${canonicalJson(receipt)}\n`);
        if (receipt.result !== 'PASS') process.exitCode = 1;
      } catch {
        process.stdout.write(`${canonicalJson({ ...safeWslAuthFailure('PROBE_ERROR'), runtimeExecution: 'FAILED' })}\n`);
        process.exitCode = 1;
      }
    }
  } else if (args.wslWorkbenchAuthSelfTest) {
    process.stdout.write(`${canonicalJson(runWslWorkbenchAuthSelfTest())}\n`);
  } else if (args.workbenchSelfTest) {
    process.stdout.write(`${JSON.stringify(await runWorkbenchSelfTest())}\n`);
  } else {
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
  }
} finally {
  if (fixture) await new Promise((resolve) => fixture.server.close(resolve));
}
