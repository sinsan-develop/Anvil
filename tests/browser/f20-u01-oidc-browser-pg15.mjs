#!/usr/bin/env node
// Single Chromium context against the Python-owned HTTPS OIDC/PG15 host.
import assert from 'node:assert/strict';
import { closeSync, existsSync, lstatSync, openSync, readdirSync, realpathSync,
  renameSync, unlinkSync, writeFileSync, writeSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, isAbsolute, join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const auditSelfTest = process.argv.includes('--audit-self-test');
const r47SelfTest = process.argv.includes('--r47-self-test');
const r48DiagnosticSelfTest = process.argv.includes('--r48-diagnostic-self-test');
const r47Mode = process.env.ANVIL_F20_R47_MODE === '1';
const r48Mode = process.env.ANVIL_F20_R48_MODE === '1';
const r48Scenario = process.env.ANVIL_F20_R48_SCENARIO || 'normal';
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
let navigationRound = 0;
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

const manualPhases = new Set([
  'STORED_CLICK_BEGIN', 'STORED_CLICK_DONE', 'SERVICE_ERROR_BEGIN', 'SERVICE_ERROR_DONE',
  'SERVICE_RECOVERY_BEGIN', 'SERVICE_RECOVERY_DONE', 'INVALID_BEGIN', 'INVALID_DONE',
  'KEYBOARD_RECOVERY_BEGIN', 'KEYBOARD_RECOVERY_DONE', 'REVOKED_CLICK_BEGIN',
  'REVOKED_CLICK_DONE', 'REFRESH_BASELINE_BEGIN', 'REFRESH_BASELINE_DONE',
  'REFRESH_ROUTE_READY', 'REFRESH_TRIGGER_BEGIN', 'REFRESH_TRIGGER_DONE',
  'REFRESH_REQUEST_WAIT', 'REFRESH_REQUEST_DONE', 'REFRESH_LOADING_WAIT',
  'REFRESH_LOADING_DONE', 'REFRESH_LOADING_FACTS_BEGIN', 'REFRESH_LOADING_FACTS_DONE',
  'REFRESH_RELEASE', 'REFRESH_OBSERVATION_WAIT', 'REFRESH_OBSERVATION_DONE',
  'REFRESH_ACTION_WAIT', 'REFRESH_ACTION_DONE', 'REFRESH_ENABLED_WAIT',
  'REFRESH_ENABLED_DONE', 'REFRESH_UPSTREAM_WAIT', 'REFRESH_UPSTREAM_DONE',
  'REFRESH_BODY_WAIT', 'REFRESH_BODY_DONE', 'REFRESH_GATE_WAIT', 'REFRESH_GATE_DONE',
  'REFRESH_FULFILL_WAIT', 'REFRESH_FULFILL_DONE', 'FAILURE_ROUTE_READY',
  'FAILURE_BASELINE_WAIT', 'FAILURE_BASELINE_DONE', 'FAILURE_TRIGGER_BEGIN',
  'FAILURE_TRIGGER_DONE', 'FAILURE_REQUEST_WAIT', 'FAILURE_REQUEST_DONE',
  'FAILURE_LOADING_WAIT', 'FAILURE_LOADING_DONE', 'FAILURE_RELEASE',
  'FAILURE_OBSERVATION_WAIT', 'FAILURE_OBSERVATION_DONE', 'FAILURE_ACTION_WAIT',
  'FAILURE_ACTION_DONE', 'FAILURE_FULFILL_WAIT', 'FAILURE_FULFILL_DONE',
  'FAILURE_GATE_WAIT', 'FAILURE_GATE_DONE',
]);

function manualPhase(value) {
  if (!manualPhases.has(value)) throw new Error('R27_MANUAL_PHASE_INVALID');
  writeSync(1, `R27_MANUAL_PHASE ${value}\n`);
}

const r30Phases = new Set(['CANCEL_BEGIN', 'CANCEL_UPSTREAM', 'CANCEL_ABORT',
  'CANCEL_RECOVERY', 'CANCEL_LATE', 'CLIENT_BEGIN', 'CLIENT_HELD',
  'CLIENT_CANCEL', 'CLIENT_RECOVERY', 'CLIENT_STALE']);
const r30Assertions = new Set([
  'R30_CANCEL_STORED_SETUP_MISSING', 'R30_CANCEL_UPSTREAM_NOT_READY',
  'R30_CANCEL_LATE_RESPONSE_MISMATCH', 'R30_CANCEL_OLD_RESPONSE_NOT_DISTINCT',
  'R30_CANCEL_DUPLICATE_GET', 'R30_CANCEL_BROWSER_ABORT_MISSING',
  'R30_CANCEL_RECOVERY_ROW_MISSING', 'R30_CANCEL_STATE_MISMATCH',
  'R30_CLIENT_RACE_BASELINE_MISSING', 'R30_CLIENT_RACE_STALE_NOT_DISTINCT',
  'R30_CLIENT_RACE_HELD_GET_MISSING', 'R30_CLIENT_RACE_CANCEL_MISSING',
  'R30_CLIENT_RACE_NEW_GET_MISSING', 'R30_CLIENT_RACE_RECOVERY_MISSING',
  'R30_CLIENT_RACE_OLD_RELEASE_MISSING',
  'R30_CLIENT_RACE_LATE_SUCCESS_OVERWROTE_RECOVERY',
]);
let currentR30Phase = null;

function r30Phase(value) {
  if (!r30Phases.has(value)) throw new Error('R30_PHASE_INVALID');
  currentR30Phase = value;
  writeSync(1, `R30_PHASE ${value}\n`);
}

function safeR30FailureCode(error) {
  const code = typeof error?.message === 'string'
    ? /^R30_[A-Z_]+/.exec(error.message)?.[0] : null;
  return r30Assertions.has(code) ? code : 'R30_UNCLASSIFIED';
}

const r44AssertionCodes = new Set([
  'R44_PREAUTH_DETAIL_RETAINED', 'R44_HEALTH_SEED_FAILED',
  'R44_HEALTH_DASHBOARD_FAILED', 'R44_R43_ORDER_CHANGED',
  'R44_HEALTH_DETAIL_MISMATCH', 'R44_PRE_REVOKE_ACTION_MISMATCH',
  'R44_REVOKED_DETAIL_RETAINED', 'R27_REVOKED_REFRESH_MISMATCH',
  'R45_QUEUE_SEED_FAILED', 'R45_QUEUE_DASHBOARD_FAILED',
  'R45_QUEUE_DETAIL_MISMATCH', 'R45_REVOKED_DETAIL_RETAINED',
  'R27_REVOKED_STALE_SETUP_MISSING',
]);

function safeR44FailureCode(error) {
  const code = typeof error?.message === 'string'
    ? /^([A-Z][A-Z0-9_]+)(?:\b|$)/.exec(error.message)?.[1] : null;
  return code && r44AssertionCodes.has(code) ? code : 'UNCLASSIFIED';
}

const r48Stages = new Set(['BOOTSTRAP', 'BROWSER_LAUNCH', 'BROWSER_CONTEXT',
  'PREAUTH', 'POPUP_OPEN', 'CALLBACK', 'REDIRECT_GET', 'REDIRECT_HEADERS',
  'REDIRECT_SCRUB', 'REDIRECT_REFERER', 'REDIRECT_FETCH_DISPATCH',
  'REDIRECT_REQUEST_CAPTURED', 'REDIRECT_HEADER_CLASSIFY', 'ACK',
  'ACK_BUTTON_WAIT', 'ACK_CLICK', 'ACK_RESPONSE_WAIT', 'ACK_DENIAL_CHECK',
  'ACK_DENIAL_BODY_WAIT', 'ACK_DENIAL_CODE', 'ACK_UI_BLOCKED_WAIT',
  'ACK_BLOCKED_UI_WAIT', 'ACK_CONTEXT_CLOSE', 'AUDIT', 'DONE']);
const r48AssertionCodes = new Set([
  'R48_SCENARIO_INVALID', 'R48_CALLBACK_REJECTED', 'R48_CSRF_MISSING',
  'R48_REDIRECT_GET_MISSING', 'R48_REDIRECT_HEADER_REFERRER',
  'R48_REDIRECT_HEADER_CACHE', 'R48_REDIRECT_URL_NOT_SCRUBBED',
  'R48_HISTORY_STATE_LEAK', 'R48_DOM_SECRET_LEAK', 'R48_REFERER_LEAK',
  'R48_REFERER_CLEAN_ROOT', 'R48_REFERER_CODE_OR_STATE',
  'R48_REFERER_OTHER',
  'R48_POPUP_NOT_CLOSED', 'R48_OPEN_ALERT_MISSING',
  'R48_ORIGIN_NOT_DENIED', 'R48_CSRF_NOT_DENIED',
  'R48_ORIGIN_WRONG_DENIAL', 'R48_CSRF_WRONG_DENIAL',
  'R48_PERMISSION_NOT_DENIED', 'R48_PERMISSION_DENIAL_CODE',
  'R48_PERMISSION_BODY_TIMEOUT',
  'R48_ACK_REJECTED', 'R48_ACK_PAYLOAD_INVALID',
  'R48_AUDIT_PERMISSION_NOT_DENIED', 'R48_AUDIT_DENIAL_CODE',
  'R48_ACK_RETRANSMITTED', 'R48_AUDIT_PAGE_NOT_INTERCEPTED',
  'R48_FALSE_SUCCESS', 'R48_BROWSER_API_NOT_SAME_ORIGIN',
]);
let r48Stage = 'BOOTSTRAP';
function safeR48Stage(value) { return r48Stages.has(value) ? value : 'BOOTSTRAP'; }
function markR48Stage(value) {
  r48Stage = safeR48Stage(value);
  writeSync(1, `R48_STAGE ${r48Stage}\n`);
}
function safeR48FailureCode(error) {
  const code = typeof error?.message === 'string'
    ? /^(R48_[A-Z_]+)(?:\b|$)/.exec(error.message)?.[1] : null;
  return code && r48AssertionCodes.has(code) ? code : 'UNCLASSIFIED';
}

function classifyR48Referer(value, cleanRoot, code, state) {
  if (value === undefined || value === null || value === '') return 'ABSENT';
  if (typeof value !== 'string') return 'OTHER';
  if (value === cleanRoot) return 'CLEAN_ROOT';
  if (/[?&](?:code|state)=/i.test(value)
    || [code, state].filter(Boolean).some((secret) =>
      value.includes(secret) || value.includes(encodeURIComponent(secret)))) return 'CODE_OR_STATE';
  return 'OTHER';
}

async function readR48DenialCode(response, timeoutMs, timeoutCode) {
  let timer;
  try {
    const body = response.json().then((payload) => payload?.error?.code);
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(timeoutCode)), timeoutMs);
    });
    return await Promise.race([body, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

function safeFailureName(error) {
  return ['AssertionError', 'Error', 'TypeError', 'TimeoutError', 'SyntaxError',
    'ReferenceError', 'RangeError', 'AggregateError', 'TargetClosedError'].includes(error?.name)
    ? error.name : 'Error';
}

function emitSafeFailure(error) {
  if (r48Mode) {
    writeSync(2, `R48_SAFE_FAILURE scenario=${['redirect', 'permission-denied',
      'audit-denied', 'audit-unreachable', 'normal'].includes(r48Scenario)
      ? r48Scenario : 'invalid'} stage=${safeR48Stage(r48Stage)} `
      + `code=${safeR48FailureCode(error)} name=${safeFailureName(error)}\n`);
    return;
  }
  const safeStage = progressStages.has(stage) ? stage : 'BOOTSTRAP';
  writeSync(2, `R6_SAFE_FAILURE stage=${safeStage} code=${safeR44FailureCode(error)} `
    + `name=${safeFailureName(error)}\n`);
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

function validateStoredElapsed(snapshot, expected, rowText, storedAlertAt) {
  const fields = ['priority', 'reason', 'target', 'action', 'deep_link'];
  const actions = snapshot?.next_actions;
  const matchingAlerts = Array.isArray(snapshot?.alerts) ? snapshot.alerts.filter((alert) =>
    ['open', 'acknowledged'].includes(alert?.status)
    && alert.level === expected.priority && alert.cause === expected.reason
    && alert.related_entity_id === expected.target && alert.next_action === expected.action
    && alert.deep_link === expected.deep_link) : [];
  const matchingActions = Array.isArray(actions) ? actions.filter((action) =>
    fields.every((field) => action?.[field] === expected[field])) : [];
  const alertAt = matchingAlerts[0]?.observed_at;
  const snapshotAt = snapshot?.observed_at;
  const elapsed = Math.floor((Date.parse(snapshotAt) - Date.parse(alertAt)) / 60_000);
  assert.ok(matchingAlerts.length === 1 && matchingActions.length === 1
    && typeof snapshotAt === 'string' && typeof alertAt === 'string'
    && alertAt === storedAlertAt && Number.isSafeInteger(elapsed) && elapsed >= 0
    && rowText.includes(`경과시간 · ${elapsed}분`)
    && !rowText.includes('경과시간 확인 불가'), 'R32_ELAPSED_MISMATCH');
  return { elapsedEvidence: { snapshotObservedAt: snapshotAt, alertObservedAt: alertAt,
    elapsedMinutes: elapsed, uniqueAlertMatch: true, rowDisplayed: true } };
}

function validateR43Detail(snapshot, storedAlert, facts, origin) {
  const actionFields = ['priority', 'reason', 'target', 'action', 'deep_link'];
  const detailFields = ['code', 'source', 'impact', 'observed_at', 'evidence_hash'];
  const action = snapshot?.next_actions?.[0];
  const matchingActions = Array.isArray(snapshot?.next_actions) ? snapshot.next_actions.filter((row) =>
    actionFields.every((field) => row?.[field] === action?.[field])) : [];
  const matchingAlerts = Array.isArray(snapshot?.alerts) ? snapshot.alerts.filter((row) =>
    ['open', 'acknowledged'].includes(row?.status) && row.level === action?.priority
    && row.cause === action?.reason && row.related_entity_id === action?.target
    && row.next_action === action?.action && row.deep_link === action?.deep_link) : [];
  const alert = matchingAlerts[0];
  const expectedParagraphs = alert && [
    `코드 · ${alert.code}`, `출처 · ${alert.source}`, `영향 · ${alert.impact}`,
    `발생 시각 · ${alert.observed_at}`, `증거 hash · ${alert.evidence_hash}`,
  ];
  let url;
  try { url = new URL(facts.url); } catch { /* Invalid navigation fails below. */ }
  assert.ok(matchingActions.length === 1 && matchingAlerts.length === 1
    && detailFields.every((field) => typeof alert[field] === 'string'
      && alert[field].length > 0 && alert[field] === storedAlert[field])
    && facts.href === '#next-action-detail-1' && facts.id === 'next-action-detail-1'
    && facts.linkCount === 1 && facts.detailCount === 1
    && Array.isArray(facts.paragraphs) && facts.paragraphs.length === expectedParagraphs.length
    && facts.paragraphs.every((text, index) => text === expectedParagraphs[index])
    && url?.origin === origin && url.pathname === '/' && url.search === ''
    && url.hash === '#next-action-detail-1', 'R43_DETAIL_MISMATCH');
  return {detailEvidence: {samePageFragment: true, detailApiDomMatch: true,
    detailCount: 1, placeholderNavigation: false}};
}

function validateR43DetailCleared(linkCount, detailCount) {
  assert.ok(linkCount === 0 && detailCount === 0, 'R43_DETAIL_RETAINED');
  return {preAuthCleared: true};
}

function validateR44HealthDetail(snapshot, facts, origin) {
  const signal = snapshot?.health?.backend;
  const alerts = snapshot?.alerts?.filter(row => row.source === 'environment'
    && row.related_entity_id === 'backend');
  const alert = alerts?.[0];
  const expected = alert && [
    `코드 · ${alert.code}`, `출처 · ${alert.source}`, `원인 · ${alert.cause}`,
    `영향 · ${alert.impact}`, `발생 시각 · ${alert.observed_at}`,
    `증거 hash · ${alert.evidence_hash}`,
  ];
  let url;
  try { url = new URL(facts.url); } catch { /* Invalid navigation fails below. */ }
  assert.ok(snapshot?.health?.database?.state === 'HEALTHY'
    && snapshot.health.database.error_count === 0 && alerts?.length === 1
    && signal?.state === 'LATE' && signal.error_count === 0
    && alert.code === 'HEALTH_SIGNAL_LATE' && alert.evidence_hash === signal.evidence_ref
    && alert.deep_link === signal.detail_path && alert.status === 'open'
    && facts.href === '#health-detail-backend' && facts.id === 'health-detail-backend'
    && facts.linkCount === 1 && facts.detailCount === 1
    && facts.paragraphs?.length === expected.length
    && facts.paragraphs.every((text, index) => text === expected[index])
    && url?.origin === origin && url.pathname === '/' && url.search === ''
    && url.hash === '#health-detail-backend', 'R44_HEALTH_DETAIL_MISMATCH');
  return {healthDetailEvidence: {storedAlert: true, samePageFragment: true,
    apiDomMatch: true, preAuthCleared: true, revokedCleared: true,
    databasePreserved: true, r43OrderPreserved: true}};
}

function validateR45QueueDetail(snapshot, facts, origin) {
  const rows = snapshot?.quarantine;
  const alerts = snapshot?.alerts?.filter(row => row.code === 'QUEUE_JOB_QUARANTINED');
  const alert = alerts?.[0];
  const expected = alert && [
    `코드 · ${alert.code}`, `출처 · ${alert.source}`, `원인 · ${alert.cause}`,
    `영향 · ${alert.impact}`, `발생 시각 · ${alert.observed_at}`,
    `증거 hash · ${alert.evidence_hash}`,
  ];
  let url;
  try { url = new URL(facts.url); } catch { /* Invalid navigation fails below. */ }
  const snapshotAge = Date.now() - Date.parse(snapshot?.observed_at);
  assert.ok(Number.isFinite(snapshotAge) && snapshotAge >= 0 && snapshotAge <= 60_000
    && rows?.length === 1 && rows[0].job_id === 'r45-qa-job'
    && rows[0].attempts === 2 && rows[0].reason === 'EXHAUSTED'
    && alerts?.length === 1 && alert.source === 'orchestrator'
    && alert.related_entity_id === rows[0].job_id
    && alert.status === 'open' && alert.deep_link === '/operations/queue'
    && snapshot.health?.database?.state === 'HEALTHY'
    && snapshot.health?.backend?.state === 'LATE'
    && snapshot.health?.queue?.state === 'UNKNOWN'
    && snapshot.source_gaps?.includes('queue')
    && facts.status === 'UNKNOWN' && facts.confirmed === '확인된 격리 이상'
    && facts.gap === 'Queue source 연결 정보가 부족합니다.'
    && facts.count === '격리 작업 1건 · 현재 범위'
    && facts.href === '#health-detail-queue' && facts.id === 'health-detail-queue'
    && facts.linkCount === 1 && facts.detailCount === 1
    && facts.paragraphs?.length === expected.length
    && facts.paragraphs.every((text, index) => text === expected[index])
    && url?.origin === origin && url.pathname === '/' && url.search === ''
    && url.hash === '#health-detail-queue', 'R45_QUEUE_DETAIL_MISMATCH');
  return {queueDetailEvidence: {storedAlert: true, samePageFragment: true,
    apiDomMatch: true, countOne: true, preAuthCleared: true,
    revokedCleared: true, r44Preserved: true}};
}

function validateR44PreRevokeActions(snapshot, rowCount) {
  const alerts = snapshot?.alerts;
  const actions = snapshot?.next_actions;
  assert.ok(Array.isArray(alerts) && alerts.length === 2
    && alerts[0].code === 'WORKER_LEASE_EXPIRED'
    && alerts[1].code === 'HEALTH_SIGNAL_LATE'
    && Array.isArray(actions) && actions.length === 2 && rowCount === 2
    && actions[0].priority === 'critical' && actions[0].target === alerts[0].related_entity_id
    && actions[1].priority === 'warning' && actions[1].target === alerts[1].related_entity_id,
  'R44_PRE_REVOKE_ACTION_MISMATCH');
  return true;
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

function validatePreAuthAccessibility(view) {
  assert.ok(view.alertLive === 'polite' && view.alertAtomic === 'true'
    && view.actionLive === 'polite' && view.actionAtomic === 'true'
    && view.alertText.includes('UNAVAILABLE')
    && view.alertText.includes('저장 경고 기록을 확인할 수 없습니다.')
    && view.actionText.includes('BLOCKED') && view.actionText.includes('조회 차단')
    && !view.alertText.includes('0건') && !view.actionText.includes('0건')
    && view.alertRows === 0 && view.actionRows === 0
    && view.sensitiveTextVisible === false, 'R25_PRE_AUTH_ACCESSIBILITY_MISMATCH');
  return { r25PreAuthAccessible: true };
}

function validateEmptyErrorAccessibility(view) {
  assert.ok(view.emptyAlertLive === 'polite' && view.emptyActionLive === 'polite'
    && view.errorActionLive === 'polite'
    && view.emptyAlertText.includes('이 페이지에 저장된 Critical 기록 없음')
    && view.emptyActionText.includes('현재 관측된 다음 조치 0건')
    && view.errorAlertText.includes('이 페이지에 저장된 Critical 기록 없음')
    && view.errorActionText.includes('UNAVAILABLE')
    && view.errorActionText.includes('다음 조치를 확인할 수 없습니다.')
    && !view.errorActionText.includes('0건')
    && view.independentBefore.length > 0
    && view.independentAfter === view.independentBefore
    && view.errorBodyVisible === false,
  'R25_EMPTY_ERROR_ACCESSIBILITY_MISMATCH');
  return { r25EmptyErrorDistinct: true };
}

function validateRevokedAccessibility(view) {
  assert.ok(view.alertLive === 'polite' && view.actionLive === 'polite'
    && view.alertText.includes('BLOCKED') && view.alertText.includes('조회 차단')
    && view.actionText.includes('BLOCKED') && view.actionText.includes('조회 차단')
    && !view.alertText.includes('0건') && !view.actionText.includes('0건')
    && view.alertRows === 0 && view.actionRows === 0
    && view.staleFocusable === 0 && view.staleTextVisible === false,
  'R25_REVOKED_ACCESSIBILITY_MISMATCH');
  return { r25RevokedRowsInaccessible: true };
}

function validateLoadingKeyboardStability(view) {
  assert.ok(view.beforeFocused === true && view.afterFocused === true
    && view.firstExpanded === 'true' && view.collapsedExpanded === 'false'
    && view.restoredExpanded === 'true' && view.pendingDuringToggle === true,
  'R25_LOADING_KEYBOARD_MISMATCH');
  return { r25LoadingKeyboardStable: true };
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
    const index = Number.isSafeInteger(failed.captureIndex) ? failed.captureIndex : 0;
    const observedStage = progressStages.has(failed.observedStage) ? failed.observedStage : 'BOOTSTRAP';
    const observedRound = Number.isSafeInteger(failed.observedRound) ? failed.observedRound : 0;
    const settledRound = Number.isSafeInteger(failed.settledRound) ? failed.settledRound : 0;
    writeSync(1, `R6_RESPONSE_CAPTURE_FAILED category=${failed.category} status=${failed.status} reason=${failed.reason}`
      + ` index=${index} observed_stage=${observedStage} observed_round=${observedRound} settled_round=${settledRound}\n`);
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

async function traceRevokedDashboardFetch(page, emit = (line) => writeSync(1, line + '\n')) {
  const facts = {request: 'NONE', response: 'NONE', status: 0, finished: 'NONE', page: 'START'};
  let lastTrace = '';
  const emitFacts = () => {
    const line = `R46_REVOKE_DASHBOARD_TRACE request=${facts.request} response=${facts.response}`
      + ` status=${facts.status} finished=${facts.finished} page=${facts.page}`;
    if (line !== lastTrace) { emit(line); lastTrace = line; }
  };
  const phases = new Map([['R46_FETCH_PHASE_FETCH_PENDING', 'FETCH_PENDING'],
    ['R46_FETCH_PHASE_HEADERS', 'HEADERS'], ['R46_FETCH_PHASE_BODY_PENDING', 'BODY_PENDING'],
    ['R46_FETCH_PHASE_BODY_DONE', 'BODY_DONE'], ['R46_FETCH_PHASE_FETCH_ERROR', 'FETCH_ERROR'],
    ['R46_FETCH_PHASE_BODY_ERROR', 'BODY_ERROR']]);
  const matches = (request) => {
    try {
      const url = new URL(request.url());
      return url.origin === apiUrl && url.pathname === '/api/dashboard/operations'
        && request.method() === 'GET';
    } catch { return false; }
  };
  const onRequest = (request) => {
    if (matches(request)) { facts.request = 'SEEN'; emitFacts(); }
  };
  const onResponse = (response) => {
    if (!matches(response.request())) return;
    facts.response = 'SEEN';
    const status = response.status();
    facts.status = Number.isInteger(status) && status >= 100 && status <= 599 ? status : 0;
    emitFacts();
  };
  const onFinished = (request) => {
    if (matches(request)) { facts.finished = 'DONE'; emitFacts(); }
  };
  const onFailed = (request) => {
    if (matches(request)) { facts.finished = 'FAILED'; emitFacts(); }
  };
  const onConsole = (message) => {
    try {
      const phase = message.type() === 'info' ? phases.get(message.text()) : undefined;
      if (phase) { facts.page = phase; emitFacts(); }
    } catch { /* observation remains bounded and unknown */ }
  };
  const observers = [['request', onRequest], ['response', onResponse],
    ['requestfinished', onFinished], ['requestfailed', onFailed], ['console', onConsole]];
  const attached = [];
  try {
    emitFacts();
    for (const [name, callback] of observers) {
      page.on(name, callback);
      attached.push([name, callback]);
    }
    return await page.evaluate(async () => {
      console.info('R46_FETCH_PHASE_FETCH_PENDING');
      let response;
      try {
        response = await fetch('/api/dashboard/operations', {credentials: 'same-origin'});
      } catch (error) {
        console.info('R46_FETCH_PHASE_FETCH_ERROR');
        throw error;
      }
      console.info('R46_FETCH_PHASE_HEADERS');
      console.info('R46_FETCH_PHASE_BODY_PENDING');
      let text;
      try {
        text = await response.text();
      } catch (error) {
        console.info('R46_FETCH_PHASE_BODY_ERROR');
        throw error;
      }
      console.info('R46_FETCH_PHASE_BODY_DONE');
      return {status: response.status, text};
    });
  } catch (error) {
    emitFacts();
    throw error;
  } finally {
    for (const [name, callback] of attached) page.off(name, callback);
  }
}

async function fetchDashboardBeforeReload(page, responseCaptures) {
  const responseReady = page.waitForResponse((response) => {
    try {
      return new URL(response.url()).origin === apiUrl
        && responseCategory(response.url()) === 'DASHBOARD_API'
        && response.request().method() === 'GET';
    } catch { return false; }
  }, {timeout: 10000}).then(
    (value) => ({ok: true, value}),
    () => ({ok: false}),
  );
  const dashboard = await fetchOnPage(page, '/api/dashboard/operations');
  const settled = await responseReady;
  if (!settled.ok) failPhaseResponse('DASHBOARD_API', 0, 'WAIT_TIMEOUT');
  const capture = responseCaptures.get(settled.value);
  if (!capture) failPhaseResponse('DASHBOARD_API', settled.value.status(), 'CAPTURE_MISSING');
  verifiedResponseFacts([await capture]);
  return dashboard;
}

const loadingPaths = new Map([
  ['/api/providers', 'PROVIDER_API'],
  ['/api/operations/alerts', 'ALERT_API'],
  ['/api/health/ready', 'HEALTH_API'],
  ['/api/dashboard/operations', 'DASHBOARD_API'],
]);

function validateObservationTime(view, expected) {
  assert.ok(view.live === 'polite' && view.atomic === 'true'
    && view.text === `대시보드 관측 시각 · ${expected}`,
  'R26_OBSERVATION_TIME_MISMATCH');
  return { observationTimeAccessible: true };
}

function validateManualRefreshFacts(facts, expectedObservedAt) {
  assert.ok(facts.requestCount === 1 && facts.requestPath === '/api/dashboard/operations'
    && facts.requestMethod === 'GET' && facts.loadingDisabled
    && facts.loadingTime === '대시보드 관측 시각 · 조회 중'
    && facts.staleActionCount === 0 && facts.providerDuring === 'LOADING'
    && facts.alertBefore === facts.alertDuring && facts.readinessBefore === facts.readinessDuring
    && facts.responseStatus === 200 && facts.observedAt === expectedObservedAt,
  'R27_MANUAL_REFRESH_MISMATCH');
  return { manualRefreshClicked: true, manualRefreshRequestCount: 1,
    manualRefreshObservedAt: expectedObservedAt, independentCardsPreserved: true };
}

async function verifyManualRefresh(page, origin, expectedAction, activation = 'click') {
  manualPhase('REFRESH_BASELINE_BEGIN');
  const button = page.getByRole('button', { name: '대시보드 새로고침' });
  const nextCard = page.locator('section[aria-labelledby="next-actions-heading"]');
  const provider = page.locator('article.status-card').filter({ hasText: 'LLM Providers' });
  const alerts = page.locator('section[aria-labelledby="critical-alerts-heading"]');
  const heading = page.locator('.dashboard-heading');
  const alertBefore = await alerts.innerText();
  const readinessBefore = (await heading.innerText()).split('\n').find((line) => line.startsWith('마지막 확인'));
  manualPhase('REFRESH_BASELINE_DONE');
  let release;
  const held = new Promise((resolve) => { release = resolve; });
  let received;
  const requested = new Promise((resolve) => { received = resolve; });
  let requestCount = 0;
  let requestPath = null;
  let requestMethod = null;
  let responseStatus = null;
  let observedAt = null;
  const handler = async (route) => {
    requestCount += 1;
    const request = route.request();
    const url = new URL(request.url());
    requestPath = url.origin === origin ? url.pathname : null;
    requestMethod = request.method();
    try {
      manualPhase('REFRESH_UPSTREAM_WAIT');
      const response = await route.fetch();
      manualPhase('REFRESH_UPSTREAM_DONE');
      responseStatus = response.status();
      manualPhase('REFRESH_BODY_WAIT');
      const body = await response.json();
      manualPhase('REFRESH_BODY_DONE');
      observedAt = body?.data?.observed_at ?? null;
      received();
      manualPhase('REFRESH_GATE_WAIT');
      await held;
      manualPhase('REFRESH_GATE_DONE');
      manualPhase('REFRESH_FULFILL_WAIT');
      await route.fulfill({ response });
      manualPhase('REFRESH_FULFILL_DONE');
    } catch (error) {
      received();
      throw error;
    }
  };
  await page.route('**/api/dashboard/operations', handler);
  manualPhase('REFRESH_ROUTE_READY');
  try {
    manualPhase('REFRESH_TRIGGER_BEGIN');
    if (activation === 'keyboard') {
      await button.focus();
      await page.keyboard.press('Enter');
    } else {
      await button.click();
    }
    manualPhase('REFRESH_TRIGGER_DONE');
    manualPhase('REFRESH_REQUEST_WAIT');
    await boundedCapture(() => requested, 10000);
    manualPhase('REFRESH_REQUEST_DONE');
    manualPhase('REFRESH_LOADING_WAIT');
    await verifyObservationTime(page, '조회 중');
    manualPhase('REFRESH_LOADING_DONE');
    manualPhase('REFRESH_LOADING_FACTS_BEGIN');
    const loadingDisabled = await button.isDisabled();
    const staleActionCount = await nextCard.locator('li').count();
    const loadingTime = await heading.locator('p[aria-live]').innerText();
    const providerDuring = await provider.locator('[aria-live] p').first().innerText();
    const alertDuring = await alerts.innerText();
    const readinessDuring = (await heading.innerText()).split('\n')
      .find((line) => line.startsWith('마지막 확인'));
    manualPhase('REFRESH_LOADING_FACTS_DONE');
    manualPhase('REFRESH_RELEASE');
    release();
    manualPhase('REFRESH_OBSERVATION_WAIT');
    await verifyObservationTime(page, observedAt);
    manualPhase('REFRESH_OBSERVATION_DONE');
    manualPhase('REFRESH_ACTION_WAIT');
    await nextCard.locator('li').filter({ hasText: expectedAction }).waitFor();
    manualPhase('REFRESH_ACTION_DONE');
    manualPhase('REFRESH_ENABLED_WAIT');
    assert.equal(await button.isEnabled(), true, 'R27_MANUAL_REFRESH_MISMATCH');
    manualPhase('REFRESH_ENABLED_DONE');
    return validateManualRefreshFacts({ requestCount, requestPath, requestMethod,
      loadingDisabled, loadingTime, staleActionCount, providerDuring,
      alertBefore, alertDuring, readinessBefore, readinessDuring, responseStatus, observedAt }, observedAt);
  } finally {
    release();
    await page.unroute('**/api/dashboard/operations', handler);
  }
}

async function verifyManualFailure(page, origin, status, body) {
  const button = page.getByRole('button', { name: '대시보드 새로고침' });
  const nextCard = page.locator('section[aria-labelledby="next-actions-heading"]');
  let release;
  const held = new Promise((resolve) => { release = resolve; });
  let received;
  const requested = new Promise((resolve) => { received = resolve; });
  let requestCount = 0;
  const handler = async (route) => {
    requestCount += 1;
    assert.equal(new URL(route.request().url()).origin, origin, 'R27_MANUAL_FAILURE_MISMATCH');
    assert.equal(route.request().method(), 'GET', 'R27_MANUAL_FAILURE_MISMATCH');
    received();
    manualPhase('FAILURE_GATE_WAIT');
    await held;
    manualPhase('FAILURE_GATE_DONE');
    manualPhase('FAILURE_FULFILL_WAIT');
    await route.fulfill({ status, contentType: 'application/json', body });
    manualPhase('FAILURE_FULFILL_DONE');
  };
  await page.route('**/api/dashboard/operations', handler);
  manualPhase('FAILURE_ROUTE_READY');
  try {
    manualPhase('FAILURE_BASELINE_WAIT');
    assert.equal(await nextCard.locator('li').count(), 1, 'R27_MANUAL_FAILURE_MISMATCH');
    manualPhase('FAILURE_BASELINE_DONE');
    manualPhase('FAILURE_TRIGGER_BEGIN');
    await button.click();
    manualPhase('FAILURE_TRIGGER_DONE');
    manualPhase('FAILURE_REQUEST_WAIT');
    await boundedCapture(() => requested, 10000);
    manualPhase('FAILURE_REQUEST_DONE');
    manualPhase('FAILURE_LOADING_WAIT');
    await verifyObservationTime(page, '조회 중');
    manualPhase('FAILURE_LOADING_DONE');
    assert.equal(await button.isDisabled(), true, 'R27_MANUAL_FAILURE_MISMATCH');
    assert.equal(await nextCard.locator('li').count(), 0, 'R27_MANUAL_FAILURE_MISMATCH');
    await button.evaluate((element) => element.click());
    assert.equal(requestCount, 1, 'R27_MANUAL_FAILURE_DUPLICATE');
    manualPhase('FAILURE_RELEASE');
    release();
    manualPhase('FAILURE_OBSERVATION_WAIT');
    await verifyObservationTime(page, '확인 불가');
    manualPhase('FAILURE_OBSERVATION_DONE');
    manualPhase('FAILURE_ACTION_WAIT');
    await nextCard.getByText('UNAVAILABLE', { exact: true }).waitFor();
    manualPhase('FAILURE_ACTION_DONE');
    assert.equal(await nextCard.locator('li').count(), 0, 'R27_MANUAL_FAILURE_MISMATCH');
    assert.equal(await button.isEnabled(), true, 'R27_MANUAL_FAILURE_MISMATCH');
    assert.equal(requestCount, 1, 'R27_MANUAL_FAILURE_DUPLICATE');
    assert.equal((await page.locator('body').innerText()).includes('r27-private-error-body-marker'), false,
      'R27_MANUAL_FAILURE_BODY_LEAK');
    return { requestCount, responseStatus: status, failClosed: true };
  } finally {
    release();
    await page.unroute('**/api/dashboard/operations', handler);
  }
}

async function verifyQuotaRefresh(page, origin, expectedAction) {
  const button = page.getByRole('button', { name: '대시보드 새로고침' });
  const nextCard = page.locator('section[aria-labelledby="next-actions-heading"]');
  const health = page.locator('section[aria-labelledby="health-heading"]');
  const independentReadiness = health.locator('article.status-card').filter({hasText: 'Database'}).locator('p').filter({hasText: 'API 준비'});
  const alerts = page.locator('section[aria-labelledby="critical-alerts-heading"]');
  const readinessBefore = await independentReadiness.innerText();
  const alertsBefore = await alerts.innerText();
  assert.equal(await nextCard.locator('li').count(), 1, 'R29_QUOTA_STORED_SETUP_MISSING');
  let release;
  const held = new Promise((resolve) => { release = resolve; });
  let received;
  const requested = new Promise((resolve) => { received = resolve; });
  let requestCount = 0;
  let sameOriginGet = true;
  const handler = async (route) => {
    requestCount += 1;
    const request = route.request();
    sameOriginGet &&= new URL(request.url()).origin === origin
      && new URL(request.url()).pathname === '/api/dashboard/operations'
      && request.method() === 'GET';
    received();
    await held;
    await route.fulfill({ status: 429, contentType: 'application/json',
      body: '{"error":"r29-private-quota-body-marker"}' });
  };
  await page.route('**/api/dashboard/operations', handler);
  try {
    await button.click();
    await boundedCapture(() => requested, 10000);
    await verifyObservationTime(page, '조회 중');
    assert.equal(await button.isDisabled(), true, 'R29_QUOTA_DUPLICATE_GET');
    assert.equal(await nextCard.locator('li').count(), 0, 'R29_QUOTA_STALE_ROW');
    await button.evaluate((element) => element.click());
    assert.equal(requestCount, 1, 'R29_QUOTA_DUPLICATE_GET');
    release();
    await verifyObservationTime(page, '조회 제한');
    await nextCard.getByText('QUOTA', { exact: true }).waitFor();
    const cardNames = ['Database', 'Queue', 'Worker', 'LLM Providers', 'Execution Backends', 'Artifact Store'];
    const cardText = await Promise.all(cardNames.map(async (name) =>
      health.locator('article.status-card').filter({ hasText: name }).first().innerText()));
    const body = await page.locator('body').innerText();
    const quotaVisible = cardText.every((text, index) => text.includes('QUOTA')
      && text.includes(index === 1 ? '조회 제한 · Queue 기록을 표시하지 않습니다.'
        : `조회 제한 · ${cardNames[index]} 상태 정보를 표시하지 않습니다.`))
      && cardText[0].includes('API 준비 READY')
      && (await nextCard.innerText()).includes('조회 제한');
    const staleRowsCleared = await nextCard.locator('li').count() === 0
      && !(await nextCard.innerText()).includes(expectedAction);
    const observationRestricted = body.includes('대시보드 관측 시각 · 조회 제한')
      && !body.includes('대시보드 관측 시각 · 2026-');
    const secretHidden = !body.includes('r29-private-quota-body-marker');
    const independentCardsPreserved = await independentReadiness.innerText() === readinessBefore
      && await alerts.innerText() === alertsBefore;
    assert.ok(requestCount === 1 && sameOriginGet && quotaVisible && staleRowsCleared
      && observationRestricted && secretHidden && independentCardsPreserved
      && await button.isEnabled(), 'R29_QUOTA_STATE_MISMATCH');
    return { requestCount, responseStatus: 429, sameOriginGet, quotaVisible,
      staleRowsCleared, observationRestricted, secretHidden, independentCardsPreserved };
  } finally {
    release();
    await page.unroute('**/api/dashboard/operations', handler);
  }
}

function hasFailedRequestReason(failure) {
  return typeof failure?.errorText === 'string' && failure.errorText.trim().length > 0;
}

async function verifyDashboardCancellation(page, origin, expectedAction, previousObservedAt) {
  r30Phase('CANCEL_BEGIN');
  const refresh = page.getByRole('button', { name: '대시보드 새로고침' });
  const cancel = page.getByRole('button', { name: '대시보드 조회 취소' });
  const nextCard = page.locator('section[aria-labelledby="next-actions-heading"]');
  const health = page.locator('section[aria-labelledby="health-heading"]');
  const independentReadiness = health.locator('article.status-card').filter({hasText: 'Database'}).locator('p').filter({hasText: 'API 준비'});
  const alerts = page.locator('section[aria-labelledby="critical-alerts-heading"]');
  const readinessBefore = await independentReadiness.innerText();
  const alertsBefore = await alerts.innerText();
  assert.equal(await nextCard.locator('li').count(), 1, 'R30_CANCEL_STORED_SETUP_MISSING');
  await verifyObservationTime(page, previousObservedAt);
  let release;
  const held = new Promise((resolve) => { release = resolve; });
  let received;
  const requested = new Promise((resolve) => { received = resolve; });
  let settled;
  const completed = new Promise((resolve) => { settled = resolve; });
  let requestCount = 0;
  let requestPath = null;
  let requestMethod = null;
  let responseStatus = null;
  let lateObservedAt = null;
  let routeError = null;
  let mutationRequestCount = 0;
  let oldRequest = null;
  let oldResponseDistinct = false;
  let observedFailure;
  const requestFailed = new Promise((resolve) => { observedFailure = resolve; });
  const captureFailure = (request) => {
    if (request === oldRequest) observedFailure(request.failure());
  };
  const countMutation = (request) => {
    const url = new URL(request.url());
    if (url.origin === origin && url.pathname.startsWith('/api/') && request.method() !== 'GET') {
      mutationRequestCount += 1;
    }
  };
  const handler = async (route) => {
    requestCount += 1;
    const request = route.request();
    oldRequest = request;
    const url = new URL(request.url());
    requestPath = url.origin === origin ? url.pathname : null;
    requestMethod = request.method();
    try {
      const response = await route.fetch();
      responseStatus = response.status();
      const payload = await response.json();
      lateObservedAt = payload?.data?.observed_at ?? null;
      oldResponseDistinct = Array.isArray(payload?.data?.next_actions)
        && payload.data.next_actions.length === 1;
      received();
      await held;
      // A valid older empty snapshot makes an overwrite after the new 200 observable.
      try { await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ ...payload, data: { ...payload.data, next_actions: [] } }) }); }
      catch (error) { routeError = error; }
    } catch (error) {
      routeError = error;
      received();
    } finally {
      settled();
    }
  };
  page.on('request', countMutation);
  page.on('requestfailed', captureFailure);
  await page.route('**/api/dashboard/operations', handler);
  let oldRouteRegistered = true;
  try {
    await refresh.click();
    await boundedCapture(() => requested, 10000);
    assert.equal(responseStatus, 200, 'R30_CANCEL_UPSTREAM_NOT_READY');
    assert.equal(lateObservedAt, previousObservedAt, 'R30_CANCEL_LATE_RESPONSE_MISMATCH');
    assert.equal(oldResponseDistinct, true, 'R30_CANCEL_OLD_RESPONSE_NOT_DISTINCT');
    r30Phase('CANCEL_UPSTREAM');
    await verifyObservationTime(page, '조회 중');
    const duplicateRequestPrevented = await refresh.isDisabled();
    await refresh.evaluate((element) => element.click());
    assert.equal(requestCount, 1, 'R30_CANCEL_DUPLICATE_GET');
    await cancel.focus();
    await page.keyboard.press('Enter');
    const failure = await boundedCapture(() => requestFailed, 10000);
    const browserRequestAborted = hasFailedRequestReason(failure);
    assert.equal(browserRequestAborted, true, 'R30_CANCEL_BROWSER_ABORT_MISSING');
    r30Phase('CANCEL_ABORT');
    await verifyObservationTime(page, '조회 취소');
    await nextCard.getByText('CANCELLED', { exact: true }).waitFor();
    const cancelledVisible = await nextCard.getByText('CANCELLED', { exact: true }).count() === 1
      && await cancel.count() === 0 && await refresh.isEnabled();
    const cardNames = ['Database', 'Queue', 'Worker', 'LLM Providers', 'Execution Backends', 'Artifact Store'];
    const cardText = await Promise.all(cardNames.map(async (name) =>
      health.locator('article.status-card').filter({ hasText: name }).first().innerText()));
    const cancelledCards = cardText.every((text, index) => text.includes('CANCELLED')
      && text.includes(index === 1 ? '조회 취소 · Queue 기록을 표시하지 않습니다.'
        : `조회 취소 · ${cardNames[index]} 상태 정보를 표시하지 않습니다.`))
      && (await nextCard.innerText()).includes('조회 취소 · 다음 조치를 표시하지 않습니다.');
    const cancelledBody = await page.locator('body').innerText();
    const staleRowsCleared = await nextCard.locator('li').count() === 0
      && !(await nextCard.innerText()).includes(expectedAction);
    const observationCleared = cancelledBody.includes('대시보드 관측 시각 · 조회 취소')
      && !cancelledBody.includes(`대시보드 관측 시각 · ${previousObservedAt}`);
    const independentCardsPreserved = await independentReadiness.innerText() === readinessBefore
      && await alerts.innerText() === alertsBefore && cardText[0].includes('API 준비 READY');
    const secretHidden = !cancelledBody.includes('r29-private-quota-body-marker');
    // Leave the old handler pending while the next manual GET completes.
    await page.unroute('**/api/dashboard/operations', handler);
    oldRouteRegistered = false;
    r30Phase('CANCEL_RECOVERY');
    const cancelRecoveryEvidence = await verifyManualRefresh(page, origin, expectedAction);
    assert.equal(await nextCard.locator('li').count(), 1, 'R30_CANCEL_RECOVERY_ROW_MISSING');
    release();
    await boundedCapture(() => completed, 10000);
    r30Phase('CANCEL_LATE');
    await page.waitForTimeout(50);
    const lateAfterRecoveryIgnored = await nextCard.locator('li').count() === 1
      && (await nextCard.locator('li').first().innerText()).includes(expectedAction)
      && (await page.locator('.dashboard-heading p[aria-live]').innerText())
        === `대시보드 관측 시각 · ${cancelRecoveryEvidence.manualRefreshObservedAt}`;
    assert.ok(requestCount === 1 && requestPath === '/api/dashboard/operations'
      && requestMethod === 'GET' && cancelledVisible && cancelledCards && staleRowsCleared
      && observationCleared && independentCardsPreserved && browserRequestAborted
      && oldResponseDistinct && lateAfterRecoveryIgnored
      && secretHidden && duplicateRequestPrevented && mutationRequestCount === 0,
    `R30_CANCEL_STATE_MISMATCH route=${routeError ? 'SETTLED_WITH_ABORT' : 'FULFILLED'}`);
    return { cancelEvidence: { requestCount, requestPath, requestMethod, cancelledVisible,
      staleRowsCleared, observationCleared, independentCardsPreserved,
      browserRequestAborted, oldResponseDistinct, lateAfterRecoveryIgnored,
      secretHidden, duplicateRequestPrevented, mutationRequestCount }, cancelRecoveryEvidence };
  } finally {
    release();
    page.off('request', countMutation);
    page.off('requestfailed', captureFailure);
    if (oldRouteRegistered) await page.unroute('**/api/dashboard/operations', handler);
  }
}

async function verifyClientLateSuccessRace(page, origin, expectedAction) {
  r30Phase('CLIENT_BEGIN');
  const refresh = page.getByRole('button', { name: '대시보드 새로고침' });
  const cancel = page.getByRole('button', { name: '대시보드 조회 취소' });
  const nextCard = page.locator('section[aria-labelledby="next-actions-heading"]');
  const direct = await fetchOnPage(page, '/api/dashboard/operations');
  assert.equal(direct.status, 200, 'R30_CLIENT_RACE_BASELINE_MISSING');
  const source = JSON.parse(direct.text);
  assert.ok(Array.isArray(source?.data?.next_actions)
    && source.data.next_actions.length === 1, 'R30_CLIENT_RACE_BASELINE_MISSING');
  const stale = { ...source, data: { ...source.data, next_actions: [] } };
  const staleResponseDistinct = source.data.next_actions[0].action === expectedAction
    && stale.data.next_actions.length === 0;
  assert.equal(staleResponseDistinct, true, 'R30_CLIENT_RACE_STALE_NOT_DISTINCT');
  let mutationRequestCount = 0;
  const countMutation = (request) => {
    const url = new URL(request.url());
    if (url.origin === origin && url.pathname.startsWith('/api/') && request.method() !== 'GET') {
      mutationRequestCount += 1;
    }
  };
  page.on('request', countMutation);
  let installed = false;
  try {
    await page.evaluate((oldPayload) => {
      const nativeFetch = window.fetch;
      let calls = 0;
      let firstSignal = null;
      let resolveFirst = null;
      let released = false;
      window.fetch = (input, init) => {
        const url = new URL(typeof input === 'string' ? input : input.url, location.href);
        if (url.origin === location.origin && url.pathname === '/api/dashboard/operations') {
          calls += 1;
          if (calls === 1) {
            firstSignal = init?.signal ?? null;
            // Deliberately ignore abort to exercise Shell's request-identity guard.
            return new Promise((resolve) => { resolveFirst = resolve; });
          }
        }
        return nativeFetch.call(window, input, init);
      };
      globalThis.__anvilR30Race = {
        facts: () => ({ calls, firstSignalAborted: firstSignal?.aborted === true, released }),
        releaseOld: () => {
          if (!resolveFirst || released) return false;
          released = true;
          resolveFirst(new Response(JSON.stringify(oldPayload), { status: 200,
            headers: { 'content-type': 'application/json' } }));
          return true;
        },
        restore: () => { window.fetch = nativeFetch; },
      };
    }, stale);
    installed = true;
    await refresh.click();
    await verifyObservationTime(page, '조회 중');
    const held = await page.evaluate(() => globalThis.__anvilR30Race.facts());
    assert.equal(held.calls, 1, 'R30_CLIENT_RACE_HELD_GET_MISSING');
    r30Phase('CLIENT_HELD');
    await cancel.click();
    await verifyObservationTime(page, '조회 취소');
    await nextCard.getByText('CANCELLED', { exact: true }).waitFor();
    const cancelledVisible = await nextCard.locator('li').count() === 0;
    const firstSignalAborted = (await page.evaluate(() => globalThis.__anvilR30Race.facts()))
      .firstSignalAborted;
    assert.ok(cancelledVisible && firstSignalAborted, 'R30_CLIENT_RACE_CANCEL_MISSING');
    r30Phase('CLIENT_CANCEL');
    r30Phase('CLIENT_RECOVERY');
    const recovered = await verifyManualRefresh(page, origin, expectedAction);
    const observedAt = recovered.manualRefreshObservedAt;
    const beforeRelease = await page.evaluate(() => globalThis.__anvilR30Race.facts());
    assert.equal(beforeRelease.calls, 2, 'R30_CLIENT_RACE_NEW_GET_MISSING');
    assert.equal(await nextCard.locator('li').count(), 1, 'R30_CLIENT_RACE_RECOVERY_MISSING');
    const releasedAfterRecovery = await page.evaluate(() => globalThis.__anvilR30Race.releaseOld());
    assert.equal(releasedAfterRecovery, true, 'R30_CLIENT_RACE_OLD_RELEASE_MISSING');
    r30Phase('CLIENT_STALE');
    await page.waitForTimeout(50);
    const latestRowPreserved = await nextCard.locator('li').count() === 1
      && (await nextCard.locator('li').first().innerText()).includes(expectedAction)
      && !(await nextCard.innerText()).includes('현재 관측된 다음 조치 0건');
    const latestObservationPreserved = (await page.locator('.dashboard-heading p[aria-live]').innerText())
      === `대시보드 관측 시각 · ${observedAt}`;
    assert.ok(staleResponseDistinct && latestRowPreserved && latestObservationPreserved
      && mutationRequestCount === 0, 'R30_CLIENT_RACE_LATE_SUCCESS_OVERWROTE_RECOVERY');
    return { interceptedDashboardCalls: 2, firstSignalAborted, cancelledVisible,
      staleResponseDistinct, oldPromiseResolvedAfterRecovery: releasedAfterRecovery,
      latestRowPreserved, latestObservationPreserved,
      manualRefreshRequestCount: recovered.manualRefreshRequestCount,
      manualRefreshObservedAt: observedAt, mutationRequestCount };
  } finally {
    page.off('request', countMutation);
    if (installed) await page.evaluate(() => {
      globalThis.__anvilR30Race.restore();
      delete globalThis.__anvilR30Race;
    });
  }
}

async function verifyDashboardReconnect(page, origin, expectedAction) {
  const retry = page.getByRole('button', { name: '대시보드 연결 재시도' });
  const refresh = page.getByRole('button', { name: '대시보드 새로고침' });
  const cancel = page.getByRole('button', { name: '대시보드 조회 취소' });
  const nextCard = page.locator('section[aria-labelledby="next-actions-heading"]');
  const health = page.locator('section[aria-labelledby="health-heading"]');
  const independentReadiness = health.locator('article.status-card').filter({hasText: 'Database'}).locator('p').filter({hasText: 'API 준비'});
  const alerts = page.locator('section[aria-labelledby="critical-alerts-heading"]');
  const readinessBefore = await independentReadiness.innerText();
  const alertsBefore = await alerts.innerText();
  await retry.waitFor();
  await nextCard.getByText('UNAVAILABLE', { exact: true }).waitFor();
  let release;
  const held = new Promise((resolve) => { release = resolve; });
  let received;
  const requested = new Promise((resolve) => { received = resolve; });
  let retryRequestCount = 0;
  let requestPath = null;
  let requestMethod = null;
  let recoveryStatus = null;
  let recoveredObservedAt = null;
  let mutationRequestCount = 0;
  const countMutation = (request) => {
    const url = new URL(request.url());
    if (url.origin === origin && url.pathname.startsWith('/api/') && request.method() !== 'GET') {
      mutationRequestCount += 1;
    }
  };
  const handler = async (route) => {
    retryRequestCount += 1;
    const request = route.request();
    const url = new URL(request.url());
    requestPath = url.origin === origin ? url.pathname : null;
    requestMethod = request.method();
    try {
      const response = await route.fetch();
      recoveryStatus = response.status();
      const payload = await response.json();
      recoveredObservedAt = payload?.data?.observed_at ?? null;
      received();
      await held;
      await route.fulfill({ response });
    } catch (error) {
      received();
      throw error;
    }
  };
  page.on('request', countMutation);
  await page.route('**/api/dashboard/operations', handler);
  try {
    await retry.focus();
    await page.keyboard.press('Enter');
    await boundedCapture(() => requested, 10000);
    await verifyObservationTime(page, '재연결 중');
    const cardNames = ['Database', 'Queue', 'Worker', 'LLM Providers', 'Execution Backends', 'Artifact Store'];
    const cardText = await Promise.all(cardNames.map(async (name) =>
      health.locator('article.status-card').filter({ hasText: name }).first().innerText()));
    const pendingBody = await page.locator('body').innerText();
    const reconnectingVisible = await cancel.count() === 1 && await retry.count() === 0
      && cardText.every((text) => text.includes('RECONNECTING'))
      && (await nextCard.innerText()).includes('RECONNECTING');
    const dependentCardsCleared = await nextCard.locator('li').count() === 0
      && !(await nextCard.innerText()).includes(expectedAction);
    const observationCleared = pendingBody.includes('대시보드 관측 시각 · 재연결 중')
      && !pendingBody.includes(`대시보드 관측 시각 · ${recoveredObservedAt}`);
    const independentCardsPreserved = await independentReadiness.innerText() === readinessBefore
      && await alerts.innerText() === alertsBefore && cardText[0].includes('API 준비 READY');
    const duplicateRequestPrevented = await refresh.isDisabled();
    await refresh.evaluate((element) => element.click());
    assert.equal(retryRequestCount, 1, 'R31_RECONNECT_DUPLICATE_GET');
    release();
    await verifyObservationTime(page, recoveredObservedAt);
    await nextCard.locator('li').filter({ hasText: expectedAction }).waitFor();
    const recoveredRowVisible = await nextCard.locator('li').count() === 1
      && await retry.count() === 0 && await cancel.count() === 0;
    const recoveredBody = await page.locator('body').innerText();
    const secretHidden = !pendingBody.includes('r31-private-reconnect-marker')
      && !recoveredBody.includes('r31-private-reconnect-marker');
    assert.ok(retryRequestCount === 1 && requestPath === '/api/dashboard/operations'
      && requestMethod === 'GET' && reconnectingVisible && dependentCardsCleared
      && observationCleared && independentCardsPreserved && duplicateRequestPrevented
      && recoveryStatus === 200 && recoveredRowVisible && secretHidden
      && mutationRequestCount === 0, 'R31_RECONNECT_STATE_MISMATCH');
    return { failureStatus: 503, retryRequestCount, requestPath, requestMethod,
      reconnectingVisible, dependentCardsCleared, observationCleared,
      independentCardsPreserved, duplicateRequestPrevented, recoveryStatus,
      recoveredRowVisible, recoveredObservedAt, secretHidden, mutationRequestCount };
  } finally {
    release();
    page.off('request', countMutation);
    await page.unroute('**/api/dashboard/operations', handler);
  }
}

async function verifyReconnectCancellation(page, origin, expectedAction) {
  const retry = page.getByRole('button', { name: '대시보드 연결 재시도' });
  const cancel = page.getByRole('button', { name: '대시보드 조회 취소' });
  const nextCard = page.locator('section[aria-labelledby="next-actions-heading"]');
  const health = page.locator('section[aria-labelledby="health-heading"]');
  const independentReadiness = health.locator('article.status-card').filter({hasText: 'Database'}).locator('p').filter({hasText: 'API 준비'});
  const alerts = page.locator('section[aria-labelledby="critical-alerts-heading"]');
  const readinessBefore = await independentReadiness.innerText();
  const alertsBefore = await alerts.innerText();
  await retry.waitFor();
  let release;
  const held = new Promise((resolve) => { release = resolve; });
  let received;
  const requested = new Promise((resolve) => { received = resolve; });
  let settled;
  const completed = new Promise((resolve) => { settled = resolve; });
  let retryRequestCount = 0;
  let requestPath = null;
  let requestMethod = null;
  let oldRequest = null;
  let mutationRequestCount = 0;
  let observedFailure;
  const requestFailed = new Promise((resolve) => { observedFailure = resolve; });
  const captureFailure = (request) => {
    if (request === oldRequest) observedFailure(request.failure());
  };
  const countMutation = (request) => {
    const url = new URL(request.url());
    if (url.origin === origin && url.pathname.startsWith('/api/') && request.method() !== 'GET') {
      mutationRequestCount += 1;
    }
  };
  const handler = async (route) => {
    retryRequestCount += 1;
    oldRequest = route.request();
    const url = new URL(oldRequest.url());
    requestPath = url.origin === origin ? url.pathname : null;
    requestMethod = oldRequest.method();
    try {
      const response = await route.fetch();
      assert.equal(response.status(), 200, 'R31_RECONNECT_CANCEL_UPSTREAM_NOT_READY');
      const payload = await response.json();
      received();
      await held;
      try { await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ ...payload, data: { ...payload.data, next_actions: [] } }) }); }
      catch { /* Browser abort may close this exact routed request. */ }
    } catch (error) {
      received();
      throw error;
    } finally {
      settled();
    }
  };
  page.on('request', countMutation);
  page.on('requestfailed', captureFailure);
  await page.route('**/api/dashboard/operations', handler);
  let oldRouteRegistered = true;
  try {
    await retry.click();
    await boundedCapture(() => requested, 10000);
    await verifyObservationTime(page, '재연결 중');
    await cancel.click();
    const requestAborted = hasFailedRequestReason(await boundedCapture(() => requestFailed, 10000));
    await verifyObservationTime(page, '조회 취소');
    await nextCard.getByText('CANCELLED', { exact: true }).waitFor();
    const cancelledVisible = await cancel.count() === 0
      && await nextCard.getByText('CANCELLED', { exact: true }).count() === 1;
    const cancelledBody = await page.locator('body').innerText();
    const staleRowsCleared = await nextCard.locator('li').count() === 0
      && !(await nextCard.innerText()).includes(expectedAction);
    const secretHidden = !cancelledBody.includes('r31-private-reconnect-marker');
    const independentCardsPreserved = await independentReadiness.innerText() === readinessBefore
      && await alerts.innerText() === alertsBefore
      && (await health.locator('article.status-card').filter({ hasText: 'Database' }).first().innerText())
        .includes('API 준비 READY');
    await page.unroute('**/api/dashboard/operations', handler);
    oldRouteRegistered = false;
    const recovery = await verifyManualRefresh(page, origin, expectedAction);
    const recoveredObservedAt = recovery.manualRefreshObservedAt;
    release();
    await boundedCapture(() => completed, 10000);
    await page.waitForTimeout(50);
    const abortedRouteNoOverwrite = await nextCard.locator('li').count() === 1
      && (await nextCard.locator('li').first().innerText()).includes(expectedAction)
      && (await page.locator('.dashboard-heading p[aria-live]').innerText())
        === `대시보드 관측 시각 · ${recoveredObservedAt}`;
    assert.ok(retryRequestCount === 1 && requestPath === '/api/dashboard/operations'
      && requestMethod === 'GET' && cancelledVisible && requestAborted
      && staleRowsCleared && secretHidden && independentCardsPreserved && abortedRouteNoOverwrite
      && mutationRequestCount === 0, 'R31_RECONNECT_CANCEL_MISMATCH');
    return { failureStatus: 503, retryRequestCount, requestPath, requestMethod,
      cancelledVisible, requestAborted, staleRowsCleared, independentCardsPreserved,
      secretHidden,
      recoveredObservedAt, abortedRouteNoOverwrite, mutationRequestCount };
  } finally {
    release();
    page.off('request', countMutation);
    page.off('requestfailed', captureFailure);
    if (oldRouteRegistered) await page.unroute('**/api/dashboard/operations', handler);
  }
}

