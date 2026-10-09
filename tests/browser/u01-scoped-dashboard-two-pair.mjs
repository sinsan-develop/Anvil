#!/usr/bin/env node
// Isolated U-01 two-pair HTTPS/OIDC/Chromium QA. No product mutations.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {existsSync, lstatSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';

const require = createRequire(import.meta.url);

const periodDays = Object.freeze({'1d': 1, '7d': 7, '30d': 30});
const diagnosticStages = new Set(['START', 'CONFIG', 'BROWSER', 'PREAUTH', 'OIDC',
  'SESSION', 'PAIRS', 'API', 'UI', 'STALE', 'STALE_TRIGGER', 'STALE_REQUEST',
  'STALE_LOADING', 'STALE_SWITCH', 'STALE_SETTLED', 'STALE_VERIFY', 'FAULT',
  'FAULT_TRIGGER', 'FAULT_REQUEST', 'FAULT_ALERT', 'FAULT_RETRY', 'FAULT_RECOVERED',
  'EVIDENCE']);
const diagnosticClasses = new Set(['AssertionError', 'Error', 'TimeoutError', 'TypeError']);
const diagnosticCodes = new Set([
  'U01_QA_ABSOLUTE_API_FORBIDDEN', 'U01_QA_ACTOR_MISMATCH',
  'U01_QA_API_BODY_INVALID', 'U01_QA_API_ERROR_MISMATCH', 'U01_QA_API_STATUS_MISMATCH',
  'U01_QA_BROWSER_CONFIG_REJECTED', 'U01_QA_BROWSER_FAILED',
  'U01_QA_BROWSER_TARGET_REJECTED', 'U01_QA_CALLBACK_ORIGIN_MISMATCH',
  'U01_QA_CURRENT_DB_COUNT_MISMATCH', 'U01_QA_EVIDENCE_DIR_REJECTED',
  'U01_QA_EVIDENCE_EXISTS', 'U01_QA_FONT_SIZE_MISMATCH', 'U01_QA_ISSUER_FAILED',
  'U01_QA_ISSUER_MISMATCH', 'U01_QA_KEYBOARD_NAVIGATION_FAILED',
  'U01_QA_NETWORK_MISSING', 'U01_QA_PAIR_CONFIG_REJECTED',
  'U01_QA_PAIR_LIST_MISMATCH', 'U01_QA_PERIOD_DB_COUNT_MISMATCH',
  'U01_QA_PERIOD_REJECTED', 'U01_QA_SCOPED_DATA_INVALID', 'U01_QA_SECRET_VISIBLE',
  'U01_QA_SESSION_MISSING', 'U01_QA_STALE_PAIR_RESTORED',
  'U01_QA_STALE_PERIOD_RESTORED', 'U01_QA_STALE_REQUEST_NOT_OBSERVED',
  'U01_QA_UI_FAULT_NOT_EXERCISED', 'U01_QA_UI_PERIOD_MISMATCH',
  'U01_QA_UNEXPECTED_BROWSER_ORIGIN',
]);
let lastStage = 'START';

function markStage(stage) {
  assert.ok(diagnosticStages.has(stage));
  lastStage = stage;
  process.stdout.write(`U01_QA_STAGE_${stage}\n`);
}

function safeFailure(error, stage) {
  const safeStage = diagnosticStages.has(stage) ? stage : 'START';
  const safeClass = diagnosticClasses.has(error?.name) ? error.name : 'Error';
  const safeCode = diagnosticCodes.has(error?.message) ? error.message : 'U01_QA_BROWSER_FAILED';
  return `U01_QA_FAILURE stage=${safeStage} class=${safeClass} code=${safeCode}`;
}

function expectedPairs(phase, pairs) {
  assert.ok(['granted', 'revoked', 'restored', 'other'].includes(phase)
    && Array.isArray(pairs) && pairs.length === 2 && pairs[0] !== pairs[1],
  'U01_QA_PAIR_CONFIG_REJECTED');
  return phase === 'other' ? [] : phase === 'revoked' ? [pairs[1]] : pairs;
}

