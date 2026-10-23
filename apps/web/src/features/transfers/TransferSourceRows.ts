import {createElement as h} from 'react';
import type {ContextPreparationView} from '../workspace/context-api.ts';
type Items=ContextPreparationView['manifest']['items'];
export function TransferSourceRows({items,pending,onRead}:{items:Items;pending:boolean;onRead:(id:string)=>void}){
 return h('div',null,h('p',{className:'meta'},'보관 맥락의 수집 항목입니다. 현재 효력·이해 대조·재개 확인이 아닙니다.'),
  h('table',null,h('caption',null,'인계 원문 선택과 고정 참조'),
   h('thead',null,h('tr',null,...['항목·수집 상태','고정 원문','선택 이유·누락','원문 조회'].map(label=>h('th',{key:label,scope:'col'},label)))),
   h('tbody',null,...items.map(item=>{const ref=item.sourceRef,disabled=pending||item.includedState!=='INCLUDED';return h('tr',{key:item.itemId},
    h('td',null,`${item.category} · ${item.itemId} · ${item.includedState}`),
    h('td',null,ref?h('div',null,h('p',null,ref.id),h('p',null,typeof ref.version==='number'?`v${ref.version}`:'버전 없는 대화 원문'),h('p',{className:'meta'},ref.contentHash)):h('p',null,'원문 미선택')),
    h('td',null,h('pre',null,item.reason),h('p',null,item.issue??'이 항목에 기록된 추가 오류 없음 · 의미 적합 미확인')),
    h('td',null,h('button',{type:'button',disabled,onClick:()=>{if(!disabled)onRead(item.itemId);}},`인계 항목 원문 ${item.itemId}`)));}))));
}
