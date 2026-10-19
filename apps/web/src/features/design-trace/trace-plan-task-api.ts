import {ApiClient,ApiError} from '../../api/client.ts';
import {readWorkPlan,type PlanRef} from './work-plan-api.ts';
import type {TraceRef} from './trace-api.ts';
import type {TaskCard} from '../../../../server/modules/traceability/work-plan-card.ts';
export interface TracePlanTaskView{planRef:PlanRef;documentRef:PlanRef;designRef:PlanRef;task:TaskCard}
/** 검색/latest나 편집 buffer로 대체하지 않고 선택한 보관 trace의 고정 plan/task만 읽는다. */
export async function readTracePlanTask(client:ApiClient,projectId:string,raw:TraceRef,active:()=>boolean):Promise<TracePlanTaskView|null>{
 const target=structuredClone(raw);
 if(!target||Object.keys(target).sort().join(',')!=='id,kind,localCode,versionRef'||target.kind!=='PLAN_TASK'||target.id!==target.versionRef?.id||typeof target.localCode!=='string'||!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(target.localCode))throw new ApiError('TRACE_PLAN_TASK_REFERENCE_INVALID');
 if(!active())return null;
 const plan=await readWorkPlan(client,projectId,target.versionRef);if(!active())return null;
 const tasks=plan.tasks.filter(task=>task.taskCode===target.localCode);
 if(tasks.length!==1||plan.relationalProjection!=='STORED')throw new ApiError('TRACE_PLAN_TASK_UNVERIFIED');
 return structuredClone({planRef:plan.ref,documentRef:plan.documentRef,designRef:plan.designRef,task:tasks[0]!});
}