function periodBounds(observedAt, period) {
  assert.ok(Object.hasOwn(periodDays, period) && Number.isFinite(Date.parse(observedAt)),
    'U01_QA_PERIOD_REJECTED');
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(observedAt)).map(part => [part.type, part.value]));
  const midnightUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day))
    - 9 * 60 * 60 * 1000;
  return {startUtc: new Date(midnightUtc - (periodDays[period] - 1) * 86400000).toISOString(),
    endUtc: new Date(midnightUtc + 86400000).toISOString()};
}

function validateScoped(data, pair, period) {
  try {
    assert.ok(data && typeof data === 'object' && data.pair && data.period
      && data.current && data.occurrences && data.sourceCompleteness);
    for (const field of ['projectId', 'environmentId', 'projectName', 'environmentName']) {
      assert.equal(data.pair[field], pair[field]);
    }
    assert.equal(data.period.key, period);
    assert.equal(data.period.timeZone, 'Asia/Seoul');
    assert.ok(Number.isFinite(Date.parse(data.period.observedAt)));
    const expected = periodBounds(data.period.observedAt, period);
    assert.equal(Date.parse(data.period.startUtc), Date.parse(expected.startUtc));
    assert.equal(Date.parse(data.period.endUtc), Date.parse(expected.endUtc));
    assert.ok(Date.parse(data.period.startUtc) <= Date.parse(data.period.observedAt)
      && Date.parse(data.period.observedAt) < Date.parse(data.period.endUtc)
      && Date.parse(data.period.observedAt) <= Date.now() + 5000);
    const scope = {projectId: pair.projectId, environmentId: pair.environmentId};
    const auditEvidence = (entry) => entry?.complete === true
      && entry.source === 'operations_audit_events' && entry.eventTimeBasis === 'DETECTED.at'
      && entry.pair?.projectId === scope.projectId && entry.pair?.environmentId === scope.environmentId
      && Date.parse(entry.observedAt) === Date.parse(data.period.observedAt);
    assert.ok(auditEvidence(data.sourceCompleteness.current.unresolvedCritical));
    assert.ok(auditEvidence(data.sourceCompleteness.current.nextActions));
    assert.ok(auditEvidence(data.sourceCompleteness.occurrences.criticalDetected));
    const detected = data.occurrences.criticalDetected;
    assert.ok(detected.status === 'AVAILABLE' && Number.isInteger(detected.count)
      && detected.count >= 0 && detected.source === 'operations_audit_events'
      && Date.parse(detected.observedAt) === Date.parse(data.period.observedAt));
    for (const name of ['runStarted', 'gateFailed', 'costExceeded', 'baselineConflict']) {
      const metric = data.occurrences[name];
      assert.ok(metric.status === 'UNAVAILABLE' && metric.count === null
        && metric.reason === 'SOURCE_UNAVAILABLE'
        && data.sourceCompleteness.occurrences[name]?.complete === false);
    }
    for (const name of ['database', 'queue', 'worker', 'provider', 'backend', 'artifact_store']) {
      assert.ok(data.current.health?.[name]?.status === 'UNAVAILABLE'
        && data.current.health[name].reason === 'SOURCE_UNAVAILABLE');
    }
    for (const name of ['run', 'queue', 'agent']) {
      const metric = data.current[name];
      const proof = data.sourceCompleteness.current[name];
      assert.ok(metric && proof && proof.pair?.projectId === scope.projectId
        && proof.pair?.environmentId === scope.environmentId);
      if (metric.status === 'AVAILABLE') {
        assert.ok(metric.source === `scoped_${name}_owner` && proof.source === metric.source
          && proof.complete === true && proof.eventTimeBasis === 'CURRENT_OBSERVATION'
          && Number.isFinite(Date.parse(metric.observedAt))
          && Date.parse(proof.observedAt) === Date.parse(metric.observedAt)
          && Array.isArray(metric.items) && metric.count === metric.items.length);
      } else {
        assert.ok(metric.status === 'UNAVAILABLE' && metric.count === null
          && metric.reason === 'SOURCE_UNAVAILABLE' && proof.complete === false);
      }
    }
    assert.ok(Array.isArray(data.current.unresolvedCritical)
      && Array.isArray(data.current.nextActions));
    for (const alert of data.current.unresolvedCritical) {
      assert.ok(typeof alert.alertId === 'string' && alert.alertId
        && alert.level === 'critical' && ['open', 'acknowledged'].includes(alert.status)
        && typeof alert.nextAction === 'string' && alert.nextAction
        && Number.isFinite(Date.parse(alert.observedAt)));
      assert.ok(data.current.nextActions.some(action => action.alertId === alert.alertId
        && action.action === alert.nextAction));
    }
    return true;
  } catch {
    return false;
  }
}

