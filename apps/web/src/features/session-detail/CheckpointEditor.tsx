import {freezeCheckpointSave,sendCheckpointSave,readStoredCheckpoint,listStoredCheckpoints,checkpointKnownRejection,type CheckpointServerWork} from './checkpoint-api.ts';
import {useEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import type {ConfirmedAssignmentView} from '../workspace/assignment-confirmation-api.ts';
import type {DocumentSession} from '../design-trace/editor-api.ts';
import {checkpointBufferKey,checkpointDownloadFile,prepareCheckpointRecord,type CheckpointRecordDraft} from './checkpoint-api.ts';
import {CheckpointObservationFields} from './CheckpointObservationFields.tsx';
import type {CheckpointObservationForm} from './checkpoint-observation-input.ts';
import {CheckpointEvidenceFields} from './CheckpointEvidenceFields.tsx';
import type {CheckpointEvidenceForm} from './checkpoint-evidence-input.ts';
import {CheckpointWorkFields} from './CheckpointWorkFields.tsx';
import type {CheckpointWorkDetails,CheckpointWorkRow,CheckpointWorkRows} from './checkpoint-work-input.ts';
import {checkpointFormFromStoredCheckpoint,checkpointInputFromForm,emptyCheckpointForm,isEmptyCheckpointForm} from './checkpoint-form-restore.ts';
import type {CheckpointStoredInspection} from './checkpoint-journal-comparison.ts';
const fields=[['position','현재 작업 위치'],['completed','완료한 내용 · 수행자 주장'],['progress','진행 중인 작업'],['remaining','남은 작업'],['decisions','판단·승인 대기'],['next','다음 행동'],['forbidden','금지 행동'],['reason','기록 이유']] as const;
export type CheckpointForm=Record<typeof fields[number][0],string>&{observations?:CheckpointObservationForm;evidence?:CheckpointEvidenceForm;workDetails?:CheckpointWorkDetails;workRows?:CheckpointWorkRows;attemptCountOrder?:string[];serverWork?:CheckpointServerWork};
export interface CheckpointBuffers{buffers:Record<string,CheckpointForm|null>;onChange:(key:string,change:(previous:CheckpointForm|null)=>CheckpointForm|null)=>void}
const empty=emptyCheckpointForm();
export function CheckpointEditor({client,assignment,session,storage,onUnavailable,onStoredCheckpoint}:{client:ApiClient;assignment:ConfirmedAssignmentView;session:DocumentSession;storage:CheckpointBuffers;onUnavailable:(code:string)=>void;onStoredCheckpoint?:(value:CheckpointStoredInspection|null)=>void}){
 const bufferKey=checkpointBufferKey(session,assignment.projectId,assignment.ref),form=storage.buffers[bufferKey]??empty;
 const [value,setValue]=useState<CheckpointRecordDraft|null>(null),[error,setError]=useState<string|null>(null),[pending,setPending]=useState(false),generation=useRef(0),unavailable=useRef(onUnavailable);unavailable.current=onUnavailable;
 useEffect(()=>()=>{generation.current++;},[client,bufferKey,session.csrfToken]);
 useEffect(()=>{generation.current++;setValue(null);setError(null);setPending(false);},[form]);
 function change(key:typeof fields[number][0],text:string){generation.current++;setPending(false);setValue(null);setError(null);storage.onChange(bufferKey,previous=>({...previous??empty,[key]:text}));}
 function changeObservations(observations:CheckpointObservationForm){generation.current++;setPending(false);setValue(null);setError(null);storage.onChange(bufferKey,previous=>({...previous??empty,observations}));}
 function changeEvidence(evidence:CheckpointEvidenceForm){generation.current++;setPending(false);setValue(null);setError(null);storage.onChange(bufferKey,previous=>({...previous??empty,evidence}));}
 function changeWorkDetails(workDetails:CheckpointWorkDetails){generation.current++;setPending(false);setValue(null);setError(null);storage.onChange(bufferKey,previous=>({...previous??empty,workDetails}));}
 function changeRows(key:keyof CheckpointWorkRows,change:(rows:CheckpointWorkRow[],previous:CheckpointForm)=>CheckpointWorkRow[]){
  generation.current++;setPending(false);setValue(null);setError(null);
  storage.onChange(bufferKey,previous=>{
   if(!previous?.workRows)return previous;
   const old=previous.workRows[key],next=change(old,previous);
   return old===next?previous:{...previous,workRows:{...previous.workRows,[key]:next}};
  });
 }
 function addRow(key:keyof CheckpointWorkRows){
  const id=crypto.randomUUID();
  changeRows(key,(rows,previous)=>{
   const used=Object.values(previous.workRows!).some(group=>group.some(row=>row.id===id))||previous.workDetails?.evidence.some(row=>row.itemId===id)||previous.workDetails?.decisions.some(row=>row.decisionId===id);
   return rows.length>=200||used?rows:[...rows,{id,text:''}];
  });
 }
 async function prepare(){const ticket=++generation.current;setPending(true);setValue(null);setError(null);const active=()=>generation.current===ticket;
  try{const input=checkpointInputFromForm(assignment,form);input.baseRef=form.serverWork?.baseRef??null;
  const result=await prepareCheckpointRecord(client,assignment,input,session,active);if(active()&&result)setValue(result);}catch(cause){if(!active())return;const e=cause instanceof ApiError?cause:new ApiError('CHECKPOINT_RESPONSE_INVALID'),code=/^[A-Z_]{1,80}$/.test(e.code)?e.code:'CHECKPOINT_RESPONSE_INVALID';setError(code);if([401,403,404].includes(e.status))unavailable.current(e.status===401?'AUTH_REQUIRED':code);}finally{if(active())setPending(false);}
 }
 async function download(){if(!value)return;const ticket=generation.current;try{const file=await checkpointDownloadFile(value);if(generation.current!==ticket)return;const url=URL.createObjectURL(new Blob([new Uint8Array(file.bytes).buffer],{type:'text/markdown;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download=file.name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),0);}catch{if(generation.current===ticket)setError('CHECKPOINT_DOWNLOAD_INVALID');}}
 return <section className="status-card" aria-label="상세 작업현황 초안" lang="ko"><h3>상세 작업현황 초안</h3><p>선택한 확정 임무에 연결합니다. 완료·변경·시험은 수행자 기록이며 실제 검수나 안전 재개 판정이 아닙니다.</p><p>같은 사용자·기기·프로젝트·확정 임무의 화면 왕복 중 입력을 유지합니다. 새로고침·앱 종료 뒤 복원은 제공하지 않으므로 필요한 기록을 내려받으세요.</p><form onSubmit={e=>{e.preventDefault();void prepare();}}>
 {fields.map(([key,label])=>{
  if(form.workRows&&key!=='position'&&key!=='next'&&key!=='reason'){
   const rows=form.workRows[key];
   return <fieldset key={key}><legend>{label}</legend>{rows.map(row=><div key={row.id}>
    <label>{label} {row.id}<textarea value={row.text} maxLength={20000} required rows={3} onChange={e=>{const text=e.target.value;changeRows(key,previous=>previous.map(item=>item.id===row.id?{...item,text}:item));}}/></label>
    <button type="button" onClick={()=>changeRows(key,previous=>previous.filter(item=>item.id!==row.id))}>{label} {row.id} 제거</button>
   </div>)}<button type="button" disabled={rows.length>=200} onClick={()=>addRow(key)}>{label} 추가</button></fieldset>;
  }
  return <label key={key}>{label}<textarea value={form[key]} maxLength={20000} required={['position','next','reason'].includes(key)} rows={key==='position'?2:3} onChange={e=>change(key,e.target.value)}/></label>;
 })}
 <CheckpointObservationFields value={form.observations} onChange={changeObservations}/><CheckpointEvidenceFields assignment={assignment} value={form.evidence} onChange={changeEvidence}/><CheckpointWorkFields text={form} value={form.workDetails} onChange={changeWorkDetails}/><p>{form.workRows?'복원된 항목은 ID별로 편집합니다. ':'목록은 한 줄에 한 항목입니다. '}입력한 근거/변경·시험·오류는 실제 관측/검수를 인증하지 않으며 미입력을 ‘없음’으로 검증하지 않습니다. 초안을 준비한 뒤 별도 명령으로 서버 저장을 요청합니다.</p><button type="submit" disabled={pending}>{pending?'기록 준비 중':'기록 초안 준비'}</button></form>
 <CheckpointServerPanel client={client} assignment={assignment} session={session} form={form} storage={storage} prepared={value} onUnavailable={onUnavailable} onStoredCheckpoint={onStoredCheckpoint}/>
 {pending?<p role="status">정확 임무와 대조 중 · 이전 기록 숨김</p>:null}{error?<p role="alert">{error} · 기록 준비 미확인. 자동 저장·재시도하지 않습니다.</p>:null}
 {value?<section aria-label="준비된 현황 기록"><p>서버·파일 저장 미수행 · 완료/안전 재개 승인 아님</p><p>누락·미확인: {value.gaps.join(', ')}</p><p>기록 초안 {value.recordFile.bytes}바이트 · SHA-256 {value.recordFile.contentHash}</p><button type="button" onClick={()=>void download()}>기록 초안 내려받기</button><p>브라우저에 내려받기를 요청합니다. 로컬 저장 완료·서버 등록으로 확인하지 않습니다.</p><details><summary>작업현황 기록 초안 보기</summary><pre>{value.recordText}</pre></details></section>:null}
 </section>;
}

function CheckpointServerPanel({client,assignment,session,form,storage,prepared,onUnavailable,onStoredCheckpoint}:{client:ApiClient;assignment:ConfirmedAssignmentView;session:DocumentSession;form:CheckpointForm;storage:CheckpointBuffers;prepared:CheckpointRecordDraft|null;onUnavailable:(code:string)=>void;onStoredCheckpoint?:(value:CheckpointStoredInspection|null)=>void}){
 const key=checkpointBufferKey(session,assignment.projectId,assignment.ref),signature=JSON.stringify({...form,serverWork:undefined}),owner=useRef({client,transport:client.transport,key,csrf:session.csrfToken,signature,epoch:0});if(owner.current.client!==client||owner.current.transport!==client.transport||owner.current.key!==key||owner.current.csrf!==session.csrfToken||owner.current.signature!==signature)owner.current={client,transport:client.transport,key,csrf:session.csrfToken,signature,epoch:owner.current.epoch+1};
 const[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),[shown,setShown]=useState<any>(null),[page,setPage]=useState<any>(null),seq=useRef(0),reported=useRef(onStoredCheckpoint),context=owner.current,work=form.serverWork??{pending:null,uncertain:false,rejected:null,storedRef:null};reported.current=onStoredCheckpoint;
 useEffect(()=>{seq.current++;setBusy(false);setError(null);setShown(null);setPage(null);reported.current?.(null);return()=>{seq.current++;reported.current?.(null);};},[context]);
 const active=()=>owner.current===context&&client.transport===context.transport,visible=active(),ownedPending=work.pending?.ownerKey===key;
 function update(next:CheckpointServerWork){if(active())storage.onChange(key,previous=>({...previous??form,serverWork:next}));}
 async function run(action:(current:()=>boolean)=>Promise<void>){if(!active()||busy)return;const ticket=++seq.current,current=()=>active()&&seq.current===ticket;setBusy(true);setError(null);setShown(null);reported.current?.(null);try{await action(current);}catch(e){if(!current())return;const err=e instanceof ApiError?e:new ApiError('CHECKPOINT_RESPONSE_INVALID');setError(err.code);if([401,403,404].includes(err.status)){setPage(null);onUnavailable(err.code);}}finally{if(current())setBusy(false);}}
 async function freeze(){if(!prepared||work.pending)return;await run(async current=>{const pending=await freezeCheckpointSave(client,assignment,prepared.input,session,current);if(current()&&pending)update({...work,pending,uncertain:false,rejected:null,storedRef:null});});}
 async function save(){if(!work.pending||!ownedPending)return;await run(async current=>{
  const original=structuredClone(work.pending!);update({...work,pending:original,uncertain:true,rejected:null});
  let ref;
  try{ref=await sendCheckpointSave(client,original,session,current);}
  catch(e){if(current()){const rejected=checkpointKnownRejection(e);update({...work,pending:original,uncertain:!rejected,rejected:rejected?{command:original,code:(e as ApiError).code}:null});}throw e;}
  if(!current()||!ref)return;
  update({...work,pending:null,uncertain:false,rejected:null,storedRef:ref});
  const fixed=await readStoredCheckpoint(client,assignment,ref,current);
  if(current()&&fixed){setShown({context,value:fixed});reported.current?.(fixed);}
 });}
 async function list(cursor:string|null){await run(async current=>{const v=await listStoredCheckpoints(client,assignment,cursor,current);if(current()&&v)setPage({context,value:v});});}
 async function read(ref:any){await run(async current=>{const v=await readStoredCheckpoint(client,assignment,ref,current);if(current()&&v){setShown({context,value:v});reported.current?.(v);}});}
 const currentPage=page?.context===context?page.value:null,currentShown=shown?.context===context?shown.value:null;
 async function restore(){const source=currentShown;if(!source||!isEmptyCheckpointForm(form)||work.pending)return;await run(async current=>{const restored=await checkpointFormFromStoredCheckpoint(assignment,source);if(!current())return;storage.onChange(key,previous=>current()&&isEmptyCheckpointForm(previous)?restored:previous);});}
 return <section aria-label="서버 체크포인트 보관"><h4>서버 체크포인트 보관</h4><p>저장 결과는 서버 응답으로 확인합니다. 보관한 기록의 조회는 실행·안전 재개를 승인하지 않습니다.</p><button type="button" disabled={busy||!prepared||!!work.pending} onClick={()=>void freeze()}>서버 기록 저장 명령 준비</button>{work.pending?<><p>원명령 {work.pending.command.commandId} · {work.pending.commandHash}</p><details><summary>고정된 저장 원명령</summary><pre>{JSON.stringify(work.pending.command,null,2)}</pre></details><button type="button" disabled={busy||!ownedPending} onClick={()=>void save()}>{work.uncertain?'같은 기록 저장 명령 재확인':'서버 기록 명시 저장'}</button></>:null}{work.rejected?<><p>명확한 거절 {work.rejected.code} · 원명령과 이유는 보존합니다.</p><button type="button" disabled={busy||!ownedPending} onClick={()=>update({...work,pending:null,uncertain:false,history:[...work.history??[],work.rejected!]})}>거절 확인 후 새 기록 준비</button></>:null}{work.storedRef?<button type="button" disabled={busy} onClick={()=>void read(work.storedRef)}>저장된 체크포인트 원문 조회</button>:null}<button type="button" disabled={busy} onClick={()=>void list(null)}>보관 기록 목록 조회</button>{busy?<p role="status">현재 권한·고정 기록 대조 중 · 이전 본문 숨김</p>:null}{error?<p role="alert">{error}</p>:null}
 {currentPage?<div aria-label="보관 기록 목록">{currentPage.items.length?currentPage.items.map((i:any)=><button type="button" key={i.ref.id} disabled={busy} onClick={()=>void read(i.ref)}>기록 선택 {i.ref.id} · 순번 {i.serverSequence}</button>):<p>보관 기록 없음</p>}{currentPage.hasMore?<button type="button" disabled={busy} onClick={()=>void list(currentPage.nextCursor)}>이전 기록 더 보기</button>:null}</div>:null}
 {currentShown?<section aria-label="고정 서버 기록"><p>서버 기록 원문 검산 완료 · 실제 파일 저장/현재 사실/쓰기 회수/안전 재개/완료/실행 미인증</p><p>{currentShown.ref.id} · {currentShown.ref.contentHash}</p><pre>{currentShown.recordText}</pre><button type="button" onClick={()=>{seq.current++;setShown(null);reported.current?.(null);}}>기록 닫기</button><button type="button" disabled={busy||!!work.pending} onClick={()=>update({...work,baseRef:currentShown.ref})}>이 기록을 다음 기준으로 선택</button><button type="button" disabled={busy||!!work.pending||!isEmptyCheckpointForm(form)} onClick={()=>void restore()}>이 기록을 빈 입력으로 복원</button></section>:null}</section>;
}
