import {useLayoutEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import type {VersionRef} from '../../../../../contracts/generated-types.ts';
import type {MethodologyGraph} from '../../../../../contracts/methodologies.ts';
import {readPinnedMethodRequirements} from './pinned-method-requirements-read.ts';

export function PinnedMethodRequirementsContent({graph}:{graph:MethodologyGraph}){
 return <>{graph.nodes.length?graph.nodes.map(node=><section key={node.nodeId}><h5>{node.nodeId} · {node.name}</h5>
  {(['capabilities','environment'] as const).map(kind=>{const values=node.requirements?.[kind].filter(value=>!!value.trim())??[],label=kind==='capabilities'?'요구 능력':'요구 환경';return <div key={kind}><h6>{label}</h6>{values.length?<ul>{values.map((value,index)=><li key={index}>{value}</li>)}</ul>:<p>{label} 미작성</p>}</div>;})}
 </section>):<p>방법론 단계 미작성</p>}</>;
}
type ReadIdentity={client:ApiClient;key:string;attempt:number;mounted:boolean};
type ReadValue={status:'LOADING'}|{status:'READY';graph:MethodologyGraph}|{status:'ERROR';error:ApiError};
export function PinnedMethodRequirements({client,userId,clientId,draftId,reference,onAuthenticationLost}:{client:ApiClient;userId:string;clientId:string;draftId:string|null;reference:VersionRef;onAuthenticationLost:()=>void}){
 const key=JSON.stringify([userId,clientId,draftId,reference]),live=useRef<ReadIdentity>({client,key,attempt:0,mounted:true}),lost=useRef(onAuthenticationLost);
 lost.current=onAuthenticationLost;
 if(live.current.client!==client||live.current.key!==key)live.current={client,key,attempt:0,mounted:true};
 const identity=live.current;
 const [read,setRead]=useState<{identity:ReadIdentity;attempt:number;value:ReadValue}|null>(null);
 // 단계 이탈/재진입은 같은 ref여도 새 시도다. cleanup은 늦은 JSON/hash보다 먼저 무효화한다.
 useLayoutEffect(()=>{identity.mounted=true;return()=>{identity.mounted=false;identity.attempt++;};},[identity]);
 const shown=read?.identity===identity&&read.attempt===identity.attempt?read.value:null;
 function close(){identity.attempt++;setRead(null);}
 async function load(){
  const attempt=++identity.attempt,current=()=>live.current===identity&&identity.mounted&&identity.attempt===attempt;
  setRead({identity,attempt,value:{status:'LOADING'}});
  try{
   const source=await readPinnedMethodRequirements(client,reference,current);
   if(!source||!current())return;
   setRead(previous=>current()?{identity,attempt,value:{status:'READY',graph:source.graph}}:previous);
  }catch(cause:unknown){
   if(!current())return;
   const error=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');
   setRead(previous=>current()?{identity,attempt,value:{status:'ERROR',error}}:previous);
   if(error.status===401&&current())lost.current();
  }
 }
 return <section aria-label="고정 방법론의 저장된 준비 요구"><h4>고정 방법론의 준비 요구</h4>
  <p className="meta">선택한 고정 버전의 원문 요구 정의입니다. 실제 도구·환경 준비, 현재 확정 유효성이나 실행 권한을 판정하지 않습니다.</p>
  {shown?<button type="button" onClick={close}>준비 요구 닫기</button>:<button type="button" onClick={()=>{void load();}}>저장된 준비 요구 조회</button>}
  {!shown?<p>고정 방법론의 요구 정의는 이 화면에서 아직 조회하지 않았습니다.</p>:shown.status==='LOADING'?<p role="status">선택한 고정 버전의 준비 요구 조회 중</p>:shown.status==='ERROR'?<p role="alert">{shown.error.message} · {shown.error.code} · 저장된 준비 요구 조회 실패. 원문을 표시하지 않습니다. 닫은 뒤 다시 조회할 수 있습니다.</p>:<PinnedMethodRequirementsContent graph={shown.graph}/>}
 </section>;
}
