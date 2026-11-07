import {useEffect,useRef,useState,type Dispatch,type SetStateAction} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import type {DocumentSession} from '../design-trace/editor-api.ts';
import type {KnowledgeCorrectionBuffer} from './correction-api.ts';
import {newKnowledgeCorrectionUploadApproval,prepareKnowledgeCorrectionUploadApproval,bindKnowledgeCorrectionUploadApproval,reopenKnowledgeCorrectionUploadApproval,matchesKnowledgeCorrectionInput} from './knowledge-correction-upload-approval.ts';
import {sendApprovalCommand,type ApprovalRequestWork} from '../decisions/api.ts';
import {documentMutationUncertain,isKnownDocumentRejection} from '../design-trace/mutation-result.ts';
const risks={data:'데이터 위험',security:'보안 위험',cost:'비용 위험',interruption:'중단 영향',unverified:'미확인 사항'};
export function KnowledgeCorrectionUploadApprovalEditor({client,session,buffer,disabled,onChange,onAuthenticationLost,onBusy}:{client:ApiClient;session:DocumentSession;buffer:KnowledgeCorrectionBuffer;disabled:boolean;onChange:Dispatch<SetStateAction<KnowledgeCorrectionBuffer|null>>;onAuthenticationLost:()=>void;onBusy:(busy:boolean)=>void}){
 const [busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),live=useRef(true),flight=useRef(false),latest=useRef(buffer),owned=useRef(new Set([buffer])),epoch=useRef(0),context=useRef({client,user:session.user.id,clientId:session.clientId,csrf:session.csrfToken,disabled});
 const previous=context.current;if(previous.client!==client||previous.user!==session.user.id||previous.clientId!==session.clientId||previous.csrf!==session.csrfToken||!owned.current.has(buffer)){epoch.current++;owned.current=new Set([buffer]);}
 context.current={client,user:session.user.id,clientId:session.clientId,csrf:session.csrfToken,disabled};latest.current=buffer;
 useEffect(()=>{live.current=true;return()=>{live.current=false;epoch.current++;onBusy(false);};},[]);
 const p=buffer.pending,a=p?.uploadApproval,w=a?.request;
 function operation(){const id=epoch.current;return()=>live.current&&epoch.current===id&&!context.current.disabled&&owned.current.has(latest.current)&&latest.current.pending?.upload.commandId===p?.upload.commandId&&latest.current.ownerUserId===session.user.id;}
 function update(edit:(b:KnowledgeCorrectionBuffer)=>KnowledgeCorrectionBuffer,active:()=>boolean){onChange(b=>{if(!b||!active()||!owned.current.has(b))return b;const next=edit(b);owned.current.add(next);return next;});}
 function failure(cause:unknown,active:()=>boolean){const e=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');if(active()){setError(e.code);if(e.status===401)onAuthenticationLost();}return e;}
 function start(){if(disabled||flight.current)return false;flight.current=true;setBusy(true);setError(null);onBusy(true);return true;}
 function end(){flight.current=false;if(live.current){setBusy(false);onBusy(false);}}
 async function begin(){if(w||!start())return;const active=operation();try{const request=await newKnowledgeCorrectionUploadApproval(buffer,session);if(active())update(b=>b.pending===p?{...b,pending:{...p!,uploadApproval:{request,requestId:'',commandHash:null,ownerUserId:session.user.id,sourceHash:''}}}:b,active);}catch(e){failure(e,active);}finally{end();}}
 function replace(before:ApprovalRequestWork,next:ApprovalRequestWork,active:()=>boolean){update(b=>b.pending?.uploadApproval?.request===before?{...b,pending:{...b.pending,uploadApproval:{...b.pending.uploadApproval,request:next}}}:b,active);}
 async function send(){if(!w||w.resultId||!start())return;const active=operation();let current=w,dispatched=false;
  try{
   if(!current.pending){const pending=await prepareKnowledgeCorrectionUploadApproval(client,current,buffer,session,active);if(!active())return;const next={...current,pending};replace(current,next,active);current=next;}
   if(!active())return;const next={...current,uncertain:true,failure:null};replace(current,next,active);current=next;dispatched=true;
   const result=await sendApprovalCommand(client,current.pending!,session);if(!active())return;const saved={...current,pending:null,resultId:String(result.targetId),uncertain:false,failure:null,dirty:false};
   update(b=>{const pending=b.pending,approval=pending?.uploadApproval;if(!pending||!approval||!current.pending||approval.request?.pending?.commandId!==current.pending.commandId)return b;return{...b,pending:{...pending,uploadApproval:{...approval,request:saved,requestId:saved.resultId}}};},active);
  }catch(cause){const e=failure(cause,active);if(active())replace(current,{...current,failure:{code:e.code,status:e.status},uncertain:dispatched?documentMutationUncertain(w.uncertain,e):current.uncertain},active);}finally{end();}
 }
 async function bind(){if(!a?.requestId||a.commandHash||!start())return;const active=operation();try{const next=await bindKnowledgeCorrectionUploadApproval(client,buffer,a.requestId,session,active);if(active())update(b=>b.pending===p?next:b,active);}catch(e){failure(e,active);}finally{end();}}
 function edit(next:ApprovalRequestWork){if(w&&!disabled&&!busy&&!w.pending&&!w.resultId){const active=operation();replace(w,next,active);}}
 if(!p||!matchesKnowledgeCorrectionInput(buffer,p,session)||p.correct||buffer.ownerUserId!==session.user.id||p.upload.clientId!==session.clientId||buffer.uncertain||!a&&(buffer.failure?.code!=='APPROVAL_REQUIRED'||buffer.failure.status!==412))return null;
 return <section aria-label="정정 원문 일회 승인"><h3>정정 원문 업로드 승인</h3><p className="meta">요청·별도 결정·결박 후에도 업로드하지 않습니다. 아래 저장 재개 버튼으로 원문 업로드와 지식 정정을 진행하세요.</p>
 {!w?<button type="button" disabled={disabled||busy} onClick={()=>void begin()}>정정 원문 승인 요청 준비</button>:<>
 <details><summary>원문 업로드 명령·해시</summary><pre>{JSON.stringify(w.candidate,null,2)}</pre></details>
 <fieldset disabled={disabled||busy||!!w.pending||!!w.resultId||!!a?.commandHash}><legend>정정 원문 승인 요청</legend>
 <label>원문 승인 요청 이유<textarea maxLength={20000} value={w.details.reason} onChange={e=>edit({...w,details:{...w.details,reason:e.target.value}})}/></label>
 {(Object.keys(risks) as (keyof typeof risks)[]).map(k=><label key={k}>원문 {risks[k]}<textarea maxLength={20000} value={w.details.risks[k]} onChange={e=>edit({...w,details:{...w.details,risks:{...w.details.risks,[k]:e.target.value}}})}/></label>)}
 <label>원문 복구 방법<textarea maxLength={20000} value={w.details.rollback.method} onChange={e=>edit({...w,details:{...w.details,rollback:{...w.details.rollback,method:e.target.value}}})}/></label>
 <label>원문 복구 한계<textarea maxLength={20000} value={w.details.rollback.limitations} onChange={e=>edit({...w,details:{...w.details,rollback:{...w.details.rollback,limitations:e.target.value}}})}/></label>
 <label>원문 승인 만료 UTC<input value={w.details.expiresAt} onChange={e=>edit({...w,details:{...w.details,expiresAt:e.target.value}})}/></label></fieldset>
 <button type="button" disabled={disabled||busy||!!w.resultId||!!a?.commandHash} onClick={()=>void send()}>{w.pending?'같은 원문 승인 요청 결과 확인':'원문 업로드 승인 요청 저장'}</button>
 {w.pending&&!w.uncertain&&isKnownDocumentRejection(w.failure)?<button type="button" disabled={disabled||busy} onClick={()=>{const active=operation();try{update(b=>reopenKnowledgeCorrectionUploadApproval(b,session),active);}catch(e){failure(e,active);}}}>거절된 원문 승인 요청 보관 후 수정</button>:null}
 {w.resultId?<><p role="status">원문 승인 요청 저장 확인 · 업로드 전</p><a href={`#/projects/${buffer.projectId}/approvals/requests/${w.resultId}`}>원문 승인 요청에서 별도 결정</a></>:null}
 {w.failure?<p role="alert">{w.failure.code}{w.uncertain?' · 같은 요청 결과를 재확인하세요':''}</p>:null}
 </>}
 {a?<><label>기존 원문 승인 요청 ID<input value={a.requestId} disabled={disabled||busy||!!w?.pending||!!w?.resultId||!!a.commandHash} onChange={e=>{const value=e.target.value,active=operation();update(b=>b.pending?.uploadApproval?{...b,pending:{...b.pending,uploadApproval:{...b.pending.uploadApproval,requestId:value}}}:b,active);}}/></label><button type="button" disabled={disabled||busy||!a.requestId||!!a.commandHash||!!w?.pending} onClick={()=>void bind()}>원문 승인 재조회·같은 업로드 명령 결박</button></>:null}
 {a?.commandHash?<p role="status">원문 승인 결박 확인 · 별도 저장 재개 전입니다.</p>:null}
 {error?<p role="alert">{error}</p>:null}
 </section>;
}
