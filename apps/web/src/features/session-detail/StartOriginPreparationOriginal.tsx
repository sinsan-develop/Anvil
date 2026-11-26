import {useEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import {ordered} from '../knowledge/review-view.ts';
import type {OriginView} from './execution-start-origin-api.ts';
import {readPreparationOriginalByRef,type PreparationOriginal,type WorkUnderstandingBasis} from './preparation-history-api.ts';
import {WorkPreparationUnderstandingSource} from './PreparationHistory.tsx';
import type {NormalUnderstandingReview} from './understanding-history-api.ts';

const same=(a:unknown,b:unknown)=>ordered(a)===ordered(b);

function assertOriginPreparation(origin:OriginView,preparation:PreparationOriginal){
 const source=origin.snapshot,{intent,options,understandingBasis}=preparation.snapshot;
 const refs=['assignmentRef','roleBindingRef','contextBundleRef','connectionRef','environmentRef','budgetPolicyRef'];
 if(preparation.projectId!==origin.projectId||!same(preparation.ref,source.preparationRef)||
    intent.connectionKind!=='REGISTERED_DEFINITION'||refs.some(ref=>!same(intent[ref],source[ref]))||
    !same(intent.sourceScopes,source.sourceScopes)||!same(preparation.snapshot.basisRefs,source.basisRefs)||
    !same(preparation.snapshot.latestInstructionRefs,source.latestInstructionRefs)||
    !same(source.options.preparationRef,preparation.ref)||!options||
    options.format!==source.options.format||options.contentHash!==source.options.contentHash||options.utf8Bytes!==source.options.utf8Bytes||
    understandingBasis&&!same(understandingBasis.agentSessionRef,source.sessionBindingRef)){
  throw new ApiError('EXECUTION_START_ORIGIN_SOURCE_MISMATCH',409);
 }
}

function matchesStoredReview(review:NormalUnderstandingReview,basis:WorkUnderstandingBasis){
 const {currentBinding,outcome}=review.snapshot,g=currentBinding.sourceBasis;
 return outcome==='ACCEPTED'&&same(currentBinding.subjectBindingRef,basis.roleBindingRef)&&
   same(g.bundleRef,basis.contextBundleRef)&&
   (['preparationRef','roleBindingRef','agentSessionRef','requestRef','responseRef','basisRefs','latestInstructionRefs'] as const).every(key=>same(g[key],basis[key]));
}

export function StartOriginPreparationOriginal({client,origin,active,onAuthenticationLost}:{client:ApiClient;origin:OriginView;active:()=>boolean;onAuthenticationLost:()=>void}){
 const alive=useRef(false),sequence=useRef(0),live=useRef(active);
 live.current=active;
 const [result,setResult]=useState<{value:PreparationOriginal|null;pending:boolean;error:string|null}|null>(null);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;sequence.current++;};},[]);
 async function inspect(){
  if(!alive.current||!live.current())return;
  const ticket=++sequence.current,transport=client.transport;
  const current=()=>alive.current&&live.current()&&sequence.current===ticket&&client.transport===transport;
  setResult({value:null,pending:true,error:null});
  try{
   const value=await readPreparationOriginalByRef(client,origin.projectId,origin.snapshot.preparationRef,current);
   if(!current()||!value)return;
   assertOriginPreparation(origin,value);
   setResult({value,pending:false,error:null});
  }catch(cause){
   if(!current())return;
   const code=cause instanceof ApiError&&/^[A-Z_]{1,80}$/.test(cause.code)?cause.code:'PREPARATION_HISTORY_RESPONSE_INVALID';
   setResult({value:null,pending:false,error:code});
   if(cause instanceof ApiError&&cause.status===401)onAuthenticationLost();
  }
 }
 const shown=active()?result:null,preparation=shown?.value,shownSequence=sequence.current,shownTransport=client.transport;
 const reviewCurrent=()=>alive.current&&live.current()&&sequence.current===shownSequence&&client.transport===shownTransport;
 const basis=preparation?.snapshot.understandingBasis as WorkUnderstandingBasis|undefined;
 return <section aria-label="START에 연결된 등록 준비본">
  <button type="button" disabled={shown?.pending} onClick={()=>void inspect()}>START에 보관된 준비 원문 검산</button>
  {shown?<button type="button" onClick={()=>{sequence.current++;setResult(null);}}>연결된 준비 원문 닫기</button>:null}
  {shown?.pending?<p role="status">정확한 준비 버전 검산 중</p>:null}
  {shown?.error?<p role="alert">{shown.error} · 보관된 준비 원문 확인 실패</p>:null}
  {preparation?<article aria-label="START에 연결된 준비 원문 검산 결과">
   <h5>{preparation.snapshot.intent.mode} · 연결된 준비 원문</h5>
   <p>{preparation.ref.id} · v{preparation.ref.version} · {preparation.ref.contentHash}</p>
   <p>준비 이유: {preparation.snapshot.intent.reason}</p>
   <p>Options {preparation.snapshot.options.format} · {preparation.snapshot.options.utf8Bytes}바이트 · {preparation.snapshot.options.contentHash}</p>
   <p>기록 당시 준비 자료 · 현재 실행 자격 미검산</p>
   {basis?<WorkPreparationUnderstandingSource client={client} basis={basis} isSourceCurrent={reviewCurrent} matchesSource={review=>matchesStoredReview(review,basis)} onAuthenticationLost={onAuthenticationLost}/>:null}
  </article>:null}
 </section>;
}
