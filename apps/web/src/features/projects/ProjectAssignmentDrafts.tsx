import {useEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import {sessionDetailHref} from '../../shell/routes.ts';
import {listAssignmentDrafts,type AssignmentPage} from '../workspace/assignment-api.ts';

/** 저장 초안의 기존 유한 목록만 소비한다. 실행 이력/현재 준비 상태로 승격하지 않는다. */
type Position={cursor:string|null;history:Array<string|null>};
export function ProjectAssignmentDrafts({client,projectId,name,disabled,onAuthenticationLost}:{client:ApiClient;projectId:string;name:string;disabled:boolean;onAuthenticationLost:()=>void}){
 const scope=useRef({client,transport:client.transport,projectId,disabled});
 if(scope.current.client!==client||scope.current.transport!==client.transport||scope.current.projectId!==projectId||scope.current.disabled!==disabled)scope.current={client,transport:client.transport,projectId,disabled};
 const currentScope=scope.current;
 type Request={scope:typeof currentScope;target:Position};
 const [request,setRequest]=useState<Request|null>(null),[position,setPosition]=useState<Request|null>(null);
 const [loaded,setLoaded]=useState<{request:Request;value:AssignmentPage|null;error:string|null;denied:boolean}|null>(null);
 const requested=useRef(request);requested.current=request;
 const lost=useRef(onAuthenticationLost);lost.current=onAuthenticationLost;
 const open=!!request&&request.scope===currentScope&&!disabled,shown=open&&loaded?.request===request?loaded:null,pending=open&&!shown,v=shown?.value;
 const successful=position?.scope===currentScope?position.target:null;
 useEffect(()=>{
  if(!request||!open)return;let active=true;
  const current=()=>active&&requested.current===request&&scope.current===request.scope&&!scope.current.disabled&&client.transport===request.scope.transport;
  listAssignmentDrafts(client,projectId,request.target.cursor).then(value=>{
   if(!current())return;
   if(value.hasMore&&(!value.items.length||value.nextCursor===request.target.cursor)||value.items.some(i=>Date.parse(i.updatedAt)>Date.parse(value.observedAt)))throw new ApiError('PROJECT_DRAFTS_RESPONSE_INVALID');
   setPosition(request);setLoaded({request,value,error:null,denied:false});
  }).catch(cause=>{if(!current())return;const e=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');setLoaded({request,value:null,error:/^[A-Z_]{1,80}$/.test(e.code)?e.code:'RESPONSE_INVALID',denied:[401,403,404].includes(e.status)});if(e.status===401)lost.current();});
  return()=>{active=false;};
 },[request,open,currentScope,client,projectId]);
 function start(target:Position,first=false){
  if(disabled||pending||requested.current!==request||scope.current!==currentScope||client.transport!==currentScope.transport)return;
  const next={scope:currentScope,target};requested.current=next;setLoaded(null);setRequest(next);if(first)setPosition(null);
 }
 function close(){requested.current=null;setRequest(null);setPosition(null);setLoaded(null);}
 return <section aria-label={name+' 저장 임무 초안'}>
  <button type="button" aria-expanded={open} disabled={disabled||pending} onClick={()=>start({cursor:null,history:[]},true)}>{name} 저장 임무 {open?'다시 조회':'조회'}</button>
  {open?<button type="button" onClick={close}>저장 임무 조회 닫기</button>:null}
  {pending?<p role="status">저장 임무 페이지 조회 중 · 이전 결과 숨김</p>:null}
  {shown?.error?<><p role="alert">{shown.error} · 저장 임무 미확인. 빈 목록/완료로 처리하지 않습니다.</p><button type="button" disabled={disabled||pending||shown.denied} onClick={()=>{if(request)start(request.target);}}>저장 임무 같은 페이지 다시 조회</button></>:null}
  {v&&successful?<><p>{successful.history.length+1}페이지 · 이 페이지 {v.items.length}건 · 전체 건수 미산정</p><p>저장 초안 변경시각 내림차순의 현재 페이지 · 초안 · 실행 상태 아님</p>
   <p className="meta">서버 목록 관측 {v.observedAt} · 관측 뒤 개정/권한이 달라질 수 있습니다.</p>
   {v.items.length?<ul>{v.items.map(item=><li key={item.ref.id}><p>{item.goal||'목표 미입력'} · 업무 {item.taskRef.taskCode} · 저장 v{item.ref.version} · 기록된 준비 문제 {item.issueCount}건</p><p className="meta">초안 변경 {item.updatedAt} · 목록 metadata, 원문 무결성/현재 준비 미확인</p><a href={sessionDetailHref(projectId,item.ref)}>저장 임무 v{item.ref.version} 상세 조회</a></li>)}</ul>:<p>이 페이지에 저장 임무 초안 없음 · 실행/결과 이력 없음이라는 뜻은 아닙니다.</p>}
   {successful.history.length?<button type="button" disabled={disabled||pending} onClick={()=>start({cursor:successful.history.at(-1)!,history:successful.history.slice(0,-1)})}>저장 임무 이전 페이지</button>:null}
   {v.hasMore?<button type="button" disabled={disabled||pending} onClick={()=>start({cursor:v.nextCursor,history:[...successful.history,successful.cursor]})}>저장 임무 다음 페이지</button>:null}
   <p>상세 이동은 고정 원문을 다시 조회합니다. 확정·책임자 배정·Agent 시작은 하지 않습니다.</p>
  </>:null}
 </section>;
}
