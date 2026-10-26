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
import {createDocumentPreparationGate} from './document-preparation-gate.ts';
import {DesignDependencyEditor} from './DesignDependencyEditor.tsx';
import {newDesignDependency} from './design-dependency.ts';
import {readDesignIndex} from './design-index-api.ts';
import { DesignIndexEditor } from './DesignIndexEditor.tsx';
import { newDesignIndex,type ScreenRegion } from './design-index-api.ts';
import {readRegisteredScreen,readRegisteredDesignOrigin,type ScreenRegionContext,type ScreenRegionSelection} from './screen-region-navigation.ts';
import { getPinnedForm } from '../methodologies/forms-api.ts';
import { WorkPlanEditor } from './WorkPlanEditor.tsx';
import { newWorkPlan,blankPlanTask } from './work-plan-api.ts';
import { WorkPlanLibrary } from './WorkPlanLibrary.tsx';
import {DesignAnchorOriginal}from'./DesignAnchorOriginal.tsx';
import type{DesignAnchorSelection}from'./design-anchor.ts';
import { DocumentVersionComparison } from './DocumentVersionComparison.tsx';
import { PinnedFormOriginal } from '../methodologies/PinnedFormOriginal.tsx';
import {DocumentSourceLinks} from './DocumentSourceLinks.tsx';
import {StoredDocumentAttachments} from './StoredDocumentAttachments.tsx';
import {newSourceDetach,type SourceDetachBuffer,type SourceDetachChange} from './source-detach-api.ts';
import {SourceDetachEditor} from './SourceDetachEditor.tsx';
import type {SourceLinkView} from './source-links-api.ts';
import {DocumentStageFilter} from './DocumentStageFilter.tsx';
import {DocumentMarkdownPreview} from './DocumentMarkdownPreview.tsx';
import {sameStageRef,type StageNodeRef} from './stage-api.ts';
import type {DocumentVersionSelection} from '../../shell/routes.ts';

