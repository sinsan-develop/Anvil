import {randomUUID} from 'node:crypto';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {readDispatchEnvelopeV1,type DispatchEnvelopeV1} from '../../../contracts/runtime/dispatch-envelope-v1.ts';
import {receiptKeyV1} from '../../../contracts/runtime/dispatch-receipt-v1.ts';
import {readServerExecutionFactV1} from '../../../contracts/runtime/server-execution-fact-v1.ts';
import {arrayV1,cloneV1,hashV1,isoV1,recordV1,refV1,uuidV1,type RuntimeRefV1} from '../../../contracts/runtime/validation-v1.ts';
import type {OwnedProcessRef} from './windows-host.ts';
import type {SyntheticSentResponseServerSource} from './sent-turn-current-binding.ts';

export interface SentProcessSelection {
 envelope:DispatchEnvelopeV1;parentThreadClaimRef:RuntimeRefV1;attemptRef:RuntimeRefV1;permitRef:RuntimeRefV1;
 ownershipEvidenceRef:RuntimeRefV1;instructionContentHash:string;preSendBindingHash:string;
}
/** Ports only: authenticated archive/head/revocation and native OBSERVE providers
 * do not yet exist. Never implement them by echoing this selection/archive. */
export interface SyntheticSentProcessArchive {
 transport:'SYNTHETIC_ONLY';readCurrent(selection:SentProcessSelection,signal:AbortSignal):Promise<unknown>;
}
export interface SyntheticSentProcessObserver {
 transport:'SYNTHETIC_ONLY';observe(request:{ref:RuntimeRefV1;snapshot:Record<string,unknown>},signal:AbortSignal):Promise<unknown>;
}
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const hash=(v:unknown)=>contentHash(canonicalJson(v));
const positive=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>0;
function fail():never {throw Error('SENT_PROCESS_EVIDENCE_UNAVAILABLE');}
function processRef(v:unknown):v is OwnedProcessRef {
 return recordV1(v,['runId','generation','jobId','pid','startTicks','executableHash'])&&uuidV1(v.runId)&&positive(v.generation)&&uuidV1(v.jobId)&&positive(v.pid)&&typeof v.startTicks==='string'&&/^[1-9][0-9]{16,19}$/.test(v.startTicks)&&hashV1(v.executableHash);
}
/** Response-purpose evidence only. No native calls, persistence, writer release,
 * file/source authority, SEND admission, default registration or automatic retry.
 * A structurally valid injected port is not an authenticated OS provider. */
