import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {readDispatchEnvelopeV1,type DispatchEnvelopeV1} from '../../../contracts/runtime/dispatch-envelope-v1.ts';
import {receiptKeyV1} from '../../../contracts/runtime/dispatch-receipt-v1.ts';
import {executionFactChecks,readServerExecutionFactV1} from '../../../contracts/runtime/server-execution-fact-v1.ts';
import {cloneV1,hashV1,isoV1,recordV1,refV1,type RuntimeRefV1} from '../../../contracts/runtime/validation-v1.ts';
import type {SyntheticSentTurnCurrentSource} from './sent-turn-post-current.ts';
type Input=Parameters<SyntheticSentTurnCurrentSource['readCurrent']>[0];
export interface SyntheticSentResponseServerSource{transport:'SYNTHETIC_ONLY';currentSentResponse(envelope:DispatchEnvelopeV1,parent:RuntimeRefV1,signal:AbortSignal):Promise<unknown>}
export interface SyntheticSentTurnPrivateCurrent{transport:'SYNTHETIC_ONLY';/** Independent private current read, never an echo of preSendSnapshot. Its provenance/OS authority is the provider's responsibility. */readCurrent(input:Input,signal:AbortSignal):Promise<unknown>}
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b),hash=(v:unknown)=>contentHash(canonicalJson(v));
function fail():never{throw Error('SENT_TURN_CURRENT_BINDING_UNAVAILABLE');}
/** Internal source-only composition. Structural equality never authenticates a port,
 * OS ownership, DB transaction, durable material, wire completion or actual Agent.
 * No HTTP/default registration, SEND admission, permit issuance or retry. */
