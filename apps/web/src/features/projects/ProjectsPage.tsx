import { useEffect, useState, type FormEvent } from 'react';
import { ApiClient, ApiError } from '../../api/client.ts';
import { listProjects } from './api.ts';
import {ProjectAccessSummary} from './ProjectAccessSummary.tsx';
import {routeHref} from '../../shell/routes.ts';
import {ProjectPendingApprovals} from './ProjectPendingApprovals.tsx';
import {ProjectAssignmentDrafts} from './ProjectAssignmentDrafts.tsx';
import {ProjectMethodologyOriginal} from './ProjectMethodologyOriginal.tsx';
import {mergeProjectListSnapshot,selectProjectListSnapshot,type ProjectListSnapshot,type ProjectListVisible} from './project-list-snapshot.ts';

export function ProjectListResults({client,snapshot,pending,error,onAuthenticationLost}:{client:ApiClient;snapshot:ProjectListVisible|null;pending:boolean;error:ApiError|null;onAuthenticationLost:()=>void}){
  if(snapshot&&snapshot.client!==client||error&&[401,403,404].includes(error.status))snapshot=null;
  const locked=pending||!!error||!snapshot?.current;
  return <>
    {pending||!snapshot&&!error?<p role="status">프로젝트를 조회하고 있습니다.</p>:null}
    {error?<p role="alert">{error.message}{snapshot?' 앞선 목록은 오래된 자료입니다.':''}</p>:null}
    {snapshot?<p className="meta">마지막 수신 페이지 관측: <time dateTime={snapshot.page.observedAt}>{new Date(snapshot.page.observedAt).toLocaleString('ko-KR')}</time>{locked?' · 오래된 자료 · 현재 상태 미확인':''} · 각 항목의 관측은 아래에 별도 표시합니다.</p>:null}
    {snapshot&&!snapshot.page.items.length&&!locked?<section className="status-card"><h2>프로젝트가 없습니다</h2><p>새 프로젝트를 만들거나 먼저 방법론을 준비하세요.</p><a href="#/methodologies">방법론 준비</a></section>:null}
    <ul className="project-list">{snapshot?.page.items.map(item=><li className="status-card" key={item.id}>
      <h2>{locked?<span>{item.name} · 목록 재확인 후 열기</span>:<a href={`#/projects/${item.id}/workspace`} aria-label={`${item.name} 프로젝트 열기`}>{item.name}</a>}</h2>
      <p>{item.purpose}</p><p className="meta">버전 {item.version} · 원본 정의 변경 {new Date(item.updatedAt).toLocaleString('ko-KR')} · 최근 실행 시각 아님</p>
      <p className="meta">목록 항목 관측: <time dateTime={snapshot.itemObservedAt[item.id]}>{new Date(snapshot.itemObservedAt[item.id]!).toLocaleString('ko-KR')}</time> · 관측 뒤 상태·권한 변경 가능</p>
      <p className="meta">현재 실행 단계·다음 행동: 미확인 · 조회 응답에 없음</p>
      {!locked?<><a href={routeHref('approvals',item.id)} aria-label={item.name+' 승인 요청 보기'}>승인 요청 화면 열기 · 건수는 별도 조회</a>{' · '}<a href={routeHref('control',item.id)} aria-label={item.name+' 작업 권한 인계 화면 열기'}>작업 권한 인계 화면 열기</a></>:null}
      <ProjectAccessSummary key={[item.id,snapshot.query,snapshot.archived,snapshot.refresh,item.version].join(':')} client={client} projectId={item.id} name={item.name} disabled={locked} onAuthenticationLost={onAuthenticationLost}/>
      <ProjectPendingApprovals key={'decisions:'+ [item.id,snapshot.query,snapshot.archived,snapshot.refresh,item.version].join(':')} client={client} projectId={item.id} name={item.name} disabled={locked} onAuthenticationLost={onAuthenticationLost}/>
      <ProjectAssignmentDrafts key={'drafts:'+ [item.id,snapshot.query,snapshot.archived,snapshot.refresh,item.version].join(':')} client={client} projectId={item.id} name={item.name} disabled={locked} onAuthenticationLost={onAuthenticationLost}/>
      <ProjectMethodologyOriginal key={'method:'+ [item.id,snapshot.query,snapshot.archived,snapshot.refresh,item.version].join(':')} client={client} projectId={item.id} name={item.name} disabled={locked} onAuthenticationLost={onAuthenticationLost}/>
    </li>)}</ul>
  </>;
}

