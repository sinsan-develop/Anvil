import {useEffect,useLayoutEffect,useRef,useState,type Dispatch,type SetStateAction} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import {documentControl,type DocumentSession} from '../design-trace/editor-api.ts';
import type {DesignChangePage} from './api.ts';
import {ActivationScope,activationOwned,activationSame,newDesignActivation,prepareDesignActivation,readCurrentActivation,readFixedActivation,sendDesignActivation,type ActivationBuffer,type CurrentActivation,type FixedActivation} from './activation-api.ts';
import {documentVersionHref} from '../../shell/routes.ts';
import {readWorkPlan,type PlanRef} from '../design-trace/work-plan-api.ts';
import {readWorkPlanDecision} from '../design-trace/work-plan-decision-api.ts';
import {bindDesignActivationApproval} from '../decisions/design-activation-approval-api.ts';
import {readDesignActivationDecision} from './design-activation-decision-read.ts';
type Props={client:ApiClient;projectId:string;session:DocumentSession;page:DesignChangePage|null;selectionId:string;buffer:ActivationBuffer|null;onChange:Dispatch<SetStateAction<ActivationBuffer|null>>;onRequest:(buffer:ActivationBuffer)=>boolean;onAuthenticationLost:()=>void};
type HistorySelection={active:()=>boolean;value:FixedActivation};
type DecisionRead={owner:HistorySelection;busy:boolean;value:Awaited<ReturnType<typeof readDesignActivationDecision>>;error:string|null};
function ActivatedDecisionReason({client,projectId,selection,onAuthenticationLost}:{
 client:ApiClient;projectId:string;selection:HistorySelection;onAuthenticationLost:()=>void;
}){
 const owner=useRef<HistorySelection|null>(null),flight=useRef<object|null>(null);
 const [read,setRead]=useState<DecisionRead|null>(null);
 useLayoutEffect(()=>{owner.current=selection;return()=>{owner.current=null;flight.current=null;};},[selection]);
 const shown=read?.owner===selection&&selection.active()?read:null;
 async function load(){
  if(owner.current!==selection||!selection.active()||flight.current||shown)return;
  const ticket={},transport=client.transport;
  const active=()=>owner.current===selection&&selection.active()&&flight.current===ticket&&client.transport===transport;
  flight.current=ticket;
  setRead({owner:selection,busy:true,value:null,error:null});
  try{
   const value=await readDesignActivationDecision(client,projectId,selection.value,active);
   if(active()&&value)setRead({owner:selection,busy:false,value,error:null});
  }catch(cause){
   if(!active())return;
   const e=cause instanceof ApiError?cause:new ApiError('DESIGN_ACTIVATION_DECISION_MISMATCH');
   setRead({owner:selection,busy:false,value:null,error:/^[A-Z_]{1,80}$/.test(e.code)?e.code:'DESIGN_ACTIVATION_DECISION_MISMATCH'});
   if(e.status===401)onAuthenticationLost();
  }finally{if(flight.current===ticket)flight.current=null;}
 }
 return <section aria-label="당시 적용·승인 이유">
  {!shown?<button type="button" onClick={()=>void load()}>당시 적용·승인 이유 확인</button>:<>
   <button type="button" onClick={()=>{flight.current=null;setRead(null);}}>당시 적용·승인 이유 닫기</button>
   {shown.busy?<p role="status">저장된 적용·승인 이유 조회 중</p>:null}
   {shown.error?<p role="alert">{shown.error} · 당시 이유를 확인할 수 없습니다.</p>:null}
   {shown.value?<><h5>적용 후보 이유</h5><pre>{shown.value.candidateReason}</pre>
    <h5>승인 결정 이유</h5><pre>{shown.value.decisionReason}</pre>
    <p>요청 {shown.value.requestRef.id} · SHA256 {shown.value.requestRef.contentHash}</p>
    <p>승인 결정 {shown.value.decisionRef.id} · SHA256 {shown.value.decisionRef.contentHash}</p>
    <p>적용 당시 소비된 승인 기록입니다. 현재 승인 권한이나 실행 허가를 뜻하지 않습니다.</p>
   </>:null}
  </>}
 </section>;
}
function ActivatedPlanOriginal({client,selection,onAuthenticationLost}:{client:ApiClient;selection:HistorySelection;onAuthenticationLost:()=>void}){
 const owner=useRef(selection);owner.current=selection;
 const alive=useRef(true),flight=useRef<{selection:HistorySelection}|null>(null);
 const [read,setRead]=useState<{owner:HistorySelection;busy:boolean;documentRef:PlanRef|null;error:ApiError|null}|null>(null);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;flight.current=null;};},[]);
 const shown=read?.owner===selection&&selection.active()?read:null;
 async function load(){
  if(!selection.active()||flight.current?.selection===selection)return;
  const ticket={selection},transport=client.transport;flight.current=ticket;
  const active=()=>alive.current&&owner.current===selection&&selection.active()&&client.transport===transport&&flight.current===ticket;
  setRead({owner:selection,busy:true,documentRef:null,error:null});
  try{
   const snapshot=selection.value.snapshot,plan=await readWorkPlan(client,snapshot.projectId,snapshot.confirmedPlanRef);if(!active())return;
   if(!activationSame(plan.designRef,snapshot.approvedDesignRef))throw new ApiError('DESIGN_ACTIVATION_PLAN_MISMATCH');
   const decision=await readWorkPlanDecision(client,snapshot.projectId,plan);if(!active())return;
   const confirmation=decision.confirmation;
   if(!confirmation||!activationSame(confirmation.validation.sourceRefs,[plan.documentRef,plan.designRef])||!activationSame(confirmation.validation.screenReviewRefs,plan.screenReviewRefs))throw new ApiError('DESIGN_ACTIVATION_PLAN_CONFIRMATION_MISMATCH');
   setRead({owner:selection,busy:false,documentRef:plan.documentRef,error:null});
  }catch(cause){if(!active())return;const error=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');setRead({owner:selection,busy:false,documentRef:null,error});if(error.status===401)onAuthenticationLost();}
  finally{if(flight.current===ticket)flight.current=null;}
 }
 return <section aria-label="당시 확정 계획 원문"><button type="button" disabled={shown?.busy} onClick={()=>void load()}>당시 확정 계획 원문 확인</button>{shown?.busy?<p role="status">고정 계획·확정 기록 확인 중</p>:null}{shown?.error?<p role="alert">{shown.error.code} · 당시 확정 계획 원문을 확인할 수 없습니다.</p>:null}{shown?.documentRef?<><a href={documentVersionHref(selection.value.snapshot.projectId,shown.documentRef)}>당시 확정 계획 작성 문서 보기</a><p>당시 고정 버전의 확정 기록입니다. 현재 계획 유효성·적용·실행 허가를 뜻하지 않습니다.</p></>:null}</section>;
}
export function DesignActivationPanel({client,projectId,session,page,selectionId,buffer:b,onChange,onRequest,onAuthenticationLost}:Props){
 const scope=useRef(new ActivationScope()),alive=useRef(true),flight=useRef(false);const identity=JSON.stringify([session,projectId,selectionId,page?.change.ref??null,page?.latestImpactRef??null]);scope.current.bind(client,session,projectId,{selectionId,changeRef:page?.change.ref??(!selectionId?b?.input.changeRef:null)??null,impactRef:page?.latestImpactRef??(!selectionId?b?.input.impactRef:null)??null});
 const context=useRef({client,transport:client.transport,identity,generation:0});if(context.current.client!==client||context.current.transport!==client.transport||context.current.identity!==identity)context.current={client,transport:client.transport,identity,generation:context.current.generation+1};
 const [busy,setBusy]=useState(false),[error,setError]=useState<ApiError|null>(null),[ack,setAck]=useState(false),[requestId,setRequestId]=useState(''),[attempted,setAttempted]=useState(false),[blocked,setBlocked]=useState(false);
 const [current,setCurrent]=useState<{active:()=>boolean;value:CurrentActivation}|null>(null),[history,setHistory]=useState<{active:()=>boolean;value:FixedActivation}|null>(null);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);useEffect(()=>{flight.current=false;setBusy(false);setAck(false);},[context.current.generation]);
 const selected=!!b&&(page?activationSame(b.input.changeRef,page.change.ref)&&activationSame(b.input.impactRef,page.latestImpactRef):!selectionId),owned=!!b&&b.ownerUserId===session.user.id&&b.ownerClientId===session.clientId&&b.csrfToken===session.csrfToken&&b.api===client&&b.transport===client.transport;
 const shownCurrent=current?.active()?current.value:null,shownHistory=history?.active()?history.value:null;
 function update(expected:ActivationBuffer,next:ActivationBuffer){onChange(old=>old?.bindingId===expected.bindingId&&activationSame(old.pending,expected.pending)?next:old);}
 async function perform(run:(active:()=>boolean)=>Promise<void>){if(flight.current)return;flight.current=true;setBusy(true);setError(null);const token=scope.current.capture(),active=()=>alive.current&&token();try{await run(active);}catch(cause){if(!active())return;const e=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');setError(e);if([401,403,404].includes(e.status)){setCurrent(null);setHistory(null);setBlocked(true);}if(e.status===401)onAuthenticationLost();}finally{if(active()){flight.current=false;setBusy(false);}}}
 async function begin(active:()=>boolean){if(!page||b&&!b.receipt)throw new ApiError('DESIGN_ACTIVATION_INPUT_PRESERVED');const generation=await documentControl(client,projectId,session);if(!active())return;const blank={id:'',version:0,contentHash:''};onChange(old=>old&&!old.receipt?old:newDesignActivation(client,projectId,session,generation,{changeRef:page.change.ref,impactRef:page.latestImpactRef,approvedDesignRef:{...blank},confirmedPlanRef:{...blank},reason:''},null));setCurrent(null);setHistory(null);setAttempted(false);setBlocked(false);}
 async function inspectCurrent(active:()=>boolean){const value=await readCurrentActivation(client,projectId,active);if(!active()||!value)return;setCurrent({active,value});setHistory(null);setBlocked(false);if(b&&owned&&selected&&!b.pending&&!b.receipt&&!b.uncertain)update(b,{...b,current:value});}
 function edit(kind:'approvedDesignRef'|'confirmedPlanRef',field:'id'|'version'|'contentHash',value:string){if(!b||b.pending)return;const ref={...b.input[kind],[field]:field==='version'?Number(value):value};update(b,{...b,input:{...b.input,[kind]:ref}});setAck(false);}
 async function bind(active:()=>boolean){if(!b||!owned||!selected)throw new ApiError('DESIGN_ACTIVATION_BINDING_INVALID');const next=await bindDesignActivationApproval(client,b,requestId,session,active);if(!active())return;update(b,next);if(next.current)setCurrent({active,value:next.current});setBlocked(false);}
 async function apply(active:()=>boolean){if(!b||!owned||!selected||!b.pending||blocked)throw new ApiError('DESIGN_ACTIVATION_BINDING_INVALID');activationOwned(b,session,client);setAttempted(true);try{const receipt=await sendDesignActivation(client,b.pending,session,active);if(!active()||!receipt)return;update(b,{...b,receipt,uncertain:false,failure:null});}catch(cause){if(!active())return;const e=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');update(b,{...b,failure:{code:e.code,status:e.status},uncertain:b.uncertain||!e.status||e.code==='RESPONSE_INVALID'});throw e;}}
 async function inspect(ref:FixedActivation['ref'],active:()=>boolean){setHistory(null);const value=await readFixedActivation(client,projectId,ref,active);if(active()&&value)setHistory({active,value});}
 return <section className="status-card definition-editor" aria-label="설계 변경 적용"><h3>설계 변경 적용</h3><p>변경·영향·확정 설계와 계획을 확인해 별도 승인을 요청합니다. 실제 영향과 실행 안전이 확인되지 않으면 기준을 적용할 수 없습니다.</p>
  <button type="button" disabled={!page||busy||!!b&&!b.receipt} onClick={()=>void perform(begin)}>설계 변경 적용 준비</button>
   <button type="button" disabled={busy} onClick={()=>void perform(inspectCurrent)}>현재 적용 기준 확인</button>
   {shownCurrent?<section aria-label="현재 적용 기준">{shownCurrent.current.state==='NONE'?<p>최초 기준 등록 · 저장된 현재 기준과 적용 이력이 없습니다. 실제 실행·writer 부재를 뜻하지 않습니다.</p>:<><p>현재 적용 {shownCurrent.current.activationRef.id} · v{shownCurrent.current.activationRef.version} · SHA256 {shownCurrent.current.activationRef.contentHash}</p><button type="button" disabled={busy} onClick={()=>void perform(async active=>{if(shownCurrent.current.state==='PRESENT')await inspect(shownCurrent.current.activationRef,active);})}>적용 이력 원문 확인</button></>}<p>관측 {shownCurrent.observedAt} · 조회는 적용·실행 허가가 아닙니다.</p></section>:null}
   {shownHistory?<section aria-label="고정 적용 이력"><h4>고정 적용 이력</h4><p>{shownHistory.ref.id} · v{shownHistory.ref.version} · SHA256 {shownHistory.ref.contentHash} · {shownHistory.isCurrent?'관측 시점 현재 기준':'보존된 과거 기준'}</p><pre>{JSON.stringify(shownHistory.snapshot,null,2)}</pre><a href={documentVersionHref(shownHistory.snapshot.projectId,shownHistory.snapshot.approvedDesignRef)}>당시 확정 설계 원문 보기</a><ActivatedPlanOriginal client={client} selection={history!} onAuthenticationLost={onAuthenticationLost}/><ActivatedDecisionReason client={client} projectId={projectId} selection={history!} onAuthenticationLost={onAuthenticationLost}/><p>이 적용 사실은 실제 실행·검수 합격의 증거가 아닙니다.</p>{shownHistory.snapshot.previousActivationRef?<button type="button" disabled={busy} onClick={()=>void perform(active=>inspect(shownHistory.snapshot.previousActivationRef!,active))}>직전 적용 이력 확인</button>:null}</section>:null}
  {b&&owned?<><p>변경 {b.input.changeRef.id} · v{b.input.changeRef.version} · SHA256 {b.input.changeRef.contentHash}</p><p>영향 {b.input.impactRef.id} · v{b.input.impactRef.version} · SHA256 {b.input.impactRef.contentHash}</p>{!selected?<p role="status">다른 선택의 원 입력·명령을 보존했습니다. 현재 선택에서는 실행하지 않습니다.</p>:null}
   <fieldset disabled={busy||!!b.pending||!selected}><legend>적용 후보 입력</legend>{(['approvedDesignRef','confirmedPlanRef'] as const).map((kind,index)=><div key={kind}><label>{index?'적용할 확정 계획 ID':'적용할 확정 설계 ID'}<input autoComplete="off" maxLength={36} value={b.input[kind].id} onChange={e=>edit(kind,'id',e.target.value)}/></label><label>{index?'적용할 계획 버전':'적용할 설계 버전'}<input type="number" min={1} value={b.input[kind].version||''} onChange={e=>edit(kind,'version',e.target.value)}/></label><label>{index?'적용할 계획 SHA256':'적용할 설계 SHA256'}<input autoComplete="off" maxLength={64} value={b.input[kind].contentHash} onChange={e=>edit(kind,'contentHash',e.target.value)}/></label></div>)}<label>기준 적용 이유<textarea maxLength={20000} value={b.input.reason} onChange={e=>{if(b.pending)return;update(b,{...b,input:{...b.input,reason:e.target.value}});setAck(false);}}/></label></fieldset>
   <label><input type="checkbox" disabled={busy||!!b.pending||!shownCurrent||!selected} checked={ack} onChange={e=>setAck(e.target.checked)}/>정확한 적용 후보와 현재 기준을 확인했습니다</label><button type="button" disabled={busy||!ack||!shownCurrent||!!b.pending||!selected} onClick={()=>{try{const pending=prepareDesignActivation(b,session);update(b,{...b,pending});setError(null);}catch(e){setError(e instanceof ApiError?e:new ApiError('RESPONSE_INVALID'));}}}>적용 후보 고정</button>
   {b.pending?<><details><summary>보존한 정확 적용 명령</summary><pre>{JSON.stringify(b.pending,null,2)}</pre></details><button type="button" disabled={busy||!selected||!!b.pending.approvalRef||b.uncertain||!!b.receipt} onClick={()=>{try{if(!onRequest(b))throw new ApiError('APPROVAL_REQUEST_IN_PROGRESS');}catch(e){setError(e instanceof ApiError?e:new ApiError('RESPONSE_INVALID'));}}}>이 설계 변경 승인 요청 작성</button><label>적용 승인 요청 ID<input autoComplete="off" maxLength={36} value={requestId} onChange={e=>setRequestId(e.target.value)}/></label><button type="button" disabled={busy||!selected||!requestId.trim()||!!b.pending.approvalRef||b.uncertain||!!b.receipt} onClick={()=>void perform(bind)}>승인 원문 결박</button><button type="button" disabled={busy||!selected||blocked||!b.pending.approvalRef||!!b.receipt} onClick={()=>void perform(apply)}>{attempted||b.failure||b.uncertain?'같은 적용 명령 결과 확인':'설계 변경 별도 적용'}</button></>:null}
   {b.receipt?<p role="status">기준 적용 저장 확인 · {b.receipt.data.ref.id} · v{b.receipt.data.ref.version}. 실제 업무 재개·Agent 실행과는 별개입니다.</p>:null}{b.uncertain?<p role="status">처리 결과 미확인 · 원 입력과 같은 명령을 보존했습니다.</p>:null}
  </>:null}{busy?<p role="status">정확 후보·기준 확인 중</p>:null}{error?<p role="alert">{error.code} · 원 입력·명령은 보존했습니다.</p>:null}
 </section>;
}