async function verifyReconnectDenied(page, origin, expectedAction) {
  const retry = page.getByRole('button', { name: '대시보드 연결 재시도' });
  const nextCard = page.locator('section[aria-labelledby="next-actions-heading"]');
  const health = page.locator('section[aria-labelledby="health-heading"]');
  const independentReadiness = health.locator('article.status-card').filter({hasText: 'Database'}).locator('p').filter({hasText: 'API 준비'});
  const alerts = page.locator('section[aria-labelledby="critical-alerts-heading"]');
  const readinessBefore = await independentReadiness.innerText();
  const alertsBefore = await alerts.innerText();
  await retry.waitFor();
  let retryRequestCount = 0;
  let requestPath = null;
  let requestMethod = null;
  let mutationRequestCount = 0;
  const countMutation = (request) => {
    const url = new URL(request.url());
    if (url.origin === origin && url.pathname.startsWith('/api/') && request.method() !== 'GET') {
      mutationRequestCount += 1;
    }
  };
  const handler = async (route) => {
    retryRequestCount += 1;
    const request = route.request();
    const url = new URL(request.url());
    requestPath = url.origin === origin ? url.pathname : null;
    requestMethod = request.method();
    await route.fulfill({ status: 403, contentType: 'application/json',
      body: '{"error":"r31-private-denial-marker"}' });
  };
  page.on('request', countMutation);
  await page.route('**/api/dashboard/operations', handler);
  try {
    await retry.click();
    await verifyObservationTime(page, '조회 차단');
    await nextCard.getByText('BLOCKED', { exact: true }).waitFor();
    const cardNames = ['Database', 'Queue', 'Worker', 'LLM Providers', 'Execution Backends', 'Artifact Store'];
    const cardText = await Promise.all(cardNames.map(async (name) =>
      health.locator('article.status-card').filter({ hasText: name }).first().innerText()));
    const body = await page.locator('body').innerText();
    const blockedVisible = await retry.count() === 0
      && cardText.every((text) => text.includes('BLOCKED'));
    const staleRowsCleared = await nextCard.locator('li').count() === 0
      && !(await nextCard.innerText()).includes(expectedAction);
    const observationBlocked = body.includes('대시보드 관측 시각 · 조회 차단');
    const independentCardsPreserved = await independentReadiness.innerText() === readinessBefore
      && await alerts.innerText() === alertsBefore && cardText[0].includes('API 준비 READY');
    const secretHidden = !body.includes('r31-private-denial-marker');
    assert.ok(retryRequestCount === 1 && requestPath === '/api/dashboard/operations'
      && requestMethod === 'GET' && blockedVisible && staleRowsCleared
      && observationBlocked && independentCardsPreserved && secretHidden
      && mutationRequestCount === 0, 'R31_RECONNECT_DENIAL_MISMATCH');
    return { failureStatus: 503, retryRequestCount, requestPath, requestMethod,
      deniedStatus: 403, blockedVisible, staleRowsCleared, observationBlocked,
      independentCardsPreserved, secretHidden, mutationRequestCount };
  } finally {
    page.off('request', countMutation);
    await page.unroute('**/api/dashboard/operations', handler);
  }
}

