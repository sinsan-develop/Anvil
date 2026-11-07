import {ApiClient,ApiError} from '../../api/client.ts';
import type {PlanRef} from '../design-trace/work-plan-api.ts';
import type {ConfirmedAssignmentView} from '../workspace/assignment-confirmation-api.ts';
import {ordered} from '../knowledge/review-view.ts';
import {readStoredCriteriaList,readStoredCriteria} from './result-criteria-api.ts';

/** 보관 검수의 정확한 기준만 소비한다. 최근 목록 밖 참조를 최신 버전으로 대체하지 않는다. */
export async function readReviewCriteriaOriginal(client:ApiClient,assignment:ConfirmedAssignmentView,criteriaRef:PlanRef,active:()=>boolean){
 const a=structuredClone(assignment),ref=structuredClone(criteriaRef);
 const list=await readStoredCriteriaList(client,a,active);if(!active()||!list)return null;
 const item=list.items.find(i=>ordered(i.ref)===ordered(ref));
 if(!item)throw new ApiError('REVIEW_CRITERIA_NOT_IN_RECENT_LIST');
 return readStoredCriteria(client,a,item,active);
}
