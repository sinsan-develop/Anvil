import {Component, useEffect, useRef, useState, type ErrorInfo, type ReactNode} from 'react';
import {MENU_ITEMS} from '../features/app-shell/app-shell-model.js';
import {scanProjects} from '../api/projects-client.js';
import {createProjectsState, reduceProjects} from '../features/projects/projects-state.js';

type Readiness = 'NOT CONNECTED' | 'READY';
type AppProps = {route?: string};
type ProjectsState = {status: string; reason: string; repository: {branch: string; head: string; dirtyPaths: number; untrackedPaths: number} | null; baseline: {status: string; reason: string}; mutationAllowed: boolean};
type ProviderRegistration = {status: 'VALID'; registered: number} | {status: 'UNAVAILABLE'; registered: null};
type DashboardQueueState = {status: 'LOADED'; observed: number; sourceGap: boolean}
  | {status: 'UNAVAILABLE' | 'BLOCKED'};
type CriticalAlert = {alert_id: string; code: string; source: string; observed_at: string;
  owner_id: string | null; cause: string; related_entity_id: string; status: 'open' | 'acknowledged'};
type CriticalAlertsState = {status: 'LOADED'; alerts: CriticalAlert[]; partial: boolean;
  nextBeforeSequence: number | null; seenAlertIds: string[]} | {status: 'UNAVAILABLE' | 'BLOCKED'};

const READ_ONLY_MENU = new Map(MENU_ITEMS.map((item) => [item.href, item.label]));
const PROVIDER_IDS = new Set(['cerebras', 'groq', 'mistral', 'openrouter', 'upstage', 'gemini', 'anthropic', 'openai', 'ollama']);
const PROVIDER_UNAVAILABLE: ProviderRegistration = {status: 'UNAVAILABLE', registered: null};
const DASHBOARD_QUEUE_UNAVAILABLE: DashboardQueueState = {status: 'UNAVAILABLE'};
const DASHBOARD_QUEUE_BLOCKED: DashboardQueueState = {status: 'BLOCKED'};
const DASHBOARD_SNAPSHOT_FIELDS = ['observed_at', 'health', 'queue', 'quarantine',
  'worker', 'budget', 'reservations', 'providers', 'deployments', 'source_gaps',
  'alerts', 'next_actions'];
const DASHBOARD_HEALTH_COMPONENTS = ['database', 'queue', 'worker', 'provider', 'backend', 'artifact_store'];
const DASHBOARD_HEALTH_FIELDS = ['state', 'observed_at', 'stale_after_seconds',
  'last_check', 'error_count', 'detail_path', 'evidence_ref'];
const DASHBOARD_QUEUE_FIELDS = ['job_id', 'run_id', 'state', 'available_at', 'attempts',
  'max_attempts', 'lease_epoch', 'lease_expires_at', 'dependency_ids', 'conflict_keys',
  'priority', 'required_capability', 'input_verified', 'backoff_until'];
const DASHBOARD_GAPS = new Set([...DASHBOARD_HEALTH_COMPONENTS, 'deployment']);
const ALERTS_UNAVAILABLE: CriticalAlertsState = {status: 'UNAVAILABLE'};
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

