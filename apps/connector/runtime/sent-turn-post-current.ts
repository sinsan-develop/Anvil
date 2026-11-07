import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {readDispatchEnvelopeV1} from '../../../contracts/runtime/dispatch-envelope-v1.ts';
import {receiptKeyV1} from '../../../contracts/runtime/dispatch-receipt-v1.ts';
import {cloneV1,hashV1,isoV1,recordV1,refV1} from '../../../contracts/runtime/validation-v1.ts';
import type {SyntheticInstructionPostResponseAuthority} from '../adapters/primary/instruction-transport.ts';
import type {SyntheticLockedProviderAttemptSource} from '../adapters/primary/provider-reader-factory.ts';
import type {ProviderWireAttempt} from '../adapters/primary/provider-bound-wire.ts';
type Input=Parameters<SyntheticInstructionPostResponseAuthority['current']>[0];
export interface SyntheticSentTurnCurrentSource{transport:'SYNTHETIC_ONLY';/** Trusted current verifier, not caller/HTTP state. No concrete server/OS verification is implemented by this interface. */readCurrent(input:Input,signal:AbortSignal):Promise<unknown>}
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b),hash=(v:unknown)=>contentHash(canonicalJson(v));
const fail=():never=>{throw Error('SENT_TURN_POST_CURRENT_UNAVAILABLE');};
/** Same locked sent event only; never grants eligibility for another SEND. Exact
 * journal hashes do not prove fsync, current ownership, DPAPI or Agent execution.
 * No lock reacquisition, native/DB call, credential issuance or default verifier. */
