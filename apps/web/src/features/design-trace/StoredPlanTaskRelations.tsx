import {useId,useState} from 'react';
import {ordered} from '../knowledge/review-view.ts';
import type {WorkPlanView} from './work-plan-api.ts';
import {storedPlanRelations} from './stored-plan-relations.ts';
import {StoredPlanTaskList} from './StoredPlanTasks.tsx';
const states={UNIQUE:'같은 계획의 고유 업무',MISSING:'같은 계획에 없음',AMBIGUOUS:'같은 계획의 코드 중복',SELF:'자기 참조 · 정상 선행 아님'};
export function StoredPlanTaskRelations({view}:{view:WorkPlanView}){
 const id=useId(),binding=ordered(view.ref),[selection,setSelection]=useState<{binding:string;code:string}|null>(null),selected=selection?.binding===binding?selection.code:'',result=selected?storedPlanRelations(view.tasks,selected):null,counts=new Map<string,number>();for(const t of view.tasks)counts.set(t.taskCode,(counts.get(t.taskCode)??0)+1);
 const choose=(code:string)=>{if(storedPlanRelations(view.tasks,code).state==='UNIQUE')setSelection({binding,code});};
 return <section className="status-card" aria-label="고정 계획 업무 관계 탐색"><h3>같은 계획의 선행·후속 업무 원문</h3><p>고정 계획 {view.ref.id} · v{view.ref.version} · {view.ref.contentHash}</p><p>카드의 직접 관계 정의입니다. 실제 선행 완료·착수 허가 아님 · 서버 추적 연결/현재 진행·전이 영향 판정 아님</p><label htmlFor={id}>관계 조회 업무</label><select id={id} value={selected} onChange={e=>e.target.value?choose(e.target.value):setSelection(null)}><option value="">업무 선택</option>{view.tasks.map((task,index)=><option key={index} value={task.taskCode} disabled={counts.get(task.taskCode)!==1}>{task.taskCode} · {task.title}{counts.get(task.taskCode)!==1?' · 코드 중복':''}</option>)}</select>
 {!result?<p>업무를 명시 선택하면 같은 조회 버전의 선행·후속을 확인합니다. 검색·편집 입력은 바꾸지 않습니다.</p>:result.state!=='UNIQUE'?<p role="status">선택 업무 {states[result.state]} · 임의 첫 카드로 대체하지 않습니다.</p>:<><p>선택: {result.task.taskCode} · {result.task.title}</p>{result.links.length?<ul>{result.links.map((link,index)=>{const label=(link.phase==='START'?'착수':'검수')+' '+(link.direction==='PREREQUISITE'?'선행':'후속');return <li key={index}><span>{link.taskCode} · {states[link.state]}</span><button type="button" disabled={link.state!=='UNIQUE'} onClick={()=>{if(link.state==='UNIQUE')choose(link.taskCode);}}>{label} {link.taskCode} 원문 선택</button></li>;})}</ul>:<p>카드 선언에서 직접 선행·후속 없음 · 완료/독립 실행 가능 판정 아님</p>}<section key={selected} aria-label="관계 업무 원문"><StoredPlanTaskList tasks={[result.task]}/></section></>}
 </section>;
}