export class SyntheticSentTurnCurrentBinding implements SyntheticSentTurnCurrentSource{
 readonly transport='SYNTHETIC_ONLY' as const;
 #server:SyntheticSentResponseServerSource;#local:SyntheticSentTurnPrivateCurrent;#clock:()=>number;#timeout:number;
 constructor(server:SyntheticSentResponseServerSource,local:SyntheticSentTurnPrivateCurrent,options:{clock:()=>number;timeoutMs:number}){
  this.#server=server;this.#local=local;this.#clock=options.clock;this.#timeout=options.timeoutMs;
  if(typeof this.#clock!=='function'||!Number.isSafeInteger(this.#timeout)||this.#timeout<1||this.#timeout>10000)fail();this.#ports();
 }
 #ports(){if(this.#server?.transport!=='SYNTHETIC_ONLY'||typeof this.#server.currentSentResponse!=='function'||this.#local?.transport!=='SYNTHETIC_ONLY'||typeof this.#local.readCurrent!=='function')fail();}
 #now(){const n=this.#clock();if(!Number.isSafeInteger(n)||!Number.isFinite(new Date(n).getTime()))return fail();return n;}
 #serverValue(value:unknown,i:Input,pre:any){
  const v=cloneV1(value),e=i.envelope;
  if(e.operation!=='SEND_INSTRUCTION')return fail();
  if(!recordV1(v,['purpose','executionAuthorized','dispatchPerformed','attemptRef','permitRef','attemptBinding','basis'])||v.purpose!=='SENT_RESPONSE_ONLY'||v.executionAuthorized!==false||v.dispatchPerformed!==false||!same(v.attemptRef,i.attemptRef)||!same(v.permitRef,i.permitRef)||!recordV1(v.attemptBinding,['instructionContentHash','bindingHash'])||v.attemptBinding.instructionContentHash!==pre.instructionContentHash||v.attemptBinding.bindingHash!==i.preSendBindingHash)return fail();
  const b=v.basis;if(!recordV1(b,['key','envelopeHash','claimRef','parentThreadClaimRef','fact','expiresAt','turnState','grantRef'])||!same(b.key,receiptKeyV1(e))||b.envelopeHash!==e.envelopeHash||!same(b.grantRef,pre.grantRef)||!same(b.claimRef,i.parentThreadClaimRef)||!same(b.parentThreadClaimRef,i.parentThreadClaimRef)||!['BUSY','IDLE'].includes(b.turnState)||!isoV1(b.expiresAt))return fail();
  const f=readServerExecutionFactV1(b.fact),c=e.context;
  if(f.projectId!==c.projectId||f.executionId!==c.executionId||f.executionGeneration!==c.executionGeneration||!same(f.agentSession.sessionRef,e.payload.sessionBindingRef)||!same(f.registration.ref,e.executorRegistrationRef)||f.intent.assignmentRef.id!==c.assignmentId||!same(f.intent.connectionRef,c.connectionRef)||!same(f.intent.environmentRef,c.environmentRef)||!same(f.intent.capabilityRef,c.capabilityRef)||!same(f.intent.sourceScopes,c.sourceScopes)||f.writerState!=='OWNED'||executionFactChecks.some(k=>k!=='understanding'&&f.checks[k].state!=='VERIFIED_CURRENT')||!f.checks.osFence.evidenceRefs.some(r=>same(r,pre.ownershipRef))||!same(f.understandingReviewRef,pre.understandingReviewRef))fail();
  if(f.intent.mode==='CONTEXT_REVIEW'){
   if(pre.understandingReviewRef!==null||f.checks.understanding.state!=='NOT_REQUIRED'||!Object.hasOwn(pre,'contextReviewFact')||f.intent.sourceScopes.some(s=>s.targets.some(t=>t.access!=='READ')))fail();
   const prior=readServerExecutionFactV1(pre.contextReviewFact),{checkedAt:_,...a}=prior,{checkedAt:__,...z}=f;if(!same(a,z))fail();
  }else if(!refV1(f.understandingReviewRef)||f.checks.understanding.state!=='VERIFIED_CURRENT'||Object.hasOwn(pre,'contextReviewFact'))fail();
  if(!isoV1(f.checkedAt)||Date.parse(f.checkedAt)>this.#now()||this.#now()-Date.parse(f.checkedAt)>30000)fail();
  const deadline=Math.min(Date.parse(b.expiresAt),Date.parse(f.checkedAt)+30000,...Object.values(f.expires).map(Date.parse));if(deadline<=this.#now())fail();
  return{value:v,deadline};
 }
 async readCurrent(raw:Input,signal:AbortSignal):Promise<unknown>{
  const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined,listener:(()=>void)|undefined;
  try{
   this.#ports();if(!(signal instanceof AbortSignal)||signal.aborted)return fail();const i=cloneV1(raw),e=readDispatchEnvelopeV1(i.envelope,this.#now()),pre:any=i.preSendSnapshot;
   if(e.operation!=='SEND_INSTRUCTION'||!recordV1(pre,['transport','key','envelopeHash','sessionBindingRef','instructionRef','partsRef','materialReceiptRef','instructionContentHash','understandingReviewRef','grantRef','ownershipRef','threadId','turnState','checkedAt','expiresAt',...(Object.hasOwn(pre??{},'contextReviewFact')?['contextReviewFact']:[])])||pre.transport!=='SYNTHETIC_ONLY'||pre.turnState!=='IDLE'||!same(pre.key,receiptKeyV1(e))||pre.envelopeHash!==e.envelopeHash||!same(pre.sessionBindingRef,e.payload.sessionBindingRef)||!same(pre.instructionRef,e.payload.instructionRef)||!same(pre.partsRef,e.payload.partsRef)||![pre.materialReceiptRef,pre.grantRef,pre.ownershipRef,i.parentThreadClaimRef,i.attemptRef,i.permitRef,i.responseRef].every(refV1)||!hashV1(pre.instructionContentHash)||!hashV1(i.preSendBindingHash)||typeof pre.threadId!=='string'||!/^[A-Za-z0-9._:-]{1,512}$/.test(pre.threadId)||!isoV1(pre.checkedAt)||!isoV1(pre.expiresAt))return fail();
   const{checkedAt:_,expiresAt:__,...binding}=pre;if(Object.hasOwn(binding,'contextReviewFact')){const{checkedAt:___,...stable}=binding.contextReviewFact;binding.contextReviewFact=stable;}if(hash(binding)!==i.preSendBindingHash)fail();
   let end=Math.min(this.#now()+this.#timeout,Date.parse(e.expiresAt),Date.parse(pre.expiresAt));
   const guard=()=>{this.#ports();if(signal.aborted||controller.signal.aborted||this.#now()>=end)fail();};guard();
   const cancelled=new Promise<never>((_,reject)=>{listener=()=>{controller.abort();reject(Error('SENT_TURN_CURRENT_BINDING_UNAVAILABLE'));};signal.addEventListener('abort',listener,{once:true});timer=setTimeout(listener,Math.max(1,end-this.#now()));});
   const work=async()=>{
    const first=this.#serverValue(await this.#server.currentSentResponse(cloneV1(e),cloneV1(i.parentThreadClaimRef),controller.signal),i,pre);end=Math.min(end,first.deadline);guard();
    const current=cloneV1(await this.#local.readCurrent(cloneV1(i),controller.signal));guard();
    if(!recordV1(current,Object.keys(pre))||!isoV1(current.checkedAt)||!isoV1(current.expiresAt)||Date.parse(current.checkedAt)>this.#now()||this.#now()-Date.parse(current.checkedAt)>30000||Date.parse(current.expiresAt)>Date.parse(current.checkedAt)+30000||current.turnState!==(first.value.basis.turnState==='BUSY'?'IN_PROGRESS':'IDLE'))return fail();
    for(const k of Object.keys(pre))if(!['checkedAt','expiresAt','turnState','contextReviewFact'].includes(k)&&!same(current[k],pre[k]))fail();
    if(Object.hasOwn(pre,'contextReviewFact')){const{checkedAt:_,...a}=readServerExecutionFactV1(current.contextReviewFact),{checkedAt:__,...b}=readServerExecutionFactV1(first.value.basis.fact);if(!same(a,b))fail();}
    end=Math.min(end,Date.parse(current.expiresAt),Date.parse(current.checkedAt)+30000);guard();
    const last=this.#serverValue(await this.#server.currentSentResponse(cloneV1(e),cloneV1(i.parentThreadClaimRef),controller.signal),i,pre);guard();
    const stable=(v:any)=>{const b=cloneV1(v.basis),{checkedAt:_,...fact}=b.fact;delete b.expiresAt;b.fact=fact;return{...v,basis:b};};if(!same(stable(first.value),stable(last.value)))fail();end=Math.min(end,last.deadline);guard();
    return{...current,expiresAt:new Date(end).toISOString(),...(Object.hasOwn(pre,'contextReviewFact')?{contextReviewFact:cloneV1(last.value.basis.fact)}:{})};
   };
   const result=await Promise.race([work(),cancelled]);guard();return result;
  }catch{return fail();}finally{controller.abort();if(timer)clearTimeout(timer);if(listener&&signal instanceof AbortSignal)signal.removeEventListener('abort',listener);}
 }
}