export class SyntheticSentTurnPostCurrent implements SyntheticInstructionPostResponseAuthority{
 readonly transport='SYNTHETIC_ONLY' as const;#current:SyntheticSentTurnCurrentSource;#clock:()=>number;#timeout:number;
 constructor(current:SyntheticSentTurnCurrentSource,options:{clock:()=>number;timeoutMs:number}){this.#current=current;this.#clock=options.clock;this.#timeout=options.timeoutMs;if(typeof this.#clock!=='function'||!Number.isSafeInteger(this.#timeout)||this.#timeout<1||this.#timeout>10000)fail();this.#ports();}
 #ports(source?:SyntheticLockedProviderAttemptSource){if(this.#current?.transport!=='SYNTHETIC_ONLY'||typeof this.#current.readCurrent!=='function'||source!==undefined&&(source?.transport!=='SYNTHETIC_ONLY'||typeof source.readLocked!=='function'))fail();}
 #now(){const n=this.#clock();if(!Number.isSafeInteger(n)||!Number.isFinite(new Date(n).getTime()))return fail();return n;}
 #evidence(raw:unknown,a:ProviderWireAttempt,pre:any){
  if(!recordV1(raw,['complete','attemptRecord','permitRecord'])||raw.complete!==true||Buffer.byteLength(canonicalJson(raw))>32768)return fail();const v=cloneV1(raw);
  for(const r of[v.attemptRecord,v.permitRecord]){if(!recordV1(r,['ref','snapshot'])||!refV1(r.ref)||r.ref.version!==1||r.ref.contentHash!==hash(r.snapshot)||!recordV1(r.snapshot,['sequence','key','envelopeHash','state','bindingHash','materialReceiptRef','instructionContentHash','grantRef','permitRef','responseFact','at','previousRef','reason']))fail();const s=r.snapshot;if(!Number.isSafeInteger(s.sequence)||s.sequence<1||!isoV1(s.at)||Date.parse(s.at)>this.#now()||s.reason!=='NONE'||s.responseFact!==null||!same(s.key,a.key)||s.envelopeHash!==a.envelopeHash||s.bindingHash!==a.bindingHash||!same(s.materialReceiptRef,pre.materialReceiptRef)||s.instructionContentHash!==a.instructionContentHash||!same(s.grantRef,pre.grantRef)||s.previousRef!==null&&!refV1(s.previousRef))fail();}
  const first=v.attemptRecord,last=v.permitRecord;if(!same(first.ref,a.localAttemptRef)||first.snapshot.state!=='SEND_ATTEMPTED'||first.snapshot.permitRef!==null||last.snapshot.state!=='PERMIT_RECORDED'||!same(last.snapshot.permitRef,a.permitRef)||last.snapshot.sequence!==first.snapshot.sequence+1||!same(last.snapshot.previousRef,first.ref)||Date.parse(last.snapshot.at)<Date.parse(first.snapshot.at))fail();return v;
 }
 async current(raw:Input,signal:AbortSignal,source?:SyntheticLockedProviderAttemptSource):Promise<unknown>{
  const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined,listener:(()=>void)|undefined;
  try{
   this.#ports(source);if(!source||!(signal instanceof AbortSignal)||signal.aborted)return fail();const input=cloneV1(raw),e=readDispatchEnvelopeV1(input.envelope,this.#now()),pre:any=input.preSendSnapshot;
   if(e.operation!=='SEND_INSTRUCTION'||!recordV1(pre,['transport','key','envelopeHash','sessionBindingRef','instructionRef','partsRef','materialReceiptRef','instructionContentHash','understandingReviewRef','grantRef','ownershipRef','threadId','turnState','checkedAt','expiresAt',...(Object.hasOwn(pre??{},'contextReviewFact')?['contextReviewFact']:[])])||pre.transport!=='SYNTHETIC_ONLY'||pre.turnState!=='IDLE'||!same(pre.key,receiptKeyV1(e))||pre.envelopeHash!==e.envelopeHash||!same(pre.sessionBindingRef,e.payload.sessionBindingRef)||!same(pre.instructionRef,e.payload.instructionRef)||!same(pre.partsRef,e.payload.partsRef)||!refV1(pre.materialReceiptRef)||!refV1(pre.grantRef)||!refV1(pre.ownershipRef)||!hashV1(pre.instructionContentHash)||!hashV1(input.preSendBindingHash)||![input.attemptRef,input.permitRef,input.responseRef,input.parentThreadClaimRef].every(refV1)||!isoV1(pre.checkedAt)||!isoV1(pre.expiresAt))return fail();
   const{checkedAt:_,expiresAt:__,...binding}=pre;if(Object.hasOwn(binding,'contextReviewFact')){const{checkedAt:___,...stable}=binding.contextReviewFact;binding.contextReviewFact=stable;}if(hash(binding)!==input.preSendBindingHash)fail();
   const attempt:ProviderWireAttempt={key:receiptKeyV1(e),envelopeHash:e.envelopeHash,localAttemptRef:cloneV1(input.attemptRef),permitRef:cloneV1(input.permitRef),instructionContentHash:pre.instructionContentHash,bindingHash:input.preSendBindingHash},deadline=Math.min(this.#now()+this.#timeout,Date.parse(e.expiresAt),Date.parse(pre.expiresAt));let currentDeadline=deadline;
   const guard=()=>{this.#ports(source);if(signal.aborted||controller.signal.aborted||this.#now()>=Math.min(deadline,currentDeadline))fail();};guard();
   const cancelled=new Promise<never>((_,reject)=>{listener=()=>{controller.abort();reject(Error('SENT_TURN_POST_CURRENT_UNAVAILABLE'));};signal.addEventListener('abort',listener,{once:true});timer=setTimeout(listener,Math.max(1,deadline-this.#now()));});
   const work=async()=>{
    const before=this.#evidence(await source.readLocked(cloneV1(attempt)),attempt,pre);guard();
    const current=cloneV1(await this.#current.readCurrent(cloneV1(input),controller.signal));guard();
    if(!recordV1(current,Object.keys(pre))||!['IDLE','IN_PROGRESS'].includes(current.turnState)||!isoV1(current.checkedAt)||!isoV1(current.expiresAt)||Date.parse(current.checkedAt)>this.#now()||this.#now()-Date.parse(current.checkedAt)>30000||Date.parse(current.expiresAt)>Date.parse(current.checkedAt)+30000)return fail();
    for(const k of Object.keys(pre))if(!['checkedAt','expiresAt','turnState','contextReviewFact'].includes(k)&&!same(current[k],pre[k]))fail();
    if(Object.hasOwn(pre,'contextReviewFact')){const{checkedAt:a,...now}=current.contextReviewFact,{checkedAt:b,...prior}=pre.contextReviewFact;if(!isoV1(a)||Date.parse(a)>this.#now()||this.#now()-Date.parse(a)>30000||!same(now,prior))fail();}
    currentDeadline=Date.parse(current.expiresAt);guard();const after=this.#evidence(await source.readLocked(cloneV1(attempt)),attempt,pre);guard();if(!same(before,after))fail();
    return{transport:'SYNTHETIC_ONLY',preSendBindingHash:input.preSendBindingHash,attemptRef:cloneV1(input.attemptRef),permitRef:cloneV1(input.permitRef),responseRef:cloneV1(input.responseRef),parentThreadClaimRef:cloneV1(input.parentThreadClaimRef),currentSnapshot:current};
   };
   const value=await Promise.race([work(),cancelled]);guard();return value;
  }catch{return fail();}finally{controller.abort();if(timer)clearTimeout(timer);if(listener&&signal instanceof AbortSignal)signal.removeEventListener('abort',listener);}
 }
}
