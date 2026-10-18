import {useId,useState} from 'react';
import type {TaskCard} from '../../../../server/modules/traceability/work-plan-card.ts';

type TaskType = TaskCard['type']|'ALL';
const types: {value:TaskType;label:string}[] = [
  {value:'ALL',label:'전체'}, {value:'SCREEN',label:'화면'},
  {value:'FUNCTION',label:'기능'}, {value:'INTEGRATION',label:'연결'},
  {value:'PREPARATION',label:'준비'},
];
const fields = {inputs:'입력',outputs:'출력',included:'포함 범위',excluded:'제외 범위',allowedFileRefs:'파일 선언',steps:'수행 절차',acceptanceCriteria:'검수 조건',evidenceRequirements:'증거 요구'} as const;

export function StoredPlanTaskList({tasks,query='',type='ALL'}:{tasks:TaskCard[];query?:string;type?:TaskType}){
  const term=query.trim().toLowerCase();
  const matches=tasks.flatMap((task,index)=>(type==='ALL'||task.type===type)&&(!term||[task.taskCode,task.title,task.purpose].some(value=>value.toLowerCase().includes(term)))?[{task,index}]:[]);
  if(!tasks.length)return <p>저장된 업무 카드가 없습니다.</p>;
  return <section aria-label="조회한 업무 카드"><p role="status">전체 {tasks.length}건 중 {matches.length}건</p>
    {!matches.length?<p>조건에 맞는 업무 카드가 없습니다.</p>:null}
    {matches.map(({task:t,index})=><details key={JSON.stringify([index,t.taskCode])}>
      <summary>{t.taskCode} · {t.title} · {t.type}</summary>
      <p>{t.purpose}</p><p>책임 역할: {t.ownerRole}</p>
      <p>착수 선행: {t.startPrerequisites.join(', ')||'없음'}</p>
      <p>검수 선행: {t.acceptancePrerequisites.join(', ')||'없음'}</p>
      {(Object.keys(fields) as (keyof typeof fields)[]).map(field=><section key={field}><h4>{fields[field]}</h4><ul>{t[field].map((value,index)=><li key={index}>{value}</li>)}</ul></section>)}
      <h4>검증 계획</h4>{t.testCases.map((c,index)=><p key={index}>{c.id} · {c.kind} · {c.steps.join(' → ')} · 기대: {c.expected} · 환경: {c.environment}</p>)}
      <p>복구: {t.rollback}</p><p>재개: {t.recoveryNotes}</p>
    </details>)}
  </section>;
}

export function StoredPlanTasks({tasks}:{tasks:TaskCard[]}){
  const id=useId(),[type,setType]=useState<TaskType>('ALL'),[query,setQuery]=useState('');
  return <section aria-label="보관 계획 업무 검색">
    <label htmlFor={id+'-type'}>업무 유형</label><select id={id+'-type'} value={type} onChange={event=>setType(event.target.value as TaskType)}>{types.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}</select>
    <label htmlFor={id+'-query'}>업무 ID·제목·목적 찾기</label><input id={id+'-query'} type="search" value={query} onChange={event=>setQuery(event.target.value)}/>
    <p className="meta">업무 카드의 ID·제목·목적만 검색합니다. 아래 원문 참조와 검토·확정 이력은 전체 계획 기준이며, 실행 상태를 뜻하지 않습니다.</p>
    <StoredPlanTaskList tasks={tasks} query={query} type={type}/>
  </section>;
}
