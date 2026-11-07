import {ApiClient,ApiError} from '../../api/client.ts';
import {readDesignChange,type ImpactTargetRef} from './api.ts';
import {readWorkPlan,type PlanRef} from '../design-trace/work-plan-api.ts';
import {ordered} from '../knowledge/review-view.ts';

export interface ImpactPlanSelection {projectId:string;userId:string;clientId:string;changeRef:PlanRef;impactRef:PlanRef;beforeVersion:number|null;target:ImpactTargetRef}
const uuid=(value:unknown)=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
const ref=(value:PlanRef)=>value&&uuid(value.id)&&Number.isSafeInteger(value.version)&&value.version>0&&typeof value.contentHash==='string'&&/^[0-9a-f]{64}$/.test(value.contentHash);
const same=(a:unknown,b:unknown)=>ordered(a)===ordered(b);
/** 현재 조회한 이력 구간만 다시 확인한다. 다른 페이지/계획/업무로 자동 대체하지 않는다. */
export async function readImpactPlanTask(client:ApiClient,selection:ImpactPlanSelection,active:()=>boolean){
  const target=selection?.target;
  if(!selection||![selection.projectId,selection.userId,selection.clientId].every(uuid)||!ref(selection.changeRef)||selection.changeRef.version!==1||!ref(selection.impactRef)||!target||target.kind!=='PLAN_TASK'||!ref(target.versionRef)||target.id!==target.versionRef.id||typeof target.localCode!=='string'||!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(target.localCode)||target.anchor!==undefined||selection.beforeVersion!==null&&(!Number.isSafeInteger(selection.beforeVersion)||selection.beforeVersion<1||selection.beforeVersion>999999999999999))throw new ApiError('IMPACT_PLAN_TARGET_INVALID');
  const chosen=structuredClone(selection),check=()=>{if(!active())throw new ApiError('IMPACT_PLAN_READ_PAUSED');};check();
  const page=await readDesignChange(client,chosen.projectId,chosen.changeRef.id,chosen.beforeVersion);check();
  if(!same(page.change.ref,chosen.changeRef))throw new ApiError('IMPACT_PLAN_TARGET_CHANGED');
  const impacts=page.impactVersions.filter(value=>same(value.ref,chosen.impactRef)),impact=impacts[0];
  if(impacts.length!==1||!impact||impact.items.filter(item=>same(item.targetRef,chosen.target)).length!==1||impact.inputs.planRefs.filter(value=>same(value,chosen.target.versionRef)).length!==1)throw new ApiError('IMPACT_PLAN_TARGET_CHANGED');
  const plan=await readWorkPlan(client,chosen.projectId,chosen.target.versionRef);check();
  if(plan.tasks.filter(task=>task.taskCode===chosen.target.localCode).length!==1)throw new ApiError('IMPACT_PLAN_TASK_UNAVAILABLE');
  return{plan,taskCode:chosen.target.localCode!};
}
