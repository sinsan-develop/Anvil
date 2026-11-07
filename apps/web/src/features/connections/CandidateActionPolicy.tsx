import {useEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import type {DocumentSession} from '../design-trace/editor-api.ts';
import {candidateAccess,type CandidateKind} from './api.ts';
type Access=Awaited<ReturnType<typeof candidateAccess>>;
export function CandidateActionPolicy({client,projectId,session,onAuthenticationLost}:{client:ApiClient;projectId:string;session:DocumentSession;onAuthenticationLost:()=>void}){
 const [kind,setKind]=useState<CandidateKind>('CONNECTION_CANDIDATE'),[loaded,setLoaded]=useState<{key:string;value:Access|null;error:string|null}|null>(null),[pending,setPending]=useState<{key:string;sequence:number}|null>(null);
 const key=[projectId,session.user.id,session.clientId,kind].join(':'),current=useRef({key,epoch:0}),alive=useRef(true),sequence=useRef(0),lost=useRef(onAuthenticationLost);lost.current=onAuthenticationLost;
 if(current.current.key!==key)current.current={key,epoch:current.current.epoch+1};
 const epoch=current.current.epoch,identity=key+':'+epoch;
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;sequence.current++;};},[]);
 const shown=loaded?.key===identity?loaded:null,busy=pending?.key===identity;
 async function read(){
  if(busy)return;const ticket=++sequence.current,scope=identity;setLoaded(null);setPending({key:scope,sequence:ticket});
  const active=()=>alive.current&&sequence.current===ticket&&current.current.key===key&&current.current.epoch===epoch;
  try{const value=await candidateAccess(client,projectId,session,kind,true);if(active())setLoaded({key:scope,value:structuredClone(value),error:null});}
  catch(cause){if(!active())return;const error=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');setLoaded({key:scope,value:null,error:/^[A-Z_]{1,64}$/.test(error.code)?error.code:'RESPONSE_INVALID'});if(error.status===401)lost.current();}
  finally{if(alive.current&&sequence.current===ticket)setPending(null);}
 }
 const value=shown?.value;
 return <section aria-label="후보 저장 허용 행동 조회"><h3>후보 저장 정책 대조</h3><p>조회는 후보 저장·승인 소비·Agent 실행 허가가 아닙니다.</p>
  <label>조회할 후보 저장 행동<select aria-label="조회할 후보 저장 행동" value={kind} onChange={event=>setKind(event.target.value as CandidateKind)}><option value="CONNECTION_CANDIDATE">도구 후보 등록</option><option value="ENVIRONMENT_CANDIDATE">환경 후보 저장</option></select></label>
  <button type="button" disabled={busy} onClick={()=>void read()}>후보 저장 정책 조회</button>
  {busy?<p role="status">선택 행동 정책 조회 중 · 이전 결과 숨김</p>:null}{shown?.error?<p role="alert">{shown.error} · 허용으로 추정하지 않습니다.</p>:null}
  {value?<div data-testid="candidate-action-policy-fact"><p>클라이언트 규칙 대조: {value.approvalRequired?'REQUIRE_APPROVAL · 별도 승인 필요':'AUTO_RULE_FOUND · AUTO 규칙 발견'}</p>
   <p>행동: {kind==='CONNECTION_CANDIDATE'?'registerConnection':'saveEnvironment'} · 프로젝트 {projectId}</p><p>반환 정책 참조 {value.policyRef.id} · v{value.policyRef.version}<br/>{value.policyRef.contentHash}</p>
   <p>대조 제어 세대 {value.generation} · 규칙의 조회 당시 유효기한 <time dateTime={value.validUntil}>{value.validUntil}</time></p>
   <p>현재 효력·재인증·정책 원문 hash 무결성·명령 허가는 이 표시로 검증하지 않습니다. 저장 시 기존 최신 검사를 다시 거치며, 승인 필요는 별도 승인 절차를 따릅니다.</p>
  </div>:null}
 </section>;
}