function validateConfig(options) {
  const id = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;
  const pairs = [options.pairA, options.pairB];
  if (!['granted', 'revoked', 'restored', 'other'].includes(options.phase)
      || pairs.some(pair => !pair || ['projectId', 'environmentId', 'projectName', 'environmentName']
        .some(field => typeof pair[field] !== 'string' || !pair[field]))
      || pairs.some(pair => !id.test(pair.projectId) || !id.test(pair.environmentId))
      || pairs[0].projectId === pairs[1].projectId
      || pairs[0].environmentId === pairs[1].environmentId
      || !id.test(options.expectedRole || '')
      || (options.phase === 'other' && (!id.test(options.readerRole || '')
        || options.readerRole === options.expectedRole))) {
    throw new Error('U01_QA_BROWSER_CONFIG_REJECTED');
  }
  let app;
  let issuer;
  try {
    app = new URL(options.appUrl);
    issuer = new URL(options.issuerUrl);
  } catch {
    throw new Error('U01_QA_BROWSER_TARGET_REJECTED');
  }
  if (app.protocol !== 'https:' || issuer.protocol !== 'https:'
      || app.hostname !== 'anvil-f18-qa.local' || issuer.hostname !== app.hostname
      || app.origin !== issuer.origin
      || app.pathname !== '/' || issuer.pathname !== '/realms/anvil'
      || app.username || app.password || issuer.username || issuer.password
      || app.search || issuer.search || app.hash || issuer.hash) {
    throw new Error('U01_QA_BROWSER_TARGET_REJECTED');
  }
  return {...options, app, issuer};
}

