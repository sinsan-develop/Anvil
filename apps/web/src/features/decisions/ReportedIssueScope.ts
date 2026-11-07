import {createElement as h} from 'react';import type {ConfirmedAssignmentView} from '../workspace/assignment-confirmation-api.ts';
type Definition=ConfirmedAssignmentView['snapshot']['definition'];
export function ReportedIssueScope({definition:d}:{definition:Definition}){
 return h('section',{'aria-label':'보고의 고정 임무 범위'},h('h5',null,'당시 포함·제외와 수행 경계'),
 h('dl',null,
 ...([['ownerRole','책임 역할'],['integrationResponsibility','통합 책임']] as const).map(([field,label])=>h('div',{key:field},h('dt',null,label),h('dd',null,d[field]||'미입력'))),
 ...([['inputs','입력'],['outputs','산출물'],['included','포함 범위'],['excluded','제외 범위'],['requiredCapabilities','필요 능력']] as const).map(([field,label])=>h('div',{key:field},h('dt',null,label),h('dd',null,d[field].length?h('ul',null,...d[field].map((v,i)=>h('li',{key:i},h('pre',null,v||'미입력')))):'기록 없음 · 미확인'))),
 h('div',null,h('dt',null,'기준 참조'),h('dd',null,d.baselineRefs.length?h('ul',null,...d.baselineRefs.map((r,i)=>h('li',{key:i},r.id+' · v'+r.version+' · '+r.contentHash))):'기준 참조 없음 · 미확인')),
 h('div',null,h('dt',null,'소스 허가 범위'),h('dd',null,d.allowedScopes.length?h('pre',null,JSON.stringify(d.allowedScopes,null,2)):'등록 범위 없음 · 실행 허가 아님')),
 ...([['environmentRef','환경 참조'],['budgetRef','예산 참조'],['recordingPolicyRef','상황기록 정책 참조'],['parentAssignmentRef','부모 임무 참조']] as const).map(([field,label])=>{const r=d[field];return h('div',{key:field},h('dt',null,label),h('dd',null,r?r.id+' · v'+r.version+' · '+r.contentHash+' · 현재 유효성 미검증':'미연결 · 미검증'));})),
 h('p',{'className':'meta'},'저장 당시 고정 조건입니다. 현재 실행 허가 아님 · 권한·환경·예산·능력의 현재 유효성을 검증하거나 새로 부여하지 않습니다.'));
}
