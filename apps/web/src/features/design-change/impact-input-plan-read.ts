import {ApiClient,ApiError} from '../../api/client.ts';
import {readDesignChange} from './api.ts';
import {readWorkPlan,type PlanRef} from '../design-trace/work-plan-api.ts';
import {ordered} from '../knowledge/review-view.ts';
export interface ImpactInputPlanSelection{projectId:string;userId:string;clientId:string;changeRef:PlanRef;impactRef:PlanRef;beforeVersion:number|null;planRef:PlanRef}
const uuid=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
const ref=(v:PlanRef)=>v&&Object.keys(v).sort().join(',')==='contentHash,id,version'&&uuid(v.id)&&Number.isSafeInteger(v.version)&&v.version>0&&typeof v.contentHash==='string'&&/^[0-9a-f]{64}$/.test(v.contentHash);
const same=(a:unknown,b:unknown)=>ordered(a)===ordered(b);
/** 같은 이력 구간의 고정 입력만 읽고 현재 기준으로 대체하거나 실행하지 않는다. */
export async function readImpactInputPlan(client:ApiClient,selection:ImpactInputPlanSelection,active:()=>boolean){
 if(!selection||![selection.projectId,selection.userId,selection.clientId].every(uuid)||![selection.changeRef,selection.impactRef,selection.planRef].every(ref)||selection.changeRef.version!==1||selection.beforeVersion!==null&&(!Number.isSafeInteger(selection.beforeVersion)||selection.beforeVersion<1||selection.beforeVersion>999999999999999))throw new ApiError('IMPACT_INPUT_PLAN_INVALID');
 const chosen=structuredClone(selection),check=()=>{if(!active())throw new ApiError('IMPACT_INPUT_PLAN_READ_PAUSED');};check();
 const page=await readDesignChange(client,chosen.projectId,chosen.changeRef.id,chosen.beforeVersion);check();
 const impacts=page.impactVersions.filter(v=>same(v.ref,chosen.impactRef)),impact=impacts[0];
 if(!same(page.change.ref,chosen.changeRef)||impacts.length!==1||!impact||impact.inputs.planRefs.filter(v=>same(v,chosen.planRef)).length!==1)throw new ApiError('IMPACT_INPUT_PLAN_CHANGED');
 const plan=await readWorkPlan(client,chosen.projectId,chosen.planRef);check();
 return plan;
}
