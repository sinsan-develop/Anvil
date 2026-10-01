#!/usr/bin/env node
// Single Chromium context against the Python-owned HTTPS OIDC/PG15 host.
import assert from 'node:assert/strict';
import { closeSync, existsSync, lstatSync, openSync, readdirSync, realpathSync,
  renameSync, unlinkSync, writeFileSync, writeSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, isAbsolute, join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const auditSelfTest = process.argv.includes('--audit-self-test');
const apiUrl = process.env.ANVIL_F20_R6_API_URL || (auditSelfTest ? 'https://127.0.0.1:9' : undefined);
const issuerUrl = process.env.ANVIL_F20_R6_ISSUER_URL;
const alertCode = process.env.ANVIL_F20_R6_ALERT_CODE;
const controlToken = process.env.ANVIL_F20_R6_CONTROL_TOKEN;
const expectedEntity = process.env.ANVIL_F20_R6_ALERT_ENTITY;
const expectedCause = process.env.ANVIL_F20_R6_ALERT_CAUSE;
const diagnosticDrain = process.env.ANVIL_F20_R6_DIAGNOSTIC_DRAIN_NONOK === '1';
const evidenceDir = process.env.ANVIL_F20_R6_EVIDENCE_DIR;
let sensitiveValues = [];
let stage = 'BOOTSTRAP';
const progressStages = new Set([
  'BOOTSTRAP', 'PLAYWRIGHT_REQUIRE', 'BROWSER_LAUNCH', 'BROWSER_CONTEXT',
  'ISSUER_CONTEXT', 'PAGE_CREATE', 'PRE_AUTH_DOCUMENT', 'PRE_AUTH_CARD',
  'PRE_AUTH_RESPONSES',
  'PRE_AUTH_LOADING_REQUESTS', 'PRE_AUTH_LOADING_DOM', 'PRE_AUTH_KEYBOARD',
  'PRE_AUTH_LOADING_RELEASE',
  'PRE_AUTH_FETCH', 'PRE_AUTH_CARD_CHECK', 'OIDC_AUTH_REQUEST',
  'OIDC_ISSUER_REDIRECT', 'OIDC_CALLBACK', 'OIDC_SESSION', 'OIDC_COOKIE',
  'EMPTY_ALERT_FETCH', 'EMPTY_DASHBOARD_FETCH', 'EMPTY_DOCUMENT', 'EMPTY_CARD',
  'EMPTY_RESPONSES', 'EMPTY_ASSERT', 'SEED_CONTROL',
  'ERROR_DOCUMENT', 'ERROR_CARD', 'ERROR_RESPONSES', 'ERROR_ASSERT',
  'STORED_ALERT_FETCH', 'STORED_DOCUMENT', 'STORED_CARD', 'STORED_RESPONSES',
  'STORED_ALERT_WAIT',
  'STORED_ROW', 'REVOKE_CONTROL', 'REVOKE_FETCH', 'REVOKE_DOCUMENT',
  'STORED_DASHBOARD_FETCH', 'STORED_NEXT_ACTION', 'REVOKE_DASHBOARD_FETCH',
  'REVOKE_NEXT_ACTION',
  'REVOKE_CARD', 'REVOKE_RESPONSES', 'REVOKE_CLEAR', 'NETWORK_REQUEST_FACTS',
  'NETWORK_RESPONSE_FACTS', 'NETWORK_DOM', 'NETWORK_IDP_STATE',
  'NETWORK_ASSERT', 'EVIDENCE_PRE_AUTH', 'EVIDENCE_STORED', 'EVIDENCE_REVOKED',
  'ISSUER_DISPOSE', 'BROWSER_CLOSE', 'EVIDENCE_EXPORT',
]);

function markStage(value) {
  if (!progressStages.has(value)) throw new Error('R6_STAGE_INVALID');
  stage = value;
  writeSync(1, `R6_STAGE ${value}\n`);
}

function auditTraffic(requestFacts, responseFacts, domText, sessionValue) {
  const markers = [...sensitiveValues, sessionValue].filter((value) => typeof value === 'string' && value);
  const variants = markers.flatMap((value) => [value, encodeURIComponent(value)]);
  const containsSensitive = (value) => variants.some((marker) => String(value).includes(marker));
  const allAppRequestsSameOrigin = requestFacts.length > 0
    && requestFacts.every((fact) => fact.origin === apiUrl);
  const offOriginCredentialLeak = requestFacts.some((fact) => fact.origin !== apiUrl
    && ['cookie', 'authorization', 'proxy-authorization', 'x-r6-control-token']
      .some((name) => Boolean(fact.headers[name])));
  const requestExposure = requestFacts.some((fact) => {
    const headers = { ...fact.headers };
    if (fact.origin === apiUrl) delete headers.cookie; // Normal same-origin HttpOnly session.
    return containsSensitive(fact.url) || containsSensitive(fact.body)
      || containsSensitive(JSON.stringify(headers));
  });
  const responseExposure = responseFacts.some((fact) => {
    const headers = { ...fact.headers };
    if (fact.origin === apiUrl) delete headers['set-cookie']; // Normal session issuance.
    return containsSensitive(fact.url) || containsSensitive(fact.body)
      || containsSensitive(JSON.stringify(headers));
  });
  return { allAppRequestsSameOrigin, offOriginCredentialLeak,
    secretExposure: requestExposure || responseExposure || containsSensitive(domText) };
}

function validateStoredNextAction(dashboard, alert, expected, rowText, rowCount) {
  const fields = ['priority', 'reason', 'target', 'action', 'deep_link'];
  const fromAlert = { priority: alert.level, reason: alert.cause,
    target: alert.related_entity_id, action: alert.next_action, deep_link: alert.deep_link };
  assert.ok(dashboard.status === 200 && Array.isArray(dashboard.actions)
    && dashboard.actions.length === 1 && rowCount === 1
    && fields.every((field) => typeof expected[field] === 'string' && expected[field].length > 0
      && dashboard.actions[0][field] === expected[field]
      && fromAlert[field] === expected[field])
    && Object.keys(dashboard.actions[0]).length === fields.length
    && rowText.includes(expected.priority)
    && rowText.includes(`원인 · ${expected.reason}`)
    && rowText.includes(`대상 · ${expected.target}`)
    && rowText.includes(`조치 · ${expected.action}`), 'R20_NEXT_ACTION_MISMATCH');
  return { dashboardStatus: dashboard.status, actionCount: dashboard.actions.length,
    alertApiDomMatch: true };
}

function validateSeedResult(seed, code, entity, cause) {
  const alert = seed?.stored_alert;
  const fields = ['code', 'level', 'cause', 'related_entity_id', 'next_action', 'deep_link'];
  assert.ok(seed?.before_count === 0 && seed?.seeded_count === 1
    && alert && Object.keys(alert).length === fields.length
    && fields.every((field) => typeof alert[field] === 'string' && alert[field].length > 0)
    && alert.code === code && alert.level === 'critical'
    && alert.related_entity_id === entity && alert.cause === cause,
  'R24_SEED_FAILED');
  return { priority: alert.level, reason: alert.cause,
    target: alert.related_entity_id, action: alert.next_action, deep_link: alert.deep_link };
}

function validateRevokedNextAction(status, cardText, rowCount) {
  assert.ok(status === 403 && cardText.includes('BLOCKED')
    && cardText.includes('조회 차단') && rowCount === 0,
  'R20_REVOKED_ACTION_MISMATCH');
  return { revokedDashboardStatus: status, revokedActionCount: rowCount,
    revokedActionCleared: true };
}

function validateEmptyDashboard(api, alertText, actionText, alertRows, actionRows) {
  assert.ok(api.alertStatus === 200 && Array.isArray(api.alerts) && api.alerts.length === 0
    && api.actionStatus === 200 && Array.isArray(api.actions) && api.actions.length === 0
    && api.storedCount === 0 && alertRows === 0 && actionRows === 0
    && alertText.includes('이 페이지에 저장된 Critical 기록 없음')
    && actionText.includes('현재 관측된 다음 조치 0건')
    && !alertText.includes('BLOCKED') && !alertText.includes('UNAVAILABLE')
    && !actionText.includes('BLOCKED') && !actionText.includes('UNAVAILABLE'),
  'R24_EMPTY_STATE_MISMATCH');
  return { emptyCriticalAlerts: true, emptyNextActions: true, emptyIsObserved: true };
}

function validateDashboardError(view) {
  assert.ok(view.count === 1 && view.status === 503
    && view.alerts.includes('이 페이지에 저장된 Critical 기록 없음')
    && view.actions.includes('UNAVAILABLE')
    && view.actions.includes('다음 조치를 확인할 수 없습니다.')
    && !view.actions.includes('0건')
    && view.queue.includes('UNAVAILABLE') && !view.queue.includes('HEALTHY')
    && view.independentBefore.length > 0
    && view.independentAfter === view.independentBefore
    && !view.dom.includes('r24-private-error-body-marker'),
  'R24_ERROR_STATE_MISMATCH');
  return { errorIsNotZero: true, independentCardsPreserved: true, errorBodyHidden: true };
}

function safeDashboardSummary(response) {
  let actions = 'INVALID';
  try {
    const parsed = JSON.parse(response.text);
    const rows = parsed?.data?.next_actions;
    if (Array.isArray(rows) && rows.length <= 100) actions = String(rows.length);
  } catch { /* Raw response bodies never enter diagnostics. */ }
  const status = Number.isInteger(response.status) && response.status >= 100
    && response.status <= 599 ? response.status : 0;
  return { status, actions };
}

function safeStoredComparison(directText, reloadText, expected, rowTexts, visible) {
  const singleAction = (text) => {
    try {
      const rows = JSON.parse(text)?.data?.next_actions;
      return Array.isArray(rows) && rows.length === 1 && typeof rows[0]?.action === 'string'
        ? rows[0].action : null;
    } catch { return null; }
  };
  const direct = singleAction(directText);
  const reload = singleAction(reloadText);
  const matches = (value) => value === null ? 'INVALID' : value === expected ? 'YES' : 'NO';
  const safeRows = Array.isArray(rowTexts) && rowTexts.length <= 100
    && rowTexts.every((row) => typeof row === 'string') ? rowTexts : null;
  const rowMatch = (value) => safeRows === null || value === null ? 'INVALID'
    : safeRows.some((row) => row.includes(value)) ? 'YES' : 'NO';
  return {
    directExpected: matches(direct), reloadExpected: matches(reload),
    domExpected: rowMatch(expected), domReload: rowMatch(reload),
    rows: safeRows === null ? 'INVALID' : String(safeRows.length),
    visible: typeof visible === 'boolean' ? visible ? 'YES' : 'NO' : 'INVALID',
  };
}

function safeStoredCardState(status, rows, empty) {
  if (rows > 0) return 'ROW';
  if (empty) return 'EMPTY';
  return ['LOADING', 'BLOCKED', 'UNAVAILABLE'].includes(status) ? status : 'OTHER';
}

async function storedCardState(card) {
  try {
    const text = await card.innerText();
    const rows = await card.locator('li').count();
    const status = await card.locator('p.status-unavailable').first().count()
      ? await card.locator('p.status-unavailable').first().innerText() : '';
    return safeStoredCardState(status, rows, text.includes('현재 관측된 다음 조치 0건'));
  } catch { return 'OTHER'; }
}

async function injectSingleDashboardError(page, origin, work) {
  let count = 0;
  const handler = async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== origin || url.pathname !== '/api/dashboard/operations'
      || request.method() !== 'GET') {
      await route.continue();
      return;
    }
    count += 1;
    if (count !== 1) {
      await route.continue();
      return;
    }
    await route.fulfill({ status: 503, contentType: 'application/json',
      body: '{"error":"r24-private-error-body-marker"}' });
  };
  await page.route('**/api/dashboard/operations', handler);
  try {
    const value = await work();
    return { count, value };
  } finally {
    await page.unrouteAll({ behavior: 'wait' });
  }
}

