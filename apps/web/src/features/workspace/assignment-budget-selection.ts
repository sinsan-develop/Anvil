import {ApiError} from '../../api/client.ts';
import {validateStoredLimitPolicy,type LimitPolicyRecord} from '../connections/limit-policy-api.ts';
import type {DocumentSession} from '../design-trace/editor-api.ts';
import type {AssignmentBuffer} from './assignment-api.ts';
import {ordered} from '../knowledge/review-view.ts';

function editable(b:AssignmentBuffer,s:DocumentSession){
 return b.ownerUserId===s.user.id&&b.ownerClientId===s.clientId&&!b.pending&&!b.result&&!b.uncertain;
}
/** 명시 선택을 미저장 초안에만 요청한다. BUDGET_UNVERIFIED/실행 판정은 변경하지 않는다. */
export async function applyAssignmentBudgetSelection(buffer:AssignmentBuffer,session:DocumentSession,raw:LimitPolicyRecord,active:()=>boolean,update:(change:(current:AssignmentBuffer)=>AssignmentBuffer)=>void){
 const expected=structuredClone(buffer),source=structuredClone(raw);
 if(!editable(expected,session))throw new ApiError('ASSIGNMENT_BUDGET_SELECTION_INVALID');
 if(!active())return;
 const policy=await validateStoredLimitPolicy(source,expected.projectId,source.ref);
 if(policy.snapshot.state!=='APPLIED')throw new ApiError('ASSIGNMENT_BUDGET_REVOKED');
 if(!active())return;
 update(current=>{
  if(!active()||!editable(current,session)||current.bindingId!==expected.bindingId||current.projectId!==expected.projectId||current.controlGeneration!==expected.controlGeneration
   ||ordered(current.input)!==ordered(expected.input)||ordered(current.expectedDesignRef)!==ordered(expected.expectedDesignRef))return current;
  const next=structuredClone(current);next.input.definition.budgetRef=structuredClone(policy.ref);next.dirty=true;next.failure=null;return next;
 });
}
