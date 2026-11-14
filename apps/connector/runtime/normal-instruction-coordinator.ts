import {randomUUID} from 'node:crypto';
import {isProxy} from 'node:util/types';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {readDispatchEnvelopeV1,type DispatchEnvelopeV1} from '../../../contracts/runtime/dispatch-envelope-v1.ts';
import {receiptKeyV1} from '../../../contracts/runtime/dispatch-receipt-v1.ts';
import {cloneV1,recordV1,refV1,isoV1,arrayV1,type RuntimeRefV1 as Ref} from '../../../contracts/runtime/validation-v1.ts';
import {NormalInstructionIntake,captureInstructionInput,type NormalInstructionStore} from './normal-instruction-intake.ts';
import {NormalProtectedPostClient,type NormalPermitResult} from './normal-protected-post-client.ts';
import type {NormalStartCurrent} from './normal-start-coordinator.ts';
export interface NormalInstructionPreparationResult{transport:'NORMAL_PROTECTED';state:'PERMIT_RECORDED'|'UNKNOWN';key:ReturnType<typeof receiptKeyV1>;envelopeHash:string;recordRef:Ref;permit:NormalPermitResult['permit']|null;proofResultRef:Ref|null;readOnly:true;executionAuthorized:false;dispatchPerformed:false}
type Send=Extract<DispatchEnvelopeV1,{operation:'SEND_INSTRUCTION'}>;
type Ports={intake:NormalInstructionIntake;store:NormalInstructionStore;post:NormalProtectedPostClient;current:NormalStartCurrent;grantRef:Ref;clock:()=>number;timeoutMs:number};
const originalRead=NormalInstructionIntake.prototype.instruction,originalPrepare=NormalProtectedPostClient.prototype.preparePermit,originalSend=NormalProtectedPostClient.prototype.send;
const hash=(v:unknown)=>contentHash(canonicalJson(v)),same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
function fail(code='NORMAL_INSTRUCTION_ATTEMPT_INVALID'):never{throw Error(code);}
/** SEND 내구 시도와 허가 기록만 연결한다. wire/SDK/관측 성공/cursor 확정 권한은 없다. */
export class NormalInstructionCoordinator{
 #p:Ports;#current:NormalStartCurrent['current'];#exclusive:NormalInstructionStore['exclusive'];#last=-Infinity;#busy=false;#unknown=false;
 constructor(p:Ports){
  if(!p||isProxy(p)||!recordV1(p,['intake','store','post','current','grantRef','clock','timeoutMs'])||isProxy(p.intake)||Object.getPrototypeOf(p.intake)!==NormalInstructionIntake.prototype||
   isProxy(p.post)||Object.getPrototypeOf(p.post)!==NormalProtectedPostClient.prototype||!p.store||isProxy(p.store)||p.store.transport!=='NORMAL_PROTECTED'||typeof p.store.exclusive!=='function'||
   !p.current||isProxy(p.current)||p.current.transport!=='NORMAL_PROTECTED'||typeof p.current.current!=='function'||!refV1(p.grantRef)||typeof p.clock!=='function'||!Number.isSafeInteger(p.timeoutMs)||p.timeoutMs<1||p.timeoutMs>10000)fail();
  this.#p={...p,grantRef:cloneV1(p.grantRef)};this.#current=p.current.current;this.#exclusive=p.store.exclusive;this.#ports();
 }
 #ports(){const p=this.#p;if(p.intake.instruction!==originalRead||NormalInstructionIntake.prototype.instruction!==originalRead||p.post.preparePermit!==originalPrepare||p.post.send!==originalSend||NormalProtectedPostClient.prototype.preparePermit!==originalPrepare||NormalProtectedPostClient.prototype.send!==originalSend||p.current.current!==this.#current||p.store.exclusive!==this.#exclusive||p.store.transport!=='NORMAL_PROTECTED')fail('NORMAL_INSTRUCTION_PORT_CHANGED');}
 #now(){const n=this.#p.clock();if(!Number.isSafeInteger(n)||!Number.isFinite(new Date(n).getTime())||n<this.#last)fail('NORMAL_INSTRUCTION_CLOCK_INVALID');this.#last=n;return n;}
 #permit(p:any,e:Send){if(!recordV1(p,['ref','commandId','envelopeHash','issuedAt','expiresAt'])||!refV1(p.ref)||p.ref.version!==1||p.commandId!==e.commandId||p.envelopeHash!==e.envelopeHash||!isoV1(p.issuedAt)||!isoV1(p.expiresAt)||Date.parse(p.issuedAt)>this.#now()||Date.parse(p.expiresAt)<=Date.parse(p.issuedAt)||Date.parse(p.expiresAt)>Math.min(Date.parse(p.issuedAt)+30000,Date.parse(e.expiresAt)))fail('NORMAL_INSTRUCTION_PERMIT_INVALID');}
 #rows(raw:unknown,e:Send,received:Ref){
  if(!arrayV1(raw,3)||Buffer.byteLength(canonicalJson(raw))>2097152)fail();const rows=cloneV1(raw) as any[];let at=-Infinity;const ids=new Set<string>();
  for(const [i,r] of rows.entries()){const s=r?.snapshot,prior=rows[i-1]?.snapshot;
   if(!recordV1(r,['ref','snapshot'])||!refV1(r.ref)||r.ref.version!==1||ids.has(r.ref.id)||r.ref.contentHash!==hash(s)||!recordV1(s,['sequence','state','key','envelopeHash','grantRef','sessionBindingRef','receivedRef','previousRef','permit','proofResultRef','recordedAt'])||
    s.sequence!==i+1||!same(s.key,receiptKeyV1(e))||s.envelopeHash!==e.envelopeHash||!same(s.grantRef,this.#p.grantRef)||!same(s.sessionBindingRef,e.payload.sessionBindingRef)||!same(s.receivedRef,received)||!same(s.previousRef,rows[i-1]?.ref??null)||!isoV1(s.recordedAt)||Date.parse(s.recordedAt)<at||Date.parse(s.recordedAt)>this.#now())fail();
   ids.add(r.ref.id);at=Date.parse(s.recordedAt);
   if(i===0){if(s.state!=='SEND_ATTEMPTED'||s.permit!==null||s.proofResultRef!==null)fail();}
   else{if(prior.state==='UNKNOWN'||i===2&&s.state!=='UNKNOWN'||!['PERMIT_RECORDED','UNKNOWN'].includes(s.state)||i===2&&prior.state!=='PERMIT_RECORDED')fail();
    if(s.permit!==null){this.#permit(s.permit,e);if(!refV1(s.proofResultRef))fail();}else if(s.proofResultRef!==null||s.state==='PERMIT_RECORDED')fail();
    if(i===2&&(!same(s.permit,prior.permit)||!same(s.proofResultRef,prior.proofResultRef)))fail();
   }
  }return rows;
 }
 #result(e:Send,row:any,state=row.snapshot.state){return{transport:'NORMAL_PROTECTED' as const,state,key:receiptKeyV1(e),envelopeHash:e.envelopeHash,recordRef:cloneV1(row.ref),permit:cloneV1(row.snapshot.permit),proofResultRef:cloneV1(row.snapshot.proofResultRef),readOnly:true as const,executionAuthorized:false as const,dispatchPerformed:false as const};}
 async #bounded<T>(fn:(signal:AbortSignal)=>Promise<T>,outer:AbortSignal,end:number){
  const c=new AbortController(),duration=Math.min(this.#p.timeoutMs,end-this.#now()),mono=performance.now();let timer:ReturnType<typeof setTimeout>|undefined,listener=()=>{};
  if(outer.aborted||duration<=0)fail('NORMAL_INSTRUCTION_EXPIRED');
  const stop=new Promise<never>((_,reject)=>{listener=()=>{c.abort();reject(Error('NORMAL_INSTRUCTION_INTERRUPTED'));};outer.addEventListener('abort',listener,{once:true});timer=setTimeout(listener,duration);});
  try{const out=await Promise.race([Promise.resolve().then(()=>{if(c.signal.aborted)fail();return fn(c.signal);}),stop]);if(c.signal.aborted||outer.aborted||performance.now()-mono>=duration||this.#now()>=end)fail('NORMAL_INSTRUCTION_EXPIRED');this.#ports();return out;}
  finally{c.abort();clearTimeout(timer);outer.removeEventListener('abort',listener);}
 }
 async prepare(raw:unknown,signal:AbortSignal):Promise<NormalInstructionPreparationResult>{
  if(this.#busy)fail('NORMAL_INSTRUCTION_BUSY');if(this.#unknown)fail('NORMAL_INSTRUCTION_UNKNOWN');if(!(signal instanceof AbortSignal)||signal.aborted)fail('NORMAL_INSTRUCTION_CANCELLED');
  this.#ports();const captured=captureInstructionInput(raw),e=readDispatchEnvelopeV1(captured,Date.parse((captured as any)?.issuedAt));if(e.operation!=='SEND_INSTRUCTION'||Date.parse(e.issuedAt)>this.#now())fail();
  this.#busy=true;let attempted=false;
  try{
   const material=await this.#p.intake.instruction(e,true);this.#ports();if(signal.aborted)fail();
   const result=await this.#exclusive.call(this.#p.store,receiptKeyV1(e),async tx=>{
    let rows=this.#rows(await tx.read(),e,material.receivedRef);this.#ports();
    const append=async(state:string,permit:any=null,proofResultRef:Ref|null=null)=>{
     const snapshot={sequence:rows.length+1,state,key:receiptKeyV1(e),envelopeHash:e.envelopeHash,grantRef:cloneV1(this.#p.grantRef),sessionBindingRef:cloneV1(e.payload.sessionBindingRef),receivedRef:cloneV1(material.receivedRef),previousRef:rows.at(-1)?.ref??null,permit:cloneV1(permit),proofResultRef:cloneV1(proofResultRef),recordedAt:new Date(this.#now()).toISOString()};
     const entry={ref:{id:randomUUID(),version:1,contentHash:hash(snapshot)},snapshot};await tx.appendAndSync(entry);
     const reread=this.#rows(await tx.read(),e,material.receivedRef);if(!same(reread,[...rows,entry]))fail('NORMAL_INSTRUCTION_SYNC_UNCERTAIN');rows=reread;return entry;
    };
    if(rows.length){if(rows.at(-1).snapshot.state==='SEND_ATTEMPTED')await append('UNKNOWN');return this.#result(e,rows.at(-1));}
    readDispatchEnvelopeV1(e,this.#now());if(signal.aborted)fail();
    const currentMaterial=await this.#p.intake.instruction(e);if(!same({...currentMaterial,bytes:null},{...material,bytes:null})||!Buffer.from(currentMaterial.bytes).equals(Buffer.from(material.bytes)))fail();
    this.#ports();readDispatchEnvelopeV1(e,this.#now());if(signal.aborted)fail('NORMAL_INSTRUCTION_CANCELLED');
    attempted=true;const attempt=await append('SEND_ATTEMPTED');
    let end=Date.parse(e.expiresAt);
    try{
     const v:any=cloneV1(await this.#bounded(s=>this.#current.call(this.#p.current,cloneV1(e),cloneV1(attempt.ref),s),signal,end));
     const refs=[...new Map(e.context.sourceScopes.map(s=>[canonicalJson(s.observationRef),s.observationRef])).values()],now=this.#now();
     if(!recordV1(v,['transport','key','envelopeHash','grantRef','localAttemptRef','sourceObservationRefs','osOwnershipRef','checkedAt','expiresAt'])||v.transport!=='NORMAL_PROTECTED'||!same(v.key,receiptKeyV1(e))||v.envelopeHash!==e.envelopeHash||!same(v.grantRef,this.#p.grantRef)||!same(v.localAttemptRef,attempt.ref)||!same(v.sourceObservationRefs,refs)||!refV1(v.osOwnershipRef)||!isoV1(v.checkedAt)||!isoV1(v.expiresAt)||Date.parse(v.checkedAt)>now||now-Date.parse(v.checkedAt)>30000||Date.parse(v.expiresAt)<=now||Date.parse(v.expiresAt)>Date.parse(v.checkedAt)+30000)fail('NORMAL_INSTRUCTION_CURRENT_INVALID');
     end=Math.min(end,Date.parse(v.expiresAt));
     const packet=await this.#bounded(s=>this.#p.post.preparePermit(e.commandId,{envelopeHash:e.envelopeHash,localAttemptRef:attempt.ref,sourceObservationRefs:v.sourceObservationRefs,osOwnershipRef:v.osOwnershipRef},s),signal,end);
     const reply=await this.#bounded(s=>this.#p.post.send(packet,s),signal,end) as NormalPermitResult;
     if(!recordV1(reply,['transport','proofResultRef','permit','cacheControl','nonceConsumed','executionAuthorized','dispatchPerformed'])||reply.transport!=='NORMAL_PROTECTED'||!refV1(reply.proofResultRef)||reply.cacheControl!=='no-store'||reply.nonceConsumed!==true||reply.executionAuthorized!==true||reply.dispatchPerformed!==false)fail('NORMAL_INSTRUCTION_PERMIT_INVALID');
     this.#permit(reply.permit,e);end=Math.min(end,Date.parse(reply.permit.expiresAt));
     const latest=await this.#p.intake.instruction(e);this.#ports();if(!same({...latest,bytes:null},{...material,bytes:null})||!Buffer.from(latest.bytes).equals(Buffer.from(material.bytes))||signal.aborted||this.#now()>=end)fail();
     const saved=await append('PERMIT_RECORDED',reply.permit,reply.proofResultRef);this.#ports();if(signal.aborted||this.#now()>=end)fail();return this.#result(e,saved);
    }catch{
     this.#unknown=true;const last=rows.at(-1);await append('UNKNOWN',last.snapshot.permit,last.snapshot.proofResultRef);return this.#result(e,rows.at(-1));
    }
   });
   return result as NormalInstructionPreparationResult;
  }catch(error){if(attempted)this.#unknown=true;throw error;}finally{this.#busy=false;}
 }
}
