import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import {sessionDetailHref} from '../../shell/routes.ts';
import type {PlanRef} from '../design-trace/work-plan-api.ts';
import type {DocumentSession} from '../design-trace/editor-api.ts';
import {ResultArtifactDownloads} from '../session-detail/ResultArtifactDownloads.tsx';
import {readAssignmentResult,type ResultSummary,type SubmittedResultView} from '../session-detail/result-api.ts';
import {ResultContent} from '../session-detail/SessionDetailPage.tsx';
import {ReportedIssueAssignment} from './ReportedIssueAssignment.tsx';
import {StoredObservationJournal} from '../session-detail/StoredObservationJournal.tsx';
import {StoredStopRequests} from '../session-detail/StoredStopRequests.tsx';
import {IssueBasisPanel} from './IssueBasisPanel.tsx';
import {ResultArtifactTexts} from '../session-detail/ResultReviewSources.tsx';

export interface ResultIssueSelection{assignmentRef:PlanRef;returnDraftRef:PlanRef;item:ResultSummary}
type ResultIssueProps={client:ApiClient;session:DocumentSession;projectId:string;selection:ResultIssueSelection|null;onClose:()=>void;onAuthenticationLost:()=>void};
const issueIdentity=({projectId,selection,session}:ResultIssueProps)=>JSON.stringify([projectId,selection,session.user.id,session.clientId,session.csrfToken]);
/** 이미 조회한 고정 결과의 선택만 보관한다. 현재 원인/권한/관측 분류를 생성하지 않는다. */
export function ReportedResultIssue(props:ResultIssueProps){
 const identity=issueIdentity(props),route=globalThis.location?.hash,context=useRef({client:props.client,transport:props.client.transport,identity,route,valid:true,generation:0});
 if(context.current.client!==props.client||context.current.transport!==props.client.transport||context.current.identity!==identity)context.current={client:props.client,transport:props.client.transport,identity,route,valid:true,generation:context.current.generation+1};
 else if(context.current.route!==route)context.current.valid=false;
 else if(!context.current.valid)context.current={...context.current,valid:true,generation:context.current.generation+1};
 const owner=context.current,alive=useRef(false),[,refreshRoute]=useState(0);
 useLayoutEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 useLayoutEffect(()=>{
  const hash=(value:string)=>{try{return new URL(value).hash;}catch{return null;}};
  const changed=(event:HashChangeEvent)=>{if(context.current!==owner)return;const before=event.oldURL?hash(event.oldURL):owner.route,after=event.newURL?hash(event.newURL):globalThis.location?.hash;if(before!==owner.route||after!==owner.route||globalThis.location?.hash!==owner.route){owner.valid=false;refreshRoute(value=>value+1);}};
  globalThis.addEventListener?.('hashchange',changed);return()=>globalThis.removeEventListener?.('hashchange',changed);
 },[owner]);
 return <ReportedResultIssueContent key={owner.generation} {...props} isCurrent={()=>alive.current&&owner.valid&&context.current===owner&&props.client.transport===owner.transport&&issueIdentity(props)===owner.identity&&globalThis.location?.hash===owner.route}/>;
}
function ReportedResultIssueContent({client,session,projectId,selection,onClose,onAuthenticationLost,isCurrent}:ResultIssueProps&{isCurrent:()=>boolean}){
 const [attempt,setAttempt]=useState(0),[loaded,setLoaded]=useState<{key:string;value:SubmittedResultView|null;error:string|null}|null>(null),lost=useRef(onAuthenticationLost);lost.current=onAuthenticationLost;
 const key=JSON.stringify([projectId,selection,attempt]),shown=loaded?.key===key?loaded:null;
 const readRevision=useRef(0),viewRevision=readRevision.current;
 const current=()=>isCurrent()&&readRevision.current===viewRevision;
 const invalidate=()=>{readRevision.current++;setLoaded(null);};
 const hideUnavailable=(code:string)=>{
  if(!current())return false;
  readRevision.current++;setLoaded({key,value:null,error:code});
  return true;
 };
 const authenticationLost=()=>{if(isCurrent())lost.current();};
 const onHistoryUnavailable=(code:string)=>{if(hideUnavailable(code)&&code==='AUTH_REQUIRED')authenticationLost();};
 useEffect(()=>{if(!selection||!attempt)return;let live=true;const selected=structuredClone(selection),active=()=>live&&current();
  readAssignmentResult(client,projectId,selected.assignmentRef,selected.item,active).then(value=>{if(active()&&value)setLoaded({key,value,error:null});}).catch(cause=>{if(!active())return;const e=cause instanceof ApiError?cause:new ApiError('RESULT_RESPONSE_INVALID');setLoaded({key,value:null,error:/^[A-Z_]{1,80}$/.test(e.code)?e.code:'RESULT_RESPONSE_INVALID'});if(e.status===401)lost.current();});return()=>{live=false;};
 },[client,projectId,selection,attempt,key]);
 return <section className="status-card" aria-label="선택 보고의 문제 원문"><h3>보고된 문제·미확인 원문</h3><p>실제 원인·현재 실행 상태는 미확인입니다. 수행자 보고를 오류 원인 확정·검수 합격·정식 실패 횟수로 계산하지 않습니다.</p>
  {selection?<><p>선택 제출 {selection.item.ref.id} · v{selection.item.ref.version} · SHA256 {selection.item.ref.contentHash}</p><button type="button" disabled={attempt>0&&!shown} onClick={()=>{if(!current())return;invalidate();setAttempt(n=>n+1);}}>{attempt?'선택 보고 원문 다시 확인':'선택 보고 원문 확인'}</button><button type="button" onClick={()=>{if(!current())return;invalidate();setAttempt(0);onClose();}}>선택 보고 닫기</button><a href={sessionDetailHref(projectId,selection.returnDraftRef)} onClick={event=>{if(!current()){event.preventDefault();return;}invalidate();setAttempt(0);}}>원 임무 상세로 돌아가기</a>{attempt&&!shown?<p role="status">정확 보고 원문 조회 중 · 이전 원문 숨김</p>:null}{shown?.error?<p role="alert">{shown.error} · 보고 원문 미확인. 다른 보고로 대체하지 않습니다.</p>:null}{shown?.value?<>
   <ResultContent value={shown.value}/>
   <ResultArtifactTexts key={'artifacts:'+key} client={client} result={shown.value} onAccessUnavailable={hideUnavailable} onAuthenticationLost={authenticationLost}/>
   <ResultArtifactDownloads key={'downloads:'+key} client={client} result={shown.value} session={session} onAccessUnavailable={hideUnavailable} onAuthenticationLost={authenticationLost}/>
   <IssueBasisPanel key={'basis:'+key} client={client} result={shown.value} onUnavailable={hideUnavailable} onAuthenticationLost={authenticationLost}/>
   <StoredObservationJournal key={'observations:'+key} client={client} result={shown.value} isCurrent={current} onUnavailable={onHistoryUnavailable}/>
   <StoredStopRequests key={'stop-requests:'+key} client={client} result={shown.value} session={session} isCurrent={current} onUnavailable={onHistoryUnavailable}/>
   <ReportedIssueAssignment key={JSON.stringify([shown.value.ref,selection.returnDraftRef])} client={client} result={shown.value} draftRef={selection.returnDraftRef} isCurrent={current} onUnavailable={hideUnavailable} onAuthenticationLost={authenticationLost}/>
  </>:null}</>:<p>단계책임자·실행 상세에서 제출 원문을 확인한 뒤 이 화면으로 가져오세요. 보고가 없다고 정상·완료로 판단하지 않습니다.</p>}
  <p>조회는 승인·보완 요청·Agent 교체·새 실행을 하지 않습니다. 실제 원인 분류와 조치 실행은 아직 연결 전입니다.</p>
 </section>;
}
