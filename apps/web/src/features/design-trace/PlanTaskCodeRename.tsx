import {useState} from 'react';
import {ApiError} from '../../api/client.ts';
import type {WorkPlanBuffer} from './work-plan-api.ts';
import {renamePlanTaskCode} from './plan-code-rename.ts';
export function PlanTaskCodeRename({state,index,locked,onApply}:{state:WorkPlanBuffer;index:number;locked:boolean;onApply:(next:WorkPlanBuffer)=>void}){
 const [nextCode,setNextCode]=useState(''),[error,setError]=useState<ApiError|null>(null),target=state.input.tasks[index];
 if(!target)return null;
 const starts=state.input.tasks.reduce((n,t)=>n+t.startPrerequisites.filter(v=>v===target.taskCode).length,0),acceptances=state.input.tasks.reduce((n,t)=>n+t.acceptancePrerequisites.filter(v=>v===target.taskCode).length,0);
 const frozen=locked||!!state.pending||!!state.result||state.uncertain||!!state.sent||!!state.approval||!!state.decision||!!state.traceLink;
 function apply(){
  if(frozen)return;
  if(!confirm('업무 '+state.input.tasks[index]!.taskCode+' → '+nextCode+' 및 정확 일치하는 착수 선행 '+starts+'건·검수 선행 '+acceptances+'건을 이 초안에서 함께 바꿀까요? 설명·시험 ID·원본 버전은 보존하며 저장은 별도입니다.'))return;
  try{const next=renamePlanTaskCode(state,index,nextCode,true);if(next!==state)onApply(next);setError(null);}
  catch(cause){setError(cause instanceof ApiError?cause:new ApiError('WORK_PLAN_CODE_RENAME_INVALID'));}
 }
 return <div className="status-card" aria-label={'업무 '+(index+1)+' 코드 연결 변경'}><label>업무 {index+1} 새 코드<input maxLength={64} value={nextCode} disabled={frozen} onChange={event=>{setNextCode(event.target.value);setError(null);}}/></label><p className="meta">현재 {target.taskCode||'미입력'} · 같은 초안의 착수 참조 {starts}건·검수 참조 {acceptances}건. 직접 코드 편집은 참조를 바꾸지 않으며, 아래 변경은 정확 일치하는 선행 코드만 함께 바꿉니다. 유효성 합격·기준 적용·실행은 아닙니다.</p><button type="button" disabled={frozen||!nextCode} onClick={apply}>업무 {index+1} 코드·선행 함께 변경</button>{error?<p role="alert">{error.message} · {error.code}</p>:null}</div>;
}
