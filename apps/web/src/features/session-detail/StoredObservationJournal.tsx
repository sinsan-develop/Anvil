import {useEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import type {SubmittedResultView} from './result-api.ts';
import {readStoredObservations,type StoredObservationView} from './observation-journal-api.ts';
export function StoredObservationJournal({client,result,onUnavailable}:{client:ApiClient;result:SubmittedResultView;onUnavailable:(code:string)=>void}){
 const [revision,setRevision]=useState(0),[loaded,setLoaded]=useState<{key:string;value:StoredObservationView|null;error:string|null}|null>(null),unavailable=useRef(onUnavailable);unavailable.current=onUnavailable;
 const key=[result.snapshot.scope.projectId,result.ref.id,result.ref.contentHash,revision].join(':'),shown=loaded?.key===key?loaded:null;
 useEffect(()=>{if(!revision)return;let active=true;readStoredObservations(client,result,()=>active).then(value=>{if(active&&value)setLoaded({key,value,error:null});}).catch(cause=>{if(!active)return;const e=cause instanceof ApiError?cause:new ApiError('RESULT_OBSERVATION_RESPONSE_INVALID'),code=/^[A-Z_]{1,80}$/.test(e.code)?e.code:'RESULT_OBSERVATION_RESPONSE_INVALID';setLoaded({key,value:null,error:code});if([401,403,404].includes(e.status))unavailable.current(e.status===401?'AUTH_REQUIRED':code);});return()=>{active=false;};},[client,result,revision,key]);
 const value=shown?.value,ack=value?.ack?.snapshot;
 return <section className="status-card" aria-label="보관 실행 관측·ACK" lang="ko"><h4>보관 실행 관측·ACK</h4><p>합성 공급자 주장·서버 수신 기록입니다. 현재 실제 Agent/OS·중지·쓰기 회수·완료/재개 판정이 아닙니다.</p><button type="button" disabled={!!revision&&!shown} onClick={()=>{setLoaded(null);setRevision(n=>n+1);}}>{revision?'보관 관측 다시 조회':'보관 관측 조회'}</button>
 {revision&&!shown?<p role="status">원제출에 고정된 관측 원장 조회 중 · 이전 값 숨김</p>:null}{shown?.error?<p role="alert">{shown.error} · 관측/ACK 미확인. 없음·정상으로 추정하지 않습니다.</p>:null}
 {value?<><p>현재 로컬 순번: 미확인</p><p>보관 관측 {value.storedCount}건 · 조회 시각: <time dateTime={value.observedAt}>{value.observedAt}</time></p>{ack?<><p>서버 연속 수신 순번: {ack.highestContiguous}</p><p>보관 범위 최대 순번: {ack.maxSequence}</p><p>보관 범위 미수신 구간: {ack.gaps.length?ack.gaps.map(g=>g.from+'~'+g.to).join(', '):'없음 · 실제 로컬 전송 완료를 확인한 것은 아님'}</p></>:<p>보관 ACK 없음 · 로컬 순번 0/미수행으로 추정하지 않습니다.</p>}{value.items.length?<ul>{value.items.map(item=><li key={item.ref.id}>순번 {item.snapshot.event.sequence} · {item.snapshot.event.type} · {item.snapshot.event.reasonCode} · 공급자 주장</li>)}</ul>:<p>조회된 보관 관측 없음 · 실제 실행 상태 미확인</p>}{value.hasMore?<p>최근 순번 20건만 표시 · 더 이전 원문 페이지 연결 미완료</p>:null}<details><summary>보관 관측·ACK 참조 보기</summary><pre>{JSON.stringify(value,null,2)}</pre></details></>:null}
 </section>;
}
