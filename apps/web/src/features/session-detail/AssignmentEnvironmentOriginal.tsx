import {useEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import {capabilityNames,type CandidateView,type Ref} from '../connections/api.ts';
import {readAssignmentEnvironmentOriginal} from './assignment-environment-original.ts';
export function AssignmentEnvironmentOriginal({client,projectId,assignmentRef,environmentRef,onAuthenticationLost}:{client:ApiClient;projectId:string;assignmentRef:Ref;environmentRef:Ref;onAuthenticationLost:()=>void}){
 const [opened,setOpened]=useState(false),[revision,setRevision]=useState(0),[value,setValue]=useState<CandidateView|null>(null),[error,setError]=useState<ApiError|null>(null);
 const lost=useRef(onAuthenticationLost);lost.current=onAuthenticationLost;
 useEffect(()=>{
  if(!opened)return;let active=true;setValue(null);setError(null);
  readAssignmentEnvironmentOriginal(client,projectId,assignmentRef,environmentRef,()=>active).then(v=>{if(active)setValue(v);}).catch(cause=>{if(!active)return;const e=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');setValue(null);setError(e);if(e.status===401)lost.current();});
  return()=>{active=false;};
 },[client,projectId,assignmentRef.id,assignmentRef.version,assignmentRef.contentHash,environmentRef.id,environmentRef.version,environmentRef.contentHash,opened,revision]);
 return <section aria-label="고정 임무 환경 원문"><h3>임무에 고정된 환경</h3><p className="meta">환경 v{environmentRef.version} · 읽기 전용 · 현재 환경/권한/실행은 미확인</p>
  <button type="button" onClick={()=>{setValue(null);setError(null);setOpened(true);setRevision(n=>n+1);}}>{opened?'고정 환경 원문 다시 조회':'고정 환경 원문 보기'}</button>
  {opened?<><button type="button" onClick={()=>{setOpened(false);setValue(null);setError(null);}}>환경 원문 닫기</button>{error?<p role="alert">{error.code} · 원문 미확인 · 다른 환경으로 대체하지 않습니다.</p>:value?<>
   <h4>{value.candidate.input.candidate.label}</h4><p>NOT_READY · {value.expired?'기한 경과':'조회 시 기한 이내'} · 실행 허가 없음</p>
   <p>기한 {value.candidate.input.expiresAt} · 보관 이유 {value.candidate.input.reason}</p><ul>{value.candidate.readiness.missingRequirements.map((r,i)=><li key={i}>{r.field}: {r.reason}</li>)}</ul>
   <details><summary>고정 환경 입력·정책 참조</summary><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify({ref:value.ref,input:value.candidate.input},null,2)}</pre></details>
   <ul>{value.candidate.capabilities.map(c=><li key={c.code}>{capabilityNames[c.code]} · 실측/통제 UNVERIFIED</li>)}</ul>
  </>:<p role="status">고정 환경 원문 확인 중</p>}</>:null}
 </section>;
}
