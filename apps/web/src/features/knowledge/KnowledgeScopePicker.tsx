import {useEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import type {KnowledgeEntry,KnowledgeScope} from '../../../../server/modules/knowledge/knowledge-entry.ts';
import {readWorkspaceProject,readWorkspaceMethodology,type WorkspaceMethodology} from '../workspace/api.ts';
import {listWorkPlans,readWorkPlan,type WorkPlanPage,type WorkPlanView,type WorkPlanSummary} from '../design-trace/work-plan-api.ts';
import {knowledgeScopeOf,validKnowledgeScope} from './knowledge-scope.ts';

export function KnowledgeScopeSummary({scope,label}:{scope:KnowledgeScope;label:string}){
 return <section aria-label={label}><h4>고정 관련성</h4>{!scope.stageRefs.length&&!scope.taskRefs.length?<p>프로젝트 공통</p>:<><ul>{scope.stageRefs.map(r=><li key={JSON.stringify(r)}>단계 {r.nodeId} · 적용본 {r.applicationRef.id} v{r.applicationRef.version} · SHA256 {r.applicationRef.contentHash}</li>)}{scope.taskRefs.map(r=><li key={JSON.stringify(r)}>업무 {r.taskCode} · 계획 {r.planRef.id} v{r.planRef.version} · SHA256 {r.planRef.contentHash}</li>)}</ul><p className="meta">보관된 관련성입니다. 현재 적용·계획 확정 여부와 실행 권한은 미확인입니다.</p></>}</section>;
}
export function KnowledgeScopePicker({client,buffer,projectId,kind,scope,disabled,onChange,onAuthenticationLost}:{client:ApiClient;buffer:object;projectId:string;kind:KnowledgeEntry['kind'];scope?:KnowledgeScope;disabled:boolean;onChange:(scope:KnowledgeScope)=>void;onAuthenticationLost:()=>void}){
 const alive=useRef(true),seq=useRef(0),latest=useRef({buffer,disabled});latest.current={buffer,disabled};
 const [busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null);
 const [method,setMethod]=useState<{buffer:object;value:WorkspaceMethodology}|null>(null),[plans,setPlans]=useState<{buffer:object;value:WorkPlanPage}|null>(null),[plan,setPlan]=useState<{buffer:object;value:WorkPlanView}|null>(null);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;seq.current++;};},[]);
 const selected=knowledgeScopeOf({projectId,scope}),shownMethod=method?.buffer===buffer?method.value:null,shownPlans=plans?.buffer===buffer?plans.value:null,shownPlan=plan?.buffer===buffer?plan.value:null;
 const global=['PURPOSE','CONSTITUTION'].includes(kind),locked=busy||disabled,full=selected.stageRefs.length+selected.taskRefs.length>=200;
 function fail(e:unknown){const a=e instanceof ApiError?e:new ApiError('RESPONSE_INVALID');setError(a.code);if(a.status===401)onAuthenticationLost();}
 function close(){seq.current++;setMethod(null);setPlans(null);setPlan(null);setBusy(false);setError(null);}
 async function load(mode:'STAGE'|'PLAN',source?:WorkPlanSummary,cursor:string|null=null){
  if(locked||global)return;const captured=buffer,id=++seq.current,active=()=>alive.current&&seq.current===id&&latest.current.buffer===captured&&!latest.current.disabled;
  setBusy(true);setError(null);setMethod(null);setPlan(null);if(!source)setPlans(null);
  try{
   if(mode==='STAGE'){const p=await readWorkspaceProject(client,projectId);if(!active())return;const value=await readWorkspaceMethodology(client,projectId,p.currentMethodologyRef);if(active())setMethod({buffer:captured,value});}
   else if(source){const value=await readWorkPlan(client,projectId,structuredClone(source.ref));if(active())setPlan({buffer:captured,value});}
   else{const value=await listWorkPlans(client,projectId,cursor);if(active())setPlans({buffer:captured,value});}
  }catch(e){if(active())fail(e);}finally{if(alive.current&&seq.current===id)setBusy(false);}
 }
 function change(value:KnowledgeScope){if(locked)return;try{if(!validKnowledgeScope(value,projectId,global?'FACT':kind)||global&&value.stageRefs.length+value.taskRefs.length>=selected.stageRefs.length+selected.taskRefs.length)throw new ApiError('KNOWLEDGE_SCOPE_INVALID');onChange(structuredClone(value));close();}catch(e){fail(e);}}
 return <section aria-label="지식 관련성 선택"><KnowledgeScopeSummary scope={selected} label="작성 지식 관련성"/>
  <p className="meta">프로젝트 내부 관련성만 선택합니다. 접근 권한·공유·자동 전달·업무 실행은 바뀌지 않습니다. 연결 저장은 지식 저장 때 별도로 수행합니다.</p>
  {global?<p>목적·헌법은 프로젝트 공통입니다. 남은 관련성을 해제한 뒤 저장하세요.</p>:null}
  <button type="button" disabled={locked||global||full} onClick={()=>void load('STAGE')}>관련 단계 조회</button><button type="button" disabled={locked||global||full} onClick={()=>void load('PLAN')}>관련 업무 계획 조회</button>
  <ul>{selected.stageRefs.map((r,i)=><li key={JSON.stringify(r)}>{r.nodeId}<button type="button" disabled={locked} onClick={()=>change({...selected,stageRefs:selected.stageRefs.filter((_,n)=>i!==n)})}>단계 {r.nodeId} 관련성 해제</button></li>)}{selected.taskRefs.map((r,i)=><li key={JSON.stringify(r)}>{r.taskCode}<button type="button" disabled={locked} onClick={()=>change({...selected,taskRefs:selected.taskRefs.filter((_,n)=>i!==n)})}>업무 {r.taskCode} 관련성 해제</button></li>)}</ul>
  {shownMethod?.snapshot&&shownMethod.applicationRef?<><p>조회한 적용본 v{shownMethod.applicationRef.version} · {shownMethod.snapshot.name} · 현재 실행은 미확인</p><ul>{shownMethod.snapshot.graph.nodes.map(n=><li key={n.nodeId}>{n.name}<button type="button" disabled={locked||global||full||selected.stageRefs.some(r=>JSON.stringify(r.applicationRef)===JSON.stringify(shownMethod.applicationRef)&&r.nodeId===n.nodeId)} onClick={()=>change({...selected,stageRefs:[...selected.stageRefs,{applicationRef:shownMethod.applicationRef!,nodeId:n.nodeId}]})}>단계 {n.nodeId} 관련성 추가</button></li>)}</ul></>:shownMethod?<p>적용된 방법론이 없습니다.</p>:null}
  {shownPlans?<><ul>{shownPlans.items.map((p,i)=><li key={p.ref.id}>{p.title} · v{p.ref.version} · 초안/확정 여부는 별도 확인<button type="button" disabled={locked} onClick={()=>void load('PLAN',p)}>계획 {i+1} 업무 확인</button></li>)}</ul>{shownPlans.hasMore?<button type="button" disabled={locked} onClick={()=>void load('PLAN',undefined,shownPlans.nextCursor)}>관련 계획 다음 목록</button>:null}{!shownPlans.items.length?<p>조회된 계획이 없습니다.</p>:null}</>:null}
  {shownPlan?<><p>정확 계획 v{shownPlan.ref.version} · 원문 상태 DRAFT · 별도 확정/실행은 미확인</p><ul>{shownPlan.tasks.map((t,index)=><li key={t.taskCode+':'+index}>{t.title}{shownPlan.tasks.filter(item=>item.taskCode===t.taskCode).length!==1?<span> · 업무 코드 중복 · 선택 불가</span>:null}<button type="button" disabled={locked||global||full||shownPlan.tasks.filter(item=>item.taskCode===t.taskCode).length!==1||selected.taskRefs.some(r=>JSON.stringify(r.planRef)===JSON.stringify(shownPlan.ref)&&r.taskCode===t.taskCode)} onClick={()=>change({...selected,taskRefs:[...selected.taskRefs,{planRef:shownPlan.ref,taskCode:t.taskCode}]})}>업무 {t.taskCode} 관련성 추가</button></li>)}</ul></>:null}
  {busy?<p role="status">고정 관련성 확인 중</p>:null}{busy||shownMethod||shownPlans||shownPlan||error?<button type="button" onClick={close}>관련성 선택 닫기</button>:null}{error?<p role="alert">{error} · 관련성은 변경하지 않았습니다.</p>:null}
 </section>;
}
