import {createElement as h,type ReactNode} from 'react';
import type {DraftEditorState} from './api.ts';

/** 이 탭의 입력·저장 기록만 표시한다. 총괄·환경 선택이나 실제 준비/권한 판정은 하지 않는다. */
export function DraftWizardReview({buffer,step,pinnedRequirements}:{buffer:DraftEditorState;step:3|4;pinnedRequirements?:ReactNode}){
 if(step===3)return h('section',{'aria-label':'총괄·환경 준비 상태'},h('h3',null,'총괄·환경 준비 상태'),
  h('dl',null,h('dt',null,'총괄 세션'),h('dd',null,'이 생성 화면의 선택 미구현 · 준비 필요'),h('dt',null,'코딩 Agent·개발환경'),h('dd',null,'이 생성 화면의 선택 미구현 · 실제 연결 미확인'),h('dt',null,'실행 권한'),h('dd',null,'미확인 · 이 화면에서 부여하지 않음')),
  buffer.input.methodologySelection?.kind==='NEW_PROJECT_DRAFT'?h('details',null,h('summary',null,'방법론 초안의 준비 요구'),
   h('p',null,'이 탭에 작성한 요구 정의입니다. 등록된 도구·환경이나 실행 허가를 확인한 결과가 아닙니다.'),
   buffer.input.methodologySelection.graph.nodes.length?buffer.input.methodologySelection.graph.nodes.map((node,index)=>h('section',{key:index},h('h4',null,`${node.nodeId} · ${node.name}`),
    h('h5',null,'요구 능력'),node.requirements?.capabilities.length?h('ul',null,node.requirements.capabilities.map((value,item)=>h('li',{key:item},value))):h('p',null,'요구 능력 미작성'),
    h('h5',null,'요구 환경'),node.requirements?.environment.length?h('ul',null,node.requirements.environment.map((value,item)=>h('li',{key:item},value))):h('p',null,'요구 환경 미작성'))):h('p',null,'방법론 단계 미작성')):
   buffer.input.methodologySelection&&pinnedRequirements?pinnedRequirements:h('p',null,buffer.input.methodologySelection?'고정 방법론의 요구 정의는 이 화면에서 아직 조회하지 않았습니다.':'방법론 선택 전이므로 요구 정의 미확인'),
  h('p',null,'미연결 항목을 준비 필요 상태로 저장할 수 있습니다. 환경이나 Agent가 준비됐다고 판정하지 않습니다.'),
  h('p',null,'현재 입력은 이전/다음 이동으로 지우지 않습니다. 생성은 Agent 실행이 아닙니다.'));
 const input=buffer.input,method=input.methodologySelection;
 return h('section',{'aria-label':'생성 전 입력 확인'},h('h3',null,'생성 전 입력 확인'),h('p',{className:'meta'},'이 탭의 입력·저장 기록입니다. 실제 환경·권한·현재 서버 상태를 확인한 결과가 아닙니다.'),
  h('dl',null,h('dt',null,'프로젝트 이름'),h('dd',null,input.name||'미입력'),h('dt',null,'왜 만드는가'),h('dd',null,input.purpose||'미입력'),h('dt',null,'기대 결과'),h('dd',null,input.desiredOutcome||'미입력'),
   h('dt',null,'소스 방식'),h('dd',null,input.sourceMode==='EMPTY'?'새 빈 프로젝트 선택':'기존 소스 사용자 선언 · 미확인'),
   h('dt',null,'방법론 선택'),h('dd',null,method?.kind==='CONFIRMED_REFERENCE'?`확정 참조 선택 · ${method.versionRef.id} v${method.versionRef.version} · SHA256 ${method.versionRef.contentHash}`:method?.kind==='NEW_PROJECT_DRAFT'?`방법론 초안 선택 · ${method.name} · 별도 검토·확정 필요`:'미선택'),
   h('dt',null,'중간본 저장 기록'),h('dd',null,buffer.draftId?`${buffer.draftId} v${buffer.version} · ${buffer.dirty?'미저장 입력 있음':'이 탭에 저장 응답 있음'}`:'저장 전')),
  input.sourceMode==='EXISTING'?h('section',{'aria-label':'검토할 소스 선언'},h('h4',null,'기존 소스 선언 · 실제 파일 접근 전'),input.sourceDeclaration?h('dl',null,h('dt',null,'기기·표시 이름'),h('dd',null,`${input.sourceDeclaration.hostLabel} · ${input.sourceDeclaration.displayName}`),h('dt',null,'위치 설명'),h('dd',null,input.sourceDeclaration.pathHint),h('dt',null,'선언 이유'),h('dd',null,input.sourceDeclaration.reason)):h('p',null,'선언 입력 미확인')):null,
  h('p',null,'총괄·도구·환경 선택은 미구현이며 실제 연결·권한은 미확인입니다. 프로젝트 생성 후에도 준비가 필요합니다.'),
  h('p',null,'생성은 Agent 실행이 아닙니다. 기존 저장·방법론 확정 조건과 같은 명령의 결과 확인 절차를 따릅니다.'));
}
