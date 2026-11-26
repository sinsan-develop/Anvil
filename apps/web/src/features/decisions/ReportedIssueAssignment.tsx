import {useLayoutEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import {transferPreparationHref} from '../../shell/routes.ts';
import type {PlanRef} from '../design-trace/work-plan-api.ts';
import type {SubmittedResultView} from '../session-detail/result-api.ts';
import {readReportedIssueAssignment} from './reported-issue-assignment.ts';
import {ReportedIssueHistories} from './ReportedIssueHistories.ts';
import {ReportedIssueScope} from './ReportedIssueScope.ts';
import {AssignmentPlanOriginal} from '../session-detail/AssignmentPlanOriginal.tsx';
type Original=NonNullable<Awaited<ReturnType<typeof readReportedIssueAssignment>>>;
export function ReportedIssueAssignment({client,result,draftRef,isCurrent,onUnavailable,onAuthenticationLost}:{client:ApiClient;result:SubmittedResultView;draftRef:PlanRef;isCurrent:()=>boolean;onUnavailable:(code:string)=>void;onAuthenticationLost:()=>void}){
 const identity=JSON.stringify([result.snapshot.scope,result.ref,draftRef]);
 const context=useRef({identity,client,transport:client.transport});
 if(context.current.identity!==identity||context.current.client!==client||context.current.transport!==client.transport)context.current={identity,client,transport:client.transport};
 const owner=context.current,alive=useRef(false),revision=useRef(0),inflight=useRef<typeof owner|null>(null);
 const [read,setRead]=useState<{owner:typeof owner;ticket:number;value:Original|null;error:string|null}|null>(null);
 const unavailable=useRef(onUnavailable),lost=useRef(onAuthenticationLost);unavailable.current=onUnavailable;lost.current=onAuthenticationLost;
 useLayoutEffect(()=>{alive.current=true;return()=>{alive.current=false;revision.current++;};},[]);
 const current=()=>alive.current&&owner===context.current&&client.transport===owner.transport&&isCurrent();
 const shown=read?.owner===owner&&read.ticket===revision.current&&current()?read:null;
 const pending=!!shown&&!shown.value&&!shown.error;
 async function load(){
  if(!current()||inflight.current===owner)return;
  const ticket=++revision.current,active=()=>current()&&revision.current===ticket;
  inflight.current=owner;
  setRead({owner,ticket,value:null,error:null});
  try{const value=await readReportedIssueAssignment(client,result,draftRef,active);if(active()&&value)setRead({owner,ticket,value,error:null});}
  catch(cause){
   if(!active())return;
   const e=cause instanceof ApiError?cause:new ApiError('ISSUE_ASSIGNMENT_BINDING_INVALID'),code=/^[A-Z_]{1,80}$/.test(e.code)?e.code:'ISSUE_ASSIGNMENT_BINDING_INVALID';
   setRead({owner,ticket,value:null,error:code});
   if([401,403,404].includes(e.status))unavailable.current(code);
   if(e.status===401)lost.current();
  }
  finally{if(revision.current===ticket)inflight.current=null;}
 }
 const a=shown?.value?.assignment,d=a?.snapshot.definition;
 return <section className="status-card" aria-label="보고에 고정된 임무 조건"><h4>보고에 고정된 임무 조건</h4><p>당시 고정 원문입니다. 현재 적용 여부·실행 허가 미확인. 조건을 읽는 것만으로 원인 확정·완료 수락·재실행을 하지 않습니다.</p>
  <button type="button" disabled={pending} onClick={()=>void load()}>{shown?'고정 임무 조건 다시 조회':'고정 임무 조건 조회'}</button>
  {pending?<p role="status">고정 임무 대조 중 · 이전 조건 숨김</p>:null}{shown?.error?<p role="alert">{shown.error} · 다른 임무로 대체하지 않습니다.</p>:null}
  {a&&d?<article aria-label="고정 임무 완료·검증 조건"><p>임무 {a.ref.id} · v{a.ref.version} · SHA256 {a.ref.contentHash}</p><p>업무 {d.taskRef.taskCode} · 단계 {d.taskRef.nodeId}</p><h5>목적·목표</h5><p>{d.purpose}</p><p>{d.goal}</p><h5>완료 조건</h5>{d.acceptanceCriteria.length?<ul>{d.acceptanceCriteria.map((v,i)=><li key={i}>{v}</li>)}</ul>:<p>기록된 완료 조건 없음 · 완료 판단 불가</p>}<h5>검증 조건</h5>{d.verificationRequirements.length?<ul>{d.verificationRequirements.map((v,i)=><li key={i}>{v}</li>)}</ul>:<p>기록된 검증 조건 없음 · 검증 미확인</p>}</article>:null}
  {a&&d?<ReportedIssueScope definition={d}/>:null}
  {a&&shown?.value?<>
   <a href={transferPreparationHref(shown.value.detail.projectId,shown.value.detail.draft.ref)} onClick={event=>{if(!current()||revision.current!==shown.ticket)event.preventDefault();}}>해당 임무 인계 기록 보기</a>
   <AssignmentPlanOriginal key={'plan:'+shown.ticket} client={client} detail={shown.value.detail} onAuthenticationLost={onAuthenticationLost}/>
  </>:null}
  {a&&shown?<ReportedIssueHistories key={shown.ticket} client={client} result={result} assignment={a} onUnavailable={onUnavailable} onAuthenticationLost={onAuthenticationLost}/>:null}
 </section>;
}
