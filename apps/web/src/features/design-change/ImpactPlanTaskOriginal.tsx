import {useEffect,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import type {DocumentSession} from '../design-trace/editor-api.ts';
import type {ImpactTargetRef} from './api.ts';
import type {PlanRef} from '../design-trace/work-plan-api.ts';
import {WorkPlanTaskOriginal} from '../workspace/work-plan-task-original.ts';
import {readImpactPlanTask,type ImpactPlanSelection} from './impact-plan-task-read.ts';

function Original({client,selection,onClose,onAuthenticationLost}:{client:ApiClient;selection:ImpactPlanSelection;onClose:()=>void;onAuthenticationLost:()=>void}){
  const [result,setResult]=useState<{client:ApiClient;selection:ImpactPlanSelection;value:Awaited<ReturnType<typeof readImpactPlanTask>>|null;error:ApiError|null}|null>(null);
  useEffect(()=>{let active=true;readImpactPlanTask(client,selection,()=>active).then(value=>{if(active)setResult({client,selection,value,error:null});}).catch(cause=>{if(!active)return;const error=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');setResult({client,selection,value:null,error});if(error.status===401)onAuthenticationLost();});return()=>{active=false;};},[client,selection]);
  const current=result?.client===client&&result.selection===selection?result:null;
  return <section aria-label="영향 계획 업무 고정 원문"><button type="button" onClick={onClose}>영향 업무 원문 닫기</button><p className="meta">저장된 영향 이력의 고정 계획 업무 · 현재 업무 상태/완료·권한은 미확인 · 검토/확정·계획 개정·실행 없음</p>
    {current?.error?<p role="alert">{current.error.code} · 업무 원문을 채택하지 않았습니다. 현재 영향 구간을 다시 확인하세요.</p>:current?.value?<WorkPlanTaskOriginal plan={current.value.plan} taskCode={current.value.taskCode}/>:<p role="status">영향 업무 원문 확인 중</p>}
  </section>;
}

export function ImpactPlanTaskOriginal({client,projectId,session,changeRef,impactRef,beforeVersion,target,onAuthenticationLost}:{client:ApiClient;projectId:string;session:DocumentSession;changeRef:PlanRef;impactRef:PlanRef;beforeVersion:number|null;target:ImpactTargetRef;onAuthenticationLost:()=>void}){
  const context=JSON.stringify([projectId,session.user.id,session.clientId,changeRef,impactRef,beforeVersion,target]);
  const [selection,setSelection]=useState<{client:ApiClient;context:string;value:ImpactPlanSelection;nonce:number}|null>(null);
  const current=selection?.client===client&&selection.context===context?selection:null;
  if(target.kind!=='PLAN_TASK')return null;
  return <><button type="button" aria-label={'영향 업무 '+target.localCode+' 고정 원문 보기'} onClick={()=>setSelection(old=>({client,context,nonce:(old?.nonce??0)+1,value:structuredClone({projectId,userId:session.user.id,clientId:session.clientId,changeRef,impactRef,beforeVersion,target})}))}>영향 업무 고정 원문 보기</button>{current?<Original key={current.nonce} client={client} selection={current.value} onClose={()=>setSelection(null)} onAuthenticationLost={onAuthenticationLost}/>:null}</>;
}
