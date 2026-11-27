import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import {ordered} from '../knowledge/review-view.ts';
import type {SubmittedResultView} from './result-api.ts';
import {inspectReportedCommands} from './reported-command-output.ts';
import {readReportedCommandEvidence,readReportedCommandEvidenceBytes,type CommandEvidenceSelection,type CommandEvidenceView,type CommandEvidenceBytesView} from './reported-command-evidence.ts';

type EvidenceValue={kind:'TEXT';value:CommandEvidenceView}|{kind:'BYTES';value:CommandEvidenceBytesView};
export function ReportedCommandEvidenceFiles({client,result,isCurrent,onAuthenticationLost,onAccessUnavailable}:{client:ApiClient;result:SubmittedResultView;isCurrent?:()=>boolean;onAuthenticationLost:()=>void;onAccessUnavailable:(code:string)=>void}){
 const binding=ordered([result.snapshot.scope,result.ref]),owner=useRef({client,transport:client.transport,result,binding,route:globalThis.location?.hash,valid:true});
 if(!owner.current.valid||owner.current.client!==client||owner.current.transport!==client.transport||owner.current.result!==result||owner.current.binding!==binding||owner.current.route!==globalThis.location?.hash)owner.current={client,transport:client.transport,result,binding,route:globalThis.location?.hash,valid:true};
 const scope=owner.current,alive=useRef(false),controller=useRef<AbortController|null>(null);
 type Selection={owner:typeof scope;pick:CommandEvidenceSelection;kind:'TEXT'|'BYTES'};
 const [selection,setSelection]=useState<Selection|null>(null),[loaded,setLoaded]=useState<{selection:Selection;value:EvidenceValue|null;error:string|null}|null>(null),requested=useRef<Selection|null>(null);
 const lost=useRef(onAuthenticationLost),unavailable=useRef(onAccessUnavailable);lost.current=onAuthenticationLost;unavailable.current=onAccessUnavailable;
 const parentCurrent=useRef(isCurrent);parentCurrent.current=isCurrent;
 const current=()=>{if(parentCurrent.current?.()===false)scope.valid=false;return alive.current&&scope.valid&&owner.current===scope&&client.transport===scope.transport&&globalThis.location?.hash===scope.route;};
 const selected=selection?.owner===scope&&current()?selection:null;requested.current=selected;
 const commands=inspectReportedCommands(result.snapshot.manifest.commandResults),shown=selected&&loaded?.selection===selected?loaded:null;
 function close(){requested.current=null;controller.current?.abort();controller.current=null;setSelection(null);setLoaded(null);}
 useLayoutEffect(()=>{alive.current=true;return()=>{alive.current=false;requested.current=null;controller.current?.abort();};},[]);
 useLayoutEffect(()=>{
  const hash=(value:string)=>{try{return new URL(value).hash;}catch{return null;}};
  const changed=(event:HashChangeEvent)=>{
   if(owner.current!==scope||!scope.valid)return;
   const before=event.oldURL?hash(event.oldURL):scope.route,after=event.newURL?hash(event.newURL):globalThis.location?.hash;
   if(before!==scope.route||after!==scope.route||globalThis.location?.hash!==scope.route){scope.valid=false;close();}
  };
  globalThis.addEventListener?.('hashchange',changed);return()=>globalThis.removeEventListener?.('hashchange',changed);
 },[scope]);
 useEffect(()=>{
  if(!selected)return;let active=true;const cancel=new AbortController();controller.current=cancel;
  const check=()=>active&&current()&&requested.current===selected&&!cancel.signal.aborted;
  const read=async():Promise<EvidenceValue|null>=>{
   if(selected.kind==='BYTES'){const value=await readReportedCommandEvidenceBytes(client,selected.owner.result,selected.pick,check,cancel.signal);return value?{kind:'BYTES',value}:null;}
   const value=await readReportedCommandEvidence(client,selected.owner.result,selected.pick,check);return value?{kind:'TEXT',value}:null;
  };
  read().then(value=>{if(check()&&value)setLoaded({selection:selected,value,error:null});}).catch(cause=>{
   if(!check())return;const e=cause instanceof ApiError?cause:new ApiError('COMMAND_EVIDENCE_FILE_BINDING_INVALID'),code=/^[A-Z_]{1,80}$/.test(e.code)?e.code:'COMMAND_EVIDENCE_FILE_BINDING_INVALID';
   setLoaded({selection:selected,value:null,error:code});if([401,403,404].includes(e.status))unavailable.current(code);if(e.status===401)lost.current();
  });return()=>{active=false;cancel.abort();if(controller.current===cancel)controller.current=null;};
 },[selected]);
 const choose=(pick:CommandEvidenceSelection,kind:'TEXT'|'BYTES')=>{
  if(!current())return;controller.current?.abort();const next={owner:scope,pick,kind};requested.current=next;setLoaded(null);setSelection(next);
 };
 const value=shown?.value?.value;
 return <section className="status-card" aria-label="명령 개별 근거 파일 대조"><h5>명령 개별 근거 파일 대조</h5>
  <p>명령 출력과 별개로 선택한 근거 선언만 보관 파일과 대조합니다. 출처·환경은 수행자 선언이며 실제 수행/exit·검수/완료를 확인하지 않습니다.</p>
  {commands.listInvalid||commands.invalidIndices.length?<p>일부 명령 형식 미확인 · 정상 보고로 보정하지 않음</p>:null}
  {commands.rows.map(({index,value})=><div key={index}><h6>명령 보고 {index+1}</h6>{value.evidence.length?value.evidence.map((_,evidenceIndex)=><span key={evidenceIndex}><button type="button" onClick={()=>choose({commandIndex:index,evidenceIndex},'TEXT')}>명령 {index+1} 근거 {evidenceIndex+1} 원문 대조</button><button type="button" onClick={()=>choose({commandIndex:index,evidenceIndex},'BYTES')}>명령 {index+1} 근거 {evidenceIndex+1} 보관 bytes 대조</button></span>):<p>선언된 개별 근거 없음 · 실제 근거 부재 판정 아님</p>}</div>)}
  {selected?<><button type="button" disabled={!shown} onClick={()=>choose(selected.pick,selected.kind)}>선택 명령 근거 다시 대조</button><button type="button" onClick={()=>{if(current()&&requested.current===selected)close();}}>명령 근거 닫기</button></>:null}
  {selected&&!shown?<p role="status">선택 근거 결박·bytes 대조 중 · 이전 원문은 숨깁니다.</p>:null}
  {shown?.error?<p role="alert">{shown.error} · 근거 미확인. 다른 출력으로 대체하지 않습니다.</p>:null}
  {value?<article aria-label="선택 명령 근거 대조"><h6>명령 {value.selection.commandIndex+1} · 근거 {value.selection.evidenceIndex+1}</h6>
   <p>출처 선언 {value.reported.sourceKind} · 실제 출처 미검증</p>
   <details><summary>근거의 선언 5필드</summary><pre>{JSON.stringify(value.reported,null,2)}</pre></details>
   {value.file?<p>{shown?.value?.kind==='BYTES'?'선택 선언과 보호 파일 SHA 일치 · 원결과 귀속·실제 출처 미검증':'등록 bytes 일치 · 실제 명령 수행/성공 아님'}</p>:<p>파일 조회하지 않음 · {value.issues.join(', ')}</p>}
   {shown?.value?.kind==='TEXT'&&shown.value.value.file?<pre>{shown.value.value.file.text}</pre>:null}
   {shown?.value?.kind==='BYTES'&&shown.value.value.file?<><p>보관 bytes 길이 {shown.value.value.file.bytes} · SHA256 {shown.value.value.file.sha256}</p><p>{shown.value.value.file.artifactRef.id} · v{shown.value.value.file.artifactRef.version}</p></>:null}
  </article>:null}
 </section>;
}
