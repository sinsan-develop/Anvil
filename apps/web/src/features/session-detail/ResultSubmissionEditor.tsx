import {useEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import {documentControl,type DocumentSession} from '../design-trace/editor-api.ts';
import {isKnownDocumentRejection} from '../design-trace/mutation-result.ts';
import type {ConfirmedAssignmentView} from '../workspace/assignment-confirmation-api.ts';
import {prepareResultSubmissionFile,prepareResultSubmitCommand,sendResultSubmission,resultSubmissionKey,type ResultSubmissionBuffers} from './result-submission-write-api.ts';
import {ManualResultReportForm} from './ManualResultReportForm.tsx';

export function ResultSubmissionEditor({client,assignment,session,storage,onStored,onAuthenticationLost}:{client:ApiClient;assignment:ConfirmedAssignmentView;session:DocumentSession;storage:ResultSubmissionBuffers;onStored:()=>void;onAuthenticationLost:()=>void}){
 const key=resultSubmissionKey(session,assignment.projectId,assignment.ref),buffer=storage.buffers[key]??null;
 const [busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),[ack,setAck]=useState(false),live=useRef(true),flight=useRef(false),latest=useRef(buffer);latest.current=buffer;
 useEffect(()=>{live.current=true;return()=>{live.current=false;};},[]);
 useEffect(()=>{setAck(false);},[buffer?.bindingId]);
 const active=(id:string|null)=>live.current&&(latest.current?.bindingId??null)===id;
 async function run(action:()=>Promise<void>){if(flight.current)return;flight.current=true;setBusy(true);setError(null);try{await action();}catch(cause){if(live.current){const failure=cause instanceof ApiError?cause:new ApiError('RESULT_SUBMISSION_FILE_INVALID');setError(failure.code);if(failure.status===401)onAuthenticationLost();}}finally{flight.current=false;if(live.current)setBusy(false);}}
 async function choose(file:File){
  if(buffer||file.size<1||file.size>2*1024*1024)throw new ApiError('RESULT_SUBMISSION_FILE_INVALID');
  const bytes=new Uint8Array(await file.arrayBuffer());if(!active(null))return;
  const generation=await documentControl(client,assignment.projectId,session);if(!active(null))return;
  const value=await prepareResultSubmissionFile(bytes,assignment.projectId,assignment.ref,session,generation);if(active(null))storage.onChange(key,old=>old===null?value:old);
 }
 async function save(){
  if(!buffer||buffer.result)return;const chosen=buffer,wasUnknown=!!chosen.pending&&chosen.uncertain;
  try{
   const generation=await documentControl(client,assignment.projectId,session);if(!active(chosen.bindingId))return;
   if(generation!==chosen.controlGeneration)throw new ApiError('CONTROL_GENERATION_CONFLICT',409);
   const command=await prepareResultSubmitCommand(chosen,session,!!chosen.pending||ack);if(!active(chosen.bindingId))return;
   const staged={...chosen,pending:command,uncertain:true,failure:null};storage.onChange(key,current=>current?.bindingId===chosen.bindingId?staged:current);
   const result=await sendResultSubmission(client,staged,session,()=>active(chosen.bindingId));if(!active(chosen.bindingId))return;
   storage.onChange(key,current=>current?.bindingId===chosen.bindingId&&current.pending?.commandId===command.commandId?{...current,result,pending:null,uncertain:false,dirty:false,failure:null}:current);onStored();
  }catch(cause){
   if(!active(chosen.bindingId))return;const failure=cause instanceof ApiError?cause:new ApiError('RESULT_SUBMISSION_RESPONSE_INVALID');
   storage.onChange(key,current=>current?.bindingId===chosen.bindingId?{...current,failure:{code:failure.code,status:failure.status},uncertain:wasUnknown||!!current.pending&&!isKnownDocumentRejection(failure)}:current);throw failure;
  }
 }
 function clear(){if(busy||!buffer||buffer.pending||buffer.uncertain)return;if(confirm('이 화면의 결과 준비 입력을 비울까요? 원래 선택 파일과 서버 보관 자료는 삭제하지 않습니다.'))storage.onChange(key,current=>current?.bindingId===buffer.bindingId&&!current.pending&&!current.uncertain?null:current);}
 return <section aria-label="결과 제출 파일 등록"><h4>결과 보고 등록</h4><p className="meta">화면 작성 또는 기존 scope·manifest JSON 파일을 읽고 별도 저장합니다. 최대 2MiB UTF-8. 등록 준비 원문과 해시는 화면 메모리에 보존하며 서버에는 정규화된 제출 내용만 저장합니다. 파일의 실행·시험·출처·COMPLETED는 제출자 주장이고 실제 실행·검수 합격이 아닙니다.</p>
  {error?<p role="alert">{error} · 원문·미확인 명령을 자동 교체하지 않습니다.</p>:null}
  {storage.manual?<ManualResultReportForm client={client} assignment={assignment} session={session} storage={storage.manual} occupied={busy||!!buffer} onPrepared={value=>{if(!active(null)||flight.current)return;storage.onChange(key,old=>old??value);}} onAuthenticationLost={onAuthenticationLost}/>:null}
  <label>결과 제출 JSON 파일<input type="file" accept=".json,application/json" disabled={busy||!!buffer} onChange={event=>{const file=event.target.files?.[0];event.target.value='';if(file)void run(()=>choose(file));}}/></label>
  {busy?<p role="status">결과 제출 내용 처리 중</p>:null}
  {buffer?<><p>제출 원문 SHA-256 {buffer.fileHash}</p><p>제출 상태 주장: {buffer.manifest.submissionState} · 실행 참조는 제출자 선언이며 서버가 저장 당시 다시 대조합니다.</p><p>실행 {buffer.scope.executionRef.id} · v{buffer.scope.executionRef.version} · {buffer.scope.executionRef.contentHash}</p><details><summary>등록 준비 JSON 원문</summary><pre aria-label="결과 제출 파일 원문">{buffer.fileText}</pre></details>
   <label><input type="checkbox" checked={ack} disabled={busy||!!buffer.pending||!!buffer.result} onChange={e=>setAck(e.target.checked)}/>제출자 주장만 등록하며 검수·완료 판정이나 실행 허가가 아님을 확인합니다</label>
   {buffer.result?<p role="status">결과 제출 등록 영수증 확인 · 완료 아님 · 제출 ID {buffer.result.submissionId}</p>:<button type="button" disabled={busy||!buffer.pending&&!ack} onClick={()=>void run(save)}>{buffer.pending?'같은 결과 제출 명령 결과 확인':'결과 제출 내용 등록'}</button>}
   {buffer.pending&&buffer.failure&&!buffer.uncertain?<button type="button" disabled={busy} onClick={()=>{if(confirm('이 명령의 미적용 거절을 확인했습니다. 원 입력은 보존하고 다시 준비할까요?'))storage.onChange(key,current=>current?.bindingId===buffer.bindingId&&!current.uncertain?{...current,pending:null,failure:null}:current);}}>결과 제출 거절 확인 후 준비로 돌아가기</button>:null}
   {!buffer.pending&&!buffer.uncertain?<button type="button" disabled={busy} onClick={clear}>결과 준비 입력 비우기</button>:null}
  </>:null}
 </section>;
}
