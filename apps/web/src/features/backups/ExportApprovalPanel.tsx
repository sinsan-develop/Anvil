import {useEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import type {DocumentSession} from '../design-trace/editor-api.ts';
import {sendApprovalCommand,type ApprovalRequestWork} from '../decisions/api.ts';
import {ApprovalRequestLinks} from '../mobile/ApprovalRequestLinks.ts';
import {newExportApprovalRequest,prepareExportApprovalRequest,bindExportApproval} from './export-approval.ts';
import {exportPendingMatches,type ExportPending} from './project-backups-api.ts';
interface Props{client:ApiClient;session:DocumentSession;buffer:ExportPending;disabled:boolean;onChange:(expected:string,next:ExportPending)=>boolean;onAuthenticationLost:()=>void}
const risks={data:'데이터 위험',security:'보안 위험',cost:'비용 위험',interruption:'중단 영향',unverified:'미확인 사항'};
export function ExportApprovalPanel({client,session,buffer,disabled,onChange,onAuthenticationLost}:Props){
 const [busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),[lookup,setLookup]=useState(''),alive=useRef(true),lock=useRef(false),live=useRef({client,session,buffer});live.current={client,session,buffer};
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const w=buffer.approvalRequest??null,current=(p:ExportPending)=>alive.current&&live.current.client===client&&live.current.session===session&&live.current.buffer===p&&exportPendingMatches(p,client,session,p.projectId);
 function change(p:ExportPending,next:ExportPending){if(!current(p)||!onChange(p.bindingId,next))return false;live.current.buffer=next;return true;}
 function fail(e:unknown,p:ExportPending){if(!current(p))return;const a=e instanceof ApiError?e:new ApiError('RESPONSE_INVALID');setError(a.code);if(a.status===401)onAuthenticationLost();}
 function edit(next:ApprovalRequestWork){if(!busy&&!disabled&&w&&!w.pending&&!w.resultId)change(buffer,{...buffer,approvalRequest:next});}
 function begin(){if(busy||disabled||w)return;try{change(buffer,{...buffer,approvalRequest:newExportApprovalRequest(buffer,session)});}catch(e){fail(e,buffer);}}
 async function prepare(){if(!w||w.pending||w.resultId||busy||disabled||lock.current)return;const p=buffer;lock.current=true;setBusy(true);setError(null);try{const pending=await prepareExportApprovalRequest(client,w,p,session,()=>current(p));if(current(p))change(p,{...p,approvalRequest:{...w,pending}});}catch(e){fail(e,p);}finally{lock.current=false;if(alive.current)setBusy(false);}}
 async function send(){if(!w?.pending||w.resultId||busy||disabled||lock.current)return;const p={...buffer,approvalRequest:{...w,uncertain:true,failure:null}};if(!change(buffer,p))return;lock.current=true;setBusy(true);setError(null);try{const result=await sendApprovalCommand(client,w.pending,session);if(current(p))change(p,{...p,approvalRequest:{...w,resultId:result.targetId,uncertain:false,failure:null}});}catch(e){const a=e instanceof ApiError?e:new ApiError('RESPONSE_INVALID');if(current(p)){const known=[400,403,404,409,412,422].includes(a.status)&&!['RESPONSE_INVALID','REQUEST_FAILED'].includes(a.code);change(p,{...p,approvalRequest:{...w,uncertain:w.uncertain||!known,failure:{code:a.code,status:a.status}}});if(a.status===401)onAuthenticationLost();}}finally{lock.current=false;if(alive.current)setBusy(false);}}
 async function bind(){if(busy||disabled||lock.current)return;const p=buffer,id=w?.resultId??lookup;lock.current=true;setBusy(true);setError(null);try{const next=await bindExportApproval(client,p,id,session,()=>current(p));if(current(p))change(p,next);}catch(e){fail(e,p);}finally{lock.current=false;if(alive.current)setBusy(false);}}
 if(buffer.dispatchState!=='REQUIRED'&&buffer.dispatchState!=='BOUND')return null;
 return <section aria-label="반출 일회 승인"><h3>반출 일회 승인</h3><p>원명령 {buffer.command.commandId}의 선택·이유를 보존합니다. 요청·결정·결박은 반출 실행과 별개입니다.</p><details><summary>원 선택·반출 이유</summary><pre>{JSON.stringify(buffer.command.payload,null,2)}</pre></details>
 {buffer.dispatchState==='BOUND'?<p role="status">승인 결박 확인 · 같은 반출 명령을 별도로 실행하세요.</p>:<>
 {!w?<button disabled={busy||disabled} onClick={begin}>반출 승인 요청 작성</button>:<section aria-label="반출 승인 요청 작성">
 <fieldset disabled={busy||disabled||!!w.pending||!!w.resultId}><label>반출 승인 요청 이유<textarea value={w.details.reason} onChange={e=>edit({...w,dirty:true,details:{...w.details,reason:e.target.value}})}/></label>
 {(Object.keys(risks) as (keyof typeof risks)[]).map(k=><label key={k}>{risks[k]}<textarea value={w.details.risks[k]} onChange={e=>edit({...w,dirty:true,details:{...w.details,risks:{...w.details.risks,[k]:e.target.value}}})}/></label>)}
 <label>복구 방법<textarea value={w.details.rollback.method} onChange={e=>edit({...w,dirty:true,details:{...w.details,rollback:{...w.details.rollback,method:e.target.value}}})}/></label>
 <label>복구 한계<textarea value={w.details.rollback.limitations} onChange={e=>edit({...w,dirty:true,details:{...w.details,rollback:{...w.details.rollback,limitations:e.target.value}}})}/></label>
 <label>승인 만료 UTC<input value={w.details.expiresAt} onChange={e=>edit({...w,dirty:true,details:{...w.details,expiresAt:e.target.value}})}/></label></fieldset>
 {!w.pending?<button disabled={busy||disabled} onClick={()=>void prepare()}>반출 승인 요청 명령 준비</button>:<><p>승인 요청 원명령: {w.pending.commandId}</p><button disabled={busy||disabled||!!w.resultId} onClick={()=>void send()}>같은 반출 승인 요청 전송·재확인</button></>}
 {w.failure?<p role="alert">{w.failure.code}{w.uncertain?' · 원 승인 요청 보존/결과 미확인':''}</p>:null}
 {w.resultId?<><p role="status">반출 승인 요청 저장 확인</p><ApprovalRequestLinks projectId={buffer.projectId} requestId={w.resultId}/></>:null}
 </section>}
 <label>반출 승인 요청 ID<input value={w?.resultId??lookup} readOnly={!!w?.resultId} onChange={e=>setLookup(e.target.value)} maxLength={36}/></label><button disabled={busy||disabled||!(w?.resultId??lookup)} onClick={()=>void bind()}>반출 승인을 원명령에 결박</button>
 </>}{error?<p role="alert">{error}</p>:null}</section>;
}
