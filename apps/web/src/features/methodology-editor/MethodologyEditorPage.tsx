import { useEffect, useId, useState, type Dispatch, type SetStateAction } from 'react';
import { ApiClient, ApiError } from '../../api/client.ts';
import { FormsCatalog } from '../methodologies/FormsCatalog.tsx';
import { getMethod, listMethods, type MethodPage, type MethodVersion } from './api.ts';
import { CommonMethodEditor } from './CommonMethodEditor.tsx';
import type { MethodBuffer } from './common-api.ts';
import type { FormBuffer } from '../methodologies/form-editor-state.ts';
import { MethodGraphCanvas } from './MethodGraphCanvas.tsx';
import { MethodReviewPanel } from './MethodReviewPanel.tsx';
import { StoredMethodValidation } from './StoredMethodValidation.tsx';

const approvalLabels: Record<string, string> = {
  USER_REQUIREMENTS_CONFIRMATION: '사용자 요구사항 확인', USER_ITERATION_SCOPE_CONFIRMATION: '사용자 반복 범위 확인',
  USER_DESIGN_AND_SCREEN_CONFIRMATION: '사용자 설계·화면 확인', USER_WORK_AND_TEST_PLAN_CONFIRMATION: '사용자 작업·시험계획 확인',
  USER_INCREMENT_ACCEPTANCE: '사용자 증분 수용', USER_NEXT_ITERATION_OR_COMPLETION: '사용자 다음 반복·전체 완료 판단', USER_PROJECT_COMPLETION: '사용자 전체 완료 확인',
};
export function MethodologyEditorPage({ client, session, buffer, onChange, formBuffer, onFormChange, onAuthenticationLost }: { client: ApiClient; session: { user: { id: string }; clientId: string; csrfToken: string }; buffer: MethodBuffer; onChange: Dispatch<SetStateAction<MethodBuffer>>; formBuffer: FormBuffer; onFormChange: Dispatch<SetStateAction<FormBuffer>>; onAuthenticationLost: () => void }) {
  const filterId = useId();
  const [page, setPage] = useState<MethodPage | null>(null), [selectedId, setSelectedId] = useState(''), [nodeId, setNodeId] = useState('');
  const [version, setVersion] = useState<MethodVersion | null>(null), [error, setError] = useState<ApiError | null>(null);
  const [pending, setPending] = useState(true), [listRetry, setListRetry] = useState(0), [retry, setRetry] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null), [pageHistory, setPageHistory] = useState<(string | null)[]>([]);
  const [filterInput, setFilterInput] = useState({ scope: '', name: '', status: '' }), [filters, setFilters] = useState({ scope: '', name: '', status: '' });
  function resetList() { setCursor(null); setPageHistory([]); setVersion(null); setListRetry(value => value + 1); }
  const selected = page?.items.find(item => item.ref.id === selectedId);
  function failed(cause: unknown) {
    const failure = cause instanceof ApiError ? cause : new ApiError('RESPONSE_INVALID');
    if (failure.status === 401 || failure.status === 403) { setPage(null); setVersion(null); if (failure.status === 401) onAuthenticationLost(); }
    setError(failure);
  }
  useEffect(() => {
    let current = true;
    setPending(true); setError(null);
    listMethods(client, { ...(cursor ? { cursor } : {}), ...(filters.name ? { name: filters.name } : {}), ...(filters.scope ? { scope: filters.scope as 'SYSTEM' | 'USER_COMMON' } : {}), ...(filters.status ? { status: filters.status as 'DRAFT' | 'CONFIRMED' } : {}) }).then(data => { if (current) { setPage(data); setSelectedId(id => data.items.some(item => item.ref.id === id) ? id : data.items[0]?.ref.id ?? ''); } })
      .catch((cause: unknown) => { if (current) failed(cause); }).finally(() => { if (current) setPending(false); });
    return () => { current = false; };
  }, [client, listRetry, cursor, filters.name, filters.scope, filters.status]);
  useEffect(() => {
    if (!selected) return;
    let current = true;
    setPending(true); setError(null);
    getMethod(client, selected).then(data => { if (current) { setVersion(data); setNodeId(id => data.graph.nodes.some(node => node.nodeId === id) ? id : data.graph.entryNodeId); } })
      .catch((cause: unknown) => { if (current) failed(cause); }).finally(() => { if (current) setPending(false); });
    return () => { current = false; };
  }, [client, selected?.ref.id, selected?.ref.version, selected?.ref.contentHash, retry]);
  const node = version?.graph.nodes.find(item => item.nodeId === nodeId);
  return <>
    <section aria-label="방법론 원본 조회"><h2>절차·문서·검수 기준</h2>
      <form className="definition-editor" onSubmit={event => { event.preventDefault(); setFilters(filterInput); resetList(); }}><label htmlFor={filterId + '-name'}>방법론 이름 검색</label><input id={filterId + '-name'} maxLength={200} value={filterInput.name} onChange={event => setFilterInput(previous => ({ ...previous, name: event.target.value }))} />
        <label htmlFor={filterId + '-scope'}>방법론 범위</label><select id={filterId + '-scope'} value={filterInput.scope} onChange={event => setFilterInput(previous => ({ ...previous, scope: event.target.value }))}><option value="">전체 허가 범위</option><option value="SYSTEM">시스템 기본본</option><option value="USER_COMMON">내 공통본</option></select>
        <label htmlFor={filterId + '-status'}>방법론 확정 상태</label><select id={filterId + '-status'} value={filterInput.status} onChange={event => setFilterInput(previous => ({ ...previous, status: event.target.value }))}><option value="">전체 상태</option><option value="DRAFT">초안·미확정</option><option value="CONFIRMED">확정</option></select><button disabled={pending} type="submit">방법론 검색 적용</button></form>
      <div className="methodology-flow"><button disabled={pending || !pageHistory.length} onClick={() => { setVersion(null); setCursor(pageHistory.at(-1) ?? null); setPageHistory(previous => previous.slice(0, -1)); }}>방법론 이전 페이지</button>
        <button disabled={pending || !page?.hasMore || !!error} onClick={() => { if (page?.nextCursor) { setVersion(null); setPageHistory(previous => [...previous, cursor]); setCursor(page.nextCursor); } }}>방법론 다음 페이지</button>
        <button disabled={pending} onClick={resetList}>방법론 목록 처음부터 갱신</button><button disabled={pending} onClick={() => setListRetry(value => value + 1)}>현재 목록 다시 조회</button></div>
      <ul className="project-list">{page?.items.map(item => <li className="status-card" key={item.ref.id}><h3>{item.name}</h3><p>{item.purpose}</p><p className="meta">{item.scope === 'SYSTEM' ? '시스템 기본본' : '내 공통본'} · 버전 {item.ref.version}</p><button aria-pressed={selectedId === item.ref.id} onClick={() => { setSelectedId(item.ref.id); setVersion(null); setNodeId(''); setRetry(value => value + 1); }} aria-label={`${item.name} 상세 보기`}>상세 보기</button></li>)}</ul>
      <button disabled={pending} onClick={() => selected ? setRetry(value => value + 1) : setListRetry(value => value + 1)}>방법론 다시 조회</button>
      {pending ? <p role="status">방법론을 조회하고 있습니다.</p> : null}
      {error ? <p role="alert">{error.message}{version ? ' 앞선 그래프는 오래된 자료입니다.' : ''}</p> : null}
      {page && !page.items.length ? <p>조회 가능한 방법론이 없습니다.</p> : null}
      {version ? <section className="status-card" aria-label="선택 방법론 원본"><h3>{version.systemCode ?? '사용자 정의'} {version.name}</h3>
        <p className="meta">버전 {version.ref.version} · {version.ref.contentHash}</p>
        <p>실제 Agent·환경·한도 연결 전 · 실행 불가</p><p>{version.confirmation ? '이 버전의 사람 확정 이력 있음 · 프로젝트 적용은 별도' : 'Anvil 안의 사람 확정 이력 없음'}</p>
        <MethodGraphCanvas graph={version.graph} selectedId={nodeId} onSelect={setNodeId} label="원본 방법론 공간형 흐름도" />
        <div className="methodology-flow" role="group" aria-label="개발 절차">{version.graph.nodes.map((stage, index) => <button key={stage.nodeId} aria-pressed={stage.nodeId === nodeId} onClick={() => setNodeId(stage.nodeId)}>{index + 1}. {stage.name}</button>)}</div>
        {node ? <section aria-label="선택 단계 상세" className="status-card"><h4>{node.nodeId} {node.name}</h4><p>{node.purpose}</p><p className="meta">{node.kind === 'HUMAN' ? '사용자 판단 단계' : node.kind === 'AGENT' ? 'Agent 역할 단계 · 연결 전' : node.kind === 'JOIN' ? '결과 합류' : '분기 판단'} · 위치 {node.position.x}, {node.position.y}</p>
          <div className="methodology-detail"><div><h4>완료·검수 조건</h4><ul>{node.completionCriteria.map((text, index) => <li key={index}>{text}</li>)}</ul><h4>사람 확인 지점</h4>{node.approvalBoundary.length ? <ul>{node.approvalBoundary.map(code => <li key={code}>{approvalLabels[code] ?? code}</li>)}</ul> : <p>이 단계에 별도 사용자 확인 지점 없음 · 권한 검사는 유지</p>}
          <h4>작업 기록</h4><ul>{node.recordRequirements.map((text, index) => <li key={index}>{text}</li>)}</ul></div><div><h4>입력·산출 문서의 고정 버전</h4><ul>{[...node.inputs, ...node.outputs].map(item => <li key={item.itemId}><strong>{item.itemId}</strong><p className="meta">{item.sourceNodeId ? `${item.sourceNodeId}의 입력` : '단계 산출물'} · 버전 {item.formRef.version} · {item.formRef.contentHash}</p></li>)}</ul></div></div>
          <details><summary>다음·재작업 경로</summary><ul>{version.graph.edges.filter(edge => edge.fromNodeId === node.nodeId).map(edge => <li key={edge.edgeId}>{edge.kind === 'REWORK' ? '재작업/반복' : '다음'} → {edge.toNodeId}: {edge.reason}</li>)}</ul></details>
        </section> : null}
        <details><summary>구조 검사 결과 · 실제 실행 검증 아님</summary><StoredMethodValidation graph={version.graph} validation={version.validation} onSelect={setNodeId} /></details>
      </section> : null}
      <CommonMethodEditor client={client} session={session} source={!pending && !error ? version : null} buffer={buffer} onChange={onChange} onAuthenticationLost={onAuthenticationLost} onSaved={resetList} />
      {version && !pending && !error ? <MethodReviewPanel client={client} session={session} source={version} buffer={buffer} onChange={onChange} onVerified={setVersion} onAuthenticationLost={onAuthenticationLost} /> : null}
      <p className="meta">내 공통 방법론의 공간형·단계/문서/조건 편집과 내용 검토·별도 확정을 연결했습니다. 프로젝트 적용·실제 Agent·환경·한도 연결은 아직 미완료입니다. 화면 조회나 확정으로 Agent를 시작하지 않습니다.</p>
    </section>
    <FormsCatalog client={client} session={session} buffer={formBuffer} onChange={onFormChange} onAuthenticationLost={onAuthenticationLost} />
  </>;
}