function classifyDashboardQueue(payload: unknown): DashboardQueueState {
  if (!record(payload) || !exactFields(payload, ['data', 'request_id'])
    || !nonempty(payload.request_id) || !record(payload.data)
    || !exactFields(payload.data, DASHBOARD_SNAPSHOT_FIELDS)) return DASHBOARD_QUEUE_UNAVAILABLE;
  const snapshot = payload.data;
  if (!validObservedAt(snapshot.observed_at) || !record(snapshot.health)
    || !exactFields(snapshot.health, DASHBOARD_HEALTH_COMPONENTS)
    || !DASHBOARD_HEALTH_COMPONENTS.every((name) => {
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
  return {status: 'LOADED', observed: snapshot.queue.length,
    sourceGap: snapshot.source_gaps.includes('queue')};
}

export async function loadDashboardQueue(signal: AbortSignal, request: typeof fetch = fetch): Promise<DashboardQueueState> {
  try {
    const response = await request('/api/dashboard/operations', {
      credentials: 'same-origin', signal, headers: {Accept: 'application/json'},
    });
    if (!response.ok) {
      await response.text();
      return response.status === 401 || response.status === 403
        ? DASHBOARD_QUEUE_BLOCKED : DASHBOARD_QUEUE_UNAVAILABLE;
    }
    return classifyDashboardQueue(await response.json());
  } catch {
    return DASHBOARD_QUEUE_UNAVAILABLE;
  }
}

export function QueueHealthCard({value}: {value: DashboardQueueState}) {
  return <article className="status-card"><h3>Queue</h3>
    <div aria-live="polite" aria-atomic="true">
      {value.status === 'LOADED' ? <>
        <p className="status-unavailable">UNKNOWN</p>
        <p>범위 내 관측 {value.observed}건</p>
        <p>{value.sourceGap ? 'Queue source 연결 정보가 부족합니다.'
          : 'Queue source의 완전성은 확인되지 않았습니다.'}</p>
      </> : <><p className="status-unavailable">{value.status}</p>
        <p>{value.status === 'BLOCKED' ? '조회 차단 · Queue 기록을 표시하지 않습니다.'
          : 'Queue 상태 정보를 확인할 수 없습니다.'}</p></>}
    </div>
  </article>;
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
        cause: item.cause as string, related_entity_id: item.related_entity_id as string,
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
      {value.status !== 'LOADED' ? <><p className="status-unavailable">{value.status}</p>
        <p>{value.status === 'BLOCKED' ? '조회 차단 · 저장 경고 기록을 표시하지 않습니다.'
          : '저장 경고 기록을 확인할 수 없습니다.'}</p></> : <>
        <p>저장된 Critical 기록 · 현재 페이지</p>
        {value.alerts.length === 0 ? <p>이 페이지에 저장된 Critical 기록 없음</p> :
          <ul>{value.alerts.map((alert) => <li key={alert.alert_id}>
            <strong>{alert.code}</strong><span> · {alert.source}</span>
            <p>발생시각 · {alert.observed_at}</p>
            <p>담당자 · {alert.owner_id ?? '미배정'} · {alert.status}</p>
            <p>원인 · {alert.cause}</p><p>대상 · {alert.related_entity_id}</p>
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

export function ProviderHealthCard({value}: {value: ProviderRegistration}) {
  return <article className="status-card"><h3>LLM Providers</h3>
    <div aria-live="polite" aria-atomic="true">
      {value.status === 'VALID' ? <>
        <p>등록 {value.registered} / 9</p>
        <p>연결 상태 · NOT CHECKED</p>
      </> : <><p className="status-unavailable">UNAVAILABLE</p>
        <p>연결된 상태 정보가 없습니다.</p></>}
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

export function DatabaseHealthCard({value}: {value: unknown}) {
  const status = classifyReadiness(value);
  const head = status === 'READY' ? (value as {migration_head: string}).migration_head : null;
  return <article className="status-card"><h3>Database</h3>
    <p className={status === 'READY' ? 'status-ready' : 'status-unavailable'}>{status}</p>
    <p>{head ? `Migration ${head}` : '연결된 상태 정보가 없습니다.'}</p>
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

function Shell({route}: AppProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [readinessPayload, setReadinessPayload] = useState<unknown>(null);
  const [checked, setChecked] = useState('NOT REQUESTED');
  const [projects, setProjects] = useState<ProjectsState>(createProjectsState());
  const [providerRegistration, setProviderRegistration] = useState<ProviderRegistration>(PROVIDER_UNAVAILABLE);
  const [dashboardQueue, setDashboardQueue] = useState<DashboardQueueState>(DASHBOARD_QUEUE_UNAVAILABLE);
  const [criticalAlerts, setCriticalAlerts] = useState<CriticalAlertsState>(ALERTS_UNAVAILABLE);
  const [loadingOlderAlerts, setLoadingOlderAlerts] = useState(false);
  const alertsController = useRef<AbortController | null>(null);
  const olderRequestInFlight = useRef(false);
  const currentRoute = route ?? (typeof window === 'undefined' ? '/' : window.location.pathname);

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
    void loadDashboardQueue(controller.signal).then((value) => {
      if (!controller.signal.aborted) setDashboardQueue(value);
    });
    void loadCriticalAlerts(controller.signal).then((value) => {
      if (!controller.signal.aborted) setCriticalAlerts(value);
    });
    return () => {
      controller.abort();
      if (alertsController.current === controller) alertsController.current = null;
    };
  }, [currentRoute]);

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
        <div className="dashboard-heading"><h1>Dashboard</h1><p>마지막 확인 · {checked}</p></div>
        <section aria-labelledby="health-heading"><h2 id="health-heading">Health</h2>
          <div className="status-grid">
            {['Database', 'Queue', 'Worker', 'LLM Providers', 'Execution Backends', 'Artifact Store'].map((name) => {
              if (name === 'Database') return <DatabaseHealthCard key={name} value={readinessPayload}/>;
              if (name === 'Queue') return <QueueHealthCard key={name} value={dashboardQueue}/>;
              if (name === 'LLM Providers') return <ProviderHealthCard key={name} value={providerRegistration}/>;
              return <article className="status-card" key={name}><h3>{name}</h3>
                <p className="status-unavailable">UNAVAILABLE</p>
                <p>연결된 상태 정보가 없습니다.</p>
              </article>;
            })}
          </div>
        </section>
        <section aria-labelledby="operations-heading"><h2 id="operations-heading">운영 상태</h2>
          <p>실행·승인·비용 read model은 아직 연결되지 않았습니다. UNAVAILABLE</p>
        </section>
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
