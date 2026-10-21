import {useEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import {documentControl,type DocumentSession} from '../design-trace/editor-api.ts';
import type {ConfirmedAssignmentView} from '../workspace/assignment-confirmation-api.ts';
import {newManualResultReport,prepareManualResultReport,type ManualResultReport,type ManualResultReportStorage} from './manual-result-report.ts';
import {resultSubmissionKey,type ResultSubmissionBuffer} from './result-submission-write-api.ts';
import {ordered} from '../knowledge/review-view.ts';
export function ManualResultReportForm({client,assignment,session,storage,occupied,onPrepared,onAuthenticationLost}:{client:ApiClient;assignment:ConfirmedAssignmentView;session:DocumentSession;storage:ManualResultReportStorage;occupied:boolean;onPrepared:(b:ResultSubmissionBuffer)=>void;onAuthenticationLost:()=>void}){
 const key=resultSubmissionKey(session,assignment.projectId,assignment.ref),draft=storage.drafts[key]??null,[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),live=useRef(true),flight=useRef(false),latest=useRef({draft,occupied});latest.current={draft,occupied};
 useEffect(()=>{live.current=true;return()=>{live.current=false;};},[]);
 function edit(change:(d:ManualResultReport)=>void){if(!draft||busy||occupied)return;storage.onChange(key,old=>{if(!old||old.bindingId!==draft.bindingId)return old;const next=structuredClone(old);change(next);return next;});}
 async function prepare(){
  if(!draft||occupied||flight.current)return;const chosen=structuredClone(draft),fingerprint=ordered(chosen);flight.current=true;setBusy(true);setError(null);
  const active=()=>live.current&&!latest.current.occupied&&ordered(latest.current.draft)===fingerprint;
  try{const generation=await documentControl(client,assignment.projectId,session);if(!active())return;const b=await prepareManualResultReport(chosen,assignment,session,generation);if(active())onPrepared(b);}
  catch(cause){if(active()){const e=cause instanceof ApiError?cause:new ApiError('MANUAL_RESULT_REPORT_INVALID');setError(e.code);if(e.status===401)onAuthenticationLost();}}
  finally{flight.current=false;if(live.current)setBusy(false);}
 }
 return <section aria-label="미완료 결과 화면 작성"><h4>미완료·차단 결과 직접 작성</h4><p>수행자 주장만 입력합니다. 실행 참조는 서버가 등록 시 대조합니다. 변경 파일·명령·시험·산출물은 이 간이 보고에서 미보고이며, 상세 근거가 있으면 기존 JSON 파일 등록을 사용하세요. 시험/완료 합격을 만들지 않습니다.</p>
  {error?<p role="alert">{error} · 작성 입력은 보존합니다.</p>:null}
  {!draft?<button type="button" disabled={occupied||busy} onClick={()=>storage.onChange(key,old=>old??newManualResultReport(assignment,session))}>미완료 결과 직접 작성</button>:<>
   <fieldset disabled={busy||occupied}><legend>결과 주장 입력</legend>
    <label>보고 실행 ID<input value={draft.executionId} onChange={e=>edit(d=>{d.executionId=e.target.value;})}/></label>
    <label>보고 실행 버전<input inputMode="numeric" value={draft.executionVersion} onChange={e=>edit(d=>{d.executionVersion=e.target.value;})}/></label>
    <label>보고 실행 해시<input value={draft.executionHash} onChange={e=>edit(d=>{d.executionHash=e.target.value;})}/></label>
    <label>보고 상태<select value={draft.submissionState} onChange={e=>edit(d=>{d.submissionState=e.target.value as ManualResultReport['submissionState'];})}><option value="INCOMPLETE">미완료</option><option value="BLOCKED">차단</option><option value="CANCELLED">취소</option></select></label>
    {draft.rows.map((row,i)=><fieldset key={i}><legend>미실행 항목 {i+1}</legend><label>미실행 조건 ID {i+1}<input maxLength={80} value={row.criterionId} onChange={e=>edit(d=>{const r=d.rows[i];if(r)r.criterionId=e.target.value;})}/></label><label>미실행 시험 ID {i+1}<input maxLength={80} value={row.testId} onChange={e=>edit(d=>{const r=d.rows[i];if(r)r.testId=e.target.value;})}/></label><label>미실행 사유 {i+1}<textarea aria-label={'미실행 사유 '+(i+1)} maxLength={20000} value={row.reason} onChange={e=>edit(d=>{const r=d.rows[i];if(r)r.reason=e.target.value;})}/></label>{draft.rows.length>1?<button type="button" onClick={()=>edit(d=>{d.rows.splice(i,1);})}>미실행 항목 {i+1} 제거</button>:null}</fieldset>)}
    <button type="button" disabled={draft.rows.length>=200} onClick={()=>edit(d=>{d.rows.push({criterionId:'',testId:'',reason:''});})}>미실행 항목 추가</button>
    <label>보고 위험<textarea aria-label="보고 위험" maxLength={20000} value={draft.risks} onChange={e=>edit(d=>{d.risks=e.target.value;})}/></label><label>보고 복구 방법<textarea aria-label="보고 복구 방법" maxLength={20000} value={draft.rollback} onChange={e=>edit(d=>{d.rollback=e.target.value;})}/></label>
   </fieldset>
   <button type="button" disabled={busy||occupied} onClick={()=>void prepare()}>작성 보고 검사·등록 준비</button>
   {busy?<p role="status">작성 보고 검사 중 · 아직 저장하지 않음</p>:null}
   {occupied?<p>준비본이 있습니다. 원래 작성 입력을 보존하고 등록/미확인 명령을 덮지 않습니다.</p>:null}
  </>}
 </section>;
}
