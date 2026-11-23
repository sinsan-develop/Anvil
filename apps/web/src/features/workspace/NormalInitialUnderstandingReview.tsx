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
import {normalInitialUnderstandingOwner,normalInitialUnderstandingBasis,beginNormalInitialUnderstandingReview,normalInitialUnderstandingReviewKey,prepareNormalInitialUnderstandingReview,saveNormalInitialUnderstandingReview,matchNormalInitialUnderstandingReview,UnderstandingReadbackUnconfirmed,type NormalInitialUnderstandingBasis,type NormalInitialUnderstandingReviewStorage,type NormalInitialUnderstandingReviewBuffer} from '../session-detail/understanding-review-write.ts';
import type {PreparationRecord} from './responsible-session-api.ts';
import type {NormalUnderstandingMetadataRequest,NormalUnderstandingRangeResult} from './NormalUnderstandingDiscovery.tsx';
type Source=Extract<NormalUnderstandingRangeResult,{status:'RANGE_STORED'}>;
const same=(a:unknown,b:unknown)=>ordered(a)===ordered(b);
/** 이 컴포넌트만 현재 원문 view를 받는다. App 저장소에는 refs/사람 입력/명령/승인만 넘긴다. */
export function NormalInitialUnderstandingReview({client,session,request,preparation,source,viewActive,storage,busy}:{client:ApiClient;session:DocumentSession;request:NormalUnderstandingMetadataRequest;preparation:PreparationRecord|null;source:Source|null;viewActive:()=>boolean;storage:NormalInitialUnderstandingReviewStorage;busy:boolean}){
 const [verified,setVerified]=useState<{sourceKey:string;owner:object;basis:NormalInitialUnderstandingBasis}|null>(null),[history,setHistory]=useState<{key:string;value:NormalUnderstandingHistoryView}|null>(null),[notice,setNotice]=useState(''),[working,setWorking]=useState(false),[ack,setAck]=useState(false);
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
 const candidates=Object.entries(storage.buffers).filter(([,v])=>v&&v.ownerEpoch===epoch&&v.ownerUserId===session.user.id&&v.ownerClientId===session.clientId&&same(v.basis.scope,scopeValue)&&same(v.basis.assignmentRef,request.assignmentRef)&&same(v.basis.preparationRef,request.preparationRef)&&same(v.basis.rangeRequestRef,request.requestRef));
 const key=basis?normalInitialUnderstandingReviewKey(basis,session,epoch):candidates.length===1?candidates[0]![0]:null,b=key?storage.read(key):null;
 const sourceCurrent=()=>!!basis&&current()&&view.current.viewActive()&&view.current.source===source&&view.current.preparation===preparation&&!!source&&Date.parse(source.expiresAt)>Date.now()&&(!b||same(b.basis,basis));
 const update=(next:NormalInitialUnderstandingReviewBuffer,expected:NormalInitialUnderstandingReviewBuffer)=>{if(!key||!current()||storage.read(key)!==expected)return false;storage.onChange(key,prior=>prior===expected?next:prior);return storage.read(key)===next;};
 const firstAvailable=shown?.items.length===0;
 const edit=(change:(value:NormalInitialUnderstandingReviewBuffer)=>NormalInitialUnderstandingReviewBuffer)=>{if(b&&firstAvailable&&sourceCurrent()&&!working&&!busy&&!b.pending&&!b.stored&&!b.uncertain)update(change(b),b);};
 async function run(mode:'HISTORY'|'BEGIN'|'PREPARE'|'SAVE'|'APPROVAL_BEGIN'|'APPROVAL_SEND'|'BIND'){
  if(flight.current||busy||!current())return;const attempt=Symbol(),captured=owner,original=b;flight.current=attempt;setWorking(true);setNotice('');
  const active=()=>current()&&scope.current===captured&&flight.current===attempt;
  const sourceCheck=()=>{if(!active()||!sourceCurrent())throw new ApiError('UNDERSTANDING_CURRENT_REQUIRED',412);};
  const pinned=new ApiClient((...args)=>{if(!active())throw new ApiError('UNDERSTANDING_CURRENT_REQUIRED',412);return captured.transport.call(globalThis,...args);});
  const read=async()=>{setHistory(null);const h=await readNormalUnderstandingHistory(client,scopeValue,active);if(!h||!active())throw new ApiError('UNDERSTANDING_HISTORY_UNAVAILABLE',503);setHistory({key:identity,value:h});return h;};
  let sent=false,latest=original;
  try{
   if(mode==='HISTORY'){
    const h=await read();
    if(original?.pending){
     const stored=matchNormalInitialUnderstandingReview(h,original);
     if(stored)update({...original,stored,uncertain:false,failure:null},original);
    }
    return;
   }
   if(mode==='BEGIN'){
    sourceCheck();
    const h=await read();
    sourceCheck();
    if(h.items.length||!basis||candidates.length||storage.read(normalInitialUnderstandingReviewKey(basis,session,epoch))){
     throw new ApiError('UNDERSTANDING_FIRST_REVIEW_REQUIRED',409);
    }
    const next=beginNormalInitialUnderstandingReview(basis,session,epoch);
    const target=normalInitialUnderstandingReviewKey(basis,session,epoch);
    storage.onChange(target,prior=>prior??next);
    return;
   }
   if(!original||!key||storage.read(key)!==original||original.stored)return;
   if(mode==='PREPARE'){
    sourceCheck();
    if(original.pending||original.uncertain)return;
    const generation=await documentControl(pinned,request.projectId,session);
    sourceCheck();
    if((await read()).items.length)throw new ApiError('UNDERSTANDING_FIRST_REVIEW_REQUIRED',409);
    const pending=await prepareNormalInitialUnderstandingReview(original,session,generation,epoch);
    sourceCheck();
    if(await documentControl(pinned,request.projectId,session)!==generation){
     throw new ApiError('CONTROL_GENERATION_CONFLICT',409);
    }
    sourceCheck();
    update({...original,pending,failure:null},original);
    setAck(false);
    return;
   }
   if(!original.pending||mode!=='SAVE'&&original.uncertain)return;
   if(mode!=='SAVE'&&!firstAvailable)throw new ApiError('UNDERSTANDING_FIRST_REVIEW_REQUIRED',409);
   if(mode==='APPROVAL_BEGIN'){
    if(original.approval||original.pending.approvalRef!==null)return;
    const work=newUnderstandingApprovalRequest(original.pending,session,'NORMAL_PROTECTED');
    update({...original,approval:{work,requestId:''}},original);
    return;
   }
   if(mode==='BIND'){
    if(!original.approval?.requestId)return;
    const pending=await bindUnderstandingApproval(pinned,original.pending,session,original.approval.requestId,active);
    if(active()&&pending)update({...original,pending,failure:null},original);
    setAck(false);
    return;
   }
   if(mode==='APPROVAL_SEND'){
    const work=original.approval?.work;
    if(!work||work.resultId||!same(work.candidate,{...original.pending,approvalRef:null}))return;
    const pending=await prepareUnderstandingApprovalRequest(work,session);
    if(!active())return;
    const next={...original,approval:{...original.approval!,work:{...work,pending,uncertain:true,failure:null}}};
    if(!update(next,original))return;
    latest=next;
    sent=true;
    const receipt=await sendApprovalCommand(pinned,pending,session);
    if(!active())return;
    update({...next,approval:{work:{...next.approval.work!,pending:null,resultId:receipt.targetId,uncertain:false,failure:null,dirty:false},requestId:receipt.targetId}},next);
    return;
   }
   if(!original.uncertain&&!ack)return;
   if(!original.uncertain)sourceCheck();
   const generation=await documentControl(pinned,request.projectId,session);
   if(!active())return;
   if(generation!==original.pending.controlGeneration)throw new ApiError('CONTROL_GENERATION_CONFLICT',409);
   const h=await read();
   const already=matchNormalInitialUnderstandingReview(h,original);
   if(already){
    update({...original,stored:already,uncertain:false,failure:null},original);
    return;
   }
   if(h.items.length)throw new ApiError('UNDERSTANDING_FIRST_REVIEW_REQUIRED',409);
   if(!original.uncertain)sourceCheck();
   const next={...original,uncertain:true,failure:null};
   if(!update(next,original))return;
   latest=next;
   sent=true;
   const stored=await saveNormalInitialUnderstandingReview(client,next,session,
    ()=>active()&&storage.read(key!)===next&&(original.uncertain||sourceCurrent()));
   if(active()&&stored)update({...next,stored,uncertain:false,failure:null},next);
  }catch(cause){if(!active())return;const e=cause instanceof ApiError?cause:new ApiError('UNDERSTANDING_REVIEW_RESPONSE_INVALID'),code=/^[A-Z_]{1,80}$/.test(e.code)?e.code:'UNDERSTANDING_REVIEW_RESPONSE_INVALID';setNotice(code);
   if(latest&&key&&storage.read(key)===latest){if(mode==='APPROVAL_SEND'&&latest.approval?.work){const w=latest.approval.work;update({...latest,approval:{...latest.approval,work:{...w,failure:{code,status:e.status},uncertain:sent&&(w.uncertain||!isKnownDocumentRejection(e))}}},latest);}else update({...latest,failure:{code,status:e.status},uncertain:latest.uncertain&&(original?.uncertain===true||sent&&(!isKnownDocumentRejection(e)||e instanceof UnderstandingReadbackUnconfirmed))},latest);}
  }finally{if(flight.current===attempt){flight.current=null;if(alive.current)setWorking(false);}}
 }
 const locked=busy||working;
 if(mountOwner.current!==epoch)return null;
 return <section aria-label="정상 최초 이해 검토"><h5>최초 사람 이해 검토</h5><p>선택한 같은 세션의 고정 부분만 대조합니다. 저장한 판단과 별도 승인은 현재 실행 허가가 아닙니다.</p>
 <button type="button" disabled={locked} onClick={()=>void run('HISTORY')}>정상 이해 검토 이력 확인</button>
 {notice?<p role="alert">{notice} · 입력과 고정 명령을 보존합니다.</p>:null}
 {shown?<>{shown.items.length===0?<p>보관된 최초 검토 없음</p>:shown.items.map(row=><article key={row.ref.contentHash}><h6>보관된 최초 검토 · {row.snapshot.outcome==='ACCEPTED'?'보관 당시 적합':'보관 당시 미수용'}</h6><p>현재 기준·허가 미재검산 · {row.snapshot.recordedAt}</p><p>{row.snapshot.input.reason}</p><ul>{row.snapshot.input.items.map(item=><li key={item.code}>{understandingLabels[item.code]} · {item.judgement}<pre>{item.reason}</pre></li>)}</ul></article>)}</>:null}
 {!b&&basis&&shown?.items.length===0&&candidates.length===0?<button type="button" disabled={locked} onClick={()=>void run('BEGIN')}>최초 이해 검토 입력 준비</button>:null}
 {!basis?<p role="status">같은 준비·맥락의 현재 선택 원문을 확인해야 새 판단을 작성할 수 있습니다.</p>:null}
 {b?<><fieldset disabled={locked||!basis||!firstAvailable||!!b.pending||b.uncertain||!!b.stored}><legend>사람 판단 6항목</legend>{b.form.items.map((item,index)=><div key={item.code}><strong>{understandingLabels[item.code]}</strong>
 <fieldset><legend>{index+1} 기준 부분 선택</legend>{b.basis.basisRefs.map(r=><label key={ordered(r)}><input type="checkbox" aria-label={'기준 '+(index+1)+' '+r.id} checked={item.sourceRefs.some(v=>same(v,r))} onChange={e=>{const checked=e.target.checked;edit(v=>({...v,form:{...v.form,items:v.form.items.map((row,n)=>n===index?{...row,sourceRefs:checked?[...row.sourceRefs,r]:row.sourceRefs.filter(x=>!same(x,r))}:row)}}));}}/>{r.id} · v{r.version}</label>)}</fieldset>
 <fieldset><legend>{index+1} 응답 부분 선택</legend>{b.basis.responsePartRefs.map((r,n)=><label key={ordered(r)}><input type="checkbox" aria-label={'응답 '+(index+1)+' '+r.id} checked={item.responsePartRefs.some(v=>same(v,r))} onChange={e=>{const checked=e.target.checked;edit(v=>({...v,form:{...v.form,items:v.form.items.map((row,i)=>i===index?{...row,responsePartRefs:checked?[...row.responsePartRefs,r]:row.responsePartRefs.filter(x=>!same(x,r))}:row)}}));}}/>텍스트 부분 {n+1} · {r.id}</label>)}</fieldset>
 <label>판단<select aria-label={'최초 이해 판단 '+(index+1)} value={item.judgement} onChange={e=>{const judgement=e.target.value as typeof item.judgement;edit(v=>({...v,form:{...v.form,items:v.form.items.map((row,n)=>n===index?{...row,judgement}:row)}}));}}><option value="">미선택</option><option value="MATCH">일치</option><option value="MISMATCH">불일치</option><option value="INSUFFICIENT">부족</option></select></label>
 <label>판단 이유<textarea aria-label={'최초 이해 이유 '+(index+1)} maxLength={20000} value={item.reason} onChange={e=>{const reason=e.target.value;edit(v=>({...v,form:{...v.form,items:v.form.items.map((row,n)=>n===index?{...row,reason}:row)}}));}}/></label></div>)}<label>검토 이유<textarea aria-label="최초 이해 검토 이유" maxLength={20000} value={b.form.reason} onChange={e=>{const reason=e.target.value;edit(v=>({...v,form:{...v.form,reason}}));}}/></label></fieldset>
 {!b.pending&&!b.stored?<button type="button" disabled={locked||!basis||!firstAvailable} onClick={()=>void run('PREPARE')}>최초 이해 검토 명령 준비</button>:null}
 {b.pending&&!b.stored?<><p>고정 명령 {b.pending.commandId}</p>{b.uncertain?<p role="status">저장 결과 미확인 · 같은 명령만 재확인합니다.</p>:<label><input type="checkbox" aria-label="최초 이해 검토 저장 확인" checked={ack} disabled={locked} onChange={e=>setAck(e.target.checked)}/>6항목을 별도로 대조했으며 저장이 실행 허가가 아님을 확인합니다</label>}
 <button type="button" disabled={locked||!b.uncertain&&(!ack||!basis||!!b.failure)} onClick={()=>void run('SAVE')}>{b.uncertain?'같은 최초 이해 검토 명령 재확인':'최초 이해 검토 저장'}</button>
 {b.failure&&!b.uncertain&&isKnownDocumentRejection(b.failure)?<button type="button" disabled={locked} onClick={()=>{if(sourceCurrent())update({...b,pending:null,failure:null,approval:undefined},b);setAck(false);}}>거절 확인 후 최초 검토 입력 수정</button>:null}
 {!b.uncertain&&firstAvailable?<section aria-label="정상 최초 검토 별도 승인"><h6>정확 원명령의 별도 승인</h6>{!b.approval?<button type="button" disabled={locked||b.pending.approvalRef!==null} onClick={()=>void run('APPROVAL_BEGIN')}>최초 이해 검토 승인 요청 준비</button>:null}
 {b.approval?.work?(()=>{const w=b.approval.work;return <><fieldset disabled={locked||!!w.pending||!!w.resultId||w.uncertain}><label>승인 요청 이유<textarea aria-label="최초 이해 승인 요청 이유" value={w.details.reason} onChange={e=>{const reason=e.target.value;update({...b,approval:{...b.approval!,work:{...w,details:{...w.details,reason}}}},b);}}/></label><label>승인 기한<input aria-label="최초 이해 승인 기한" value={w.details.expiresAt} onChange={e=>{const expiresAt=e.target.value;update({...b,approval:{...b.approval!,work:{...w,details:{...w.details,expiresAt}}}},b);}}/></label></fieldset>{!w.resultId?<button type="button" disabled={locked} onClick={()=>void run('APPROVAL_SEND')}>{w.uncertain?'같은 최초 이해 승인 요청 재확인':'최초 이해 승인 요청 보관'}</button>:null}{w.failure?<p role="alert">{w.failure.code}</p>:null}</>;})():null}
 {b.approval?.requestId?<><a href={approvalRequestHref(request.projectId,b.approval.requestId)}>UI08에서 전체 최초 판단을 보고 별도 결정</a><button type="button" disabled={locked} onClick={()=>void run('BIND')}>같은 최초 원명령에 결정 결박</button></>:null}</section>:null}</>:null}
 {b.stored?<p role="status">최초 이해 검토 보관 확인 · v1 · {b.stored.snapshot.outcome==='ACCEPTED'?'보관 당시 적합':'보관 당시 미수용'} · 현재 실행 허가가 아닙니다.</p>:null}</>:null}
 </section>;
}