function containsEvidenceSecret(value, markers) {
  return markers.filter((marker) => typeof marker === 'string' && marker)
    .flatMap((marker) => [marker, encodeURIComponent(marker)])
    .some((marker) => String(value).includes(marker));
}

function safeEvidenceUrls(requests, origin, markers) {
  assert.ok(requests.length > 0, 'R6_EVIDENCE_URL_REJECTED');
  return requests.map(({ url }) => {
    let parsed;
    try { parsed = new URL(url); }
    catch { throw new Error('R6_EVIDENCE_URL_REJECTED'); }
    assert.ok(parsed.origin === origin && parsed.protocol === 'https:'
      && !parsed.username && !parsed.password && !parsed.search && !parsed.hash
      && !url.includes('?') && !url.includes('#')
      && !containsEvidenceSecret(url, markers), 'R6_EVIDENCE_URL_REJECTED');
    return parsed.href;
  });
}

async function captureEvidenceScreen(page, markers) {
  assert.deepEqual(page.viewportSize(), { width: 1920, height: 1080 },
    'R6_EVIDENCE_SCREEN_REJECTED');
  const visibleText = await page.locator('body').innerText();
  assert.ok(!containsEvidenceSecret(visibleText, markers), 'R6_EVIDENCE_SCREEN_REJECTED');
  return page.screenshot({ type: 'png', fullPage: false });
}

function publishEvidence(directory, screens, urls) {
  assert.ok(isAbsolute(directory) && resolve(directory) === directory
    && /^anvil-u01-r6-evidence-[0-9a-f]{7}$/.test(basename(directory)),
  'R6_EVIDENCE_DIR_REJECTED');
  try {
    const stat = lstatSync(directory);
    assert.ok(stat.isDirectory() && !stat.isSymbolicLink()
      && realpathSync(directory) === directory && readdirSync(directory).length === 0,
    'R6_EVIDENCE_DIR_REJECTED');
  } catch {
    throw new Error('R6_EVIDENCE_DIR_REJECTED');
  }
  const files = [
    ['pre-auth-error.png', screens.preAuth],
    ['stored-critical.png', screens.stored],
    ['revoked-blocked.png', screens.revoked],
    ['page-requests.json', JSON.stringify({ scope: 'R6B_LOOPBACK_QA_ONLY',
      pageRequestCount: urls.length, urls }) + '\n'],
  ];
  const created = [];
  try {
    for (const [name, content] of files) {
      const pending = join(directory, name + '.pending');
      let fd;
      try {
        fd = openSync(pending, 'wx', 0o644);
        created.push(pending);
        writeFileSync(fd, content);
      } finally {
        if (fd !== undefined) closeSync(fd);
      }
    }
    for (const [name] of files) {
      const destination = join(directory, name);
      if (existsSync(destination)) throw new Error('R6_EVIDENCE_WRITE_FAILED');
      renameSync(join(directory, name + '.pending'), destination);
      created.push(destination);
    }
  } catch {
    for (const path of created.reverse()) {
      try { if (existsSync(path)) unlinkSync(path); } catch { /* Main owns residue check. */ }
    }
    throw new Error('R6_EVIDENCE_WRITE_FAILED');
  }
}

function settleCapture(work) {
  return Promise.resolve().then(work).then(
    (value) => ({ ok: true, value }),
    (error) => ({ ok: false, reason: error?.message === 'R6_CAPTURE_TIMEOUT' ? 'TIMEOUT' : 'UNREADABLE' }),
  );
}

function boundedCapture(work, timeoutMs) {
  let timer;
  return Promise.race([
    Promise.resolve().then(work),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('R6_CAPTURE_TIMEOUT')), timeoutMs);
    }),
  ]).finally(() => clearTimeout(timer));
}

function responseCategory(url) {
  try {
    const path = new URL(url).pathname;
    if (path === '/') return 'DOCUMENT';
    if (path.startsWith('/assets/')) return 'ASSET';
    if (path === '/api/operations/alerts') return 'ALERT_API';
    if (path === '/api/health/ready') return 'HEALTH_API';
    if (path === '/api/dashboard/operations') return 'DASHBOARD_API';
    if (path === '/api/providers') return 'PROVIDER_API';
    if (/^\/api\/runs\/[^/]+\/events$/.test(path)) return 'EVENT_REPLAY_API';
    if (path.startsWith('/auth/oidc/')) return 'OIDC_AUTH';
    if (path.startsWith('/api/')) return 'OTHER_API';
    return 'OTHER_APP';
  } catch {
    return 'UNKNOWN';
  }
}

function captureRequestFact(request) {
  return settleCapture(async () => ({
    origin: new URL(request.url()).origin, url: request.url(),
    body: request.postData() || '', headers: await request.allHeaders(),
  }));
}

function captureResponseFact(response, timeoutMs = 10000) {
  let status = 0;
  let category = 'UNKNOWN';
  try {
    status = response.status();
    if (!Number.isInteger(status) || status < 100 || status > 599) status = 0;
    category = responseCategory(response.url());
  } catch { /* fail closed through the capture result */ }
  return settleCapture(() => boundedCapture(async () => {
    const headers = await response.allHeaders();
    let body;
    try {
      body = await boundedCapture(() => response.text(), Math.max(10, Math.floor(timeoutMs / 3)));
    } catch (error) {
      if (![204, 301, 302, 303, 304, 307, 308].includes(status)) throw error;
      body = '';
    }
    return { origin: new URL(response.url()).origin, url: response.url(), headers, body };
  }, timeoutMs)).then((result) => ({ ...result, category, status }));
}

function verifiedFacts(results) {
  assert.ok(results.length > 0 && results.every(({ ok }) => ok), 'R6_NETWORK_CAPTURE_UNREADABLE');
  return results.map(({ value }) => value);
}

function verifiedResponseFacts(results) {
  const failed = results.find(({ ok }) => !ok);
  if (failed) {
    writeSync(1, `R6_RESPONSE_CAPTURE_FAILED category=${failed.category} status=${failed.status} reason=${failed.reason}\n`);
    throw new Error('R6_RESPONSE_CAPTURE_FAILED');
  }
  return verifiedFacts(results);
}

