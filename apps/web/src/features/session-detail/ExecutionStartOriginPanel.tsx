import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import type {DocumentSession} from '../design-trace/editor-api.ts';
import type {ConfirmedAssignmentView} from '../workspace/assignment-confirmation-api.ts';
import {readResponsibleSessionState,type ResponsibleSessionState,type PreparationRecord} from '../workspace/responsible-session-api.ts';
import {readStageQueue,type QueueView} from './stage-queue-api.ts';
import {readPreparationHistoryPage,readPreparationOriginal,type PreparationHistoryPage,type PreparationSummary} from './preparation-history-api.ts';
import {originBufferKey,originRef,prepareOrigin,sendOrigin,readOrigin,readOriginHistory,packetStatus,type OriginStorage,type OriginView,type OriginPage,type OriginPacket} from './execution-start-origin-api.ts';
import {ordered} from '../knowledge/review-view.ts';
import {StartOriginPreparationOriginal} from './StartOriginPreparationOriginal.tsx';
import {verifiedStageQueueItem,isQueueViewLimit,readWaitingStageReceiptCandidate,type WaitingStageReceipt} from './StageStartPanel.tsx';
import {NormalStartPanel} from './NormalStartPanel.tsx';
import type {NormalStartStorage} from './normal-start-write-api.ts';
const same=(a:unknown,b:unknown)=>ordered(a)===ordered(b);
// App에 남은 원 packet도 후보의 소유 수명을 우회해 일반 준비로 바뀌지 않는다.
const receiptCandidatePackets=new WeakMap<OriginPacket,{owner:object;hint:object;pageScope:{route:string;epoch:number}}>();
export function ExecutionStartOriginPanel({client,assignment,session,storage,onUnavailable,waitingHint,isSourceCurrent,normalStarts}:{client:ApiClient;assignment:ConfirmedAssignmentView;session:DocumentSession;storage:OriginStorage;onUnavailable:(code:string)=>void;waitingHint?:WaitingStageReceipt|null;isSourceCurrent?:()=>boolean;normalStarts?:NormalStartStorage}){
 const pid=assignment.projectId,key=originBufferKey(session,pid,assignment.ref),buffer=storage.buffers[key]??null,scope=useRef({key,client,transport:client.transport,session,csrf:session.csrfToken,epoch:0});
 if(scope.current.key!==key||scope.current.client!==client||scope.current.transport!==client.transport||scope.current.session!==session||scope.current.csrf!==session.csrfToken)scope.current={key,client,transport:client.transport,session,csrf:session.csrfToken,epoch:scope.current.epoch+1};
 const owner=scope.current,live=useRef(true),current=useRef(buffer),change=useRef(storage.onChange),unavailable=useRef(onUnavailable),working=useRef(false);current.current=buffer;change.current=storage.onChange;unavailable.current=onUnavailable;
 const hintRef=useRef({receipt:waitingHint});
 if(hintRef.current.receipt!==waitingHint)hintRef.current={receipt:waitingHint};
 const hint=hintRef.current;
 const pageRoute=useRef(0),[,renderRoute]=useState(0);
 const pageScope=()=>({route:typeof location==='undefined'?'':location.hash,epoch:pageRoute.current});
 const renderedPageScope=pageScope();
 const [busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),[targets,setTargets]=useState<{owner:typeof owner;hint?:typeof hint;queue:QueueView|null;receiptCandidate?:WaitingStageReceipt;preparations:PreparationHistoryPage;bindings:ResponsibleSessionState;cursors:string[];pageScope:ReturnType<typeof pageScope>}|null>(null),[selection,setSelection]=useState<{owner:typeof owner;stage:string;preparation:string;binding:string;reason:string}|null>(null),[original,setOriginal]=useState<{owner:typeof owner;value:OriginView;revision:number}|null>(null),[history,setHistory]=useState<{owner:typeof owner;value:OriginPage}|null>(null),[ack,setAck]=useState(false);
 const originalRevision=useRef(0);
 const clearOriginal=()=>{originalRevision.current++;setOriginal(null);};
 useLayoutEffect(()=>{live.current=true;return()=>{live.current=false;};},[]);
 // 명시 목록 조회의 페이지 연속성만 지킨다. 전달된 주소 왕복도 이전 cursor의 소유를 끝낸다.
 useLayoutEffect(()=>{const depart=()=>{pageRoute.current++;renderRoute(v=>v+1);};globalThis.addEventListener?.('hashchange',depart);return()=>globalThis.removeEventListener?.('hashchange',depart);},[]);
 useEffect(()=>{setOriginal(null);setTargets(null);setHistory(null);setSelection(null);setError(null);setAck(false);},[owner]);
 const active=()=>live.current&&scope.current===owner&&client.transport===owner.transport&&originBufferKey(session,pid,assignment.ref)===owner.key&&session.csrfToken===owner.csrf&&(!isSourceCurrent||isSourceCurrent());
 const hintCurrent=()=>active()&&hintRef.current===hint&&same(renderedPageScope,pageScope());
 const candidatePacketCurrent=(packet:OriginPacket)=>{const proof=receiptCandidatePackets.get(packet);return !proof||proof.owner===owner&&proof.hint===hint&&hintCurrent()&&same(proof.pageScope,pageScope());};
 const forPacket=(packet:OriginPacket)=>()=>active()&&current.current?.packet===packet&&candidatePacketCurrent(packet);
 const detail=original?.owner===owner&&original.revision===originalRevision.current?original:null;
 const shown=detail?.value,list=history?.owner===owner?history.value:null,data=targets?.owner===owner&&(!targets.hint||targets.hint===hint&&same(targets.pageScope,pageScope()))?targets:null,input=selection?.owner===owner?selection:null,locked=!!buffer?.packet;
 const preparationChoice=useRef({data,input});preparationChoice.current={data,input};
 const [candidateConfirmation,setCandidateConfirmation]=useState<{data:typeof data;input:typeof input}|null>(null);
 const candidateConsent=useRef(candidateConfirmation),saveConsent=useRef<OriginPacket|null>(null);
 const candidateConfirmed=candidateConfirmation?.data===data&&candidateConfirmation?.input===input&&candidateConsent.current===candidateConfirmation;
 const appliedPage=useRef<{data:typeof data;cursor:string}|null>(null);
 const failure=(cause:unknown)=>{const e=cause instanceof ApiError?cause:new ApiError('EXECUTION_START_ORIGIN_RESPONSE_INVALID');if(active()){clearOriginal();setError(/^[A-Z_]{1,80}$/.test(e.code)?e.code:'EXECUTION_START_ORIGIN_RESPONSE_INVALID');if([401,403,404].includes(e.status)){setTargets(null);setHistory(null);unavailable.current(e.status===401?'AUTH_REQUIRED':e.code);}}return e;};
 async function run(work:()=>Promise<void>,isCurrent=active){if(working.current||!isCurrent())return;working.current=true;setBusy(true);setError(null);try{await work();}catch(e){if(isCurrent())failure(e);}finally{working.current=false;if(live.current)setBusy(false);}}
 async function choose(){await run(async()=>{clearOriginal();setTargets(null);appliedPage.current=null;const source=pageScope();const [queue,preparations,bindings]=await Promise.all([readStageQueue(client,pid,active),readPreparationHistoryPage(client,pid,assignment.ref,null,active),readResponsibleSessionState(client,assignment)]);if(!active()||!queue||!preparations)return;setTargets({owner,queue,preparations,bindings,cursors:[],pageScope:source});setSelection({owner,stage:'',preparation:'',binding:'',reason:''});});}
 async function chooseHint(){
  const receipt=hint.receipt;
  if(!receipt||locked)return;
  await run(async()=>{
   clearOriginal();setTargets(null);setSelection(null);appliedPage.current=null;
   const source=pageScope();
   const isCurrent=()=>hintCurrent()&&same(source,pageScope());
   let queue:QueueView|null=null,candidate:WaitingStageReceipt|undefined;
   try{queue=await readStageQueue(client,pid,isCurrent);if(!isCurrent()||!queue)return;
    const item=verifiedStageQueueItem(queue,receipt);if(!item)throw new ApiError('STAGE_START_QUEUE_NOT_FOUND',409);queue={...queue,items:[item]};
   }catch(cause){if(!isCurrent())return;if(!isQueueViewLimit(cause))throw cause;const checked=await readWaitingStageReceiptCandidate(receipt,assignment,session,isCurrent);if(!isCurrent()||!checked)return;candidate=checked;}
   const [preparations,bindings]=await Promise.all([readPreparationHistoryPage(client,pid,assignment.ref,null,hintCurrent),readResponsibleSessionState(client,assignment)]);
   if(!isCurrent()||!preparations)return;
   setTargets({owner,hint,queue,...(candidate?{receiptCandidate:candidate}:{}),preparations,bindings,cursors:[],pageScope:source});
   setSelection({owner,stage:receipt.ref.id,preparation:'',binding:'',reason:''});setCandidateConfirmation(null);
  },hintCurrent);
 }
 async function previousPreparations(){
  if(!data||!input||locked||!data.preparations.nextCursor)return;
  const cursor=data.preparations.nextCursor;
  if(appliedPage.current?.data===data&&appliedPage.current.cursor===cursor)return;
  const isCurrent=()=>(data.hint?hintCurrent():active())&&current.current===buffer&&preparationChoice.current.data===data&&preparationChoice.current.input===input&&same(data.pageScope,pageScope());
  await run(async()=>{
   if(data.cursors.includes(cursor))throw new ApiError('PREPARATION_HISTORY_RESPONSE_INVALID');
   const page=await readPreparationHistoryPage(client,pid,assignment.ref,cursor,isCurrent);
   if(!isCurrent()||!page)return;
   if(page.items.some(item=>data.preparations.items.some(prior=>prior.ref.id===item.ref.id))||page.nextCursor!==null&&(page.nextCursor===cursor||data.cursors.includes(page.nextCursor)))throw new ApiError('PREPARATION_HISTORY_RESPONSE_INVALID');
   appliedPage.current={data,cursor};
   setTargets({...data,preparations:{...page,items:[...data.preparations.items,...page.items]},cursors:[...data.cursors,cursor]});
  },isCurrent);
 }
 function edit(field:'stage'|'preparation'|'binding'|'reason',value:string){if(!input||locked||working.current||!active()||preparationChoice.current.input!==input)return;candidateConsent.current=null;setCandidateConfirmation(null);setSelection({...input,[field]:value});clearOriginal();setAck(false);}
 async function prepare(){
  const consent=candidateConsent.current;
  if(!input||!data||locked||data.receiptCandidate&&(!consent||consent.data!==data||consent.input!==input))return;
  const isCurrent=()=>(data.hint?hintCurrent():active())&&current.current===buffer
   &&preparationChoice.current.data===data&&preparationChoice.current.input===input&&(!data.receiptCandidate||same(data.pageScope,pageScope())&&candidateConsent.current===consent);
  await run(async()=>{
   const stage=data.queue?.items.find(v=>v.requestRef.id===input.stage),candidate=data.receiptCandidate;
   const stageRef=stage?.requestRef??(candidate&&input.stage===candidate.ref.id?candidate.ref:null);
   const prep=data.preparations.items.find(v=>v.ref.id===input.preparation);
   const binding=data.bindings.bindings.find(v=>v.ref.id===input.binding);
   if(!stageRef||!prep||!binding)throw new ApiError('SOURCE_REQUIRED',412);
   const selected=await readPreparationOriginal(client,pid,assignment.ref,prep,isCurrent);
   if(!isCurrent()||!selected)return;
   if(selected.snapshot.intent.connectionKind!=='REGISTERED_DEFINITION'||!same(selected.snapshot.intent.roleBindingRef,binding.ref))throw new ApiError('EXECUTION_START_ORIGIN_SOURCE_MISMATCH',409);
   const exact=await client.get<PreparationRecord>(`/api/v1/projects/${pid}/role-bindings/${binding.ref.id}/versions/${binding.ref.version}`);
   if(!isCurrent())return;
   if(!same(exact,binding)||!same(exact.snapshot.assignmentRef,assignment.ref)||exact.snapshot.connectionKind!=='REGISTERED_DEFINITION'||exact.snapshot.state!=='RESERVED'||exact.snapshot.externalSessionHandleRef!==null)throw new ApiError('RESPONSE_INVALID');
   const packet=await prepareOrigin(client,session,pid,{stageRequestRef:stageRef,assignmentRef:assignment.ref,preparationRef:prep.ref,roleBindingRef:binding.ref},input.reason,isCurrent,async()=>{
    try{
     const queue=await readStageQueue(client,pid,isCurrent);if(!isCurrent()||!queue)return false;
     if(!(candidate?!!verifiedStageQueueItem(queue,candidate):queue.items.some(item=>same(item,stage))))throw new ApiError('STAGE_START_QUEUE_NOT_FOUND',409);
     return true;
    }catch(cause){if(!isCurrent())return false;if(!candidate||!isQueueViewLimit(cause))throw cause;
     return !!hint.receipt&&same(candidate.ref,hint.receipt.ref)&&same(candidate.snapshot,hint.receipt.snapshot)&&!!await readWaitingStageReceiptCandidate(hint.receipt,assignment,session,isCurrent)&&isCurrent();
    }
   });
   if(!isCurrent()||!packet)return;
   if(data.receiptCandidate)receiptCandidatePackets.set(packet,{owner,hint,pageScope:data.pageScope});
   change.current(key,prior=>prior===buffer&&!prior?.packet&&isCurrent()?{packet,phase:'PREPARED',receipt:null,failure:null}:prior);
   saveConsent.current=null;
   setAck(false);
  },isCurrent);
 }
 async function save(){const packet=buffer?.packet;if(!packet||buffer.phase!=='PREPARED'||!ack||!candidatePacketCurrent(packet)||receiptCandidatePackets.has(packet)&&saveConsent.current!==packet)return;await run(async()=>{clearOriginal();const currentPacket=forPacket(packet);try{const view=await sendOrigin(client,session,packet,currentPacket,()=>{if(!currentPacket()||receiptCandidatePackets.has(packet)&&saveConsent.current!==packet)return false;return change.current(key,prior=>prior?.packet===packet&&prior.phase==='PREPARED'?{...prior,phase:'SENDING',failure:null}:prior);},receipt=>{change.current(key,prior=>prior?.packet===packet?{...prior,phase:'SAVED',receipt,failure:null}:prior);});if(currentPacket()&&view)setOriginal({owner,value:view,revision:originalRevision.current});}catch(cause){const e=cause instanceof ApiError?cause:new ApiError('EXECUTION_START_ORIGIN_RESPONSE_INVALID'),phase=packetStatus(packet);if(currentPacket())failure(e);change.current(key,prior=>prior?.packet===packet?{...prior,phase:phase==='SAVED'?'SAVED':phase==='UNKNOWN'?'UNKNOWN':'PREPARED',failure:e.code}:prior);if(currentPacket())throw e;}finally{if(packetStatus(packet)==='UNKNOWN')change.current(key,prior=>prior?.packet===packet&&prior.phase==='SENDING'?{...prior,phase:'UNKNOWN'}:prior);}},forPacket(packet));}
 function saveAcknowledgement(checked:boolean){const packet=buffer?.packet;if(packet&&receiptCandidatePackets.has(packet)){if(working.current&&checked||!active()||current.current?.packet!==packet||!candidatePacketCurrent(packet))return;saveConsent.current=checked?packet:null;}setAck(checked);}
 function canDiscardPrepared(){const packet=buffer?.packet;return !!packet&&buffer.phase==='PREPARED'&&packetStatus(packet)==='PREPARED'&&!buffer.receipt&&current.current===buffer&&active()&&hintRef.current===hint&&same(renderedPageScope,pageScope())&&!working.current;}
 function discardPrepared(){const packet=buffer?.packet;if(!packet||!canDiscardPrepared())return;const proof=receiptCandidatePackets.get(packet);if(!change.current(key,prior=>canDiscardPrepared()&&prior===buffer&&prior.packet===packet&&prior.phase==='PREPARED'&&receiptCandidatePackets.get(packet)===proof&&packetStatus(packet)==='PREPARED'?null:prior))return;saveConsent.current=null;setAck(false);candidateConsent.current=null;setCandidateConfirmation(null);setTargets(null);setSelection(null);setError(null);}
 async function reread(){const ref=buffer?.receipt?.data?.ref;if(originRef(ref))await open(ref);}
 async function page(cursor:string|null){await run(async()=>{clearOriginal();setHistory(null);const value=await readOriginHistory(client,pid,assignment.ref,cursor,active);if(active()&&value)setHistory({owner,value});});}
 async function open(ref:OriginPage['items'][number]['ref']){await run(async()=>{clearOriginal();const value=await readOrigin(client,pid,ref,assignment.ref,active);if(active()&&value)setOriginal({owner,value,revision:originalRevision.current});});}
 return <section aria-label="START 원자료 저장" style={{fontSize:12}}><h3>START 원자료 저장 <span title="선택한 원자료와 미발급 예약만 보관합니다. Agent 실행·허가·시작 완료를 뜻하지 않습니다." tabIndex={0}>ⓘ</span></h3><p>명시 선택 → 등록 준비 → 명시 저장 · credential 미발급</p>
  {waitingHint?<button type="button" disabled={busy||locked} onClick={()=>void chooseHint()}>이 영수증의 대기 요청 원장에서 확인·선택</button>:null}
  <button type="button" disabled={busy||locked} onClick={()=>void choose()}>원자료 선택 목록 조회</button>
  {data&&input?<fieldset disabled={busy||locked}><label>대기 요청<select aria-label="대기 요청" value={input.stage} onChange={e=>edit('stage',e.target.value)}><option value="">명시 선택</option>{data.queue?.items.map(v=><option key={v.requestRef.id} value={v.requestRef.id}>요청 {v.sequence} · {v.requestRef.id} · 임무 연결 미검산</option>)}{data.receiptCandidate?<option value={data.receiptCandidate.ref.id}>보관 영수증 {data.receiptCandidate.ref.id} · 현재 WAITING 미검산</option>:null}</select></label><label>등록 준비<select aria-label="등록 준비" value={input.preparation} onChange={e=>edit('preparation',e.target.value)}><option value="">명시 선택</option>{data.preparations.items.map(v=><option key={v.ref.id} value={v.ref.id}>{v.mode} · {v.ref.id}</option>)}</select></label><label>책임 예약<select aria-label="책임 예약" value={input.binding} onChange={e=>edit('binding',e.target.value)}><option value="">명시 선택</option>{data.bindings.bindings.filter(v=>v.snapshot.connectionKind==='REGISTERED_DEFINITION'&&same(v.snapshot.assignmentRef,assignment.ref)).map(v=><option key={v.ref.id} value={v.ref.id}>{v.ref.id} · 논리 세션 예약</option>)}</select></label><label>기록 이유<textarea aria-label="기록 이유" value={input.reason} onChange={e=>edit('reason',e.target.value)}/></label>{data.receiptCandidate?<><p role="status">대기 요청 현재성 미검산 영수증 후보 · 명시 저장 시 서버가 원 WAITING·임무·준비를 대조하며 취소·변경된 요청은 거절합니다.</p><label><input type="checkbox" aria-label="미검산 대기 영수증 후보 확인" checked={candidateConfirmed} onChange={e=>{if((!working.current||!e.target.checked)&&hintCurrent()&&same(data.pageScope,pageScope())&&preparationChoice.current.data===data&&preparationChoice.current.input===input){const consent=e.target.checked?{data,input}:null;candidateConsent.current=consent;setCandidateConfirmation(consent);}}}/>대기 요청의 현재성은 명시 저장 시 검산함을 확인했습니다</label></>:null}<button type="button" disabled={!!data.receiptCandidate&&!candidateConfirmed} onClick={()=>void prepare()}>등록 준비 고정</button></fieldset>:null}
  {data?.preparations.nextCursor?<button type="button" disabled={busy||locked} onClick={()=>void previousPreparations()}>이전 등록 준비 조회</button>:null}
  {buffer?.packet?<div><p>원 명령 {buffer.packet.command.commandId} · 상태 {buffer.phase}</p>{buffer.phase==='PREPARED'?<><label><input type="checkbox" checked={ack} onChange={e=>saveAcknowledgement(e.target.checked)}/>선택 원자료의 비실행 저장을 확인했습니다</label><button type="button" disabled={busy||!ack||!candidatePacketCurrent(buffer.packet)} onClick={()=>void save()}>원자료 명시 저장</button></>:null}{buffer.phase==='PREPARED'?<button type="button" disabled={busy||!canDiscardPrepared()} onClick={discardPrepared}>{receiptCandidatePackets.has(buffer.packet)?'미전송 영수증 후보 준비 폐기':'미전송 원자료 준비 폐기'}</button>:null}{buffer.phase==='UNKNOWN'?<p role="status">결과 불명 · 원 명령·본문 보존 · 새 저장을 보내지 않습니다. 보호 이력에서 확인하세요.</p>:null}{buffer.receipt?<><p>확정 receipt 보존 · {buffer.receipt.data.ref.id}</p><button type="button" disabled={busy} onClick={()=>void reread()}>저장 원문 다시 조회</button></>:null}</div>:null}
  <button type="button" disabled={busy} onClick={()=>void page(null)}>보호 이력 조회</button>{list?<div><ul>{list.items.map(v=><li key={v.ref.id}><button type="button" disabled={busy} onClick={()=>void open(v.ref)}>{v.recordedAt} · {v.ref.id} 원문 조회</button></li>)}</ul>{list.nextCursor?<button type="button" disabled={busy} onClick={()=>void page(list.nextCursor)}>이전 이력</button>:null}{!list.items.length?<p>저장된 원자료 없음</p>:null}</div>:null}
  {busy?<p role="status">원 보호 자료 확인 중</p>:null}{error?<p role="alert">{error}</p>:null}{detail&&shown?<article aria-label="START 원자료 보호 원문"><h4>원자료 저장 · credential 미발급</h4><p>실행 {shown.snapshot.execution.executionId} · 원자료 {shown.ref.id} · SHA {shown.ref.contentHash}</p><p>기록 이유: {shown.snapshot.reason}</p><p>원 기한 {shown.snapshot.expiresAt} · 현재 실행 상태 미검산</p><ul>{shown.snapshot.unresolvedChecks.map((v:string)=><li key={v}>{v}</li>)}</ul>
   <StartOriginPreparationOriginal key={detail.revision} client={client} origin={shown} active={()=>active()&&originalRevision.current===detail.revision} onAuthenticationLost={()=>unavailable.current('AUTH_REQUIRED')}/>
   <button type="button" onClick={clearOriginal}>START 원자료 보호 원문 닫기</button>
  </article>:null}
  {normalStarts?<NormalStartPanel client={client} session={session} assignment={assignment} selected={shown??null} selectionIdentity={detail} storage={normalStarts} isSourceCurrent={active} onAuthenticationLost={()=>{if(active())unavailable.current('AUTH_REQUIRED');}}/>:null}
 </section>;
}
