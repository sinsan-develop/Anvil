import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { ApiClient, ApiError } from '../../api/client.ts';
import { continueDocumentSave, prepareDocumentSave, type DocumentBuffer, type DocumentSession } from './editor-api.ts';
import { adoptDocumentConflict, canCompareDocumentConflict, compareDocumentConflict, type DocumentConflictComparison } from './conflict-api.ts';

export function DocumentEditor({ client, session, buffer, onChange, onSaved, onAuthenticationLost }: { client: ApiClient; session: DocumentSession; buffer: DocumentBuffer; onChange: Dispatch<SetStateAction<DocumentBuffer | null>>; onSaved: (id: string, version: number, title: string) => void; onAuthenticationLost: () => void }) {
  const [busy, setBusy] = useState(false), running = useRef(false), mounted = useRef(true);
  const [comparison, setComparison] = useState<DocumentConflictComparison | null>(null), [acknowledged, setAcknowledged] = useState(false), [comparisonError, setComparisonError] = useState<ApiError | null>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const locked = busy || !!buffer.pending;
  function change(patch: Partial<DocumentBuffer>) { if (!locked) onChange(previous => previous?.ownerUserId === session.user.id && previous.projectId === buffer.projectId && previous.documentId === buffer.documentId ? { ...previous, ...patch, dirty: true, savedRef: null, failure: null } : previous); }
  async function save() {
    if (running.current || buffer.ownerUserId !== session.user.id) return;
    running.current = true; setBusy(true);
    let pending = buffer.pending;
    try {
      if (!pending) { pending = await prepareDocumentSave(buffer, session); const prepared = pending; onChange(previous => previous?.ownerUserId === session.user.id && previous.documentId === buffer.documentId && previous.projectId === buffer.projectId ? { ...previous, pending: prepared, failure: null } : previous); }
      const command = pending.upload.commandId;
      const ref = await continueDocumentSave(client, pending, session, value => onChange(previous => previous?.pending?.upload.commandId === command ? { ...previous, pending: value } : previous), () => mounted.current);
      onChange(previous => previous?.pending?.upload.commandId === command ? { ...previous, documentId: ref.id, baseVersion: ref.version, pending: null, dirty: false, savedRef: ref, failure: null } : previous);
      if (mounted.current) onSaved(ref.id, ref.version, buffer.title);
    } catch (cause) {
      const error = cause instanceof ApiError ? cause : new ApiError('RESPONSE_INVALID');
      onChange(previous => previous?.ownerUserId === session.user.id && previous.projectId === buffer.projectId && previous.documentId === buffer.documentId ? { ...previous, failure: { code: error.code, status: error.status } } : previous);
      if (mounted.current && error.status === 401) onAuthenticationLost();
    } finally { running.current = false; if (mounted.current) setBusy(false); }
  }
  async function compare() {
    if (running.current) return; running.current = true; setBusy(true); setComparison(null); setAcknowledged(false); setComparisonError(null);
    try { const value = await compareDocumentConflict(client, buffer, session); if (mounted.current) setComparison(value); }
    catch (cause) { if (mounted.current) { const error = cause instanceof ApiError ? cause : new ApiError('RESPONSE_INVALID'); setComparisonError(error); if (error.status === 401) onAuthenticationLost(); } }
    finally { running.current = false; if (mounted.current) setBusy(false); }
  }
  function adopt() {
    if (!comparison || busy) return;
    try { const next = adoptDocumentConflict(buffer, comparison, session, acknowledged); onChange(previous => previous?.pending?.saveCommandId === comparison.rejectedCommandId && canCompareDocumentConflict(previous) ? next : previous); setComparison(null); setAcknowledged(false); }
    catch (cause) { setComparisonError(cause instanceof ApiError ? cause : new ApiError('RESPONSE_INVALID')); }
  }
  return <section className="status-card definition-editor" aria-label="문서 초안 편집">
    <h2>문서 초안 편집</h2><p className="meta">기준 버전 {buffer.baseVersion} · 원본/구버전은 보존됩니다. 이 저장은 사용자 확정이나 Agent 실행이 아닙니다.</p>
    {buffer.savedRef ? <p role="status">초안 버전 {buffer.savedRef.version} 저장 확인</p> : null}
    {buffer.failure ? <p role="alert">{new ApiError(buffer.failure.code, buffer.failure.status).message} · {buffer.failure.code} · 입력과 기존 명령을 보존했습니다.</p> : null}
    {buffer.pending ? <p>저장 결과 확인 전에는 입력을 바꾸거나 새 명령을 만들지 않습니다. 자동 재전송하지 않습니다.</p> : null}
    {buffer.reconciliation ? <p className="meta">충돌 비교 후 기준 {buffer.reconciliation.fromVersion}→{buffer.reconciliation.toVersion} · 이전 거절 명령 {buffer.reconciliation.rejectedCommandId} · 아직 새 초안 저장 전이면 별도로 저장하세요.</p> : null}
    {canCompareDocumentConflict(buffer) ? <button disabled={busy} onClick={() => { void compare(); }}>최신 버전과 비교</button> : null}
    {comparisonError ? <p role="alert">{comparisonError.message} · {comparisonError.code} · 기존 입력과 명령을 유지했습니다.</p> : null}
    {comparison ? <section className="status-card" aria-label="문서 버전 충돌 비교"><h3>기준 {comparison.baseVersion} → 서버 {comparison.latest.document.version}</h3><p>내 제목·본문·항목 위치로 새 초안을 준비합니다. 서버 최신본은 구버전으로 보존되며 자동 합치기/저장은 하지 않습니다.</p><p>서버 제목: {comparison.latest.document.title} · 내 제목: {buffer.title}</p><pre aria-label="서버 최신 원문" className="document-original">{comparison.latest.body}</pre><pre aria-label="내 미저장 원문" className="document-original">{buffer.body}</pre>
      {!comparison.compatible ? <p role="alert">양식·첨부·원문 형식 또는 연결 자료가 달라 수동 조정이 필요합니다. 자동 채택하지 않습니다.</p> : null}
      <label><input type="checkbox" disabled={busy || !comparison.compatible} checked={acknowledged} onChange={e => setAcknowledged(e.target.checked)} />양쪽 내용을 비교했고 내 입력을 새 초안으로 저장하겠습니다</label><button disabled={busy || !comparison.compatible || !acknowledged} onClick={adopt}>내 입력으로 새 기준 초안 준비</button>
    </section> : null}
    <label>문서 제목<input value={buffer.title} maxLength={200} readOnly={locked} onChange={event => change({ title: event.target.value })} /></label>
    <label htmlFor={'document-body-' + buffer.documentId}>문서 본문 편집</label><textarea id={'document-body-' + buffer.documentId} value={buffer.body} rows={14} readOnly={locked} onChange={event => change({ body: event.target.value })} />
    <fieldset disabled={locked}><legend>양식 항목의 원문 위치</legend>{buffer.criteria.map(item => <label key={item.criterionId}>{item.title} 시작 줄<input type="number" min="1" value={buffer.content.sections.find(section => section.itemId === item.criterionId)?.anchor.slice(5) ?? ''} onChange={event => { const kept = buffer.content.sections.filter(section => section.itemId !== item.criterionId); change({ content: { ...buffer.content, sections: event.target.value ? [...kept, { itemId: item.criterionId, anchor: 'line:' + event.target.value }] : kept } }); }} /></label>)}</fieldset>
    <label htmlFor={'document-reason-' + buffer.documentId}>문서 변경 이유</label><textarea id={'document-reason-' + buffer.documentId} value={buffer.reason} rows={2} maxLength={20_000} readOnly={locked} onChange={event => change({ reason: event.target.value })} />
    <div className="project-toolbar"><button disabled={busy || !buffer.pending && (!buffer.dirty || !buffer.title.trim() || !buffer.reason.trim())} onClick={() => { void save(); }}>{buffer.pending ? '같은 저장 명령 결과 확인' : '새 초안 버전 저장'}</button>
      <button disabled={locked} onClick={() => { if (!buffer.dirty || confirm('이 문서의 미저장 편집 입력을 버릴까요?')) onChange(previous => previous === buffer ? null : previous); }}>편집 닫기</button></div>
  </section>;
}
