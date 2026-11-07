import type {MethodologyGraph} from '../../../../../contracts/methodologies.ts';
import type {MethodVersion} from './api.ts';
import {methodIssueNodeTargets} from './method-issue-targets.ts';
export function StoredMethodValidation({graph,validation,onSelect}:{graph:MethodologyGraph;validation:MethodVersion['validation'];onSelect:(nodeId:string)=>void}){
 return <section aria-label="저장 원본 구조 검사"><p>{validation.validForConfirmation?'구조 오류 없음 · 내용 검토·확정·적용·실제 실행은 별도':'저장 원본 구조 보완 필요'}</p>
  <ul>{validation.issues.map((issue,index)=>{const targets=methodIssueNodeTargets(graph,issue.location);return <li key={index}>{issue.severity} · {issue.code} · {issue.location}: {issue.message} {targets.length?targets.map(target=><button key={target.nodeId} onClick={()=>onSelect(target.nodeId)}>문제 단계 조회 {target.nodeId}: {target.name}</button>):<span>연결할 단계 미확인 · 원 오류는 유지합니다.</span>}</li>;})}</ul>
 </section>;
}
