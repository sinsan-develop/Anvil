import {useEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import type {DocumentSession} from '../design-trace/editor-api.ts';
import {readWriterCurrent,type WriterCurrent} from './writer-authority-current-api.ts';
interface Props{client:ApiClient;projectId:string;session:DocumentSession;onAuthenticationLost:()=>void}
export function WriterAuthorityCurrentPanel({client,projectId,session,onAuthenticationLost}:Props){
 const key=JSON.stringify([projectId,session.user.id,session.clientId,session.csrfToken]);
 const owner=useRef({key,client,transport:client.transport}),alive=useRef(true),sequence=useRef(0),pending=useRef<number|null>(null);
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[value,setValue]=useState<{owner:object;value:WriterCurrent}|null>(null),[error,setError]=useState<{owner:object;code:string;status:number}|null>(null);
 if(owner.current.key!==key||owner.current.client!==client||owner.current.transport!==client.transport){owner.current={key,client,transport:client.transport};sequence.current++;pending.current=null;}
 const scope=owner.current;
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;sequence.current++;};},[]);
 useEffect(()=>{setValue(null);setError(null);setBusy(false);},[scope]);
 function close(){sequence.current++;pending.current=null;setBusy(false);setValue(null);setError(null);setOpen(false);}
 async function read(){if(pending.current!==null)return;const captured=owner.current,seq=++sequence.current;pending.current=seq;const active=()=>alive.current&&owner.current===captured&&captured.client.transport===captured.transport&&sequence.current===seq;setBusy(true);setValue(null);setError(null);try{const next=await readWriterCurrent(client,projectId,active);if(active())setValue({owner:captured,value:next});}catch(e){if(active()){const a=e instanceof ApiError?e:new ApiError('RESPONSE_INVALID');setError({owner:captured,code:a.code,status:a.status});if(a.status===401)onAuthenticationLost();}}finally{if(pending.current===seq){pending.current=null;if(alive.current)setBusy(false);}}}
 const shown=value?.owner===scope&&!busy?value.value:null,problem=error?.owner===scope?error:null;
 return <section aria-label="쓰기 제어 기록 수동 조회"><button onClick={()=>open?close():setOpen(true)}>{open?'쓰기 제어 기록 닫기':'쓰기 제어 기록 열기'}</button>{open?<><p>저장된 원장 조회입니다. 실제 실행·쓰기 허가·회수 성공을 확인하지 않습니다.</p><button disabled={busy&&pending.current!==null} onClick={()=>void read()}>쓰기 제어 기록 확인</button>{busy?<p role="status">조회 중</p>:null}{problem?<p role="alert">{[404,503].includes(problem.status)?'조회 미연결 또는 미확인 · ':''}{problem.code}</p>:null}{shown?<div role="status"><p>{shown.head?'저장 단계: '+shown.head.snapshot.phase:'저장된 현재 쓰기 제어 기록이 없습니다. 작업이 없다는 뜻은 아닙니다.'}</p>{shown.head?<p>조회 응답 기준 기한: {shown.expired?'경과':'기한 내'}</p>:null}{shown.head?<p>원장 기한: {shown.head.snapshot.expiresAt}</p>:null}<p>이 조회로 실제 실행·쓰기 허용·전달 수행·회수 완료를 확인할 수 없습니다.</p><details><summary>원장 참조 상세</summary><pre>{JSON.stringify({head:shown.head,tip:shown.tip},null,2)}</pre><p>tip의 소속·원 사건 진위는 이 조회에서 검증하지 않습니다.</p></details></div>:null}</>:null}</section>;
}
