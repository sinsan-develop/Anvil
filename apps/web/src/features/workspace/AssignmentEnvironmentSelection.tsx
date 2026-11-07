import {useEffect,useRef,useState} from 'react';
import {ApiClient} from '../../api/client.ts';
import type {DocumentSession} from '../design-trace/editor-api.ts';
import {listCandidates,type CandidateHit,type CandidateView,type Ref} from '../connections/api.ts';
import type {AssignmentBuffer} from './assignment-api.ts';
import {selectAssignmentEnvironment} from './assignment-environment-selection.ts';
import {clearAssignmentSelection} from './assignment-selection-clear.ts';

export function AssignmentEnvironmentSelection({client,buffer,session,locked,update,run}:{client:ApiClient;buffer:AssignmentBuffer;session:DocumentSession;locked:boolean;update:(change:(value:AssignmentBuffer)=>AssignmentBuffer)=>void;run:(action:()=>Promise<void>)=>void}){
 const[items,setItems]=useState<CandidateHit[]|null>(null),[cursor,setCursor]=useState<string|null>(null),[view,setView]=useState<CandidateView|null>(null);
 const alive=useRef(true);useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 async function load(next:string|null=null){
  setItems(null);setCursor(null);setView(null);const page=await listCandidates(client,buffer.projectId,'ENVIRONMENT_CANDIDATE',next);
  if(alive.current){setItems(page.items);setCursor(page.nextCursor);}
 }
 async function choose(ref:Ref){
  setView(null);const value=await selectAssignmentEnvironment(client,buffer,session,ref,()=>alive.current,update);
  if(alive.current&&value)setView(value);
 }
 return <section aria-label="임무 환경 후보 선택"><h5>임무 환경 후보 선택</h5>
  <p>등록한 환경 후보를 고정 원문으로 대조해 초안에 선택합니다. Windows 실행기와 WSL 대상은 다르며 후보 NOT_READY/능력 미확인은 그대로입니다. 환경 확인·쓰기 허가·Agent 실행이 아닙니다.</p>
  <button type="button" disabled={locked} onClick={()=>run(()=>load())}>환경 후보 목록 조회</button>
  {items?<>{items.length?<ul>{items.map((item,index)=><li key={JSON.stringify([item.ref,index])}>{item.label} · v{item.ref.version} · NOT_READY
   <button type="button" disabled={locked} onClick={()=>run(()=>choose(item.ref))}>환경 원문 대조 후 초안 선택: {item.label}</button>
  </li>)}</ul>:<p>등록 환경 후보 없음 · 실제 환경이 없다는 판정 아님</p>}
  {cursor?<button type="button" disabled={locked} onClick={()=>run(()=>load(cursor))}>환경 후보 다음 목록</button>:null}</>:null}
  {view?<article aria-label="대조한 환경 후보"><h6>{view.candidate.input.candidate.label} · NOT_READY</h6>
   <p>{view.ref.id} · v{view.ref.version} · {view.ref.contentHash}</p><p>보관 원문 대조·초안 반영 요청 · 아래 실제 초안 참조를 확인하세요. ENVIRONMENT_UNVERIFIED는 유지합니다.</p>
   <pre>{JSON.stringify(view.candidate.input.candidate,null,2)}</pre>
   <ul>{view.candidate.readiness.missingRequirements.map((item,index)=><li key={index}>{item.field} · {item.reason}</li>)}</ul><p>실제 지원 능력·호스트 신뢰·명령/비밀 접근·OS 통제는 미확인입니다.</p>
  </article>:null}
  {buffer.input.definition.environmentRef?<p aria-label="초안 환경 고정 참조">{buffer.input.definition.environmentRef.id} · v{buffer.input.definition.environmentRef.version} · {buffer.input.definition.environmentRef.contentHash} · ENVIRONMENT_UNVERIFIED · 별도 임무 저장 필요</p>:<p>초안 환경 참조 없음 · 미검증</p>}
  <button type="button" disabled={locked||buffer.uncertain||!buffer.input.definition.environmentRef} onClick={()=>run(async()=>{clearAssignmentSelection(buffer,session,'environmentRef',update,()=>alive.current);if(alive.current)setView(null);})}>초안 환경 선택 해제</button>
 </section>;
}
