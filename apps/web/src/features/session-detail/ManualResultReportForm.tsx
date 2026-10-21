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
 return <section aria-label="미완료 결과 화면 작성"><h4>미완료·차단 결과 직접 작성</h4><p>수행자 주장만 입력합니다. 실행 참조는 서버가 등록 시 대조합니다. 변경 파일·시험 결과도 주장으로만 등록하며 실제 파일·증거 출처는 미검증입니다. 명령·산출물과 diff/증거 참조는 기존 JSON 파일 등록을 사용하세요. 시험/완료 합격을 만들지 않습니다.</p>
  {error?<p role="alert">{error} · 작성 입력은 보존합니다.</p>:null}
  {!draft?<button type="button" disabled={occupied||busy} onClick={()=>storage.onChange(key,old=>old??newManualResultReport(assignment,session))}>미완료 결과 직접 작성</button>:<>
   <fieldset disabled={busy||occupied}><legend>결과 주장 입력</legend>
    <label>보고 실행 ID<input value={draft.executionId} onChange={e=>edit(d=>{d.executionId=e.target.value;})}/></label>
    <label>보고 실행 버전<input inputMode="numeric" value={draft.executionVersion} onChange={e=>edit(d=>{d.executionVersion=e.target.value;})}/></label>
    <label>보고 실행 해시<input value={draft.executionHash} onChange={e=>edit(d=>{d.executionHash=e.target.value;})}/></label>
    <label>보고 상태<select value={draft.submissionState} onChange={e=>edit(d=>{d.submissionState=e.target.value as ManualResultReport['submissionState'];})}><option value="INCOMPLETE">미완료</option><option value="BLOCKED">차단</option><option value="CANCELLED">취소</option></select></label>
    {draft.rows.map((row,i)=><fieldset key={i}><legend>미실행 항목 {i+1}</legend><label>미실행 조건 ID {i+1}<input maxLength={80} value={row.criterionId} onChange={e=>edit(d=>{const r=d.rows[i];if(r)r.criterionId=e.target.value;})}/></label><label>미실행 시험 ID {i+1}<input maxLength={80} value={row.testId} onChange={e=>edit(d=>{const r=d.rows[i];if(r)r.testId=e.target.value;})}/></label><label>미실행 사유 {i+1}<textarea aria-label={'미실행 사유 '+(i+1)} maxLength={20000} value={row.reason} onChange={e=>edit(d=>{const r=d.rows[i];if(r)r.reason=e.target.value;})}/></label>{draft.rows.length>1?<button type="button" onClick={()=>edit(d=>{d.rows.splice(i,1);})}>미실행 항목 {i+1} 제거</button>:null}</fieldset>)}
    <button type="button" disabled={draft.rows.length>=200} onClick={()=>edit(d=>{d.rows.push({criterionId:'',testId:'',reason:''});})}>미실행 항목 추가</button>
    <fieldset><legend>변경 파일 주장</legend><p className="meta">상대경로와 변경 종류만 보고합니다. 실제 파일 읽기·변경·diff 검증은 하지 않으며, 빈 hash는 미보고로 남깁니다.</p>
     {(draft.changes??[]).map((row,i)=><fieldset key={i}><legend>변경 파일 {i+1}</legend>
      <label>변경 파일 상대경로 {i+1}<input maxLength={2000} value={row.path} onChange={e=>edit(d=>{const r=d.changes?.[i];if(r)r.path=e.target.value;})}/></label>
      <label>변경 종류 {i+1}<select aria-label={'변경 종류 '+(i+1)} value={row.kind} onChange={e=>edit(d=>{const r=d.changes?.[i];if(r)r.kind=e.target.value as typeof r.kind;})}><option value="MODIFIED">수정</option><option value="ADDED">추가</option><option value="DELETED">삭제</option></select></label>
      <label>변경 전 hash {i+1}<input maxLength={64} value={row.beforeHash} onChange={e=>edit(d=>{const r=d.changes?.[i];if(r)r.beforeHash=e.target.value;})}/></label>
      <label>변경 후 hash {i+1}<input maxLength={64} value={row.afterHash} onChange={e=>edit(d=>{const r=d.changes?.[i];if(r)r.afterHash=e.target.value;})}/></label>
      <button type="button" onClick={()=>edit(d=>{d.changes?.splice(i,1);})}>변경 파일 {i+1} 제거</button>
     </fieldset>)}
     <button type="button" disabled={(draft.changes?.length??0)>=200} onClick={()=>edit(d=>{(d.changes??=[]).push({path:'',kind:'MODIFIED',beforeHash:'',afterHash:''});})}>변경 파일 추가</button>
    </fieldset>
    <fieldset><legend>시험 결과 주장</legend><p className="meta">고정 임무의 기준 참조를 보존합니다. PASS 선택도 검수 합격·실제 실행 확인이 아니며, 원 미실행 보고는 별도로 남습니다.</p>
     {(draft.tests??[]).map((row,i)=><fieldset key={i}><legend>시험 결과 {i+1}</legend>
      <label>시험 조건 ID {i+1}<input maxLength={80} value={row.criterionId} onChange={e=>edit(d=>{const r=d.tests?.[i];if(r)r.criterionId=e.target.value;})}/></label>
      <label>시험 ID {i+1}<input maxLength={80} value={row.testId} onChange={e=>edit(d=>{const r=d.tests?.[i];if(r)r.testId=e.target.value;})}/></label>
      <label>시험 기대 결과 {i+1}<textarea aria-label={'시험 기대 결과 '+(i+1)} maxLength={20000} value={row.expected} onChange={e=>edit(d=>{const r=d.tests?.[i];if(r)r.expected=e.target.value;})}/></label>
      <label>시험 실제 결과 {i+1}<textarea aria-label={'시험 실제 결과 '+(i+1)} maxLength={20000} value={row.actual} onChange={e=>edit(d=>{const r=d.tests?.[i];if(r)r.actual=e.target.value;})}/></label>
      <label>시험 상태 주장 {i+1}<select aria-label={'시험 상태 주장 '+(i+1)} value={row.status} onChange={e=>edit(d=>{const r=d.tests?.[i];if(r)r.status=e.target.value as typeof r.status;})}>{['NOT_EXECUTED','FAIL','BLOCKED','PASS','NOT_APPLICABLE'].map(status=><option key={status}>{status}</option>)}</select></label>
      <button type="button" onClick={()=>edit(d=>{d.tests?.splice(i,1);})}>시험 결과 {i+1} 제거</button>
     </fieldset>)}
     <button type="button" disabled={(draft.tests?.length??0)>=200} onClick={()=>edit(d=>{(d.tests??=[]).push({criterionId:'',testId:'',expected:'',actual:'',status:'NOT_EXECUTED'});})}>시험 결과 추가</button>
    </fieldset>
    <label>보고 위험<textarea aria-label="보고 위험" maxLength={20000} value={draft.risks} onChange={e=>edit(d=>{d.risks=e.target.value;})}/></label><label>보고 복구 방법<textarea aria-label="보고 복구 방법" maxLength={20000} value={draft.rollback} onChange={e=>edit(d=>{d.rollback=e.target.value;})}/></label>
   </fieldset>
   <button type="button" disabled={busy||occupied} onClick={()=>void prepare()}>작성 보고 검사·등록 준비</button>
   {busy?<p role="status">작성 보고 검사 중 · 아직 저장하지 않음</p>:null}
   {occupied?<p>준비본이 있습니다. 원래 작성 입력을 보존하고 등록/미확인 명령을 덮지 않습니다.</p>:null}
  </>}
 </section>;
}
