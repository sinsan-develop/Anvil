import {useEffect,useRef,useState} from 'react';
import {ApiClient} from '../../api/client.ts';
import type {DocumentSession} from '../design-trace/editor-api.ts';
import {readLimitPolicy,type LimitPolicyRecord} from '../connections/limit-policy-api.ts';
import type {AssignmentBuffer} from './assignment-api.ts';
import {applyAssignmentBudgetSelection} from './assignment-budget-selection.ts';
import {clearAssignmentSelection} from './assignment-selection-clear.ts';

export function AssignmentBudgetSelection({client,buffer,session,locked,update,run}:{client:ApiClient;buffer:AssignmentBuffer;session:DocumentSession;locked:boolean;update:(change:(value:AssignmentBuffer)=>AssignmentBuffer)=>void;run:(action:()=>Promise<void>)=>void}){
 const[ref,setRef]=useState({id:'',version:'',contentHash:''}),[policy,setPolicy]=useState<LimitPolicyRecord|null>(null);
 const alive=useRef(true);useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 async function load(){setPolicy(null);const value=await readLimitPolicy(client,buffer.projectId,{id:ref.id,version:Number(ref.version),contentHash:ref.contentHash});if(alive.current)setPolicy(value);}
 return <section aria-label="임무 예산 정책 선택"><h5>임무 예산 정책 선택</h5><p>도구·환경 화면에서 작성한 프로젝트 정책의 정확 참조를 조회하세요. 보관 APPLIED도 현재 유효·사용량·실제 강제 확인이 아닙니다. 선택은 미저장 초안에만 반영합니다.</p>
  <label>선택 예산 정책 ID<input aria-label="선택 예산 정책 ID" disabled={locked} value={ref.id} onChange={e=>{setPolicy(null);setRef({...ref,id:e.target.value});}}/></label>
  <label>선택 예산 정책 버전<input aria-label="선택 예산 정책 버전" type="number" min="1" step="1" disabled={locked} value={ref.version} onChange={e=>{setPolicy(null);setRef({...ref,version:e.target.value});}}/></label>
  <label>선택 예산 정책 hash<input aria-label="선택 예산 정책 hash" disabled={locked} value={ref.contentHash} onChange={e=>{setPolicy(null);setRef({...ref,contentHash:e.target.value});}}/></label>
  <button type="button" disabled={locked} onClick={()=>run(load)}>임무 예산 고정 버전 조회</button>
  {policy?<article aria-label="선택 전 예산 보관본"><p>{policy.ref.id} · v{policy.ref.version} · {policy.ref.contentHash}<br/>보관 상태 {policy.snapshot.state} · 현재 유효성 미검증</p><pre>{JSON.stringify(policy.snapshot.limits,null,2)}</pre><p>기록 기한 {policy.snapshot.expiresAt} · {policy.snapshot.reason}</p>
   <button type="button" disabled={locked||policy.snapshot.state!=='APPLIED'||buffer.uncertain} onClick={()=>run(()=>applyAssignmentBudgetSelection(buffer,session,policy,()=>alive.current,update))}>이 보관 예산을 임무 초안에 선택</button>
  </article>:null}
  {buffer.input.definition.budgetRef?<p aria-label="초안 예산 고정 참조">{buffer.input.definition.budgetRef.id} · v{buffer.input.definition.budgetRef.version} · {buffer.input.definition.budgetRef.contentHash} · BUDGET_UNVERIFIED · 별도 임무 저장 필요</p>:<p>초안 예산 참조 없음 · 미검증</p>}
  <button type="button" disabled={locked||buffer.uncertain||!buffer.input.definition.budgetRef} onClick={()=>run(async()=>{clearAssignmentSelection(buffer,session,'budgetRef',update,()=>alive.current);if(alive.current)setPolicy(null);})}>초안 예산 선택 해제</button>
 </section>;
}
