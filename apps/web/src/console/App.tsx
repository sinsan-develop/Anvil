import {Component, useCallback, useEffect, useRef, useState, type ErrorInfo, type ReactNode} from 'react';
import {DASHBOARD_OPERATION_DEFINITIONS, MENU_ITEMS} from '../features/app-shell/app-shell-model.js';
import {scanProjects} from '../api/projects-client.js';
import {createProjectsState, reduceProjects} from '../features/projects/projects-state.js';

type Readiness = 'NOT CONNECTED' | 'READY';
type AppProps = {route?: string};
type ProjectsState = {status: string; reason: string; repository: {branch: string; head: string; dirtyPaths: number; untrackedPaths: number} | null; baseline: {status: string; reason: string}; mutationAllowed: boolean};
type ProviderRegistration = {status: 'VALID'; registered: number} | {status: 'UNAVAILABLE'; registered: null}
  | {status: 'LOADING'};
type DashboardSignalState = {status: 'HEALTHY' | 'LATE' | 'EXPIRED' | 'UNKNOWN' | 'UNAVAILABLE' | 'BLOCKED';
  lastCheck: string | null; errorCount: number | null; detail?: HealthDetail | null};
type HealthDetail = {code: string; source: string; cause: string; impact: string;
  observedAt: string; evidenceHash: string};
type DashboardSignalComponent = 'database' | 'queue' | 'worker' | 'provider' | 'backend' | 'artifact_store';
type NextAction = {priority: 'critical' | 'warning'; reason: string; target: string;
  action: string; deep_link: string};
type NextActionDetail = {code: string; source: string; impact: string;
  observedAt: string; evidenceHash: string};
type NextActionRow = NextAction & {elapsedMinutes: number | null; detail: NextActionDetail | null};
type RunSummary = {observedAt: string; observedTotal: number;
  active: number; waiting: number; blocked: number};
type NextActionsState = {status: 'LOADED'; actions: NextActionRow[]} | {status: 'LOADING' | 'RECONNECTING' | 'UNAVAILABLE' | 'BLOCKED' | 'QUOTA' | 'CANCELLED'};
type DashboardQueueState = {status: 'LOADED'; observed: number; observedAt: string | null; sourceGap: boolean;
  health: Record<DashboardSignalComponent, DashboardSignalState>; database: DashboardSignalState;
  nextActions: NextActionsState; runSummary: RunSummary | null}
  | {status: 'LOADING' | 'RECONNECTING' | 'UNAVAILABLE' | 'BLOCKED' | 'QUOTA' | 'CANCELLED'};
type CriticalAlert = {alert_id: string; code: string; source: string; observed_at: string;
  owner_id: string | null; cause: string; impact: string; next_action: string;
  related_entity_id: string; status: 'open' | 'acknowledged'};
type CriticalAlertsState = {status: 'LOADED'; alerts: CriticalAlert[]; partial: boolean;
  nextBeforeSequence: number | null; seenAlertIds: string[]} | {status: 'LOADING' | 'UNAVAILABLE' | 'BLOCKED'};

const READ_ONLY_MENU = new Map(MENU_ITEMS.map((item) => [item.href, item.label]));
const KNOWN_DETAIL_SOURCES = new Set([...READ_ONLY_MENU.keys(),
  '/operations/workers', '/operations/queue', '/operations/cost']);
const PROVIDER_IDS = new Set(['cerebras', 'groq', 'mistral', 'openrouter', 'upstage', 'gemini', 'anthropic', 'openai', 'ollama']);
const PROVIDER_UNAVAILABLE: ProviderRegistration = {status: 'UNAVAILABLE', registered: null};
const PROVIDER_LOADING: ProviderRegistration = {status: 'LOADING'};
const DASHBOARD_QUEUE_LOADING: DashboardQueueState = {status: 'LOADING'};
const DASHBOARD_QUEUE_RECONNECTING: DashboardQueueState = {status: 'RECONNECTING'};
const DASHBOARD_QUEUE_UNAVAILABLE: DashboardQueueState = {status: 'UNAVAILABLE'};
const DASHBOARD_QUEUE_BLOCKED: DashboardQueueState = {status: 'BLOCKED'};
const DASHBOARD_QUEUE_QUOTA: DashboardQueueState = {status: 'QUOTA'};
const DASHBOARD_QUEUE_CANCELLED: DashboardQueueState = {status: 'CANCELLED'};
const DASHBOARD_SNAPSHOT_FIELDS = ['observed_at', 'health', 'queue', 'quarantine',
  'worker', 'budget', 'reservations', 'providers', 'deployments', 'source_gaps',
  'alerts', 'next_actions', 'run_summary'];
const DASHBOARD_HEALTH_COMPONENTS = ['database', 'queue', 'worker', 'provider', 'backend', 'artifact_store'];
const DASHBOARD_HEALTH_FIELDS = ['state', 'observed_at', 'stale_after_seconds',
  'last_check', 'error_count', 'detail_path', 'evidence_ref'];
const DASHBOARD_QUEUE_FIELDS = ['job_id', 'run_id', 'state', 'available_at', 'attempts',
  'max_attempts', 'lease_epoch', 'lease_expires_at', 'dependency_ids', 'conflict_keys',
  'priority', 'required_capability', 'input_verified', 'backoff_until'];
const DASHBOARD_GAPS = new Set([...DASHBOARD_HEALTH_COMPONENTS, 'deployment']);
const DASHBOARD_SIGNAL_COMPONENTS: DashboardSignalComponent[] = ['database', 'queue', 'worker', 'provider', 'backend', 'artifact_store'];
const NEXT_ACTION_FIELDS = ['priority', 'reason', 'target', 'action', 'deep_link'];
const ALERTS_UNAVAILABLE: CriticalAlertsState = {status: 'UNAVAILABLE'};
const ALERTS_LOADING: CriticalAlertsState = {status: 'LOADING'};
const ALERTS_BLOCKED: CriticalAlertsState = {status: 'BLOCKED'};
const ALERT_FIELDS = ['alert_id', 'sequence', 'level', 'source', 'category', 'code',
  'related_entity_id', 'dedupe_key', 'detector_rule_revision', 'cause', 'impact',
  'next_action', 'deep_link', 'evidence_hash', 'status', 'owner_id', 'observed_at',
  'project_id', 'environment_id'];

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function exactFields(value: Record<string, unknown>, fields: string[]): boolean {
  return Object.keys(value).length === fields.length && fields.every((field) => Object.hasOwn(value, field));
}