if (process.argv.includes('--self-test')) {
  assert.deepEqual(expectedPairs('granted', ['A', 'B']), ['A', 'B']);
  assert.deepEqual(expectedPairs('revoked', ['A', 'B']), ['B']);
  assert.equal(periodBounds('2026-03-01T00:00:00.000Z', '1d').startUtc,
    '2026-02-28T15:00:00.000Z');
  assert.equal(periodBounds('2024-03-01T00:00:00.000Z', '7d').startUtc,
    '2024-02-23T15:00:00.000Z');
  const pair = {projectId: 'project-a', environmentId: 'environment-a',
    projectName: 'Project A', environmentName: 'Environment A'};
  const observedAt = '2026-03-01T00:00:00.000Z';
  const scope = {projectId: pair.projectId, environmentId: pair.environmentId};
  const evidence = {complete: true, source: 'operations_audit_events', pair: scope,
    eventTimeBasis: 'DETECTED.at', observedAt, reason: null};
  const unavailableOwner = {status: 'UNAVAILABLE', count: null,
    source: 'NO_VERIFIED_CURRENT_SOURCE', observedAt: null, reason: 'SOURCE_UNAVAILABLE'};
  const unavailableProof = {complete: false, source: 'NO_VERIFIED_CURRENT_SOURCE', pair: scope,
    eventTimeBasis: null, observedAt: null, reason: 'SOURCE_UNAVAILABLE'};
  const data = {pair, period: {key: '1d', timeZone: 'Asia/Seoul',
    ...periodBounds(observedAt, '1d'), observedAt},
  current: {unresolvedCritical: [], nextActions: [],
    run: unavailableOwner, queue: unavailableOwner, agent: unavailableOwner,
    health: Object.fromEntries(['database', 'queue', 'worker', 'provider', 'backend',
      'artifact_store'].map(name => [name, {status: 'UNAVAILABLE', reason: 'SOURCE_UNAVAILABLE'}]))},
  occurrences: {criticalDetected: {status: 'AVAILABLE', count: 0,
    source: 'operations_audit_events', observedAt, reason: null},
    ...Object.fromEntries(['runStarted', 'gateFailed', 'costExceeded', 'baselineConflict']
      .map(name => [name, {status: 'UNAVAILABLE', count: null,
        source: 'NO_COMPLETE_PERIOD_SOURCE', observedAt: null, reason: 'SOURCE_UNAVAILABLE'}]))},
  sourceCompleteness: {current: {unresolvedCritical: evidence, nextActions: evidence,
    run: unavailableProof, queue: unavailableProof, agent: unavailableProof},
    occurrences: {criticalDetected: evidence,
      ...Object.fromEntries(['runStarted', 'gateFailed', 'costExceeded', 'baselineConflict']
        .map(name => [name, {...unavailableProof, source: 'NO_COMPLETE_PERIOD_SOURCE'}]))}}};
  assert.equal(validateScoped(data, pair, '1d'), true);
  assert.equal(validateScoped({...data, pair: {...pair, environmentId: 'other'}}, pair, '1d'), false);
  assert.equal(validateScoped({...data, occurrences: {...data.occurrences,
    runStarted: {...data.occurrences.runStarted, count: 0}}}, pair, '1d'), false);
  assert.equal(validateScoped({...data, current: {...data.current, health: {}}}, pair, '1d'), false);
  assert.equal(validateScoped({...data, occurrences: {...data.occurrences,
    criticalDetected: {...data.occurrences.criticalDetected, count: 1}}}, pair, '1d'), true);
  assert.equal(validateScoped({...data, current: {...data.current, run: {status: 'AVAILABLE',
    count: 0, items: [{runId: 'unexpected'}], source: 'scoped_run_owner', observedAt}},
    sourceCompleteness: {...data.sourceCompleteness, current: {...data.sourceCompleteness.current,
      run: {...evidence, source: 'scoped_run_owner', eventTimeBasis: 'CURRENT_OBSERVATION'}}}},
  pair, '1d'), false);
  const options = {phase: 'granted', appUrl: 'https://anvil-f18-qa.local:8444/',
    issuerUrl: 'https://anvil-f18-qa.local:8444/realms/anvil',
    pairA: pair, pairB: {projectId: 'project-b', environmentId: 'environment-b',
      projectName: 'Project B', environmentName: 'Environment B'}, expectedRole: 'qa-reader'};
  assert.equal(validateConfig(options).phase, 'granted');
  assert.throws(() => validateConfig({...options, appUrl: 'http://127.0.0.1:8444/'}),
    /U01_QA_BROWSER_TARGET_REJECTED/);
  assert.throws(() => validateConfig({...options, pairB: {...options.pairB,
    projectId: pair.projectId}}), /U01_QA_BROWSER_CONFIG_REJECTED/);
  assert.throws(() => validateConfig({...options, pairB: {...options.pairB,
    projectId: '../other'}}), /U01_QA_BROWSER_CONFIG_REJECTED/);
  assert.equal(safeFailure(new Error('authorization-code-secret'), 'OIDC'),
    'U01_QA_FAILURE stage=OIDC class=Error code=U01_QA_BROWSER_FAILED');
  assert.equal(safeFailure(Object.assign(new Error('U01_QA_ISSUER_FAILED'),
    {name: 'AssertionError'}), 'OIDC'),
  'U01_QA_FAILURE stage=OIDC class=AssertionError code=U01_QA_ISSUER_FAILED');
  assert.equal(safeFailure(Object.assign(new Error('timeout'), {name: 'TimeoutError'}),
    'STALE_LOADING'),
  'U01_QA_FAILURE stage=STALE_LOADING class=TimeoutError code=U01_QA_BROWSER_FAILED');
  let selectedRole;
  let selectedText;
  scopedLoadingStatus({getByRole: role => {
    selectedRole = role;
    return {filter: options => {
      selectedText = options.hasText;
      return {waitFor: () => undefined};
    }};
  }});
  assert.equal(selectedRole, 'status');
  assert.equal(selectedText, '선택한 조합·기간 조회 중');
  let alertRole;
  let alertText;
  scopedFaultAlert({getByRole: role => {
    alertRole = role;
    return {filter: options => {
      alertText = options.hasText;
      return {waitFor: () => undefined};
    }};
  }});
  assert.equal(alertRole, 'alert');
  assert.equal(alertText, '조합·기간 자료를 확인할 수 없습니다.');
  assert.equal(safeFailure(Object.assign(new Error('timeout'), {name: 'TimeoutError'}),
    'FAULT_ALERT'),
  'U01_QA_FAILURE stage=FAULT_ALERT class=TimeoutError code=U01_QA_BROWSER_FAILED');
  process.stdout.write('U01_TWO_PAIR_SELF_TEST_PASS\n');
} else {
  run().catch(error => {
    process.stderr.write(`${safeFailure(error, lastStage)}\n`);
    process.exitCode = 1;
  });
}

