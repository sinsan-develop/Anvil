import {useEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import type {DocumentSession} from './editor-api.ts';
import {readWorkPlanAtVersion,type WorkPlanView} from './work-plan-api.ts';
import {StoredPlanTasks} from './StoredPlanTasks.tsx';
import {StoredPlanTaskRelations} from './StoredPlanTaskRelations.tsx';
import {WorkPlanVersionComparison} from './WorkPlanVersionComparison.ts';
import {PlanDocumentOriginal} from './PlanDocumentOriginal.tsx';
type HistoryProps={client:ApiClient;projectId:string;session:DocumentSession;observedPlan:WorkPlanView;onAuthenticationLost:()=>void};
export function WorkPlanVersionHistory(props:HistoryProps){
 const [owner,setOwner]=useState({client:props.client,generation:0});
 if(owner.client!==props.client){setOwner({client:props.client,generation:owner.generation+1});return null;}
 return <History key={JSON.stringify([owner.generation,props.projectId,props.session.user.id,props.session.clientId,props.observedPlan.ref,props.observedPlan.documentRef])} {...props}/>;
}
function History({client,projectId,session,observedPlan,onAuthenticationLost}:HistoryProps){
 const observedRef=observedPlan.ref;
 const [version,setVersion]=useState(String(Math.max(1,observedRef.version-1))),[request,setRequest]=useState<{version:number}|null>(null);
 const [loaded,setLoaded]=useState<{request:typeof request;value:WorkPlanView|null;error:ApiError|null}|null>(null);
 const lost=useRef(onAuthenticationLost);lost.current=onAuthenticationLost;
 const requested=Number(version),valid=Number.isSafeInteger(requested)&&requested>=1&&requested<=observedRef.version,shown=loaded?.request===request?loaded:null;
 useEffect(()=>{
  if(!request)return;let active=true;
  readWorkPlanAtVersion(client,projectId,observedRef,request.version,()=>active).then(value=>{if(active)setLoaded({request,value,error:null});}).catch(cause=>{if(!active)return;const error=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');setLoaded({request,value:null,error});if(error.status===401)lost.current();});
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
   <WorkPlanVersionComparison before={value} after={observedPlan}/>
   <StoredPlanTasks key={JSON.stringify(value.ref)} tasks={value.tasks}/><StoredPlanTaskRelations key={'history:'+JSON.stringify(value.ref)} view={value}/>
   <PlanDocumentOriginal key={JSON.stringify([projectId,session.user.id,session.clientId,value.ref,value.documentRef])} client={client} projectId={projectId} session={session} view={value} onAuthenticationLost={onAuthenticationLost}/>
   <details><summary>원문·검토 참조와 저장된 구조 문제</summary><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify({documentRef:value.documentRef,designRef:value.designRef,screenReviewRefs:value.screenReviewRefs,issues:value.issues,relationalProjection:value.relationalProjection},null,2)}</pre></details>
  </section>:null}
 </section>;
}
