import{ApiError}from'../../api/client.ts';import type{WorkPlanBuffer}from'./work-plan-api.ts';
export function planTaskRemovalImpact(state:WorkPlanBuffer,index:number){
 if(state.pending||state.result||state.uncertain||state.sent||state.approval||state.decision||state.traceLink||!Number.isSafeInteger(index)||index<0||index>=state.input.tasks.length)throw new ApiError('WORK_PLAN_TASK_REMOVE_INVALID');
 const task=state.input.tasks[index]!,retainedReferences:{index:number;taskCode:string;phase:'START'|'ACCEPTANCE'}[]=[];
 if(task.taskCode)state.input.tasks.forEach((other,i)=>{if(i===index)return;if(other.startPrerequisites.includes(task.taskCode))retainedReferences.push({index:i,taskCode:other.taskCode,phase:'START'});if(other.acceptancePrerequisites.includes(task.taskCode))retainedReferences.push({index:i,taskCode:other.taskCode,phase:'ACCEPTANCE'});});
 return{taskCode:task.taskCode,title:task.title,designRefs:task.designRefs.length,screenRefs:task.screenRefs.length,tests:task.testCases.length,retainedReferences};
}
/** 선택 카드만 로컬 초안에서 제외한다. 다른 선행·검토참조/저장본은 자동 정정하지 않는다. */
export function removePlanTask(state:WorkPlanBuffer,index:number,acknowledged:boolean):WorkPlanBuffer{
 planTaskRemovalImpact(state,index);if(!acknowledged)throw new ApiError('WORK_PLAN_TASK_REMOVE_CONFIRM_REQUIRED');
 return{...state,failure:null,input:{...state.input,tasks:state.input.tasks.filter((_,i)=>i!==index)}};
}
