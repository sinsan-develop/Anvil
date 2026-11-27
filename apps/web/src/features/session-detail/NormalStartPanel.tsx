import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import type {DocumentSession} from '../design-trace/editor-api.ts';
import type {ConfirmedAssignmentView} from '../workspace/assignment-confirmation-api.ts';
import {ordered} from '../knowledge/review-view.ts';
import type {OriginView} from './execution-start-origin-api.ts';
import {normalStartKey,normalStartOwner,normalStartStatus,prepareNormalStart,sendNormalStart,subscribeNormalStart,type NormalStartBuffer,type NormalStartPacket,type NormalStartStorage} from './normal-start-write-api.ts';

const same=(a:unknown,b:unknown)=>ordered(a)===ordered(b);
export function NormalStartPanel({client,session,assignment,selected,selectionIdentity,storage,isSourceCurrent,onAuthenticationLost}:{client:ApiClient;session:DocumentSession;assignment:ConfirmedAssignmentView;selected:OriginView|null;selectionIdentity:object|null;storage:NormalStartStorage;isSourceCurrent:()=>boolean;onAuthenticationLost:()=>void}){
 const epoch=normalStartOwner(client,session),scope=useRef({epoch,client,transport:client.transport,session,assignment:ordered(assignment.ref)});
 if(scope.current.epoch!==epoch||scope.current.client!==client||scope.current.transport!==client.transport||scope.current.session!==session||scope.current.assignment!==ordered(assignment.ref))scope.current={epoch,client,transport:client.transport,session,assignment:ordered(assignment.ref)};
 const owner=scope.current,mounted=useRef(true),running=useRef(false),controller=useRef<AbortController|null>(null),source=useRef({selected,selectionIdentity}),store=useRef(storage),sourceCurrent=useRef(isSourceCurrent),authLost=useRef(onAuthenticationLost);
 store.current=storage;sourceCurrent.current=isSourceCurrent;authLost.current=onAuthenticationLost;
 if(source.current.selected!==selected||source.current.selectionIdentity!==selectionIdentity)source.current={selected,selectionIdentity};
 const [busy,setBusy]=useState(false),[failure,setFailure]=useState<{code:string;status:number}|null>(null),[ack,setAck]=useState<NormalStartPacket|null>(null),[,refresh]=useState(0);
 const active=()=>mounted.current&&scope.current===owner&&client.transport===owner.transport&&normalStartOwner(client,session)===epoch&&sourceCurrent.current()&&store.current.current();
 useLayoutEffect(()=>{mounted.current=true;return()=>{mounted.current=false;controller.current?.abort();};},[]);
 useEffect(()=>{controller.current?.abort();setFailure(null);setAck(null);},[owner]);
 const buffers=Object.values(storage.buffers).filter((value):value is NormalStartBuffer=>!!value&&value.packet.ownerUserId===session.user.id&&value.packet.ownerClientId===session.clientId&&value.packet.source.projectId===assignment.projectId&&same(value.packet.source.assignmentRef,assignment.ref));
 useEffect(()=>{const remove=buffers.map(buffer=>subscribeNormalStart(buffer.packet,()=>{if(active())refresh(value=>value+1);}));return()=>{for(const dispose of remove)dispose();};},[storage.buffers,owner]);
 const selectedBuffer=selected?buffers.find(buffer=>same(buffer.packet.source.originRef,selected.ref)&&same(buffer.packet.source.reservationRef,selected.reservation.ref)):null;
 async function run(work:(signal:AbortSignal)=>Promise<void>,current:()=>boolean){
  if(running.current||!current())return;
  const abort=new AbortController();controller.current=abort;running.current=true;setBusy(true);setFailure(null);
  try{await work(abort.signal);}catch(cause){if(current()){const error=cause instanceof ApiError?cause:new ApiError('NORMAL_START_RESPONSE_INVALID');setFailure({code:error.code,status:error.status});if(error.status===401)authLost.current();}}
  finally{if(controller.current===abort)controller.current=null;running.current=false;if(mounted.current)setBusy(false);}
 }
 async function prepare(){
  const original=source.current;if(!original.selected||selectedBuffer)return;
  const current=()=>active()&&source.current===original;
  await run(async signal=>{
   const packet=await prepareNormalStart(client,session,assignment,original.selected!,current,signal);
   if(!packet||!current())return;
   const key=normalStartKey(packet),next:NormalStartBuffer={packet,phase:'PREPARED',receipt:null,failure:null};
   if(store.current.read(key)!==null||!store.current.compareAndSet(key,null,next)||store.current.read(key)!==next)return;
   setAck(null);
  },current);
 }
 async function send(buffer:NormalStartBuffer){
  const packet=buffer.packet,key=normalStartKey(packet),original=source.current,status=normalStartStatus(packet),fresh=status==='PREPARED';
  if(fresh&&(ack!==packet||!original.selected||!same(packet.source.originRef,original.selected.ref)||!same(packet.source.reservationRef,original.selected.reservation.ref)))return;
  const current=()=>active()&&store.current.read(key)?.packet===packet&&(!fresh||source.current===original);
  let sending:NormalStartBuffer|null=null;
  await run(async signal=>{
   await sendNormalStart(client,session,packet,current,{
    beforeDispatch:()=>{
     if(!current()||store.current.read(key)!==buffer)return false;
     const next:NormalStartBuffer={...buffer,phase:'SENDING',failure:null};
     if(!store.current.compareAndSet(key,buffer,next)||store.current.read(key)!==next)return false;
     sending=next;return current();
    },
    notSent:()=>{if(sending&&store.current.read(key)===sending)store.current.compareAndSet(key,sending,buffer);},
    stored:receipt=>{
     if(!sending||!current()||store.current.read(key)!==sending)return false;
     const next:NormalStartBuffer={packet,phase:'STORED',receipt,failure:null};
     return store.current.compareAndSet(key,sending,next)&&store.current.read(key)===next&&current();
    },
    unknown:error=>{
     if(!sending||store.current.read(key)!==sending)return;
     store.current.compareAndSet(key,sending,{...sending,phase:normalStartStatus(packet)==='REJECTED'?'REJECTED':'UNKNOWN',failure:error});
    }
   },signal);
  },current);
 }
 return <section aria-label="정상 START 접수"><h3>정상 START 접수 <span tabIndex={0} title="선택한 원자료의 고정 실행 ID로 접수 저장만 요청합니다. 실행 허가와 시작 완료는 별도입니다.">ⓘ</span></h3>
  {selected&&!selectedBuffer?<button type="button" disabled={busy} onClick={()=>void prepare()}>정상 START 접수 준비</button>:null}
  {buffers.map(buffer=>{const packet=buffer.packet,status=normalStartStatus(packet)??buffer.phase,fresh=status==='PREPARED',chosen=!!selected&&same(packet.source.originRef,selected.ref)&&same(packet.source.reservationRef,selected.reservation.ref);return <article key={packet.id} aria-label="정상 START 접수 원명령">
   <p>고정 실행 {packet.source.executionId} · 세대 {packet.source.executionGeneration} · 원 명령 {packet.command.commandId}</p>
   {fresh?<><p>접수 준비 · 미전송</p><label><input type="checkbox" checked={ack===packet} disabled={busy||!chosen} onChange={event=>{if(active()&&!running.current)setAck(event.target.checked?packet:null);}}/>이 원자료와 고정 실행 ID로 접수 저장을 요청합니다</label><button type="button" disabled={busy||!chosen||ack!==packet} onClick={()=>void send(buffer)}>정상 START 명시 접수</button></>:null}
   {status==='SENDING'?<p role="status">접수 응답 확인 중 · 원 명령 보존</p>:null}
   {status==='UNKNOWN'||status==='REJECTED'?<><p role="status">{status==='UNKNOWN'?'접수 결과 불명':'접수 거절'} · 원 명령·본문 보존</p><button type="button" disabled={busy} onClick={()=>void send(buffer)}>같은 START 원명령 재확인</button></>:null}
   {buffer.receipt&&status==='STORED'?<p role="status">정상 START 접수 저장 확인 · {buffer.receipt.ref.id} · SHA {buffer.receipt.ref.contentHash} · 실행 허가·시작 완료는 별도</p>:null}
   {buffer.failure?<p>{buffer.failure.code}{buffer.failure.status===412?' · 현재 준비·환경·등록·권한 조건을 확인하지 못했습니다.':''}</p>:null}
  </article>;})}
  {busy?<p role="status">정상 접수의 원 보호 근거 확인 중</p>:null}
  {failure?<p role="alert">{failure.code}{failure.status===412?' · 현재 준비·환경·등록·권한 조건을 확인하지 못했습니다.':''}</p>:null}
 </section>;
}
