import {randomUUID} from 'node:crypto';
import {canonicalJson,contentHash,parseWireJson} from '../../../../contracts/canonical.ts';
import {readDispatchEnvelopeV1,type AdapterContextV1,type DispatchEnvelopeV1} from '../../../../contracts/runtime/dispatch-envelope-v1.ts';
import {receiptKeyV1,type ReceiptKeyV1} from '../../../../contracts/runtime/dispatch-receipt-v1.ts';
import {arrayV1,cloneV1,hashV1,isoV1,recordV1,refV1,type RuntimeRefV1 as Ref} from '../../../../contracts/runtime/validation-v1.ts';
import {Codex0161Codec,type CodecFact} from './codec.ts';
import {validateRequest} from './schemas.ts';
import {validateProviderSessionClaim,verifyProviderHandleBinding} from '../../../../contracts/runtime/provider-session-claim-v1.ts';
type Scope={projectId:string;executionId:string;executionGeneration:number};
type ResponseFact={transport:'SYNTHETIC_ONLY';source:'CODEX_0161_PROVIDER_CLAIM';fact:CodecFact};
type Entry={ref:Ref;snapshot:{sequence:number;key:ReceiptKeyV1;envelopeHash:string;permitRef:Ref;grantRef:Ref;bindingHash:string;materialReceiptRef:Ref;optionsContentHash:string;state:'START_ATTEMPTED'|'RESPONSE_RECORDED'|'UNKNOWN';responseFact:ResponseFact|null;responseRef:Ref|null;at:string;previousRef:Ref|null}};
export interface SyntheticPrimaryStartStore{transport:'SYNTHETIC_ONLY';/** 같은 execution 전체 잠금, 성공 sync는 callback 실패로 rollback하지 않는다. */exclusive<T>(scope:Scope,body:(tx:{read():Promise<{complete:boolean;events:Entry[]}>;appendAndSync(entry:Entry):Promise<void>})=>Promise<T>):Promise<T>}
export interface SyntheticPrimaryStartMaterials{transport:'SYNTHETIC_ONLY';/** 고정 options 원문을 현재 허가된 수신 자료에서만 읽는다. bytes는 {threadStartParams} JSON이며 원ref hash와 별도 bytes hash를 혼동하지 않는다. */read(envelope:DispatchEnvelopeV1):Promise<unknown>}
export interface SyntheticPrimaryStartAuthority{transport:'SYNTHETIC_ONLY';/** 실제 서버 검증 제공자가 없는 P1 합성 port다. permit/자료/현재 grant·소유를 재대조하고 유한 checkedAt/expiresAt을 반환한다. */current(envelope:DispatchEnvelopeV1,permitRef:Ref,material:unknown):Promise<unknown>}
export interface SyntheticPrimaryStartWire{transport:'SYNTHETIC_ONLY';exchange(bytes:Uint8Array,signal:AbortSignal):Promise<Uint8Array>}
export interface SyntheticPrimaryStartResponseBarrier{
 transport:'SYNTHETIC_ONLY';codec:Codex0161Codec;
 /** Explicit opt-in only. Must complete protected capture/metadata append+sync or
  * throw on uncertainty. This promise and matching metadata are not independent
  * evidence of native/OS protection, durability, authority or Agent execution. */
 complete(input:{envelope:DispatchEnvelopeV1;attemptRef:Ref;permitRef:Ref;fact:CodecFact},signal:AbortSignal):Promise<unknown>;
}
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b),hash=(v:unknown)=>contentHash(canonicalJson(v));
class StartFailure extends Error{}
const fail=(code:string):never=>{throw new StartFailure(code);};
/** 승인 C3 내부 합성 어댑터. 초기화 완료 codec만 소비하며 실제 OS/socket/credential/Agent fallback은 없다.
 * thread/start는 명시 옵션만 사용한다. context 본문 전달·외부 handle 영속 결박·실제 세션 사용은 별도 미연결이다.
 * 원문 옵션·provider handle을 journal에 남기지 않고 provider claim digest만 보존한다. */
