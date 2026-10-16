import { useEffect, useId, useRef, useState } from 'react';
import { ApiClient, ApiError } from '../../api/client.ts';
import { getMethod, listMethods, type MethodSummary } from '../methodology-editor/api.ts';
import type { DraftMethodSelection } from '../../../../../contracts/project-drafts.ts';
import { DraftMethodEditor } from './DraftMethodEditor.tsx';

export function MethodologySelection({ client, value, disabled, onChange, onAuthenticationLost, onBusyChange }: {
  client: ApiClient; value: DraftMethodSelection | null; disabled: boolean; onChange: (selection: DraftMethodSelection | null) => void; onAuthenticationLost: () => void; onBusyChange: (busy: boolean) => void;
}) {
  const fieldId = useId();
  const [items, setItems] = useState<MethodSummary[]>([]), [selected, setSelected] = useState(''), [loading, setLoading] = useState(true), [retry, setRetry] = useState(0), [error, setError] = useState<ApiError | null>(null);
  const active = useRef(true), copying = useRef(false);
  const [copyPending, setCopyPending] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null), [nextCursor, setNextCursor] = useState<string | null>(null);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => {
    let current = true; setLoading(true); setError(null);
    listMethods(client, cursor ? { cursor } : {}).then(page => { if (current) { const available = page.items.filter(item => item.scope === 'SYSTEM' || item.status === 'CONFIRMED'); setItems(previous => cursor ? [...previous, ...available.filter(item => !previous.some(old => old.ref.id === item.ref.id))] : available); setNextCursor(page.nextCursor); setSelected(id => cursor && id ? id : available.some(item => item.ref.id === id) ? id : available[0]?.ref.id ?? ''); } })
      .catch((cause: unknown) => { if (current) { const failure = cause instanceof ApiError ? cause : new ApiError('RESPONSE_INVALID'); setError(failure); if (!cursor || failure.status === 401 || failure.status === 403) setItems([]); if (failure.status === 401) onAuthenticationLost(); } }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [client, retry, cursor]);
  const chosen = items.find(item => item.ref.id === selected);
  const locked = disabled || copyPending;
  function replaceAllowed() { return !value || confirm('현재 초안의 방법론 선택·입력을 바꿀까요? 원본·서버 저장본은 유지합니다.'); }
  async function copy() {
    if (disabled || copying.current || !chosen || !replaceAllowed()) return;
    copying.current = true; setCopyPending(true); onBusyChange(true); setError(null);
    try {
      const source = await getMethod(client, chosen);
      if (active.current) onChange({ kind: 'NEW_PROJECT_DRAFT', name: source.name, purpose: source.purpose, graph: structuredClone(source.graph), sourceRefs: [source.ref], reviewRefs: [] });
    } catch (cause: unknown) {
      if (active.current) { const failure = cause instanceof ApiError ? cause : new ApiError('RESPONSE_INVALID'); setError(failure); if (failure.status === 401) onAuthenticationLost(); }
    } finally { copying.current = false; if (active.current) { setCopyPending(false); onBusyChange(false); } }
  }
  return <section aria-label="프로젝트 방법론 선택" className="definition-editor">
    <h3>방법론·자료</h3><p>시스템 기본본 또는 내 공통 확정본의 정확 버전을 선택합니다. 선택·중간 저장은 프로젝트 생성이나 Agent 실행이 아닙니다.</p>
    <label htmlFor={fieldId}>사용할 방법론</label><select id={fieldId} disabled={locked || loading || !!error} value={selected} onChange={event => setSelected(event.target.value)}><option value="">선택하세요</option>{items.map(item => <option key={item.ref.id} value={item.ref.id}>{item.name} · {item.scope === 'SYSTEM' ? '승인된 기본본' : '내 확정본'} · 버전 {item.ref.version}</option>)}</select>
    <button type="button" disabled={locked || loading || !!error || !chosen} onClick={() => { if (chosen && replaceAllowed()) onChange({ kind: 'CONFIRMED_REFERENCE', versionRef: chosen.ref }); }}>선택한 방법론 연결</button>
    <button type="button" disabled={locked || loading || !!error || !chosen} onClick={() => { void copy(); }}>선택 방법론을 이 프로젝트 초안으로 복사</button>
    <button type="button" disabled={locked} onClick={() => { if (replaceAllowed()) onChange({ kind: 'NEW_PROJECT_DRAFT', name: '', purpose: '', graph: { nodes: [], edges: [], entryNodeId: '', terminalNodeIds: [] }, sourceRefs: [], reviewRefs: [] }); }}>이 프로젝트 방법론 직접 작성</button>
    <button type="button" disabled={locked || loading} onClick={() => { setCursor(null); setRetry(value => value + 1); }}>선택 목록 다시 조회</button>
    <button type="button" disabled={locked || loading || !nextCursor} onClick={() => { setCursor(nextCursor); setRetry(value => value + 1); }}>방법론 선택 목록 더 보기</button>
    {copyPending ? <p role="status">원본의 정확 버전을 읽고 있습니다. 조회가 끝날 때까지 저장하지 않습니다.</p> : null}
    {loading ? <p role="status">선택 가능한 방법론을 조회하고 있습니다.</p> : null}
    {error ? <p role="alert">{error.message} 초안에 저장한 선택은 변경하지 않았습니다.</p> : null}
    {value?.kind === 'CONFIRMED_REFERENCE' ? <div><p>선택한 고정 방법론 · 버전 {value.versionRef.version}</p><p className="meta">{value.versionRef.id} · {value.versionRef.contentHash}</p><p>기본본의 원 출처 승인과 사용자 확정 기록을 구분하며 최종 생성 때 다시 검사합니다.</p></div> : value ? <p>프로젝트 전용 방법론 초안 · {value.name} · 내용 검토·확정 전</p> : <p>방법론 선택 전</p>}
    {value ? <button type="button" disabled={locked} onClick={() => { if (confirm('이 생성 초안의 방법론 선택만 해제할까요? 원본은 유지합니다.')) onChange(null); }}>초안의 방법론 선택 해제</button> : null}
    {value?.kind === 'NEW_PROJECT_DRAFT' ? <DraftMethodEditor client={client} value={value} disabled={locked} onChange={onChange} onAuthenticationLost={onAuthenticationLost} /> : null}
    <p className="meta">문서 가져오기·프로젝트 전용 내용 검토/확정은 후속 연결 대상입니다. 필수 자료를 완료한 것으로 처리하지 않습니다.</p>
  </section>;
}
