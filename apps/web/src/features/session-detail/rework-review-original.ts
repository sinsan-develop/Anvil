import {ApiClient,ApiError} from '../../api/client.ts';
import type {ConfirmedAssignmentView} from '../workspace/assignment-confirmation-api.ts';
import type {SubmittedResultView} from './result-api.ts';
import type {StoredResultRework} from './result-rework-write-api.ts';
import {readStoredResultRework,type StoredReworkSummary} from './stored-result-reworks-api.ts';
import {readStoredResultReviewReference} from './stored-result-reviews-api.ts';
/** 명시 읽기만 한다. 보관 관계 일치가 현재 권한/재작업·시험 성공/완료 판정은 아니다. */
export async function readReworkReviewOriginal(client:ApiClient,assignment:ConfirmedAssignmentView,result:SubmittedResultView,original:StoredResultRework,active:()=>boolean){
 if(!active())return null;const a=structuredClone(assignment),r=structuredClone(result),selected=structuredClone(original),s=selected?.snapshot,i=s?.input;
 if(!s||!i)throw new ApiError('REWORK_REVIEW_ORIGINAL_INVALID');
 const item:StoredReworkSummary={ref:selected.ref,reviewRef:i.reviewRef,responsibleBindingRef:i.responsibleBindingRef,stageSessionRef:s.stageSessionRef,missingItems:i.missingItems,remainingMissingItems:s.remainingMissingItems,requestedBy:s.requestedBy,requestedAt:s.requestedAt,reworkStored:true,currentBindingVerified:false,currentAuthorityVerified:false,completionAccepted:false,formalFailureCounted:false,executionAuthorized:false,dispatchPerformed:false};
 const rework=await readStoredResultRework(client,a,r,item,active);if(!active()||!rework)return null;
 const review=await readStoredResultReviewReference(client,r,rework.snapshot.input.reviewRef,rework.snapshot.criteriaRef,active);if(!active()||!review)return null;
 const picked=new Set(rework.snapshot.input.missingItems),remaining=new Set(rework.snapshot.remainingMissingItems),items=review.snapshot.input.items;
 if(items.length!==picked.size+remaining.size||items.some(v=>!picked.has(v.criterionId)&&!remaining.has(v.criterionId))||[...picked].some(id=>remaining.has(id))||Date.parse(review.snapshot.reviewedAt)>Date.parse(rework.snapshot.requestedAt))throw new ApiError('REWORK_REVIEW_ORIGINAL_MISMATCH',412);
 return{rework,review,selectedItems:items.filter(v=>picked.has(v.criterionId)),remainingItems:items.filter(v=>remaining.has(v.criterionId))};
}
