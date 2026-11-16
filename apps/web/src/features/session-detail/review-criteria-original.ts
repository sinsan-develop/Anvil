import {ApiClient} from '../../api/client.ts';
import type {PlanRef} from '../design-trace/work-plan-api.ts';
import type {ConfirmedAssignmentView} from '../workspace/assignment-confirmation-api.ts';
import {readStoredCriteriaRef} from './result-criteria-api.ts';

/** 보관 검수의 정확한 기준만 소비한다. 최근 목록 밖 참조도 최신 버전으로 대체하지 않는다. */
export async function readReviewCriteriaOriginal(client:ApiClient,assignment:ConfirmedAssignmentView,criteriaRef:PlanRef,active:()=>boolean){
 return readStoredCriteriaRef(client,assignment,criteriaRef,active);
}
