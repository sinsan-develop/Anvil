import {ApiClient,ApiError} from '../../api/client.ts';
import {documentControl,type DocumentSession} from '../design-trace/editor-api.ts';
import type {PlanRef} from '../design-trace/work-plan-api.ts';
import {ordered} from '../knowledge/review-view.ts';
import type {ConfirmedAssignmentView} from './assignment-confirmation-api.ts';
import {newContextPreparation,readContextPreparation,type ContextPreparationBuffer} from './context-api.ts';

/** 기존 보호조회와 현재제어를 확인해 미저장 입력만 만든다. 원본/준비 저장·전달은 수행하지 않는다. */
export async function reuseContextPreparationInput(client:ApiClient,confirmed:ConfirmedAssignmentView,session:DocumentSession,ref:PlanRef,isCurrent:()=>boolean):Promise<ContextPreparationBuffer|null>{
 if(!isCurrent())return null;
 try{
  const source=await readContextPreparation(client,confirmed.projectId,ref);if(!isCurrent())return null;
  if(ordered(source.manifest.assignmentRef)!==ordered(confirmed.ref)||ordered(source.manifest.budgetRef)!==ordered(confirmed.snapshot.definition.budgetRef))throw new ApiError('CONTEXT_ASSIGNMENT_INVALID');
  const generation=await documentControl(client,confirmed.projectId,session);if(!isCurrent())return null;
  const next=newContextPreparation(confirmed,session,generation);
  next.input=structuredClone(source.manifest.preparationInput);next.input.reason='';
  return next;
 }catch(cause){if(!isCurrent())return null;throw cause;}
}
