import {useEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import type {PlanRef} from '../design-trace/work-plan-api.ts';
import {readContextKnowledgeOriginal} from './context-original.ts';
export function ContextKnowledgeOriginal({client,projectId,contextRef,assignmentRef,itemId,onClose,onFailure}:{client:ApiClient;projectId:string;contextRef:PlanRef;assignmentRef:PlanRef;itemId:string;onClose:()=>void;onFailure:(error:ApiError)=>void}){
 const [loaded,setLoaded]=useState<Awaited<ReturnType<typeof readContextKnowledgeOriginal>>>(null),[error,setError]=useState<string|null>(null);
 const failure=useRef(onFailure);failure.current=onFailure;
 useEffect(()=>{let active=true;setLoaded(null);setError(null);readContextKnowledgeOriginal(client,projectId,contextRef,assignmentRef,itemId,()=>active).then(v=>{if(active)setLoaded(v);}).catch(e=>{if(!active)return;const problem=e instanceof ApiError?e:new ApiError('CONTEXT_SOURCE_INVALID');setError(/^[A-Z_]{1,80}$/.test(problem.code)?problem.code:'CONTEXT_SOURCE_INVALID');if(problem.status===401)failure.current(problem);});return()=>{active=false;};},[client,projectId,contextRef,assignmentRef,itemId]);
 return <section aria-label="저장 맥락의 고정 지식 원문"><h6>선택했던 지식 원문</h6><button type="button" onClick={onClose}>맥락 지식 원문 닫기</button><p>읽기 전용 · 고정 선택 원문 대조이며 현재 적용·내용 적합·Agent 전달·실행 허가가 아닙니다.</p>{error?<p role="alert">{error} · 원문 미확인, 다른 버전으로 대체하지 않습니다.</p>:loaded?<><p>{loaded.title} · v{loaded.sourceRef.version} · {loaded.state}</p><code>{loaded.sourceRef.contentHash}</code><pre aria-label="맥락 지식 원문 본문">{loaded.body}</pre></>:<p role="status">저장 선택과 원문 대조 중</p>}</section>;
}