function failPhaseResponse(category, status, reason) {
  writeSync(1, `R6_PHASE_RESPONSE_FAILED category=${category} status=${status} reason=${reason}\n`);
  throw new Error('R6_PHASE_RESPONSE_FAILED');
}

function diagnosticDrainBootstrap(timeoutMs) {
  const browserWindow = globalThis.window;
  const originalFetch = browserWindow.fetch.bind(browserWindow);
  browserWindow.fetch = async (...args) => {
    const response = await originalFetch(...args);
    let target;
    try { target = new URL(response.url, browserWindow.location.href); }
    catch { return response; }
    if (response.ok || target.origin !== browserWindow.location.origin) return response;
    let outcome = 'DONE';
    let timer;
    try {
      const cloned = response.clone();
      await Promise.race([
        cloned.text(),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('R6_DIAG_DRAIN_TIMEOUT')), timeoutMs);
        }),
      ]);
    } catch (error) {
      outcome = error?.message === 'R6_DIAG_DRAIN_TIMEOUT' ? 'TIMEOUT' : 'ERROR';
    } finally {
      clearTimeout(timer);
    }
    const path = target.pathname;
    const category = path === '/api/providers' ? 'PROVIDER_API'
      : path === '/api/operations/alerts' ? 'ALERT_API'
        : path === '/api/health/ready' ? 'HEALTH_API' : 'OTHER_APP';
    await browserWindow.__anvilR6DrainEvent({ category, status: response.status, outcome });
    return response;
  };
}

async function configureDiagnosticDrain(page, enabled, events) {
  if (!enabled) return;
  await page.exposeFunction('__anvilR6DrainEvent', (event) => {
    assert.ok(event && ['PROVIDER_API', 'ALERT_API', 'HEALTH_API', 'OTHER_APP']
      .includes(event.category) && Number.isInteger(event.status)
      && event.status >= 100 && event.status <= 599
      && ['DONE', 'TIMEOUT', 'ERROR'].includes(event.outcome), 'R6_DIAG_EVENT_INVALID');
    events.push({ category: event.category, status: event.status, outcome: event.outcome });
  });
  await page.addInitScript(diagnosticDrainBootstrap, 2000);
}

async function probeResponseTransport(response, nativeRead, timeoutMs = 2000) {
  let headers = {};
  try { headers = response.headers() || {}; } catch { /* diagnostics stay unknown */ }
  const normalized = Object.fromEntries(Object.entries(headers)
    .map(([name, value]) => [name.toLowerCase(), value]));
  const rawLength = normalized['content-length'];
  const length = rawLength === undefined ? 'MISSING'
    : /^0+$/.test(rawLength) ? 'ZERO'
      : /^[0-9]+$/.test(rawLength) ? 'POSITIVE' : 'INVALID';
  const rawTransfer = normalized['transfer-encoding'];
  const transfer = rawTransfer === undefined ? 'MISSING'
    : String(rawTransfer).toLowerCase() === 'chunked' ? 'CHUNKED' : 'OTHER';
  const completed = await settleCapture(() => boundedCapture(() => response.finished(), timeoutMs));
  const finished = completed.ok ? (completed.value == null ? 'DONE' : 'ERROR')
    : completed.reason === 'TIMEOUT' ? 'TIMEOUT' : 'ERROR';
  const read = await settleCapture(() => boundedCapture(nativeRead, timeoutMs));
  const native = read.ok
    ? read.value?.status === 401
      ? typeof read.value.text === 'string' && read.value.text.length > 0
        ? 'READABLE_401' : 'EMPTY_BODY'
      : 'OTHER_STATUS'
    : read.reason === 'TIMEOUT' ? 'TIMEOUT' : 'ERROR';
  return { length, transfer, finished, native };
}

async function fetchOnPage(page, path, options = {}) {
  return page.evaluate(async ({ path, options }) => {
    const response = await fetch(path, { credentials: 'same-origin', ...options });
    const text = await response.text();
    return { status: response.status, text };
  }, { path, options });
}

const loadingPaths = new Map([
  ['/api/providers', 'PROVIDER_API'],
  ['/api/operations/alerts', 'ALERT_API'],
  ['/api/health/ready', 'HEALTH_API'],
  ['/api/dashboard/operations', 'DASHBOARD_API'],
]);

function validateLoadingFacts(facts) {
  const names = ['Database', 'Queue', 'Worker', 'LLM Providers',
    'Execution Backends', 'Artifact Store'];
  const valid = (item, name) => item?.status === 'LOADING'
    && item.live === 'polite' && item.atomic === 'true'
    && item.text === `${name} 조회 중입니다.`;
  assert.ok(facts.cards?.length === names.length
    && facts.cards.every((item, index) => item.name === names[index] && valid(item, item.name))
    && valid(facts.next, '다음 조치')
    && valid(facts.alerts, 'Critical Alerts')
    && facts.checked === 'NOT REQUESTED', 'R23_LOADING_STATE_MISMATCH');
  return { loadingCardCount: names.length, loadingNextActions: true,
    loadingCriticalAlerts: true };
}

async function loadingFacts(page) {
  const liveFact = async (locator) => {
    const live = locator.locator('[aria-live]');
    return { status: await live.locator('p').first().innerText(),
      live: await live.getAttribute('aria-live'), atomic: await live.getAttribute('aria-atomic'),
      text: await live.locator('p').nth(1).innerText() };
  };
  const health = page.locator('section[aria-labelledby="health-heading"]');
  const cards = [];
  for (const name of ['Database', 'Queue', 'Worker', 'LLM Providers',
    'Execution Backends', 'Artifact Store']) {
    const card = health.locator('article.status-card').filter({ hasText: name });
    cards.push({ name, ...await liveFact(card) });
  }
  const next = await liveFact(page.locator('section[aria-labelledby="next-actions-heading"]'));
  const alerts = await liveFact(page.locator('section[aria-labelledby="critical-alerts-heading"]'));
  const checked = (await page.locator('.dashboard-heading').innerText()).includes('NOT REQUESTED')
    ? 'NOT REQUESTED' : 'SETTLED';
  return { cards, next, alerts, checked };
}

async function verifyDashboardKeyboard(page) {
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')),
    'Anvil Dashboard', 'R23_KEYBOARD_MISMATCH');
  await page.keyboard.press('Tab');
  const toggle = page.locator('button.sidebar-toggle');
  assert.equal(await toggle.evaluate((element) => element === document.activeElement), true,
    'R23_KEYBOARD_MISMATCH');
  assert.equal(await toggle.getAttribute('aria-expanded'), 'true', 'R23_KEYBOARD_MISMATCH');
  await page.keyboard.press('Enter');
  assert.equal(await toggle.getAttribute('aria-expanded'), 'false', 'R23_KEYBOARD_MISMATCH');
  await page.keyboard.press('Enter');
  assert.equal(await toggle.getAttribute('aria-expanded'), 'true', 'R23_KEYBOARD_MISMATCH');
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement?.textContent?.trim()),
    'Dashboard', 'R23_KEYBOARD_MISMATCH');
  return { dashboardTabFocused: true, sidebarEnterToggle: true };
}

function createTrackedRouteHandler(origin, pending, observed) {
  const active = [];
  let failed = false;
  let signalFailure;
  const failure = new Promise((resolveFailure) => { signalFailure = resolveFailure; });
  const handler = (route) => {
    const work = (async () => {
      const url = new URL(route.request().url());
      const category = url.origin === origin ? loadingPaths.get(url.pathname) : undefined;
      if (!category || observed.has(category)) { await route.continue(); return; }
      observed.set(category, true);
      const gate = pending.get(category);
      gate.resolveRequest();
      await gate.released;
      await route.continue();
    })().catch(() => {
      if (!failed) {
        failed = true;
        writeSync(1, 'R23_ROUTE_CONTINUE_FAILED\n');
        signalFailure();
      }
    });
    active.push(work);
    return work;
  };
  return { handler, failure,
    async drain() {
      await Promise.all(active);
      if (failed) throw new Error('R23_ROUTE_CONTINUE_FAILED');
    } };
}

function cardsStillPending(released) {
  const cards = [];
  if (!released.has('ALERT_API')) cards.push('ALERTS');
  if (!released.has('DASHBOARD_API')) cards.push('NEXT_ACTIONS');
  return cards;
}

