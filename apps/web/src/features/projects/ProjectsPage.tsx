import { useEffect, useState, type FormEvent } from 'react';
import { ApiClient, ApiError } from '../../api/client.ts';
import { listProjects, type ProjectPage } from './api.ts';
import {ProjectAccessSummary} from './ProjectAccessSummary.tsx';
import {routeHref} from '../../shell/routes.ts';
import {ProjectPendingApprovals} from './ProjectPendingApprovals.tsx';

export function ProjectsPage({ client, onAuthenticationLost, onNewProject }: { client: ApiClient; onAuthenticationLost: () => void; onNewProject: () => boolean }) {
  const [query, setQuery] = useState(() => new URLSearchParams(location.search).get('projectQuery') ?? '');
  const [applied, setApplied] = useState(query);
  const [archived, setArchived] = useState(() => new URLSearchParams(location.search).get('projectArchived') === 'true');
  const [cursor, setCursor] = useState<string | null>(null);
  const [page, setPage] = useState<ProjectPage | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [refresh, setRefresh] = useState(0);
  const newUrl = new URL(location.href); newUrl.searchParams.delete('draftId'); newUrl.hash = '/projects/new';
  function filter(event?: FormEvent, nextArchived = archived) {
    event?.preventDefault();
    const url = new URL(location.href);
    url.searchParams.set('projectQuery', query); url.searchParams.set('projectArchived', String(nextArchived));
    history.replaceState(history.state, '', url);
    setApplied(query); setArchived(nextArchived); setCursor(null); setPage(null); setError(null); setRefresh(value => value + 1);
  }
  useEffect(() => {
    let current = true;
    setPending(true); setError(null);
    listProjects(client, applied, archived, cursor).then(result => {
      if (!current) return;
      setPage(previous => cursor && previous ? { ...result, items: [...new Map([...previous.items, ...result.items].map(item => [item.id, item])).values()] } : result);
    }).catch((cause: unknown) => {
      if (!current) return;
      const failure = cause instanceof ApiError ? cause : new ApiError('RESPONSE_INVALID');
      if (failure.status === 401 || failure.status === 403) { setPage(null); if (failure.status === 401) onAuthenticationLost(); }
      setError(failure);
    }).finally(() => { if (current) setPending(false); });
    return () => { current = false; };
  }, [client, applied, archived, cursor, refresh]);
  return <section aria-label="프로젝트 목록">
    <div className="project-toolbar"><form onSubmit={event => filter(event)}><label>프로젝트 검색<input value={query} onChange={event => setQuery(event.target.value)} maxLength={200} /></label><button disabled={pending}>검색</button></form><a className="button-link" href={newUrl.pathname + newUrl.search + newUrl.hash} onClick={event => { if (!onNewProject()) event.preventDefault(); }}>새 프로젝트</a><button disabled={pending} onClick={() => { setCursor(null); setRefresh(value => value + 1); }}>목록 새로고침</button></div>
    <div className="project-toolbar" role="group" aria-label="보관 필터"><button aria-pressed={!archived} onClick={() => filter(undefined, false)}>미보관</button><button aria-pressed={archived} onClick={() => filter(undefined, true)}>보관</button></div>
    <p className="meta">진행·완료 단계와 결정·최근 작업·다음 행동은 실행/계획 연결 전입니다. 이 목록을 여는 것만으로 Agent를 시작하지 않습니다.</p>
    {pending ? <p role="status">프로젝트를 조회하고 있습니다.</p> : null}
    {error ? <p role="alert">{error.message}{page ? ' 앞선 목록은 오래된 자료입니다.' : ''}</p> : null}
    {page ? <p className="meta">관측 시각: <time dateTime={page.observedAt}>{new Date(page.observedAt).toLocaleString('ko-KR')}</time>{error || pending ? ' · 현재 상태 미확인' : ''}</p> : null}
    {page && !page.items.length && !error && !pending ? <section className="status-card"><h2>프로젝트가 없습니다</h2><p>새 프로젝트를 만들거나 먼저 방법론을 준비하세요.</p><a href="#/methodologies">방법론 준비</a></section> : null}
    <ul className="project-list">{page?.items.map(item => <li className="status-card" key={item.id}><h2><a href={`#/projects/${item.id}/workspace`} aria-label={`${item.name} 프로젝트 열기`}>{item.name}</a></h2><p>{item.purpose}</p><p className="meta">버전 {item.version} · 원본 변경 {new Date(item.updatedAt).toLocaleString('ko-KR')}</p><p className="meta">현재 실행 단계·다음 행동: 연결 전</p>{!pending&&!error?<a href={routeHref('approvals',item.id)} aria-label={item.name+' 승인 요청 보기'}>승인 요청 화면 열기 · 건수는 별도 조회</a>:null}<ProjectAccessSummary key={[item.id,applied,archived,refresh,item.version].join(':')} client={client} projectId={item.id} name={item.name} disabled={pending||!!error} onAuthenticationLost={onAuthenticationLost}/><ProjectPendingApprovals key={'decisions:'+ [item.id,applied,archived,refresh,item.version].join(':')} client={client} projectId={item.id} name={item.name} disabled={pending||!!error} onAuthenticationLost={onAuthenticationLost}/></li>)}</ul>
    {page?.hasMore ? <button disabled={pending || !!error} onClick={() => setCursor(page.nextCursor)}>다음 프로젝트 더 보기</button> : null}
  </section>;
}
