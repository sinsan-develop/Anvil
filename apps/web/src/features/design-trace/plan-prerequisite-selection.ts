import {ApiError} from '../../api/client.ts';
import type {WorkPlanBuffer} from './work-plan-api.ts';
export type PrerequisiteField='startPrerequisites'|'acceptancePrerequisites';
/** 같은 초안의 명시 선택만 편집한다. 누락 참조 정리·순환 합격·저장/실행을 수행하지 않는다. */
export function selectPlanPrerequisite(state:WorkPlanBuffer,index:number,field:PrerequisiteField,targetCode:string,selected:boolean):WorkPlanBuffer{
 const tasks=state.input.tasks,task=tasks[index];
 if(state.pending||state.result||state.uncertain||state.sent||state.approval||state.decision||state.traceLink||!Number.isSafeInteger(index)||index<0||!task
  ||!['startPrerequisites','acceptancePrerequisites'].includes(field)||typeof selected!=='boolean'||typeof targetCode!=='string'||!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(targetCode)
  ||targetCode===task.taskCode||tasks.filter(t=>t.taskCode===targetCode).length!==1)throw new ApiError('WORK_PLAN_PREREQUISITE_SELECTION_INVALID');
 const current=task[field];
 if(selected&&current.includes(targetCode)||!selected&&!current.includes(targetCode))return state;
 if(selected&&current.length>=200)throw new ApiError('WORK_PLAN_PREREQUISITE_SELECTION_INVALID');
 const next=selected?[...current,targetCode]:current.filter(code=>code!==targetCode);
 return {...state,failure:null,input:{...state.input,tasks:tasks.map((t,i)=>i===index?{...t,[field]:next}:t)}};
}
