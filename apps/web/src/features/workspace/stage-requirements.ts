import {createElement as h} from 'react';
import type {MethodologyNode} from '../../../../../contracts/methodologies.ts';

/** 조회/해시 대조된 고정 정의만 표시한다. 실제 도구·환경·한도를 검증/적용하지 않는다. */
export function StageRequirements({requirements,limitPolicyRef}:Pick<MethodologyNode,'requirements'|'limitPolicyRef'>){
 const items=(label:string,values:string[]|undefined,empty:string)=>h('div',null,
  h('dt',null,label),h('dd',null,values?.length?h('ul',null,values.map((value,index)=>h('li',{key:index},value))):empty));
 return h('section',{'aria-label':'단계 필요조건 정의'},h('h5',null,'단계 필요조건 정의'),h('dl',null,
  items('필요 능력',requirements?.capabilities,'필요 능력 정의 없음'),
  items('개발환경',requirements?.environment,'개발환경 정의 없음'),
  h('div',null,h('dt',null,'한도 정책 고정 참조'),h('dd',null,limitPolicyRef
   ?`${limitPolicyRef.id} · v${limitPolicyRef.version} · ${limitPolicyRef.contentHash}`:'한도 정책 참조 없음'))),
  h('p',{className:'meta'},'저장된 단계 정의입니다. 실제 능력·환경·예산 검증이나 실행 허가가 아닙니다.'));
}
