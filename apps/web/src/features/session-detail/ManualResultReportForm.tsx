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
 return <section aria-label="미완료 결과 화면 작성"><h4>미완료·차단 결과 직접 작성</h4><p>수행자 주장만 입력합니다. 실행 참조는 서버가 등록 시 대조합니다. 변경 파일·diff 참조·명령·출력 참조·시험 결과/증거·산출물 참조도 주장으로만 등록하며 실제 실행·파일·증거 출처는 미검증입니다. 명령의 증거 참조는 기존 JSON 파일 등록을 사용하세요. 시험/완료 합격을 만들지 않습니다.</p>
  {error?<p role="alert">{error} · 작성 입력은 보존합니다.</p>:null}
  {!draft?<button type="button" disabled={occupied||busy} onClick={()=>storage.onChange(key,old=>old??newManualResultReport(assignment,session))}>미완료 결과 직접 작성</button>:<>
   <fieldset disabled={busy||occupied}><legend>결과 주장 입력</legend>
    <label>보고 실행 ID<input value={draft.executionId} onChange={e=>edit(d=>{d.executionId=e.target.value;})}/></label>
    <label>보고 실행 버전<input inputMode="numeric" value={draft.executionVersion} onChange={e=>edit(d=>{d.executionVersion=e.target.value;})}/></label>
    <label>보고 실행 해시<input value={draft.executionHash} onChange={e=>edit(d=>{d.executionHash=e.target.value;})}/></label>
    <label>보고 상태<select value={draft.submissionState} onChange={e=>edit(d=>{d.submissionState=e.target.value as ManualResultReport['submissionState'];})}><option value="INCOMPLETE">미완료</option><option value="BLOCKED">차단</option><option value="CANCELLED">취소</option></select></label>
    {draft.rows.map((row,i)=><fieldset key={i}><legend>미실행 항목 {i+1}</legend><label>미실행 조건 ID {i+1}<input maxLength={80} value={row.criterionId} onChange={e=>edit(d=>{const r=d.rows[i];if(r)r.criterionId=e.target.value;})}/></label><label>미실행 시험 ID {i+1}<input maxLength={80} value={row.testId} onChange={e=>edit(d=>{const r=d.rows[i];if(r)r.testId=e.target.value;})}/></label><label>미실행 사유 {i+1}<textarea aria-label={'미실행 사유 '+(i+1)} maxLength={20000} value={row.reason} onChange={e=>edit(d=>{const r=d.rows[i];if(r)r.reason=e.target.value;})}/></label>{draft.rows.length>1?<button type="button" onClick={()=>edit(d=>{d.rows.splice(i,1);})}>미실행 항목 {i+1} 제거</button>:null}</fieldset>)}
    <button type="button" disabled={draft.rows.length>=200} onClick={()=>edit(d=>{d.rows.push({criterionId:'',testId:'',reason:''});})}>미실행 항목 추가</button>
    <fieldset><legend>명령 결과 주장</legend><p className="meta">명령을 실행하지 않습니다. 프로필·작업위치·호스트 참조는 수행자 선언이며 실제 존재·현재 권한은 미확인입니다. 보고 실행과 입력 형식은 별도로 대조합니다. 인수는 한 줄에 하나이며 빈 줄은 빈 인수입니다. 비밀을 입력하지 마세요. 종료 코드 0도 검수 합격·실행 확인이 아닙니다.</p>
     {(draft.commands??[]).map((row,i)=><fieldset key={i}><legend>명령 결과 {i+1}</legend>
      {([['profile','프로필'],['cwd','작업위치'],['host','호스트']]as const).map(([key,label])=><fieldset key={key}><legend>명령 {i+1} {label} 고정 참조</legend>{([['id','ID'],['version','버전'],['contentHash','해시']]as const).map(([field,title])=><label key={field}>명령 {i+1} {label} {title}<input maxLength={field==='version'?16:field==='id'?36:64} value={row[key][field]} onChange={e=>edit(d=>{const c=d.commands?.[i];if(c)c[key][field]=e.target.value;})}/></label>)}</fieldset>)}
      <label><input type="checkbox" aria-label={'명령 '+(i+1)+' 출력 참조 입력'} checked={row.output!=null} onChange={e=>edit(d=>{const c=d.commands?.[i];if(c)c.output=e.target.checked?{id:'',version:'',contentHash:''}:null;})}/>명령 {i+1} 출력 참조 입력</label>
      {row.output?<fieldset><legend>명령 {i+1} 출력 보관 참조 보고</legend><p className="meta">기존 출력 보관파일의 고정 참조만 보고합니다. 실파일 존재·내용·명령 출처·exit는 여기서 확인하지 않습니다. 이후 원문 조회에는 같은 파일을 산출물 참조에도 명시 등록해야 합니다. 선택 해제는 이 작성 입력의 출력 참조만 미보고로 바꾸며 파일을 삭제하지 않습니다.</p>{([['id','ID'],['version','버전'],['contentHash','해시']]as const).map(([field,title])=><label key={field}>명령 {i+1} 출력 {title}<input maxLength={field==='version'?16:field==='id'?36:64} value={row.output![field]} onChange={e=>edit(d=>{const c=d.commands?.[i];if(c?.output)c.output[field]=e.target.value;})}/></label>)}</fieldset>:null}
      <label>명령 인수 {i+1}<textarea aria-label={'명령 인수 '+(i+1)} maxLength={400200} value={row.argv} onChange={e=>edit(d=>{const c=d.commands?.[i];if(c)c.argv=e.target.value;})}/></label>
      {([['startedAt','시작 UTC'],['finishedAt','종료 UTC'],['exitCode','종료 코드']]as const).map(([key,label])=><label key={key}>명령 {i+1} {label}<input maxLength={key==='exitCode'?16:24} placeholder={key==='exitCode'?'빈 값은 미보고':'YYYY-MM-DDTHH:mm:ss.sssZ · 빈 값은 미보고'} value={row[key]} onChange={e=>edit(d=>{const c=d.commands?.[i];if(c)c[key]=e.target.value;})}/></label>)}
      <button type="button" onClick={()=>edit(d=>{d.commands?.splice(i,1);})}>명령 결과 {i+1} 제거</button>
     </fieldset>)}
     <button type="button" disabled={(draft.commands?.length??0)>=200} onClick={()=>edit(d=>{(d.commands??=[]).push({profile:{id:'',version:'',contentHash:''},cwd:{id:'',version:'',contentHash:''},host:{id:'',version:'',contentHash:''},argv:'',startedAt:'',finishedAt:'',exitCode:''});})}>명령 결과 추가</button>
    </fieldset>
    <fieldset><legend>변경 파일 주장</legend><p className="meta">상대경로와 변경 종류만 보고합니다. 실제 파일 읽기·변경·diff 검증은 하지 않으며, 빈 hash는 미보고로 남깁니다.</p>
     {(draft.changes??[]).map((row,i)=><fieldset key={i}><legend>변경 파일 {i+1}</legend>
      <label>변경 파일 상대경로 {i+1}<input maxLength={2000} value={row.path} onChange={e=>edit(d=>{const r=d.changes?.[i];if(r)r.path=e.target.value;})}/></label>
      <label>변경 종류 {i+1}<select aria-label={'변경 종류 '+(i+1)} value={row.kind} onChange={e=>edit(d=>{const r=d.changes?.[i];if(r)r.kind=e.target.value as typeof r.kind;})}><option value="MODIFIED">수정</option><option value="ADDED">추가</option><option value="DELETED">삭제</option></select></label>
      <label>변경 전 hash {i+1}<input maxLength={64} value={row.beforeHash} onChange={e=>edit(d=>{const r=d.changes?.[i];if(r)r.beforeHash=e.target.value;})}/></label>
      <label>변경 후 hash {i+1}<input maxLength={64} value={row.afterHash} onChange={e=>edit(d=>{const r=d.changes?.[i];if(r)r.afterHash=e.target.value;})}/></label>
      <label><input type="checkbox" aria-label={'변경 파일 '+(i+1)+' diff 참조 입력'} checked={row.diff!=null} onChange={e=>edit(d=>{const r=d.changes?.[i];if(r)r.diff=e.target.checked?{id:'',version:'',contentHash:''}:null;})}/>변경 파일 {i+1} diff 참조 입력</label>
      {row.diff?<fieldset><legend>변경 파일 {i+1} diff 보관 참조 보고</legend><p className="meta">기존 diff 파일의 고정 참조만 보고합니다. 실제 파일·변경 내용·Git 이력·출처는 확인하지 않습니다. 이후 원문 조회에는 같은 파일을 산출물 참조에도 명시 등록해야 합니다. 선택 해제는 이 작성 입력의 참조만 미보고로 바꾸며 파일을 삭제하지 않습니다.</p>{([['id','ID'],['version','버전'],['contentHash','해시']]as const).map(([field,title])=><label key={field}>변경 파일 {i+1} diff {title}<input maxLength={field==='version'?16:field==='id'?36:64} value={row.diff![field]} onChange={e=>edit(d=>{const r=d.changes?.[i];if(r?.diff)r.diff[field]=e.target.value;})}/></label>)}</fieldset>:null}
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
      <p className="meta">증거 출처는 입력자의 선언입니다. CONNECTOR_OBSERVED·TEST_ARTIFACT·REVIEWER_CONFIRMED를 선택해도 실제 관측·검토 확인이나 출처 인증이 되지 않습니다. 기존 파일·환경의 고정 참조와 기록 시각만 보고하며 비밀을 입력하지 마세요.</p>
      {(row.evidence??[]).map((ev,j)=><fieldset key={j}><legend>시험 {i+1} 증거 {j+1} 선언</legend>
       <label>시험 {i+1} 증거 {j+1} 출처 선언<select aria-label={'시험 '+(i+1)+' 증거 '+(j+1)+' 출처 선언'} value={ev.sourceKind} onChange={e=>edit(d=>{const v=d.tests?.[i]?.evidence?.[j];if(v)v.sourceKind=e.target.value as typeof v.sourceKind;})}>{['WORKER_CLAIM','CONNECTOR_OBSERVED','TEST_ARTIFACT','REVIEWER_CONFIRMED'].map(k=><option key={k}>{k}</option>)}</select></label>
       {([['ref','파일'],['environmentRef','환경']]as const).map(([key,title])=><fieldset key={key}><legend>{title} 고정 참조</legend>{([['id','ID'],['version','버전'],['contentHash','해시']]as const).map(([field,label])=><label key={field}>시험 {i+1} 증거 {j+1} {title} {label}<input maxLength={field==='version'?16:field==='id'?36:64} value={ev[key][field]} onChange={e=>edit(d=>{const v=d.tests?.[i]?.evidence?.[j];if(v)v[key][field]=e.target.value;})}/></label>)}</fieldset>)}
       <label>시험 {i+1} 증거 {j+1} 내용 해시<input maxLength={64} value={ev.contentHash} onChange={e=>edit(d=>{const v=d.tests?.[i]?.evidence?.[j];if(v)v.contentHash=e.target.value;})}/></label>
       <label>시험 {i+1} 증거 {j+1} 기록 UTC<input maxLength={24} placeholder="YYYY-MM-DDTHH:mm:ss.sssZ" value={ev.recordedAt} onChange={e=>edit(d=>{const v=d.tests?.[i]?.evidence?.[j];if(v)v.recordedAt=e.target.value;})}/></label>
       <button type="button" onClick={()=>edit(d=>{d.tests?.[i]?.evidence?.splice(j,1);})}>시험 {i+1} 증거 {j+1} 제거</button>
      </fieldset>)}
      <button type="button" disabled={(row.evidence?.length??0)>=20} onClick={()=>edit(d=>{const r=d.tests?.[i];if(r)(r.evidence??=[]).push({sourceKind:'WORKER_CLAIM',ref:{id:'',version:'',contentHash:''},contentHash:'',environmentRef:{id:'',version:'',contentHash:''},recordedAt:''});})}>시험 {i+1} 증거 추가</button>
      <button type="button" onClick={()=>edit(d=>{d.tests?.splice(i,1);})}>시험 결과 {i+1} 제거</button>
     </fieldset>)}
     <button type="button" disabled={(draft.tests?.length??0)>=200} onClick={()=>edit(d=>{(d.tests??=[]).push({criterionId:'',testId:'',expected:'',actual:'',status:'NOT_EXECUTED'});})}>시험 결과 추가</button>
    </fieldset>
    <fieldset><legend>산출물 참조 주장</legend><p className="meta">기존 자료의 ID·버전·해시를 선언합니다. 참조만으로 파일을 만들거나 실존·접근·원문·시험 출처를 확인하지 않습니다.</p>
     {(draft.artifacts??[]).map((row,i)=><fieldset key={i}><legend>산출물 참조 {i+1}</legend>
      <label>보고 산출물 ID {i+1}<input maxLength={36} value={row.id} onChange={e=>edit(d=>{const r=d.artifacts?.[i];if(r)r.id=e.target.value;})}/></label>
      <label>보고 산출물 버전 {i+1}<input inputMode="numeric" maxLength={16} value={row.version} onChange={e=>edit(d=>{const r=d.artifacts?.[i];if(r)r.version=e.target.value;})}/></label>
      <label>보고 산출물 해시 {i+1}<input maxLength={64} value={row.contentHash} onChange={e=>edit(d=>{const r=d.artifacts?.[i];if(r)r.contentHash=e.target.value;})}/></label>
      <button type="button" onClick={()=>edit(d=>{d.artifacts?.splice(i,1);})}>산출물 참조 {i+1} 제거</button>
     </fieldset>)}
     <button type="button" disabled={(draft.artifacts?.length??0)>=200} onClick={()=>edit(d=>{(d.artifacts??=[]).push({id:'',version:'',contentHash:''});})}>산출물 참조 추가</button>
    </fieldset>
    <label>보고 위험<textarea aria-label="보고 위험" maxLength={20000} value={draft.risks} onChange={e=>edit(d=>{d.risks=e.target.value;})}/></label><label>보고 복구 방법<textarea aria-label="보고 복구 방법" maxLength={20000} value={draft.rollback} onChange={e=>edit(d=>{d.rollback=e.target.value;})}/></label>
   </fieldset>
   <button type="button" disabled={busy||occupied} onClick={()=>void prepare()}>작성 보고 검사·등록 준비</button>
   {busy?<p role="status">작성 보고 검사 중 · 아직 저장하지 않음</p>:null}
   {occupied?<p>준비본이 있습니다. 원래 작성 입력을 보존하고 등록/미확인 명령을 덮지 않습니다.</p>:null}
  </>}
 </section>;
}
