import {useEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import type {DocumentSession} from './editor-api.ts';
import {readWorkPlanAtVersion,type WorkPlanView} from './work-plan-api.ts';
import {StoredPlanTasks} from './StoredPlanTasks.tsx';
import {StoredPlanTaskRelations} from './StoredPlanTaskRelations.tsx';
import {WorkPlanVersionComparison} from './WorkPlanVersionComparison.ts';
import {PlanDocumentOriginal} from './PlanDocumentOriginal.tsx';
import {readWorkPlanDecision,type PlanDecisionView} from './work-plan-decision-api.ts';
type HistoryProps={client:ApiClient;projectId:string;session:DocumentSession;observedPlan:WorkPlanView;onAuthenticationLost:()=>void};
export function WorkPlanVersionHistory(props:HistoryProps){
 const [owner,setOwner]=useState({client:props.client,transport:props.client.transport,generation:0});
 if(owner.client!==props.client||owner.transport!==props.client.transport){setOwner({client:props.client,transport:props.client.transport,generation:owner.generation+1});return null;}
 return <History key={JSON.stringify([owner.generation,props.projectId,props.session.user.id,props.session.clientId,props.observedPlan.ref,props.observedPlan.documentRef])} {...props}/>;
}
function History({client,projectId,session,observedPlan,onAuthenticationLost}:HistoryProps){
 const observedRef=observedPlan.ref;
 const [version,setVersion]=useState(String(Math.max(1,observedRef.version-1))),[request,setRequest]=useState<{version:number}|null>(null);
 const [loaded,setLoaded]=useState<{request:typeof request;value:WorkPlanView|null;error:ApiError|null}|null>(null);
 const lost=useRef(onAuthenticationLost);lost.current=onAuthenticationLost;
 const requested=Number(version),valid=Number.isSafeInteger(requested)&&requested>=1&&requested<=observedRef.version,shown=loaded?.request===request?loaded:null;
 useEffect(()=>{
  if(!request)return;let active=true;const transport=client.transport,current=()=>active&&client.transport===transport;
  readWorkPlanAtVersion(client,projectId,observedRef,request.version,current).then(value=>{if(current())setLoaded({request,value,error:null});}).catch(cause=>{if(!current())return;const error=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');setLoaded({request,value:null,error});if(error.status===401)lost.current();});
  return()=>{active=false;};
 },[client,projectId,observedRef.id,observedRef.version,observedRef.contentHash,request]);
 const value=shown?.value;
 return <section aria-label="보관 작업계획 버전 조회" className="status-card"><h3>보관 작업계획 버전 조회</h3>
  <p>열어둔 기준 v{observedRef.version} 이하 · 최신/적용 상태 재확인 아님 · 원문 조회만 수행합니다.</p>
  <label>조회할 보관 계획 버전<input type="number" min="1" max={observedRef.version} value={version} onChange={e=>{setVersion(e.target.value);setRequest(null);}}/></label>
  <button type="button" disabled={!valid} onClick={()=>setRequest({version:requested})}>지정 보관 계획 버전 열기</button>
  {request?<button type="button" onClick={()=>setRequest(null)}>과거 계획 원문 닫기</button>:null}
  {request&&!shown?<p role="status">지정 보관 계획 원문 확인 중</p>:null}
  {shown?.error?<p role="alert">{shown.error.code} · 원문 미확인 · 앞선 결과로 대체하지 않습니다.</p>:null}
  {value?<section aria-label="조회한 보관 계획 버전"><h4>계획 v{value.ref.version}</h4><p>저장 당시 초안 · 별도 확정/현재 적용·실행은 미확인</p><p>{value.reason}</p><p className="meta">{value.ref.id} · SHA256 {value.ref.contentHash}</p>
   <HistoricalDecision key={'decision:'+JSON.stringify(value.ref)} client={client} projectId={projectId} plan={value} onAuthenticationLost={onAuthenticationLost}/>
   <WorkPlanVersionComparison before={value} after={observedPlan}/>
   <StoredPlanTasks key={JSON.stringify(value.ref)} tasks={value.tasks}/><StoredPlanTaskRelations key={'history:'+JSON.stringify(value.ref)} view={value}/>
   <PlanDocumentOriginal key={JSON.stringify([projectId,session.user.id,session.clientId,value.ref,value.documentRef])} client={client} projectId={projectId} session={session} view={value} onAuthenticationLost={onAuthenticationLost}/>
   <details><summary>원문·검토 참조와 저장된 구조 문제</summary><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify({documentRef:value.documentRef,designRef:value.designRef,screenReviewRefs:value.screenReviewRefs,issues:value.issues,relationalProjection:value.relationalProjection},null,2)}</pre></details>
  </section>:null}
 </section>;
}

const outcomeLabels={ACCEPTED:'적합',REWORK:'보완 필요',BLOCKED:'판단 보류',NOT_EXECUTED:'미검토'};
function HistoricalDecision({client,projectId,plan,onAuthenticationLost}:{client:ApiClient;projectId:string;plan:WorkPlanView;onAuthenticationLost:()=>void}){
 const [read,setRead]=useState<{token:object;transport:typeof client.transport;loading:boolean;value:PlanDecisionView|null;error:ApiError|null}|null>(null);
 const current=useRef<object|null>(null),alive=useRef(true),lost=useRef(onAuthenticationLost);lost.current=onAuthenticationLost;
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;current.current=null;};},[]);
 const shown=read?.token===current.current&&read.transport===client.transport?read:null;
 async function open(){
  if(shown?.loading)return;
  const token={},transport=client.transport,selected=structuredClone(plan);current.current=token;
  const active=()=>alive.current&&current.current===token&&client.transport===transport;
  setRead({token,transport,loading:true,value:null,error:null});
  try{const value=await readWorkPlanDecision(client,projectId,selected);if(active())setRead({token,transport,loading:false,value,error:null});}
  catch(cause){if(!active())return;const error=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');setRead({token,transport,loading:false,value:null,error});if(error.status===401)lost.current();}
 }
 const value=shown?.value;
 return <section aria-label="과거 계획 검토·확정 이력">
  <button type="button" disabled={!!shown?.loading} onClick={()=>void open()}>이 버전 검토·확정 이력 조회</button>
  {shown?<button type="button" onClick={()=>{current.current=null;setRead(null);}}>이 버전 검토·확정 이력 닫기</button>:null}
  {shown?.loading?<p role="status">이 버전 검토·확정 이력 확인 중</p>:null}
  {shown?.error?<p role="alert">{shown.error.message} · {shown.error.code} · 이력 미확인. 이 버전 이력 조회로 다시 확인하세요.</p>:null}
  {value?<>
   <p>조회 계획 v{value.planRef.version} · 최신 v{value.headVersion} · 현재 확정 버전 {value.confirmedVersion===null?'없음':value.confirmedVersion}</p>
   <p className="meta">{value.planRef.id} · SHA256 {value.planRef.contentHash} · 관측 <time dateTime={value.observedAt}>{value.observedAt}</time></p>
   <p>{value.confirmation?'과거 확정 이력 있음':'이 버전의 확정 이력 없음'} · {value.currentConfirmationValid?'현재 확정 유효':'현재 확정 유효하지 않음'}</p>
   <p className="meta">현재 적용·실행 허가를 뜻하지 않습니다. 조회만 수행하며 검토·확정 명령은 보내지 않습니다.</p>
   {value.confirmation?<details><summary>확정 당시 기록·검토 참조</summary><p>확정 ID {value.confirmation.id} · 확정자 {value.confirmation.confirmedBy.userId} · <time dateTime={value.confirmation.confirmedAt}>{value.confirmation.confirmedAt}</time></p><p>확정 대상 {value.confirmation.planRef.id} · v{value.confirmation.planRef.version} · {value.confirmation.planRef.contentHash}</p><ul>{value.confirmation.reviewRefs.map(ref=><li key={ref.id}>당시 검토 {ref.id} · 기준 v{ref.criteriaVersion} · {outcomeLabels[ref.outcome]} · 대상 v{ref.targetRef.version} · {ref.targetRef.contentHash}</li>)}</ul><p>당시 참조는 아래 현재 검토 목록과 별도로 보존됩니다.</p></details>:null}
   <h5>조회한 버전의 검토 기록</h5>
   {value.contentReviews.length?value.contentReviews.map(review=><details key={review.ref.id}><summary>{outcomeLabels[review.ref.outcome]} · {review.reason}</summary><p>검토 ID {review.ref.id} · 사람 {review.reviewer.userId} · 원문 작성자와 {review.reviewer.sameAsTargetRecorder?'같음':'다름'} · <time dateTime={review.reviewedAt}>{review.reviewedAt}</time></p><p>기준 v{review.criteria.criteriaVersion} · 감사 순번 {review.serverSequence}</p><ul>{review.items.map(item=><li key={item.criterionId}>{review.criteria.items.find(c=>c.criterionId===item.criterionId)?.title??item.criterionId} · {outcomeLabels[item.outcome]} · {item.reason} · 보관 근거 {item.evidenceRefs.length}개</li>)}</ul></details>):<p>이 버전의 내용 검토 이력이 없습니다.</p>}
   {value.validation.issues.length?<ul aria-label="조회 시점 준비 미충족">{value.validation.issues.map((issue,index)=><li key={index}>{issue.code} · {issue.location} · {issue.message}</li>)}</ul>:null}
  </>:null}
 </section>;
}
