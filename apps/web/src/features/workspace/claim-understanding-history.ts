import {ApiClient,ApiError} from '../../api/client.ts';
import {readProviderClaimReceiptHistory,type ProviderClaimPageHistory} from './provider-claim-receipt-api.ts';
import {readNormalUnderstandingHistory,validateUnderstandingHistory,type UnderstandingHistoryView} from '../session-detail/understanding-history-api.ts';
/** 제출 결과 없이, 선택된 보관 claim의 원결과가 존재할 때만 같은 실행의 검토 이력을 읽는다.
 * claim과 검토 응답의 직접 대응·현재 세션 가동/허가·의미 이해 수용은 검증하지 않는다. */
export async function readClaimUnderstandingHistory(client:ApiClient,projectId:string,sessionRef:ProviderClaimPageHistory['agentSessionRef'],raw:ProviderClaimPageHistory['items'][number],active:()=>boolean):Promise<UnderstandingHistoryView|null>{
 const selected=structuredClone(raw),session=structuredClone(sessionRef),q=selected?.query;
 if(!selected||Object.keys(selected).sort().join(',')!=='query,receipt'||!selected.receipt||!q||q.projectId!==projectId||q.agentSessionId!==session?.id||!Number.isSafeInteger(session.version)||session.version<1||typeof session.contentHash!=='string'||!/^[a-f0-9]{64}$/.test(session.contentHash))throw new ApiError('UNDERSTANDING_CLAIM_BINDING_INVALID');
 if(!active())return null;
 const original=await readProviderClaimReceiptHistory(client,q,active,selected.receipt);if(!original||!active())return null;
 if(!original.found)throw new ApiError('UNDERSTANDING_CLAIM_NOT_FOUND',404);
 const scope={projectId:q.projectId,executionId:q.executionId,executionGeneration:q.generation},value=await client.get(`/api/v1/projects/${scope.projectId}/executions/${scope.executionId}/understanding-reviews?generation=${scope.executionGeneration}`);if(!active())return null;
 return validateUnderstandingHistory(value,scope,active);
}

