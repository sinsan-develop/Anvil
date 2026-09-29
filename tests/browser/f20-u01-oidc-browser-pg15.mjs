#!/usr/bin/env node
// Single Chromium context against the Python-owned HTTPS OIDC/PG15 host.
import assert from 'node:assert/strict';
import { writeSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const auditSelfTest = process.argv.includes('--audit-self-test');
const apiUrl = process.env.ANVIL_F20_R6_API_URL || (auditSelfTest ? 'https://127.0.0.1:9' : undefined);
const issuerUrl = process.env.ANVIL_F20_R6_ISSUER_URL;
const alertCode = process.env.ANVIL_F20_R6_ALERT_CODE;
const controlToken = process.env.ANVIL_F20_R6_CONTROL_TOKEN;
const expectedEntity = process.env.ANVIL_F20_R6_ALERT_ENTITY;
const expectedCause = process.env.ANVIL_F20_R6_ALERT_CAUSE;
let sensitiveValues = [];
let stage = 'BOOTSTRAP';
const progressStages = new Set([
  'BOOTSTRAP', 'PLAYWRIGHT_REQUIRE', 'BROWSER_LAUNCH', 'BROWSER_CONTEXT',
  'ISSUER_CONTEXT', 'PAGE_CREATE', 'PRE_AUTH_DOCUMENT', 'PRE_AUTH_CARD',
  'PRE_AUTH_RESPONSES',
  'PRE_AUTH_FETCH', 'PRE_AUTH_CARD_CHECK', 'OIDC_AUTH_REQUEST',
  'OIDC_ISSUER_REDIRECT', 'OIDC_CALLBACK', 'OIDC_SESSION', 'OIDC_COOKIE',
  'STORED_ALERT_FETCH', 'STORED_DOCUMENT', 'STORED_CARD', 'STORED_RESPONSES',
  'STORED_ALERT_WAIT',
  'STORED_ROW', 'REVOKE_CONTROL', 'REVOKE_FETCH', 'REVOKE_DOCUMENT',
  'REVOKE_CARD', 'REVOKE_RESPONSES', 'REVOKE_CLEAR', 'NETWORK_REQUEST_FACTS',
  'NETWORK_RESPONSE_FACTS', 'NETWORK_DOM', 'NETWORK_IDP_STATE',
  'NETWORK_ASSERT', 'ISSUER_DISPOSE', 'BROWSER_CLOSE',
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

async function fetchOnPage(page, path, options = {}) {
  return page.evaluate(async ({ path, options }) => {
    const response = await fetch(path, { credentials: 'same-origin', ...options });
    const text = await response.text();
    return { status: response.status, text };
  }, { path, options });
}

async function readyDashboard(page, action, origin, phase, responseCaptures) {
  const categories = ['HEALTH_API', 'PROVIDER_API', 'ALERT_API'];
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
  if (action === 'goto') {
    await page.goto(origin + '/', { waitUntil: 'domcontentloaded' });
  } else if (action === 'reload') {
    await page.reload({ waitUntil: 'domcontentloaded' });
  } else {
    throw new Error('R6_NAVIGATION_ACTION_INVALID');
  }
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
  verifiedResponseFacts(await Promise.all(captures));
  return card;
}

async function main() {
  markStage('BOOTSTRAP');
  sensitiveValues = JSON.parse(process.env.ANVIL_F20_R6_SECRET_VALUES_JSON || '[]');
  assert.equal(new URL(apiUrl).hostname, '127.0.0.1');
  assert.equal(new URL(issuerUrl).hostname, '127.0.0.1');
  assert.equal(alertCode, 'WORKER_LEASE_EXPIRED');
  assert.ok(controlToken?.length >= 32);
  assert.ok(expectedEntity && expectedCause && Array.isArray(sensitiveValues));
  markStage('PLAYWRIGHT_REQUIRE');
  const { chromium, request: playwrightRequest } = require(process.env.ANVIL_PLAYWRIGHT_MODULE || 'playwright');
  markStage('BROWSER_LAUNCH');
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  let flowComplete = false;
  try {
    markStage('BROWSER_CONTEXT');
    const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1920, height: 1080 } });
    markStage('ISSUER_CONTEXT');
    const issuerClient = await playwrightRequest.newContext({ ignoreHTTPSErrors: true });
    try {
    markStage('PAGE_CREATE');
    const page = await context.newPage();
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
    const card = await readyDashboard(page, 'goto', apiUrl, 'PRE_AUTH', responseCaptures);
    markStage('PRE_AUTH_FETCH');
    const preAuth = await fetchOnPage(page, '/api/operations/alerts');
    assert.equal(preAuth.status, 401);
    markStage('PRE_AUTH_CARD_CHECK');
    assert.equal(await card.getByText(alertCode, { exact: true }).count(), 0);

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

    markStage('STORED_ALERT_FETCH');
    const stored = await fetchOnPage(page, '/api/operations/alerts');
    assert.equal(stored.status, 200);
    const alerts = JSON.parse(stored.text).data.alerts;
    assert.deepEqual(alerts.map(({ code }) => code), [alertCode]);
    assert.equal(alerts[0].related_entity_id, expectedEntity);
    assert.equal(alerts[0].cause, expectedCause);
    await readyDashboard(page, 'reload', apiUrl, 'STORED', responseCaptures);
    markStage('STORED_ALERT_WAIT');
    await card.getByText(alertCode, { exact: true }).waitFor();
    const visibleBeforeRevoke = await card.getByText(alertCode, { exact: true }).count() === 1;
    markStage('STORED_ROW');
    const rowText = await card.locator('li').filter({ hasText: alertCode }).innerText();
    const rowMatches = rowText.includes(expectedEntity) && rowText.includes(expectedCause);
    assert.ok(rowMatches);

    markStage('REVOKE_CONTROL');
    const released = await issuerClient.post(new URL('/r6-control/revoke', issuerUrl).href, {
      headers: { 'x-r6-control-token': controlToken },
    });
    assert.equal(released.status(), 200);
    markStage('REVOKE_FETCH');
    const revoked = await fetchOnPage(page, '/api/operations/alerts');
    assert.equal(revoked.status, 403);
    await readyDashboard(page, 'reload', apiUrl, 'REVOKE', responseCaptures);
    markStage('REVOKE_CLEAR');
    await card.getByText('UNAVAILABLE', { exact: true }).waitFor();
    const staleCleared = await card.getByText(alertCode, { exact: true }).count() === 0;
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
    console.log('R6_RESULT ' + JSON.stringify({
      preAuthStatus: preAuth.status, authorizationStatus: authorization.status,
      callbackStatus: callback.status, sessionAuthenticated: true,
      cookieSecure: cookie.secure, cookieHttpOnly: cookie.httpOnly,
      storedStatus: stored.status, storedAlertCode: alerts[0].code,
      storedEntity: alerts[0].related_entity_id, storedCause: alerts[0].cause, rowMatches,
      visibleBeforeRevoke, revokedStatus: revoked.status, staleCleared,
      allAppRequestsSameOrigin, idpContextSeparate, offOriginCredentialLeak, secretExposure,
      pageRequestCount: requests.length, appApiRequestCount,
    }));
    flowComplete = true;
    } finally {
      if (flowComplete) markStage('ISSUER_DISPOSE');
      await issuerClient.dispose();
    }
  } finally {
    if (flowComplete) markStage('BROWSER_CLOSE');
    await browser.close();
  }
}

if (auditSelfTest) {
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
  const phasePaths = ['/api/health/ready', '/api/providers', '/api/operations/alerts'];
  let phaseFailureMode = 'CAPTURE_TIMEOUT';
  function releasePhaseResponses(mode = 'NONE') {
    assert.equal(phaseWaiters.length, 3);
    for (const path of phasePaths) {
      const response = { url: () => apiUrl + path, status: () => 401 };
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
  assert.equal(await initialReady, fakeCard);
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
  for (const status of [204, 302, 304]) {
    const accepted = await captureResponseFact(hangingResponse(status, '/auth/oidc/callback'), 60);
    assert.equal(accepted.ok, true);
    assert.equal(accepted.value.body, '');
  }
  console.log('R6_AUDIT_SELF_TEST_PASS');
} else {
  writeSync(1, 'R6_NODE_STARTED\n');
  main().catch((error) => {
    console.error('R6_BROWSER_FAILED stage=' + stage + ' class=' + error.name);
    process.exitCode = 1;
  });
}
