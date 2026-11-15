import { useId, useState, useMemo, useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import { ApiClient, ApiError } from '../../api/client.ts';
import { writeCommonCommand, type MethodCommand, type MethodGateway } from './common-api.ts';
import { getMethod, type MethodVersion } from './api.ts';
import { type ReviewOutcome } from '../methodologies/forms-api.ts';
import type { MethodBuffer } from './common-api.ts';
import {matchesReviewReceipt, reviewReceiptEvent, verifyReviewEvent, type FormReviewWork} from '../methodologies/form-editor-state.ts';

const labels: Record<ReviewOutcome, string> = { ACCEPTED: '적합', REWORK: '보완 필요', BLOCKED: '판단 보류', NOT_EXECUTED: '미검토' };
export function MethodReviewPanel({ client, session, source, buffer, onChange, onVerified, onAuthenticationLost, gateway, projectId }: {
  client: ApiClient; session: { user: { id: string }; clientId: string; csrfToken: string }; source: MethodVersion;
  buffer: MethodBuffer; onChange: Dispatch<SetStateAction<MethodBuffer>>; onVerified: (value: MethodVersion) => void; onAuthenticationLost: () => void; gateway?: MethodGateway; projectId?:string;
}) {
  const fieldId = useId();
  const active=useRef(true),preparing=useRef<string|null>(null),latestChange=useRef(onChange);latestChange.current=onChange;
  useEffect(()=>{active.current=true;return ()=>{active.current=false;const id=preparing.current;if(id)latestChange.current(previous=>previous.preparationId===id?{...previous,preparationId:null}:previous);};},[]);
  const [pending, setPending] = useState(false), [error, setError] = useState<ApiError | null>(null), [recorded, setRecorded] = useState<object|null>(null);
  const work = buffer.review, criteria = source.contentReviewCriteria;
  const matches = !!work && work.ref.id === source.ref.id && work.ref.version === source.ref.version && work.ref.contentHash === source.ref.contentHash && work.criteriaVersion === criteria?.criteriaVersion;
  const running=useRef(false), latestPending=useRef(work?.pending);latestPending.current=work?.pending;
  const project=gateway ? projectId??null : null;
  const targetKey=JSON.stringify([source.ref.id,source.ref.version,source.ref.contentHash,criteria?.criteriaVersion,criteria?.items]);
  const context=useMemo(()=>({userId:session.user.id,clientId:session.clientId,csrf:session.csrfToken,transport:client.transport,targetKey}),
    [session,session.user.id,session.clientId,session.csrfToken,client,client.transport,targetKey,project,buffer.ownerUserId,!!gateway]);
  const lastContext=useRef(context);lastContext.current=context;
  const current=()=>active.current && lastContext.current===context && session.user.id===context.userId &&
    session.clientId===context.clientId && session.csrfToken===context.csrf && client.transport===context.transport &&
    JSON.stringify([source.ref.id,source.ref.version,source.ref.contentHash,source.contentReviewCriteria?.criteriaVersion,source.contentReviewCriteria?.items])===context.targetKey;
  const locked = pending || !!buffer.preparationId || !!work?.pending || !!buffer.pending || buffer.dirty || !!buffer.application?.pending || !!buffer.application?.preparationId;
  const latest = source.contentReviews?.[0];
  function update(patch: Partial<FormReviewWork>) { onChange(previous => previous.review ? { ...previous, review: { ...previous.review, ...patch, dirty: true } } : previous); setRecorded(null); }
  function start() {
    if (!criteria || locked || work?.dirty && !confirm('현재 미저장 검토 입력을 이 버전의 새 검토로 바꿀까요?')) return;
    onChange(previous => ({ ...previous, ownerUserId: session.user.id, review: { ref: source.ref, criteriaVersion: criteria.criteriaVersion, criteria: structuredClone(criteria.items),
      items: criteria.items.map(item => ({ criterionId: item.criterionId, outcome: 'NOT_EXECUTED', evidenceRefs: [], reason: '' })), outcome: 'NOT_EXECUTED', reason: '', dirty: false, pending: null } }));
    setError(null); setRecorded(null);
  }
  async function execute(request: MethodCommand) {
    if (running.current || !matches || !current() || request.clientId!==session.clientId ||
        work.pending && work.pending!==request || gateway && (!project || work.pending && request.projectId!==project)) return;
    if (request.operation==='recordContentReview' ? request.payload.targetKind!=='METHODOLOGY' : request.operation!=='confirmMethodology') return;
    let event=work.receiptEvent;
    if (event && !matchesReviewReceipt(event,request,source.ref,work.criteriaVersion,session.user.id,project)) return;
    const stillCurrent=()=>current() && (!latestPending.current || latestPending.current.commandId===request.commandId);
    running.current=true;setPending(true);setError(null);setRecorded(null);
    let applied=!!event;
    const preparationId=event ? null : crypto.randomUUID();
    if(preparationId){preparing.current=preparationId;onChange(previous=>({...previous,preparationId}));}
    try {
      if (!event) {
        request = gateway ? await gateway.prepare(request) : request;
        if (!stillCurrent()) return;
        if ((request.projectId??null)!==project) throw new ApiError('RESPONSE_INVALID');
        onChange(previous => previous.preparationId===preparationId && previous.review ? {...previous,preparationId:null,review:{...previous.review,pending:request}} : previous);
        const receipt=gateway ? await gateway.write(request) : await writeCommonCommand(client,request,session.csrfToken,session.user.id);
        applied=true;
        if (!stillCurrent()) return;
        const verified=reviewReceiptEvent(request,receipt,source.ref,work.criteriaVersion,session.user.id,project);
        onChange(previous => current() && previous.review?.pending===request ?
          {...previous,review:{...previous.review,receiptEvent:verified}} : previous);
        event=verified;
      }
      const value=gateway ? await gateway.read(source.ref, source.name, source.purpose) : await getMethod(client, { ref: source.ref, name: source.name, purpose: source.purpose, systemCode: null, status: 'DRAFT', sourceAvailable: false, scope: 'USER_COMMON' });
      if (!stillCurrent()) return;
      verifyReviewEvent(event,request,value);
      onChange(previous => current() && previous.review?.pending===request ?
        {...previous,review:{...previous.review,dirty:false,pending:null,receiptEvent:undefined}} : previous);
      onVerified(value);setRecorded(request.operation==='recordContentReview' ? context : null);
    } catch (cause:unknown) {
      if (!stillCurrent()) return;
      const failure=cause instanceof ApiError ? cause : new ApiError('RESPONSE_INVALID');setError(failure);
      if(!applied && !(gateway && work.pending) && failure.status>=400 && failure.status<500 && failure.code!=='RESPONSE_INVALID')
        onChange(previous=>current() && previous.review?.pending===request ? {...previous,review:{...previous.review,pending:null}} : previous);
      if(failure.status===401)onAuthenticationLost();
    } finally {
      if(preparationId){onChange(previous=>previous.preparationId===preparationId?{...previous,preparationId:null}:previous);preparing.current=null;}
      running.current=false;if(active.current)setPending(false);
    }
  }
  function record() {
    if (!work || !matches || locked || !work.reason.trim() || work.items.some(item => !item.reason.trim())) return;
    void execute({ schemaVersion: 1, commandId: crypto.randomUUID(), operation: 'recordContentReview', targetId: work.ref.id, expectedVersion: work.ref.version, clientId: session.clientId,
      payload: { targetKind: 'METHODOLOGY', targetRef: work.ref, criteriaVersion: work.criteriaVersion, items: work.items, outcome: work.outcome, reason: work.reason } });
  }
  function confirmVersion() {
    if (!work || !matches || locked || work.dirty || latest?.ref.outcome !== 'ACCEPTED') return;
    void execute({ schemaVersion: 1, commandId: crypto.randomUUID(), operation: 'confirmMethodology', targetId: source.ref.id, expectedVersion: source.ref.version, clientId: session.clientId, payload: { versionRef: source.ref, reviewRefs: [latest.ref] } });
  }
  if (source.scope !== (gateway ? 'PROJECT' : 'USER_COMMON') || buffer.ownerUserId && buffer.ownerUserId !== session.user.id) return null;
  return <section className="status-card definition-editor" aria-label="방법론 내용 검토·확정"><h3>내용 검토와 사용자 확정</h3>
    <p className="meta">버전 {source.ref.version} · {source.ref.contentHash}. 실제 내용을 직접 읽고 판단하세요. 시험 실행·파일 근거를 자동 확인하는 기능은 아닙니다.</p>
    <button disabled={!criteria || locked} onClick={start}>이 방법론 내용 검토 시작</button>
    {work && !matches ? <p role="alert">다른 방법론 버전의 검토 입력이 남아 있습니다. 현재 버전에 자동 적용하지 않습니다.</p> : null}
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
    <button disabled={locked || !matches || !!work?.dirty || latest?.ref.outcome !== 'ACCEPTED' || !!source.confirmation} onClick={confirmVersion}>이 방법론 버전 확정</button>
    {source.confirmation ? <><p>현재 버전 사용자 확정 이력 있음 · 실행 승인은 별도</p>
      <details key={JSON.stringify([session.user.id,session.clientId,source.ref.id,source.ref.version,source.ref.contentHash,source.confirmation.id])} aria-label="방법론 확정 사건 상세" style={{overflowWrap:'anywhere'}}>
        <summary>저장된 확정 사건 상세 보기</summary>
        <p className="meta">이 저장 버전의 과거 사용자 확정입니다. 현재 프로젝트 적용·현재 권한·실행 승인·내용 독립검수 합격을 뜻하지 않습니다.</p>
        <dl><dt>확정 사건 ID</dt><dd>{source.confirmation.id}</dd><dt>저장된 결정</dt><dd>{source.confirmation.decision}</dd><dt>기록 원 시각</dt><dd style={{whiteSpace:'pre-wrap'}}>{source.confirmation.decided_at}</dd><dt>확정 사용자 ID</dt><dd>{source.confirmation.decidedBy}</dd></dl>
        <ul aria-label="확정 당시 검토 참조">{source.confirmation.reviewRefs.map((review,index)=><li key={JSON.stringify([index,review.id,review.targetRef])}><p>검토 ID {review.id}</p><p>기준 버전 {review.criteriaVersion} · 저장 판정 {review.outcome}</p><p>대상 ID {review.targetRef.id} · 대상 버전 {review.targetRef.version}</p><p>대상 내용 지문 {review.targetRef.contentHash}</p></li>)}</ul>
      </details></> : <p>이 버전의 사용자 확정 이력 없음</p>}
    {pending ? <p role="status">검토·확정 저장과 재조회를 확인하고 있습니다.</p> : null}
    {work?.pending && !pending ? <><p role="alert">{work.receiptEvent?'검토·확정 저장 확인 · 원문 사건 조회 미확인':'검토·확정 결과 미확인 · 같은 명령만 다시 확인하세요.'}</p><button disabled={!matches || work.pending.clientId !== session.clientId || gateway && work.pending.projectId!==project || !!work.receiptEvent && !matchesReviewReceipt(work.receiptEvent,work.pending,source.ref,work.criteriaVersion,session.user.id,project)} onClick={() => { void execute(work.pending!); }}>{work.receiptEvent?'저장된 검토·확정 사건 다시 조회':'같은 검토·확정 명령 결과 확인'}</button></> : null}
    {error ? <p role="alert">{error.message} 검토 입력과 미확인 명령은 유지했습니다.</p> : null}
    {recorded===context ? <p role="status">서버 내용 검토 기록 확인</p> : null}
  </section>;
}
