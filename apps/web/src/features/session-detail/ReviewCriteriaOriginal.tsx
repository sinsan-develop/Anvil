import {useEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import type {ConfirmedAssignmentView} from '../workspace/assignment-confirmation-api.ts';
import type {RecordedResultReview} from './result-review-write-api.ts';
import type {RegisteredCriteria} from './result-criteria-api.ts';
import {readReviewCriteriaOriginal} from './review-criteria-original.ts';

/** 보관 판정에서 고정 원조건으로 이동하는 읽기 전용 소비자. 현재 합격·실제 시험 판정은 하지 않는다. */
export function ReviewCriteriaOriginal({client,assignment,review,onAuthenticationLost,onAccessUnavailable}:{client:ApiClient;assignment:ConfirmedAssignmentView;review:RecordedResultReview;onAuthenticationLost:()=>void;onAccessUnavailable:(code:string)=>void}){
 const [open,setOpen]=useState(false),[attempt,setAttempt]=useState(0),[loaded,setLoaded]=useState<{attempt:number;value:RegisteredCriteria|null;error:string|null}|null>(null),epoch=useRef(0),lost=useRef(onAuthenticationLost),unavailable=useRef(onAccessUnavailable);lost.current=onAuthenticationLost;unavailable.current=onAccessUnavailable;
 const shown=open&&loaded?.attempt===attempt?loaded:null;
 useEffect(()=>{if(!open)return;let active=true;const generation=epoch.current,valid=()=>active&&epoch.current===generation;
  readReviewCriteriaOriginal(client,assignment,review.snapshot.input.criteriaRef,valid).then(value=>{if(valid()&&value)setLoaded({attempt,value,error:null});}).catch(cause=>{if(!valid())return;const e=cause instanceof ApiError?cause:new ApiError('RESULT_CRITERIA_RESPONSE_INVALID'),code=/^[A-Z_]{1,80}$/.test(e.code)?e.code:'RESULT_CRITERIA_RESPONSE_INVALID';setLoaded({attempt,value:null,error:code});if([401,403,404].includes(e.status))unavailable.current(code);if(e.status===401)lost.current();});
  return()=>{active=false;};
 },[client,assignment,review,attempt,open]);
 return <section className="status-card" aria-label="검수에 사용한 기준 원문"><h6>이 검수에 사용한 기준·원조건</h6>
  <button type="button" onClick={()=>{epoch.current++;setLoaded(null);setAttempt(v=>v+1);setOpen(v=>!v);}}>{open?'검수 기준·원조건 닫기':'검수 기준·원조건 열기'}</button>
  <p>고정 참조만 조회합니다. 최근20개 목록 밖 기준은 미확인으로 남기며 최신 기준으로 대체하지 않습니다.</p>
  {open&&!shown?<p role="status">정확한 기준·원조건 대조 중</p>:null}{shown?.error?<p role="alert">{shown.error} · 기준 원문 미확인</p>:null}
  {shown?.value?<article aria-label="검수의 고정 기준·원조건"><p>{shown.value.ref.id} · v{shown.value.ref.version} · {shown.value.ref.contentHash}</p><p>{shown.value.input.reason}</p>
   <ul>{shown.value.input.items.map(i=>{const decision=review.snapshot.input.items.find(d=>d.criterionId===i.criterionId);return <li key={i.criterionId}><p>{i.criterionId} · {i.testId} · {i.kind}</p>
    <ul>{i.sources.map(s=><li key={s.field+':'+s.index}>{s.field==='acceptanceCriteria'?'완료 조건':'검증 조건'} {s.index+1}: {assignment.snapshot.definition[s.field][s.index]}</li>)}</ul>
    <p>보관 판정: {decision?decision.outcome==='REWORK'?'보완 필요':'차단':'해당 조건 기록 없음 · 미확인'}</p>{decision?<p>{decision.reason}</p>:null}</li>;})}</ul>
   <p>원조건 연결과 보관 판정을 조회한 것입니다. 현재 기준 적용·실제 시험·업무 완료·실행 허가를 확인하지 않습니다.</p><details><summary>기준·원조건 hash·환경 전체</summary><pre>{JSON.stringify(shown.value,null,2)}</pre></details>
  </article>:null}
 </section>;
}
