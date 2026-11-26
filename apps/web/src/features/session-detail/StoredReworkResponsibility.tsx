import {useLayoutEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import type {PlanRef} from '../design-trace/work-plan-api.ts';
import type {ConfirmedAssignmentView} from '../workspace/assignment-confirmation-api.ts';
import type {SubmittedResultView} from './result-api.ts';
import type {StoredResultRework} from './result-rework-write-api.ts';
import {readStoredReworkResponsibility} from './stored-rework-responsibility-api.ts';

type Responsibility=NonNullable<Awaited<ReturnType<typeof readStoredReworkResponsibility>>>;
type Read={state:'loading'}|{state:'done';value:Responsibility}|{state:'error';code:string};
const refText=(ref:PlanRef)=>`${ref.id} · v${ref.version} · SHA256 ${ref.contentHash}`;

export function StoredReworkResponsibility({client,assignment,result,rework,current,onUnavailable}:{
 client:ApiClient;assignment:ConfirmedAssignmentView;result:SubmittedResultView;rework:StoredResultRework;
 current:()=>boolean;onUnavailable:(error:ApiError)=>void;
}){
 const [read,setRead]=useState<Read|null>(null),mounted=useRef(false),flight=useRef<object|null>(null);
 useLayoutEffect(()=>{mounted.current=true;return()=>{mounted.current=false;flight.current=null;};},[]);
 const shown=current()?read:null;
 async function load(){
  if(!mounted.current||!current()||flight.current||shown)return;
  const ticket={},transport=client.transport;
  const active=()=>mounted.current&&current()&&flight.current===ticket&&client.transport===transport;
  flight.current=ticket;
  setRead({state:'loading'});
  try{
   const value=await readStoredReworkResponsibility(client,assignment,result,rework,active);
   if(active()&&value)setRead({state:'done',value});
  }catch(cause){
   if(!active())return;
   const e=cause instanceof ApiError?cause:new ApiError('RESULT_REWORK_RESPONSIBILITY_MISMATCH');
   setRead({state:'error',code:/^[A-Z_]{1,80}$/.test(e.code)?e.code:'RESULT_REWORK_RESPONSIBILITY_MISMATCH'});
   if([401,403,404].includes(e.status))onUnavailable(e);
  }finally{if(flight.current===ticket)flight.current=null;}
 }
 function close(){flight.current=null;setRead(null);}
 return <section aria-label="보완 당시 책임 관계">
  {!shown?<button type="button" onClick={()=>void load()}>당시 책임 역할·예약 원문 열기</button>:<>
   <button type="button" onClick={close}>당시 책임 역할·예약 원문 닫기</button>
   {shown.state==='loading'?<p role="status">당시 역할·예약 보호 조회 중</p>:null}
   {shown.state==='error'?<p role="alert">{shown.code} · 당시 책임 관계 미확인</p>:null}
   {shown.state==='done'?<>
    <p>단계 책임 역할 {refText(shown.value.role.ref)} · {shown.value.role.snapshot.reason}</p>
    <p>예약 {refText(shown.value.binding.ref)} · 세대 {shown.value.binding.snapshot.generation} · {shown.value.binding.snapshot.reason}</p>
    <p>예약 세션 {refText(shown.value.binding.snapshot.sessionRef)} · {shown.value.binding.snapshot.connectionReadiness}</p>
    <details><summary>당시 역할·예약 전체 원문</summary><pre>{JSON.stringify({role:shown.value.role,binding:shown.value.binding},null,2)}</pre></details>
    <p>보완 판단 당시의 기록입니다. 현재 배정·권한과 재개 가능 여부는 미확인입니다.</p>
   </>:null}
  </>}
 </section>;
}