function readConfig() {
  let pairA;
  let pairB;
  try {
    pairA = JSON.parse(process.env.ANVIL_U01_QA_PAIR_A_JSON || 'null');
    pairB = JSON.parse(process.env.ANVIL_U01_QA_PAIR_B_JSON || 'null');
  } catch {
    throw new Error('U01_QA_BROWSER_CONFIG_REJECTED');
  }
  return validateConfig({phase: process.env.ANVIL_U01_QA_PHASE,
    appUrl: process.env.ANVIL_U01_QA_APP_URL,
    issuerUrl: process.env.ANVIL_U01_QA_ISSUER_URL,
    pairA, pairB, expectedRole: process.env.ANVIL_U01_QA_EXPECTED_ROLE,
    readerRole: process.env.ANVIL_U01_QA_READER_ROLE});
}

async function sameOriginFetch(page, path, options = {}) {
  assert.ok(path.startsWith('/') && !path.startsWith('//'), 'U01_QA_ABSOLUTE_API_FORBIDDEN');
  return page.evaluate(async ({path, options}) => {
    const response = await fetch(path, {credentials: 'same-origin', ...options});
    return {status: response.status, body: await response.text()};
  }, {path, options});
}

function checkedEnvelope(response, status, code = null) {
  assert.equal(response.status, status, 'U01_QA_API_STATUS_MISMATCH');
  let body;
  try { body = JSON.parse(response.body); } catch { throw new Error('U01_QA_API_BODY_INVALID'); }
  if (code) {
    assert.equal(body?.error?.code, code, 'U01_QA_API_ERROR_MISMATCH');
    assert.equal(typeof body?.error?.request_id, 'string');
  }
  return body;
}

function scopedPath(pair, period) {
  return `/api/projects/${encodeURIComponent(pair.projectId)}`
    + `/environments/${encodeURIComponent(pair.environmentId)}/dashboard?period=${period}`;
}

function evidenceDirectory() {
  const directory = process.env.ANVIL_U01_QA_EVIDENCE_DIR;
  if (!directory) return null;
  try {
    if (!lstatSync(directory).isDirectory() || lstatSync(directory).isSymbolicLink())
      throw new Error('unsafe');
  } catch {
    throw new Error('U01_QA_EVIDENCE_DIR_REJECTED');
  }
  return directory;
}

function scopedLoadingStatus(page) {
  return page.getByRole('status').filter({hasText: '선택한 조합·기간 조회 중'});
}

function scopedFaultAlert(page) {
  return page.getByRole('alert').filter({hasText: '조합·기간 자료를 확인할 수 없습니다.'});
}

