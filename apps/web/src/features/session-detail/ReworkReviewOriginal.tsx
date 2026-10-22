import {useEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import type {ConfirmedAssignmentView} from '../workspace/assignment-confirmation-api.ts';
import type {SubmittedResultView} from './result-api.ts';
import type {StoredResultRework} from './result-rework-write-api.ts';
import {readReworkReviewOriginal} from './rework-review-original.ts';
type Original=NonNullable<Awaited<ReturnType<typeof readReworkReviewOriginal>>>;
/** 원검토는 사용자 명시 조회만. 새 검수·재작업 명령이나 완료 판정은 만들지 않는다. */
export function ReworkReviewOriginal({client,assignment,result,rework,onUnavailable}:{client:ApiClient;assignment:ConfirmedAssignmentView;result:SubmittedResultView;rework:StoredResultRework;onUnavailable:(error:ApiError)=>void}){
 const [loaded,setLoaded]=useState<{key:string;value:Original|null;error:string|null}|null>(null),[pending,setPending]=useState<string|null>(null),ticket=useRef(0),flight=useRef(false),unavailable=useRef(onUnavailable);unavailable.current=onUnavailable;
 const key=JSON.stringify([assignment.projectId,assignment.ref,result.ref,rework.ref]),latest=useRef(key);latest.current=key;
 useEffect(()=>{ticket.current++;flight.current=false;return()=>{ticket.current++;flight.current=false;};},[client,key]);
 const shown=loaded?.key===key?loaded:null,busy=pending===key;
 function clear(){ticket.current++;flight.current=false;setPending(null);setLoaded(null);}
 async function read(){if(flight.current)return;const id=++ticket.current,active=()=>ticket.current===id&&latest.current===key;flight.current=true;setLoaded(null);setPending(key);
  try{const value=await readReworkReviewOriginal(client,assignment,result,rework,active);if(active()&&value)setLoaded({key,value,error:null});}
  catch(cause){if(!active())return;const e=cause instanceof ApiError?cause:new ApiError('REWORK_REVIEW_ORIGINAL_INVALID'),code=/^[A-Z_]{1,80}$/.test(e.code)?e.code:'REWORK_REVIEW_ORIGINAL_INVALID';setLoaded({key,value:null,error:code});if([401,403,404].includes(e.status))unavailable.current(e);}
  finally{if(active()){flight.current=false;setPending(null);}}
 }
 return <section aria-label="보완 원검토 조회"><button type="button" disabled={busy} onClick={()=>void read()}>{shown?'보완의 원검토 다시 조회':'이 보완의 원검토 열기'}</button><button type="button" disabled={!busy&&!shown} onClick={clear}>원검토 닫기</button>
  {busy?<p role="status">원 보완·검토 고정 참조 대조 중 · 앞선 원문 숨김</p>:null}{shown?.error?<p role="alert">{shown.error} · 원검토 미확인 · 다른 검토로 대체하지 않습니다.</p>:null}
  {shown?.value&&!busy?<article aria-label="보완의 원검토 조건"><h6>원검토 조건 · 완료·재작업 실행 허가 아님</h6><p>원검토 {shown.value.review.ref.id} · v{shown.value.review.ref.version} · SHA256 {shown.value.review.ref.contentHash}</p><p>기준 {shown.value.review.snapshot.input.criteriaRef.id} · v{shown.value.review.snapshot.input.criteriaRef.version} · SHA256 {shown.value.review.snapshot.input.criteriaRef.contentHash}</p><p>검토자 {shown.value.review.snapshot.reviewedBy.userId} · {shown.value.review.snapshot.reviewedAt} · {shown.value.review.snapshot.sameAsSubmitter?'제출자와 동일':'제출자와 다름 · 독립성 보장 아님'}</p><p>{shown.value.review.snapshot.input.reason}</p><h6>이 보완에 선택한 조건</h6><ul>{shown.value.selectedItems.map(i=><li key={i.criterionId}>{i.criterionId} · {i.outcome} · {i.reason}</li>)}</ul><h6>원검토의 남은 조건</h6>{shown.value.remainingItems.length?<ul>{shown.value.remainingItems.map(i=><li key={i.criterionId}>{i.criterionId} · {i.outcome} · {i.reason}</li>)}</ul>:<p>보관 검토의 남은 조건 없음 · 현재 완료 판정 아님</p>}<details><summary>원검토 고정 전체 원문</summary><pre>{JSON.stringify(shown.value.review,null,2)}</pre></details><p>보관 결과·검토·기준 참조 일치만 확인했습니다. 실제 증거 진위·현재 기준 효력·담당 권한·재작업 수행은 미확인입니다.</p></article>:null}
 </section>;
}
