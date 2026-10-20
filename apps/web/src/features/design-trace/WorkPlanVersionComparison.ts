import {createElement as h} from 'react';
import type {WorkPlanView} from './work-plan-api.ts';
import {ordered} from '../knowledge/review-view.ts';
import {compareDocumentBodies} from './document-version-comparison.ts';
const text=(v:WorkPlanView)=>JSON.stringify(JSON.parse(ordered({documentRef:v.documentRef,designRef:v.designRef,screenReviewRefs:v.screenReviewRefs,tasks:v.tasks,dependencies:v.dependencies,reason:v.reason,issues:v.issues,relationalProjection:v.relationalProjection})),null,2);
/** 조회·무결성 확인된 두 보관본의 표시 비교이며 의미 적합/확정·실행 판정이 아니다. */
export function WorkPlanVersionComparison({before,after}:{before:WorkPlanView;after:WorkPlanView}){
 if(before.ref.id!==after.ref.id)return h('p',{role:'status'},'동일 계획의 버전이 아니므로 비교하지 않습니다.');
 const result=compareDocumentBodies(text(before),text(after));
 return h('details',{'aria-label':'보관 계획 변경 비교'},h('summary',null,'보관 버전과 기준 계획의 변경 비교'),h('p',null,`보관 계획 v${before.ref.version} → 기준 계획 v${after.ref.version}`),
  h('p',{className:'meta'},'업무 카드·선행·고정 문서/설계/화면검토 참조·저장 이유/구조 문제의 키 정렬 JSON을 비교합니다. 공통 양끝을 제외한 차이 포함 구간이며 최소 편집 diff가 아닙니다. 관측시각·검수/확정·적용·실행 상태는 비교하지 않으며 원문과 입력을 변경하지 않습니다.'),
  result.kind==='IDENTICAL'?h('p',null,'두 버전의 표시 내용이 같습니다. 검토·확정·적용 상태가 같다는 뜻은 아닙니다.'):result.kind==='UNVERIFIED'?h('p',{role:'status'},'비교 미확인 · 각 표시 원문 131072자/4000줄 한도 초과. 원문 조회는 유지합니다.'):h('div',null,
   h('p',null,`공통 앞 ${result.commonBeforeLines}줄 · 뒤 ${result.commonAfterLines}줄 제외`),h('h5',null,`보관 계획 v${before.ref.version} 차이 포함 구간`),h('pre',{'aria-label':'보관 계획 차이 구간',style:{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}},result.before),h('h5',null,`기준 계획 v${after.ref.version} 차이 포함 구간`),h('pre',{'aria-label':'기준 계획 차이 구간',style:{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}},result.after)));
}
