import {useId,useState} from 'react';
import {inspectReportedCommands} from './reported-command-output.ts';
import type {PlanRef} from '../design-trace/work-plan-api.ts';
export function ReportedCommandResults({commands,executionRef}:{commands:unknown;executionRef:PlanRef}){
 const id=useId(),[finished,setFinished]=useState('ALL'),[query,setQuery]=useState('');
 const inspected=inspectReportedCommands(commands),term=query.trim().toLowerCase(),rows=inspected.rows.filter(({value})=>(finished==='ALL'||(value.finishedAt===null?'UNREPORTED':'REPORTED')===finished)&&(!term||[value.profileRef.id,...value.argv].some(s=>s.toLowerCase().includes(term))));
 return <section aria-label="제출 명령 보고 탐색"><h4>제출 명령 보고 탐색</h4><p className="meta">시각·exit·인자·출처는 제출자 선언입니다. 실제 수행·성공·원인·현재 권한을 판정하거나 명령을 실행하지 않습니다.</p>
 {inspected.listInvalid?<p role="alert">명령 보고 목록 형식·범위 미확인 · 전체 제출 원문을 확인하세요.</p>:<>
 {inspected.invalidIndices.length?<p>명령 형식 미확인 {inspected.invalidIndices.length}건 · 원문 위치 {inspected.invalidIndices.map(i=>i+1).join(', ')} · 정상 보고로 보정하지 않음</p>:null}
 <label htmlFor={id+'-finished'}>종결 시각 보고</label><select id={id+'-finished'} value={finished} onChange={e=>setFinished(e.target.value)}><option value="ALL">전체</option><option value="REPORTED">종결 시각 보고됨</option><option value="UNREPORTED">종결 시각 미보고</option></select><label htmlFor={id+'-query'}>명령 프로필·인자 찾기</label><input type="search" id={id+'-query'} value={query} onChange={e=>setQuery(e.target.value)}/>
 <p role="status">형식 확인된 명령 보고 {inspected.rows.length}건 중 {rows.length}건 · 실제 수행수/성공수 아님</p>
 {!rows.length?<p>조건에 맞는 명령 보고 없음 · 실제 미수행 판정 아님</p>:rows.map(({index,value})=><details key={index}><summary>명령 보고 {index+1} · {value.exitCode===null?'exit 미보고':'보고 exit '+value.exitCode}</summary><p>보고 시작 {value.startedAt??'미보고'} · 보고 종결 {value.finishedAt??'미보고'}</p><p>보고 exit {value.exitCode??'미보고'} · 성공/실패 원인 판정 아님</p>{value.executionRef.id!==executionRef.id||value.executionRef.version!==executionRef.version||value.executionRef.contentHash!==executionRef.contentHash?<p>제출 원실행과 다른 보고 · 출력 연결 미확인</p>:<p>제출 원실행 참조 일치 · 실제 수행 증명 아님</p>}<h5>인자 원소 · 실행 가능한 명령으로 재구성하지 않음</h5><ol>{value.argv.map((arg,n)=><li key={n}><code>{arg}</code></li>)}</ol><h5>선언 참조 · 실제 환경/경로 미확인</h5><ul>{[['프로필',value.profileRef],['cwd',value.cwdRef],['host',value.hostRef],['원실행',value.executionRef],['출력',value.outputRef]].map(([label,r])=><li key={String(label)}>{String(label)} · {r?JSON.stringify(r):'미보고'}</li>)}</ul><details><summary>선언된 근거 · 진위 미검증</summary><pre>{JSON.stringify(value.evidence,null,2)}</pre></details></details>)}
 </>}
 </section>;
}
