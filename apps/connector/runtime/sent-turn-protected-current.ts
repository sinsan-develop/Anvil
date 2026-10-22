import {canonicalJson} from '../../../contracts/canonical.ts';
import {readDispatchEnvelopeV1} from '../../../contracts/runtime/dispatch-envelope-v1.ts';
import {receiptKeyV1} from '../../../contracts/runtime/dispatch-receipt-v1.ts';
import {validateProviderSessionClaim,type ProviderSessionClaim,type ProviderRef} from '../../../contracts/runtime/provider-session-claim-v1.ts';
import {cloneV1,hashV1,isoV1,recordV1,refV1} from '../../../contracts/runtime/validation-v1.ts';
import type {SyntheticSentTurnPrivateCurrent} from './sent-turn-current-binding.ts';
import {SyntheticSentResponseHandleReader} from './sent-response-handle-reader.ts';
type Input=Parameters<SyntheticSentTurnPrivateCurrent['readCurrent']>[0];
export interface SyntheticSentTurnCurrentMetadata{transport:'SYNTHETIC_ONLY';/** Fresh private current metadata WITHOUT threadId. Not preSendSnapshot echo, caller/HTTP data or proof of OS authority. */readCurrent(input:Input,signal:AbortSignal):Promise<unknown>}
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
function fail():never{throw Error('SENT_TURN_PROTECTED_CURRENT_UNAVAILABLE');}
/** Response-only private snapshot. Fixed parent + protected THREAD, never a raw
 * identifier supplied by metadata/pre. Outer server binding/material/current and
 * original locked post checks remain mandatory. No default registration/execution. */
