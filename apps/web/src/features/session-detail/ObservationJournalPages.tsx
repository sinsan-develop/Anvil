import {useEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import type {SubmittedResultView} from './result-api.ts';
import {readStoredObservationPage,type StoredObservationPage} from './observation-journal-api.ts';
type Position={cursor:string;before:number|null};
type Anchor=Pick<StoredObservationPage,'snapshotMaxSequence'|'snapshotDigest'|'snapshotCount'|'cursorExpiresAt'>&{deadline:number};
type Props={client:ApiClient;result:SubmittedResultView;onOpen:()=>void;onUnavailable:(code:string)=>void;stopOnly?:boolean;isSourceCurrent?:()=>boolean};
export function ObservationJournalPages(props:Props){
 const {client,result,stopOnly=false}=props,key=JSON.stringify([result.snapshot.scope,result.ref]),route=stopOnly?globalThis.location?.hash:undefined;
 const owner=useRef({client,transport:client.transport,key,stopOnly,route,valid:true,generation:0}),source=useRef(props.isSourceCurrent);source.current=props.isSourceCurrent;
 const [,refresh]=useState(0);
 if(owner.current.client!==client||owner.current.transport!==client.transport||owner.current.key!==key||owner.current.stopOnly!==stopOnly||owner.current.route!==route)owner.current={client,transport:client.transport,key,stopOnly,route,valid:true,generation:owner.current.generation+1};
 const original=owner.current;
 useEffect(()=>{
  if(!stopOnly)return;
  const hash=(value:string)=>{try{return new URL(value).hash;}catch{return null;}};
  const changed=(event:HashChangeEvent)=>{if((event.oldURL?hash(event.oldURL):route)!==route||(event.newURL?hash(event.newURL):globalThis.location?.hash)!==route){original.valid=false;refresh(value=>value+1);}};
  globalThis.addEventListener?.('hashchange',changed);return()=>globalThis.removeEventListener?.('hashchange',changed);
 },[original]);
 const current=()=>{
  const supplied=source.current?.()!==false;
  if(stopOnly&&(!supplied||globalThis.location?.hash!==original.route))original.valid=false;
  return owner.current===original&&client.transport===original.transport&&supplied&&original.valid;
 };
 return <Pages key={original.generation} {...props} current={current}/>;
}
function Pages({client,result,onOpen,onUnavailable,current,stopOnly=false}:Props&{current:()=>boolean}){
 const [open,setOpen]=useState(false),[pending,setPending]=useState(false),[error,setError]=useState<string|null>(null),[loaded,setLoaded]=useState<{page:StoredObservationPage;index:number;deadline:number}|null>(null),[positions,setPositions]=useState<Position[]>([]),[selected,setSelected]=useState<string|null>(null),generation=useRef(0),anchor=useRef<Anchor|null>(null),unavailable=useRef(onUnavailable);unavailable.current=onUnavailable;
 const [retry,setRetry]=useState<(Position&{index:number})|null>(null),flight=useRef(false);
 useEffect(()=>()=>{generation.current++;},[]);
 function expired(){generation.current++;flight.current=false;setRetry(null);setLoaded(null);setPositions([]);setSelected(null);anchor.current=null;setPending(false);setError('RESULT_OBSERVATION_CURSOR_EXPIRED');}
 useEffect(()=>{const deadline=loaded?.deadline??(retry?anchor.current?.deadline:undefined);if(deadline===undefined)return;const timer=setTimeout(expired,Math.max(0,deadline-performance.now()));return()=>clearTimeout(timer);},[loaded,retry]);
 async function load(cursor:string|null,index:number,reset=false,before?:number|null){
  if(flight.current||!current())return;if(!reset&&anchor.current&&performance.now()>=anchor.current.deadline){expired();return;}
  const ticket=++generation.current,active=()=>current()&&ticket===generation.current,started=performance.now(),basis=reset?null:anchor.current,expected=reset?null:positions[index]??(cursor&&before!==undefined?{cursor,before}:null);
  flight.current=true;setRetry(null);
  setOpen(true);onOpen();setPending(true);setLoaded(null);setSelected(null);setError(null);if(reset){anchor.current=null;setPositions([]);}
  try{const page=await readStoredObservationPage(client,result,cursor,active);if(!page||!active())return;const deadline=Math.min(basis?.deadline??Infinity,started+Date.parse(page.cursorExpiresAt)-Date.parse(page.observedAt));
   if(performance.now()>=deadline)throw new ApiError('RESULT_OBSERVATION_CURSOR_EXPIRED');
   if(basis&&(page.snapshotMaxSequence!==basis.snapshotMaxSequence||page.snapshotDigest!==basis.snapshotDigest||page.snapshotCount!==basis.snapshotCount||page.cursorExpiresAt!==basis.cursorExpiresAt)||expected&&page.beforeSequence!==expected.before)throw new ApiError('RESULT_OBSERVATION_RESPONSE_INVALID');
   anchor.current={snapshotMaxSequence:page.snapshotMaxSequence,snapshotDigest:page.snapshotDigest,snapshotCount:page.snapshotCount,cursorExpiresAt:page.cursorExpiresAt,deadline};
   setPositions(old=>[...old.slice(0,index),{cursor:page.pageCursor,before:page.beforeSequence}]);setLoaded({page,index,deadline});
  }catch(cause){if(!active())return;const e=cause instanceof ApiError?cause:new ApiError('RESULT_OBSERVATION_RESPONSE_INVALID'),code=/^[A-Z_]{1,80}$/.test(e.code)?e.code:'RESULT_OBSERVATION_RESPONSE_INVALID';
   setError(code);
   if(e.code==='CONNECTION_LOST'&&e.status===0&&basis&&cursor&&expected){
    if(performance.now()>=basis.deadline){expired();return;}
    setRetry({cursor,index,before:expected.before});
   }
   else{setPositions([]);anchor.current=null;}
   if([401,403,404].includes(e.status))unavailable.current(e.status===401?'AUTH_REQUIRED':code);}
  finally{if(active()){flight.current=false;setPending(false);}}
 }
 const isCurrent=current(),value=isCurrent?loaded?.page:undefined,items=value?.items.filter(item=>!stopOnly||['STOP_REQUESTED','STOPPED','STOP_UNCONFIRMED'].includes(item.snapshot.event.type))??[],record=items.find(e=>e.ref.id===selected);
 const displayedGeneration=generation.current;
 function close(){if(!current()||generation.current!==displayedGeneration)return;generation.current++;flight.current=false;anchor.current=null;setOpen(false);setPending(false);setLoaded(null);setPositions([]);setSelected(null);setRetry(null);setError(null);}
 return <section aria-label={stopOnly?'보관 STOP 관측 페이지 탐색':'보관 관측 페이지 탐색'}><h5>{stopOnly?'보관 STOP 관측 페이지 탐색':'보관 관측 페이지 탐색'}</h5><p>요약 목록과 별도 조회입니다. 고정된 순번 범위를 탐색하며 각 페이지 이동·복귀 때 현재 조회 권한을 다시 확인합니다. 실제 Agent/OS·완료·중지·재개 판정은 아닙니다.</p>
  <button type="button" disabled={pending||!isCurrent} onClick={()=>void load(null,0,true)}>{stopOnly?(open?'STOP 관측 페이지 새로 조회':'STOP 관측 페이지 탐색'):(open?'관측 페이지 새로 조회':'관측 페이지 탐색')}</button>{stopOnly&&open&&isCurrent?<button type="button" onClick={close}>STOP 관측 페이지 닫기</button>:null}
  {isCurrent&&pending?<p role="status">관측 페이지 조회 중 · 이전 원문 숨김</p>:null}{isCurrent&&error?<p role="alert">{error} · 페이지 미확인. {retry?'원 탐색 기한 안에서 같은 페이지를 명시 재조회할 수 있습니다.':'새 조회가 필요합니다.'}</p>:null}
  {isCurrent&&retry?<button type="button" disabled={pending} onClick={()=>void load(retry.cursor,retry.index,false,retry.before)}>같은 관측 페이지 재조회</button>:null}
  {value&&loaded?<><p>현재 보관 {value.storedCount}건 · 고정 탐색 {value.snapshotCount}건 · 페이지 {loaded.index+1}</p><p>고정 상한 순번 {value.snapshotMaxSequence} · 현재 서버 ACK 최대 {value.ack?.snapshot.maxSequence??'미보관'} · 현재 로컬 순번 미확인</p><p>원 탐색 기한 <time dateTime={value.cursorExpiresAt}>{value.cursorExpiresAt}</time> · 페이지 이동으로 연장하지 않습니다.</p>
   <button type="button" disabled={pending||loaded.index===0} onClick={()=>{const previous=positions[loaded.index-1];if(previous)void load(previous.cursor,loaded.index-1);}}>이후 관측 페이지</button>
   <button type="button" disabled={pending||!value.hasMore} onClick={()=>{if(value.nextCursor)void load(value.nextCursor,loaded.index+1,false,value.items.at(-1)?.snapshot.event.sequence);}}>더 이전 관측 20건</button>
   {stopOnly?<p>현재 페이지 전체 {value.items.length}건 중 STOP 기록 {items.length}건 · 필터는 탐색 순번을 바꾸지 않습니다.</p>:null}{items.length?<ul>{items.map(e=><li key={e.ref.id}>순번 {e.snapshot.event.sequence} · {e.snapshot.event.type} · 공급자 주장 <button type="button" aria-pressed={e.ref.id===selected} onClick={()=>setSelected(e.ref.id)}>페이지 관측 원문 {e.snapshot.event.sequence}</button></li>)}</ul>:<p>{stopOnly?'이 페이지에 STOP 관측 없음 · 다른 페이지의 부재나 실제 정지 판정 아님':'고정 범위의 보관 관측 없음 · 실제 실행 상태 미확인'}</p>}
   {record?<article aria-label="페이지 선택 관측 원문"><h5>순번 {record.snapshot.event.sequence} · 공급자 주장</h5><button type="button" onClick={()=>setSelected(null)}>페이지 관측 원문 닫기</button><p>기록 ID {record.ref.id} · {record.ref.contentHash}</p><p>주장 시각 {record.snapshot.event.occurredAt} · 서버 수신 {record.snapshot.receivedAt}</p><p>원인·실제 수행·중지·쓰기 회수는 미확인입니다. 출처 표기를 실제 관측이나 합격으로 승격하지 않습니다.</p><pre>{JSON.stringify(record,null,2)}</pre></article>:null}
  </>:null}
 </section>;
}
