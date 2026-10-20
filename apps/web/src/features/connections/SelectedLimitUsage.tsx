import {useEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import {readStoredBudgetUsage,type BudgetUsageView} from '../session-detail/budget-usage-api.ts';
import type {Ref} from './api.ts';
interface Props{client:ApiClient;projectId:string;reference:Ref;onAuthenticationLost:()=>void}
/** 선택한 고정 정책의 보관 원장만 명시 조회한다. 현재 권한/실과금·Agent 실행 판정이나 쓰기는 없다. */
export function SelectedLimitUsage({client,projectId,reference,onAuthenticationLost}:Props){
 const[value,setValue]=useState<BudgetUsageView|null>(null),[error,setError]=useState<string|null>(null),[busy,setBusy]=useState(false),[attempt,setAttempt]=useState(false);
 const alive=useRef(true),sequence=useRef(0),locked=useRef(false),lost=useRef(onAuthenticationLost);lost.current=onAuthenticationLost;
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;sequence.current++;};},[]);
 async function load(){
  if(locked.current)return;locked.current=true;const selected=++sequence.current,active=()=>alive.current&&sequence.current===selected;setValue(null);setError(null);setBusy(true);setAttempt(true);
  try{const result=await readStoredBudgetUsage(client,projectId,reference,active);if(active()&&result)setValue(result);}
  catch(cause){if(active()){const e=cause instanceof ApiError?cause:new ApiError('BUDGET_USAGE_RESPONSE_INVALID');setError(/^[A-Z_]{1,80}$/.test(e.code)?e.code:'BUDGET_USAGE_RESPONSE_INVALID');if(e.status===401)lost.current();}}
  finally{locked.current=false;if(active())setBusy(false);}
 }
 return <section aria-label="선택 한도 사용량"><h4>선택 한도 · 보관 사용량</h4><p>프로젝트 전체 정책 누적 · 현재 정책·실제 공급자 과금 미검증</p>
  <button type="button" disabled={busy} onClick={()=>void load()}>{attempt?'보관 사용량 다시 조회':'보관 사용량 조회'}</button>
  {busy?<p role="status">보관 사용량 조회 중 · 이전 값 숨김</p>:null}{error?<p role="alert">{error} · 사용량 미확인</p>:null}
  {value?<><p>조회 시각: <time dateTime={value.observedAt}>{value.observedAt}</time> · 보관 원장 {value.ledgerRowCount}행</p><p>정산 호출: {value.summary.used.calls} · 예약 호출: {value.summary.reserved.calls}</p><p>미확인 예약: {value.summary.unknownReservations}</p><p>원장상 진행/미확인 실행: {value.summary.liveExecutions} · 실제 가동 관측 아님</p><p>선택 정책 보관 상태: {value.policy.snapshot.state} · {value.summary.policyIssues.join(', ')||'조회시각의 만료/회수 표식 없음 · 현재 적용 인증 아님'}</p><details><summary>정산·예약·비용 보관 원문</summary><pre>{JSON.stringify({selectedPolicy:value.policy.ref,used:value.summary.used,reserved:value.summary.reserved,ledgerLastRef:value.ledgerLastRef},null,2)}</pre></details><p>비용 항목 없음과 미확인은 0원으로 환산하지 않습니다. 새 호출 허가·실제 과금 확인·누적 초기화가 아닙니다.</p></>:null}
 </section>;
}