function nonempty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function validObservedAt(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) return false;
  const [, year, month, day, hour, minute, second] = match;
  return Number(hour) < 24 && Number(minute) < 60 && Number(second) < 60
    && new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))).toISOString().slice(0, 10) === value.slice(0, 10)
    && Number.isFinite(Date.parse(value));
}

function nonnegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function uniqueNames(value: unknown, allowed?: Set<string>): value is string[] {
  return Array.isArray(value) && value.length <= 100
    && value.every((item) => nonempty(item) && (!allowed || allowed.has(item)))
    && new Set(value).size === value.length;
}

function validDashboardQueueRow(value: unknown): boolean {
  if (!record(value) || !exactFields(value, DASHBOARD_QUEUE_FIELDS)) return false;
  return nonempty(value.job_id) && nonempty(value.run_id)
    && ['PENDING', 'CLAIMED', 'SUCCEEDED', 'QUARANTINED'].includes(value.state as string)
    && validObservedAt(value.available_at) && nonnegativeInteger(value.attempts)
    && Number.isSafeInteger(value.max_attempts) && (value.max_attempts as number) >= 1
    && nonnegativeInteger(value.lease_epoch)
    && (value.lease_expires_at === null || validObservedAt(value.lease_expires_at))
    && uniqueNames(value.dependency_ids) && uniqueNames(value.conflict_keys)
    && value.priority === 'UNKNOWN' && value.required_capability === 'UNKNOWN'
    && typeof value.input_verified === 'boolean' && validObservedAt(value.backoff_until);
}

function dashboardNextActions(value: unknown, alerts: unknown[], snapshotTime: string,
  health: Record<string, unknown>, gaps: string[]): NextActionsState {
  if (!Array.isArray(value) || value.length > 100 || !value.every((item) =>
    record(item) && exactFields(item, NEXT_ACTION_FIELDS)
    && (item.priority === 'critical' || item.priority === 'warning')
    && nonempty(item.reason) && nonempty(item.target) && nonempty(item.action)
    && nonempty(item.deep_link))) return {status: 'UNAVAILABLE'};
  const actions = value as NextAction[];
  const matches = (alert: unknown, action: NextAction): alert is Record<string, unknown> =>
    record(alert) && (alert.status === 'open' || alert.status === 'acknowledged')
    && alert.level === action.priority && alert.cause === action.reason
    && alert.related_entity_id === action.target && alert.next_action === action.action
    && alert.deep_link === action.deep_link;
  const validAlert = (alert: Record<string, unknown>) => exactFields(alert, ALERT_FIELDS)
    && nonempty(alert.alert_id) && Number.isSafeInteger(alert.sequence) && (alert.sequence as number) > 0
    && validObservedAt(alert.observed_at)
    && (alert.status === 'open' ? alert.owner_id === null : nonempty(alert.owner_id))
    && ['source', 'category', 'code', 'dedupe_key', 'detector_rule_revision',
      'impact', 'evidence_hash', 'project_id', 'environment_id'].every((key) => nonempty(alert[key]));
  const sameAction = (left: NextAction, right: NextAction) =>
    NEXT_ACTION_FIELDS.every((field) => left[field as keyof NextAction] === right[field as keyof NextAction]);
  return {status: 'LOADED', actions: actions.map((action) => {
    const candidates = alerts.filter((alert) => matches(alert, action));
    const unique = candidates.length === 1 && validAlert(candidates[0])
      && actions.filter((other) => sameAction(other, action)).length === 1
      && Date.parse(snapshotTime) <= Date.now();
    const at = unique && validObservedAt(candidates[0].observed_at)
      ? Date.parse(candidates[0].observed_at) : NaN;
    const elapsed = Math.floor((Date.parse(snapshotTime) - at) / 60_000);
    const confirmed = unique && Number.isSafeInteger(elapsed) && elapsed >= 0;
    const alert = candidates.length === 1 && record(candidates[0]) ? candidates[0] : null;
    const healthSignal = DASHBOARD_SIGNAL_COMPONENTS.includes(action.target as DashboardSignalComponent)
      && !gaps.includes(action.target) ? health[action.target] : null;
    const healthCode = record(healthSignal) && (healthSignal.error_count as number) > 0
      ? 'HEALTH_ERROR_COUNT' : record(healthSignal)
        && ['UNKNOWN', 'LATE', 'EXPIRED'].includes(healthSignal.state as string)
        ? `HEALTH_SIGNAL_${healthSignal.state}` : null;
    const safePath = /^\/[A-Za-z0-9/_-]*$/.test(action.deep_link)
      && !action.deep_link.startsWith('//');
    const isHealthAlert = alert !== null && (alert.code === 'HEALTH_ERROR_COUNT'
      || (typeof alert.code === 'string' && alert.code.startsWith('HEALTH_SIGNAL_'))
      || alert.source === 'environment' || action.action === 'CHECK_SOURCE_HEALTH'
      || action.reason === 'Health observation requires attention');
    const safeHealthSource = alert !== null && alert.source === 'environment'
      && alert.code === healthCode && action.action === 'CHECK_SOURCE_HEALTH'
      && record(healthSignal) && validDashboardSignal(healthSignal, snapshotTime)
      && healthSignal.detail_path === action.deep_link
      && healthSignal.evidence_ref === alert.evidence_hash;
    const safeSource = safePath && (isHealthAlert ? safeHealthSource
      : KNOWN_DETAIL_SOURCES.has(action.deep_link));
    const detailAlert = confirmed && safeSource ? alert : null;
    return {...action, elapsedMinutes: confirmed ? elapsed : null,
      detail: detailAlert ? {code: detailAlert.code as string, source: detailAlert.source as string,
        impact: detailAlert.impact as string, observedAt: detailAlert.observed_at as string,
        evidenceHash: detailAlert.evidence_hash as string} : null};
  })};
}

function validDashboardSignal(value: unknown, snapshotTime: string): value is Record<string, unknown> {
  if (!record(value) || !exactFields(value, DASHBOARD_HEALTH_FIELDS)) return false;
  if (value.state === 'UNKNOWN' && DASHBOARD_HEALTH_FIELDS.slice(1).every((field) => value[field] === null)) return true;
  return ['HEALTHY', 'LATE', 'EXPIRED', 'UNKNOWN'].includes(value.state as string)
    && validObservedAt(value.observed_at) && value.last_check === value.observed_at
    && Date.parse(value.observed_at) <= Date.parse(snapshotTime)
    && Date.parse(value.observed_at) <= Date.now()
    && Number.isSafeInteger(value.stale_after_seconds) && (value.stale_after_seconds as number) > 0
    && nonnegativeInteger(value.error_count)
    && typeof value.evidence_ref === 'string' && /^sha256:[0-9a-f]{64}$/.test(value.evidence_ref)
    && typeof value.detail_path === 'string' && !value.detail_path.startsWith('//')
    && /^\/[A-Za-z0-9/_-]+$/.test(value.detail_path);
}

