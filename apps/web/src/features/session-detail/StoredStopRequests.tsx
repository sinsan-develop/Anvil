import type {DocumentSession} from '../design-trace/editor-api.ts';
import {ordered} from '../knowledge/review-view.ts';
import {useEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import type {SubmittedResultView} from './result-api.ts';
import {readStoredStopRequests,readStoredStopRequestPage,type StopRequestHistoryView,type StopRequestPageView} from './stop-request-history-api.ts';
export function StoredStopRequests({client,result,session,onUnavailable}:{client:ApiClient;result:SubmittedResultView;session?:DocumentSession;onUnavailable:(code:string)=>void}){
 const [revision,setRevision]=useState(0),[loaded,setLoaded]=useState<{key:string;value:StopRequestHistoryView|null;error:string|null}|null>(null),unavailable=useRef(onUnavailable);unavailable.current=onUnavailable;const identity=ordered({projectId:result.snapshot.scope.projectId,resultRef:result.ref,executionRef:result.snapshot.scope.executionRef,userId:session?.user.id??null,clientId:session?.clientId??null,csrf:session?.csrfToken??null}),context=useRef({identity,client,transport:client.transport,epoch:0}),requested=useRef<object|null>(null);if(context.current.identity!==identity||context.current.client!==client||context.current.transport!==client.transport)context.current={identity,client,transport:client.transport,epoch:context.current.epoch+1};const owner=context.current,key=identity+':'+owner.epoch+':'+revision,shown=loaded?.key===key?loaded:null;
 useEffect(()=>{if(!revision||requested.current!==owner)return;let live=true;const active=()=>live&&context.current===owner&&client.transport===owner.transport;readStoredStopRequests(client,result,active).then(value=>{if(active()&&value)setLoaded({key,value,error:null});}).catch(cause=>{if(!active())return;const e=cause instanceof ApiError?cause:new ApiError('RESULT_STOP_HISTORY_RESPONSE_INVALID'),code=/^[A-Z_]{1,80}$/.test(e.code)?e.code:'RESULT_STOP_HISTORY_RESPONSE_INVALID';setLoaded({key,value:null,error:code});if([401,403,404].includes(e.status))unavailable.current(e.status===401?'AUTH_REQUIRED':code);});return()=>{live=false;};},[client,result,revision,key]);
 const v=shown?.value,summaryPending=!!revision&&!shown&&requested.current===owner;
 return <section className="status-card" aria-label="보관 중지 요청" lang="ko"><h4>보관 중지 요청</h4><p>합성 경계에서 보관된 요청입니다. 도구로 전달하거나 실제 실행을 중지하는 버튼이 아닙니다.</p><button type="button" disabled={summaryPending} onClick={()=>{requested.current=owner;setLoaded(null);setRevision(n=>n+1);}}>{revision?'중지 요청 이력 다시 조회':'중지 요청 이력 조회'}</button>{summaryPending?<p role="status">같은 실행의 보관 요청 조회 중 · 이전 값 숨김</p>:null}{shown?.error?<p role="alert">{shown.error} · 중지 요청 이력 미확인. 없음·안전으로 추정하지 않습니다.</p>:null}
 {v?<><p>실제 중지·쓰기 회수: 미확인</p><p>표시 요청 {v.items.length}건 · 조회 시각: <time dateTime={v.observedAt}>{v.observedAt}</time></p>{v.items.length?<ul>{v.items.map(item=><li key={item.ref.id}><p>{item.reason}</p><p>요청 보관 · 실제 전달 미수행 · {item.grantKind==='EXECUTION'?'당시 실행 허가':'당시 회수 허가'} 참조</p><p>요청 시각: <time dateTime={item.requestedAt}>{item.requestedAt}</time> · 당시 전달 기한: <time dateTime={item.expiresAt}>{item.expiresAt}</time></p><p>{item.ref.id} · v{item.ref.version} · {item.ref.contentHash}</p></li>)}</ul>:<p>조회 범위에 보관 중지 요청 없음 · 실제 중지/작업 미수행/정상으로 추정하지 않습니다.</p>}{v.hasMore?<><p>최근 20건 요약 · 이전 기록은 별도 보호 조회합니다.</p>{session?<StopRequestPages client={client} result={result} session={session} onUnavailable={onUnavailable}/>:<p>현재 조회자 문맥 미확인 · 과거 페이지 조회 불가</p>}</>:null}<details><summary>보관 중지 요청 참조 보기</summary><pre>{JSON.stringify(v,null,2)}</pre></details><p>당시 명령·영수증·감사·보류 outbox 대조입니다. 만료된 요청이 없어지거나 현재 허가·안전 재개가 생기지 않습니다.</p></>:null}</section>;
}

type StopPosition={cursor:string;before:StopRequestPageView['before']};
type StopAnchor=Pick<StopRequestPageView,'snapshotUpper'|'snapshotMaxAuditSequence'|'cursorIssuedAt'|'cursorExpiresAt'>&{deadline:number};
/** 기존 요약과 분리된 명시 보호 탐색. 성공한 이동만 확정한다. */
function StopRequestPages({client,result,session,onUnavailable}:{client:ApiClient;result:SubmittedResultView;session:DocumentSession;onUnavailable:(code:string)=>void}){
 const identity=ordered({projectId:result.snapshot.scope.projectId,resultRef:result.ref,executionRef:result.snapshot.scope.executionRef,userId:session.user.id,clientId:session.clientId,csrf:session.csrfToken}),scope=useRef({identity,client,transport:client.transport});
 if(scope.current.identity!==identity||scope.current.client!==client||scope.current.transport!==client.transport)scope.current={identity,client,transport:client.transport};
 const owner=scope.current,sequence=useRef(0),alive=useRef(true),flight=useRef(false),committed=useRef<{positions:StopPosition[];index:number;anchor:StopAnchor}|null>(null),requested=useRef<{cursor:string|null;index:number;reset:boolean}|null>(null);
 const [loaded,setLoaded]=useState<{owner:object;page:StopRequestPageView;index:number}|null>(null),[pending,setPending]=useState(false),[error,setError]=useState<{owner:object;code:string}|null>(null),[opened,setOpened]=useState(false);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;sequence.current++;};},[]);
 useEffect(()=>{sequence.current++;flight.current=false;committed.current=null;requested.current=null;setLoaded(null);setPending(false);setError(null);setOpened(false);},[owner]);
 const shown=loaded?.owner===owner?loaded:null,failure=error?.owner===owner?error.code:null;
 const current=(ticket:number)=>alive.current&&scope.current===owner&&client.transport===owner.transport&&ticket===sequence.current;
 function expire(){sequence.current++;flight.current=false;committed.current=null;requested.current=null;setLoaded(null);setPending(false);setError({owner,code:'CURSOR_INVALID'});}
 useEffect(()=>{if(!shown)return;const deadline=committed.current?.anchor.deadline;if(deadline===undefined)return;const timer=setTimeout(()=>{if(scope.current===owner&&client.transport===owner.transport)expire();},Math.max(0,deadline-performance.now()));return()=>clearTimeout(timer);},[shown,owner]);
 async function load(cursor:string|null,index:number,reset=false){
  if(flight.current)return;const basis=reset?null:committed.current;if(basis&&performance.now()>=basis.anchor.deadline){expire();return;}
  const ticket=++sequence.current,started=performance.now();flight.current=true;requested.current={cursor,index,reset};setPending(true);setOpened(true);setLoaded(null);setError(null);
  try{const page=await readStoredStopRequestPage(client,result,cursor,()=>current(ticket));if(!page||!current(ticket))return;
   const deadline=Math.min(basis?.anchor.deadline??Infinity,started+Date.parse(page.cursorExpiresAt)-Date.parse(page.observedAt));if(performance.now()>=deadline)throw new ApiError('CURSOR_INVALID',400);
   if(basis&&(ordered(page.snapshotUpper)!==ordered(basis.anchor.snapshotUpper)||page.snapshotMaxAuditSequence!==basis.anchor.snapshotMaxAuditSequence||page.cursorIssuedAt!==basis.anchor.cursorIssuedAt||page.cursorExpiresAt!==basis.anchor.cursorExpiresAt))throw new ApiError('RESULT_STOP_HISTORY_RESPONSE_INVALID');
   const positions=[...(basis?.positions??[]).slice(0,index),{cursor:page.pageCursor,before:page.before}];
   committed.current={positions,index,anchor:{snapshotUpper:page.snapshotUpper,snapshotMaxAuditSequence:page.snapshotMaxAuditSequence,cursorIssuedAt:page.cursorIssuedAt,cursorExpiresAt:page.cursorExpiresAt,deadline}};requested.current=null;setLoaded({owner,page,index});
  }catch(cause){if(!current(ticket))return;const e=cause instanceof ApiError?cause:new ApiError('RESULT_STOP_HISTORY_RESPONSE_INVALID'),code=/^[A-Z_]{1,80}$/.test(e.code)?e.code:'RESULT_STOP_HISTORY_RESPONSE_INVALID';setError({owner,code});if([401,403,404].includes(e.status)){committed.current=null;requested.current=null;onUnavailable(e.status===401?'AUTH_REQUIRED':code);}}
  finally{if(current(ticket)){flight.current=false;setPending(false);}}
 }
 const page=shown?.page;
 return <section aria-label="과거 중지 요청 페이지"><h5>과거 중지 요청 페이지</h5><p>원제출의 고정 탐색 범위입니다. 요청 보관은 실제 중지·전달·쓰기 회수 확인이 아닙니다.</p>
 <button type="button" disabled={pending} onClick={()=>void load(null,0,true)}>{opened?'중지 요청 페이지 새 목록 조회':'과거 중지 요청 페이지 탐색'}</button>
 {opened?<button type="button" onClick={()=>{sequence.current++;flight.current=false;committed.current=null;requested.current=null;setLoaded(null);setPending(false);setError(null);setOpened(false);}}>중지 요청 페이지 닫기</button>:null}
 {pending?<p role="status">중지 요청 페이지 조회 중 · 이전 원문 숨김</p>:null}
 {failure?<><p role="alert">{failure} · 페이지 미확인. 없음·안전으로 추정하지 않습니다.</p>{requested.current?<button type="button" disabled={pending} onClick={()=>{const target=requested.current;if(target)void load(target.cursor,target.index,target.reset);}}>같은 중지 요청 페이지 재시도</button>:<p>현재 조회권한·기한을 확인한 뒤 새 목록을 명시 조회하세요.</p>}</>:null}
 {page&&shown?<><p>보호 조회 페이지 {shown.index+1} · 표시 요청 {page.items.length}건</p><p>탐색 기한 <time dateTime={page.cursorExpiresAt}>{page.cursorExpiresAt}</time> · 이동으로 연장하지 않습니다.</p>
 <button type="button" disabled={pending||shown.index===0} onClick={()=>{const state=committed.current,position=state?.positions[shown.index-1];if(position)void load(position.cursor,shown.index-1);}}>이후 중지 요청 20건</button>
 <button type="button" disabled={pending||!page.hasMore} onClick={()=>{if(page.nextCursor)void load(page.nextCursor,shown.index+1);}}>더 이전 중지 요청 20건</button>
 {page.items.length?<ol>{page.items.map(item=><li key={item.ref.id}><p>{item.reason}</p><p>{item.ref.id} · v{item.ref.version} · {item.ref.contentHash}</p><p>당시 요청 {item.requestedAt} · 당시 전달 기한 {item.expiresAt} · {item.grantKind}</p></li>)}</ol>:<p>고정 범위에 보관 중지 요청 없음 · 실제 중지 여부 미확인</p>}{!page.hasMore?<p>고정 탐색 범위 끝</p>:null}<p>현재 실행 허가·실제 전달·중지·쓰기 회수: 미확인</p></>:null}
 </section>;
}
