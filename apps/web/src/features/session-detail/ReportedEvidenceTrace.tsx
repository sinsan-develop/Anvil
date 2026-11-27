import {useLayoutEffect,useMemo,useRef,useState,type MouseEvent} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import {documentVersionHref} from '../../shell/routes.ts';
import type {DocumentSession} from '../design-trace/editor-api.ts';
import type {ArtifactTraceDetail} from './artifact-task-trace-api.ts';
import type {ReportedEvidenceArtifactView} from './reported-evidence-artifact.ts';
import {createReportedEvidenceTrace,type ReportedEvidenceTracePage} from './reported-evidence-trace.ts';
import type {SubmittedResultView} from './result-api.ts';

interface Props {
 client:ApiClient;
 detail:ArtifactTraceDetail;
 evidence:Extract<ReportedEvidenceArtifactView,{bytesState:'MATCHED_REGISTERED_BYTES'}>;
 result:SubmittedResultView;
 session:DocumentSession;
 onAuthenticationLost:()=>void;
 onAccessUnavailable:(code:string)=>void;
}
interface Ticket {
 scope:object;
 pending:boolean;
 page:ReportedEvidenceTracePage|null;
 reader:ReturnType<typeof createReportedEvidenceTrace>;
}
interface View {
 ticket:Ticket;
 pending:boolean;
 page:ReportedEvidenceTracePage|null;
 error:string|null;
}

export function ReportedEvidenceTrace({client,detail,evidence,result,session,onAuthenticationLost,onAccessUnavailable}:Props){
 const transport=client.transport,route=globalThis.location?.hash;
 const scope=useMemo(()=>({}),[client,transport,detail,evidence,result,session.user.id,session.clientId,session.csrfToken,route]);
 const committed=useRef<object|null>(null),owner=useRef<Ticket|null>(null),[view,setView]=useState<View|null>(null);
 const shown=view?.ticket.scope===scope&&owner.current===view.ticket?view:null;
 useLayoutEffect(()=>{
  committed.current=scope;
  return ()=>{committed.current=null;owner.current=null;};
 },[scope]);
 const scopeCurrent=()=>committed.current===scope&&client.transport===transport&&globalThis.location?.hash===route;
 const active=(ticket:Ticket)=>owner.current===ticket&&scopeCurrent();
 async function read(ticket:Ticket,expected:ReportedEvidenceTracePage|null){
  if(!active(ticket)||ticket.pending||ticket.page!==expected)return;
  ticket.pending=true;
  ticket.page=null;
  setView({ticket,pending:true,page:null,error:null});
  try{
   const page=await ticket.reader.next();
   if(active(ticket)&&page){
    ticket.page=page;
    setView({ticket,pending:false,page,error:null});
   }
  }catch(error){
   if(!active(ticket))return;
   const failure=error instanceof ApiError?error:new ApiError('REPORTED_EVIDENCE_TRACE_INCONSISTENT');
   const code=/^[A-Z_]{1,80}$/.test(failure.code)?failure.code:'REPORTED_EVIDENCE_TRACE_INCONSISTENT';
   setView({ticket,pending:false,page:null,error:code});
   if([401,403,404].includes(failure.status))onAccessUnavailable(code);
   if(failure.status===401&&active(ticket))onAuthenticationLost();
  }finally{ticket.pending=false;}
 }
 function open(){
  if(!scopeCurrent()||owner.current||!detail.confirmed)return;
  const ticket:Ticket={scope,pending:false,page:null,reader:createReportedEvidenceTrace(client,detail,result,evidence,()=>active(ticket))};
  owner.current=ticket;
  void read(ticket,null);
 }
 function close(){
  if(!shown||!active(shown.ticket))return;
  owner.current=null;setView(null);
 }
 function guardDocumentLink(event:MouseEvent<HTMLAnchorElement>){
  if(!shown||!active(shown.ticket)||shown.ticket.pending||shown.ticket.page!==shown.page)event.preventDefault();
 }
 const task=detail.confirmed?.snapshot.definition.taskRef;
 return <section aria-label="시험 근거의 설계 위치">
  {!shown?<button type="button" onClick={open}>시험 근거에서 원 설계 위치 확인</button>:<>
   <button type="button" onClick={close}>시험 근거 설계 위치 닫기</button>
   <p>등록 원문에서 고정 계획 업무와 설계 위치의 저장 연결을 조회합니다. 시험 수행·명령과 종료 코드·출처·완료는 미검증입니다.</p>
   {shown.pending?<p role="status">저장 연결 조회 중</p>:null}
   {shown.error?<p role="alert">{shown.error} · 저장 연결 확인 불가</p>:null}
   {shown.page?.state==='MORE'?<>
    <p>확인할 다음 페이지가 있습니다. 아직 저장 연결을 판정할 수 없습니다.</p>
    <button type="button" onClick={()=>void read(shown.ticket,shown.page)}>다음 설계 연결 더 보기</button>
   </>:null}
   {shown.page?.state==='FINISHED'?<>
    {shown.page.matches.length?<>
     <p>계획 업무 {task?.taskCode} · {task?.planRef.id} v{task?.planRef.version} · SHA256 {task?.planRef.contentHash}</p>
     <ul>{shown.page.matches.map(match=><li key={match.targetEdgeId}>
      <strong>{match.target.localCode} · {match.title}</strong>
      <p>원 위치 {match.target.anchor} · {match.target.kind==='SCREEN_REGION'?'시안':'설계'} {match.target.versionRef.id} v{match.target.versionRef.version} · SHA256 {match.target.versionRef.contentHash}</p>
      {match.target.kind==='DESIGN_ITEM'||match.target.kind==='SCREEN_REGION'?
       <a href={documentVersionHref(result.snapshot.scope.projectId,match.target.versionRef)} onClick={guardDocumentLink} onAuxClick={guardDocumentLink}>
        {match.target.kind==='SCREEN_REGION'?'고정 시안 원문 열기':'고정 설계 원문 열기'}
       </a>:null}
      <p>산출물→업무 {match.artifactEdgeId} · SHA256 {match.artifactEdgeHash}</p>
      <p>업무→원 위치 {match.targetEdgeId} · SHA256 {match.targetEdgeHash}</p>
     </li>)}</ul>
    </>:<p>조회한 페이지에서 확인된 연결이 없습니다. 미연결 여부는 미확인입니다.</p>}
   </>:null}
  </>}
 </section>;
}
