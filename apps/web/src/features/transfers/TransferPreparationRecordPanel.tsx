import {readDefinition,type DefinitionView} from '../connections/connection-definition-api.ts';
import {readLimitPolicy,type LimitPolicyRecord} from '../connections/limit-policy-api.ts';
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import type {DocumentSession} from '../design-trace/editor-api.ts';
import type {ConfirmedAssignmentView} from '../workspace/assignment-confirmation-api.ts';
import type {ResponsibleSessionState} from '../workspace/responsible-session-api.ts';
import type {PlanRef} from '../design-trace/work-plan-api.ts';
import {readContextPreparation} from '../workspace/context-api.ts';
import {readTransferContext} from './transfer-read.ts';
import {TransferContextOriginals} from './TransferContextOriginals.tsx';
import {nextPreparation,newPreparation,preparationKey,preparationOwned,preparationSame as same,editPreparation,editRejectedPreparation,prepareRecord,markPreparationDispatch,sendPreparation,failPreparation,readPreparationRecord,readPreparationRole,readPreparationBinding,type PreparationBuffer,type PreparationStorage,type PreparationGet} from './preparation-record-api.ts';
type HistoricalChoice = {field:'contextRef'|'targetConnectionRef';ref:PlanRef}|{field:'responsibility';roleRef:PlanRef;bindingRef:PlanRef};
export function TransferPreparationRecordPanel({client,session,confirmed,state,contexts,storage,onAuthenticationLost}:{client:ApiClient;session:DocumentSession;confirmed:ConfirmedAssignmentView;state:ResponsibleSessionState;contexts:PlanRef[];storage:PreparationStorage;onAuthenticationLost:()=>void}){
 const key=preparationKey(session,confirmed.projectId,confirmed.ref),owner=useRef({key,client,transport:client.transport,session,csrf:session.csrfToken});if(owner.current.key!==key||owner.current.client!==client||owner.current.transport!==client.transport||owner.current.session!==session||owner.current.csrf!==session.csrfToken)owner.current={key,client,transport:client.transport,session,csrf:session.csrfToken};const scope=owner.current,mounted=useRef(true),seq=useRef(0),flight=useRef<object|null>(null),lost=useRef(onAuthenticationLost);lost.current=onAuthenticationLost;
 const [working,setWorking]=useState<object|null>(null),[rawView,setRawView]=useState<{owner:object;value:PreparationGet}|null>(null),[error,setError]=useState<{owner:object;value:string}|null>(null),[roleId,setRoleId]=useState(''),[roleVersion,setRoleVersion]=useState('1'),[bindingId,setBindingId]=useState(''),[bindingVersion,setBindingVersion]=useState('1'),[targetId,setTargetId]=useState(''),[targetVersion,setTargetVersion]=useState('1'),[targetHash,setTargetHash]=useState('');
 const displayed=useRef(rawView),displayedGeneration=useRef(0);
 function setView(next:typeof rawView){displayedGeneration.current++;displayed.current=next;setRawView(next);}
 const [lookup,setLookup]=useState<{owner:object;id:string;hash:string}|null>(null),[lookupWorking,setLookupWorking]=useState<object|null>(null),[lookupError,setLookupError]=useState<{owner:object;code:string}|null>(null),lookupSeq=useRef(0),lookupFlight=useRef<{owner:object;ticket:number}|null>(null);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;seq.current++;};},[]);
 const current=()=>mounted.current&&owner.current===scope&&client.transport===scope.transport&&session.csrfToken===scope.csrf;
 const stored=storage.buffers[key]??null,b=stored&&preparationOwned(stored,client,session,confirmed)?stored:null,busy=working===scope||lookupWorking===scope,view=current()&&rawView?.owner===scope?rawView.value:null;
 const activeBuffer=useRef(b),flightBuffer=useRef(b),bufferGeneration=useRef(0);if(activeBuffer.current!==b)bufferGeneration.current++;activeBuffer.current=b;
 const locked=!!b?.pending;
 function replace(old:PreparationBuffer|null,next:PreparationBuffer,canApply?:()=>boolean){if(!current()||activeBuffer.current!==old||canApply&&!canApply()||!storage.onChange(old,next))throw new ApiError('TRANSFER_PREPARATION_CONTEXT_CHANGED',412);bufferGeneration.current++;activeBuffer.current=next;flightBuffer.current=next;}
 function edit(patch:Parameters<typeof editPreparation>[1]){if(!b||busy||!current())return;try{replace(b,editPreparation(b,patch));}catch{setError({owner:scope,value:'TRANSFER_PREPARATION_COMMAND_PRESERVED'});}}
 async function run(action:(check:()=>boolean)=>Promise<void>){if(!current()||flight.current===scope||lookupFlight.current?.owner===scope)return;flight.current=scope;flightBuffer.current=b;const ticket=++seq.current,check=()=>current()&&seq.current===ticket&&activeBuffer.current===flightBuffer.current;setWorking(scope);setError(null);setView(null);try{await action(check);}catch(cause){if(!check())return;const e=cause instanceof ApiError?cause:new ApiError('TRANSFER_PREPARATION_RESPONSE_INVALID',503);setError({owner:scope,value:/^[A-Z_]{1,80}$/.test(e.code)?e.code:'TRANSFER_PREPARATION_RESPONSE_INVALID'});if(e.status===401)lost.current();}finally{if(current()&&seq.current===ticket&&flight.current===scope){flight.current=null;setWorking(null);}}}
 async function selectRole(id:string,version:number,want?:PlanRef){await run(async check=>{if(!b||locked)return;const role=await readPreparationRole(client,confirmed,id,version,check);if(want&&!same(want,role.ref))throw new ApiError('TRANSFER_PREPARATION_ROLE_MISMATCH',412);if(check())replace(b,editPreparation(b,{roleRef:role.ref,roleSelected:true,oldBindingRef:null,bindingSelected:false}));});}
 async function selectBinding(id:string,version:number,want?:PlanRef){await run(async check=>{if(!b?.roleRef||locked)throw new ApiError('TRANSFER_PREPARATION_ROLE_REQUIRED',422);const role=await readPreparationRole(client,confirmed,b.roleRef.id,b.roleRef.version,check);if(!same(role.ref,b.roleRef))throw new ApiError('TRANSFER_PREPARATION_ROLE_MISMATCH',412);const binding=await readPreparationBinding(client,confirmed,role,id,version,check);if(want&&!same(want,binding.ref))throw new ApiError('TRANSFER_PREPARATION_BINDING_MISMATCH',412);if(check())replace(b,editPreparation(b,{oldBindingRef:binding.ref,bindingSelected:true}));});}
 async function prepare(){await run(async check=>{if(!b)return;try{const next=await prepareRecord(client,session,confirmed,b,check);if(check())replace(b,next);}catch(cause){if(check()&&cause instanceof ApiError)replace(b,failPreparation(b,cause));throw cause;}});}
 async function save(){await run(async check=>{if(!b)return;let latest=b;try{latest=markPreparationDispatch(b);replace(b,latest);const next=await sendPreparation(client,session,confirmed,latest,check);if(!check())return;replace(latest,next);latest=next;const result=await readPreparationRecord(client,confirmed.projectId,next.pending!.receipt.data.ref,confirmed.ref,check);if(check())setView({owner:scope,value:result});}catch(cause){if(check()&&cause instanceof ApiError)replace(latest,failPreparation(latest,cause));throw cause;}});}
 function next(){if(!b||busy||!current()||flight.current===scope||lookupFlight.current?.owner===scope||activeBuffer.current!==b)return;try{replace(b,nextPreparation(client,session,confirmed,b));seq.current++;setView(null);setError(null);setRoleId('');setRoleVersion('1');setBindingId('');setBindingVersion('1');setTargetId('');setTargetVersion('1');setTargetHash('');}catch{setError({owner:scope,value:'TRANSFER_PREPARATION_COMMAND_PRESERVED'});}}
 async function read(){await run(async check=>{if(!b?.pending?.receipt)return;const result=await readPreparationRecord(client,confirmed.projectId,b.pending.receipt.data.ref,confirmed.ref,check);if(check())setView({owner:scope,value:result});});}
 async function selectHistorical(reference:HistoricalChoice,sourceCurrent:()=>boolean){
  const source=rawView;
  if(!b||b.pending||busy||!current()||!sourceCurrent()||!preparationOwned(b,client,session,confirmed)||activeBuffer.current!==b||flight.current===scope||
   lookupFlight.current?.owner===scope||!source||source.owner!==scope||displayed.current!==source)return;
  const wanted=structuredClone(reference),record=source.value.record;
  const matches=()=>same(record.assignmentRef,confirmed.ref)&&(wanted.field==='responsibility'
   ? same(record.roleRef,wanted.roleRef)&&same(record.oldBindingRef,wanted.bindingRef)
   : same(record[wanted.field],wanted.ref));
  if(!matches())return;
  const ticket=++seq.current,generation=bufferGeneration.current,viewGeneration=displayedGeneration.current;
  const check=()=>current()&&seq.current===ticket&&flight.current===scope&&activeBuffer.current===b&&!b.pending&&preparationOwned(b,client,session,confirmed)&&
   bufferGeneration.current===generation&&displayed.current===source&&displayedGeneration.current===viewGeneration&&matches()&&sourceCurrent();
  flight.current=scope;setWorking(scope);setError(null);
  try{
   if(wanted.field==='responsibility'){
    const role=await readPreparationRole(client,confirmed,wanted.roleRef.id,wanted.roleRef.version,check);
    if(!check())return;
    if(!same(role.ref,wanted.roleRef))throw new ApiError('TRANSFER_PREPARATION_ROLE_MISMATCH',412);
    const binding=await readPreparationBinding(client,confirmed,role,wanted.bindingRef.id,wanted.bindingRef.version,check);
    if(!check())return;
    if(!same(binding.ref,wanted.bindingRef))throw new ApiError('TRANSFER_PREPARATION_BINDING_MISMATCH',412);
    replace(b,editPreparation(b,{roleRef:role.ref,roleSelected:true,oldBindingRef:binding.ref,bindingSelected:true}),check);
    return;
   }
   const value=wanted.field==='contextRef'?await readTransferContext(client,confirmed.projectId,confirmed.ref,wanted.ref,check):
    await readDefinition(client,confirmed.projectId,wanted.ref,check);
   if(check()&&value){
    if(!same(value.ref,wanted.ref))throw new ApiError('TRANSFER_PREPARATION_REFERENCE_MISMATCH',412);
    const patch=wanted.field==='contextRef'?{contextRef:value.ref,contextSelected:true}:{targetConnectionRef:value.ref,targetSelected:true};
    replace(b,editPreparation(b,patch),check);
   }
  }
  catch(cause){if(!check())return;const e=cause instanceof ApiError?cause:new ApiError('TRANSFER_PREPARATION_RESPONSE_INVALID',503);setError({owner:scope,value:/^[A-Z_]{1,80}$/.test(e.code)?e.code:'TRANSFER_PREPARATION_RESPONSE_INVALID'});if(e.status===401)lost.current();}
  finally{if(current()&&seq.current===ticket&&flight.current===scope){flight.current=null;setWorking(null);}}
 }
 const known=lookup?.owner===scope?lookup:{owner:scope,id:'',hash:''};
 function changeLookup(patch:Partial<{id:string;hash:string}>){if(!current()||working===scope)return;lookupSeq.current++;lookupFlight.current=null;setLookupWorking(null);setLookupError(null);setView(null);setLookup(old=>({...(old?.owner===scope?old:{owner:scope,id:'',hash:''}),...patch,owner:scope}));}
 async function readKnown(){if(!current()||busy)return;const reference:PlanRef={id:known.id,version:1,contentHash:known.hash},ticket=++lookupSeq.current;lookupFlight.current={owner:scope,ticket};const check=()=>current()&&lookupSeq.current===ticket&&lookupFlight.current?.owner===scope&&lookupFlight.current.ticket===ticket;setLookupWorking(scope);setLookupError(null);setView(null);try{const value=await readPreparationRecord(client,confirmed.projectId,reference,confirmed.ref,check);if(check())setView({owner:scope,value});}catch(cause){if(!check())return;const e=cause instanceof ApiError?cause:new ApiError('TRANSFER_PREPARATION_RESPONSE_INVALID',503);setLookupError({owner:scope,code:/^[A-Z_]{1,80}$/.test(e.code)?e.code:'TRANSFER_PREPARATION_RESPONSE_INVALID'});if(e.status===401)lost.current();}finally{if(check()){lookupFlight.current=null;setLookupWorking(null);}}}
 const candidates=state.bindings.filter(v=>same(v.snapshot.assignmentRef,confirmed.ref)&&b?.roleRef&&same(v.snapshot.roleRef,b.roleRef));
 return <section aria-label="인계 준비기록"><h3>인계 준비기록</h3><p>선택한 참조와 공백을 저장합니다. 실제 인계·중지·회수·이해 합격·재개 권한은 부여하지 않습니다.</p>
 <fieldset disabled={working===scope}><legend>알려진 준비기록 조회</legend><p>이미 알고 있는 정확 참조만 입력하세요. 목록 검색·새 기록 작성 없이 현재 보호 GET으로 대조합니다.</p><label>준비기록 ID<input aria-label="준비기록 조회 ID" value={known.id} onChange={e=>changeLookup({id:e.target.value})}/></label><label>버전<input aria-label="준비기록 조회 버전" value="1" readOnly/></label><label>내용 hash<input aria-label="준비기록 조회 hash" value={known.hash} onChange={e=>changeLookup({hash:e.target.value})}/></label><button type="button" disabled={busy} onClick={()=>void readKnown()}>알려진 준비기록 고정 조회</button></fieldset>{lookupError?.owner===scope?<p role="alert">{lookupError.code}</p>:null}
 {!b?<>{stored?<p role="alert">이전 연결의 원명령이 보존되어 있습니다. 동일 연결 문맥에서 확인하세요.</p>:<button type="button" disabled={busy} onClick={()=>{if(current())replace(null,newPreparation(client,session,confirmed));}}>새 준비기록 작성</button>}</>:<>
 <p>고정 확정 임무 {b.assignmentRef.id} · v{b.assignmentRef.version} · {b.assignmentRef.contentHash}</p>
 <fieldset disabled={locked||busy}><legend>준비기록 선택</legend>
 <label>준비 이유<textarea aria-label="준비기록 이유" value={b.reason} onChange={e=>edit({reason:e.target.value})}/></label><label>의도 기한(분, 최대30)<input aria-label="준비기록 기한 분" value={b.minutes} onChange={e=>edit({minutes:e.target.value})}/></label><p>준비할 때 한 번 고정하며 재확인으로 연장하지 않습니다.</p>
 <h4>맥락</h4><button type="button" onClick={()=>edit({contextRef:null,contextSelected:true})}>맥락 미수집 명시 선택</button>{contexts.map(ref=><button type="button" key={ref.id+':'+ref.version} onClick={()=>void run(async check=>{const v=await readContextPreparation(client,confirmed.projectId,ref);if(!check())return;if(!same(v.manifest.assignmentRef,confirmed.ref)||!same(v.ref,ref))throw new ApiError('TRANSFER_PREPARATION_CONTEXT_MISMATCH',412);replace(b,editPreparation(b,{contextRef:ref,contextSelected:true}));})}>맥락 {ref.id} 고정 선택</button>)}
 <h4>역할</h4><button type="button" onClick={()=>edit({roleRef:null,roleSelected:true,oldBindingRef:null,bindingSelected:false})}>역할 미선택 명시</button>{state.roles.map(role=><button type="button" key={role.ref.id} onClick={()=>void selectRole(role.ref.id,role.ref.version,role.ref)}>{role.snapshot.kind} 역할 고정 선택</button>)}
 <label>과거 역할 ID<input aria-label="과거 역할 ID" value={roleId} onChange={e=>setRoleId(e.target.value)}/></label><label>과거 역할 버전<input aria-label="과거 역할 버전" value={roleVersion} onChange={e=>setRoleVersion(e.target.value)}/></label><button type="button" onClick={()=>void selectRole(roleId,Number(roleVersion))}>과거 역할 보호 조회·선택</button>
 <h4>기존 책임 결박</h4><p>역할별 최신 목록은 이 임무의 전체 결박 이력이 아닙니다.</p><button type="button" onClick={()=>edit({oldBindingRef:null,bindingSelected:true})}>기존 결박 미수집 명시 선택</button>{candidates.map(binding=><button type="button" key={binding.ref.id+':'+binding.ref.version} onClick={()=>void selectBinding(binding.ref.id,binding.ref.version,binding.ref)}>결박 {binding.ref.id} 고정 선택</button>)}
 <label>과거 결박 ID<input aria-label="과거 결박 ID" value={bindingId} onChange={e=>setBindingId(e.target.value)}/></label><label>과거 결박 버전<input aria-label="과거 결박 버전" value={bindingVersion} onChange={e=>setBindingVersion(e.target.value)}/></label><button type="button" onClick={()=>void selectBinding(bindingId,Number(bindingVersion))}>과거 결박 보호 조회·선택</button>
 <h4>대상 연결</h4><p>고정 연결 정의를 보호 조회해 선택합니다. 능력은 미검증이며 후보/host trust를 대신 사용하지 않습니다.</p><button type="button" onClick={()=>edit({targetConnectionRef:null,targetSelected:true})}>대상 미선택 명시</button><label>등록 연결 ID<input aria-label="등록 연결 ID" value={targetId} onChange={e=>setTargetId(e.target.value)}/></label><label>등록 연결 버전<input aria-label="등록 연결 버전" value={targetVersion} onChange={e=>setTargetVersion(e.target.value)}/></label><label>등록 연결 hash<input aria-label="등록 연결 hash" value={targetHash} onChange={e=>setTargetHash(e.target.value)}/></label><button type="button" onClick={()=>void run(async check=>{const ref={id:targetId,version:Number(targetVersion),contentHash:targetHash};const value=await readDefinition(client,confirmed.projectId,ref,check);if(check())replace(b,editPreparation(b,{targetConnectionRef:value.ref,targetSelected:true}));})}>등록 대상 보호 조회·선택</button>
 </fieldset><p>선택: 맥락 {b.contextSelected?b.contextRef?.id??'명시 미수집':'미확인'} · 역할 {b.roleSelected?b.roleRef?.id??'명시 미선택':'미확인'} · 결박 {b.bindingSelected?b.oldBindingRef?.id??'명시 미수집':'미확인'} · 대상 {b.targetSelected?b.targetConnectionRef?.id??'명시 미선택':'미확인'}</p>
 {!b.pending?<button type="button" disabled={busy} onClick={()=>void prepare()}>준비기록 원명령 준비</button>:<><p>원명령 {b.pending.command.commandId} · {b.pending.state==='UNKNOWN'?'결과 미확인 · 원입력 잠금':b.pending.state}</p>{['PREPARED','UNKNOWN'].includes(b.pending.state)?<button type="button" disabled={busy} onClick={()=>void save()}>같은 준비기록 명령 저장·재확인</button>:null}{b.pending.state==='REJECTED'?<button type="button" disabled={busy} onClick={()=>replace(b,editRejectedPreparation(b))}>준비기록 거절 확인 후 수정</button>:null}{b.pending.receipt?<><p>저장 영수증 보존 {b.pending.receipt.data.ref.id} · v1 · {b.pending.receipt.data.ref.contentHash}</p><button type="button" disabled={busy} onClick={()=>void read()}>저장 준비기록 고정 조회</button><button type="button" disabled={busy} onClick={next}>다음 독립 준비기록 작성</button></>:null}</>}
 </>}{b?.storedCommands?.map(saved=><section key={saved.command.commandId} aria-label="보존 준비기록 영수증"><p>보존 원명령 {saved.command.commandId} · {saved.receipt.data.ref.id} · v1 · {saved.receipt.data.ref.contentHash}</p><button type="button" disabled={busy} onClick={()=>void run(async check=>{const result=await readPreparationRecord(client,confirmed.projectId,saved.receipt.data.ref,confirmed.ref,check);if(check())setView({owner:scope,value:result});})}>보존 준비기록 {saved.receipt.data.ref.id} 고정 조회</button></section>)}{busy?<p role="status">고정 자료 대조 중</p>:null}{error?.owner===scope?<p role="alert">{error.value}</p>:b?.failure?<p role="alert">{b.failure.code}</p>:null}
 {view?<section aria-label="준비기록 고정 원문"><p>{view.ref.id} · v1 · {view.ref.contentHash}</p><p>보관 관측 {view.record.observedAt} · 의도 기한 {view.record.intentExpiresAt} · {view.currentStatus.intentExpired?'과거 기한 경과':'조회 시 기한 이내'} · 원자료 현재성 {view.currentStatus.sourceCurrentness} · 실제 인계 불가</p><p>미확인 공백: {view.record.gaps.join(', ')}</p><pre>{JSON.stringify(view.record,null,2)}</pre>
 {view.record.budgetRef?<HistoricalBudget key={JSON.stringify([view.ref,view.record.budgetRef])} client={client} projectId={confirmed.projectId} reference={view.record.budgetRef} current={()=>current()&&displayed.current===rawView} onAuthenticationLost={()=>lost.current()}/>:<p>한도 정책 참조 없음</p>}
 {view.record.targetConnectionRef?<HistoricalTarget key={JSON.stringify([displayedGeneration.current,view.ref,view.record.targetConnectionRef])} client={client} projectId={confirmed.projectId} reference={view.record.targetConnectionRef} current={()=>current()&&displayed.current===rawView} onAuthenticationLost={()=>lost.current()} onSelect={b&&!locked?(ref,check)=>void selectHistorical({field:'targetConnectionRef',ref},check):undefined} selecting={busy}/>:<p>대상 연결 참조 없음</p>}
 {view.record.contextRef?<HistoricalContext key={JSON.stringify([displayedGeneration.current,view.ref,view.record.contextRef])} client={client} projectId={confirmed.projectId} assignmentRef={confirmed.ref} reference={view.record.contextRef} current={()=>current()&&displayed.current===rawView} onAuthenticationLost={()=>lost.current()} onSelect={b&&!locked?(ref,check)=>void selectHistorical({field:'contextRef',ref},check):undefined} selecting={busy}/>:<p>당시 맥락 참조 없음</p>}
 <HistoricalResponsibility key={JSON.stringify([displayedGeneration.current,view.ref,view.record.roleRef,view.record.oldBindingRef])} client={client} confirmed={confirmed} roleRef={view.record.roleRef} bindingRef={view.record.oldBindingRef} current={()=>current()&&displayed.current===rawView} onAuthenticationLost={()=>lost.current()} onSelect={b&&!locked?(roleRef,bindingRef,check)=>void selectHistorical({field:'responsibility',roleRef,bindingRef},check):undefined} selecting={busy}/>
 <button type="button" onClick={()=>setView(null)}>준비기록 원문 닫기</button></section>:null}
 </section>;
}