async function holdFirstDashboardRequests(page, origin, navigate) {
  const pending = new Map();
  const observed = new Map();
  for (const category of loadingPaths.values()) {
    let resolveRequest;
    const requested = new Promise((resolveRequestNow) => { resolveRequest = resolveRequestNow; });
    let release;
    const released = new Promise((releaseNow) => { release = releaseNow; });
    pending.set(category, { requested, resolveRequest, released, release });
  }
  const routes = createTrackedRouteHandler(origin, pending, observed);
  await page.route('**/*', routes.handler);
  try {
    await navigate();
    const evidence = await (async () => {
      markStage('PRE_AUTH_LOADING_REQUESTS');
      await boundedCapture(() => Promise.all([...pending.values()].map((gate) => gate.requested)), 10000);
      markStage('PRE_AUTH_LOADING_DOM');
      const loading = validateLoadingFacts(await loadingFacts(page));
      markStage('PRE_AUTH_KEYBOARD');
      const keyboard = await verifyDashboardKeyboard(page);
      markStage('PRE_AUTH_LOADING_RELEASE');
      const released = new Set();
      for (const category of loadingPaths.values()) {
        const response = page.waitForResponse((value) =>
          new URL(value.url()).origin === origin && responseCategory(value.url()) === category,
        { timeout: 10000 });
        released.add(category);
        pending.get(category).release();
        await Promise.race([response, routes.failure.then(() => {
          throw new Error('R23_ROUTE_CONTINUE_FAILED');
        })]);
        for (const card of cardsStillPending(released)) {
          const selector = card === 'ALERTS' ? 'critical-alerts-heading' : 'next-actions-heading';
          assert.equal(await page.locator(`section[aria-labelledby="${selector}"]`)
            .locator('[aria-live] p').first().innerText(), 'LOADING', 'R23_EARLY_SETTLEMENT');
        }
      }
      return { ...loading, ...keyboard, heldRequestCount: observed.size, individuallyReleased: true };
    })();
    return evidence;
  } finally {
    for (const gate of pending.values()) gate.release();
    await page.unrouteAll({ behavior: 'wait' });
    await routes.drain();
  }
}

async function readyDashboard(page, action, origin, phase, responseCaptures, beforeResponses) {
  const categories = ['HEALTH_API', 'PROVIDER_API', 'ALERT_API', 'DASHBOARD_API'];
  const responseReady = categories.map((category) => {
    let pending;
    try {
      pending = page.waitForResponse((response) => {
        try {
          return new URL(response.url()).origin === origin && responseCategory(response.url()) === category;
        } catch {
          return false;
        }
      }, { timeout: 10000 });
    } catch (error) {
      pending = Promise.reject(error);
    }
    return Promise.resolve(pending).then(
      (value) => ({ ok: true, value, category }),
      (error) => ({ ok: false, category,
        reason: error?.name === 'TimeoutError' ? 'WAIT_TIMEOUT' : 'WAIT_ERROR' }),
    );
  });
  markStage(phase + '_DOCUMENT');
  const navigate = async () => {
    if (action === 'goto') await page.goto(origin + '/', { waitUntil: 'domcontentloaded' });
    else if (action === 'reload') await page.reload({ waitUntil: 'domcontentloaded' });
    else throw new Error('R6_NAVIGATION_ACTION_INVALID');
  };
  const beforeEvidence = beforeResponses ? await beforeResponses(navigate) : (await navigate(), {});
  markStage(phase + '_CARD');
  const card = page.locator('section[aria-labelledby="critical-alerts-heading"]');
  await card.waitFor({ state: 'visible' });
  markStage(phase + '_RESPONSES');
  const settled = await Promise.all(responseReady);
  const missing = settled.find(({ ok }) => !ok);
  if (missing) failPhaseResponse(missing.category, 0, missing.reason);
  const captures = settled.map(({ value, category }) => {
    const capture = responseCaptures.get(value);
    if (!capture) {
      let status = 0;
      try { status = value.status(); } catch { /* unknown status stays zero */ }
      if (!Number.isInteger(status) || status < 100 || status > 599) status = 0;
      failPhaseResponse(category, status, 'CAPTURE_MISSING');
    }
    return capture;
  });
  const results = await Promise.all(captures);
  const providerIndex = categories.indexOf('PROVIDER_API');
  const provider = results[providerIndex];
  if (!provider.ok && provider.status === 401 && provider.reason === 'TIMEOUT') {
    const probe = await probeResponseTransport(settled[providerIndex].value,
      () => fetchOnPage(page, '/api/providers'));
    writeSync(1, `R6_RESPONSE_PROBE category=PROVIDER_API status=401 `
      + `length=${probe.length} transfer=${probe.transfer} `
      + `finished=${probe.finished} native=${probe.native}\n`);
  }
  verifiedResponseFacts(results);
  return { card, beforeEvidence,
    ...(phase === 'STORED' ? { dashboardResponse: results[categories.indexOf('DASHBOARD_API')] } : {}) };
}

