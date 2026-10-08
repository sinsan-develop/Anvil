#!/usr/bin/env node
// Isolated Chromium QA: verify a fresh OIDC session observes only its exact pair.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const phase = process.env.ANVIL_F19A_QA_PAIR_PHASE;
const appUrl = process.env.ANVIL_F19A_QA_API_URL;
const issuerUrl = process.env.ANVIL_F19A_QA_ISSUER_URL;
const projectId = process.env.ANVIL_F19A_QA_PROJECT_ID;
const environmentId = process.env.ANVIL_F19A_QA_ENVIRONMENT_ID;
const expectedRole = process.env.ANVIL_F19A_QA_EXPECTED_ROLE;
const readerRole = process.env.ANVIL_F19A_QA_READER_ROLE;

function config() {
  if (!['granted', 'revoked', 'other-actor', 'admin-coarse'].includes(phase)
      || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(projectId || '')
      || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(environmentId || '')
      || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(expectedRole || '')
      || (phase === 'other-actor' && (
        !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(readerRole || '')
        || expectedRole === readerRole))) {
    throw new Error('F19A_QA_BROWSER_CONFIG_INVALID');
  }
  const app = new URL(appUrl);
  const issuer = new URL(issuerUrl);
  if (app.protocol !== 'https:' || issuer.protocol !== 'https:'
      || app.hostname !== 'anvil-f18-qa.local' || issuer.hostname !== 'anvil-f18-qa.local'
      || app.pathname !== '/' || issuer.pathname !== '/realms/anvil') {
    throw new Error('F19A_QA_BROWSER_TARGET_INVALID');
  }
  return { app, issuer };
}

async function sameOriginFetch(page, path, options = {}) {
  assert.ok(path.startsWith('/') && !path.startsWith('//'), 'F19A_QA_ABSOLUTE_API_FORBIDDEN');
  return page.evaluate(async ({ path, options }) => {
    const response = await fetch(path, { credentials: 'same-origin', ...options });
    return { status: response.status, body: await response.text() };
  }, { path, options });
}

async function run() {
  const { app, issuer } = config();
  if (process.argv.includes('--self-test')) {
    assert.equal(new URL('/api/dashboard/project-environments', app).origin, app.origin);
    process.stdout.write('F19A_QA_BROWSER_SELF_TEST_PASS\n');
    return;
  }
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    try {
      const page = await context.newPage();
      const apiRequests = [];
      const unexpectedOrigins = [];
      page.on('request', request => {
        const url = new URL(request.url());
        if (url.pathname.startsWith('/api/')) apiRequests.push(url);
        if (url.origin !== app.origin && url.origin !== issuer.origin) unexpectedOrigins.push(url.origin);
      });
      await page.goto(app.href, { waitUntil: 'domcontentloaded' });
      const before = await sameOriginFetch(page, '/api/dashboard/project-environments');
      assert.equal(before.status, 401, 'F19A_QA_PREAUTH_NOT_401');
      const authorization = await sameOriginFetch(page, '/auth/oidc/authorization', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
      });
      assert.equal(authorization.status, 200, 'F19A_QA_AUTHORIZATION_FAILED');
      const auth = JSON.parse(authorization.body).data;
      assert.equal(new URL(auth.authorization_url).origin, issuer.origin);
      const redirect = await context.request.get(auth.authorization_url, { maxRedirects: 0 });
      assert.equal(redirect.status(), 302, 'F19A_QA_ISSUER_FAILED');
      const location = new URL(redirect.headers().location);
      assert.equal(location.origin, app.origin);
      assert.equal(location.searchParams.get('state'), auth.browser_state);
      const callback = await sameOriginFetch(page, '/auth/oidc/callback', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: location.searchParams.get('code'),
          state: auth.browser_state, browser_state: auth.browser_state }),
      });
      assert.equal(callback.status, 200, 'F19A_QA_CALLBACK_FAILED');
      const session = await sameOriginFetch(page, '/auth/session/status');
      assert.equal(session.status, 200);
      const sessionStatus = JSON.parse(session.body);
      assert.equal(sessionStatus.authenticated, true);
      assert.equal(sessionStatus.actor_role, expectedRole, 'F19A_QA_ACTOR_ROLE_MISMATCH');
      const list = await sameOriginFetch(page, '/api/dashboard/project-environments');
      if (phase === 'admin-coarse') {
        assert.equal(list.status, 403, 'F19A_QA_ADMIN_NOT_COARSE_DENIED');
        const envelope = JSON.parse(list.body);
        assert.deepEqual(Object.keys(envelope), ['error']);
        assert.deepEqual(Object.keys(envelope.error).sort(), ['code', 'message', 'request_id']);
        assert.equal(envelope.error.code, 'AUTHORIZATION_SCOPE_MISMATCH');
        assert.equal(typeof envelope.error.message, 'string');
        assert.ok(envelope.error.message.length > 0);
        assert.equal(typeof envelope.error.request_id, 'string');
        assert.ok(envelope.error.request_id.length > 0);
      } else {
        assert.equal(list.status, 200, 'F19A_QA_PAIR_LIST_FAILED');
        const items = JSON.parse(list.body).items;
        assert.ok(Array.isArray(items));
        if (phase === 'granted') {
          assert.equal(items.length, 1, 'F19A_QA_CROSS_PAIR_EXPOSED');
          assert.equal(items[0].projectId, projectId);
          assert.equal(items[0].environmentId, environmentId);
        } else {
          assert.deepEqual(items, [], 'F19A_QA_REVOKED_OR_OTHER_PAIR_EXPOSED');
        }
      }
      assert.ok(apiRequests.length >= 2);
      assert.ok(apiRequests.every(url => url.origin === app.origin), 'F19A_QA_CROSS_ORIGIN_API');
      assert.deepEqual(unexpectedOrigins, [], 'F19A_QA_UNEXPECTED_BROWSER_ORIGIN');
      process.stdout.write(`F19A_QA_BROWSER_${phase.toUpperCase().replace('-', '_')}_PASS\n`);
    } finally {
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

run().catch(error => {
  const code = /^F19A_QA_[A-Z_]+$/.test(error?.message) ? error.message : 'F19A_QA_BROWSER_FAILED';
  process.stderr.write(`${code}\n`);
  process.exitCode = 1;
});
