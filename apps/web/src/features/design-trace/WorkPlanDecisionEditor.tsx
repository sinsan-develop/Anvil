import{useEffect,useRef,useState,type Dispatch,type SetStateAction}from'react';
import{ApiClient,ApiError}from'../../api/client.ts';
import type{DocumentBuffer,DocumentSession}from'./editor-api.ts';
import{planOutcomes,prepareWorkPlanDecision,sendWorkPlanDecision,type WorkPlanDecisionBuffer,type PlanOutcome}from'./work-plan-decision-api.ts';
import{documentMutationUncertain,isKnownDocumentRejection}from'./mutation-result.ts';
const names={NOT_EXECUTED:'미실행',ACCEPTED:'적합',REWORK:'보완 필요',BLOCKED:'차단'};
export function WorkPlanDecisionEditor({client,session,buffer,onChange,onAuthenticationLost}:{client:ApiClient;session:DocumentSession;buffer:DocumentBuffer;onChange:Dispatch<SetStateAction<DocumentBuffer|null>>;onAuthenticationLost:()=>void}){
 const s=buffer.workPlanState!,d=s.decision!,mounted=useRef(true),flight=useRef<{owner:object}|null>(null),dispatch=useRef<object|null>(null),[activity,setActivity]=useState<object|null>(null);
 const identity=[client,client.transport,session.user.id,session.clientId,session.csrfToken,buffer.projectId,buffer.ownerUserId,buffer.controlGeneration,s.bindingId],owner=useRef({identity,decisions:new WeakSet([d])});
 if(identity.some((value,index)=>value!==owner.current.identity[index])||!owner.current.decisions.has(d))owner.current={identity,decisions:new WeakSet([d])};
 const captured=owner.current,busy=activity===captured,current=()=>mounted.current&&owner.current===captured&&client.transport===captured.identity[1];
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const locked=busy||!!d.pending||!!d.savedId,canClose=!d.uncertain&&(!d.pending||!!d.savedId||isKnownDocumentRejection(d.failure));
 function update(f:(v:WorkPlanDecisionBuffer)=>WorkPlanDecisionBuffer,dirty=true){onChange(b=>{if(!current()||b?.ownerUserId!==session.user.id||b.projectId!==buffer.projectId||b.workPlanState?.bindingId!==s.bindingId||b.workPlanState.decision!==d)return b;const next=f(d);captured.decisions.add(next);return{...b,dirty:dirty||b.dirty,workPlanState:{...b.workPlanState,decision:next}};});}
 async function save(){
  if(!current()||flight.current?.owner===captured||d.savedId)return;
  const attempt={owner:captured};flight.current=attempt;dispatch.current=attempt;setActivity(captured);let next=d;
  const active=()=>current()&&dispatch.current===attempt;
  const publish=(change:(value:WorkPlanDecisionBuffer)=>WorkPlanDecisionBuffer,dirty?:boolean)=>{const expected=next;onChange(b=>{if(!active()||b?.ownerUserId!==session.user.id||b.projectId!==buffer.projectId||b.workPlanState?.bindingId!==s.bindingId||b.workPlanState.decision!==expected)return b;const value=change(expected);captured.decisions.add(value);return{...b,dirty:dirty??b.dirty,workPlanState:{...b.workPlanState,decision:value}};});};
  try{
   if(!next.pending){const prepared={...next,pending:prepareWorkPlanDecision(next,session),failure:null};publish(()=>prepared,true);next=prepared;}
   const result=await sendWorkPlanDecision(client,next,session,active);
   if(active())publish(value=>({...value,savedId:result.id,uncertain:false,failure:null,dirty:false}),false);
  }catch(e){if(active()){const error=e instanceof ApiError?e:new ApiError('RESPONSE_INVALID');publish(value=>({...value,failure:{code:error.code,status:error.status},uncertain:next.pending?documentMutationUncertain(value.uncertain,error):value.uncertain}));if(error.status===401)onAuthenticationLost();}}
  finally{if(flight.current===attempt){flight.current=null;if(mounted.current)setActivity(value=>value===captured?null:value);}}
 }
 return<section className="status-card" aria-label="계획 검토·확정"><h3>{d.kind==='REVIEW'?'작업계획 내용검토':'작업계획 별도 확정'}</h3><p>계획 {d.target.planRef.id} v{d.target.planRef.version} · SHA256 {d.target.planRef.contentHash}</p><p>현재 원문·화면 검토·카드 준비 검사: {d.target.validation.validForConfirmation?'충족':'미충족'} · 실제 의미 검토/사용자 인수와 별개</p><ul>{d.target.validation.issues.map((i,n)=><li key={n}>{i.message} · {i.code}</li>)}</ul>
 {d.target.contentReviews[0]?<p>최근 내용검토: {names[d.target.contentReviews[0].ref.outcome]} · {d.target.contentReviews[0].reason}</p>:<p>계획 내용검토 없음</p>}{d.target.confirmation?<p>별도 확정 이력: {d.target.confirmation.id} · 현재 유효성 {d.target.currentConfirmationValid?'유효':'미충족'} · 자동 기준 활성화 없음</p>:null}
 {d.failure?<p role="alert">{new ApiError(d.failure.code,d.failure.status).message} · {d.failure.code} · 입력/명령 보존</p>:null}
 {d.kind==='REVIEW'?<fieldset disabled={locked}><legend>원문·업무 카드의 직접 내용검토</legend>{d.target.criteria.items.map(c=><section key={c.criterionId}><p>{c.title}</p><label>{c.criterionId} 판단<select aria-label={c.criterionId+' 판단'} value={d.items.find(i=>i.criterionId===c.criterionId)!.outcome} onChange={e=>update(v=>({...v,dirty:true,items:v.items.map(i=>i.criterionId===c.criterionId?{...i,outcome:e.target.value as PlanOutcome}:i)}))}>{planOutcomes.map(o=><option key={o} value={o}>{names[o]}</option>)}</select></label><label>{c.criterionId} 판단 이유<textarea aria-label={c.criterionId+' 판단 이유'} maxLength={20_000} value={d.items.find(i=>i.criterionId===c.criterionId)!.reason} onChange={e=>update(v=>({...v,dirty:true,items:v.items.map(i=>i.criterionId===c.criterionId?{...i,reason:e.target.value}:i)}))}/></label></section>)}<label>계획 검토 종합 판단<select aria-label="계획 검토 종합 판단" value={d.outcome} onChange={e=>update(v=>({...v,dirty:true,outcome:e.target.value as PlanOutcome}))}>{planOutcomes.map(o=><option key={o} value={o}>{names[o]}</option>)}</select></label><label>계획 검토 이유<textarea aria-label="계획 검토 이유" maxLength={20_000} value={d.reason} onChange={e=>update(v=>({...v,dirty:true,reason:e.target.value}))}/></label></fieldset>:<fieldset disabled={locked}><legend>검토와 별도인 사용자 확정</legend><p>현재 준비 조건과 최신 적합 검토를 서버에서 다시 확인합니다. 확정은 기준 활성화·작업 시작·완료가 아닙니다.</p><label><input type="checkbox" checked={d.acknowledged} onChange={e=>update(v=>({...v,dirty:true,acknowledged:e.target.checked}))}/>검토한 이 계획 버전을 별도로 확정하겠습니다</label></fieldset>}
 <button disabled={busy||!!d.savedId||d.kind==='CONFIRM'&&(!d.acknowledged||!d.target.validation.validForConfirmation||!!d.target.confirmation||d.target.contentReviews[0]?.ref.outcome!=='ACCEPTED')} onClick={()=>void save()}>{d.pending?d.kind==='REVIEW'?'같은 계획 검토 명령 결과 확인':'같은 계획 확정 명령 결과 확인':d.kind==='REVIEW'?'계획 내용검토 저장':'계획 별도 확정'}</button><button disabled={busy||!canClose} onClick={()=>{if(!current()||busy||!canClose)return;if(!d.dirty||confirm('미저장 계획 판단을 버리고 닫을까요?'))onChange(b=>current()&&b?.ownerUserId===session.user.id&&b.projectId===buffer.projectId&&b.workPlanState?.bindingId===s.bindingId&&b.workPlanState.decision===d?{...b,dirty:false,workPlanState:{...b.workPlanState,decision:null}}:b);}}>계획 결정 닫기</button>
 {d.savedId?<p role="status">{d.kind==='REVIEW'?'계획 내용검토 저장 확인 · 계획 확정/실행 아님':'계획 별도 확정 저장 확인 · 기준 활성화/실행 아님'}</p>:null}
 </section>;
}