type ResponsibilityRead={state:'idle'|'loading'}|{state:'loaded';role:Awaited<ReturnType<typeof readPreparationRole>>;binding:Awaited<ReturnType<typeof readPreparationBinding>>|null}|{state:'error';code:string};
function HistoricalResponsibility({client,confirmed,roleRef,bindingRef,current,onAuthenticationLost,onSelect,selecting}:{
 client:ApiClient;confirmed:ConfirmedAssignmentView;roleRef:PlanRef|null;bindingRef:PlanRef|null;current:()=>boolean;onAuthenticationLost:()=>void;
 onSelect?:(role:PlanRef,binding:PlanRef,current:()=>boolean)=>void;selecting:boolean;
}){
 const [read,setRead]=useState<ResponsibilityRead>({state:'idle'}),sequence=useRef(0),inFlight=useRef(false);
 const displayedTicket=sequence.current;
 useLayoutEffect(()=>()=>{sequence.current++;inFlight.current=false;},[]);
 async function load(){
  if(!roleRef||inFlight.current||!current())return;
  const ticket=++sequence.current,active=()=>ticket===sequence.current&&current();inFlight.current=true;setRead({state:'loading'});
  try{
   const role=await readPreparationRole(client,confirmed,roleRef.id,roleRef.version,active);
   if(!active())return;if(!same(role.ref,roleRef))throw new ApiError('TRANSFER_PREPARATION_ROLE_MISMATCH',412);
   const binding=bindingRef?await readPreparationBinding(client,confirmed,role,bindingRef.id,bindingRef.version,active):null;
   if(!active())return;if(binding&&bindingRef&&!same(binding.ref,bindingRef))throw new ApiError('TRANSFER_PREPARATION_BINDING_MISMATCH',412);
   setRead({state:'loaded',role,binding});
  }catch(cause){
   if(!active())return;const error=cause instanceof ApiError?cause:new ApiError('TRANSFER_PREPARATION_RESPONSE_INVALID',503);
   setRead({state:'error',code:/^[A-Z_]{1,80}$/.test(error.code)?error.code:'TRANSFER_PREPARATION_RESPONSE_INVALID'});
   if(error.status===401)onAuthenticationLost();
  }finally{if(ticket===sequence.current)inFlight.current=false;}
 }
 const shown=current()&&read.state==='loaded'?read:null;
 const refText=(ref:PlanRef)=>`${ref.id} · v${ref.version} · ${ref.contentHash}`;
 return <section aria-label="당시 역할·책임 결박">
  {!roleRef?<p>당시 역할 미기록</p>:<button type="button" disabled={read.state==='loading'} onClick={()=>void load()}>당시 역할·책임 결박 원문 열기</button>}
  {!bindingRef?<p>당시 기존 책임 결박 미기록</p>:null}
  {read.state==='loading'?<p role="status">당시 책임 관계 보호 조회 중 · 이전 원문 숨김</p>:null}
  {read.state==='error'?<p role="alert">{read.code} · 당시 책임 관계를 확인할 수 없습니다.</p>:null}
  {shown?<section aria-label="당시 책임 관계 고정 원문">
   <p>당시 역할 {refText(shown.role.ref)}</p><pre>{JSON.stringify(shown.role.snapshot,null,2)}</pre>
   {shown.binding?<><p>당시 책임 결박 {refText(shown.binding.ref)}</p><p>당시 세션 {refText(shown.binding.snapshot.sessionRef)}</p><p>당시 연결 {refText(shown.binding.snapshot.connectionRef)}</p><p>당시 예약 세대 {shown.binding.snapshot.generation} · 상태 {shown.binding.snapshot.state} · {shown.binding.snapshot.connectionReadiness}</p><pre>{JSON.stringify(shown.binding.snapshot,null,2)}</pre></>:null}
   <p>보관 예약 관계입니다. 현재 권한·세션 가동·중지·쓰기 회수·이해 합격·인계 또는 실행 허가를 뜻하지 않습니다.</p>
   {onSelect&&shown.binding?<button type="button" disabled={selecting} onClick={()=>{
    if(shown.binding)onSelect(shown.role.ref,shown.binding.ref,()=>current()&&!inFlight.current&&sequence.current===displayedTicket);
   }}>당시 역할·책임 결박을 현재 새 준비기록에 선택</button>:null}
  </section>:null}
 </section>;
}

