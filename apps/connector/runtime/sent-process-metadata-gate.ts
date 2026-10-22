import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {readDispatchEnvelopeV1} from '../../../contracts/runtime/dispatch-envelope-v1.ts';
import {receiptKeyV1} from '../../../contracts/runtime/dispatch-receipt-v1.ts';
import {readServerExecutionFactV1} from '../../../contracts/runtime/server-execution-fact-v1.ts';
import {cloneV1,hashV1,isoV1,recordV1,refV1} from '../../../contracts/runtime/validation-v1.ts';
import {SyntheticSentProcessEvidence} from './sent-process-evidence.ts';
import type {SyntheticSentTurnCurrentMetadata} from './sent-turn-protected-current.ts';
type Input=Parameters<SyntheticSentTurnCurrentMetadata['readCurrent']>[0];
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
function fail():never {throw Error('SENT_PROCESS_METADATA_UNAVAILABLE');}
/** Additional response-only read condition, NOT a current authority resolver.
 * The independent metadata provider remains required; no pre snapshot fallback,
 * fact/check/OWNED injection, WRITE permission, new SEND or default registration.
 * Outer protected THREAD/material/server-current/original-lock checks still apply. */
export class SyntheticSentProcessMetadataGate implements SyntheticSentTurnCurrentMetadata {
 readonly transport='SYNTHETIC_ONLY' as const;
 #evidence:SyntheticSentProcessEvidence;#metadata:SyntheticSentTurnCurrentMetadata;#clock:()=>number;#timeout:number;#used=false;
 constructor(evidence:SyntheticSentProcessEvidence,metadata:SyntheticSentTurnCurrentMetadata,options:{clock:()=>number;timeoutMs:number}) {
  this.#evidence=evidence;this.#metadata=metadata;this.#clock=options.clock;this.#timeout=options.timeoutMs;
  if(typeof this.#clock!=='function'||!Number.isSafeInteger(this.#timeout)||this.#timeout<1||this.#timeout>10000)fail();this.#ports();
 }
 #ports() {if(!(this.#evidence instanceof SyntheticSentProcessEvidence)||this.#evidence.transport!=='SYNTHETIC_ONLY'||typeof this.#evidence.read!=='function'||this.#metadata?.transport!=='SYNTHETIC_ONLY'||typeof this.#metadata.readCurrent!=='function')fail();}
 #now() {const n=this.#clock();if(!Number.isSafeInteger(n)||!Number.isFinite(new Date(n).getTime()))return fail();return n;}
 async readCurrent(raw:Input,signal:AbortSignal):Promise<unknown> {
  if(this.#used)fail();this.#used=true;
  const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined,listener:(()=>void)|undefined;
  try {
   this.#ports();if(!(signal instanceof AbortSignal)||signal.aborted)return fail();const input=cloneV1(raw),started=this.#now(),e=readDispatchEnvelopeV1(input.envelope,started),pre:any=input.preSendSnapshot;
   if(e.operation!=='SEND_INSTRUCTION'||!recordV1(pre,['transport','key','envelopeHash','sessionBindingRef','instructionRef','partsRef','materialReceiptRef','instructionContentHash','understandingReviewRef','grantRef','ownershipRef','threadId','turnState','checkedAt','expiresAt',...(Object.hasOwn(pre??{},'contextReviewFact')?['contextReviewFact']:[])])||pre.transport!=='SYNTHETIC_ONLY'||pre.turnState!=='IDLE'||!same(pre.key,receiptKeyV1(e))||pre.envelopeHash!==e.envelopeHash||!same(pre.sessionBindingRef,e.payload.sessionBindingRef)||!same(pre.instructionRef,e.payload.instructionRef)||!same(pre.partsRef,e.payload.partsRef)||![pre.materialReceiptRef,pre.grantRef,pre.ownershipRef,input.parentThreadClaimRef,input.attemptRef,input.permitRef,input.responseRef].every(refV1)||!hashV1(pre.instructionContentHash)||!hashV1(input.preSendBindingHash)||typeof pre.threadId!=='string'||!/^[A-Za-z0-9._:-]{1,512}$/.test(pre.threadId)||!isoV1(pre.checkedAt)||!isoV1(pre.expiresAt)||Date.parse(pre.checkedAt)>started)return fail();
   const{checkedAt:_,expiresAt:__,...binding}=pre;
   if(Object.hasOwn(binding,'contextReviewFact')){const{checkedAt:___,...stable}=readServerExecutionFactV1(binding.contextReviewFact);binding.contextReviewFact=stable;}
   if(contentHash(canonicalJson(binding))!==input.preSendBindingHash)fail();
   let end=Math.min(started+this.#timeout,Date.parse(e.expiresAt),Date.parse(pre.expiresAt));
   const guard=()=>{this.#ports();const now=this.#now();if(signal.aborted||controller.signal.aborted||now<started||now>=end)fail();};guard();
   const cancelled=new Promise<never>((_,reject)=>{listener=()=>{controller.abort();reject(Error('SENT_PROCESS_METADATA_UNAVAILABLE'));};signal.addEventListener('abort',listener,{once:true});timer=setTimeout(listener,Math.max(1,end-started));});
   const work=async()=>{
    const evidence=cloneV1(await this.#evidence.read({envelope:cloneV1(e),parentThreadClaimRef:cloneV1(input.parentThreadClaimRef),attemptRef:cloneV1(input.attemptRef),permitRef:cloneV1(input.permitRef),ownershipEvidenceRef:cloneV1(pre.ownershipRef),instructionContentHash:pre.instructionContentHash,preSendBindingHash:input.preSendBindingHash},controller.signal));guard();
    if(!recordV1(evidence,['purpose','transport','state','ownershipEvidenceRef','bindingRef','requestRef','processRef','observedAt','expiresAt','fileSandboxVerified','currentAuthorityVerified','writerReleaseVerified','executionAuthorized','dispatchPerformed'])||evidence.purpose!=='SENT_RESPONSE_PROCESS_EVIDENCE_ONLY'||evidence.transport!=='SYNTHETIC_ONLY'||evidence.state!=='SYNTHETIC_MATCHED'||!same(evidence.ownershipEvidenceRef,pre.ownershipRef)||!refV1(evidence.bindingRef)||!refV1(evidence.requestRef)||[evidence.fileSandboxVerified,evidence.currentAuthorityVerified,evidence.writerReleaseVerified,evidence.executionAuthorized,evidence.dispatchPerformed].some(v=>v!==false)||!isoV1(evidence.observedAt)||!isoV1(evidence.expiresAt)||Date.parse(evidence.observedAt)<started||Date.parse(evidence.observedAt)>this.#now()||Date.parse(evidence.expiresAt)>Date.parse(evidence.observedAt)+30000)return fail();
    end=Math.min(end,Date.parse(evidence.expiresAt));guard();
    const metadata=cloneV1(await this.#metadata.readCurrent(cloneV1(input),controller.signal));guard();
    if(!recordV1(metadata,Object.keys(pre).filter(k=>k!=='threadId'))||!['IDLE','IN_PROGRESS'].includes(metadata.turnState)||!isoV1(metadata.checkedAt)||!isoV1(metadata.expiresAt)||Date.parse(metadata.checkedAt)<Date.parse(evidence.observedAt)||Date.parse(metadata.checkedAt)>this.#now()||Date.parse(metadata.expiresAt)>Date.parse(metadata.checkedAt)+30000)return fail();
    for(const k of Object.keys(metadata))if(!['checkedAt','expiresAt','turnState','contextReviewFact'].includes(k)&&!same(metadata[k],pre[k]))fail();
    if(Object.hasOwn(pre,'contextReviewFact')){const{checkedAt:at,...a}=readServerExecutionFactV1(metadata.contextReviewFact),{checkedAt:___,...b}=readServerExecutionFactV1(pre.contextReviewFact);if(Date.parse(at)<Date.parse(evidence.observedAt)||Date.parse(at)>this.#now()||!same(a,b))fail();}
    end=Math.min(end,Date.parse(metadata.expiresAt),Date.parse(metadata.checkedAt)+30000);guard();
    return{...metadata,expiresAt:new Date(end).toISOString()};
   };
   const result=await Promise.race([work(),cancelled]);guard();return result;
  } catch {return fail();} finally {controller.abort();if(timer)clearTimeout(timer);if(listener&&signal instanceof AbortSignal)signal.removeEventListener('abort',listener);}
 }
}
