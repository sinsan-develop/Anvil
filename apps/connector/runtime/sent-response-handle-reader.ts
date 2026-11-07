import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {readDispatchEnvelopeV1} from '../../../contracts/runtime/dispatch-envelope-v1.ts';
import {receiptKeyV1} from '../../../contracts/runtime/dispatch-receipt-v1.ts';
import {validateProviderSessionClaim,verifyProviderHandleBinding} from '../../../contracts/runtime/provider-session-claim-v1.ts';
import {executionFactChecks,readServerExecutionFactV1} from '../../../contracts/runtime/server-execution-fact-v1.ts';
import {cloneV1,hashV1,isoV1,recordV1,refV1,type RuntimeRefV1} from '../../../contracts/runtime/validation-v1.ts';
import type {SyntheticProtectedProviderStore} from '../adapters/primary/provider-handle-reader.ts';
import type {SyntheticSentResponseServerSource} from './sent-turn-current-binding.ts';
import {decodeProviderHandleCapsule} from './provider-handle-capsule.ts';
type Selection={envelope:unknown;claim:unknown;claimRef:RuntimeRefV1;attemptRef:RuntimeRefV1;permitRef:RuntimeRefV1;grantRef:RuntimeRefV1;preSendBindingHash:string;instructionContentHash:string};
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b),hash=(v:unknown)=>contentHash(canonicalJson(v));
function fail():never{throw Error('SENT_RESPONSE_HANDLE_UNAVAILABLE');}
/** Separate sent-response THREAD read. Never implements the pre-send current/reader
 * port and never authorizes wire/SEND/STOP. Raw identifiers stay in the private
 * callback; byte ownership/zeroing does not guarantee JS string/GC erasure.
 * Real protected store, OS identity and server authenticity remain provider duties. */
