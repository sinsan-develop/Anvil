import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { ApiClient, ApiError } from '../../api/client.ts';
import { listDocuments, readDocument, type DocumentPage, type DocumentSummary, type DocumentVersion } from './api.ts';
import { documentControl, editDocument, type DocumentBuffer, type DocumentSession } from './editor-api.ts';
import { DocumentEditor } from './DocumentEditor.tsx';
import { NewDocumentForm } from './NewDocumentForm.tsx';
import { newDocumentReview, type DocumentReviewBuffer } from './review-api.ts';
import { DocumentReviewEditor } from './DocumentReviewEditor.tsx';
import { latestAcceptedDocumentReview, newDocumentConfirmation, type DocumentConfirmationBuffer } from './confirmation-api.ts';
import { DocumentConfirmation } from './DocumentConfirmation.tsx';
import { MaterialLibrary } from './MaterialLibrary.tsx';
import { DesignIndexViewer } from './DesignIndexViewer.tsx';
import { DesignIndexEditor } from './DesignIndexEditor.tsx';
import { newDesignIndex } from './design-index-api.ts';
import { getPinnedForm } from '../methodologies/forms-api.ts';
import { WorkPlanEditor } from './WorkPlanEditor.tsx';
import { newWorkPlan,blankPlanTask } from './work-plan-api.ts';
import { WorkPlanLibrary } from './WorkPlanLibrary.tsx';
import {DesignAnchorOriginal}from'./DesignAnchorOriginal.tsx';
import type{DesignAnchorSelection}from'./design-anchor.ts';

