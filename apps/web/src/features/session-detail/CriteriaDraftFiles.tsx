import {useEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import {documentControl,type DocumentSession} from '../design-trace/editor-api.ts';
import type {ConfirmedAssignmentView} from '../workspace/assignment-confirmation-api.ts';
import type {CriteriaRow} from './result-criteria-api.ts';
import {encodeCriteriaDraft,decodeCriteriaDraft} from './criteria-draft-file.ts';
type Draft={rows:CriteriaRow[];reason:string};
export function CriteriaDraftFiles({client,assignment,session,draft,canImport,canExport,disabled,onRestore,onAccessUnavailable,onAuthenticationLost}:{client:ApiClient;assignment:ConfirmedAssignmentView;session:DocumentSession;draft:Draft|null;canImport:boolean;canExport:boolean;disabled:boolean;onRestore:(value:Draft,generation:number)=>void;onAccessUnavailable:(code:string)=>void;onAuthenticationLost:()=>void}){
 const [busy,setBusy]=useState(false),[failure,setFailure]=useState<string|null>(null),live=useRef(true),working=useRef(false),current=useRef({draft,canImport,canExport,disabled});current.current={draft,canImport,canExport,disabled};
 useEffect(()=>{live.current=true;return()=>{live.current=false;};},[]);
 async function perform(file?:File){
  if(working.current||disabled||(file?!canImport:!canExport||!draft))return;
  const selected=draft;working.current=true;setBusy(true);setFailure(null);
  try{
   if(file){
    if(file.size>2097152)throw new ApiError('RESULT_CRITERIA_DRAFT_INVALID');
    let text:string;try{text=new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer());}catch{throw new ApiError('RESULT_CRITERIA_DRAFT_INVALID');}
    const value=await decodeCriteriaDraft(assignment,text);if(!live.current||current.current.disabled||!current.current.canImport)return;
    const generation=await documentControl(client,assignment.projectId,session);if(live.current&&!current.current.disabled&&current.current.canImport)onRestore(value,generation);
   }else{
    const text=await encodeCriteriaDraft(assignment,selected!.rows,selected!.reason);if(!live.current||current.current.disabled||!current.current.canExport||current.current.draft!==selected)return;
    const url=URL.createObjectURL(new Blob([text],{type:'application/json;charset=utf-8'}));try{const a=document.createElement('a');a.href=url;a.download='anvil-criteria-draft-'+assignment.ref.id+'.json';a.click();}finally{setTimeout(()=>URL.revokeObjectURL(url),0);}
   }
  }catch(cause){if(live.current){const error=cause instanceof ApiError?cause:new ApiError('RESULT_CRITERIA_DRAFT_INVALID');setFailure(error.code);if([401,403,404].includes(error.status))onAccessUnavailable(error.code);if(error.status===401)onAuthenticationLost();}}
  finally{working.current=false;if(live.current)setBusy(false);}
 }
 return <section aria-label="검수 기준 입력 파일"><p className="meta">입력만 사용자 파일로 보존합니다. 파일은 서버 보호 밖에 있으며 작성자 진위·저장·명령·실행 허가가 아닙니다. 명령/인증정보는 포함하지 않고 같은 확정 임무의 빈 입력에만 복원합니다.</p>
  {canExport?<button type="button" disabled={disabled||busy} onClick={()=>void perform()}>기준 입력 파일로 저장</button>:null}
  <label>기준 입력 파일 불러오기<input type="file" accept=".json,application/json" disabled={disabled||busy||!canImport} onChange={event=>{const file=event.target.files?.[0];event.target.value='';if(file)void perform(file);}}/></label>
  {failure?<p role="alert">{failure} · 기존 입력/명령은 변경하지 않았습니다.</p>:null}{busy?<p role="status">기준 입력 파일 대조 중</p>:null}
 </section>;
}