async function main() {
  markStage('BOOTSTRAP');
  assert.ok(process.env.ANVIL_F20_R6_DIAGNOSTIC_DRAIN_NONOK === undefined
    || process.env.ANVIL_F20_R6_DIAGNOSTIC_DRAIN_NONOK === '1', 'R6_DIAG_FLAG_INVALID');
  sensitiveValues = JSON.parse(process.env.ANVIL_F20_R6_SECRET_VALUES_JSON || '[]');
  assert.equal(new URL(apiUrl).hostname, '127.0.0.1');
  assert.equal(new URL(issuerUrl).hostname, '127.0.0.1');
  assert.equal(alertCode, 'WORKER_LEASE_EXPIRED');
  assert.ok(controlToken?.length >= 32);
  assert.ok(expectedEntity && expectedCause && Array.isArray(sensitiveValues));
  assert.ok(!evidenceDir || !diagnosticDrain, 'R6_EVIDENCE_DIAGNOSTIC_CONFLICT');
  markStage('PLAYWRIGHT_REQUIRE');
  const { chromium, request: playwrightRequest } = require(process.env.ANVIL_PLAYWRIGHT_MODULE || 'playwright');
  markStage('BROWSER_LAUNCH');
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  let flowComplete = false;
  let resultEvidence;
  let exportPayload;
  try {
    markStage('BROWSER_CONTEXT');
    const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1920, height: 1080 } });
    markStage('ISSUER_CONTEXT');
    const issuerClient = await playwrightRequest.newContext({ ignoreHTTPSErrors: true });
    try {
    markStage('PAGE_CREATE');
    const page = await context.newPage();
    const diagnosticEvents = [];
    await configureDiagnosticDrain(page, diagnosticDrain, diagnosticEvents);
    const requestFacts = [];
    const responseFacts = [];
    const responseCaptures = new WeakMap();
    page.on('request', (request) => {
      requestFacts.push(captureRequestFact(request));
    });
    page.on('response', (response) => {
      const capture = captureResponseFact(response);
      responseCaptures.set(response, capture);
      responseFacts.push(capture);
    });
    const { card, beforeEvidence: loadingEvidence } = await readyDashboard(page, 'goto', apiUrl,
      'PRE_AUTH', responseCaptures,
      (navigate) => holdFirstDashboardRequests(page, apiUrl, navigate));
    markStage('PRE_AUTH_FETCH');
    const preAuth = await fetchOnPage(page, '/api/operations/alerts');
    assert.equal(preAuth.status, 401);
    markStage('PRE_AUTH_CARD_CHECK');
    assert.equal(await card.getByText(alertCode, { exact: true }).count(), 0);
    if (evidenceDir) {
      await card.getByText('UNAVAILABLE', { exact: true }).waitFor();
      markStage('EVIDENCE_PRE_AUTH');
      exportPayload = { screens: { preAuth: await captureEvidenceScreen(page, sensitiveValues) } };
    }

    markStage('OIDC_AUTH_REQUEST');
    const authorization = await fetchOnPage(page, '/auth/oidc/authorization', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    });
    assert.equal(authorization.status, 200);
    const authPayload = JSON.parse(authorization.text).data;
    assert.equal(new URL(authPayload.authorization_url).origin, new URL(issuerUrl).origin);
    markStage('OIDC_ISSUER_REDIRECT');
    const redirect = await issuerClient.get(authPayload.authorization_url, { maxRedirects: 0 });
    assert.equal(redirect.status(), 302);
    const callbackLocation = new URL(redirect.headers().location);
    assert.equal(callbackLocation.origin, apiUrl);
    assert.equal(callbackLocation.pathname, '/auth/oidc/callback');
    assert.equal(callbackLocation.searchParams.get('state'), authPayload.browser_state);
    markStage('OIDC_CALLBACK');
    const callback = await fetchOnPage(page, '/auth/oidc/callback', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: callbackLocation.searchParams.get('code'),
        state: authPayload.browser_state, browser_state: authPayload.browser_state }),
    });
    assert.equal(callback.status, 200);
    markStage('OIDC_SESSION');
    const session = await fetchOnPage(page, '/auth/session/status');
    assert.equal(session.status, 200);
    assert.equal(JSON.parse(session.text).authenticated, true);
    markStage('OIDC_COOKIE');
    const cookie = (await context.cookies(apiUrl)).find(({ name }) => name === 'anvil_session');
    assert.ok(cookie?.secure && cookie?.httpOnly);

    markStage('EMPTY_ALERT_FETCH');
    const emptyAlerts = await fetchOnPage(page, '/api/operations/alerts');
    markStage('EMPTY_DASHBOARD_FETCH');
    const emptyDashboard = await fetchOnPage(page, '/api/dashboard/operations');
    await readyDashboard(page, 'reload', apiUrl, 'EMPTY', responseCaptures);
    markStage('EMPTY_CARD');
    const nextCard = page.locator('section[aria-labelledby="next-actions-heading"]');
    await nextCard.waitFor({ state: 'visible' });
    await card.getByText('이 페이지에 저장된 Critical 기록 없음').waitFor();
    await nextCard.getByText('현재 관측된 다음 조치 0건', { exact: false }).waitFor();
    const emptyAlertText = await card.innerText();
    const emptyActionText = await nextCard.innerText();
    const emptyAlertRows = await card.locator('li').count();
    const emptyActionRows = await nextCard.locator('li').count();
    markStage('EMPTY_ASSERT');
    assert.ok(emptyAlertText.includes('이 페이지에 저장된 Critical 기록 없음')
      && emptyActionText.includes('현재 관측된 다음 조치 0건'),
    'R24_EMPTY_STATE_MISMATCH');
    const providerCard = page.locator('section[aria-labelledby="health-heading"]')
      .locator('article.status-card').filter({ hasText: 'LLM Providers' });
    await page.waitForFunction(() => {
      const card = [...document.querySelectorAll('section[aria-labelledby="health-heading"] article.status-card')]
        .find((item) => item.textContent?.includes('LLM Providers'));
      return card && !card.textContent?.includes('조회 중입니다.');
    });
    const independentBefore = await providerCard.innerText();

    const errorResponse = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.origin === apiUrl && url.pathname === '/api/dashboard/operations'
        && response.status() === 503;
    }, { timeout: 10000 });
    const injectedFlow = await injectSingleDashboardError(page, apiUrl,
      () => readyDashboard(page, 'reload', apiUrl, 'ERROR', responseCaptures));
    const injected = await errorResponse;
    markStage('ERROR_ASSERT');
    await nextCard.getByText('UNAVAILABLE', { exact: true }).waitFor();
    await card.getByText('이 페이지에 저장된 Critical 기록 없음').waitFor();
    const errorEvidence = validateDashboardError({
      count: injectedFlow.count, status: injected.status(),
      alerts: await card.innerText(), actions: await nextCard.innerText(),
      queue: await page.locator('section[aria-labelledby="health-heading"]')
        .locator('article.status-card').filter({ hasText: 'Queue' }).first().innerText(),
      independentBefore,
      independentAfter: await providerCard.innerText(),
      dom: await page.locator('body').innerText(),
    });
    markStage('SEED_CONTROL');
    const seed = await issuerClient.post(new URL('/r6-control/seed', issuerUrl).href, {
      headers: { 'x-r6-control-token': controlToken },
    });
    assert.equal(seed.status(), 200, 'R24_SEED_FAILED');
    const seedResult = await seed.json();
    const expectedAction = validateSeedResult(seedResult, alertCode, expectedEntity, expectedCause);
    const emptyEvidence = validateEmptyDashboard({
      alertStatus: emptyAlerts.status, alerts: JSON.parse(emptyAlerts.text).data.alerts,
      actionStatus: emptyDashboard.status,
      actions: JSON.parse(emptyDashboard.text).data.next_actions,
      storedCount: seedResult.before_count,
    }, emptyAlertText, emptyActionText, emptyAlertRows, emptyActionRows);

    markStage('STORED_ALERT_FETCH');
    const stored = await fetchOnPage(page, '/api/operations/alerts');
    assert.equal(stored.status, 200);
    const alerts = JSON.parse(stored.text).data.alerts;
    assert.deepEqual(alerts.map(({ code }) => code), [alertCode]);
    assert.equal(alerts[0].related_entity_id, expectedEntity);
    assert.equal(alerts[0].cause, expectedCause);
    markStage('STORED_DASHBOARD_FETCH');
    const storedDashboard = await fetchOnPage(page, '/api/dashboard/operations');
    assert.equal(storedDashboard.status, 200, 'R20_NEXT_ACTION_MISMATCH');
    const dashboardActions = JSON.parse(storedDashboard.text).data.next_actions;
    const storedReady = await readyDashboard(page, 'reload', apiUrl, 'STORED', responseCaptures);
    markStage('STORED_ALERT_WAIT');
    await card.getByText(alertCode, { exact: true }).waitFor();
    const visibleBeforeRevoke = await card.getByText(alertCode, { exact: true }).count() === 1;
    markStage('STORED_ROW');
    const rowText = await card.locator('li').filter({ hasText: alertCode }).innerText();
    const rowMatches = rowText.includes(expectedEntity) && rowText.includes(expectedCause);
    assert.ok(rowMatches);
    markStage('STORED_NEXT_ACTION');
    await nextCard.waitFor({ state: 'visible' });
    try {
      await nextCard.locator('li').filter({ hasText: expectedAction.action }).waitFor();
    } catch (error) {
      const direct = safeDashboardSummary(storedDashboard);
      const reload = safeDashboardSummary({ status: storedReady.dashboardResponse.status,
        text: storedReady.dashboardResponse.value.body });
      const dom = await storedCardState(nextCard);
      writeSync(1, `R24_STORED_UI_DIAG directStatus=${direct.status} directActions=${direct.actions}`
        + ` reloadStatus=${reload.status} reloadActions=${reload.actions} dom=${dom}\n`);
      let rowTexts = null;
      let visible = null;
      try {
        const rows = nextCard.locator('li');
        rowTexts = await rows.allInnerTexts();
        visible = rowTexts.length > 0 ? await rows.first().isVisible() : false;
      } catch { /* Diagnostic collection must not replace the original failure. */ }
      const comparison = safeStoredComparison(storedDashboard.text,
        storedReady.dashboardResponse.value.body, expectedAction.action, rowTexts, visible);
      writeSync(1, `R24_STORED_COMPARE directExpected=${comparison.directExpected}`
        + ` reloadExpected=${comparison.reloadExpected} domExpected=${comparison.domExpected}`
        + ` domReload=${comparison.domReload} rows=${comparison.rows} visible=${comparison.visible}\n`);
      throw error;
    }
    const actionRow = nextCard.locator('li');
    const storedActionEvidence = validateStoredNextAction(
      { status: storedDashboard.status, actions: dashboardActions }, alerts[0], expectedAction,
      await actionRow.first().innerText(), await actionRow.count());
    if (evidenceDir) {
      markStage('EVIDENCE_STORED');
      exportPayload.screens.stored = await captureEvidenceScreen(page,
        [...sensitiveValues, cookie.value]);
    }

    markStage('REVOKE_CONTROL');
    const released = await issuerClient.post(new URL('/r6-control/revoke', issuerUrl).href, {
      headers: { 'x-r6-control-token': controlToken },
    });
    assert.equal(released.status(), 200);
    markStage('REVOKE_FETCH');
    const revoked = await fetchOnPage(page, '/api/operations/alerts');
    assert.equal(revoked.status, 403);
    markStage('REVOKE_DASHBOARD_FETCH');
    const revokedDashboard = await fetchOnPage(page, '/api/dashboard/operations');
    await readyDashboard(page, 'reload', apiUrl, 'REVOKE', responseCaptures);
    markStage('REVOKE_CLEAR');
    await card.getByText('BLOCKED', { exact: true }).waitFor();
    await card.getByText('조회 차단', { exact: false }).waitFor();
    assert.equal(await card.getByText('UNAVAILABLE', { exact: true }).count(), 0);
    const staleCleared = await card.getByText(alertCode, { exact: true }).count() === 0;
    markStage('REVOKE_NEXT_ACTION');
    await nextCard.getByText('BLOCKED', { exact: true }).waitFor();
    const revokedActionEvidence = validateRevokedNextAction(revokedDashboard.status,
      await nextCard.innerText(), await nextCard.locator('li').count());
    if (evidenceDir) {
      assert.ok(staleCleared, 'R6_EVIDENCE_REVOKE_STATE_REJECTED');
      markStage('EVIDENCE_REVOKED');
      exportPayload.screens.revoked = await captureEvidenceScreen(page,
        [...sensitiveValues, cookie.value]);
    }
    markStage('NETWORK_REQUEST_FACTS');
    const requests = verifiedFacts(await Promise.all(requestFacts));
    markStage('NETWORK_RESPONSE_FACTS');
    const responses = verifiedResponseFacts(await Promise.all(responseFacts));
    markStage('NETWORK_DOM');
    const domText = await page.locator('body').innerText();
    const { allAppRequestsSameOrigin, offOriginCredentialLeak, secretExposure } =
      auditTraffic(requests, responses, domText, cookie.value);
    markStage('NETWORK_IDP_STATE');
    const idpContextSeparate = (await issuerClient.storageState()).cookies
      .every(({ name }) => name !== 'anvil_session');
    markStage('NETWORK_ASSERT');
    const appApiRequestCount = requests.filter(({ url }) => new URL(url).pathname.startsWith('/api/')).length;
    assert.ok(allAppRequestsSameOrigin && !offOriginCredentialLeak && !secretExposure
      && idpContextSeparate && staleCleared && appApiRequestCount > 0);
    if (diagnosticDrain) {
      assert.ok(diagnosticEvents.length > 0
        && diagnosticEvents.every(({ outcome }) => outcome === 'DONE')
        && diagnosticEvents.some(({ category, status }) =>
          category === 'PROVIDER_API' && status === 401), 'R6_DIAG_DRAIN_INCOMPLETE');
    }
    if (evidenceDir) {
      exportPayload.urls = safeEvidenceUrls(requests, apiUrl, [...sensitiveValues, cookie.value]);
    }
    resultEvidence = {
      preAuthStatus: preAuth.status, authorizationStatus: authorization.status,
      callbackStatus: callback.status, sessionAuthenticated: true,
      cookieSecure: cookie.secure, cookieHttpOnly: cookie.httpOnly,
      storedStatus: stored.status, storedAlertCode: alerts[0].code,
      storedEntity: alerts[0].related_entity_id, storedCause: alerts[0].cause, rowMatches,
      visibleBeforeRevoke, revokedStatus: revoked.status, staleCleared,
      ...storedActionEvidence, ...revokedActionEvidence,
      ...loadingEvidence, ...emptyEvidence, ...errorEvidence, r23Regression: true,
      allAppRequestsSameOrigin, idpContextSeparate, offOriginCredentialLeak, secretExposure,
      pageRequestCount: requests.length, appApiRequestCount,
      ...(diagnosticDrain ? {
        diagnosticDrainMode: true,
        diagnosticNonOkDrainCount: diagnosticEvents.length,
        diagnosticProvider401DrainCount: diagnosticEvents.filter(({ category, status }) =>
          category === 'PROVIDER_API' && status === 401).length,
      } : {}),
    };
    flowComplete = true;
    } finally {
      if (flowComplete) markStage('ISSUER_DISPOSE');
      await issuerClient.dispose();
    }
  } finally {
    if (flowComplete) markStage('BROWSER_CLOSE');
    await browser.close();
  }
  if (evidenceDir) {
    markStage('EVIDENCE_EXPORT');
    publishEvidence(evidenceDir, exportPayload.screens, exportPayload.urls);
    resultEvidence.evidenceExported = true;
  }
  console.log('R6_RESULT ' + JSON.stringify(resultEvidence));
}