function dashboardSignals(health: Record<string, unknown>, gaps: string[], snapshotTime: string):
    Record<DashboardSignalComponent, DashboardSignalState> {
  const unavailable: DashboardSignalState = {status: 'UNAVAILABLE', lastCheck: null, errorCount: null};
  const signal = (name: DashboardSignalComponent): DashboardSignalState => {
    if (Date.parse(snapshotTime) > Date.now() || !validDashboardSignal(health[name], snapshotTime)) return unavailable;
    const row = health[name] as Record<string, unknown>;
    if (gaps.includes(name) || row.state === 'UNKNOWN') return {status: 'UNKNOWN', lastCheck: null, errorCount: null};
    return {status: row.state as DashboardSignalState['status'],
      lastCheck: row.last_check as string | null, errorCount: row.error_count as number | null};
  };
  return Object.fromEntries(DASHBOARD_SIGNAL_COMPONENTS.map((name) => [name, signal(name)])) as
    Record<DashboardSignalComponent, DashboardSignalState>;
}

function dashboardHealthDetails(health: Record<string, unknown>, alerts: unknown[], gaps: string[],
  snapshotTime: string): Record<DashboardSignalComponent, HealthDetail | null> {
  return Object.fromEntries(DASHBOARD_SIGNAL_COMPONENTS.map((component) => {
    const signal = health[component];
    if (gaps.includes(component) || Date.parse(snapshotTime) > Date.now()
      || !validDashboardSignal(signal, snapshotTime) || signal.state === 'UNKNOWN') return [component, null];
    const code = (signal.error_count as number) > 0 ? 'HEALTH_ERROR_COUNT'
      : ['LATE', 'EXPIRED'].includes(signal.state as string) ? `HEALTH_SIGNAL_${signal.state}` : null;
    if (!code) return [component, null];
    const candidates = alerts.filter((item) => record(item) && item.source === 'environment'
      && item.related_entity_id === component && typeof item.code === 'string'
      && (item.code === 'HEALTH_ERROR_COUNT' || item.code.startsWith('HEALTH_SIGNAL_')));
    if (candidates.length !== 1 || !record(candidates[0])) return [component, null];
    const alert = candidates[0];
    if (!exactFields(alert, ALERT_FIELDS) || !nonempty(alert.alert_id)
      || !Number.isSafeInteger(alert.sequence) || (alert.sequence as number) <= 0
      || !['open', 'acknowledged'].includes(alert.status as string)
      || (alert.status === 'open' ? alert.owner_id !== null : !nonempty(alert.owner_id))
      || alert.code !== code || alert.deep_link !== signal.detail_path
      || alert.evidence_hash !== signal.evidence_ref
      || !validObservedAt(alert.observed_at) || Date.parse(alert.observed_at) > Date.parse(snapshotTime)
      || !['code', 'source', 'cause', 'impact', 'evidence_hash'].every((key) => safeAlertText(alert[key]))
      || !/^sha256:[0-9a-f]{64}$/.test(alert.evidence_hash as string)) return [component, null];
    return [component, {code: alert.code, source: alert.source, cause: alert.cause,
      impact: alert.impact, observedAt: alert.observed_at,
      evidenceHash: alert.evidence_hash} as HealthDetail];
  })) as Record<DashboardSignalComponent, HealthDetail | null>;
}

function dashboardRunSummary(value: unknown): RunSummary | null {
  if (!record(value) || !exactFields(value, ['status', 'observed_at', 'observed_total',
    'active_runs', 'waiting_approval_runs', 'blocked_runs']) || value.status !== 'AVAILABLE'
    || !validObservedAt(value.observed_at) || Date.parse(value.observed_at) > Date.now()) return null;
  const counts = [value.observed_total, value.active_runs, value.waiting_approval_runs, value.blocked_runs];
  if (!counts.every((count) => typeof count === 'number' && Number.isInteger(count) && count >= 0 && count <= 100)) return null;
  const [total, active, waiting, blocked] = counts as number[];
  if (active + waiting + blocked > total) return null;
  return {observedAt: value.observed_at, observedTotal: total, active, waiting, blocked};
}

export function DashboardOperatingCards({value}: {value: DashboardQueueState}) {
  const runs = value.status === 'LOADED' ? value.runSummary : null;
  const numbers = runs ? [runs.active, runs.waiting, runs.blocked] : [];
  return <section aria-labelledby="operations-heading"><h2 id="operations-heading">운영 상태</h2>
    <div className="status-grid">{DASHBOARD_OPERATION_DEFINITIONS.map(({key, label}, index) =>
      <article className="status-card" key={key}><h3>{label}</h3>
        {runs && index < 3 ? <><p className="status-ready">{numbers[index]}건</p>
          <p>범위 내 관측 {runs.observedTotal} Run</p><p>Run 관측 시각 · {runs.observedAt}</p>
          <p>Run 상태 집계 · 실제 프로세스/승인 객체 수가 아닙니다.</p></>
          : <><p className="status-unavailable">UNAVAILABLE</p>
            <p>이 운영 카드의 read model은 아직 연결되지 않았습니다.</p></>}
      </article>)}</div>
  </section>;
}

