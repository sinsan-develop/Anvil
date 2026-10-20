import {useEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import {routeHref} from '../../shell/routes.ts';
import {readProjectPendingApprovals,type ProjectPendingApprovalsView} from './project-pending-approvals.ts';
export function ProjectPendingApprovals({client,projectId,name,disabled,onAuthenticationLost}:{client:ApiClient;projectId:string;name:string;disabled:boolean;onAuthenticationLost:()=>void}){
 const [revision,setRevision]=useState(0),[cursor,setCursor]=useState<string|null>(null),[number,setNumber]=useState(1),[loaded,setLoaded]=useState<{client:ApiClient;projectId:string;revision:number;cursor:string|null;value:ProjectPendingApprovalsView|null;error:string|null}|null>(null),lost=useRef(onAuthenticationLost);lost.current=onAuthenticationLost;
 const shown=!disabled&&loaded?.client===client&&loaded.projectId===projectId&&loaded.revision===revision&&loaded.cursor===cursor?loaded:null,pending=revision>0&&!shown,v=shown?.value;
 useEffect(()=>{if(!revision)return;let active=true;
  readProjectPendingApprovals(client,projectId,cursor,()=>active).then(value=>{if(active)setLoaded({client,projectId,revision,cursor,value,error:null});}).catch(cause=>{if(!active)return;const e=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');setLoaded({client,projectId,revision,cursor,value:null,error:/^[A-Z_]{1,80}$/.test(e.code)?e.code:'RESPONSE_INVALID'});if(e.status===401)lost.current();});return()=>{active=false;};
 },[client,projectId,revision,cursor]);
 return <section aria-label={name+' 대기 승인 조회'}><button type="button" aria-expanded={revision>0} disabled={disabled||pending} onClick={()=>{setLoaded(null);setCursor(null);setNumber(1);setRevision(n=>n+1);}}>{name} 대기 승인 {revision?'다시 조회':'조회'}</button>
  {revision?<button type="button" onClick={()=>{setRevision(0);setCursor(null);setNumber(1);setLoaded(null);}}>대기 승인 조회 닫기</button>:null}
  {pending&&!disabled?<p role="status">대기 승인 페이지 조회 중 · 이전 결과는 숨깁니다.</p>:null}
  {shown?.error?<p role="alert">{shown.error} · 대기 요청 미확인. 0건이나 승인 완료로 처리하지 않습니다.</p>:null}
  {v?<><p>{number}페이지 · 표시된 대기 요청 {v.pageCount}건 · 전체 건수 미산정</p><p>서버 목록 관측 시각 {v.observedAt} · 관측 뒤 변경·만료될 수 있습니다.</p>
   {v.items.length?<ul>{v.items.map(i=><li key={i.id}>요청 {i.id} · 연산 {i.operation} · 만료 {i.expiresAt} · 목록 metadata만 조회, 상세 진위·현재 결정 권한 미확인</li>)}</ul>:<p>이 페이지에 관측된 대기 요청 없음 · 전체 문제·다른 상태 요청 없음이라는 뜻은 아닙니다.</p>}
   {v.hasMore?<button type="button" onClick={()=>{setLoaded(null);setCursor(v.nextCursor);setNumber(n=>n+1);}}>대기 승인 다음 페이지</button>:<p>이 조회 조건의 다음 페이지 없음 · 전체 실행 준비 판정 아님</p>}
   <a href={routeHref('approvals',projectId)}>대기 요청은 승인 화면에서 원문·현재 상태 확인</a><p>이 조회는 승인 결정·소비·실행을 하지 않습니다.</p>
  </>:null}
 </section>;
}
