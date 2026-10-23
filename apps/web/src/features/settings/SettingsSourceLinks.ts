import {createElement as h} from 'react';
import {routeHref,type Screen} from '../../shell/routes.ts';
const sources:[Screen,string][]=[['workspace','프로젝트 작업'],['connections','도구·환경·한도 정책'],['approvals','승인·중요 문제'],['control','제어 기록 조회'],['documents','문서·원문']];
export function SettingsSourceLinks({projectId}:{projectId:string|null}){
 return h('section',{'aria-label':'설정 관련 원화면'},h('h2',null,'설정 관련 원화면'),
  projectId?h('nav',{'aria-label':'같은 프로젝트 원화면'},h('ul',null,...sources.map(([screen,label])=>h('li',{key:screen},h('a',{href:routeHref(screen,projectId)},label))))):
   h('p',null,'프로젝트를 선택하면 같은 프로젝트의 원화면으로 이동할 수 있습니다. ',h('a',{href:routeHref('projects',null)},'프로젝트 선택')),
  h('p',{className:'meta'},'이동은 설정 저장·백업·복원·승인·실행이 아닙니다. 실제 상태는 각 원화면에서 조회하며 여기서 건수나 성공 상태를 합성하지 않습니다.'),
  h('p',null,'백업·복원 설정·실행은 미구현입니다. 설정 저장이나 검증 기록을 실제 백업·복원 성공으로 표시하지 않습니다.'));
}
