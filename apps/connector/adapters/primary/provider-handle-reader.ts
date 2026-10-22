import {canonicalJson,contentHash,parseWireJson} from '../../../../contracts/canonical.ts';
import {validateProviderSessionClaim,verifyProviderHandleBinding,providerBindingHash,type ProviderSessionClaim,type ProviderRef} from '../../../../contracts/runtime/provider-session-claim-v1.ts';
import {readDispatchEnvelopeV1,type DispatchEnvelopeV1} from '../../../../contracts/runtime/dispatch-envelope-v1.ts';
import {receiptKeyV1} from '../../../../contracts/runtime/dispatch-receipt-v1.ts';
import {readServerExecutionFactV1,executionFactChecks} from '../../../../contracts/runtime/server-execution-fact-v1.ts';
import {cloneV1,recordV1,isoV1,hashV1} from '../../../../contracts/runtime/validation-v1.ts';

export interface SyntheticProviderCommandCurrent{
 transport:'SYNTHETIC_ONLY';
 /** Trusted internal port, never HTTP input: resolves the stored selected claim and exact
  * current command/grant/permit/subject/generation/OS ownership. Existing SEND IDLE/budget/
  * consume and STOP authorization remain mandatory outside this reader; no permission is issued here. */
 current(envelope:DispatchEnvelopeV1,claimRef:ProviderRef):Promise<unknown>;
}
export interface SyntheticProtectedProviderStore{
 transport:'SYNTHETIC_ONLY';
 /** In-memory fake only. Native DPAPI/ACL/file identity/decryption are NOT implemented.
  * Own returned bytes exclusively; caller zeroes them including late results. No raw export endpoint. */
 read(claim:ProviderSessionClaim,signal:AbortSignal):Promise<unknown>;
}
type Selection={envelope:unknown;claimRef:ProviderRef;claim:ProviderSessionClaim;parent:ProviderSessionClaim|null};
type Handles={threadId:string;turnId:string|null};
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b),hash=(v:unknown)=>contentHash(canonicalJson(v));
function fail():never{throw Error('PROVIDER_HANDLE_UNAVAILABLE');}
const handle=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9._:-]{1,512}$/.test(v);
/** Internal synthetic consumption boundary, not a dispatcher, native helper or authority.
 * Raw identifiers only reach the trusted callback. JS strings/GC cannot guarantee full erasure. */
