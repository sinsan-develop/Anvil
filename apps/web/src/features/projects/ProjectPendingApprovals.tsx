import {useEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import {routeHref,approvalRequestHref} from '../../shell/routes.ts';
import {readProjectPendingApprovals,type ProjectPendingApprovalsView} from './project-pending-approvals.ts';
export function ProjectPendingApprovals({client,projectId,name,disabled,onAuthenticationLost}:{client:ApiClient;projectId:string;name:string;disabled:boolean;onAuthenticationLost:()=>void}){
 const scope=useRef({client,projectId,disabled});if(scope.current.client!==client||scope.current.projectId!==projectId||scope.current.disabled!==disabled)scope.current={client,projectId,disabled};
 const currentScope=scope.current;
 const [openedScope,setOpenedScope]=useState<typeof currentScope|null>(null),[revision,setRevision]=useState(0),[position,setPosition]=useState<{cursor:string|null;history:Array<string|null>}|null>(null),[requested,setRequested]=useState<{cursor:string|null;history:Array<string|null>}>({cursor:null,history:[]}),[loaded,setLoaded]=useState<{scope:typeof currentScope;revision:number;cursor:string|null;value:ProjectPendingApprovalsView|null;error:string|null;denied:boolean}|null>(null),lost=useRef(onAuthenticationLost);lost.current=onAuthenticationLost;
 const open=revision>0&&openedScope===currentScope&&!disabled,shown=open&&loaded?.scope===currentScope&&loaded.revision===revision&&loaded.cursor===requested.cursor?loaded:null,pending=open&&!shown,v=shown?.value;
 useEffect(()=>{if(!open)return;let active=true;const current=()=>active&&scope.current===currentScope&&!scope.current.disabled;
  readProjectPendingApprovals(client,projectId,requested.cursor,current).then(value=>{if(current()){setPosition(requested);setLoaded({scope:currentScope,revision,cursor:requested.cursor,value,error:null,denied:false});}}).catch(cause=>{if(!current())return;const e=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');setLoaded({scope:currentScope,revision,cursor:requested.cursor,value:null,error:/^[A-Z_]{1,80}$/.test(e.code)?e.code:'RESPONSE_INVALID',denied:[401,403,404].includes(e.status)});if(e.status===401)lost.current();});return()=>{active=false;};
 },[client,projectId,revision,requested.cursor,open,currentScope]);
 function first(){setOpenedScope(currentScope);setLoaded(null);setPosition(null);setRequested({cursor:null,history:[]});setRevision(n=>n+1);}
 function navigate(target:{cursor:string|null;history:Array<string|null>}){if(!open||pending||shown?.denied)return;setLoaded(null);setRequested(target);setRevision(n=>n+1);}
 function previous(){if(!position?.history.length)return;navigate({cursor:position.history.at(-1)!,history:position.history.slice(0,-1)});}
 return <section aria-label={name+' 대기 승인 조회'}><button type="button" aria-expanded={open} disabled={disabled||pending} onClick={first}>{name} 대기 승인 {open?'다시 조회':'조회'}</button>
  {open?<button type="button" onClick={()=>{setOpenedScope(null);setRevision(0);setPosition(null);setRequested({cursor:null,history:[]});setLoaded(null);}}>대기 승인 조회 닫기</button>:null}
  {pending?<p role="status">대기 승인 페이지 조회 중 · 이전 결과는 숨깁니다.</p>:null}
  {shown?.error?<><p role="alert">{shown.error} · 대기 요청 미확인. 0건이나 승인 완료로 처리하지 않습니다.</p><button type="button" disabled={disabled||pending||shown.denied} onClick={()=>{setLoaded(null);setRevision(n=>n+1);}}>대기 승인 같은 페이지 다시 조회</button>{position&&requested.cursor!==position.cursor?<button type="button" disabled={disabled||pending||shown.denied} onClick={()=>navigate(position)}>대기 승인 마지막 성공 페이지 다시 조회</button>:null}</>:null}
  {open?<button type="button" disabled={disabled||pending||!position?.history.length||shown?.denied} onClick={previous}>대기 승인 이전 페이지</button>:null}
  {v?<><p>{(position?.history.length??0)+1}페이지 · 표시된 대기 요청 {v.pageCount}건 · 전체 건수 미산정</p><p>서버 목록 관측 시각 {v.observedAt} · 관측 뒤 변경·만료될 수 있습니다.</p>
   {v.items.length?<ul>{v.items.map(i=><li key={i.id}>요청 {i.id} · 연산 {i.operation} · 만료 {i.expiresAt} · 목록 metadata만 조회, 상세 진위·현재 결정 권한 미확인 <a href={approvalRequestHref(projectId,i.id)}>요청 {i.id} 원문 보기</a></li>)}</ul>:<p>이 페이지에 관측된 대기 요청 없음 · 전체 문제·다른 상태 요청 없음이라는 뜻은 아닙니다.</p>}
   {v.hasMore?<button type="button" disabled={disabled||pending} onClick={()=>{if(position)navigate({cursor:v.nextCursor,history:[...position.history,position.cursor]});}}>대기 승인 다음 페이지</button>:<p>이 조회 조건의 다음 페이지 없음 · 전체 실행 준비 판정 아님</p>}
   <a href={routeHref('approvals',projectId)}>대기 요청은 승인 화면에서 원문·현재 상태 확인</a><p>이 조회는 승인 결정·소비·실행을 하지 않습니다.</p>
  </>:null}
 </section>;
}
