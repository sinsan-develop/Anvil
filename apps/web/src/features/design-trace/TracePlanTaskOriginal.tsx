import {useEffect,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import type {TraceRef} from './trace-api.ts';
import type {DesignAnchorContext,DesignAnchorSelection} from './design-anchor.ts';
import {traceAnchorSelection} from './trace-anchor-selection.ts';
import {readTracePlanTask,type TracePlanTaskView} from './trace-plan-task-api.ts';
import {StoredPlanTaskList} from './StoredPlanTasks.tsx';
export function TracePlanTaskOriginal({client,projectId,target,context,onClose,onAnchorSelect,onUnavailable}:{client:ApiClient;projectId:string;target:TraceRef;context:DesignAnchorContext|null;onClose:()=>void;onAnchorSelect?:(selection:DesignAnchorSelection|null)=>void;onUnavailable:(error:ApiError)=>void}){
 const [value,setValue]=useState<TracePlanTaskView|null>(null),[error,setError]=useState<ApiError|null>(null);
 const {id,version,contentHash}=target.versionRef,code=target.localCode;
 useEffect(()=>{let active=true;readTracePlanTask(client,projectId,target,()=>active).then(v=>{if(active&&v)setValue(v);}).catch(cause=>{if(!active)return;const e=cause instanceof ApiError?cause:new ApiError('TRACE_PLAN_TASK_UNVERIFIED');setValue(null);setError(e);if([401,403,404].includes(e.status))onUnavailable(e);});return()=>{active=false;};},[client,projectId,id,version,contentHash,code]);
 return <section className="status-card" aria-label="연결 계획 업무 원문"><h4>{code} 연결 계획 업무 원문</h4><button onClick={onClose}>계획 업무 원문 닫기</button><p className="meta">고정 계획 v{version} · 현재 실행·완료·시험 합격은 미확인 · 편집·명령 전송 없음</p><p className="meta">계획 {id} · SHA256 {contentHash}</p>
 {error?<p role="alert">{error.code} · 계획 업무 원문으로 채택하지 않았습니다.</p>:value?<><p className="meta">문서 {value.documentRef.id} v{value.documentRef.version} · SHA256 {value.documentRef.contentHash}</p><StoredPlanTaskList tasks={[value.task]}/><h4>원문 참조</h4><ul>{[...value.task.designRefs,...value.task.screenRefs].map((r,index)=>{const selection=context?traceAnchorSelection(context,r):null;return <li key={index}>{r.localCode} · {r.kind} · v{r.versionRef.version} · {r.anchor}<p className="meta">{r.versionRef.id} · SHA256 {r.versionRef.contentHash}</p>{selection&&onAnchorSelect?<button onClick={()=>onAnchorSelect(selection)}>{r.localCode} 원 설계 위치 보기</button>:<p>현재 본문과 다른 원문 참조 · 자동 이동하지 않음</p>}</li>;})}</ul></>:<p role="status">고정 계획 업무 원문 확인 중</p>}
 </section>;
}
