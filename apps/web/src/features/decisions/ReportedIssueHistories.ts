import {createElement as h} from 'react';
import type {ApiClient} from '../../api/client.ts';
import type {SubmittedResultView} from '../session-detail/result-api.ts';
import type {ConfirmedAssignmentView} from '../workspace/assignment-confirmation-api.ts';
import {StoredResultReworkHistory} from '../session-detail/StoredResultReworkHistory.tsx';
import {ReportedIssueReviewHistory} from './ReportedIssueReviewHistory.tsx';

/** 부모가 대조한 같은 원결과·임무의 기존 읽기 경로만 재사용한다. 자동 조회·저장·배정은 없다. */
export function ReportedIssueHistories({client,result,assignment,onUnavailable,onAuthenticationLost}:{client:ApiClient;result:SubmittedResultView;assignment:ConfirmedAssignmentView;onUnavailable:(code:string)=>void;onAuthenticationLost:()=>void}){
 return h('section',{'aria-label':'보고의 검수·보완 이력'},
  h(ReportedIssueReviewHistory,{client,result,assignment,onUnavailable,onAuthenticationLost}),
  h(StoredResultReworkHistory,{client,result,assignment,onAccessUnavailable:onUnavailable,onAuthenticationLost}),
 );
}