async function run() {
  markStage('CONFIG');
  const config = readConfig();
  const evidenceDir = evidenceDirectory();
  const {chromium} = require('playwright');
  markStage('BROWSER');
  const browser = await chromium.launch({headless: true});
  const network = [];
  const unexpectedOrigins = [];
  try {
    const context = await browser.newContext({ignoreHTTPSErrors: true,
      viewport: {width: 1920, height: 1080}});
    try {
      const page = await context.newPage();
      page.on('request', request => {
        const url = new URL(request.url());
        if (url.origin !== config.app.origin && url.origin !== config.issuer.origin)
          unexpectedOrigins.push(url.origin);
        if (url.pathname.startsWith('/api/') && url.origin !== config.app.origin)
          unexpectedOrigins.push(url.origin);
      });
      page.on('response', response => {
        const url = new URL(response.url());
        if (url.pathname.startsWith('/api/'))
          network.push({path: url.pathname, period: url.searchParams.get('period'),
            method: response.request().method(), status: response.status()});
      });
      markStage('PREAUTH');
      await page.goto(config.app.href, {waitUntil: 'domcontentloaded'});
      checkedEnvelope(await sameOriginFetch(page, '/api/dashboard/project-environments'),
        401, 'AUTHENTICATION_REQUIRED');
      markStage('OIDC');
      const auth = checkedEnvelope(await sameOriginFetch(page, '/auth/oidc/authorization', {
        method: 'POST', headers: {'Content-Type': 'application/json'}, body: '{}',
      }), 200).data;
      assert.equal(new URL(auth.authorization_url).origin, config.issuer.origin,
        'U01_QA_ISSUER_MISMATCH');
      const redirect = await context.request.get(auth.authorization_url, {maxRedirects: 0});
      assert.equal(redirect.status(), 302, 'U01_QA_ISSUER_FAILED');
      const callbackUrl = new URL(redirect.headers().location);
      assert.equal(callbackUrl.origin, config.app.origin, 'U01_QA_CALLBACK_ORIGIN_MISMATCH');
      assert.equal(callbackUrl.searchParams.get('state'), auth.browser_state);
      checkedEnvelope(await sameOriginFetch(page, '/auth/oidc/callback', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({code: callbackUrl.searchParams.get('code'),
          state: auth.browser_state, browser_state: auth.browser_state}),
      }), 200);
      markStage('SESSION');
      const session = checkedEnvelope(await sameOriginFetch(page, '/auth/session/status'), 200);
      assert.equal(session.authenticated, true, 'U01_QA_SESSION_MISSING');
      assert.equal(session.actor_role, config.expectedRole, 'U01_QA_ACTOR_MISMATCH');
      markStage('PAIRS');
      const listed = checkedEnvelope(
        await sameOriginFetch(page, '/api/dashboard/project-environments'), 200);
      const expected = expectedPairs(config.phase, [config.pairA, config.pairB]);
      assert.deepEqual(listed.items, expected, 'U01_QA_PAIR_LIST_MISMATCH');
      if (config.phase === 'other') assert.equal(expected.length, 0);
      markStage('API');
      const observations = [];
      for (const pair of expected) {
        for (const period of Object.keys(periodDays)) {
          const response = checkedEnvelope(await sameOriginFetch(page, scopedPath(pair, period)), 200);
          assert.equal(typeof response.request_id, 'string', 'U01_QA_API_BODY_INVALID');
          assert.ok(validateScoped(response.data, pair, period), 'U01_QA_SCOPED_DATA_INVALID');
          const expectedCount = pair.projectId === config.pairA.projectId
            ? {'1d': 1, '7d': 2, '30d': 3}[period] : {'1d': 1, '7d': 1, '30d': 2}[period];
          assert.equal(response.data.occurrences.criticalDetected.count, expectedCount,
            'U01_QA_PERIOD_DB_COUNT_MISMATCH');
          const expectedCurrent = pair.projectId === config.pairA.projectId ? 3 : 2;
          assert.equal(response.data.current.unresolvedCritical.length, expectedCurrent,
            'U01_QA_CURRENT_DB_COUNT_MISMATCH');
          assert.equal(response.data.current.nextActions.length, expectedCurrent,
            'U01_QA_CURRENT_DB_COUNT_MISMATCH');
          observations.push({pair: [pair.projectId, pair.environmentId], period,
            startUtc: response.data.period.startUtc, endUtc: response.data.period.endUtc,
            observedAt: response.data.period.observedAt,
            detected: response.data.occurrences.criticalDetected.count});
        }
      }
      if (config.phase === 'revoked' || config.phase === 'other') {
        checkedEnvelope(await sameOriginFetch(page, scopedPath(config.pairA, '1d')),
          403, 'AUTHORIZATION_SCOPE_MISMATCH');
      }
      if (config.phase === 'other') {
        checkedEnvelope(await sameOriginFetch(page, scopedPath(config.pairB, '1d')),
          403, 'AUTHORIZATION_SCOPE_MISMATCH');
      }
      if (config.phase !== 'other') {
        const cross = {...config.pairA, environmentId: config.pairB.environmentId};
        checkedEnvelope(await sameOriginFetch(page, scopedPath(cross, '1d')),
          403, 'AUTHORIZATION_SCOPE_MISMATCH');
      }
      markStage('UI');
      await page.reload({waitUntil: 'domcontentloaded'});
      await page.getByRole('button', {name: '조합 목록 새로고침'}).click();
      const select = page.locator('#scoped-pair');
      await select.waitFor();
      await page.waitForFunction(count => document.querySelectorAll('#scoped-pair option').length === count + 1,
        expected.length);
      if (config.phase === 'other')
        await page.getByRole('status', {name: '선택 가능한 조합이 없습니다.'}).waitFor();
      assert.equal(await select.evaluate(element => getComputedStyle(element).fontSize), '12px',
        'U01_QA_FONT_SIZE_MISMATCH');
      await select.focus();
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => document.activeElement?.id), 'scoped-period',
        'U01_QA_KEYBOARD_NAVIGATION_FAILED');
      for (const pair of expected) {
        await select.selectOption(JSON.stringify([pair.projectId, pair.environmentId]));
        for (const period of Object.keys(periodDays)) {
          await page.locator('#scoped-period').selectOption(period);
          const count = pair.projectId === config.pairA.projectId
            ? {'1d': 1, '7d': 2, '30d': 3}[period] : {'1d': 1, '7d': 1, '30d': 2}[period];
          const currentCount = pair.projectId === config.pairA.projectId ? 3 : 2;
          await page.waitForFunction(({pairKey, period, count, currentCount}) => {
            const cards = [...document.querySelectorAll('.scoped-dashboard .status-card')];
            const card = name => cards.find(item => item.querySelector('h3')?.textContent === name);
            return document.querySelector('#scoped-pair')?.value === pairKey
              && document.querySelector('#scoped-period')?.value === period
              && document.querySelector('.scoped-period-evidence')?.textContent
                ?.includes(`서버 기간 · ${period}`)
              && card('criticalDetected')?.querySelector('.status-ready')?.textContent === String(count)
              && card('미해결 Critical')?.textContent?.includes(`${currentCount}건`);
          }, {pairKey: JSON.stringify([pair.projectId, pair.environmentId]), period, count,
            currentCount});
          const text = await page.locator('.scoped-period-evidence').innerText();
          assert.ok(text.includes('Asia/Seoul') && text.includes('관측'), 'U01_QA_UI_PERIOD_MISMATCH');
        }
      }
      if (expected.length === 2) {
        markStage('STALE');
        let releaseRequest;
        const delayedRequest = new Promise(resolve => { releaseRequest = resolve; });
        let releaseResponse;
        const delayedResponse = new Promise(resolve => { releaseResponse = resolve; });
        const delayedPath = scopedPath(config.pairA, '30d');
        const delayedPredicate = url => url.origin === config.app.origin
          && `${url.pathname}${url.search}` === delayedPath;
        await page.route(delayedPredicate, async route => {
          releaseRequest();
          await delayedResponse;
          try { await route.continue(); } catch { /* An aborted stale request is expected. */ }
        });
        try {
          markStage('STALE_TRIGGER');
          assert.equal(await page.locator('#scoped-period').inputValue(), '30d',
            'U01_QA_STALE_PERIOD_RESTORED');
          await select.selectOption(JSON.stringify([config.pairA.projectId,
            config.pairA.environmentId]));
          markStage('STALE_REQUEST');
          await Promise.race([delayedRequest, new Promise((_, reject) => setTimeout(
            () => reject(new Error('U01_QA_STALE_REQUEST_NOT_OBSERVED')), 5000))]);
          markStage('STALE_LOADING');
          await scopedLoadingStatus(page).waitFor();
          markStage('STALE_SWITCH');
          await select.selectOption(JSON.stringify([config.pairB.projectId,
            config.pairB.environmentId]));
          await page.locator('#scoped-period').selectOption('7d');
          releaseResponse();
          markStage('STALE_SETTLED');
          await page.waitForFunction(pairKey => {
            const cards = [...document.querySelectorAll('.scoped-dashboard .status-card')];
            const current = cards.find(item => item.querySelector('h3')?.textContent === '미해결 Critical');
            return document.querySelector('#scoped-pair')?.value === pairKey
              && document.querySelector('#scoped-period')?.value === '7d'
              && current?.textContent?.includes('2건');
          }, JSON.stringify([config.pairB.projectId, config.pairB.environmentId]));
          markStage('STALE_VERIFY');
          await page.waitForTimeout(1000);
          assert.equal(await select.inputValue(), JSON.stringify([config.pairB.projectId,
            config.pairB.environmentId]), 'U01_QA_STALE_PAIR_RESTORED');
          assert.equal(await page.locator('#scoped-period').inputValue(), '7d',
            'U01_QA_STALE_PERIOD_RESTORED');
        } finally {
          releaseResponse();
          await page.unroute(delayedPredicate);
        }
      }
      markStage('FAULT');
      let clientSimulatedFault = false;
      if (expected.length > 0) {
        const availablePair = expected.at(-1);
        const faultPath = scopedPath(availablePair, '1d');
        const faultPredicate = url => url.origin === config.app.origin
          && `${url.pathname}${url.search}` === faultPath;
        let releaseFaultRequest;
        const faultRequest = new Promise(resolve => { releaseFaultRequest = resolve; });
        await page.route(faultPredicate, async route => {
          clientSimulatedFault = true;
          await route.fulfill({status: 503, contentType: 'application/json',
            body: JSON.stringify({error: {code: 'DASHBOARD_SOURCE_UNAVAILABLE',
              message: 'QA client-side simulated fault', request_id: 'qa-synthetic'}})});
          releaseFaultRequest();
        });
        try {
          markStage('FAULT_TRIGGER');
          assert.equal(await page.locator('#scoped-period').inputValue(), '7d',
            'U01_QA_UI_PERIOD_MISMATCH');
          await select.selectOption(JSON.stringify([availablePair.projectId,
            availablePair.environmentId]));
          await page.locator('#scoped-period').selectOption('1d');
          markStage('FAULT_REQUEST');
          await Promise.race([faultRequest, new Promise((_, reject) => setTimeout(
            () => reject(new Error('U01_QA_UI_FAULT_NOT_EXERCISED')), 5000))]);
          markStage('FAULT_ALERT');
          await scopedFaultAlert(page).waitFor();
          assert.equal(clientSimulatedFault, true, 'U01_QA_UI_FAULT_NOT_EXERCISED');
          assert.ok(network.some(item => item.path === new URL(faultPath, config.app).pathname
            && item.period === '1d' && item.status === 503),
          'U01_QA_UI_FAULT_NOT_EXERCISED');
        } finally {
          await page.unroute(faultPredicate);
        }
        markStage('FAULT_RETRY');
        await page.getByRole('button', {name: '선택한 자료 다시 조회'}).click();
        markStage('FAULT_RECOVERED');
        await page.waitForFunction(() => {
          const card = [...document.querySelectorAll('.scoped-dashboard .status-card')]
            .find(item => item.querySelector('h3')?.textContent === 'criticalDetected');
          return card?.querySelector('.status-ready')?.textContent === '1';
        });
      }
      assert.deepEqual(unexpectedOrigins, [], 'U01_QA_UNEXPECTED_BROWSER_ORIGIN');
      assert.ok(network.length >= 2 && network.every(item => item.path.startsWith('/api/')
        && Number.isInteger(item.status)),
        'U01_QA_NETWORK_MISSING');
      const visible = await page.locator('body').innerText();
      assert.ok(!/\b(?:access_token|refresh_token|id_token|client_secret|Bearer\s+[A-Za-z0-9])/i
        .test(visible), 'U01_QA_SECRET_VISIBLE');
      markStage('EVIDENCE');
      if (evidenceDir) {
        const screenshot = join(evidenceDir, `u01-${config.phase}-1920x1080.png`);
        const networkFile = join(evidenceDir, `u01-${config.phase}-network.json`);
        if (existsSync(screenshot) || existsSync(networkFile))
          throw new Error('U01_QA_EVIDENCE_EXISTS');
        await page.screenshot({path: screenshot, fullPage: true});
        writeFileSync(networkFile, JSON.stringify({phase: config.phase, network, observations,
          clientSimulatedFault}));
      }
      process.stdout.write(`U01_TWO_PAIR_${config.phase.toUpperCase()}_PASS `
        + JSON.stringify({pairs: expected.length, reads: observations.length, apiRequests: network.length}) + '\n');
    } finally {
      await context.close();
    }
  } finally {
    await browser.close();
  }
}
