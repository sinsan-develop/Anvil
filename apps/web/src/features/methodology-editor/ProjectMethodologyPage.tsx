import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { ApiClient, ApiError } from '../../api/client.ts';
import { getMethod, listMethods, type MethodPage, type MethodVersion } from './api.ts';
import { listProjectMethods, readProjectMethod, readProjectMethodAtVersion, readMethodApplicationRef, prepareProjectMethod, writeProjectMethod, type ProjectMethodPage } from './project-api.ts';
import type { VersionRef } from '../../../../../contracts/generated-types.ts';
import { CommonMethodEditor } from './CommonMethodEditor.tsx';
import { MethodReviewPanel } from './MethodReviewPanel.tsx';
import { MethodGraphCanvas } from './MethodGraphCanvas.tsx';
import type { MethodBuffer, MethodGateway } from './common-api.ts';
import { MethodVersionComparison } from './MethodVersionComparison.tsx';
import { StoredMethodValidation } from './StoredMethodValidation.tsx';
import { StoredNodeDefinition } from './StoredNodeDefinition.tsx';
import { StoredNodeRoutes } from './StoredNodeRoutes.tsx';
import { MethodApplicationPanel } from './MethodApplicationPanel.tsx';
import { AppliedMethodOriginal } from './AppliedMethodOriginal.tsx';

type CursorPosition = { cursor: string | null; history: (string | null)[] };
type ListNavigation = { own: CursorPosition; catalog: CursorPosition };
const firstPage = (): CursorPosition => ({ cursor: null, history: [] });
const firstLists = (): ListNavigation => ({ own: firstPage(), catalog: firstPage() });

