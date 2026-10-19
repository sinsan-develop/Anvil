import {ApiClient,ApiError} from '../../api/client.ts';
import {readCandidate,type Ref} from '../connections/api.ts';
import type {DocumentSession} from '../design-trace/editor-api.ts';
import type {AssignmentBuffer} from './assignment-api.ts';
import {ordered} from '../knowledge/review-view.ts';
function editable(b:AssignmentBuffer,s:DocumentSession){return b.ownerUserId===s.user.id&&b.ownerClientId===s.clientId&&!b.pending&&!b.result&&!b.uncertain;}
/** 등록 후보 참조만 미저장 임무에 선택한다. 실제 환경/능력·권한·실행 준비는 검증하지 않는다. */
export async function selectAssignmentEnvironment(client:ApiClient,buffer:AssignmentBuffer,session:DocumentSession,rawRef:Ref,active:()=>boolean,update:(change:(current:AssignmentBuffer)=>AssignmentBuffer)=>void){
 const expected=structuredClone(buffer),selected=structuredClone(rawRef);
 if(!editable(expected,session))throw new ApiError('ASSIGNMENT_ENVIRONMENT_SELECTION_INVALID');
 if(!active())return null;
 const value=await readCandidate(client,expected.projectId,selected);
 if(!active())return null;
 if(value.candidate.kind!=='ENVIRONMENT_CANDIDATE'||value.expired)throw new ApiError('ASSIGNMENT_ENVIRONMENT_CANDIDATE_UNAVAILABLE',412);
 update(current=>{
  if(!active()||!editable(current,session)||current.bindingId!==expected.bindingId||current.projectId!==expected.projectId||current.controlGeneration!==expected.controlGeneration
   ||ordered(current.input)!==ordered(expected.input)||ordered(current.expectedDesignRef)!==ordered(expected.expectedDesignRef))return current;
  const next=structuredClone(current);next.input.definition.environmentRef=structuredClone(value.ref);next.dirty=true;next.failure=null;return next;
 });
 return value;
}