async function verifyReconnectClientRace(page, origin, expectedAction) {
  const retry = page.getByRole('button', { name: '대시보드 연결 재시도' });
  const cancel = page.getByRole('button', { name: '대시보드 조회 취소' });
  const nextCard = page.locator('section[aria-labelledby="next-actions-heading"]');
  await retry.waitFor();
  const direct = await fetchOnPage(page, '/api/dashboard/operations');
  assert.equal(direct.status, 200, 'R31_RACE_BASELINE_MISSING');
  const source = JSON.parse(direct.text);
  assert.ok(Array.isArray(source?.data?.next_actions)
    && source.data.next_actions.length === 1, 'R31_RACE_BASELINE_MISSING');
  const stale = { ...source, data: { ...source.data, next_actions: [] } };
  const staleResponseDistinct = source.data.next_actions[0].action === expectedAction
    && stale.data.next_actions.length === 0;
  assert.equal(staleResponseDistinct, true, 'R31_RACE_STALE_NOT_DISTINCT');
  let mutationRequestCount = 0;
  const countMutation = (request) => {
    const url = new URL(request.url());
    if (url.origin === origin && url.pathname.startsWith('/api/') && request.method() !== 'GET') {
      mutationRequestCount += 1;
    }
  };
  page.on('request', countMutation);
  let installed = false;
  try {
    await page.evaluate((oldPayload) => {
      const nativeFetch = window.fetch;
      let calls = 0;
      let firstSignal = null;
      let resolveFirst = null;
      let released = false;
      window.fetch = (input, init) => {
        const url = new URL(typeof input === 'string' ? input : input.url, location.href);
        if (url.origin === location.origin && url.pathname === '/api/dashboard/operations') {
          calls += 1;
          if (calls === 1) {
            firstSignal = init?.signal ?? null;
            // The old client Promise deliberately ignores abort, unlike the routed browser Request.
            return new Promise((resolve) => { resolveFirst = resolve; });
          }
        }
        return nativeFetch.call(window, input, init);
      };
      globalThis.__anvilR31Race = {
        facts: () => ({ calls, firstSignalAborted: firstSignal?.aborted === true, released }),
        releaseOld: () => {
          if (!resolveFirst || released) return false;
          released = true;
          resolveFirst(new Response(JSON.stringify(oldPayload), { status: 200,
            headers: { 'content-type': 'application/json' } }));
          return true;
        },
        restore: () => { window.fetch = nativeFetch; },
      };
    }, stale);
    installed = true;
    await retry.click();
    await verifyObservationTime(page, '재연결 중');
    const held = await page.evaluate(() => globalThis.__anvilR31Race.facts());
    assert.equal(held.calls, 1, 'R31_RACE_HELD_GET_MISSING');
    await cancel.click();
    await verifyObservationTime(page, '조회 취소');
    await nextCard.getByText('CANCELLED', { exact: true }).waitFor();
    const cancelledVisible = await nextCard.locator('li').count() === 0;
    const firstSignalAborted = (await page.evaluate(() => globalThis.__anvilR31Race.facts()))
      .firstSignalAborted;
    assert.ok(cancelledVisible && firstSignalAborted, 'R31_RACE_CANCEL_MISSING');
    const recovery = await verifyManualRefresh(page, origin, expectedAction);
    const recoveredObservedAt = recovery.manualRefreshObservedAt;
    const beforeRelease = await page.evaluate(() => globalThis.__anvilR31Race.facts());
    assert.equal(beforeRelease.calls, 2, 'R31_RACE_NEW_GET_MISSING');
    assert.equal(await nextCard.locator('li').count(), 1, 'R31_RACE_RECOVERY_MISSING');
    const oldPromiseResolvedAfterRecovery = await page.evaluate(() => globalThis.__anvilR31Race.releaseOld());
    assert.equal(oldPromiseResolvedAfterRecovery, true, 'R31_RACE_OLD_RELEASE_MISSING');
    await page.waitForTimeout(50);
    const latestRowPreserved = await nextCard.locator('li').count() === 1
      && (await nextCard.locator('li').first().innerText()).includes(expectedAction)
      && !(await nextCard.innerText()).includes('현재 관측된 다음 조치 0건');
    const latestObservationPreserved = (await page.locator('.dashboard-heading p[aria-live]').innerText())
      === `대시보드 관측 시각 · ${recoveredObservedAt}`;
    assert.ok(staleResponseDistinct && latestRowPreserved && latestObservationPreserved
      && mutationRequestCount === 0, 'R31_RACE_LATE_SUCCESS_OVERWROTE_RECOVERY');
    return { interceptedDashboardCalls: 2, firstSignalAborted, cancelledVisible,
      staleResponseDistinct, oldPromiseResolvedAfterRecovery,
      latestRowPreserved, latestObservationPreserved, recoveredObservedAt,
      mutationRequestCount };
  } finally {
    page.off('request', countMutation);
    if (installed) await page.evaluate(() => {
      globalThis.__anvilR31Race.restore();
      delete globalThis.__anvilR31Race;
    });
  }
}

