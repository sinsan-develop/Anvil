import {useEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import type {WorkPlanView} from '../design-trace/work-plan-api.ts';
import {WorkPlanTaskOriginal} from '../workspace/work-plan-task-original.ts';
import {readAssignmentPlanOriginal} from './assignment-plan-original.ts';
import type {SessionDetail} from './api.ts';
import {AssignmentDesignOriginal} from './AssignmentDesignOriginal.tsx';
export function AssignmentPlanOriginal({client,detail,onAuthenticationLost}:{client:ApiClient;detail:Pick<SessionDetail,'projectId'|'draft'|'confirmed'>;onAuthenticationLost:()=>void}){
 const [request,setRequest]=useState<object|null>(null),[loaded,setLoaded]=useState<{request:object;value:WorkPlanView|null;error:ApiError|null}|null>(null),lost=useRef(onAuthenticationLost);lost.current=onAuthenticationLost;
 const shown=loaded?.request===request?loaded:null;
 useEffect(()=>{
  if(!request)return;let active=true;
  readAssignmentPlanOriginal(client,detail,()=>active).then(value=>{if(active)setLoaded({request,value,error:null});}).catch(cause=>{if(!active)return;const error=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');setLoaded({request,value:null,error});if(error.status===401)lost.current();});
  return()=>{active=false;};
 },[client,detail,request]);
 return <section aria-label="고정 임무 계획 업무 원문" className="status-card"><h3>임무의 원 작업계획 업무</h3><p>임무 확정에 연결된 원초안의 카드 hash를 대조합니다. 현재 계획·선행 완료·실행 허가 확인은 아닙니다.</p>
  <button type="button" onClick={()=>setRequest({})}>{request?'고정 계획 업무 원문 다시 조회':'고정 계획 업무 원문 보기'}</button>
  {request?<button type="button" onClick={()=>setRequest(null)}>계획 업무 조회 닫기</button>:null}
  {request&&!shown?<p role="status">고정 계획과 업무 원문 확인 중</p>:null}
  {shown?.error?<p role="alert">{shown.error.code} · 임무의 원 업무로 채택하지 않았습니다.</p>:null}
  {shown?.value?<><WorkPlanTaskOriginal plan={shown.value} taskCode={detail.draft.snapshot.basis.taskCode}/><AssignmentDesignOriginal client={client} detail={detail} onAuthenticationLost={onAuthenticationLost}/></>:null}
 </section>;
}
