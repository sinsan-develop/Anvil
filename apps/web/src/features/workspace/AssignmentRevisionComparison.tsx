import {useEffect,useRef,useState} from 'react';
import type {ApiClient} from '../../api/client.ts';
import type {AssignmentDraftView} from './assignment-api.ts';
import {readAssignmentRevisionComparison} from './assignment-revision-comparison.ts';
const names:Record<string,string>={purpose:'목적',goal:'목표',taskRef:'계획 업무·단계',baselineRefs:'기준 참조',inputs:'입력',outputs:'산출물',acceptanceCriteria:'완료 조건',verificationRequirements:'검증 조건',included:'포함 범위',excluded:'제외 범위',allowedScopes:'소스 범위',environmentRef:'환경 참조',requiredCapabilities:'필요 능력',budgetRef:'예산 참조',ownerRole:'책임 역할',parentAssignmentRef:'부모 임무',recordingPolicyRef:'상황기록 정책',integrationResponsibility:'통합 책임',basis:'저장 근거',reason:'개정 이유',readinessIssues:'보관 준비 문제'};
const display=(value:unknown)=>typeof value==='string'?value:JSON.stringify(value,null,2);
type Comparison=NonNullable<Awaited<ReturnType<typeof readAssignmentRevisionComparison>>>;
export function AssignmentRevisionComparison({client,current,busy,run}:{client:ApiClient;current:AssignmentDraftView;busy:boolean;run:(action:()=>Promise<void>)=>void}){
 const [value,setValue]=useState<Comparison|null>(null),[loading,setLoading]=useState(false),live=useRef(true),ticket=useRef(0);
 useEffect(()=>{live.current=true;return()=>{live.current=false;ticket.current++;};},[]);
 function close(){ticket.current++;setValue(null);setLoading(false);}
 async function load(){
  const chosen=++ticket.current,active=()=>live.current&&chosen===ticket.current;setValue(null);setLoading(true);
  try{const result=await readAssignmentRevisionComparison(client,current,active);if(active())setValue(result);}catch(cause){if(active())throw cause;}finally{if(active())setLoading(false);}
 }
 return <section aria-label="저장 임무 개정 비교"><h5>저장 임무 개정 비교</h5><p>선택 원문에 고정된 직전 1개 버전만 명시 조회합니다. 최신 버전이나 작성 입력으로 대체하지 않습니다.</p>
  <button type="button" disabled={busy} onClick={()=>run(load)}>직전 임무와 변경 비교</button><button type="button" disabled={!loading&&!value} onClick={close}>임무 비교 닫기</button>
  {loading?<p role="status">직전 고정 임무 원문 확인 중 · 이전 비교 숨김</p>:null}
  {value?<section aria-label="임무 개정 값 비교"><p>이전 v{value.previous.ref.version} → 선택 v{value.currentRef.version} · 변경 항목 {value.changes.length}개</p><p>이전 {value.previous.ref.id} · {value.previous.ref.contentHash}</p><p>선택 {value.currentRef.id} · {value.currentRef.contentHash}</p>
   {value.changes.length?<ul>{value.changes.map(change=>{const label=names[change.field.replace(/^definition\./,'')]??change.field;return <li key={change.field}><h6>{label}</h6><p>이전 값</p><pre aria-label={label+' 이전 값'}>{display(change.before)}</pre><p>선택 값</p><pre aria-label={label+' 선택 값'}>{display(change.after)}</pre></li>;})}</ul>:<p>대조한 정의·근거·이유·준비 문제의 값 차이 없음</p>}
   <p>구조 값 비교일 뿐 의미 적합성·현재 원본 효력/권한·실제 영향·배정/실행/완료 판정이 아닙니다.</p>
  </section>:null}
 </section>;
}
