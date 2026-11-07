import {cloneV1,recordV1,isoV1,hashV1} from '../../../contracts/runtime/validation-v1.ts';
import {SyntheticExecutionClient,type SyntheticClientAuthority,type SyntheticClientSigner,type SyntheticClientInvocation} from './execution-client.ts';
import {readClientScope,readClientOperation,clientSame,type SyntheticClientStore} from './execution-ledger.ts';
import {SyntheticObservationSpool} from './execution-observation-spool.ts';
import {ExecutionObservationHttpsClient,type ObservationHttpsRequestDriver} from './execution-observation-https.ts';
type Options={transport:'SYNTHETIC_ONLY';scope:unknown;spool:SyntheticObservationSpool;store:SyntheticClientStore;authority:SyntheticClientAuthority;signer:SyntheticClientSigner;origin:string;ca:string;credential:string;credentialExpiresAt:string;expectedScopeDigest?:string;request:ObservationHttpsRequestDriver;clock:()=>number;monotonicNow?:()=>number;timeoutMs:number};
const fail=(code:string):never=>{throw Error(code);};
/** 명시 합성 driver로 기존 serializer/decoder를 소비한다. 보호 current/서명/credential 출처나 실제 전송 활성화를 제공하지 않는다. */
export class SyntheticObservationDeliveryOwner{
 readonly transport='SYNTHETIC_ONLY' as const;
 #options:Options;#scope:ReturnType<typeof readClientScope>;#closed=false;#active:AbortController|null=null;
 #ports:{exclusive:Function;current:Function;sign:Function;request:Function;sync:Function;prepare:Function;spoolStore:SyntheticObservationSpool['store'];spoolExclusive:Function};
 constructor(options:Options){
  if(!options||options.transport!=='SYNTHETIC_ONLY'||!(options.spool instanceof SyntheticObservationSpool)||options.store?.transport!=='SYNTHETIC_ONLY'||options.authority?.transport!=='SYNTHETIC_ONLY'||options.signer?.transport!=='SYNTHETIC_ONLY'||typeof options.request!=='function'||typeof options.clock!=='function'||!Number.isSafeInteger(options.timeoutMs)||options.timeoutMs<1||options.timeoutMs>10000||!isoV1(options.credentialExpiresAt)||options.expectedScopeDigest!==undefined&&!hashV1(options.expectedScopeDigest))fail('OBSERVATION_OWNER_CONFIG_INVALID');
  this.#scope=readClientScope(options.scope);if(this.#scope.mode!=='EXECUTION')fail('OBSERVATION_OWNER_SCOPE_INVALID');this.#options={...options,scope:cloneV1(this.#scope)};
  this.#ports={exclusive:options.store.exclusive,current:options.authority.current,sign:options.signer.sign,request:options.request,sync:options.spool.sync,prepare:options.spool.prepareBatch,spoolStore:options.spool.store,spoolExclusive:options.spool.store.exclusive};if(Object.entries(this.#ports).some(([k,v])=>k!=='spoolStore'&&typeof v!=='function'))fail('OBSERVATION_OWNER_CONFIG_INVALID');
 }
 #check(controller?:AbortController,deadline=Infinity,history=false){
  const o=this.#options,p=this.#ports;if(this.#closed||controller?.signal.aborted)fail('OBSERVATION_OWNER_CLOSED');
  if(o.store.transport!=='SYNTHETIC_ONLY'||o.authority.transport!=='SYNTHETIC_ONLY'||o.signer.transport!=='SYNTHETIC_ONLY'||o.store.exclusive!==p.exclusive||o.authority.current!==p.current||o.signer.sign!==p.sign||o.request!==p.request||o.spool.sync!==p.sync||o.spool.prepareBatch!==p.prepare||o.spool.store!==p.spoolStore||o.spool.store.exclusive!==p.spoolExclusive||o.spool.store.transport!=='SYNTHETIC_ONLY')fail('OBSERVATION_OWNER_CONTEXT_CHANGED');
  const now=o.clock();if(!Number.isSafeInteger(now)||!Number.isFinite(new Date(now).getTime()))fail('OBSERVATION_OWNER_CLOCK_INVALID');if(now>=Math.min(deadline,history?Infinity:Date.parse(o.credentialExpiresAt)))fail('OBSERVATION_OWNER_EXPIRED');return now;
 }
 #context(raw:unknown,phase:'CHALLENGE'|'OBSERVATIONS',deadline:number){
  if(!recordV1(raw,['scope','requestKey','target','request','operation','issued','deadline'])||!clientSame(raw.scope,this.#scope)||!Number.isSafeInteger(raw.deadline)||raw.deadline>deadline||!hashV1(raw.requestKey))fail('OBSERVATION_OWNER_CONTEXT_INVALID');
  const c=cloneV1(raw) as unknown as SyntheticClientInvocation,operation=readClientOperation(this.#scope,c.operation,this.#check(undefined,deadline));
  if(operation.operation.kind!=='OBSERVATIONS'||operation.operation.commandId!==null||operation.requestKey!==c.requestKey||!clientSame(operation.target,c.target)||!recordV1(c.request,['requestId','purpose','grantRef','credentialGeneration','target','clientNonce','issuedAt'])||!clientSame(c.request.target,c.target)||phase==='CHALLENGE'&&c.issued!==null||phase==='OBSERVATIONS'&&c.issued===null)fail('OBSERVATION_OWNER_CONTEXT_INVALID');
  return c;
 }
 async sync(afterSequence:unknown){
  this.#check();if(this.#active)fail('OBSERVATION_OWNER_BUSY');const o=this.#options,controller=new AbortController(),deadline=Math.min(this.#check()+o.timeoutMs,Date.parse(o.credentialExpiresAt));this.#active=controller;let rejectAbort:((error:Error)=>void)|undefined;const onAbort=()=>rejectAbort?.(Error('OBSERVATION_OWNER_OUTCOME_UNKNOWN'));const cancelled=new Promise<never>((_,reject)=>{rejectAbort=reject;controller.signal.addEventListener('abort',onAbort,{once:true});});const timer=setTimeout(()=>controller.abort(),Math.max(1,deadline-o.clock()));
  const check=()=>this.#check(controller,deadline);let pending=false;
  try{
   const https=new ExecutionObservationHttpsClient({origin:o.origin,ca:o.ca,scope:this.#scope,credential:o.credential,credentialExpiresAt:o.credentialExpiresAt,...(o.expectedScopeDigest?{expectedScopeDigest:o.expectedScopeDigest}:{})},{request:o.request,now:o.clock,monotonicNow:o.monotonicNow});
   const transport={transport:'SYNTHETIC_ONLY' as const,
    challenge:async(scope:unknown,request:unknown,signature:string,signal:AbortSignal,invocation?:SyntheticClientInvocation)=>{
     check();const c=this.#context(invocation,'CHALLENGE',deadline);if(!clientSame(scope,c.scope)||!clientSame(request,c.request))fail('OBSERVATION_OWNER_CONTEXT_INVALID');
     const result=await https.challenge(c.request,signature,new Date(c.deadline).toISOString(),signal);check();return result;
    },
    perform:async(scope:unknown,operation:unknown,challengeRef:unknown,proof:unknown,signature:string,bodyRaw:string,signal:AbortSignal,invocation?:SyntheticClientInvocation)=>{
     check();const c=this.#context(invocation,'OBSERVATIONS',deadline),issued:any=c.issued,full:any=c.operation;
     if(!clientSame(scope,c.scope)||!clientSame(operation,{kind:full.kind,commandId:full.commandId})||bodyRaw!==full.bodyRaw||!clientSame(challengeRef,issued?.ref))fail('OBSERVATION_OWNER_CONTEXT_INVALID');
     const result=await https.observations({request:c.request,operation:c.operation,issued:c.issued,proof:cloneV1(proof),signature,requestExpiresAt:new Date(c.deadline).toISOString()},signal);check();
     // HTTP 원형은 그대로 검산됐으며 이 표식은 합성 조립의 provenance만 나타낸다.
     return{...result,transport:'SYNTHETIC_ONLY' as const};
    }};
   const authority:SyntheticClientAuthority={transport:'SYNTHETIC_ONLY',current:async request=>{check();const result=await o.authority.current(request);check();return result;}};
   const signer:SyntheticClientSigner={transport:'SYNTHETIC_ONLY',sign:async(purpose,bytes,signal)=>{check();const result=await o.signer.sign(purpose,bytes,signal);check();return result;}};
   const client=new SyntheticExecutionClient(o.store,authority,signer,transport,{clock:o.clock,timeoutMs:o.timeoutMs,signal:controller.signal,deadline});
   const work=SyntheticObservationSpool.prototype.sync.call(o.spool,client,cloneV1(this.#scope),afterSequence);pending=true;const release=()=>{if(this.#active===controller)this.#active=null;};void work.then(release,release);const result=await Promise.race([work,cancelled]);
   if(result.delivery.state!=='UNKNOWN')check();return result;
  }finally{clearTimeout(timer);controller.signal.removeEventListener('abort',onAbort);controller.abort();if(!pending&&this.#active===controller)this.#active=null;}
 }
 async readRecorded(afterSequence:unknown){
  const started=this.#check(undefined,Infinity,true);if(this.#active)fail('OBSERVATION_OWNER_BUSY');const o=this.#options,controller=new AbortController(),deadline=started+o.timeoutMs;this.#active=controller;
  let timer:ReturnType<typeof setTimeout>|undefined,rejectAbort:((error:Error)=>void)|undefined;const abort=()=>rejectAbort?.(Error('OBSERVATION_OWNER_CLOSED'));let pending=false;
  try{
   const cancel=new Promise<never>((_,reject)=>{rejectAbort=reject;controller.signal.addEventListener('abort',abort,{once:true});timer=setTimeout(()=>reject(Error('OBSERVATION_OWNER_EXPIRED')),o.timeoutMs);});
   const work=async()=>{const batch=await SyntheticObservationSpool.prototype.prepareBatch.call(o.spool,afterSequence);this.#check(controller,deadline,true);if(!batch.operation)fail('OBSERVATION_OWNER_BATCH_EMPTY');
    const denied=async():Promise<never>=>fail('OBSERVATION_OWNER_HISTORY_EFFECT_DENIED');
    const client=new SyntheticExecutionClient(o.store,o.authority,o.signer,{transport:'SYNTHETIC_ONLY',challenge:denied,perform:denied},{clock:o.clock,timeoutMs:o.timeoutMs});
    const saved=await client.readRecorded(cloneV1(this.#scope),batch.operation);this.#check(controller,deadline,true);return saved;};
   const running=work();pending=true;const release=()=>{if(this.#active===controller)this.#active=null;};void running.then(release,release);return await Promise.race([running,cancel]);
  }finally{if(timer)clearTimeout(timer);controller.signal.removeEventListener('abort',abort);controller.abort();if(!pending&&this.#active===controller)this.#active=null;}
 }
 close(){if(this.#closed)return;this.#closed=true;this.#active?.abort();}
}
