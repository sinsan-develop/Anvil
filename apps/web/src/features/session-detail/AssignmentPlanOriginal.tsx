import {useLayoutEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import type {WorkPlanView} from '../design-trace/work-plan-api.ts';
import {WorkPlanTaskOriginal} from '../workspace/work-plan-task-original.ts';
import {readAssignmentPlanOriginal} from './assignment-plan-original.ts';
import type {SessionDetail} from './api.ts';
import {AssignmentDesignOriginal} from './AssignmentDesignOriginal.tsx';
export function AssignmentPlanOriginal({client,detail,onAuthenticationLost,traceSourceCurrent}:{client:ApiClient;detail:Pick<SessionDetail,'projectId'|'draft'|'confirmed'>;onAuthenticationLost:()=>void;traceSourceCurrent?:()=>boolean}){
 const binding=useRef({client,detail,transport:client.transport});
 if(binding.current.client!==client||binding.current.detail!==detail||binding.current.transport!==client.transport)binding.current={client,detail,transport:client.transport};
 const owner=binding.current,living=useRef(false),sequence=useRef(0);
 const latest=useRef<{owner:typeof owner;id:number}|null>(null);
 const [request,setRequest]=useState<typeof latest.current>(null);
 const [loaded,setLoaded]=useState<{request:NonNullable<typeof request>;value:WorkPlanView|null;error:ApiError|null}|null>(null);
 useLayoutEffect(()=>{living.current=true;return()=>{living.current=false;};},[]);
 const active=()=>living.current&&binding.current===owner&&client.transport===owner.transport&&(!traceSourceCurrent||traceSourceCurrent());
 const visible=request?.owner===owner?request:null,shown=loaded?.request===visible?loaded:null;
 const close=()=>{latest.current=null;setRequest(null);};
 async function open(){
  if(!active())return;
  const attempt={owner,id:++sequence.current};
  latest.current=attempt;setRequest(attempt);
  const current=()=>active()&&latest.current===attempt;
  try{
   const value=await readAssignmentPlanOriginal(client,detail,current);
   if(current())setLoaded({request:attempt,value,error:null});
  }catch(cause){
   if(!current())return;
   const error=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');
   setLoaded({request:attempt,value:null,error});
   if(error.status===401)onAuthenticationLost();
  }
 }
 return <section aria-label="고정 임무 계획 업무 원문" className="status-card"><h3>임무의 원 작업계획 업무</h3><p>임무 확정에 연결된 원초안의 카드 hash를 대조합니다. 현재 계획·선행 완료·실행 허가 확인은 아닙니다.</p>
  <button type="button" onClick={()=>void open()}>{visible?'고정 계획 업무 원문 다시 조회':'고정 계획 업무 원문 보기'}</button>
  {visible?<button type="button" onClick={close}>계획 업무 조회 닫기</button>:null}
  {visible&&!shown?<p role="status">고정 계획과 업무 원문 확인 중</p>:null}
  {shown?.error?<p role="alert">{shown.error.code} · 임무의 원 업무로 채택하지 않았습니다.</p>:null}
  {shown?.value?<><WorkPlanTaskOriginal plan={shown.value} taskCode={detail.draft.snapshot.basis.taskCode}/><AssignmentDesignOriginal key={shown.request.id} client={client} detail={detail} plan={traceSourceCurrent?shown.value:undefined} isPlanCurrent={()=>active()&&latest.current===shown.request} onAuthenticationLost={onAuthenticationLost}/></>:null}
 </section>;
}
