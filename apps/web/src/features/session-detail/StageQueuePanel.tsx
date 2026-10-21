import {useEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import {documentControl,type DocumentSession} from '../design-trace/editor-api.ts';
import {isKnownDocumentRejection} from '../design-trace/mutation-result.ts';
import {ordered} from '../knowledge/review-view.ts';
import {readStageQueue,prepareQueueCancellation,sendQueueCancellation,queueCancellationKey,type QueueView,type QueueCancellationStorage,type QueuePanelBuffer} from './stage-queue-api.ts';
/** 프로젝트 전체 WAITING 목록이며 현재 상세 임무와의 결합/실행 허가를 주장하지 않는다. */
export function StageQueuePanel({client,projectId,session,storage,onUnavailable}:{client:ApiClient;projectId:string;session:DocumentSession;storage:QueueCancellationStorage;onUnavailable:(code:string)=>void}){
 const key=queueCancellationKey(session,projectId),buffer=storage.buffers[key]??null;
 const [view,setView]=useState<QueueView|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),[ack,setAck]=useState(false),live=useRef(true),working=useRef(false);
 const current=useRef(buffer);current.current=buffer;const changed=useRef(storage.onChange);changed.current=storage.onChange;const unavailable=useRef(onUnavailable);unavailable.current=onUnavailable;
 useEffect(()=>{live.current=true;return()=>{live.current=false;};},[]);
 const update=(previous:QueuePanelBuffer,next:QueuePanelBuffer)=>changed.current(key,value=>value===previous?next:value);
 function failure(cause:unknown){const e=cause instanceof ApiError?cause:new ApiError('STAGE_QUEUE_RESPONSE_INVALID'),code=/^[A-Z_]{1,80}$/.test(e.code)?e.code:'STAGE_QUEUE_RESPONSE_INVALID';if(live.current){setError(code);if([401,403,404].includes(e.status)){setView(null);unavailable.current(e.status===401?'AUTH_REQUIRED':code);}}return e;}
 async function load(){if(working.current)return;working.current=true;setBusy(true);setError(null);setView(null);try{const v=await readStageQueue(client,projectId,()=>live.current);if(live.current&&v)setView(v);}catch(cause){failure(cause);}finally{working.current=false;if(live.current)setBusy(false);}}
 async function prepare(){const original=buffer;if(!original||original.command||working.current)return;working.current=true;setBusy(true);setError(null);setAck(false);const active=()=>live.current&&current.current===original;
  try{const generation=await documentControl(client,projectId,session);if(!active())return;const fresh=await readStageQueue(client,projectId,active);if(!active()||!fresh)return;setView(fresh);const item=fresh.items.find(i=>ordered(i)===ordered(original.item));if(!item)throw new ApiError('QUEUE_REQUEST_NOT_CANCELLABLE',409);const command=prepareQueueCancellation(projectId,item,original.reason,session,generation);if(active())update(original,{...original,command});}
  catch(cause){failure(cause);}finally{working.current=false;if(live.current)setBusy(false);}
 }
 async function send(){const original=buffer,c=original?.command;if(!original||!c||c.result||working.current||!c.uncertain&&!ack)return;working.current=true;setBusy(true);setError(null);let sent=false;
  try{const generation=await documentControl(client,projectId,session);if(!live.current||current.current!==original)return;if(generation!==c.controlGeneration)throw new ApiError('PROJECT_CONTROL_CHANGED',409);
   const inFlight={...original,command:{...c,uncertain:true,failure:null}};update(original,inFlight);sent=true;
   const result=await sendQueueCancellation(client,inFlight.command,session,()=>live.current);if(live.current)changed.current(key,value=>value?.command?.bindingId===c.bindingId?{...value,command:{...inFlight.command,result,uncertain:false}}:value);
  }catch(cause){const e=failure(cause);if(sent&&live.current)changed.current(key,value=>value?.command?.bindingId===c.bindingId?{...value,command:{...value.command,uncertain:c.uncertain||!isKnownDocumentRejection(e),failure:{code:e.code,status:e.status}}}:value);}
  finally{working.current=false;if(live.current)setBusy(false);}
 }
 const command=buffer?.command;
 return <section aria-label="단계 대기 요청"><h3>단계 대기 요청</h3><p>프로젝트 전체의 미시작 WAITING 보관 기록입니다. 현재 임무 연결·기준·실행 상태는 미확인이고, 슬롯 예약·Agent 실행은 하지 않습니다. 취소 이력은 이 목록에서 생략됩니다.</p>
  <button type="button" disabled={busy} onClick={()=>void load()}>대기 목록 조회</button>
  {error?<p role="alert">{error} · 성공을 확인하지 못했습니다. 자동 재전송하지 않습니다.</p>:null}
  {view?<><p>서버 관측 {view.observedAt} · {view.items.length}건 · WAITING_ONLY · 차단 참조 빈 목록은 선행 충족 판정이 아닙니다.</p><ul>{view.items.map(i=><li key={i.requestRef.id}><span>{i.requestRef.id}</span> · 순번 {i.sequence} · v{i.requestRef.version}<code>{i.requestRef.contentHash}</code><ul>{i.reasonCodes.map(code=><li key={code}>{code}</li>)}</ul><button type="button" disabled={busy||!!command} onClick={()=>{setError(null);setAck(false);const next={item:structuredClone(i),reason:buffer?.reason??'',command:null};changed.current(key,prior=>prior?.command?prior:next);}}>대기 요청 {i.sequence} 선택</button></li>)}</ul></>:null}
  {buffer?<><p>선택 요청 {buffer.item.requestRef.id} / v1 / 순번 {buffer.item.sequence}</p><label>취소 사유<textarea aria-label="대기 요청 취소 사유" maxLength={20000} value={buffer.reason} disabled={busy||!!command} onChange={e=>{const reason=e.target.value;update(buffer,{...buffer,reason});}}/></label>
   {!command?<button type="button" disabled={busy||!buffer.reason.trim()} onClick={()=>void prepare()}>정확 요청 취소 준비</button>:<><p>고정 명령 {command.pending.commandId} · 제어 세대 {command.controlGeneration}</p>
    {command.result?<><p role="status">취소 영수증 확인 · v2 CANCELLED 보관 기록입니다. Agent 중지·예약 해제가 아닙니다.</p><button type="button" disabled={busy} onClick={()=>{changed.current(key,value=>value===buffer&&value.command?.result?null:value);setView(null);}}>취소 영수증 닫기</button></>:<>
     {command.uncertain?<p>결과 미확인: 새 명령을 만들거나 입력을 바꾸지 않고 같은 명령만 재확인합니다.</p>:<label><input type="checkbox" checked={ack} disabled={busy} onChange={e=>setAck(e.target.checked)}/>미시작 대기 요청만 취소하며 Agent 중지가 아님을 확인합니다</label>}
     <button type="button" disabled={busy||!command.uncertain&&!ack||!!command.failure&&!command.uncertain} onClick={()=>void send()}>{command.uncertain?'같은 취소 명령 결과 재확인':'대기 요청 취소 등록'}</button>
     {command.failure&&!command.uncertain?<button type="button" disabled={busy} onClick={()=>{update(buffer,{...buffer,command:null});setAck(false);setError(null);setView(null);}}>거절 확인 후 취소 입력으로 돌아가기</button>:null}
    </>}
   </>}
  </>:null}
 </section>;
}
