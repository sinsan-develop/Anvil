import {canonicalJson} from '../../../contracts/canonical.ts';
import {readDispatchEnvelopeV1} from '../../../contracts/runtime/dispatch-envelope-v1.ts';
import {providerProtectedHandleRef,validateProviderSessionClaim,type ProviderBindingInput} from '../../../contracts/runtime/provider-session-claim-v1.ts';
import {cloneV1,recordV1} from '../../../contracts/runtime/validation-v1.ts';
import {Codex0161Codec,type ProtectedSessionCapture} from '../adapters/primary/codec.ts';
import type {SyntheticPrimaryStartResponseBarrier} from '../adapters/primary/start-transport.ts';
import {SyntheticProviderCapturePreparation,type SyntheticProviderCapturePreparationStore} from './provider-capture-preparation.ts';
import {SyntheticProviderHandleProtocolCapture} from './provider-handle-protocol-capture.ts';
import type {SyntheticProviderHandleBytePipe} from './provider-handle-protocol-store.ts';
type Input=Parameters<SyntheticPrimaryStartResponseBarrier['complete']>[0];
type Metadata=Awaited<ReturnType<SyntheticProviderHandleProtocolCapture['capturePrepared']>>;
export interface SyntheticStartCaptureBasis{transport:'SYNTHETIC_ONLY';prepare(input:Input,signal:AbortSignal):Promise<unknown>}
export interface SyntheticStartCaptureReceiptStore{transport:'SYNTHETIC_ONLY';appendAndSync(value:Metadata,signal:AbortSignal):Promise<unknown>}
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const fail=():never=>{throw Error('START_PROTECTED_CAPTURE_UNAVAILABLE');};
/** Explicit source-only bridge. Synchronous RECORDED means only private memory
 * capture; the asynchronous barrier separately prepares, protects, and records.
 * No default registration/native process/file/credential/Agent is created.
 * Injected stores/pipe are synthetic claims, never proof of durability or OS
 * protection. JS strings cannot promise physical erasure or GC timing. */
