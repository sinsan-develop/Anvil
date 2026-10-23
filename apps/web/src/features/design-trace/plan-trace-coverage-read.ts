import {ApiClient,ApiError} from '../../api/client.ts';
import {readWorkPlan,type PlanRef,type WorkPlanView} from './work-plan-api.ts';
import {readDesignIndex} from './design-index-api.ts';
import {analyzePlanDependencies,type PlanDependency} from '../../../../server/modules/traceability/plan-dependencies.ts';

export interface PlanCoverageSelection {projectId:string;userId:string;clientId:string;planRef:PlanRef;designRef:PlanRef}
const invalid=():never=>{throw new ApiError('PLAN_TRACE_COVERAGE_SELECTION_INVALID');};
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
function object(v:unknown,keys:string[]):Record<string,any>{
 if(!v||typeof v!=='object'||Array.isArray(v)||![Object.prototype,null].includes(Object.getPrototypeOf(v))||Object.getOwnPropertySymbols(v).length)return invalid();
 const d=Object.getOwnPropertyDescriptors(v);if(Object.keys(d).sort().join(',')!==[...keys].sort().join(',')||!Object.values(d).every(p=>p.enumerable&&'value'in p))return invalid();return Object.fromEntries(keys.map(k=>[k,d[k]!.value]));
}
function reference(v:unknown):PlanRef{const r=object(v,['id','version','contentHash']);if(!uuid(r.id)||!Number.isSafeInteger(r.version)||r.version<1||typeof r.contentHash!=='string'||!/^[a-f0-9]{64}$/.test(r.contentHash))return invalid();return{id:r.id,version:r.version,contentHash:r.contentHash};}
const same=(a:PlanRef,b:PlanRef)=>a.id===b.id&&a.version===b.version&&a.contentHash===b.contentHash;
function selection(v:unknown):PlanCoverageSelection{const s=object(v,['projectId','userId','clientId','planRef','designRef']);if(![s.projectId,s.userId,s.clientId].every(uuid))return invalid();return{projectId:s.projectId,userId:s.userId,clientId:s.clientId,planRef:reference(s.planRef),designRef:reference(s.designRef)};}
function declaredIssues(plan:WorkPlanView){
 const codes=new Set(plan.issues.map(i=>i.code)),dependencies:PlanDependency[]=[];
 if(!plan.tasks.length)codes.add('TASKS_MISSING');
 for(const task of plan.tasks){
  for(const field of ['title','purpose','ownerRole','rollback','recoveryNotes'] as const)if(!task[field].trim())codes.add('CARD_TEXT_MISSING');
  for(const field of ['inputs','outputs','included','excluded','allowedFileRefs','steps','acceptanceCriteria','evidenceRequirements'] as const)if(!task[field].length||task[field].some(s=>!s.trim()))codes.add('CARD_LIST_MISSING');
  if(!task.designRefs.length)codes.add('DESIGN_LINK_MISSING');if(task.type==='SCREEN'&&!task.screenRefs.length)codes.add('SCREEN_LINK_MISSING');
  for(const kind of ['NORMAL','IMPORTANT_FAILURE','DIRECT_IMPACT'])if(!task.testCases.some(c=>c.kind===kind))codes.add('TEST_COVERAGE_MISSING');
  const tests=new Set<string>();for(const c of task.testCases){if(tests.has(c.id)||!c.steps.length||c.steps.some(s=>!s.trim())||!c.expected.trim()||!c.environment.trim())codes.add('TEST_CASE_INCOMPLETE');tests.add(c.id);}
  for(const [field,phase] of [['startPrerequisites','START'],['acceptancePrerequisites','ACCEPTANCE']] as const)for(const target of task[field])dependencies.push({taskCode:task.taskCode,dependencyTaskCode:target,phase});
 }
 const graph=analyzePlanDependencies(plan.tasks.map(t=>t.taskCode),dependencies);for(const issue of graph.issues)codes.add(issue.code);
 const keys=(rows:PlanDependency[])=>JSON.stringify(rows.map(d=>JSON.stringify([d.taskCode,d.dependencyTaskCode,d.phase])).sort());
 if(keys(graph.dependencies)!==keys(plan.dependencies))throw new ApiError('PLAN_TRACE_COVERAGE_PROJECTION_INVALID');
 return{codes:[...codes].sort(),ambiguous:graph.issues.length>0};
}
/** 기존 두 GET과 브라우저 해시 검사를 소비한다. 새 API/쓰기/인증·현재 권위는 생성하지 않는다. */
export async function readPlanTraceCoverage(client:ApiClient,value:unknown,active:()=>boolean){
 const s=selection(value),check=()=>{if(!active())throw new ApiError('PLAN_TRACE_COVERAGE_PAUSED');};check();
 const plan=structuredClone(await readWorkPlan(client,s.projectId,s.planRef));check();
 if(!same(plan.designRef,s.designRef))throw new ApiError('PLAN_TRACE_COVERAGE_CHANGED');
 const index=structuredClone(await readDesignIndex(client,s.projectId,s.designRef));check();
 const issues=declaredIssues(plan),base={designRef:s.designRef,planRef:s.planRef,planIssueCodes:issues.codes,projectScopeAuthenticated:false,sourceTextVerified:false,accepted:false,completionDetermined:false,storageMutationPerformed:false,executionAuthorized:false};
 const unavailable=(reason:string)=>({projectId:s.projectId,analysis:{...base,status:'UNAVAILABLE' as const,reason,unlinkedDesignItems:null,unlinkedScreenRegions:null,invalidTaskLinks:null,ungroundedTasks:null}});
 if(index.status==='NOT_INDEXED')return unavailable('DESIGN_INDEX_UNAVAILABLE');
 if(plan.relationalProjection!=='STORED'||issues.ambiguous)return unavailable('PLAN_PROJECTION_UNAVAILABLE');
 const items=new Map(index.items.map(i=>[i.id,i])),screens=new Map(index.screenRegions.map(i=>[i.id,i])),linkedItems=new Set<string>(),linkedScreens=new Set<string>();
 const invalidTaskLinks:{taskCode:string;kind:'DESIGN_ITEM'|'SCREEN_REGION';referenceId:string;reason:string}[]=[],ungroundedTasks:{taskCode:string;reasons:string[]}[]=[];
 for(const task of plan.tasks){
  let designs=0,regions=0;
  for(const r of [...task.designRefs,...task.screenRefs]){
   const target=r.kind==='DESIGN_ITEM'?items.get(r.id):screens.get(r.id);
   if(!target)invalidTaskLinks.push({taskCode:task.taskCode,kind:r.kind,referenceId:r.id,reason:'REFERENCE_NOT_FOUND'});
   else if(!same(r.versionRef,target.documentRef)||r.localCode!==('localCode'in target?target.localCode:target.screenCode)||r.anchor!==target.anchor)invalidTaskLinks.push({taskCode:task.taskCode,kind:r.kind,referenceId:r.id,reason:'REFERENCE_MISMATCH'});
   else if(r.kind==='DESIGN_ITEM'){designs++;linkedItems.add(r.id);}else{regions++;linkedScreens.add(r.id);}
  }
  const reasons:string[]=[];if(!designs)reasons.push('DESIGN_REFERENCE_ABSENT');if(task.type==='SCREEN'&&!regions)reasons.push('SCREEN_REFERENCE_ABSENT');if(reasons.length)ungroundedTasks.push({taskCode:task.taskCode,reasons});
 }
 return{projectId:s.projectId,analysis:{...base,status:'UNVERIFIED' as const,reason:'PLAN_TRACE_COVERAGE_ONLY',unlinkedDesignItems:index.items.filter(i=>!linkedItems.has(i.id)).map(i=>({id:i.id,localCode:i.localCode})),unlinkedScreenRegions:index.screenRegions.filter(i=>!linkedScreens.has(i.id)).map(i=>({id:i.id,screenCode:i.screenCode,designItemId:i.designItemId})),invalidTaskLinks,ungroundedTasks}};
}