export class SyntheticSentTurnProtectedCurrent implements SyntheticSentTurnPrivateCurrent{
 readonly transport='SYNTHETIC_ONLY' as const;
 #reader:SyntheticSentResponseHandleReader;#claim:ProviderSessionClaim;#claimRef:ProviderRef;#metadata:SyntheticSentTurnCurrentMetadata;#clock:()=>number;#timeout:number;
 constructor(reader:SyntheticSentResponseHandleReader,parent:{claim:unknown;claimRef:ProviderRef},metadata:SyntheticSentTurnCurrentMetadata,options:{clock:()=>number;timeoutMs:number}){
  this.#reader=reader;this.#metadata=metadata;this.#clock=options.clock;this.#timeout=options.timeoutMs;
  if(!recordV1(parent,['claim','claimRef'])||typeof this.#clock!=='function'||!Number.isSafeInteger(this.#timeout)||this.#timeout<1||this.#timeout>10000)fail();
  const checked=validateProviderSessionClaim(parent.claim);if(checked.claim.kind!=='THREAD'||!same(checked.ref,parent.claimRef))fail();this.#claim=checked.claim;this.#claimRef=checked.ref;this.#ports();
 }
 #ports(){if(!(this.#reader instanceof SyntheticSentResponseHandleReader)||this.#reader.transport!=='SYNTHETIC_ONLY'||typeof this.#reader.use!=='function'||this.#metadata?.transport!=='SYNTHETIC_ONLY'||typeof this.#metadata.readCurrent!=='function')fail();}
 #now(){const n=this.#clock();if(!Number.isSafeInteger(n)||!Number.isFinite(new Date(n).getTime()))return fail();return n;}
 async readCurrent(raw:Input,signal:AbortSignal):Promise<unknown>{
  const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined,listener:(()=>void)|undefined;
  try{
   this.#ports();if(!(signal instanceof AbortSignal)||signal.aborted)return fail();const input=cloneV1(raw),e=readDispatchEnvelopeV1(input.envelope,this.#now()),pre:any=input.preSendSnapshot;
   if(e.operation!=='SEND_INSTRUCTION'||!same(input.parentThreadClaimRef,this.#claimRef)||!recordV1(pre,['transport','key','envelopeHash','sessionBindingRef','instructionRef','partsRef','materialReceiptRef','instructionContentHash','understandingReviewRef','grantRef','ownershipRef','threadId','turnState','checkedAt','expiresAt',...(Object.hasOwn(pre??{},'contextReviewFact')?['contextReviewFact']:[])])||pre.transport!=='SYNTHETIC_ONLY'||pre.turnState!=='IDLE'||!same(pre.key,receiptKeyV1(e))||pre.envelopeHash!==e.envelopeHash||!same(pre.sessionBindingRef,e.payload.sessionBindingRef)||!same(pre.instructionRef,e.payload.instructionRef)||!same(pre.partsRef,e.payload.partsRef)||![pre.materialReceiptRef,pre.grantRef,pre.ownershipRef,input.attemptRef,input.permitRef,input.responseRef].every(refV1)||!hashV1(pre.instructionContentHash)||!hashV1(input.preSendBindingHash)||!isoV1(pre.checkedAt)||!isoV1(pre.expiresAt))return fail();
   let end=Math.min(this.#now()+this.#timeout,Date.parse(e.expiresAt),Date.parse(pre.expiresAt),Date.parse(this.#claim.usableBefore));
   const guard=()=>{this.#ports();if(signal.aborted||controller.signal.aborted||this.#now()>=end)fail();};guard();
   const cancelled=new Promise<never>((_,reject)=>{listener=()=>{controller.abort();reject(Error('SENT_TURN_PROTECTED_CURRENT_UNAVAILABLE'));};signal.addEventListener('abort',listener,{once:true});timer=setTimeout(listener,Math.max(1,end-this.#now()));});
   const work=async()=>{
    let snapshot:unknown;
    await this.#reader.use({envelope:cloneV1(e),claim:cloneV1(this.#claim),claimRef:cloneV1(this.#claimRef),attemptRef:cloneV1(input.attemptRef),permitRef:cloneV1(input.permitRef),grantRef:cloneV1(pre.grantRef),preSendBindingHash:input.preSendBindingHash,instructionContentHash:pre.instructionContentHash},controller.signal,async(handles,privateSignal)=>{
     guard();if(privateSignal.aborted||handles.threadId!==pre.threadId||handles.turnId!==null)fail();
     const metadata=cloneV1(await this.#metadata.readCurrent(cloneV1(input),privateSignal));guard();
     if(privateSignal.aborted||!recordV1(metadata,Object.keys(pre).filter(k=>k!=='threadId'))||!['IDLE','IN_PROGRESS'].includes(metadata.turnState)||!isoV1(metadata.checkedAt)||!isoV1(metadata.expiresAt)||Date.parse(metadata.checkedAt)>this.#now()||this.#now()-Date.parse(metadata.checkedAt)>30000||Date.parse(metadata.expiresAt)>Date.parse(metadata.checkedAt)+30000)return fail();
     for(const k of Object.keys(metadata))if(!['checkedAt','expiresAt','turnState','contextReviewFact'].includes(k)&&!same(metadata[k],pre[k]))fail();
     if(Object.hasOwn(pre,'contextReviewFact')){const{checkedAt:a,...now}=metadata.contextReviewFact,{checkedAt:b,...prior}=pre.contextReviewFact;if(!isoV1(a)||Date.parse(a)>this.#now()||this.#now()-Date.parse(a)>30000||!same(now,prior))fail();}
     end=Math.min(end,Date.parse(metadata.expiresAt),Date.parse(metadata.checkedAt)+30000);guard();
     snapshot={...metadata,threadId:handles.threadId,expiresAt:new Date(end).toISOString()};
    });guard();if(snapshot===undefined)fail();return snapshot;
   };
   const result=await Promise.race([work(),cancelled]);guard();return result;
  }catch{return fail();}finally{controller.abort();if(timer)clearTimeout(timer);if(listener&&signal instanceof AbortSignal)signal.removeEventListener('abort',listener);}
 }
}
