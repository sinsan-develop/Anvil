import {useEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import type {SubmittedResultView} from './result-api.ts';
import {inspectReportedCommands} from './reported-command-output.ts';
import {readReportedCommandEvidence,type CommandEvidenceSelection,type CommandEvidenceView} from './reported-command-evidence.ts';

export function ReportedCommandEvidenceFiles({client,result,onAuthenticationLost,onAccessUnavailable}:{client:ApiClient;result:SubmittedResultView;onAuthenticationLost:()=>void;onAccessUnavailable:(code:string)=>void}){
 const [selected,setSelected]=useState<CommandEvidenceSelection|null>(null),[revision,setRevision]=useState(0),[loaded,setLoaded]=useState<{key:string;value:CommandEvidenceView|null;error:string|null}|null>(null);
 const lost=useRef(onAuthenticationLost),unavailable=useRef(onAccessUnavailable);lost.current=onAuthenticationLost;unavailable.current=onAccessUnavailable;
 const commands=inspectReportedCommands(result.snapshot.manifest.commandResults),key=[result.snapshot.scope.projectId,result.ref.id,result.ref.version,result.ref.contentHash,selected?.commandIndex,selected?.evidenceIndex,revision].join(':'),shown=loaded?.key===key?loaded:null;
 useEffect(()=>{
  if(!selected)return;let active=true;
  readReportedCommandEvidence(client,result,selected,()=>active).then(value=>{if(active&&value)setLoaded({key,value,error:null});}).catch(cause=>{
   if(!active)return;const e=cause instanceof ApiError?cause:new ApiError('COMMAND_EVIDENCE_FILE_BINDING_INVALID'),code=/^[A-Z_]{1,80}$/.test(e.code)?e.code:'COMMAND_EVIDENCE_FILE_BINDING_INVALID';
   setLoaded({key,value:null,error:code});if([401,403,404].includes(e.status))unavailable.current(code);if(e.status===401)lost.current();
  });return()=>{active=false;};
 },[client,result,selected,key]);
 const choose=(pick:CommandEvidenceSelection)=>{setLoaded(null);setRevision(v=>v+1);setSelected(pick);};
 return <section className="status-card" aria-label="명령 개별 근거 파일 대조"><h5>명령 개별 근거 파일 대조</h5>
  <p>명령 출력과 별개로 선택한 근거 선언만 보관 파일과 대조합니다. 출처·환경은 수행자 선언이며 실제 수행/exit·검수/완료를 확인하지 않습니다.</p>
  {commands.listInvalid||commands.invalidIndices.length?<p>일부 명령 형식 미확인 · 정상 보고로 보정하지 않음</p>:null}
  {commands.rows.map(({index,value})=><div key={index}><h6>명령 보고 {index+1}</h6>{value.evidence.length?value.evidence.map((_,evidenceIndex)=><button type="button" key={evidenceIndex} onClick={()=>choose({commandIndex:index,evidenceIndex})}>명령 {index+1} 근거 {evidenceIndex+1} 원문 대조</button>):<p>선언된 개별 근거 없음 · 실제 근거 부재 판정 아님</p>}</div>)}
  {selected?<><button type="button" disabled={!shown} onClick={()=>choose(selected)}>선택 명령 근거 다시 대조</button><button type="button" onClick={()=>{setSelected(null);setLoaded(null);}}>명령 근거 닫기</button></>:null}
  {selected&&!shown?<p role="status">선택 근거 결박·bytes 대조 중 · 이전 원문은 숨깁니다.</p>:null}
  {shown?.error?<p role="alert">{shown.error} · 근거 미확인. 다른 출력으로 대체하지 않습니다.</p>:null}
  {shown?.value?<article aria-label="선택 명령 근거 대조"><h6>명령 {shown.value.selection.commandIndex+1} · 근거 {shown.value.selection.evidenceIndex+1}</h6>
   <p>출처 선언 {shown.value.reported.sourceKind} · 실제 출처 미검증</p>
   <details><summary>근거의 선언 5필드</summary><pre>{JSON.stringify(shown.value.reported,null,2)}</pre></details>
   {shown.value.file?<><p>등록 bytes 일치 · 실제 명령 수행/성공 아님</p><pre>{shown.value.file.text}</pre></>:<p>파일 조회하지 않음 · {shown.value.issues.join(', ')}</p>}
  </article>:null}
 </section>;
}
