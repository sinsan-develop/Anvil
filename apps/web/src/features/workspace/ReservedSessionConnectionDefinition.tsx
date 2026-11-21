import {useEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import {readDefinition,type DefinitionView} from '../connections/connection-definition-api.ts';
import type {Ref} from '../connections/api.ts';
import {ordered} from '../knowledge/review-view.ts';

/** 저장된 RESERVED binding의 고정 참조만 읽는다. 편집·예약 명령은 소유하지 않는다. */
export function ReservedSessionConnectionDefinition({client,projectId,connectionRef,buffer,contextKey,disabled,isCurrent,onAuthenticationLost}:{client:ApiClient;projectId:string;connectionRef:Ref;buffer:object|null;contextKey:string;disabled:boolean;isCurrent:()=>boolean;onAuthenticationLost:()=>void}){
 const key=ordered([projectId,connectionRef,buffer,contextKey,disabled]),scope=useRef({client,transport:client.transport,key,buffer}),sequence=useRef(0),alive=useRef(true),flight=useRef<number|null>(null);
 if(scope.current.client!==client||scope.current.transport!==client.transport||scope.current.key!==key||scope.current.buffer!==buffer){scope.current={client,transport:client.transport,key,buffer};sequence.current++;flight.current=null;}
 const owner=scope.current;
 const [result,setResult]=useState<{owner:typeof owner;ticket:number;view:DefinitionView|null;error:boolean;pending:boolean}|null>(null);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;sequence.current++;flight.current=null;};},[]);
 const active=(ticket:number)=>alive.current&&scope.current===owner&&sequence.current===ticket&&!disabled&&isCurrent();
 const shown=result?.owner===owner&&result.ticket===sequence.current&&!disabled&&isCurrent()?result:null;
 async function open(){
  if(disabled||!isCurrent()||scope.current!==owner||flight.current!==null)return;
  const ticket=++sequence.current;flight.current=ticket;setResult({owner,ticket,view:null,error:false,pending:true});
  try{const view=await readDefinition(client,projectId,connectionRef,()=>active(ticket));if(active(ticket))setResult({owner,ticket,view,error:false,pending:false});}
  catch(cause){if(active(ticket)){setResult({owner,ticket,view:null,error:true,pending:false});if(cause instanceof ApiError&&cause.status===401)onAuthenticationLost();}}
  finally{if(flight.current===ticket)flight.current=null;}
 }
 function close(){if(scope.current!==owner)return;sequence.current++;flight.current=null;setResult(null);}
 const view=shown?.view;
 return <section aria-label="예약 당시 등록 정의">
  <button type="button" disabled={disabled||!!shown?.pending} onClick={()=>void open()}>예약 당시 등록 정의 조회</button>
  {shown?<button type="button" onClick={close}>예약 당시 등록 정의 닫기</button>:null}
  {shown?.pending?<p role="status">예약 당시 등록 정의 조회 중</p>:null}
  {shown?.error?<p role="alert">예약 당시 등록 정의 조회 미확인 · 명시 재조회가 필요합니다.</p>:null}
  {view?<article aria-label="예약 당시 등록 정의 원문"><h6>예약 당시 등록 정의 원문</h6>
   <p>{view.ref.id} · v{view.ref.version} · {view.ref.contentHash}</p>
   <p>도구 {view.definition.toolProduct} · 버전 {view.definition.toolVersion} · 어댑터 {view.definition.adapterKind}</p>
   <pre aria-label="예약 당시 모델 옵션">{JSON.stringify(view.definition.modelOptions,null,2)}</pre>
   {view.definition.environmentRef?<p>당시 환경 참조 {view.definition.environmentRef.id} · v{view.definition.environmentRef.version} · {view.definition.environmentRef.contentHash}</p>:<p>당시 환경 참조 미기록</p>}
   <p>조회 시각 {view.observedAt} · 설정 head v{view.currentStatus.headVersion} · 고정 버전 일치 {String(view.currentStatus.configurationCurrent)}</p>
   <p>NOT_READY · UNVERIFIED · 실제 Agent 연결·실행 허가 아님</p>
  </article>:null}
 </section>;
}
