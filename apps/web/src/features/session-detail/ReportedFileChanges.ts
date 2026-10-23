import {createElement as h,useId,useState} from 'react';
import {inspectReportedChanges,reportedChangeKinds,type ReportedChange} from './reported-changes.ts';
import {resolveReportedChangeDiff} from './reported-change-diff.ts';
export function ReportedFileChanges({changes,artifacts}:{changes:unknown;artifacts:unknown}){
 const id=useId(),[kind,setKind]=useState<'ALL'|ReportedChange['kind']>('ALL'),[query,setQuery]=useState('');
 const inspected=inspectReportedChanges(changes),term=query.trim().toLowerCase(),rows=inspected.rows.filter(({value})=>(kind==='ALL'||value.kind===kind)&&(!term||value.path.toLowerCase().includes(term)));
 return h('section',{'aria-label':'제출 변경 파일 보고 탐색'},h('h4',null,'제출 변경 파일 보고 탐색'),
  h('p',{className:'meta'},'제출자 선언의 형식·참조 표시이며 실제 파일 변경·Git diff 검증이 아닙니다. 경로를 열거나 명령을 실행하지 않습니다.'),
  inspected.listInvalid?h('p',{role:'alert'},'변경 보고 목록 형식·범위 미확인 · 전체 제출 원문을 확인하세요.'):h('div',null,
   inspected.invalidIndices.length?h('p',null,`형식 미확인 ${inspected.invalidIndices.length}건 · 원문 위치 ${inspected.invalidIndices.map(index=>index+1).join(', ')} · 정상 변경으로 보정하지 않습니다.`):null,
   h('label',{htmlFor:id+'-kind'},'보고 변경 종류'),h('select',{id:id+'-kind',value:kind,onChange:(event:{target:{value:string}})=>setKind(event.target.value as typeof kind)},h('option',{value:'ALL'},'전체'),reportedChangeKinds.map(value=>h('option',{key:value,value},value))),
   h('label',{htmlFor:id+'-query'},'보고 경로 찾기'),h('input',{id:id+'-query',type:'search',value:query,onChange:(event:{target:{value:string}})=>setQuery(event.target.value)}),
   h('p',{role:'status'},`형식 확인된 변경 보고 ${inspected.rows.length}건 중 ${rows.length}건 · 실제 변경 파일수 아님`),
   rows.length?rows.map(({index,value})=>{const diff=resolveReportedChangeDiff(value,artifacts);return h('details',{key:index},h('summary',null,`변경 보고 ${index+1} · ${value.kind} · ${value.path}`),
    h('p',null,value.beforeHash?`변경 전 SHA256 ${value.beforeHash}`:'변경 전 hash 미보고'),h('p',null,value.afterHash?`변경 후 SHA256 ${value.afterHash}`:'변경 후 hash 미보고'),
    h('p',null,!value.diffRef?'diff 근거 참조 미보고':diff?`동일 제출의 등록 diff 참조 일치 · ${diff.id} v${diff.version} · ${diff.contentHash} · 원문 접근·진위 미검증`:'등록 diff 참조 연결 미확인 · 기존 원문 선택에서 확인하세요.'));}):h('p',null,'조건에 맞는 변경 보고 없음 · 실제 변경/미변경 판정 아님')));
}
