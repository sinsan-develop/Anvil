import {useEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import {readWorkspaceProject,type WorkspaceProject} from '../workspace/api.ts';
import {AppliedMethodOriginal} from '../methodology-editor/AppliedMethodOriginal.tsx';

/** 기존 두 읽기 경계만 소비한다. 고정 정의는 실제 현재 단계/진행 상태가 아니다. */
export function ProjectMethodologyOriginal({client,projectId,name,disabled,onAuthenticationLost}:{client:ApiClient;projectId:string;name:string;disabled:boolean;onAuthenticationLost:()=>void}){
 const [request,setRequest]=useState<{client:ApiClient;projectId:string;nonce:number}|null>(null);
 const [loaded,setLoaded]=useState<{client:ApiClient;projectId:string;nonce:number;value:WorkspaceProject|null;error:string|null}|null>(null);
 const lost=useRef(onAuthenticationLost);lost.current=onAuthenticationLost;
 const current=!disabled&&request?.client===client&&request.projectId===projectId?request:null;
 const shown=current&&loaded?.client===client&&loaded.projectId===projectId&&loaded.nonce===current.nonce?loaded:null;
 const pending=!!current&&!shown,value=shown?.value,ref=value?.currentMethodologyRef;
 useEffect(()=>{
  if(disabled){setRequest(null);setLoaded(null);return;}
  if(!request||request.client!==client||request.projectId!==projectId)return;
  let active=true;
  readWorkspaceProject(client,projectId).then(value=>{if(active)setLoaded({client,projectId,nonce:request.nonce,value,error:null});})
   .catch(cause=>{if(!active)return;const error=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');
    setLoaded({client,projectId,nonce:request.nonce,value:null,error:/^[A-Z_]{1,80}$/.test(error.code)?error.code:'RESPONSE_INVALID'});
    if(error.status===401)lost.current();});
  return()=>{active=false;};
 },[client,projectId,disabled,request]);
 return <section aria-label={name+' 고정 개발절차'}>
  <button type="button" disabled={disabled||pending} aria-expanded={!!current} onClick={()=>{setLoaded(null);setRequest(previous=>({client,projectId,nonce:(previous?.nonce??0)+1}));}}>{name} 절차 참조 {current?'다시 조회':'조회'}</button>
  {current?<button type="button" onClick={()=>{setRequest(null);setLoaded(null);}}>절차 참조 조회 닫기</button>:null}
  {pending?<p role="status">프로젝트의 고정 절차 참조 조회 중 · 이전 원문 숨김</p>:null}
  {shown?.error?<p role="alert">{shown.error} · 개발절차 미확인. 적용 참조 없음이나 완료로 처리하지 않습니다.</p>:null}
  {value?<><p className="meta">조회한 프로젝트 원본 v{value.version} · 고정 정의 탐색이며 실제 실행 단계·진행·배정·권한은 미확인입니다.</p>
   {ref?<><p className="meta">고정 적용 참조 {ref.id} · v{ref.version} · {ref.contentHash}</p><AppliedMethodOriginal key={[projectId,ref.id,ref.version,ref.contentHash].join(':')} client={client} projectId={projectId} expected={ref} onAuthenticationLost={()=>lost.current()}/></>:<p>조회한 프로젝트 원본에 적용 참조 없음 · 실제 실행 상태는 미확인입니다.</p>}
  </>:null}
 </section>;
}