type ContextRead={state:'idle'|'loading'}|{state:'loaded';value:NonNullable<Awaited<ReturnType<typeof readTransferContext>>>}|{state:'error';code:string};
function HistoricalContext({client,projectId,assignmentRef,reference,current,onAuthenticationLost,onSelect,selecting}:{
 client:ApiClient;projectId:string;assignmentRef:PlanRef;reference:PlanRef;current:()=>boolean;onAuthenticationLost:()=>void;onSelect?: (ref:PlanRef,current:()=>boolean)=>void;selecting:boolean;
}){
 const [read,setRead]=useState<ContextRead>({state:'idle'});
 const sequence=useRef(0),inFlight=useRef(false);
 const displayedTicket=sequence.current;
 useLayoutEffect(()=>()=>{sequence.current++;inFlight.current=false;},[]);
 async function load(){
  if(inFlight.current||!current())return;
  const ticket=++sequence.current,active=()=>ticket===sequence.current&&current();
  inFlight.current=true;setRead({state:'loading'});
  try{
   const value=await readTransferContext(client,projectId,assignmentRef,reference,active);
   if(active()&&value)setRead({state:'loaded',value});
  }catch(error){
   if(!active())return;
   setRead({state:'error',code:error instanceof ApiError&&/^[A-Z_]{1,80}$/.test(error.code)?error.code:'CONTEXT_RESPONSE_INVALID'});
   if(error instanceof ApiError&&error.status===401)onAuthenticationLost();
  }finally{if(ticket===sequence.current)inFlight.current=false;}
 }
 return <section aria-label="당시 맥락 조회">
  <button type="button" disabled={read.state==='loading'} onClick={()=>void load()}>당시 맥락 원문 열기</button>
  {read.state==='loading'?<p role="status">저장된 맥락 조회 중</p>:null}
  {read.state==='error'?<p role="alert">{read.code} · 저장된 맥락을 확인할 수 없습니다.</p>:null}
  {read.state==='loaded'?<section aria-label="당시 맥락 고정 원문">
   <p>{read.value.ref.id} · v{read.value.ref.version} · {read.value.ref.contentHash}</p>
   <p>보관 맥락 metadata · 조회 관측 {read.value.observedAt}</p>
   <p>현재 원문 대조 {read.value.currentCheck.state} · {read.value.currentCheck.issues.join(', ')||'추가 보고 없음 · 의미 적합 미확인'}</p>
   <p>누락: {read.value.manifest.missingRequired.join(', ')||'당시 metadata상 없음 · 전체 맥락 완비 판정 아님'}</p>
   <p>제외: {read.value.manifest.excluded.join(', ')||'당시 metadata상 없음'}</p>
   <details><summary>고정 참조·누락·전달 계획 metadata</summary><pre>{JSON.stringify(read.value.manifest,null,2)}</pre></details>
   <p>이 조회는 원자료 본문 수집·이전 승인·Agent 전달·실행 완료를 확인하지 않습니다.</p>
   {onSelect?<button type="button" disabled={selecting} onClick={()=>onSelect(read.value.ref,()=>current()&&sequence.current===displayedTicket)}>당시 맥락을 현재 새 준비기록에 선택</button>:null}
   <TransferContextOriginals client={client} projectId={projectId} assignmentRef={assignmentRef} context={read.value} current={()=>current()&&sequence.current===displayedTicket} onUnavailable={error=>{if(current()&&sequence.current===displayedTicket&&error.status===401)onAuthenticationLost();}}/>
  </section>:null}
 </section>;
}

