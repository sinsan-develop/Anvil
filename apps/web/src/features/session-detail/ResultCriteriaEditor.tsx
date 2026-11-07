import {useEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import {documentControl,type DocumentSession} from '../design-trace/editor-api.ts';
import {isKnownDocumentRejection} from '../design-trace/mutation-result.ts';
import type {ConfirmedAssignmentView} from '../workspace/assignment-confirmation-api.ts';
import type {ResultReviewBuffers} from './result-review-write-api.ts';
import type {ResultReworkBuffers} from './result-rework-write-api.ts';
import type {ResultSubmissionBuffers} from './result-submission-write-api.ts';
import type {QueueCancellationStorage} from './stage-queue-api.ts';
import type {StageStartStorage} from './stage-start-api.ts';
import type {UnderstandingReviewStorage} from './understanding-review-write.ts';
import {CriteriaDraftFiles} from './CriteriaDraftFiles.tsx';
import {CriteriaReadbackUnconfirmed,criteriaRows,prepareCriteriaRegistration,prepareCriteriaRevision,saveCriteriaRegistration,resultTestKinds,type CriteriaInput,type CriteriaRow,type CriteriaRegistration,type RegisteredCriteria} from './result-criteria-api.ts';
import {ordered} from '../knowledge/review-view.ts';
export interface CriteriaBuffer{base?:RegisteredCriteria;items?:CriteriaInput['items'];savedHistory?:RegisteredCriteria[];bindingId:string;ownerUserId:string;ownerClientId:string;assignmentRef:ConfirmedAssignmentView['ref'];controlGeneration:number;rows:CriteriaRow[];reason:string;pending:CriteriaRegistration|null;stored:RegisteredCriteria|null;dirty:boolean;uncertain:boolean;failure:{code:string;status:number}|null}
export interface CriteriaEditorProps{session:DocumentSession;buffer:CriteriaBuffer|null;onChange:(change:CriteriaBuffer|((value:CriteriaBuffer|null)=>CriteriaBuffer|null))=>void;reviews?:ResultReviewBuffers;reworks?:ResultReworkBuffers;submissions?:ResultSubmissionBuffers;stageQueue?:QueueCancellationStorage;stageStart?:StageStartStorage;understanding?:UnderstandingReviewStorage}
/** App 메모리의 주체·임무별 초안/미확인 명령을 소비한다. localStorage/Secret 저장은 하지 않는다. */
export function ResultCriteriaEditor({client,assignment,session,buffer,onChange,onAuthenticationLost,onAccessUnavailable}:{client:ApiClient;assignment:ConfirmedAssignmentView;onAuthenticationLost:()=>void;onAccessUnavailable:(code:string)=>void}&CriteriaEditorProps){
 const [busy,setBusy]=useState(false),[failure,setFailure]=useState<string|null>(null),live=useRef(true),working=useRef(false);useEffect(()=>{live.current=true;return()=>{live.current=false;};},[]);
 const bound=buffer&&buffer.ownerUserId===session.user.id&&buffer.ownerClientId===session.clientId&&buffer.assignmentRef.id===assignment.ref.id&&buffer.assignmentRef.version===assignment.ref.version&&buffer.assignmentRef.contentHash===assignment.ref.contentHash?buffer:null,d=assignment.snapshot.definition,canCreate=!!d.environmentRef&&d.baselineRefs.length>0&&d.acceptanceCriteria.length>0&&d.verificationRequirements.length>0;
 const epoch=useRef(0),identity=useRef<{client:ApiClient;key:string}|null>(null),identityKey=ordered([session.user.id,session.clientId,assignment.projectId,assignment.ref,bound?.bindingId??null,bound?.controlGeneration??null]);
 if(identity.current?.client!==client||identity.current.key!==identityKey){epoch.current++;identity.current={client,key:identityKey};}
 const latest=useRef({client,session,assignment,buffer,bound});latest.current={client,session,assignment,buffer,bound};
 const change=(next:CriteriaBuffer,expected:CriteriaBuffer|null=bound)=>onChange(current=>current&&expected&&ordered(current)===ordered(expected)?next:current);
 const edit=(field:'reason'|'rows'|'items',value:string|CriteriaRow[]|CriteriaInput['items'])=>{if(!bound||bound.pending||bound.stored||working.current)return;setFailure(null);change({...bound,[field]:value,dirty:true,failure:null});};
 async function run(mode:'CREATE'|'PREPARE'|'SAVE'|'REBIND'){
  if(working.current)return;working.current=true;setBusy(true);setFailure(null);const b=bound;let attempted=false,expected=b;const context=latest.current,requestEpoch=epoch.current;
  const active=()=>{const now=latest.current;return live.current&&epoch.current===requestEpoch&&now.client===context.client&&now.session.user.id===context.session.user.id&&now.session.clientId===context.session.clientId&&ordered(now.assignment)===ordered(context.assignment)&&(!b?now.buffer===context.buffer:now.bound?.bindingId===b.bindingId&&now.bound.controlGeneration===b.controlGeneration&&ordered(now.bound.pending)===ordered(b.pending));};
  try{
   const generation=await documentControl(client,assignment.projectId,session);if(!active())return;
   if(mode==='CREATE'){if(!canCreate||b)return;onChange(current=>current===null?{bindingId:crypto.randomUUID(),ownerUserId:session.user.id,ownerClientId:session.clientId,assignmentRef:structuredClone(assignment.ref),controlGeneration:generation,rows:criteriaRows(assignment),reason:'',pending:null,stored:null,dirty:false,uncertain:false,failure:null}:current);return;}
   if(mode==='REBIND'){if(!b||b.pending||b.uncertain||b.stored)throw new ApiError('RESULT_CRITERIA_BINDING_INVALID');change({...b,controlGeneration:generation,failure:null});return;}
   if(!b||b.stored||generation!==b.controlGeneration)throw new ApiError('PROJECT_CONTROL_CHANGED',409);
   if(mode==='PREPARE'){if(b.pending||b.uncertain)return;const pending=b.base?await prepareCriteriaRevision(assignment,b.base,b.items!,b.reason,session,generation):await prepareCriteriaRegistration(assignment,b.rows,b.reason,session,generation);if(active())change({...b,pending,failure:null},b);return;}
   if(!b.pending)return;attempted=true;expected={...b,uncertain:true,failure:null};change(expected,b);const stored=await saveCriteriaRegistration(client,b.pending,session,active);if(active()&&stored)change({...b,stored,dirty:false,uncertain:false,failure:null},expected);
  }catch(cause){if(!active())return;const error=cause instanceof ApiError?cause:new ApiError('RESULT_CRITERIA_INPUT_INVALID'),safe=/^[A-Z_]{1,80}$/.test(error.code)?error.code:'RESULT_CRITERIA_INPUT_INVALID';setFailure(safe);if(b)change({...b,failure:{code:safe,status:error.status},uncertain:b.uncertain||attempted&&(error instanceof CriteriaReadbackUnconfirmed||!isKnownDocumentRejection(error))},expected);if([401,403,404].includes(error.status))onAccessUnavailable(safe);if(error.status===401)onAuthenticationLost();}
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
  <CriteriaDraftFiles key={[assignment.projectId,assignment.ref.id,assignment.ref.version,assignment.ref.contentHash,session.user.id,session.clientId].join(':')} client={client} assignment={assignment} session={session} draft={bound} canImport={canCreate&&!buffer} canExport={!!bound&&!bound.base&&!bound.pending&&!bound.uncertain&&!bound.stored} disabled={busy} onRestore={(value,generation)=>onChange(current=>current===null?{bindingId:crypto.randomUUID(),ownerUserId:session.user.id,ownerClientId:session.clientId,assignmentRef:structuredClone(assignment.ref),controlGeneration:generation,rows:value.rows,reason:value.reason,pending:null,stored:null,dirty:true,uncertain:false,failure:null}:current)} onAccessUnavailable={onAccessUnavailable} onAuthenticationLost={onAuthenticationLost}/>
  {bound?.base?<p role="status">개정 모드 · 입력 파일 v1은 최초 등록 전용이므로 가져오기/내보내기를 사용할 수 없습니다. 정확 baseRef와 다중 원조건 보존을 위해 파일을 만들지 않습니다.</p>:null}
  {!bound?<button type="button" disabled={busy||!canCreate||!!buffer} onClick={()=>void run('CREATE')}>검수 기준 작성</button>:<>
   <p>필수 원조건 전체 포함 · 환경 {d.environmentRef?.id} v{d.environmentRef?.version}</p>
{!bound.base?bound.rows.map((row,index)=><fieldset key={row.field+':'+row.index} disabled={frozen}><legend>{row.field==='acceptanceCriteria'?'완료 조건':'검증 조건'} {row.index+1}</legend><p>{d[row.field][row.index]}</p><label>기준 ID {index+1}<input value={row.criterionId} maxLength={80} onChange={e=>edit('rows',bound.rows.map((v,i)=>i===index?{...v,criterionId:e.target.value}:v))}/></label><label>시험 ID {index+1}<input value={row.testId} maxLength={80} onChange={e=>edit('rows',bound.rows.map((v,i)=>i===index?{...v,testId:e.target.value}:v))}/></label><label>시험 종류 {index+1}<select aria-label={'시험 종류 '+(index+1)} value={row.kind} onChange={e=>edit('rows',bound.rows.map((v,i)=>i===index?{...v,kind:e.target.value}:v))}><option value="">직접 선택</option>{resultTestKinds.map(k=><option key={k} value={k}>{k}</option>)}</select></label></fieldset>):bound.items!.map((item,index)=><fieldset key={index} disabled={frozen}><legend>개정 기준 {index+1}</legend><p>개정 원본 {bound.base!.ref.id} v{bound.base!.ref.version} · 환경 {item.environmentRef.id} v{item.environmentRef.version}</p><ul>{item.sources.map(source=><li key={source.field+':'+source.index}>{source.field==='acceptanceCriteria'?'완료 조건':'검증 조건'} {source.index+1}: {d[source.field][source.index]} · {source.contentHash}</li>)}</ul><label>기준 ID {index+1}<input maxLength={80} value={item.criterionId} onChange={e=>edit('items',bound.items!.map((v,i)=>i===index?{...v,criterionId:e.target.value}:v))}/></label><label>시험 ID {index+1}<input maxLength={80} value={item.testId} onChange={e=>edit('items',bound.items!.map((v,i)=>i===index?{...v,testId:e.target.value}:v))}/></label><label>시험 종류 {index+1}<select aria-label={'시험 종류 '+(index+1)} value={item.kind} onChange={e=>edit('items',bound.items!.map((v,i)=>i===index?{...v,kind:e.target.value}:v))}><option value="">직접 선택</option>{resultTestKinds.map(k=><option key={k} value={k}>{k}</option>)}</select></label></fieldset>)}
   <label>기준 등록 이유<textarea disabled={frozen} maxLength={20000} value={bound.reason} onChange={e=>edit('reason',e.target.value)}/></label>
   {!bound.pending&&!bound.stored?<><button type="button" disabled={busy||bound.uncertain} onClick={()=>void run('PREPARE')}>검수 기준 저장 준비</button><button type="button" disabled={busy||bound.uncertain} onClick={()=>void run('REBIND')}>현재 제어로 미전송 입력 재결박</button></>:null}
   {bound.pending&&!bound.stored?<><details><summary>저장할 고정 명령·원조건 매핑</summary><pre>{JSON.stringify(bound.pending.command,null,2)}</pre></details><button type="button" disabled={busy} onClick={()=>void run('SAVE')}>{bound.failure||bound.uncertain?'같은 기준 저장 명령 재확인':'검수 기준 명시 저장'}</button>{!bound.uncertain&&isKnownDocumentRejection(bound.failure)?<button type="button" disabled={busy} onClick={()=>change({...bound,pending:null,failure:null,dirty:true})}>확인된 거절 이후 입력 수정</button>:null}</>:null}
   {bound.pending&&!bound.stored&&!bound.uncertain&&!bound.failure?<button type="button" disabled={busy} onClick={releaseUnsentPreparation}>미전송 기준 저장 준비 해제</button>:null}
   {bound.uncertain?<p role="status">저장 결과 미확인 · 입력/명령을 보존했습니다. 새 명령을 만들지 않고 같은 명령으로만 확인하세요.</p>:null}
   {bound.stored?<div><p>등록 원문 확인 완료 · 검수 합격/적용/실행 허가 아님</p><p>{bound.stored.ref.id} · v{bound.stored.ref.version} · {bound.stored.ref.contentHash}</p><details><summary>저장된 기준 원문</summary><pre>{JSON.stringify(bound.stored,null,2)}</pre></details><p>보관 기준 목록의 정확 원문을 선택해 새 개정을 시작할 수 있습니다. 합격 판정·보완 실행은 미연결입니다.</p></div>:null}
  </>}
  {failure||bound?.failure?<p role="alert">{failure??bound?.failure?.code} · 저장 완료로 표시하지 않습니다.</p>:null}
  {busy?<p role="status">현재 제어·입력·정확 저장 결과 확인 중</p>:null}<p className="meta">입력과 미확인 명령은 화면 이동 중 메모리에 보존됩니다. 미전송 입력은 명시 파일 저장/불러오기를 이용할 수 있으나, 미확인 명령은 파일 복원하거나 자동 재발행하지 않습니다. 새로고침·종료로 미확인 명령을 잃으면 서버 적용 여부를 먼저 확인해야 합니다.</p>
 </section>;
}
