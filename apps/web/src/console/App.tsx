import {Component, useEffect, useState, type ErrorInfo, type ReactNode} from 'react';
import {MENU_ITEMS} from '../features/app-shell/app-shell-model.js';

type Readiness = 'NOT CONNECTED' | 'READY';
type AppProps = {route?: string};

export function classifyReadiness(value: unknown): Readiness {
  if (typeof value !== 'object' || value === null) return 'NOT CONNECTED';
  const payload = value as Record<string, unknown>;
  return payload.status === 'ready' && payload.migration_head === '0016_operations_recovery'
    ? 'READY' : 'NOT CONNECTED';
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
  const [readiness, setReadiness] = useState<Readiness>('NOT CONNECTED');
  const [checked, setChecked] = useState('NOT REQUESTED');
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
          setReadiness(classifyReadiness(payload));
          setChecked('JUST NOW');
        }
      } catch {
        if (!controller.signal.aborted) {
          setReadiness('NOT CONNECTED');
          setChecked('FAILED');
        }
      }
    };
    void read();
    return () => controller.abort();
  }, []);

  return <div className={`app-shell${collapsed ? ' sidebar-collapsed' : ''}`}>
    <aside className="sidebar">
      <a className="brand" href="/" aria-label="Anvil Dashboard"><strong>A</strong><span>ANVIL<small>AI Development OS</small></span></a>
      <button type="button" className="sidebar-toggle" aria-controls="app-menu" aria-expanded={!collapsed}
        onClick={() => setCollapsed(!collapsed)}>{collapsed ? '메뉴 펼치기' : '메뉴 접기'}</button>
      <nav aria-label="Anvil 전체 메뉴"><ul id="app-menu" className="app-menu">
        {MENU_ITEMS.map((item) => <li key={item.id}>
          {item.id === 'dashboard'
            ? <a href="/" aria-current={currentRoute === '/' ? 'page' : undefined}>{item.label}</a>
            : <span aria-disabled="true" title="이 메뉴는 아직 준비 중입니다.">{item.label}</span>}
          {item.id !== 'dashboard' && <span className="menu-state">PREPARING</span>}
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
              const status = name === 'Database' ? readiness : 'UNAVAILABLE';
              return <article className="status-card" key={name}><h3>{name}</h3>
                <p className={status === 'READY' ? 'status-ready' : 'status-unavailable'}>{status}</p>
                <p>{name === 'Database' && status === 'READY' ? 'Migration 0016_operations_recovery' : '연결된 상태 정보가 없습니다.'}</p>
              </article>;
            })}
          </div>
        </section>
        <section aria-labelledby="operations-heading"><h2 id="operations-heading">운영 상태</h2>
          <p>실행·승인·비용·알람 read model은 아직 연결되지 않았습니다. UNAVAILABLE</p>
        </section>
      </main> : <main className="dashboard" role="alert"><h1>페이지를 사용할 수 없습니다</h1>
        <p>준비되지 않은 경로입니다. <a href="/">Dashboard로 돌아가기</a></p></main>}
    </section>
  </div>;
}

export function App(props: AppProps) {
  return <ShellErrorBoundary><Shell {...props}/></ShellErrorBoundary>;
}
