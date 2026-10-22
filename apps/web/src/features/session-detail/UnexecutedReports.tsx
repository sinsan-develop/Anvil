import {useId,useState} from 'react';
import {inspectUnexecutedReports} from './unexecuted-reports.ts';
type Filter='ALL'|'WITH_REPORT'|'WITHOUT_REPORT'|'WITH_PASS';
/** 같은 제출 안의 표시 관계만 제공한다. 실수행·합격·허위 여부·현재 권한은 판정하지 않는다. */
export function UnexecutedReports({unexecuted,tests}:{unexecuted:unknown;tests:unknown}){
 const id=useId(),[query,setQuery]=useState(''),[filter,setFilter]=useState<Filter>('ALL'),[selected,setSelected]=useState<number|null>(null);
 const inspected=inspectUnexecutedReports(unexecuted,tests),term=query.trim().toLowerCase(),rows=inspected.rows.filter(r=>(filter==='ALL'||filter==='WITH_REPORT'&&r.testReports.length>0||filter==='WITHOUT_REPORT'&&r.testReports.length===0||filter==='WITH_PASS'&&r.testReports.some(t=>t.value.status==='PASS'))&&(!term||[r.value.criterionId,r.value.testId,r.value.reason].some(v=>v.toLowerCase().includes(term))));
 return <section aria-label="제출 미실행 보고 탐색"><h4>제출 미실행 보고 탐색</h4><p className="meta">미실행 사유와 상태는 제출자의 보고입니다. 실제 미수행·원인·시험 합격·완료를 판정하지 않으며 같은 조건·시험 ID의 보고만 대조합니다. 중복 보고는 원문 순서를 유지합니다.</p>
  {inspected.listInvalid?<p role="alert">미실행 목록 형식·범위 미확인 · 전체 제출 원문을 확인하세요.</p>:<>
   {inspected.invalidIndices.length?<p>미실행 형식 미확인 {inspected.invalidIndices.length}건 · 원문 위치 {inspected.invalidIndices.map(n=>n+1).join(', ')} · 정상/완료 보고로 보정하지 않음</p>:null}
   {inspected.testReportsIncomplete?<p>시험 보고 일부의 형식·범위 미확인 · 연결이 없더라도 동일 시험 보고 부재를 확정하지 않습니다.</p>:null}
   <label htmlFor={id+'-association'}>관련 시험 보고</label><select id={id+'-association'} value={filter} onChange={e=>{setFilter(e.target.value as Filter);setSelected(null);}}><option value="ALL">전체 미실행 보고</option><option value="WITH_REPORT">동일 조건·시험 보고 있음</option><option value="WITHOUT_REPORT">대조 가능한 보고 없음</option><option value="WITH_PASS">동일 시험의 PASS 주장 있음</option></select>
   <label htmlFor={id+'-query'}>미실행 조건·시험·사유 찾기</label><input type="search" id={id+'-query'} value={query} onChange={e=>{setQuery(e.target.value);setSelected(null);}}/>
   <p role="status">형식 확인된 미실행 보고 {inspected.rows.length}건 중 {rows.length}건 · 실제 미수행 건수 아님</p>
   {!rows.length?<p>조건에 맞는 미실행 보고 없음 · 모두 수행/합격했다는 판정 아님</p>:<ul>{rows.map(({index,value,testReports})=><li key={index}><button type="button" aria-expanded={selected===index} onClick={()=>setSelected(v=>v===index?null:index)}>미실행 보고 {index+1} · {value.criterionId} / {value.testId}</button>{selected===index?<article aria-label={'미실행 보고 원문 '+(index+1)}><p>원문 위치 {index+1} · 조건 {value.criterionId} · 시험 {value.testId}</p><h5>보고된 미실행 사유</h5><p>{value.reason}</p>{testReports.some(r=>r.value.status==='PASS')?<p>PASS 주장과 미실행 보고가 함께 있습니다 · 보고 시점·근거·적합성은 별도 검토가 필요하며 어느 쪽도 자동 확정하지 않습니다.</p>:null}<h5>동일 제출의 조건·시험 보고</h5>{testReports.length?<ul>{testReports.map(r=><li key={r.index}>시험 보고 원문 위치 {r.index+1} · {r.value.status}<p>기대: {r.value.expected}</p><p>보고 내용: {r.value.actual}</p><p>선언 출처: {[...new Set(r.value.evidence.map(e=>e.sourceKind))].join(', ')||'근거 출처 보고 없음'} · 출처 진위 미검증</p></li>)}</ul>:<p>대조 가능한 동일 조건·시험 보고 없음 · 실제 수행/미수행 판정 아님</p>}</article>:null}</li>)}</ul>}
  </>}
 </section>;
}
