import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import type {DocumentSummary} from './api.ts';
import type {DocumentBuffer,DocumentSession} from './editor-api.ts';
import {listWorkPlans,readWorkPlan,prepareStoredWorkPlan,type WorkPlanPage,type WorkPlanView,type PlanRef} from './work-plan-api.ts';
import{readWorkPlanDecision,type PlanDecisionView}from'./work-plan-decision-api.ts';
import {WorkPlanReferences} from './WorkPlanReference.tsx';
import {StoredPlanTasks} from './StoredPlanTasks.tsx';
import {StoredPlanTaskRelations} from './StoredPlanTaskRelations.tsx';
import {WorkPlanVersionHistory} from './WorkPlanVersionHistory.tsx';
import {PlanDocumentOriginal} from './PlanDocumentOriginal.tsx';
import {StoredPlanTraceCoverage} from './StoredPlanTraceCoverage.ts';
import {TraceTaskEvidence} from './TraceTaskEvidence.tsx';
import {ordered} from '../knowledge/review-view.ts';
import type {TraceRef} from './trace-api.ts';
type LibraryProps={client:ApiClient;projectId:string;session:DocumentSession;documents:DocumentSummary[];canPrepare:boolean;onPrepared:(b:DocumentBuffer)=>void;onBusy:(b:boolean)=>void;onAuthenticationLost:()=>void};
function confirmationMatches(plan:WorkPlanView,record:NonNullable<PlanDecisionView['confirmation']>){
 return ordered(record.planRef)===ordered(plan.ref)&&
  ordered(record.validation.sourceRefs)===ordered([plan.documentRef,plan.designRef])&&
  ordered(record.validation.screenReviewRefs)===ordered(plan.screenReviewRefs);
}
export function WorkPlanLibrary(props:LibraryProps){
  const {client,projectId,session}=props,identity=JSON.stringify([projectId,session.user.id,session.clientId,session.csrfToken]),scope=useRef({client,transport:client.transport,identity,generation:0});
  if(scope.current.client!==client||scope.current.transport!==client.transport||scope.current.identity!==identity)scope.current={client,transport:client.transport,identity,generation:scope.current.generation+1};
  const selected=scope.current,current=()=>scope.current===selected&&client.transport===selected.transport&&JSON.stringify([projectId,session.user.id,session.clientId,session.csrfToken])===identity;
  return <WorkPlanLibraryScope key={selected.generation} {...props} scopeCurrent={current}/>;
}
function WorkPlanLibraryScope({client,projectId,session,documents,canPrepare,onPrepared,onBusy,onAuthenticationLost,scopeCurrent}:LibraryProps&{scopeCurrent:()=>boolean}){
  const[decision,setDecision]=useState<PlanDecisionView|null>(null);
  const[revisionVersion,setRevisionVersion]=useState('');
  const [page,setPage]=useState<WorkPlanPage|null>(null),[view,setView]=useState<WorkPlanView|null>(null),[cursor,setCursor]=useState<string|null>(null),[documentId,setDocumentId]=useState<string|null>(null),[reload,setReload]=useState(0),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState<ApiError|null>(null),[ack,setAck]=useState(false),mounted=useRef(true),running=useRef(false);
  type EvidenceSelection={occurrence:number;serial:number;target:TraceRef};
  const occurrence=useRef(0),serial=useRef(0),latestEvidence=useRef<EvidenceSelection|null>(null);
  const [evidence,setEvidence]=useState<EvidenceSelection|null>(null);
  useLayoutEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  const active=()=>mounted.current&&scopeCurrent();
  const revokeEvidence=()=>{latestEvidence.current=null;setEvidence(null);};
  function invalidateEvidence(){occurrence.current++;revokeEvidence();}
  function invalidateDecision(){invalidateEvidence();setDecision(null);}
  function fail(cause:unknown){if(!active())return;const e=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');setError(e);if([401,403,404].includes(e.status)){invalidateDecision();setPage(null);setView(null);}if(e.status===401)onAuthenticationLost();}
  useEffect(()=>{let listening=true;const current=()=>listening&&active();setLoading(true);setError(null);listWorkPlans(client,projectId,cursor,documentId).then(v=>{if(current())setPage(old=>cursor&&old?{...v,items:[...new Map([...old.items,...v.items].map(i=>[i.ref.id,i])).values()]}:v);}).catch(e=>{if(current())fail(e);}).finally(()=>{if(current())setLoading(false);});return()=>{listening=false;};},[client,projectId,cursor,documentId,reload]);
  async function open(ref:PlanRef){
   if(!active()||running.current)return;
   invalidateDecision();const ticket=occurrence.current, current=()=>active()&&ticket===occurrence.current;
   running.current=true;setBusy(true);setView(null);setError(null);setAck(false);setRevisionVersion('');
   try{const v=await readWorkPlan(client,projectId,ref);if(current())setView(v);}catch(e){if(current())fail(e);}finally{running.current=false;if(active())setBusy(false);}
  }
  async function readDecision(){
   if(!active()||!view||running.current)return;
   invalidateDecision();const ticket=occurrence.current,current=()=>active()&&ticket===occurrence.current;
   running.current=true;setBusy(true);setError(null);
   try{
    const value=await readWorkPlanDecision(client,projectId,view);
    if(!current())return;
    if(value.confirmation&&!confirmationMatches(view,value.confirmation))throw new ApiError('RESPONSE_INVALID');
    setDecision(value);
   }catch(e){if(current())fail(e);}finally{running.current=false;if(active())setBusy(false);}
  }
  const recorded=view?.relationalProjection==='STORED'?decision?.confirmation:null;
  const counts=new Map<string,number>();
  if(recorded)for(const task of view!.tasks)counts.set(task.taskCode,(counts.get(task.taskCode)??0)+1);
  const tasks=recorded?view!.tasks.filter(task=>/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(task.taskCode)&&counts.get(task.taskCode)===1):[];
  const planOccurrence=occurrence.current;
  const canReadEvidence=()=>active()&&!!recorded&&!running.current&&planOccurrence===occurrence.current;
  function chooseEvidence(code:string){
   if(loading||error||!canReadEvidence())return;
   revokeEvidence();
   if(!code||!view||!tasks.some(task=>task.taskCode===code))return;
   const next:EvidenceSelection={occurrence:planOccurrence,serial:++serial.current,target:{kind:'PLAN_TASK',id:view.ref.id,versionRef:{...view.ref},localCode:code}};
   latestEvidence.current=next;setEvidence(next);
  }
  const validRevision=/^[1-9][0-9]{0,14}$/.test(revisionVersion)&&Number.isSafeInteger(Number(revisionVersion));
  async function prepare(mode:'REVISION'|'TRACE'='REVISION',explicit=false){if(!active()||!view||!canPrepare||mode==='REVISION'&&!ack||explicit&&!validRevision||running.current)return;revokeEvidence();running.current=true;setBusy(true);onBusy(true);setError(null);try{const b=await prepareStoredWorkPlan(client,projectId,view.ref,session,mode,{...(explicit?{documentVersion:Number(revisionVersion)}:{}),active});if(active())onPrepared(b);}catch(e){fail(e);}finally{running.current=false;onBusy(false);if(active())setBusy(false);}}
  return <section className="status-card" aria-label="보관한 작업계획"><h2>보관한 작업계획</h2><p className="meta">목록은 저장 당시 메타데이터입니다. 열 때 정확 원문·관계·hash를 다시 확인합니다. 초안 조회는 제어권·쓰기를 요구하지 않습니다.</p><button disabled={busy||loading} onClick={()=>{invalidateEvidence();setCursor(null);setReload(n=>n+1);}}>작업계획 목록 새로고침</button><label htmlFor="stored-plan-document">작업계획 원문 필터</label><select id="stored-plan-document" disabled={busy} value={documentId??''} onChange={e=>{invalidateDecision();setDocumentId(e.target.value||null);setCursor(null);setPage(null);setView(null);setAck(false);}}><option value="">모든 원문</option>{documents.map(d=><option key={d.id} value={d.id}>{d.title}</option>)}</select>
    {loading?<p role="status">작업계획 목록 조회 중</p>:null}{error?<p role="alert">{error.message} · {error.code} · 앞선 자료가 남아 있다면 과거 관측입니다.</p>:null}<ul>{page?.items.map(i=><li key={i.ref.id}><button aria-label={'보관 계획 '+i.ref.id+' 열기'} disabled={busy||loading||!!error} onClick={()=>{void open(i.ref);}}>{i.title} · 계획 v{i.ref.version}</button><p className="meta">원문 v{i.documentRef.version} · 설계 v{i.designRef.version} · 문제 {i.issueCount}건 · {new Date(i.updatedAt).toLocaleString('ko-KR')}</p></li>)}</ul>{page&&!loading&&!page.items.length?<p>보관한 작업계획이 없습니다.</p>:null}{page?.hasMore?<button disabled={busy||loading||!!error} onClick={()=>{invalidateEvidence();setCursor(page.nextCursor);}}>다음 작업계획 더 보기</button>:null}
    {view?<section aria-label="보관 작업계획 상세"><h3>계획 v{view.ref.version} · 초안</h3><p>SHA256 {view.ref.contentHash}</p><p>실제 실행/시험 증거: 미연결</p><p>저장 이유: {view.reason}</p><ul>{view.issues.map((i,n)=><li key={n}>{i.code} · {i.location} · {i.message}</li>)}</ul><StoredPlanTasks key={JSON.stringify([projectId,session.user.id,session.clientId,view.ref])} tasks={view.tasks}/><StoredPlanTaskRelations key={'plan-relations:'+JSON.stringify([projectId,session.user.id,session.clientId,view.ref])} view={view}/><label><input type="checkbox" disabled={busy||!canPrepare} checked={ack} onChange={e=>setAck(e.target.checked)}/>이 계획을 새 개정 초안으로 준비하겠습니다</label><button disabled={busy||!canPrepare||!ack} onClick={()=>{void prepare();}}>이 계획에서 개정 준비</button><p>보관 원문 {view.documentRef.id} · v{view.documentRef.version} · SHA256 {view.documentRef.contentHash}</p><label>개정할 원문 버전<input aria-label="개정할 원문 버전" type="number" min="1" disabled={busy||!canPrepare} value={revisionVersion} onChange={e=>setRevisionVersion(e.target.value)}/></label><button disabled={busy||!canPrepare||!ack||!validRevision} onClick={()=>void prepare('REVISION',true)}>선택한 원문 버전으로 개정 준비</button><p className="meta">같은 AF04 문서의 지정 버전을 읽고 현재 원문 버전과 대조합니다. 기존 계획 ID·버전은 유지하며 저장은 별도입니다.</p>{!canPrepare?<p>다른 편집·검토·확정 작업을 닫은 뒤 개정할 수 있습니다. 조회는 가능합니다.</p>:null}</section>:null}
    {view?<WorkPlanReferences key={JSON.stringify([projectId,session.user.id,session.clientId,view.ref,cursor,documentId,reload])} client={client} projectId={projectId} session={session} view={view} onAuthenticationLost={onAuthenticationLost}/>:null}
    {view&&!busy&&!loading&&!error?<StoredPlanTraceCoverage key={'coverage:'+JSON.stringify([projectId,session.user.id,session.clientId,view.ref,view.designRef,cursor,documentId,reload])} client={client} projectId={projectId} session={session} view={view} onAuthenticationLost={onAuthenticationLost}/>:null}
    {view&&!busy&&!loading&&!error?<PlanDocumentOriginal key={'plan-original:'+JSON.stringify([projectId,session.user.id,session.clientId,view.ref,view.documentRef,cursor,documentId,reload])} client={client} projectId={projectId} session={session} view={view} onAuthenticationLost={onAuthenticationLost}/>:null}
    {view&&!busy&&!loading&&!error?<WorkPlanVersionHistory key={'plan-history:'+JSON.stringify([projectId,session.user.id,session.clientId,view.ref,view.documentRef,cursor,documentId,reload])} client={client} projectId={projectId} session={session} observedPlan={view} onAuthenticationLost={onAuthenticationLost}/>:null}
    {view?<button disabled={busy} onClick={()=>void readDecision()}>계획 검토·확정 상태 조회</button>:null}
    {view&&decision?<section aria-label="보관 계획 검토·확정"><p>관측 {new Date(decision.observedAt).toLocaleString('ko-KR')} · 계획 v{decision.planRef.version} / 최신 v{decision.headVersion}</p><p>{decision.confirmation?'별도 계획 확정 이력 있음':'별도 계획 확정 이력 없음'}</p><p>현재 확정 조건: {decision.currentConfirmationValid?'충족':'미충족'}</p><p>자동 기준 활성화·실행 없음 · 저장 당시 초안과 별도 확정 이력은 분리됩니다.</p>{decision.confirmation?<p>확정 ID {decision.confirmation.id} · {new Date(decision.confirmation.confirmedAt).toLocaleString('ko-KR')}</p>:null}<ul>{decision.validation.issues.map((i,n)=><li key={n}>{i.message} · {i.code}</li>)}</ul>{decision.contentReviews.length?decision.contentReviews.map(r=><details key={r.ref.id}><summary>{r.ref.outcome==='ACCEPTED'?'적합':r.ref.outcome==='REWORK'?'보완 필요':r.ref.outcome==='BLOCKED'?'차단':'미실행'} · {r.reason}</summary><p>사람 검토 · {new Date(r.reviewedAt).toLocaleString('ko-KR')} · 원문 작성자와 {r.reviewer.sameAsTargetRecorder?'같음':'다름'}</p>{r.items.map(i=><p key={i.criterionId}>{decision.criteria.items.find(c=>c.criterionId===i.criterionId)?.title} · {i.outcome} · {i.reason}</p>)}</details>):<p>별도 계획 내용검토 없음</p>}</section>:null}
    {view?<button disabled={busy||!canPrepare||!['STORED','ISSUES_ONLY'].includes(view.relationalProjection)} onClick={()=>{void prepare('TRACE');}}>이 계획 업무 연결 준비</button>:null}
    {tasks.length>0&&!busy&&!loading&&!error?<section aria-label="확정 계획 업무의 임무 조회">
     <p>보관된 확정 이력의 업무입니다. 현재 계획의 효력과 실행 허가는 별도입니다.</p>
     <label>확정 임무를 찾을 업무<select aria-label="확정 임무를 찾을 업무" value={evidence?.target.localCode??''} onChange={event=>chooseEvidence(event.target.value)}>
      <option value="">업무 선택</option>{tasks.map(task=><option key={task.taskCode} value={task.taskCode}>{task.taskCode} · {task.title}</option>)}
     </select></label>
     {evidence?<TraceTaskEvidence key={evidence.serial} client={client} projectId={projectId} target={evidence.target} context={String(evidence.serial)}
      scopeCurrent={()=>canReadEvidence()&&latestEvidence.current===evidence&&evidence.occurrence===occurrence.current} onAuthenticationLost={onAuthenticationLost}/>:null}
    </section>:null}
  </section>;
}
