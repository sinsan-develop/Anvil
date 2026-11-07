import {ApiClient,ApiError} from '../../api/client.ts';
import {readAssignmentDraft,type AssignmentDraftView} from './assignment-api.ts';
import {ordered} from '../knowledge/review-view.ts';
export interface AssignmentRevisionChange{field:string;before:unknown;after:unknown}
/** 이미 조회한 현재 원문에 고정된 직전 버전만 대조한다. 의미/권한·현재성/실행 판정이 아니다. */
export async function readAssignmentRevisionComparison(client:ApiClient,current:AssignmentDraftView,active:()=>boolean=()=>true){
 const selected=structuredClone(current),ref=selected.snapshot.previousRef;
 if(!ref||ref.id!==selected.ref.id||!Number.isSafeInteger(selected.ref.version)||selected.ref.version!==ref.version+1)throw new ApiError('ASSIGNMENT_REVISION_REFERENCE_INVALID');
 if(!active())return null;
 const previous=await readAssignmentDraft(client,selected.projectId,ref);if(!active())return null;
 const changes:AssignmentRevisionChange[]=[];
 const compare=(field:string,before:unknown,after:unknown)=>{if(ordered(before)!==ordered(after))changes.push({field,before:structuredClone(before),after:structuredClone(after)});};
 const old=previous.snapshot.definition,next=selected.snapshot.definition;
 for(const key of [...new Set([...Object.keys(old),...Object.keys(next)])].sort())compare('definition.'+key,old[key as keyof typeof old],next[key as keyof typeof next]);
 compare('basis',previous.snapshot.basis,selected.snapshot.basis);compare('reason',previous.snapshot.reason,selected.snapshot.reason);compare('readinessIssues',previous.snapshot.readinessIssues,selected.snapshot.readinessIssues);
 return{previous,currentRef:selected.ref,changes};
}
