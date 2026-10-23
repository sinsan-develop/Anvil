import {createElement as h,useId,useState,type ReactNode} from 'react';
import type {ImpactVersion} from './api.ts';
type State='ALL'|ImpactVersion['items'][number]['state'];
export function selectImpactItems(items:ImpactVersion['items'],state:State,query:string){
 const term=query.trim().toLowerCase();
 return items.flatMap((item,index)=>(state==='ALL'||item.state===state)&&(!term||[item.targetRef.kind,item.targetRef.id,item.targetRef.versionRef.id,item.targetRef.localCode??'',item.targetRef.anchor??'',item.reason].some(value=>value.toLowerCase().includes(term)))?[{item,index}]:[]);
}
export function ImpactItemFilter({items,children}:{items:ImpactVersion['items'];children:(rows:ReturnType<typeof selectImpactItems>)=>ReactNode}){
 const id=useId(),[state,setState]=useState<State>('ALL'),[query,setQuery]=useState('');
 const rows=selectImpactItems(items,state,query),unknown=items.filter(item=>item.state==='UNKNOWN').length;
 return h('section',{'aria-label':'영향 항목 탐색'},h('label',{htmlFor:id+'-state'},'영향 항목 상태'),
  h('select',{id:id+'-state',value:state,onChange:(event:{target:{value:string}})=>setState(event.target.value as State)},h('option',{value:'ALL'},'전체'),h('option',{value:'UNKNOWN'},'미확인'),h('option',{value:'AFFECTED'},'재확인 대상'),h('option',{value:'UNAFFECTED'},'사람의 영향 없음 검토')),
  h('label',{htmlFor:id+'-query'},'영향 대상·사유 찾기'),h('input',{id:id+'-query',type:'search',value:query,onChange:(event:{target:{value:string}})=>setQuery(event.target.value)}),
  h('p',{role:'status'},`해당 영향 버전의 전체 ${items.length}건 중 ${rows.length}건 표시 · 전체 미확인 ${unknown}건`),
  h('p',{className:'meta'},'표시된 항목만으로 영향 없음·안전을 판정하지 않습니다. 다른 상태와 범위 미확인·구버전/원근거는 그대로 보존합니다.'),
  !rows.length?h('p',null,'검색 조건에 맞는 영향 항목 없음 · 영향 없음 판정이 아닙니다.'):null,children(rows));
}