async function verifyObservationTime(page, expected) {
  const observation = page.locator('.dashboard-heading p[aria-live]');
  await page.locator('.dashboard-heading').getByText(
    `대시보드 관측 시각 · ${expected}`, { exact: true }).waitFor();
  return validateObservationTime({ live: await observation.getAttribute('aria-live'),
    atomic: await observation.getAttribute('aria-atomic'), text: await observation.innerText() }, expected);
}

async function verifyRevokedObservationTime(page, queueSnapshot) {
  return verifyObservationTime(page, queueSnapshot.observed_at);
}

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

const healthCardNames = [['database', 'Database'], ['queue', 'Queue'], ['worker', 'Worker'],
  ['provider', 'LLM Providers'], ['backend', 'Execution Backends'], ['artifact_store', 'Artifact Store']];

function validateHealthCardFacts(snapshot, cards) {
  assert.equal(cards.length, 6, 'R35_HEALTH_API_DOM_MISMATCH');
  for (const [index, [component]] of healthCardNames.entries()) {
    const source = snapshot.health[component];
    const card = cards[index];
    const unknown = snapshot.source_gaps.includes(component) || source.state === 'UNKNOWN';
    assert.ok(card.component === component && card.actions === 0
      && ['HEALTHY', 'LATE', 'EXPIRED', 'UNKNOWN'].includes(source.state)
      && card.paragraphs[0] === (unknown ? 'UNKNOWN' : source.state), 'R35_HEALTH_API_DOM_MISMATCH');
    const observations = card.paragraphs.filter(text => /^(마지막 점검 |오류 )/.test(text));
    assert.deepEqual(observations, unknown ? [] : [
      `마지막 점검 ${source.last_check}`, `오류 ${source.error_count}건`,
    ], 'R35_HEALTH_API_DOM_MISMATCH');
  }
  return cards.length;
}

