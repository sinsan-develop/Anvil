import {useEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import type {SubmittedResultView} from '../session-detail/result-api.ts';
import {readStoredIssueBasis,type StoredIssueBasis} from './issue-basis-api.ts';
/** 부모는 현재 사용자/client·정확 보고/선택/조회세대로 이 패널을 분리한다. */
export function IssueBasisPanel({client,result,onUnavailable,onAuthenticationLost}:{client:ApiClient;result:SubmittedResultView;onUnavailable:(code:string)=>void;onAuthenticationLost:()=>void}){
 const[attempt,setAttempt]=useState(0),[loaded,setLoaded]=useState<{key:string;value:StoredIssueBasis|null;error:string|null}|null>(null),unavailable=useRef(onUnavailable),lost=useRef(onAuthenticationLost);unavailable.current=onUnavailable;lost.current=onAuthenticationLost;
 const key=JSON.stringify([result.ref,attempt]),shown=loaded?.key===key?loaded:null;
 useEffect(()=>{if(!attempt)return;let active=true;readStoredIssueBasis(client,result,()=>active).then(value=>{if(active&&value)setLoaded({key,value,error:null});}).catch(cause=>{if(!active)return;const e=cause instanceof ApiError?cause:new ApiError('STORED_ISSUE_BASIS_RESPONSE_INVALID'),code=/^[A-Z_]{1,80}$/.test(e.code)?e.code:'STORED_ISSUE_BASIS_RESPONSE_INVALID';setLoaded({key,value:null,error:code});if([401,403,404].includes(e.status))unavailable.current(code);if(e.status===401)lost.current();});return()=>{active=false;};},[client,result,key,attempt]);
 const v=shown?.value;
 return <section className="status-card" aria-label="보관 원장 문제 근거"><h4>문제 근거 · 보관 범위</h4><p>서버가 검증한 저장 원장·ACK 범위만 대조합니다. 수행자 주장을 실제 오류·거부·쿼터/대기 원인으로 바꾸지 않습니다.</p><button type="button" disabled={attempt>0&&!shown} onClick={()=>{setLoaded(null);setAttempt(n=>n+1);}}>{attempt?'문제 근거 다시 조회':'문제 근거 조회'}</button>
  {attempt>0&&!shown?<p role="status">문제 근거 대조 중 · 이전 근거 숨김</p>:null}{shown?.error?<p role="alert">{shown.error} · 문제 근거 미확인. 다른 보고나 원장으로 대체하지 않습니다.</p>:null}
  {v?<article aria-label="선택 보고의 저장 원장 근거"><h5>현재 중단 원인 미확인</h5>{v.observationGaps.length?<><p>저장 원장 미수신 구간 · 실제 OS 실행 공백이나 직접 원인 판정 아님</p><ul>{v.observationGaps.map(g=><li key={g.from}>{g.from}~{g.to} · ACK {g.evidenceRef.id} v{g.evidenceRef.version} · SHA256 {g.evidenceRef.contentHash}</li>)}</ul></>:<p>{v.ack===null?'보관 ACK 없음 · 로컬 전송 완료/미수행을 판단하지 않습니다.':'보관 ACK 범위의 공백 없음 · 현재 정상 가동이나 관측 완전성을 뜻하지 않습니다.'}</p>}<p>실제 Agent/OS·현재 권한·업무 완료를 확인하지 않았습니다.</p><p>저장 원장 조회 {v.journalObservedAt} · 서버 대조 {v.asOf} · 이후 변경/현재성 인증 아님</p><p>직접 원인은 근거를 더 확인해야 합니다. 이 조회는 검수 저장·실패 집계·재시도·Agent 교체·중지·writer 해제/실행을 하지 않습니다.</p><details><summary>정확 보고·실행·ACK와 미확인 근거 전체</summary><pre>{JSON.stringify(v,null,2)}</pre></details></article>:null}
 </section>;
}
