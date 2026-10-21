import {useState} from 'react';
import {ApiError} from '../../api/client.ts';
import type {WorkPlanBuffer} from './work-plan-api.ts';
import {selectPlanPrerequisite,type PrerequisiteField} from './plan-prerequisite-selection.ts';
export function PlanPrerequisiteSelection({state,index,locked,onApply}:{state:WorkPlanBuffer;index:number;locked:boolean;onApply:(captured:WorkPlanBuffer,next:WorkPlanBuffer)=>void}){
 const [error,setError]=useState<ApiError|null>(null),task=state.input.tasks[index];if(!task)return null;
 const disabled=locked||!!state.pending||!!state.result||state.uncertain||!!state.sent||!!state.approval||!!state.decision||!!state.traceLink;
 const choices=state.input.tasks.filter((t,i)=>i!==index&&t.taskCode!==task.taskCode&&/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(t.taskCode)&&state.input.tasks.filter(x=>x.taskCode===t.taskCode).length===1);
 function choose(field:PrerequisiteField,code:string,selected:boolean){if(disabled)return;try{onApply(state,selectPlanPrerequisite(state,index,field,code,selected));setError(null);}catch(e){setError(e instanceof ApiError?e:new ApiError('WORK_PLAN_PREREQUISITE_SELECTION_INVALID'));}}
 return <details aria-label={'업무 '+(index+1)+' 선행 업무 선택'}><summary>업무 {index+1} 선행 업무 목록에서 선택</summary><p className="meta">착수와 검수 선행은 별개입니다. 미해결 코드·순환은 자동 수정하지 않으며 저장·서버 검수는 별도입니다.</p>
 {choices.length?(['startPrerequisites','acceptancePrerequisites']as const).map(field=><fieldset key={field} disabled={disabled}><legend>{field==='startPrerequisites'?'착수':'검수'} 선행 선택</legend>{choices.map(t=><label key={t.taskCode}><input type="checkbox" aria-label={'업무 '+(index+1)+' '+(field==='startPrerequisites'?'착수':'검수')+' 선행으로 '+t.taskCode+' 선택'} checked={task[field].includes(t.taskCode)} onChange={e=>choose(field,t.taskCode,e.target.checked)}/>{t.taskCode} · {t.title||'제목 미입력'}</label>)}</fieldset>):<p>선택할 다른 고유 업무 코드가 없습니다.</p>}
 {error?<p role="alert">{error.code}</p>:null}</details>;
}