export class SyntheticStartProtectedCaptureBridge implements SyntheticPrimaryStartResponseBarrier{
 readonly transport='SYNTHETIC_ONLY' as const;
 #codec:Codex0161Codec;#basis:SyntheticStartCaptureBasis;#receipts:SyntheticStartCaptureReceiptStore;
 #prepared:SyntheticProviderCapturePreparation;#capture:SyntheticProviderHandleProtocolCapture;
 #clock:()=>number;#timeout:number;#kind:'THREAD'|'TURN';#pending:Readonly<ProtectedSessionCapture>|null=null;#used=false;#expiry:ReturnType<typeof setTimeout>|undefined;
 get codec(){return this.#codec;}
 constructor(ports:{basis:SyntheticStartCaptureBasis;preparationStore:SyntheticProviderCapturePreparationStore;pipe:SyntheticProviderHandleBytePipe;receipts:SyntheticStartCaptureReceiptStore},options:{clock:()=>number;timeoutMs:number;maxFrameBytes:number;captureKind?:'THREAD'|'TURN'}){
  this.#basis=ports.basis;this.#receipts=ports.receipts;this.#clock=options.clock;this.#timeout=options.timeoutMs;this.#kind=options.captureKind===undefined?'THREAD':options.captureKind;
  if(!['THREAD','TURN'].includes(this.#kind)||typeof this.#clock!=='function'||!Number.isSafeInteger(this.#timeout)||this.#timeout<1||this.#timeout>10000)fail();this.#ports();
  this.#prepared=new SyntheticProviderCapturePreparation(ports.preparationStore,options);
  this.#capture=new SyntheticProviderHandleProtocolCapture(this.#prepared,ports.pipe,options);
  this.#codec=new Codex0161Codec({maxFrameBytes:options.maxFrameBytes,maxPending:1},{capture:(value)=>{
   if(this.#used||this.#pending||value.method!==(this.#kind==='THREAD'?'thread/start':'turn/start')||(this.#kind==='THREAD'?value.turnId!==null:value.turnId===null))throw Error('START_PROTECTED_CAPTURE_UNAVAILABLE');
   this.#pending=cloneV1(value);this.#expiry=setTimeout(()=>{this.#pending=null;this.#used=true;},this.#timeout);this.#expiry.unref();return 'RECORDED';
  }});
 }
 #ports(){if(this.#basis?.transport!=='SYNTHETIC_ONLY'||typeof this.#basis.prepare!=='function'||this.#receipts?.transport!=='SYNTHETIC_ONLY'||typeof this.#receipts.appendAndSync!=='function')fail();}
 #now(){const n=this.#clock();if(!Number.isSafeInteger(n)||!Number.isFinite(new Date(n).getTime()))return fail();return n;}
 async complete(raw:Input,signal:AbortSignal):Promise<unknown>{
  let timer:ReturnType<typeof setTimeout>|undefined,listener:(()=>void)|undefined;const controller=new AbortController();
  try{
   this.#ports();if(this.#used||!this.#pending||!(signal instanceof AbortSignal)||signal.aborted)return fail();this.#used=true;
   const capture=this.#pending;this.#pending=null;if(this.#expiry)clearTimeout(this.#expiry);
   const input=cloneV1(raw),e=readDispatchEnvelopeV1(input.envelope,this.#now());if(e.operation!==(this.#kind==='THREAD'?'START_SESSION':'SEND_INSTRUCTION')||capture.method!==(this.#kind==='THREAD'?'thread/start':'turn/start')||input.fact.kind!=='RPC_RESPONSE'||input.fact.method!==capture.method||input.fact.requestIdDigest!==capture.requestIdDigest||input.fact.payloadDigest!==capture.payloadDigest)fail();
   let deadline=Math.min(Date.parse(e.expiresAt),this.#now()+this.#timeout);
   const guard=()=>{this.#ports();if(signal.aborted||controller.signal.aborted||this.#now()>=deadline)fail();};guard();
   const cancelled=new Promise<never>((_,reject)=>{listener=()=>{controller.abort();reject(Error('START_PROTECTED_CAPTURE_UNAVAILABLE'));};signal.addEventListener('abort',listener,{once:true});timer=setTimeout(listener,Math.max(1,deadline-this.#now()));});
   const work=async()=>{
    const basis=cloneV1(await this.#basis.prepare(cloneV1(input),controller.signal));guard();
    if(!recordV1(basis,['bindingInput','parent'])||(this.#kind==='THREAD'?basis.parent!==null:basis.parent===null))return fail();const b=basis.bindingInput as ProviderBindingInput,parent=basis.parent===null?null:validateProviderSessionClaim(basis.parent).claim;
    validateProviderSessionClaim({...b,protectedHandleRef:providerProtectedHandleRef(b,'0'.repeat(64))},parent??undefined);
    if(b.kind!==this.#kind||b.projectId!==e.context.projectId||b.execution.id!==e.context.executionId||b.execution.generation!==e.context.executionGeneration||b.assignmentRef.id!==e.context.assignmentId||b.commandId!==e.commandId||b.envelopeHash!==e.envelopeHash||!same(b.executorRegistrationRef,e.executorRegistrationRef)||!same(b.connectionRef,e.context.connectionRef)||!same(b.environmentRef,e.context.environmentRef)||!same(b.authorizationReceiptRef,e.context.authorizationReceiptRef)||!same(b.localAttemptRef,input.attemptRef)||!same(b.permitRef,input.permitRef)||!same(b.source.responseRef,input.responseRef)||b.source.method!==capture.method||b.source.requestIdDigest!==capture.requestIdDigest||b.source.responsePayloadDigest!==capture.payloadDigest||Date.parse(b.capturedAt)<Date.parse(e.issuedAt))fail();
    if(e.operation==='SEND_INSTRUCTION'&&!same(b.agentSessionRef,e.payload.sessionBindingRef))fail();
    deadline=Math.min(deadline,Date.parse(b.usableBefore));guard();await this.#prepared.prepare(b,parent,controller.signal);guard();
    const metadata=await this.#capture.capturePrepared(b,capture,controller.signal);guard();
    const receipt=cloneV1(await this.#receipts.appendAndSync(cloneV1(metadata),controller.signal));guard();
    if(!recordV1(receipt,['complete','claimRef','ciphertextHash'])||receipt.complete!==true||!same(receipt.claimRef,metadata.claimRef)||receipt.ciphertextHash!==metadata.ciphertextHash)fail();
    return{state:'PROTECTED_PROVIDER_CLAIM_RECORDED',...metadata,...(this.#kind==='TURN'?{parent}: {})};
   };
   const value=await Promise.race([work(),cancelled]);guard();return value;
  }catch{return fail();}finally{this.#used=true;this.#pending=null;if(this.#expiry)clearTimeout(this.#expiry);controller.abort();if(timer)clearTimeout(timer);if(listener&&signal instanceof AbortSignal)signal.removeEventListener('abort',listener);}
 }
}