async function healthCardFacts(page) {
  const section = page.locator('section[aria-labelledby="health-heading"]');
  const cards = [];
  assert.equal(await section.locator('article.status-card').count(), 6, 'R35_HEALTH_API_DOM_MISMATCH');
  for (const [component, label] of healthCardNames) {
    const card = section.locator('article.status-card').filter({has: page.getByRole('heading', {name: label, exact: true})});
    cards.push({component, actions: await card.locator('a, button, input, select').count(),
      paragraphs: await card.locator('p').allInnerTexts()});
  }
  return cards;
}

async function verifyOperatingCards(page, runs = null) {
  const section = page.locator('section[aria-labelledby="operations-heading"]');
  const cards = section.locator('.status-grid > article.status-card');
  const names = ['실행 중', '승인 대기', 'BLOCKED', '필수 Gate 미통과',
    '예상 비용 초과', 'baseline 충돌'];
  assert.equal(await cards.count(), names.length, 'R33_OPERATING_CARDS_MISMATCH');
  for (let index = 0; index < names.length; index += 1) {
    const card = cards.nth(index);
    assert.equal(await card.locator('h3').innerText(), names[index],
      'R33_OPERATING_CARDS_MISMATCH');
    if (runs && index < 3) {
      assert.equal(runs.status, 'AVAILABLE', 'R34_RUN_API_MISMATCH');
      assert.deepEqual([runs.observed_total, runs.active_runs, runs.waiting_approval_runs,
        runs.blocked_runs], [3, 1, 1, 1], 'R34_RUN_API_MISMATCH');
      assert.ok(Number.isFinite(Date.parse(runs.observed_at))
        && Date.parse(runs.observed_at) <= Date.now(), 'R34_RUN_API_MISMATCH');
      assert.deepEqual(await card.locator('p').allInnerTexts(), [
        '1건', '범위 내 관측 3 Run', `Run 관측 시각 · ${runs.observed_at}`,
        'Run 상태 집계 · 실제 프로세스/승인 객체 수가 아닙니다.',
      ], 'R34_RUN_DOM_MISMATCH');
    } else assert.deepEqual(await card.locator('p').allInnerTexts(), [
      'UNAVAILABLE', '이 운영 카드의 read model은 아직 연결되지 않았습니다.',
    ], 'R33_OPERATING_CARDS_MISMATCH');
    assert.equal(await card.locator('a, button, input, select, textarea, [tabindex]').count(),
      0, 'R33_OPERATING_CARDS_MISMATCH');
  }
}

async function verifyDashboardKeyboard(page, requestsPending) {
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')),
    'Anvil Dashboard', 'R23_KEYBOARD_MISMATCH');
  await page.keyboard.press('Tab');
  const toggle = page.locator('button.sidebar-toggle');
  assert.equal(await toggle.evaluate((element) => element === document.activeElement), true,
    'R23_KEYBOARD_MISMATCH');
  const beforeFocused = await toggle.evaluate((element) => element === document.activeElement);
  const firstExpanded = await toggle.getAttribute('aria-expanded');
  assert.equal(firstExpanded, 'true', 'R23_KEYBOARD_MISMATCH');
  await page.keyboard.press('Enter');
  const collapsedExpanded = await toggle.getAttribute('aria-expanded');
  assert.equal(collapsedExpanded, 'false', 'R23_KEYBOARD_MISMATCH');
  await page.keyboard.press('Enter');
  const restoredExpanded = await toggle.getAttribute('aria-expanded');
  assert.equal(restoredExpanded, 'true', 'R23_KEYBOARD_MISMATCH');
  const afterFocused = await toggle.evaluate((element) => element === document.activeElement);
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement?.textContent?.trim()),
    'Dashboard', 'R23_KEYBOARD_MISMATCH');
  const loading = await loadingFacts(page);
  const pendingDuringToggle = requestsPending && loading.cards.every(({ status }) => status === 'LOADING')
    && loading.next.status === 'LOADING' && loading.alerts.status === 'LOADING';
  return { dashboardTabFocused: true, sidebarEnterToggle: true,
    ...validateLoadingKeyboardStability({ beforeFocused, afterFocused,
      firstExpanded, collapsedExpanded, restoredExpanded, pendingDuringToggle }) };
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
      await verifyObservationTime(page, '조회 중');
      markStage('PRE_AUTH_KEYBOARD');
      const keyboard = await verifyDashboardKeyboard(page, observed.size === loadingPaths.size);
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
        if (!released.has('DASHBOARD_API')) await verifyObservationTime(page, '조회 중');
      }
      assert.equal(await page.evaluate(() => document.activeElement?.textContent?.trim()),
        'Dashboard', 'R25_LOADING_KEYBOARD_MISMATCH');
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
  navigationRound += 1;
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
      const captureIndex = responseFacts.length + 1;
      const observedStage = stage;
      const observedRound = navigationRound;
      const capture = captureResponseFact(response).then((result) => ({...result,
        captureIndex, observedStage, observedRound, settledRound: navigationRound}));
      responseCaptures.set(response, capture);
      responseFacts.push(capture);
    });
    const { card, beforeEvidence: loadingEvidence } = await readyDashboard(page, 'goto', apiUrl,
      'PRE_AUTH', responseCaptures,
      (navigate) => holdFirstDashboardRequests(page, apiUrl, navigate));
    await verifyOperatingCards(page);
    markStage('PRE_AUTH_FETCH');
    const preAuth = await fetchOnPage(page, '/api/operations/alerts');
    assert.equal(preAuth.status, 401);
    markStage('PRE_AUTH_CARD_CHECK');
    assert.equal(await card.getByText(alertCode, { exact: true }).count(), 0);
    const preAuthDashboard = await fetchOnPage(page, '/api/dashboard/operations');
    assert.equal(preAuthDashboard.status, 401, 'R25_PRE_AUTH_ACCESSIBILITY_MISMATCH');
    const preAuthNext = page.locator('section[aria-labelledby="next-actions-heading"]');
    await preAuthNext.getByText('BLOCKED', { exact: true }).waitFor();
    const preAuthDetailEvidence = validateR43DetailCleared(
      await preAuthNext.locator('a[href^="#next-action-detail-"]').count(),
      await preAuthNext.locator('[id^="next-action-detail-"]').count());
    await verifyObservationTime(page, '조회 차단');
    const preAuthAlertLive = card.locator('[aria-live]');
    const preAuthActionLive = preAuthNext.locator('[aria-live]');
    const preAuthAlertText = await preAuthAlertLive.innerText();
    const preAuthActionText = await preAuthActionLive.innerText();
    const preAuthAccessible = validatePreAuthAccessibility({
      alertLive: await preAuthAlertLive.getAttribute('aria-live'),
      alertAtomic: await preAuthAlertLive.getAttribute('aria-atomic'),
      alertText: preAuthAlertText, alertRows: await card.locator('li').count(),
      actionLive: await preAuthActionLive.getAttribute('aria-live'),
      actionAtomic: await preAuthActionLive.getAttribute('aria-atomic'),
      actionText: preAuthActionText, actionRows: await preAuthNext.locator('li').count(),
      sensitiveTextVisible: [alertCode, expectedEntity, expectedCause]
        .some((value) => Boolean(value) && (preAuthAlertText + preAuthActionText).includes(value)),
    });
    const preAuthHealthLinks = await page.locator('section[aria-labelledby="health-heading"] a[href^="#health-detail-"]').count();
    assert.equal(preAuthHealthLinks, 0, 'R44_PREAUTH_DETAIL_RETAINED');
    const preAuthQueue = page.locator('section[aria-labelledby="health-heading"] article.status-card')
      .filter({hasText: 'Queue'});
    assert.equal(await preAuthQueue.getByText('격리 작업', {exact: false}).count(),
      0, 'R45_QUEUE_DETAIL_MISMATCH');
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
    assert.equal(callbackLocation.pathname, '/');
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
    const emptyAlertLive = card.locator('[aria-live]');
    const emptyActionLive = nextCard.locator('[aria-live]');
    const emptyAlertLiveText = await emptyAlertLive.innerText();
    const emptyActionLiveText = await emptyActionLive.innerText();
    const emptyAlertLiveMode = await emptyAlertLive.getAttribute('aria-live');
    const emptyActionLiveMode = await emptyActionLive.getAttribute('aria-live');
    const emptyAlertRows = await card.locator('li').count();
    const emptyActionRows = await nextCard.locator('li').count();
    markStage('EMPTY_ASSERT');
    assert.ok(emptyAlertText.includes('이 페이지에 저장된 Critical 기록 없음')
      && emptyActionText.includes('현재 관측된 다음 조치 0건'),
    'R24_EMPTY_STATE_MISMATCH');
    const readinessCard = page.locator('section[aria-labelledby="health-heading"]')
      .locator('article.status-card').filter({hasText: 'Database'}).locator('p').filter({hasText: 'API 준비'});
    await page.waitForFunction(() => {
      const card = [...document.querySelectorAll('section[aria-labelledby="health-heading"] article.status-card')]
        .find((item) => item.textContent?.includes('LLM Providers'));
      return card && !card.textContent?.includes('조회 중입니다.');
    });
    const independentBefore = await readinessCard.innerText();

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
      independentAfter: await readinessCard.innerText(),
      dom: await page.locator('body').innerText(),
    });
    const emptyErrorAccessible = validateEmptyErrorAccessibility({
      emptyAlertLive: emptyAlertLiveMode, emptyActionLive: emptyActionLiveMode,
      emptyAlertText: emptyAlertLiveText, emptyActionText: emptyActionLiveText,
      errorAlertText: await card.locator('[aria-live]').innerText(),
      errorActionLive: await nextCard.locator('[aria-live]').getAttribute('aria-live'),
      errorActionText: await nextCard.locator('[aria-live]').innerText(),
      independentBefore, independentAfter: await readinessCard.innerText(),
      errorBodyVisible: (await page.locator('body').innerText()).includes('r24-private-error-body-marker'),
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
    const storedRunSummary = JSON.parse(storedReady.dashboardResponse.value.body).data.run_summary;
    await verifyOperatingCards(page, storedRunSummary);
    const healthCardCount = validateHealthCardFacts(JSON.parse(storedReady.dashboardResponse.value.body).data,
      await healthCardFacts(page));
    const observedHealth = JSON.parse(storedReady.dashboardResponse.value.body).data.health.database;
    assert.equal(observedHealth.state, 'HEALTHY', 'R35_QA_SOURCE_MISMATCH');
    assert.equal(observedHealth.error_count, 0, 'R35_QA_SOURCE_MISMATCH');
    assert.equal(observedHealth.last_check, '2026-09-27T23:59:50+00:00', 'R35_QA_SOURCE_MISMATCH');
    const storedObservedAt = JSON.parse(storedReady.dashboardResponse.value.body).data.observed_at;
    assert.ok(/^\d{4}-\d{2}-\d{2}T/.test(storedObservedAt)
      && Number.isFinite(Date.parse(storedObservedAt)) && Date.parse(storedObservedAt) <= Date.now(),
    'R26_OBSERVATION_TIME_MISMATCH');
    await verifyObservationTime(page, storedObservedAt);
    markStage('STORED_ALERT_WAIT');
    await card.getByText(alertCode, { exact: true }).waitFor();
    const visibleBeforeRevoke = await card.getByText(alertCode, { exact: true }).count() === 1;
    markStage('STORED_ROW');
    const rowText = await card.locator('li').filter({ hasText: alertCode }).innerText();
    const criticalRow = card.locator('li').filter({hasText: alertCode});
    const criticalParagraphs = await criticalRow.locator('p').allInnerTexts();
    assert.ok(criticalParagraphs.includes(`영향 · ${alerts[0].impact}`)
      && criticalParagraphs.includes(`다음 조치 · ${alerts[0].next_action}`), 'R35_ALERT_API_DOM_MISMATCH');
    assert.equal(await criticalRow.locator('a, button, input, select').count(), 0, 'R35_ALERT_API_DOM_MISMATCH');
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
    const elapsedEvidence = validateStoredElapsed(
      JSON.parse(storedReady.dashboardResponse.value.body).data, expectedAction,
      await actionRow.first().innerText(), alerts[0].observed_at);
    const detailLink = actionRow.first().locator('a[href="#next-action-detail-1"]');
    const detailTarget = actionRow.first().locator('#next-action-detail-1');
    const detailHref = await detailLink.getAttribute('href');
    await detailLink.click();
    const storedDetailEvidence = validateR43Detail(
      JSON.parse(storedReady.dashboardResponse.value.body).data, alerts[0],
      {href: detailHref, id: await detailTarget.getAttribute('id'),
        paragraphs: await detailTarget.locator('p').allInnerTexts(),
        linkCount: await nextCard.locator('a[href^="#next-action-detail-"]').count(),
        detailCount: await nextCard.locator('[id^="next-action-detail-"]').count(),
        url: page.url()}, apiUrl);
    markStage('STORED_NEXT_ACTION');
    manualPhase('STORED_CLICK_BEGIN');
    const manualRefreshEvidence = await verifyManualRefresh(page, apiUrl, expectedAction.action);
    manualPhase('STORED_CLICK_DONE');
    markStage('STORED_NEXT_ACTION');
    manualPhase('SERVICE_ERROR_BEGIN');
    const failedRefresh503 = await verifyManualFailure(page, apiUrl, 503,
      '{"error":"r27-private-error-body-marker"}');
    await verifyOperatingCards(page);
    manualPhase('SERVICE_ERROR_DONE');
    markStage('STORED_NEXT_ACTION');
    manualPhase('SERVICE_RECOVERY_BEGIN');
    await verifyManualRefresh(page, apiUrl, expectedAction.action);
    manualPhase('SERVICE_RECOVERY_DONE');
    markStage('STORED_NEXT_ACTION');
    manualPhase('INVALID_BEGIN');
    const failedRefreshInvalid = await verifyManualFailure(page, apiUrl, 200,
      '{"data":{"observed_at":"2026-09-28T00:00:00+00:00"}}');
    await verifyOperatingCards(page);
    manualPhase('INVALID_DONE');
    markStage('STORED_NEXT_ACTION');
    manualPhase('KEYBOARD_RECOVERY_BEGIN');
    const keyboardRefreshEvidence = await verifyManualRefresh(
      page, apiUrl, expectedAction.action, 'keyboard');
    manualPhase('KEYBOARD_RECOVERY_DONE');
    const quotaRefreshEvidence = await verifyQuotaRefresh(page, apiUrl, expectedAction.action);
    const quotaRecoveryEvidence = await verifyManualRefresh(page, apiUrl, expectedAction.action);
    const { cancelEvidence, cancelRecoveryEvidence } = await verifyDashboardCancellation(
      page, apiUrl, expectedAction.action, quotaRecoveryEvidence.manualRefreshObservedAt);
    const clientRaceEvidence = await verifyClientLateSuccessRace(page, apiUrl, expectedAction.action);
    currentR30Phase = null;
    await verifyManualFailure(page, apiUrl, 503, '{"error":"r31-private-reconnect-marker"}');
    const reconnectEvidence = await verifyDashboardReconnect(page, apiUrl, expectedAction.action);
    await verifyManualFailure(page, apiUrl, 503, '{"error":"r31-private-reconnect-marker"}');
    const reconnectCancelEvidence = await verifyReconnectCancellation(page, apiUrl, expectedAction.action);
    await verifyManualFailure(page, apiUrl, 503, '{"error":"r31-private-reconnect-marker"}');
    const reconnectDeniedEvidence = await verifyReconnectDenied(page, apiUrl, expectedAction.action);
    await verifyManualRefresh(page, apiUrl, expectedAction.action);
    await verifyManualFailure(page, apiUrl, 503, '{"error":"r31-private-reconnect-marker"}');
    const reconnectRaceEvidence = await verifyReconnectClientRace(page, apiUrl, expectedAction.action);
    if (evidenceDir) {
      markStage('EVIDENCE_STORED');
      exportPayload.screens.stored = await captureEvidenceScreen(page,
        [...sensitiveValues, cookie.value]);
    }

    const healthSeed = await issuerClient.post(new URL('/r6-control/seed-health', issuerUrl).href, {
      headers: { 'x-r6-control-token': controlToken },
    });
    assert.equal(healthSeed.status(), 200, 'R44_HEALTH_SEED_FAILED');
    const healthDashboard = await fetchOnPage(page, '/api/dashboard/operations');
    assert.equal(healthDashboard.status, 200, 'R44_HEALTH_DASHBOARD_FAILED');
    const healthSnapshot = JSON.parse(healthDashboard.text).data;
    assert.deepEqual(healthSnapshot.alerts.map(row => row.code),
      [alertCode, 'HEALTH_SIGNAL_LATE'], 'R44_R43_ORDER_CHANGED');
    assert.equal(healthSnapshot.health.queue.state, 'UNKNOWN', 'R46_ZERO_QUEUE_HEALTH_CHANGED');
    assert.ok(healthSnapshot.source_gaps.includes('queue')
      && healthSnapshot.quarantine.length === 0
      && healthSnapshot.alerts.every(row => row.code !== 'QUEUE_JOB_QUARANTINED'),
    'R46_ZERO_QUEUE_EVIDENCE_CHANGED');
    await readyDashboard(page, 'reload', apiUrl, 'STORED', responseCaptures);
    const emptyQueueCard = page.locator('section[aria-labelledby="health-heading"] article.status-card')
      .filter({hasText: 'Queue'});
    assert.equal(await emptyQueueCard.locator('[aria-live] > p').first().innerText(), 'UNKNOWN',
      'R46_ZERO_QUEUE_CARD_CHANGED');
    assert.equal(await emptyQueueCard.getByText('확인된 격리 이상').count(), 0,
      'R46_ZERO_QUEUE_CARD_CHANGED');
    const healthCard = page.locator('section[aria-labelledby="health-heading"] article.status-card')
      .filter({hasText: 'Execution Backends'});
    const healthLink = healthCard.locator('a[href="#health-detail-backend"]');
    await healthLink.waitFor();
    const healthHref = await healthLink.getAttribute('href');
    await healthLink.click();
    const healthTarget = healthCard.locator('#health-detail-backend');
    const healthDetailEvidence = validateR44HealthDetail(healthSnapshot, {
      href: healthHref, id: await healthTarget.getAttribute('id'),
      linkCount: await healthCard.locator('a[href^="#health-detail-"]').count(),
      detailCount: await healthCard.locator('[id^="health-detail-"]').count(),
      paragraphs: await healthTarget.locator('p').allInnerTexts(), url: page.url(),
    }, apiUrl);
    validateR44PreRevokeActions(healthSnapshot, await nextCard.locator('li').count());

    const queueSeed = await issuerClient.post(new URL('/r6-control/seed-quarantine', issuerUrl).href, {
      headers: { 'x-r6-control-token': controlToken },
    });
    assert.equal(queueSeed.status(), 200, 'R45_QUEUE_SEED_FAILED');
    const queueDashboard = await fetchDashboardBeforeReload(page, responseCaptures);
    assert.equal(queueDashboard.status, 200, 'R45_QUEUE_DASHBOARD_FAILED');
    const queueSnapshot = JSON.parse(queueDashboard.text).data;
    await readyDashboard(page, 'reload', apiUrl, 'STORED', responseCaptures);
    const queueCard = page.locator('section[aria-labelledby="health-heading"] article.status-card')
      .filter({hasText: 'Queue'});
    const queueLink = queueCard.locator('a[href="#health-detail-queue"]');
    await queueLink.waitFor();
    const queueHref = await queueLink.getAttribute('href');
    await queueLink.click();
    const queueTarget = queueCard.locator('#health-detail-queue');
    const queueDetailEvidence = validateR45QueueDetail(queueSnapshot, {
      status: await queueCard.locator('[aria-live] > p').first().innerText(),
      confirmed: await queueCard.getByText('확인된 격리 이상').innerText(),
      gap: await queueCard.getByText('Queue source 연결 정보가 부족합니다.').innerText(),
      count: await queueCard.getByText('격리 작업 1건 · 현재 범위').innerText(),
      href: queueHref, id: await queueTarget.getAttribute('id'),
      linkCount: await queueCard.locator('a[href^="#health-detail-"]').count(),
      detailCount: await queueCard.locator('[id^="health-detail-"]').count(),
      paragraphs: await queueTarget.locator('p').allInnerTexts(), url: page.url(),
    }, apiUrl);

    markStage('REVOKE_CONTROL');
    const released = await issuerClient.post(new URL('/r6-control/revoke', issuerUrl).href, {
      headers: { 'x-r6-control-token': controlToken },
    });
    assert.equal(released.status(), 200);
    markStage('REVOKE_FETCH');
    const revoked = await fetchOnPage(page, '/api/operations/alerts');
    assert.equal(revoked.status, 403);
    markStage('REVOKE_DASHBOARD_FETCH');
    const revokedDashboard = await traceRevokedDashboardFetch(page);
    assert.equal(revokedDashboard.status, 403, 'R27_REVOKED_REFRESH_MISMATCH');
    await verifyRevokedObservationTime(page, queueSnapshot);
    markStage('REVOKE_FETCH');
    manualPhase('REVOKED_CLICK_BEGIN');
    let deniedRequestCount = 0;
    const countDeniedRequest = (request) => {
      const url = new URL(request.url());
      if (url.origin === apiUrl && url.pathname === '/api/dashboard/operations'
        && request.method() === 'GET') deniedRequestCount += 1;
    };
    const deniedRefresh = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.origin === apiUrl && url.pathname === '/api/dashboard/operations'
        && response.request().method() === 'GET';
    }, { timeout: 10000 });
    page.on('request', countDeniedRequest);
    try {
      await page.getByRole('button', { name: '대시보드 새로고침' }).click();
      assert.equal((await deniedRefresh).status(), 403, 'R27_REVOKED_REFRESH_MISMATCH');
      await verifyObservationTime(page, '조회 차단');
      await nextCard.getByText('BLOCKED', { exact: true }).waitFor();
      assert.equal(await nextCard.locator('li').count(), 0, 'R27_REVOKED_REFRESH_MISMATCH');
      validateR43DetailCleared(
        await nextCard.locator('a[href^="#next-action-detail-"]').count(),
        await nextCard.locator('[id^="next-action-detail-"]').count());
      assert.equal(deniedRequestCount, 1, 'R27_REVOKED_REFRESH_MISMATCH');
    } finally {
      page.off('request', countDeniedRequest);
    }
    const revokedManualRefreshEvidence = { revokedManualRefreshStatus: 403,
      revokedManualRefreshCleared: true, revokedManualRefreshFromStored: true };
    manualPhase('REVOKED_CLICK_DONE');
    await readyDashboard(page, 'reload', apiUrl, 'REVOKE', responseCaptures);
    await verifyOperatingCards(page);
    await verifyObservationTime(page, '조회 차단');
    markStage('REVOKE_CLEAR');
    await card.getByText('BLOCKED', { exact: true }).waitFor();
    await card.getByText('조회 차단', { exact: false }).waitFor();
    assert.equal(await card.getByText('UNAVAILABLE', { exact: true }).count(), 0);
    const staleCleared = await card.getByText(alertCode, { exact: true }).count() === 0;
    assert.equal(await card.locator('li').count(), 0, 'R35_REVOKED_DATA_RETAINED');
    for (const fact of await healthCardFacts(page)) {
      assert.equal(fact.paragraphs[0], 'BLOCKED', 'R35_REVOKED_DATA_RETAINED');
      assert.ok(!fact.paragraphs.some(text => /^(마지막 점검 |오류 |등록 )/.test(text)), 'R35_REVOKED_DATA_RETAINED');
    }
    markStage('REVOKE_NEXT_ACTION');
    await nextCard.getByText('BLOCKED', { exact: true }).waitFor();
    const revokedActionEvidence = validateRevokedNextAction(revokedDashboard.status,
      await nextCard.innerText(), await nextCard.locator('li').count());
    const revokedDetailCleared = validateR43DetailCleared(
      await nextCard.locator('a[href^="#next-action-detail-"]').count(),
      await nextCard.locator('[id^="next-action-detail-"]').count());
    assert.equal(await page.locator('section[aria-labelledby="health-heading"] a[href^="#health-detail-"]').count(),
      0, 'R44_REVOKED_DETAIL_RETAINED');
    assert.equal(await page.locator('section[aria-labelledby="health-heading"] [id^="health-detail-"]').count(),
      0, 'R44_REVOKED_DETAIL_RETAINED');
    assert.equal(await queueCard.getByText('격리 작업 1건 · 현재 범위').count(),
      0, 'R45_REVOKED_DETAIL_RETAINED');
    const revokedAlertText = await card.locator('[aria-live]').innerText();
    const revokedActionText = await nextCard.locator('[aria-live]').innerText();
    const revokedAccessible = validateRevokedAccessibility({
      alertLive: await card.locator('[aria-live]').getAttribute('aria-live'),
      actionLive: await nextCard.locator('[aria-live]').getAttribute('aria-live'),
      alertText: revokedAlertText, actionText: revokedActionText,
      alertRows: await card.locator('li').count(), actionRows: await nextCard.locator('li').count(),
      staleFocusable: await card.locator('a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])').count()
        + await nextCard.locator('a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])').count(),
      staleTextVisible: [alertCode, expectedAction.action, expectedEntity, expectedCause]
        .some((value) => Boolean(value) && (revokedAlertText + revokedActionText).includes(value)),
    });
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
      healthAlertEvidence: {healthCardCount, healthApiDomMatch: true, sourceGapUnknown: true,
        alertImpactMatch: true, alertNextActionMatch: true, readOnlyText: true, revokedCleared: true,
        source: 'ISOLATED_QA_HEALTH_SIGNAL_NOT_LIVENESS', observedComponent: 'database',
        observedState: observedHealth.state, observedErrorCount: observedHealth.error_count,
        observedAt: observedHealth.last_check},
      runCardsEvidence: {observedAt: storedRunSummary.observed_at,
        observedTotal: storedRunSummary.observed_total, active: storedRunSummary.active_runs,
        waiting: storedRunSummary.waiting_approval_runs, blocked: storedRunSummary.blocked_runs,
        apiDomMatch: true, remainingUnavailable: true, revokedCleared: true},
      preAuthStatus: preAuth.status, authorizationStatus: authorization.status,
      callbackStatus: callback.status, sessionAuthenticated: true,
      cookieSecure: cookie.secure, cookieHttpOnly: cookie.httpOnly,
      storedStatus: stored.status, storedAlertCode: alerts[0].code,
      storedEntity: alerts[0].related_entity_id, storedCause: alerts[0].cause, rowMatches,
      visibleBeforeRevoke, revokedStatus: revoked.status, staleCleared,
      ...storedActionEvidence, ...elapsedEvidence, ...revokedActionEvidence,
      detailEvidence: {...storedDetailEvidence.detailEvidence,
        ...preAuthDetailEvidence, revokedCleared: revokedDetailCleared.preAuthCleared},
      ...healthDetailEvidence,
      ...queueDetailEvidence,
      ...manualRefreshEvidence, ...revokedManualRefreshEvidence,
      failedRefresh503, failedRefreshInvalid, keyboardRefreshEvidence,
      quotaRefreshEvidence, quotaRecoveryEvidence,
      cancelEvidence, cancelRecoveryEvidence,
      clientRaceEvidence,
      reconnectEvidence,
      reconnectCancelEvidence,
      reconnectDeniedEvidence,
      reconnectRaceEvidence,
      ...loadingEvidence, ...preAuthAccessible, ...emptyEvidence, ...errorEvidence,
      ...emptyErrorAccessible, ...revokedAccessible, r23Regression: true,
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

