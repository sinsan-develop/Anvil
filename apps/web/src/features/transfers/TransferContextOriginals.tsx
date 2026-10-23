import {useEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import type {PlanRef} from '../design-trace/work-plan-api.ts';
import type {ContextPreparationView} from '../workspace/context-api.ts';
import {readTransferOriginal} from './transfer-original.ts';
import {TransferSourceRows} from './TransferSourceRows.ts';
type Original=NonNullable<Awaited<ReturnType<typeof readTransferOriginal>>>;
/** 사용자 선택 한 건만 조회하며 metadata와 실제 표시 본문을 구분한다. */
export function TransferContextOriginals({client,projectId,assignmentRef,context,onUnavailable}:{client:ApiClient;projectId:string;assignmentRef:PlanRef;context:ContextPreparationView;onUnavailable:(error:ApiError)=>void}){
 const [value,setValue]=useState<Original|null>(null),[error,setError]=useState<string|null>(null),[pending,setPending]=useState(false),ticket=useRef(0),flight=useRef(false),unavailable=useRef(onUnavailable);unavailable.current=onUnavailable;
 const key=JSON.stringify([projectId,assignmentRef,context.ref]),latest=useRef(key);latest.current=key;
 useEffect(()=>()=>{ticket.current++;flight.current=false;},[client,key]);
 function clear(){ticket.current++;flight.current=false;setValue(null);setError(null);setPending(false);}
 async function read(itemId:string){if(flight.current)return;flight.current=true;const id=++ticket.current,active=()=>ticket.current===id&&latest.current===key;setValue(null);setError(null);setPending(true);
  try{const v=await readTransferOriginal(client,projectId,assignmentRef,context.ref,itemId,active);if(active()&&v)setValue(v);}
  catch(cause){if(!active())return;const e=cause instanceof ApiError?cause:new ApiError('TRANSFER_ORIGINAL_READ_FAILED');setError(/^[A-Z_]{1,80}$/.test(e.code)?e.code:'TRANSFER_ORIGINAL_READ_FAILED');if([401,403,404].includes(e.status))unavailable.current(e);}
  finally{if(active()){flight.current=false;setPending(false);}}
 }
 return <section aria-label="인계 맥락 원문 선택"><h3>선택 항목의 실제 원문</h3><p>선택한 항목 한 건만 기존 Anvil 조회로 읽습니다. 새 인계본 저장·외부 전달·현재 지시 효력·안전 재개를 확인하지 않습니다.</p>
  <TransferSourceRows items={context.manifest.items} pending={pending} onRead={itemId=>void read(itemId)}/>
  <button type="button" disabled={!pending&&!value&&!error} onClick={clear}>선택 인계 원문 닫기</button>
  {pending?<p role="status">선택 원문 대조 중 · 이전 본문 숨김</p>:null}
  {error?<p role="alert">{error} · 원문 미확인. 다른 버전/자료로 대체하지 않습니다.</p>:null}
  {value&&!pending?<section aria-label="인계 항목 원문"><h4>{value.title}</h4><p>{value.kind} · {value.itemId} · {value.sourceRef.id} · {value.sourceRef.contentHash}</p><p>{value.bodyRef.bytes}바이트 · SHA256 {value.bodyRef.contentHash}</p><pre>{value.body}</pre><p>고정 맥락 참조와 원문 일치 · 외부 전달·현재 지시 효력·안전 재개 미확인</p></section>:null}
 </section>;
}
