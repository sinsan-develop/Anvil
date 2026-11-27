import { useEffect, useLayoutEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { ApiClient, ApiError } from '../../api/client.ts';
import {BaselineDesignPicker} from './BaselineDesignPicker.tsx';
import {checkBaselineApprovalBinding} from './baseline-approval.ts';
import {BaselineApprovalEditor} from './BaselineApprovalEditor.tsx';
import {BaselineUploadApprovalEditor} from './BaselineUploadApprovalEditor.tsx';
import { documentControl, type DocumentSession } from '../design-trace/editor-api.ts';
import { readWorkspaceProject, type WorkspaceProject } from '../workspace/api.ts';
import { listSourceReadGrants, readSourceReadSnapshot, type SourceReadSnapshotView } from '../connections/source-read-api.ts';
import { baselineMutationFailed, beginBaselineReview, listBaselineRecords, mergeBaselineBuffer, newBaselineBuffer, prepareBaselineAdoption, prepareBaselineCommand, prepareBaselineUpload, readAdoptedBaseline, readBaselineDecision, readBaselineDraft, readBaselineEvidence, readCurrentBaseline, recheckBaselineCommand, releaseRejectedBaseline, restartBaselineDraft, restoreBaselineDraft, sendBaselineCommand, sendBaselineUpload, type BaselineBuffer, type BaselineContentReview, type BaselineDecision, type BaselineDraftView, type BaselineEvidenceRef, type BaselineOperation, type BaselinePage, type Ref } from './baseline-api.ts';
import { artifact, featureLabels, reference, same, type BaselineCoreEvidence, type BaselineFeatureState, type BaselineItem, type BaselineReviewOutcome } from './baseline-validation.ts';

const outcomes={NOT_EXECUTED:'미검토',ACCEPTED:'기록 내용 적합',REWORK:'보완 필요',BLOCKED:'판단 불가'} as const;
const failure=(e:unknown)=>e instanceof ApiError?e:new ApiError('RESPONSE_INVALID');
const modified=(b:BaselineBuffer|null)=>!!b&&(b.dirty||b.reviewDirty||b.confirmation.acknowledged||!!b.confirmation.reason);
type UploadCheckpoint={pending:BaselineBuffer;resolve:(installed:boolean)=>void};
type EvidenceOriginal={ref:BaselineEvidenceRef;bytes:Uint8Array<ArrayBuffer>;text:string|null};
type AdoptedSlot='current'|'historical';
const adoptionLabels={current:'현재 채택본',historical:'과거 채택본'} as const;
type AdoptionValue={
 projectId:string;status:'FEATURE_STATUS_V1'|'LEGACY_UNVERIFIED'|'UNCONFIRMED';ref:Ref|null;contentConfirmed:boolean;
 snapshot?:{input:{items:BaselineItem[]};evidenceBindings:{itemId:string;evidenceRefs:BaselineEvidenceRef[]}[]}|null;
 currentContentReviewValid?:boolean;currentCheck?:{state:string};
};
type AdoptionOwner={key:string;client:ApiClient;transport:typeof fetch};
type AdoptionRecord={owner:AdoptionOwner;slot:AdoptedSlot;value:AdoptionValue};
type AdoptionSelection={record:AdoptionRecord;baselineRef:Ref;itemId:string;artifact:BaselineEvidenceRef;controller:AbortController;loading:boolean};
type AdoptedEvidence={selection:AdoptionSelection;original:EvidenceOriginal|null;error:ApiError|null};

function adoptedArtifact(record:AdoptionRecord,itemId:string,ref:BaselineEvidenceRef){
 const value=record.value;
 if(value.status!=='FEATURE_STATUS_V1'||!value.contentConfirmed||!reference(value.ref)||!value.snapshot||!artifact(ref))return null;
 // The adoption reader already verified the snapshot hash and equal bindings. Preserve the exact UI selection.
 const items=value.snapshot.input.items.filter(item=>item.itemId===itemId);
 const bindings=value.snapshot.evidenceBindings.filter(item=>item.itemId===itemId);
 if(items.length!==1||bindings.length!==1)return null;
 const evidence=items[0]!.evidenceRefs.filter(item=>item.artifactId===ref.artifactId);
 const bound=bindings[0]!.evidenceRefs.filter(item=>item.artifactId===ref.artifactId);
 return evidence.length===1&&bound.length===1&&same(evidence[0],ref)&&same(bound[0],ref)?evidence[0]!:null;
}
async function readEvidenceOriginal(client:ApiClient,projectId:string,ref:BaselineEvidenceRef,active:()=>boolean,signal?:AbortSignal):Promise<EvidenceOriginal|null>{
 const bytes=await readBaselineEvidence(client,projectId,ref,signal);
 if(!active())return null;
 let text:string|null=null;
 if(/^text\/(?:plain|markdown)(?:;|$)/i.test(ref.mediaType)){
  try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}
  catch{throw new ApiError('DOCUMENT_UTF8_INVALID');}
 }
 return {ref,bytes,text};
}
function downloadEvidence(original:EvidenceOriginal){
 const url=URL.createObjectURL(new Blob([original.bytes],{type:'application/octet-stream'})),a=document.createElement('a');
 a.href=url;a.download=`evidence-${original.ref.artifactId}.bin`;a.click();
 setTimeout(()=>URL.revokeObjectURL(url),0);
}
function sameUploadBuffer(left:BaselineBuffer,right:BaselineBuffer){const a=left.upload,b=right.upload;if(!!a!==!!b||a&&b&&(a.bytes.length!==b.bytes.length||a.bytes.some((value,index)=>value!==b.bytes[index])))return false;return same({...left,upload:a?{...a,bytes:null}:a},{...right,upload:b?{...b,bytes:null}:b});}
function RefLabel({value}:{value:Ref}) { return <span className="meta">{value.id} · v{value.version}<br/>{value.contentHash}</span>; }
export function ProjectBaselinePanel({client,projectId,session,buffer,onChange,onAuthenticationLost}:{client:ApiClient;projectId:string;session:DocumentSession;buffer:BaselineBuffer|null;onChange:Dispatch<SetStateAction<BaselineBuffer|null>>;onAuthenticationLost:()=>void}) {
 const [project,setProject]=useState<WorkspaceProject|null>(null),[error,setError]=useState<ApiError|null>(null),[busy,setBusy]=useState(false),[revision,setRevision]=useState(0);
 const [drafts,setDrafts]=useState<BaselinePage|null>(null),[history,setHistory]=useState<{owner:AdoptionOwner;page:BaselinePage}|null>(null);
 const [adoptions,setAdoptions]=useState<Record<AdoptedSlot,AdoptionRecord|null>>({current:null,historical:null}),latestAdoptions=useRef(adoptions);
 const [adoptedEvidence,setAdoptedEvidence]=useState<AdoptedEvidence|null>(null),latestEvidence=useRef<AdoptionSelection|null>(null);
 const [selected,setSelected]=useState<BaselineDraftView|null>(null),[decision,setDecision]=useState<BaselineDecision|null>(null);
 const [reports,setReports]=useState<Awaited<ReturnType<typeof listSourceReadGrants>>|null>(null),[report,setReport]=useState<SourceReadSnapshotView|null>(null),[original,setOriginal]=useState<EvidenceOriginal|null>(null);
 const mounted=useRef(false),epoch=useRef(0),working=useRef(false);
 const [uploadCheckpoint,setUploadCheckpoint]=useState<UploadCheckpoint|null>(null),uploadCommit=useRef<UploadCheckpoint|null>(null),latestUpload=useRef({client,buffer});latestUpload.current={client,buffer};
 const authority=[projectId,session.user.id,session.clientId,project?.controlState.status,project?.controlState.actorId,project?.controlState.clientId,project?.controlState.generation].join(':');
 const latestAuthority=useRef(authority);latestAuthority.current=authority;
 const adoptionKey=JSON.stringify([projectId,session.user.id,session.clientId,session.csrfToken,revision]);
 const adoptionScope=useRef<AdoptionOwner>({key:adoptionKey,client,transport:client.transport});
 if(adoptionScope.current.key!==adoptionKey||adoptionScope.current.client!==client||adoptionScope.current.transport!==client.transport)adoptionScope.current={key:adoptionKey,client,transport:client.transport};
 const adoptionOwner=adoptionScope.current,adoptionAlive=useRef(false);
 useLayoutEffect(()=>{adoptionAlive.current=true;return()=>{adoptionAlive.current=false;};},[]);
 const adoptionActive=()=>adoptionAlive.current&&adoptionScope.current===adoptionOwner&&client.transport===adoptionOwner.transport;
 const adoptionHistory=history?.owner===adoptionOwner?history.page:null;
 const recordActive=(record:AdoptionRecord)=>adoptionActive()&&record.owner===adoptionOwner&&record.value.projectId===projectId&&latestAdoptions.current[record.slot]===record;
 const evidenceActive=(selection:AdoptionSelection)=>recordActive(selection.record)&&latestEvidence.current===selection&&same(selection.record.value.ref,selection.baselineRef);
 const evidenceShown=adoptedEvidence&&evidenceActive(adoptedEvidence.selection)?adoptedEvidence:null;
 const revokeEvidence=()=>{const old=latestEvidence.current;latestEvidence.current=null;if(old?.loading)old.controller.abort();};
 const clearAdoptedEvidence=()=>{revokeEvidence();setAdoptedEvidence(null);};
 function clearAdoptions(){const next={current:null,historical:null};latestAdoptions.current=next;setAdoptions(next);clearAdoptedEvidence();}
 function showAdoption(slot:AdoptedSlot,value:AdoptionValue|null){
  const next={...latestAdoptions.current,[slot]:value?{owner:adoptionOwner,slot,value}:null};
  latestAdoptions.current=next;setAdoptions(next);
 }
 useLayoutEffect(()=>{clearAdoptions();setHistory(null);return revokeEvidence;},[adoptionOwner]);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;epoch.current++;const checkpoint=uploadCommit.current;uploadCommit.current=null;checkpoint?.resolve(false);};},[]);
 // 부모 updater가 지연·거절될 수 있으므로 실제 반영된 prop만 전송을 허용한다.
 useEffect(()=>{if(!uploadCheckpoint)return;if(uploadCommit.current===uploadCheckpoint){uploadCommit.current=null;uploadCheckpoint.resolve(buffer===uploadCheckpoint.pending);}setUploadCheckpoint(null);},[buffer,uploadCheckpoint]);
 useEffect(()=>{
  let active=true;const ticket=++epoch.current;setProject(null);setError(null);setSelected(null);setDecision(null);setReport(null);setOriginal(null);setDrafts(null);setHistory(null);setReports(null);
  readWorkspaceProject(client,projectId).then(p=>{if(active&&ticket===epoch.current)setProject(p);}).catch(e=>{if(active&&ticket===epoch.current){const f=failure(e);setError(f);if(f.status===401)onAuthenticationLost();}});
  return()=>{active=false;};
 },[client,projectId,session.user.id,session.clientId,revision]);
 const owner=project?.participation==='OWNER'&&project.controlState.status==='HELD'&&project.controlState.actorId===session.user.id&&project.controlState.clientId===session.clientId;
 const bound=!!buffer&&buffer.projectId===projectId&&buffer.ownerUserId===session.user.id&&buffer.ownerClientId===session.clientId;
 const writable=!!owner&&(!buffer||bound&&buffer.controlGeneration===project?.controlState.generation);
 const locked=busy||!!buffer?.pending||!writable;
 const editable=!!buffer&&bound&&buffer.dirty&&!locked;
 function update(expected:BaselineBuffer,fn:(b:BaselineBuffer)=>BaselineBuffer){onChange(previous=>mergeBaselineBuffer(previous,expected,fn));}
 function hideReads(){setSelected(null);setDecision(null);clearAdoptions();setReport(null);setOriginal(null);setDrafts(null);setHistory(null);setReports(null);}
 async function action(fn:(active:()=>boolean)=>Promise<void>,write:boolean|'new'=false,isCurrent:()=>boolean=()=>true){
  if(!isCurrent()||working.current||(write==='new'?!owner:write&&!writable))return;working.current=true;setBusy(true);setError(null);setOriginal(null);
  const ticket=++epoch.current,key=authority,active=()=>mounted.current&&ticket===epoch.current&&latestAuthority.current===key&&isCurrent();
  try{await fn(active);}catch(e){if(active()){const f=failure(e);setError(f);hideReads();if(f.status===401)onAuthenticationLost();}}finally{working.current=false;if(mounted.current)setBusy(false);}
 }
 async function control(b?:BaselineBuffer|null){const g=await documentControl(client,projectId,session);if(g!==project?.controlState.generation||b&&g!==b.controlGeneration)throw new ApiError('PROJECT_CONTROL_REQUIRED',403);return g;}
 function start(){void action(async active=>{if(buffer?.pending||buffer?.uncertain)throw new ApiError('BASELINE_RECONCILIATION_REQUIRED');if((modified(buffer)||buffer&&buffer.controlGeneration!==project?.controlState.generation)&&!confirm('이 탭의 기존 입력 대신 현재 제어 세대의 새 초안을 시작할까요? 저장된 이력과 분리한 거절 명령은 유지합니다.'))return;const generation=await control();if(active()){onChange(buffer?restartBaselineDraft(buffer,session,generation,project?.sourceDeclaration?.ref??null):newBaselineBuffer(projectId,session,generation,project?.sourceDeclaration?.ref??null));setSelected(null);setDecision(null);}},'new');}
 function changeInput(fn:(b:BaselineBuffer)=>BaselineBuffer){if(!buffer||!editable)return;const b=buffer;update(b,p=>({...fn(p),review:null,reviewDirty:false,confirmation:{reason:'',acknowledged:false},failure:null}));setDecision(null);}
 function changeItem(index:number,patch:Partial<BaselineItem>){changeInput(b=>({...b,input:{...b.input,items:b.input.items.map((i,n)=>n===index?{...i,...patch}:i)}}));}
 async function loadDraft(r:Ref){await action(async active=>{setSelected(null);setDecision(null);const value=await readBaselineDraft(client,projectId,r),d=await readBaselineDecision(client,projectId,r);if(active()){setSelected(value);setDecision(d);}});}
 function useSelected(){if(!selected||locked||!buffer)return;const b=buffer;if(modified(b)&&!confirm('이 탭의 미저장 입력을 선택한 저장본으로 바꿀까요? 원 명령이 미확인인 경우 변경하지 않습니다.'))return;try{update(b,p=>restoreBaselineDraft(p,session,selected));}catch(e){setError(failure(e));}}
 function revise(){if(!buffer?.saved||locked)return;const b=buffer;if(modified(b)&&!confirm('현재 검토·채택 입력 대신 저장본을 개정할까요? 이전 기록은 유지합니다.'))return;update(b,p=>({...p,input:{...structuredClone(p.saved!.snapshot.input),baseRef:{...p.saved!.ref}},review:null,reviewDirty:false,confirmation:{reason:'',acknowledged:false},dirty:true,failure:null}));setDecision(null);}
 async function persist(expected:BaselineBuffer,operation:BaselineOperation|'recheck',active:()=>boolean){
  await control(expected);if(!active())return;
  let command;
  if(operation==='recheck')command=recheckBaselineCommand(expected,session);
  else if(operation==='confirmBaseline'){
   if(!expected.saved)throw new ApiError('BASELINE_SAVED_DRAFT_REQUIRED');const d=await readBaselineDecision(client,projectId,expected.saved.ref);if(!active())return;setDecision(d);command=prepareBaselineAdoption(expected,session,d);
  }else command=prepareBaselineCommand(expected,session,operation);
  if(command.approvalRef!==null){await checkBaselineApprovalBinding(expected,session);if(!active())return;}
  const pending={...expected,pending:command,uncertain:true,failure:null};update(expected,()=>pending);
  try{
   const result=await sendBaselineCommand(client,command,session);if(!active())return;
   update(pending,p=>command.operation==='saveBaselineDraft'?{...p,pending:null,baselineApproval:undefined,uncertain:false,failure:null,saved:{projectId,ref:result.ref,snapshot:result.snapshot,headVersion:result.ref.version,currentCheck:{state:'MATCHED_METADATA',issues:[]},contentConfirmed:false,observedAt:result.observedAt},input:structuredClone(result.snapshot.input),dirty:false,review:null,reviewDirty:false,confirmation:{reason:'',acknowledged:false}}:{...p,pending:null,baselineApproval:undefined,uncertain:false,failure:null,reviewDirty:command.operation==='reviewBaselineContent'?false:p.reviewDirty,confirmation:command.operation==='confirmBaseline'?{reason:'',acknowledged:false}:p.confirmation});
   // Mutation receipt and later history reads are separate: a failed GET cannot resurrect a completed command.
   if(command.operation==='saveBaselineDraft'){setSelected(null);setDecision(null);}
   else if(expected.saved){const d=await readBaselineDecision(client,projectId,expected.saved.ref);if(active())setDecision(d);}
   if(command.operation==='confirmBaseline'&&active()&&adoptionActive())await loadAdoption('current',active);
  }catch(e){const f=failure(e);if(active())update(pending,p=>baselineMutationFailed(p,!!expected.pending&&expected.uncertain,f));throw e;}
 }
 function write(operation:BaselineOperation|'recheck'){const b=buffer;if(!b||!bound)return;void action(active=>persist(b,operation,active),true);}
 async function uploadControl(b:BaselineBuffer,active:()=>boolean){
  try{await control(b);return active();}catch(e){if(active()){const f=failure(e);setError(f);hideReads();setProject(null);if(f.status===401)onAuthenticationLost();}return false;}
 }
 function upload(index:number,file:File|null){if(!file||!buffer||!editable)return;const b=buffer,item=b.input.items[index];if(!item)return;const frozen=structuredClone(b);
  void action(async active=>{
   const current=()=>active()&&latestUpload.current.client===client&&latestUpload.current.buffer===b&&sameUploadBuffer(b,frozen);
   if(!current()||!await uploadControl(b,current))return;if(file.size>20*1024*1024)throw new ApiError('BASELINE_UPLOAD_INPUT_INVALID');
   const bytes=new Uint8Array(await file.arrayBuffer());if(!current())return;const next=await prepareBaselineUpload(b,session,item.itemId,bytes,file.type||'application/octet-stream');if(!current())return;
   await uploadPending(next,active,b,frozen);
  },true);
 }
 async function uploadPending(b:BaselineBuffer,active:()=>boolean,expected=b,frozen=structuredClone(expected)){
  const current=()=>active()&&latestUpload.current.client===client&&latestUpload.current.buffer===expected&&sameUploadBuffer(expected,frozen);
  if(!current()||!await uploadControl(b,current)||!current())return;
  const previouslyUncertain=b.uncertain,pending={...b,uncertain:true},pinned=structuredClone(pending);
  const currentPending=()=>active()&&latestUpload.current.client===client&&latestUpload.current.buffer===pending&&sameUploadBuffer(pending,pinned);
  // 아직 전송하지 않은 이 시도의 정확 checkpoint만 원입력으로 복구한다.
  const rollback=()=>onChange(previous=>previous===pending&&sameUploadBuffer(previous,pinned)?expected:previous);
  const installed=await new Promise<boolean>(resolve=>{const checkpoint={pending,resolve};uploadCommit.current=checkpoint;setUploadCheckpoint(checkpoint);onChange(previous=>uploadCommit.current===checkpoint&&current()&&previous===expected&&sameUploadBuffer(previous,frozen)?pending:previous);});
  if(!installed||!currentPending()){rollback();return;}
  let dispatched=false,cancelled=false;
  const transport=new ApiClient(async(input,init)=>{if(!currentPending()){cancelled=true;throw new ApiError('BASELINE_UPLOAD_PAUSED');}dispatched=true;return client.transport.call(globalThis,input,init);});
  try{const result=await sendBaselineUpload(transport,pending,session);if(active())update(pending,()=>result);}catch(e){if(cancelled&&!dispatched){rollback();return;}const f=failure(e);if(active())update(pending,p=>baselineMutationFailed(p,previouslyUncertain,f));throw e;}
 }
 function reviewChange(fn:(r:BaselineContentReview)=>BaselineContentReview){if(!buffer?.review||locked)return;const b=buffer;update(b,p=>({...p,review:fn(p.review!),reviewDirty:true,confirmation:{reason:'',acknowledged:false},failure:null}));setDecision(null);}
 function coreChange(index:number,patch:Partial<BaselineCoreEvidence>){reviewChange(r=>({...r,items:r.items.map((i,n)=>n===index?{...i,coreEvidence:{basis:'UNKNOWN',environment:'',checkedAt:'',normalFlow:[],storageRead:[],importantFailure:[],...i.coreEvidence,...patch}}:i)}));}
 async function evidence(r:BaselineEvidenceRef){await action(async active=>{const value=await readEvidenceOriginal(client,projectId,r,active);if(value&&active())setOriginal(value);});}
 async function loadAdoption(slot:AdoptedSlot,active:()=>boolean,r?:Ref){
  const currentRead=()=>active()&&adoptionActive();
  if(!currentRead())return;
  clearAdoptedEvidence();showAdoption(slot,null);
  try{
   const value=r?await readAdoptedBaseline(client,projectId,r):await readCurrentBaseline(client,projectId);
   if(currentRead())showAdoption(slot,value);
  }catch(cause){if(currentRead())throw cause;}
 }
 function openAdoption(slot:AdoptedSlot,r?:Ref){
  void action(active=>loadAdoption(slot,active,r),false,adoptionActive);
 }
 async function openAdoptedEvidence(record:AdoptionRecord,itemId:string,r:BaselineEvidenceRef){
  if(working.current||!recordActive(record))return;
  const selected=adoptedArtifact(record,itemId,r),baselineRef=record.value.ref;
  if(!selected||!baselineRef)return;
  const previous=latestEvidence.current;
  if(previous?.loading&&previous.record===record&&previous.itemId===itemId&&same(previous.artifact,selected))return;
  revokeEvidence();
  const selection:AdoptionSelection={record,itemId,baselineRef:{...baselineRef},artifact:{...selected},controller:new AbortController(),loading:true};
  latestEvidence.current=selection;setAdoptedEvidence({selection,original:null,error:null});
  const active=()=>evidenceActive(selection);
  try{
   const value=await readEvidenceOriginal(client,projectId,selection.artifact,active,selection.controller.signal);
   if(value&&active())setAdoptedEvidence({selection,original:value,error:null});
  }catch(cause){
   if(!active())return;
   const error=failure(cause);setAdoptedEvidence({selection,original:null,error});
   if(error.status===401)onAuthenticationLost();
  }finally{selection.loading=false;}
 }
 async function list(kind:'drafts'|'adoptions',more=false){
  await action(async active=>{
   const previous=kind==='drafts'?drafts:adoptionHistory;
   const page=await listBaselineRecords(client,projectId,kind,more?previous?.nextCursor??null:null);
   if(!active())return;
   const next=more&&previous?{...page,items:[...previous.items,...page.items]}:page;
   if(kind==='drafts')setDrafts(next);else setHistory({owner:adoptionOwner,page:next});
  },false,kind==='adoptions'?adoptionActive:undefined);
 }
 async function reportList(more=false){await action(async active=>{const page=await listSourceReadGrants(client,projectId,more?reports?.nextCursor??null:null);if(active())setReports(more&&reports?{...page,items:[...reports.items,...page.items]}:page);});}
 return <section className="status-card auth-form" aria-label="기능 상태 시작 기준선" lang="ko">
  <h2>기능 상태 시작 기준선</h2><p className="meta">프로젝트 생성과 별도입니다. 기능 분류를 기록·내용 검토·채택하며 소스 접근이나 Agent 실행을 허가하지 않습니다.</p>
  <button disabled={busy} onClick={()=>{hideReads();setRevision(n=>n+1);}}>현재 권한·프로젝트 다시 조회</button>
  {!project?<p>프로젝트·현재 제어 미확인</p>:null}{error?<p role="alert">{error.code} · 조회본문은 숨겼으며 입력·미확인 원명령은 보존했습니다.</p>:null}
  {project?<><p>현재 참여 {project.participation} · 제어 세대 {project.controlState.generation} · {writable?'기준선 작성 가능 · 명시 정책은 서버 재검사':'이 화면은 조회 전용 · 기존 입력 보존'}</p>
   <div className="project-toolbar"><button disabled={busy} onClick={()=>openAdoption('current')}>현재 채택본 조회</button><button disabled={busy} onClick={()=>void list('drafts')}>저장 초안 목록</button><button disabled={busy} onClick={()=>void list('adoptions')}>채택 이력 목록</button><button disabled={busy||!owner||!!buffer?.pending||!!buffer?.uncertain} onClick={start}>새 기준선 초안 작성</button></div>
   {Object.values(adoptions).map(record=>record&&recordActive(record)?<BaselineRecord key={record.slot} record={record} busy={busy} onEvidence={(itemId,ref)=>void openAdoptedEvidence(record,itemId,ref)}
    evidence={evidenceShown?.selection.record===record?evidenceShown:null} onCloseEvidence={selection=>{if(evidenceActive(selection))clearAdoptedEvidence();}}
    onDownloadEvidence={(selection,value)=>{if(evidenceActive(selection))downloadEvidence(value);}}/>:null)}
   {drafts?<div aria-label="기준선 초안 목록"><p>목록은 메타데이터이며 내용 검토·현재 무결성 확인이 아닙니다.</p>{drafts.items.map((v,i)=>v.ref?<p key={v.ref.id+':'+v.ref.version}><button disabled={busy} onClick={()=>void loadDraft(v.ref!)}>초안 정확 조회</button> <RefLabel value={v.ref}/></p>:<p key={i}>옛 기록 · 미확인</p>)}{drafts.hasMore?<button disabled={busy} onClick={()=>void list('drafts',true)}>다음 초안</button>:null}</div>:null}
   {adoptionHistory?<div aria-label="기준선 채택 이력">{adoptionHistory.items.map(v=>{const r=v.ref??('legacyRef'in v?v.legacyRef:null);return r?<p key={r.id+':'+r.version}>{v.status==='LEGACY_UNVERIFIED'?'옛 결박 미확인 · 자동 채택하지 않음':null}<button disabled={busy} onClick={()=>openAdoption('historical',r)}>고정 이력 조회</button><RefLabel value={r}/></p>:null;})}{adoptionHistory.hasMore?<button disabled={busy} onClick={()=>void list('adoptions',true)}>다음 이력</button>:null}</div>:null}
   {selected?<section aria-label="선택 기준선 초안"><h3>저장 초안 v{selected.ref.version} · head {selected.headVersion}</h3><RefLabel value={selected.ref}/><p>현재 보호 근거 {selected.currentCheck.state} · 내용 미확정</p><ItemSummary items={selected.snapshot.input.items}/><details><summary>저장 초안 원본 JSON</summary><pre>{JSON.stringify(selected.snapshot,null,2)}</pre></details><button disabled={locked||!buffer} onClick={useSelected}>선택 저장본을 이 탭에서 검토·편집</button>{!buffer?<p>새 초안을 시작한 뒤 저장본을 선택하세요. 조회만으로 입력을 덮어쓰지 않습니다.</p>:null}</section>:null}
  </>:null}
  {buffer&&!bound?<p role="alert">다른 프로젝트·사용자·기기 버퍼는 표시하거나 전송하지 않습니다.</p>:null}
  {buffer&&bound?<>
   {buffer.pending?<section aria-label="미확인 기준선 명령"><p role="status">원명령 {buffer.pending.operation} · {buffer.pending.commandId} · {buffer.uncertain?'결과 재확인 필요':'종결 거절 · 명시 분리 가능'}</p><button disabled={busy||!writable||!!buffer.uploadApproval&&!buffer.uploadApproval.commandHash||!!buffer.baselineApproval&&!buffer.baselineApproval.commandHash} onClick={()=>buffer.upload?void action(active=>uploadPending(buffer,active),true):write('recheck')}>동일 원명령 재확인</button>{buffer.failure?<p>{buffer.failure.code} · HTTP {buffer.failure.status||'미확인'}{buffer.failure.quarantinedArtifactId?` · 보호 격리 원문 ${buffer.failure.quarantinedArtifactId}`:null}</p>:null}{!buffer.uncertain&&buffer.failure?<button disabled={busy||!!buffer.baselineApproval?.request?.pending||!!buffer.baselineApproval?.request?.uncertain||!!buffer.uploadApproval?.request?.pending||!!buffer.uploadApproval?.request?.uncertain} onClick={()=>{if(!confirm('종결된 거절 명령과 격리 사실을 이 탭 기록에 보존하고 입력만 다시 편집할까요? 서버 원문은 삭제·격리해제하지 않습니다.'))return;try{update(buffer,b=>releaseRejectedBaseline(b,session));setError(null);}catch(e){setError(failure(e));}}}>종결 거절 기록 보존·입력 복구</button>:null}</section>:null}
   {buffer.pending&&['saveBaselineDraft','reviewBaselineContent','confirmBaseline'].includes(buffer.pending.operation)?<BaselineApprovalEditor key={buffer.bindingId+':'+buffer.pending.commandId} client={client} session={session} buffer={buffer} disabled={busy||!writable} onAuthenticationLost={onAuthenticationLost} update={change=>onChange(previous=>previous?.ownerUserId===session.user.id&&previous.ownerClientId===session.clientId&&previous.controlGeneration===project?.controlState.generation?mergeBaselineBuffer(previous,buffer,change):previous)}/>:null}
   {buffer.upload&&buffer.pending&&(buffer.failure?.code==='APPROVAL_REQUIRED'||buffer.uploadApproval)?<BaselineUploadApprovalEditor key={buffer.bindingId+':'+buffer.pending.commandId} client={client} session={session} buffer={buffer} disabled={busy||!writable} onAuthenticationLost={onAuthenticationLost} update={change=>onChange(previous=>previous?.bindingId===buffer.bindingId&&previous.ownerUserId===session.user.id&&previous.ownerClientId===session.clientId&&previous.controlGeneration===project?.controlState.generation&&previous.pending?.commandId===buffer.pending?.commandId?change(previous):previous)}/>:null}
   {buffer.rejectedCommands.length?<details><summary>분리 보존한 거절 명령 {buffer.rejectedCommands.length}건</summary>{buffer.rejectedCommands.map(v=><p key={v.command.commandId}>{v.command.commandId} · {v.command.operation} · {v.failure.code}{v.failure.quarantinedArtifactId?` · 격리 원문 ${v.failure.quarantinedArtifactId}`:null}</p>)}</details>:null}
   <h3>기능 분류 초안 {buffer.dirty?'· 미저장 입력':'· 저장본 고정'}</h3>{buffer.saved?<><RefLabel value={buffer.saved.ref}/><button disabled={locked} onClick={revise}>저장본 개정 시작</button></>:null}
   <fieldset disabled={!editable}><legend>기능 범위·소스 근거</legend>
    <label>소스 종류<select value={buffer.input.source.kind} onChange={e=>{const kind=e.target.value;if(kind==='ATTRIBUTE_REPORT')return;setReport(null);changeInput(b=>({...b,input:{...b.input,source:{...b.input.source,kind:kind as 'NONE_SELECTED'|'DECLARATION_ONLY',declarationRef:kind==='DECLARATION_ONLY'?project?.sourceDeclaration?.ref??null:null,sourceRootRef:null,snapshotRef:null,grantRef:null}}}));}}><option value="NONE_SELECTED" disabled={!!project?.sourceDeclaration}>미선택 · 빈 소스 증명 아님</option><option value="DECLARATION_ONLY" disabled={!project?.sourceDeclaration}>프로젝트 생성 당시 사용자 선언만</option>{buffer.input.source.kind==='ATTRIBUTE_REPORT'?<option value="ATTRIBUTE_REPORT">선택된 과거 속성 보고</option>:null}</select></label>
    {project?.sourceDeclaration?<details><summary>프로젝트 생성 당시 사용자 선언 원본</summary><pre>{JSON.stringify(project.sourceDeclaration,null,2)}</pre></details>:null}
    <label>미확인 이유<textarea value={buffer.input.source.unverifiedReason} onChange={e=>changeInput(b=>({...b,input:{...b.input,source:{...b.input.source,unverifiedReason:e.target.value}}}))}/></label>
    <label>기능 범위·누락 가능성<textarea value={buffer.input.coverageReason} onChange={e=>changeInput(b=>({...b,input:{...b.input,coverageReason:e.target.value}}))}/></label><label>초안 저장·개정 이유<textarea value={buffer.input.reason} onChange={e=>changeInput(b=>({...b,input:{...b.input,reason:e.target.value}}))}/></label>
   </fieldset>
   <button disabled={busy} onClick={()=>void reportList()}>보존된 소스 속성 보고 목록 조회</button>{reports?<div aria-label="보존 속성 보고 목록">{reports.items.map(v=>v.snapshotRef?<p key={v.grantRef.id}><button disabled={busy} onClick={()=>void action(async active=>{setReport(null);const value=await readSourceReadSnapshot(client,projectId,v.snapshotRef!,v.grantRef);if(active())setReport(value);})}>보고 정확 원본 조회</button><RefLabel value={v.snapshotRef}/></p>:<p key={v.grantRef.id}>이 허가에 보존된 보고 없음</p>)}{reports.hasMore?<button disabled={busy} onClick={()=>void reportList(true)}>다음 보고</button>:null}</div>:null}
   {report?<section><p>CONNECTOR_REPORTED · OS UNVERIFIED · 실제 현재 소스/본문 검증 아님</p>{report.rawAllowed?<><details><summary>보존 보고 원문</summary><pre>{JSON.stringify(report.report,null,2)}</pre></details><button disabled={!editable} onClick={()=>changeInput(b=>({...b,input:{...b.input,source:{...b.input.source,kind:'ATTRIBUTE_REPORT',declarationRef:project?.sourceDeclaration?.ref??null,sourceRootRef:report.sourceRootRef,snapshotRef:report.snapshotRef,grantRef:report.grantRef}}}))}>이 정확 보고를 초안 근거로 선택</button></>:<p>현재 원문 조회 권한 없음 · 선택 불가</p>}</section>:null}
   {buffer.input.items.map((item,index)=><fieldset key={index} disabled={!editable}><legend>기능 항목 {index+1}</legend><label>기능 ID<input value={item.itemId} maxLength={200} onChange={e=>changeItem(index,{itemId:e.target.value})}/></label><label>기능 이름<input value={item.title} maxLength={200} onChange={e=>changeItem(index,{title:e.target.value})}/></label><label>기능 구현 상태<select value={item.featureState} onChange={e=>changeItem(index,{featureState:e.target.value as BaselineFeatureState})}>{Object.entries(featureLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><label>분류 이유<textarea value={item.reason} onChange={e=>changeItem(index,{reason:e.target.value})}/></label><label>미확인·한계<textarea value={item.limitations} onChange={e=>changeItem(index,{limitations:e.target.value})}/></label>{item.designRef?<p>고정 설계 참조 <RefLabel value={item.designRef}/></p>:<p>설계 문서 참조 미선택</p>}
    <BaselineDesignPicker key={buffer.bindingId+':'+index} client={client} session={session} buffer={buffer} index={index} disabled={!editable} onAuthenticationLost={onAuthenticationLost} onApply={(captured,next)=>{if(!editable||working.current)return;onChange(previous=>previous===captured&&previous.projectId===projectId&&previous.ownerUserId===session.user.id&&previous.ownerClientId===session.clientId&&previous.controlGeneration===project?.controlState.generation?next:previous);setDecision(null);}}/>
    <label>근거 파일 보관<input type="file" onChange={e=>{const file=e.target.files?.[0]??null;e.target.value='';upload(index,file);}}/></label><p>새 원문은 보호 저장하고 READY·hash 일치만 연결합니다. 자동 내용 합격이 아닙니다.</p>{item.evidenceRefs.map(r=><p key={r.artifactId}>{r.artifactId} · {r.bytes} bytes <button type="button" onClick={()=>changeItem(index,{evidenceRefs:item.evidenceRefs.filter(v=>v.artifactId!==r.artifactId)})}>이 초안에서 연결만 제거</button></p>)}<button type="button" onClick={()=>changeInput(b=>({...b,input:{...b.input,items:b.input.items.filter((_,n)=>n!==index)}}))}>이 초안에서 항목 제거</button></fieldset>)}
   <button disabled={!editable||buffer.input.items.length>=200} onClick={()=>changeInput(b=>({...b,input:{...b.input,items:[...b.input.items,{itemId:'',title:'',designRef:null,featureState:'NOT_IMPLEMENTED',evidenceRefs:[],limitations:'',reason:''}]}}))}>기능 항목 추가</button><button disabled={!editable} onClick={()=>write('saveBaselineDraft')}>초안 저장 · 미확정</button>
   <section aria-label="기준선 근거 원문">{buffer.input.items.flatMap(i=>i.evidenceRefs.map(r=><p key={i.itemId+':'+r.artifactId}>{i.title} · {r.artifactId} <button disabled={busy} onClick={()=>void evidence(r)}>보호 원문 조회</button></p>))}</section>
   {original?<section aria-label="확인한 근거 원문"><p>{original.ref.artifactId} · 길이·hash 일치 · 내용 합격은 별도</p>{original.text!==null?<pre>{original.text}</pre>:<p>텍스트로 실행·렌더링하지 않는 형식입니다.</p>}<button onClick={()=>downloadEvidence(original)}>원문 파일 다운로드</button></section>:null}
   <button disabled={locked||buffer.dirty||!buffer.saved} onClick={()=>{if(buffer.reviewDirty&&!confirm('이 탭의 미저장 검토 대신 새 내용 검토를 시작할까요?'))return;try{update(buffer,p=>beginBaselineReview(p,session));setDecision(null);}catch(e){setError(failure(e));}}}>저장된 정확 초안 내용 검토 시작</button>
   {buffer.review?<fieldset disabled={locked}><legend>책임 있는 사용자 내용 검토 · 독립 검토 자동 주장 없음</legend>{buffer.review.items.map((item,index)=><section key={item.itemId}><h4>{item.itemId} · {featureLabels[item.featureState]}</h4><label>항목 판정<Outcome value={item.outcome} onChange={v=>reviewChange(r=>({...r,items:r.items.map((i,n)=>n===index?{...i,outcome:v}:i)}))}/></label><label>항목 내용 검토 이유<textarea value={item.reason} onChange={e=>reviewChange(r=>({...r,items:r.items.map((i,n)=>n===index?{...i,reason:e.target.value}:i)}))}/></label>
    {item.featureState==='IMPLEMENTED_CORE_CHECKED'?<section><label>핵심 동작 근거 종류<select value={item.coreEvidence?.basis??'UNKNOWN'} onChange={e=>coreChange(index,{basis:e.target.value as BaselineCoreEvidence['basis']})}>{['UNKNOWN','ACTUAL','MOCK','STATIC','NOT_EXECUTED'].map(k=><option key={k}>{k}</option>)}</select></label><label>실제 확인 환경<input value={item.coreEvidence?.environment??''} onChange={e=>coreChange(index,{environment:e.target.value})}/></label><label>확인 시각 · UTC ISO 밀리초<input placeholder="2026-10-18T07:00:00.000Z" value={item.coreEvidence?.checkedAt??''} onChange={e=>coreChange(index,{checkedAt:e.target.value})}/></label>{(['normalFlow','storageRead','importantFailure']as const).map(k=><div key={k}><p>{{normalFlow:'실제 정상 처리',storageRead:'실제 저장·조회',importantFailure:'중요 실패 조건'}[k]} 근거를 직접 선택</p>{item.evidenceRefs.map(r=><label key={r.artifactId}><input type="checkbox" checked={!!item.coreEvidence?.[k].some(v=>same(v,r))} onChange={e=>coreChange(index,{[k]:e.target.checked?[...(item.coreEvidence?.[k]??[]),r]:(item.coreEvidence?.[k]??[]).filter(v=>!same(v,r))})}/>{r.artifactId}</label>)}</div>)}</section>:null}</section>)}
    <label>범위 검토 판정<Outcome value={buffer.review.coverage.outcome} onChange={v=>reviewChange(r=>({...r,coverage:{...r.coverage,outcome:v}}))}/></label><label>범위 검토 이유<textarea value={buffer.review.coverage.reason} onChange={e=>reviewChange(r=>({...r,coverage:{...r.coverage,reason:e.target.value}}))}/></label><label>전체 내용 검토 판정<Outcome value={buffer.review.outcome} onChange={v=>reviewChange(r=>({...r,outcome:v}))}/></label><label>전체 검토 이유<textarea value={buffer.review.reason} onChange={e=>reviewChange(r=>({...r,reason:e.target.value}))}/></label><button disabled={buffer.dirty} onClick={()=>write('reviewBaselineContent')}>사용자 내용 검토 저장 · 아직 채택 아님</button>
   </fieldset>:null}
   <button disabled={busy||!buffer.saved} onClick={()=>{if(buffer.saved)void action(async active=>{setDecision(null);const d=await readBaselineDecision(client,projectId,buffer.saved!.ref);if(active())setDecision(d);});}}>정확 저장본의 최신 검토 조회</button>
   {decision?<section aria-label="기준선 최신 검토"><p>최신 내용 검토 {decision.latestReviewAccepted?'기록 내용 적합':'적합 판정 없음'} · 현재 head {String(decision.draftIsHead)} · 보호 근거 {decision.currentCheck.state}</p>{decision.reviews.map(r=><details key={r.ref.id}><summary>검토 {r.snapshot.input.outcome} · {r.snapshot.reviewedAt}</summary><RefLabel value={r.ref}/><pre>{JSON.stringify(r.snapshot,null,2)}</pre></details>)}{decision.hasMoreReviews?<p>200건 밖의 검토가 더 있습니다. 최신 판정은 첫 기록입니다.</p>:null}{decision.adoptedRef?<p>이미 채택된 고정 기록 <RefLabel value={decision.adoptedRef}/></p>:null}</section>:null}
   <fieldset disabled={locked||buffer.dirty||buffer.reviewDirty||!buffer.saved}><legend>별도 사용자 채택</legend><label>채택 이유<textarea value={buffer.confirmation.reason} onChange={e=>update(buffer,p=>({...p,confirmation:{...p.confirmation,reason:e.target.value}}))}/></label><label><input type="checkbox" checked={buffer.confirmation.acknowledged} onChange={e=>update(buffer,p=>({...p,confirmation:{...p.confirmation,acknowledged:e.target.checked}}))}/>기능 상태 기록을 채택합니다. 소스 권한·작업 시작·기능 전체 합격을 뜻하지 않습니다.</label><button disabled={!buffer.confirmation.acknowledged} onClick={()=>write('confirmBaseline')}>최신 적합 검토 재확인 후 이 버전 채택</button></fieldset>
  </>:null}
 </section>;
}
function Outcome({value,onChange}:{value:BaselineReviewOutcome;onChange:(v:BaselineReviewOutcome)=>void}){return <select value={value} onChange={e=>onChange(e.target.value as BaselineReviewOutcome)}>{Object.entries(outcomes).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select>;}
function ItemSummary({items,renderEvidence}:{items:BaselineItem[];renderEvidence?:(item:BaselineItem)=>ReactNode}){return <ul>{items.map(i=><li key={i.itemId}>{i.itemId} · {i.title} · {featureLabels[i.featureState]}<p>한계: {i.limitations}</p><p>근거 {i.evidenceRefs.length}건 · 분류 이유: {i.reason}</p>{renderEvidence?.(i)}</li>)}</ul>;}
function BaselineRecord({record,evidence,busy,onEvidence,onCloseEvidence,onDownloadEvidence}:{record:AdoptionRecord;evidence:AdoptedEvidence|null;busy:boolean;onEvidence:(itemId:string,ref:BaselineEvidenceRef)=>void;onCloseEvidence:(selection:AdoptionSelection)=>void;onDownloadEvidence:(selection:AdoptionSelection,value:EvidenceOriginal)=>void}){
 const {value,slot}=record,label=adoptionLabels[slot],original=evidence?.original;
 return <section aria-label={label}><h3>{value.status==='UNCONFIRMED'?'아직 채택된 기준선 없음':value.status==='LEGACY_UNVERIFIED'?'옛 기록 · 결박 미확인':label+' · 사용자 채택 기록'}</h3>
  {value.ref?<RefLabel value={value.ref}/>:null}
  <p>과거 채택 사실 {String(value.contentConfirmed)} · 현재 내용 검토 유효 {String(value.currentContentReviewValid??false)} · 현재 보호 근거 {value.currentCheck?.state??'미확인'}</p><p>소스 접근/완전성 검증·Agent 실행 허가 없음</p>
  {value.status==='FEATURE_STATUS_V1'&&value.snapshot?<><ItemSummary items={value.snapshot.input.items} renderEvidence={item=>item.evidenceRefs.map(ref=><p key={ref.artifactId}><span>{ref.artifactId} · {ref.bytes} bytes</span> <button type="button" disabled={busy} aria-label={`${label} ${item.itemId} 근거 원문 조회 ${ref.artifactId}`} onClick={()=>onEvidence(item.itemId,ref)}>근거 원문 조회</button></p>)}/>
   <details><summary>고정 기록 원본 JSON</summary><pre>{JSON.stringify(value.snapshot,null,2)}</pre></details>
  </>:null}
  {evidence?<section aria-label="채택 근거 원문">
   <h4>{evidence.selection.itemId} · {evidence.selection.artifact.artifactId}</h4>
   <button type="button" onClick={()=>onCloseEvidence(evidence.selection)}>채택 근거 원문 닫기</button>
   {evidence.error?<p role="alert">{evidence.error.code} · 근거 원문 조회 실패</p>:original?<><p>채택 당시 근거 · 길이와 해시 일치 · 현재 내용 유효성 미확인</p>
    {original.text!==null?<pre>{original.text}</pre>:<p>텍스트로 표시하지 않는 형식입니다.</p>}
    <button type="button" onClick={()=>onDownloadEvidence(evidence.selection,original)}>원문 파일 다운로드</button>
   </>:<p role="status">채택 근거 원문 확인 중</p>}
  </section>:null}
 </section>;
}
