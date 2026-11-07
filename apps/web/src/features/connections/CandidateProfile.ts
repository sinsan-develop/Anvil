import {createElement as h} from 'react';
import type {CandidateView,Ref} from './api.ts';
const toolFields=[['toolProduct','제품'],['toolVersion','제품 버전'],['adapterKind','설치형·CLI·웹 유형'],['connectorRef','연결기 참조'],['environmentRef','환경 참조']];
const environmentFields=[['executionHostRef','실행 호스트 참조'],['sourceRootRefs','소스 참조'],['targetHostRefs','시험·배포 대상'],['commandProfileRefs','명령 정책 참조'],['secretRefs','비밀 참조']];
const reference=(value:Ref)=>`${value.id} · v${value.version} · ${value.contentHash}`;
function describe(value:unknown):string{
 if(typeof value==='string')return value.trim()?value:'빈 값으로 제공';
 if(Array.isArray(value))return value.length?value.map(item=>reference(item as Ref)).join('\n'):'명시적 빈 목록';
 return reference(value as Ref);
}
export function CandidateProfile({view}:{view:CandidateView}){
 const candidate=view.candidate.input.candidate,fields=view.candidate.kind==='CONNECTION_CANDIDATE'?toolFields:environmentFields;
 const rows=fields.map(([key,label])=>h('tr',{key},h('th',{scope:'row'},label),h('td',null,h('pre',null,Object.hasOwn(candidate,key!)?describe(candidate[key!]):'미제공'))));
 return h('section',{'aria-label':'보관 후보 설정·관측'},h('h4',null,'보관 후보 설정·관측'),
  h('p',null,`기록자 ${view.recordedBy} · 기록 ${view.createdAt} · 조회 관측 ${view.observedAt}`),
  h('p',{className:'meta'},`고정 후보 ${reference(view.ref)} · 정책 ${reference(view.candidate.input.policyRef)}`),
  h('table',null,h('caption',null,'사용자 등록 후보 값 · 실제 상태 미검증'),h('tbody',null,...rows)),
  h('p',{className:'meta'},'실제 설치·연결·능력·현재 권한 확인이 아닙니다. 미제공·명시 빈 값·참조를 구분하며 비밀값을 읽거나 표시하지 않습니다. 후보 저장은 실행 범위를 확대하지 않습니다.'));
}
