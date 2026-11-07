import {useEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import type {PlanRef} from '../design-trace/work-plan-api.ts';
import {readContextKnowledgeOriginal,readContextDocumentOriginal,readContextInstructionOriginal} from './context-original.ts';
import {KnowledgeScopeSummary} from '../knowledge/KnowledgeScopePicker.tsx';
export function ContextKnowledgeOriginal({client,projectId,contextRef,assignmentRef,itemId,onClose,onFailure,kind='KNOWLEDGE_VERSION'}:{client:ApiClient;projectId:string;contextRef:PlanRef;assignmentRef:PlanRef;itemId:string;onClose:()=>void;onFailure:(error:ApiError)=>void;kind?:'KNOWLEDGE_VERSION'|'DOCUMENT_VERSION'|'USER_INSTRUCTION'}){
 const [loaded,setLoaded]=useState<Awaited<ReturnType<typeof readContextKnowledgeOriginal>>>(null),[error,setError]=useState<string|null>(null);
 const label=kind==='KNOWLEDGE_VERSION'?'지식':kind==='DOCUMENT_VERSION'?'문서':'지시';
 const failure=useRef(onFailure);failure.current=onFailure;
 useEffect(()=>{let active=true;setLoaded(null);setError(null);(kind==='KNOWLEDGE_VERSION'?readContextKnowledgeOriginal:kind==='DOCUMENT_VERSION'?readContextDocumentOriginal:readContextInstructionOriginal)(client,projectId,contextRef,assignmentRef,itemId,()=>active).then(v=>{if(active)setLoaded(v);}).catch(e=>{if(!active)return;const problem=e instanceof ApiError?e:new ApiError('CONTEXT_SOURCE_INVALID');setError(/^[A-Z_]{1,80}$/.test(problem.code)?problem.code:'CONTEXT_SOURCE_INVALID');if(problem.status===401)failure.current(problem);});return()=>{active=false;};},[client,projectId,contextRef,assignmentRef,itemId,kind]);
 return <section aria-label={'저장 맥락의 고정 '+label+' 원문'}><h6>선택했던 {label} 원문</h6><button type="button" onClick={onClose}>맥락 {label} 원문 닫기</button><p>읽기 전용 · 고정 선택 원문 대조이며 현재 적용·내용 적합·Agent 전달·실행 허가가 아닙니다.</p>{error?<p role="alert">{error} · 원문 미확인, 다른 버전으로 대체하지 않습니다.</p>:loaded?<><p>{loaded.title} · {loaded.sourceRef.version===null?'불변 발언':'v'+loaded.sourceRef.version} · {loaded.state}</p><code>{loaded.sourceRef.contentHash}</code>{loaded.knowledgeScope?<KnowledgeScopeSummary scope={loaded.knowledgeScope} label="맥락 보관 지식 관련성"/>:null}<pre aria-label={'맥락 '+label+' 원문 본문'}>{loaded.body}</pre></>:<p role="status">저장 선택과 원문 대조 중</p>}</section>;
}