export function ProjectsPage({ client, onAuthenticationLost, onNewProject }: { client: ApiClient; onAuthenticationLost: () => void; onNewProject: () => boolean }) {
  const [query, setQuery] = useState(() => new URLSearchParams(location.search).get('projectQuery') ?? '');
  const [applied, setApplied] = useState(query);
  const [archived, setArchived] = useState(() => new URLSearchParams(location.search).get('projectArchived') === 'true');
  const [cursor, setCursor] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<ProjectListSnapshot | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [refresh, setRefresh] = useState(0);
  const request={client,query:applied,archived,refresh,cursor},visible=selectProjectListSnapshot(snapshot,request);
  const newUrl = new URL(location.href); newUrl.searchParams.delete('draftId'); newUrl.hash = '/projects/new';
  function filter(event?: FormEvent, nextArchived = archived) {
    event?.preventDefault();
    const url = new URL(location.href);
    url.searchParams.set('projectQuery', query); url.searchParams.set('projectArchived', String(nextArchived));
    history.replaceState(history.state, '', url);
    setApplied(query); setArchived(nextArchived); setCursor(null); setSnapshot(null); setError(null); setRefresh(value => value + 1);
  }
  useEffect(() => {
    let current = true;
    setPending(true); setError(null);
    listProjects(client, applied, archived, cursor).then(result => {
      if (!current) return;
      setSnapshot(previous=>mergeProjectListSnapshot(previous,request,result));
    }).catch((cause: unknown) => {
      if (!current) return;
      const failure = cause instanceof ApiError ? cause : new ApiError('RESPONSE_INVALID');
      if ([401,403,404].includes(failure.status)) { setSnapshot(null); if (failure.status === 401) onAuthenticationLost(); }
      setError(failure);
    }).finally(() => { if (current) setPending(false); });
    return () => { current = false; };
  }, [client, applied, archived, cursor, refresh]);
  return <section aria-label="프로젝트 목록">
    <div className="project-toolbar"><form onSubmit={event => filter(event)}><label>프로젝트 검색<input value={query} onChange={event => setQuery(event.target.value)} maxLength={200} /></label><button disabled={pending}>검색</button></form><a className="button-link" href={newUrl.pathname + newUrl.search + newUrl.hash} onClick={event => { if (!onNewProject()) event.preventDefault(); }}>새 프로젝트</a><button disabled={pending} onClick={() => { setCursor(null); setRefresh(value => value + 1); }}>목록 새로고침</button></div>
    <div className="project-toolbar" role="group" aria-label="보관 필터"><button aria-pressed={!archived} onClick={() => filter(undefined, false)}>미보관</button><button aria-pressed={archived} onClick={() => filter(undefined, true)}>보관</button></div>
    <p className="meta">실행 진행·완료 단계와 다음 행동은 연결 전입니다. 대기 결정·저장 임무는 카드에서 별도로 조회하며 이 목록을 여는 것만으로 Agent를 시작하지 않습니다.</p>
    <ProjectListResults client={client} snapshot={visible} pending={pending} error={error} onAuthenticationLost={onAuthenticationLost}/>
    {visible?.page.hasMore ? <button disabled={pending || !!error || !visible.current} onClick={() => setCursor(visible.page.nextCursor)}>다음 프로젝트 더 보기</button> : null}
  </section>;
}
