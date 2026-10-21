import { useEffect, useRef, useState } from 'react';
import { ApiClient, ApiError } from '../../api/client.ts';
import type { DocumentBuffer, DocumentSession } from './editor-api.ts';
import { prepareWorkPlan, type WorkPlanBuffer } from './work-plan-api.ts';
import { newWorkPlanApprovalRequest, prepareWorkPlanApprovalRequest, bindWorkPlanApproval, reopenRejectedWorkPlanApproval } from '../decisions/work-plan-approval-api.ts';
import { sendApprovalCommand, type ApprovalRequestWork } from '../decisions/api.ts';
import { documentMutationUncertain, isKnownDocumentRejection } from './mutation-result.ts';
interface Props { client:ApiClient;session:DocumentSession;buffer:DocumentBuffer;disabled:boolean;update:(change:(s:WorkPlanBuffer)=>WorkPlanBuffer,dirty?:boolean)=>void;onAuthenticationLost:()=>void }
const risks={data:'데이터 위험',security:'보안 위험',cost:'비용 위험',interruption:'중단 영향',unverified:'미확인 사항'};
export function WorkPlanApprovalEditor({client,session,buffer,disabled,update,onAuthenticationLost}:Props){
 const s=buffer.workPlanState!,w=s.approval?.request,[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),alive=useRef(true),lock=useRef(false),latest=useRef(buffer);
 latest.current=buffer;useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const active=()=>alive.current&&latest.current.ownerUserId===buffer.ownerUserId&&latest.current.projectId===buffer.projectId&&latest.current.controlGeneration===buffer.controlGeneration&&latest.current.workPlanState?.bindingId===s.bindingId;
 function fail(cause:unknown){const e=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');if(active())setError(e.code);if(active()&&e.status===401)onAuthenticationLost();return e;}
 function change(next:ApprovalRequestWork){if(!busy&&!w?.pending&&!w?.resultId)update(v=>v.approval&&v.approval.request===w?{...v,approval:{...v.approval,request:next}}:v);}
 function begin(){if(disabled||busy||lock.current||s.result||s.sent||s.uncertain||w)return;try{const pending=s.pending??prepareWorkPlan(buffer,session),next={...buffer,workPlanState:{...s,pending}},request=newWorkPlanApprovalRequest(next,session);update(v=>!v.sent&&!v.uncertain&&!v.result&&!v.approval?{...v,pending,approval:{request,requestId:'',commandHash:null}}:v);setError(null);}catch(e){fail(e);}}
 async function send(){
  if(!w||w.resultId||lock.current||disabled)return;lock.current=true;setBusy(true);setError(null);let current=w,dispatched=false;
  const replace=(before:ApprovalRequestWork,next:ApprovalRequestWork)=>update(v=>v.approval?.request===before?{...v,approval:{...v.approval,request:next}}:v,false);
  try{
   if(!current.pending){const pending=await prepareWorkPlanApprovalRequest(client,current,buffer,session,active);if(!active())return;const next={...current,pending};replace(current,next);current=next;}
   if(!active())return;
   const before=current,next={...current,uncertain:true,failure:null};replace(before,next);current=next;dispatched=true;
   const result=await sendApprovalCommand(client,current.pending!,session),saved={...current,resultId:result.targetId,pending:null,uncertain:false,failure:null,dirty:false};
   // 이탈해도 같은 후보/요청에만 결과를 수집한다. 다른 버퍼에는 적용하지 않는다.
   update(v=>v.approval&&v.approval.request.pending?.commandId===current.pending?.commandId&&!v.approval.request.resultId?{...v,approval:{...v.approval,request:saved,requestId:result.targetId}}:v,false);
  }catch(cause){const e=fail(cause),failed={...current,failure:{code:e.code,status:e.status},uncertain:dispatched?documentMutationUncertain(w.uncertain,e):current.uncertain};replace(current,failed);}
  finally{lock.current=false;if(active())setBusy(false);}
 }
 async function bind(){
  if(!s.approval?.requestId||disabled||lock.current)return;lock.current=true;setBusy(true);setError(null);
  try{const original=s.pending,next=await bindWorkPlanApproval(client,buffer,s.approval.requestId,session,active);if(active())update(v=>v.pending===original&&!v.sent&&!v.uncertain?next.workPlanState!:v,false);}catch(e){fail(e);}finally{lock.current=false;if(active())setBusy(false);}
 }
 async function reopen(){
  if(disabled||lock.current||!s.approval||!confirm('서버 거절/수정요청을 확인한 뒤 원 입력과 승인 이력을 보존해 새 후보를 작성할까요?'))return;
  lock.current=true;setBusy(true);try{const next=await reopenRejectedWorkPlanApproval(client,buffer,session,active);if(active())update(v=>v.pending===s.pending?next.workPlanState!:v);}catch(e){fail(e);}finally{lock.current=false;if(active())setBusy(false);}
 }
 function unprepare(){
  if(disabled||busy||lock.current||!s.approval||w?.uncertain||s.sent||w?.resultId||w?.pending&&!isKnownDocumentRejection(w.failure))return;
  if(confirm('전송 전이거나 명확히 거절된 요청입니다. 원 입력과 후보 이력을 보존해 새 명령으로 다시 준비할까요?'))update(v=>v.approval&&v.approval===s.approval?{...v,pending:null,approval:undefined,approvalHistory:[...v.approvalHistory??[],v.approval],failure:null}:v);
 }
 return <section aria-label="작업계획 일회 승인"><h3>작업계획 저장 일회 승인</h3><p>준비·요청·별도 결정·저장은 서로 다른 행동입니다. 승인은 계획 확정이나 Agent 실행이 아닙니다.</p>
 {!w?<button type="button" disabled={disabled||busy||!!s.result||!!s.sent||s.uncertain} onClick={begin}>작업계획 저장 승인 준비</button>:<>
  <p>고정 후보 {w.candidate.commandId}</p><details><summary>저장할 정확 입력</summary><pre>{JSON.stringify(w.candidate,null,2)}</pre></details>
  <fieldset disabled={disabled||busy||!!w.pending||!!w.resultId}><legend>초안 저장 승인 요청</legend>
   <label>계획 승인 요청 이유<textarea maxLength={20000} value={w.details.reason} onChange={e=>change({...w,details:{...w.details,reason:e.target.value}})}/></label>
   {(Object.keys(risks)as(keyof typeof risks)[]).map(k=><label key={k}>계획 {risks[k]}<textarea maxLength={20000} value={w.details.risks[k]} onChange={e=>change({...w,details:{...w.details,risks:{...w.details.risks,[k]:e.target.value}}})}/></label>)}
   <label>계획 복구 방법<textarea maxLength={20000} value={w.details.rollback.method} onChange={e=>change({...w,details:{...w.details,rollback:{...w.details.rollback,method:e.target.value}}})}/></label>
   <label>계획 복구 한계<textarea maxLength={20000} value={w.details.rollback.limitations} onChange={e=>change({...w,details:{...w.details,rollback:{...w.details.rollback,limitations:e.target.value}}})}/></label>
   <label>계획 승인 만료 UTC<input value={w.details.expiresAt} onChange={e=>change({...w,details:{...w.details,expiresAt:e.target.value}})}/></label>
  </fieldset><button type="button" disabled={disabled||busy||!!w.resultId} onClick={()=>void send()}>{w.pending?'같은 계획 승인 요청 결과 확인':'작업계획 일회 승인 요청 저장'}</button>
  {w.resultId?<><p role="status">요청 저장 확인 · 계획 저장 전</p><a href={`#/projects/${buffer.projectId}/approvals/requests/${w.resultId}`}>이 계획 승인 요청에서 별도 결정</a><button type="button" disabled={disabled||busy||!!s.sent||s.uncertain||s.pending?.approvalRef!==null} onClick={()=>void bind()}>계획 승인 재조회·미전송 명령 결박</button></>:null}
  {s.approval?.commandHash?<p role="status">정확 승인 결박 확인 · 아래 저장 버튼으로 별도 전송하세요.</p>:null}
  {w.resultId?<button type="button" disabled={disabled||busy||!!s.sent||s.uncertain||s.pending?.approvalRef!==null} onClick={()=>void reopen()}>거절·수정요청 재조회 후 새 계획 후보 작성</button>:<button type="button" disabled={disabled||busy||w.uncertain||!!w.pending&&!isKnownDocumentRejection(w.failure)} onClick={unprepare}>전송 전·명확 거절 승인 준비 해제</button>}
  {w.failure?<p role="alert">{w.failure.code}{w.uncertain?' · 결과 미확인, 같은 요청 명령 보존':''}</p>:null}
 </>}{s.approvalHistory?.length?<details><summary>이전 승인 후보 이력 {s.approvalHistory.length}건</summary>{s.approvalHistory.map((a,i)=><p key={i}>후보 {a.request.candidate.commandId} · 요청 {a.requestId||'미저장/명확 거절'}</p>)}</details>:null}{error&&!w?.failure?<p role="alert">{error}</p>:null}</section>;
}
