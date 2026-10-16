import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { ApiClient, ApiError } from '../../api/client.ts';
import type { DocumentSession } from './editor-api.ts';
import { prepareDocumentConfirmation, sendDocumentConfirmation, type DocumentConfirmationBuffer } from './confirmation-api.ts';
export function DocumentConfirmation({ client, session, buffer, onChange, onConfirmed, onAuthenticationLost }: { client: ApiClient; session: DocumentSession; buffer: DocumentConfirmationBuffer; onChange: Dispatch<SetStateAction<DocumentConfirmationBuffer | null>>; onConfirmed: () => void; onAuthenticationLost: () => void }) {
  const [busy, setBusy] = useState(false), running = useRef(false), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const locked = busy || !!buffer.pending || buffer.saved;
  const same = (p: DocumentConfirmationBuffer | null) => p?.ownerUserId === session.user.id && p.projectId === buffer.projectId && p.ref.id === buffer.ref.id && p.ref.version === buffer.ref.version && p.ref.contentHash === buffer.ref.contentHash;
  async function save() {
    if (running.current || buffer.ownerUserId !== session.user.id || buffer.saved) return;
    running.current = true; setBusy(true); let command = buffer.pending;
    try {
      command ??= prepareDocumentConfirmation(buffer, session); const pending = command;
      onChange(p => same(p) ? { ...p!, pending, failure: null } : p);
      await sendDocumentConfirmation(client, { ...buffer, pending }, session, () => mounted.current);
      onChange(p => p?.pending?.commandId === pending.commandId ? { ...p, pending: null, saved: true, failure: null } : p);
      if (mounted.current) onConfirmed();
    } catch (cause) {
      const error = cause instanceof ApiError ? cause : new ApiError('RESPONSE_INVALID');
      onChange(p => same(p) && (!command || p?.pending?.commandId === command.commandId) ? { ...p!, failure: { code: error.code, status: error.status } } : p);
      if (mounted.current && error.status === 401) onAuthenticationLost();
    } finally { running.current = false; if (mounted.current) setBusy(false); }
  }
  return <section className="status-card definition-editor" aria-label="문서 별도 확정">
    <h2>문서 별도 확정</h2><p>{buffer.title} · 버전 {buffer.ref.version}</p><p className="meta">SHA256 {buffer.ref.contentHash} · 내용 검토 {buffer.reviewRefs[0]!.id}</p>
    <p>표시된 버전과 검토를 확인한 뒤 별도로 확정합니다. 작업 시작·배포·Agent 실행을 승인하지 않습니다.</p>
    {buffer.saved ? <p role="status">문서 확정 저장 확인 · Agent 실행 아님</p> : null}
    {buffer.failure ? <p role="alert">{new ApiError(buffer.failure.code, buffer.failure.status).message} · {buffer.failure.code} · 대상과 기존 명령을 보존했습니다.</p> : null}
    {buffer.pending ? <p>결과가 확인되지 않아 다른 버전/검토로 교체하지 않습니다. 자동 재전송하지 않습니다.</p> : null}
    <label><input type="checkbox" checked={buffer.acknowledged} disabled={locked} onChange={e => onChange(p => same(p) ? { ...p!, acknowledged: e.target.checked } : p)} />이 문서 버전과 검토 결과를 확인했습니다</label>
    <div className="project-toolbar"><button disabled={busy || buffer.saved || !buffer.acknowledged} onClick={() => { void save(); }}>{buffer.pending ? '같은 확정 명령 결과 확인' : '문서 버전 확정'}</button><button disabled={busy || !!buffer.pending} onClick={() => onChange(p => p === buffer ? null : p)}>확정 준비 닫기</button></div>
  </section>;
}