export class SyntheticSentProcessEvidence {
 readonly transport='SYNTHETIC_ONLY' as const;
 #server:SyntheticSentResponseServerSource;#archive:SyntheticSentProcessArchive;#observer:SyntheticSentProcessObserver;
 #clock:()=>number;#timeout:number;#used=false;
 constructor(server:SyntheticSentResponseServerSource,archive:SyntheticSentProcessArchive,observer:SyntheticSentProcessObserver,options:{clock:()=>number;timeoutMs:number}) {
  this.#server=server;this.#archive=archive;this.#observer=observer;this.#clock=options.clock;this.#timeout=options.timeoutMs;
  if(typeof this.#clock!=='function'||!Number.isSafeInteger(this.#timeout)||this.#timeout<1||this.#timeout>10000)fail();this.#ports();
 }
 #ports() {
  if(this.#server?.transport!=='SYNTHETIC_ONLY'||typeof this.#server.currentSentResponse!=='function'||this.#archive?.transport!=='SYNTHETIC_ONLY'||typeof this.#archive.readCurrent!=='function'||this.#observer?.transport!=='SYNTHETIC_ONLY'||typeof this.#observer.observe!=='function')fail();
 }
 #now() {const n=this.#clock();if(!Number.isSafeInteger(n)||!Number.isFinite(new Date(n).getTime()))return fail();return n;}
 #window(at:unknown,expires:unknown,notBefore:number,maxAge=30000) {
  const now=this.#now();if(!isoV1(at)||!isoV1(expires)||Date.parse(at)<notBefore||Date.parse(at)>now||now-Date.parse(at)>maxAge||Date.parse(expires)<=now||Date.parse(expires)<=Date.parse(at)||Date.parse(expires)>Date.parse(at)+maxAge)fail();
  return Date.parse(expires as string);
 }
 #serverValue(raw:unknown,i:SentProcessSelection) {
  const v=cloneV1(raw),e=i.envelope;if(e.operation!=='SEND_INSTRUCTION')return fail();
  if(!recordV1(v,['purpose','executionAuthorized','dispatchPerformed','attemptRef','permitRef','attemptBinding','basis'])||v.purpose!=='SENT_RESPONSE_ONLY'||v.executionAuthorized!==false||v.dispatchPerformed!==false||!same(v.attemptRef,i.attemptRef)||!same(v.permitRef,i.permitRef)||!recordV1(v.attemptBinding,['instructionContentHash','bindingHash'])||v.attemptBinding.instructionContentHash!==i.instructionContentHash||v.attemptBinding.bindingHash!==i.preSendBindingHash)return fail();
  const b=v.basis;if(!recordV1(b,['key','envelopeHash','claimRef','parentThreadClaimRef','fact','expiresAt','turnState','grantRef'])||!same(b.key,receiptKeyV1(e))||b.envelopeHash!==e.envelopeHash||!same(b.claimRef,i.parentThreadClaimRef)||!same(b.parentThreadClaimRef,i.parentThreadClaimRef)||!refV1(b.grantRef)||!['BUSY','IDLE'].includes(b.turnState)||!isoV1(b.expiresAt))return fail();
  const f=readServerExecutionFactV1(b.fact),c=e.context;
  if(f.projectId!==c.projectId||f.executionId!==c.executionId||f.executionGeneration!==c.executionGeneration||!same(f.agentSession.sessionRef,e.payload.sessionBindingRef)||!same(f.registration.ref,e.executorRegistrationRef)||f.intent.assignmentRef.id!==c.assignmentId||!same(f.intent.connectionRef,c.connectionRef)||!same(f.intent.environmentRef,c.environmentRef)||!same(f.intent.capabilityRef,c.capabilityRef)||!same(f.intent.sourceScopes,c.sourceScopes)||f.checks.osFence.state!=='VERIFIED_CURRENT'||!f.checks.osFence.evidenceRefs.some(r=>same(r,i.ownershipEvidenceRef)))return fail();
  const now=this.#now();if(Date.parse(f.checkedAt)>now||now-Date.parse(f.checkedAt)>30000)fail();
  const end=Math.min(Date.parse(b.expiresAt),Date.parse(f.checkedAt)+30000,...Object.values(f.expires).map(Date.parse));if(end<=now)fail();
  const scope={projectId:c.projectId,executionId:c.executionId,executionGeneration:c.executionGeneration,sessionBindingRef:e.payload.sessionBindingRef,roleBindingRef:f.agentSession.roleBindingRef,executorRegistrationRef:e.executorRegistrationRef};
  const stable=cloneV1(v);delete stable.basis.expiresAt;delete stable.basis.fact.checkedAt;
  return{scope,stable,end};
 }
 #record(raw:unknown,keys:string[]) {
  if(!recordV1(raw,['ref','snapshot'])||!refV1(raw.ref)||!recordV1(raw.snapshot,keys)||hash(raw.snapshot)!==raw.ref.contentHash)return fail();return raw;
 }
 #archiveValue(raw:unknown,i:SentProcessSelection,scope:unknown,started:number) {
  const v=cloneV1(raw);
  if(!recordV1(v,['anchor','binding','anchorHeadRef','bindingHeadRef','revoked','readAt','expiresAt'])||v.revoked!==false||!refV1(v.anchorHeadRef)||!refV1(v.bindingHeadRef))return fail();
  let end=this.#window(v.readAt,v.expiresAt,started);
  const a=this.#record(v.anchor,['schemaVersion','purpose','transport','scope','processRef','observerRef','recordedAt','expiresAt','state','fileSandboxVerified','executionAuthorized','dispatchPerformed']);
  const b=this.#record(v.binding,['schemaVersion','purpose','transport','ownershipEvidenceRef','scope','commandId','envelopeHash','parentThreadClaimRef','attemptRef','permitRef','instructionContentHash','preSendBindingHash','recordedAt','expiresAt']);
  const s=a.snapshot,t=b.snapshot;
  if(!same(a.ref,i.ownershipEvidenceRef)||!same(v.anchorHeadRef,a.ref)||!same(v.bindingHeadRef,b.ref)||s.schemaVersion!==1||s.purpose!=='PROCESS_OWNERSHIP_ANCHOR'||s.transport!=='SYNTHETIC_ONLY'||!same(s.scope,scope)||!processRef(s.processRef)||!refV1(s.observerRef)||s.state!=='BOUND'||s.fileSandboxVerified!==false||s.executionAuthorized!==false||s.dispatchPerformed!==false)return fail();
  if(t.schemaVersion!==1||t.purpose!=='SENT_PROCESS_BINDING'||t.transport!=='SYNTHETIC_ONLY'||!same(t.scope,scope)||!same(t.ownershipEvidenceRef,a.ref)||t.commandId!==i.envelope.commandId||t.envelopeHash!==i.envelope.envelopeHash||!same(t.parentThreadClaimRef,i.parentThreadClaimRef)||!same(t.attemptRef,i.attemptRef)||!same(t.permitRef,i.permitRef)||t.instructionContentHash!==i.instructionContentHash||t.preSendBindingHash!==i.preSendBindingHash)return fail();
  for(const r of [s,t])if(!isoV1(r.recordedAt)||!isoV1(r.expiresAt)||Date.parse(r.recordedAt)>this.#now()||Date.parse(r.expiresAt)<=this.#now()||Date.parse(r.expiresAt)<=Date.parse(r.recordedAt))fail();
  if(Date.parse(t.recordedAt)<Date.parse(s.recordedAt))fail();end=Math.min(end,Date.parse(s.expiresAt),Date.parse(t.expiresAt));
  return{anchor:a,binding:b,end};
 }
 #observation(raw:unknown,request:{ref:RuntimeRefV1;snapshot:Record<string,any>},owner:OwnedProcessRef) {
  const v=cloneV1(raw),r=request.snapshot;
  if(!recordV1(v,['requestRef','ownershipEvidenceRef','bindingRef','observerRef','observedAt','expiresAt','facts'])||!same(v.requestRef,request.ref)||!same(v.ownershipEvidenceRef,r.ownershipEvidenceRef)||!same(v.bindingRef,r.bindingRef)||!same(v.observerRef,r.observerRef))return fail();
  const end=this.#window(v.observedAt,v.expiresAt,Date.parse(r.requestedAt)),f=v.facts;
  if(!recordV1(f,['processRef','state','active','processes','killOnClose','fileSandboxVerified'])||!same(f.processRef,owner)||f.state!=='RUNNING'||f.killOnClose!==false||f.fileSandboxVerified!==false||!positive(f.active)||!arrayV1(f.processes,128)||f.active!==f.processes.length)return fail();
  const pids=new Set<number>();let root=false;
  for(const p of f.processes) {
   if(!recordV1(p,['pid','startTicks','inJob','executableHash'])||!positive(p.pid)||pids.has(p.pid)||typeof p.startTicks!=='string'||!/^[1-9][0-9]{16,19}$/.test(p.startTicks)||p.inJob!==true||p.executableHash!==owner.executableHash)return fail();
   pids.add(p.pid);if(p.pid===owner.pid){if(p.startTicks!==owner.startTicks)fail();root=true;}
  }
  if(!root)fail();return{observedAt:v.observedAt,end};
 }
 async read(raw:SentProcessSelection,signal:AbortSignal) {
  if(this.#used)fail();this.#used=true;
  const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined,listener:(()=>void)|undefined;
  try {
   this.#ports();if(!(signal instanceof AbortSignal)||signal.aborted)return fail();
   const i=cloneV1(raw),started=this.#now();
   if(!recordV1(i,['envelope','parentThreadClaimRef','attemptRef','permitRef','ownershipEvidenceRef','instructionContentHash','preSendBindingHash'])||![i.parentThreadClaimRef,i.attemptRef,i.permitRef,i.ownershipEvidenceRef].every(refV1)||!hashV1(i.instructionContentHash)||!hashV1(i.preSendBindingHash))return fail();
   i.envelope=readDispatchEnvelopeV1(i.envelope,started);if(i.envelope.operation!=='SEND_INSTRUCTION')fail();
   let end=Math.min(started+this.#timeout,Date.parse(i.envelope.expiresAt));
   const guard=()=>{this.#ports();if(signal.aborted||controller.signal.aborted||this.#now()>=end)fail();};guard();
   const cancelled=new Promise<never>((_,reject)=>{listener=()=>{controller.abort();reject(Error('SENT_PROCESS_EVIDENCE_UNAVAILABLE'));};signal.addEventListener('abort',listener,{once:true});timer=setTimeout(listener,Math.max(1,end-started));});
   const work=async()=>{
    const first=this.#serverValue(await this.#server.currentSentResponse(cloneV1(i.envelope),cloneV1(i.parentThreadClaimRef),controller.signal),i);end=Math.min(end,first.end);guard();
    const before=this.#archiveValue(await this.#archive.readCurrent(cloneV1(i),controller.signal),i,first.scope,started);end=Math.min(end,before.end);guard();
    const a=before.anchor,b=before.binding;
    const snapshot={schemaVersion:1,purpose:'OBSERVE_SENT_PROCESS',transport:'SYNTHETIC_ONLY',ownershipEvidenceRef:a.ref,bindingRef:b.ref,processRef:a.snapshot.processRef,observerRef:a.snapshot.observerRef,commandId:i.envelope.commandId,envelopeHash:i.envelope.envelopeHash,attemptRef:i.attemptRef,permitRef:i.permitRef,requestedAt:new Date(this.#now()).toISOString(),expiresAt:new Date(end).toISOString()};
    const request={ref:{id:randomUUID(),version:1,contentHash:hash(snapshot)},snapshot};
    const observed=this.#observation(await this.#observer.observe(cloneV1(request),controller.signal),request,a.snapshot.processRef);end=Math.min(end,observed.end);guard();
    const after=this.#archiveValue(await this.#archive.readCurrent(cloneV1(i),controller.signal),i,first.scope,started);end=Math.min(end,after.end);guard();
    if(!same(before.anchor,after.anchor)||!same(before.binding,after.binding))fail();
    const last=this.#serverValue(await this.#server.currentSentResponse(cloneV1(i.envelope),cloneV1(i.parentThreadClaimRef),controller.signal),i);end=Math.min(end,last.end);guard();if(!same(first.stable,last.stable))fail();
    return{purpose:'SENT_RESPONSE_PROCESS_EVIDENCE_ONLY' as const,transport:'SYNTHETIC_ONLY' as const,state:'SYNTHETIC_MATCHED' as const,ownershipEvidenceRef:cloneV1(a.ref) as RuntimeRefV1,bindingRef:cloneV1(b.ref) as RuntimeRefV1,requestRef:request.ref,processRef:cloneV1(a.snapshot.processRef) as OwnedProcessRef,observedAt:observed.observedAt as string,expiresAt:new Date(end).toISOString(),fileSandboxVerified:false as const,currentAuthorityVerified:false as const,writerReleaseVerified:false as const,executionAuthorized:false as const,dispatchPerformed:false as const};
   };
   const result=await Promise.race([work(),cancelled]);guard();return result;
  } catch {return fail();} finally {controller.abort();if(timer)clearTimeout(timer);if(listener&&signal instanceof AbortSignal)signal.removeEventListener('abort',listener);}
 }
}
