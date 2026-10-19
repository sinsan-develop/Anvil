import {ApiError} from '../../api/client.ts';
import type {DocumentSession} from '../design-trace/editor-api.ts';
import {ordered} from '../knowledge/review-view.ts';
import type {AssignmentBuffer} from './assignment-api.ts';
const editable=(b:AssignmentBuffer,s:DocumentSession)=>b.ownerUserId===s.user.id&&b.ownerClientId===s.clientId&&!b.pending&&!b.result&&!b.uncertain;
/** 미저장 예산/환경 선택만 해제한다. 원본·정책·실제 권한에는 부작용이 없다. */
export function clearAssignmentSelection(buffer:AssignmentBuffer,session:DocumentSession,field:'budgetRef'|'environmentRef',update:(change:(current:AssignmentBuffer)=>AssignmentBuffer)=>void,active:()=>boolean):void{
 const expected=structuredClone(buffer);
 if(!['budgetRef','environmentRef'].includes(field)||!editable(expected,session))throw new ApiError('ASSIGNMENT_SELECTION_CLEAR_INVALID');
 if(!active()||expected.input.definition[field]===null)return;
 update(current=>{
  if(!active()||!editable(current,session)||current.bindingId!==expected.bindingId||current.projectId!==expected.projectId||current.controlGeneration!==expected.controlGeneration
   ||ordered(current.input)!==ordered(expected.input)||ordered(current.ref)!==ordered(expected.ref)||ordered(current.expectedDesignRef)!==ordered(expected.expectedDesignRef))return current;
  const next=structuredClone(current);next.input.definition[field]=null;next.dirty=true;next.failure=null;return next;
 });
}