export class SyntheticSentResponseHandleReader{
 readonly transport='SYNTHETIC_ONLY' as const;
 #current:SyntheticSentResponseServerSource;#store:SyntheticProtectedProviderStore;#clock:()=>number;#timeout:number;
 constructor(current:SyntheticSentResponseServerSource,store:SyntheticProtectedProviderStore,options:{clock:()=>number;timeoutMs:number}){
  this.#current=current;this.#store=store;this.#clock=options.clock;this.#timeout=options.timeoutMs;
  if(typeof this.#clock!=='function'||!Number.isSafeInteger(this.#timeout)||this.#timeout<1||this.#timeout>10000)fail();this.#ports();
 }
 #ports(){if(this.#current?.transport!=='SYNTHETIC_ONLY'||typeof this.#current.currentSentResponse!=='function'||this.#store?.transport!=='SYNTHETIC_ONLY'||typeof this.#store.read!=='function')fail();}
 #now(){const n=this.#clock();if(!Number.isSafeInteger(n)||!Number.isFinite(new Date(n).getTime()))return fail();return n;}
 async use(raw:Selection,signal:AbortSignal,consume:(handles:Readonly<{threadId:string;turnId:null}>,signal:AbortSignal)=>Promise<void>):Promise<void>{
  const abort=new AbortController(),buffers=new Set<Uint8Array>();let timer:ReturnType<typeof setTimeout>|undefined,listener:(()=>void)|undefined;
  try{
   this.#ports();if(!(signal instanceof AbortSignal)||signal.aborted||typeof consume!=='function'||!recordV1(raw,['envelope','claim','claimRef','attemptRef','permitRef','grantRef','preSendBindingHash','instructionContentHash']))return fail();
   const s=cloneV1(raw),e=readDispatchEnvelopeV1(s.envelope,this.#now()),checked=validateProviderSessionClaim(s.claim),c=checked.claim;
   if(e.operation!=='SEND_INSTRUCTION'||c.kind!=='THREAD'||c.parentThreadClaimRef!==null||!same(checked.ref,s.claimRef)||![s.attemptRef,s.permitRef,s.grantRef].every(refV1)||!hashV1(s.preSendBindingHash)||!hashV1(s.instructionContentHash)||c.projectId!==e.context.projectId||c.execution.id!==e.context.executionId||c.execution.generation!==e.context.executionGeneration||c.assignmentRef.id!==e.context.assignmentId||!same(c.agentSessionRef,e.payload.sessionBindingRef)||!same(c.connectionRef,e.context.connectionRef)||!same(c.environmentRef,e.context.environmentRef)||!same(c.executorRegistrationRef,e.executorRegistrationRef)||Date.parse(c.capturedAt)>this.#now())return fail();
   let end=Math.min(this.#now()+this.#timeout,Date.parse(e.expiresAt),Date.parse(c.usableBefore));
   const guard=()=>{this.#ports();if(signal.aborted||abort.signal.aborted||this.#now()>=end)fail();};guard();
   const cancelled=new Promise<never>((_,reject)=>{listener=()=>{abort.abort();reject(Error('SENT_RESPONSE_HANDLE_UNAVAILABLE'));};signal.addEventListener('abort',listener,{once:true});timer=setTimeout(listener,Math.max(1,end-this.#now()));});
   const current=async()=>{
    guard();const v=cloneV1(await this.#current.currentSentResponse(cloneV1(e),cloneV1(s.claimRef),abort.signal));guard();
    if(!recordV1(v,['purpose','executionAuthorized','dispatchPerformed','attemptRef','permitRef','attemptBinding','basis'])||v.purpose!=='SENT_RESPONSE_ONLY'||v.executionAuthorized!==false||v.dispatchPerformed!==false||!same(v.attemptRef,s.attemptRef)||!same(v.permitRef,s.permitRef)||!recordV1(v.attemptBinding,['instructionContentHash','bindingHash'])||v.attemptBinding.instructionContentHash!==s.instructionContentHash||v.attemptBinding.bindingHash!==s.preSendBindingHash)return fail();
    const b=v.basis;if(!recordV1(b,['key','envelopeHash','claimRef','parentThreadClaimRef','fact','expiresAt','turnState','grantRef'])||!same(b.key,receiptKeyV1(e))||b.envelopeHash!==e.envelopeHash||!same(b.claimRef,s.claimRef)||!same(b.parentThreadClaimRef,s.claimRef)||!same(b.grantRef,s.grantRef)||!['BUSY','IDLE'].includes(b.turnState)||!isoV1(b.expiresAt))return fail();
    const f=readServerExecutionFactV1(b.fact),i=f.intent;
    if(f.projectId!==c.projectId||f.executionId!==c.execution.id||f.executionGeneration!==c.execution.generation||f.writerState!=='OWNED'||!same(f.agentSession.sessionRef,c.agentSessionRef)||!same(f.agentSession.roleBindingRef,c.responsibleBindingRef)||!same(f.registration.ref,c.executorRegistrationRef)||!same(i.assignmentRef,c.assignmentRef)||!same(i.connectionRef,c.connectionRef)||!same(i.environmentRef,c.environmentRef)||!same(i.capabilityRef,e.context.capabilityRef)||!same(i.sourceScopes,e.context.sourceScopes)||executionFactChecks.some(k=>k!=='understanding'&&f.checks[k].state!=='VERIFIED_CURRENT')||i.mode==='WORK'&&(f.understandingReviewRef===null||f.checks.understanding.state!=='VERIFIED_CURRENT')||i.mode==='CONTEXT_REVIEW'&&(f.understandingReviewRef!==null||f.checks.understanding.state!=='NOT_REQUIRED'||i.sourceScopes.some(x=>x.targets.some(t=>t.access!=='READ')))||Date.parse(f.checkedAt)>this.#now()||this.#now()-Date.parse(f.checkedAt)>30000)fail();
    end=Math.min(end,Date.parse(b.expiresAt),Date.parse(f.checkedAt)+30000,...Object.values(f.expires).map(Date.parse));guard();
    const{checkedAt:_,...fact}=f,{expiresAt:__,...basis}=b;return hash({...v,basis:{...basis,fact}});
   };
   const work=async()=>{
    const before=await current();guard();const value=await this.#store.read(cloneV1(c),abort.signal);
    const bytes=value&&typeof value==='object'?Object.getOwnPropertyDescriptor(value,'plaintext')?.value:undefined;
    if(bytes instanceof Uint8Array){buffers.add(bytes);if(signal.aborted||abort.signal.aborted){bytes.fill(0);return fail();}}
    guard();if(!recordV1(value,['ciphertextHash','plaintext'])||!hashV1(value.ciphertextHash)||!(bytes instanceof Uint8Array)||bytes.byteLength<1||bytes.byteLength>4096)return fail();
    verifyProviderHandleBinding(c,value.ciphertextHash);const{protectedHandleRef:_,...binding}=c,handles=decodeProviderHandleCapsule(bytes,binding);if(handles.turnId!==null)fail();
    const after=await current();guard();if(before!==after)fail();
    const result=await consume(Object.freeze({threadId:handles.threadId,turnId:null}),abort.signal);guard();if(result!==undefined)fail();
   };
   await Promise.race([work(),cancelled]);guard();
  }catch{return fail();}finally{abort.abort();if(timer)clearTimeout(timer);if(listener&&signal instanceof AbortSignal)signal.removeEventListener('abort',listener);for(const b of buffers)b.fill(0);}
 }
}