export class SyntheticProviderHandleReader{
 #current:SyntheticProviderCommandCurrent;#store:SyntheticProtectedProviderStore;#clock:()=>number;#timeout:number;
 constructor(current:SyntheticProviderCommandCurrent,store:SyntheticProtectedProviderStore,options:{clock:()=>number;timeoutMs:number}){
  this.#current=current;this.#store=store;
  if(typeof options?.clock!=='function'||!Number.isSafeInteger(options.timeoutMs)||options.timeoutMs<1||options.timeoutMs>10000)fail();
  this.#clock=options.clock;this.#timeout=options.timeoutMs;this.#ports();
 }
 #ports(){if(this.#current?.transport!=='SYNTHETIC_ONLY'||typeof this.#current.current!=='function'||this.#store?.transport!=='SYNTHETIC_ONLY'||typeof this.#store.read!=='function')fail();}
 #now(){const n=this.#clock();if(!Number.isSafeInteger(n)||!Number.isFinite(new Date(n).getTime()))return fail();return n;}
 async use(raw:Selection,consume:(handles:Readonly<Handles>,signal:AbortSignal)=>Promise<void>):Promise<void>{
  const buffers=new Set<Uint8Array>(),abort=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
  try{
   this.#ports();if(!recordV1(raw,['envelope','claimRef','claim','parent'])||typeof consume!=='function')fail();
   const s=cloneV1(raw),now=this.#now(),e=readDispatchEnvelopeV1(s.envelope,now),checked=validateProviderSessionClaim(s.claim,s.parent??undefined),c=checked.claim;
   if(!same(checked.ref,s.claimRef)||e.operation==='START_SESSION'||e.operation==='SEND_INSTRUCTION'&&c.kind!=='THREAD'||e.operation==='REQUEST_STOP'&&c.kind!=='TURN'
    ||c.projectId!==e.context.projectId||c.execution.id!==e.context.executionId||c.execution.generation!==e.context.executionGeneration||c.assignmentRef.id!==e.context.assignmentId
    ||!same(c.agentSessionRef,e.payload.sessionBindingRef)||!same(c.connectionRef,e.context.connectionRef)||!same(c.environmentRef,e.context.environmentRef)||!same(c.executorRegistrationRef,e.executorRegistrationRef)
    ||Date.parse(c.capturedAt)>now||Date.parse(c.usableBefore)<=now)fail();
   let deadline=Math.min(now+this.#timeout,Date.parse(e.expiresAt),Date.parse(c.usableBefore));
   const expired=()=>{this.#ports();if(abort.signal.aborted||this.#now()>=deadline)fail();};
   const guard=async()=>{
    expired();const v=cloneV1(await this.#current.current(cloneV1(e),cloneV1(s.claimRef)));expired();
    if(!recordV1(v,['key','envelopeHash','claimRef','parentThreadClaimRef','fact','expiresAt'])||!same(v.key,receiptKeyV1(e))||v.envelopeHash!==e.envelopeHash||!same(v.claimRef,s.claimRef)||!same(v.parentThreadClaimRef,c.parentThreadClaimRef)||!isoV1(v.expiresAt))fail();
    const f=readServerExecutionFactV1(v.fact),i=f.intent;
    if(f.projectId!==c.projectId||f.executionId!==c.execution.id||f.executionGeneration!==c.execution.generation||f.writerState!=='OWNED'
     ||!same(f.agentSession.sessionRef,c.agentSessionRef)||!same(f.agentSession.roleBindingRef,c.responsibleBindingRef)||!same(f.registration.ref,c.executorRegistrationRef)
     ||!same(i.assignmentRef,c.assignmentRef)||!same(i.connectionRef,c.connectionRef)||!same(i.environmentRef,c.environmentRef)||!same(i.capabilityRef,e.context.capabilityRef)||!same(i.sourceScopes,e.context.sourceScopes)
     ||executionFactChecks.some(k=>k!=='understanding'&&f.checks[k].state!=='VERIFIED_CURRENT')
     ||e.operation==='SEND_INSTRUCTION'&&(i.mode==='WORK'?(f.understandingReviewRef===null||f.checks.understanding.state!=='VERIFIED_CURRENT'):i.sourceScopes.some(x=>x.targets.some(t=>t.access!=='READ')))
     ||Date.parse(f.checkedAt)>this.#now()||this.#now()-Date.parse(f.checkedAt)>30000||Date.parse(v.expiresAt)>Date.parse(f.checkedAt)+30000)fail();
    deadline=Math.min(deadline,Date.parse(v.expiresAt),Date.parse(f.checkedAt)+30000,...Object.values(f.expires).map(Date.parse));expired();
    const{checkedAt:_,...stable}=f;return hash({key:v.key,envelopeHash:v.envelopeHash,claimRef:v.claimRef,parentThreadClaimRef:v.parentThreadClaimRef,fact:stable});
   };
   const read=async(claim:ProviderSessionClaim,parent?:ProviderSessionClaim):Promise<Handles>=>{
    expired();const value=await this.#store.read(cloneV1(claim),abort.signal);
    // Inspect data descriptors rather than invoking a potentially hostile getter during cleanup.
    const bytes=value&&typeof value==='object'?Object.getOwnPropertyDescriptor(value,'plaintext')?.value:undefined;
    if(bytes instanceof Uint8Array){buffers.add(bytes);if(abort.signal.aborted){bytes.fill(0);fail();}}
    expired();if(!recordV1(value,['ciphertextHash','plaintext'])||!hashV1(value.ciphertextHash)||!(bytes instanceof Uint8Array)||bytes.byteLength<1||bytes.byteLength>4096)fail();
    verifyProviderHandleBinding(claim,value.ciphertextHash,parent);
    const capsule=parseWireJson(new TextDecoder('utf-8',{fatal:true}).decode(bytes)),{protectedHandleRef:_,...input}=claim;
    if(!recordV1(capsule,['schemaVersion','bindingHash','threadId','turnId'])||capsule.schemaVersion!==1||capsule.bindingHash!==providerBindingHash(input)||!handle(capsule.threadId)||(claim.kind==='THREAD'?capsule.turnId!==null:!handle(capsule.turnId)))fail();
    return{threadId:capsule.threadId,turnId:capsule.turnId};
   };
   const work=async()=>{const before=await guard(),h=await read(c,s.parent??undefined);if(s.parent){const p=await read(s.parent);if(p.threadId!==h.threadId)fail();}const after=await guard();if(after!==before)fail();expired();const result=await consume(Object.freeze(h),abort.signal);expired();if(result!==undefined)fail();};
   await Promise.race([work(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>{abort.abort();reject(Error('PROVIDER_HANDLE_UNAVAILABLE'));},Math.max(1,deadline-this.#now()));})]);
  }catch{return fail();}finally{abort.abort();if(timer)clearTimeout(timer);for(const b of buffers)b.fill(0);}
 }
}
