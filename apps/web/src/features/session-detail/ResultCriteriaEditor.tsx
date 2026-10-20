import {useEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import {documentControl,type DocumentSession} from '../design-trace/editor-api.ts';
import {isKnownDocumentRejection} from '../design-trace/mutation-result.ts';
import type {ConfirmedAssignmentView} from '../workspace/assignment-confirmation-api.ts';
import type {ResultReviewBuffers} from './result-review-write-api.ts';
import type {ResultReworkBuffers} from './result-rework-write-api.ts';
import type {ResultSubmissionBuffers} from './result-submission-write-api.ts';
import {CriteriaReadbackUnconfirmed,criteriaRows,prepareCriteriaRegistration,saveCriteriaRegistration,resultTestKinds,type CriteriaRow,type CriteriaRegistration,type RegisteredCriteria} from './result-criteria-api.ts';
export interface CriteriaBuffer{bindingId:string;ownerUserId:string;ownerClientId:string;assignmentRef:ConfirmedAssignmentView['ref'];controlGeneration:number;rows:CriteriaRow[];reason:string;pending:CriteriaRegistration|null;stored:RegisteredCriteria|null;dirty:boolean;uncertain:boolean;failure:{code:string;status:number}|null}
export interface CriteriaEditorProps{session:DocumentSession;buffer:CriteriaBuffer|null;onChange:(change:CriteriaBuffer|((value:CriteriaBuffer|null)=>CriteriaBuffer|null))=>void;reviews?:ResultReviewBuffers;reworks?:ResultReworkBuffers;submissions?:ResultSubmissionBuffers}
/** App 메모리의 주체·임무별 초안/미확인 명령을 소비한다. localStorage/Secret 저장은 하지 않는다. */
export function ResultCriteriaEditor({client,assignment,session,buffer,onChange,onAuthenticationLost,onAccessUnavailable}:{client:ApiClient;assignment:ConfirmedAssignmentView;onAuthenticationLost:()=>void;onAccessUnavailable:(code:string)=>void}&CriteriaEditorProps){
 const [busy,setBusy]=useState(false),[failure,setFailure]=useState<string|null>(null),live=useRef(true),working=useRef(false);useEffect(()=>{live.current=true;return()=>{live.current=false;};},[]);
 const bound=buffer&&buffer.ownerUserId===session.user.id&&buffer.ownerClientId===session.clientId&&buffer.assignmentRef.id===assignment.ref.id&&buffer.assignmentRef.version===assignment.ref.version&&buffer.assignmentRef.contentHash===assignment.ref.contentHash?buffer:null,d=assignment.snapshot.definition,canCreate=!!d.environmentRef&&d.baselineRefs.length>0&&d.acceptanceCriteria.length>0&&d.verificationRequirements.length>0;
 const change=(next:CriteriaBuffer)=>onChange(current=>current?.bindingId===next.bindingId?next:current);
 const edit=(field:'reason'|'rows',value:string|CriteriaRow[])=>{if(!bound||bound.pending||bound.stored||working.current)return;setFailure(null);change({...bound,[field]:value,dirty:true,failure:null});};
 async function run(mode:'CREATE'|'PREPARE'|'SAVE'|'REBIND'){
  if(working.current)return;working.current=true;setBusy(true);setFailure(null);const b=bound;let attempted=false;
  try{
   const generation=await documentControl(client,assignment.projectId,session);if(!live.current)return;
   if(mode==='CREATE'){if(!canCreate||b)return;onChange({bindingId:crypto.randomUUID(),ownerUserId:session.user.id,ownerClientId:session.clientId,assignmentRef:structuredClone(assignment.ref),controlGeneration:generation,rows:criteriaRows(assignment),reason:'',pending:null,stored:null,dirty:false,uncertain:false,failure:null});return;}
   if(mode==='REBIND'){if(!b||b.pending||b.uncertain||b.stored)throw new ApiError('RESULT_CRITERIA_BINDING_INVALID');change({...b,controlGeneration:generation,failure:null});return;}
   if(!b||b.stored||generation!==b.controlGeneration)throw new ApiError('PROJECT_CONTROL_CHANGED',409);
   if(mode==='PREPARE'){if(b.pending||b.uncertain)return;const pending=await prepareCriteriaRegistration(assignment,b.rows,b.reason,session,generation);if(live.current)change({...b,pending,failure:null});return;}
   if(!b.pending)return;attempted=true;change({...b,uncertain:true,failure:null});const stored=await saveCriteriaRegistration(client,b.pending,session,()=>live.current);if(live.current&&stored)change({...b,stored,dirty:false,uncertain:false,failure:null});
  }catch(cause){if(!live.current)return;const error=cause instanceof ApiError?cause:new ApiError('RESULT_CRITERIA_INPUT_INVALID'),safe=/^[A-Z_]{1,80}$/.test(error.code)?error.code:'RESULT_CRITERIA_INPUT_INVALID';setFailure(safe);if(b)change({...b,failure:{code:safe,status:error.status},uncertain:b.uncertain||attempted&&(error instanceof CriteriaReadbackUnconfirmed||!isKnownDocumentRejection(error))});if([401,403,404].includes(error.status))onAccessUnavailable(safe);if(error.status===401)onAuthenticationLost();}
  finally{working.current=false;if(live.current)setBusy(false);}
 }
 const frozen=busy||!!bound?.pending||!!bound?.stored;
 function releaseUnsentPreparation(){
  if(working.current||busy||!bound?.pending||bound.uncertain||bound.stored||bound.failure)return;
  const chosen=bound;if(!confirm('미전송 기준 저장 준비만 해제하고 입력 수정으로 돌아갈까요? 서버 저장이나 전송된 명령은 취소하지 않습니다.'))return;
  onChange(current=>current?.bindingId===chosen.bindingId&&current.pending?.command.commandId===chosen.pending?.command.commandId&&!current.uncertain&&!current.stored&&!current.failure?{...current,pending:null,dirty:true}:current);
 }
 return <section className="status-card" aria-label="검수 기준 등록"><h5>명시 검수 기준 등록</h5><p>원조건마다 시험 ID·종류를 직접 지정합니다. 환경은 확정 임무의 고정 참조이며 실제 가동·검수 합격·실행 허가를 뜻하지 않습니다.</p>
  {!canCreate?<p role="status">확정 임무의 기준·환경·완료/검증 조건이 부족하여 등록할 수 없습니다. 먼저 임무를 보완하세요.</p>:null}
  {!bound?<button type="button" disabled={busy||!canCreate||!!buffer} onClick={()=>void run('CREATE')}>검수 기준 작성</button>:<>
   <p>필수 원조건 전체 포함 · 환경 {d.environmentRef?.id} v{d.environmentRef?.version}</p>
{bound.rows.map((row,index)=><fieldset key={row.field+':'+row.index} disabled={frozen}><legend>{row.field==='acceptanceCriteria'?'완료 조건':'검증 조건'} {row.index+1}</legend><p>{d[row.field][row.index]}</p><label>기준 ID {index+1}<input value={row.criterionId} maxLength={80} onChange={e=>edit('rows',bound.rows.map((v,i)=>i===index?{...v,criterionId:e.target.value}:v))}/></label><label>시험 ID {index+1}<input value={row.testId} maxLength={80} onChange={e=>edit('rows',bound.rows.map((v,i)=>i===index?{...v,testId:e.target.value}:v))}/></label><label>시험 종류 {index+1}<select aria-label={'시험 종류 '+(index+1)} value={row.kind} onChange={e=>edit('rows',bound.rows.map((v,i)=>i===index?{...v,kind:e.target.value}:v))}><option value="">직접 선택</option>{resultTestKinds.map(k=><option key={k} value={k}>{k}</option>)}</select></label></fieldset>)}
   <label>기준 등록 이유<textarea disabled={frozen} maxLength={20000} value={bound.reason} onChange={e=>edit('reason',e.target.value)}/></label>
   {!bound.pending&&!bound.stored?<><button type="button" disabled={busy||bound.uncertain} onClick={()=>void run('PREPARE')}>검수 기준 저장 준비</button><button type="button" disabled={busy||bound.uncertain} onClick={()=>void run('REBIND')}>현재 제어로 미전송 입력 재결박</button></>:null}
   {bound.pending&&!bound.stored?<><details><summary>저장할 고정 명령·원조건 매핑</summary><pre>{JSON.stringify(bound.pending.command,null,2)}</pre></details><button type="button" disabled={busy} onClick={()=>void run('SAVE')}>{bound.failure||bound.uncertain?'같은 기준 저장 명령 재확인':'검수 기준 명시 저장'}</button>{!bound.uncertain&&isKnownDocumentRejection(bound.failure)?<button type="button" disabled={busy} onClick={()=>change({...bound,pending:null,failure:null,dirty:true})}>확인된 거절 이후 입력 수정</button>:null}</>:null}
   {bound.pending&&!bound.stored&&!bound.uncertain&&!bound.failure?<button type="button" disabled={busy} onClick={releaseUnsentPreparation}>미전송 기준 저장 준비 해제</button>:null}
   {bound.uncertain?<p role="status">저장 결과 미확인 · 입력/명령을 보존했습니다. 새 명령을 만들지 않고 같은 명령으로만 확인하세요.</p>:null}
   {bound.stored?<div><p>등록 원문 확인 완료 · 검수 합격/적용/실행 허가 아님</p><p>{bound.stored.ref.id} · v{bound.stored.ref.version} · {bound.stored.ref.contentHash}</p><details><summary>저장된 기준 원문</summary><pre>{JSON.stringify(bound.stored,null,2)}</pre></details><p>보관 기준 선택·보완/차단 검수는 아래 별도 영역에서 제공합니다. 기준 개정·합격 판정·보완 실행은 미연결입니다.</p></div>:null}
  </>}
  {failure||bound?.failure?<p role="alert">{failure??bound?.failure?.code} · 저장 완료로 표시하지 않습니다.</p>:null}
  {busy?<p role="status">현재 제어·입력·정확 저장 결과 확인 중</p>:null}<p className="meta">입력과 미확인 명령은 이 브라우저 화면을 이동해도 메모리에 보존됩니다. 페이지 새로고침·종료 후 복원은 아직 미제공입니다.</p>
 </section>;
}