function classifyDashboardQueue(payload: unknown): DashboardQueueState {
  if (!record(payload) || !exactFields(payload, ['data', 'request_id'])
    || !nonempty(payload.request_id) || !record(payload.data)
    || !exactFields(payload.data, DASHBOARD_SNAPSHOT_FIELDS)) return DASHBOARD_QUEUE_UNAVAILABLE;
  const snapshot = payload.data;
  if (!validObservedAt(snapshot.observed_at) || !record(snapshot.health)
    || !exactFields(snapshot.health, DASHBOARD_HEALTH_COMPONENTS)
    || !DASHBOARD_HEALTH_COMPONENTS.filter((name) => name !== 'database').every((name) => {
      const health = snapshot.health as Record<string, unknown>;
      return record(health[name]) && exactFields(health[name], DASHBOARD_HEALTH_FIELDS)
        && ['UNKNOWN', 'HEALTHY', 'LATE', 'EXPIRED', 'DEGRADED', 'UNHEALTHY'].includes(health[name].state as string);
    })
    || !Array.isArray(snapshot.queue) || snapshot.queue.length > 100
    || !snapshot.queue.every(validDashboardQueueRow)
    || new Set(snapshot.queue.map((row) => row.job_id)).size !== snapshot.queue.length
    || !uniqueNames(snapshot.source_gaps, DASHBOARD_GAPS)
    || !['quarantine', 'worker', 'budget', 'reservations', 'providers',
      'deployments', 'alerts', 'next_actions'].every((name) => Array.isArray(snapshot[name]))) {
    return DASHBOARD_QUEUE_UNAVAILABLE;
  }
  const health = dashboardSignals(snapshot.health as Record<string, unknown>, snapshot.source_gaps, snapshot.observed_at);
  const details = dashboardHealthDetails(snapshot.health as Record<string, unknown>, snapshot.alerts as unknown[],
    snapshot.source_gaps, snapshot.observed_at);
  DASHBOARD_SIGNAL_COMPONENTS.forEach((component) => {
    if (details[component]) health[component].detail = details[component];
  });
  return {status: 'LOADED', observed: snapshot.queue.length,
    runSummary: Date.parse(snapshot.observed_at) <= Date.now() ? dashboardRunSummary(snapshot.run_summary) : null,
    observedAt: Date.parse(snapshot.observed_at) <= Date.now() ? snapshot.observed_at : null,
    sourceGap: snapshot.source_gaps.includes('queue'),
    nextActions: dashboardNextActions(snapshot.next_actions, snapshot.alerts as unknown[],
      snapshot.observed_at, snapshot.health as Record<string, unknown>, snapshot.source_gaps),
    database: health.database, health};
}

export function NextActionsCard({value}: {value: DashboardQueueState}) {
  const state: NextActionsState = value.status === 'LOADED' ? value.nextActions : {status: value.status};
  const occurrences = new Map<string, number>();
  return <section className="status-card" aria-labelledby="next-actions-heading">
    <h3 id="next-actions-heading">Next Actions</h3>
    <div aria-live="polite" aria-atomic="true">
      {state.status !== 'LOADED' ? <><p className={state.status === 'LOADING' || state.status === 'RECONNECTING'
        ? undefined : 'status-unavailable'}>{state.status}</p>
        <p>{state.status === 'LOADING' ? '다음 조치 조회 중입니다.'
          : state.status === 'RECONNECTING' ? '재연결 중 · 다음 조치를 표시하지 않습니다.'
          : state.status === 'BLOCKED' ? '조회 차단 · 다음 조치를 표시하지 않습니다.'
          : state.status === 'QUOTA' ? '조회 제한 · 다음 조치를 표시하지 않습니다.'
          : state.status === 'CANCELLED' ? '조회 취소 · 다음 조치를 표시하지 않습니다.'
          : '다음 조치를 확인할 수 없습니다.'}</p></> : state.actions.length === 0
        ? <p>현재 관측된 다음 조치 0건 · 전체 범위의 부재는 확인되지 않았습니다.</p>
        : <ul>{state.actions.map((item, index) => {
          const detailId = `next-action-detail-${index + 1}`;
          const identity = JSON.stringify(item);
          const occurrence = (occurrences.get(identity) ?? 0) + 1;
          occurrences.set(identity, occurrence);
          return <li key={`${identity}:${occurrence}`}><strong>{item.priority}</strong>
            <p>원인 · {item.reason}</p><p>대상 · {item.target}</p>
            <p>조치 · {item.action}</p>
            <p>{item.elapsedMinutes === null ? '경과시간 확인 불가' : `경과시간 · ${item.elapsedMinutes}분`}</p>
            {item.detail ? <><p><a href={`#${detailId}`}>상세 원인 보기</a></p>
              <div id={detailId}><p>코드 · {item.detail.code}</p><p>출처 · {item.detail.source}</p>
                <p>영향 · {item.detail.impact}</p><p>발생 시각 · {item.detail.observedAt}</p>
                <p>증거 hash · {item.detail.evidenceHash}</p></div></>
              : <p>상세 원인 확인 불가</p>}
          </li>;
        })}</ul>}
    </div>
  </section>;
}

export async function loadDashboardQueue(signal: AbortSignal, request: typeof fetch = fetch): Promise<DashboardQueueState> {
  try {
    const response = await request('/api/dashboard/operations', {
      credentials: 'same-origin', signal, headers: {Accept: 'application/json'},
    });
    if (!response.ok) {
      await response.text();
      return response.status === 401 || response.status === 403
        ? DASHBOARD_QUEUE_BLOCKED : response.status === 429
          ? DASHBOARD_QUEUE_QUOTA : DASHBOARD_QUEUE_UNAVAILABLE;
    }
    return classifyDashboardQueue(await response.json());
  } catch {
    return DASHBOARD_QUEUE_UNAVAILABLE;
  }
}

export function DashboardObservationTime({value}: {value: DashboardQueueState}) {
  const observation = value.status === 'LOADED' && value.observedAt !== null
    ? value.observedAt : value.status === 'LOADING' ? '조회 중'
      : value.status === 'RECONNECTING' ? '재연결 중'
      : value.status === 'BLOCKED' ? '조회 차단'
        : value.status === 'QUOTA' ? '조회 제한'
          : value.status === 'CANCELLED' ? '조회 취소' : '확인 불가';
  return <p aria-live="polite" aria-atomic="true">대시보드 관측 시각 · {observation}</p>;
}

export function QueueHealthCard({value}: {value: DashboardQueueState}) {
  return <DashboardSignalCard label="Queue" component="queue" value={value}>
      {value.status === 'LOADED' ? <>
        <p>범위 내 관측 {value.observed}건</p>
        <p>{value.sourceGap ? 'Queue source 연결 정보가 부족합니다.'
          : 'Queue source의 완전성은 확인되지 않았습니다.'}</p>
      </> : <p>{value.status === 'LOADING' ? 'Queue 조회 중입니다.'
          : value.status === 'RECONNECTING' ? '재연결 중 · Queue 기록을 표시하지 않습니다.'
          : value.status === 'BLOCKED' ? '조회 차단 · Queue 기록을 표시하지 않습니다.'
          : value.status === 'QUOTA' ? '조회 제한 · Queue 기록을 표시하지 않습니다.'
          : value.status === 'CANCELLED' ? '조회 취소 · Queue 기록을 표시하지 않습니다.'
          : 'Queue 상태 정보를 확인할 수 없습니다.'}</p>}
  </DashboardSignalCard>;
}

