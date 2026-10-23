import {createElement as h} from 'react';
import type {KnowledgeView} from './api.ts';
const events={PROPOSED:'제안',CORRECTED:'정정',CONFIRMED:'확정 기록',EXCLUDED:'사용 제외'};
const states={PROPOSED:'제안 상태',CONFIRMED:'확정 이력 있음',SUPERSEDED:'대체된 과거 버전',EXCLUDED:'사용 제외'};
export function KnowledgeHistory({view}:{view:KnowledgeView}){
 const rows=view.history.map(event=>h('tr',{key:event.id},
  h('td',null,events[event.kind],h('p',{className:'meta'},event.id)),
  h('td',null,h('pre',null,event.reason)),h('td',null,event.actorRef.userId),h('td',null,event.recordedAt),
  h('td',null,event.baseRef?`${event.baseRef.id} · v${event.baseRef.version} · ${event.baseRef.contentHash}`:'이 사건에 앞 버전 참조 없음')));
 const validity=view.currentConfirmationValid===true?'현재 확정 유효':view.currentConfirmationValid===false?'현재 확정 유효하지 않음':'현재 확정 유효성 미확인';
 return h('section',{'aria-label':'지식 버전별 변경 이력'},h('h4',null,'지식 버전별 변경 이력'),
  h('p',null,`${view.ref.id} · v${view.ref.version} · ${view.ref.contentHash} · ${states[view.state]} · ${validity}`),
  h('p',{className:'meta'},'이 버전의 기록만 표시합니다. 다른 버전 이력은 앞 버전 원문에서 확인합니다. 사용 제외는 원문 삭제가 아닙니다. 과거 확정 기록은 현재 사용 가능·내용 진위·Agent 전달·이해 대조 확인이 아닙니다.'),
  h('table',null,h('caption',null,'보관된 사건 순서·이유·작성자'),h('thead',null,h('tr',null,...['사건','기록 이유','작성자','기록 시각','정정 전 고정 참조'].map(label=>h('th',{key:label,scope:'col'},label)))),h('tbody',null,...rows)));
}
