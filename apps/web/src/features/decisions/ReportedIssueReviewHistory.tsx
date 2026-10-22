import {useEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import type {SubmittedResultView} from '../session-detail/result-api.ts';
import type {ConfirmedAssignmentView} from '../workspace/assignment-confirmation-api.ts';
import {readStoredResultReviews,readStoredResultReview,type StoredResultReviews,type StoredReviewSummary} from '../session-detail/stored-result-reviews-api.ts';
import type {RecordedResultReview} from '../session-detail/result-review-write-api.ts';
import {NextActionBasisPanel} from '../session-detail/NextActionBasisPanel.tsx';
/** 부모의 고정 보고·임무 및 사용자/client key 아래 보관 원문만 소비한다. */
export function ReportedIssueReviewHistory({client,result,assignment,onUnavailable,onAuthenticationLost}:{client:ApiClient;result:SubmittedResultView;assignment:ConfirmedAssignmentView;onUnavailable:(code:string)=>void;onAuthenticationLost:()=>void}){
 const[attempt,setAttempt]=useState(0),[page,setPage]=useState<{key:string;value:StoredResultReviews|null;error:string|null}|null>(null),[chosen,setChosen]=useState<StoredReviewSummary|null>(null),[readAttempt,setReadAttempt]=useState(0),[original,setOriginal]=useState<{key:string;value:RecordedResultReview|null;error:string|null}|null>(null);
 const unavailable=useRef(onUnavailable),lost=useRef(onAuthenticationLost);unavailable.current=onUnavailable;lost.current=onAuthenticationLost;
 const key=JSON.stringify([result.ref,assignment.ref,attempt]),shown=page?.key===key?page:null,readKey=JSON.stringify([key,chosen?.ref,readAttempt]),selected=original?.key===readKey?original:null;
 function error(cause:unknown){const e=cause instanceof ApiError?cause:new ApiError('RESULT_REVIEW_HISTORY_RESPONSE_INVALID'),code=/^[A-Z_]{1,80}$/.test(e.code)?e.code:'RESULT_REVIEW_HISTORY_RESPONSE_INVALID';if([401,403,404].includes(e.status))unavailable.current(code);if(e.status===401)lost.current();return code;}
 useEffect(()=>{if(!attempt)return;let active=true;readStoredResultReviews(client,result,()=>active).then(value=>{if(active&&value)setPage({key,value,error:null});}).catch(cause=>{if(active)setPage({key,value:null,error:error(cause)});});return()=>{active=false;};},[client,result,key,attempt]);
 useEffect(()=>{if(!chosen||!shown?.value?.items.some(i=>JSON.stringify(i)===JSON.stringify(chosen)))return;let active=true;readStoredResultReview(client,result,chosen,()=>active).then(value=>{if(active&&value)setOriginal({key:readKey,value,error:null});}).catch(cause=>{if(active)setOriginal({key:readKey,value:null,error:error(cause)});});return()=>{active=false;};},[client,result,chosen,shown,readKey]);
 const review=selected?.value;
 return <section className="status-card" aria-label="보고의 보완·차단 검수 이력"><h5>보관된 보완·차단 검수</h5><p>저장 당시의 사람 검수입니다. 최신 검수 자동 선택·실제 수행 인증·완료 수락·정식 실패 횟수 반영·실행 허가는 하지 않습니다.</p>
  <button type="button" disabled={attempt>0&&!shown} onClick={()=>{setPage(null);setChosen(null);setOriginal(null);setAttempt(v=>v+1);}}>{attempt?'검수 이력 다시 조회':'검수 이력 조회'}</button>
  {attempt>0&&!shown?<p role="status">이력 조회 중 · 이전 원문과 근거 숨김</p>:null}{shown?.error?<p role="alert">{shown.error}</p>:null}
  {shown?.value?<><p>조회 {shown.value.observedAt} · 최근 최대 20건. 원문을 직접 선택하세요.</p>{shown.value.hasMore?<p>이전 이력이 더 있습니다. 전체 이력 조회가 아니며 이 목록만으로 검수 부재를 판단하지 않습니다.</p>:null}{!shown.value.items.length?<p>조회 범위에 보관된 검수 없음</p>:null}<ul>{shown.value.items.map(item=><li key={item.ref.id}><span>{item.outcome} · {item.reviewedAt} · v{item.ref.version} · SHA256 {item.ref.contentHash}</span><button type="button" onClick={()=>{setOriginal(null);setChosen(structuredClone(item));setReadAttempt(v=>v+1);}}>검수 원문 {item.ref.id}</button></li>)}</ul></>:null}
  {chosen&&!selected?<p role="status">선택 원문 대조 중 · 이전 근거 숨김</p>:null}{selected?.error?<p role="alert">{selected.error} · 원문 미확인</p>:null}
  {review?<><article aria-label="선택한 보관 검수 원문"><p>{review.snapshot.input.outcome} · 검수 {review.ref.id} · v{review.ref.version} · SHA256 {review.ref.contentHash}</p><p>{review.snapshot.input.reason}</p><ul>{review.snapshot.input.items.map(item=><li key={item.criterionId}>{item.criterionId} · {item.outcome} · {item.reason}</li>)}</ul><p>검수자 {review.snapshot.reviewedBy.userId} · {review.snapshot.reviewedAt} · 제출자와 동일 {review.snapshot.sameAsSubmitter?'예':'아니오'}</p><p>보관 당시 근거이며 현재 권한·실행 상태·증거 출처의 진실성은 미확인입니다.</p></article><NextActionBasisPanel key={readKey} client={client} result={result} assignment={assignment} review={review} onAuthenticationLost={onAuthenticationLost} onAccessUnavailable={onUnavailable} reworkPreparationAvailable={false}/></>:null}
 </section>;
}
