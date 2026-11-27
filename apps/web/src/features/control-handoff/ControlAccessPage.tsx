import type {ControlAcceptanceChain} from '../../../../server/modules/control-handoff/control-grant.ts';
import type {ProtectedHandoffSummary} from '../../../../server/modules/control-handoff/control-handoff-protected-summary.ts';
import {useLayoutEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import {routeHref} from '../../shell/routes.ts';
import {ProjectAccessSummary} from '../projects/ProjectAccessSummary.tsx';
import {ControlApi,ControlAcceptanceNotReady,same,type ControlSession,type ControlStateResult,type ControlRequestListResult,type ControlRequestReadResult,type HandoffSummaryReadResult,type ControlRef} from './api.ts';
import {ControlScope,emptyControlBuffer,freezeControlCommand,freezeControlAcceptance,rejectControlAcceptance,unresolvedControlPending,selfRequestCommand,type ControlBuffer,type ControlTicket} from './state.ts';
interface Props{isCurrent?:()=>boolean;client:ApiClient;projectId:string;session?:ControlSession;buffer?:ControlBuffer|null;onChange?:(expected:string|null,next:ControlBuffer)=>boolean;scope?:ControlScope;onAuthenticationLost:()=>void}
interface View{acceptanceOwner?:ControlBuffer['pending'];state:ControlStateResult|null;list:ControlRequestListResult|null;request:ControlRequestReadResult|null;summary:HandoffSummaryReadResult|null;headNone:boolean;protectedSummary:ProtectedHandoffSummary|null;protectedHeadState:'NONE'|'UNKNOWN'|null;acceptance:ControlAcceptanceChain['result']|null;error:ApiError|null;busy:boolean}
const emptyView=():View=>({state:null,list:null,request:null,summary:null,headNone:false,protectedSummary:null,protectedHeadState:null,acceptance:null,error:null,busy:false});
const labels={activeExecutions:'진행 작업',pendingCommands:'미결 명령',pendingApprovals:'미결 승인',sourceCheckpointRefs:'원본·체크포인트 참조'};
/** 명시 조작만 원 명령을 보존해 전송한다. 실행 시작·자동 재전송은 하지 않는다. */
export function ControlAccessPage({isCurrent,client,projectId,session,buffer=null,onChange,scope:parentScope,onAuthenticationLost}:Props){
 const sourceCurrent=()=>!isCurrent||isCurrent();
 const localScope=useRef(new ControlScope()),scope=parentScope??localScope.current;scope.bind(session??null,projectId);
 const live=useRef({client,projectId,session,buffer,onChange});live.current={client,projectId,session,buffer,onChange};
 const [view,setView]=useState<View>(emptyView),[ticketRevision,setTicketRevision]=useState(0),[confirmedSummary,setConfirmedSummary]=useState<{context:object;requestRef:ControlRef;summaryRef:ControlRef}|null>(null);
 const context=useRef({session,projectId,client,transport:client.transport,csrf:session?.csrfToken});
 const navigation=useRef<{OWN:{cursors:(string|null)[];index:number};CONTROLLER:{cursors:(string|null)[];index:number};failed:{view:'OWN'|'CONTROLLER';cursor:string|null;index:number}|null}>({OWN:{cursors:[],index:-1},CONTROLLER:{cursors:[],index:-1},failed:null});
 const visibleContext=useRef<object|null>(null),ticketContexts=useRef(new WeakMap<ControlTicket,object>());if(context.current.session!==session||context.current.projectId!==projectId||context.current.client!==client||context.current.transport!==client.transport||context.current.csrf!==session?.csrfToken){context.current={session,projectId,client,transport:client.transport,csrf:session?.csrfToken};navigation.current={OWN:{cursors:[],index:-1},CONTROLLER:{cursors:[],index:-1},failed:null};scope.dispose();scope.bind(session??null,projectId);}
 const mounted=useRef(false),renderOwner=context.current;
 useLayoutEffect(()=>{mounted.current=true;scope.bind(session??null,projectId);return()=>{mounted.current=false;scope.dispose();};},[scope]);
 // Never show a prior scope's sensitive result in the render preceding an effect.
 const visible=useRef<{session:ControlSession|undefined;projectId:string;client:ApiClient}|null>(null);
 const currentView=sourceCurrent()&&visibleContext.current===context.current&&visible.current?.session===session&&visible.current?.projectId===projectId&&visible.current?.client===client?view:emptyView();
 const b=buffer&&session&&buffer.projectId===projectId&&buffer.ownerUserId===session.user.id&&buffer.ownerClientId===session.clientId?buffer:null;
 const pending=b?.pending??null,unresolved=unresolvedControlPending(pending);
 const historyScope=useRef({context:context.current,binding:b?.bindingId,pending,revision:0});
 if(historyScope.current.context!==context.current||historyScope.current.binding!==b?.bindingId||historyScope.current.pending!==pending){
  historyScope.current={context:context.current,binding:b?.bindingId,pending,revision:historyScope.current.revision+1};
 }
 const historyOwner=historyScope.current;
 const configured=!!session&&!!onChange;
 const matches=(ticket:ControlTicket,binding:string|null)=>{
  if(!sourceCurrent()||!mounted.current||!scope.current(ticket,binding)||ticketContexts.current.get(ticket)!==context.current)return false;
  if(context.current.transport!==client.transport||context.current.csrf!==session?.csrfToken){scope.dispose();setTicketRevision(v=>v+1);return false;}
  return live.current.session===session&&live.current.projectId===projectId&&live.current.client===client;
 };
 function start(binding:string|null=null){const retain=visibleContext.current===context.current;const ticket=scope.ticket(binding);ticketContexts.current.set(ticket,context.current);visibleContext.current=context.current;visible.current={session,projectId,client};setView(v=>({...(retain?v:emptyView()),error:null,busy:true}));setTicketRevision(v=>v+1);return ticket;}
 function fail(cause:unknown,ticket:ControlTicket,binding:string|null=null){if(!matches(ticket,binding))return;const error=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');setView({...emptyView(),error});if(error.status===401)onAuthenticationLost();}
 function currentController(state:ControlStateResult|null):state is ControlStateResult{
  const basis=state?.control.basis;
  return !!session&&live.current.session===session&&live.current.projectId===projectId&&live.current.client===client&&context.current.transport===client.transport&&context.current.csrf===session.csrfToken
   &&state?.projectId===projectId&&state.actorId===session.user.id&&state.clientId===session.clientId&&(state.participation==='OWNER'||state.participation==='HANDOFF_ELIGIBLE')
   &&state.control.state==='HELD'&&!!basis&&basis.actorId===session.user.id&&basis.clientId===session.clientId;
 }
 function api(){if(!sourceCurrent()||!session)throw new ApiError('AUTH_REQUIRED',401);return new ControlApi(client.transport,session,projectId);}
 async function loadState(){if(!sourceCurrent())return;const t=start();setView({...emptyView(),busy:true});try{const state=await api().state();if(matches(t,null))setView({...emptyView(),state});}catch(e){fail(e,t);}}
 async function loadList(view:'OWN'|'CONTROLLER',cursor:string|null=null,index=0,retry=false){
  if(!sourceCurrent())return;
  const t=start();navigation.current.failed={view,cursor,index};
  setView(v=>({...v,list:null,request:null,summary:null,headNone:false,protectedSummary:null,protectedHeadState:null}));
  try{
   let state=currentView.state;
   if(retry){state=await api().state();if(!matches(t,null))return;}
   if(!state||view==='CONTROLLER'&&!currentController(state))throw new ApiError('REQUEST_FAILED',403);
   const list=await api().list(view,cursor);if(!matches(t,null))return;
   const history=navigation.current[view];history.cursors=history.cursors.slice(0,index);history.cursors[index]=cursor;history.index=index;navigation.current.failed=null;
   setView(v=>({...v,state,list,busy:false}));
  }catch(e){fail(e,t);}
 }
 async function select(requestRef:ControlRef){if(!sourceCurrent())return;const t=start();setView(v=>({...v,request:null,summary:null,headNone:false,protectedSummary:null,protectedHeadState:null}));try{const request=await api().request(requestRef);if(matches(t,null))setView(v=>({...v,request,busy:false}));}catch(e){fail(e,t);}}
 async function loadSummary(){if(!sourceCurrent())return;const selected=currentView.request;if(!selected)return;const t=start();setView(v=>({...v,summary:null,headNone:false,protectedSummary:null,protectedHeadState:null}));try{const head=await api().head(selected.requestRef);if(!matches(t,null))return;if(head.head.state==='NONE'){setView(v=>({...v,headNone:true,busy:false}));return;}const result=await api().summary(selected.requestRef,head.head.summaryRef,selected.snapshot.expiresAt);if(matches(t,null))setView(v=>({...v,summary:result,busy:false}));}catch(e){fail(e,t);}}
 async function loadProtectedSummary(){
  if(!sourceCurrent())return;
  const selected=currentView.request;if(!selected)return;const t=start();setView(v=>({...v,protectedSummary:null,protectedHeadState:null}));
  try{const head=await api().protectedHead(selected.requestRef);if(!matches(t,null))return;if(head.head.state!=='AVAILABLE'){const state=head.head.state;setView(v=>({...v,protectedHeadState:state,busy:false}));return;}
   const summary=await api().protectedSummary(selected.requestRef,head.head.summaryRef);if(!matches(t,null))return;
   if(!same(summary.snapshot.baseControl,selected.snapshot.baseControl)||!same(summary.snapshot.targetActorRef,selected.snapshot.targetActorRef)||!same(summary.snapshot.targetClientRef,selected.snapshot.targetClientRef)||Date.parse(summary.snapshot.validUntil)>Date.parse(selected.snapshot.expiresAt))throw new ApiError('RESPONSE_INVALID');
   setView(v=>({...v,protectedSummary:summary,busy:false}));
  }catch(e){fail(e,t);}
 }
 function edit(field:'reason'|'expiresAt',value:string){if(!sourceCurrent()||!session||!onChange||unresolved)return;const old=b??emptyControlBuffer(session,projectId);onChange(b?.bindingId??null,{...old,[field]:value});}
 function preserve(command:Parameters<typeof freezeControlCommand>[1]){if(!sourceCurrent()||!session||!onChange||unresolved)return;const old=b??emptyControlBuffer(session,projectId);const next=freezeControlCommand(old,command);onChange(b?.bindingId??null,next);}
 function prepareRequest(){try{if(!sourceCurrent()||!session||!currentView.state||!b)return;preserve(selfRequestCommand(session,projectId,currentView.state,b.reason,b.expiresAt));}catch(e){setView(v=>({...v,error:e instanceof ApiError?e:new ApiError('REQUEST_FAILED')}));}}
 function prepareSummary(){if(!sourceCurrent())return;const request=currentView.request,state=currentView.state;if(!session||!request||!currentController(state)||currentView.busy||!!currentView.error||unresolved||request.current.expired||request.current.baseControlState!=='MATCHED'||!same(state.control.basis,request.snapshot.baseControl))return;preserve({schemaVersion:1,operation:'prepareControlHandoff',commandId:crypto.randomUUID(),projectId,clientId:session.clientId,payload:{requestRef:{...request.requestRef}}});}
 function prepareProtected(){if(!sourceCurrent())return;const selected=currentView.request;if(!session||!onChange||!selected||!canPrepare)return;const old=b??emptyControlBuffer(session,projectId),next=freezeControlCommand(old,{schemaVersion:1,operation:'prepareControlHandoff',commandId:crypto.randomUUID(),projectId,clientId:session.clientId,payload:{requestRef:{...selected.requestRef}}});if(next.pending&&next.pending.kind!=='ACCEPT')next.pending={...next.pending,kind:'PROTECTED_PREPARE'};onChange(b?.bindingId??null,next);}
 function prepareAcceptance(){try{if(!sourceCurrent()||!session||!onChange||!b||!canAccept||!currentView.protectedSummary)return;const summary=currentView.protectedSummary,command={schemaVersion:1 as const,operation:'acceptControl' as const,commandId:crypto.randomUUID(),projectId,clientId:session.clientId,payload:{requestRef:{...summary.snapshot.requestRef},summaryVersion:summary.ref.version,reason:b.reason}};onChange(b.bindingId,freezeControlAcceptance(b,command,summary));}catch(e){setView(v=>({...v,error:e instanceof ApiError?e:new ApiError('REQUEST_FAILED')}));}}
 async function send(){
 const old=live.current.buffer,command=old?.pending;
 if(!sourceCurrent()||!mounted.current||context.current!==renderOwner||client.transport!==renderOwner.transport||session?.csrfToken!==renderOwner.csrf
  ||!old||!command||command!==pending||!session||!onChange||command.status!=='READY'&&command.status!=='UNKNOWN'
  ||old.ownerUserId!==session.user.id||old.ownerClientId!==session.clientId||old.projectId!==projectId)return;
 const binding=command.bindingId,t=start(binding),sending={...old,pending:{...command,status:'UNKNOWN' as const}};
 // Parent synchronously CAS-preserves the exact payload before any transport call.
 if(!onChange(old.bindingId,sending)){scope.ticket();setView(v=>({...v,busy:false}));return;}
 if(command.kind==='ACCEPT')live.current.buffer=sending;
 try{
 if(command.kind==='ACCEPT'){
   const current=()=>matches(t,binding)&&live.current.buffer===sending;
   const result=command.status==='UNKNOWN'?await api().acceptanceResult(command.command,command.summary,current):await api().accept(command.command,command.summary,current);if(!matches(t,binding))return;
   const latest=live.current.buffer,confirmed={...command,status:'CONFIRMED' as const};
   if(latest!==sending||!onChange(old.bindingId,{...latest,pending:confirmed})){setView(v=>({...v,busy:false}));return;}
   try{const state=await api().state();if(matches(t,binding))setView({...emptyView(),state,acceptance:result,acceptanceOwner:confirmed});}
   catch(e){fail(e,t,binding);} // 수락 CAS가 확정된 뒤의 현재 상태 조회 오류만 처리한다.
   return;
  }
  if(command.kind==='PROTECTED_PREPARE'){
   if(command.command.operation!=='prepareControlHandoff')throw new ApiError('RESPONSE_INVALID');const summary=await api().prepareProtected(command.command);if(!matches(t,binding))return;
   const latest=live.current.buffer;if(!latest||latest.bindingId!==old.bindingId||latest.pending?.bindingId!==binding||!onChange(old.bindingId,{...latest,pending:{...command,status:'CONFIRMED'}}))return;
   setView(v=>({...v,protectedSummary:summary,protectedHeadState:null,busy:false}));return;
  }
  const result=await api().send(command.command);if(!matches(t,binding))return;
 const latest=live.current.buffer;if(!latest||latest.bindingId!==old.bindingId||latest.pending?.bindingId!==binding)return;
 if(!onChange(old.bindingId,{...latest,pending:{...command,status:'CONFIRMED'}}))return;
 // Re-read using fixed refs; no POST response alone grants a current permission.
 if('requestRef'in result){const request=await api().request(result.requestRef);if(matches(t,binding))setView(v=>({...v,request,summary:null,headNone:false,protectedSummary:null,protectedHeadState:null,busy:false}));}
 else{const selected=currentView.request;if(!selected||command.command.operation!=='prepareControlHandoff'||!same(selected.requestRef,command.command.payload.requestRef)){setView(v=>({...v,busy:false}));return;}const summary=await api().summary(selected.requestRef,result.summaryRef,selected.snapshot.expiresAt);if(matches(t,binding))setView(v=>({...v,summary,busy:false}));}
 }catch(e){
 if(command.kind==='ACCEPT'){
  if(!matches(t,binding))return;
  if(live.current.buffer!==sending){setView(v=>({...v,busy:false}));return;}
  if(command.status==='READY'&&e instanceof ControlAcceptanceNotReady&&e.commandId===command.command.commandId){
   const rejected=rejectControlAcceptance(sending,e.commandId);
   if(onChange(old.bindingId,rejected)){
    live.current.buffer=rejected;navigation.current.failed=null;setConfirmedSummary(null);setView(emptyView());
   }else setView(v=>({...v,busy:false}));
   return;
  }
  // 첫 CAS에 보존된 UNKNOWN을 재작성하거나 다른 버퍼로 옮기지 않는다.
  fail(e,t,binding);return;
 }
 // Preserve UNKNOWN in the App-owned store even after logout/navigation. Never repopulate an old screen.
 const latest=live.current.buffer;if(latest?.bindingId===old.bindingId&&latest.pending?.bindingId===binding&&latest.pending.status!=='CONFIRMED')onChange(old.bindingId,{...latest,pending:{...command,status:'UNKNOWN'}});
 fail(e,t,binding);
 }
 }
 const state=currentView.state,request=currentView.request,summary=currentView.summary;
 const canRequest=configured&&state?.control.state==='OTHER_CLIENT'&&!currentView.busy&&!currentView.error&&!unresolved;
 const canPrepare=configured&&currentController(state)&&request&&!request.current.expired&&request.current.baseControlState==='MATCHED'&&same(state.control.basis,request.snapshot.baseControl)&&!currentView.busy&&!currentView.error&&!unresolved;
 const protectedSummary=currentView.protectedSummary,confirmationContext=context.current;
 const summaryConfirmed=!!confirmedSummary&&confirmedSummary.context===confirmationContext&&!!request&&!!protectedSummary&&same(confirmedSummary.requestRef,request.requestRef)&&same(confirmedSummary.requestRef,protectedSummary.snapshot.requestRef)&&same(confirmedSummary.summaryRef,protectedSummary.ref);
 const canAccept=configured&&!!b?.reason.trim()&&!!request&&!request.current.expired&&request.current.baseControlState==='MATCHED'&&!!protectedSummary&&protectedSummary.snapshot.transferState==='READY'&&Date.parse(protectedSummary.snapshot.validUntil)>Date.now()&&protectedSummary.snapshot.targetActorRef.userId===session?.user.id&&protectedSummary.snapshot.targetClientRef.clientId===session?.clientId&&same(protectedSummary.snapshot.requestRef,request.requestRef)&&summaryConfirmed&&!currentView.busy&&!currentView.error&&!unresolved;
 void ticketRevision;
 return <section aria-label="작업 권한 인계"><h2>작업 권한 인계</h2>
  <p>내 다른 기기의 인수 요청과 보호요약을 확인하고 명시적으로 수락합니다. 실제 보호 근거가 없으면 수락할 수 없습니다. 실행 작업은 자동 중단·재시작하지 않습니다.</p>
  <p role="status">조회는 인수 요청·수락·새 권한 발급이 아닙니다. 미확인 자료로 권한을 부여하지 않습니다.</p>
  <ProjectAccessSummary key={projectId} client={client} projectId={projectId} name="선택 프로젝트" disabled={false} onAuthenticationLost={onAuthenticationLost}/>
  <section aria-label="현재 제어와 내 기기"><h3>현재 제어와 내 기기</h3>
   <p>현재 사용자 {session?.user.displayName??'미확인'} · 기기 {session?.clientId??'미확인'}</p>
   <button type="button" onClick={()=>void loadState()} disabled={!configured||currentView.busy}>현재 제어 조회</button>
   {state?<dl><dt>서버 관측 시각</dt><dd>{state.observedAt}</dd><dt>제어 상태</dt><dd>{state.control.state}</dd><dt>현재 제어 사용자·기기</dt><dd>{state.control.basis?state.control.basis.actorId+' / '+state.control.basis.clientId:'확인된 제어 기준 없음'}</dd><dt>제어 세대·버전</dt><dd>{state.control.basis?state.control.basis.generation+' / '+state.control.basis.version:'미확인'}</dd></dl>:<p>현재 제어는 아직 확인하지 않았습니다.</p>}
  </section>
  {currentView.busy?<p role="status">조회·결과 확인 중입니다.</p>:null}
  {currentView.error?<p role="alert">{currentView.error.status===404||currentView.error.status===503?'인계 소스가 연결되지 않았거나 조회할 수 없습니다. 사용할 수 있는 상태로 확인되지 않았습니다.':currentView.error.message} ({currentView.error.status||currentView.error.code}) 입력과 명령은 유지했습니다. 현재 제어를 다시 조회하세요.</p>:null}
  <section aria-label="내 다른 기기 인수 요청"><h3>내 다른 기기 인수 요청</h3>
   <p>요청 대상은 현재 로그인한 사용자와 이 기기입니다. 서버가 재인증·권한을 다시 확인합니다.</p>
   <label>인수 요청 이유<textarea maxLength={20000} value={b?.reason??''} disabled={!configured||unresolved} onChange={e=>edit('reason',e.target.value)}/></label>
   <label>요청 만료 시각 (UTC)<input type="text" placeholder="YYYY-MM-DDTHH:mm:ss.sssZ" value={b?.expiresAt??''} disabled={!configured||unresolved} onChange={e=>edit('expiresAt',e.target.value)}/></label>
   <p>확인된 서버 관측 시각 이후 최대 30분입니다. 위 시각은 서버 관측값이며 이 기기의 현재 시각이 아닙니다.</p>
   <button type="button" disabled={!canRequest||!b?.reason.trim()||!b.expiresAt} onClick={prepareRequest}>인수 요청 명령 보존</button>
   <a href={routeHref('settings',projectId)}>로그인·재인증 설정</a>
  </section>
  {pending?<section aria-label="보존된 인계 명령"><h3>보존된 인계 명령</h3><p>{pending.kind==='ACCEPT'?'인수 수락':pending.kind==='PROTECTED_PREPARE'?'보호요약 준비':pending.command.operation==='requestControl'?'인수 요청':'미확인 요약 준비'} · {pending.status}</p>
   {pending.command.operation==='requestControl'?<p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>보존한 요청 이유: {pending.command.payload.reason} · 요청 만료 {pending.command.payload.expiresAt}</p>:pending.kind==='ACCEPT'?<p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>보존한 수락 이유: {pending.command.payload.reason} · 보호요약 {pending.summary.ref.version}</p>:<p>선택한 고정 요청의 요약 준비 명령입니다.</p>}
   {pending.status==='REJECTED'?<p role="status">수락 거절 확인 · 원명령 {pending.command.commandId}. 현재 제어를 다시 조회하고 최신 보호요약과 대상 기기를 확인한 뒤 새 수락 명령을 보존하세요.</p>:<>
    <p>결과가 불명이면 자동 재전송하지 않습니다. 같은 명령 확인은 원래 식별자와 본문을 사용합니다.</p>
    <button type="button" disabled={!configured||currentView.busy||pending.status==='SENDING'||pending.status==='CONFIRMED'||!!currentView.error} onClick={()=>void send()}>{pending.status==='UNKNOWN'?'같은 명령 결과 재확인':'보존한 명령 전송'}</button></>}
  </section>:null}
  <section aria-label="인수 요청 목록"><h3>인수 요청 목록</h3>
   <button type="button" disabled={!state||currentView.busy||!!currentView.error} onClick={()=>void loadList('OWN')}>내 요청 목록 조회</button>
   <button type="button" disabled={!currentController(state)||currentView.busy||!!currentView.error} onClick={()=>void loadList('CONTROLLER')}>현재 제어자 요청 목록 조회</button>
   {visibleContext.current===context.current&&navigation.current.failed?<button type="button" disabled={!configured||currentView.busy} onClick={()=>{const target=navigation.current.failed;if(target)void loadList(target.view,target.cursor,target.index,true);}}>같은 요청 목록 다시 조회</button>:null}
   {currentView.list&&navigation.current[currentView.list.view].index>0?<button type="button" disabled={currentView.busy} onClick={()=>{const list=currentView.list!,history=navigation.current[list.view],index=history.index-1;void loadList(list.view,history.cursors[index]!,index);}}>이전 요청 목록 조회</button>:null}
   {currentView.list?<><p>서버 관측 {currentView.list.observedAt} · {currentView.list.view}</p>{currentView.list.items.length===0?<p>확인된 요청이 없습니다.</p>:<ol>{currentView.list.items.map((item,index)=><li key={item.requestRef.id}><button type="button" disabled={currentView.busy} onClick={()=>void select(item.requestRef)}>요청 {index+1} 원문 확인</button> 생성 {item.createdAt} · 만료 {item.expiresAt} · {item.current.expired?'기한 경과':'관측 시점 기한 내'} · 기준 {item.current.baseControlState}</li>)}</ol>}{currentView.list.hasMore?<button type="button" disabled={currentView.busy} onClick={()=>void loadList(currentView.list!.view,currentView.list!.nextCursor,navigation.current[currentView.list!.view].index+1)}>다음 요청 목록 조회</button>:null}</>:null}
  </section>
  {request?<section aria-label="선택한 고정 요청"><h3>선택한 고정 요청</h3><p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{request.snapshot.reason}</p><p>요청 사용자·기기 {request.snapshot.requestedBy.actorId} / {request.snapshot.requestedBy.clientId}</p><p>요청 만료 {request.snapshot.expiresAt} · 서버 관측 {request.observedAt} · {request.current.expired?'기한 경과':'관측 시점 기한 내'} · 현재 기준 {request.current.baseControlState}</p>
   <button type="button" disabled={!canPrepare} onClick={prepareSummary}>미확인 요약 준비 명령 보존</button>
    <button type="button" disabled={!canPrepare} onClick={prepareProtected}>보호요약 준비 명령 보존</button>
   <button type="button" disabled={currentView.busy||!!currentView.error} onClick={()=>void loadSummary()}>최신 요약 참조·고정 원문 조회</button>
   <button type="button" disabled={currentView.busy||!!currentView.error} onClick={()=>void loadProtectedSummary()}>최신 보호요약 고정 원문 조회</button>
   {currentView.protectedHeadState?<p>{currentView.protectedHeadState==='NONE'?'보관된 보호요약이 없습니다.':'현재 요청의 보호요약 기준을 확인할 수 없습니다.'}</p>:null}
   {currentView.headNone?<p>서버 관측에서 이 요청의 요약이 없음을 확인했습니다. 미연결 상태와 다릅니다.</p>:null}
  </section>:null}
  {summary&&request?<ControlSummaryView summary={summary} requestExpiresAt={request.snapshot.expiresAt}/>:null}
  {currentView.protectedSummary?<section aria-label="고정 보호요약"><h3>고정 보호요약</h3><p>보호 검산 {currentView.protectedSummary.snapshot.transferState}</p><p>관측 {currentView.protectedSummary.snapshot.observedAt} · 기한 {currentView.protectedSummary.snapshot.validUntil}</p><dl>{(Object.keys(labels)as(keyof typeof labels)[]).map(key=><div key={key}><dt>{labels[key]}</dt><dd>{currentView.protectedSummary!.snapshot.collections[key].state} · 참조 {currentView.protectedSummary!.snapshot.collections[key].items.length}개</dd></div>)}</dl><p>미확인 항목: {currentView.protectedSummary.snapshot.gaps.join(', ')}</p>{!currentView.busy?<ProtectedSummaryDetails key={ticketRevision} summary={currentView.protectedSummary}/>:null}<p>보관 원문 조회만으로 현재 수락 권한을 만들지 않습니다.</p></section>:null}
  {protectedSummary?<section aria-label="인수 수락 확인"><label>수락 이유<textarea maxLength={20000} value={b?.reason??''} disabled={!configured||unresolved} onChange={e=>edit('reason',e.target.value)}/></label><label><input type="checkbox" checked={summaryConfirmed} disabled={!configured||unresolved||currentView.busy} onChange={e=>{if(!sourceCurrent()||context.current!==confirmationContext||visibleContext.current!==confirmationContext||client.transport!==confirmationContext.transport||session?.csrfToken!==confirmationContext.csrf||!request)return;setConfirmedSummary(e.target.checked?{context:confirmationContext,requestRef:{...request.requestRef},summaryRef:{...protectedSummary.ref}}:null);}}/>요약과 대상 기기를 확인했습니다.</label></section>:null}
   <button type="button" disabled={!canAccept} onClick={prepareAcceptance}>인수 수락 명령 보존</button>
   {session&&b&&pending?.kind==='ACCEPT'&&pending.status==='CONFIRMED'?
    <ConfirmedAcceptanceHistory client={client} session={session} projectId={projectId} key={historyOwner.revision} busy={currentView.busy}
     initial={currentView.acceptanceOwner===pending?currentView.acceptance:null}
     current={()=>sourceCurrent()&&historyScope.current===historyOwner&&live.current.buffer?.pending===pending&&
      live.current.buffer.bindingId===historyOwner.binding&&pending.status==='CONFIRMED'&&live.current.projectId===projectId&&
      session.user.id===b.ownerUserId&&session.clientId===b.ownerClientId&&live.current.session===session&&
      client.transport===historyOwner.context.transport&&session.csrfToken===historyOwner.context.csrf}
     read={active=>new ControlApi(client.transport,session,projectId).acceptanceResult(pending.command,pending.summary,active)}
     onAuthenticationLost={onAuthenticationLost}/>:null}
  <a href={routeHref('workspace',projectId)}>프로젝트 작업으로 돌아가기</a>
 </section>;
}

type HistoricalResult=ControlAcceptanceChain['result'];
function ConfirmedAcceptanceHistory({client,session,projectId,busy,initial,current,read,onAuthenticationLost}:{
 client:ApiClient;session:ControlSession;projectId:string;busy:boolean;initial:HistoricalResult|null;current:()=>boolean;read:(active:()=>boolean)=>Promise<HistoricalResult>;onAuthenticationLost:()=>void;
}){
 const ticket=useRef(0),pending=useRef(false),displayed=useRef<HistoricalResult|null>(null),summaryRoute=useRef({route:globalThis.location?.hash,valid:true});
 const [history,setHistory]=useState<{result:HistoricalResult|null;error?:ApiError;loading?:boolean}|null>(null);
 const [,refreshSummaryRoute]=useState(0);
 useLayoutEffect(()=>{
  const hash=(value:string)=>{try{return new URL(value).hash;}catch{return null;}};
  const changed=(event:HashChangeEvent)=>{
   const route=summaryRoute.current.route;
   const before=event.oldURL?hash(event.oldURL):route,after=event.newURL?hash(event.newURL):globalThis.location?.hash;
   if(before!==route||after!==route||globalThis.location?.hash!==route){summaryRoute.current.valid=false;refreshSummaryRoute(value=>value+1);}
  };
  globalThis.addEventListener?.('hashchange',changed);
  return()=>{ticket.current++;pending.current=false;globalThis.removeEventListener?.('hashchange',changed);};
 },[]);
 function close(){ticket.current++;pending.current=false;displayed.current=null;setHistory({result:null});}
 async function query(){
  if(busy||pending.current||!current())return;
  const request=++ticket.current,active=()=>ticket.current===request&&current();
  displayed.current=null;if(globalThis.location?.hash===summaryRoute.current.route)summaryRoute.current.valid=true;
  pending.current=true;setHistory({loading:true,result:null});
  try{const result=await read(active);if(active())setHistory({result});}
  catch(cause){if(active()){const error=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');setHistory({result:null,error});if(error.status===401)onAuthenticationLost();}}
  finally{if(ticket.current===request)pending.current=false;}
 }
 const result=history===null?initial:history.result;
 displayed.current=result;const resultTicket=ticket.current;
 const summaryCurrent=()=>{
  if(globalThis.location?.hash!==summaryRoute.current.route)summaryRoute.current.valid=false;
  return summaryRoute.current.valid&&current()&&ticket.current===resultTicket&&displayed.current===result;
 };
 return <section aria-label="보존한 수락 결과">
  <button type="button" disabled={busy||history?.loading} onClick={()=>void query()}>수락 결과 다시 조회</button>
  {history?.loading?<p role="status">수락 결과를 조회하고 있습니다.</p>:null}
  {history?.error?<p role="alert">수락 결과를 확인할 수 없습니다. ({history.error.status||history.error.code})</p>:null}
  {result?<section aria-label="제어 전환 결과 확인"><h3>제어 전환 결과 확인</h3><p>수락 결과의 사용자·기기 {result.nextControl.actorId} / {result.nextControl.clientId} · 세대 {result.nextControl.generation}</p><p>원 결과는 과거 사실입니다. 현재 제어와 일반 작업 허가는 서버가 별도로 검산합니다.</p><AcceptanceRecordDetails result={result}/>{summaryCurrent()?<AcceptedProtectedSummary client={client} session={session} projectId={projectId} result={result} current={summaryCurrent} onAuthenticationLost={onAuthenticationLost}/>:null}</section>:null}
  {result||history?.loading||history?.error?<button type="button" onClick={close}>수락 결과 닫기</button>:null}
 </section>;
}

/** 이미 검산된 수락 결과의 두 원참조만 읽는다. 현재 보호 head·수락 조건은 갱신하지 않는다. */
function AcceptedProtectedSummary({client,session,projectId,result,current,onAuthenticationLost}:{client:ApiClient;session:ControlSession;projectId:string;result:HistoricalResult;current:()=>boolean;onAuthenticationLost:()=>void}){
 const identity=JSON.stringify([projectId,session.user.id,session.clientId,session.csrfToken,result.requestRef,result.summaryRef,globalThis.location?.hash??null]);
 const owner=useRef({identity,client,transport:client.transport,session,result});
 if(owner.current.identity!==identity||owner.current.client!==client||owner.current.transport!==client.transport||owner.current.session!==session||owner.current.result!==result)owner.current={identity,client,transport:client.transport,session,result};
 const scope=owner.current,alive=useRef(true),parent=useRef(current);parent.current=current;
 const sequence=useRef(0),flight=useRef<object|null>(null),selected=useRef<object|null>(null);
 const [view,setView]=useState<{owner:object;ticket:object;summary:ProtectedHandoffSummary|null;error:ApiError|null;loading:boolean}|null>(null);
 useLayoutEffect(()=>{alive.current=true;return()=>{alive.current=false;sequence.current++;selected.current=null;};},[]);
 const subject=()=>result.projectId===projectId&&result.nextControl.actorId===session.user.id&&result.nextControl.clientId===session.clientId;
 const active=()=>alive.current&&owner.current===scope&&client.transport===scope.transport&&identity===JSON.stringify([projectId,session.user.id,session.clientId,session.csrfToken,result.requestRef,result.summaryRef,globalThis.location?.hash??null])&&subject()&&parent.current();
 const shown=view?.owner===scope&&view.ticket===selected.current&&active()?view:null;
 async function query(){
  if(!active()||flight.current)return;
  const ticket={},number=++sequence.current;flight.current=ticket;selected.current=ticket;
  const check=()=>active()&&sequence.current===number&&selected.current===ticket;
  setView({owner:scope,ticket,summary:null,error:null,loading:true});
  try{
   const summary=await new ControlApi(scope.transport,session,projectId).protectedSummary({...result.requestRef},{...result.summaryRef});
   if(!check())return;
   const snapshot=summary.snapshot;
   if(!same(summary.ref,result.summaryRef)||!same(snapshot.requestRef,result.requestRef)||!same(snapshot.baseControl,result.previousControl)||snapshot.targetActorRef.userId!==session.user.id||snapshot.targetClientRef.userId!==session.user.id||snapshot.targetClientRef.clientId!==session.clientId)throw new ApiError('RESPONSE_INVALID');
   setView({owner:scope,ticket,summary,error:null,loading:false});
  }catch(cause){
   if(!check())return;
   const error=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');setView({owner:scope,ticket,summary:null,error,loading:false});if(error.status===401)onAuthenticationLost();
  }finally{if(flight.current===ticket)flight.current=null;}
 }
 function close(){if(!shown||!active()||selected.current!==shown.ticket)return;sequence.current++;selected.current=null;flight.current=null;setView(null);}
 return <section aria-label="수락 결과의 과거 보호요약"><button type="button" disabled={!!shown?.loading} onClick={()=>void query()}>이 수락의 과거 보호요약 조회</button>
 {shown?<><button type="button" onClick={close}>수락 당시 보호요약 닫기</button>{shown.loading?<p role="status">원 수락의 고정 보호요약 조회 중</p>:shown.error?<p role="alert">수락 당시 보호요약을 확인할 수 없습니다. ({shown.error.status||shown.error.code})</p>:shown.summary?<section aria-label="수락 당시 보호요약"><h4>수락 당시 보호요약</h4><p>{shown.summary.ref.id} · v{shown.summary.ref.version} · {shown.summary.ref.contentHash}</p><p>당시 관측 {shown.summary.snapshot.observedAt} · 당시 기한 {shown.summary.snapshot.validUntil} · {shown.summary.snapshot.transferState}</p><ProtectedSummaryDetails key={sequence.current} summary={shown.summary}/></section>:null}</>:null}
 </section>;
}

function AcceptanceRecordDetails({result}:{result:HistoricalResult}){
 const [expanded,setExpanded]=useState(false);
 return <div>
  <button type="button" aria-expanded={expanded} onClick={()=>setExpanded(v=>!v)}>수락 기록 상세 {expanded?'접기':'펼치기'}</button>
  {expanded?<section aria-label="수락 기록 참조와 당시 제어 기준">
   <p>기록 당시 시각 {result.recordedAt}</p>
   <dl>
    {([['원 요청',result.requestRef],['보호 인계요약',result.summaryRef],['수락',result.acceptanceRef],['제어 부여',result.grantRef],['영수증',result.receiptRef],['감사',result.auditRef]]as const).map(([label,ref])=><div key={label}><dt>{label} 참조</dt><dd style={{overflowWrap:'anywhere'}}>{ref.id} · v{ref.version} · {ref.contentHash}</dd></div>)}
    {([['이전 제어 기준',result.previousControl],['수락 후 제어 기준',result.nextControl]]as const).map(([label,basis])=><div key={label}><dt>{label}</dt><dd>사용자 {basis.actorId} · 기기 {basis.clientId} · 세대 {basis.generation} · 버전 {basis.version}</dd></div>)}
   </dl>
  </section>:null}
 </div>;
}

/** 요약 TTL과 원요청 만료는 별도 서버 관측 사실이다. */
function ProtectedSummaryDetails({summary}:{summary:ProtectedHandoffSummary}){
 const [expanded,setExpanded]=useState(false);
 return <div>
  <button type="button" aria-expanded={expanded} onClick={()=>setExpanded(v=>!v)}>항목별 인계 판정 {expanded?'접기':'펼치기'}</button>
  {expanded?<section aria-label="보호요약 항목별 인계 판정">
   <p>저장 당시 관측입니다. 현재 진행·정지 확인이나 새로운 수락 조건을 뜻하지 않습니다.</p>
   {(Object.keys(labels)as(keyof typeof labels)[]).map(key=>{
    const collection=summary.snapshot.collections[key];
    return <section key={key} aria-label={labels[key]+' 인계 근거'}><h4>{labels[key]}</h4>
     <p>보관 판정 {collection.state} · 관측 {collection.observedAt} · 기한 {collection.expiresAt}</p>
     <p>범주별 미확인: {collection.gaps.length?collection.gaps.join(', '):'기록된 공백 없음 · 현재 안전 판정 아님'}</p>
     {collection.items.length?<ul>{collection.items.map((item,index)=><li key={index}>
      <p>원참조 {item.ref.id} · v{item.ref.version} · {item.ref.contentHash}</p>
      <p>근거 {item.provenance} · 인계 판정 {item.handoffDisposition}</p>
      <p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>판정 이유 {item.reasonCode}</p>
      <p>항목 관측 {item.observedAt} · 기한 {item.expiresAt}</p>
     </li>)}</ul>:<p>{collection.state==='VERIFIED_CURRENT'&&collection.gaps.length===0?'저장 당시 확인된 빈 목록':'보관 항목 0개 · 부재 확인 아님'}</p>}
    </section>;
   })}
  </section>:null}
 </div>;
}
export function ControlSummaryView({summary,requestExpiresAt}:{summary:HandoffSummaryReadResult;requestExpiresAt:string}){
 return <section aria-label="미확인 인계 요약"><h3>미확인 인계 요약</h3><p>{summary.body.safetyState} · {summary.body.sourceMode}</p><p>요약 관측 {summary.body.observedAt} · 요약 유효 시각 {summary.body.validUntil} (최대 30초) · 요청 만료 {requestExpiresAt}</p><p>조회 서버 관측 {summary.observedAt} · {Date.parse(summary.body.validUntil)<=Date.parse(summary.observedAt)?'요약 기한 경과':'서버 관측 시점 요약 기한 내'} · {summary.current.expired?'원요청 기한 경과':'원요청은 관측 시점 기한 내'} · 기준 {summary.current.baseControlState}</p><dl>{(Object.keys(labels) as (keyof typeof labels)[]).map(key=><div key={key}><dt>{labels[key]}</dt><dd>{summary.body[key].status} · {summary.body[key].reasonCode} · 관측 {summary.body[key].observedAt} · 참조 {summary.body[key].refs.length}개</dd></div>)}</dl><p>미확인 항목: {summary.body.gaps.join(', ')}</p><p>실제 수집 연결 false · 수락 가능 false · 실행 허가 false · 제어 이전 false</p></section>;
}
