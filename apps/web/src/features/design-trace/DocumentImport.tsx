import{QuarantinedOriginalNotice}from'./QuarantinedOriginalNotice.tsx';
import{isConfirmedArtifactQuarantine,documentFailure}from'./mutation-result.ts';
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { ApiClient, ApiError } from '../../api/client.ts';
import type { DocumentBuffer, DocumentSession } from './editor-api.ts';
import { adoptDocumentImport, continueDocumentImport, prepareDocumentImport, preparePngAttachmentImport, prepareCreatedOriginalImport, refreshCreatedOriginalImport, matchesDocumentImportTarget, rejectedDocumentImport, type DocumentImportBuffer, type UploadDocumentImportBuffer, type CreatedOriginalImportBuffer } from './import-api.ts';
import {ImportedPngAttachment} from './ImportedPngAttachment.tsx';
import type {CreatedOriginalSelection} from '../../shell/routes.ts';

type ImportProps={client:ApiClient;session:DocumentSession;buffer:DocumentBuffer;onChange:Dispatch<SetStateAction<DocumentBuffer|null>>;onAuthenticationLost:()=>void;disabled?:boolean;createdOriginal?:CreatedOriginalSelection};
export function DocumentImport(props:ImportProps){
 const state=props.buffer.importState;
 if(state?.source==='CREATED_ORIGINAL'||props.createdOriginal&&!state)return <CreatedOriginalDocumentImport {...props}/>;
 return <UploadedDocumentImport {...props}/>;
}
function UploadedDocumentImport({ client, session, buffer, onChange, onAuthenticationLost, disabled = false }: ImportProps) {
  const [busy, setBusy] = useState(false), [error, setError] = useState<ApiError | null>(null), [acknowledged, setAcknowledged] = useState(false);
  const running = useRef(false), mounted = useRef(true), latest=useRef(buffer), state = buffer.importState as UploadDocumentImportBuffer|null|undefined, attachmentOnly=buffer.documentId!==null;latest.current=buffer;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  function sameTarget(b:DocumentBuffer|null):b is DocumentBuffer{return !!b&&b.ownerUserId===session.user.id&&b.projectId===buffer.projectId&&b.documentId===buffer.documentId&&b.baseVersion===buffer.baseVersion&&b.baseHash===buffer.baseHash&&b.controlGeneration===buffer.controlGeneration;}
  function update(value: DocumentImportBuffer) { if(value.source==='CREATED_ORIGINAL')return;onChange(b => sameTarget(b) && matchesDocumentImportTarget(b,value) && !b.pending && b.importState?.attemptId===value.attemptId && b.importState?.upload?.commandId === value.upload.commandId ? { ...b, importState: value, dirty: true } : b); }
  function failed(cause: unknown) { const e = cause instanceof ApiError ? cause : new ApiError('IMPORT_INPUT_INVALID'); if (mounted.current) { setError(e); if (e.status === 401) onAuthenticationLost(); } return e; }
  async function select(file: File | undefined) {
    if (!file || disabled || running.current || state || buffer.pending || buffer.importPreparationId || buffer.ownerUserId !== session.user.id) return;
    running.current = true; setBusy(true); setError(null); setAcknowledged(false);
    const preparationId = crypto.randomUUID();
    onChange(b => b === buffer && !b.pending && !b.importState && !b.importPreparationId ? { ...b, importPreparationId: preparationId, dirty: true } : b);
    try {
      if (file.size > (attachmentOnly?2097152:20 * 1024 * 1024)) throw new ApiError('IMPORT_FILE_TOO_LARGE');
      if(attachmentOnly&&!file.name.toLowerCase().endsWith('.png'))throw new ApiError('IMPORT_INPUT_INVALID');
      const value = await (attachmentOnly?preparePngAttachmentImport:prepareDocumentImport)(buffer, session, { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) });
      onChange(b => sameTarget(b) && b.importPreparationId === preparationId && matchesDocumentImportTarget(b,value) && !b.pending && !b.importState ? { ...b, importPreparationId: null, importState: value, dirty: true } : b);
    } catch (cause) { failed(cause); onChange(b => b?.importPreparationId === preparationId ? { ...b, importPreparationId: null } : b); } finally { running.current = false; if (mounted.current) setBusy(false); }
  }
  async function create() {
    if (!state || disabled || state.candidate || running.current) return;
    running.current = true; setBusy(true); setError(null); const priorUncertain=state.uncertain,pending = { ...state, attempted: true, uncertain:true,attemptId:crypto.randomUUID(),failure: null }; onChange(b=>sameTarget(b)&&b.importState===state?{...b,importState:pending,dirty:true}:b);
    try { update(await continueDocumentImport(client, pending, buffer.formRef, session, update, () => mounted.current&&sameTarget(latest.current)&&latest.current.importState?.upload?.commandId===state.upload.commandId&&latest.current.importState.attemptId===pending.attemptId)); }
    catch (cause) { const e=failed(cause),failure=documentFailure(e),uncertain=isConfirmedArtifactQuarantine(e)?false:priorUncertain||!rejectedDocumentImport({...pending,uncertain:false,failure}); onChange(b=>sameTarget(b)&&b.importState?.upload?.commandId===state.upload.commandId&&b.importState.attemptId===pending.attemptId?{...b,importState:{...b.importState,uncertain,failure}}:b); }
    finally { running.current = false; if (mounted.current) setBusy(false); }
  }
  async function adopt() {
    if (!state?.candidate || disabled || !acknowledged || running.current) return;
    running.current = true; setBusy(true); setError(null);
    try {
      const value = await adoptDocumentImport(client, buffer, session);
      if (mounted.current) onChange(b => b?.importState?.upload?.commandId === state.upload.commandId ? value : b);
    } catch (cause) { failed(cause); } finally { running.current = false; if (mounted.current) setBusy(false); }
  }
  let preview: string | null = null;
  if (!attachmentOnly&&state?.candidate?.status === 'READY') { try { preview = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(state.bytes); } catch { /* 손실 변환 없이 후보 오류를 표시한다. */ } }
  return <section aria-label="원본 문서 가져오기" className="status-card"><h3>{attachmentOnly?'새 PNG 첨부 원본 보관':'원본 문서 가져오기'}</h3><p className="meta">{attachmentOnly?'기존 문서에는 PNG 2MiB 이하만 새 첨부로 보관할 수 있습니다. 현재 문서 버전·해시를 고정하고 본문/구버전은 바꾸지 않습니다.':'UTF-8 .txt/.md 본문은 최대 2MiB, 원본은 최대 20MiB입니다. 다른 형식은 원본만 보관합니다.'} 파일 선택만으로 업로드하거나 기존 입력을 바꾸지 않습니다.</p>
    {!state ? <><label htmlFor="document-import-file">{attachmentOnly?'첨부할 새 PNG 파일':'가져올 원본 파일'}</label><input id="document-import-file" type="file" accept={attachmentOnly?'.png,image/png':undefined} disabled={disabled || busy || !!buffer.pending || !!buffer.importPreparationId} onChange={e => { void select(e.target.files?.[0]); e.target.value = ''; }} />{buffer.importPreparationId ? <p role="status">파일을 읽는 동안 저장·교체를 잠시 보류합니다.</p> : null}</> : <>
      <p>{state.name} · {state.bytes.length} bytes</p>
      {!state.candidate ? <><button disabled={busy} onClick={() => { void create(); }}>{state.attempted ? '같은 가져오기 명령 결과 확인' : attachmentOnly?'PNG 원본 보관·후보 만들기':'원본 보관·가져오기 후보 만들기'}</button>{state.attempted ? <p>결과 확인 전에는 새 명령이나 파일 교체를 하지 않습니다.</p> : null}</> : <>
        <p role="status">가져오기 후보 {state.candidate.status} · {state.candidate.id}</p><p className="meta">원본 SHA256 {state.candidate.originalRef.contentHash} · {state.candidate.parserVersion ?? '지원 파서 없음'}</p>
        {state.candidate.issues.map((issue, i) => <p key={i}>{issue.code} · {issue.message}</p>)}
        <a href={`/api/v1/projects/${buffer.projectId}/files/${state.candidate.originalRef.artifactId}`} download>보관한 원본 다운로드</a>
        {preview !== null ? <><pre className="document-original" aria-label="가져오기 후보 원문">{preview}</pre><label><input type="checkbox" disabled={busy} checked={acknowledged} onChange={e => setAcknowledged(e.target.checked)} />원문을 확인했고 현재 편집 본문을 이 후보로 바꾸겠습니다</label><button disabled={busy || !acknowledged} onClick={() => { void adopt(); }}>이 후보로 초안 준비</button></> : <p>본문 반영 불가입니다. 원본 보존을 문서 추출 성공으로 취급하지 않습니다.</p>}
        {state.candidate.status==='UNSUPPORTED'&&state.candidate.originalRef.mediaType==='image/png'?<ImportedPngAttachment key={state.upload.commandId+':'+state.candidate.id} client={client} session={session} buffer={buffer} disabled={disabled||busy} onChange={onChange} onAuthenticationLost={onAuthenticationLost}/>:null}
      </>}
      {rejectedDocumentImport(state) ? <p>서버가 현재 명령을 거절했습니다. 가져오기만 닫아 기존 편집 입력으로 돌아갈 수 있습니다. 이미 보관된 원본은 삭제하지 않으며 다음 작업은 현재 권한/제어를 다시 확인해야 합니다.</p> : null}
      {!state.attempted || state.candidate || rejectedDocumentImport(state) ? <button disabled={busy} onClick={() => onChange(b => b?.importState?.upload?.commandId === state.upload.commandId ? { ...b, importState: null } : b)}>후보 선택 닫기</button> : null}
    </>}
    <QuarantinedOriginalNotice failure={state?.failure}/>{error || state?.failure ? <p role="alert">{error?.code ?? state?.failure?.code} · 원문과 기존 입력·명령을 보존했습니다.</p> : null}
  </section>;
}

