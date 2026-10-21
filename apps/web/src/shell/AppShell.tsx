import { useState, type ReactNode } from 'react';
import { routeHref, screenTitles, type Route, type Screen } from './routes.ts';

const projectScreens: Screen[] = ['workspace', 'methodologies', 'session', 'documents', 'knowledge', 'approvals', 'changes', 'transfers', 'connections', 'control', 'mobile'];
export function AppShell({ route, displayName, onLogout, endingSession, children }: { route: Route; displayName?: string; onLogout?: () => void; endingSession?: boolean; children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuLink = (screen: Screen) => <a key={screen} href={routeHref(screen, route.projectId)} aria-current={route.screen === screen ? 'page' : undefined} onClick={() => setMenuOpen(false)}>{screenTitles[screen]}</a>;
  return <div className="app-shell">
    <a className="skip-link" href="#main-content" onClick={event => { event.preventDefault(); document.getElementById('main-content')?.focus(); }}>본문으로 이동</a>
    <aside className="sidebar">
      <div className="brand">ANVIL</div><p className="tagline">프로젝트는 남고, 도구는 바뀐다</p>
      <button className="menu-toggle" aria-label="탐색 메뉴" aria-expanded={menuOpen} aria-controls="main-navigation" onClick={() => setMenuOpen(v => !v)}>메뉴</button>
      <nav id="main-navigation" aria-label="주 탐색" className={menuOpen ? 'is-open' : ''}>
        {menuLink('projects')}
        {route.projectId ? <><p className="nav-heading">현재 프로젝트</p>{projectScreens.map(menuLink)}</> : menuLink('methodologies')}
        {menuLink('settings')}
      </nav>
    </aside>
    <div className="main-frame">
      <header className="topbar"><span>{screenTitles[route.screen]}</span><div className="identity"><span>{displayName ?? '접근 확인 전'}</span><span className="badge">제어권 미확인 · 실행 불가</span>{onLogout ? <button onClick={onLogout} disabled={endingSession}>로그아웃</button> : null}</div></header>
      <main id="main-content" className={route.screen==='mobile'?'mobile-content':undefined} tabIndex={-1}><div className="page-heading"><div><p className="eyebrow">개발 절차와 작업 공간</p><h1>{screenTitles[route.screen]}</h1></div><details className="help"><summary aria-label="화면 도움말">i</summary><p>Anvil이 프로젝트와 기준·지식을 보관하고 기존 코딩 Agent에 작업을 맡깁니다. 화면 이동은 실행을 시작하지 않습니다.</p></details></div>{children}</main>
    </div>
  </div>;
}
