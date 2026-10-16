import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { ApiClient, ApiError } from '../../api/client.ts';
import { continueDocumentSave, prepareDocumentSave, type DocumentBuffer, type DocumentSession } from './editor-api.ts';

export function DocumentEditor({ client, session, buffer, onChange, onSaved, onAuthenticationLost }: { client: ApiClient; session: DocumentSession; buffer: DocumentBuffer; onChange: Dispatch<SetStateAction<DocumentBuffer | null>>; onSaved: (id: string, version: number, title: string) => void; onAuthenticationLost: () => void }) {
  const [busy, setBusy] = useState(false), running = useRef(false), mounted = useRef(true);
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
      onChange(previous => previous?.pending?.upload.commandId === command ? { ...previous, baseVersion: ref.version, pending: null, dirty: false, savedRef: ref, failure: null } : previous);
      if (mounted.current) onSaved(ref.id, ref.version, buffer.title);
    } catch (cause) {
      const error = cause instanceof ApiError ? cause : new ApiError('RESPONSE_INVALID');
      onChange(previous => previous?.ownerUserId === session.user.id && previous.projectId === buffer.projectId && previous.documentId === buffer.documentId ? { ...previous, failure: { code: error.code, status: error.status } } : previous);
      if (mounted.current && error.status === 401) onAuthenticationLost();
    } finally { running.current = false; if (mounted.current) setBusy(false); }
  }
  return <section className="status-card definition-editor" aria-label="문서 초안 편집">
    <h2>문서 초안 편집</h2><p className="meta">기준 버전 {buffer.baseVersion} · 원본/구버전은 보존됩니다. 이 저장은 사용자 확정이나 Agent 실행이 아닙니다.</p>
    {buffer.savedRef ? <p role="status">초안 버전 {buffer.savedRef.version} 저장 확인</p> : null}
    {buffer.failure ? <p role="alert">{new ApiError(buffer.failure.code, buffer.failure.status).message} · {buffer.failure.code} · 입력과 기존 명령을 보존했습니다.</p> : null}
    {buffer.pending ? <p>저장 결과 확인 전에는 입력을 바꾸거나 새 명령을 만들지 않습니다. 자동 재전송하지 않습니다.</p> : null}
    <label>문서 제목<input value={buffer.title} maxLength={200} readOnly={locked} onChange={event => change({ title: event.target.value })} /></label>
    <label htmlFor={'document-body-' + buffer.documentId}>문서 본문 편집</label><textarea id={'document-body-' + buffer.documentId} value={buffer.body} rows={14} readOnly={locked} onChange={event => change({ body: event.target.value })} />
    <fieldset disabled={locked}><legend>양식 항목의 원문 위치</legend>{buffer.criteria.map(item => <label key={item.criterionId}>{item.title} 시작 줄<input type="number" min="1" value={buffer.content.sections.find(section => section.itemId === item.criterionId)?.anchor.slice(5) ?? ''} onChange={event => { const kept = buffer.content.sections.filter(section => section.itemId !== item.criterionId); change({ content: { ...buffer.content, sections: event.target.value ? [...kept, { itemId: item.criterionId, anchor: 'line:' + event.target.value }] : kept } }); }} /></label>)}</fieldset>
    <label htmlFor={'document-reason-' + buffer.documentId}>문서 변경 이유</label><textarea id={'document-reason-' + buffer.documentId} value={buffer.reason} rows={2} maxLength={20_000} readOnly={locked} onChange={event => change({ reason: event.target.value })} />
    <div className="project-toolbar"><button disabled={busy || !buffer.pending && (!buffer.dirty || !buffer.title.trim() || !buffer.reason.trim())} onClick={() => { void save(); }}>{buffer.pending ? '같은 저장 명령 결과 확인' : '새 초안 버전 저장'}</button>
      <button disabled={locked} onClick={() => { if (!buffer.dirty || confirm('이 문서의 미저장 편집 입력을 버릴까요?')) onChange(previous => previous === buffer ? null : previous); }}>편집 닫기</button></div>
  </section>;
}