export function DashboardSignalCard({label, component, value, children}:
    {label: string; component: DashboardSignalComponent; value: DashboardQueueState; children?: ReactNode}) {
  const signal = value.status === 'LOADED' ? value.health[component]
    : {status: value.status, lastCheck: null, errorCount: null, detail: null};
  return <article className="status-card"><h3>{label}</h3>
    <div aria-live="polite" aria-atomic="true">
      <p className={signal.status === 'HEALTHY' ? 'status-ready'
        : signal.status === 'LOADING' || signal.status === 'RECONNECTING'
          ? undefined : 'status-unavailable'}>{signal.status}</p>
      {signal.status === 'LOADING' ? <p>{label} 조회 중입니다.</p> : null}
      {signal.status === 'RECONNECTING' ? <p>재연결 중 · {label} 상태 정보를 표시하지 않습니다.</p> : null}
      {signal.status === 'QUOTA' ? <p>조회 제한 · {label} 상태 정보를 표시하지 않습니다.</p> : null}
      {signal.status === 'CANCELLED' ? <p>조회 취소 · {label} 상태 정보를 표시하지 않습니다.</p> : null}
      {signal.lastCheck !== null ? <p>마지막 점검 {signal.lastCheck}</p> : null}
      {signal.errorCount !== null ? <p>오류 {signal.errorCount}건</p> : null}
      {signal.detail ? <><p><a href={`#health-detail-${component}`}>상세 원인 보기</a></p>
        <div id={`health-detail-${component}`}><p>코드 · {signal.detail.code}</p>
          <p>출처 · {signal.detail.source}</p><p>원인 · {signal.detail.cause}</p>
          <p>영향 · {signal.detail.impact}</p><p>발생 시각 · {signal.detail.observedAt}</p>
          <p>증거 hash · {signal.detail.evidenceHash}</p></div></>
        : null}
      {children}
    </div>
  </article>;
}