import {ordered} from '../knowledge/review-view.ts';
import {readPreparationOriginalByRef} from '../session-detail/preparation-history-api.ts';
import type {ReviewedNormalUnderstandingRangeHistoryRequest} from './NormalUnderstandingDiscovery.tsx';
import type {PlanRef} from '../design-trace/work-plan-api.ts';
export type NormalClaimRangeHistoryBasis={status:'EXACT_NORMAL_RANGE_REFS';origin:ReviewedNormalUnderstandingRangeHistoryRequest;reviewRef:PlanRef}|{status:'NO_NORMAL_REVIEW'};
/** 선택 claim은 실행의 탐색 입구다. 판단의 원문 참조와 현재 원문 읽기 권한을 대신하지 않는다. */
export async function readNormalClaimRangeHistory(client:ApiClient,projectId:string,sessionRef:ProviderClaimPageHistory['agentSessionRef'],raw:ProviderClaimPageHistory['items'][number],signal:AbortSignal,active:()=>boolean):Promise<NormalClaimRangeHistoryBasis>{
 const selected=structuredClone(raw),session=structuredClone(sessionRef),transport=client.transport,owned=new AbortController();
 const fail=():never=>{throw new ApiError('UNDERSTANDING_CLAIM_BINDING_INVALID');};
 if(!selected||Object.keys(selected).sort().join(',')!=='query,receipt'||!selected.receipt||selected.query?.projectId!==projectId||selected.query.agentSessionId!==session?.id||!Number.isSafeInteger(session.version)||session.version<1||!/^[a-f0-9]{64}$/.test(session.contentHash))fail();
 let wall=Date.now(),mono=performance.now();const wallEnd=wall+30000,monoEnd=mono+30000;
 const check=()=>{const w=Date.now(),m=performance.now();if(!active()||signal.aborted||owned.signal.aborted||client.transport!==transport||ordered(raw)!==ordered(selected)||ordered(sessionRef)!==ordered(session)||w<wall||m<mono||w>=wallEnd||m>=monoEnd){owned.abort();throw new ApiError('DISCOVERY_SCOPE_CHANGED');}wall=w;mono=m;};
 let timer:ReturnType<typeof setTimeout>|undefined,abort!:()=>void;
 const expired=new Promise<never>((_,reject)=>{abort=()=>{owned.abort();reject(new ApiError('DISCOVERY_SCOPE_CHANGED'));};timer=setTimeout(abort,30000);});
 signal.addEventListener('abort',abort,{once:true});
 const bounded=new ApiClient(async(url,options)=>{
  check();if(options?.method!=='GET')return fail();
  const response=await Promise.race([transport.call(globalThis,url,{...options,signal:owned.signal}).then(value=>{if(owned.signal.aborted)void value.body?.cancel().catch(()=>{});return value;}),expired]);check();
  const value=await readBoundedUnderstandingHistoryJson(response,check,owned.signal);check();return Response.json(value,{status:response.status,headers:{'Cache-Control':'no-store'}});
 });
 async function lookup():Promise<NormalClaimRangeHistoryBasis>{
  check();const q=selected.query,original=await readProviderClaimReceiptHistory(bounded,q,()=>{check();return true;},selected.receipt);check();
  if(!original?.found)throw new ApiError('UNDERSTANDING_CLAIM_NOT_FOUND',404);
  const scope={projectId,executionId:q.executionId,executionGeneration:q.generation};
  const history=await readNormalUnderstandingHistory(bounded,scope,()=>{check();return true;});check();
  if(!history)return fail();if(!history.items.length)return {status:'NO_NORMAL_REVIEW'};
  const row=history.items[0]!,c=row.snapshot.currentBinding,g:any=c.sourceBasis;
  if(!same(g.agentSessionRef,session))return fail();
  const preparation=await readPreparationOriginalByRef(bounded,projectId,g.preparationRef as PlanRef,()=>{check();return true;});check();
  const p=preparation?.snapshot,i=p?.intent;
  if(!p||i.connectionKind!=='REGISTERED_DEFINITION'||i.mode!=='CONTEXT_REVIEW'||!same(i.contextBundleRef,c.bundleRef)||!same(i.roleBindingRef,c.subjectBindingRef)||!same(p.basisRefs,c.basisRefs)||!same(p.latestInstructionRefs,c.latestInstructionRefs))return fail();
  return {status:'EXACT_NORMAL_RANGE_REFS',reviewRef:structuredClone(row.ref),origin:{kind:'NORMAL_REVIEW_HISTORY',request:{...scope,assignmentRef:structuredClone(i.assignmentRef),preparationRef:structuredClone(preparation!.ref),requestRef:structuredClone(g.requestRef as PlanRef)},responseRef:structuredClone(c.responseRef),partRefs:structuredClone(c.responsePartRefs),bundleRef:structuredClone(c.bundleRef),subjectBindingRef:structuredClone(c.subjectBindingRef)}};
 }
 const same=(a:unknown,b:unknown)=>ordered(a)===ordered(b);
 try{return await Promise.race([lookup(),expired]);}finally{if(timer!==undefined)clearTimeout(timer);signal.removeEventListener('abort',abort);owned.abort();}
}

/** 같은 유한 바이트 판독을 메타 탐색과 별도 원문 GET에 적용한다. */
export async function readBoundedUnderstandingHistoryJson(response:Response,check:()=>void,signal:AbortSignal){
 if(!/^application\/json\b/i.test(response.headers.get('content-type')??'')||!response.body)throw Error();const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0,bytes:Uint8Array|undefined;
 let cancelled=false;
 const abort=()=>{if(cancelled)return;cancelled=true;try{void reader.cancel().catch(()=>{});}catch{}};signal.addEventListener('abort',abort,{once:true});
 try{
  while(true){check();const r=await reader.read();try{check();}catch(error){if(!r.done)r.value.fill(0);throw error;}if(r.done)break;chunks.push(r.value);size+=r.value.byteLength;if(size>2097152)throw Error();}
  check();
  bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  check();const raw=new TextDecoder('utf-8',{fatal:true}).decode(bytes);check();
  const value:unknown=JSON.parse(raw),stack:{keys:Set<string>|null;key:boolean}[]=[];
  for(const token of raw.match(/"(?:\\.|[^"\\])*"|[{}\[\],:]|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null/g)??[]){
   if(token==='{'||token==='[')stack.push({keys:token==='{'?new Set():null,key:token==='{'});else if(token==='}'||token===']')stack.pop();else{
    const frame=stack.at(-1);if(!frame?.keys)continue;if(token===',')frame.key=true;else if(token===':')frame.key=false;else if(frame.key&&token.startsWith('"')){const k=JSON.parse(token);if(frame.keys.has(k))throw Error();frame.keys.add(k);}
   }
  }
  check();return value;
 }finally{
  signal.removeEventListener('abort',abort);try{abort();reader.releaseLock();}finally{bytes?.fill(0);for(const chunk of chunks)chunk.fill(0);}
 }
}
