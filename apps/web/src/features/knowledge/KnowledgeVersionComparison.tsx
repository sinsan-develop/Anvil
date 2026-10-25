import {useEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import type {KnowledgeView} from './api.ts';
import type {DocumentSession} from '../design-trace/editor-api.ts';
import {KnowledgeDocumentSources} from './KnowledgeDocumentSources.tsx';
import {readKnowledgeVersionComparison,type StoredKnowledgeComparison} from './knowledge-version-comparison.ts';
import {KnowledgeCorrectionDiff} from './KnowledgeCorrectionDiff.tsx';
import {KnowledgeScopeSummary} from './KnowledgeScopePicker.tsx';
import {KnowledgeScopeOriginals} from './KnowledgeScopeOriginals.tsx';
type ComparisonProps={client:ApiClient;projectId:string;session:DocumentSession;view:KnowledgeView;onAuthenticationLost:()=>void};
export function KnowledgeVersionComparison(props:ComparisonProps){
 const [owner,setOwner]=useState({client:props.client,view:props.view,generation:0});
 if(owner.client!==props.client||owner.view!==props.view){setOwner({client:props.client,view:props.view,generation:owner.generation+1});return null;}
 return <Comparison key={JSON.stringify([owner.generation,props.projectId,props.session.user.id,props.session.clientId,props.view.ref,props.view.supersedesRef])} {...props}/>;
}
function Comparison({client,projectId,session,view,onAuthenticationLost}:ComparisonProps){
 const [attempt,setAttempt]=useState(0),[loaded,setLoaded]=useState<{key:string;client:ApiClient;view:KnowledgeView;value:StoredKnowledgeComparison|null;error:string|null}|null>(null),lost=useRef(onAuthenticationLost);lost.current=onAuthenticationLost;
 const key=JSON.stringify([projectId,view.ref,view.supersedesRef,attempt]),shown=attempt>0&&loaded?.key===key&&loaded.client===client&&loaded.view===view?loaded:null;
 useEffect(()=>{if(!attempt)return;let active=true;readKnowledgeVersionComparison(client,projectId,view,()=>active).then(value=>{if(active&&value)setLoaded({key,client,view,value,error:null});}).catch(cause=>{if(!active)return;const error=cause instanceof ApiError?cause:new ApiError('KNOWLEDGE_VERSION_COMPARISON_INVALID');setLoaded({key,client,view,value:null,error:/^[A-Z_]{1,80}$/.test(error.code)?error.code:'KNOWLEDGE_VERSION_COMPARISON_INVALID'});if(error.status===401)lost.current();});return()=>{active=false;};},[client,projectId,view,key,attempt]);
 if(!view.supersedesRef)return null;
 const value=shown?.value,fields=(v:KnowledgeView)=>({title:v.entry.title,body:v.body,reason:v.entry.reason});
 return <div><button type="button" disabled={attempt>0&&!shown} onClick={()=>{setLoaded(null);setAttempt(n=>n+1);}}>{attempt?'보관 버전 비교 다시 조회':'앞 버전과 보관 원문 비교'}</button>{attempt>0?<section className="status-card" aria-label="보관 지식 버전 비교"><h4>보관 정정 전후 원문</h4><button type="button" onClick={()=>{setAttempt(0);setLoaded(null);}}>보관 버전 비교 닫기</button><p>원문 이력 비교이며 현재 확정·헌법 적용·내용 진위·Agent 전달을 판정하지 않습니다.</p>{!shown?<p role="status">정확 앞 버전 확인 중 · 이전 비교 숨김</p>:null}{shown?.error?<p role="alert">{shown.error} · 앞 버전 비교 미확인. 변경없음으로 처리하지 않습니다.</p>:null}{value?<><p>앞 버전 {value.before.ref.id} · v{value.before.ref.version} · {value.before.ref.contentHash}</p><p>선택 버전 {value.after.ref.id} · v{value.after.ref.version} · {value.after.ref.contentHash}</p><p>정정 기록 이유: {value.after.history[0]!.reason}</p><KnowledgeCorrectionDiff base={fields(value.before)} current={fields(value.after)} version={value.before.ref.version} storedVersion={value.after.ref.version}/>
  <section aria-label="앞 보관 버전의 고정 관련성"><KnowledgeScopeSummary scope={value.before.entry.scope} label="앞 보관 버전의 관련성 요약"/><KnowledgeScopeOriginals key={JSON.stringify([session.user.id,session.clientId,projectId,value.before.ref])} client={client} projectId={projectId} view={value.before} onAuthenticationLost={onAuthenticationLost}/></section>
  <section aria-label="선택 보관 버전의 고정 관련성"><KnowledgeScopeSummary scope={value.after.entry.scope} label="선택 보관 버전의 관련성 요약"/><KnowledgeScopeOriginals key={JSON.stringify([session.user.id,session.clientId,projectId,value.after.ref])} client={client} projectId={projectId} view={value.after} onAuthenticationLost={onAuthenticationLost}/></section>
  <section aria-label="앞 보관 버전의 고정 출처"><KnowledgeDocumentSources key={JSON.stringify([session.user.id,session.clientId,projectId,value.before.ref])} client={client} projectId={projectId} session={session} view={value.before} onAuthenticationLost={onAuthenticationLost}/></section><section aria-label="선택 보관 버전의 고정 출처"><KnowledgeDocumentSources key={JSON.stringify([session.user.id,session.clientId,projectId,value.after.ref])} client={client} projectId={projectId} session={session} view={value.after} onAuthenticationLost={onAuthenticationLost}/></section><details><summary>비교한 두 보관 원문</summary><pre>{value.before.body}</pre><pre>{value.after.body}</pre></details></>:null}</section>:null}</div>;
}
