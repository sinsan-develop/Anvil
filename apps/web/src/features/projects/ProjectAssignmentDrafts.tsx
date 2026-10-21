import {useEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import {sessionDetailHref} from '../../shell/routes.ts';
import {listAssignmentDrafts,type AssignmentPage} from '../workspace/assignment-api.ts';

/** 저장 초안의 기존 유한 목록만 소비한다. 실행 이력/현재 준비 상태로 승격하지 않는다. */
export function ProjectAssignmentDrafts({client,projectId,name,disabled,onAuthenticationLost}:{client:ApiClient;projectId:string;name:string;disabled:boolean;onAuthenticationLost:()=>void}){
 const [revision,setRevision]=useState(0),[cursor,setCursor]=useState<string|null>(null),[number,setNumber]=useState(1);
 const [loaded,setLoaded]=useState<{client:ApiClient;projectId:string;revision:number;cursor:string|null;value:AssignmentPage|null;error:string|null}|null>(null);
 const lost=useRef(onAuthenticationLost);lost.current=onAuthenticationLost;
 const shown=!disabled&&loaded?.client===client&&loaded.projectId===projectId&&loaded.revision===revision&&loaded.cursor===cursor?loaded:null,pending=revision>0&&!shown,v=shown?.value;
 useEffect(()=>{
  if(disabled){setRevision(0);setCursor(null);setNumber(1);setLoaded(null);return;}
  if(!revision)return;let active=true;
  listAssignmentDrafts(client,projectId,cursor).then(value=>{
   if(!active)return;
   if(value.hasMore&&(!value.items.length||value.nextCursor===cursor)||value.items.some(i=>Date.parse(i.updatedAt)>Date.parse(value.observedAt)))throw new ApiError('PROJECT_DRAFTS_RESPONSE_INVALID');
   setLoaded({client,projectId,revision,cursor,value,error:null});
  }).catch(cause=>{if(!active)return;const e=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');setLoaded({client,projectId,revision,cursor,value:null,error:/^[A-Z_]{1,80}$/.test(e.code)?e.code:'RESPONSE_INVALID'});if(e.status===401)lost.current();});
  return()=>{active=false;};
 },[client,projectId,revision,cursor,disabled]);
 return <section aria-label={name+' 저장 임무 초안'}>
  <button type="button" aria-expanded={revision>0} disabled={disabled||pending} onClick={()=>{setLoaded(null);setCursor(null);setNumber(1);setRevision(n=>n+1);}}>{name} 저장 임무 {revision?'다시 조회':'조회'}</button>
  {revision?<button type="button" onClick={()=>{setRevision(0);setCursor(null);setNumber(1);setLoaded(null);}}>저장 임무 조회 닫기</button>:null}
  {pending&&!disabled?<p role="status">저장 임무 페이지 조회 중 · 이전 결과 숨김</p>:null}
  {shown?.error?<p role="alert">{shown.error} · 저장 임무 미확인. 빈 목록/완료로 처리하지 않습니다.</p>:null}
  {v?<><p>{number}페이지 · 이 페이지 {v.items.length}건 · 전체 건수 미산정</p><p>저장 초안 변경시각 내림차순의 현재 페이지 · 초안 · 실행 상태 아님</p>
   <p className="meta">서버 목록 관측 {v.observedAt} · 관측 뒤 개정/권한이 달라질 수 있습니다.</p>
   {v.items.length?<ul>{v.items.map(item=><li key={item.ref.id}><p>{item.goal||'목표 미입력'} · 업무 {item.taskRef.taskCode} · 저장 v{item.ref.version} · 기록된 준비 문제 {item.issueCount}건</p><p className="meta">초안 변경 {item.updatedAt} · 목록 metadata, 원문 무결성/현재 준비 미확인</p><a href={sessionDetailHref(projectId,item.ref)}>저장 임무 v{item.ref.version} 상세 조회</a></li>)}</ul>:<p>이 페이지에 저장 임무 초안 없음 · 실행/결과 이력 없음이라는 뜻은 아닙니다.</p>}
   {v.hasMore?<button type="button" onClick={()=>{setLoaded(null);setCursor(v.nextCursor);setNumber(n=>n+1);}}>저장 임무 다음 페이지</button>:null}
   <p>상세 이동은 고정 원문을 다시 조회합니다. 확정·책임자 배정·Agent 시작은 하지 않습니다.</p>
  </>:null}
 </section>;
}
