import {normalInitialUnderstandingOwner,type NormalInitialUnderstandingReviewStorage} from '../session-detail/understanding-review-write.ts';
import {useEffect,useRef,useState} from 'react';import {ApiClient,ApiError} from '../../api/client.ts';import {approvalRequestHref,mobileApprovalRequestHref,routeHref} from '../../shell/routes.ts';import type {DocumentSession} from '../design-trace/editor-api.ts';import type {ConfirmedAssignmentView} from './assignment-confirmation-api.ts';import type {Ref} from '../connections/api.ts';import {ordered} from '../knowledge/review-view.ts';import {sendApprovalCommand} from '../decisions/api.ts';
import {newExecutionPreparation,assertDefinitionReportCurrent,loadPreparationChoices,selectPreparationSources,prepareExecutionCommand,sendExecutionPreparation,executionPreparationOwned,selectNormalWorkUnderstanding,ExecutionPreparationRejected,type ExecutionPreparationBuffer,type ExecutionPreparationChange,type DefinitionReportSelection} from './execution-preparation-api.ts';import {newExecutionApproval,prepareExecutionApproval,bindExecutionApproval,canCloseRejectedExecutionApproval,closeRejectedExecutionApproval} from './execution-preparation-approval.ts';
import {readContextPreparation,type ContextPreparationBuffer} from './context-api.ts';
import type {ExactWorkReviewCandidate} from './claim-understanding-history.ts';
type DispatchLatch={previous:ExecutionPreparationBuffer;next:ExecutionPreparationBuffer};
interface Props{mobile?:boolean;providedDefinitionReport?:DefinitionReportSelection|null;normalInitialReviews?:NormalInitialUnderstandingReviewStorage;knownNormalScopes?:ExactWorkReviewCandidate['scope'][];exactWorkCandidates?:ExactWorkReviewCandidate[];savedContextBuffer?:ContextPreparationBuffer|null;client:ApiClient;confirmed:ConfirmedAssignmentView;session:DocumentSession;providedHumanReportRef:Ref|null;buffer:ExecutionPreparationBuffer|null;onChange:(change:ExecutionPreparationChange)=>void;owner:boolean;onAuthenticationLost:()=>void}
export function ExecutionPreparationEditor({mobile=false,providedDefinitionReport=null,normalInitialReviews,knownNormalScopes=[],exactWorkCandidates=[],savedContextBuffer=null,client,confirmed,session,providedHumanReportRef,buffer,onChange,owner,onAuthenticationLost}:Props){const [choices,setChoices]=useState<Awaited<ReturnType<typeof loadPreparationChoices>>>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[ack,setAck]=useState(false);const acknowledgements=useRef<Array<{next:ExecutionPreparationBuffer;active:()=>boolean;resolve:(ok:boolean)=>void}>>([]);const currentBuffer=useRef(buffer);currentBuffer.current=buffer;const key=ordered([confirmed.projectId,confirmed.ref,session.user.id,session.clientId,session.csrfToken,providedHumanReportRef,providedDefinitionReport,owner]),context=useRef({client,transport:client.transport,key,epoch:0});if(context.current.client!==client||context.current.transport!==client.transport||context.current.key!==key)context.current={client,transport:client.transport,key,epoch:context.current.epoch+1};const identity=context.current,alive=useRef(true),ticket=useRef(0),lock=useRef(false);useEffect(()=>{alive.current=true;return()=>{alive.current=false;ticket.current++;for(const a of acknowledgements.current)a.resolve(false);acknowledgements.current=[];};},[]);useEffect(()=>{setBusy(false);setChoices(null);setError('');setAck(false);lock.current=false;},[identity]);
 const [dispatchRevision,setDispatchRevision]=useState(0);
 useEffect(()=>{
  const waiting=acknowledgements.current;acknowledgements.current=[];
  for(const a of waiting)a.resolve(buffer===a.next&&a.active());
 },[buffer,identity,dispatchRevision]);
 function commitForDispatch({previous,next}:DispatchLatch,active:()=>boolean){
  return new Promise<boolean>(resolve=>{
   let committed=false;
   const waiting={next,active,resolve:(ok:boolean)=>{committed=ok;resolve(ok);}};
   acknowledgements.current.push(waiting);
   onChange(value=>value===previous&&(committed||acknowledgements.current.includes(waiting)&&active())?next:value);
   // The parent may ignore the updater entirely. Observe a commit even when its buffer did not change.
   setDispatchRevision(v=>v+1);
  });
 }
 function restoreUnissuedDispatch({previous,next}:DispatchLatch){
  // The original parent scope owns this rollback even if the editor has since lost that scope.
  onChange(value=>value===next?previous:value);
 }

 const savedKey=ordered(savedContextBuffer),savedSelection=useRef({buffer:savedContextBuffer,key:savedKey});if(savedSelection.current.buffer!==savedContextBuffer||savedSelection.current.key!==savedKey)savedSelection.current={buffer:savedContextBuffer,key:savedKey};
 const savedContext=savedContextBuffer?.resultRef&&!savedContextBuffer.uncertain&&savedContextBuffer.projectId===confirmed.projectId&&savedContextBuffer.ownerUserId===session.user.id&&savedContextBuffer.ownerClientId===session.clientId&&ordered(savedContextBuffer.assignmentRef)===ordered(confirmed.ref)&&ordered(savedContextBuffer.budgetRef)===ordered(confirmed.snapshot.definition.budgetRef)?savedContextBuffer:null;
 const bound=buffer?.projectId===confirmed.projectId&&ordered(buffer.assignmentRef)===ordered(confirmed.ref)&&buffer.ownerUserId===session.user.id&&buffer.ownerClientId===session.clientId&&executionPreparationOwned(client,buffer,session),work=bound?buffer:null;
 const preparationReportRef=work?.definitionReportSelection?.reportRef??providedHumanReportRef;
 const exactKey=ordered(exactWorkCandidates),exactScope=useRef({key:exactKey});
 if(exactScope.current.key!==exactKey)exactScope.current={key:exactKey};
 const exactFor=(scope:ExactWorkReviewCandidate['scope'])=>exactWorkCandidates.find(candidate=>ordered(candidate.scope)===ordered(scope));
 function exactSelectionCurrent(b:ExecutionPreparationBuffer){
  const basis=b.understandingSelection?.basis;
  if(!basis)return true;
  const candidate=exactFor(basis.scope);
  return !candidate||ordered(candidate)===ordered({scope:basis.scope,reviewRef:basis.reviewRef,assignmentRef:basis.assignmentRef,roleBindingRef:basis.roleBindingRef,agentSessionRef:basis.agentSessionRef});
 }
 const settle=(expected:ExecutionPreparationBuffer,next:ExecutionPreparationBuffer)=>onChange(previous=>previous&&ordered(previous)===ordered(expected)?next:previous);
 async function run(fn:(active:()=>boolean)=>Promise<void>){if(lock.current)return;lock.current=true;setBusy(true);setError('');const t=++ticket.current,at=context.current;const active=()=>alive.current&&context.current===at&&client.transport===at.transport&&ticket.current===t&&(!currentBuffer.current?.understandingSelection||executionPreparationOwned(client,currentBuffer.current,session));try{await fn(active);}catch(e){if(active()){const a=e instanceof ApiError?e:new ApiError('RESPONSE_INVALID');setError(a.code);if(a.status===401)onAuthenticationLost();}}finally{if(active()){setBusy(false);lock.current=false;}}}
 async function begin(){if(!owner||work?.pending||work?.uncertain)return;if(work?.dirty&&!confirm('미저장 실행 의도 입력을 버리고 새로 준비할까요?'))return;await run(async active=>{const next=newExecutionPreparation(confirmed,session),value=await loadPreparationChoices(client,confirmed,active);if(!active()||!value)return;onChange(previous=>previous===buffer?next:previous);setChoices(value);setAck(false);});}
 function edit(change:(value:ExecutionPreparationBuffer)=>void){if(!owner||!work||work.pending||work.result||busy)return;const next=structuredClone(work);change(next);if(next.definitionReportSelection&&(ordered(next.draft.capabilityRef)!==ordered(next.definitionReportSelection.reportRef)||ordered(next.draft.roleBindingRef)!==ordered(work.draft.roleBindingRef)))delete next.definitionReportSelection;if(ordered([next.draft.roleBindingRef,next.draft.contextBundleRef,next.draft.capabilityRef,next.draft.mode])!==ordered([work.draft.roleBindingRef,work.draft.contextBundleRef,work.draft.capabilityRef,work.draft.mode]))delete next.understandingSelection;next.sources=null;next.dirty=true;settle(work,next);}
 async function reloadChoices(){await run(async active=>{const value=await loadPreparationChoices(client,confirmed,active);if(active()&&value)setChoices(value);});}
 async function chooseSavedContext(){
  if(!owner||!work||!savedContext?.resultRef||work.pending||work.uncertain||work.savedReceipt||work.result)return;
  const original=work,selection=savedSelection.current,ref=structuredClone(savedContext.resultRef),transport=client.transport;
  await run(async active=>{
   const current=()=>active()&&client.transport===transport&&currentBuffer.current===original&&savedSelection.current===selection;
   try{const value=await readContextPreparation(client,confirmed.projectId,ref);if(!current())return;
    if(ordered(value.manifest.assignmentRef)!==ordered(confirmed.ref)||ordered(value.manifest.budgetRef)!==ordered(confirmed.snapshot.definition.budgetRef))throw new ApiError('EXECUTION_BINDING_MISMATCH');
    const next=structuredClone(original);next.draft.contextBundleRef=structuredClone(value.ref);
    if(ordered(original.draft.contextBundleRef)!==ordered(next.draft.contextBundleRef))delete next.understandingSelection;
    next.sources=null;next.dirty=true;
    onChange(previous=>previous===original&&current()?next:previous);
   }catch(e){if(current())throw e;}
  });
 }
 async function inspect(){if(owner&&work&&!preparationReportRef){setError('EXECUTION_PREPARATION_SOURCE_REQUIRED');return;}if(!owner||!work||!preparationReportRef||!work.draft.roleBindingRef||!work.draft.contextBundleRef||!work.draft.capabilityRef)return;const original=structuredClone(work);await run(async active=>{const sources=await selectPreparationSources(client,confirmed,{roleBindingRef:original.draft.roleBindingRef!,contextBundleRef:original.draft.contextBundleRef!,capabilityRef:original.draft.capabilityRef!},preparationReportRef,active);await assertDefinitionReportCurrent(client,{...original,sources},session,active);if(active())settle(original,{...original,sources});});}
 async function freeze(){if(owner&&work&&!preparationReportRef){setError('EXECUTION_PREPARATION_SOURCE_REQUIRED');return;}if(!owner||!work||!preparationReportRef||work.pending)return;const original=structuredClone(work),selection=exactScope.current;await run(async active=>{
  if(!exactSelectionCurrent(original))throw new ApiError('WORK_PREPARATION_UNDERSTANDING_CHANGED',412);
  const current=()=>active()&&(!original.understandingSelection||exactScope.current===selection)&&ordered(currentBuffer.current)===ordered(original);
  const next=await prepareExecutionCommand(client,original,confirmed,session,preparationReportRef,current);if(current())settle(original,next);
 });}

 async function save(){
  if(!owner||!work?.pending||!ack)return;
  let current=structuredClone(work),predecessor:ExecutionPreparationBuffer|null=null,dispatched=false,unissuedLatch:DispatchLatch|undefined;
  const previouslyUncertain=current.uncertain,selection=exactScope.current,reconciling=current.uncertain||!!current.savedReceipt;
  await run(async active=>{
   const ownsBuffer=()=>active()&&(ordered(currentBuffer.current)===ordered(current)||predecessor!==null&&ordered(currentBuffer.current)===ordered(predecessor));
   const owned=()=>ownsBuffer()&&(!current.understandingSelection||reconciling||dispatched||exactScope.current===selection);
   try{
    if(!reconciling&&!exactSelectionCurrent(current))throw new ApiError('WORK_PREPARATION_UNDERSTANDING_CHANGED',412);
    const result=await sendExecutionPreparation(client,current,session,owned,receipt=>{
     const next={...current,savedReceipt:receipt,uncertain:false,failure:null};predecessor=current;settle(current,next);current=next;
    },async()=>{
     if(!owned())return false;
     const previous=currentBuffer.current;
     if(!previous)return false;
     const next={...current,uncertain:true,failure:null,...(current.understandingSelection||current.definitionReportSelection?{preparationDispatchStarted:true}:{})},latch={previous,next};predecessor=current;current=next;
     if(!reconciling)unissuedLatch=latch;
     if(current.understandingSelection||current.definitionReportSelection){
      const accepted=await commitForDispatch(latch,owned);
      if(!accepted||!active()||currentBuffer.current!==next)return false;
     }else settle(predecessor!,next);
     return owned();
    },()=>{dispatched=true;});
    if(owned())settle(current,{...current,result,pending:null,pendingHash:null,uncertain:false,failure:null});
   }catch(e){
    if(!dispatched&&unissuedLatch)restoreUnissuedDispatch(unissuedLatch);
    else if(ownsBuffer()){
     const a=e instanceof ApiError?e:new ApiError('RESPONSE_INVALID');
     settle(current,{...current,result:null,uncertain:current.savedReceipt?false:previouslyUncertain||dispatched&&!(e instanceof ExecutionPreparationRejected),failure:{code:a.code,status:a.status}});
    }
    throw e;
   }
  });
 }


 async function requestBegin(){
  if(!owner||!work)return;
  const original=structuredClone(work),selection=exactScope.current;
  await run(async active=>{
   if(!exactSelectionCurrent(original))throw new ApiError('WORK_PREPARATION_UNDERSTANDING_CHANGED',412);
   const request=await newExecutionApproval(original,session,client);
   if(active()&&(!original.understandingSelection||exactScope.current===selection))settle(original,{...original,approval:{request,requestId:'',commandHash:null}});
  });
 }
 function requestEdit(change:(request:NonNullable<NonNullable<ExecutionPreparationBuffer['approval']>['request']>)=>void){if(!owner||!work?.approval?.request||work.approval.request.pending||work.approval.request.resultId||busy)return;const next=structuredClone(work);change(next.approval!.request!);settle(work,next);}
 async function requestSave(){
  if(!owner||!work?.approval?.request)return;
  const original=structuredClone(work),originalRequest=original.approval!.request!,selection=exactScope.current;
  let current=original,dispatched=false,unissuedLatch:DispatchLatch|undefined;
  await run(async active=>{
   const owns=()=>active()&&(ordered(currentBuffer.current)===ordered(original)||ordered(currentBuffer.current)===ordered(current));
   const canSend=()=>owns()&&(!!originalRequest.pending||!original.understandingSelection||exactScope.current===selection)&& (!!originalRequest.pending||!original.definitionReportSelection||Date.parse(original.definitionReportSelection.expiresAt)>Date.now());
   try{
    let request=originalRequest;
    if(!request.pending){
     if(!exactSelectionCurrent(original))throw new ApiError('WORK_PREPARATION_UNDERSTANDING_CHANGED',412);
     const pending=await prepareExecutionApproval(client,original,request,session,canSend);
     const previous=currentBuffer.current;
     if(!previous||!canSend())throw new ApiError('EXECUTION_PREPARATION_CONTEXT_CHANGED',412);
     request={...request,pending,uncertain:true};
     current={...original,approval:{...original.approval!,request}};
     unissuedLatch={previous,next:current};
     const accepted=await commitForDispatch(unissuedLatch,canSend);
     if(!accepted||currentBuffer.current!==current)throw new ApiError('EXECUTION_PREPARATION_DISPATCH_REJECTED',409);
    }
    const result=await sendApprovalCommand(client,request.pending!,session,()=>{
     if(!canSend()||!originalRequest.pending&&currentBuffer.current!==current)return false;
     dispatched=true;return true;
    });
    if(!owns())return;
    settle(current,{...current,approval:{...current.approval!,request:{...request,resultId:result.data.ref.id,uncertain:false,failure:null},requestId:result.data.ref.id}});
   }catch(e){
    if(!dispatched&&unissuedLatch)restoreUnissuedDispatch(unissuedLatch);
    else if(owns()){
     const a=e instanceof ApiError?e:new ApiError('RESPONSE_INVALID');
     const request=dispatched?current.approval!.request!:originalRequest;
     settle(current,{...current,approval:{...current.approval!,request:{...request,uncertain:request.uncertain||dispatched,failure:{code:a.code,status:a.status}}}});
    }
    throw e;
   }
  });
 }
 async function bind(){
  if(!owner||!work?.approval?.requestId)return;
  const original=structuredClone(work),selection=exactScope.current;
  await run(async active=>{
   if(!exactSelectionCurrent(original))throw new ApiError('WORK_PREPARATION_UNDERSTANDING_CHANGED',412);
   const current=()=>active()&&(!original.understandingSelection||exactScope.current===selection)&&ordered(currentBuffer.current)===ordered(original);
   const next=await bindExecutionApproval(client,original,original.approval!.requestId,session,current);
   if(current())settle(original,next);
  });
 }
 const approvalCloseRoute=globalThis.location?.hash;
 async function closeRejectedApproval(){
  if(!owner||!work||currentBuffer.current!==work||approvalCloseRoute!==globalThis.location?.hash||!canCloseRejectedExecutionApproval(work))return;
  const original=work;
  await run(async active=>{
   const current=()=>active()&&currentBuffer.current===original&&approvalCloseRoute===globalThis.location?.hash;
   try{
    const next=await closeRejectedExecutionApproval(client,original,session,current);
    if(!current())return;
    onChange(previous=>previous===original&&current()?next:previous);
    setAck(false);
   }catch(e){if(current())throw e;}
  });
 }
 const epoch=normalInitialUnderstandingOwner(client,session);
 const normalScopes=[...exactWorkCandidates.map(v=>v.scope),...knownNormalScopes,...Object.values(normalInitialReviews?.buffers??{}).filter(v=>v&&v.ownerEpoch===epoch&&v.ownerUserId===session.user.id&&v.ownerClientId===session.clientId&&v.stored&&v.basis.scope.projectId===confirmed.projectId&&ordered(v.basis.assignmentRef)===ordered(confirmed.ref)).map(v=>v!.basis.scope)].filter((v,n,all)=>v.projectId===confirmed.projectId&&all.findIndex(x=>ordered(x)===ordered(v))===n);
 async function chooseUnderstanding(scope:ExactWorkReviewCandidate['scope'],candidate?:ExactWorkReviewCandidate){
  if(!owner||!work||work.draft.mode!=='WORK'||work.pending||work.result||work.savedReceipt||work.uncertain||!preparationReportRef||!work.draft.roleBindingRef||!work.draft.contextBundleRef||!work.draft.capabilityRef)return;
  const original=work,transport=client.transport,selection=exactScope.current;
  await run(async active=>{
   const current=()=>active()&&client.transport===transport&&currentBuffer.current===original&&exactScope.current===selection&&normalInitialUnderstandingOwner(client,session)===epoch;
   if(candidate&&(ordered(candidate.assignmentRef)!==ordered(confirmed.ref)||ordered(candidate.roleBindingRef)!==ordered(original.draft.roleBindingRef)))throw new ApiError('WORK_PREPARATION_UNDERSTANDING_CHANGED',412);
   const sources=await selectPreparationSources(client,confirmed,original.draft as any,preparationReportRef,current);
   const verified=await selectNormalWorkUnderstanding(client,confirmed,sources,scope,session,current,candidate);
   if(current())onChange(previous=>current()&&previous===original?{...original,sources,understandingSelection:verified,dirty:true}:previous);
  });
 }
 async function chooseDefinitionReport(){
  if(!owner||!work||work.pending||work.savedReceipt||work.result||work.uncertain||!providedDefinitionReport||!work.draft.roleBindingRef||!work.draft.contextBundleRef)return;
  const original=work,selected=providedDefinitionReport;
  await run(async active=>{
   const current=()=>active()&&currentBuffer.current===original&&context.current===identity;
   const sources=await selectPreparationSources(client,confirmed,{roleBindingRef:original.draft.roleBindingRef!,contextBundleRef:original.draft.contextBundleRef!,capabilityRef:selected.reportRef},selected.reportRef,current);
   const next={...original,draft:{...original.draft,capabilityRef:selected.reportRef},definitionReportSelection:selected,sources,dirty:true};
   delete next.understandingSelection;
   await assertDefinitionReportCurrent(client,next,session,current);
   if(current())settle(original,next);
  });
 }
 const registered=work?.sources?.kind==='REGISTERED_DEFINITION'||work?.pending?.payload.connectionKind==='REGISTERED_DEFINITION'||choices?.bindings.find(v=>ordered(v.ref)===ordered(work?.draft.roleBindingRef))?.snapshot.connectionKind==='REGISTERED_DEFINITION';
 const locked=busy||!owner||!!work?.pending||!!work?.result;
 const storedRequest=work?.approval?.request;
 let approvalHref:string|null=null;
 if(storedRequest?.resultId&&!storedRequest.uncertain&&storedRequest.projectId===confirmed.projectId&&storedRequest.ownerUserId===session.user.id&&storedRequest.ownerClientId===session.clientId){
  try{approvalHref=(mobile?mobileApprovalRequestHref:approvalRequestHref)(confirmed.projectId,storedRequest.resultId);}catch{/* 고정 저장 요청이 검증되기 전에는 상세 링크를 열지 않는다. */}
 }
 return <section aria-label="실행 의도 준비본"><h5>실행 의도 준비본</h5><p>보관해도 실행 허가가 아닙니다. 실제 Agent를 호출하지 않습니다.</p><button disabled={busy||!owner||!!work?.pending||!!work?.uncertain} onClick={()=>void begin()}>새 실행 의도 준비</button>{error&&<p role="alert">{error}</p>}{buffer&&!bound&&<p>다른 임무·주체의 원입력이 보존되어 있습니다.</p>}
 {!providedHumanReportRef&&!registered&&<p>먼저 <a href={routeHref('connections',confirmed.projectId)}>UI11 도구·환경</a>에서 이 연결·환경의 사람보고를 보관하세요. 임의 참조를 만들지 않습니다.</p>}
 {providedDefinitionReport?<div><p>선택한 등록 정의 사람보고 · 실측·실행 허가 없음 · {ordered(providedDefinitionReport.reportRef)}</p><button type="button" disabled={busy||locked||!work?.draft.roleBindingRef||!work.draft.contextBundleRef} onClick={()=>void chooseDefinitionReport()}>이 등록 정의 보고를 보호 대조 후 선택</button></div>:null}
 {work?.definitionReportSelection?<p>고정한 등록 보고 {ordered(work.definitionReportSelection.reportRef)} · UNVERIFIED · 실행 허가 없음</p>:null}
 {work&&<><button disabled={busy} onClick={()=>void reloadChoices()}>보관 참조 목록 다시 조회</button><p>임무 {ordered(work.assignmentRef)}</p><fieldset disabled={locked}><legend>실제 보관 참조의 명시 선택</legend><label>예약binding<select aria-label="준비 예약binding" value={work.draft.roleBindingRef?.id??''} onChange={e=>edit(b=>{b.draft.roleBindingRef=choices?.bindings.find(v=>v.ref.id===e.target.value)?.ref??null;})}><option value="">선택</option>{work.draft.roleBindingRef&&!choices?.bindings.some(v=>ordered(v.ref)===ordered(work.draft.roleBindingRef))&&<option value={work.draft.roleBindingRef.id}>이전 선택 · 목록 미확인 {work.draft.roleBindingRef.id}</option>}{choices?.bindings.map(v=><option key={v.ref.id} value={v.ref.id}>{v.ref.id} / v{v.ref.version}</option>)}</select></label>{savedContext&&<button disabled={locked||!!work.uncertain||!!work.savedReceipt} onClick={()=>void chooseSavedContext()}>저장한 맥락 원문 확인 후 선택</button>}<label>맥락준비<select aria-label="준비 맥락" value={work.draft.contextBundleRef?.id??''} onChange={e=>edit(b=>{b.draft.contextBundleRef=choices?.contexts.find(v=>v.ref.id===e.target.value)?.ref??null;})}><option value="">선택</option>{work.draft.contextBundleRef&&!choices?.contexts.some(v=>ordered(v.ref)===ordered(work.draft.contextBundleRef))&&<option value={work.draft.contextBundleRef.id}>이전 선택 · 목록 미확인 {work.draft.contextBundleRef.id}</option>}{choices?.contexts.map(v=><option key={v.ref.id} value={v.ref.id}>{v.ref.id} / v{v.ref.version}</option>)}</select></label>{choices&&!choices.bindings.length&&<p>예약binding 없음 · 기존 책임 세션 예약을 먼저 보관하세요.</p>}{choices&&!choices.contexts.length&&<p>맥락준비 없음 · 기존 맥락준비를 먼저 보관하세요.</p>}{providedHumanReportRef&&<><p>{registered?'원 입력으로 보존할 능력 참조 · 실제 능력 미검증':'보관 후 검산된 사람보고 후보'} {ordered(providedHumanReportRef)}</p><button onClick={()=>edit(b=>{b.draft.capabilityRef=structuredClone(providedHumanReportRef);})}>{registered?'이 능력 참조 명시 선택':'이 사람보고 명시 선택'}</button></>}<p>확정환경 {ordered(confirmed.snapshot.definition.environmentRef)} · 예산 {ordered(confirmed.snapshot.definition.budgetRef)} · 현재 가용량/집행 권위 미검증</p><button onClick={()=>void inspect()}>선택 원형 재조회</button>
 <fieldset><legend>허용 소스 범위 명시 선택</legend>{confirmed.snapshot.definition.allowedScopes.flatMap((scope:any,si:number)=>scope.targets.map((target:any,ti:number)=><label key={si+':'+ti}><input type="checkbox" aria-label={'준비 범위 '+target.relativePath+' '+target.access} checked={work.draft.sourceScopes.some(s=>ordered(s.sourceRootRef)===ordered(scope.sourceRootRef)&&s.targets.some((t:any)=>ordered(t)===ordered(target)))} onChange={e=>edit(b=>{const base=b.draft.sourceScopes.filter(s=>ordered(s.sourceRootRef)!==ordered(scope.sourceRootRef)),old=b.draft.sourceScopes.find(s=>ordered(s.sourceRootRef)===ordered(scope.sourceRootRef)),targets=(old?.targets??[]).filter((t:any)=>ordered(t)!==ordered(target));if(e.target.checked)targets.push(structuredClone(target));b.draft.sourceScopes=targets.length?[...base,{...structuredClone(scope),targets}]:base;})}/>{target.relativePath} · {target.access}</label>))}</fieldset><label>준비 mode<select aria-label="준비 mode" value={work.draft.mode} onChange={e=>edit(b=>{b.draft.mode=e.target.value as any;})}><option value="">선택</option><option>CONTEXT_REVIEW</option><option>WORK</option></select></label><label>준비 이유<textarea aria-label="준비 이유" value={work.draft.reason} onChange={e=>edit(b=>{b.draft.reason=e.target.value;})}/></label><button onClick={()=>void freeze()}>의도 준비·입력 확인</button></fieldset>
 {work.draft.mode==='WORK'&&<section aria-label="정상 이해 판단 선택"><h6>정상 이해 판단 · 별도 WORK 준비 근거</h6><p>알려진 실행 범위만 명시 조회합니다. 실행·소스 접근 허가가 아닙니다.</p>{normalScopes.length?normalScopes.map(scope=>{const candidate=exactFor(scope);return <button key={ordered(scope)} disabled={locked||!!work.uncertain||!!work.savedReceipt} onClick={()=>void chooseUnderstanding(scope,candidate)}>{candidate?'선택한 적합 판단 확인 · '+ordered(candidate.reviewRef):'최신 적합 판단 확인·선택'} · {scope.executionId} / {scope.executionGeneration}</button>;}):<p>이 인증에서 확인된 정상 실행 참조가 없습니다. 기존 책임 세션의 정확 수신 기록에서 정상 판단 참조를 확인하세요.</p>}{work.understandingSelection&&<p>선택 판단 {ordered(work.understandingSelection.basis.reviewRef)} · 원 실행 {ordered(work.understandingSelection.basis.scope)} · 저장 전 현재성 재확인</p>}</section>}
 {work.sources&&<details><summary>보호조회 원형·현재성</summary><p>{work.sources.kind==='REGISTERED_DEFINITION'?'REGISTERED_DEFINITION_ONLY · 능력/예산 미검증 · 실행허가 없음':'HUMAN_CLAIM / UNVERIFIED / CANDIDATE_ONLY · 실행허가 없음'}</p><p>맥락 {work.sources.context.currentCheck.state} · 부족 {work.sources.context.manifest.missingRequired.join(', ')}</p><p>예산 {work.sources.budget.snapshot.state} · 기한 {work.sources.budget.snapshot.expiresAt} · 현재head/가용량 미확인</p><ul>{work.sources.kind==='CANDIDATE'&&work.sources.report.currentnessIssues.map(v=><li key={ordered(v)}>{v.code}</li>)}</ul></details>}
 {work.pending&&<><p>원명령 {work.pending.commandId} · payload hash {work.payloadHash}</p><pre>{JSON.stringify(work.pending.payload,null,2)}</pre><label><input type="checkbox" aria-label="준비 보관 확인" checked={ack} onChange={e=>setAck(e.target.checked)}/>실행 허가가 아닌 준비본 보관을 확인했습니다</label><button disabled={busy||!owner||!ack} onClick={()=>void save()}>{work.savedReceipt?'저장된 준비본 원문 다시 조회':work.uncertain?'같은 준비 명령 재확인':'준비본 보관'}</button>{work.failure?.code==='APPROVAL_REQUIRED'&&!work.savedReceipt&&!work.approval&&<button disabled={busy||!owner} onClick={()=>void requestBegin()}>준비본 보관 승인 요청 준비</button>}{!work.savedReceipt&&!work.uncertain&&work.failure&&work.failure.code!=='APPROVAL_REQUIRED'&&<button disabled={busy} onClick={()=>{const next={...work,rejected:[...work.rejected,{command:structuredClone(work.pending!),code:work.failure!.code}],closedApprovals:work.approval?[...work.closedApprovals,{command:structuredClone(work.pending!),request:structuredClone(work.approval.request),requestId:work.approval.requestId,view:work.approval.view??null}]:work.closedApprovals,approval:null,pending:null,pendingHash:null,payloadHash:null,failure:null};settle(work,next);}}>거절 확인 후 준비 수정</button>}</>}
 {work.approval?.request&&<section aria-label="준비본 별도 승인 요청"><p>실제 실행 승인이 아닌 정확 준비본 보관 승인</p><fieldset disabled={busy||!owner||!!work.approval.request.pending||!!work.approval.request.resultId}><label>승인요청 이유<textarea aria-label="준비 승인 이유" value={work.approval.request.details.reason} onChange={e=>requestEdit(r=>{r.details.reason=e.target.value;})}/></label>{(['data','security','cost','interruption','unverified'] as const).map(k=><label key={k}>{k}<textarea aria-label={'준비 승인 위험 '+k} value={work.approval!.request!.details.risks[k]} onChange={e=>requestEdit(r=>{r.details.risks[k]=e.target.value;})}/></label>)}<label>복구방법<textarea aria-label="준비 승인 복구방법" value={work.approval.request.details.rollback.method} onChange={e=>requestEdit(r=>{r.details.rollback.method=e.target.value;})}/></label><label>복구한계<textarea aria-label="준비 승인 복구한계" value={work.approval.request.details.rollback.limitations} onChange={e=>requestEdit(r=>{r.details.rollback.limitations=e.target.value;})}/></label><label>승인기한<input aria-label="준비 승인 기한" value={work.approval.request.details.expiresAt} onChange={e=>requestEdit(r=>{r.details.expiresAt=e.target.value;})}/></label></fieldset><button disabled={busy||!owner||!!work.approval.request.resultId} onClick={()=>void requestSave()}>{work.approval.request.pending?'같은 준비 승인 요청 재확인':'준비 승인 요청 명시 보관'}</button><p>요청ID {work.approval.requestId}</p>{approvalHref?<a href={approvalHref}>UI08에서 별도 결정</a>:<p>승인 요청 저장이 확인되면 정확한 상세를 열 수 있습니다.</p>}<label>결정 조회 요청ID<input aria-label="준비 결정 요청ID" value={work.approval.requestId} disabled={busy||!owner} onChange={e=>{if(!owner)return;settle(work,{...work,approval:{...work.approval!,requestId:e.target.value}});}}/></label><button disabled={busy||!owner} onClick={()=>void bind()}>별도 결정을 같은 준비 원명령에 결박</button>{canCloseRejectedExecutionApproval(work)&&<button type="button" disabled={busy||!owner} onClick={()=>void closeRejectedApproval()}>거절·수정 요청 확인 후 준비 수정</button>}</section>}
 {work.result&&<section aria-label="준비본 보관 확인"><h6>NOT_AUTHORIZED · 실행/dispatch false</h6><p>{ordered(work.result.ref)}</p>{work.result.snapshot.understandingBasis&&<p>정착 검토 {ordered(work.result.snapshot.understandingBasis.reviewRef)} · 원 CONTEXT_REVIEW 범위 {ordered(work.result.snapshot.understandingBasis.scope)}</p>}<pre>{JSON.stringify(work.result.snapshot,null,2)}</pre></section>}
 </>}
 </section>;
}
