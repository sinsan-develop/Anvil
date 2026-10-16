import { useId, type Dispatch, type SetStateAction } from 'react';
import type { DraftAction, DraftEditorState, DraftReviewInput } from './api.ts';
import type { ReviewOutcome } from '../methodologies/forms-api.ts';

const labels: Record<ReviewOutcome, string> = { ACCEPTED: '적합', REWORK: '보완 필요', BLOCKED: '판단 보류', NOT_EXECUTED: '미검토' };
export function DraftReviewPanel({ buffer, session, disabled, onChange, onExecute }: { buffer: DraftEditorState; session: { user: { id: string }; clientId: string }; disabled: boolean; onChange: Dispatch<SetStateAction<DraftEditorState>>; onExecute: (action: DraftAction) => void }) {
  const fieldId = useId(), source = buffer.methodologyState, work = buffer.review;
  if (!source || !buffer.draftId || buffer.input.methodologySelection?.kind !== 'NEW_PROJECT_DRAFT') return null;
  const matches = work?.ref.id === source.ref.id && work.ref.version === source.ref.version && work.ref.contentHash === source.ref.contentHash;
  const locked = disabled || buffer.dirty || !!buffer.pendingAction || !!buffer.pendingCommand;
  function update(patch: Partial<DraftReviewInput>) { onChange(previous => previous.review ? { ...previous, review: { ...previous.review, ...patch, dirty: true } } : previous); }
  function start() {
    if (locked || work?.dirty && !confirm('현재 미저장 검토 입력을 이 초안 버전의 새 검토로 바꿀까요?')) return;
    onChange(previous => ({ ...previous, review: { ref: source!.ref, criteriaVersion: source!.contentReviewCriteria.criteriaVersion, items: source!.contentReviewCriteria.items.map(item => ({ criterionId: item.criterionId, outcome: 'NOT_EXECUTED', evidenceRefs: [], reason: '' })), outcome: 'NOT_EXECUTED', reason: '', dirty: false } }));
  }
  function execute(operation: string, payload: Record<string, unknown>) {
    onExecute({ kind: 'review', draftId: buffer.draftId!, body: { schemaVersion: 1, commandId: crypto.randomUUID(), clientId: session.clientId, targetId: buffer.draftId!, expectedVersion: buffer.version, operation, payload } });
  }
  return <section className="status-card definition-editor" aria-label="초안 방법론 검토·확정"><h3>전용 방법론 내용 검토·확정</h3>
    <p className="meta">저장 초안 버전 {source.ref.version} · {source.ref.contentHash}. 직접 내용을 읽고 판단하며 검토 기록과 사용자 확정은 별도입니다. 실행 승인이 아닙니다.</p>
    {source.validation.issues.map((issue, index) => <p key={index}>{issue.severity} · {issue.code}</p>)}
    {buffer.dirty ? <p>변경한 초안을 먼저 저장해야 검토·확정할 수 있습니다.</p> : null}
    <button disabled={locked} onClick={start}>이 초안 내용 검토 시작</button>
    {work && !matches ? <p role="alert">이전 버전의 검토 입력입니다. 현재 초안에 자동 적용하지 않습니다.</p> : null}
    {matches && work ? <fieldset disabled={locked}>
      {source.contentReviewCriteria.items.map(criterion => { const item = work.items.find(value => value.criterionId === criterion.criterionId); if (!item) return null; return <div key={criterion.criterionId}>
        <p>{criterion.title}</p><label htmlFor={fieldId + criterion.criterionId + '-outcome'}>{criterion.criterionId} 초안 판정</label><select id={fieldId + criterion.criterionId + '-outcome'} value={item.outcome} onChange={event => update({ items: work.items.map(value => value.criterionId === item.criterionId ? { ...value, outcome: event.target.value as ReviewOutcome } : value) })}>{Object.entries(labels).map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select>
        <label htmlFor={fieldId + criterion.criterionId}>{criterion.criterionId} 초안 검토 이유</label><textarea id={fieldId + criterion.criterionId} maxLength={20000} value={item.reason} onChange={event => update({ items: work.items.map(value => value.criterionId === item.criterionId ? { ...value, reason: event.target.value } : value) })} />
      </div>; })}
      <label htmlFor={fieldId + '-outcome'}>초안 검토 종합 판정</label><select id={fieldId + '-outcome'} value={work.outcome} onChange={event => update({ outcome: event.target.value as ReviewOutcome })}>{Object.entries(labels).map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select>
      <label htmlFor={fieldId + '-reason'}>초안 검토 종합 이유</label><textarea id={fieldId + '-reason'} maxLength={20000} value={work.reason} onChange={event => update({ reason: event.target.value })} />
      <button disabled={!work.reason.trim() || work.items.some(item => !item.reason.trim()) || work.outcome === 'ACCEPTED' && work.items.some(item => item.outcome !== 'ACCEPTED')} onClick={() => execute('recordContentReview', { targetKind: 'DRAFT_METHODOLOGY', targetRef: work.ref, criteriaVersion: work.criteriaVersion, items: work.items, outcome: work.outcome, reason: work.reason })}>초안 내용 검토 기록</button>
    </fieldset> : null}
    {source.contentReviews.map(review => <div key={review.reviewRef.id}><p>검토 {labels[review.reviewRef.outcome]} · {review.reason}</p><p className="meta">{review.reviewerSubjectRef.sameAsTargetRecorder ? '작성 기록자와 같은 사용자 · 독립 검수 아님' : '작성 기록자와 다른 사용자'}</p></div>)}
    <button disabled={locked || !!work?.dirty || source.contentReviews[0]?.reviewRef.outcome !== 'ACCEPTED' || !source.validation.validForConfirmation || !!source.confirmation} onClick={() => execute('confirmDraftMethodology', { draftVersion: source.ref.version, graphHash: source.ref.contentHash, reviewRefs: [source.contentReviews[0]!.reviewRef] })}>이 초안 방법론 확정</button>
    <p>{source.confirmation ? '현재 초안 방법론 확정 기록 있음 · 실행 승인은 별도' : '현재 초안 방법론 확정 기록 없음'}</p>
  </section>;
}