function validateR47DatabaseSnapshot(snapshot) {
  const row = snapshot?.database;
  return row?.state === 'HEALTHY' && row.error_count === 0
    && typeof row.observed_at === 'string' && Number.isFinite(Date.parse(row.observed_at))
    && typeof row.evidence_ref === 'string' && /^sha256:[0-9a-f]{64}$/.test(row.evidence_ref)
    && Array.isArray(snapshot.source_gaps) && !snapshot.source_gaps.includes('database')
    && ['queue', 'worker', 'provider', 'backend', 'artifact_store']
      .every((name) => snapshot.source_gaps.includes(name));
}

function r47ControlOrigin(issuer) {
  return new URL(issuer).origin;
}

async function mainR47() {
  const origin = process.env.ANVIL_F20_R47_API_URL;
  const identity = process.env.ANVIL_F20_R47_ISSUER_URL;
  const control = process.env.ANVIL_F20_R47_CONTROL_TOKEN;
  const secrets = JSON.parse(process.env.ANVIL_F20_R47_SECRET_VALUES_JSON || '[]');
  assert.equal(new URL(origin).hostname, '127.0.0.1');
  assert.equal(new URL(identity).hostname, '127.0.0.1');
  assert.ok(control?.length >= 32 && Array.isArray(secrets));
  const {chromium, request: playwrightRequest} = require(process.env.ANVIL_PLAYWRIGHT_MODULE || 'playwright');
  const browser = await chromium.launch({headless: true, args: ['--no-sandbox']});
  try {
    const context = await browser.newContext({ignoreHTTPSErrors: true,
      viewport: {width: 1920, height: 1080}});
    const issuerClient = await playwrightRequest.newContext({ignoreHTTPSErrors: true});
    try {
      const page = await context.newPage();
      const pageRequests = [];
      page.on('request', (request) => pageRequests.push(request.url()));
      const card = page.locator('section[aria-labelledby="health-heading"] article.status-card')
        .filter({has: page.locator('h3', {hasText: 'Database'})});
      await page.goto(origin + '/');
      const before = await fetchOnPage(page, '/api/dashboard/operations');
      assert.equal(before.status, 401, 'R47_PREAUTH_NOT_DENIED');
      const authorization = await fetchOnPage(page, '/auth/oidc/authorization', {
        method: 'POST', headers: {'Content-Type': 'application/json'}, body: '{}',
      });
      assert.equal(authorization.status, 200, 'R47_AUTH_REQUEST_FAILED');
      const auth = JSON.parse(authorization.text).data;
      const redirect = await issuerClient.get(auth.authorization_url, {maxRedirects: 0});
      assert.equal(redirect.status(), 302, 'R47_ISSUER_REDIRECT_FAILED');
      const callback = new URL(redirect.headers().location);
      assert.equal(callback.origin, origin, 'R47_CALLBACK_ORIGIN_INVALID');
      const completed = await fetchOnPage(page, '/auth/oidc/callback', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({code: callback.searchParams.get('code'),
          state: auth.browser_state, browser_state: auth.browser_state}),
      });
      assert.equal(completed.status, 200, 'R47_CALLBACK_FAILED');
      const cookie = (await context.cookies(origin)).find(({name}) => name === 'anvil_session');
      assert.ok(cookie?.secure && cookie?.httpOnly, 'R47_SESSION_COOKIE_INVALID');
      await page.reload();
      const positive = await fetchOnPage(page, '/api/dashboard/operations');
      assert.equal(positive.status, 200, 'R47_DASHBOARD_POSITIVE_FAILED');
      const healthy = JSON.parse(positive.text).data;
      assert.equal(validateR47DatabaseSnapshot({database: healthy.health?.database,
        source_gaps: healthy.source_gaps}), true, 'R47_DATABASE_SOURCE_INVALID');
      await card.getByText('HEALTHY', {exact: true}).waitFor();
      assert.match(await card.innerText(), /DB 접속·읽기 질의·Migration 일치 관측/);

      const headers = {'x-r47-control-token': control};
      const mismatchControl = await issuerClient.post(r47ControlOrigin(identity) + '/r47-control/mismatch', {headers});
      assert.equal(mismatchControl.status(), 200, 'R47_MISMATCH_CONTROL_FAILED');
      await page.reload();
      const mismatch = await fetchOnPage(page, '/api/dashboard/operations');
      assert.equal(mismatch.status, 200, 'R47_MISMATCH_API_FAILED');
      const mismatchData = JSON.parse(mismatch.text).data;
      assert.equal(mismatchData.health?.database?.state, 'UNKNOWN', 'R47_MISMATCH_NOT_UNKNOWN');
      assert.ok(mismatchData.source_gaps?.includes('database'), 'R47_MISMATCH_GAP_MISSING');
      await card.getByText('UNKNOWN', {exact: true}).waitFor();
      assert.doesNotMatch(await card.innerText(), /DB 접속·읽기 질의·Migration 일치 관측/);

      const restoreControl = await issuerClient.post(r47ControlOrigin(identity) + '/r47-control/restore', {headers});
      assert.equal(restoreControl.status(), 200, 'R47_RESTORE_CONTROL_FAILED');
      await page.reload();
      await card.getByText('HEALTHY', {exact: true}).waitFor();
      const revokeControl = await issuerClient.post(r47ControlOrigin(identity) + '/r47-control/revoke', {headers});
      assert.equal(revokeControl.status(), 200, 'R47_REVOKE_CONTROL_FAILED');
      await page.reload();
      const revoked = await fetchOnPage(page, '/api/dashboard/operations');
      assert.equal(revoked.status, 403, 'R47_REVOKE_NOT_DENIED');
      await card.getByText('BLOCKED', {exact: true}).waitFor();
      assert.doesNotMatch(await card.innerText(), /DB 접속·읽기 질의·Migration 일치 관측|sha256:/);

      const visible = await page.locator('body').innerText();
      assert.ok(pageRequests.length > 0 && pageRequests.every((url) =>
        new URL(url).origin === origin), 'R47_NETWORK_NOT_SAME_ORIGIN');
      assert.ok([...secrets, cookie.value].every((value) => typeof value === 'string' && value.length > 0
        && !visible.includes(value) && !positive.text.includes(value)
        && !mismatch.text.includes(value) && !revoked.text.includes(value)
        && !pageRequests.some((url) => url.includes(value))), 'R47_SECRET_EXPOSED');
      console.log('R47_RESULT ' + JSON.stringify({positive: true, mismatch: true,
        restored: true, revoked: true, sameOrigin: true, secretFree: true,
        pageRequestCount: pageRequests.length,
        evidenceRef: healthy.health.database.evidence_ref}));
    } finally {
      await issuerClient.dispose();
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

async function mainR48() {
  assert.ok(['redirect', 'permission-denied', 'audit-denied', 'audit-unreachable',
    'normal'].includes(r48Scenario), 'R48_SCENARIO_INVALID');
  markR48Stage('BROWSER_LAUNCH');
  const {chromium} = require(process.env.ANVIL_PLAYWRIGHT_MODULE || 'playwright');
  const browser = await chromium.launch({headless: true, args: ['--no-sandbox']});
  try {
    markR48Stage('BROWSER_CONTEXT');
    const context = await browser.newContext({ignoreHTTPSErrors: true});
    if (r48Scenario === 'redirect') await context.addInitScript(() => {
      if (window.opener) window.close = () => { window.__r48CloseRequested = true; };
    });
    const page = await context.newPage();
    const requests = [];
    let redirectRequest = null;
    let redirectResponse = null;
    context.on('request', (request) => {
      const url = new URL(request.url());
      requests.push({url, referer: request.headers().referer || ''});
      if (url.origin === apiUrl && url.pathname === '/' && url.searchParams.has('code')) {
        redirectRequest = {code: url.searchParams.get('code'), state: url.searchParams.get('state')};
      }
    });
    context.on('response', (response) => {
      const url = new URL(response.url());
      if (url.origin === apiUrl && url.pathname === '/' && url.searchParams.has('code'))
        redirectResponse = response;
    });
    markR48Stage('PREAUTH');
    await page.goto(apiUrl + '/');
    const card = page.locator('section[aria-labelledby="critical-alerts-heading"]');
    await card.getByText(alertCode, {exact: true}).waitFor({state: 'hidden'});
    markR48Stage('POPUP_OPEN');
    const popupOpened = context.waitForEvent('page');
    const callbackResponse = page.waitForResponse((response) =>
      response.url().endsWith('/auth/oidc/callback') && response.request().method() === 'POST');
    await page.getByRole('button', {name: '재인증'}).click();
    const popup = await popupOpened;
    await page.getByRole('button', {name: '재인증'}).waitFor({state: 'hidden'});
    markR48Stage('CALLBACK');
    const callback = await callbackResponse;
    assert.equal(callback.status(), 200, 'R48_CALLBACK_REJECTED');
    const csrf = (await callback.json()).data.csrf_token;
    assert.ok(typeof csrf === 'string' && csrf.length > 0, 'R48_CSRF_MISSING');
    if (r48Scenario === 'redirect') {
      markR48Stage('REDIRECT_GET');
      await popup.waitForFunction(() => window.__r48CloseRequested === true);
      assert.ok(redirectRequest?.code && redirectRequest?.state, 'R48_REDIRECT_GET_MISSING');
      markR48Stage('REDIRECT_HEADERS');
      assert.equal(redirectResponse?.headers()['referrer-policy'], 'no-referrer',
        'R48_REDIRECT_HEADER_REFERRER');
      assert.equal(redirectResponse?.headers()['cache-control'], 'no-store',
        'R48_REDIRECT_HEADER_CACHE');
      markR48Stage('REDIRECT_SCRUB');
      const residue = await popup.evaluate(({code, state}) => {
        const html = document.documentElement.outerHTML;
        return {url: location.href, historyState: history.state,
          domLeak: html.includes(code) || html.includes(state)};
      }, redirectRequest);
      assert.equal(residue.url, apiUrl + '/', 'R48_REDIRECT_URL_NOT_SCRUBBED');
      assert.equal(residue.historyState, null, 'R48_HISTORY_STATE_LEAK');
      assert.equal(residue.domLeak, false, 'R48_DOM_SECRET_LEAK');
      markR48Stage('REDIRECT_REFERER');
      const followup = popup.waitForRequest((request) =>
        new URL(request.url()).pathname === '/api/health/ready');
      markR48Stage('REDIRECT_FETCH_DISPATCH');
      await popup.evaluate(() => { void fetch('/api/health/ready').catch(() => {}); });
      const followupRequest = await followup;
      markR48Stage('REDIRECT_REQUEST_CAPTURED');
      const category = classifyR48Referer(followupRequest.headers().referer,
        apiUrl + '/', redirectRequest.code, redirectRequest.state);
      markR48Stage('REDIRECT_HEADER_CLASSIFY');
      writeSync(1, `R48_REFERER_FACT headers=${category}\n`);
      assert.equal(category, 'ABSENT', `R48_REFERER_${category}`);
      await popup.close();
      markR48Stage('DONE');
      console.log('R48_RESULT {"scenario":"redirect","scrubbed":true,"headersSafe":true,"refererSafe":true}');
      await context.close();
      return;
    }
    if (!popup.isClosed()) await popup.waitForEvent('close', {timeout: 5000});
    assert.equal(popup.isClosed(), true, 'R48_POPUP_NOT_CLOSED');
    markR48Stage('ACK');
    const ackButton = card.getByRole('button', {name: '확인'});
    markR48Stage('ACK_BUTTON_WAIT');
    await ackButton.waitFor({timeout: 10000});
    if (r48Scenario === 'normal') {
      const alertRead = await context.request.get(apiUrl + '/api/operations/alerts');
      assert.equal(alertRead.status(), 200);
      const alert = (await alertRead.json()).data.alerts.find((row) => row.status === 'open');
      assert.ok(alert?.sequence && alert?.evidence_hash, 'R48_OPEN_ALERT_MISSING');
      const path = apiUrl + '/api/operations/alerts/' + encodeURIComponent(alert.alert_id) + ':acknowledge';
      const headers = {'content-type': 'application/json', 'x-csrf-token': csrf,
        'if-match': String(alert.sequence), 'x-target-hash': alert.evidence_hash,
        'x-permission-scope': 'operations:alerts:acknowledge', 'x-reason': 'operator_ack'};
      for (const [reason, invalid] of [
        ['origin', {'origin': 'https://other.invalid', 'idempotency-key': 'r48-origin-denied'}],
        ['csrf', {'origin': apiUrl, 'x-csrf-token': 'invalid',
          'idempotency-key': 'r48-csrf-denied'}]]) {
        const denied = await context.request.post(path, {headers: {...headers, ...invalid}, data: '{}'});
        assert.equal(denied.status(), 403, `R48_${reason.toUpperCase()}_NOT_DENIED`);
        const code = (await denied.json())?.error?.code;
        assert.ok(reason === 'origin'
          ? ['ORIGIN_VALIDATION_FAILED', 'CORS_ORIGIN_DENIED'].includes(code)
          : code === 'CSRF_VALIDATION_FAILED', `R48_${reason.toUpperCase()}_WRONG_DENIAL`);
      }
    }
    let auditIntercepted = 0;
    if (r48Scenario === 'audit-unreachable') await page.route('**/api/operations/audit', async (route) => {
      auditIntercepted += 1;
      await route.fulfill({status: 200, contentType: 'application/json',
        body: JSON.stringify({data: {events: [], next_before_sequence: null}})});
    });
    const auditDeniedResponse = r48Scenario === 'audit-denied'
      ? page.waitForResponse((response) => response.url().includes('/api/operations/audit')) : null;
    let ackNetwork = 'PENDING';
    let ackNetworkSettled;
    const ackNetworkTerminal = new Promise((resolve) => { ackNetworkSettled = resolve; });
    const isAckRequest = (request) => request.method() === 'POST'
      && new URL(request.url()).pathname.endsWith(':acknowledge');
    page.on('requestfinished', (request) => {
      if (isAckRequest(request)) { ackNetwork = 'FINISHED'; ackNetworkSettled(); }
    });
    page.on('requestfailed', (request) => {
      if (isAckRequest(request)) { ackNetwork = 'FAILED'; ackNetworkSettled(); }
    });
    const ackResponse = page.waitForResponse((response) =>
      response.url().includes(':acknowledge') && response.request().method() === 'POST',
    {timeout: 10000});
    markR48Stage('ACK_CLICK');
    await ackButton.click({timeout: 10000});
    markR48Stage('ACK_RESPONSE_WAIT');
    const ack = await ackResponse;
    if (r48Scenario === 'permission-denied') {
      markR48Stage('ACK_DENIAL_CHECK');
      assert.equal(ack.status(), 403, 'R48_PERMISSION_NOT_DENIED');
      markR48Stage('ACK_UI_BLOCKED_WAIT');
      await card.getByText(/확인 미검증/).waitFor({timeout: 10000});
      await Promise.race([ackNetworkTerminal, new Promise((resolve) => setTimeout(resolve, 1000))]);
      writeSync(1, `R48_ACK_FACT ui=BLOCKED network=${ackNetwork}\n`);
      markR48Stage('ACK_DENIAL_BODY_WAIT');
      const deniedCode = await readR48DenialCode(ack, 5000, 'R48_PERMISSION_BODY_TIMEOUT');
      markR48Stage('ACK_DENIAL_CODE');
      assert.equal(deniedCode, 'PERMISSION_DENIED', 'R48_PERMISSION_DENIAL_CODE');
      markR48Stage('ACK_BLOCKED_UI_WAIT');
      assert.equal(requests.filter(({url}) => url.pathname.includes(':acknowledge')).length, 1);
      console.log('R48_RESULT {"scenario":"permission-denied","blocked":true,"postCount":1}');
      markR48Stage('ACK_CONTEXT_CLOSE');
      await context.close();
      markR48Stage('DONE');
      return;
    }
    assert.equal(ack.status(), 200, 'R48_ACK_REJECTED');
    const payload = (await ack.json()).data;
    assert.ok(Number.isSafeInteger(payload.ack_sequence) && payload.ack_sequence > 1
      && /^ack:[A-Za-z0-9_-]+$/.test(payload.receipt), 'R48_ACK_PAYLOAD_INVALID');
    markR48Stage('AUDIT');
    if (r48Scenario === 'audit-denied' || r48Scenario === 'audit-unreachable') {
      if (auditDeniedResponse) {
        const denied = await auditDeniedResponse;
        assert.equal(denied.status(), 403, 'R48_AUDIT_PERMISSION_NOT_DENIED');
        assert.equal((await denied.json())?.error?.code, 'PERMISSION_DENIED');
      }
      await card.getByText(/확인 미검증/).waitFor();
      assert.equal(requests.filter(({url}) => url.pathname.includes(':acknowledge')).length, 1,
        'R48_ACK_RETRANSMITTED');
      assert.ok(r48Scenario !== 'audit-unreachable' || auditIntercepted > 0,
        'R48_AUDIT_PAGE_NOT_INTERCEPTED');
      assert.equal(await card.getByText(/확인 완료/).count(), 0, 'R48_FALSE_SUCCESS');
      console.log(`R48_RESULT ${JSON.stringify({scenario: r48Scenario, blocked: true,
        postCount: 1, ackSequence: payload.ack_sequence})}`);
      await context.close();
      return;
    }
    await card.getByText(`확인 완료 · audit sequence ${payload.ack_sequence}`).waitFor();
    const audit = await page.evaluate(async () => {
      const response = await fetch('/api/operations/audit', {credentials: 'same-origin'});
      return {status: response.status, body: await response.json()};
    });
    assert.equal(audit.status, 200);
    const record = audit.body.data.events.find((row) => row.sequence === payload.ack_sequence);
    assert.equal(record?.approval_id, payload.receipt);
    assert.equal(record?.alert_id, payload.alert_id);
    assert.equal(record?.evidence_hash, payload.evidence_hash);
    assert.equal(requests.filter(({url}) => url.pathname.includes(':acknowledge')).length, 1);
    assert.ok(requests.filter(({url}) => url.pathname.startsWith('/api/')
      || url.pathname.startsWith('/auth/')).every(({url}) => url.origin === apiUrl),
    'R48_BROWSER_API_NOT_SAME_ORIGIN');
    console.log(`R48_RESULT ${JSON.stringify({scenario: 'normal', ackSequence: payload.ack_sequence,
      popupClosed: true, auditConfirmed: true, postCount: 1,
      csrfOriginDenied: true})}`);
    markR48Stage('DONE');
    await context.close();
  } finally {
    await browser.close();
  }
}

if (r48DiagnosticSelfTest) {
  assert.equal(await readR48DenialCode({json: async () => ({error: {code: 'PERMISSION_DENIED'}})},
    10, 'R48_PERMISSION_BODY_TIMEOUT'), 'PERMISSION_DENIED');
  await assert.rejects(readR48DenialCode({json: () => new Promise(() => {})},
    1, 'R48_PERMISSION_BODY_TIMEOUT'), /R48_PERMISSION_BODY_TIMEOUT/);
  const root = 'https://anvil.invalid/';
  assert.equal(classifyR48Referer(undefined, root, 'private-code', 'private-state'), 'ABSENT');
  assert.equal(classifyR48Referer('', root, 'private-code', 'private-state'), 'ABSENT');
  assert.equal(classifyR48Referer(root, root, 'private-code', 'private-state'), 'CLEAN_ROOT');
  assert.equal(classifyR48Referer(root + '?code=private-code&state=private-state',
    root, 'private-code', 'private-state'), 'CODE_OR_STATE');
  assert.equal(classifyR48Referer(root + 'other', root, 'private-code', 'private-state'), 'OTHER');
  assert.equal(safeR48FailureCode({message: 'R48_REDIRECT_HEADER_REFERRER private-code'}),
    'R48_REDIRECT_HEADER_REFERRER');
  assert.equal(safeR48FailureCode({message: 'R48_PRIVATE_CODE private-token'}),
    'UNCLASSIFIED');
  assert.equal(safeR48FailureCode({message: 'private-token R48_REDIRECT_HEADER_REFERRER'}),
    'UNCLASSIFIED');
  assert.equal(safeR48Stage('REDIRECT_HEADERS'), 'REDIRECT_HEADERS');
  assert.equal(safeR48Stage('ACK_BUTTON_WAIT'), 'ACK_BUTTON_WAIT');
  assert.equal(safeR48Stage('ACK_RESPONSE_WAIT'), 'ACK_RESPONSE_WAIT');
  assert.equal(safeR48Stage('ACK_UI_BLOCKED_WAIT'), 'ACK_UI_BLOCKED_WAIT');
  assert.equal(safeR48Stage('private-token'), 'BOOTSTRAP');
  console.log('R48_DIAGNOSTIC_SELF_TEST_PASS');
} else if (r47SelfTest) {
  const healthy = {database: {state: 'HEALTHY', observed_at: '2026-10-05T00:00:00+00:00',
    error_count: 0, evidence_ref: 'sha256:' + 'a'.repeat(64)},
    source_gaps: ['queue', 'worker', 'provider', 'backend', 'artifact_store']};
  assert.equal(validateR47DatabaseSnapshot(healthy), true);
  assert.equal(validateR47DatabaseSnapshot({...healthy, source_gaps: ['database']}), false);
  assert.equal(validateR47DatabaseSnapshot({...healthy, database: {...healthy.database,
    evidence_ref: 'postgresql://private'}}), false);
  assert.equal(r47ControlOrigin('https://127.0.0.1:48123/realms/anvil'),
    'https://127.0.0.1:48123');
  console.log('R47_BROWSER_SELF_TEST_PASS');
} else if (auditSelfTest) {
  const names = ['database', 'queue', 'worker', 'provider', 'backend', 'artifact_store'];
  const snapshot = {source_gaps: ['provider'], health: Object.fromEntries(names.map(name =>
    [name, {state: 'LATE', last_check: '2026-09-30T00:00:00+00:00', error_count: 2}]))};
  const cards = names.map(name => ({component: name, actions: 0, paragraphs: name === 'provider'
    ? ['UNKNOWN'] : ['LATE', '마지막 점검 2026-09-30T00:00:00+00:00', '오류 2건']}));
  assert.equal(validateHealthCardFacts(snapshot, cards), 6);
  for (const change of [{paragraphs: ['HEALTHY']}, {actions: 1},
    {paragraphs: ['LATE', '마지막 점검 forged', '오류 0건']}]) {
    assert.throws(() => validateHealthCardFacts(snapshot, [{...cards[0], ...change}, ...cards.slice(1)]),
      /R35_HEALTH_API_DOM_MISMATCH/);
  }
  assert.throws(() => validateHealthCardFacts(snapshot, cards.slice(1)), /R35_HEALTH_API_DOM_MISMATCH/);
  assert.equal(hasFailedRequestReason({ errorText: 'synthetic-abort' }), true);
  for (const failure of [null, '', 'synthetic-abort', {}, { errorText: '' },
    { errorText: ' ' }, { errorText: 1 }]) {
    assert.equal(hasFailedRequestReason(failure), false);
  }
  assert.equal(safeR30FailureCode({ message: 'R30_CANCEL_BROWSER_ABORT_MISSING private-secret' }),
    'R30_CANCEL_BROWSER_ABORT_MISSING');
  assert.equal(safeR30FailureCode({ message: 'R30_PRIVATE_SECRET private-secret' }),
    'R30_UNCLASSIFIED');
  assert.equal(safeR44FailureCode({message: 'R44_HEALTH_DETAIL_MISMATCH private-token'}),
    'R44_HEALTH_DETAIL_MISMATCH');
  assert.equal(safeR44FailureCode({message: 'R44_PRIVATE_TOKEN private-token'}),
    'UNCLASSIFIED');
  assert.equal(safeR44FailureCode({message: 'R27_REVOKED_REFRESH_MISMATCH private-token'}),
    'R27_REVOKED_REFRESH_MISMATCH');
  assert.equal(safeFailureName({name: 'AssertionError'}), 'AssertionError');
  assert.equal(safeFailureName({name: 'private-token'}), 'Error');
  assert.ok([...manualPhases].every((value) => /^[A-Z_]+$/.test(value)),
    'R27_MANUAL_PHASE_GRAMMAR_INVALID');
  assert.throws(() => manualPhase('PRIVATE_TOKEN_VALUE'), /R27_MANUAL_PHASE_INVALID/);
  for (const manualStage of ['STORED_NEXT_ACTION', 'REVOKE_FETCH']) {
    assert.match(manualStage, /^[A-Z_]+$/, 'R27_STAGE_CLASSIFIER_GRAMMAR_MISMATCH');
    assert.equal(progressStages.has(manualStage), true, 'R27_STAGE_CLASSIFIER_GRAMMAR_MISMATCH');
  }
  const manualFacts = { requestCount: 1, requestPath: '/api/dashboard/operations', requestMethod: 'GET',
    loadingDisabled: true, loadingTime: '대시보드 관측 시각 · 조회 중', staleActionCount: 0,
    providerDuring: 'LOADING',
    alertBefore: 'alert-safe', alertDuring: 'alert-safe', readinessBefore: '마지막 확인 · JUST NOW',
    readinessDuring: '마지막 확인 · JUST NOW', responseStatus: 200,
    observedAt: '2026-09-28T00:00:00+00:00' };
  assert.deepEqual(validateManualRefreshFacts(manualFacts, manualFacts.observedAt),
    { manualRefreshClicked: true, manualRefreshRequestCount: 1,
      manualRefreshObservedAt: manualFacts.observedAt, independentCardsPreserved: true });
  for (const changed of [{ requestCount: 2 }, { requestPath: '/api/providers' },
    { loadingDisabled: false }, { staleActionCount: 1 }, { responseStatus: 403 },
    { providerDuring: 'changed' }, { observedAt: 'wrong' }]) {
    assert.throws(() => validateManualRefreshFacts({ ...manualFacts, ...changed },
      manualFacts.observedAt), /R27_MANUAL_REFRESH_MISMATCH/);
  }
  assert.deepEqual(validateObservationTime({ live: 'polite', atomic: 'true',
    text: '대시보드 관측 시각 · 조회 중' }, '조회 중'), { observationTimeAccessible: true });
  assert.throws(() => validateObservationTime({ live: 'polite', atomic: 'true',
    text: '대시보드 관측 시각 · JUST NOW' }, '2026-09-30T00:00:00+00:00'),
  /R26_OBSERVATION_TIME_MISMATCH/);
  assert.throws(() => validateObservationTime({ live: null, atomic: 'true',
    text: '대시보드 관측 시각 · 조회 차단' }, '조회 차단'),
  /R26_OBSERVATION_TIME_MISMATCH/);
  assert.deepEqual(validateEmptyErrorAccessibility({ emptyAlertLive: 'polite',
    emptyActionLive: 'polite', emptyAlertText: '이 페이지에 저장된 Critical 기록 없음',
    emptyActionText: '현재 관측된 다음 조치 0건', errorAlertText: '이 페이지에 저장된 Critical 기록 없음',
    errorActionLive: 'polite', errorActionText: 'UNAVAILABLE\n다음 조치를 확인할 수 없습니다.',
    independentBefore: '등록 9 / 9', independentAfter: '등록 9 / 9', errorBodyVisible: false }),
  { r25EmptyErrorDistinct: true });
  assert.throws(() => validateEmptyErrorAccessibility({ emptyAlertLive: 'polite',
    emptyActionLive: 'polite', emptyAlertText: '이 페이지에 저장된 Critical 기록 없음',
    emptyActionText: '현재 관측된 다음 조치 0건', errorAlertText: '이 페이지에 저장된 Critical 기록 없음',
    errorActionLive: 'polite', errorActionText: '현재 관측된 다음 조치 0건',
    independentBefore: '등록 9 / 9', independentAfter: '등록 9 / 9', errorBodyVisible: false }),
  /R25_EMPTY_ERROR_ACCESSIBILITY_MISMATCH/);
  assert.deepEqual(validateRevokedAccessibility({ alertLive: 'polite', actionLive: 'polite',
    alertText: 'BLOCKED\n조회 차단', actionText: 'BLOCKED\n조회 차단',
    alertRows: 0, actionRows: 0, staleFocusable: 0, staleTextVisible: false }),
  { r25RevokedRowsInaccessible: true });
  assert.throws(() => validateRevokedAccessibility({ alertLive: 'polite', actionLive: 'polite',
    alertText: 'BLOCKED\n조회 차단', actionText: 'BLOCKED\n조회 차단',
    alertRows: 0, actionRows: 0, staleFocusable: 1, staleTextVisible: false }),
  /R25_REVOKED_ACCESSIBILITY_MISMATCH/);
  assert.deepEqual(validatePreAuthAccessibility({ alertLive: 'polite', alertAtomic: 'true',
    alertText: 'UNAVAILABLE\n저장 경고 기록을 확인할 수 없습니다.', alertRows: 0,
    actionLive: 'polite', actionAtomic: 'true',
    actionText: 'BLOCKED\n조회 차단 · 다음 조치를 표시하지 않습니다.', actionRows: 0,
    sensitiveTextVisible: false }), { r25PreAuthAccessible: true });
  assert.throws(() => validatePreAuthAccessibility({ alertLive: null, alertAtomic: 'true',
    alertText: 'UNAVAILABLE', alertRows: 0, actionLive: 'polite', actionAtomic: 'true',
    actionText: 'BLOCKED', actionRows: 0, sensitiveTextVisible: false }),
  /R25_PRE_AUTH_ACCESSIBILITY_MISMATCH/);
  assert.deepEqual(validateLoadingKeyboardStability({ beforeFocused: true,
    afterFocused: true, firstExpanded: 'true', collapsedExpanded: 'false',
    restoredExpanded: 'true', pendingDuringToggle: true }),
  { r25LoadingKeyboardStable: true });
  assert.throws(() => validateLoadingKeyboardStability({ beforeFocused: true,
    afterFocused: false, firstExpanded: 'true', collapsedExpanded: 'false',
    restoredExpanded: 'true', pendingDuringToggle: true }),
  /R25_LOADING_KEYBOARD_MISMATCH/);
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
  const elapsedSnapshot = { observed_at: '2026-09-28T00:05:00+00:00',
    alerts: [{ ...actionAlert, status: 'open', observed_at: '2026-09-28T00:00:00+00:00' }],
    next_actions: [expectedAction] };
  const elapsedRow = `${displayed}\n경과시간 · 5분`;
  assert.deepEqual(validateStoredElapsed(elapsedSnapshot, expectedAction, elapsedRow,
    elapsedSnapshot.alerts[0].observed_at),
    { elapsedEvidence: { snapshotObservedAt: elapsedSnapshot.observed_at,
      alertObservedAt: '2026-09-28T00:00:00+00:00', elapsedMinutes: 5,
      uniqueAlertMatch: true, rowDisplayed: true } });
  const detailAlert = {...elapsedSnapshot.alerts[0], code: 'WORKER_LEASE_EXPIRED',
    source: 'worker', impact: 'Run ownership cannot be trusted', evidence_hash: 'sha256:qa'};
  const detailFacts = {href: '#next-action-detail-1', id: 'next-action-detail-1',
    paragraphs: ['코드 · WORKER_LEASE_EXPIRED', '출처 · worker',
      '영향 · Run ownership cannot be trusted', '발생 시각 · 2026-09-28T00:00:00+00:00',
      '증거 hash · sha256:qa'], linkCount: 1, detailCount: 1,
    url: apiUrl + '/#next-action-detail-1'};
  assert.deepEqual(validateR43Detail({...elapsedSnapshot, alerts: [detailAlert]},
    detailAlert, detailFacts, apiUrl), {detailEvidence: {samePageFragment: true,
    detailApiDomMatch: true, detailCount: 1, placeholderNavigation: false}});
  for (const bad of [{...detailFacts, url: apiUrl + '/operations'},
    {...detailFacts, paragraphs: [...detailFacts.paragraphs.slice(0, 4), '증거 hash · wrong']},
    {...detailFacts, detailCount: 2}]) {
    assert.throws(() => validateR43Detail({...elapsedSnapshot, alerts: [detailAlert]},
      detailAlert, bad, apiUrl), /R43_DETAIL_MISMATCH/);
  }
  assert.deepEqual(validateR43DetailCleared(0, 0), {preAuthCleared: true});
  assert.throws(() => validateR43DetailCleared(1, 0), /R43_DETAIL_RETAINED/);
  const healthAlert = {code: 'HEALTH_SIGNAL_LATE', source: 'environment',
    related_entity_id: 'backend', cause: 'Health observation requires attention',
    impact: 'Current service health requires review',
    observed_at: '2026-09-28T00:00:00+00:00', evidence_hash: `sha256:${'a'.repeat(64)}`,
    deep_link: '/operations/health', status: 'open'};
  const healthSnapshot = {health: {database: {state: 'HEALTHY', error_count: 0},
    backend: {state: 'LATE', error_count: 0, evidence_ref: healthAlert.evidence_hash,
      detail_path: healthAlert.deep_link}}, alerts: [
        {code: 'WORKER_LEASE_EXPIRED', source: 'worker', related_entity_id: 'r6-run'}, healthAlert]};
  const healthFacts = {href: '#health-detail-backend', id: 'health-detail-backend',
    linkCount: 1, detailCount: 1, paragraphs: [
      `코드 · ${healthAlert.code}`, `출처 · ${healthAlert.source}`, `원인 · ${healthAlert.cause}`,
      `영향 · ${healthAlert.impact}`, `발생 시각 · ${healthAlert.observed_at}`,
      `증거 hash · ${healthAlert.evidence_hash}`], url: apiUrl + '/#health-detail-backend'};
  assert.equal(validateR44HealthDetail(healthSnapshot, healthFacts, apiUrl)
    .healthDetailEvidence.apiDomMatch, true);
  const beforeRevoke = {...healthSnapshot, next_actions: [
    {priority: 'critical', target: 'r6-run', action: 'REVIEW_WORKER_LEASE'},
    {priority: 'warning', target: 'backend', action: 'CHECK_SOURCE_HEALTH'},
  ]};
  assert.equal(validateR44PreRevokeActions(beforeRevoke, 2), true);
  assert.throws(() => validateR44PreRevokeActions(beforeRevoke, 1),
    /R44_PRE_REVOKE_ACTION_MISMATCH/);
  assert.throws(() => validateR44HealthDetail({...healthSnapshot,
    alerts: [...healthSnapshot.alerts, healthAlert]}, healthFacts, apiUrl),
  /R44_HEALTH_DETAIL_MISMATCH/);
  for (const bad of [{...healthFacts, url: 'https://outside.invalid/'},
    {...healthFacts, paragraphs: [...healthFacts.paragraphs.slice(0, 5), '증거 hash · wrong']},
    {...healthFacts, linkCount: 2}]) {
    assert.throws(() => validateR44HealthDetail(healthSnapshot, bad, apiUrl), /R44_HEALTH_DETAIL_MISMATCH/);
  }
  const queueAlert = {code: 'QUEUE_JOB_QUARANTINED', source: 'orchestrator',
    related_entity_id: 'r45-qa-job', status: 'open', deep_link: '/operations/queue',
    cause: 'Queue job reached quarantine', impact: 'Run cannot advance automatically',
    observed_at: '2026-09-28T00:00:00+00:00', evidence_hash: `sha256:${'b'.repeat(64)}`};
  const queueSnapshot = {observed_at: new Date(Date.now() - 1000).toISOString(),
    source_gaps: ['queue'], quarantine: [{job_id: 'r45-qa-job', attempts: 2,
    reason: 'EXHAUSTED'}], alerts: [queueAlert], health: {database: {state: 'HEALTHY'},
      backend: {state: 'LATE'}, queue: {state: 'UNKNOWN'}}};
  const queueFacts = {status: 'UNKNOWN', confirmed: '확인된 격리 이상',
    gap: 'Queue source 연결 정보가 부족합니다.', count: '격리 작업 1건 · 현재 범위',
    href: '#health-detail-queue', id: 'health-detail-queue', linkCount: 1,
    detailCount: 1, paragraphs: [
      `코드 · ${queueAlert.code}`, `출처 · ${queueAlert.source}`, `원인 · ${queueAlert.cause}`,
      `영향 · ${queueAlert.impact}`, `발생 시각 · ${queueAlert.observed_at}`,
      `증거 hash · ${queueAlert.evidence_hash}`], url: apiUrl + '/#health-detail-queue'};
  assert.equal(validateR45QueueDetail(queueSnapshot, queueFacts, apiUrl)
    .queueDetailEvidence.apiDomMatch, true);
  assert.notEqual(queueSnapshot.observed_at, manualFacts.observedAt,
    'R46_QUEUE_SNAPSHOT_MUST_BE_NEWER_THAN_MANUAL_REFRESH');
  const observedLabel = `대시보드 관측 시각 · ${queueSnapshot.observed_at}`;
  const observationStub = {
    getByText: (label, options) => {
      assert.equal(label, observedLabel, 'R46_REVOKED_EXPECTED_OLD_OBSERVATION');
      assert.deepEqual(options, {exact: true});
      return {waitFor: async () => {}};
    },
    getAttribute: async (name) => name === 'aria-live' ? 'polite' : 'true',
    innerText: async () => observedLabel,
  };
  assert.deepEqual(await verifyRevokedObservationTime({locator: () => observationStub}, queueSnapshot),
    {observationTimeAccessible: true});
  for (const bad of [{...queueFacts, href: '/operations/queue'},
    {...queueFacts, count: '격리 작업 2건 · 현재 범위'},
    {...queueFacts, paragraphs: [...queueFacts.paragraphs.slice(0, 5), '증거 hash · wrong']}]) {
    assert.throws(() => validateR45QueueDetail(queueSnapshot, bad, apiUrl),
      /R45_QUEUE_DETAIL_MISMATCH/);
  }
  for (const bad of [
    {...queueSnapshot, source_gaps: []},
    {...queueSnapshot, health: {...queueSnapshot.health, queue: {state: 'HEALTHY'}}},
    {...queueSnapshot, observed_at: new Date(Date.now() - 61000).toISOString()},
    {...queueSnapshot, observed_at: new Date(Date.now() + 1000).toISOString()},
    {...queueSnapshot, alerts: [...queueSnapshot.alerts, queueAlert]},
    {...queueSnapshot, alerts: [...queueSnapshot.alerts, {...queueAlert, source: 'worker'}]},
  ]) assert.throws(() => validateR45QueueDetail(bad, queueFacts, apiUrl),
    /R45_QUEUE_DETAIL_MISMATCH/);
  for (const bad of [
    { ...elapsedSnapshot, alerts: [...elapsedSnapshot.alerts, ...elapsedSnapshot.alerts] },
    { ...elapsedSnapshot, alerts: [{ ...elapsedSnapshot.alerts[0], status: 'resolved' }] },
    { ...elapsedSnapshot, alerts: [{ ...elapsedSnapshot.alerts[0], observed_at: 'bad' }] },
    { ...elapsedSnapshot, next_actions: [...elapsedSnapshot.next_actions, expectedAction] },
  ]) assert.throws(() => validateStoredElapsed(bad, expectedAction, elapsedRow,
    elapsedSnapshot.alerts[0].observed_at),
    /R32_ELAPSED_MISMATCH/);
  assert.throws(() => validateStoredElapsed(elapsedSnapshot, expectedAction,
    displayed + '\n경과시간 확인 불가', elapsedSnapshot.alerts[0].observed_at),
  /R32_ELAPSED_MISMATCH/);
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
  let releaseDashboardBody;
  const dashboardBody = new Promise((resolve) => { releaseDashboardBody = resolve; });
  const dashboardResponse = {status: () => 200, url: () => apiUrl + '/api/dashboard/operations',
    request: () => ({method: () => 'GET'}),
    allHeaders: async () => ({'content-type': 'application/json'}), text: () => dashboardBody};
  const captureMap = new WeakMap([[dashboardResponse, captureResponseFact(dashboardResponse)]]);
  let waitedForResponse = false;
  const dashboardPage = {
    waitForResponse: async (predicate) => {
      waitedForResponse = true;
      assert.equal(predicate(dashboardResponse), true);
      return dashboardResponse;
    },
    evaluate: async () => ({status: 200, text: '{}'}),
  };
  let dashboardFetchSettled = false;
  const dashboardFetch = fetchDashboardBeforeReload(dashboardPage, captureMap)
    .then((value) => { dashboardFetchSettled = true; return value; });
  await new Promise((resolve) => setTimeout(resolve, 0));
  const settledBeforeCapture = dashboardFetchSettled;
  releaseDashboardBody('{}');
  assert.deepEqual(await dashboardFetch, {status: 200, text: '{}'});
  assert.equal(waitedForResponse, true, 'R45_DASHBOARD_CAPTURE_WAIT_MISSING');
  assert.equal(settledBeforeCapture, false, 'R45_DASHBOARD_CAPTURE_SETTLED_EARLY');
  const traceCallbacks = new Map();
  const traceLines = [];
  const traceRequest = {url: () => apiUrl + '/api/dashboard/operations', method: () => 'GET'};
  const tracePhase = (phase) => traceCallbacks.get('console')({type: () => 'info',
    text: () => `R46_FETCH_PHASE_${phase}`});
  const tracePage = {
    exposeFunction: async () => { throw new Error('SETUP_SHOULD_NOT_RUN'); },
    on: (name, callback) => traceCallbacks.set(name, callback),
    off: (name) => traceCallbacks.delete(name),
    evaluate: async () => {
      traceCallbacks.get('console')({type: () => 'error', text: () => 'private-token'});
      traceCallbacks.get('console')({type: () => 'info', text: () => 'private-response-body'});
      tracePhase('FETCH_PENDING');
      assert.ok(traceLines.some((line) => line.endsWith('page=FETCH_PENDING')),
        'R46_FETCH_PENDING_FACT_NOT_EMITTED_BEFORE_AWAIT');
      traceCallbacks.get('request')(traceRequest);
      traceCallbacks.get('response')({url: () => traceRequest.url(), request: () => traceRequest,
        status: () => 403});
      tracePhase('HEADERS');
      tracePhase('BODY_PENDING');
      throw Object.assign(new Error('private-response-body'), {name: 'TimeoutError'});
    },
  };
  await assert.rejects(traceRevokedDashboardFetch(tracePage, (line) => traceLines.push(line)),
    /private-response-body/);
  assert.equal(traceLines.at(-1),
    'R46_REVOKE_DASHBOARD_TRACE request=SEEN response=SEEN status=403 finished=NONE page=BODY_PENDING');
  assert.ok(traceLines.every((line) => /^R46_REVOKE_DASHBOARD_TRACE request=(NONE|SEEN) /
    .test(line) && !line.includes('private-')));
  assert.equal(traceCallbacks.size, 0);
  const setupCallbacks = new Map();
  const setupLines = [];
  const setupPage = {
    on: (name, callback) => {
      if (name === 'response') throw new Error('private-setup-detail');
      setupCallbacks.set(name, callback);
    },
    off: (name) => setupCallbacks.delete(name),
    evaluate: async () => { throw new Error('EVALUATE_SHOULD_NOT_RUN'); },
  };
  await assert.rejects(traceRevokedDashboardFetch(setupPage, (line) => setupLines.push(line)),
    /private-setup-detail/);
  assert.deepEqual(setupLines, [
    'R46_REVOKE_DASHBOARD_TRACE request=NONE response=NONE status=0 finished=NONE page=START',
  ]);
  assert.equal(setupCallbacks.size, 0);
  console.log('R6_AUDIT_SELF_TEST_PASS');
} else {
  writeSync(1, `${r48Mode ? 'R48' : r47Mode ? 'R47' : 'R6'}_NODE_STARTED\n`);
  process.on('unhandledRejection', (error) => {
    emitSafeFailure(error);
    process.exitCode = 1;
  });
  process.on('uncaughtException', (error) => {
    emitSafeFailure(error);
    process.exitCode = 1;
  });
  (r48Mode ? mainR48() : r47Mode ? mainR47() : main()).catch((error) => {
    emitSafeFailure(error);
    if (r48Mode) { process.exitCode = 1; return; }
    if (currentR30Phase !== null) {
      writeSync(2, `R30_DIAG code=${safeR30FailureCode(error)}\n`);
    }
    writeSync(2, `${r48Mode ? 'R48_BROWSER_FAILED' : r47Mode ? 'R47_BROWSER_FAILED' : 'R6_BROWSER_FAILED'} stage=${progressStages.has(stage) ? stage : 'BOOTSTRAP'} `
      + `class=${safeFailureName(error)}\n`);
    process.exitCode = 1;
  });
}
