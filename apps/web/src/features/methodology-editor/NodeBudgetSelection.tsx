import {useEffect,useRef,useState,type Dispatch,type SetStateAction} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import {readLimitPolicy,type LimitPolicyRecord} from '../connections/limit-policy-api.ts';
import type {MethodBuffer} from './common-api.ts';
import {selectNodeBudget,clearNodeBudget} from './node-budget-selection.ts';
export function NodeBudgetSelection({client,projectId,owner,buffer,onChange,locked,onAuthenticationLost}:{client:ApiClient;projectId:string;owner:string;buffer:MethodBuffer;onChange:Dispatch<SetStateAction<MethodBuffer>>;locked:boolean;onAuthenticationLost:()=>void}){
 const [ref,setRef]=useState({id:'',version:'',contentHash:''}),[policy,setPolicy]=useState<LimitPolicyRecord|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),alive=useRef(true),working=useRef(false),current=useRef({buffer,locked});current.current={buffer,locked};
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 async function run(action:()=>Promise<void>){if(locked||working.current)return;working.current=true;setBusy(true);setError(null);try{await action();}catch(cause){if(alive.current){const e=cause instanceof ApiError?cause:new ApiError('NODE_BUDGET_RESPONSE_INVALID');setError(e.code);setPolicy(null);if(e.status===401)onAuthenticationLost();}}finally{working.current=false;if(alive.current)setBusy(false);}}
 const node=buffer.graph.nodes.find(n=>n.nodeId===buffer.nodeId);
 return <section aria-label="방법론 단계 한도 선택"><h5>선택 단계 한도 정책</h5><p>프로젝트의 보관 APPLIED 정책만 참조합니다. 현재 유효성·남은 예산·실제 강제는 미검증이며 초안 저장·확정·적용과 실행은 별도입니다.</p>
  <label>단계 한도 정책 ID<input disabled={locked||busy} value={ref.id} onChange={e=>{setPolicy(null);setRef({...ref,id:e.target.value});}}/></label><label>단계 한도 정책 버전<input type="number" min="1" step="1" disabled={locked||busy} value={ref.version} onChange={e=>{setPolicy(null);setRef({...ref,version:e.target.value});}}/></label><label>단계 한도 정책 hash<input disabled={locked||busy} value={ref.contentHash} onChange={e=>{setPolicy(null);setRef({...ref,contentHash:e.target.value});}}/></label>
  <button type="button" disabled={locked||busy} onClick={()=>void run(async()=>{setPolicy(null);const value=await readLimitPolicy(client,projectId,{id:ref.id,version:Number(ref.version),contentHash:ref.contentHash});if(alive.current&&!current.current.locked)setPolicy(value);})}>단계 한도 보관본 조회</button>
  {policy?<article aria-label="단계 선택 전 한도"><p>{policy.ref.id} · v{policy.ref.version} · {policy.snapshot.state} · 기록 기한 {policy.snapshot.expiresAt}</p><pre>{JSON.stringify(policy.snapshot.limits,null,2)}</pre><button type="button" disabled={locked||busy||policy.snapshot.state!=='APPLIED'} onClick={()=>void run(()=>selectNodeBudget(buffer,projectId,owner,policy,()=>alive.current&&!current.current.locked,onChange))}>이 한도를 선택 단계 초안에 반영</button></article>:null}
  <p aria-label="단계 초안 한도 참조">{node?.limitPolicyRef?node.limitPolicyRef.id+' · v'+node.limitPolicyRef.version+' · '+node.limitPolicyRef.contentHash:'선택 없음'} · 현재 정책 검증 아님</p><button type="button" disabled={locked||busy||!node?.limitPolicyRef} onClick={()=>void run(async()=>clearNodeBudget(buffer,owner,onChange))}>단계 한도 선택 해제</button>
  {busy?<p role="status">단계 한도 참조 대조 중</p>:null}{error?<p role="alert">{error} · 원 단계/명령은 변경하지 않았습니다.</p>:null}
 </section>;
}