export function ProjectMethodologyPage({ client, projectId, session, buffer, onChange, onAuthenticationLost }: {
  client: ApiClient; projectId: string; session: { user: { id: string }; clientId: string; csrfToken: string }; buffer: MethodBuffer;
  onChange: Dispatch<SetStateAction<MethodBuffer>>; onAuthenticationLost: () => void;
}) {
  const [page, setPage] = useState<ProjectMethodPage | null>(null), [catalog, setCatalog] = useState<MethodPage | null>(null), [source, setSource] = useState<MethodVersion | null>(null);
  const [error, setError] = useState<ApiError | null>(null), [loading, setLoading] = useState(true), [revision, setRevision] = useState(0);
  const [navigation, setNavigation] = useState<ListNavigation>(firstLists), [position, setPosition] = useState<ListNavigation>(firstLists);
  const [nodeId, setNodeId] = useState('');
  const [appliedRef, setAppliedRef] = useState<VersionRef | null | undefined>(undefined);
  function failed(cause: unknown) { const failure = cause instanceof ApiError ? cause : new ApiError('RESPONSE_INVALID'); setError(failure); if ([401, 403, 404].includes(failure.status)) { setSource(null); setPage(null); setCatalog(null); if (failure.status === 401) onAuthenticationLost(); } }
  useEffect(() => {
    let current = true; setLoading(true); setError(null);
    Promise.all([listProjectMethods(client, projectId, navigation.own.cursor), listMethods(client, { ...(navigation.catalog.cursor ? { cursor: navigation.catalog.cursor } : {}) }), readMethodApplicationRef(client, projectId)]).then(([own, common, applied]) => { if (current) { setPage(own); setCatalog(common); setAppliedRef(applied); setPosition(navigation); } }).catch(cause => { if (current) { setAppliedRef(undefined); failed(cause); } }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [client, projectId, revision, navigation]);
  function navigate(list: keyof ListNavigation, back: boolean) {
    if (loading || error) return;
    const current = position[list];
    if (!back && !(list === 'own' ? page?.hasMore : catalog?.hasMore)) return;
    const cursor = back ? current.history.at(-1) : list === 'own' ? page?.nextAfterId : catalog?.nextCursor;
    if (cursor === undefined || !back && cursor === null) return;
    setLoading(true);
    setNavigation({ ...position, [list]: { cursor, history: back ? current.history.slice(0, -1) : [...current.history, current.cursor] } });
  }
  function resetLists(all: boolean) {
    setLoading(true); setNavigation(current => ({ own: firstPage(), catalog: all ? firstPage() : current.catalog })); setRevision(value => value + 1);
  }
  const gateway: MethodGateway = { prepare: request => prepareProjectMethod(client, projectId, session, request), write: request => writeProjectMethod(client, request, session.csrfToken), read: (ref, name, purpose) => readProjectMethod(client, projectId, ref, name, purpose) };
  const headVersion = source && 'headVersion' in source ? Number(source.headVersion) : null;
  const selectedNode = source?.graph.nodes.find(node => node.nodeId === nodeId) ?? source?.graph.nodes.find(node => node.nodeId === source.graph.entryNodeId);
  const formAccess = source && selectedNode && !loading && !error ? { client, onAuthenticationLost, contextKey: JSON.stringify([session.user.id, session.clientId, projectId, source.ref, selectedNode.nodeId]) } : undefined;
  async function select(load: () => Promise<MethodVersion>) { if (loading) return; setLoading(true); setError(null); setSource(null); try { setSource(await load()); } catch (cause) { failed(cause); } finally { setLoading(false); } }
  return <>
    <section aria-label="프로젝트 전용 방법론 조회"><h2>프로젝트 전용 방법론</h2>
      <p className="meta">공통 원본과 기존 적용본은 유지됩니다. 저장·내용 검토·확정은 적용 전환이나 Agent 실행이 아닙니다.</p>
      <section aria-label="고정 적용본 조회" className="status-card"><h3>현재 고정 적용본</h3>{appliedRef === undefined ? <p>적용본 조회 미확인</p> : appliedRef === null ? <p>확인된 적용본 없음</p> : <><p>적용 세대 {appliedRef.version}</p><p className="meta">{appliedRef.id} · {appliedRef.contentHash}</p><p className="meta">아래 편집·확정 후보와 별개인 적용 snapshot 참조입니다.</p></>}</section>
      {!loading&&!error&&appliedRef?<AppliedMethodOriginal key={JSON.stringify([projectId,session.user.id,session.clientId,appliedRef])} client={client} projectId={projectId} expected={appliedRef} onAuthenticationLost={onAuthenticationLost}/>:null}
      <button disabled={loading} onClick={() => resetLists(true)}>전용 방법론 목록 갱신</button>
      {page?.items.map(item => <button disabled={loading} key={item.ref.id} onClick={() => { void select(() => readProjectMethod(client, projectId, item.ref, item.name, item.purpose)); }}>{item.name} v{item.ref.version} 열기</button>)}
      <button disabled={loading || !!error || !position.own.history.length} onClick={() => navigate('own', true)}>전용 방법론 이전 목록</button>
      <button disabled={loading || !!error || !page?.hasMore} onClick={() => navigate('own', false)}>전용 방법론 다음 목록</button>
      <h3>복사할 시스템·내 공통 원본</h3>{catalog?.items.map(item => <button disabled={loading} key={item.ref.id} onClick={() => { void select(() => getMethod(client, item)); }}>{item.name} 전용 복사 원본</button>)}
      <button disabled={loading || !!error || !position.catalog.history.length} onClick={() => navigate('catalog', true)}>복사 원본 이전 목록</button>
      <button disabled={loading || !!error || !catalog?.hasMore} onClick={() => navigate('catalog', false)}>복사 원본 다음 목록</button>
      {loading ? <p role="status">방법론 원본 조회 중</p> : null}{error ? <><p role="alert">{error.message} 이전 목록은 현재 자료로 간주하지 않습니다.</p><button disabled={loading} onClick={() => { setLoading(true); setRevision(value => value + 1); }}>방법론 목록 다시 조회</button></> : null}
    </section>
    {source ? <section aria-label="선택한 전용 원본" className="status-card"><h3>{source.name} · 버전 {source.ref.version}</h3><p>{source.purpose}</p><p className="meta">{source.scope === 'PROJECT' ? '프로젝트 전용' : source.scope === 'SYSTEM' ? '시스템 원본' : '내 공통 원본'} · {source.ref.contentHash}</p>
      {source.scope === 'PROJECT' ? <div><button disabled={loading || source.ref.version <= 1} onClick={() => { void select(() => readProjectMethodAtVersion(client, projectId, source.ref.id, source.ref.version - 1)); }}>이전 방법론 버전</button><button disabled={loading || !headVersion || source.ref.version >= headVersion} onClick={() => { void select(() => readProjectMethodAtVersion(client, projectId, source.ref.id, source.ref.version + 1)); }}>다음 방법론 버전</button><p className="meta">현재 조회 {source.ref.version} / 최신 {headVersion} · 과거 원문과 확정 이력 보존</p></div> : null}
      <MethodGraphCanvas graph={source.graph} selectedId={source.graph.nodes.some(node => node.nodeId === nodeId) ? nodeId : source.graph.entryNodeId} onSelect={setNodeId} label="프로젝트 방법론 원본 흐름" />
      {selectedNode ? <section aria-label="전용 원본 선택 단계 상세"><StoredNodeDefinition node={selectedNode} formAccess={formAccess} /><StoredNodeRoutes graph={source.graph} nodeId={selectedNode.nodeId} /></section> : null}
      <details><summary>절차 원문과 구조 검사</summary>{source.graph.nodes.map(node => <div key={node.nodeId}><h4>{node.name}</h4><p>{node.purpose}</p><ul>{node.completionCriteria.map((value, index) => <li key={index}>{value}</li>)}</ul></div>)}<StoredMethodValidation graph={source.graph} validation={source.validation} onSelect={setNodeId} /></details>
      <p>{source.confirmation ? '이 버전의 확정 이력 있음 · 적용 여부와 별도' : '이 버전의 별도 확정 이력 없음'}</p></section> : null}
    {source?.scope==='PROJECT'&&headVersion?<MethodVersionComparison key={`${projectId}:${source.ref.id}:${source.ref.version}:${source.ref.contentHash}`} client={client} projectId={projectId} base={source} maxVersion={headVersion} onAuthenticationLost={onAuthenticationLost}/>:null}
    <CommonMethodEditor client={client} projectId={projectId} session={session} source={source} buffer={buffer} onChange={onChange} gateway={gateway} onAuthenticationLost={onAuthenticationLost} onSaved={() => resetLists(false)} />
    {source?.scope === 'PROJECT' ? <MethodReviewPanel client={client} session={session} source={source} buffer={buffer} onChange={onChange} gateway={gateway} onVerified={setSource} onAuthenticationLost={onAuthenticationLost} /> : null}
    <MethodApplicationPanel key={JSON.stringify([projectId,session.user.id,session.clientId,source?.ref??null])} client={client} projectId={projectId} session={session} source={source} appliedRef={appliedRef} unavailable={loading||!!error} buffer={buffer} onChange={onChange} onApplied={setAppliedRef} onAuthenticationLost={onAuthenticationLost}/>
  </>;
}
