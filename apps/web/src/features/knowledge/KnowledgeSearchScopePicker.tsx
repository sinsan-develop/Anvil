import {useEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import {readWorkspaceProject,readWorkspaceMethodology,type WorkspaceMethodology} from '../workspace/api.ts';
import {listWorkPlans,readWorkPlan,type WorkPlanPage,type WorkPlanView,type WorkPlanSummary} from '../design-trace/work-plan-api.ts';
import {knowledgeSearchScopeWire,type KnowledgeSearchScope} from './knowledge-search-scope.ts';
export function KnowledgeSearchScopePicker({client,projectId,contextKey,scope,onChange,onAuthenticationLost}:{client:ApiClient;projectId:string;contextKey:string;scope:KnowledgeSearchScope|null;onChange:(scope:KnowledgeSearchScope|null)=>void;onAuthenticationLost:()=>void}){
 const live=useRef(true),identity=useRef({client,projectId,contextKey,epoch:0}),seq=useRef(0);
 if(identity.current.client!==client||identity.current.projectId!==projectId||identity.current.contextKey!==contextKey){identity.current={client,projectId,contextKey,epoch:identity.current.epoch+1};seq.current++;}
 const epoch=identity.current.epoch,[state,setState]=useState<{epoch:number;busy:boolean;method?:WorkspaceMethodology;plans?:WorkPlanPage;plan?:WorkPlanView;error?:string}>({epoch:0,busy:false}),shown=state.epoch===epoch?state:null;
 useEffect(()=>{live.current=true;return()=>{live.current=false;seq.current++;};},[]);
 function close(){seq.current++;setState({epoch,busy:false});}
 function select(next:KnowledgeSearchScope|null){try{if(next)knowledgeSearchScopeWire(next);onChange(next);close();}catch(e){setState({epoch,busy:false,error:e instanceof ApiError?e.code:'RESPONSE_INVALID'});}}
 async function load(mode:'STAGE'|'PLAN',summary?:WorkPlanSummary,cursor:string|null=null){
  if(shown?.busy)return;const id=++seq.current,active=()=>live.current&&identity.current.epoch===epoch&&seq.current===id;setState({epoch,busy:true});
  try{if(mode==='STAGE'){const p=await readWorkspaceProject(client,projectId);if(!active())return;const method=await readWorkspaceMethodology(client,projectId,p.currentMethodologyRef);if(active())setState({epoch,busy:false,method});}
   else if(summary){const plan=await readWorkPlan(client,projectId,structuredClone(summary.ref));if(active())setState({epoch,busy:false,plan});}
   else{const plans=await listWorkPlans(client,projectId,cursor);if(active())setState({epoch,busy:false,plans});}
  }catch(e){if(active()){const a=e instanceof ApiError?e:new ApiError('RESPONSE_INVALID');setState({epoch,busy:false,error:a.code});if(a.status===401)onAuthenticationLost();}}
 }
 const base=scope??{stageRef:null,taskRef:null,includeProjectWide:false};
 return <section aria-label="지식 검색 관련성"><h3>단계·업무로 검색</h3><span title="관련성은 접근 권한이나 실행 허가가 아닙니다. 선택 단계 또는 업무를 포함하며 프로젝트 공통은 명시 선택합니다.">ⓘ</span>
 <button type="button" disabled={shown?.busy} onClick={()=>void load('STAGE')}>검색 단계 조회</button><button type="button" disabled={shown?.busy} onClick={()=>void load('PLAN')}>검색 업무 계획 조회</button>
 <label><input type="checkbox" checked={!!scope?.includeProjectWide} disabled={!scope} onChange={e=>{if(scope)select({...scope,includeProjectWide:e.target.checked});}}/>프로젝트 공통 지식 포함</label>
 {scope?.stageRef?<p>선택 단계 {scope.stageRef.nodeId} · 적용본 v{scope.stageRef.applicationRef.version} · {scope.stageRef.applicationRef.contentHash}<button type="button" onClick={()=>select(scope.taskRef?{...scope,stageRef:null}:null)}>검색 단계 해제</button></p>:null}
 {scope?.taskRef?<p>선택 업무 {scope.taskRef.taskCode} · 계획 v{scope.taskRef.planRef.version} · {scope.taskRef.planRef.contentHash}<button type="button" onClick={()=>select(scope.stageRef?{...scope,taskRef:null}:null)}>검색 업무 해제</button></p>:null}
 {scope?<button type="button" onClick={()=>select(null)}>관련성 검색 해제</button>:<p>관련성 조건 없음 · 프로젝트 전체</p>}
 {shown?.method?.snapshot&&shown.method.applicationRef?<><p>고정 적용본 v{shown.method.applicationRef.version} · 현재 실행은 미확인</p>{shown.method.snapshot.graph.nodes.map(n=><button type="button" key={n.nodeId} onClick={()=>select({...base,stageRef:{applicationRef:shown.method!.applicationRef!,nodeId:n.nodeId}})}>단계 {n.nodeId} 검색 선택</button>)}</>:shown?.method?<p>적용한 방법론이 없습니다.</p>:null}
 {shown?.plans?<><ul>{shown.plans.items.map((p,i)=><li key={p.ref.id}>{p.title} · v{p.ref.version} · 초안<button type="button" onClick={()=>void load('PLAN',p)}>계획 {i+1} 검색 업무 확인</button></li>)}</ul>{shown.plans.hasMore?<button type="button" onClick={()=>void load('PLAN',undefined,shown.plans!.nextCursor)}>검색 계획 다음 목록</button>:null}</>:null}
 {shown?.plan?<><p>고정 계획 v{shown.plan.ref.version} · 초안 · 실행 미확인</p>{shown.plan.tasks.map((task,i)=><button type="button" key={task.taskCode+':'+i} disabled={shown.plan!.tasks.filter(t=>t.taskCode===task.taskCode).length!==1} onClick={()=>select({...base,taskRef:{planRef:shown.plan!.ref,taskCode:task.taskCode}})}>업무 {task.taskCode} 검색 선택</button>)}</>:null}
 {shown?.busy?<p role="status">검색 관련성 확인 중</p>:null}{shown&&(shown.busy||shown.error||shown.method||shown.plan||shown.plans)?<button type="button" onClick={close}>검색 관련성 선택 닫기</button>:null}{shown?.error?<p role="alert">{shown.error}</p>:null}
 </section>;
}
