import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { ApiClient, ApiError } from '../../api/client.ts';
import type { DocumentSession } from './editor-api.ts';
import { prepareDocumentReview, retireRejectedDocumentReview, sendDocumentReview, verifySavedDocumentReview, type DocumentReviewBuffer } from './review-api.ts';
import { documentMutationUncertain, isKnownDocumentRejection } from './mutation-result.ts';

const options = <><option value="NOT_EXECUTED">미확인</option><option value="ACCEPTED">적합</option><option value="REWORK">재작업</option><option value="BLOCKED">확인 불가</option></>;
export function DocumentReviewEditor({ client, session, buffer, onChange, onRecorded, onAuthenticationLost }: { client: ApiClient; session: DocumentSession; buffer: DocumentReviewBuffer; onChange: Dispatch<SetStateAction<DocumentReviewBuffer | null>>; onRecorded: () => void; onAuthenticationLost: () => void }) {
  const [busy, setBusy] = useState(false), running = useRef(false), mounted = useRef(true);
  const [retireError,setRetireError] = useState<ApiError | null>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const scope = useMemo(() => ({ client, transport: client.transport, userId: session.user.id, clientId: session.clientId, csrf: session.csrfToken }),
    [client, client.transport, session.user.id, session.clientId, session.csrfToken, buffer.ownerUserId, buffer.projectId, buffer.controlGeneration,
      buffer.ref.id, buffer.ref.version, buffer.ref.contentHash, buffer.criteria, buffer.items, buffer.reason, buffer.outcome]);
  const readContext = useMemo(() => ({ scope, buffer }), [scope, buffer]);
  const live = useRef(readContext);
  live.current = readContext;
  const current = () => mounted.current && live.current.scope === scope && client.transport === scope.transport &&
    session.user.id === scope.userId && session.clientId === scope.clientId && session.csrfToken === scope.csrf;
  const [read, setRead] = useState<{ context: typeof readContext; status: 'READING' | 'MATCH' | 'UNVERIFIED' } | null>(null);
  const reading = useRef<typeof readContext | null>(null);
  const displayed = read?.context === readContext ? read.status : null;
  async function verify() {
    if (!current() || reading.current === readContext) return;
    const active = () => current() && live.current === readContext;
    reading.current = readContext;
    setRead({ context: readContext, status: 'READING' });
    try {
      await verifySavedDocumentReview(client, buffer, session, active);
      if (active()) setRead({ context: readContext, status: 'MATCH' });
    } catch (cause) {
      if (active()) {
        setRead({ context: readContext, status: 'UNVERIFIED' });
        if (cause instanceof ApiError && cause.status === 401) onAuthenticationLost();
      }
    } finally { if (reading.current === readContext) reading.current = null; }
  }
  const locked = busy || !!buffer.pending;
  const same = (previous: DocumentReviewBuffer | null) => previous?.ownerUserId === session.user.id && previous.projectId === buffer.projectId && previous.controlGeneration === buffer.controlGeneration && previous.ref.id === buffer.ref.id && previous.ref.version === buffer.ref.version && previous.ref.contentHash === buffer.ref.contentHash;
  function change(patch: Partial<DocumentReviewBuffer>) { if (!locked) onChange(previous => same(previous) ? { ...previous!, ...patch, dirty: true, saved: false, savedReview: undefined, failure: null } : previous); }
  async function save() {
    if (running.current || buffer.ownerUserId !== session.user.id) return;
    running.current = true; setBusy(true); let command = buffer.pending;
    try {
      command ??= prepareDocumentReview(buffer, session); const pending = command;
      onChange(previous => same(previous) ? { ...previous!, pending, failure: null } : previous);
      const reviewRef = await sendDocumentReview(client, { ...buffer, pending }, session, current);
      if (!current()) return;
      const savedReview = { ownerUserId: session.user.id, command: structuredClone(pending), reviewRef };
      onChange(previous => same(previous) && previous?.pending?.commandId === pending.commandId ? { ...previous, pending: null, dirty: false, savedReview, saved: true, failure: null, uncertain: false } : previous);
      if (mounted.current) onRecorded();
    } catch (cause) {
      if (!current()) return;
      const error = cause instanceof ApiError ? cause : new ApiError('RESPONSE_INVALID');
      onChange(previous => same(previous) && (!command || previous?.pending?.commandId === command.commandId) ? { ...previous!, failure: { code: error.code, status: error.status }, uncertain: command ? documentMutationUncertain(previous?.uncertain,error) : !!previous?.uncertain } : previous);
      if (mounted.current && error.status === 401) onAuthenticationLost();
    } finally { running.current = false; if (mounted.current) setBusy(false); }
  }
  return <section className="status-card definition-editor" aria-label="문서 내용 검토 작성">
    <h2>문서 내용 검토 작성</h2><p>{buffer.title} · 버전 {buffer.ref.version}</p><p className="meta">SHA256 {buffer.ref.contentHash} · 사람의 검토 판단만 기록합니다. 문서 확정·시험 합격·Agent 실행 승인이 아닙니다.</p>
    {buffer.saved ? <p role="status">내용 검토 저장 확인 · 문서 확정 아님</p> : null}
    {buffer.saved && !buffer.dirty && buffer.savedReview?.ownerUserId === session.user.id && buffer.savedReview.command.clientId === session.clientId ? <>
      <button disabled={displayed === 'READING'} onClick={() => { void verify(); }}>저장된 검토 사건 조회</button>
      {displayed && <p role="status">{displayed === 'READING' ? '검토 사건 조회 중' : displayed === 'MATCH' ? '검토 사건 원문 일치' : '검토 사건 조회 미확인'}</p>}
    </> : null}
    {buffer.failure ? <p role="alert">{new ApiError(buffer.failure.code, buffer.failure.status).message} · {buffer.failure.code} · 입력과 기존 명령을 보존했습니다.</p> : null}
    {buffer.pending ? <p>결과 확인 전 입력/대상 버전을 바꾸지 않습니다. 자동 재전송하지 않습니다. 명확히 거절된 명령만 별도 선택으로 보관한 뒤 새 대상을 고릅니다.</p> : null}
    {buffer.rejectedAttempts?.length ? <details open><summary>거절된 검토 입력 보관</summary><pre className="document-original" aria-label="거절된 검토 명령 이력">{JSON.stringify(buffer.rejectedAttempts,null,2)}</pre></details> : null}
    {retireError ? <p role="alert">{retireError.message} · {retireError.code}</p> : null}
    {buffer.pending && !buffer.uncertain && isKnownDocumentRejection(buffer.failure) ? <button disabled={busy} onClick={() => { try { const next = retireRejectedDocumentReview(buffer,session); onChange(previous => previous?.pending?.commandId === buffer.pending?.commandId ? next : previous); setRetireError(null); } catch(e) { setRetireError(e instanceof ApiError ? e : new ApiError('RESPONSE_INVALID')); } }}>거절된 검토 명령 보관하고 입력 다시 열기</button> : null}
    <fieldset disabled={locked}><legend>고정 양식 항목별 검토</legend>{buffer.criteria.map((criterion, index) => <section key={criterion.criterionId}>
      <h3>{criterion.title}</h3><ul>{criterion.reviewCriteria.map((text, i) => <li key={i}>{text}</li>)}</ul>
      <label htmlFor={'review-outcome-' + index}>{criterion.title} 판단</label><select id={'review-outcome-' + index} value={buffer.items[index]!.outcome} onChange={event => change({ items: buffer.items.map((item, i) => i === index ? { ...item, outcome: event.target.value as typeof item.outcome } : item) })}>{options}</select>
      <label htmlFor={'review-reason-' + index}>{criterion.title} 근거</label><textarea id={'review-reason-' + index} rows={2} maxLength={20_000} value={buffer.items[index]!.reason} onChange={event => change({ items: buffer.items.map((item, i) => i === index ? { ...item, reason: event.target.value } : item) })} />
    </section>)}</fieldset>
    <label htmlFor="document-review-outcome">내용 검토 종합 판단</label><select id="document-review-outcome" disabled={locked} value={buffer.outcome} onChange={event => change({ outcome: event.target.value as typeof buffer.outcome })}>{options}</select>
    <label htmlFor="document-review-reason">내용 검토 종합 이유</label><textarea id="document-review-reason" rows={2} maxLength={20_000} readOnly={locked} value={buffer.reason} onChange={event => change({ reason: event.target.value })} />
    <div className="project-toolbar"><button disabled={busy || buffer.saved && !buffer.dirty} onClick={() => { void save(); }}>{buffer.pending ? '같은 검토 명령 결과 확인' : '내용 검토 기록 저장'}</button><button disabled={locked} onClick={() => { if (!buffer.dirty || confirm('미저장 검토 입력을 버릴까요?')) onChange(previous => previous === buffer ? null : previous); }}>검토 작성 닫기</button></div>
  </section>;
}
