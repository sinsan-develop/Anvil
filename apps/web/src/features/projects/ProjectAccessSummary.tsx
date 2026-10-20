import {useEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import {readProjectAccessSummary,type ProjectAccessSummaryView} from './project-access-summary.ts';
export function ProjectAccessSummary({client,projectId,name,disabled,onAuthenticationLost}:{client:ApiClient;projectId:string;name:string;disabled:boolean;onAuthenticationLost:()=>void}){
 const [revision,setRevision]=useState(0),[loaded,setLoaded]=useState<{client:ApiClient;projectId:string;revision:number;value:ProjectAccessSummaryView|null;error:string|null}|null>(null),lost=useRef(onAuthenticationLost);lost.current=onAuthenticationLost;
 const shown=!disabled&&loaded?.client===client&&loaded.projectId===projectId&&loaded.revision===revision?loaded:null,pending=revision>0&&!shown;
 useEffect(()=>{if(!revision)return;let active=true;
  readProjectAccessSummary(client,projectId,()=>active).then(value=>{if(active)setLoaded({client,projectId,revision,value,error:null});}).catch(cause=>{if(!active)return;const e=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');setLoaded({client,projectId,revision,value:null,error:/^[A-Z_]{1,80}$/.test(e.code)?e.code:'RESPONSE_INVALID'});if(e.status===401)lost.current();});
  return()=>{active=false;};
 },[client,projectId,revision]);
 const v=shown?.value;
 return <section aria-label={name+' 제어·준비 상태'}><button type="button" aria-expanded={revision>0} disabled={disabled||pending} onClick={()=>{setLoaded(null);setRevision(n=>n+1);}}>{name} 제어·준비 상태 {revision?'다시 조회':'조회'}</button>
  {revision?<button type="button" onClick={()=>{setRevision(0);setLoaded(null);}}>제어·준비 조회 닫기</button>:null}
  {pending&&!disabled?<p role="status">프로젝트 제어·준비 상태 조회 중 · 이전 결과는 숨깁니다.</p>:null}
  {shown?.error?<p role="alert">{shown.error} · 제어·준비 상태 미확인. 실행 가능이나 담당자 없음으로 판정하지 않습니다.</p>:null}
  {v?<><p>브라우저 수신 시각 {v.receivedAt} · 프로젝트 v{v.projectVersion} · 이 조회 시점의 응답이며 실시간 감시가 아닙니다.</p><dl>
   <div><dt>내 참여 권한</dt><dd>{v.participation==='OWNER'?'소유자':v.participation==='VIEWER'?'조회자':'작업 인수 가능 참여자'}</dd></div>
   <div><dt>제어 상태</dt><dd>{v.controlState.status==='HELD'?'이 로그인·기기에 제어 기록 있음':v.controlState.status==='OTHER_CLIENT'?'다른 사용자 또는 기기에 제어 기록 있음':'현재 유효한 제어 기록 없음'}</dd></div>
   {v.controlState.status!=='UNASSIGNED'?<><div><dt>제어 기록 사용자 ID</dt><dd>{v.controlState.actorId}</dd></div><div><dt>제어 기록 기기 ID</dt><dd>{v.controlState.clientId}</dd></div><div><dt>제어 세대</dt><dd>{v.controlState.generation}</dd></div></>:null}
  </dl><h3>준비 미확인 조건</h3>{v.readinessIssues.length?<ul>{v.readinessIssues.map((i,n)=><li key={n}>{i.code}</li>)}</ul>:<p>응답에 준비 미확인 코드 없음 · 전체 준비 완료 판정 아님</p>}
  <p>실제 단계·Agent 작업·필요 결정 건수·변경 권한은 이 조회로 확인하지 않습니다. 제어권 인수·승인·Agent 시작은 수행하지 않았습니다.</p></>:null}
 </section>;
}
