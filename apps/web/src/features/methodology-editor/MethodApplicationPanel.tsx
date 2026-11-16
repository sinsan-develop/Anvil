import {useEffect,useRef,useState,useId,type Dispatch,type SetStateAction} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import type {VersionRef} from '../../../../../contracts/generated-types.ts';
import type {MethodVersion} from './api.ts';
import type {MethodBuffer,MethodApplicationWork} from './common-api.ts';
import {prepareMethodApplication,writeMethodApplication,readMethodApplicationRef} from './project-api.ts';
import {ordered} from '../knowledge/review-view.ts';
const same=(a:VersionRef|null|undefined,b:VersionRef|null|undefined)=>!!a&&!!b&&a.id===b.id&&a.version===b.version&&a.contentHash===b.contentHash;

export function MethodApplicationPanel({client,projectId,session,source,appliedRef,unavailable,buffer,onChange,onApplied,onAuthenticationLost}:{
 client:ApiClient;projectId:string;session:{user:{id:string};clientId:string;csrfToken:string};source:MethodVersion|null;appliedRef:VersionRef|null|undefined;unavailable:boolean;
 buffer:MethodBuffer;onChange:Dispatch<SetStateAction<MethodBuffer>>;onApplied:(ref:VersionRef)=>void;onAuthenticationLost:()=>void;
}){
 const [agreed,setAgreed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState<ApiError|null>(null);
 const reasonId=useId();
 const active=useRef(true),running=useRef(false),attempt=useRef<string|null>(null),change=useRef(onChange);change.current=onChange;
 const identity=JSON.stringify([projectId,session,source?.ref??null]),context=useRef({client,transport:client.transport,identity});
 if(context.current.client!==client||context.current.transport!==client.transport||context.current.identity!==identity)context.current={client,transport:client.transport,identity};
 const currentContext=context.current;
 const bufferContext=useRef({value:buffer});
 if(bufferContext.current.value!==buffer)bufferContext.current={value:buffer};
 const currentBuffer=bufferContext.current;
 const notification=useRef<{buffer:MethodBuffer;current:()=>boolean;result:{ref:VersionRef;notify:(ref:VersionRef)=>void}|{error:ApiError;notify:()=>void}}|null>(null);
 useEffect(()=>{active.current=true;return()=>{active.current=false;const id=attempt.current;if(id)change.current(previous=>previous.application?.preparationId===id?{...previous,application:{...previous.application,preparationId:null}}:previous);};},[]);
 useEffect(()=>{running.current=false;setBusy(false);setError(null);setAgreed(false);},[currentContext,currentBuffer]);
 useEffect(()=>{
  const n=notification.current;if(!n)return;
  if(!n.current()){notification.current=null;return;}
  if(n.buffer!==buffer)return;
  notification.current=null;
  if('ref'in n.result)n.result.notify(n.result.ref);else{setError(n.result.error);if(n.result.error.status===401)n.result.notify();}
 });
 const capture=()=>()=>active.current&&context.current===currentContext&&client.transport===currentContext.transport&&bufferContext.current===currentBuffer;
 function changeOwned(update:(previous:MethodBuffer)=>MethodBuffer,current:()=>boolean){
  if(!current())return null;const previous=currentBuffer.value,next=update(previous);if(next===previous)return null;
  currentBuffer.value=next;onChange(value=>value===previous?next:value);return next;
 }
 const work=buffer.application,owned=(!buffer.ownerUserId||buffer.ownerUserId===session.user.id)&&(!work||work.ownerUserId===session.user.id&&work.clientId===session.clientId&&(!work.pending||work.pending.request.projectId===projectId));
 const latest=source?.contentReviews?.[0]?.ref,head=source&&'headVersion'in source?Number(source.headVersion):null;
 const ready=owned&&!unavailable&&appliedRef!==undefined&&!busy&&!work?.pending&&!work?.preparationId&&!buffer.preparationId&&!buffer.pending&&!buffer.review?.pending&&!buffer.dirty&&!buffer.review?.dirty
  &&source?.scope==='PROJECT'&&head===source.ref.version&&source.validation.validForConfirmation&&!!source.confirmation&&latest?.outcome==='ACCEPTED'&&source.confirmation.reviewRefs.some(ref=>ordered(ref)===ordered(latest));
 function update(reason:string){if(!owned||work?.pending||work?.preparationId)return;onChange(previous=>({...previous,ownerUserId:session.user.id,application:{ownerUserId:session.user.id,clientId:session.clientId,reason,preparationId:null,pending:null,verifiedRef:null}}));setAgreed(false);setError(null);}
 function fail(cause:unknown,current:()=>boolean){if(!current())return;const failure=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');setError(failure);if(failure.status===401)onAuthenticationLost();}
 async function send(pending:NonNullable<MethodApplicationWork['pending']>,current:()=>boolean){
  let receiptRef=pending.receiptRef;
  try{
   if(!current())return;
   if(!receiptRef){
    const receipt=await writeMethodApplication(client,pending.request,pending.previous,session.csrfToken);if(!current())return;
    receiptRef=structuredClone(receipt.data.ref);
    const confirmedRef=receiptRef;
    if(!changeOwned(previous=>previous.ownerUserId===session.user.id&&previous.application?.clientId===session.clientId&&previous.application.pending?.request.commandId===pending.request.commandId?{...previous,application:{...previous.application,pending:{...previous.application.pending,receiptRef:confirmedRef,uncertain:false}}}:previous,current))return;
   }
   const observed=await readMethodApplicationRef(client,projectId);if(!current())return;
   if(!same(observed,receiptRef))throw new ApiError('VERSION_CONFLICT',409);
   const verifiedRef=receiptRef;
   const changed=changeOwned(previous=>previous.ownerUserId===session.user.id&&previous.application?.clientId===session.clientId&&previous.application.pending?.request.commandId===pending.request.commandId?{...previous,application:{...previous.application,reason:'',pending:null,preparationId:null,verifiedRef}}:previous,current);
   if(changed)notification.current={buffer:changed,current,result:{ref:verifiedRef,notify:onApplied}};
   setAgreed(false);
  }catch(cause){
   if(current()){
    const failure=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');
    const rejected=!pending.uncertain&&!receiptRef&&[409,412,422].includes(failure.status)&&failure.code!=='RESPONSE_INVALID';
    const changed=changeOwned(previous=>previous.ownerUserId===session.user.id&&previous.application?.clientId===session.clientId&&previous.application.pending?.request.commandId===pending.request.commandId?{...previous,application:{...previous.application,pending:rejected?null:{...previous.application.pending,uncertain:!receiptRef}}}:previous,current);
    if(changed)notification.current={buffer:changed,current,result:{error:failure,notify:onAuthenticationLost}};
    if(rejected)setAgreed(false);
   }
  }
  finally{if(current()){running.current=false;setBusy(false);}}
 }
 async function start(){
  if(!capture()()||!ready||!source||appliedRef===undefined||!agreed||!work?.reason.trim()||running.current)return;
  const reason=work.reason,id=crypto.randomUUID(),current=capture();attempt.current=id;running.current=true;setBusy(true);setError(null);
  changeOwned(previous=>({...previous,ownerUserId:session.user.id,application:{ownerUserId:session.user.id,clientId:session.clientId,reason,preparationId:id,pending:null,verifiedRef:null}}),current);
  try{
   const request=await prepareMethodApplication(client,projectId,session,source.ref,appliedRef,reason);if(!current())return;
   const pending={request,previous:appliedRef===null?null:structuredClone(appliedRef),uncertain:false};attempt.current=null;
   if(!changeOwned(previous=>previous.application?.preparationId===id?{...previous,application:{...previous.application,preparationId:null,pending}}:previous,current))return;
   await send(pending,current);
  }catch(cause){fail(cause,current);}
  finally{
   onChange(previous=>previous.application?.preparationId===id?{...previous,application:{...previous.application,preparationId:null}}:previous);
   if(current()){running.current=false;setBusy(false);}
  }
 }
 function retry(){if(!capture()()||!owned||!work?.pending||busy||running.current||unavailable||work.pending.request.projectId!==projectId||work.pending.request.clientId!==session.clientId)return;running.current=true;setBusy(true);setError(null);void send({...work.pending,uncertain:!work.pending.receiptRef},capture());}
 if(!owned)return <section className="status-card" aria-label="방법론 적용 경계"><h3>방법론 별도 적용</h3><p role="alert">다른 사용자·기기의 적용 입력이 남아 있습니다. 내용을 표시하거나 전송하지 않습니다.</p></section>;
 return <section className="status-card" aria-label="방법론 적용 경계"><h3>방법론 별도 적용</h3>
  <p className="meta">임무·실행 이력이 없는 프로젝트만 서버에서 적용할 수 있습니다. 저장·검토·확정이나 Agent 실행과 별도입니다.</p>
  <fieldset disabled={!ready}><label htmlFor={reasonId}>방법론 적용 이유</label><textarea id={reasonId} maxLength={20000} value={work?.reason??''} onChange={event=>update(event.target.value)}/>
   <label><input type="checkbox" checked={agreed} onChange={event=>setAgreed(event.target.checked)}/>저장·확정과 별개로 이 버전을 프로젝트에 적용합니다</label>
   <button disabled={!ready||!agreed||!work?.reason.trim()} onClick={()=>{void start();}}>확정 방법론 별도 적용</button>
  </fieldset>
  {!ready&&!work?.pending&&!busy?<p>최신 전용 방법론의 적합 검토·확정과 현재 적용본 조회가 필요합니다. 미저장 편집·미확인 명령을 먼저 확인하세요.</p>:null}
  {busy?<p role="status">명시 적용과 서버 재조회를 확인하고 있습니다.</p>:null}
  {work?.pending&&!busy?<><p role="alert">{work.pending.receiptRef?'적용 저장 확인 · 현재 적용본 재조회가 필요합니다.':'적용 결과 미확인 · 같은 명령만 다시 확인하세요.'}</p><p className="meta">고정 원문 버전 {work.pending.request.payload.methodologyRef.version} · {work.pending.request.payload.methodologyRef.contentHash}</p><button disabled={unavailable} onClick={retry}>{work.pending.receiptRef?'확정 적용 결과 다시 조회':'같은 적용 명령 결과 확인'}</button></>:null}
  {error?<p role="alert">{error.message} {work?.pending?'적용 입력과 원 명령은 유지합니다.':'이번 적용은 거절됐으며 입력을 보존했습니다.'}</p>:null}
  {!unavailable&&work?.verifiedRef&&same(appliedRef,work.verifiedRef)?<p role="status">서버 적용·재조회 확인 · 적용 세대 {work.verifiedRef.version}</p>:null}
 </section>;
}
