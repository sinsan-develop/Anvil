import {useEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import {readAssignmentDesignOriginal} from './assignment-design-original.ts';
import type {SessionDetail} from './api.ts';
type Original=Awaited<ReturnType<typeof readAssignmentDesignOriginal>>;
export function AssignmentDesignOriginal({client,detail,onAuthenticationLost}:{client:ApiClient;detail:Pick<SessionDetail,'projectId'|'draft'|'confirmed'>;onAuthenticationLost:()=>void}){
 const [request,setRequest]=useState<object|null>(null),[loaded,setLoaded]=useState<{request:object;value:Original|null;error:ApiError|null}|null>(null),lost=useRef(onAuthenticationLost);lost.current=onAuthenticationLost;
 const shown=loaded?.request===request?loaded:null;
 useEffect(()=>{
  if(!request)return;let active=true;
  readAssignmentDesignOriginal(client,detail,()=>active).then(value=>{if(active)setLoaded({request,value,error:null});}).catch(cause=>{if(!active)return;const error=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');setLoaded({request,value:null,error});if(error.status===401)lost.current();});
  return()=>{active=false;};
 },[client,detail,request]);
 return <section aria-label="고정 임무 설계 원문"><h4>임무의 원 설계서</h4><p>확정 임무와 원초안에 고정된 설계 버전만 읽습니다. 현재 기준 적용·권한·실행 준비 확인이 아닙니다.</p>
  <button type="button" onClick={()=>setRequest({})}>{request?'고정 설계 원문 다시 조회':'고정 설계 원문 보기'}</button>
  {request?<button type="button" onClick={()=>setRequest(null)}>설계 원문 조회 닫기</button>:null}
  {request&&!shown?<p role="status">고정 설계 원문 확인 중</p>:null}
  {shown?.error?<p role="alert">{shown.error.code} · 설계 원문 미확인. 이전 본문은 표시하지 않습니다.</p>:null}
  {shown?.value?<article><h5>{shown.value.document.title}</h5><p>{shown.value.document.id} · v{shown.value.document.version} · {shown.value.document.contentHash}</p><p>저장된 확정 이력: {shown.value.document.confirmed?'있음':'없음'} · 현재 내용 검토·적용 효력은 미확인</p><pre>{shown.value.body}</pre></article>:null}
 </section>;
}
