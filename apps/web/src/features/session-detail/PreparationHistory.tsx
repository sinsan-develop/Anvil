import {useEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import type {DocumentSession} from '../design-trace/editor-api.ts';
import type {ConfirmedAssignmentView} from '../workspace/assignment-confirmation-api.ts';
import {readPreparationHistoryPage,readPreparationOriginal,type PreparationHistoryPage,type PreparationSummary,type PreparationOriginal} from './preparation-history-api.ts';
import {ordered} from '../knowledge/review-view.ts';
type Position={cursor:string|null;history:(string|null)[]};
const first=():Position=>({cursor:null,history:[]});
const errorCode=(e:unknown)=>e instanceof ApiError&&/^[A-Z_]{1,80}$/.test(e.code)?e.code:'PREPARATION_HISTORY_RESPONSE_INVALID';
export function PreparationHistory({client,confirmed,session,onAuthenticationLost}:{client:ApiClient;confirmed:ConfirmedAssignmentView;session:DocumentSession;onAuthenticationLost:()=>void}){
 const key=ordered([confirmed.projectId,confirmed.ref,session.user.id,session.clientId]);
 const context=useRef({key,client,epoch:0});if(context.current.key!==key||context.current.client!==client)context.current={key,client,epoch:context.current.epoch+1};const owner=context.current;
 const sequence=useRef(0),originalSequence=useRef(0),lost=useRef(onAuthenticationLost);lost.current=onAuthenticationLost;
 const [opened,setOpened]=useState<typeof owner|null>(null),[target,setTarget]=useState<Position>(first),[position,setPosition]=useState<Position>(first),[attempt,setAttempt]=useState(0);
 const [loaded,setLoaded]=useState<{owner:typeof owner;attempt:number;value:PreparationHistoryPage|null;error:string|null}|null>(null);
 const [successfulSelection,setSuccessfulSelection]=useState<{owner:typeof owner;position:Position;item:PreparationSummary}|null>(null);
 const [selection,setSelection]=useState<{owner:typeof owner;item:PreparationSummary;attempt:number}|null>(null),[original,setOriginal]=useState<{selection:NonNullable<typeof selection>;value:PreparationOriginal|null;error:string|null}|null>(null);
 const open=opened===owner,current=open&&loaded?.owner===owner&&loaded.attempt===attempt?loaded:null,page=current?.value??null,selected=selection?.owner===owner?selection:null,shown=page&&selected&&original?.selection===selected?original:null;
 useEffect(()=>{if(!open)return;const ticket=++sequence.current,still=()=>context.current===owner&&sequence.current===ticket;let active=true;
 readPreparationHistoryPage(client,confirmed.projectId,confirmed.ref,target.cursor,()=>active&&still()).then(value=>{if(active&&still()&&value){setPosition(target);setLoaded({owner,attempt,value,error:null});if(successfulSelection?.owner===owner&&ordered(successfulSelection.position)===ordered(target)){const exact=value.items.find(item=>ordered(item)===ordered(successfulSelection.item));if(exact)setSelection({owner,item:exact,attempt});else setSuccessfulSelection(null);}else setSuccessfulSelection(null);}}).catch(cause=>{if(!active||!still())return;setLoaded({owner,attempt,value:null,error:errorCode(cause)});setSelection(null);setOriginal(null);if(cause instanceof ApiError&&[401,403,404].includes(cause.status))setSuccessfulSelection(null);if(cause instanceof ApiError&&cause.status===401)lost.current();});return()=>{active=false;};
 },[client,owner,open,attempt,target,confirmed.projectId,confirmed.ref]);
 useEffect(()=>{if(!open||!page||!selected)return;const ticket=++originalSequence.current,still=()=>context.current===owner&&originalSequence.current===ticket;let active=true;
 readPreparationOriginal(client,confirmed.projectId,confirmed.ref,selected.item,()=>active&&still()).then(value=>{if(active&&still()&&value){setOriginal({selection:selected,value,error:null});setSuccessfulSelection({owner,position,item:selected.item});}}).catch(cause=>{if(!active||!still())return;setOriginal({selection:selected,value:null,error:errorCode(cause)});if(cause instanceof ApiError&&[401,403,404].includes(cause.status)){setSuccessfulSelection(null);setLoaded({owner,attempt,value:null,error:errorCode(cause)});setSelection(null);if(cause.status===401)lost.current();}});return()=>{active=false;};
 },[client,owner,open,page,selected,confirmed.projectId,confirmed.ref,attempt]);
 function navigate(next:Position){sequence.current++;originalSequence.current++;setSelection(null);setOriginal(null);setLoaded(null);setTarget(next);setAttempt(v=>v+1);}
 function close(){sequence.current++;originalSequence.current++;setOpened(null);setLoaded(null);setSelection(null);setOriginal(null);setSuccessfulSelection(null);}
 return <section className="status-card" aria-label="전체 실행 준비 이력" lang="ko"><h3>전체 준비 이력</h3><p>저장된 과거 준비이며 현재 권한·실행 준비 완료·제어 세대는 미확인입니다.</p>
 {!open?<button type="button" onClick={()=>{setOpened(owner);setPosition(first());navigate(first());}}>전체 준비 이력 열기</button>:<><button type="button" onClick={close}>전체 준비 이력 닫기</button><button type="button" onClick={()=>navigate(first())}>준비 이력 첫 페이지 새로고침</button>
 {!current?<p role="status">준비 이력 조회 중 · 이전 자료 숨김</p>:null}{current?.error?<><p role="alert">{current.error} · 준비 이력 미확인</p><button type="button" onClick={()=>navigate(target)}>같은 준비 페이지 재시도</button>{successfulSelection?.owner===owner?<button type="button" onClick={()=>navigate(successfulSelection.position)}>직전 성공 준비 페이지·선택 다시 확인</button>:null}</>:null}
 {page?<><p>준비 이력 {position.history.length+1}페이지 · 현재 실행 허가 아님</p><button type="button" disabled={!position.history.length} onClick={()=>navigate({cursor:position.history.at(-1)??null,history:position.history.slice(0,-1)})}>더 최근 준비 보기</button>{page.items.length?<ul>{page.items.map(item=><li key={item.ref.id}><button type="button" aria-pressed={selected?.item.ref.id===item.ref.id} onClick={()=>{originalSequence.current++;setOriginal(null);setSelection({owner,item,attempt:(selected?.attempt??0)+1});}}>준비 원문 {item.ref.id}</button><p>{item.mode} · {item.checkedAt} · 부족 항목: {item.missingConditions.join(', ')}</p></li>)}</ul>:<p>조회된 과거 준비 기록 없음 · 미수행/완료 판정 아님</p>}{page.nextCursor?<button type="button" onClick={()=>navigate({cursor:page.nextCursor,history:[...position.history,position.cursor]})}>더 이전 준비 보기</button>:<p>조회된 범위의 더 이전 준비 없음</p>}</>:null}
 {page&&selected&&!shown?<p role="status">선택 준비 원문 검산 중 · 이전 본문 숨김</p>:null}{shown?.error?<p role="alert">{shown.error} · 원문 미확인</p>:null}
 {shown?.value?<article aria-label="선택 준비 고정 원문"><h4>준비 원문 · NOT_AUTHORIZED</h4><p>{shown.value.ref.id} · v{shown.value.ref.version} · {shown.value.ref.contentHash}</p><pre>{JSON.stringify(shown.value.snapshot,null,2)}</pre><button type="button" onClick={()=>{originalSequence.current++;setSelection(null);setOriginal(null);}}>준비 원문 닫기</button></article>:null}</>}
 </section>;
}
