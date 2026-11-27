import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import type {DocumentSession} from '../design-trace/editor-api.ts';
import type {ImpactTargetRef} from './api.ts';
import type {PlanRef} from '../design-trace/work-plan-api.ts';
import {WorkPlanTaskOriginal} from '../workspace/work-plan-task-original.ts';
import {readImpactPlanTask,type ImpactPlanSelection} from './impact-plan-task-read.ts';
import {workspaceTaskHref} from '../../shell/routes.ts';

function Original({client,selection,current,onClose,onAuthenticationLost}:{client:ApiClient;selection:ImpactPlanSelection;current:()=>boolean;onClose:()=>void;onAuthenticationLost:()=>void}){
  const latest=useRef(current);latest.current=current;
  const [result,setResult]=useState<{value:Awaited<ReturnType<typeof readImpactPlanTask>>|null;error:ApiError|null}|null>(null);
  useEffect(()=>{
    let active=true;const check=()=>active&&latest.current();
    if(check())void readImpactPlanTask(client,selection,check).then(value=>{if(check())setResult({value,error:null});}).catch(cause=>{
      if(!check())return;
      const error=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');
      setResult({value:null,error});if(error.status===401)onAuthenticationLost();
    });
    return()=>{active=false;};
  },[client,selection]);
  const shown=current()?result:null,value=shown?.value;
  const eligible=value?.plan.relationalProjection==='STORED'&&value.plan.tasks.filter(task=>task.taskCode===value.taskCode).length===1;
  const guard=(event:{preventDefault:()=>void})=>{if(!latest.current())event.preventDefault();};
  return <section aria-label="영향 계획 업무 고정 원문"><button type="button" onClick={onClose}>영향 업무 원문 닫기</button><p className="meta">저장된 영향 이력의 고정 계획 업무 · 현재 업무 상태/완료·권한은 미확인 · 검토/확정·계획 개정·실행 없음</p>
    {shown?.error?<p role="alert">{shown.error.code} · 업무 원문을 채택하지 않았습니다. 현재 영향 구간을 다시 확인하세요.</p>:value?<><WorkPlanTaskOriginal plan={value.plan} taskCode={value.taskCode}/>{eligible?<><a href={workspaceTaskHref(selection.projectId,value.plan.ref,value.taskCode)} onClick={guard} onAuxClick={guard}>선택 업무로 임무 준비 화면 열기</a></>:null}</>:<p role="status">영향 업무 원문 확인 중</p>}
  </section>;
}

export function ImpactPlanTaskOriginal({client,projectId,session,changeRef,impactRef,beforeVersion,target,isCurrent,onAuthenticationLost}:{client:ApiClient;projectId:string;session:DocumentSession;changeRef:PlanRef;impactRef:PlanRef;beforeVersion:number|null;target:ImpactTargetRef;isCurrent?:()=>boolean;onAuthenticationLost:()=>void}){
  const context=JSON.stringify([projectId,session.user.id,session.clientId,session.csrfToken??null,changeRef,impactRef,beforeVersion,target,globalThis.location?.hash??null]);
  const owner=useRef({context,client,transport:client.transport,session});
  if(owner.current.context!==context||owner.current.client!==client||owner.current.transport!==client.transport||owner.current.session!==session)owner.current={context,client,transport:client.transport,session};
  const scope=owner.current,alive=useRef(true),external=useRef(isCurrent);external.current=isCurrent;
  const route=globalThis.location?.hash;
  const active=()=>alive.current&&owner.current===scope&&client.transport===scope.transport&&JSON.stringify([projectId,session.user.id,session.clientId,session.csrfToken??null,changeRef,impactRef,beforeVersion,target,globalThis.location?.hash??null])===context&&globalThis.location?.hash===route&&(!external.current||external.current());
  type Selection={owner:object;value:ImpactPlanSelection;nonce:number};
  const [selection,setSelection]=useState<Selection|null>(null),selected=useRef<Selection|null>(null),sequence=useRef(0);
  useLayoutEffect(()=>{alive.current=true;return()=>{alive.current=false;selected.current=null;};},[]);
  const current=selection?.owner===scope&&selected.current===selection&&active()?selection:null;
  function open(){
    if(!active())return;
    const next={owner:scope,nonce:++sequence.current,value:structuredClone({projectId,userId:session.user.id,clientId:session.clientId,changeRef,impactRef,beforeVersion,target})};
    selected.current=next;setSelection(next);
  }
  if(target.kind!=='PLAN_TASK')return null;
  return <><button type="button" aria-label={'영향 업무 '+target.localCode+' 고정 원문 보기'} onClick={open}>영향 업무 고정 원문 보기</button>{current?<Original key={current.nonce} client={client} selection={current.value} current={()=>active()&&selected.current===current} onClose={()=>{if(selected.current===current){selected.current=null;setSelection(null);}}} onAuthenticationLost={onAuthenticationLost}/>:null}</>;
}
