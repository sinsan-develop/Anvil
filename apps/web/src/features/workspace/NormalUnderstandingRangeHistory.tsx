import {useEffect,useRef,useState} from 'react';
import {ApiError} from '../../api/client.ts';
import {ordered} from '../knowledge/review-view.ts';
import type {HistoricalRangeInput,NormalUnderstandingRangeHistoryResult} from './NormalUnderstandingDiscovery.tsx';

type Verify<T extends HistoricalRangeInput>=(raw:unknown,input:T,check:()=>void)=>Promise<NormalUnderstandingRangeHistoryResult>;
type Status='READING'|'UNKNOWN'|'UNAVAILABLE'|'NOT_STORED'|'NOT_FOUND'|null;
/** 본문은 이 보기의 상태에만 둔다. 현재 선택/검토/승인으로 넘기는 출구는 없다. */
export function NormalUnderstandingRangeHistory<T extends HistoricalRangeInput>({input,reader,verify,active,disabled,scopeOwner,entryOwner}:{input:T;reader:(input:Readonly<T>,signal:AbortSignal)=>Promise<NormalUnderstandingRangeHistoryResult>;verify:Verify<T>;active:()=>boolean;disabled:boolean;scopeOwner:object;entryOwner:object}){
 const [shown,setShown]=useState<{owner:object;value:NormalUnderstandingRangeHistoryResult;wallEnd:number;monoEnd:number}|null>(null);
 const [status,setStatus]=useState<{owner:object;value:Status}|null>(null);
 const alive=useRef(true),live=useRef({active,disabled});live.current={active,disabled};
 const key=ordered(input),enabled=active()&&!disabled,context=useRef({key,reader,verify,enabled,scopeOwner,entryOwner});
 if(context.current.key!==key||context.current.reader!==reader||context.current.verify!==verify||context.current.enabled!==enabled||context.current.scopeOwner!==scopeOwner||context.current.entryOwner!==entryOwner)context.current={key,reader,verify,enabled,scopeOwner,entryOwner};
 const owner=context.current;
 const flight=useRef<{owner:object;controller:AbortController;timer?:ReturnType<typeof setTimeout>}|null>(null);
 const cancel=()=>{
  const original=flight.current;flight.current=null;
  if(original){if(original.timer!==undefined)clearTimeout(original.timer);original.controller.abort();}
  setShown(null);setStatus(null);
 };
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;const original=flight.current;flight.current=null;if(original){if(original.timer!==undefined)clearTimeout(original.timer);original.controller.abort();}};},[]);
 useEffect(()=>{setShown(null);setStatus(null);return()=>{const original=flight.current;if(original?.owner===owner){flight.current=null;if(original.timer!==undefined)clearTimeout(original.timer);original.controller.abort();}};},[owner]);
 useEffect(()=>{
  if(!shown||shown.owner!==owner)return;
  const remaining=Math.min(shown.wallEnd-Date.now(),shown.monoEnd-performance.now());
  const timer=setTimeout(()=>setShown(current=>current===shown?null:current),Math.min(2147483647,Math.max(0,remaining)));
  return()=>clearTimeout(timer);
 },[shown,owner]);
 async function read(){
  if(flight.current||!enabled||!alive.current||context.current!==owner)return;
  const operation={owner,controller:new AbortController(),timer:undefined as ReturnType<typeof setTimeout>|undefined};
  flight.current=operation;setShown(null);setStatus({owner,value:'READING'});
  const expected=structuredClone(input),startedWall=Date.now(),startedMono=performance.now();
  let wall=startedWall,mono=startedMono,wallEnd=wall+30000,monoEnd=mono+30000;
  const current=()=>alive.current&&context.current===owner&&flight.current===operation&&!operation.controller.signal.aborted&&live.current.active()&&!live.current.disabled&&ordered(input)===key;
  const check=()=>{
   const w=Date.now(),m=performance.now();
   if(!current()||w<wall||m<mono||w>=wallEnd||m>=monoEnd)throw new ApiError('DISCOVERY_SCOPE_CHANGED');
   wall=w;mono=m;
  };
  operation.timer=setTimeout(()=>{
   if(flight.current===operation){flight.current=null;operation.controller.abort();setShown(null);if(alive.current&&context.current===owner)setStatus({owner,value:'UNKNOWN'});}
  },30000);
  try{
   check();const raw=await reader(expected,operation.controller.signal);check();
   const interval=Date.parse(raw.expiresAt)-Date.parse(raw.observedAt);
   if(Number.isFinite(interval)&&interval>0&&interval<=30000){const absolute=Date.parse(raw.expiresAt);wallEnd=Math.min(wallEnd,absolute,startedWall+interval);monoEnd=Math.min(monoEnd,startedMono+interval,performance.now()+absolute-Date.now());}
   check();const value=await verify(raw,expected,check);check();
   setShown({owner,value,wallEnd,monoEnd});setStatus(null);
  }catch(error){
   if(!current())return;
   const code=error instanceof ApiError?error.code:'',http=error instanceof ApiError?error.status:0;
   const value:Status=code==='NORMAL_UNDERSTANDING_RANGE_HISTORY_NOT_STORED'&&http===412?'NOT_STORED':http===404?'NOT_FOUND':[401,403,412].includes(http)?'UNAVAILABLE':'UNKNOWN';
   setShown(null);setStatus({owner,value});
  }finally{
   if(operation.timer!==undefined)clearTimeout(operation.timer);
   if(flight.current===operation){flight.current=null;if(alive.current&&context.current===owner)setStatus(value=>value?.value==='READING'?null:value);}
  }
 }
 const reading=flight.current?.owner===owner,value=shown?.owner===owner&&enabled&&Date.now()<shown.wallEnd&&performance.now()<shown.monoEnd?shown.value:null;
 const notice=status?.owner===owner?status.value:null;
 return <section aria-label="과거 선택 원문 조회"><h5>과거 보관 원문</h5>
  <button type="button" disabled={!enabled||reading} onClick={()=>void read()}>과거 보관 원문 확인</button>
  {notice==='READING'?<><p role="status">과거 원문 확인 중</p><button type="button" onClick={cancel}>과거 원문 조회 취소</button></>:null}
  {notice==='UNKNOWN'?<p role="status">과거 원문 조회 결과 미확인</p>:null}
  {notice==='UNAVAILABLE'?<p role="status">현재 인증·제어·읽기 권한을 확인한 뒤 다시 조회하세요.</p>:null}
  {notice==='NOT_FOUND'?<p role="status">해당 과거 보관 원문을 찾을 수 없습니다.</p>:null}
  {notice==='NOT_STORED'?<p role="status">선택 원문이 아직 정착되지 않았습니다.</p>:null}
  {value?<div aria-label="기록 당시 선택 원문"><p role="status">과거 보관 원문 · 현재 실행·검토 근거 없음</p>
   <p>현재 읽기 권한으로 조회한 당시의 고정 부분입니다. 같은 세션의 순번 {value.body.firstSequence}–{value.body.lastSequence}이며 전체 대화가 아닙니다.</p>
   {value.body.parts.map((part,index)=><div key={value.partRefs[index]!.id}><p>기록 당시 출력 순번 {part.sequence} · 텍스트 {part.blockIndex+1}</p><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{part.text}</pre></div>)}
   <button type="button" onClick={cancel}>과거 원문 닫기</button>
  </div>:null}
 </section>;
}
