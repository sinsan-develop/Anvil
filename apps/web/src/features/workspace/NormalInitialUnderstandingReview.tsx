import {useEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import {documentControl,type DocumentSession} from '../design-trace/editor-api.ts';
import {isKnownDocumentRejection} from '../design-trace/mutation-result.ts';
import type {PlanRef} from '../design-trace/work-plan-api.ts';
import {ordered} from '../knowledge/review-view.ts';
import {approvalRequestHref} from '../../shell/routes.ts';
import {sendApprovalCommand} from '../decisions/api.ts';
import {newUnderstandingApprovalRequest,prepareUnderstandingApprovalRequest,bindUnderstandingApproval} from '../decisions/understanding-review-approval-api.ts';
import {readNormalUnderstandingHistory,understandingLabels,type NormalUnderstandingHistoryView} from '../session-detail/understanding-history-api.ts';
import {normalFollowUpUnderstandingLatest,normalFollowUpUnderstandingReviewKey,beginNormalFollowUpUnderstandingReview,prepareNormalFollowUpUnderstandingReview,saveNormalFollowUpUnderstandingReview,matchNormalFollowUpUnderstandingReview,normalInitialUnderstandingOwner,normalInitialUnderstandingBasis,beginNormalInitialUnderstandingReview,normalInitialUnderstandingReviewKey,prepareNormalInitialUnderstandingReview,saveNormalInitialUnderstandingReview,matchNormalInitialUnderstandingReview,UnderstandingReadbackUnconfirmed,type NormalInitialUnderstandingBasis,type NormalInitialUnderstandingReviewStorage,type NormalInitialUnderstandingReviewBuffer} from '../session-detail/understanding-review-write.ts';
import type {PreparationRecord} from './responsible-session-api.ts';
import type {NormalUnderstandingMetadataRequest,NormalUnderstandingRangeResult} from './NormalUnderstandingDiscovery.tsx';
type Source=Extract<NormalUnderstandingRangeResult,{status:'RANGE_STORED'}>;
const same=(a:unknown,b:unknown)=>ordered(a)===ordered(b);
/** 이 컴포넌트만 현재 원문 view를 받는다. App 저장소에는 refs/사람 입력/명령/승인만 넘긴다. */
export function NormalInitialUnderstandingReview({client,session,request,preparation,source,viewActive,storage,busy}:{client:ApiClient;session:DocumentSession;request:NormalUnderstandingMetadataRequest;preparation:PreparationRecord|null;source:Source|null;viewActive:()=>boolean;storage:NormalInitialUnderstandingReviewStorage;busy:boolean}){
 const [verified,setVerified]=useState<{sourceKey:string;owner:object;basis:NormalInitialUnderstandingBasis}|null>(null),[history,setHistory]=useState<{key:string;value:NormalUnderstandingHistoryView}|null>(null),[notice,setNotice]=useState(''),[working,setWorking]=useState(false),[ack,setAck]=useState(false);
 const [selected,setSelected]=useState<{owner:object;key:string}|null>(null);
 const epoch=normalInitialUnderstandingOwner(client,session),identity=ordered([request,epoch,session.user.id,session.clientId]),scope=useRef({identity,client,transport:client.transport}),alive=useRef(true),flight=useRef<symbol|null>(null),view=useRef({source,preparation,viewActive});view.current={source,preparation,viewActive};
 if(scope.current.identity!==identity||scope.current.client!==client||scope.current.transport!==client.transport)scope.current={identity,client,transport:client.transport};const owner=scope.current;
 const mountOwner=useRef(epoch);
 const current=()=>mountOwner.current===epoch&&alive.current&&scope.current===owner&&client.transport===owner.transport&&normalInitialUnderstandingOwner(client,session)===epoch;
 const shown=history?.key===identity?history.value:null;
 const sourceKey=source?ordered([source.request,source.responseRef,source.partRefs,source.observedAt,source.expiresAt,preparation?.ref??null]):'';
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;flight.current=null;};},[]);
 useEffect(()=>{setVerified(null);setHistory(null);setNotice('');setAck(false);},[owner]);
 useEffect(()=>{let live=true;setVerified(null);if(source&&preparation){const held=source;normalInitialUnderstandingBasis(held,preparation,request.preparationRef,()=>live&&current()&&view.current.viewActive()&&view.current.source===held&&view.current.preparation===preparation).then(basis=>{if(live&&current()&&view.current.source===held)setVerified({sourceKey,owner,basis});}).catch(()=>{});}return()=>{live=false;};},[source,preparation,owner]);
 const basis=verified?.sourceKey===sourceKey&&verified.owner===owner&&source&&viewActive()&&Date.parse(source.expiresAt)>Date.now()?verified.basis:null;
 const scopeValue={projectId:request.projectId,executionId:request.executionId,executionGeneration:request.executionGeneration};
 const owned=Object.entries(storage.buffers).filter(([,v])=>v&&v.ownerEpoch===epoch&&v.ownerUserId===session.user.id&&v.ownerClientId===session.clientId&&same(v.basis.scope,scopeValue));
 const candidates=owned.filter(([,v])=>v&&same(v.basis.assignmentRef,request.assignmentRef)&&same(v.basis.preparationRef,request.preparationRef)&&same(v.basis.rangeRequestRef,request.requestRef));
 const open=candidates.filter(([,v])=>!v?.stored),kept=candidates.filter(([,v])=>v?.stored).sort((a,b)=>b[1]!.stored!.ref.version-a[1]!.stored!.ref.version);
 const chosen=selected?.owner===owner?candidates.find(([k])=>k===selected.key):undefined;
 const key=chosen?.[0]??(open.length===1?open[0]![0]:open.length>1?null:kept[0]?.[0]??(basis?normalInitialUnderstandingReviewKey(basis,session,epoch):null)),b=key?storage.read(key):null;
 const follow=!!b?.previousReviewRef,prefix=follow?'후속':'최초',head=shown?.items.at(-1)?.ref??null;
 const unresolved=()=>storage.hasUnresolved?storage.hasUnresolved(epoch,scopeValue):owned.some(([k])=>{const v=storage.read(k);return v?.ownerEpoch===epoch&&same(v.basis.scope,scopeValue)&&(v.uncertain||v.approval?.work?.uncertain);});
 const sourceCurrent=()=>!!basis&&current()&&view.current.viewActive()&&view.current.source===source&&view.current.preparation===preparation&&!!source&&Date.parse(source.expiresAt)>Date.now()&&(!b||same(b.basis,basis));
 const update=(next:NormalInitialUnderstandingReviewBuffer,expected:NormalInitialUnderstandingReviewBuffer)=>{if(!key||!current()||storage.read(key)!==expected)return false;storage.onChange(key,prior=>current()&&prior===expected&&(!!next.stored||expected.uncertain||expected.approval?.work?.uncertain||!unresolved())?next:prior);return storage.read(key)===next;};
 const firstAvailable=shown?.items.length===0,draftAvailable=follow?!!head&&same(head,b?.previousReviewRef):firstAvailable;
 useEffect(()=>{setAck(false);},[key]);
 const match=(value:NormalUnderstandingHistoryView,buffer:NormalInitialUnderstandingReviewBuffer)=>buffer.previousReviewRef?matchNormalFollowUpUnderstandingReview(value,buffer):matchNormalInitialUnderstandingReview(value,buffer);
 const edit=(change:(value:NormalInitialUnderstandingReviewBuffer)=>NormalInitialUnderstandingReviewBuffer)=>{if(b&&draftAvailable&&sourceCurrent()&&!unresolved()&&!working&&!busy&&!b.pending&&!b.stored&&!b.uncertain)update(change(b),b);};
 async function run(mode:'HISTORY'|'BEGIN'|'FOLLOW_BEGIN'|'PREPARE'|'SAVE'|'APPROVAL_BEGIN'|'APPROVAL_SEND'|'BIND'){
  if(flight.current||busy||!current())return;const attempt=Symbol(),captured=owner,original=b;flight.current=attempt;setWorking(true);setNotice('');
  const active=()=>current()&&scope.current===captured&&flight.current===attempt;
  const commit=(next:NormalInitialUnderstandingReviewBuffer,expected:NormalInitialUnderstandingReviewBuffer)=>{if(!key||!active()||storage.read(key)!==expected)return false;storage.onChange(key,prior=>active()&&prior===expected&&(!!next.stored||expected.uncertain||expected.approval?.work?.uncertain||!unresolved())?next:prior);return storage.read(key)===next;};
  const sourceCheck=()=>{if(!active()||!sourceCurrent())throw new ApiError('UNDERSTANDING_CURRENT_REQUIRED',412);};
  const pinned=new ApiClient((...args)=>{if(!active())throw new ApiError('UNDERSTANDING_CURRENT_REQUIRED',412);return captured.transport.call(globalThis,...args);});
  const read=async()=>{setHistory(null);const h=await readNormalUnderstandingHistory(client,scopeValue,active);if(!h||!active())throw new ApiError('UNDERSTANDING_HISTORY_UNAVAILABLE',503);setHistory({key:identity,value:h});return h;};
  const requireHead=async(h:NormalUnderstandingHistoryView,buffer:NormalInitialUnderstandingReviewBuffer)=>{if(buffer.previousReviewRef){if(!same(await normalFollowUpUnderstandingLatest(buffer.basis,h,active),buffer.previousReviewRef))throw new ApiError('UNDERSTANDING_REVIEW_HEAD_CHANGED',409);}else if(h.items.length)throw new ApiError('UNDERSTANDING_FIRST_REVIEW_REQUIRED',409);};
  const requireResolved=()=>{if(unresolved())throw new ApiError('UNDERSTANDING_REVIEW_RECOVERY_REQUIRED',409);};
  let sent=false,latest=original;
  try{
   if(mode==='HISTORY'){
    const h=await read();
    if(original?.pending){
     const stored=match(h,original);
     if(stored)commit({...original,stored,uncertain:false,failure:null},original);
    }
    return;
   }
   if(mode==='BEGIN'){
    sourceCheck();requireResolved();
    const h=await read();
    sourceCheck();
    if(h.items.length||!basis||candidates.length||storage.read(normalInitialUnderstandingReviewKey(basis,session,epoch))){
     throw new ApiError('UNDERSTANDING_FIRST_REVIEW_REQUIRED',409);
    }
    const next=beginNormalInitialUnderstandingReview(basis,session,epoch);
    const target=normalInitialUnderstandingReviewKey(basis,session,epoch);
    storage.onChange(target,prior=>prior??(active()&&sourceCurrent()&&!unresolved()?next:null));
    return;
   }
   if(mode==='FOLLOW_BEGIN'){
    sourceCheck();requireResolved();if(!storage.hasUnresolved)throw new ApiError('UNDERSTANDING_REVIEW_SCOPE_UNAVAILABLE',503);
    const h=await read();sourceCheck();requireResolved();if(!basis)return;
    const next=await beginNormalFollowUpUnderstandingReview(basis,session,epoch,h,()=>active()&&sourceCurrent());sourceCheck();
    const after=await read();sourceCheck();requireResolved();
    if(!same(await normalFollowUpUnderstandingLatest(basis,after,active),next.previousReviewRef))throw new ApiError('UNDERSTANDING_REVIEW_HEAD_CHANGED',409);
    const target=normalFollowUpUnderstandingReviewKey(basis,session,epoch,next.previousReviewRef!);
    storage.onChange(target,prior=>prior??(active()&&sourceCurrent()&&!unresolved()?next:null));
    if(active()&&storage.read(target))setSelected({owner,key:target});
    return;
   }
   if(!original||!key||storage.read(key)!==original||original.stored)return;
   if(mode==='PREPARE'){
    sourceCheck();
    if(original.pending||original.uncertain)return;requireResolved();
    const generation=await documentControl(pinned,request.projectId,session);
    sourceCheck();
    await requireHead(await read(),original);
    const pending=await (follow?prepareNormalFollowUpUnderstandingReview:prepareNormalInitialUnderstandingReview)(original,session,generation,epoch);
    sourceCheck();
    if(await documentControl(pinned,request.projectId,session)!==generation){
     throw new ApiError('CONTROL_GENERATION_CONFLICT',409);
    }
    sourceCheck();
    if(follow){await requireHead(await read(),original);sourceCheck();}requireResolved();
    commit({...original,pending,failure:null},original);
    setAck(false);
    return;
   }
   if(!original.pending||mode!=='SAVE'&&original.uncertain)return;
   const approvalRecovery=mode==='APPROVAL_SEND'&&!!original.approval?.work?.uncertain&&!!original.approval.work.pending;
   if(mode!=='SAVE'&&!approvalRecovery){
    if(follow){sourceCheck();requireResolved();if(await documentControl(pinned,request.projectId,session)!==original.pending.controlGeneration)throw new ApiError('CONTROL_GENERATION_CONFLICT',409);await requireHead(await read(),original);sourceCheck();}
    else if(!firstAvailable)throw new ApiError('UNDERSTANDING_FIRST_REVIEW_REQUIRED',409);
   }
   if(mode==='APPROVAL_BEGIN'){
    if(original.approval||original.pending.approvalRef!==null)return;
    const work=newUnderstandingApprovalRequest(original.pending,session,'NORMAL_PROTECTED');
    commit({...original,approval:{work,requestId:''}},original);
    return;
   }
   if(mode==='BIND'){
    if(!original.approval?.requestId)return;
    const pending=await bindUnderstandingApproval(pinned,original.pending,session,original.approval.requestId,active);
    if(follow){await requireHead(await read(),original);sourceCheck();requireResolved();}
    if(active()&&pending)commit({...original,pending,failure:null},original);
    setAck(false);
    return;
   }
   if(mode==='APPROVAL_SEND'){
    const work=original.approval?.work;
    if(!work||work.resultId||!same(work.candidate,{...original.pending,approvalRef:null}))return;
    const pending=await prepareUnderstandingApprovalRequest(work,session);
    if(!active())return;
    if(follow&&!approvalRecovery){await requireHead(await read(),original);sourceCheck();requireResolved();}
    const next={...original,approval:{...original.approval!,work:{...work,pending,uncertain:true,failure:null}}};
    if(!commit(next,original))return;
    latest=next;
    sent=true;
    const receipt=await sendApprovalCommand(pinned,pending,session);
    if(!active())return;
    commit({...next,approval:{work:{...next.approval.work!,pending:null,resultId:receipt.targetId,uncertain:false,failure:null,dirty:false},requestId:receipt.targetId}},next);
    return;
   }
   if(!original.uncertain&&!ack)return;
   if(!original.uncertain)sourceCheck();
   const generation=await documentControl(pinned,request.projectId,session);
   if(!active())return;
   if(generation!==original.pending.controlGeneration)throw new ApiError('CONTROL_GENERATION_CONFLICT',409);
   const h=await read();
   const already=match(h,original);
   if(already){
    commit({...original,stored:already,uncertain:false,failure:null},original);
    return;
   }
   if(h.items.some(row=>row.snapshot.request.commandId===original.pending!.commandId))throw new ApiError('UNDERSTANDING_REVIEW_RESPONSE_INVALID');
   if(!original.uncertain){sourceCheck();requireResolved();await requireHead(h,original);sourceCheck();}
   const next={...original,uncertain:true,failure:null};
   if(follow){
    let held=original;
    const stored=await saveNormalFollowUpUnderstandingReview(client,original,session,
     ()=>active()&&storage.read(key!)===held&&(original.uncertain||sourceCurrent()),body=>{
      if(!active()||storage.read(key!)!==original||JSON.stringify(original.pending)!==body||!same(original.form,original.pending?.payload))return false;
      if(!original.uncertain){sourceCheck();requireResolved();}
      if(!commit(next,original))return false;
      try{if(!active()||!original.uncertain&&!sourceCurrent())throw new ApiError('UNDERSTANDING_CURRENT_REQUIRED',412);}
      catch(error){storage.onChange(key!,prior=>prior===next?original:prior);throw error;}
      held=next;latest=next;sent=true;return true;
     });
    if(active()&&stored)commit({...held,stored,uncertain:false,failure:null},held);
    return;
   }
   if(!commit(next,original))return;
   latest=next;sent=true;
   const stored=await saveNormalInitialUnderstandingReview(client,next,session,
    ()=>active()&&storage.read(key!)===next&&(original.uncertain||sourceCurrent()));
   if(active()&&stored)commit({...next,stored,uncertain:false,failure:null},next);
  }catch(cause){if(!active())return;const e=cause instanceof ApiError?cause:new ApiError('UNDERSTANDING_REVIEW_RESPONSE_INVALID'),code=/^[A-Z_]{1,80}$/.test(e.code)?e.code:'UNDERSTANDING_REVIEW_RESPONSE_INVALID';setNotice(code);
   if(latest&&key&&storage.read(key)===latest){if(mode==='APPROVAL_SEND'&&latest.approval?.work){const w=latest.approval.work;commit({...latest,approval:{...latest.approval,work:{...w,failure:{code,status:e.status},uncertain:sent&&(w.uncertain||!isKnownDocumentRejection(e))}}},latest);}else commit({...latest,failure:{code,status:e.status},uncertain:latest.uncertain&&(original?.uncertain===true||sent&&(!isKnownDocumentRejection(e)||e instanceof UnderstandingReadbackUnconfirmed))},latest);}
  }finally{if(flight.current===attempt){flight.current=null;if(alive.current)setWorking(false);}}
 }
 const locked=busy||working;
 if(mountOwner.current!==epoch)return null;
 return <section aria-label={'정상 '+prefix+' 이해 검토'}><h5>{prefix} 사람 이해 검토</h5><p>선택한 같은 세션의 고정 부분만 대조합니다. 저장한 판단과 별도 승인은 현재 실행 허가가 아닙니다.</p>
 <button type="button" disabled={locked} onClick={()=>void run('HISTORY')}>정상 이해 검토 이력 확인</button>
 {notice?<p role="alert">{notice} · 입력과 고정 명령을 보존합니다.</p>:null}{follow&&b?.failure?.code==='UNDERSTANDING_NORMAL_FIRST_REQUIRED'?<p role="status">서버가 최초 검토만 허용하여 후속 저장을 거절했습니다. 기존 입력·명령·승인은 보존됩니다.</p>:null}
 {shown?<>{shown.items.length===0?<p>보관된 최초 검토 없음</p>:shown.items.map(row=><article key={row.ref.contentHash}><h6>보관된 {row.ref.version===1?'최초':'후속'} 검토 · v{row.ref.version} · {row.snapshot.outcome==='ACCEPTED'?'보관 당시 적합':'보관 당시 미수용'}</h6><p>현재 기준·허가 미재검산 · {row.snapshot.recordedAt}</p><p>{row.snapshot.input.reason}</p><ul>{row.snapshot.input.items.map(item=><li key={item.code}>{understandingLabels[item.code]} · {item.judgement}<pre>{item.reason}</pre></li>)}</ul></article>)}</>:null}
 {candidates.length>1?<div aria-label="보존된 정상 검토 초안">{candidates.map(([k,v])=><button type="button" key={k} disabled={locked} onClick={()=>{if(current()&&storage.read(k)===v){setSelected({owner,key:k});setAck(false);}}}>{v!.previousReviewRef?'후속':'최초'} 초안 · {v!.stored?'저장 v'+v!.stored.ref.version:v!.uncertain?'결과 미확인':v!.pending?'고정 명령 보존':'입력 중'}{v!.pending?' · '+v!.pending.commandId:''}</button>)}</div>:null}
 {unresolved()?<p role="status">같은 실행의 미확정 명령 또는 승인 요청을 원 요청에서 먼저 재확인하세요. 새 후속 명령을 만들지 않습니다.</p>:null}
 {basis&&shown?.items.length&&!unresolved()?<button type="button" disabled={locked} onClick={()=>void run('FOLLOW_BEGIN')}>후속 이해 검토 입력 준비</button>:null}
 {follow&&head&&!same(head,b?.previousReviewRef)&&!b?.stored?<p role="status">최신 검토 버전이 바뀌었습니다. 이전 입력·원명령·승인은 보존하며 새 입력 준비는 명시적으로 수행합니다.</p>:null}
 {!b&&basis&&shown?.items.length===0&&candidates.length===0?<button type="button" disabled={locked} onClick={()=>void run('BEGIN')}>최초 이해 검토 입력 준비</button>:null}
 {!basis?<p role="status">같은 준비·맥락의 현재 선택 원문을 확인해야 새 판단을 작성할 수 있습니다.</p>:null}
 {b?<>{follow?<p>화면에서 확인한 이전 v{b.previousReviewRef!.version} · 이 참조는 승인·저장 명령에 전송되지 않으며 서버는 저장 시점 최신 버전에 이어 붙입니다.</p>:null}<fieldset disabled={locked||!basis||!draftAvailable||unresolved()||!!b.pending||b.uncertain||!!b.stored}><legend>사람 판단 6항목</legend>{b.form.items.map((item,index)=><div key={item.code}><strong>{understandingLabels[item.code]}</strong>
 <fieldset><legend>{index+1} 기준 부분 선택</legend>{b.basis.basisRefs.map(r=><label key={ordered(r)}><input type="checkbox" aria-label={'기준 '+(index+1)+' '+r.id} checked={item.sourceRefs.some(v=>same(v,r))} onChange={e=>{const checked=e.target.checked;edit(v=>({...v,form:{...v.form,items:v.form.items.map((row,n)=>n===index?{...row,sourceRefs:checked?[...row.sourceRefs,r]:row.sourceRefs.filter(x=>!same(x,r))}:row)}}));}}/>{r.id} · v{r.version}</label>)}</fieldset>
 <fieldset><legend>{index+1} 응답 부분 선택</legend>{b.basis.responsePartRefs.map((r,n)=><label key={ordered(r)}><input type="checkbox" aria-label={'응답 '+(index+1)+' '+r.id} checked={item.responsePartRefs.some(v=>same(v,r))} onChange={e=>{const checked=e.target.checked;edit(v=>({...v,form:{...v.form,items:v.form.items.map((row,i)=>i===index?{...row,responsePartRefs:checked?[...row.responsePartRefs,r]:row.responsePartRefs.filter(x=>!same(x,r))}:row)}}));}}/>텍스트 부분 {n+1} · {r.id}</label>)}</fieldset>
 <label>판단<select aria-label={prefix+' 이해 판단 '+(index+1)} value={item.judgement} onChange={e=>{const judgement=e.target.value as typeof item.judgement;edit(v=>({...v,form:{...v.form,items:v.form.items.map((row,n)=>n===index?{...row,judgement}:row)}}));}}><option value="">미선택</option><option value="MATCH">일치</option><option value="MISMATCH">불일치</option><option value="INSUFFICIENT">부족</option></select></label>
 <label>판단 이유<textarea aria-label={prefix+' 이해 이유 '+(index+1)} maxLength={20000} value={item.reason} onChange={e=>{const reason=e.target.value;edit(v=>({...v,form:{...v.form,items:v.form.items.map((row,n)=>n===index?{...row,reason}:row)}}));}}/></label></div>)}<label>검토 이유<textarea aria-label={prefix+' 이해 검토 이유'} maxLength={20000} value={b.form.reason} onChange={e=>{const reason=e.target.value;edit(v=>({...v,form:{...v.form,reason}}));}}/></label></fieldset>
 {!b.pending&&!b.stored?<button type="button" disabled={locked||!basis||!draftAvailable||unresolved()} onClick={()=>void run('PREPARE')}>{prefix+' 이해 검토 명령 준비'}</button>:null}
 {b.pending&&!b.stored?<><p>고정 명령 {b.pending.commandId}</p>{b.uncertain?<p role="status">저장 결과 미확인 · 같은 명령만 재확인합니다.</p>:<label><input type="checkbox" aria-label={prefix+' 이해 검토 저장 확인'} checked={ack} disabled={locked} onChange={e=>setAck(e.target.checked)}/>6항목을 별도로 대조했으며 저장이 실행 허가가 아님을 확인합니다</label>}
 <button type="button" disabled={locked||!b.uncertain&&(!ack||!basis||!!b.failure&&(!follow||isKnownDocumentRejection(b.failure)))} onClick={()=>void run('SAVE')}>{b.uncertain?'같은 '+prefix+' 이해 검토 명령 재확인':prefix+' 이해 검토 저장'}</button>
 {follow&&b.failure&&!b.uncertain&&!isKnownDocumentRejection(b.failure)?<p role="status">저장 POST는 전송하지 않았습니다. 같은 입력의 현재 근거와 최신 버전을 다시 검산한 뒤 시도합니다.</p>:null}
 {b.failure&&!b.uncertain&&isKnownDocumentRejection(b.failure)?<button type="button" disabled={locked} onClick={()=>{if(sourceCurrent())update({...b,pending:null,failure:null,approval:undefined},b);setAck(false);}}>{'거절 확인 후 '+prefix+' 검토 입력 수정'}</button>:null}
 {!b.uncertain&&(draftAvailable||!!b.approval)?<section aria-label={'정상 '+prefix+' 검토 별도 승인'}><h6>정확 원명령의 별도 승인</h6>{!b.approval?<button type="button" disabled={locked||b.pending.approvalRef!==null||!draftAvailable||unresolved()} onClick={()=>void run('APPROVAL_BEGIN')}>{prefix+' 이해 검토 승인 요청 준비'}</button>:null}
 {b.approval?.work?(()=>{const w=b.approval.work;return <><fieldset disabled={locked||!!w.pending||!!w.resultId||w.uncertain}><label>승인 요청 이유<textarea aria-label={prefix+' 이해 승인 요청 이유'} value={w.details.reason} onChange={e=>{const reason=e.target.value;update({...b,approval:{...b.approval!,work:{...w,details:{...w.details,reason}}}},b);}}/></label><label>승인 기한<input aria-label={prefix+' 이해 승인 기한'} value={w.details.expiresAt} onChange={e=>{const expiresAt=e.target.value;update({...b,approval:{...b.approval!,work:{...w,details:{...w.details,expiresAt}}}},b);}}/></label></fieldset>{!w.resultId?<button type="button" disabled={locked} onClick={()=>void run('APPROVAL_SEND')}>{w.uncertain?'같은 '+prefix+' 이해 승인 요청 재확인':prefix+' 이해 승인 요청 보관'}</button>:null}{w.failure?<p role="alert">{w.failure.code}</p>:null}</>;})():null}
 {b.approval?.requestId?<><a href={approvalRequestHref(request.projectId,b.approval.requestId)}>UI08에서 전체 {prefix} 판단을 보고 별도 결정</a><button type="button" disabled={locked} onClick={()=>void run('BIND')}>{'같은 '+prefix+' 원명령에 결정 결박'}</button></>:null}</section>:null}</>:null}
 {b.stored?<><p role="status">{prefix} 이해 검토 보관 확인 · v{b.stored.ref.version} · {b.stored.snapshot.outcome==='ACCEPTED'?'보관 당시 적합':'보관 당시 미수용'} · 현재 실행 허가가 아닙니다.</p>{b.previousReviewRef&&!same(b.previousReviewRef,b.stored.snapshot.previousRef)?<p role="status">화면에서 확인한 이전 v{b.previousReviewRef.version} · 서버가 저장한 이전 v{b.stored.snapshot.previousRef?.version}. 원 명령의 저장은 확인됐으며 취소나 새 승인으로 바꾸지 않습니다.</p>:null}</>:null}</>:null}
 </section>;
}
