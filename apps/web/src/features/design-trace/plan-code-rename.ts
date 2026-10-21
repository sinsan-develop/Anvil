import {ApiError} from '../../api/client.ts';
import type {WorkPlanBuffer} from './work-plan-api.ts';
const code=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(v);
/** 로컬 초안의 정확한 선행 코드만 재결박한다. 설명·시험 ID·저장본·명령은 바꾸지 않는다. */
export function renamePlanTaskCode(state:WorkPlanBuffer,index:number,nextCode:string,acknowledged:boolean):WorkPlanBuffer{
 const tasks=state.input.tasks,target=tasks[index],oldCode=target?.taskCode;
 if(state.pending||state.result||state.uncertain||state.sent||state.approval||state.decision||state.traceLink||!Number.isSafeInteger(index)||!target||!code(oldCode)||!code(nextCode)||tasks.filter(t=>t.taskCode===oldCode).length!==1||tasks.some((t,i)=>i!==index&&t.taskCode===nextCode))throw new ApiError('WORK_PLAN_CODE_RENAME_INVALID');
 if(oldCode===nextCode)return state;
 if(!acknowledged)throw new ApiError('WORK_PLAN_CODE_RENAME_CONFIRM_REQUIRED');
 return {...state,failure:null,input:{...state.input,tasks:tasks.map((t,i)=>({...t,taskCode:i===index?nextCode:t.taskCode,startPrerequisites:t.startPrerequisites.map(v=>v===oldCode?nextCode:v),acceptancePrerequisites:t.acceptancePrerequisites.map(v=>v===oldCode?nextCode:v)}))}};
}
