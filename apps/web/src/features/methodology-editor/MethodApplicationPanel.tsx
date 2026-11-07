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
 useEffect(()=>()=>{active.current=false;const id=attempt.current;if(id)change.current(previous=>previous.application?.preparationId===id?{...previous,application:{...previous.application,preparationId:null}}:previous);},[]);
 const work=buffer.application,owned=(!buffer.ownerUserId||buffer.ownerUserId===session.user.id)&&(!work||work.ownerUserId===session.user.id&&work.clientId===session.clientId);
 const latest=source?.contentReviews?.[0]?.ref,head=source&&'headVersion'in source?Number(source.headVersion):null;
 const ready=owned&&!unavailable&&appliedRef!==undefined&&!busy&&!work?.pending&&!work?.preparationId&&!buffer.preparationId&&!buffer.pending&&!buffer.review?.pending&&!buffer.dirty&&!buffer.review?.dirty
  &&source?.scope==='PROJECT'&&head===source.ref.version&&source.validation.validForConfirmation&&!!source.confirmation&&latest?.outcome==='ACCEPTED'&&source.confirmation.reviewRefs.some(ref=>ordered(ref)===ordered(latest));
 function update(reason:string){if(!owned||work?.pending||work?.preparationId)return;onChange(previous=>({...previous,ownerUserId:session.user.id,application:{ownerUserId:session.user.id,clientId:session.clientId,reason,preparationId:null,pending:null,verifiedRef:null}}));setAgreed(false);setError(null);}
 function fail(cause:unknown){if(!active.current)return;const failure=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');setError(failure);if(failure.status===401)onAuthenticationLost();}
 async function send(pending:NonNullable<MethodApplicationWork['pending']>){
  let receiptReceived=false;
  try{
   const receipt=await writeMethodApplication(client,pending.request,pending.previous,session.csrfToken);receiptReceived=true;if(!active.current)return;
   const observed=await readMethodApplicationRef(client,projectId);if(!active.current)return;
   if(!same(observed,receipt.data.ref))throw new ApiError('VERSION_CONFLICT',409);
   onChange(previous=>previous.ownerUserId===session.user.id&&previous.application?.clientId===session.clientId&&previous.application.pending?.request.commandId===pending.request.commandId?{...previous,application:{...previous.application,reason:'',pending:null,preparationId:null,verifiedRef:receipt.data.ref}}:previous);
   setAgreed(false);onApplied(receipt.data.ref);
  }catch(cause){
   if(active.current){
    const failure=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');
    const rejected=!pending.uncertain&&!receiptReceived&&[409,412,422].includes(failure.status)&&failure.code!=='RESPONSE_INVALID';
    onChange(previous=>previous.ownerUserId===session.user.id&&previous.application?.clientId===session.clientId&&previous.application.pending?.request.commandId===pending.request.commandId?{...previous,application:{...previous.application,pending:rejected?null:{...previous.application.pending,uncertain:true}}}:previous);
    if(rejected)setAgreed(false);
   }
   fail(cause);
  }
  finally{running.current=false;if(active.current)setBusy(false);}
 }
 async function start(){
  if(!ready||!source||appliedRef===undefined||!agreed||!work?.reason.trim()||running.current)return;
  const reason=work.reason,id=crypto.randomUUID();attempt.current=id;running.current=true;setBusy(true);setError(null);
  onChange(previous=>({...previous,ownerUserId:session.user.id,application:{ownerUserId:session.user.id,clientId:session.clientId,reason,preparationId:id,pending:null,verifiedRef:null}}));
  try{
   const request=await prepareMethodApplication(client,projectId,session,source.ref,appliedRef,reason);if(!active.current)return;
   const pending={request,previous:appliedRef===null?null:structuredClone(appliedRef),uncertain:false};attempt.current=null;
   onChange(previous=>previous.application?.preparationId===id?{...previous,application:{...previous.application,preparationId:null,pending}}:previous);
   await send(pending);
  }catch(cause){fail(cause);}
  finally{
   onChange(previous=>previous.application?.preparationId===id?{...previous,application:{...previous.application,preparationId:null}}:previous);
   running.current=false;if(active.current)setBusy(false);
  }
 }
 function retry(){if(!owned||!work?.pending||busy||running.current||unavailable||work.pending.request.projectId!==projectId||work.pending.request.clientId!==session.clientId)return;running.current=true;setBusy(true);setError(null);void send({...structuredClone(work.pending),uncertain:true});}
 if(!owned)return <section className="status-card" aria-label="방법론 적용 경계"><h3>방법론 별도 적용</h3><p role="alert">다른 사용자·기기의 적용 입력이 남아 있습니다. 내용을 표시하거나 전송하지 않습니다.</p></section>;
 return <section className="status-card" aria-label="방법론 적용 경계"><h3>방법론 별도 적용</h3>
  <p className="meta">임무·실행 이력이 없는 프로젝트만 서버에서 적용할 수 있습니다. 저장·검토·확정이나 Agent 실행과 별도입니다.</p>
  <fieldset disabled={!ready}><label htmlFor={reasonId}>방법론 적용 이유</label><textarea id={reasonId} maxLength={20000} value={work?.reason??''} onChange={event=>update(event.target.value)}/>
   <label><input type="checkbox" checked={agreed} onChange={event=>setAgreed(event.target.checked)}/>저장·확정과 별개로 이 버전을 프로젝트에 적용합니다</label>
   <button disabled={!ready||!agreed||!work?.reason.trim()} onClick={()=>{void start();}}>확정 방법론 별도 적용</button>
  </fieldset>
  {!ready&&!work?.pending&&!busy?<p>최신 전용 방법론의 적합 검토·확정과 현재 적용본 조회가 필요합니다. 미저장 편집·미확인 명령을 먼저 확인하세요.</p>:null}
  {busy?<p role="status">명시 적용과 서버 재조회를 확인하고 있습니다.</p>:null}
  {work?.pending&&!busy?<><p role="alert">적용 결과 미확인 · 같은 명령만 다시 확인하세요.</p><p className="meta">고정 원문 버전 {work.pending.request.payload.methodologyRef.version} · {work.pending.request.payload.methodologyRef.contentHash}</p><button disabled={unavailable} onClick={retry}>같은 적용 명령 결과 확인</button></>:null}
  {error?<p role="alert">{error.message} {work?.pending?'적용 입력과 원 명령은 유지합니다.':'이번 적용은 거절됐으며 입력을 보존했습니다.'}</p>:null}
  {!unavailable&&work?.verifiedRef&&same(appliedRef,work.verifiedRef)?<p role="status">서버 적용·재조회 확인 · 적용 세대 {work.verifiedRef.version}</p>:null}
 </section>;
}
