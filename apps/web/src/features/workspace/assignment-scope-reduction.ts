import {ApiError} from '../../api/client.ts';
import type {DocumentSession} from '../design-trace/editor-api.ts';
import {ordered} from '../knowledge/review-view.ts';
import type {AssignmentBuffer} from './assignment-api.ts';
const editable=(b:AssignmentBuffer,s:DocumentSession)=>b.ownerUserId===s.user.id&&b.ownerClientId===s.clientId&&!b.pending&&!b.result&&!b.uncertain;
/** 미저장 의도의 기존 범위만 줄인다. 원본/관측·권한·실행 상태는 변경하지 않는다. */
export function reduceAssignmentSourceScope(buffer:AssignmentBuffer,session:DocumentSession,scopeIndex:number,targetIndex:number|null,update:(change:(current:AssignmentBuffer)=>AssignmentBuffer)=>void,active:()=>boolean=()=>true):void {
 const expected=structuredClone(buffer),scope=expected.input.definition.allowedScopes[scopeIndex];
 if(!editable(expected,session)||!Number.isSafeInteger(scopeIndex)||scopeIndex<0||!scope||targetIndex!==null&&(!Number.isSafeInteger(targetIndex)||targetIndex<0||targetIndex>=scope.targets.length))throw new ApiError('ASSIGNMENT_SCOPE_REDUCTION_INVALID');
 if(!active())return;
 update(current=>{
  if(!active()||!editable(current,session)||current.bindingId!==expected.bindingId||current.projectId!==expected.projectId||current.controlGeneration!==expected.controlGeneration
   ||ordered(current.input)!==ordered(expected.input)||ordered(current.ref)!==ordered(expected.ref)||ordered(current.expectedDesignRef)!==ordered(expected.expectedDesignRef))return current;
  const next=structuredClone(current),scopes=next.input.definition.allowedScopes;
  if(targetIndex===null)scopes.splice(scopeIndex,1);
  else {scopes[scopeIndex]!.targets.splice(targetIndex,1);if(!scopes[scopeIndex]!.targets.length)scopes.splice(scopeIndex,1);}
  next.dirty=true;next.failure=null;return next;
 });
}
