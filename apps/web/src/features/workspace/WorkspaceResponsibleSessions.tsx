import type {NormalInitialUnderstandingReviewStorage} from '../session-detail/understanding-review-write.ts';
import {ReservedSessionConnectionDefinition} from './ReservedSessionConnectionDefinition.tsx';
import {readDefinition} from '../connections/connection-definition-api.ts';
import {RegisteredReservationRejected} from './responsible-session-api.ts';
import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { ApiClient, ApiError } from '../../api/client.ts';
import { documentControl, type DocumentSession } from '../design-trace/editor-api.ts';
import type { ConfirmedAssignmentView } from './assignment-confirmation-api.ts';
import { listCandidates, readCandidate, type CandidateHit } from '../connections/api.ts';
import { ordered } from '../knowledge/review-view.ts';
import {readProviderClaimPageHistory,readProviderClaimReceiptHistory,type ProviderClaimPageHistory,type ProviderClaimHistory,type ProviderClaimHistoryQuery} from './provider-claim-receipt-api.ts';
import {ClaimUnderstandingHistory} from './ClaimUnderstandingHistory.tsx';
import {readNormalClaimRangeHistory,type ExactWorkReviewCandidate,type NormalClaimRangeHistoryBasis} from './claim-understanding-history.ts';
import {NormalUnderstandingRangeHistory} from './NormalUnderstandingRangeHistory.tsx';
import {readReviewedNormalUnderstandingRangeHistory,verifyReviewedNormalUnderstandingRangeHistory,type ReviewedNormalUnderstandingRangeHistoryRequest} from './NormalUnderstandingDiscovery.tsx';
import {createNormalUnderstandingRangeCommands,NormalUnderstandingDiscovery,readNormalUnderstandingMetadata,readNormalUnderstandingRange,readNormalUnderstandingRangeHistory,type NormalUnderstandingMetadataReader,type NormalUnderstandingRangeReader,type NormalUnderstandingRangeHistoryReader} from './NormalUnderstandingDiscovery.tsx';
import {ResponsibleSessionApprovalEditor} from './ResponsibleSessionApprovalEditor.tsx';
import {checkResponsibleSessionApprovalBinding,markResponsibleSessionDispatch,settleResponsibleSessionWrite} from './responsible-session-approval.ts';
import {updateResponsibleSessionApprovalBuffer} from './responsible-session-api.ts';
import { assertResponsibleSessionInputCurrent, canPrepareResponsibleSessionInput, prepareResponsibleSessionInput, prepareResponsibleSessionAction, readResponsibleSessionState, readSavedResponsibleSession, sendResponsibleSessionAction, type PreparationRecord, type ResponsibleSessionAction, type ResponsibleSessionBuffer, type ResponsibleSessionState } from './responsible-session-api.ts';

type WorkReviewSubject=Pick<ExactWorkReviewCandidate,'assignmentRef'|'roleBindingRef'>;
type SelectWorkReview=(candidate:ExactWorkReviewCandidate)=>void;

