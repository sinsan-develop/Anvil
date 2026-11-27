import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import {documentControl,type DocumentSession} from '../design-trace/editor-api.ts';
import {isKnownDocumentRejection} from '../design-trace/mutation-result.ts';
import type {ConfirmedAssignmentView} from '../workspace/assignment-confirmation-api.ts';
import {prepareResultSubmissionFile,prepareResultSubmitCommand,sendResultSubmission,resultSubmissionKey,type ResultSubmissionBuffer,type ResultSubmissionBuffers} from './result-submission-write-api.ts';
import {ManualResultReportForm} from './ManualResultReportForm.tsx';
import {ordered} from '../knowledge/review-view.ts';

export function ResultSubmissionEditor({client,assignment,session,storage,onStored,onAuthenticationLost}:{client:ApiClient;assignment:ConfirmedAssignmentView;session:DocumentSession;storage:ResultSubmissionBuffers;onStored:()=>void;onAuthenticationLost:()=>void}){
 const key=resultSubmissionKey(session,assignment.projectId,assignment.ref),buffer=storage.buffers[key]??null;
 const [busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),[ack,setAck]=useState(false),[dispatchRevision,setDispatchRevision]=useState(0);
 const live=useRef(false),flight=useRef<object|null>(null),latest=useRef(buffer);latest.current=buffer;
 const sessionKey=()=>ordered([session.user.id,session.clientId,session.csrfToken,assignment.projectId,assignment.ref]);
 const sourceKey=sessionKey(),route=globalThis.location?.hash;
 const scope=useRef({client,transport:client.transport,key:sourceKey,route});
 if(scope.current.client!==client||scope.current.transport!==client.transport||scope.current.key!==sourceKey||scope.current.route!==route)scope.current={client,transport:client.transport,key:sourceKey,route};
 const observed=scope.current,currentScope=()=>live.current&&scope.current===observed&&client.transport===observed.transport&&sourceKey===sessionKey()&&route===globalThis.location?.hash;
 const contextKey=ordered([session.user.id,session.clientId,session.csrfToken,assignment.projectId,assignment.ref,buffer?.bindingId??null,buffer?.controlGeneration??null]);
 const attempt=useRef(0),revision=useRef(0),context=useRef({client,transport:client.transport,buffer,key:contextKey}),current=useRef({client,session,assignment,buffer,busy});current.current={client,session,assignment,buffer,busy};
 if(context.current.client!==client||context.current.transport!==client.transport||context.current.buffer!==buffer||context.current.key!==contextKey){revision.current++;context.current={client,transport:client.transport,buffer,key:contextKey};}
 type CommitAck={next:ResultSubmissionBuffer;active:()=>boolean;resolve:(ok:boolean)=>void};
 const acknowledgements=useRef<CommitAck[]>([]);
 useLayoutEffect(()=>{
  live.current=true;setBusy(false);setError(null);setAck(false);
  return()=>{live.current=false;flight.current=null;for(const waiting of acknowledgements.current)waiting.resolve(false);acknowledgements.current=[];};
 },[observed]);
 useLayoutEffect(()=>{
  const waiting=acknowledgements.current;acknowledgements.current=[];
  for(const a of waiting)a.resolve(buffer===a.next&&a.active());
 },[buffer,observed,dispatchRevision]);
 useEffect(()=>{setAck(false);},[buffer?.bindingId]);
 async function run(action:(active:()=>boolean)=>Promise<void>){
  if(flight.current||!currentScope())return;
  const ticket={};attempt.current++;flight.current=ticket;setBusy(true);setError(null);
  const active=()=>currentScope()&&flight.current===ticket;
  try{await action(active);}
  catch(cause){if(active()){const failure=cause instanceof ApiError?cause:new ApiError('RESULT_SUBMISSION_FILE_INVALID');setError(failure.code);if(failure.status===401)onAuthenticationLost();}}
  finally{if(flight.current===ticket){flight.current=null;if(currentScope())setBusy(false);}}
 }
 async function choose(file:File,active:()=>boolean){
  const available=()=>active()&&latest.current===null;
  if(buffer||file.size<1||file.size>2*1024*1024)throw new ApiError('RESULT_SUBMISSION_FILE_INVALID');
  const bytes=new Uint8Array(await file.arrayBuffer());if(!available())return;
  const generation=await documentControl(client,assignment.projectId,session);if(!available())return;
  const value=await prepareResultSubmissionFile(bytes,assignment.projectId,assignment.ref,session,generation);
  if(available())storage.onChange(key,old=>old===null&&currentScope()?value:old);
 }
 async function save(active:()=>boolean){
  if(!buffer||buffer.result)return;const chosen=buffer,wasUnknown=!!chosen.pending&&chosen.uncertain;
  let expected=chosen,fingerprint=ordered(chosen),started=false;
  const dispatch:{latch:{next:ResultSubmissionBuffer;fingerprint:string}|null}={latch:null};
  const owned=()=>active()&&latest.current===expected&&ordered(expected)===fingerprint;
  async function commit(next:ResultSubmissionBuffer){
   if(!owned())return false;
   const previous=expected,body=fingerprint,updated=ordered(next);
   let accepted=false;
   const committed=await new Promise<boolean>(resolve=>{
    const waiting:CommitAck={next,active,resolve:ok=>{accepted=ok;resolve(ok);}};
    acknowledgements.current.push(waiting);
    storage.onChange(key,value=>value===previous&&ordered(value)===body&&
      (accepted||acknowledgements.current.includes(waiting)&&owned())?next:value);
    setDispatchRevision(value=>value+1);
   });
   if(!committed||!active()||latest.current!==next||ordered(next)!==updated)return false;
   expected=next;fingerprint=updated;
   return owned();
  }
  try{
   if(!owned())return;
   const generation=await documentControl(client,assignment.projectId,session);if(!owned())return;
   if(generation!==chosen.controlGeneration)throw new ApiError('CONTROL_GENERATION_CONFLICT',409);
   const command=await prepareResultSubmitCommand(chosen,session,!!chosen.pending||ack);if(!owned())return;
   const staged={...chosen,pending:command,uncertain:true,failure:null};
   const result=await sendResultSubmission(client,staged,session,owned,{
    commit:async()=>{dispatch.latch={next:staged,fingerprint:ordered(staged)};return commit(staged);},
    started:()=>{started=true;}
   });
   if(await commit({...staged,result,pending:null,uncertain:false,dirty:false,failure:null})&&owned())onStored();
  }catch(cause){
   if(!owned())return;
   const failure=cause instanceof ApiError?cause:new ApiError('RESULT_SUBMISSION_RESPONSE_INVALID');
   if(!started&&failure.code==='RESULT_SUBMISSION_PAUSED')throw failure;
   const failed={...expected,failure:{code:failure.code,status:failure.status},uncertain:wasUnknown||started&&!isKnownDocumentRejection(failure)};
   if(await commit(failed)&&owned())throw failure;
  }finally{
   const unissued=dispatch.latch;
   if(!started&&unissued)storage.onChange(key,value=>value===unissued.next&&ordered(value)===unissued.fingerprint?chosen:value);
  }
 }
 function release(rejected:boolean){
  if(busy||flight.current||!buffer||buffer.uncertain|| (rejected? !buffer.pending||!buffer.failure:!!buffer.pending))return;
  const chosen=buffer,pending=chosen.pending,original=ordered([session,assignment,chosen]),transport=client.transport,turn=attempt.current,stamp=revision.current;
  const owns=()=>{const now=current.current;return currentScope()&&!flight.current&&!now.busy&&attempt.current===turn&&revision.current===stamp&&now.client===client&&now.client.transport===transport&&now.buffer===chosen&&chosen.pending===pending&&!chosen.uncertain&&chosen.ownerUserId===now.session.user.id&&chosen.ownerClientId===now.session.clientId&&chosen.projectId===now.assignment.projectId&&ordered(chosen.assignmentRef)===ordered(now.assignment.ref)&&ordered([now.session,now.assignment,chosen])===original;};
  if(!owns()||!confirm(rejected?'이 명령의 미적용 거절을 확인했습니다. 원 입력은 보존하고 다시 준비할까요?':'이 화면의 결과 준비 입력을 비울까요? 원래 선택 파일과 서버 보관 자료는 삭제하지 않습니다.')||!owns())return;
  storage.onChange(key,value=>value===chosen&&owns()?(rejected?{...value,pending:null,failure:null}:null):value);
 }
 return <section aria-label="결과 제출 파일 등록"><h4>결과 보고 등록</h4><p className="meta">화면 작성 또는 기존 scope·manifest JSON 파일을 읽고 별도 저장합니다. 최대 2MiB UTF-8. 등록 준비 원문과 해시는 화면 메모리에 보존하며 서버에는 정규화된 제출 내용만 저장합니다. 파일의 실행·시험·출처·COMPLETED는 제출자 주장이고 실제 실행·검수 합격이 아닙니다.</p>
  {error?<p role="alert">{error} · 원문·미확인 명령을 자동 교체하지 않습니다.</p>:null}
  {storage.manual?<ManualResultReportForm client={client} assignment={assignment} session={session} storage={storage.manual} occupied={busy||!!buffer} onPrepared={value=>{if(!currentScope()||latest.current!==null||flight.current)return;storage.onChange(key,old=>old??value);}} onAuthenticationLost={onAuthenticationLost}/>:null}
  <label>결과 제출 JSON 파일<input type="file" accept=".json,application/json" disabled={busy||!!buffer} onChange={event=>{const file=event.target.files?.[0];event.target.value='';if(file)void run(active=>choose(file,active));}}/></label>
  {busy?<p role="status">결과 제출 내용 처리 중</p>:null}
  {buffer?<><p>제출 원문 SHA-256 {buffer.fileHash}</p><p>제출 상태 주장: {buffer.manifest.submissionState} · 실행 참조는 제출자 선언이며 서버가 저장 당시 다시 대조합니다.</p><p>실행 {buffer.scope.executionRef.id} · v{buffer.scope.executionRef.version} · {buffer.scope.executionRef.contentHash}</p><details><summary>등록 준비 JSON 원문</summary><pre aria-label="결과 제출 파일 원문">{buffer.fileText}</pre></details>
   <label><input type="checkbox" checked={ack} disabled={busy||!!buffer.pending||!!buffer.result} onChange={e=>setAck(e.target.checked)}/>제출자 주장만 등록하며 검수·완료 판정이나 실행 허가가 아님을 확인합니다</label>
   {buffer.result?<p role="status">결과 제출 등록 영수증 확인 · 완료 아님 · 제출 ID {buffer.result.submissionId}</p>:<button type="button" disabled={busy||!buffer.pending&&!ack} onClick={()=>void run(save)}>{buffer.pending?'같은 결과 제출 명령 결과 확인':'결과 제출 내용 등록'}</button>}
   {buffer.pending&&buffer.failure&&!buffer.uncertain?<button type="button" disabled={busy} onClick={()=>release(true)}>결과 제출 거절 확인 후 준비로 돌아가기</button>:null}
   {!buffer.pending&&!buffer.uncertain?<button type="button" disabled={busy} onClick={()=>release(false)}>결과 준비 입력 비우기</button>:null}
  </>:null}
 </section>;
}
