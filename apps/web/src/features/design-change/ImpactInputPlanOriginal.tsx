import {useEffect,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import type {DocumentSession} from '../design-trace/editor-api.ts';
import type {PlanRef} from '../design-trace/work-plan-api.ts';
import {StoredPlanTasks} from '../design-trace/StoredPlanTasks.tsx';
import {readImpactInputPlan,type ImpactInputPlanSelection} from './impact-input-plan-read.ts';
const reference=(r:PlanRef)=>`${r.id} · v${r.version} · ${r.contentHash}`;
function Original({client,selection,onClose,onAuthenticationLost}:{client:ApiClient;selection:ImpactInputPlanSelection;onClose:()=>void;onAuthenticationLost:()=>void}){
 const [result,setResult]=useState<{client:ApiClient;selection:ImpactInputPlanSelection;value:Awaited<ReturnType<typeof readImpactInputPlan>>|null;error:ApiError|null}|null>(null);
 useEffect(()=>{let active=true;readImpactInputPlan(client,selection,()=>active).then(value=>{if(active)setResult({client,selection,value,error:null});}).catch(cause=>{if(!active)return;const error=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');setResult({client,selection,value:null,error});if(error.status===401)onAuthenticationLost();});return()=>{active=false;};},[client,selection]);
 const current=result?.client===client&&result.selection===selection?result:null,plan=current?.value;
 return <section aria-label="영향 계산 입력 계획 고정 내용"><button type="button" onClick={onClose}>입력 계획 내용 닫기</button>
  <p className="meta">저장된 영향 계산의 입력 정의입니다. 초안 기록이며 현재 확정·적용·완료·권한/실행 상태를 뜻하지 않습니다. 입력/계획 개정·승인·실행은 하지 않습니다.</p>
  {current?.error?<p role="alert">{current.error.code} · 입력 계획을 표시하지 않습니다. 영향 구간을 다시 확인하세요.</p>:plan?<><p>고정 계획 {reference(plan.ref)}</p><p>문서 {reference(plan.documentRef)}</p><p>근거 설계 {reference(plan.designRef)}</p><pre>{plan.reason}</pre><p>관계 투영 {plan.relationalProjection} · 실행 근거 미연결 · 관측 {plan.observedAt}</p>
   <p>저장된 검사 문제 {plan.issues.length}건 · 처음 50건까지만 표시합니다.</p><ul>{plan.issues.slice(0,50).map((issue,n)=><li key={n}>{issue.code} · {issue.location} · {issue.message}</li>)}</ul>
   <StoredPlanTasks tasks={plan.tasks}/>
  </>:<p role="status">입력 계획 확인 중</p>}
 </section>;
}
export function ImpactInputPlanOriginal({client,projectId,session,changeRef,impactRef,beforeVersion,planRef,onAuthenticationLost}:{client:ApiClient;projectId:string;session:DocumentSession;changeRef:PlanRef;impactRef:PlanRef;beforeVersion:number|null;planRef:PlanRef;onAuthenticationLost:()=>void}){
 const context=JSON.stringify([projectId,session.user.id,session.clientId,changeRef,impactRef,beforeVersion,planRef]);
 const [selection,setSelection]=useState<{client:ApiClient;context:string;value:ImpactInputPlanSelection;nonce:number}|null>(null);
 const current=selection?.client===client&&selection.context===context?selection:null;
 return <><button type="button" aria-label={'입력 계획 '+planRef.id+' v'+planRef.version+' 고정 내용 보기'} onClick={()=>setSelection(old=>({client,context,nonce:(old?.nonce??0)+1,value:structuredClone({projectId,userId:session.user.id,clientId:session.clientId,changeRef,impactRef,beforeVersion,planRef})}))}>입력 계획 고정 내용 보기</button>{current?<Original key={current.nonce} client={client} selection={current.value} onClose={()=>setSelection(null)} onAuthenticationLost={onAuthenticationLost}/>:null}</>;
}
