import {Component, useEffect, useState, type ErrorInfo, type ReactNode} from 'react';
import {MENU_ITEMS} from '../features/app-shell/app-shell-model.js';
import {scanProjects} from '../api/projects-client.js';
import {createProjectsState, reduceProjects} from '../features/projects/projects-state.js';

type Readiness = 'NOT CONNECTED' | 'READY';
type AppProps = {route?: string};
type ProjectsState = {status: string; reason: string; repository: {branch: string; head: string; dirtyPaths: number; untrackedPaths: number} | null; baseline: {status: string; reason: string}; mutationAllowed: boolean};
type ProviderRegistration = {status: 'VALID'; registered: number} | {status: 'UNAVAILABLE'; registered: null};

const READ_ONLY_MENU = new Map(MENU_ITEMS.map((item) => [item.href, item.label]));
const PROVIDER_IDS = new Set(['cerebras', 'groq', 'mistral', 'openrouter', 'upstage', 'gemini', 'anthropic', 'openai', 'ollama']);
const PROVIDER_UNAVAILABLE: ProviderRegistration = {status: 'UNAVAILABLE', registered: null};

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
    if (!response.ok) return PROVIDER_UNAVAILABLE;
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
  const currentRoute = route ?? (typeof window === 'undefined' ? '/' : window.location.pathname);

  useEffect(() => {
    const controller = new AbortController();
    const read = async () => {
      try {
        const response = await fetch('/api/health/ready', {
          credentials: 'same-origin', signal: controller.signal, headers: {Accept: 'application/json'},
        });
        const payload: unknown = response.ok ? await response.json() : null;
        if (!controller.signal.aborted) {
          setReadinessPayload(payload);
          setChecked('JUST NOW');
        }
      } catch {
        if (!controller.signal.aborted) {
          setReadinessPayload(null);
          setChecked('FAILED');
        }
      }
    };
    void read();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (currentRoute !== '/') return;
    const controller = new AbortController();
    void loadProviderRegistration(controller.signal).then((value) => {
      if (!controller.signal.aborted) setProviderRegistration(value);
    });
    return () => controller.abort();
  }, [currentRoute]);

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
              if (name === 'LLM Providers') return <ProviderHealthCard key={name} value={providerRegistration}/>;
              return <article className="status-card" key={name}><h3>{name}</h3>
                <p className="status-unavailable">UNAVAILABLE</p>
                <p>연결된 상태 정보가 없습니다.</p>
              </article>;
            })}
          </div>
        </section>
        <section aria-labelledby="operations-heading"><h2 id="operations-heading">운영 상태</h2>
          <p>실행·승인·비용·알람 read model은 아직 연결되지 않았습니다. UNAVAILABLE</p>
        </section>
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
