import {useEffect,useRef,useState,type Dispatch,type SetStateAction} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import type {DocumentBuffer,DocumentSession} from './editor-api.ts';
import type {UploadDocumentImportBuffer} from './import-api.ts';
import {newImportUploadApproval,prepareImportUploadApproval,bindImportUploadApproval,reopenImportUploadApproval,matchesImportApprovalInput,importApprovalInputKey} from './import-upload-approval.ts';
import {sendApprovalCommand,type ApprovalRequestWork} from '../decisions/api.ts';
import {documentMutationUncertain,isKnownDocumentRejection} from './mutation-result.ts';
const risks={data:'데이터 위험',security:'보안 위험',cost:'비용 위험',interruption:'중단 영향',unverified:'미확인 사항'};
export function ImportUploadApprovalEditor({client,session,buffer,disabled,onChange,onAuthenticationLost,onBusy}:{client:ApiClient;session:DocumentSession;buffer:DocumentBuffer;disabled:boolean;onChange:Dispatch<SetStateAction<DocumentBuffer|null>>;onAuthenticationLost:()=>void;onBusy:(busy:boolean)=>void}){
 const [busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),live=useRef(true),flight=useRef(false),latest=useRef(buffer),owned=useRef(new WeakMap<DocumentBuffer,number>([[buffer,0]])),sequence=useRef(0),observed=useRef(buffer),observedSequence=useRef(0),epoch=useRef(0),context=useRef({client,user:session.user.id,clientId:session.clientId,csrf:session.csrfToken,disabled,key:importApprovalInputKey(buffer)});
 const previous=context.current,key=importApprovalInputKey(buffer);if(previous.client!==client||previous.user!==session.user.id||previous.clientId!==session.clientId||previous.csrf!==session.csrfToken||previous.disabled!==disabled||previous.key!==key||observed.current!==buffer&&(!owned.current.has(buffer)||owned.current.get(buffer)!<=observedSequence.current)){epoch.current++;owned.current=new WeakMap([[buffer,0]]);sequence.current=0;observed.current=buffer;observedSequence.current=0;}else if(observed.current!==buffer){observed.current=buffer;observedSequence.current=owned.current.get(buffer)!;}
 context.current={client,user:session.user.id,clientId:session.clientId,csrf:session.csrfToken,disabled,key};latest.current=buffer;
 useEffect(()=>{live.current=true;return()=>{live.current=false;epoch.current++;onBusy(false);};},[]);
 const p=buffer.importState?.source!=='CREATED_ORIGINAL'?buffer.importState:null,a=p?.uploadApproval,w=a?.request;
 function operation(){const id=epoch.current;return()=>live.current&&epoch.current===id&&!context.current.disabled&&owned.current.has(latest.current)&&latest.current.importState?.upload?.commandId===p?.upload.commandId&&matchesImportApprovalInput(latest.current,session);}
 function update(edit:(b:DocumentBuffer,p:UploadDocumentImportBuffer)=>DocumentBuffer,active:()=>boolean){onChange(b=>{if(!b||!active()||!owned.current.has(b)||!b.importState||b.importState.source==='CREATED_ORIGINAL')return b;const next=edit(b,b.importState);owned.current.set(next,++sequence.current);return next;});}
 function failure(cause:unknown,active:()=>boolean){const e=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');if(active()){setError(e.code);if(e.status===401)onAuthenticationLost();}return e;}
 function start(){if(disabled||flight.current)return false;flight.current=true;setBusy(true);setError(null);onBusy(true);return true;}
 function end(){flight.current=false;if(live.current){setBusy(false);onBusy(false);}}
 async function begin(){if(w||!start())return;const active=operation();try{const request=await newImportUploadApproval(buffer,session);if(active())update((b,current)=>current===p?{...b,importState:{...current,uploadApproval:{request,requestId:'',commandHash:null,ownerUserId:session.user.id,sourceHash:'',inputKey:key}}}:b,active);}catch(e){failure(e,active);}finally{end();}}
 function replace(before:ApprovalRequestWork,next:ApprovalRequestWork,active:()=>boolean){update((b,p)=>p.uploadApproval?.request===before?{...b,importState:{...p,uploadApproval:{...p.uploadApproval,request:next}}}:b,active);}
 async function send(){if(!w||w.resultId||!start())return;const active=operation();let current=w,dispatched=false;
 try{if(!current.pending){const pending=await prepareImportUploadApproval(client,current,buffer,session,active);if(!active())return;const next={...current,pending};replace(current,next,active);current=next;}
 if(!active())return;const next={...current,uncertain:true,failure:null};replace(current,next,active);current=next;dispatched=true;
 const result=await sendApprovalCommand(client,current.pending!,session);if(!active())return;const saved={...current,pending:null,resultId:String(result.targetId),uncertain:false,failure:null,dirty:false};
 update((b,p)=>{const a=p.uploadApproval;if(!a||!current.pending||a.request?.pending?.commandId!==current.pending.commandId)return b;return{...b,importState:{...p,uploadApproval:{...a,request:saved,requestId:saved.resultId}}};},active);
 }catch(cause){const e=failure(cause,active);if(active())replace(current,{...current,failure:{code:e.code,status:e.status},uncertain:dispatched?documentMutationUncertain(w.uncertain,e):current.uncertain},active);}finally{end();}}
 async function bind(){if(!a?.requestId||!start())return;const active=operation();try{const next=await bindImportUploadApproval(client,buffer,a.requestId,session,active);if(active())update((b,current)=>current===p?next:b,active);}catch(e){failure(e,active);}finally{end();}}
 function edit(next:ApprovalRequestWork){if(w&&!disabled&&!busy&&!w.pending&&!w.resultId){const active=operation();replace(w,next,active);}}
 if(!p||!matchesImportApprovalInput(buffer,session)||p.record||p.candidate||p.uncertain||!a&&(p.failure?.code!=='APPROVAL_REQUIRED'||p.failure.status!==412))return null;
 return <section aria-label="가져오기 원본 일회 승인"><h3>가져오기 업로드 승인</h3><p className="meta">승인 요청·별도 결정·결박만으로 업로드하지 않습니다. 같은 업로드를 별도로 재개하세요. 이 승인은 가져오기 후보 생성이나 문서 저장에 전파되지 않습니다.</p>
 {!w?<button type="button" disabled={disabled||busy} onClick={()=>void begin()}>가져오기 승인 요청 준비</button>:<>
 <details><summary>가져오기 업로드 명령·해시</summary><pre>{JSON.stringify(w.candidate,null,2)}</pre></details>
 <fieldset disabled={disabled||busy||!!w.pending||!!w.resultId||!!a?.commandHash}><legend>가져오기 승인 요청</legend>
 <label>가져오기 승인 요청 이유<textarea maxLength={20000} value={w.details.reason} onChange={e=>edit({...w,details:{...w.details,reason:e.target.value}})}/></label>
 {(Object.keys(risks) as (keyof typeof risks)[]).map(k=><label key={k}>가져오기 {risks[k]}<textarea maxLength={20000} value={w.details.risks[k]} onChange={e=>edit({...w,details:{...w.details,risks:{...w.details.risks,[k]:e.target.value}}})}/></label>)}
 <label>가져오기 복구 방법<textarea maxLength={20000} value={w.details.rollback.method} onChange={e=>edit({...w,details:{...w.details,rollback:{...w.details.rollback,method:e.target.value}}})}/></label>
 <label>가져오기 복구 한계<textarea maxLength={20000} value={w.details.rollback.limitations} onChange={e=>edit({...w,details:{...w.details,rollback:{...w.details.rollback,limitations:e.target.value}}})}/></label>
 <label>가져오기 승인 만료 UTC<input value={w.details.expiresAt} onChange={e=>edit({...w,details:{...w.details,expiresAt:e.target.value}})}/></label></fieldset>
 <button type="button" disabled={disabled||busy||!!w.resultId||!!a?.commandHash} onClick={()=>void send()}>{w.pending?'같은 가져오기 승인 요청 결과 확인':'가져오기 승인 요청 저장'}</button>
 {w.pending&&!w.uncertain&&isKnownDocumentRejection(w.failure)?<button type="button" disabled={disabled||busy} onClick={()=>{const active=operation();try{update(b=>reopenImportUploadApproval(b,session),active);}catch(e){failure(e,active);}}}>거절된 가져오기 승인 요청 보관 후 수정</button>:null}
 {w.resultId?<><p role="status">가져오기 승인 요청 저장 확인 · 업로드 전</p><a href={`#/projects/${buffer.projectId}/approvals/requests/${w.resultId}`}>가져오기 승인 요청에서 별도 결정</a></>:null}
 {w.failure?<p role="alert">{w.failure.code}{w.uncertain?' · 같은 요청 결과를 재확인하세요':''}</p>:null}</>}
 {a?<><label>기존 가져오기 승인 요청 ID<input value={a.requestId} disabled={disabled||busy||!!w?.pending||!!w?.resultId||!!a.commandHash} onChange={e=>{const value=e.target.value,active=operation();update((b,p)=>p.uploadApproval?{...b,importState:{...p,uploadApproval:{...p.uploadApproval,requestId:value}}}:b,active);}}/></label><button type="button" disabled={disabled||busy||!a.requestId||!!w?.pending} onClick={()=>void bind()}>가져오기 승인 재조회·같은 업로드 결박</button></>:null}
 {a?.commandHash?<p role="status">가져오기 승인 결박 확인 · 명시 업로드 재개 전입니다.</p>:null}{error?<p role="alert">{error}</p>:null}
 </section>;
}
