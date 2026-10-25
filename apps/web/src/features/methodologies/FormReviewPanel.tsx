import { useId, useState, type Dispatch, type SetStateAction } from 'react';
import { ApiClient, ApiError } from '../../api/client.ts';
import { writeCommonCommand, type MethodCommand } from '../methodology-editor/common-api.ts';
import { getForm, reviewRefFor, type FormVersion, type ReviewOutcome } from './forms-api.ts';
import type { FormBuffer, FormReviewWork } from './form-editor-state.ts';

const labels: Record<ReviewOutcome, string> = { ACCEPTED: '적합', REWORK: '보완 필요', BLOCKED: '판단 보류', NOT_EXECUTED: '미검토' };
export function FormReviewPanel({ client, session, source, buffer, onChange, onVerified, onAuthenticationLost }: {
  client: ApiClient; session: { user: { id: string }; clientId: string; csrfToken: string }; source: FormVersion;
  buffer: FormBuffer; onChange: Dispatch<SetStateAction<FormBuffer>>; onVerified: (value: FormVersion) => void; onAuthenticationLost: () => void;
}) {
  const fieldId = useId();
  const [pending, setPending] = useState(false), [error, setError] = useState<ApiError | null>(null), [recorded, setRecorded] = useState(false);
  const work = buffer.review, criteria = source.contentReviewCriteria;
  const matches = !!work && work.ref.id === source.ref.id && work.ref.version === source.ref.version && work.ref.contentHash === source.ref.contentHash && work.criteriaVersion === criteria?.criteriaVersion;
  const locked = pending || !!work?.pending || !!buffer.pending;
  const latest = source.contentReviews?.[0];
  function update(patch: Partial<FormReviewWork>) { onChange(previous => previous.review ? { ...previous, review: { ...previous.review, ...patch, dirty: true } } : previous); setRecorded(false); }
  function start() {
    if (!criteria || locked || work?.dirty && !confirm('현재 미저장 검토 입력을 이 버전의 새 검토로 바꿀까요?')) return;
    onChange(previous => ({ ...previous, ownerUserId: session.user.id, review: { ref: source.ref, criteriaVersion: criteria.criteriaVersion, criteria: structuredClone(criteria.items),
      items: criteria.items.map(item => ({ criterionId: item.criterionId, outcome: 'NOT_EXECUTED', evidenceRefs: [], reason: '' })), outcome: 'NOT_EXECUTED', reason: '', dirty: false, pending: null } }));
    setError(null); setRecorded(false);
  }
  async function execute(request: MethodCommand) {
    if (pending || request.clientId !== session.clientId || !matches) return;
    onChange(previous => previous.review ? { ...previous, review: { ...previous.review, pending: request } } : previous);
    setPending(true); setError(null); let applied = false;
    try {
      const receipt = await writeCommonCommand(client, request, session.csrfToken, session.user.id); applied = true;
      if (receipt.data.ref.contentHash !== source.ref.contentHash || request.operation === 'recordContentReview' && (!reviewRefFor(receipt.data.reviewRef, source.ref) || receipt.data.reviewRef.outcome !== request.payload.outcome)
        || request.operation === 'confirmForm' && !/^[0-9a-f-]{36}$/.test(receipt.data.confirmationId ?? '')) throw new ApiError('RESPONSE_INVALID');
      const value = await getForm(client, { ref: source.ref, name: source.definition.name, formCode: source.definition.formCode, scope: 'USER_COMMON' });
      onChange(previous => previous.review?.pending?.commandId === request.commandId ? { ...previous, review: { ...previous.review, dirty: false, pending: null } } : previous);
      onVerified(value); setRecorded(request.operation === 'recordContentReview');
    } catch (cause: unknown) {
      const failure = cause instanceof ApiError ? cause : new ApiError('RESPONSE_INVALID'); setError(failure);
      if (!applied && failure.status >= 400 && failure.status < 500 && failure.code !== 'RESPONSE_INVALID') onChange(previous => previous.review ? { ...previous, review: { ...previous.review, pending: null } } : previous);
      if (failure.status === 401) onAuthenticationLost();
    } finally { setPending(false); }
  }
  function record() {
    if (!work || !matches || locked || !work.reason.trim() || work.items.some(item => !item.reason.trim())) return;
    void execute({ schemaVersion: 1, commandId: crypto.randomUUID(), operation: 'recordContentReview', targetId: work.ref.id, expectedVersion: work.ref.version, clientId: session.clientId,
      payload: { targetKind: 'FORM', targetRef: work.ref, criteriaVersion: work.criteriaVersion, items: work.items, outcome: work.outcome, reason: work.reason } });
  }
  function confirmVersion() {
    if (!work || !matches || locked || work.dirty || latest?.ref.outcome !== 'ACCEPTED') return;
    void execute({ schemaVersion: 1, commandId: crypto.randomUUID(), operation: 'confirmForm', targetId: source.ref.id, expectedVersion: source.ref.version, clientId: session.clientId, payload: { versionRef: source.ref, reviewRefs: [latest.ref] } });
  }
  if (source.definition.scope !== 'USER_COMMON' || buffer.ownerUserId && buffer.ownerUserId !== session.user.id) return null;
  return <section className="status-card definition-editor" aria-label="양식 내용 검토·확정"><h3>내용 검토와 사용자 확정</h3>
    <p className="meta">버전 {source.ref.version} · {source.ref.contentHash}. 실제 내용을 직접 읽고 판단하세요. 시험 실행·파일 근거를 자동 확인하는 기능은 아닙니다.</p>
    <button disabled={!criteria || locked} onClick={start}>이 양식 내용 검토 시작</button>
    {work && !matches ? <p role="alert">다른 양식 버전의 검토 입력이 남아 있습니다. 현재 버전에 자동 적용하지 않습니다.</p> : null}
    {matches && work ? <fieldset disabled={locked}>
      {work.criteria.map(criterion => { const item = work.items.find(value => value.criterionId === criterion.criterionId)!; return <div key={criterion.criterionId}>
        <p>{criterion.title}</p><label htmlFor={fieldId + '-' + criterion.criterionId + '-outcome'}>{criterion.criterionId} 판정</label><select id={fieldId + '-' + criterion.criterionId + '-outcome'} value={item.outcome} onChange={event => update({ items: work.items.map(value => value.criterionId === criterion.criterionId ? { ...value, outcome: event.target.value as ReviewOutcome } : value) })}>{Object.entries(labels).map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select>
        <label htmlFor={fieldId + '-' + criterion.criterionId}>{criterion.criterionId} 검토 이유</label><textarea id={fieldId + '-' + criterion.criterionId} maxLength={20000} value={item.reason} onChange={event => update({ items: work.items.map(value => value.criterionId === criterion.criterionId ? { ...value, reason: event.target.value } : value) })} />
      </div>; })}
      <label htmlFor={fieldId + '-outcome'}>내용 검토 종합 판정</label><select id={fieldId + '-outcome'} value={work.outcome} onChange={event => update({ outcome: event.target.value as ReviewOutcome })}>{Object.entries(labels).map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select>
      <label htmlFor={fieldId + '-reason'}>내용 검토 종합 이유</label><textarea id={fieldId + '-reason'} maxLength={20000} value={work.reason} onChange={event => update({ reason: event.target.value })} />
      <button disabled={!work.reason.trim() || work.items.some(item => !item.reason.trim()) || work.outcome === 'ACCEPTED' && work.items.some(item => item.outcome !== 'ACCEPTED')} onClick={record}>내용 검토 기록</button>
    </fieldset> : null}
    {source.contentReviews?.map(review => <div key={review.ref.id} style={{ overflowWrap: 'anywhere' }}>
      <p style={{ whiteSpace: 'pre-wrap' }}>검토 {labels[review.ref.outcome]} · {review.reason}</p>
      <p className="meta"><span>{review.reviewer.sameAsTargetRecorder ? '작성 기록자와 같은 사용자 · 독립 검수 아님' : '작성 기록자와 다른 사용자'}</span> · 사람 직접 검토 · {review.reviewedAt}</p>
      <details aria-label={'검토 ' + review.ref.id + ' 항목별 판정과 이유'}>
        <summary>항목별 판정·이유 보기 · 기준 v{review.ref.criteriaVersion} · 검토 {review.ref.id}</summary>
        {!Array.isArray(review.items) ? <p>저장된 항목 정보 확인 불가</p> : review.items.length ? <ul>{review.items.map((item, index) => !item || typeof item !== 'object' || Array.isArray(item) || typeof item.criterionId !== 'string' || typeof item.reason !== 'string' || typeof item.outcome !== 'string' || !Array.isArray(item.evidenceRefs) ? <li key={index}>저장된 항목 정보 확인 불가</li> : <li key={index}>
          <p>항목 {item.criterionId.trim() ? item.criterionId : '항목 ID 없음'} · 판정 {Object.hasOwn(labels, item.outcome) ? labels[item.outcome] : '알 수 없는 판정'}</p>
          <p style={{ whiteSpace: 'pre-wrap' }}>이유: {item.reason.trim() ? item.reason : '저장된 이유 없음'}</p>
          <p className="meta">증거 참조: {item.evidenceRefs.length ? JSON.stringify(item.evidenceRefs) : '등록된 증거 참조 없음'}</p>
        </li>)}</ul> : <p>저장된 항목별 검토 정보 없음</p>}
      </details>
    </div>)}
    <button disabled={locked || !matches || !!work?.dirty || latest?.ref.outcome !== 'ACCEPTED' || !!source.confirmation} onClick={confirmVersion}>이 양식 버전 확정</button>
    {source.confirmation ? <p>현재 버전 사용자 확정 이력 있음 · 실행 승인은 별도</p> : <p>이 버전의 사용자 확정 이력 없음</p>}
    {pending ? <p role="status">검토·확정 저장과 재조회를 확인하고 있습니다.</p> : null}
    {work?.pending && !pending ? <><p role="alert">검토·확정 결과 미확인 · 같은 명령만 다시 확인하세요.</p><button disabled={!matches || work.pending.clientId !== session.clientId} onClick={() => { void execute(work.pending!); }}>같은 검토·확정 명령 결과 확인</button></> : null}
    {error ? <p role="alert">{error.message} 검토 입력과 미확인 명령은 유지했습니다.</p> : null}
    {recorded ? <p role="status">서버 내용 검토 기록 확인</p> : null}
  </section>;
}
