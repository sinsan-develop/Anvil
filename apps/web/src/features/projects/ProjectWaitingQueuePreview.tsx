import {useEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import type {DocumentSession} from '../design-trace/editor-api.ts';
import {readStageQueue,type QueueView} from '../session-detail/stage-queue-api.ts';

const reasons:Record<string,string>={ASSIGNMENT_BINDING_UNVERIFIED:'임무 연결 미확인',BASELINE_STATE_UNVERIFIED:'기준 상태 미확인',EXECUTION_STATE_UNVERIFIED:'실행 상태 미확인',DISPATCH_NOT_CONNECTED:'실행 전달 미연결'};

/** 명시 조회한 WAITING 저장 기록만 표시한다. 현재 실행/담당/다음 행동의 근거는 아니다. */
export function ProjectWaitingQueuePreview({client,projectId,name,session,disabled,onAuthenticationLost}:{client:ApiClient;projectId:string;name:string;session:DocumentSession|undefined;disabled:boolean;onAuthenticationLost:()=>void}){
 const scope=useRef({client,transport:client.transport,projectId,session,userId:session?.user.id,clientId:session?.clientId,csrf:session?.csrfToken,disabled});
 const old=scope.current;
 if(old.client!==client||old.transport!==client.transport||old.projectId!==projectId||old.session!==session||old.userId!==session?.user.id||old.clientId!==session?.clientId||old.csrf!==session?.csrfToken||old.disabled!==disabled)scope.current={client,transport:client.transport,projectId,session,userId:session?.user.id,clientId:session?.clientId,csrf:session?.csrfToken,disabled};
 const owner=scope.current;
 type Request={owner:typeof owner};
 const [request,setRequest]=useState<Request|null>(null),[loaded,setLoaded]=useState<{request:Request;view:QueueView|null;error:ApiError|null}|null>(null);
 const requested=useRef(request);requested.current=request;
 const lost=useRef(onAuthenticationLost);lost.current=onAuthenticationLost;
 const open=!!request&&request.owner===owner&&!disabled&&!!session,shown=open&&loaded?.request===request?loaded:null,pending=open&&!shown;
 useEffect(()=>{
  if(!request||!open)return;let alive=true;
  const current=()=>alive&&requested.current===request&&scope.current===request.owner&&!scope.current.disabled&&client.transport===owner.transport&&session===owner.session&&session?.user.id===owner.userId&&session?.clientId===owner.clientId&&session?.csrfToken===owner.csrf;
  readStageQueue(client,projectId,current).then(view=>{if(current()&&view)setLoaded({request,view,error:null});}).catch(cause=>{
   if(!current())return;const failure=cause instanceof ApiError?cause:new ApiError('STAGE_QUEUE_RESPONSE_INVALID');
   setLoaded({request,view:null,error:failure});if(failure.status===401)lost.current();
  });
  return()=>{alive=false;};
 },[request,open,owner,client,projectId,session]);
 function read(){
  if(disabled||!session||pending||requested.current!==request||scope.current!==owner||client.transport!==owner.transport||session.user.id!==owner.userId||session.clientId!==owner.clientId||session.csrfToken!==owner.csrf)return;
  const next={owner};requested.current=next;setLoaded(null);setRequest(next);
 }
 function close(){requested.current=null;setRequest(null);setLoaded(null);}
 const error=shown?.error,code=error&&/^[A-Z_]{1,80}$/.test(error.code)?error.code:'STAGE_QUEUE_RESPONSE_INVALID',view=shown?.view;
 return <section aria-label={name+' 단계 시작 대기 요청'}>
  <button type="button" aria-expanded={open} disabled={disabled||!session||pending} onClick={read}>{name} 단계 시작 대기 요청 {open?'다시 조회':'조회'}</button>
  {open?<button type="button" onClick={close}>단계 시작 대기 요청 닫기</button>:null}
  {pending?<p role="status">단계 시작 대기 요청 조회 중</p>:null}
  {error?<p role="alert">{error.status===413?'조회 한도를 넘어 대기 요청을 확인하지 못했습니다.':error.status===401?'인증을 다시 확인해야 합니다.':error.status===403||error.status===404?'현재 접근으로 대기 요청을 확인할 수 없습니다.':'단계 시작 대기 요청 미확인.'} {code} · 이전 결과는 숨겼습니다.</p>:null}
  {view?<>
   <p className="meta">이번 응답 {view.items.length}건 · WAITING_ONLY · 서버 관측 <time dateTime={view.observedAt}>{new Date(view.observedAt).toLocaleString('ko-KR')}</time></p>
   {!view.items.length?<p>이번 응답에 저장된 단계 시작 대기 요청이 없습니다.</p>:null}
   <ul>{view.items.map(item=><li key={item.requestRef.id}><dl><dt>서버 순번</dt><dd>{item.sequence}</dd><dt>요청 참조</dt><dd>{item.requestRef.id} · v{item.requestRef.version} · {item.requestRef.contentHash}</dd><dt>저장된 사유</dt><dd>{item.reasonCodes.map(reason=><span key={reason}>{reasons[reason]} · {reason}<br/></span>)}</dd></dl></li>)}</ul>
   <p className="meta">저장된 대기 요청만 표시합니다. 취소 이력·현재 실행 단계·실제 담당·다음 행동은 확인하지 않았습니다. 예약·실행 허가·전달 수행을 뜻하지 않습니다.</p>
  </>:null}
 </section>;
}