export function DocumentsPage({ client, projectId, session, buffer, onChange, review, onReviewChange, confirmation, onConfirmationChange, onAuthenticationLost }: { client: ApiClient; projectId: string; session: DocumentSession; buffer: DocumentBuffer | null; onChange: Dispatch<SetStateAction<DocumentBuffer | null>>; review: DocumentReviewBuffer | null; onReviewChange: Dispatch<SetStateAction<DocumentReviewBuffer | null>>; confirmation: DocumentConfirmationBuffer | null; onConfirmationChange: Dispatch<SetStateAction<DocumentConfirmationBuffer | null>>; onAuthenticationLost: () => void }) {
  const [showPlans,setShowPlans]=useState(false);
  const [page, setPage] = useState<DocumentPage | null>(null), [cursor, setCursor] = useState<string | null>(null), [refresh, setRefresh] = useState(0);
  const [listError, setListError] = useState<ApiError | null>(null), [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<DocumentSummary | null>(null), [version, setVersion] = useState('');
  const [opened, setOpened] = useState<{ document: DocumentVersion; body: string } | null>(null), [readError, setReadError] = useState<ApiError | null>(null), [reading, setReading] = useState(false);
  const generation = useRef(0);
  const [editingError, setEditingError] = useState<ApiError | null>(null), [starting, setStarting] = useState(false);
  const [choosingForm, setChoosingForm] = useState(false);
  const [showMaterials, setShowMaterials] = useState(false);
  const [showDesignIndex,setShowDesignIndex]=useState(false);
  const [anchorSelection,setAnchorSelection]=useState<DesignAnchorSelection|null>(null);
  const reviewing = review?.ownerUserId === session.user.id && review.projectId === projectId;
  const confirming = confirmation?.ownerUserId === session.user.id && confirmation.projectId === projectId;
  useEffect(() => () => { generation.current++; }, []);
  useEffect(() => {
    let current = true; setLoading(true); setListError(null);
    listDocuments(client, projectId, cursor).then(value => { if (current) setPage(previous => cursor && previous ? { ...value, items: [...new Map([...previous.items, ...value.items].map(item => [item.id, item])).values()] } : value); }).catch((cause: unknown) => {
      if (!current) return; const error = cause instanceof ApiError ? cause : new ApiError('RESPONSE_INVALID'); setListError(error);
      if ([401, 403, 404].includes(error.status)) { generation.current++; setReading(false); setPage(null); setSelected(null); setOpened(null); if (error.status === 401) onAuthenticationLost(); }
    }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [client, projectId, cursor, refresh]);
  async function open(item: DocumentSummary, requested: number) {
    const request = ++generation.current; setAnchorSelection(null); setSelected(item); setVersion(String(requested)); setOpened(null); setReadError(null); setReading(true); setShowDesignIndex(false);
    try { const value = await readDocument(client, projectId, item.id, requested); if (request === generation.current) setOpened(value); }
    catch (cause) { if (request !== generation.current) return; const error = cause instanceof ApiError ? cause : new ApiError('RESPONSE_INVALID'); setReadError(error); if (error.status === 401) onAuthenticationLost(); }
    finally { if (request === generation.current) setReading(false); }
  }
  async function beginEdit() {
    if (!opened || starting) return;
    if (reviewing || review?.pending || confirmation) { setEditingError(new ApiError('DOCUMENT_REVIEW_INPUT_PRESERVED')); return; }
    if (buffer?.pending || buffer?.proposalState || (buffer?.designIndexState||buffer?.workPlanState) || buffer?.importState || buffer?.importPreparationId) { setEditingError(new ApiError('DOCUMENT_PENDING_RESULT')); return; }
    if (buffer && buffer.ownerUserId !== session.user.id) { setEditingError(new ApiError('DOCUMENT_OTHER_USER_INPUT_PRESERVED')); return; }
    if (buffer?.dirty && !confirm('앞선 문서의 미저장 편집을 버리고 선택한 버전에서 편집할까요?')) return;
    const current = generation.current; setStarting(true); setEditingError(null);
    try {
      const control = await documentControl(client, projectId, session);
      if (current !== generation.current) return;
      const next = editDocument(projectId, opened, session.user.id, control);
      onChange(previous => previous?.pending || previous?.proposalState || (previous?.designIndexState||previous?.workPlanState) || previous?.importState || previous?.importPreparationId || previous && previous.ownerUserId !== session.user.id ? previous : next);
    } catch (cause) { if (current === generation.current) { const error = cause instanceof ApiError ? cause : new ApiError('RESPONSE_INVALID'); setEditingError(error); if (error.status === 401) onAuthenticationLost(); } }
    finally { setStarting(false); }
  }
  async function beginReview() {
    if (!opened || starting || reading || choosingForm || confirmation) return;
    if (buffer?.dirty || buffer?.pending || buffer?.proposalState || (buffer?.designIndexState||buffer?.workPlanState) || review?.pending) { setEditingError(new ApiError('DOCUMENT_PENDING_RESULT')); return; }
    if (review && review.ownerUserId !== session.user.id) { setEditingError(new ApiError('DOCUMENT_OTHER_USER_INPUT_PRESERVED')); return; }
    if (review?.dirty && !confirm('앞선 미저장 검토를 버리고 선택한 버전을 검토할까요?')) return;
    const current = generation.current; setStarting(true); setEditingError(null);
    try {
      const control = await documentControl(client, projectId, session);
      if (current !== generation.current) return;
      const next = newDocumentReview(projectId, opened.document, session.user.id, control);
      if (review?.ownerUserId === session.user.id && review.projectId === projectId && review.rejectedAttempts) next.rejectedAttempts = structuredClone(review.rejectedAttempts);
      onReviewChange(previous => previous?.pending || previous && previous.ownerUserId !== session.user.id ? previous : next);
    } catch (cause) { if (current === generation.current) { const error = cause instanceof ApiError ? cause : new ApiError('RESPONSE_INVALID'); setEditingError(error); if (error.status === 401) onAuthenticationLost(); } }
    finally { setStarting(false); }
  }
  async function beginConfirmation() {
    if (!opened || starting || reading || choosingForm || confirmation || reviewing || buffer?.dirty || buffer?.pending || buffer?.proposalState || (buffer?.designIndexState||buffer?.workPlanState) || review?.pending) return;
    const current = generation.current; setStarting(true); setEditingError(null);
    try {
      const control = await documentControl(client, projectId, session);
      if (current !== generation.current) return;
      const next = newDocumentConfirmation(projectId, opened.document, session.user.id, control);
      onConfirmationChange(previous => previous ?? next);
    } catch (cause) { if (current === generation.current) { const error = cause instanceof ApiError ? cause : new ApiError('RESPONSE_INVALID'); setEditingError(error); if (error.status === 401) onAuthenticationLost(); } }
    finally { setStarting(false); }
  }
  async function replaceConfirmation() {
    if (!opened || !confirmation || !confirming || confirmation.pending || confirmation.saved || confirmation.uncertain || !confirmation.rejectedAttempts?.length || starting || reading || choosingForm) return;
    const current=generation.current; setStarting(true); setEditingError(null);
    try {
      const control=await documentControl(client,projectId,session); if(current !== generation.current) return;
      const next=newDocumentConfirmation(projectId,opened.document,session.user.id,control); next.rejectedAttempts=structuredClone(confirmation.rejectedAttempts);
      onConfirmationChange(previous => previous === confirmation ? next : previous);
    } catch(cause) { if(current === generation.current) { const error=cause instanceof ApiError ? cause : new ApiError('RESPONSE_INVALID'); setEditingError(error); if(error.status===401) onAuthenticationLost(); } }
    finally { setStarting(false); }
  }
  async function beginWorkPlan(){
    if(!opened||starting||reading||choosingForm||review||confirmation||buffer?.pending||buffer?.proposalState||(buffer?.designIndexState||buffer?.workPlanState)||buffer?.importState||buffer?.importPreparationId||buffer&&buffer.ownerUserId!==session.user.id)return;
    if(buffer?.dirty&&!confirm('앞선 미저장 편집을 버리고 선택한 원문에서 작업계획을 작성할까요?'))return;
    const current=generation.current;setStarting(true);setEditingError(null);
    try{const[form,control]=await Promise.all([getPinnedForm(client,opened.document.formRef),documentControl(client,projectId,session)]);if(current!==generation.current)return;if(form.definition.formCode!=='AF04')throw new ApiError('WORK_PLAN_DOCUMENT_KIND_INVALID',422);const next=editDocument(projectId,opened,session.user.id,control);next.workPlanState=newWorkPlan(next);next.workPlanState.input.tasks=[blankPlanTask()];onChange(previous=>previous===buffer?next:previous);}
    catch(cause){if(current===generation.current){const e=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');setEditingError(e);if(e.status===401)onAuthenticationLost();}}
    finally{setStarting(false);}
  }
  async function beginDesignIndex() {
    if(!opened||starting||reading||choosingForm||review||confirmation||buffer?.pending||buffer?.proposalState||(buffer?.designIndexState||buffer?.workPlanState)||buffer?.importState||buffer?.importPreparationId||buffer&&buffer.ownerUserId!==session.user.id)return;
    if(buffer?.dirty&&!confirm('앞선 미저장 편집을 버리고 선택한 설계 버전의 위치를 등록할까요?'))return;
    const current=generation.current;setStarting(true);setEditingError(null);
    try {
      const [form,control]=await Promise.all([getPinnedForm(client,opened.document.formRef),documentControl(client,projectId,session)]);if(current!==generation.current)return;
      if(form.definition.formCode!=='AF02')throw new ApiError('DESIGN_DOCUMENT_KIND_INVALID',422);
      const next=editDocument(projectId,opened,session.user.id,control);next.designIndexState=newDesignIndex(next);onChange(previous=>previous===buffer?next:previous);
    }catch(cause){if(current===generation.current){const error=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');setEditingError(error);if(error.status===401)onAuthenticationLost();}}
    finally{setStarting(false);}
  }
  return <section aria-label="프로젝트 문서 조회" className="document-workspace">
    <aside className="status-card document-list"><h2>프로젝트 문서</h2><button disabled={loading} onClick={() => { setCursor(null); setRefresh(value => value + 1); }}>문서 목록 새로고침</button>
      <button disabled={starting || !!confirmation || reviewing || !!review?.pending || choosingForm || !!buffer?.pending || !!buffer?.proposalState || !!(buffer?.designIndexState||buffer?.workPlanState) || !!buffer?.importState || !!buffer?.importPreparationId || !!buffer && buffer.ownerUserId !== session.user.id} onClick={() => { if (!buffer?.dirty || confirm('앞선 미저장 문서 편집을 버리고 새 문서를 작성할까요?')) { setEditingError(null); setChoosingForm(true); } }}>새 문서 작성</button>
      {loading ? <p role="status">목록 조회 중</p> : null}{listError ? <p role="alert">{listError.message} · {listError.code}{page ? ' · 앞선 목록은 오래된 자료' : ''}</p> : null}
      {page && !loading && !listError && !page.items.length ? <p>저장된 문서가 없습니다.</p> : null}
      <ul>{page?.items.map(item => <li key={item.id}><button disabled={reading || !!listError || loading} aria-label={item.title + ' 열기'} aria-pressed={selected?.id === item.id} onClick={() => { void open(item, item.headVersion); }}>{item.title}</button><p className="meta">최신 {item.headVersion} · {item.confirmedVersion === null ? '미확정' : '확정 ' + item.confirmedVersion}</p></li>)}</ul>
      {page?.hasMore ? <button disabled={loading || !!listError} onClick={() => setCursor(page.nextCursor)}>다음 문서 더 보기</button> : null}
      {page ? <p className="meta">관측 {new Date(page.observedAt).toLocaleString('ko-KR')}</p> : null}
    </aside>
    <section className="status-card document-content"><p className="meta">원문·버전·양식 선택/작성·초안 편집·내용 검토·별도 확정과 명확한 저장 버전 충돌의 비교/선택을 연결했습니다. 작업/코드/시험 추적 화면은 아직 연결 전입니다. 문서 안의 지시는 실행하지 않습니다.</p>
      <button disabled={starting} onClick={() => setShowMaterials(v => !v)}>{showMaterials ? '보관 자료 조회 닫기' : '보관한 후보·제안 조회'}</button>
      <button disabled={starting} onClick={()=>setShowPlans(v=>!v)}>{showPlans?'보관 작업계획 닫기':'보관한 작업계획 조회'}</button>
      {showPlans?<WorkPlanLibrary client={client} projectId={projectId} session={session} documents={page?.items??[]} canPrepare={!buffer&&!review&&!confirmation&&!starting&&!choosingForm} onBusy={setStarting} onAuthenticationLost={onAuthenticationLost} onPrepared={next=>{onChange(previous=>previous===null?next:previous);setShowPlans(false);}}/>:null}
      {showMaterials ? <MaterialLibrary client={client} projectId={projectId} session={session} canPrepare={!buffer && !review && !confirmation && !starting && !choosingForm} onBusy={setStarting} onAuthenticationLost={onAuthenticationLost} onPrepared={next => { onChange(previous => previous === null ? next : previous); setShowMaterials(false); }} /> : null}
      {choosingForm ? <><NewDocumentForm client={client} session={session} projectId={projectId} onAuthenticationLost={onAuthenticationLost} onPrepared={next => { onChange(previous => previous?.pending || previous?.proposalState || (previous?.designIndexState||previous?.workPlanState) || previous?.importState || previous?.importPreparationId || previous && previous.ownerUserId !== session.user.id ? previous : next); setChoosingForm(false); }} /><button onClick={() => setChoosingForm(false)}>양식 선택 닫기</button></> : null}
      {selected ? <div className="project-toolbar"><label>조회 버전<input type="number" min="1" max={selected.headVersion} value={version} onChange={event => setVersion(event.target.value)} /></label><button disabled={reading || !Number.isSafeInteger(Number(version)) || Number(version) < 1 || Number(version) > selected.headVersion} onClick={() => { void open(selected, Number(version)); }}>지정 버전 조회</button></div> : <p>문서를 선택하세요.</p>}
      {reading ? <p role="status">원문 무결성 확인 중</p> : null}{readError ? <p role="alert">{readError.message} · {readError.code}</p> : null}
      {opened ? <><h2>{opened.document.title}</h2><p>{opened.document.confirmed ? '확정된 버전' : '초안 · 내용 검토/사용자 확정과 별개'}</p><p className="meta">버전 {opened.document.version} · 양식 {opened.document.formRef.id} v{opened.document.formRef.version} · SHA256 {opened.document.contentHash}</p>
        <section aria-label="문서 단계 연결" className="status-card"><h3>연결된 개발 단계</h3>{opened.document.stageBinding ? <><p>{opened.document.stageBinding.methodologyName} · {opened.document.stageBinding.nodeName}</p><p className="meta">적용 세대 {opened.document.stageBinding.applicationRef.version} · {opened.document.stageBinding.nodeId} · {opened.document.stageBinding.applicationRef.contentHash}</p></> : <p>{opened.document.stageNodeRef === null ? '방법론 단계 미연결' : '단계 연결 미확인'}</p>}</section>
        <button disabled={starting || reading || choosingForm || !!confirmation || reviewing || !!review?.pending || !!buffer?.pending || !!(buffer?.designIndexState||buffer?.workPlanState) || !!buffer && buffer.ownerUserId !== session.user.id} onClick={() => { void beginEdit(); }}>이 버전에서 편집</button>
        <button disabled={starting || reading || choosingForm || !!confirmation || !!buffer?.dirty || !!buffer?.pending || !!(buffer?.designIndexState||buffer?.workPlanState) || !!review?.pending || !!review && review.ownerUserId !== session.user.id} onClick={() => { void beginReview(); }}>이 버전 내용 검토 작성</button>
        <button disabled={starting || reading || choosingForm || !!confirmation || reviewing || !!buffer?.dirty || !!buffer?.pending || !!(buffer?.designIndexState||buffer?.workPlanState) || !!review?.pending || !latestAcceptedDocumentReview(opened.document)} onClick={() => { void beginConfirmation(); }}>이 버전 확정 준비</button>
        <button disabled={reading} onClick={()=>{setAnchorSelection(null);setShowDesignIndex(v=>!v);}}>{showDesignIndex?'설계 추적 조회 닫기':'이 버전 설계 추적 조회'}</button>
        <button disabled={starting||reading||choosingForm||!!review||!!confirmation||!!buffer?.pending||!!buffer?.proposalState||!!(buffer?.designIndexState||buffer?.workPlanState)||!!buffer?.workPlanState||!!buffer?.importState||!!buffer?.importPreparationId||!!buffer&&buffer.ownerUserId!==session.user.id} onClick={()=>{void beginWorkPlan();}}>이 버전에서 작업계획 작성</button>
        <button disabled={starting||reading||choosingForm||!!review||!!confirmation||!!buffer?.pending||!!buffer?.proposalState||!!(buffer?.designIndexState||buffer?.workPlanState)||!!buffer?.importState||!!buffer?.importPreparationId||!!buffer&&buffer.ownerUserId!==session.user.id} onClick={()=>{void beginDesignIndex();}}>이 버전 설계 위치 등록</button>
        {showDesignIndex?<DesignIndexViewer key={opened.document.id+':'+opened.document.version+':'+opened.document.contentHash} client={client} projectId={projectId} documentRef={{id:opened.document.id,version:opened.document.version,contentHash:opened.document.contentHash}} bodyHash={opened.document.content.body.contentHash} onAnchorSelect={setAnchorSelection} onAuthenticationLost={onAuthenticationLost}/>:null}
        {confirming && confirmation && !confirmation.pending && !confirmation.saved && !confirmation.uncertain && confirmation.rejectedAttempts?.length ? <button disabled={starting || reading || choosingForm || !latestAcceptedDocumentReview(opened.document)} onClick={() => { void replaceConfirmation(); }}>열어 둔 버전으로 확정 대상 변경</button> : null}
        {!opened.document.confirmed && !latestAcceptedDocumentReview(opened.document) ? <p className="meta">확정하려면 필수 본문/반복 항목 검사와 정확한 최신 적합 검토가 필요합니다.</p> : null}
        <DesignAnchorOriginal body={opened.body} context={{projectId,documentRef:{id:opened.document.id,version:opened.document.version,contentHash:opened.document.contentHash},bodyHash:opened.document.content.body.contentHash}} selection={anchorSelection} onClear={()=>setAnchorSelection(null)}/>
        <h3>형식 검사</h3>{opened.document.validation.issues.length ? <ul>{opened.document.validation.issues.map((issue, index) => <li key={index}><span>{issue.message}</span><span className="meta"> · {issue.code} · {issue.location}</span></li>)}</ul> : <p>기록된 형식 문제 없음 · 내용 검토 합격을 의미하지 않습니다.</p>}
        <h3>저장 이력</h3><ul>{opened.document.statusHistory.map((event, index) => <li key={index}>{event.kind} · {event.reason} · {new Date(event.at).toLocaleString('ko-KR')}</li>)}</ul></> : null}
      {opened ? <><h3>양식의 내용 검토 기준</h3><ul>{opened.document.contentReviewCriteria.items.map(item => <li key={item.criterionId}>{item.title}<ul>{item.reviewCriteria.map((criterion, index) => <li key={index}>{criterion}</li>)}</ul></li>)}</ul>
        <h3>기록된 내용 검토</h3>{!opened.document.contentReviews.length ? <p>아직 내용 검토가 기록되지 않았습니다.</p> : opened.document.contentReviews.map(review => <section className="status-card" key={review.ref.id}><p>{review.ref.outcome} · {new Date(review.reviewedAt).toLocaleString('ko-KR')}</p><p>{review.reason}</p><p className="meta">검토자 {review.reviewer.userId}</p>{review.reviewer.sameAsTargetRecorder ? <p>작성 기록자와 같은 사용자 · 독립 검수 아님</p> : null}<ul>{review.items.map(item => <li key={item.criterionId}>{item.criterionId} · {item.outcome} · {item.reason}</li>)}</ul><p className="meta">내용 검토자의 판단이며 사용자 확정/실제 시험 합격/Agent 실행 승인이 아닙니다.</p></section>)}</> : null}
      {editingError ? <p role="alert">{editingError.message} · {editingError.code}</p> : null}
      {confirmation && !confirming ? <p>다른 사용자 또는 프로젝트의 확정 요청은 숨겨 보존했습니다.</p> : null}
      {confirming && confirmation ? <DocumentConfirmation key={confirmation.ref.id + ':' + confirmation.ref.version} client={client} session={session} buffer={confirmation} onChange={onConfirmationChange} onAuthenticationLost={onAuthenticationLost} onConfirmed={() => { setRefresh(value => value + 1); if (selected && opened?.document.id === confirmation.ref.id && opened.document.version === confirmation.ref.version) void open(selected, confirmation.ref.version); }} /> : null}
      {review && (review.ownerUserId !== session.user.id || review.projectId !== projectId) ? <p>다른 사용자 또는 프로젝트의 검토 입력은 숨겨 보존했습니다.</p> : null}
      {review?.ownerUserId === session.user.id && review.projectId === projectId ? <DocumentReviewEditor key={review.ref.id + ':' + review.ref.version + ':' + review.ref.contentHash} client={client} session={session} buffer={review} onChange={onReviewChange} onAuthenticationLost={onAuthenticationLost} onRecorded={() => { setRefresh(value => value + 1); if (selected && opened?.document.id === review.ref.id && opened.document.version === review.ref.version) void open(selected, review.ref.version); }} /> : null}
      {buffer && (buffer.ownerUserId !== session.user.id || buffer.projectId !== projectId) ? <p>다른 사용자 또는 프로젝트의 편집 입력은 숨겨 보존했습니다. 이 화면에서 자동 교체하지 않습니다.</p> : null}
      {!choosingForm&&!confirming&&!reviewing&&buffer?.ownerUserId===session.user.id&&buffer.projectId===projectId&&buffer.workPlanState?<WorkPlanEditor key={buffer.workPlanState.bindingId} client={client} session={session} buffer={buffer} documents={page?.items??[]} onChange={onChange} onAuthenticationLost={onAuthenticationLost}/>:null}
      {!choosingForm&&!confirming&&!reviewing&&buffer?.ownerUserId===session.user.id&&buffer.projectId===projectId&&buffer.designIndexState?<DesignIndexEditor key={buffer.designIndexState.bindingId} client={client} session={session} buffer={buffer} documents={page?.items??[]} onChange={onChange} onAuthenticationLost={onAuthenticationLost}/>:null}
      {!choosingForm && !confirming && !reviewing && buffer?.ownerUserId === session.user.id && buffer.projectId === projectId && !buffer.designIndexState && !buffer.workPlanState ? <DocumentEditor client={client} session={session} buffer={buffer} onChange={onChange} onAuthenticationLost={onAuthenticationLost} onSaved={(id, nextVersion, title) => { setCursor(null); setRefresh(value => value + 1); void open({ id, title, headVersion: nextVersion, confirmedVersion: null, updatedAt: new Date().toISOString() }, nextVersion); }} /> : null}
    </section>
  </section>;
}
