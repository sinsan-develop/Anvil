import {useId,useState} from 'react';
import {inspectReportedTests,reportedTestStatuses,type ReportedTestStatus} from './reported-tests.ts';
export function ReportedTestResults({tests}:{tests:unknown}){
 const id=useId(),[status,setStatus]=useState<ReportedTestStatus|'ALL'>('ALL'),[query,setQuery]=useState('');
 const inspected=inspectReportedTests(tests),term=query.trim().toLowerCase(),rows=inspected.rows.filter(({value})=>(status==='ALL'||value.status===status)&&(!term||[value.testId,value.criterionId].some(s=>s.toLowerCase().includes(term))));
 return <section aria-label="제출 시험 보고 탐색"><h4>제출 시험 보고 탐색</h4><p className="meta">상태·출처는 제출자 선언입니다. 실제 재검증·근거 진위·검수 합격·완료 판정이 아닙니다. 중복 ID는 원문 순서대로 보존합니다.</p>
  {inspected.listInvalid?<p role="alert">보고 목록 형식·범위 미확인 · 전체 제출 원문을 확인하세요.</p>:<>
  {inspected.invalidIndices.length?<p>보고 형식 미확인 {inspected.invalidIndices.length}건 · 원문 위치 {inspected.invalidIndices.map(index=>index+1).join(', ')} · 다른 상태로 보정하지 않았습니다.</p>:null}
  <label htmlFor={id+'-status'}>보고 상태</label><select id={id+'-status'} value={status} onChange={e=>setStatus(e.target.value as ReportedTestStatus|'ALL')}><option value="ALL">전체</option>{reportedTestStatuses.map(value=><option key={value} value={value}>{value}</option>)}</select>
  <label htmlFor={id+'-query'}>시험·조건 ID 찾기</label><input id={id+'-query'} type="search" value={query} onChange={e=>setQuery(e.target.value)}/>
  <p role="status">형식 확인된 보고 {inspected.rows.length}건 중 {rows.length}건 · 수행/합격 건수 아님</p>
  {!rows.length?<p>조건에 맞는 보고 없음 · 시험 수행 여부 판정 아님</p>:rows.map(({index,value})=><details key={index}><summary>{value.testId} · {value.criterionId} · {value.status}</summary><p>원문 위치 {index+1} · 보고 상태 {value.status}</p><h5>기대</h5><p>{value.expected}</p><h5>보고된 실제 내용</h5><p>{value.actual}</p><h5>기준 참조 · 현재 기준 미확인</h5><ul>{value.baselineRefs.map((r,n)=><li key={n}>{r.id} · v{r.version} · SHA256 {r.contentHash}</li>)}</ul><h5>제출자가 선언한 근거 · 진위 미검증</h5>{value.evidence.length?<ul>{value.evidence.map((e,n)=><li key={n}>{e.sourceKind} · 기록 {e.recordedAt}<p>{e.ref.id} · v{e.ref.version} · SHA256 {e.ref.contentHash}</p><p>선언 바이트 SHA256 {e.contentHash}</p><p>환경 {e.environmentRef.id} · v{e.environmentRef.version} · SHA256 {e.environmentRef.contentHash}</p></li>)}</ul>:<p>근거 참조 보고 없음 · 시험 미수행/성공으로 단정하지 않습니다.</p>}</details>)}
  </>}
 </section>;
}
