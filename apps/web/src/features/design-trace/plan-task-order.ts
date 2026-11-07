import {ApiError} from '../../api/client.ts';
import type {WorkPlanBuffer} from './work-plan-api.ts';
/** 초안의 표시/저장 배열만 이동한다. 선행 코드는 실행 순서와 별도로 보존한다. */
export function movePlanTask(state:WorkPlanBuffer,index:number,direction:number):WorkPlanBuffer{
 if(state.pending||state.result||state.uncertain||state.sent||state.approval||state.decision||state.traceLink||!Number.isSafeInteger(index)||index<0||index>=state.input.tasks.length||(direction!==-1&&direction!==1))throw new ApiError('WORK_PLAN_TASK_MOVE_INVALID');
 const to=index+direction;
 if(to<0||to>=state.input.tasks.length)return state;
 const tasks=[...state.input.tasks];[tasks[index],tasks[to]]=[tasks[to]!,tasks[index]!];
 return {...state,failure:null,input:{...state.input,tasks}};
}
