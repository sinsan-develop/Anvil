import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {ApiError,type ApiClient} from '../api/client.ts';
import {readProjectAccessSummary,type ProjectAccessSummaryView} from '../features/projects/project-access-summary.ts';
import { routeHref, screenTitles, type Route, type Screen } from './routes.ts';

const projectScreens: Screen[] = ['workspace', 'methodologies', 'session', 'documents', 'knowledge', 'approvals', 'changes', 'transfers', 'connections', 'control', 'mobile'];

type ProjectAccess={client:ApiClient;session:{user:{id:string};clientId:string};onAuthenticationLost:()=>void};
const participationLabels={OWNER:'소유자',VIEWER:'조회자',HANDOFF_ELIGIBLE:'작업 인수 가능 참여자'};
const controlLabels={
  HELD:'이 로그인·기기에 제어 기록 있음',
  OTHER_CLIENT:'다른 사용자 또는 기기에 제어 기록 있음',
  UNASSIGNED:'현재 유효한 제어 기록 없음',
};
type AccessDisplay=Pick<ProjectAccessSummaryView,'participation'|'receivedAt'> & {
  control:ProjectAccessSummaryView['controlState']['status'];
};
type AccessResult={kind:'loading'}|{kind:'error';message:string}|{kind:'ready';value:AccessDisplay};

function ProjectShellAccess({projectId,client,session,onAuthenticationLost}:ProjectAccess & {projectId:string}){
  const transport=client.transport;
  const userId=session.user.id;
  const clientId=session.clientId;
  const scope=useMemo(()=>({projectId,client,session,transport,userId,clientId}),[projectId,client,session,transport,userId,clientId]);
  const live=useRef<typeof scope|null>(null);
  const latest=useRef<object|null>(null);
  const [loaded,setLoaded]=useState<{scope:typeof scope;result:AccessResult}|null>(null);
  const shown=loaded?.scope===scope?loaded.result:null;

  useLayoutEffect(()=>{
    live.current=scope;
    return ()=>{live.current=null;latest.current=null;};
  },[scope]);

  async function checkAccess(){
    const ticket={};
    const sameContext=()=>live.current===scope&&client.transport===transport&&session.user.id===userId&&session.clientId===clientId;
    const active=()=>sameContext()&&latest.current===ticket;
    if(!sameContext())return;
    latest.current=ticket;
    const loading={scope,result:{kind:'loading' as const}};
    setLoaded(loading);
    try{
      const value=await readProjectAccessSummary(client,projectId,active);
      if(!active())return;
      const {actorId,clientId:holderId,status}=value.controlState;
      if(status==='HELD'&&(actorId!==userId||holderId!==clientId))throw new ApiError('RESPONSE_INVALID');
      setLoaded({scope,result:{kind:'ready',value:{participation:value.participation,receivedAt:value.receivedAt,control:status}}});
    }catch(cause){
      if(!active())return;
      const status=cause instanceof ApiError?cause.status:undefined;
      const message=status===401?'로그인 확인 필요':status===403||status===404?'프로젝트 접근 상태를 조회할 수 없습니다':'프로젝트 접근 상태를 확인하지 못했습니다';
      setLoaded({scope,result:{kind:'error',message}});
      if(status===401)onAuthenticationLost();
    }finally{
      // 값이 바뀐 현재 화면에서는 이 요청이 남긴 로딩만 해제한다.
      if(live.current===scope&&latest.current===ticket&&!sameContext()){
        latest.current=null;
        setLoaded(previous=>previous===loading?null:previous);
      }
    }
  }

  return <div aria-label="프로젝트 접근 상태">
    <button type="button" disabled={shown?.kind==='loading'} onClick={()=>{void checkAccess();}}>프로젝트 접근 상태 확인</button>
    <div role="status" aria-live="polite">
      {!shown?<span className="badge">제어권 미확인 · 실행 불가</span>:null}
      {shown?.kind==='loading'?<span>프로젝트 접근 상태 조회 중</span>:null}
      {shown?.kind==='error'?<span>{shown.message}</span>:null}
      {shown?.kind==='ready'?<div>
        <span>{participationLabels[shown.value.participation]} · {controlLabels[shown.value.control]}</span>
        <small>브라우저 수신 시각 <time dateTime={shown.value.receivedAt}>{new Date(shown.value.receivedAt).toLocaleString('ko-KR')}</time> · 명령 권한은 별도로 확인합니다.</small>
      </div>:null}
    </div>
  </div>;
}
export function AppShell({ route, displayName, onLogout, endingSession, projectAccess, children }: { route: Route; displayName?: string; onLogout?: () => void; endingSession?: boolean; projectAccess?: ProjectAccess; children: ReactNode }) {
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
      <header className="topbar"><span>{screenTitles[route.screen]}</span><div className="identity"><span>{displayName ?? '접근 확인 전'}</span>{route.projectId&&projectAccess?<ProjectShellAccess projectId={route.projectId} {...projectAccess}/>:<span className="badge">제어권 미확인 · 실행 불가</span>}{onLogout ? <button onClick={onLogout} disabled={endingSession}>로그아웃</button> : null}</div></header>
      <main id="main-content" className={route.screen==='mobile'?'mobile-content':undefined} tabIndex={-1}><div className="page-heading"><div><p className="eyebrow">개발 절차와 작업 공간</p><h1>{screenTitles[route.screen]}</h1></div><details className="help"><summary aria-label="화면 도움말">i</summary><p>Anvil이 프로젝트와 기준·지식을 보관하고 기존 코딩 Agent에 작업을 맡깁니다. 화면 이동은 실행을 시작하지 않습니다.</p></details></div>{children}</main>
    </div>
  </div>;
}
