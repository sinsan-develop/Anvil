import { useId, useState } from 'react';
import { ApiClient, ApiError } from '../../api/client.ts';
import type { VersionRef } from '../../../../../contracts/generated-types.ts';
import { readDocumentStageOptions, sameStageRef, type StageNodeRef, type StageOptions } from './stage-api.ts';
export function DocumentStageSelector({ client, projectId, formRef, value, disabled, onChange, onAuthenticationLost }: {
  client: ApiClient; projectId: string; formRef: VersionRef; value: StageNodeRef | null; disabled: boolean; onChange: (value: StageNodeRef | null) => void; onAuthenticationLost: () => void;
}) {
  const id = useId(), [page, setPage] = useState<StageOptions | null>(null), [error, setError] = useState<ApiError | null>(null), [busy, setBusy] = useState(false);
  const matching = page?.items.find(item => sameStageRef(item.stageNodeRef, value));
  async function load() {
    if (busy || disabled) return; setBusy(true); setError(null); setPage(null);
    try { setPage(await readDocumentStageOptions(client, projectId, formRef)); }
    catch (cause) { const failure = cause instanceof ApiError ? cause : new ApiError('RESPONSE_INVALID'); setError(failure); if (failure.status === 401) onAuthenticationLost(); }
    finally { setBusy(false); }
  }
  function choose(nodeId: string) {
    if (disabled || busy || !page || nodeId === '__preserved') return;
    const next = nodeId ? page.items.find(item => item.stageNodeRef.nodeId === nodeId)?.stageNodeRef : null;
    if (next === undefined || sameStageRef(next, value)) return;
    if (value && !confirm('새 초안에서 기존 단계 연결을 변경할까요? 과거 문서 버전은 보존합니다.')) return;
    onChange(next ? { ...next } : null);
  }
  return <section className="status-card" aria-label="문서 단계 선택"><h3>개발 단계 연결</h3>
    <p className="meta">{value ? `보존된 연결: ${value.nodeId} · 적용본 ${value.applicationId}` : '단계 미연결 · 자동 선택하지 않습니다.'}</p>
    <button disabled={disabled || busy} onClick={() => { void load(); }}>현재 적용본 단계 조회</button>
    {page ? <><p className="meta">{page.methodologyName ?? '고정 적용본 없음'}{page.applicationRef ? ' · 적용 세대 ' + page.applicationRef.version : ''} · {page.observedAt}</p>
      <label htmlFor={id}>연결할 방법론 단계</label><select id={id} disabled={disabled || busy || !!error} value={matching?.stageNodeRef.nodeId ?? (value ? '__preserved' : '')} onChange={event => choose(event.target.value)}><option value="">단계 연결 안 함</option>{value && !matching ? <option value="__preserved">기존 연결 유지 · {value.nodeId}</option> : null}{page.items.map(item => <option key={item.stageNodeRef.nodeId} value={item.stageNodeRef.nodeId}>{item.nodeName} · {item.uses.map(use => use === 'INPUT' ? '입력' : '산출').join('/')}</option>)}</select>
      {page.status === 'FORM_NOT_LINKED' ? <p>이 양식의 정확한 버전이 정의된 단계가 없습니다. 방법론을 임의 변경하지 않습니다.</p> : null}</> : null}
    {error ? <p role="alert">{error.message} 기존 연결은 유지했습니다.</p> : null}{busy ? <p role="status">정확한 양식의 적용 단계 조회 중</p> : null}
  </section>;
}