if (auditSelfTest) {
  assert.deepEqual(validateSeedResult({ before_count: 0, seeded_count: 1,
    stored_alert: { code: 'WORKER_LEASE_EXPIRED', level: 'critical',
      cause: 'Worker lease expiry observed', related_entity_id: 'r6-run',
      next_action: 'REVIEW_WORKER_TAKEOVER', deep_link: '/operations/workers' } },
  'WORKER_LEASE_EXPIRED', 'r6-run', 'Worker lease expiry observed'),
  { priority: 'critical', reason: 'Worker lease expiry observed', target: 'r6-run',
    action: 'REVIEW_WORKER_TAKEOVER', deep_link: '/operations/workers' });
  assert.throws(() => validateSeedResult({ before_count: 0, seeded_count: 1,
    stored_alert: { code: 'WORKER_LEASE_EXPIRED', level: 'critical',
      cause: 'wrong cause', related_entity_id: 'r6-run',
      next_action: 'REVIEW_WORKER_TAKEOVER', deep_link: '/operations/workers' } },
  'WORKER_LEASE_EXPIRED', 'r6-run', 'Worker lease expiry observed'), /R24_SEED_FAILED/);
  assert.deepEqual(safeStoredComparison(
    '{"data":{"next_actions":[{"action":"REVIEW_WORKER_LEASE"}]}}',
    '{"data":{"next_actions":[{"action":"REVIEW_WORKER_LEASE"}]}}',
    'REVIEW_WORKER_LEASE', ['critical\n조치 · REVIEW_WORKER_LEASE'], true),
  { directExpected: 'YES', reloadExpected: 'YES', domExpected: 'YES',
    domReload: 'YES', rows: '1', visible: 'YES' });
  assert.deepEqual(safeStoredComparison(
    '{"data":{"next_actions":[{"action":"REVIEW_WORKER_LEASE"}]}}',
    '{"data":{"next_actions":[{"action":"OTHER_ACTION"}]}}',
    'REVIEW_WORKER_LEASE', ['critical\n조치 · OTHER_ACTION'], false),
  { directExpected: 'YES', reloadExpected: 'NO', domExpected: 'NO',
    domReload: 'YES', rows: '1', visible: 'NO' });
  assert.deepEqual(safeDashboardSummary({ status: 200,
    text: '{"data":{"next_actions":[{"action":"private"}]}}' }),
  { status: 200, actions: '1' });
  assert.deepEqual(safeDashboardSummary({ status: 503, text: 'private-error-body' }),
    { status: 503, actions: 'INVALID' });
  assert.deepEqual(safeDashboardSummary({ status: 200, text: '{"data":{"next_actions":"private"}}' }),
    { status: 200, actions: 'INVALID' });
  assert.equal(safeStoredCardState('UNAVAILABLE', 0, false), 'UNAVAILABLE');
  assert.equal(safeStoredCardState('private-text', 0, false), 'OTHER');
  assert.equal(safeStoredCardState('', 1, false), 'ROW');
  assert.deepEqual(validateEmptyDashboard(
    { alertStatus: 200, alerts: [], actionStatus: 200, actions: [], storedCount: 0 },
    '이 페이지에 저장된 Critical 기록 없음',
    '현재 관측된 다음 조치 0건 · 전체 범위의 부재는 확인되지 않았습니다.',
    0, 0), { emptyCriticalAlerts: true, emptyNextActions: true, emptyIsObserved: true });
  for (const altered of [
    { alertStatus: 401, alerts: [], actionStatus: 200, actions: [], storedCount: 0 },
    { alertStatus: 200, alerts: [], actionStatus: 503, actions: [], storedCount: 0 },
    { alertStatus: 200, alerts: [], actionStatus: 200, actions: [], storedCount: 1 },
  ]) assert.throws(() => validateEmptyDashboard(altered,
    '이 페이지에 저장된 Critical 기록 없음', '현재 관측된 다음 조치 0건', 0, 0),
  /R24_EMPTY_STATE_MISMATCH/);
  const errorView = { count: 1, status: 503,
    alerts: '이 페이지에 저장된 Critical 기록 없음',
    actions: 'UNAVAILABLE\n다음 조치를 확인할 수 없습니다.',
    queue: 'UNAVAILABLE\nQueue 상태 정보를 확인할 수 없습니다.',
    independentBefore: '등록 9 / 9', independentAfter: '등록 9 / 9',
    dom: 'safe dashboard' };
  assert.deepEqual(validateDashboardError(errorView), {
    errorIsNotZero: true, independentCardsPreserved: true, errorBodyHidden: true,
  });
  for (const changed of [
    { ...errorView, count: 2 }, { ...errorView, status: 200 },
    { ...errorView, actions: '현재 관측된 다음 조치 0건' },
    { ...errorView, queue: 'HEALTHY' },
    { ...errorView, alerts: 'UNAVAILABLE' },
    { ...errorView, independentAfter: 'UNAVAILABLE' },
    { ...errorView, dom: 'r24-private-error-body-marker' },
  ]) assert.throws(() => validateDashboardError(changed), /R24_ERROR_STATE_MISMATCH/);
  const routeCalls = [];
  let injectedHandler;
  const routePage = {
    route: async (_path, handler) => { injectedHandler = handler; },
    unrouteAll: async ({ behavior }) => { routeCalls.push(`drain:${behavior}`); },
  };
  const requestRoute = () => ({
    request: () => ({ url: () => apiUrl + '/api/dashboard/operations', method: () => 'GET' }),
    fulfill: async ({ status, body }) => { routeCalls.push(`fulfill:${status}`);
      assert.equal(body, '{"error":"r24-private-error-body-marker"}'); },
    continue: async () => { routeCalls.push('continue'); },
  });
  const injection = await injectSingleDashboardError(routePage, apiUrl, async () => {
    await injectedHandler(requestRoute());
    return 'done';
  });
  assert.deepEqual(injection, { count: 1, value: 'done' });
  assert.deepEqual(routeCalls, ['fulfill:503', 'drain:wait']);
  routeCalls.length = 0;
  await assert.rejects(injectSingleDashboardError(routePage, apiUrl,
    async () => { throw new Error('expected-route-work-failure'); }),
  /expected-route-work-failure/);
  assert.deepEqual(routeCalls, ['drain:wait']);
  assert.deepEqual(cardsStillPending(new Set(['PROVIDER_API'])),
    ['ALERTS', 'NEXT_ACTIONS']);
  assert.deepEqual(cardsStillPending(new Set(['PROVIDER_API', 'ALERT_API'])),
    ['NEXT_ACTIONS']);
  assert.deepEqual(cardsStillPending(new Set(['PROVIDER_API', 'ALERT_API', 'HEALTH_API'])),
    ['NEXT_ACTIONS']);
  assert.deepEqual(cardsStillPending(new Set(['PROVIDER_API', 'ALERT_API',
    'HEALTH_API', 'DASHBOARD_API'])), []);
  const testGate = {};
  testGate.requested = new Promise((resolveRequest) => { testGate.resolveRequest = resolveRequest; });
  testGate.released = new Promise((release) => { testGate.release = release; });
  const testPending = new Map([['PROVIDER_API', testGate]]);
  const testObserved = new Map();
  const routeTracker = createTrackedRouteHandler(apiUrl, testPending, testObserved);
  let rejectContinue;
  const delayedContinue = new Promise((_, reject) => { rejectContinue = reject; });
  let continueCalls = 0;
  const unhandled = [];
  const onUnhandled = (error) => { unhandled.push(error); };
  process.on('unhandledRejection', onUnhandled);
  try {
    const handling = routeTracker.handler({
      request: () => ({ url: () => apiUrl + '/api/providers' }),
      continue: () => { continueCalls += 1; return delayedContinue; },
    });
    await testGate.requested;
    testGate.release();
    const draining = assert.rejects(routeTracker.drain(), /R23_ROUTE_CONTINUE_FAILED/);
    rejectContinue(new Error('private-route-detail'));
    await draining;
    await handling;
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(unhandled.length, 0, 'R23_ROUTE_UNHANDLED');
    assert.equal(continueCalls, 1);
    assert.equal(testObserved.size, 1);
  } finally {
    process.off('unhandledRejection', onUnhandled);
  }
  const loadingFacts = {
    cards: ['Database', 'Queue', 'Worker', 'LLM Providers', 'Execution Backends', 'Artifact Store']
      .map((name) => ({ name, status: 'LOADING', live: 'polite', atomic: 'true',
        text: `${name} 조회 중입니다.` })),
    next: { status: 'LOADING', live: 'polite', atomic: 'true', text: '다음 조치 조회 중입니다.' },
    alerts: { status: 'LOADING', live: 'polite', atomic: 'true', text: 'Critical Alerts 조회 중입니다.' },
    checked: 'NOT REQUESTED',
  };
  assert.deepEqual(validateLoadingFacts(loadingFacts), { loadingCardCount: 6,
    loadingNextActions: true, loadingCriticalAlerts: true });
  for (const changed of [
    { ...loadingFacts, cards: loadingFacts.cards.map((card) =>
      card.name === 'Database' ? { ...card, status: 'NOT CONNECTED' } : card) },
    { ...loadingFacts, next: { ...loadingFacts.next, text: '현재 관측된 다음 조치 0건' } },
    { ...loadingFacts, alerts: { ...loadingFacts.alerts, live: null } },
    { ...loadingFacts, checked: 'JUST NOW' },
  ]) assert.throws(() => validateLoadingFacts(changed), /R23_LOADING_STATE_MISMATCH/);
  const actionAlert = {
    level: 'critical', cause: 'Worker lease expiry observed',
    related_entity_id: 'r6-run', next_action: 'REVIEW_WORKER_LEASE',
    deep_link: '/operations',
  };
  const expectedAction = {
    priority: 'critical', reason: 'Worker lease expiry observed',
    target: 'r6-run', action: 'REVIEW_WORKER_LEASE', deep_link: '/operations',
  };
  const dashboardOk = { status: 200, actions: [expectedAction] };
  const displayed = 'critical\n원인 · Worker lease expiry observed\n대상 · r6-run\n조치 · REVIEW_WORKER_LEASE';
  assert.deepEqual(validateStoredNextAction(dashboardOk, actionAlert, expectedAction,
    displayed, 1), { dashboardStatus: 200, actionCount: 1,
    alertApiDomMatch: true });
  for (const field of Object.keys(expectedAction)) {
    const wrong = { ...expectedAction, [field]: 'wrong' };
    assert.throws(() => validateStoredNextAction({ status: 200, actions: [wrong] },
      actionAlert, expectedAction, displayed, 1), /R20_NEXT_ACTION_MISMATCH/);
  }
  assert.throws(() => validateStoredNextAction({ status: 403, actions: [] },
    actionAlert, expectedAction, displayed, 0), /R20_NEXT_ACTION_MISMATCH/);
  assert.throws(() => validateStoredNextAction(dashboardOk, actionAlert,
    expectedAction, displayed.replace('r6-run', 'wrong'), 1),
  /R20_NEXT_ACTION_MISMATCH/);
  assert.deepEqual(validateRevokedNextAction(403, 'BLOCKED\n조회 차단', 0),
    { revokedDashboardStatus: 403, revokedActionCount: 0, revokedActionCleared: true });
  for (const [status, text, count] of [[200, 'BLOCKED\n조회 차단', 0],
    [403, 'UNAVAILABLE', 0], [403, 'BLOCKED\n조회 차단', 1]]) {
    assert.throws(() => validateRevokedNextAction(status, text, count),
      /R20_REVOKED_ACTION_MISMATCH/);
  }
  const evidenceRequests = [
    { origin: apiUrl, url: apiUrl + '/', body: '', headers: {} },
    { origin: apiUrl, url: apiUrl + '/api/operations/alerts', body: '', headers: {} },
    { origin: apiUrl, url: apiUrl + '/api/operations/alerts', body: '', headers: {} },
  ];
  assert.deepEqual(safeEvidenceUrls(evidenceRequests, apiUrl, ['private-token']), [
    apiUrl + '/', apiUrl + '/api/operations/alerts', apiUrl + '/api/operations/alerts',
  ]);
  for (const url of [apiUrl + '/?', apiUrl + '/#',
    apiUrl + '/auth/oidc/callback?code=private-token',
    apiUrl + '/api/private-token', 'https://outside.invalid/api/operations/alerts',
    'https://user:password@127.0.0.1:9/api/operations/alerts']) {
    assert.throws(() => safeEvidenceUrls([{ origin: apiUrl, url }], apiUrl,
      ['private-token']), /R6_EVIDENCE_URL_REJECTED/);
  }
  const screenshotCalls = [];
  const fakeScreen = {
    viewportSize: () => ({ width: 1920, height: 1080 }),
    locator: () => ({ innerText: async () => 'safe dashboard' }),
    screenshot: async (options) => { screenshotCalls.push(options); return Buffer.from('png-buffer'); },
  };
  assert.deepEqual(await captureEvidenceScreen(fakeScreen, ['private-token']), Buffer.from('png-buffer'));
  assert.deepEqual(screenshotCalls, [{ type: 'png', fullPage: false }]);
  fakeScreen.viewportSize = () => ({ width: 1280, height: 720 });
  await assert.rejects(captureEvidenceScreen(fakeScreen, ['private-token']), /R6_EVIDENCE_SCREEN_REJECTED/);
  fakeScreen.viewportSize = () => ({ width: 1920, height: 1080 });
  fakeScreen.locator = () => ({ innerText: async () => 'private-token' });
  await assert.rejects(captureEvidenceScreen(fakeScreen, ['private-token']), /R6_EVIDENCE_SCREEN_REJECTED/);
  const safeRequest = { origin: apiUrl, url: apiUrl + '/api/operations/alerts', body: '',
    headers: { cookie: 'anvil_session=session-sentinel' } };
  const safeResponse = { origin: apiUrl, url: safeRequest.url, body: '',
    headers: { 'set-cookie': 'anvil_session=session-sentinel' } };
  assert.deepEqual(auditTraffic([safeRequest], [safeResponse], '', 'session-sentinel'), {
    allAppRequestsSameOrigin: true, offOriginCredentialLeak: false, secretExposure: false,
  });
  assert.equal(auditTraffic([{ ...safeRequest, body: 'session-sentinel' }],
    [safeResponse], '', 'session-sentinel').secretExposure, true);
  assert.equal(auditTraffic([{ ...safeRequest, origin: 'https://outside.invalid',
    url: 'https://outside.invalid/', headers: { cookie: 'anvil_session=session-sentinel' } }],
    [safeResponse], '', 'session-sentinel').offOriginCredentialLeak, true);
  const unreadableResponse = (status) => ({
    status: () => status, url: () => apiUrl + '/unreadable',
    allHeaders: async () => ({}),
    text: async () => { throw new Error('private-response-content'); },
  });
  const pendingResponse = captureResponseFact(unreadableResponse(200));
  const pendingRequest = captureRequestFact({
    url: () => apiUrl + '/unreadable', postData: () => '',
    allHeaders: async () => { throw new Error('private-request-content'); },
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  const failedResponse = await pendingResponse;
  const failedRequest = await pendingRequest;
  assert.equal(failedResponse.ok, false);
  assert.equal(failedRequest.ok, false);
  assert.throws(() => verifiedFacts([failedResponse]), /R6_NETWORK_CAPTURE_UNREADABLE/);
  assert.throws(() => verifiedFacts([failedRequest]), /R6_NETWORK_CAPTURE_UNREADABLE/);
  for (const status of [204, 301, 302, 303, 304, 307, 308]) {
    const result = await captureResponseFact(unreadableResponse(status));
    assert.equal(result.ok, true);
    assert.equal(result.value.body, '');
  }
  const navigationSteps = [];
  const phaseWaiters = [];
  const phaseCaptures = new WeakMap();
  const captureResolutions = [];
  const phasePaths = ['/api/health/ready', '/api/providers', '/api/operations/alerts',
    '/api/dashboard/operations'];
  let nativeReads = 0;
  let phaseFailureMode = 'CAPTURE_TIMEOUT';
  function releasePhaseResponses(mode = 'NONE') {
    assert.equal(phaseWaiters.length, 4);
    for (const path of phasePaths) {
      const response = { url: () => apiUrl + path, status: () => 401,
        headers: () => ({ 'content-length': '29' }), finished: async () => null };
      const matching = phaseWaiters.filter(({ predicate }) => predicate(response));
      assert.equal(matching.length, 1);
      if (path === '/api/providers' && mode === 'WAIT_TIMEOUT') {
        matching[0].reject(Object.assign(new Error('private-url'), { name: 'TimeoutError' }));
        continue;
      }
      if (path === '/api/providers' && mode === 'CAPTURE_MISSING') {
        matching[0].resolve(response);
        continue;
      }
      let release;
      phaseCaptures.set(response, new Promise((resolve) => { release = resolve; }));
      captureResolutions.push({ release, path, mode });
      matching[0].resolve(response);
    }
    phaseWaiters.length = 0;
  }
  const fakeCard = { waitFor: async ({ state }) => {
    assert.equal(state, 'visible');
    navigationSteps.push('card');
  } };
  const fakePage = {
    evaluate: async (_script, { path }) => {
      assert.equal(path, '/api/providers');
      nativeReads += 1;
      return { status: 401, text: '{"error":"private-not-printed"}' };
    },
    waitForResponse: (predicate, { timeout }) => {
      assert.equal(timeout, 10000);
      return new Promise((resolve, reject) => phaseWaiters.push({ predicate, resolve, reject }));
    },
    goto: async (url, { waitUntil }) => {
      assert.equal(url, apiUrl + '/');
      assert.equal(waitUntil, 'domcontentloaded');
      navigationSteps.push('document');
      releasePhaseResponses();
    },
    reload: async ({ waitUntil }) => {
      assert.equal(waitUntil, 'domcontentloaded');
      navigationSteps.push('reload');
      releasePhaseResponses(phaseFailureMode);
    },
    locator: (selector) => {
      assert.equal(selector, 'section[aria-labelledby="critical-alerts-heading"]');
      return fakeCard;
    },
  };
  let readySettled = false;
  const initialReady = readyDashboard(fakePage, 'goto', apiUrl, 'PRE_AUTH', phaseCaptures)
    .then((value) => { readySettled = true; return value; });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(readySettled, false);
  for (const { release } of captureResolutions.splice(0)) release({ ok: true, value: {} });
  assert.deepEqual(await initialReady, { card: fakeCard, beforeEvidence: {} });
  assert.deepEqual(navigationSteps, ['document', 'card']);
  navigationSteps.length = 0;
  const revokedReady = readyDashboard(fakePage, 'reload', apiUrl, 'REVOKE', phaseCaptures);
  await new Promise((resolve) => setTimeout(resolve, 0));
  for (const { release, path, mode } of captureResolutions.splice(0)) {
    release(path === '/api/providers' && mode === 'CAPTURE_TIMEOUT'
      ? { ok: false, category: 'PROVIDER_API', status: 401, reason: 'TIMEOUT' }
      : { ok: true, value: {} });
  }
  await assert.rejects(revokedReady, /R6_RESPONSE_CAPTURE_FAILED/);
  assert.equal(nativeReads, 1);
  assert.deepEqual(navigationSteps, ['reload', 'card']);
  for (const mode of ['WAIT_TIMEOUT', 'CAPTURE_MISSING']) {
    phaseFailureMode = mode;
    const phaseReady = readyDashboard(fakePage, 'reload', apiUrl, 'STORED', phaseCaptures);
    const phaseFailure = assert.rejects(phaseReady, /R6_PHASE_RESPONSE_FAILED/);
    await new Promise((resolve) => setTimeout(resolve, 0));
    for (const { release } of captureResolutions.splice(0)) release({ ok: true, value: {} });
    await phaseFailure;
  }
  markStage('PRE_AUTH_DOCUMENT');
  assert.equal(stage, 'PRE_AUTH_DOCUMENT');
  assert.throws(() => markStage('PRIVATE_SECRET'), /R6_STAGE_INVALID/);
  const hangingResponse = (status, path) => ({
    status: () => status, url: () => apiUrl + path,
    allHeaders: async () => ({ 'content-type': 'application/json' }),
    text: () => new Promise(() => {}),
  });
  const bounded = await Promise.race([
    captureResponseFact(hangingResponse(200, '/api/operations/alerts?opaque=private'), 60),
    new Promise((_, reject) => setTimeout(() => reject(new Error('R6_SELF_TEST_CAPTURE_TIMEOUT')), 500)),
  ]);
  assert.equal(bounded.ok, false);
  assert.equal(bounded.category, 'ALERT_API');
  assert.equal(bounded.status, 200);
  assert.equal(bounded.reason, 'TIMEOUT');
  assert.throws(() => verifiedResponseFacts([bounded]), /R6_RESPONSE_CAPTURE_FAILED/);
  const probe = await probeResponseTransport({
    headers: () => ({ 'content-length': '29', 'transfer-encoding': 'chunked' }),
    finished: async () => null,
  }, async () => ({ status: 401, text: '{"error":"private-not-printed"}' }), 60);
  assert.deepEqual(probe, {
    length: 'POSITIVE', transfer: 'CHUNKED', finished: 'DONE', native: 'READABLE_401',
  });
  const stalledProbe = await probeResponseTransport({
    headers: () => ({}), finished: () => new Promise(() => {}),
  }, () => new Promise(() => {}), 60);
  assert.deepEqual(stalledProbe, {
    length: 'MISSING', transfer: 'MISSING', finished: 'TIMEOUT', native: 'TIMEOUT',
  });
  for (const status of [204, 302, 304]) {
    const accepted = await captureResponseFact(hangingResponse(status, '/auth/oidc/callback'), 60);
    assert.equal(accepted.ok, true);
    assert.equal(accepted.value.body, '');
  }
  const installCalls = [];
  const diagnosticEvents = [];
  const installPage = {
    exposeFunction: async (name, callback) => installCalls.push({ name, callback }),
    addInitScript: async (bootstrap, timeoutMs) => installCalls.push({ bootstrap, timeoutMs }),
  };
  await configureDiagnosticDrain(installPage, false, diagnosticEvents);
  assert.deepEqual(installCalls, []);
  await configureDiagnosticDrain(installPage, true, diagnosticEvents);
  assert.equal(installCalls.length, 2);
  assert.equal(installCalls[0].name, '__anvilR6DrainEvent');
  assert.equal(installCalls[1].timeoutMs, 2000);
  const previousWindow = globalThis.window;
  try {
    let cloneReads = 0;
    const nonOk = { ok: false, status: 401, url: apiUrl + '/api/providers',
      clone: () => ({ text: async () => { cloneReads += 1; return 'private-body-not-output'; } }) };
    globalThis.window = { location: { origin: apiUrl, href: apiUrl + '/' },
      fetch: async () => nonOk,
      __anvilR6DrainEvent: async (event) => installCalls[0].callback(event) };
    installCalls[1].bootstrap(60);
    assert.equal(await globalThis.window.fetch('/api/providers'), nonOk);
    assert.equal(cloneReads, 1);
    assert.deepEqual(diagnosticEvents, [
      { category: 'PROVIDER_API', status: 401, outcome: 'DONE' },
    ]);
    assert.equal(JSON.stringify(diagnosticEvents).includes('private-body-not-output'), false);
    const offOrigin = { ...nonOk, url: 'https://outside.invalid/api/providers',
      clone: () => { throw new Error('off-origin-clone-must-not-run'); } };
    globalThis.window.fetch = async () => offOrigin;
    installCalls[1].bootstrap(60);
    assert.equal(await globalThis.window.fetch('https://outside.invalid/api/providers'), offOrigin);
    assert.equal(diagnosticEvents.length, 1);
    globalThis.window.fetch = async () => ({ ...nonOk,
      clone: () => ({ text: () => new Promise(() => {}) }) });
    installCalls[1].bootstrap(60);
    await globalThis.window.fetch('/api/providers');
    assert.deepEqual(diagnosticEvents[1],
      { category: 'PROVIDER_API', status: 401, outcome: 'TIMEOUT' });
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
  if (process.env.ANVIL_F20_R6_SELFTEST_EVIDENCE_DIR) {
    const png = Buffer.concat([Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex'),
      Buffer.from('0000078000000438', 'hex')]);
    const directory = process.env.ANVIL_F20_R6_SELFTEST_EVIDENCE_DIR;
    publishEvidence(directory, { preAuth: png, stored: png, revoked: png },
      safeEvidenceUrls(evidenceRequests, apiUrl, ['private-token']));
    assert.throws(() => publishEvidence(directory, { preAuth: png, stored: png, revoked: png },
      [apiUrl + '/']), /R6_EVIDENCE_DIR_REJECTED/);
  }
  console.log('R6_AUDIT_SELF_TEST_PASS');
} else {
  writeSync(1, 'R6_NODE_STARTED\n');
  main().catch((error) => {
    console.error('R6_BROWSER_FAILED stage=' + stage + ' class=' + error.name);
    process.exitCode = 1;
  });
}
