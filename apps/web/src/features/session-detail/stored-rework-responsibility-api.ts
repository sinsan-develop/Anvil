import {ApiClient,ApiError} from '../../api/client.ts';
import {validRef} from '../connections/api.ts';
import {wireHash,uuid} from '../control-handoff/api.ts';
import {preparationSame as same,readPreparationBinding,readPreparationRole} from '../transfers/preparation-record-api.ts';
import type {ConfirmedAssignmentView} from '../workspace/assignment-confirmation-api.ts';
import type {SubmittedResultView} from './result-api.ts';
import type {StoredResultRework} from './result-rework-write-api.ts';

const mismatch=():never=>{throw new ApiError('RESULT_REWORK_RESPONSIBILITY_MISMATCH',412);};

/** 보관 보완의 역할과 예약을 명시 조회한다. 현재 배정이나 실행 권위는 이 조회로 판정하지 않는다. */
export async function readStoredReworkResponsibility(client:ApiClient,assignment:ConfirmedAssignmentView,result:SubmittedResultView,rework:StoredResultRework,active:()=>boolean){
 const transport=client.transport,current=()=>active()&&client.transport===transport;
 if(!current())return null;
 const a=structuredClone(assignment),r=structuredClone(result),selected=structuredClone(rework),s=selected.snapshot;
 try{
  if(!uuid(a.projectId)||selected.projectId!==a.projectId||s.scope.projectId!==a.projectId||
   !validRef(selected.ref)||selected.ref.version!==1||!validRef(a.ref)||!validRef(r.ref)||!validRef(s.scope.executionRef)||
   !validRef(s.roleRef)||!validRef(s.input.responsibleBindingRef)||!validRef(s.stageSessionRef)||
   !same(s.scope,r.snapshot.scope)||!same(s.scope.assignmentRef,a.ref)||!same(s.input.resultRef,r.ref)||
   await wireHash(s)!==selected.ref.contentHash)return mismatch();
  if(!current())return null;
  const role=await readPreparationRole(client,a,s.roleRef.id,s.roleRef.version,current);
  if(!current())return null;
  if(!same(role.ref,s.roleRef)||role.snapshot.kind!=='STAGE_OWNER')return mismatch();
  const requested=s.input.responsibleBindingRef;
  const binding=await readPreparationBinding(client,a,role,requested.id,requested.version,current);
  if(!current())return null;
  if(!same(binding.ref,requested)||!same(binding.snapshot.sessionRef,s.stageSessionRef))return mismatch();
  return {role,binding};
 }catch(error){
  if(!current())return null;
  throw error;
 }
}