function CreatedOriginalDocumentImport({client,session,buffer,onChange,onAuthenticationLost,disabled=false,createdOriginal}:ImportProps){
 const state=buffer.importState?.source==='CREATED_ORIGINAL'?buffer.importState:null,hint=createdOriginal??state?.original;
 const sameHint=!!hint&&(!state||state.original.draftId===hint.draftId&&state.original.artifactId===hint.artifactId);
 // 시도 객체를 바꿔 A→B→A에서도 이전 async 결과를 표시하지 않는다.
 const key=JSON.stringify([session.user.id,session.clientId,session.csrfToken,buffer.ownerUserId,buffer.projectId,buffer.documentId,buffer.baseVersion,buffer.baseHash,buffer.controlGeneration,buffer.formRef,buffer.stageNodeRef,buffer.title,buffer.body,buffer.reason,buffer.content,hint,disabled]);
 type Scope={client:ApiClient;key:string;generation:number;mounted:boolean;issued:WeakMap<DocumentBuffer,number>;sequence:number;observedSequence:number;observed:DocumentBuffer};
 const newScope=():Scope=>({client,key,generation:0,mounted:true,issued:new WeakMap([[buffer,0]]),sequence:0,observedSequence:0,observed:buffer});
 const scopeRef=useRef<Scope>(newScope());
 const previous=scopeRef.current,issuedSequence=previous.issued.get(buffer);
 // 내부 updater가 발급한 새 객체만 이어 받는다. 외부 교체/과거 객체 복귀는 같은 값이어도 이전 scope를 폐기한다.
 if(previous.client!==client||previous.key!==key||previous.observed!==buffer&&(issuedSequence===undefined||issuedSequence<=previous.observedSequence)){
  previous.mounted=false;previous.generation++;scopeRef.current=newScope();
 }else if(previous.observed!==buffer){previous.observed=buffer;previous.observedSequence=issuedSequence!;}
 const scope=scopeRef.current,latest=useRef(buffer);latest.current=buffer;
 const[observation,setObservation]=useState<{scope:Scope;generation:number;state:CreatedOriginalImportBuffer}|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState<ApiError|null>(null),[ack,setAck]=useState(false);
 const flight=useRef(false);
 useEffect(()=>{scope.mounted=true;setAck(false);setError(null);return()=>{scope.mounted=false;scope.generation++;};},[scope]);
 const current=(generation:number)=>scope.mounted&&scopeRef.current===scope&&scope.generation===generation;
 function issue(next:DocumentBuffer){scope.issued.set(next,++scope.sequence);return next;}
 const owned=buffer.ownerUserId===session.user.id&&buffer.documentId===null&&buffer.baseVersion===0&&!buffer.pending&&!buffer.proposalState&&!buffer.designIndexState&&!buffer.workPlanState&&!buffer.designDependencyState&&!buffer.formEntry;
 const bound=owned&&sameHint&&(!state||state.ownerUserId===session.user.id&&state.record.clientId===session.clientId&&state.record.projectId===buffer.projectId&&state.record.controlGeneration===buffer.controlGeneration&&JSON.stringify(state.record.payload.intendedFormRef)===JSON.stringify(buffer.formRef));
 const shown=bound&&state&&observation?.scope===scope&&observation.generation===scope.generation&&observation.state===state?state:null;
 function invalidate(cause:unknown){const e=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');scope.generation++;setObservation(null);setAck(false);setError(e);if(e.status===401)onAuthenticationLost();return e;}
 function sameBuffer(b:DocumentBuffer|null){return b!==null&&b.ownerUserId===buffer.ownerUserId&&b.projectId===buffer.projectId&&b.documentId===buffer.documentId&&b.baseVersion===buffer.baseVersion&&b.baseHash===buffer.baseHash&&b.controlGeneration===buffer.controlGeneration&&b.formRef===buffer.formRef&&b.title===buffer.title&&b.body===buffer.body&&b.reason===buffer.reason&&b.content===buffer.content&&b.stageNodeRef===buffer.stageNodeRef&&!b.pending;}
 async function read(){
  if(disabled||flight.current||!bound||!hint||buffer.importCandidateRef||buffer.importPreparationId)return;
  flight.current=true;setBusy(true);setObservation(null);setError(null);setAck(false);const generation=++scope.generation,captured=buffer,id=crypto.randomUUID();
  const accepted=new WeakSet<DocumentBuffer>([captured]);
  const active=()=>current(generation)&&accepted.has(latest.current)&&sameBuffer(latest.current)&&(!state?latest.current.importPreparationId===id||latest.current===captured:latest.current.importState===state);
  if(!state)onChange(b=>{if(!current(generation)||b!==captured||b.importState||b.importPreparationId)return b;const next=issue({...b,importPreparationId:id,dirty:true});accepted.add(next);return next;});
  try{
   if(state){await refreshCreatedOriginalImport(client,state,buffer.formRef,session,active);if(active())setObservation({scope,generation,state});}
   else{const next=await prepareCreatedOriginalImport(client,buffer,session,hint,active);if(!active())return;onChange(b=>active()&&sameBuffer(b)&&b&&accepted.has(b)&&b.importPreparationId===id&&!b.importState?issue({...b,importPreparationId:null,importState:next,dirty:true}):b);setObservation({scope,generation,state:next});}
  }catch(cause){if(current(generation))invalidate(cause);}
  // 표시 권한이 폐기돼도 같은 편집 대상에 남은 자기 준비 잠금만 정리한다. 새 작업 ID/다른 대상은 보존한다.
  finally{if(!state)onChange(b=>b&&b.importPreparationId===id&&b.ownerUserId===captured.ownerUserId&&b.projectId===captured.projectId&&b.documentId===captured.documentId&&b.baseVersion===captured.baseVersion&&b.baseHash===captured.baseHash?issue({...b,importPreparationId:null}):b);flight.current=false;setBusy(false);}
 }
 async function create(){
  if(disabled||flight.current||!shown||shown.candidate)return;
  flight.current=true;setBusy(true);setError(null);setAck(false);const generation=++scope.generation,commandId=shown.recordCommandId,attemptId=crypto.randomUUID(),pending={...shown,attempted:true,attemptId},priorUncertain=shown.uncertain;
  const accepted=new WeakSet<DocumentBuffer>([buffer]);
  const active=()=>current(generation)&&accepted.has(latest.current)&&sameBuffer(latest.current)&&latest.current.importState?.recordCommandId===commandId;
  const checkpoint=(value:CreatedOriginalImportBuffer)=>{onChange(b=>{if(!active()||!sameBuffer(b)||!b||!accepted.has(b)||b.importState?.recordCommandId!==commandId)return b;const next=issue({...b,importState:value,dirty:true});accepted.add(next);return next;});setObservation({scope,generation,state:value});};
  checkpoint(pending);
  try{const result=await continueDocumentImport(client,pending,buffer.formRef,session,checkpoint,active);if(active())checkpoint(result);}
  catch(cause){if(current(generation)){
   const e=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID'),failure=documentFailure(e);
   onChange(b=>scopeRef.current===scope&&scope.mounted&&sameBuffer(b)&&b&&accepted.has(b)&&b.importState?.recordCommandId===commandId&&b.importState.attemptId===attemptId?issue({...b,importState:{...b.importState,failure,uncertain:priorUncertain||!rejectedDocumentImport({...pending,uncertain:false,failure})}}):b);
   invalidate(e);
  }}finally{flight.current=false;setBusy(false);}
 }
 async function adopt(){
  if(disabled||flight.current||!shown||shown.candidate?.status!=='READY'||!ack)return;
  flight.current=true;setBusy(true);setError(null);const captured=buffer,generation=++scope.generation;setObservation(null);setAck(false);
  const active=()=>current(generation)&&latest.current===captured&&sameBuffer(latest.current);
  try{const next=await adoptDocumentImport(client,captured,session,active);if(active())onChange(b=>active()&&b===captured?issue(next):b);}
  catch(cause){if(current(generation))invalidate(cause);}finally{flight.current=false;setBusy(false);}
 }
 let preview:string|null=null;if(shown?.candidate?.status==='READY'){try{preview=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(shown.bytes);}catch{/* 손실 변환하지 않는다. */}}
 return <section aria-label="생성 자료 문서 가져오기" className="status-card"><h3>프로젝트 생성 자료 가져오기</h3><p className="meta">원 파일명은 저장되지 않았습니다. 현재 보호 원문을 확인한 뒤 후보를 만들며, 본문 채택과 문서 저장은 각각 별도입니다.</p>
  {!bound?<p>이전 편집·가져오기 입력을 보존했습니다. 원래 대상과 현재 양식·제어 상태를 확인한 뒤 이어가세요.</p>:!shown?<p>현재 보호 조회 전에는 보존한 원문 참조·본문·명령 결과를 표시하지 않습니다.</p>:null}
  <button type="button" disabled={disabled||busy||!bound||!!buffer.importCandidateRef||!!buffer.importPreparationId} onClick={()=>void read()}>기존 원문 다시 확인</button>
  {busy?<p role="status">현재 원문과 권한 확인 중</p>:null}
  {shown?<><p>프로젝트 생성 자료 · {shown.bytes.length} bytes · {String(shown.record.payload.fileRef&&(shown.record.payload.fileRef as {mediaType:string}).mediaType)}</p><p>원문 SHA256 {(shown.record.payload.fileRef as {contentHash:string}).contentHash}</p>
   {!shown.candidate?<><button type="button" disabled={disabled||busy} onClick={()=>void create()}>{shown.attempted?'같은 가져오기 명령 결과 확인':'기존 원문으로 후보 만들기'}</button>{shown.attempted?<p>결과 확인 전에는 원 명령을 유지하며 새 후보 명령을 만들지 않습니다.</p>:null}</>:<><p role="status">가져오기 후보 {shown.candidate.status} · {shown.candidate.id}</p>{shown.candidate.issues.map((issue,i)=><p key={i}>{issue.code} · {issue.message}</p>)}{preview!==null?<><pre className="document-original" aria-label="생성 자료 후보 원문">{preview}</pre><label><input type="checkbox" disabled={disabled||busy} checked={ack} onChange={e=>setAck(e.target.checked)}/>원문을 확인했고 현재 편집 본문을 이 후보로 바꾸겠습니다</label><button type="button" disabled={disabled||busy||!ack} onClick={()=>void adopt()}>이 후보로 초안 준비</button></>:<p>본문 반영 불가입니다. 원문 보존을 문서 추출 성공으로 취급하지 않습니다.</p>}</>}
   {!shown.attempted||shown.candidate||rejectedDocumentImport(shown)?<button type="button" disabled={disabled||busy} onClick={()=>{const generation=++scope.generation;onChange(b=>current(generation)&&sameBuffer(b)&&b?.importState?.recordCommandId===shown.recordCommandId?issue({...b,importState:null}):b);setObservation(null);setAck(false);}}>후보 선택 닫기</button>:null}
  </>:null}
  {error?<p role="alert">{error.code} · 기존 입력과 원 명령은 보존했습니다.</p>:null}
  <p className="meta">브라우저 전체 새로고침은 미확인 명령을 복원하지 않습니다. 보관한 후보·제안에서 저장된 후보를 먼저 확인하세요.</p>
 </section>;
}
