import {useEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import type {PlanRef} from '../design-trace/work-plan-api.ts';
import type {SubmittedResultView} from '../session-detail/result-api.ts';
import {readReportedIssueAssignment} from './reported-issue-assignment.ts';
import {ReportedIssueReviewHistory} from './ReportedIssueReviewHistory.tsx';
type Original=NonNullable<Awaited<ReturnType<typeof readReportedIssueAssignment>>>;
export function ReportedIssueAssignment({client,result,draftRef,onUnavailable,onAuthenticationLost}:{client:ApiClient;result:SubmittedResultView;draftRef:PlanRef;onUnavailable:(code:string)=>void;onAuthenticationLost:()=>void}){
 const[attempt,setAttempt]=useState(0),[loaded,setLoaded]=useState<{key:string;value:Original|null;error:string|null}|null>(null),unavailable=useRef(onUnavailable),lost=useRef(onAuthenticationLost);unavailable.current=onUnavailable;lost.current=onAuthenticationLost;
 const key=JSON.stringify([result.ref,draftRef,attempt]),shown=loaded?.key===key?loaded:null;
 useEffect(()=>{if(!attempt)return;let active=true;
  readReportedIssueAssignment(client,result,draftRef,()=>active).then(value=>{if(active&&value)setLoaded({key,value,error:null});}).catch(cause=>{if(!active)return;const e=cause instanceof ApiError?cause:new ApiError('ISSUE_ASSIGNMENT_BINDING_INVALID'),code=/^[A-Z_]{1,80}$/.test(e.code)?e.code:'ISSUE_ASSIGNMENT_BINDING_INVALID';setLoaded({key,value:null,error:code});if([401,403,404].includes(e.status))unavailable.current(code);if(e.status===401)lost.current();});return()=>{active=false;};
 },[client,result,draftRef,key,attempt]);
 const a=shown?.value?.assignment,d=a?.snapshot.definition;
 return <section className="status-card" aria-label="보고에 고정된 임무 조건"><h4>보고에 고정된 임무 조건</h4><p>당시 고정 원문입니다. 현재 적용 여부·실행 허가 미확인. 조건을 읽는 것만으로 원인 확정·완료 수락·재실행을 하지 않습니다.</p>
  <button type="button" disabled={attempt>0&&!shown} onClick={()=>{setLoaded(null);setAttempt(v=>v+1);}}>{attempt?'고정 임무 조건 다시 조회':'고정 임무 조건 조회'}</button>
  {attempt>0&&!shown?<p role="status">고정 임무 대조 중 · 이전 조건 숨김</p>:null}{shown?.error?<p role="alert">{shown.error} · 다른 임무로 대체하지 않습니다.</p>:null}
  {a&&d?<article aria-label="고정 임무 완료·검증 조건"><p>임무 {a.ref.id} · v{a.ref.version} · SHA256 {a.ref.contentHash}</p><p>업무 {d.taskRef.taskCode} · 단계 {d.taskRef.nodeId}</p><h5>목적·목표</h5><p>{d.purpose}</p><p>{d.goal}</p><h5>완료 조건</h5>{d.acceptanceCriteria.length?<ul>{d.acceptanceCriteria.map((v,i)=><li key={i}>{v}</li>)}</ul>:<p>기록된 완료 조건 없음 · 완료 판단 불가</p>}<h5>검증 조건</h5>{d.verificationRequirements.length?<ul>{d.verificationRequirements.map((v,i)=><li key={i}>{v}</li>)}</ul>:<p>기록된 검증 조건 없음 · 검증 미확인</p>}</article>:null}
  {a?<ReportedIssueReviewHistory key={key} client={client} result={result} assignment={a} onUnavailable={onUnavailable} onAuthenticationLost={onAuthenticationLost}/>:null}
 </section>;
}
