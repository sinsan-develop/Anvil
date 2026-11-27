import {StageStartApprovalEditor} from './StageStartApprovalEditor.tsx';
import {readStageQueue,type QueueView} from './stage-queue-api.ts';
import {ordered} from '../knowledge/review-view.ts';
const same=(a:unknown,b:unknown)=>ordered(a)===ordered(b);
import {useEffect,useLayoutEffect,useRef,useState} from 'react';import {ApiClient,ApiError} from '../../api/client.ts';
import {documentControl,type DocumentSession} from '../design-trace/editor-api.ts';import {isKnownDocumentRejection} from '../design-trace/mutation-result.ts';
import {readWorkspaceMethodology} from '../workspace/api.ts';import type {ConfirmedAssignmentView} from '../workspace/assignment-confirmation-api.ts';
import {newStageStart,prepareStageStart,sendStageStart,stageStartKey,type StageStartStorage,type StageStartBuffer} from './stage-start-api.ts';
export type WaitingStageReceipt=NonNullable<StageStartBuffer['result']>;
export const isQueueViewLimit=(cause:unknown)=>cause instanceof ApiError&&cause.status===413&&cause.code==='QUEUE_VIEW_LIMIT_EXCEEDED';
/** 원 App 영수증의 선택 범위만 검산한다. 현재 WAITING/head·임무 연결의 서버 검산을 대신하지 않는다. */
export async function readWaitingStageReceiptCandidate(raw:WaitingStageReceipt,assignment:ConfirmedAssignmentView,session:DocumentSession,active:()=>boolean):Promise<WaitingStageReceipt|null>{
 if(!active())return null;
 try{
  const value=structuredClone(raw),r=value.ref,s=value.snapshot,input=s.input,task=assignment.snapshot.definition.taskRef;
  if(!r||r.version!==1||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(r.id)||!/^[a-f0-9]{64}$/.test(r.contentHash)||s.projectId!==assignment.projectId||s.requestId!==r.id||s.version!==1||s.state!=='WAITING'||!Number.isSafeInteger(s.sequence)||s.sequence<1||s.assignmentRef!==null||s.previousRef!==null||s.cancelledAt!==null||s.cancelledBy!==null||s.cancellationReason!==null||!same(s.requestedBy,{kind:'HUMAN',userId:session.user.id,clientId:session.clientId})||['slotReserved','writerReservationPerformed','executionAuthorized','dispatchPerformed'].some(k=>s[k]!==false)||!same(input.methodologyApplicationRef,task.applicationRef)||!same(input.startNodeRef,{applicationRef:task.applicationRef,nodeId:task.nodeId})||!same(input.budgetRef,assignment.snapshot.definition.budgetRef)||!Array.isArray(input.baselineRefs)||!input.baselineRefs.length||input.baselineRefs.some((v:unknown)=>!assignment.snapshot.definition.baselineRefs.some((b:unknown)=>same(v,b))))throw Error();
  const bytes=new TextEncoder().encode(ordered(s));if(bytes.length>2097152)throw Error();
  const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
  if(!active())return null;if(hash!==r.contentHash)throw Error();return{ref:r,snapshot:s};
 }catch(error){if(!active())return null;throw new ApiError('STAGE_START_RESPONSE_INVALID');}
}
export function verifiedStageQueueItem(queue:QueueView,receipt:WaitingStageReceipt){
 // readStageQueue already rejects duplicate request IDs and sequences.
 return queue.items.find(item=>same(item.requestRef,receipt.ref)&&item.sequence===receipt.snapshot.sequence);
}
export function StageStartPanel({client,assignment,session,storage,onUnavailable,isSourceCurrent,expectedControlGeneration,continueHref}:{client:ApiClient;assignment:ConfirmedAssignmentView;session:DocumentSession;storage:StageStartStorage;onUnavailable:(code:string)=>void;isSourceCurrent?:()=>boolean;expectedControlGeneration?:number;continueHref?:string}){
 const [queueVerified,setQueueVerified]=useState<{epoch:number;receipt:WaitingStageReceipt}|null>(null);
 const [queueCandidate,setQueueCandidate]=useState<{epoch:number;receipt:WaitingStageReceipt;buffer:StageStartBuffer;route:string|undefined;routeEpoch:number}|null>(null),routeEpoch=useRef(0),[,refreshRoute]=useState(0);
 const route=globalThis.location?.hash,routeRevision=routeEpoch.current,candidateLive=useRef(queueCandidate);
 useLayoutEffect(()=>{const depart=()=>{routeEpoch.current++;candidateLive.current=null;setQueueCandidate(null);refreshRoute(v=>v+1);};globalThis.addEventListener?.('hashchange',depart);return()=>globalThis.removeEventListener?.('hashchange',depart);},[]);
 const key=stageStartKey(session,assignment),buffer=storage.buffers[key]??null,[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),[ack,setAck]=useState(false),working=useRef(false),live=useRef(true),current=useRef(buffer),changed=useRef(storage.onChange),unavailable=useRef(onUnavailable);current.current=buffer;changed.current=storage.onChange;unavailable.current=onUnavailable;
 const binding=useRef({client,session,transport:client.transport,key,epoch:0});if(binding.current.client!==client||binding.current.session!==session||binding.current.transport!==client.transport||binding.current.key!==key)binding.current={client,session,transport:client.transport,key,epoch:binding.current.epoch+1};const epoch=binding.current.epoch;
 const committed=useRef(false);
 useLayoutEffect(()=>{committed.current=true;return()=>{committed.current=false;};},[]);
 const sourceCurrent=()=>!isSourceCurrent||committed.current&&isSourceCurrent();
 const viewCurrent=()=>live.current&&sourceCurrent()&&binding.current.epoch===epoch&&client.transport===binding.current.transport;
 const activeFor=(b:StageStartBuffer)=>()=>viewCurrent()&&current.current?.bindingId===b.bindingId&&current.current.ownerUserId===session.user.id&&current.current.ownerClientId===session.clientId&&same(current.current.input,b.input)&&same(current.current.pending,b.pending);
 useEffect(()=>{live.current=true;return()=>{live.current=false;};},[]);
 const update=(prior:StageStartBuffer,next:StageStartBuffer)=>{if(sourceCurrent()&&(expectedControlGeneration===undefined||prior.controlGeneration===expectedControlGeneration))changed.current(key,value=>value===prior?next:value);};
 const checkGeneration=(generation:number,prior=generation)=>{if(generation!==prior||expectedControlGeneration!==undefined&&generation!==expectedControlGeneration)throw new ApiError('PROJECT_CONTROL_CHANGED',409);};
 function failure(cause:unknown){const e=cause instanceof ApiError?cause:new ApiError('STAGE_START_RESPONSE_INVALID');if(viewCurrent()){setError(/^[A-Z_]{1,80}$/.test(e.code)?e.code:'STAGE_START_RESPONSE_INVALID');if([401,403,404].includes(e.status))unavailable.current(e.status===401?'AUTH_REQUIRED':e.code);}return e;}
 async function create(){if(working.current||buffer||!sourceCurrent())return;working.current=true;setBusy(true);setError(null);try{const generation=await documentControl(client,assignment.projectId,session);if(!live.current||!sourceCurrent())return;checkGeneration(generation);const app=await readWorkspaceMethodology(client,assignment.projectId,assignment.snapshot.definition.taskRef.applicationRef);if(!live.current||!sourceCurrent())return;const next=await newStageStart(assignment,app,session,generation);if(live.current&&binding.current.epoch===epoch&&sourceCurrent())changed.current(key,value=>sourceCurrent()?value??next:value);}catch(cause){failure(cause);}finally{working.current=false;if(live.current)setBusy(false);}}
 async function prepare(){const prior=buffer;if(!prior||prior.pending||working.current||!sourceCurrent())return;working.current=true;setBusy(true);setError(null);setAck(false);const active=activeFor(prior);
  try{const generation=await documentControl(client,assignment.projectId,session);if(!active())return;checkGeneration(generation,prior.controlGeneration);await readWorkspaceMethodology(client,assignment.projectId,prior.input.methodologyApplicationRef);if(!active())return;const next=await prepareStageStart(prior,assignment,session);if(active())update(prior,next);}catch(cause){failure(cause);}finally{working.current=false;if(live.current)setBusy(false);}}
 async function send(){const prior=buffer;if(!prior?.pending||prior.result||working.current||!sourceCurrent()||!prior.uncertain&&!ack)return;working.current=true;setBusy(true);setError(null);let sent=false;
  const active=activeFor(prior);
  try{const generation=await documentControl(client,assignment.projectId,session);if(!active())return;checkGeneration(generation,prior.controlGeneration);const next={...prior,uncertain:true,failure:null};
   const markSent=()=>{update(prior,next);sent=true;};if(!isSourceCurrent)markSent();
   const result=await sendStageStart(client,next,assignment,session,active,isSourceCurrent?markSent:undefined);
   if(active())changed.current(key,value=>value?.bindingId===prior.bindingId&&same(value.pending,prior.pending)?{...value,result,uncertain:false,failure:null}:value);
  }
  catch(cause){const e=failure(cause);if(sent&&active())changed.current(key,value=>value?.bindingId===prior.bindingId&&same(value.pending,prior.pending)?{...value,uncertain:prior.uncertain||!isKnownDocumentRejection(e),failure:{code:e.code,status:e.status}}:value);}finally{working.current=false;if(live.current)setBusy(false);}}
 async function verifyQueue(){
  const prior=buffer,receipt=prior?.result;
  if(!prior||!receipt||working.current||!sourceCurrent()||globalThis.location?.hash!==route||routeEpoch.current!==routeRevision)return;
  const buffered=activeFor(prior),active=()=>buffered()&&current.current?.result===receipt&&globalThis.location?.hash===route&&routeEpoch.current===routeRevision;
  working.current=true;setBusy(true);setError(null);setQueueVerified(null);candidateLive.current=null;setQueueCandidate(null);
  try{
   const queue=await readStageQueue(client,prior.projectId,active);
   if(!active()||!queue)return;
   if(!verifiedStageQueueItem(queue,receipt))throw new ApiError('STAGE_START_QUEUE_NOT_FOUND',409);
   setQueueVerified({epoch,receipt});
  }catch(e){if(active()){
   if(isQueueViewLimit(e)){
    try{
     if(prior.uncertain||prior.failure||!prior.pending||prior.projectId!==assignment.projectId||!same(prior.assignmentRef,assignment.ref)||!same(prior.sourceDraftRef,assignment.snapshot.draftRef)||prior.ownerUserId!==session.user.id||prior.ownerClientId!==session.clientId)throw new ApiError('STAGE_START_RESPONSE_INVALID');
     const candidate=await readWaitingStageReceiptCandidate(receipt,assignment,session,active);if(!active()||!candidate)return;
     const generation=await documentControl(client,prior.projectId,session);if(!active())return;checkGeneration(generation,prior.controlGeneration);
     const candidateOwner={epoch,receipt,buffer:prior,route,routeEpoch:routeRevision};candidateLive.current=candidateOwner;setQueueCandidate(candidateOwner);
    }catch(cause){if(active())failure(cause);}
   }else failure(e);
  }}finally{working.current=false;if(live.current)setBusy(false);}
 }
 const hasVerifiedQueue=queueVerified?.epoch===epoch&&queueVerified.receipt===buffer?.result&&client.transport===binding.current.transport;
 function closeBuffer(){if(sourceCurrent())changed.current(key,value=>sourceCurrent()&&value===buffer?null:value);}
 const controlChanged=!!buffer&&expectedControlGeneration!==undefined&&buffer.controlGeneration!==expectedControlGeneration;
 const hasCandidate=queueCandidate!==null&&candidateLive.current===queueCandidate&&queueCandidate.epoch===epoch&&queueCandidate.receipt===buffer?.result&&activeFor(queueCandidate.buffer)()&&buffer?.controlGeneration===queueCandidate.buffer.controlGeneration&&!buffer?.uncertain&&!buffer?.failure&&!controlChanged&&queueCandidate.route===globalThis.location?.hash&&queueCandidate.routeEpoch===routeEpoch.current&&client.transport===binding.current.transport;
 const writeLocked=busy||controlChanged;
 const graph=buffer?.application.snapshot?.graph,start=buffer?.input.startNodeRef.nodeId,reachable=new Set<string>(),pending=start?[start]:[];while(pending.length&&reachable.size<=200){const id=pending.pop()!;if(reachable.has(id))continue;reachable.add(id);for(const edge of graph?.edges??[])if(edge.fromNodeId===id&&!reachable.has(edge.toNodeId))pending.push(edge.toNodeId);}const nodes=graph?.nodes.filter(n=>reachable.has(n.nodeId))??[],auto=graph?.nodes.find(n=>n.nodeId===start)?.mode==='AUTO';
 return <section aria-label="단계 시작 요청 작성"><h3>단계 시작 요청 작성</h3><p>확정 임무의 참조를 입력 근거로 요청만 보관합니다. 실제 임무 결합·기준·실행 상태는 미확인이고 Agent 실행·슬롯 예약은 하지 않습니다.</p>
  {error?<p role="alert">{error} · 입력과 고정 명령을 보존하며 자동 재전송하지 않습니다.</p>:null}
  {controlChanged?<p role="status">제어 세대가 바뀌었습니다. 기존 요청과 원 명령을 보존하며 이 화면에서 수정·등록하지 않습니다.</p>:null}
  {!buffer?<button type="button" disabled={busy||!assignment.snapshot.definition.budgetRef} onClick={()=>void create()}>단계 요청 작성</button>:<><p>시작 단계 {start} / 적용 v{buffer.input.methodologyApplicationRef.version} / 예산 {buffer.input.budgetRef.id} v{buffer.input.budgetRef.version} / 기준 {buffer.input.baselineRefs.length}건</p>
   <label>요청 방식<select aria-label="단계 요청 방식" value={buffer.input.mode} disabled={writeLocked||!!buffer.pending} onChange={e=>{const mode=e.target.value as 'AUTO'|'CASE_BY_CASE';update(buffer,{...buffer,input:{...buffer.input,mode,endBoundaryRef:{...buffer.input.startNodeRef}},failure:null});}}><option value="CASE_BY_CASE">건별 요청</option>{auto?<option value="AUTO">정의된 자동 범위 요청</option>:null}</select></label>
   <label>끝 경계<select aria-label="단계 요청 끝 경계" value={buffer.input.endBoundaryRef.nodeId} disabled={writeLocked||!!buffer.pending||buffer.input.mode==='CASE_BY_CASE'} onChange={e=>update(buffer,{...buffer,input:{...buffer.input,endBoundaryRef:{...buffer.input.startNodeRef,nodeId:e.target.value}},failure:null})}>{nodes.map(n=><option key={n.nodeId} value={n.nodeId}>{n.name} ({n.nodeId})</option>)}</select></label>
   <label>요청 사유<textarea aria-label="단계 요청 사유" maxLength={20000} disabled={writeLocked||!!buffer.pending} value={buffer.input.reason} onChange={e=>update(buffer,{...buffer,input:{...buffer.input,reason:e.target.value},failure:null})}/></label>
   {!buffer.pending?<><button type="button" disabled={writeLocked||!buffer.input.reason.trim()} onClick={()=>void prepare()}>단계 요청 명령 준비</button><button type="button" disabled={busy} onClick={closeBuffer}>작성 입력 폐기</button></>:<><p>고정 명령 {buffer.pending.commandId} · 제어 세대 {buffer.controlGeneration}</p>
    {buffer.result?<><p role="status">단계 요청 보관 영수증 확인 · WAITING / 실행·예약 아님</p><button type="button" disabled={busy} onClick={()=>void verifyQueue()}>같은 WAITING 요청 원장 재조회</button>{hasVerifiedQueue?<><p role="status">동일 WAITING 요청 원장 확인</p>{continueHref?<a href={continueHref} onClick={event=>{if(working.current||!viewCurrent()||current.current?.result!==queueVerified.receipt)event.preventDefault();}}>확인한 대기 요청으로 START 원자료 준비 열기</a>:null}</>:null}{hasCandidate?<><p role="status">대기 목록 한도 초과 · 원 영수증의 현재성 미검산 · 명시 저장 시 서버에서 대조합니다.</p>{continueHref?<a href={continueHref} onClick={event=>{if(working.current||candidateLive.current!==queueCandidate||!viewCurrent()||!activeFor(queueCandidate.buffer)()||current.current?.controlGeneration!==queueCandidate.buffer.controlGeneration||current.current?.result!==queueCandidate.receipt||globalThis.location?.hash!==queueCandidate.route||routeEpoch.current!==queueCandidate.routeEpoch||controlChanged)event.preventDefault();}}>원장 미검산 영수증으로 START 원자료 후보 열기</a>:null}</>:null}<ul>{buffer.result.snapshot.readinessIssues.map((code:string)=><li key={code}>{code}</li>)}</ul><button type="button" disabled={busy} onClick={closeBuffer}>시작 요청 영수증 닫기</button></>:<>
     {buffer.uncertain?<p>결과 미확인: 입력과 명령을 바꾸지 않고 같은 명령만 재확인합니다.</p>:<label><input type="checkbox" disabled={writeLocked} checked={ack} onChange={e=>setAck(e.target.checked)}/>대기 요청 보관만 수행하며 실행·예약이 아님을 확인합니다</label>}
     <button type="button" disabled={writeLocked||!buffer.uncertain&&!ack||!!buffer.failure&&!buffer.uncertain} onClick={()=>void send()}>{buffer.uncertain?'같은 시작 요청 명령 결과 재확인':'단계 대기 요청 등록'}</button>
     {buffer.failure&&!buffer.uncertain&&buffer.failure.code!=='APPROVAL_REQUIRED'&&!buffer.stageApproval?<button type="button" disabled={writeLocked} onClick={()=>{update(buffer,{...buffer,pending:null,failure:null});setAck(false);setError(null);}}>시작 요청 거절 확인 후 입력으로 돌아가기</button>:null}
    </>}
    {(buffer.failure?.code==='APPROVAL_REQUIRED'||buffer.stageApproval)&&!buffer.result?<StageStartApprovalEditor client={client} session={session} buffer={buffer} disabled={writeLocked}
     isSourceCurrent={isSourceCurrent?()=>sourceCurrent()&&(expectedControlGeneration===undefined||buffer.controlGeneration===expectedControlGeneration):undefined}
     update={change=>{if(sourceCurrent())changed.current(key,value=>value?.bindingId===buffer.bindingId&&same(value.pending,buffer.pending)?change(value):value);}}
     onAuthenticationLost={()=>{if(sourceCurrent())unavailable.current('AUTH_REQUIRED');}}/>:null}
   </>}
   {buffer.closedStageApprovals?.length?<p>종결된 단계 승인 {buffer.closedStageApprovals.length}건 보존</p>:null}
  </>}
  {!assignment.snapshot.definition.budgetRef?<p>임무에 예산 참조가 없어 요청을 작성할 수 없습니다. 임의 예산을 만들지 않습니다.</p>:null}
 </section>;
}