type TargetRead={state:'idle'|'loading'}|{state:'loaded';value:DefinitionView}|{state:'error';code:string};
function HistoricalTarget({client,projectId,reference,current,onAuthenticationLost,onSelect,selecting}:{
 client:ApiClient;projectId:string;reference:PlanRef;current:()=>boolean;onAuthenticationLost:()=>void;
 onSelect?:(ref:PlanRef,current:()=>boolean)=>void;selecting:boolean;
}){
 const [read,setRead]=useState<TargetRead>({state:'idle'});
 const sequence=useRef(0),inFlight=useRef(false);
 const displayedTicket=sequence.current;
 useLayoutEffect(()=>()=>{sequence.current++;inFlight.current=false;},[]);
 async function load(){
  if(inFlight.current||!current())return;
  const ticket=++sequence.current,active=()=>ticket===sequence.current&&current();
  inFlight.current=true;setRead({state:'loading'});
  try{
   const value=await readDefinition(client,projectId,reference,active);
   if(active())setRead({state:'loaded',value});
  }catch(error){
   if(!active())return;
   setRead({state:'error',code:error instanceof ApiError&&/^[A-Z_]{1,80}$/.test(error.code)?error.code:'CONNECTION_RESPONSE_INVALID'});
   if(error instanceof ApiError&&error.status===401)onAuthenticationLost();
  }finally{if(ticket===sequence.current)inFlight.current=false;}
 }
 return <section aria-label="당시 대상 연결 정의">
  <button type="button" disabled={read.state==='loading'} onClick={()=>void load()}>당시 대상 연결 정의 열기</button>
  {read.state==='loading'?<p role="status">저장된 대상 연결 조회 중</p>:null}
  {read.state==='error'?<p role="alert">{read.code} · 저장된 대상 연결을 확인할 수 없습니다.</p>:null}
  {read.state==='loaded'?<><h4>{read.value.definition.label}</h4>
   <p>저장된 대상 연결 {read.value.ref.id} · v{read.value.ref.version} · {read.value.ref.contentHash}</p>
   <p>정의 상태 {read.value.definition.status} · 지원 상태 {read.value.currentStatus.support} · 실행 권한 없음</p>
   <pre>{JSON.stringify(read.value.definition,null,2)}</pre>
   {onSelect?<button type="button" disabled={selecting} onClick={()=>onSelect(read.value.ref,()=>current()&&!inFlight.current&&sequence.current===displayedTicket)}>당시 대상 연결을 현재 새 준비기록에 선택</button>:null}
  </>:null}
 </section>;
}

