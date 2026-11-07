import {useEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import {readStageQueue,type QueueView} from '../session-detail/stage-queue-api.ts';
const reasons:Record<string,string>={ASSIGNMENT_BINDING_UNVERIFIED:'임무 연결 미확인',BASELINE_STATE_UNVERIFIED:'기준 상태 미확인',EXECUTION_STATE_UNVERIFIED:'실행 상태 미확인',DISPATCH_NOT_CONNECTED:'실행 전달 미연결'};
export function ProjectWaitingQueue({client,projectId,onAuthenticationLost}:{client:ApiClient;projectId:string;onAuthenticationLost:()=>void}){
 const [view,setView]=useState<QueueView|null>(null),[error,setError]=useState<string|null>(null),[busy,setBusy]=useState(false),alive=useRef(true),sequence=useRef(0),working=useRef(false),lost=useRef(onAuthenticationLost);lost.current=onAuthenticationLost;
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;sequence.current++;};},[client,projectId]);
 async function read(){if(working.current)return;working.current=true;const ticket=++sequence.current,active=()=>alive.current&&ticket===sequence.current;setView(null);setError(null);setBusy(true);
  try{const value=await readStageQueue(client,projectId,active);if(active()&&value)setView(value);}catch(cause){if(active()){const e=cause instanceof ApiError?cause:new ApiError('STAGE_QUEUE_RESPONSE_INVALID');setView(null);setError(/^[A-Z_]{1,80}$/.test(e.code)?e.code:'STAGE_QUEUE_RESPONSE_INVALID');if(e.status===401)lost.current();}}finally{working.current=false;if(active())setBusy(false);}
 }
 return<section className="status-card" aria-label="프로젝트 대기 기록"><h2>프로젝트 대기 기록</h2><p>현재 프로젝트 {projectId}의 보관된 WAITING 요청만 조회합니다. 예약·실행 시작이나 취소 명령을 보내지 않습니다.</p><button type="button" disabled={busy} onClick={()=>void read()}>대기 기록·이유 조회</button>{busy?<p role="status">대기 기록 조회 중</p>:null}{error?<p role="alert">{error} · 조회 실패로 이전 목록을 숨겼습니다.</p>:null}
  {view?<><p role="status">이번 응답 {view.items.length}건 · WAITING_ONLY · 서버 관측 {view.observedAt}</p>{!view.items.length?<p>이번 응답에 대기 기록이 없습니다.</p>:null}<ul>{view.items.map(item=><li key={item.requestRef.id}><dl><dt>요청 ID</dt><dd>{item.requestRef.id}</dd><dt>고정 버전·hash</dt><dd>v{item.requestRef.version} · {item.requestRef.contentHash}</dd><dt>서버 순번</dt><dd>{item.sequence}</dd></dl><p>WAITING · 예약 수행 없음 · 실행 허가 없음 · 전달 수행 없음</p><ul>{item.reasonCodes.map(code=><li key={code}>{reasons[code]} · {code}</li>)}</ul></li>)}</ul></>:null}
  <p>취소 이력은 포함하지 않습니다. 전체 요청 수·실행 슬롯 수는 확인하지 않았습니다. 대기 이유는 저장된 준비 부족이며 현재 실제 실행 상태나 원인 확정이 아닙니다.</p>
 </section>;
}
