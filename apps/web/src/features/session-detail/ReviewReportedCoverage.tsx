import {useEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import type {SubmittedResultView} from './result-api.ts';
import type {RegisteredCriteria} from './result-criteria-api.ts';
import {readReportedCoverage} from './reported-coverage-api.ts';
import {reportedCompletionGap} from './reported-completion-gap.ts';

/** 부모가 명시 조회한 정확 검수 기준과 원결과만 대조한다. 판정·저장·실행은 없다. */
export function ReviewReportedCoverage({client,result,criteria,onAuthenticationLost,onAccessUnavailable}:{client:ApiClient;result:SubmittedResultView;criteria:RegisteredCriteria;onAuthenticationLost:()=>void;onAccessUnavailable:(code:string)=>void}){
 const [attempt,setAttempt]=useState(0),[loaded,setLoaded]=useState<{key:string;value:ReturnType<typeof reportedCompletionGap>|null;error:string|null}|null>(null),lost=useRef(onAuthenticationLost),unavailable=useRef(onAccessUnavailable);lost.current=onAuthenticationLost;unavailable.current=onAccessUnavailable;
 const key=JSON.stringify([result.ref,criteria.ref,attempt]),shown=loaded?.key===key?loaded:null;
 useEffect(()=>{if(!attempt)return;let active=true;readReportedCoverage(client,result,criteria,()=>active).then(value=>{if(active&&value)setLoaded({key,value:reportedCompletionGap(value),error:null});}).catch(cause=>{if(!active)return;const e=cause instanceof ApiError?cause:new ApiError('RESULT_COMPLETION_GAP_INVALID'),code=/^[A-Z_]{1,80}$/.test(e.code)?e.code:'RESULT_COVERAGE_RESPONSE_INVALID';setLoaded({key,value:null,error:code});if([401,403,404].includes(e.status))unavailable.current(code);if(e.status===401)lost.current();});return()=>{active=false;};},[client,result,criteria,key,attempt]);
 const value=shown?.value,gaps={NOT_REPORTED:'미보고',REPORTED_NOT_EXECUTED:'보고된 미실행',UNVERIFIED_EVIDENCE:'출처/실제 시험 미검증',DECLARATION_MISMATCH:'보고 결박 불일치'};
 return <section className="status-card" aria-label="검수 기준의 보고 부족 대조"><h6>선택 검수 기준과 제출 보고 대조</h6><p>이미 선택한 고정 기준만 사용합니다. 기준을 열어도 자동 조회하지 않으며 현재 기준 적용·검수 합격·실제 시험 인증이 아닙니다.</p><button type="button" disabled={attempt>0&&!shown} onClick={()=>{setLoaded(null);setAttempt(n=>n+1);}}>{attempt?'조건별 보고 부족 다시 대조':'조건별 보고 부족 대조'}</button>
  {attempt>0&&!shown?<p role="status">조건별 보고 대조 중 · 이전 결과 숨김</p>:null}{shown?.error?<p role="alert">{shown.error} · 부족 대조 미확인. 다른 기준이나 보고로 대체하지 않습니다.</p>:null}
  {value?<article aria-label="선택 검수 기준의 보고 부족"><p>제출 상태 {value.submissionState} · 수행자 보고이며 검수 합격·업무 완료가 아닙니다.</p><ul>{value.conditions.map(item=><li key={item.criterionId}>{item.criterionId} · {item.testId} · {item.requiredKind} · {gaps[item.gap]} · 보고 상태 {item.reportedStatus??'없음'}</li>)}</ul><p>미보고와 미실행을 구분하고 PASS 보고도 실제 증거 검증으로 승격하지 않습니다. 원조건·보관 검수와 함께 확인한 뒤 원 임무 상세에서 필요한 보완을 별도로 검토하세요.</p><p>공급자/OS·명령/exit·정확 commit·현재 환경은 미확인입니다. 이 대조는 문제 사건·검수·실패 집계·보완 저장/배정·실행을 하지 않습니다.</p><details><summary>고정 제출·기준과 미확인 항목</summary><pre>{JSON.stringify(value,null,2)}</pre></details></article>:null}
 </section>;
}