type BudgetRead={state:'idle'|'loading'}|{state:'loaded';policy:LimitPolicyRecord}|{state:'error';code:string};
function HistoricalBudget({client,projectId,reference,current,onAuthenticationLost}:{
 client:ApiClient;projectId:string;reference:PlanRef;current:()=>boolean;onAuthenticationLost:()=>void;
}){
 const [read,setRead]=useState<BudgetRead>({state:'idle'});
 const sequence=useRef(0),inFlight=useRef(false);
 useLayoutEffect(()=>()=>{sequence.current++;inFlight.current=false;},[]);
 async function load(){
  if(inFlight.current||!current())return;
  const ticket=++sequence.current;
  const active=()=>ticket===sequence.current&&current();
  inFlight.current=true;
  setRead({state:'loading'});
  try{
   const policy=await readLimitPolicy(client,projectId,reference);
   if(active())setRead({state:'loaded',policy});
  }catch(error){
   if(!active())return;
   const code=error instanceof ApiError&&/^[A-Z_]{1,80}$/.test(error.code)?error.code:'LIMIT_POLICY_RESPONSE_INVALID';
   setRead({state:'error',code});
   if(error instanceof ApiError&&error.status===401)onAuthenticationLost();
  }finally{if(ticket===sequence.current)inFlight.current=false;}
 }
 const snapshot=read.state==='loaded'?read.policy.snapshot:null;
 return <section aria-label="당시 저장된 한도 정책">
  <button type="button" disabled={read.state==='loading'} onClick={()=>void load()}>당시 저장된 한도 정책 보기</button>
  {read.state==='loading'?<p role="status">저장된 정책 조회 중</p>:null}
  {read.state==='error'?<p role="alert">{read.code} · 저장된 정책을 확인할 수 없습니다.</p>:null}
  {snapshot?<><h4>당시 저장된 한도 정책</h4><p>저장된 정책 상태: {snapshot.state==='APPLIED'?'적용':'회수'} · 현재 가용 예산과 실행·재개 허가는 미확인입니다.</p>
   <p>결정 시각 {snapshot.decidedAt} · 만료 시각 {snapshot.expiresAt}</p><p>결정 이유 {snapshot.reason}</p>
   <dl><dt>최대 시도</dt><dd>{snapshot.limits.maxAttempts}회</dd><dt>최대 경과 시간</dt><dd>{snapshot.limits.maxElapsedMs} ms</dd>
    <dt>최대 호출</dt><dd>{snapshot.limits.maxCalls}회</dd><dt>최대 동시 임무</dt><dd>{snapshot.limits.maxConcurrentAssignments}개</dd>
    <dt>최대 임시 보관량</dt><dd>{snapshot.limits.maxSpoolBytes} B</dd><dt>최대 오프라인 시간</dt><dd>{snapshot.limits.maxOfflineMs} ms</dd>
    {snapshot.limits.maxCost!==undefined?<><dt>비용 한도</dt><dd>{snapshot.limits.maxCost} {snapshot.limits.currency}</dd></>:null}</dl>
  </>:null}
 </section>;
}