export function WorkspaceResponsibleSessions({onWorkReviewCandidate,normalInitialReviews,client,confirmed,session,buffer,onChange,owner,busy,run}:{onWorkReviewCandidate?:SelectWorkReview;normalInitialReviews?:NormalInitialUnderstandingReviewStorage;client:ApiClient;confirmed:ConfirmedAssignmentView;session:DocumentSession;buffer:ResponsibleSessionBuffer|null;onChange:Dispatch<SetStateAction<ResponsibleSessionBuffer|null>>;owner:boolean;busy:boolean;run:(action:()=>Promise<void>)=>void}) {
  const [state,setState]=useState<ResponsibleSessionState|null>(null),[candidates,setCandidates]=useState<CandidateHit[]>([]),[nextCursor,setNextCursor]=useState<string|null>(null),[notice,setNotice]=useState<string|null>(null);
  const stateStamp=useRef({epoch:-1,revision:-1}),stateRevision=useRef(0);
  const acknowledgements=useRef<Array<{next:ResponsibleSessionBuffer;ticket:number;resolve:(ok:boolean)=>void}>>([]);
  const [definitionInput,setDefinitionInput]=useState({id:'',version:'1',hash:''});const selectionRevision=useRef(0);
  const alive=useRef(true),epoch=useRef(0),currentBuffer=useRef(buffer);currentBuffer.current=buffer;
  const identity=()=>ordered([confirmed.projectId,confirmed.ref,session.user.id,session.clientId,session.csrfToken,owner]);
  const context=useRef({client,transport:client.transport,session,confirmed,owner,identity:identity()});
  if(context.current.client!==client||context.current.transport!==client.transport||context.current.session!==session||context.current.confirmed!==confirmed||context.current.owner!==owner||context.current.identity!==identity()){epoch.current++;context.current={client,transport:client.transport,session,confirmed,owner,identity:identity()};}
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;epoch.current++;for(const a of acknowledgements.current)a.resolve(false);acknowledgements.current=[];};},[]);
  const active=(ticket:number)=>alive.current&&ticket===epoch.current&&context.current.client===client&&context.current.transport===client.transport&&context.current.identity===identity();
  useEffect(()=>{const waiting=acknowledgements.current;acknowledgements.current=[];for(const a of waiting){if(!active(a.ticket)||buffer?.bindingId!==a.next.bindingId)a.resolve(false);else if(buffer&&ordered(buffer)===ordered(a.next))a.resolve(true);else acknowledgements.current.push(a);}},[buffer,client,session,confirmed,owner]);
  const sameOwner=!buffer||buffer.projectId===confirmed.projectId&&buffer.ownerUserId===session.user.id&&buffer.ownerClientId===session.clientId;
  const bound=sameOwner&&(!buffer||ordered(buffer.assignmentRef)===ordered(confirmed.ref));
  const projectId=confirmed.projectId,assignmentKey=ordered(confirmed.ref),transport=client.transport;
  const userId=session.user.id,{clientId,csrfToken}=session,showMetadata=owner&&bound;
  const savedReservation=buffer?.savedReceipt?.snapshot?.state==='RESERVED'&&buffer.savedReceipt.snapshot.executionAuthorized===false&&buffer.savedReceipt.snapshot.dispatchPerformed===false?buffer.savedReceipt:null;
  const savedScope=savedReservation&&bound?ordered([projectId,assignmentKey,userId,clientId,savedReservation.ref,savedReservation.snapshot]):null;
  const savedOwner=useMemo(()=>({client,transport,scope:savedScope}),[client,transport,savedScope]),savedOwnerRef=useRef(savedOwner);savedOwnerRef.current=savedOwner;
  const savedRequest=useRef<{owner:object}|null>(null),[savedOriginal,setSavedOriginal]=useState<{owner:object;record:PreparationRecord|null;error:string|null;pending:boolean}|null>(null);
  const readerOwner=useRef<NormalUnderstandingMetadataReader|undefined>(undefined);
  const metadataReader=useMemo<NormalUnderstandingMetadataReader|undefined>(()=>{
    if(!showMetadata)return undefined;
    const authorization={user:{id:userId},clientId,csrfToken};
    const reader:NormalUnderstandingMetadataReader=async(request,signal)=>{
      const current=()=>alive.current&&readerOwner.current===reader&&client.transport===transport&&!signal.aborted;
      if(!current()||request.projectId!==projectId||ordered(request.assignmentRef)!==assignmentKey)throw new ApiError('DISCOVERY_SCOPE_CHANGED');
      return readNormalUnderstandingMetadata(client,authorization,request,signal,current);
    };
    return reader;
  },[client,transport,userId,clientId,csrfToken,projectId,assignmentKey,showMetadata]);
  readerOwner.current=metadataReader;
  const rangeReaderOwner=useRef<NormalUnderstandingRangeReader|undefined>(undefined);
  const rangeReader=useMemo<NormalUnderstandingRangeReader|undefined>(()=>{
    if(!showMetadata)return undefined;
    const authorization={user:{id:userId},clientId,csrfToken};
    const reader:NormalUnderstandingRangeReader=async(input,signal)=>{
      const current=()=>alive.current&&rangeReaderOwner.current===reader&&client.transport===transport&&!signal.aborted
        &&context.current.client===client&&context.current.owner&&context.current.session.user.id===userId&&context.current.session.clientId===clientId&&context.current.session.csrfToken===csrfToken
        &&context.current.confirmed.projectId===projectId&&ordered(context.current.confirmed.ref)===assignmentKey;
      if(!current()||input.request.projectId!==projectId||ordered(input.request.assignmentRef)!==assignmentKey)throw new ApiError('DISCOVERY_SCOPE_CHANGED');
      return readNormalUnderstandingRange(client,authorization,input,signal,current);
    };
    return reader;
  },[client,transport,userId,clientId,csrfToken,projectId,assignmentKey,showMetadata]);
  rangeReaderOwner.current=rangeReader;
  const historyReaderOwner=useRef<NormalUnderstandingRangeHistoryReader|undefined>(undefined);
  const rangeHistoryReader=useMemo<NormalUnderstandingRangeHistoryReader|undefined>(()=>{
    if(!showMetadata)return undefined;
    const authorization={user:{id:userId},clientId,csrfToken};
    const reader:NormalUnderstandingRangeHistoryReader=async(input,signal)=>{
      const current=()=>alive.current&&historyReaderOwner.current===reader&&client.transport===transport&&!signal.aborted
        &&context.current.client===client&&context.current.owner&&context.current.session.user.id===userId&&context.current.session.clientId===clientId&&context.current.session.csrfToken===csrfToken
        &&context.current.confirmed.projectId===projectId&&ordered(context.current.confirmed.ref)===assignmentKey;
      if(!current()||input.request.projectId!==projectId||ordered(input.request.assignmentRef)!==assignmentKey)throw new ApiError('DISCOVERY_SCOPE_CHANGED');
      return readNormalUnderstandingRangeHistory(client,authorization,input,signal,current);
    };
    return reader;
  },[client,transport,userId,clientId,csrfToken,projectId,assignmentKey,showMetadata]);
  historyReaderOwner.current=rangeHistoryReader;

  const rangeOwner=useRef<ReturnType<typeof createNormalUnderstandingRangeCommands>|undefined>(undefined);
  const rangeCommands=useMemo(()=>{
    if(!showMetadata)return undefined;
    const commands=createNormalUnderstandingRangeCommands(client,{user:{id:userId},clientId,csrfToken},projectId,assignmentKey,
      ()=>alive.current&&rangeOwner.current===commands&&client.transport===transport);
    return commands;
  },[client,transport,userId,clientId,csrfToken,projectId,assignmentKey,showMetadata]);
  rangeOwner.current=rangeCommands;
  const update=(change:(b:ResponsibleSessionBuffer)=>ResponsibleSessionBuffer)=>{const binding=buffer?.bindingId;onChange(current=>current&&current.bindingId===binding?change(current):current);};
  const coordinator=state?.roles.find(r=>r.snapshot.kind==='COORDINATOR'),stage=state?.roles.find(r=>r.snapshot.kind==='STAGE_OWNER');
  const reservationKind=buffer?.reservationKind===undefined?'STAGE_OWNER':buffer.reservationKind,selectedRole=reservationKind==='COORDINATOR'?coordinator:reservationKind==='STAGE_OWNER'?stage:undefined,binding=state?.bindings.find(r=>ordered(r.snapshot.roleRef)===ordered(selectedRole?.ref??null));
  const bindingAction:ResponsibleSessionAction=reservationKind==='COORDINATOR'?'BIND_COORDINATOR':'BIND';
  const locked=busy||!owner||!bound||!!buffer?.pending||!!buffer?.uncertain;
  const retainedSelection=buffer&&bound&&!binding&&buffer.connectionKind===undefined&&buffer.connectionRef&&!candidates.some(hit=>ordered(hit.ref)===ordered(buffer.connectionRef))?buffer.connectionRef:null;
  async function load(cursor:string|null=null) {
    const ticket=epoch.current,revision=++stateRevision.current;setState(null);setNotice(null);
    try{const [value,page]=await Promise.all([readResponsibleSessionState(client,confirmed),listCandidates(client,confirmed.projectId,'CONNECTION_CANDIDATE',cursor)]);
    if(!active(ticket))return;stateStamp.current={epoch:ticket,revision};setState(value);setCandidates(page.items);setNextCursor(page.nextCursor);}catch(e){if(active(ticket))throw e;}
  }
  async function readSavedOriginal() {
    if(!owner||!bound||!savedReservation||savedRequest.current?.owner===savedOwner)return;
    const ticket=epoch.current,readOwner=savedOwner,original=structuredClone(savedReservation),request={owner:readOwner};savedRequest.current=request;setSavedOriginal({owner:readOwner,record:null,error:null,pending:true});
    const current=()=>active(ticket)&&savedOwnerRef.current===readOwner&&ordered(currentBuffer.current?.savedReceipt)===ordered(original);
    try{const record=await readSavedResponsibleSession(client,confirmed,original,current);if(record&&current())setSavedOriginal({owner:readOwner,record,error:null,pending:false});}
    catch(cause){if(current()){const failure=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');setSavedOriginal({owner:readOwner,record:null,error:failure.code,pending:false});throw failure;}}
    finally{if(savedRequest.current===request){savedRequest.current=null;if(savedOwnerRef.current===readOwner)setSavedOriginal(value=>value?.owner===readOwner?{...value,pending:false}:value);}}
  }
  async function prepare() {
    if(!owner||!canPrepareResponsibleSessionInput(buffer,confirmed,session))return;
    if(buffer?.dirty&&!confirm('미저장 책임 세션 입력을 버리고 새로 준비할까요?'))return;
    const ticket=epoch.current;let revision=stateRevision.current;const result=await prepareResponsibleSessionInput(client,confirmed,session,buffer,()=>{revision=++stateRevision.current;setState(null);setNotice(null);},()=>active(ticket));
    if(!result)return;const old=buffer?.bindingId;onChange(value=>value?.bindingId===old?result.buffer:value);stateStamp.current={epoch:ticket,revision};setState(result.state);
  }
  async function write(action:ResponsibleSessionAction) {
    if(!owner||!bound||!buffer||!state)return;
    const ticket=epoch.current,original=buffer,previouslyUncertain=!!buffer.pending&&buffer.uncertain;
    let acknowledged=false,dispatched=false,registeredDispatch=false,current=original;
    const settle=async(next:ResponsibleSessionBuffer)=>{const expected=current;const accepted=await new Promise<boolean>(resolve=>{const ack={next,ticket,resolve};acknowledgements.current.push(ack);onChange(previous=>{if(active(ticket)&&previous&&ordered(previous)===ordered(expected))return next;queueMicrotask(()=>{acknowledgements.current=acknowledgements.current.filter(a=>a!==ack);resolve(false);});return previous;});});if(accepted)current=next;return accepted;};
    try {
      const generation=await documentControl(client,confirmed.projectId,session);if(!active(ticket))return;
      assertResponsibleSessionInputCurrent(currentBuffer.current,original);
      if(generation!==buffer.controlGeneration)throw new ApiError('CONTROL_GENERATION_CONFLICT',409);
      if((action==='BIND'||action==='BIND_COORDINATOR')&&!buffer.pending) {
        if(!buffer.connectionRef)throw new ApiError('RESPONSIBLE_SESSION_SELECTION_REQUIRED');
        if(buffer.connectionKind==='REGISTERED_DEFINITION')await readDefinition(client,confirmed.projectId,buffer.connectionRef,()=>active(ticket));
        else {const candidate=await readCandidate(client,confirmed.projectId,buffer.connectionRef);if(candidate.expired||candidate.candidate.kind!=='CONNECTION_CANDIDATE')throw new ApiError('CONNECTION_CANDIDATE_NOT_CURRENT',412);}
        if(!active(ticket))return;
      }
      assertResponsibleSessionInputCurrent(currentBuffer.current,original);
      const command=prepareResponsibleSessionAction(buffer,session,confirmed,state,action);
      if(command.approvalRef!==null)await checkResponsibleSessionApprovalBinding(buffer,session);
      if(!active(ticket))return;
      assertResponsibleSessionInputCurrent(currentBuffer.current,original);
      if(!await settle(markResponsibleSessionDispatch(current,command))||!active(ticket))return;
      dispatched=true;registeredDispatch=command.operation==='bindResponsibleSession'&&command.payload.connectionKind==='REGISTERED_DEFINITION';
      const receipt=await sendResponsibleSessionAction(client,command,session);acknowledged=true;
      if(!active(ticket))return;
      if(!await settle(settleResponsibleSessionWrite(current,receipt))||!active(ticket))return;
      setNotice((action==='BIND'||action==='BIND_COORDINATOR'?'책임 세션 예약':'역할 정의')+' 저장 영수증 확인 · v'+receipt.ref.version+' · 실제 Agent 실행 아님');
      const revision=++stateRevision.current;setState(null);const refreshed=await readResponsibleSessionState(client,confirmed);
      if(active(ticket)){stateStamp.current={epoch:ticket,revision};setState(refreshed);}
    }catch(cause){
      if(!active(ticket))return;
      const failure=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');
      await settle({...current,failure:{code:failure.code,status:failure.status},uncertain:acknowledged?false:!dispatched?previouslyUncertain:registeredDispatch?previouslyUncertain||!(failure instanceof RegisteredReservationRejected):previouslyUncertain||failure.status===0||failure.status>=500||failure.code==='RESPONSE_INVALID'||failure.code==='RESPONSIBLE_SESSION_INTEGRITY_FAILED'});
      throw failure;
    }
  }
  function editDefinitionInput(field:'id'|'version'|'hash',value:string){if(locked||binding)return;selectionRevision.current++;setDefinitionInput(old=>({...old,[field]:value}));update(b=>({...b,connectionKind:'REGISTERED_DEFINITION',connectionRef:null,dirty:true,failure:null}));}
  async function selectDefinition(){if(locked||binding||!buffer)return;const ticket=epoch.current,revision=selectionRevision.current,original=buffer,raw={...definitionInput};try{const value=await readDefinition(client,confirmed.projectId,{id:raw.id,version:Number(raw.version),contentHash:raw.hash},()=>active(ticket)&&selectionRevision.current===revision);if(!active(ticket)||selectionRevision.current!==revision)return;assertResponsibleSessionInputCurrent(currentBuffer.current,original);onChange(previous=>previous&&ordered(previous)===ordered(original)?{...previous,connectionKind:'REGISTERED_DEFINITION',connectionRef:structuredClone(value.ref),dirty:true,failure:null}:previous);setNotice('등록 정의 고정 원문 선택 · NOT_READY/UNVERIFIED · 예약 설정이며 실행 허가 아님');}catch(e){if(active(ticket)&&selectionRevision.current===revision)throw e;}}
  const pendingRoles=state?.roles.filter(r=>ordered(r.ref)===ordered(buffer?.pending?.payload.roleRef))??[],pendingRole=pendingRoles.length===1?pendingRoles[0]:undefined;
  const retryAction:ResponsibleSessionAction|null=buffer?.pending?.operation==='bindResponsibleSession'?(pendingRole?.snapshot.kind==='COORDINATOR'?'BIND_COORDINATOR':pendingRole?.snapshot.kind==='STAGE_OWNER'?'BIND':null):buffer?.pending?.payload.kind==='STAGE_OWNER'?'STAGE_OWNER':'COORDINATOR';
  const definitionEpoch=epoch.current,definitionRevision=stateRevision.current;
  return <section aria-label="책임 역할·예약 세션"><h6>책임 역할·예약 세션</h6>
    <p>확정 임무의 총괄 또는 단계책임자와 Anvil 예약 세션을 연결합니다. RESERVED는 외부 Agent 세션 생성·실행 허가가 아닙니다.</p>
    <button disabled={busy} onClick={()=>run(()=>load())}>현재 역할·예약·준비 이력 조회</button>
    <button disabled={busy||!owner||!canPrepareResponsibleSessionInput(buffer,confirmed,session)} onClick={()=>run(prepare)}>책임 세션 입력 준비</button>
    {!bound?<p role="alert">{sameOwner?'이전 임무 입력이 보관돼 있습니다. 미확인 명령이 없다면 입력 준비로 이 임무를 명시 선택하세요.':'다른 임무·주체의 미저장 입력/명령이 보관돼 있습니다. 원 대상으로 돌아가 확인하세요.'}</p>:null}
    {notice?<p role="status">{notice}</p>:null}
    {buffer&&bound&&buffer.savedReceipt?<><p role="status">책임 역할·예약 저장 영수증 보관 · {buffer.savedReceipt.ref.id} · v{buffer.savedReceipt.ref.version} · 정확 상태는 별도 조회 · 실제 Agent 실행 아님</p>{savedReservation?<button type="button" disabled={busy||!owner||savedRequest.current?.owner===savedOwner} onClick={()=>run(readSavedOriginal)}>저장 예약 원문 정확 조회</button>:null}</>:null}
    {savedOriginal?.owner===savedOwner&&savedOriginal.error?<p role="alert">저장 예약 원문 확인 실패 · {savedOriginal.error} · 원 영수증 보존</p>:null}
    {savedOriginal?.owner===savedOwner&&savedOriginal.record?<article aria-label="저장 예약 원문 정확 조회 결과"><p>저장 영수증과 동일한 RESERVED 원문 · 현재 head·실행·재개 증거 아님</p><p>프로젝트 {savedOriginal.record.projectId} · 원 ref {savedOriginal.record.ref.id} · v{savedOriginal.record.ref.version} · {savedOriginal.record.ref.contentHash}</p><p>원 임무 <code>{ordered(savedOriginal.record.snapshot.assignmentRef)}</code></p><p>원 역할 <code>{ordered(savedOriginal.record.snapshot.roleRef)}</code> · 예약 세션 <code>{ordered(savedOriginal.record.snapshot.sessionRef)}</code> · 연결 <code>{ordered(savedOriginal.record.snapshot.connectionRef)}</code></p><details><summary>원 예약 이유</summary><p>{savedOriginal.record.snapshot.reason}</p></details><p>실행 권위 false · 전달 false</p></article>:null}
    {buffer&&bound&&buffer.closedResponsibleApprovals?.length?<p>종결 승인 {buffer.closedResponsibleApprovals.length}건 · 원명령·요청 이력 보관 · 실행 허가 아님</p>:null}
    {buffer&&bound&&buffer.pending?<p>원 명령 {buffer.pending.commandId} · {buffer.uncertain?'결과 미확인 · 새 명령을 만들지 않습니다':'명시 거절 · 원 입력 보존'}</p>:null}
    {buffer&&bound&&buffer.failure?<p role="alert">{buffer.failure.code} · {buffer.uncertain?'적용 여부 미확인':'응답 계약 확인 필요'}</p>:null}
    {buffer&&bound&&buffer.pending&&(buffer.responsibleApproval||buffer.failure?.code==='APPROVAL_REQUIRED'&&buffer.failure.status===412&&!buffer.uncertain)?<ResponsibleSessionApprovalEditor client={client} session={session} buffer={buffer} disabled={busy||!owner} update={change=>onChange(previous=>updateResponsibleSessionApprovalBuffer(previous,buffer,change))} onAuthenticationLost={()=>run(async()=>{throw new ApiError('AUTH_REQUIRED',401);})}/>:null}
    {state?<><p>현재성 별도 재검사 필요 · 실행 허가 없음 · Agent 전달 없음</p>
      <ul>{state.roles.map(role=><li key={role.ref.id}>{role.snapshot.kind==='COORDINATOR'?'총괄':'선택 단계 책임자'} 역할 · {role.ref.id} · v{role.ref.version}</li>)}</ul>
      {binding?<p>책임 세션 {binding.snapshot.sessionRef.id} · RESERVED · 결박 v{binding.ref.version}<br/>현재 결박 임무 {binding.snapshot.assignmentRef.id} · v{binding.snapshot.assignmentRef.version} · 도구 교체는 별도 이전 절차입니다.</p>:<p>선택 역할에 저장된 책임 세션 예약이 없습니다.</p>}
      {binding?.snapshot.connectionKind==='REGISTERED_DEFINITION'&&binding.snapshot.state==='RESERVED'&&stateStamp.current.epoch===epoch.current&&stateStamp.current.revision===stateRevision.current?<ReservedSessionConnectionDefinition client={client} projectId={confirmed.projectId} connectionRef={binding.snapshot.connectionRef} buffer={buffer} contextKey={ordered([definitionEpoch,definitionRevision,binding.ref,buffer])} disabled={busy||!bound} isCurrent={()=>active(definitionEpoch)&&stateRevision.current===definitionRevision&&currentBuffer.current===buffer} onAuthenticationLost={()=>run(async()=>{throw new ApiError('AUTH_REQUIRED',401);})}/>:null}
      {binding&&owner?<ProviderClaimHistoryPanel onWorkReviewCandidate={busy?undefined:onWorkReviewCandidate} workSubject={{assignmentRef:confirmed.ref,roleBindingRef:binding.ref}} key={ordered([confirmed.projectId,confirmed.ref,binding.ref,binding.snapshot.sessionRef,session.user.id,session.clientId])} client={client} projectId={confirmed.projectId} sessionRef={binding.snapshot.sessionRef} subjectKey={session.user.id+':'+session.clientId} normalSession={session} normalActive={()=>bound&&active(definitionEpoch)&&stateRevision.current===definitionRevision&&context.current.owner} onAuthenticationLost={()=>run(async()=>{throw new ApiError('AUTH_REQUIRED',401);})}/>:null}
      {buffer&&bound?<><fieldset disabled={locked}><legend>현재 임무 책임자 정의·예약</legend>
        <label>예약 대상 역할<select aria-label="예약 대상 역할" value={['COORDINATOR','STAGE_OWNER'].includes(reservationKind)?reservationKind:''} onChange={e=>{if(locked)return;const kind=e.target.value;if(kind!=='COORDINATOR'&&kind!=='STAGE_OWNER')return;const role=state.roles.find(r=>r.snapshot.kind===kind),existing=state.bindings.find(b=>ordered(b.snapshot.roleRef)===ordered(role?.ref??null));update(b=>{const {connectionKind,...rest}=b;return {...rest,reservationKind:kind,connectionRef:existing?structuredClone(existing.snapshot.connectionRef):null,...(existing?.snapshot.connectionKind==='REGISTERED_DEFINITION'?{connectionKind:'REGISTERED_DEFINITION' as const}:{}),dirty:true,failure:null};});}}><option value="STAGE_OWNER">선택 단계 책임자</option><option value="COORDINATOR">총괄</option></select></label>
        {selectedRole?<p>예약 대상 {reservationKind==='COORDINATOR'?'총괄':'선택 단계 책임자'} · {selectedRole.ref.id} · v{selectedRole.ref.version} · {selectedRole.ref.contentHash}</p>:<p>선택 역할 정의가 없거나 확인되지 않았습니다. 정의 저장과 예약은 별도 명령입니다.</p>}
        <label>책임 역할·예약 이유<textarea maxLength={20000} value={buffer.reason} onChange={e=>update(b=>({...b,reason:e.target.value,dirty:true,failure:null}))}/></label>
        {buffer.connectionKind===undefined?<>        <label>기존 코딩 Agent 연결 후보<select value={buffer.connectionRef?ordered(buffer.connectionRef):''} disabled={!!binding} onChange={e=>{const hit=candidates.find(c=>ordered(c.ref)===e.target.value);update(b=>({...b,connectionRef:hit?structuredClone(hit.ref):null,dirty:true}));}}>
          <option value="">연결 후보 선택</option>{binding?<option value={ordered(binding.snapshot.connectionRef)}>기존 예약의 연결 유지 · {binding.snapshot.connectionRef.id}</option>:null}
          {retainedSelection?<option value={ordered(retainedSelection)}>보관 선택 · {retainedSelection.id} · v{retainedSelection.version} · 현재 페이지 밖/현재성 미확인</option>:null}
          {candidates.filter(hit=>!binding||ordered(hit.ref)!==ordered(binding.snapshot.connectionRef)).map(hit=><option key={hit.ref.id} value={ordered(hit.ref)}>{hit.label} · 후보/실제 능력 미확인</option>)}
        </select></label></>:null}
        <fieldset disabled={locked||!!binding}><legend>등록 정의 별도 보호 선택</legend><label>등록 정의 ID<input aria-label="예약 등록 정의 ID" value={definitionInput.id} onChange={e=>editDefinitionInput('id',e.target.value)}/></label><label>등록 정의 버전<input aria-label="예약 등록 정의 버전" value={definitionInput.version} onChange={e=>editDefinitionInput('version',e.target.value)}/></label><label>등록 정의 hash<input aria-label="예약 등록 정의 hash" value={definitionInput.hash} onChange={e=>editDefinitionInput('hash',e.target.value)}/></label><button type="button" onClick={()=>run(selectDefinition)}>등록 정의 보호 조회·선택</button><button type="button" onClick={()=>{if(locked||binding)return;selectionRevision.current++;update(b=>{const{connectionKind,...rest}=b;return{...rest,connectionRef:null,dirty:true,failure:null};});}}>기존 후보 선택으로 전환</button></fieldset>
        <p>선택 종류: {buffer.connectionKind==='REGISTERED_DEFINITION'?'REGISTERED_DEFINITION_ONLY · 등록 설정/실제 능력 미확인':'CANDIDATE_ONLY · 후보'}</p>

        {buffer.connectionRef?<p>선택 참조 {buffer.connectionRef.id} · v{buffer.connectionRef.version} · {buffer.connectionRef.contentHash} · 선택 보관은 현재성·실제 연결 인증이 아닙니다.</p>:null}
        <button disabled={!!coordinator||!buffer.reason.trim()} onClick={()=>run(()=>write('COORDINATOR'))}>총괄 역할 정의</button>
        <button disabled={!coordinator||!!stage||!buffer.reason.trim()} onClick={()=>run(()=>write('STAGE_OWNER'))}>선택 단계 책임 역할 정의</button>
        <button disabled={!selectedRole||!buffer.connectionRef||!buffer.reason.trim()} onClick={()=>run(()=>write(bindingAction))}>{binding?'같은 책임 세션으로 임무 결박':'책임 세션 예약'}</button>
      </fieldset>
      {buffer.pending?.operation==='bindResponsibleSession'&&!retryAction?<p>원 예약 역할 원본이 미확인입니다. 현재 상태를 명시 조회한 뒤 같은 원명령만 확인하세요.</p>:null}
      {buffer.pending?<button disabled={busy||!owner||!retryAction} onClick={()=>{if(retryAction)run(()=>write(retryAction));}}>같은 책임 세션 명령 결과 확인</button>:null}
      {buffer.pending&&buffer.failure&&!buffer.uncertain&&!buffer.responsibleApproval&&buffer.failure.code!=='APPROVAL_REQUIRED'&&buffer.pending.approvalRef===null?<button disabled={busy} onClick={()=>{if(confirm('명시 거절을 확인했습니다. 원 입력을 보존하며 명령만 해제할까요?'))update(b=>({...b,pending:null,failure:null}));}}>거절 확인 후 입력 수정</button>:null}
      </>:null}
      {nextCursor?<button disabled={busy} onClick={()=>run(()=>load(nextCursor))}>다음 연결 후보 조회</button>:null}
      <h6>저장된 실행 준비</h6>
      {state.preparations.length?<ol>{state.preparations.map(p=><li key={p.ref.id}>
        준비 {p.snapshot.intent.mode==='WORK'?<code>{ordered(p.ref)}</code>:p.ref.id} · NOT_AUTHORIZED · {p.snapshot.checkedAt}
        {p.snapshot.intent.mode==='WORK'?(p.snapshot.understandingBasis?
          <p>정착 이해 판단 <code>{ordered(p.snapshot.understandingBasis.reviewRef)}</code> · 원 실행 {p.snapshot.understandingBasis.scope.executionId} · 세대 {p.snapshot.understandingBasis.scope.executionGeneration}</p>:
          <p>정착 이해 근거 없음 · legacy 준비</p>):null}
        <ul>{p.snapshot.missingConditions.map((code:string)=><li key={code}>{code}</li>)}</ul>
      </li>)}</ol>:<p>저장된 준비 없음</p>}
      {state.hasMorePreparations?<p>최신20건 표시 · 이전 준비가 더 있습니다.</p>:null}
      <p>새 실행 준비 저장은 유효한 예산·능력 참조 연결이 필요합니다. 미구현 참조를 가짜 값으로 대체하지 않습니다.</p>
    </>:<p>역할·예약·준비 원문은 아직 조회 확인되지 않았습니다.</p>}
    {owner&&bound?<NormalUnderstandingDiscovery reviewStorage={normalInitialReviews} client={client} session={session} projectId={confirmed.projectId} assignmentRef={confirmed.ref}
     preparations={state&&stateStamp.current.epoch===epoch.current&&stateStamp.current.revision===stateRevision.current?state.preparations:[]}
     workSelection={onWorkReviewCandidate&&!busy&&binding?.snapshot.connectionKind==='REGISTERED_DEFINITION'&&binding.snapshot.state==='RESERVED'&&stateStamp.current.epoch===definitionEpoch&&stateStamp.current.revision===definitionRevision?{
      roleBindingRef:binding.ref,agentSessionRef:binding.snapshot.sessionRef,onSelect:candidate=>{if(active(definitionEpoch)&&stateRevision.current===definitionRevision)onWorkReviewCandidate(candidate);}
     }:undefined}
     busy={busy} metadataReader={metadataReader} rangeRequester={rangeCommands?.request} rangeRecovery={rangeCommands?.recover} rangeReader={rangeReader} rangeHistoryReader={rangeHistoryReader}/>:null}
  </section>;
}

export function ProviderClaimHistoryRow({item,pending,onSelect,onUnderstanding,onNormalHistory}:{item:ProviderClaimPageHistory['items'][number];pending:boolean;onSelect:(query:ProviderClaimHistoryQuery)=>void;onUnderstanding?:(item:ProviderClaimPageHistory['items'][number])=>void;onNormalHistory?:(item:ProviderClaimPageHistory['items'][number])=>void}){
 return <li>{item.query.kind} · 수신 기록 {item.receipt.claimRef.id} · v{item.receipt.claimRef.version} · {item.receipt.recordedAt}<button type="button" disabled={pending} onClick={()=>onSelect(item.query)}>이 기록의 원 결과 확인: {item.receipt.claimRef.id}</button>{onUnderstanding?<button type="button" disabled={pending} onClick={()=>onUnderstanding(item)}>이 실행의 이해 검토 이력: {item.receipt.claimRef.id}</button>:null}{onNormalHistory?<button type="button" disabled={pending} onClick={()=>onNormalHistory(item)}>이 기록의 과거 원문 참조 확인: {item.receipt.claimRef.id}</button>:null}</li>;
}

export function ProviderClaimHistoryPanel({onWorkReviewCandidate,workSubject,client,projectId,sessionRef,subjectKey,onAuthenticationLost,normalSession,normalActive}:{client:ApiClient;projectId:string;sessionRef:ProviderClaimPageHistory['agentSessionRef'];subjectKey:string;onAuthenticationLost:()=>void;normalSession?:DocumentSession;normalActive?:()=>boolean;onWorkReviewCandidate?:SelectWorkReview;workSubject?:WorkReviewSubject}){
 const scope=ordered([projectId,sessionRef,subjectKey]),current=useRef(scope),sequence=useRef(0),alive=useRef(true);current.current=scope;
 const auth=normalSession?ordered([normalSession.user.id,normalSession.clientId,normalSession.csrfToken]):'NO_NORMAL_SESSION',ownerRef=useRef({client,transport:client.transport,scope,auth});
 if(ownerRef.current.client!==client||ownerRef.current.transport!==client.transport||ownerRef.current.scope!==scope||ownerRef.current.auth!==auth)ownerRef.current={client,transport:client.transport,scope,auth};
 const panelOwner=ownerRef.current,normalLive=useRef(normalActive);normalLive.current=normalActive;
 const [normal,setNormal]=useState<{owner:object;item:ProviderClaimPageHistory['items'][number]}|null>(null);
 const [view,setView]=useState<{scope:string;owner:object;page:ProviderClaimPageHistory|null;receipt:ProviderClaimHistory|null;error:string|null;pending:boolean}|null>(null);
 const [understanding,setUnderstanding]=useState<{scope:string;item:ProviderClaimPageHistory['items'][number]}|null>(null);
 const shown=view?.scope===scope&&view.owner===panelOwner?view:null;
 const viewTicket=sequence.current;
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;sequence.current++;};},[]);
 const active=(ticket:number,key:string)=>alive.current&&ownerRef.current===panelOwner&&sequence.current===ticket&&current.current===key;
 const failure=(cause:unknown)=>cause instanceof ApiError&&/^[A-Z0-9_]{1,100}$/.test(cause.code)?cause.code:'PROVIDER_CLAIM_HISTORY_INVALID';
 async function load(cursor:string|null=null){
  setUnderstanding(null);setNormal(null);
  const ticket=++sequence.current,key=scope;setView({scope:key,owner:panelOwner,page:null,receipt:null,error:null,pending:true});
  try{const page=await readProviderClaimPageHistory(client,projectId,sessionRef,cursor,()=>active(ticket,key));if(active(ticket,key)&&page)setView({scope:key,owner:panelOwner,page,receipt:null,error:null,pending:false});}
  catch(cause){if(active(ticket,key)){setView({scope:key,owner:panelOwner,page:null,receipt:null,error:failure(cause),pending:false});if(cause instanceof ApiError&&cause.status===401)onAuthenticationLost();}}
 }
 async function original(query:ProviderClaimHistoryQuery){
  setUnderstanding(null);setNormal(null);
  const ticket=++sequence.current,key=scope,page=shown?.page??null;setView({scope:key,owner:panelOwner,page,receipt:null,error:null,pending:true});
  try{const selected=page?.items.find(item=>ordered(item.query)===ordered(query));if(!selected)throw new ApiError('PROVIDER_CLAIM_HISTORY_INVALID');const receipt=await readProviderClaimReceiptHistory(client,query,()=>active(ticket,key),selected.receipt);if(active(ticket,key)&&receipt)setView({scope:key,owner:panelOwner,page,receipt,error:null,pending:false});}
  catch(cause){if(active(ticket,key)){setView({scope:key,owner:panelOwner,page:null,receipt:null,error:failure(cause),pending:false});if(cause instanceof ApiError&&cause.status===401)onAuthenticationLost();}}
 }
 return <section aria-label="공급자 세션 기록"><h6>공급자 세션 기록 · 과거 수신 사실</h6>
  <p>책임 세션 예약: RESERVED · 현재 사용 가능성: 미확인 · 실제 수행·업무 인수: 미확인</p>
  <p>THREAD·TURN의 과거 수신 기록만 조회합니다. 현재 연결·전달 가능성은 미확인이며 기록 없음은 미수행·안전 판정이 아닙니다.</p>
  <button type="button" disabled={shown?.pending} onClick={()=>void load()}>공급자 세션 기록 조회</button>
  {shown?.pending?<p role="status">조회 중 · 이전 원 결과 숨김</p>:null}
  {shown?.error?<p role="alert">{shown.error} · 조회 미확인 · 처음부터 다시 조회하세요.</p>:null}
  {shown?.page?<><p>조회 시각 {shown.page.observedAt} · 현재 허가·Agent 가동 확인 아님</p>
   {shown.page.items.length?<ul>{shown.page.items.map(item=><ProviderClaimHistoryRow key={item.receipt.claimRef.id} item={item} pending={shown.pending} onSelect={query=>void original(query)} onUnderstanding={selected=>{if(!active(viewTicket,scope))return;sequence.current++;setNormal(null);setUnderstanding({scope,item:structuredClone(selected)});}} onNormalHistory={normalSession?selected=>{if(!active(viewTicket,scope))return;sequence.current++;setUnderstanding(null);setNormal({owner:panelOwner,item:selected});}:undefined}/>)}</ul>:<p>조회 범위의 기록 없음 · 당시 미저장 여부는 미확인</p>}
   {shown.page.hasMore&&shown.page.nextCursor?<button type="button" disabled={shown.pending} onClick={()=>void load(shown.page!.nextCursor)}>이전 공급자 기록 조회</button>:null}
  </>:null}
  {shown?.receipt?<article aria-label="공급자 기록 원 결과">{shown.receipt.found&&shown.receipt.receipt?<><p>PROVIDER_CLAIM_RECORDED · 공급자 주장만 보관 · 현재 사용 가능성 미확인</p><p>원 참조 {shown.receipt.receipt.claimRef.id} · v{shown.receipt.receipt.claimRef.version} · {shown.receipt.receipt.claimRef.contentHash}</p><p>원 기록 시각 {shown.receipt.receipt.recordedAt} · 조회 시각 {shown.receipt.observedAt}</p><p>새 실행 허가 없음 · 지시 전달 없음 · 업무 인수 아님</p></>:<p>정확 사건 원 결과 미발견 · 미저장·안전 판정 아님</p>}</article>:null}
 {normalSession&&normal?.owner===panelOwner&&!shown?.pending&&shown?.page?.items.includes(normal.item)?<NormalClaimRangeHistoryPanel onWorkReviewCandidate={onWorkReviewCandidate} workSubject={workSubject} client={client} session={normalSession} projectId={projectId} sessionRef={sessionRef} item={normal.item} scopeOwner={panelOwner} entryOwner={normal} active={()=>active(viewTicket,scope)&&normalLive.current?.()!==false&&shown?.page?.items.includes(normal.item)===true} onClose={()=>{if(active(viewTicket,scope)){sequence.current++;setNormal(null);}}}/>:null}
 {understanding?.scope===scope&&!shown?.pending&&shown?.page?.items.some(item=>ordered(item)===ordered(understanding.item))?<ClaimUnderstandingHistory key={ordered(understanding)} client={client} projectId={projectId} sessionRef={sessionRef} item={understanding.item} onClose={()=>setUnderstanding(null)} onAuthenticationLost={onAuthenticationLost}/>:null}
 </section>;
}

