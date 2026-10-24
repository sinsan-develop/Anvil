import {useEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import type {KnowledgeView} from './api.ts';
import {readKnowledgeScopeOriginal,type KnowledgeScopeSource} from './knowledge-scope-original.ts';
function Lines({title,items}:{title:string;items:string[]}){return <div><strong>{title}</strong>{items.length?<ul>{items.map((s,i)=><li key={i}>{s}</li>)}</ul>:<p>등록 없음</p>}</div>;}
export function KnowledgeScopeOriginals({client,projectId,view,onAuthenticationLost}:{client:ApiClient;projectId:string;view:KnowledgeView;onAuthenticationLost:()=>void}){
 const alive=useRef(true),sequence=useRef(0),latest=useRef(view);latest.current=view;
 const [busy,setBusy]=useState(false),[loaded,setLoaded]=useState<{view:KnowledgeView;original:NonNullable<Awaited<ReturnType<typeof readKnowledgeScopeOriginal>>>}|null>(null),[error,setError]=useState<string|null>(null);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;sequence.current++;};},[]);
 const shown=loaded?.view===view?loaded.original:null;
 function close(){sequence.current++;setLoaded(null);setError(null);setBusy(false);}
 async function read(source:KnowledgeScopeSource){if(busy)return;const captured=view,id=++sequence.current,active=()=>alive.current&&sequence.current===id&&latest.current===captured;setLoaded(null);setError(null);setBusy(true);
  try{const original=await readKnowledgeScopeOriginal(client,{projectId,knowledgeRef:captured.ref,source},active);if(active()&&original)setLoaded({view:captured,original});}
  catch(e){if(active()){const a=e instanceof ApiError?e:new ApiError('RESPONSE_INVALID');setError(a.code);if(a.status===401)onAuthenticationLost();}}
  finally{if(alive.current&&sequence.current===id)setBusy(false);}
 }
 const {stageRefs,taskRefs}=view.entry.scope;if(!stageRefs.length&&!taskRefs.length)return null;
 return <section aria-label="지식 관련성 원문 확인"><h4>관련 고정 원문 확인</h4><p className="meta">명시 조회만 합니다. 과거 단계 원문이 현재 GET으로 확인되지 않으면 미확인으로 남깁니다. 관련성·보관 원문은 현재 적용·확정·실행 허가가 아닙니다.</p>
  <ul>{stageRefs.map((r,i)=><li key={JSON.stringify(r)}>단계 {r.nodeId}<button type="button" disabled={busy} onClick={()=>void read({kind:'STAGE',reference:r})}>관련 단계 {i+1} 원문 확인</button></li>)}{taskRefs.map((r,i)=><li key={JSON.stringify(r)}>업무 {r.taskCode}<button type="button" disabled={busy} onClick={()=>void read({kind:'TASK',reference:r})}>관련 업무 {i+1} 원문 확인</button></li>)}</ul>
  {busy||shown||error?<button type="button" onClick={close}>관련 고정 원문 닫기</button>:null}{busy?<p role="status">고정 관련성 원문 대조 중</p>:null}
  {error?<p role="alert">{error} · 원문 미확인. 보관된 관련성을 다른 버전으로 바꾸지 않습니다.</p>:null}
  {shown?<section aria-label="지식 관련 고정 원문"><p>v{shown.ref.version} · SHA256 {shown.ref.contentHash}</p>{shown.kind==='TASK'?<><h5>{shown.task.taskCode} · {shown.task.title}</h5><p>원문 상태 {shown.status} · 별도 확정·현재 실행 여부는 미확인</p><p>{shown.task.purpose}</p><p>담당 역할: {shown.task.ownerRole} · {shown.task.type}</p><Lines title="입력" items={shown.task.inputs}/><Lines title="산출물" items={shown.task.outputs}/><Lines title="포함" items={shown.task.included}/><Lines title="제외" items={shown.task.excluded}/><Lines title="착수 선행" items={shown.task.startPrerequisites}/><Lines title="연결 검수 선행" items={shown.task.acceptancePrerequisites}/><Lines title="작업 절차" items={shown.task.steps}/><Lines title="검수 기준" items={shown.task.acceptanceCriteria}/><Lines title="증거" items={shown.task.evidenceRequirements}/><p>복구: {shown.task.rollback} · {shown.task.recoveryNotes}</p><details><summary>고정 업무 전체 내용</summary><pre>{JSON.stringify(shown.task,null,2)}</pre></details></>:<><h5>{shown.name} · {shown.node.nodeId} · {shown.node.name}</h5><p>{shown.node.purpose}</p><p>{shown.node.kind} · {shown.node.role} · {shown.node.mode}</p><Lines title="포함" items={shown.node.taskScope.included}/><Lines title="제외" items={shown.node.taskScope.excluded}/><Lines title="완료 기준" items={shown.node.completionCriteria}/><Lines title="승인 경계" items={shown.node.approvalBoundary}/><Lines title="기록 요구" items={shown.node.recordRequirements}/><details><summary>고정 단계 전체 내용</summary><pre>{JSON.stringify(shown.node,null,2)}</pre></details></>}<p>실행 허가 없음 · Agent 전달 없음</p></section>:null}
 </section>;
}