export function DocumentsPage({ client, projectId, session, requestedDocument, createdOriginal, buffer, onChange, review, onReviewChange, confirmation, onConfirmationChange, sourceDetach = null, onSourceDetachChange, onAuthenticationLost }: { createdOriginal?:import('../../shell/routes.ts').CreatedOriginalSelection; requestedDocument?:DocumentVersionSelection; client: ApiClient; projectId: string; session: DocumentSession; buffer: DocumentBuffer | null; onChange: Dispatch<SetStateAction<DocumentBuffer | null>>; review: DocumentReviewBuffer | null; onReviewChange: Dispatch<SetStateAction<DocumentReviewBuffer | null>>; confirmation: DocumentConfirmationBuffer | null; onConfirmationChange: Dispatch<SetStateAction<DocumentConfirmationBuffer | null>>; sourceDetach?: SourceDetachBuffer | null; onSourceDetachChange?: (change: SourceDetachChange) => void; onAuthenticationLost: () => void }) {
  const [showPlans,setShowPlans]=useState(false);
  const [stageFilter,setStageFilter]=useState<{ref:StageNodeRef;name:string}|null>(null);
  const [page, setPage] = useState<DocumentPage | null>(null), [cursor, setCursor] = useState<string | null>(null), [refresh, setRefresh] = useState(0);
  const [listError, setListError] = useState<ApiError | null>(null), [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<DocumentSummary | null>(null), [version, setVersion] = useState('');
  const [opened, setOpened] = useState<{ document: DocumentVersion; body: string } | null>(null), [readError, setReadError] = useState<ApiError | null>(null), [reading, setReading] = useState(false);
  const generation = useRef(0);
  const preparationGate=useRef(createDocumentPreparationGate()).current;
  const [editingError, setEditingError] = useState<ApiError | null>(null), [starting, setStarting] = useState(false);
  const [choosingForm, setChoosingForm] = useState(false);
  const [showMaterials, setShowMaterials] = useState(false);
  const [showDesignIndex,setShowDesignIndex]=useState(false);
  const [anchorSelection,setAnchorSelection]=useState<DesignAnchorSelection|null>(null);
  const [registeredView,setRegisteredView]=useState<{code:string;kind:'시안'|'설계'|'문서'}|null>(null);
  const [screenOrigin,setScreenOrigin]=useState<ScreenRegionSelection|null>(null);
  const [showComparison, setShowComparison] = useState(false);
  const [showSourceLinks,setShowSourceLinks]=useState(false);
  const reviewing = review?.ownerUserId === session.user.id && review.projectId === projectId;
  const confirming = confirmation?.ownerUserId === session.user.id && confirmation.projectId === projectId;
  const ownsSourceDetach=sourceDetach?.ownerUserId===session.user.id&&sourceDetach.ownerClientId===session.clientId&&sourceDetach.projectId===projectId;
  function beginSourceDetach(item:SourceLinkView){
    if(sourceDetach||!onSourceDetachChange||!opened||item.projectId!==projectId||item.documentRef.id!==opened.document.id||item.documentRef.version!==opened.document.version||item.documentRef.contentHash!==opened.document.contentHash)return;
    try{const next=newSourceDetach(projectId,item,session);onSourceDetachChange(p=>p??next);}catch(cause){setEditingError(cause instanceof ApiError?cause:new ApiError('SOURCE_DETACH_INPUT_INVALID'));}
  }
  function selectListStage(value:{ref:StageNodeRef;name:string}|null){
    generation.current++;setScreenOrigin(null);setReading(false);setSelected(null);setOpened(null);setVersion('');setRegisteredView(null);setAnchorSelection(null);setShowComparison(false);setShowDesignIndex(false);setShowSourceLinks(false);setReadError(null);
    setPage(null);setCursor(null);setListError(null);setStageFilter(value);
  }
  useEffect(() => () => { generation.current++; }, []);
  useEffect(() => {
    let current = true; setLoading(true); setListError(null);
    listDocuments(client, projectId, cursor,stageFilter?.ref).then(value => { if (current) setPage(previous => cursor && previous ? { ...value, items: [...new Map([...previous.items, ...value.items].map(item => [item.id, item])).values()] } : value); }).catch((cause: unknown) => {
      if (!current) return; const error = cause instanceof ApiError ? cause : new ApiError('RESPONSE_INVALID'); setListError(error);
      if ([401, 403, 404].includes(error.status)) { generation.current++; setReading(false); setPage(null); setSelected(null); setOpened(null); setRegisteredView(null); setAnchorSelection(null); if (error.status === 401) onAuthenticationLost(); }
    }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [client, projectId, cursor, refresh,stageFilter]);
  useEffect(()=>{
    if(!requestedDocument)return;
    const ref=structuredClone(requestedDocument),request=++generation.current;
    setSelected(null);setOpened(null);setReadError(null);setReading(true);setScreenOrigin(null);setRegisteredView(null);setAnchorSelection(null);
    readDocument(client,projectId,ref.id,ref.version,{expectedContentHash:ref.contentHash,active:()=>request===generation.current}).then(value=>{if(request!==generation.current)return;setOpened(value);setVersion(String(value.document.version));setRegisteredView({code:'선택한 문서',kind:'문서'});}).catch(cause=>{if(request!==generation.current)return;const error=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');setReadError(error);if(error.status===401)onAuthenticationLost();}).finally(()=>{if(request===generation.current)setReading(false);});
    return()=>{generation.current++;};
  },[client,projectId,requestedDocument]);
  async function open(item: DocumentSummary, requested: number) {
    setScreenOrigin(null);
    setShowSourceLinks(false);
    const request = ++generation.current; setRegisteredView(null); setAnchorSelection(null); setShowComparison(false); setSelected(item); setVersion(String(requested)); setOpened(null); setReadError(null); setReading(true); setShowDesignIndex(false);
    try { const value = await readDocument(client, projectId, item.id, requested); if (request === generation.current) { if(stageFilter&&!sameStageRef(value.document.stageNodeRef,stageFilter.ref))throw new ApiError('DOCUMENT_STAGE_CHANGED');setOpened(value); } }
    catch (cause) { if (request !== generation.current) return; const error = cause instanceof ApiError ? cause : new ApiError('RESPONSE_INVALID'); setReadError(error); if (error.status === 401) onAuthenticationLost(); }
    finally { if (request === generation.current) setReading(false); }
  }
  async function openScreen(sourceRef:ScreenRegion['documentRef'],region:ScreenRegion){
    if(!opened||reading||starting||opened.document.id!==sourceRef.id||opened.document.version!==sourceRef.version||opened.document.contentHash!==sourceRef.contentHash)return;
    const context:ScreenRegionContext={projectId,userId:session.user.id,clientId:session.clientId,sourceRef:{...sourceRef}},request=++generation.current;
    setShowSourceLinks(false);
    setReadError(null);setReading(true);setShowComparison(false);
    try{
      const value=await readRegisteredScreen(client,context,{...context,region},()=>request===generation.current);
      if(request!==generation.current)return;
      setSelected(null);setVersion(String(value.document.version));setOpened({document:value.document,body:value.body});setShowDesignIndex(false);setRegisteredView({code:region.screenCode,kind:'시안'});setScreenOrigin(structuredClone({...context,region}));setAnchorSelection(value.anchorSelection);
    }catch(cause){if(request!==generation.current)return;const error=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');setReadError(error);if([401,403,404].includes(error.status)){setOpened(null);setSelected(null);setRegisteredView(null);setAnchorSelection(null);setShowDesignIndex(false);if(error.status===401)onAuthenticationLost();}}
    finally{if(request===generation.current)setReading(false);}
  }
  async function returnToDesign(){
    if(!opened||!screenOrigin||reading||starting)return;
    const current={projectId,userId:session.user.id,clientId:session.clientId,screenRef:{id:opened.document.id,version:opened.document.version,contentHash:opened.document.contentHash}},selection=screenOrigin,request=++generation.current;
    setReading(true);setReadError(null);setOpened(null);setAnchorSelection(null);setShowDesignIndex(false);setShowComparison(false);setShowSourceLinks(false);setRegisteredView(null);setScreenOrigin(null);
    try{const value=await readRegisteredDesignOrigin(client,current,selection,()=>request===generation.current);if(request!==generation.current)return;setSelected(null);setVersion(String(value.document.version));setOpened({document:value.document,body:value.body});setRegisteredView({code:'원설계',kind:'설계'});setAnchorSelection(value.anchorSelection);}
    catch(cause){if(request!==generation.current)return;const error=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');setReadError(error);if(error.status===401)onAuthenticationLost();}
    finally{if(request===generation.current)setReading(false);}
  }
  async function refreshOpened(ref:ScreenRegion['documentRef']){
    if(!opened||opened.document.id!==ref.id||opened.document.version!==ref.version||opened.document.contentHash!==ref.contentHash)return;
    if(selected){await open(selected,ref.version);return;}
    const before=opened.document,request=++generation.current;setReading(true);setReadError(null);
    try{
      const value=await readDocument(client,projectId,ref.id,ref.version);if(request!==generation.current)return;
      const body=value.document.content.body,prior=before.content.body,form=value.document.formRef;
      if(value.document.contentHash!==ref.contentHash||body.artifactId!==prior.artifactId||body.bytes!==prior.bytes||body.contentHash!==prior.contentHash||body.mediaType!==prior.mediaType||form.id!==before.formRef.id||form.version!==before.formRef.version||form.contentHash!==before.formRef.contentHash)throw new ApiError('SCREEN_REGION_REFERENCE_CHANGED');
      setOpened(value);
    }catch(cause){if(request!==generation.current)return;const error=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');setReadError(error);if([401,403,404].includes(error.status)){setOpened(null);setRegisteredView(null);setAnchorSelection(null);if(error.status===401)onAuthenticationLost();}}
    finally{if(request===generation.current)setReading(false);}
  }
  async function beginEdit() {
    if (!opened || starting) return;
    if (reviewing || review?.pending || confirmation) { setEditingError(new ApiError('DOCUMENT_REVIEW_INPUT_PRESERVED')); return; }
    if (buffer?.pending || buffer?.proposalState || (buffer?.designIndexState||buffer?.workPlanState||buffer?.designDependencyState) || buffer?.importState || buffer?.importPreparationId) { setEditingError(new ApiError('DOCUMENT_PENDING_RESULT')); return; }
    if (buffer && buffer.ownerUserId !== session.user.id) { setEditingError(new ApiError('DOCUMENT_OTHER_USER_INPUT_PRESERVED')); return; }
    if (buffer?.dirty && !confirm('앞선 문서의 미저장 편집을 버리고 선택한 버전에서 편집할까요?')) return;
    const current = generation.current; setStarting(true); setEditingError(null);
    try {
      const control = await documentControl(client, projectId, session);
      if (current !== generation.current) return;
      const next = editDocument(projectId, opened, session.user.id, control);
      onChange(previous => previous?.pending || previous?.proposalState || (previous?.designIndexState||previous?.workPlanState||previous?.designDependencyState) || previous?.importState || previous?.importPreparationId || previous && previous.ownerUserId !== session.user.id ? previous : next);
    } catch (cause) { if (current === generation.current) { const error = cause instanceof ApiError ? cause : new ApiError('RESPONSE_INVALID'); setEditingError(error); if (error.status === 401) onAuthenticationLost(); } }
    finally { setStarting(false); }
  }
  async function beginReview() {
    if (!opened || starting || reading || choosingForm || confirmation) return;
    if (buffer?.dirty || buffer?.pending || buffer?.proposalState || (buffer?.designIndexState||buffer?.workPlanState||buffer?.designDependencyState) || review?.pending) { setEditingError(new ApiError('DOCUMENT_PENDING_RESULT')); return; }
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
    if (!opened || starting || reading || choosingForm || confirmation || reviewing || buffer?.dirty || buffer?.pending || buffer?.proposalState || (buffer?.designIndexState||buffer?.workPlanState||buffer?.designDependencyState) || review?.pending) return;
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
    if(!opened||starting||reading||choosingForm||review||confirmation||buffer?.pending||buffer?.proposalState||(buffer?.designIndexState||buffer?.workPlanState||buffer?.designDependencyState)||buffer?.importState||buffer?.importPreparationId||buffer&&buffer.ownerUserId!==session.user.id)return;
    if(buffer?.dirty&&!confirm('앞선 미저장 편집을 버리고 선택한 원문에서 작업계획을 작성할까요?'))return;
    const current=generation.current;setStarting(true);setEditingError(null);
    try{const[form,control]=await Promise.all([getPinnedForm(client,opened.document.formRef),documentControl(client,projectId,session)]);if(current!==generation.current)return;if(form.definition.formCode!=='AF04')throw new ApiError('WORK_PLAN_DOCUMENT_KIND_INVALID',422);const next=editDocument(projectId,opened,session.user.id,control);next.workPlanState=newWorkPlan(next);next.workPlanState.input.tasks=[blankPlanTask()];onChange(previous=>previous===buffer?next:previous);}
    catch(cause){if(current===generation.current){const e=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');setEditingError(e);if(e.status===401)onAuthenticationLost();}}
    finally{setStarting(false);}
  }
  async function beginDependency(relation:'DEPENDS_ON'|'REFINES'='DEPENDS_ON',targetKind?:'DOCUMENT_VERSION') {
    if(!opened||starting||reading||choosingForm||review||confirmation||buffer?.pending||buffer?.proposalState||buffer?.designIndexState||buffer?.workPlanState||buffer?.designDependencyState||buffer?.importState||buffer?.importPreparationId||buffer&&buffer.ownerUserId!==session.user.id)return;
    if(buffer?.dirty&&!confirm('앞선 미저장 편집을 버리고 설계 의존 관계를 작성할까요?'))return;
    const release=preparationGate.acquire();if(!release)return;
    const current=generation.current;setStarting(true);setEditingError(null);
    try{const [form,control]=await Promise.all([getPinnedForm(client,opened.document.formRef),documentControl(client,projectId,session)]);if(current!==generation.current)return;if(form.definition.formCode!=='AF02')throw new ApiError('DESIGN_DOCUMENT_KIND_INVALID',422);
      const ref={id:opened.document.id,version:opened.document.version,contentHash:opened.document.contentHash},index=await readDesignIndex(client,projectId,ref);if(current!==generation.current)return;if(targetKind?!index.items.length:relation==='DEPENDS_ON'?index.items.length<2:!index.items.length||!index.screenRegions.length)throw new ApiError('TRACE_INPUT_INVALID',422);
      const next=editDocument(projectId,opened,session.user.id,control);next.designDependencyState=newDesignDependency({ownerUserId:next.ownerUserId,projectId,documentId:ref.id,baseVersion:ref.version,baseHash:ref.contentHash,controlGeneration:next.controlGeneration,items:index.items,screenRegions:index.screenRegions},relation,targetKind);onChange(previous=>previous===buffer?next:previous);
    }catch(cause){if(current===generation.current){const e=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');setEditingError(e);if(e.status===401)onAuthenticationLost();}}finally{release();setStarting(false);}
  }
  async function beginDesignIndex() {
    if(!opened||starting||reading||choosingForm||review||confirmation||buffer?.pending||buffer?.proposalState||(buffer?.designIndexState||buffer?.workPlanState||buffer?.designDependencyState)||buffer?.importState||buffer?.importPreparationId||buffer&&buffer.ownerUserId!==session.user.id)return;
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
      {stageFilter?<><p>목록 조회 조건: {stageFilter.name}</p><p className="meta">적용본 {stageFilter.ref.applicationId} · 단계 {stageFilter.ref.nodeId} · 미연결/다른 단계 문서 제외</p><button type="button" disabled={starting} onClick={()=>selectListStage(null)}>전체 단계 문서로 돌아가기</button></>:null}
      {opened&&!reading&&!readError&&!loading&&!listError?<DocumentStageFilter key={JSON.stringify([projectId,session.user.id,session.clientId,opened.document.id,opened.document.version,opened.document.contentHash,opened.document.formRef])} client={client} projectId={projectId} formRef={opened.document.formRef} disabled={starting} onSelect={selectListStage} onAuthenticationLost={onAuthenticationLost}/>:null}
      <button disabled={starting || !!confirmation || reviewing || !!review?.pending || choosingForm || !!buffer?.pending || !!buffer?.proposalState || !!(buffer?.designIndexState||buffer?.workPlanState||buffer?.designDependencyState) || !!buffer?.importState || !!buffer?.importPreparationId || !!buffer && buffer.ownerUserId !== session.user.id} onClick={() => { if (!buffer?.dirty || confirm('앞선 미저장 문서 편집을 버리고 새 문서를 작성할까요?')) { setEditingError(null); setChoosingForm(true); } }}>새 문서 작성</button>
      {loading ? <p role="status">목록 조회 중</p> : null}{listError ? <p role="alert">{listError.message} · {listError.code}{page ? ' · 앞선 목록은 오래된 자료' : ''}</p> : null}
      {page && !loading && !listError && !page.items.length ? <p>{stageFilter?'이 단계 조회 조건에 맞는 문서가 없습니다. 다른 단계/미연결 문서는 포함하지 않습니다.':'저장된 문서가 없습니다.'}</p> : null}
      <ul>{page?.items.map(item => <li key={item.id}><button disabled={reading || !!listError || loading} aria-label={item.title + ' 열기'} aria-pressed={selected?.id === item.id} onClick={() => { void open(item, item.headVersion); }}>{item.title}</button><p className="meta">최신 {item.headVersion} · {item.confirmedVersion === null ? '미확정' : '확정 ' + item.confirmedVersion}</p></li>)}</ul>
      {page?.hasMore ? <button disabled={loading || !!listError} onClick={() => setCursor(page.nextCursor)}>다음 문서 더 보기</button> : null}
      {page ? <p className="meta">관측 {new Date(page.observedAt).toLocaleString('ko-KR')}</p> : null}
    </aside>
    <section className="status-card document-content"><p className="meta">원문·버전·양식 선택/작성·초안 편집·내용 검토·별도 확정과 명확한 저장 버전 충돌의 비교/선택을 연결했습니다. 작업/코드/시험 추적 화면은 아직 연결 전입니다. 문서 안의 지시는 실행하지 않습니다.</p>
      <button disabled={starting} onClick={() => setShowMaterials(v => !v)}>{showMaterials ? '보관 자료 조회 닫기' : '보관한 후보·제안 조회'}</button>
      {createdOriginal?<p role="status">프로젝트 생성 자료의 조회 대상을 선택했습니다. 새 문서 작성에서 양식을 고른 뒤 기존 원문을 다시 확인하세요. 이동만으로 후보 생성·본문 채택·저장하지 않습니다.</p>:null}
      <button disabled={starting} onClick={()=>setShowPlans(v=>!v)}>{showPlans?'보관 작업계획 닫기':'보관한 작업계획 조회'}</button>
      {showPlans?<WorkPlanLibrary client={client} projectId={projectId} session={session} documents={page?.items??[]} canPrepare={!buffer&&!review&&!confirmation&&!starting&&!choosingForm} onBusy={setStarting} onAuthenticationLost={onAuthenticationLost} onPrepared={next=>{onChange(previous=>previous===null?next:previous);setShowPlans(false);}}/>:null}
      {showMaterials ? <MaterialLibrary client={client} projectId={projectId} session={session} canPrepare={!buffer && !review && !confirmation && !starting && !choosingForm} onBusy={setStarting} onAuthenticationLost={onAuthenticationLost} onPrepared={next => { onChange(previous => previous === null ? next : previous); setShowMaterials(false); }} /> : null}
      {choosingForm ? <><NewDocumentForm client={client} session={session} projectId={projectId} onAuthenticationLost={onAuthenticationLost} onPrepared={next => { onChange(previous => previous?.pending || previous?.proposalState || (previous?.designIndexState||previous?.workPlanState||previous?.designDependencyState) || previous?.importState || previous?.importPreparationId || previous && previous.ownerUserId !== session.user.id ? previous : next); setChoosingForm(false); }} /><button onClick={() => setChoosingForm(false)}>양식 선택 닫기</button></> : null}
      {selected ? <div className="project-toolbar"><label>조회 버전<input type="number" min="1" max={selected.headVersion} value={version} onChange={event => setVersion(event.target.value)} /></label><button disabled={reading || !Number.isSafeInteger(Number(version)) || Number(version) < 1 || Number(version) > selected.headVersion} onClick={() => { void open(selected, Number(version)); }}>지정 버전 조회</button></div> : registeredView ? <p>{registeredView.code} 고정 {registeredView.kind} 버전 {version} 조회 · 최신 head 미확인 · 새 버전 저장은 기존 서버의 정확 버전 충돌 검사를 따릅니다.</p> : <p>문서를 선택하세요.</p>}
      {opened&&screenOrigin&&screenOrigin.projectId===projectId&&screenOrigin.userId===session.user.id&&screenOrigin.clientId===session.clientId&&screenOrigin.region.documentRef.id===opened.document.id&&screenOrigin.region.documentRef.version===opened.document.version&&screenOrigin.region.documentRef.contentHash===opened.document.contentHash?<button disabled={reading||starting||!!readError||loading||!!listError} onClick={()=>{void returnToDesign();}}>원설계 항목으로 돌아가기</button>:null}
      {reading ? <p role="status">원문 무결성 확인 중</p> : null}{readError ? <p role="alert">{readError.message} · {readError.code}</p> : null}
      {opened ? <><h2>{opened.document.title}</h2><p>{opened.document.confirmed ? '확정된 버전' : '초안 · 내용 검토/사용자 확정과 별개'}</p><p className="meta">버전 {opened.document.version} · 양식 {opened.document.formRef.id} v{opened.document.formRef.version} · SHA256 {opened.document.contentHash}</p>
        <button disabled={reading||!!readError||loading||!!listError} onClick={()=>setShowSourceLinks(v=>!v)}>{showSourceLinks?'소스 연결 조회 닫기':'이 버전 소스 연결 조회'}</button>
{showSourceLinks&&!reading&&!readError&&!loading&&!listError?<DocumentSourceLinks key={JSON.stringify([projectId,session.user.id,session.clientId,opened.document.id,opened.document.version,opened.document.contentHash])} client={client} projectId={projectId} documentRef={{id:opened.document.id,version:opened.document.version,contentHash:opened.document.contentHash}} onDetach={!sourceDetach&&onSourceDetachChange&&!buffer?.pending&&!review?.pending&&!confirmation?.pending?beginSourceDetach:undefined} onAuthenticationLost={onAuthenticationLost}/>:null}
        {!reading && !readError && !loading && !listError ? <PinnedFormOriginal key={JSON.stringify([session.user.id, session.clientId, projectId, opened.document.id, opened.document.version, opened.document.contentHash, opened.document.formRef])} client={client} formRef={opened.document.formRef} onAuthenticationLost={onAuthenticationLost} /> : null}
        <button disabled={reading} onClick={() => setShowComparison(value => !value)}>{showComparison ? '저장 버전 비교 닫기' : '저장 버전 비교 열기'}</button>
        {showComparison && !reading ? <DocumentVersionComparison key={projectId+':'+session.user.id+':'+session.clientId+':'+opened.document.id+':'+opened.document.version+':'+opened.document.contentHash} client={client} projectId={projectId} base={opened} maxVersion={selected?.headVersion ?? opened.document.version} onAuthenticationLost={onAuthenticationLost} /> : null}
        <section aria-label="문서 단계 연결" className="status-card"><h3>연결된 개발 단계</h3>{opened.document.stageBinding ? <><p>{opened.document.stageBinding.methodologyName} · {opened.document.stageBinding.nodeName}</p><p className="meta">적용 세대 {opened.document.stageBinding.applicationRef.version} · {opened.document.stageBinding.nodeId} · {opened.document.stageBinding.applicationRef.contentHash}</p></> : <p>{opened.document.stageNodeRef === null ? '방법론 단계 미연결' : '단계 연결 미확인'}</p>}</section>
        <button disabled={starting || reading || choosingForm || !!confirmation || reviewing || !!review?.pending || !!buffer?.pending || !!(buffer?.designIndexState||buffer?.workPlanState||buffer?.designDependencyState) || !!buffer && buffer.ownerUserId !== session.user.id} onClick={() => { void beginEdit(); }}>이 버전에서 편집</button>
        <button disabled={starting || reading || choosingForm || !!confirmation || !!buffer?.dirty || !!buffer?.pending || !!(buffer?.designIndexState||buffer?.workPlanState||buffer?.designDependencyState) || !!review?.pending || !!review && review.ownerUserId !== session.user.id} onClick={() => { void beginReview(); }}>이 버전 내용 검토 작성</button>
        <button disabled={starting || reading || choosingForm || !!confirmation || reviewing || !!buffer?.dirty || !!buffer?.pending || !!(buffer?.designIndexState||buffer?.workPlanState||buffer?.designDependencyState) || !!review?.pending || !latestAcceptedDocumentReview(opened.document)} onClick={() => { void beginConfirmation(); }}>이 버전 확정 준비</button>
        <button disabled={reading} onClick={()=>{setAnchorSelection(null);setShowDesignIndex(v=>!v);}}>{showDesignIndex?'설계 추적 조회 닫기':'이 버전 설계 추적 조회'}</button>
        <button disabled={starting||reading||choosingForm||!!review||!!confirmation||!!buffer?.pending||!!buffer?.proposalState||!!(buffer?.designIndexState||buffer?.workPlanState||buffer?.designDependencyState)||!!buffer?.workPlanState||!!buffer?.importState||!!buffer?.importPreparationId||!!buffer&&buffer.ownerUserId!==session.user.id} onClick={()=>{void beginWorkPlan();}}>이 버전에서 작업계획 작성</button>
        <button disabled={starting||reading||choosingForm||!!review||!!confirmation||!!buffer?.pending||!!buffer?.proposalState||!!(buffer?.designIndexState||buffer?.workPlanState||buffer?.designDependencyState)||!!buffer?.importState||!!buffer?.importPreparationId||!!buffer&&buffer.ownerUserId!==session.user.id} onClick={()=>{void beginDesignIndex();}}>이 버전 설계 위치 등록</button>
        <button disabled={starting||reading||choosingForm||!!review||!!confirmation||!!buffer?.pending||!!buffer?.proposalState||!!buffer?.designIndexState||!!buffer?.workPlanState||!!buffer?.designDependencyState||!!buffer?.importState||!!buffer?.importPreparationId||!!buffer&&buffer.ownerUserId!==session.user.id} onClick={()=>{void beginDependency();}}>이 버전 설계 의존 관계 작성</button>
        <button disabled={starting||reading||choosingForm||!!review||!!confirmation||!!buffer?.pending||!!buffer?.proposalState||!!buffer?.designIndexState||!!buffer?.workPlanState||!!buffer?.designDependencyState||!!buffer?.importState||!!buffer?.importPreparationId||!!buffer&&buffer.ownerUserId!==session.user.id} onClick={()=>{void beginDependency('REFINES');}}>이 버전 화면 상세화 관계 작성</button>
        <button disabled={starting||reading||choosingForm||!!review||!!confirmation||!!buffer?.pending||!!buffer?.proposalState||!!buffer?.designIndexState||!!buffer?.workPlanState||!!buffer?.designDependencyState||!!buffer?.importState||!!buffer?.importPreparationId||!!buffer&&buffer.ownerUserId!==session.user.id} onClick={()=>{void beginDependency('REFINES','DOCUMENT_VERSION');}}>이 버전 설계 항목 상세화 관계 작성</button>
        {showDesignIndex?<DesignIndexViewer key={opened.document.id+':'+opened.document.version+':'+opened.document.contentHash} client={client} projectId={projectId} documentRef={{id:opened.document.id,version:opened.document.version,contentHash:opened.document.contentHash}} bodyHash={opened.document.content.body.contentHash} onAnchorSelect={setAnchorSelection} onScreenOpen={reading||starting?undefined:(sourceRef,region)=>{void openScreen(sourceRef,region);}} onAuthenticationLost={onAuthenticationLost}/>:null}
        {confirming && confirmation && !confirmation.pending && !confirmation.saved && !confirmation.uncertain && confirmation.rejectedAttempts?.length ? <button disabled={starting || reading || choosingForm || !latestAcceptedDocumentReview(opened.document)} onClick={() => { void replaceConfirmation(); }}>열어 둔 버전으로 확정 대상 변경</button> : null}
        {!opened.document.confirmed && !latestAcceptedDocumentReview(opened.document) ? <p className="meta">확정하려면 필수 본문/반복 항목 검사와 정확한 최신 적합 검토가 필요합니다.</p> : null}
        <DesignAnchorOriginal body={opened.body} context={{projectId,documentRef:{id:opened.document.id,version:opened.document.version,contentHash:opened.document.contentHash},bodyHash:opened.document.content.body.contentHash}} selection={anchorSelection} onClear={()=>setAnchorSelection(null)}/>
        {!reading&&!readError&&!loading&&!listError?<DocumentMarkdownPreview key={JSON.stringify([projectId,session.user.id,session.clientId,opened.document.id,opened.document.version,opened.document.contentHash,opened.document.content.body.contentHash])} body={opened.body} mediaType={opened.document.content.body.mediaType}/>:null}
        {!reading&&!readError&&!loading&&!listError?<StoredDocumentAttachments key={JSON.stringify([projectId,session.user.id,session.clientId,opened.document.id,opened.document.version,opened.document.contentHash])} client={client} projectId={projectId} document={opened.document} onAuthenticationLost={onAuthenticationLost}/>:null}
        <h3>형식 검사</h3>{opened.document.validation.issues.length ? <ul>{opened.document.validation.issues.map((issue, index) => <li key={index}><span>{issue.message}</span><span className="meta"> · {issue.code} · {issue.location}</span></li>)}</ul> : <p>기록된 형식 문제 없음 · 내용 검토 합격을 의미하지 않습니다.</p>}
        <h3>저장 이력</h3><ul>{opened.document.statusHistory.map((event, index) => <li key={index}>{event.kind} · {event.reason} · {new Date(event.at).toLocaleString('ko-KR')}</li>)}</ul></> : null}
      {opened ? <><h3>양식의 내용 검토 기준</h3><ul>{opened.document.contentReviewCriteria.items.map(item => <li key={item.criterionId}>{item.title}<ul>{item.reviewCriteria.map((criterion, index) => <li key={index}>{criterion}</li>)}</ul></li>)}</ul>
        <h3>기록된 내용 검토</h3>{!opened.document.contentReviews.length ? <p>아직 내용 검토가 기록되지 않았습니다.</p> : opened.document.contentReviews.map(review => <section className="status-card" key={review.ref.id}><p>{review.ref.outcome} · {new Date(review.reviewedAt).toLocaleString('ko-KR')}</p><p>{review.reason}</p><p className="meta">검토자 {review.reviewer.userId}</p>{review.reviewer.sameAsTargetRecorder ? <p>작성 기록자와 같은 사용자 · 독립 검수 아님</p> : null}<ul>{review.items.map(item => <li key={item.criterionId}>{item.criterionId} · {item.outcome} · {item.reason}</li>)}</ul><p className="meta">내용 검토자의 판단이며 사용자 확정/실제 시험 합격/Agent 실행 승인이 아닙니다.</p></section>)}</> : null}
      {editingError ? <p role="alert">{editingError.message} · {editingError.code}</p> : null}
      {ownsSourceDetach&&sourceDetach&&onSourceDetachChange?<SourceDetachEditor key={sourceDetach.bindingId} client={client} session={session} buffer={sourceDetach} onChange={onSourceDetachChange} onVerified={()=>setShowSourceLinks(false)} onAuthenticationLost={onAuthenticationLost}/>:null}
      {confirmation && !confirming ? <p>다른 사용자 또는 프로젝트의 확정 요청은 숨겨 보존했습니다.</p> : null}
      {confirming && confirmation ? <DocumentConfirmation key={confirmation.ref.id + ':' + confirmation.ref.version} client={client} session={session} buffer={confirmation} onChange={onConfirmationChange} onAuthenticationLost={onAuthenticationLost} onConfirmed={() => { setRefresh(value => value + 1); void refreshOpened(confirmation.ref); }} /> : null}
      {review && (review.ownerUserId !== session.user.id || review.projectId !== projectId) ? <p>다른 사용자 또는 프로젝트의 검토 입력은 숨겨 보존했습니다.</p> : null}
      {review?.ownerUserId === session.user.id && review.projectId === projectId ? <DocumentReviewEditor key={review.ref.id + ':' + review.ref.version + ':' + review.ref.contentHash} client={client} session={session} buffer={review} onChange={onReviewChange} onAuthenticationLost={onAuthenticationLost} onRecorded={() => { setRefresh(value => value + 1); void refreshOpened(review.ref); }} /> : null}
      {buffer && (buffer.ownerUserId !== session.user.id || buffer.projectId !== projectId) ? <p>다른 사용자 또는 프로젝트의 편집 입력은 숨겨 보존했습니다. 이 화면에서 자동 교체하지 않습니다.</p> : null}
      {!choosingForm&&!confirming&&!reviewing&&buffer?.ownerUserId===session.user.id&&buffer.projectId===projectId&&buffer.workPlanState?<WorkPlanEditor key={buffer.workPlanState.bindingId} client={client} session={session} buffer={buffer} documents={page?.items??[]} onChange={onChange} onAuthenticationLost={onAuthenticationLost}/>:null}
      {!choosingForm&&!confirming&&!reviewing&&buffer?.ownerUserId===session.user.id&&buffer.projectId===projectId&&buffer.designDependencyState?<DesignDependencyEditor key={buffer.designDependencyState.bindingId} client={client} session={session} buffer={buffer} onChange={onChange} onAuthenticationLost={onAuthenticationLost}/>:null}
      {!choosingForm&&!confirming&&!reviewing&&buffer?.ownerUserId===session.user.id&&buffer.projectId===projectId&&buffer.designIndexState?<DesignIndexEditor key={buffer.designIndexState.bindingId} client={client} session={session} buffer={buffer} documents={page?.items??[]} onChange={onChange} onAuthenticationLost={onAuthenticationLost}/>:null}
      {!choosingForm && !confirming && !reviewing && buffer?.ownerUserId === session.user.id && buffer.projectId === projectId && !buffer.designIndexState && !buffer.workPlanState && !buffer.designDependencyState ? <DocumentEditor createdOriginal={createdOriginal} preparationGate={preparationGate} client={client} session={session} buffer={buffer} onChange={onChange} onAuthenticationLost={onAuthenticationLost} onSaved={(id, nextVersion, title) => { setCursor(null); setRefresh(value => value + 1); void open({ id, title, headVersion: nextVersion, confirmedVersion: null, updatedAt: new Date().toISOString() }, nextVersion); }} /> : null}
    </section>
  </section>;
}
