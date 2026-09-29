#!/usr/bin/env node
// Single Chromium context against the Python-owned HTTPS OIDC/PG15 host.
import assert from 'node:assert/strict';
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
    () => ({ ok: false }),
  );
}

function captureRequestFact(request) {
  return settleCapture(async () => ({
    origin: new URL(request.url()).origin, url: request.url(),
    body: request.postData() || '', headers: await request.allHeaders(),
  }));
}

function captureResponseFact(response) {
  return settleCapture(async () => {
    const headers = await response.allHeaders();
    let body;
    try {
      body = await response.text();
    } catch {
      if (![204, 301, 302, 303, 304, 307, 308].includes(response.status())) {
        throw new Error('R6_RESPONSE_BODY_UNAVAILABLE');
      }
      body = '';
    }
    return { origin: new URL(response.url()).origin, url: response.url(), headers, body };
  });
}

function verifiedFacts(results) {
  assert.ok(results.length > 0 && results.every(({ ok }) => ok), 'R6_NETWORK_CAPTURE_UNREADABLE');
  return results.map(({ value }) => value);
}

async function fetchOnPage(page, path, options = {}) {
  return page.evaluate(async ({ path, options }) => {
    const response = await fetch(path, { credentials: 'same-origin', ...options });
    const text = await response.text();
    return { status: response.status, text };
  }, { path, options });
}

async function main() {
  sensitiveValues = JSON.parse(process.env.ANVIL_F20_R6_SECRET_VALUES_JSON || '[]');
  assert.equal(new URL(apiUrl).hostname, '127.0.0.1');
  assert.equal(new URL(issuerUrl).hostname, '127.0.0.1');
  assert.equal(alertCode, 'WORKER_LEASE_EXPIRED');
  assert.ok(controlToken?.length >= 32);
  assert.ok(expectedEntity && expectedCause && Array.isArray(sensitiveValues));
  const { chromium, request: playwrightRequest } = require(process.env.ANVIL_PLAYWRIGHT_MODULE || 'playwright');
  stage = 'BROWSER_LAUNCH';
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1920, height: 1080 } });
    const issuerClient = await playwrightRequest.newContext({ ignoreHTTPSErrors: true });
    try {
    const page = await context.newPage();
    const requestFacts = [];
    const responseFacts = [];
    page.on('request', (request) => {
      requestFacts.push(captureRequestFact(request));
    });
    page.on('response', (response) => {
      responseFacts.push(captureResponseFact(response));
    });
    stage = 'PRE_AUTH';
    await page.goto(apiUrl + '/', { waitUntil: 'networkidle' });
    const card = page.locator('section[aria-labelledby="critical-alerts-heading"]');
    const preAuth = await fetchOnPage(page, '/api/operations/alerts');
    assert.equal(preAuth.status, 401);
    assert.equal(await card.getByText(alertCode, { exact: true }).count(), 0);

    stage = 'OIDC_AUTH';
    const authorization = await fetchOnPage(page, '/auth/oidc/authorization', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    });
    assert.equal(authorization.status, 200);
    const authPayload = JSON.parse(authorization.text).data;
    assert.equal(new URL(authPayload.authorization_url).origin, new URL(issuerUrl).origin);
    const redirect = await issuerClient.get(authPayload.authorization_url, { maxRedirects: 0 });
    assert.equal(redirect.status(), 302);
    const callbackLocation = new URL(redirect.headers().location);
    assert.equal(callbackLocation.origin, apiUrl);
    assert.equal(callbackLocation.pathname, '/auth/oidc/callback');
    assert.equal(callbackLocation.searchParams.get('state'), authPayload.browser_state);
    const callback = await fetchOnPage(page, '/auth/oidc/callback', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: callbackLocation.searchParams.get('code'),
        state: authPayload.browser_state, browser_state: authPayload.browser_state }),
    });
    assert.equal(callback.status, 200);
    const session = await fetchOnPage(page, '/auth/session/status');
    assert.equal(session.status, 200);
    assert.equal(JSON.parse(session.text).authenticated, true);
    const cookie = (await context.cookies(apiUrl)).find(({ name }) => name === 'anvil_session');
    assert.ok(cookie?.secure && cookie?.httpOnly);

    stage = 'STORED_ALERT';
    const stored = await fetchOnPage(page, '/api/operations/alerts');
    assert.equal(stored.status, 200);
    const alerts = JSON.parse(stored.text).data.alerts;
    assert.deepEqual(alerts.map(({ code }) => code), [alertCode]);
    assert.equal(alerts[0].related_entity_id, expectedEntity);
    assert.equal(alerts[0].cause, expectedCause);
    await page.reload({ waitUntil: 'networkidle' });
    await card.getByText(alertCode, { exact: true }).waitFor();
    const visibleBeforeRevoke = await card.getByText(alertCode, { exact: true }).count() === 1;
    const rowText = await card.locator('li').filter({ hasText: alertCode }).innerText();
    const rowMatches = rowText.includes(expectedEntity) && rowText.includes(expectedCause);
    assert.ok(rowMatches);

    stage = 'REVOKE';
    const released = await issuerClient.post(new URL('/r6-control/revoke', issuerUrl).href, {
      headers: { 'x-r6-control-token': controlToken },
    });
    assert.equal(released.status(), 200);
    const revoked = await fetchOnPage(page, '/api/operations/alerts');
    assert.equal(revoked.status, 403);
    await page.reload({ waitUntil: 'networkidle' });
    await card.getByText('UNAVAILABLE', { exact: true }).waitFor();
    const staleCleared = await card.getByText(alertCode, { exact: true }).count() === 0;
    stage = 'NETWORK_AUDIT';
    const requests = verifiedFacts(await Promise.all(requestFacts));
    const responses = verifiedFacts(await Promise.all(responseFacts));
    const { allAppRequestsSameOrigin, offOriginCredentialLeak, secretExposure } =
      auditTraffic(requests, responses, await page.locator('body').innerText(), cookie.value);
    const idpContextSeparate = (await issuerClient.storageState()).cookies
      .every(({ name }) => name !== 'anvil_session');
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
    } finally {
      await issuerClient.dispose();
    }
  } finally {
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
  console.log('R6_AUDIT_SELF_TEST_PASS');
} else {
  console.log('R6_NODE_STARTED');
  main().catch((error) => {
    console.error('R6_BROWSER_FAILED stage=' + stage + ' class=' + error.name);
    process.exitCode = 1;
  });
}
