import {createElement as h} from 'react';
import type {ConstitutionView} from './constitution-api.ts';

/** 소비자는 기존 readProjectConstitution의 권한·정확 참조/원문 검사를 거친 값만 준다. */
export function ConstitutionReadOnly({current,observedAt}:{current:ConstitutionView['current'];observedAt:string}){
 return h('section',{'aria-label':'적용 헌법 조회 내용'},
  current?h('div',null,
   h('p',null,`적용 세대 ${current.ref.version} · 지식 버전 ${current.application.versionRef.version} · ${current.source.entry.title}`),
   h('p',null,current.eligibility.usable?'현재 사용 가능한 헌법':'과거 적용 보존 · 현재 사용 불가',current.eligibility.reasons.length?' · '+current.eligibility.reasons.join(', '):''),
   h('p',{className:'meta'},`적용 참조 ${current.ref.id} · v${current.ref.version} · ${current.ref.contentHash}`),
   h('p',{className:'meta'},`지식 참조 ${current.application.versionRef.id} · v${current.application.versionRef.version} · ${current.application.versionRef.contentHash}`),
   h('pre',{'aria-label':'적용 헌법 원문'},current.source.body),h('p',null,'적용 이유: '+current.application.reason))
   :h('p',null,'프로젝트 적용 헌법 없음'),
  h('p',{className:'meta'},'조회 시각: ',h('time',{dateTime:observedAt},observedAt)),
  h('p',{className:'meta'},'Agent 전달 미연결 · 준수 여부 미판정. 임무 맥락 묶음 생성·전달·이해 검토가 아닙니다.'));
}
