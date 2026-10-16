import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { ApiClient, ApiError } from '../../api/client.ts';
import { getMethod, listMethods, type MethodPage, type MethodVersion } from './api.ts';
import { listProjectMethods, readProjectMethod, prepareProjectMethod, writeProjectMethod, type ProjectMethodPage } from './project-api.ts';
import { CommonMethodEditor } from './CommonMethodEditor.tsx';
import { MethodReviewPanel } from './MethodReviewPanel.tsx';
import { MethodGraphCanvas } from './MethodGraphCanvas.tsx';
import type { MethodBuffer, MethodGateway } from './common-api.ts';

export function ProjectMethodologyPage({ client, projectId, session, buffer, onChange, onAuthenticationLost }: {
  client: ApiClient; projectId: string; session: { user: { id: string }; clientId: string; csrfToken: string }; buffer: MethodBuffer;
  onChange: Dispatch<SetStateAction<MethodBuffer>>; onAuthenticationLost: () => void;
}) {
  const [page, setPage] = useState<ProjectMethodPage | null>(null), [catalog, setCatalog] = useState<MethodPage | null>(null), [source, setSource] = useState<MethodVersion | null>(null);
  const [error, setError] = useState<ApiError | null>(null), [loading, setLoading] = useState(true), [revision, setRevision] = useState(0);
  const [afterId, setAfterId] = useState<string | null>(null), [catalogCursor, setCatalogCursor] = useState<string | null>(null);
  function failed(cause: unknown) { const failure = cause instanceof ApiError ? cause : new ApiError('RESPONSE_INVALID'); setError(failure); if ([401, 403, 404].includes(failure.status)) { setSource(null); setPage(null); setCatalog(null); if (failure.status === 401) onAuthenticationLost(); } }
  useEffect(() => {
    let current = true; setLoading(true); setError(null);
    Promise.all([listProjectMethods(client, projectId, afterId), listMethods(client, { ...(catalogCursor ? { cursor: catalogCursor } : {}) })]).then(([own, common]) => { if (current) { setPage(own); setCatalog(common); } }).catch(cause => { if (current) failed(cause); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [client, projectId, revision, afterId, catalogCursor]);
  const gateway: MethodGateway = { prepare: request => prepareProjectMethod(client, projectId, session, request), write: request => writeProjectMethod(client, request, session.csrfToken), read: (ref, name, purpose) => readProjectMethod(client, projectId, ref, name, purpose) };
  async function select(load: () => Promise<MethodVersion>) { if (loading) return; setLoading(true); setError(null); setSource(null); try { setSource(await load()); } catch (cause) { failed(cause); } finally { setLoading(false); } }
  return <>
    <section aria-label="프로젝트 전용 방법론 조회"><h2>프로젝트 전용 방법론</h2>
      <p className="meta">공통 원본과 기존 적용본은 유지됩니다. 저장·내용 검토·확정은 적용 전환이나 Agent 실행이 아닙니다.</p>
      <button disabled={loading} onClick={() => { setAfterId(null); setCatalogCursor(null); setRevision(value => value + 1); }}>전용 방법론 목록 갱신</button>
      {page?.items.map(item => <button disabled={loading} key={item.ref.id} onClick={() => { void select(() => readProjectMethod(client, projectId, item.ref, item.name, item.purpose)); }}>{item.name} v{item.ref.version} 열기</button>)}
      <button disabled={loading || !page?.hasMore} onClick={() => { if (page?.nextAfterId) setAfterId(page.nextAfterId); }}>전용 방법론 다음 목록</button>
      <h3>복사할 시스템·내 공통 원본</h3>{catalog?.items.map(item => <button disabled={loading} key={item.ref.id} onClick={() => { void select(() => getMethod(client, item)); }}>{item.name} 전용 복사 원본</button>)}
      <button disabled={loading || !catalog?.hasMore} onClick={() => { if (catalog?.nextCursor) setCatalogCursor(catalog.nextCursor); }}>복사 원본 다음 목록</button>
      {loading ? <p role="status">방법론 원본 조회 중</p> : null}{error ? <p role="alert">{error.message} 이전 목록은 현재 자료로 간주하지 않습니다.</p> : null}
    </section>
    {source ? <section aria-label="선택한 전용 원본" className="status-card"><h3>{source.name} · 버전 {source.ref.version}</h3><p>{source.purpose}</p><p className="meta">{source.scope === 'PROJECT' ? '프로젝트 전용' : source.scope === 'SYSTEM' ? '시스템 원본' : '내 공통 원본'} · {source.ref.contentHash}</p><MethodGraphCanvas graph={source.graph} selectedId={source.graph.entryNodeId} onSelect={() => {}} label="프로젝트 방법론 원본 흐름" />
      <details><summary>절차 원문과 구조 검사</summary>{source.graph.nodes.map(node => <div key={node.nodeId}><h4>{node.name}</h4><p>{node.purpose}</p><ul>{node.completionCriteria.map((value, index) => <li key={index}>{value}</li>)}</ul></div>)}<ul>{source.validation.issues.map((issue, index) => <li key={index}>{issue.location}: {issue.message}</li>)}</ul></details>
      <p>{source.confirmation ? '이 버전의 확정 이력 있음 · 적용 여부와 별도' : '이 버전의 별도 확정 이력 없음'}</p></section> : null}
    <CommonMethodEditor client={client} session={session} source={source} buffer={buffer} onChange={onChange} gateway={gateway} onAuthenticationLost={onAuthenticationLost} onSaved={() => { setAfterId(null); setRevision(value => value + 1); }} />
    {source?.scope === 'PROJECT' ? <MethodReviewPanel client={client} session={session} source={source} buffer={buffer} onChange={onChange} gateway={gateway} onVerified={setSource} onAuthenticationLost={onAuthenticationLost} /> : null}
    <section className="status-card" aria-label="방법론 적용 경계"><h3>기존 적용본 전환</h3><p>실행 상태 미확인 · 적용 전환 불가</p><button disabled>프로젝트 적용 전환</button></section>
  </>;
}
