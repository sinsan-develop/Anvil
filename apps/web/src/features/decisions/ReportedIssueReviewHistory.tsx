import {useLayoutEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import {ordered} from '../knowledge/review-view.ts';
import type {SubmittedResultView} from '../session-detail/result-api.ts';
import type {ConfirmedAssignmentView} from '../workspace/assignment-confirmation-api.ts';
import {readStoredResultReviewPage,readStoredResultReview,storedReviewRootCursor,type StoredResultReviewPage,type StoredReviewSummary} from '../session-detail/stored-result-reviews-api.ts';
import type {RecordedResultReview} from '../session-detail/result-review-write-api.ts';
import {NextActionBasisPanel} from '../session-detail/NextActionBasisPanel.tsx';
import {ReviewCriteriaOriginal} from '../session-detail/ReviewCriteriaOriginal.tsx';
/** 부모의 고정 보고·임무 및 사용자/client key 아래 보관 원문만 소비한다. */
export function ReportedIssueReviewHistory({client,result,assignment,isSourceCurrent,onUnavailable,onAuthenticationLost}:{client:ApiClient;result:SubmittedResultView;assignment:ConfirmedAssignmentView;isSourceCurrent?:()=>boolean;onUnavailable:(code:string)=>void;onAuthenticationLost:()=>void}){
 const binding=JSON.stringify([result.snapshot.scope,result.ref,assignment.projectId,assignment.ref]),scope=useRef({client,transport:client.transport,binding});
 if(scope.current.client!==client||scope.current.transport!==client.transport||scope.current.binding!==binding)scope.current={client,transport:client.transport,binding};
 const owner=scope.current,alive=useRef(false),sequence=useRef(0);
 type Request={owner:typeof owner;number:number;controller:AbortController};
 type Selection={request:Request;ticket:number};
 const latest=useRef<Request|null>(null),loading=useRef<Request|null>(null),choice=useRef<Selection|null>(null);
 const [page,setPage]=useState<{request:Request;value:StoredResultReviewPage|null;error:string|null}|null>(null),[original,setOriginal]=useState<{selection:Selection;value:RecordedResultReview|null;error:string|null}|null>(null),[reading,setReading]=useState<Selection|null>(null);
 const unavailable=useRef(onUnavailable),lost=useRef(onAuthenticationLost);unavailable.current=onUnavailable;lost.current=onAuthenticationLost;
 const current=()=>alive.current&&scope.current===owner&&client.transport===owner.transport&&isSourceCurrent?.()!==false;
 const shown=page?.request.owner===owner&&page.request===latest.current?page:null,busy=!!shown&&!shown.value&&!shown.error;
 const selected=original&&original.selection===choice.current&&original.selection.request===shown?.request?original:null;
 useLayoutEffect(()=>{alive.current=true;return()=>{alive.current=false;latest.current?.controller.abort();latest.current=null;choice.current=null;};},[]);
 function error(cause:unknown){const e=cause instanceof ApiError?cause:new ApiError('RESULT_REVIEW_HISTORY_RESPONSE_INVALID'),code=/^[A-Z_]{1,80}$/.test(e.code)?e.code:'RESULT_REVIEW_HISTORY_RESPONSE_INVALID';if([401,403,404].includes(e.status))unavailable.current(code);if(e.status===401)lost.current();return code;}
 async function load(previous?:NonNullable<typeof shown>){
  if(!current()||loading.current?.owner===owner||previous&&latest.current!==previous.request)return;
  const cursor=previous?.value?.nextCursor??null;if(previous&&!cursor)return;
  const request={owner,number:previous?previous.request.number+1:1,controller:new AbortController()};
  latest.current?.controller.abort();latest.current=loading.current=request;choice.current=null;
  setOriginal(null);setReading(null);setPage({request,value:null,error:null});
  const active=()=>current()&&latest.current===request;
  try{
   const value=await readStoredResultReviewPage(client,result,cursor,active,request.controller.signal);
   if(!active()||!value)return;
   if(previous?.value&&cursor){
    const prior=previous.value,tail=prior.items.at(-1),head=value.items[0];
    const repeats=prior.items.some(item=>value.items.some(next=>next.ref.id===item.ref.id));
    if(ordered(value.window)!==ordered(previous.value.window)||value.nextCursor!==null&&(value.nextCursor===cursor||storedReviewRootCursor(value.nextCursor)!==storedReviewRootCursor(cursor))
     ||repeats||tail&&head&&head.reviewedAt>tail.reviewedAt)throw new ApiError('RESULT_REVIEW_HISTORY_RESPONSE_INVALID');
   }
   setPage({request,value,error:null});
  }catch(cause){if(active())setPage({request,value:null,error:error(cause)});}
  finally{if(loading.current===request){loading.current=null;if(latest.current===request&&scope.current===owner&&!current()){latest.current=null;setPage(null);}}}
 }
 async function select(item:StoredReviewSummary){
  if(!current()||!shown?.value?.items.includes(item)||shown.request!==latest.current)return;
  const selection={request:shown.request,ticket:++sequence.current};choice.current=selection;setOriginal(null);setReading(selection);
  const active=()=>current()&&latest.current===selection.request&&choice.current===selection;
  try{const value=await readStoredResultReview(client,result,item,active);if(active()&&value)setOriginal({selection,value,error:null});}
  catch(cause){if(active())setOriginal({selection,value:null,error:error(cause)});}
  finally{if(active())setReading(null);}
 }
 const review=selected?.value,readKey=selected?.selection.ticket;
 const reviewCurrent=()=>current()&&selected?.selection===choice.current&&selected?.selection.request===latest.current;
 const reviewUnavailable=(code:string)=>{if(reviewCurrent())queueMicrotask(()=>{if(reviewCurrent())unavailable.current(code);});};
 const reviewAuthenticationLost=()=>{if(reviewCurrent())lost.current();};
 return <section className="status-card" aria-label="보고의 보완·차단 검수 이력"><h5>보관된 보완·차단 검수</h5><p>저장 당시의 사람 검수입니다. 최신 검수 자동 선택·실제 수행 인증·완료 수락·정식 실패 횟수 반영·실행 허가는 하지 않습니다.</p>
  <button type="button" disabled={busy} onClick={()=>void load()}>{shown?'검수 이력 다시 조회':'검수 이력 조회'}</button>
  {busy?<p role="status">이력 조회 중 · 이전 원문과 근거 숨김</p>:null}{shown?.error?<p role="alert">{shown.error} · 검수 이력 미확인</p>:null}
  {shown?.value?<><p>검수 {shown.request.number}페이지 · {shown.value.items.length}건. 원문을 직접 선택하세요.</p><p>조회창 <time>{shown.value.window.startedAt}</time> ~ <time>{shown.value.window.expiresAt}</time></p>{!shown.value.items.length?<p>조회 범위에 보관된 검수 없음</p>:null}<ul>{shown.value.items.map(item=><li key={item.ref.id}><span>{item.outcome} · {item.reviewedAt} · v{item.ref.version} · SHA256 {item.ref.contentHash}</span><button type="button" onClick={()=>void select(item)}>검수 원문 {item.ref.id}</button></li>)}</ul>{shown.value.nextCursor?<button type="button" onClick={()=>void load(shown)}>더 이전 검수 목록 조회</button>:null}</>:null}
  {reading&&reading===choice.current&&!selected?<p role="status">선택 원문 대조 중 · 이전 근거 숨김</p>:null}{selected?.error?<p role="alert">{selected.error} · 원문 미확인</p>:null}
{review?<><article aria-label="선택한 보관 검수 원문"><p>{review.snapshot.input.outcome} · 검수 {review.ref.id} · v{review.ref.version} · SHA256 {review.ref.contentHash}</p><p>{review.snapshot.input.reason}</p><ul>{review.snapshot.input.items.map(item=><li key={item.criterionId}>{item.criterionId} · {item.outcome} · {item.reason}</li>)}</ul><p>검수자 {review.snapshot.reviewedBy.userId} · {review.snapshot.reviewedAt} · 제출자와 동일 {review.snapshot.sameAsSubmitter?'예':'아니오'}</p><p>보관 당시 근거이며 현재 권한·실행 상태·증거 출처의 진실성은 미확인입니다.</p></article><ReviewCriteriaOriginal key={'criteria:'+readKey} client={client} assignment={assignment} review={review} result={result} isSourceCurrent={reviewCurrent} onAuthenticationLost={reviewAuthenticationLost} onAccessUnavailable={reviewUnavailable}/><NextActionBasisPanel key={readKey} client={client} result={result} assignment={assignment} review={review} isSourceCurrent={reviewCurrent} onAuthenticationLost={reviewAuthenticationLost} onAccessUnavailable={reviewUnavailable} reworkPreparationAvailable={false}/></>:null}
 </section>;
}
