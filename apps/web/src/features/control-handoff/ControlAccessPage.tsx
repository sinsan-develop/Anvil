import {useEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import {routeHref} from '../../shell/routes.ts';
import {ProjectAccessSummary} from '../projects/ProjectAccessSummary.tsx';
import {ControlApi,same,type ControlSession,type ControlStateResult,type ControlRequestListResult,type ControlRequestReadResult,type HandoffSummaryReadResult,type ControlRef} from './api.ts';
import {ControlScope,emptyControlBuffer,freezeControlCommand,selfRequestCommand,type ControlBuffer,type ControlTicket} from './state.ts';
interface Props{client:ApiClient;projectId:string;session?:ControlSession;buffer?:ControlBuffer|null;onChange?:(expected:string|null,next:ControlBuffer)=>boolean;scope?:ControlScope;onAuthenticationLost:()=>void}
interface View{state:ControlStateResult|null;list:ControlRequestListResult|null;request:ControlRequestReadResult|null;summary:HandoffSummaryReadResult|null;headNone:boolean;error:ApiError|null;busy:boolean}
const emptyView=():View=>({state:null,list:null,request:null,summary:null,headNone:false,error:null,busy:false});
const labels={activeExecutions:'진행 작업',pendingCommands:'미결 명령',pendingApprovals:'미결 승인',sourceCheckpointRefs:'원본·체크포인트 참조'};
/** Default-OFF FN15 source consumer. No accept, permission mutation, collector or control transfer. */
export function ControlAccessPage({client,projectId,session,buffer=null,onChange,scope:parentScope,onAuthenticationLost}:Props){
 const localScope=useRef(new ControlScope()),scope=parentScope??localScope.current;scope.bind(session??null,projectId);
 const live=useRef({client,projectId,session,buffer,onChange});live.current={client,projectId,session,buffer,onChange};
 const [view,setView]=useState<View>(emptyView),[ticketRevision,setTicketRevision]=useState(0);
 const context=useRef({session,projectId,client});if(context.current.session!==session||context.current.projectId!==projectId||context.current.client!==client){context.current={session,projectId,client};scope.dispose();scope.bind(session??null,projectId);}
 useEffect(()=>()=>scope.dispose(),[scope]);
 // Never show a prior scope's sensitive result in the render preceding an effect.
 const visible=useRef<{session:ControlSession|undefined;projectId:string;client:ApiClient}|null>(null);
 const currentView=visible.current?.session===session&&visible.current?.projectId===projectId&&visible.current?.client===client?view:emptyView();
 const b=buffer&&session&&buffer.projectId===projectId&&buffer.ownerUserId===session.user.id&&buffer.ownerClientId===session.clientId?buffer:null;
 const pending=b?.pending??null,unresolved=!!pending&&pending.status!=='CONFIRMED';
 const configured=!!session&&!!onChange;
 const matches=(ticket:ControlTicket,binding:string|null)=>scope.current(ticket,binding)&&live.current.session===session&&live.current.projectId===projectId&&live.current.client===client;
 function start(binding:string|null=null){const ticket=scope.ticket(binding);visible.current={session,projectId,client};setView(v=>({...v,error:null,busy:true}));setTicketRevision(v=>v+1);return ticket;}
 function fail(cause:unknown,ticket:ControlTicket,binding:string|null=null){if(!matches(ticket,binding))return;const error=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');setView({...emptyView(),error});if(error.status===401)onAuthenticationLost();}
 function api(){if(!session)throw new ApiError('AUTH_REQUIRED',401);return new ControlApi(client.transport,session,projectId);}
 async function loadState(){const t=start();setView({...emptyView(),busy:true});try{const state=await api().state();if(matches(t,null))setView({...emptyView(),state});}catch(e){fail(e,t);}}
 async function loadList(view:'OWN'|'CONTROLLER',cursor:string|null=null){const t=start();setView(v=>({...v,list:null,request:null,summary:null,headNone:false}));try{const list=await api().list(view,cursor);if(matches(t,null))setView(v=>({...v,list,busy:false}));}catch(e){fail(e,t);}}
 async function select(requestRef:ControlRef){const t=start();setView(v=>({...v,request:null,summary:null,headNone:false}));try{const request=await api().request(requestRef);if(matches(t,null))setView(v=>({...v,request,busy:false}));}catch(e){fail(e,t);}}
 async function loadSummary(){const selected=currentView.request;if(!selected)return;const t=start();setView(v=>({...v,summary:null,headNone:false}));try{const head=await api().head(selected.requestRef);if(!matches(t,null))return;if(head.head.state==='NONE'){setView(v=>({...v,headNone:true,busy:false}));return;}const result=await api().summary(selected.requestRef,head.head.summaryRef,selected.snapshot.expiresAt);if(matches(t,null))setView(v=>({...v,summary:result,busy:false}));}catch(e){fail(e,t);}}
 function edit(field:'reason'|'expiresAt',value:string){if(!session||!onChange||unresolved)return;const old=b??emptyControlBuffer(session,projectId);onChange(b?.bindingId??null,{...old,[field]:value});}
 function preserve(command:Parameters<typeof freezeControlCommand>[1]){if(!session||!onChange||unresolved)return;const old=b??emptyControlBuffer(session,projectId);const next=freezeControlCommand(old,command);onChange(b?.bindingId??null,next);}
 function prepareRequest(){try{if(!session||!currentView.state||!b)return;preserve(selfRequestCommand(session,projectId,currentView.state,b.reason,b.expiresAt));}catch(e){setView(v=>({...v,error:e instanceof ApiError?e:new ApiError('REQUEST_FAILED')}));}}
 function prepareSummary(){const request=currentView.request,state=currentView.state;if(!session||!request||!state||state.control.state!=='HELD'||state.participation!=='OWNER'||request.current.expired||request.current.baseControlState!=='MATCHED'||!same(state.control.basis,request.snapshot.baseControl))return;preserve({schemaVersion:1,operation:'prepareControlHandoff',commandId:crypto.randomUUID(),projectId,clientId:session.clientId,payload:{requestRef:{...request.requestRef}}});}
 async function send(){
 const old=live.current.buffer,command=old?.pending;if(!old||!command||!session||!onChange||command.status==='SENDING'||command.status==='CONFIRMED'||old.ownerUserId!==session.user.id||old.ownerClientId!==session.clientId||old.projectId!==projectId)return;
 const binding=command.bindingId,t=start(binding),sending={...old,pending:{...command,status:'UNKNOWN' as const}};
 // Parent synchronously CAS-preserves the exact payload before any transport call.
 if(!onChange(old.bindingId,sending)){scope.ticket();setView(v=>({...v,busy:false}));return;}
 try{
 const result=await api().send(command.command);if(!matches(t,binding))return;
 const latest=live.current.buffer;if(!latest||latest.bindingId!==old.bindingId||latest.pending?.bindingId!==binding)return;
 if(!onChange(old.bindingId,{...latest,pending:{...command,status:'CONFIRMED'}}))return;
 // Re-read using fixed refs; no POST response alone grants a current permission.
 if('requestRef'in result){const request=await api().request(result.requestRef);if(matches(t,binding))setView(v=>({...v,request,summary:null,headNone:false,busy:false}));}
 else{const selected=currentView.request;if(!selected||command.command.operation!=='prepareControlHandoff'||!same(selected.requestRef,command.command.payload.requestRef)){setView(v=>({...v,busy:false}));return;}const summary=await api().summary(selected.requestRef,result.summaryRef,selected.snapshot.expiresAt);if(matches(t,binding))setView(v=>({...v,summary,busy:false}));}
 }catch(e){
 // Preserve UNKNOWN in the App-owned store even after logout/navigation. Never repopulate an old screen.
 const latest=live.current.buffer;if(latest?.bindingId===old.bindingId&&latest.pending?.bindingId===binding&&latest.pending.status!=='CONFIRMED')onChange(old.bindingId,{...latest,pending:{...command,status:'UNKNOWN'}});
 fail(e,t,binding);
 }
 }
 const state=currentView.state,request=currentView.request,summary=currentView.summary;
 const canRequest=configured&&state?.control.state==='OTHER_CLIENT'&&!currentView.busy&&!currentView.error&&!unresolved;
 const canPrepare=configured&&state?.control.state==='HELD'&&state.participation==='OWNER'&&request&&!request.current.expired&&request.current.baseControlState==='MATCHED'&&same(state.control.basis,request.snapshot.baseControl)&&!currentView.busy&&!currentView.error&&!unresolved;
 void ticketRevision;
 return <section aria-label="작업 권한 인계"><h2>작업 권한 인계</h2>
  <p>내 다른 기기의 인수 요청과 미확인 요약을 조회합니다. 연결은 기본 비활성입니다. 다른 사람 선택·다음 담당자 수락·권한 전환은 미구현입니다.</p>
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
  {pending?<section aria-label="보존된 인계 명령"><h3>보존된 인계 명령</h3><p>{pending.command.operation==='requestControl'?'인수 요청':'미확인 요약 준비'} · {pending.status}</p>
   {pending.command.operation==='requestControl'?<p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>보존한 요청 이유: {pending.command.payload.reason} · 요청 만료 {pending.command.payload.expiresAt}</p>:<p>선택한 고정 요청의 미확인 요약 준비 명령입니다.</p>}
   <p>결과가 불명이면 자동 재전송하지 않습니다. 같은 명령 확인은 원래 식별자와 본문을 사용합니다.</p>
   <button type="button" disabled={!configured||currentView.busy||pending.status==='SENDING'||pending.status==='CONFIRMED'||!!currentView.error} onClick={()=>void send()}>{pending.status==='UNKNOWN'?'같은 명령 결과 재확인':'보존한 명령 전송'}</button>
  </section>:null}
  <section aria-label="인수 요청 목록"><h3>인수 요청 목록</h3>
   <button type="button" disabled={!state||currentView.busy||!!currentView.error} onClick={()=>void loadList('OWN')}>내 요청 목록 조회</button>
   <button type="button" disabled={state?.control.state!=='HELD'||state.participation!=='OWNER'||currentView.busy||!!currentView.error} onClick={()=>void loadList('CONTROLLER')}>현재 제어자 요청 목록 조회</button>
   {currentView.list?<><p>서버 관측 {currentView.list.observedAt} · {currentView.list.view}</p>{currentView.list.items.length===0?<p>확인된 요청이 없습니다.</p>:<ol>{currentView.list.items.map((item,index)=><li key={item.requestRef.id}><button type="button" disabled={currentView.busy} onClick={()=>void select(item.requestRef)}>요청 {index+1} 원문 확인</button> 생성 {item.createdAt} · 만료 {item.expiresAt} · {item.current.expired?'기한 경과':'관측 시점 기한 내'} · 기준 {item.current.baseControlState}</li>)}</ol>}{currentView.list.hasMore?<button type="button" disabled={currentView.busy} onClick={()=>void loadList(currentView.list!.view,currentView.list!.nextCursor)}>다음 요청 목록 조회</button>:null}</>:null}
  </section>
  {request?<section aria-label="선택한 고정 요청"><h3>선택한 고정 요청</h3><p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{request.snapshot.reason}</p><p>요청 사용자·기기 {request.snapshot.requestedBy.actorId} / {request.snapshot.requestedBy.clientId}</p><p>요청 만료 {request.snapshot.expiresAt} · 서버 관측 {request.observedAt} · {request.current.expired?'기한 경과':'관측 시점 기한 내'} · 현재 기준 {request.current.baseControlState}</p>
   <button type="button" disabled={!canPrepare} onClick={prepareSummary}>미확인 요약 준비 명령 보존</button>
   <button type="button" disabled={currentView.busy||!!currentView.error} onClick={()=>void loadSummary()}>최신 요약 참조·고정 원문 조회</button>
   {currentView.headNone?<p>서버 관측에서 이 요청의 요약이 없음을 확인했습니다. 미연결 상태와 다릅니다.</p>:null}
  </section>:null}
  {summary&&request?<ControlSummaryView summary={summary} requestExpiresAt={request.snapshot.expiresAt}/>:null}
  <button type="button" disabled>인수 수락 (미구현)</button>
  <a href={routeHref('workspace',projectId)}>프로젝트 작업으로 돌아가기</a>
 </section>;
}

/** 요약 TTL과 원요청 만료는 별도 서버 관측 사실이다. */
export function ControlSummaryView({summary,requestExpiresAt}:{summary:HandoffSummaryReadResult;requestExpiresAt:string}){
 return <section aria-label="미확인 인계 요약"><h3>미확인 인계 요약</h3><p>{summary.body.safetyState} · {summary.body.sourceMode}</p><p>요약 관측 {summary.body.observedAt} · 요약 유효 시각 {summary.body.validUntil} (최대 30초) · 요청 만료 {requestExpiresAt}</p><p>조회 서버 관측 {summary.observedAt} · {Date.parse(summary.body.validUntil)<=Date.parse(summary.observedAt)?'요약 기한 경과':'서버 관측 시점 요약 기한 내'} · {summary.current.expired?'원요청 기한 경과':'원요청은 관측 시점 기한 내'} · 기준 {summary.current.baseControlState}</p><dl>{(Object.keys(labels) as (keyof typeof labels)[]).map(key=><div key={key}><dt>{labels[key]}</dt><dd>{summary.body[key].status} · {summary.body[key].reasonCode} · 관측 {summary.body[key].observedAt} · 참조 {summary.body[key].refs.length}개</dd></div>)}</dl><p>미확인 항목: {summary.body.gaps.join(', ')}</p><p>실제 수집 연결 false · 수락 가능 false · 실행 허가 false · 제어 이전 false</p></section>;
}
