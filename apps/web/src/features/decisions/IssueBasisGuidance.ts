import {createElement as h} from 'react';
import type {StoredIssueBasis} from './issue-basis-api.ts';

const unknownLabels:Record<string,string>={
 UNDERLYING_CAUSE_NOT_ESTABLISHED:'직접 원인은 확인되지 않았습니다',
 ACTUAL_PROVIDER_NOT_VALIDATED:'실제 공급자 동작은 검증하지 않았습니다',
 OBSERVATION_SEQUENCE_GAP:'관측 순번에 보관 공백이 있습니다',
 NO_CURRENT_OBSERVATION:'현재 직접 관측이 없습니다',
};
const choiceLabels:Record<string,string>={
 RECONCILE_MISSING_SEQUENCES:'누락 순번의 보관·수신 기록을 대조',
 INSPECT_EVIDENCE_WITHOUT_GUESSING:'직접 원인을 추측하지 말고 근거를 확인',
};

/** 기존 reader가 대조한 보관 근거만 안내한다. 새 원인·허가·동작을 생성하지 않는다. */
export function IssueBasisGuidance({value}:{value:StoredIssueBasis}){
 const c=value.classification;
 return h('section',{'aria-label':'문제 근거의 미확인·다음 확인'},
  h('h6',null,'확인하지 못한 사항'),
  h('ul',null,...c.unknowns.map(code=>h('li',{key:code},unknownLabels[code]??'미확인 항목',` · ${code}`))),
  h('h6',null,'다음 확인 선택'),
  h('ul',null,...c.nextChoices.map(code=>h('li',{key:code},choiceLabels[code]??'정의되지 않은 확인 선택',` · ${code}`))),
  h('p',null,'위 선택은 확인 방향입니다. 재시도·Agent 교체·중지·권한 회수는 자동으로 수행하지 않습니다.'),
 );
}
