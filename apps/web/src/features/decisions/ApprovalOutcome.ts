import {createElement as h} from 'react';
import type {ApprovalView} from './api.ts';
type Outcome=Pick<ApprovalView,'decision'|'consumption'|'effectiveState'|'expired'|'basisCurrent'|'observedAt'>;
const labels={APPROVE:'이번만 승인',REJECT:'거절',REQUEST_CHANGE:'수정 요청'};
export function ApprovalOutcome({view}:{view:Outcome}){
 const d=view.decision,c=view.consumption;
 return h('section',{'aria-label':'저장 결정·일회 사용 이력'},h('h4',null,'저장 결정·일회 사용 이력'),
  h('p',null,`서버 관측 상태 ${view.effectiveState} · 관측 ${view.observedAt} · 기한 ${view.expired?'경과':'미경과'} · 기준 ${view.basisCurrent?'일치':'변경됨'}`),
  d?h('div',null,h('p',null,`저장 결정: ${labels[d.decision]}`),h('pre',null,d.reason),
   h('p',null,`결정자 ${d.decidedBy.userId} · 기기 ${d.decidedBy.clientId} · 결정 시각 ${d.decidedAt}`),
   h('p',{className:'meta'},`결정 참조 ${d.ref.id} · v${d.ref.version} · ${d.ref.contentHash}`)):
   h('p',null,'저장된 결정 없음'),
  c?h('div',null,h('p',null,`일회 사용 기록 ${c.id} · 사용 시각 ${c.consumedAt}`),
   h('p',null,`원 명령 ${c.commandId} · 서버 명령 ${c.serverCommandId}`)):
   h('p',null,'이 조회에 일회 사용 기록 없음'),
  h('p',{className:'meta'},'저장된 과거 결정과 현재 관측 상태를 구분합니다. 일회 사용 기록은 실제 실행·성공의 증거는 아닙니다. 이 표시는 승인·소비·재개를 수행하지 않습니다.'));
}