function safeAlertText(value: unknown): value is string {
  if (!nonempty(value) || value.length > 2048) return false;
  let inspection = value;
  const normalize = (text: string) => text.normalize('NFKC').replace(/[\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g, '');
  for (let index = 0; index < 4; index += 1) {
    const normalized = normalize(inspection);
    try { inspection = /%[0-9a-f]{2}/i.test(normalized) ? decodeURIComponent(normalized) : normalized; } catch { return false; }
    if (inspection === normalized) break;
  }
  inspection = normalize(inspection);
  return !/(?:%[0-9a-f]{2}|\/\/|www\.|localhost|127\.0\.0\.1|authorization\s*:|(?:api[\s_-]*key|token|password|secret)\s*[:=]\s*\S|-----BEGIN.*PRIVATE KEY)/i.test(inspection);
}

function classifyCriticalAlerts(payload: unknown, beforeSequence?: number): CriticalAlertsState {
  if (!record(payload) || !record(payload.data)
    || !Object.keys(payload).every((key) => key === 'data' || key === 'request_id')
    || (Object.hasOwn(payload, 'request_id') && !nonempty(payload.request_id))
    || !exactFields(payload.data, ['alerts', 'next_before_sequence'])) return ALERTS_UNAVAILABLE;
  const {alerts, next_before_sequence: cursor} = payload.data;
  if (!Array.isArray(alerts) || alerts.length > 100
    || (cursor !== null && (!Number.isSafeInteger(cursor) || (cursor as number) < 1))) return ALERTS_UNAVAILABLE;
  const ids = new Set<string>();
  let previousSequence = 0;
  const visible: CriticalAlert[] = [];
  for (const item of alerts) {
    if (!record(item) || !exactFields(item, ALERT_FIELDS)
      || !Number.isSafeInteger(item.sequence) || (item.sequence as number) < 1
      || (item.sequence as number) <= previousSequence
      || (beforeSequence !== undefined && (item.sequence as number) >= beforeSequence)
      || !nonempty(item.alert_id) || ids.has(item.alert_id)
      || (item.level !== 'critical' && item.level !== 'warning')
      || (item.status !== 'open' && item.status !== 'acknowledged' && item.status !== 'resolved')
      || !validObservedAt(item.observed_at)
      || !safeAlertText(item.impact) || !safeAlertText(item.next_action)
      || (item.owner_id !== null && !nonempty(item.owner_id))
      || !['source', 'category', 'code', 'related_entity_id', 'dedupe_key',
        'detector_rule_revision', 'cause', 'impact', 'next_action', 'deep_link',
        'evidence_hash', 'project_id', 'environment_id'].every((key) => nonempty(item[key]))) {
      return ALERTS_UNAVAILABLE;
    }
    previousSequence = item.sequence as number;
    ids.add(item.alert_id);
    if (item.level === 'critical' && item.status !== 'resolved') {
      visible.push({alert_id: item.alert_id, code: item.code as string, source: item.source as string,
        observed_at: item.observed_at, owner_id: item.owner_id as string | null,
        cause: item.cause as string, impact: item.impact, next_action: item.next_action,
        related_entity_id: item.related_entity_id as string,
        status: item.status});
    }
  }
  if (cursor !== null && (alerts.length === 0 || cursor !== alerts[0].sequence
    || (beforeSequence !== undefined && (cursor as number) >= beforeSequence))) return ALERTS_UNAVAILABLE;
  if (beforeSequence !== undefined && alerts.length === 0) return ALERTS_UNAVAILABLE;
  return {status: 'LOADED', alerts: visible.reverse(), partial: cursor !== null,
    nextBeforeSequence: cursor as number | null, seenAlertIds: [...ids]};
}

export async function loadCriticalAlerts(signal: AbortSignal, request: typeof fetch = fetch): Promise<CriticalAlertsState> {
  try {
    const response = await request('/api/operations/alerts', {
      credentials: 'same-origin', signal, headers: {Accept: 'application/json'},
    });
    if (!response.ok) {
      await response.text();
      return response.status === 403 ? ALERTS_BLOCKED : ALERTS_UNAVAILABLE;
    }
    return classifyCriticalAlerts(await response.json());
  } catch {
    return ALERTS_UNAVAILABLE;
  }
}

export async function loadOlderCriticalAlerts(current: CriticalAlertsState, signal: AbortSignal,
  request: typeof fetch = fetch): Promise<CriticalAlertsState> {
  if (current.status !== 'LOADED' || current.nextBeforeSequence === null) return ALERTS_UNAVAILABLE;
  const beforeSequence = current.nextBeforeSequence;
  try {
    const response = await request('/api/operations/alerts', {
      credentials: 'same-origin', signal,
      headers: {Accept: 'application/json', 'x-alert-before-sequence': String(beforeSequence)},
    });
    if (!response.ok) {
      await response.text();
      return response.status === 403 ? ALERTS_BLOCKED : ALERTS_UNAVAILABLE;
    }
    const page = classifyCriticalAlerts(await response.json(), beforeSequence);
    if (page.status !== 'LOADED' || page.seenAlertIds.some((id) => current.seenAlertIds.includes(id))) {
      return ALERTS_UNAVAILABLE;
    }
    return {status: 'LOADED', alerts: [...current.alerts, ...page.alerts], partial: page.partial,
      nextBeforeSequence: page.nextBeforeSequence, seenAlertIds: [...current.seenAlertIds, ...page.seenAlertIds]};
  } catch {
    return ALERTS_UNAVAILABLE;
  }
}

export async function loadOlderCriticalAlertsOnce(current: CriticalAlertsState, signal: AbortSignal,
  inFlight: {current: boolean}, request: typeof fetch = fetch): Promise<CriticalAlertsState | null> {
  if (inFlight.current) return null;
  inFlight.current = true;
  try {
    return await loadOlderCriticalAlerts(current, signal, request);
  } finally {
    inFlight.current = false;
  }
}

export function CriticalAlertsCard({value, onLoadOlder, loadingOlder = false}: {value: CriticalAlertsState;
  onLoadOlder?: () => void; loadingOlder?: boolean}) {
  return <section className="status-card" aria-labelledby="critical-alerts-heading">
    <h3 id="critical-alerts-heading">Critical Alerts</h3>
    <div aria-live="polite" aria-atomic="true">
      {value.status !== 'LOADED' ? <><p className={value.status === 'LOADING' ? undefined : 'status-unavailable'}>{value.status}</p>
        <p>{value.status === 'BLOCKED' ? '조회 차단 · 저장 경고 기록을 표시하지 않습니다.'
          : value.status === 'LOADING' ? 'Critical Alerts 조회 중입니다.'
          : '저장 경고 기록을 확인할 수 없습니다.'}</p></> : <>
        <p>저장된 Critical 기록 · 현재 페이지</p>
        {value.alerts.length === 0 ? <p>이 페이지에 저장된 Critical 기록 없음</p> :
          <ul>{value.alerts.map((alert) => <li key={alert.alert_id}>
            <strong>{alert.code}</strong><span> · {alert.source}</span>
            <p>발생시각 · {alert.observed_at}</p>
            <p>담당자 · {alert.owner_id ?? '미배정'} · {alert.status}</p>
            <p>원인 · {alert.cause}</p><p>대상 · {alert.related_entity_id}</p>
            <p>영향 · {alert.impact}</p><p>다음 조치 · {alert.next_action}</p>
          </li>)}</ul>}
        {value.partial && <p>과거 페이지 미조회 · 부분 결과</p>}
        {value.partial && onLoadOlder && <button type="button" disabled={loadingOlder}
          onClick={onLoadOlder}>과거 저장 경고 더 보기</button>}
        {loadingOlder && <p>과거 저장 경고를 읽는 중입니다.</p>}
        {!value.partial && <p>저장된 페이지 조회 종료</p>}
        <p>탐지 실행·경고 완전성·신선도는 확인되지 않았습니다.</p>
      </>}
    </div>
  </section>;
}

function classifyProviderRegistration(payload: unknown): ProviderRegistration {
  if (typeof payload !== 'object' || payload === null || !('data' in payload)) return PROVIDER_UNAVAILABLE;
  const rows = payload.data;
  if (!Array.isArray(rows) || rows.length !== PROVIDER_IDS.size) return PROVIDER_UNAVAILABLE;
  const seen = new Set<string>();
  let registered = 0;
  for (const row of rows) {
    if (typeof row !== 'object' || row === null) return PROVIDER_UNAVAILABLE;
    const {provider_id, credential_status, health_status} = row as Record<string, unknown>;
    if (typeof provider_id !== 'string' || !PROVIDER_IDS.has(provider_id) || seen.has(provider_id)
      || (credential_status !== 'REGISTERED' && credential_status !== 'MISSING')
      || health_status !== 'NOT_CHECKED') return PROVIDER_UNAVAILABLE;
    seen.add(provider_id);
    if (credential_status === 'REGISTERED') registered += 1;
  }
  return {status: 'VALID', registered};
}

export async function loadProviderRegistration(signal: AbortSignal, request: typeof fetch = fetch): Promise<ProviderRegistration> {
  try {
    const response = await request('/api/providers', {
      credentials: 'same-origin', signal, headers: {Accept: 'application/json'},
    });
    if (!response.ok) {
      await response.text();
      return PROVIDER_UNAVAILABLE;
    }
    return classifyProviderRegistration(await response.json());
  } catch {
    return PROVIDER_UNAVAILABLE;
  }
}

export function ProviderHealthCard({value, operations}: {value: ProviderRegistration; operations?: DashboardQueueState}) {
  if (operations) return <DashboardSignalCard label="LLM Providers" component="provider" value={operations}>
    {operations.status === 'LOADED' && value.status === 'VALID' ? <>
      <p>등록 {value.registered} / 9</p><p>등록 정보는 연결 상태 검증이 아닙니다.</p>
    </> : null}
  </DashboardSignalCard>;
  return <article className="status-card"><h3>LLM Providers</h3>
    <div aria-live="polite" aria-atomic="true">
      {value.status === 'VALID' ? <>
        <p>등록 {value.registered} / 9</p>
        <p>연결 상태 · NOT CHECKED</p>
      </> : <><p className={value.status === 'LOADING' ? undefined : 'status-unavailable'}>{value.status}</p>
        <p>{value.status === 'LOADING' ? 'LLM Providers 조회 중입니다.' : '연결된 상태 정보가 없습니다.'}</p></>}
    </div>
  </article>;
}

export function classifyReadiness(value: unknown): Readiness {
  if (typeof value !== 'object' || value === null) return 'NOT CONNECTED';
  const payload = value as Record<string, unknown>;
  return payload.status === 'ready' && (payload.migration_head === '0016_operations_recovery' || payload.migration_head === '0019_oidc_sessions')
    ? 'READY' : 'NOT CONNECTED';
}

export async function loadReadiness(signal: AbortSignal, request: typeof fetch = fetch):
  Promise<{payload: unknown; checked: 'JUST NOW' | 'FAILED'}> {
  try {
    const response = await request('/api/health/ready', {
      credentials: 'same-origin', signal, headers: {Accept: 'application/json'},
    });
    if (!response.ok) {
      await response.text();
      return {payload: null, checked: 'JUST NOW'};
    }
    return {payload: await response.json(), checked: 'JUST NOW'};
  } catch {
    return {payload: null, checked: 'FAILED'};
  }
}

export function DatabaseHealthCard({value, operations, readinessPending = false}: {value: unknown;
  operations?: DashboardQueueState; readinessPending?: boolean}) {
  const readiness = classifyReadiness(value);
  const head = readiness === 'READY' ? (value as {migration_head: string}).migration_head : null;
  if (operations) return <DashboardSignalCard label="Database" component="database" value={operations}>
    <p>{readinessPending ? 'API 준비 조회 중' : head ? `API 준비 READY · Migration ${head}` : 'API 준비 NOT CONNECTED · 연결된 상태 정보가 없습니다.'}</p>
  </DashboardSignalCard>;
  const signal = readinessPending ? {status: 'LOADING', lastCheck: null, errorCount: null}
    : readiness === 'READY'
    ? {status: 'UNAVAILABLE', lastCheck: null, errorCount: null}
    : {status: 'NOT CONNECTED', lastCheck: null, errorCount: null};
  return <article className="status-card"><h3>Database</h3>
    <div aria-live="polite" aria-atomic="true">
      <p className={signal.status === 'HEALTHY' ? 'status-ready'
        : signal.status === 'LOADING' || signal.status === 'RECONNECTING'
          ? undefined : 'status-unavailable'}>{signal.status}</p>
      <p>{signal.status === 'LOADING' ? 'Database 조회 중입니다.'
        : head ? `API 준비 READY · Migration ${head}` : '연결된 상태 정보가 없습니다.'}</p>
      {signal.status === 'QUOTA' ? <p>조회 제한 · Database 상태 정보를 표시하지 않습니다.</p> : null}
      {signal.status === 'RECONNECTING' ? <p>재연결 중 · Database 상태 정보를 표시하지 않습니다.</p> : null}
      {signal.status === 'CANCELLED' ? <p>조회 취소 · Database 상태 정보를 표시하지 않습니다.</p> : null}
      {signal.lastCheck !== null ? <p>마지막 점검 {signal.lastCheck}</p> : null}
      {signal.errorCount !== null ? <p>오류 {signal.errorCount}건</p> : null}
    </div>
  </article>;
}

class ShellErrorBoundary extends Component<{children: ReactNode}, {failed: boolean}> {
  state = {failed: false};

  static getDerivedStateFromError(): {failed: boolean} {
    return {failed: true};
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // Do not send stack traces or potentially sensitive component state to the browser.
  }

  render(): ReactNode {
    if (this.state.failed) {
      return <main role="alert" className="shell-fallback">화면을 표시할 수 없습니다. 잠시 후 다시 시도하세요.</main>;
    }
    return this.props.children;
  }
}

export function DashboardReadControls({status, onRefresh, onReconnect, onCancel}:
    {status: DashboardQueueState['status']; onRefresh: () => void;
      onReconnect: () => void; onCancel: () => void}) {
  const pending = status === 'LOADING' || status === 'RECONNECTING';
  return <><button type="button" disabled={pending} onClick={onRefresh}>대시보드 새로고침</button>
    {status === 'UNAVAILABLE'
      ? <button type="button" onClick={onReconnect}>대시보드 연결 재시도</button> : null}
    {pending ? <button type="button" onClick={onCancel}>대시보드 조회 취소</button> : null}</>;
}

function Shell({route}: AppProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [readinessPayload, setReadinessPayload] = useState<unknown>(null);
  const [checked, setChecked] = useState('NOT REQUESTED');
  const [projects, setProjects] = useState<ProjectsState>(createProjectsState());
  const [providerRegistration, setProviderRegistration] = useState<ProviderRegistration>(PROVIDER_LOADING);
  const [dashboardQueue, setDashboardQueue] = useState<DashboardQueueState>(DASHBOARD_QUEUE_LOADING);
  const [criticalAlerts, setCriticalAlerts] = useState<CriticalAlertsState>(ALERTS_LOADING);
  const [loadingOlderAlerts, setLoadingOlderAlerts] = useState(false);
  const alertsController = useRef<AbortController | null>(null);
  const dashboardController = useRef<AbortController | null>(null);
  const dashboardInFlight = useRef(false);
  const olderRequestInFlight = useRef(false);
  const currentRoute = route ?? (typeof window === 'undefined' ? '/' : window.location.pathname);

  const refreshDashboard = useCallback((reconnect = false) => {
    if (currentRoute !== '/' || dashboardInFlight.current) return;
    const controller = new AbortController();
    dashboardController.current = controller;
    dashboardInFlight.current = true;
    setDashboardQueue(reconnect ? DASHBOARD_QUEUE_RECONNECTING : DASHBOARD_QUEUE_LOADING);
    void loadDashboardQueue(controller.signal).then((value) => {
      if (dashboardController.current === controller && !controller.signal.aborted) {
        setDashboardQueue(value);
      }
    }).finally(() => {
      if (dashboardController.current === controller) {
        dashboardController.current = null;
        dashboardInFlight.current = false;
      }
    });
  }, [currentRoute]);

  const cancelDashboard = () => {
    if (currentRoute !== '/' || !dashboardInFlight.current || !dashboardController.current) return;
    const controller = dashboardController.current;
    dashboardController.current = null;
    dashboardInFlight.current = false;
    controller.abort();
    setDashboardQueue(DASHBOARD_QUEUE_CANCELLED);
  };

  useEffect(() => {
    const controller = new AbortController();
    const read = async () => {
      const {payload, checked: nextChecked} = await loadReadiness(controller.signal);
      if (!controller.signal.aborted) {
        setReadinessPayload(payload);
        setChecked(nextChecked);
      }
    };
    void read();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (currentRoute !== '/') return;
    const controller = new AbortController();
    alertsController.current = controller;
    void loadProviderRegistration(controller.signal).then((value) => {
      if (!controller.signal.aborted) setProviderRegistration(value);
    });
    refreshDashboard();
    void loadCriticalAlerts(controller.signal).then((value) => {
      if (!controller.signal.aborted) setCriticalAlerts(value);
    });
    return () => {
      controller.abort();
      dashboardController.current?.abort();
      dashboardController.current = null;
      dashboardInFlight.current = false;
      if (alertsController.current === controller) alertsController.current = null;
    };
  }, [currentRoute, refreshDashboard]);

  const loadOlderAlerts = async () => {
    const controller = alertsController.current;
    if (!controller || olderRequestInFlight.current || criticalAlerts.status !== 'LOADED'
      || !criticalAlerts.partial) return;
    setLoadingOlderAlerts(true);
    try {
      const next = await loadOlderCriticalAlertsOnce(criticalAlerts, controller.signal, olderRequestInFlight);
      if (next && !controller.signal.aborted) setCriticalAlerts(next);
    } finally {
      if (!controller.signal.aborted) setLoadingOlderAlerts(false);
    }
  };

  useEffect(() => {
    if (currentRoute !== '/projects') return;
    let live = true;
    void scanProjects().then((payload) => {
      if (live) setProjects(reduceProjects(createProjectsState(), {type: 'SCAN_RECEIVED', payload}));
    }).catch((error: Error) => {
      if (live) setProjects(reduceProjects(createProjectsState(), {type: 'SCAN_FAILED', message: error.message}));
    });
    return () => { live = false; };
  }, [currentRoute]);

  return <div className={`app-shell${collapsed ? ' sidebar-collapsed' : ''}`}>
    <aside className="sidebar">
      <a className="brand" href="/" aria-label="Anvil Dashboard"><strong>A</strong><span>ANVIL<small>AI Development OS</small></span></a>
      <button type="button" className="sidebar-toggle" aria-controls="app-menu" aria-expanded={!collapsed}
        onClick={() => setCollapsed(!collapsed)}>{collapsed ? '메뉴 펼치기' : '메뉴 접기'}</button>
      <nav aria-label="Anvil 전체 메뉴"><ul id="app-menu" className="app-menu">
        {MENU_ITEMS.map((item) => <li key={item.id}>
          {item.state === 'ACTIVE'
            ? <a href={item.href} aria-current={currentRoute === item.href ? 'page' : undefined}>{item.label}</a>
            : <span aria-disabled="true" title="이 메뉴는 아직 준비 중입니다.">{item.label}</span>}
          {item.state !== 'ACTIVE' && <span className="menu-state">PREPARING</span>}
        </li>)}
      </ul></nav>
    </aside>
    <section className="app-stage">
      <header className="app-header"><p>Dashboard / Overview</p><p>Environment · NOT CONNECTED</p>
        <div className="header-actions"><span>알림 · UNAVAILABLE</span><span>권한 · 미확인</span></div></header>
      {currentRoute === '/' ? <main className="dashboard">
        <div className="dashboard-heading"><h1>Dashboard</h1><div><p>마지막 확인 · {checked}</p>
          <DashboardObservationTime value={dashboardQueue}/>
          <DashboardReadControls status={dashboardQueue.status} onRefresh={() => refreshDashboard()}
            onReconnect={() => refreshDashboard(true)} onCancel={cancelDashboard}/></div></div>
        <section aria-labelledby="health-heading"><h2 id="health-heading">Health</h2>
          <div className="status-grid">
            {['Database', 'Queue', 'Worker', 'LLM Providers', 'Execution Backends', 'Artifact Store'].map((name) => {
              if (name === 'Database') return <DatabaseHealthCard key={name} value={readinessPayload}
                readinessPending={checked === 'NOT REQUESTED'}
                operations={dashboardQueue}/>;
              if (name === 'Queue') return <QueueHealthCard key={name} value={dashboardQueue}/>;
              if (name === 'LLM Providers') return <ProviderHealthCard key={name} value={providerRegistration} operations={dashboardQueue}/>;
              if (name === 'Worker') return <DashboardSignalCard key={name} label={name}
                component="worker" value={dashboardQueue}/>;
              if (name === 'Execution Backends') return <DashboardSignalCard key={name} label={name}
                component="backend" value={dashboardQueue}/>;
              if (name === 'Artifact Store') return <DashboardSignalCard key={name} label={name}
                component="artifact_store" value={dashboardQueue}/>;
              return <article className="status-card" key={name}><h3>{name}</h3>
                <p className="status-unavailable">UNAVAILABLE</p>
                <p>연결된 상태 정보가 없습니다.</p>
              </article>;
            })}
          </div>
        </section>
        <DashboardOperatingCards value={dashboardQueue}/>
        <NextActionsCard value={dashboardQueue}/>
        <CriticalAlertsCard value={criticalAlerts} onLoadOlder={() => { void loadOlderAlerts(); }}
          loadingOlder={loadingOlderAlerts}/>
      </main> : currentRoute === '/projects' ? <main className="dashboard">
        <div className="dashboard-heading"><div><p className="header-status">REPOSITORY ONBOARDING</p><h1>Projects</h1></div><p>읽기 전용 scan · {projects.status}</p></div>
        <section className="status-card" aria-labelledby="projects-status-heading"><h2 id="projects-status-heading">Repository 상태</h2><p className={projects.status === 'READY' ? 'status-ready' : 'status-unavailable'}>{projects.status}</p><p>{projects.reason}</p>{projects.repository && <dl className="status-metadata"><div><dt>Branch</dt><dd>{projects.repository.branch}</dd></div><div><dt>HEAD</dt><dd>{projects.repository.head}</dd></div><div><dt>Tracked dirty</dt><dd>{projects.repository.dirtyPaths}</dd></div><div><dt>Untracked</dt><dd>{projects.repository.untrackedPaths}</dd></div></dl>}</section>
        <section className="status-card" aria-labelledby="projects-baseline-heading"><h2 id="projects-baseline-heading">Baseline</h2><p className={projects.baseline.status === 'READY_TO_REVIEW' ? 'status-ready' : 'status-unavailable'}>{projects.baseline.status}</p><p>{projects.baseline.reason}</p><p className="status-reason">승인 없는 mutation은 수행하지 않습니다.</p></section>
      </main> : READ_ONLY_MENU.has(currentRoute) ? <main className="dashboard">
        <div className="dashboard-heading"><div><p className="header-status">READ-ONLY CONSOLE</p><h1>{READ_ONLY_MENU.get(currentRoute)}</h1></div><p>상태 · UNAVAILABLE</p></div>
        <section className="status-card" aria-labelledby="menu-status-heading"><h2 id="menu-status-heading">연결 상태</h2><p className="status-unavailable">UNAVAILABLE</p><p>이 화면의 read model은 아직 연결되지 않았습니다. 실제 실행·변경은 수행하지 않습니다.</p></section>
      </main> : <main className="dashboard" role="alert"><h1>페이지를 사용할 수 없습니다</h1>
        <p>준비되지 않은 경로입니다. <a href="/">Dashboard로 돌아가기</a></p></main>}
    </section>
  </div>;
}

export function App(props: AppProps) {
  return <ShellErrorBoundary><Shell {...props}/></ShellErrorBoundary>;
}