/** 명시 선택한 claim에서 참조를 재발견한다. 과거 판단이나 원문을 현재 검토 editor로 넘기지 않는다. */
export function NormalClaimRangeHistoryPanel({onWorkReviewCandidate,workSubject,client,session,projectId,sessionRef,item,scopeOwner,entryOwner,active,onClose}:{client:ApiClient;session:DocumentSession;projectId:string;sessionRef:ProviderClaimPageHistory['agentSessionRef'];item:ProviderClaimPageHistory['items'][number];scopeOwner:object;entryOwner:object;active:()=>boolean;onClose:()=>void;onWorkReviewCandidate?:SelectWorkReview;workSubject?:WorkReviewSubject}){
 const transport=client.transport,auth=ordered([session.user.id,session.clientId,session.csrfToken]),key=ordered([projectId,sessionRef,item,workSubject??null]);
 const context=useRef({client,transport,auth,key,scopeOwner,entryOwner,item}),live=useRef(active);live.current=active;
 if(context.current.client!==client||context.current.transport!==transport||context.current.auth!==auth||context.current.key!==key||context.current.scopeOwner!==scopeOwner||context.current.entryOwner!==entryOwner||context.current.item!==item)context.current={client,transport,auth,key,scopeOwner,entryOwner,item};
 const owner=context.current,alive=useRef(true),[state,setState]=useState<{owner:object;basis:NormalClaimRangeHistoryBasis|null;error:boolean}|null>(null);
 const current=()=>alive.current&&context.current===owner&&client.transport===transport&&live.current()&&ordered([session.user.id,session.clientId,session.csrfToken])===auth&&ordered([projectId,sessionRef,item,workSubject??null])===key;
 const selectReview=useRef(onWorkReviewCandidate);selectReview.current=onWorkReviewCandidate;
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 useEffect(()=>{
  const controller=new AbortController();setState(null);
  readNormalClaimRangeHistory(client,projectId,sessionRef,item,controller.signal,()=>current()&&!controller.signal.aborted)
   .then(basis=>{if(current()&&!controller.signal.aborted)setState({owner,basis,error:false});})
   .catch(()=>{if(current()&&!controller.signal.aborted)setState({owner,basis:null,error:true});});
  return()=>controller.abort();
 },[owner]);
 const {user,clientId,csrfToken}=session;
 const reader=useMemo(()=>{
  const authorization={user:{id:user.id},clientId,csrfToken};
  return (input:Readonly<ReviewedNormalUnderstandingRangeHistoryRequest>,signal:AbortSignal)=>readReviewedNormalUnderstandingRangeHistory(client,authorization,input,signal,()=>current()&&!signal.aborted);
 },[owner]);
 const shown=state?.owner===owner&&current()?state:null,basis=shown?.basis;
 const candidate=basis?.status==='EXACT_NORMAL_RANGE_REFS'?basis.workCandidate:null;
 const selectable=candidate&&workSubject&&ordered(candidate.assignmentRef)===ordered(workSubject.assignmentRef)&&ordered(candidate.roleBindingRef)===ordered(workSubject.roleBindingRef);
 return <section aria-label="선택 기록의 과거 원문 참조"><h6>선택 기록의 과거 원문</h6>
  <p>선택한 수신 사건과 같은 실행의 보관 판단에서 원문 참조를 대조합니다. 사건과 판단의 직접 대응이나 현재 실행·검토 자격을 뜻하지 않습니다.</p>
  <button type="button" onClick={onClose}>과거 원문 참조 확인 취소·닫기</button>
  {!shown?<p role="status">원 기록·정확 판단·준비 버전 확인 중</p>:null}
  {shown?.error?<p role="alert">정확한 과거 원문 참조를 확인하지 못했습니다. 다른 실행이나 준비본으로 대체하지 않습니다.</p>:null}
  {basis?.status==='NO_NORMAL_REVIEW'?<p role="status">같은 실행의 보관된 정상 최초 판단이 없습니다. 현재 이해나 실행 여부의 판정이 아닙니다.</p>:null}
  {basis?.status==='EXACT_NORMAL_RANGE_REFS'?<><p>보관 판단 v{basis.reviewRef.version} · 과거 참조 대조만 완료</p>
   {selectable&&onWorkReviewCandidate?<p>조회 시 최신 적합 판단 <code>{ordered(candidate.reviewRef)}</code> <button type="button" onClick={()=>{if(current())selectReview.current?.(structuredClone(candidate));}}>이 적합 판단을 WORK 준비 후보로 선택</button></p>:null}
   <NormalUnderstandingRangeHistory input={basis.origin} reader={reader} verify={verifyReviewedNormalUnderstandingRangeHistory} scopeOwner={owner} entryOwner={basis} active={current} disabled={false}/>
  </>:null}
 </section>;
}