export class SyntheticPrimaryStartTransport{
 readonly transport='SYNTHETIC_ONLY' as const;
 readonly store:SyntheticPrimaryStartStore;readonly materials:SyntheticPrimaryStartMaterials;readonly authority:SyntheticPrimaryStartAuthority;readonly wire:SyntheticPrimaryStartWire;readonly codec:Codex0161Codec;
 #expected:{context:AdapterContextV1;envelopeExecutorRef:Ref;grantRef:Ref};#clock:()=>number;#timeout:number;#barrier:SyntheticPrimaryStartResponseBarrier|undefined;
 constructor(store:SyntheticPrimaryStartStore,materials:SyntheticPrimaryStartMaterials,authority:SyntheticPrimaryStartAuthority,wire:SyntheticPrimaryStartWire,codec:Codex0161Codec,expected:{context:AdapterContextV1;envelopeExecutorRef:Ref;grantRef:Ref},options:{clock:()=>number;timeoutMs:number;responseBarrier?:SyntheticPrimaryStartResponseBarrier}){
  this.store=store;this.materials=materials;this.authority=authority;this.wire=wire;this.codec=codec;this.#barrier=options?.responseBarrier;this.#ports();
  if(!(codec instanceof Codex0161Codec)||!recordV1(expected,['context','envelopeExecutorRef','grantRef'])||!refV1(expected.envelopeExecutorRef)||!refV1(expected.grantRef)||typeof options?.clock!=='function'||!Number.isSafeInteger(options.timeoutMs)||options.timeoutMs<1||options.timeoutMs>10000)fail('PRIMARY_START_CONFIG_INVALID');
  this.#expected=cloneV1(expected);this.#clock=options.clock;this.#timeout=options.timeoutMs;
 }
 #ports(){if(this.#barrier!==undefined&&(this.#barrier.transport!=='SYNTHETIC_ONLY'||this.#barrier.codec!==this.codec||typeof this.#barrier.complete!=='function'))fail('PRIMARY_START_PROTECTION_REQUIRED');if(this.store?.transport!=='SYNTHETIC_ONLY'||typeof this.store.exclusive!=='function'||this.materials?.transport!=='SYNTHETIC_ONLY'||typeof this.materials.read!=='function'||this.authority?.transport!=='SYNTHETIC_ONLY'||typeof this.authority.current!=='function'||this.wire?.transport!=='SYNTHETIC_ONLY'||typeof this.wire.exchange!=='function')fail('SYNTHETIC_PRIMARY_START_PORTS_REQUIRED');}
 #now(){const n=this.#clock();if(!Number.isSafeInteger(n)||!Number.isFinite(new Date(n).getTime()))return fail('PRIMARY_START_CLOCK_INVALID');return n;}
 async #bounded<T>(body:(signal:AbortSignal)=>Promise<T>,deadline:number){
  const wait=Math.min(this.#timeout,deadline-this.#now());if(wait<=0)fail('PRIMARY_START_EXPIRED');const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
  try{return await Promise.race([Promise.resolve().then(()=>{this.#ports();if(this.#now()>=deadline)fail('PRIMARY_START_EXPIRED');return body(controller.signal);}),new Promise<never>((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new StartFailure('PRIMARY_START_TIMEOUT'));},wait);})]);}finally{if(timer)clearTimeout(timer);}
 }
 async #material(e:DispatchEnvelopeV1){
  const raw=await this.#bounded(()=>this.materials.read(cloneV1(e)),Date.parse(e.expiresAt));
  if(e.operation!=='START_SESSION'||!recordV1(raw,['transport','key','envelopeHash','contextBundleRef','optionsRef','materialReceiptRef','utf8Bytes','contentHash','bytes'])||raw.transport!=='SYNTHETIC_ONLY'||!same(raw.key,receiptKeyV1(e))||raw.envelopeHash!==e.envelopeHash||!same(raw.contextBundleRef,e.payload.contextBundleRef)||!same(raw.optionsRef,e.payload.optionsRef)||!refV1(raw.materialReceiptRef)||!Number.isSafeInteger(raw.utf8Bytes)||raw.utf8Bytes<1||raw.utf8Bytes>2*1024*1024||!hashV1(raw.contentHash)||!(raw.bytes instanceof Uint8Array)||raw.bytes.byteLength!==raw.utf8Bytes)return fail('PRIMARY_START_MATERIAL_INVALID');
  const bytes=new Uint8Array(raw.bytes);if(contentHash(bytes)!==raw.contentHash)fail('PRIMARY_START_MATERIAL_INVALID');
  let value:any;try{const text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);if(/-----BEGIN (?:[A-Z0-9]+ )?PRIVATE KEY-----|\bBearer\s+[A-Za-z0-9_.~+\/-]{16,}|\b(?:password|passwd|api[_-]?key|access[_-]?token|token|secret)["']?\s*[:=]\s*["']?[^\s"']{4,}/i.test(text))fail('PRIMARY_START_SENSITIVE_CONTENT');value=parseWireJson(text);}catch(error){if(error instanceof StartFailure)throw error;return fail('PRIMARY_START_MATERIAL_INVALID');}
  if(!recordV1(value,['threadStartParams'])||!value.threadStartParams||typeof value.threadStartParams!=='object'||Array.isArray(value.threadStartParams)||!Object.keys(value.threadStartParams).length||!validateRequest('thread/start',{id:'preflight',method:'thread/start',params:value.threadStartParams}))fail('PRIMARY_START_OPTIONS_INVALID');
  const {bytes:_,...metadata}=raw;return{params:cloneV1(value.threadStartParams),metadata:cloneV1(metadata)};
 }
 async #current(e:DispatchEnvelopeV1,permitRef:Ref,material:any){
  const raw=cloneV1(await this.#bounded(()=>this.authority.current(cloneV1(e),cloneV1(permitRef),cloneV1(material)),Date.parse(e.expiresAt))),now=this.#now();
  if(e.operation!=='START_SESSION'||!recordV1(raw,['transport','key','envelopeHash','permitRef','contextBundleRef','optionsRef','materialReceiptRef','optionsContentHash','grantRef','ownershipRef','checkedAt','expiresAt'])||raw.transport!=='SYNTHETIC_ONLY'||!same(raw.key,receiptKeyV1(e))||raw.envelopeHash!==e.envelopeHash||!same(raw.permitRef,permitRef)||!same(raw.contextBundleRef,e.payload.contextBundleRef)||!same(raw.optionsRef,e.payload.optionsRef)||!same(raw.materialReceiptRef,material.materialReceiptRef)||raw.optionsContentHash!==material.contentHash||!same(raw.grantRef,this.#expected.grantRef)||!refV1(raw.ownershipRef)||!isoV1(raw.checkedAt)||!isoV1(raw.expiresAt)||Date.parse(raw.checkedAt)>now||now-Date.parse(raw.checkedAt)>30000||Date.parse(raw.expiresAt)<=now||Date.parse(raw.expiresAt)>Date.parse(raw.checkedAt)+30000)return fail('PRIMARY_START_CURRENT_REQUIRED');
  const {checkedAt:_,expiresAt:__,...binding}=raw;return{bindingHash:hash(binding),deadline:Math.min(Date.parse(e.expiresAt),Date.parse(raw.expiresAt))};
 }
 #response(raw:unknown,e:DispatchEnvelopeV1){return recordV1(raw,['transport','source','fact'])&&raw.transport==='SYNTHETIC_ONLY'&&raw.source==='CODEX_0161_PROVIDER_CLAIM'&&this.#fact(raw.fact,e);}
 #protected(raw:unknown,e:DispatchEnvelopeV1,attemptRef:Ref,permitRef:Ref,fact:CodecFact){
  const value=cloneV1(raw);if(!recordV1(value,['state','claim','claimRef','ciphertextHash','executionAuthorized','dispatchPerformed'])||value.state!=='PROTECTED_PROVIDER_CLAIM_RECORDED'||!hashV1(value.ciphertextHash)||value.executionAuthorized!==false||value.dispatchPerformed!==false)return fail('PRIMARY_START_PROTECTION_UNCERTAIN');
  const checked=validateProviderSessionClaim(value.claim),c=checked.claim;verifyProviderHandleBinding(c,value.ciphertextHash);
  if(!same(checked.ref,value.claimRef)||c.kind!=='THREAD'||c.projectId!==e.context.projectId||c.execution.id!==e.context.executionId||c.execution.generation!==e.context.executionGeneration||c.assignmentRef.id!==e.context.assignmentId||c.commandId!==e.commandId||c.envelopeHash!==e.envelopeHash||!same(c.executorRegistrationRef,e.executorRegistrationRef)||!same(c.connectionRef,e.context.connectionRef)||!same(c.environmentRef,e.context.environmentRef)||!same(c.authorizationReceiptRef,e.context.authorizationReceiptRef)||!same(c.permitRef,permitRef)||!same(c.localAttemptRef,attemptRef)||c.source.method!=='thread/start'||c.source.requestIdDigest!==fact.requestIdDigest||c.source.responsePayloadDigest!==fact.payloadDigest||Date.parse(c.capturedAt)<Date.parse(e.issuedAt)||Date.parse(c.capturedAt)>this.#now()||Date.parse(c.usableBefore)<=this.#now())fail('PRIMARY_START_PROTECTION_UNCERTAIN');
 }
 #fact(f:unknown,e:DispatchEnvelopeV1){return recordV1(f,['kind','method','requestIdDigest','payloadDigest','executionAuthorized','workAccepted','ownership'])&&f.kind==='RPC_RESPONSE'&&f.method==='thread/start'&&f.requestIdDigest===hash(hash({key:receiptKeyV1(e),envelopeHash:e.envelopeHash}))&&hashV1(f.payloadDigest)&&f.executionAuthorized===false&&f.workAccepted===false&&f.ownership==='UNVERIFIED';}
 #journal(raw:unknown,e:DispatchEnvelopeV1,permitRef:Ref){
  if(!recordV1(raw,['complete','events'])||raw.complete!==true||!arrayV1(raw.events,2)||Buffer.byteLength(canonicalJson(raw))>65536)return fail('PRIMARY_START_JOURNAL_INCOMPLETE');
  const events:Entry[]=cloneV1(raw.events);let last=-Infinity;
  for(const [i,r]of events.entries()){const s=r?.snapshot,first=events[0]?.snapshot;
   if(!recordV1(r,['ref','snapshot'])||!refV1(r.ref)||r.ref.version!==1||r.ref.contentHash!==hash(s)||!recordV1(s,['sequence','key','envelopeHash','permitRef','grantRef','bindingHash','materialReceiptRef','optionsContentHash','state','responseFact','responseRef','at','previousRef'])||s.sequence!==i+1||!same(s.key,receiptKeyV1(e))||s.envelopeHash!==e.envelopeHash||!same(s.permitRef,permitRef)||!same(s.grantRef,this.#expected.grantRef)||!hashV1(s.bindingHash)||!hashV1(s.optionsContentHash)||!refV1(s.materialReceiptRef)||!isoV1(s.at)||Date.parse(s.at)<last||Date.parse(s.at)>this.#now()||!same(s.previousRef,events[i-1]?.ref??null)||i===1&&(r.ref.id===events[0]!.ref.id||s.bindingHash!==first!.bindingHash||!same(s.materialReceiptRef,first!.materialReceiptRef)||s.optionsContentHash!==first!.optionsContentHash))fail('PRIMARY_START_JOURNAL_INVALID');
   if(i===0&&(s.state!=='START_ATTEMPTED'||s.responseFact!==null||s.responseRef!==null)||i===1&&!(s.state==='RESPONSE_RECORDED'&&this.#response(s.responseFact,e)&&refV1(s.responseRef)&&s.responseRef.version===1&&s.responseRef.id!==r.ref.id&&s.responseRef.contentHash===hash(s.responseFact)||s.state==='UNKNOWN'&&s.responseFact===null&&s.responseRef===null))fail('PRIMARY_START_JOURNAL_INVALID');last=Date.parse(s.at);
  }return events;
 }
 #result(entry:Entry){const fact=entry.snapshot.responseFact;if(entry.snapshot.state!=='RESPONSE_RECORDED'||!fact)fail('PRIMARY_START_RESPONSE_UNCERTAIN');return{transport:'SYNTHETIC_ONLY' as const,responseRef:cloneV1(entry.snapshot.responseRef!)};}
 /** SyntheticStartReceiver의 기존 wire port로만 주입한다. 원 permit 소비/현재 OS 검증을 대신하지 않는다. */
 async send(raw:unknown):Promise<{transport:'SYNTHETIC_ONLY';responseRef:Ref}>{
  try{
   this.#ports();if(!recordV1(raw,['envelope','permitRef'])||!refV1(raw.permitRef))return fail('PRIMARY_START_INPUT_INVALID');const input=cloneV1(raw),e=readDispatchEnvelopeV1(input.envelope,Date.parse((input.envelope as any)?.issuedAt)),permitRef=input.permitRef as Ref;
   if(e.operation!=='START_SESSION'||Date.parse(e.issuedAt)>this.#now()||!same(e.context,this.#expected.context)||!same(e.executorRegistrationRef,this.#expected.envelopeExecutorRef))fail('PRIMARY_START_ENVELOPE_INVALID');const key=receiptKeyV1(e),scope={projectId:key.projectId,executionId:key.executionId,executionGeneration:key.executionGeneration};
   return await this.store.exclusive(scope,async tx=>{
    const events=this.#journal(await tx.read(),e,permitRef);if(events.length)return this.#result(events.at(-1)!);readDispatchEnvelopeV1(e,this.#now());
    const material=await this.#material(e),before=await this.#current(e,permitRef,material.metadata),requestId=hash({key,envelopeHash:e.envelopeHash}),encoded=this.codec.encodeRequest('thread/start',requestId,material.params);if(encoded.kind!=='ENCODED')return fail('PRIMARY_START_CODEC_UNAVAILABLE');
    const append=async(state:Entry['snapshot']['state'],responseFact:ResponseFact|null)=>{this.#ports();const snapshot:Entry['snapshot']={sequence:events.length+1,key,envelopeHash:e.envelopeHash,permitRef:cloneV1(permitRef),grantRef:cloneV1(this.#expected.grantRef),bindingHash:before.bindingHash,materialReceiptRef:material.metadata.materialReceiptRef,optionsContentHash:material.metadata.contentHash,state,responseFact:cloneV1(responseFact),responseRef:responseFact?{id:randomUUID(),version:1,contentHash:hash(responseFact)}:null,at:new Date(this.#now()).toISOString(),previousRef:events.at(-1)?.ref??null},entry={ref:{id:randomUUID(),version:1,contentHash:hash(snapshot)},snapshot};this.#journal({complete:true,events:[...events,entry]},e,permitRef);await tx.appendAndSync(cloneV1(entry));events.push(entry);return entry;};
    const attempt=await append('START_ATTEMPTED',null);const current=await this.#current(e,permitRef,material.metadata);if(current.bindingHash!==before.bindingHash)fail('PRIMARY_START_CURRENT_CHANGED');const deadline=Math.min(before.deadline,current.deadline);if(this.#now()>=deadline)fail('PRIMARY_START_EXPIRED');let response:CodecFact|null=null;
    try{const bytes=await this.#bounded(signal=>this.wire.exchange(new Uint8Array(encoded.wire),signal),deadline);if(!(bytes instanceof Uint8Array)||bytes.byteLength>2*1024*1024||bytes.at(-1)!==10||this.#now()>=deadline)throw Error();const facts=this.codec.push(new Uint8Array(bytes)),responseIndex=facts.findIndex(f=>this.#fact(f,e));if(responseIndex>=0&&!facts.some(f=>['PROTOCOL_UNKNOWN','RPC_ERROR','TOOL_ERROR_FACT','TOOL_APPROVAL_REQUIRED'].includes(f.kind))){const frames=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes).split('\n').slice(0,-1).map(line=>parseWireJson(line.endsWith('\r')?line.slice(0,-1):line)) as any[],reply=frames[responseIndex];if(reply?.id===requestId&&typeof reply.result?.thread?.id==='string'&&facts.every((f,i)=>f.kind!=='CONTEXT_UNVERIFIED'||f.code==='CONTEXT_PENDING'&&f.method==='thread/started'&&i<responseIndex&&frames[i]?.method==='thread/started'&&frames[i]?.params?.thread?.id===reply.result.thread.id))response=facts[responseIndex]!;}
     if(response&&this.#barrier){const candidate=response;response=null;const protectedResult=cloneV1(await this.#bounded(signal=>this.#barrier!.complete({envelope:cloneV1(e),attemptRef:cloneV1(attempt.ref),permitRef:cloneV1(permitRef),fact:cloneV1(candidate)},signal),deadline));this.#ports();if(this.#now()>=deadline)throw Error();this.#protected(protectedResult,e,attempt.ref,permitRef,candidate);const after=await this.#current(e,permitRef,material.metadata);this.#ports();if(after.bindingHash!==before.bindingHash||this.#now()>=Math.min(deadline,after.deadline))throw Error();this.#protected(protectedResult,e,attempt.ref,permitRef,candidate);response=candidate;}
    }catch{/* 원문 예외/handle은 기록하지 않고 미확인 상태만 보존한다. */}
    return this.#result(await append(response?'RESPONSE_RECORDED':'UNKNOWN',response?{transport:'SYNTHETIC_ONLY',source:'CODEX_0161_PROVIDER_CLAIM',fact:response}:null));
   });
  }catch(error){if(error instanceof StartFailure)throw error;return fail('PRIMARY_START_STORAGE_UNAVAILABLE');}
 }
}
