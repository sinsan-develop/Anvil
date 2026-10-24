import {useEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import type {SubmittedResultView} from './result-api.ts';
import {readStoredUnderstandingHistory,understandingLabels,type UnderstandingHistoryView} from './understanding-history-api.ts';
export function StoredUnderstandingHistory({client,result,onAuthenticationLost,onAccessUnavailable}:{client:ApiClient;result:SubmittedResultView;onAuthenticationLost:()=>void;onAccessUnavailable:(code:string)=>void}){
 const [revision,setRevision]=useState(0),[loaded,setLoaded]=useState<{key:string;value:UnderstandingHistoryView|null;error:string|null}|null>(null),lost=useRef(onAuthenticationLost),unavailable=useRef(onAccessUnavailable);lost.current=onAuthenticationLost;unavailable.current=onAccessUnavailable;
 const key=[result.snapshot.scope.projectId,result.ref.id,result.ref.contentHash,revision].join(':'),shown=loaded?.key===key?loaded:null;
 useEffect(()=>{if(!revision)return;let active=true;
  readStoredUnderstandingHistory(client,result,()=>active).then(value=>{if(active&&value)setLoaded({key,value,error:null});}).catch(cause=>{if(!active)return;const e=cause instanceof ApiError?cause:new ApiError('UNDERSTANDING_HISTORY_RESPONSE_INVALID'),code=/^[A-Z_]{1,80}$/.test(e.code)?e.code:'UNDERSTANDING_HISTORY_RESPONSE_INVALID';setLoaded({key,value:null,error:code});if([401,403,404].includes(e.status))unavailable.current(code);if(e.status===401)lost.current();});return()=>{active=false;};
 },[client,result,key,revision]);
 return <section className="status-card" aria-label="이해 검토 보관 이력"><h5>이해 검토 보관 이력</h5><p>선택 제출의 고정 실행·세대로 조회합니다. 과거 사람의 판단이며 현재 실행 허가가 아닙니다. 새 검토·Agent 호출·WORK 재개를 하지 않습니다.</p>
  <button type="button" disabled={revision>0&&!shown} onClick={()=>{setLoaded(null);setRevision(n=>n+1);}}>{revision?'이해 검토 이력 다시 조회':'이해 검토 이력 조회'}</button>
  {revision?<button type="button" onClick={()=>{setRevision(0);setLoaded(null);}}>이해 검토 이력 닫기</button>:null}
  {revision&&!shown?<p role="status">원실행·보관 검토 대조 중 · 이전 이력 숨김</p>:null}{shown?.error?<p role="alert">{shown.error} · 이해 검토 미확인. 적합·없음으로 추정하지 않습니다.</p>:null}
  {shown?.value?<>{!shown.value.items.length?<p>보관된 이해 검토 없음 · 미검토/실행 불가의 실제 원인 판정은 아닙니다.</p>:shown.value.items.map(row=><article key={row.ref.contentHash} aria-label={'보관 이해 검토 '+row.ref.version}><h6>검토 순번 {row.ref.version} · {row.snapshot.outcome==='ACCEPTED'?'보관 당시 적합':'보관 당시 미수용'}</h6><p>기록 시각 {row.snapshot.recordedAt} · 현재 기준·수용 상태는 재확인하지 않았습니다.</p><p>검토자 {row.snapshot.reviewer.userId} · HUMAN</p><p>{row.snapshot.input.reason}</p><ul>{row.snapshot.input.items.map(item=><li key={item.code}><strong>{understandingLabels[item.code]}</strong> · {item.judgement==='MATCH'?'일치':item.judgement==='MISMATCH'?'불일치':'부족'}<pre>{item.reason}</pre><details><summary>원문·응답 부분 참조</summary><pre>{JSON.stringify({sourceRefs:item.sourceRefs,responsePartRefs:item.responsePartRefs},null,2)}</pre></details></li>)}</ul><details><summary>검토 버전·맥락·응답·책임세션 참조</summary><pre>{JSON.stringify({ref:row.ref,previousRef:row.snapshot.previousRef,bundleRef:row.snapshot.input.bundleRef,responseRef:row.snapshot.input.responseRef,subjectBindingRef:row.snapshot.input.subjectBindingRef},null,2)}</pre></details></article>)}</>:null}
 </section>;
}
