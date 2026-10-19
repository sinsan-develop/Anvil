import {randomBytes,randomUUID} from 'node:crypto';
import {canonicalJson} from '../../../contracts/canonical.ts';
import {cloneV1,isoV1,recordV1} from '../../../contracts/runtime/validation-v1.ts';
import {ClientFailure,clientBase64,clientHash,clientReject,clientSame,readClientChallenge,readClientJournal,readClientOperation,readClientProof,readClientResponse,readClientScope,type ClientEntry,type ClientJournalScope,type ClientReason,type ClientScope,type ClientState,type SyntheticClientStore,type SyntheticClientTransaction} from './execution-ledger.ts';

export interface SyntheticClientAuthority{transport:'SYNTHETIC_ONLY';current(request:{scope:ClientScope;requestKey:string;target:unknown}):Promise<unknown>}
type Purpose='EXECUTION_CHALLENGE_REQUEST'|'EXECUTION_RECOVERY_CHALLENGE_REQUEST'|'EXECUTION_REQUEST_PROOF'|'EXECUTION_RECOVERY_REQUEST_PROOF';
export interface SyntheticClientSigner{transport:'SYNTHETIC_ONLY';sign(purpose:Purpose,bytes:Buffer,signal:AbortSignal):Promise<string>}
export interface SyntheticClientTransport{
 transport:'SYNTHETIC_ONLY';
 challenge(scope:ClientScope,request:unknown,signature:string,signal:AbortSignal):Promise<unknown>;
 /** MATERIAL은 bytes를 별도 inbox에 검증/sync한 정확 partReceipt만 반환한다. bodyRaw는 GET 선택 metadata다. */
 perform(scope:ClientScope,operation:{kind:'PERMIT'|'OBSERVATIONS'|'MATERIAL';commandId:string|null},challengeRef:unknown,proof:unknown,signature:string,bodyRaw:string,signal:AbortSignal):Promise<unknown>;
}
class StorageFailure extends Error{}
/** P1 요청 전송 기록 연결이다. 실제 키/token/HTTP·OS/Agent 기본값이 없고 UNKNOWN은 자동 재전송하지 않는다.
 * 결과 ACK는 보존만 하며 전체 spool 감사·삭제나 writer 회수/실행 완료를 확정하지 않는다. */
export class SyntheticExecutionClient{
 readonly store:SyntheticClientStore;readonly authority:SyntheticClientAuthority;readonly signer:SyntheticClientSigner;readonly transport:SyntheticClientTransport;readonly clock:()=>number;readonly timeoutMs:number;
 constructor(store:SyntheticClientStore,authority:SyntheticClientAuthority,signer:SyntheticClientSigner,transport:SyntheticClientTransport,options:{clock:()=>number;timeoutMs:number}){
  this.store=store;this.authority=authority;this.signer=signer;this.transport=transport;if(!options||typeof options.clock!=='function'||!Number.isSafeInteger(options.timeoutMs)||options.timeoutMs<1||options.timeoutMs>10000)clientReject('CLIENT_CONFIG_INVALID');this.clock=options.clock;this.timeoutMs=options.timeoutMs;this.#ports();
 }
 #ports(){if(this.store?.transport!=='SYNTHETIC_ONLY'||typeof this.store.exclusive!=='function'||this.authority?.transport!=='SYNTHETIC_ONLY'||typeof this.authority.current!=='function'||this.signer?.transport!=='SYNTHETIC_ONLY'||typeof this.signer.sign!=='function'||this.transport?.transport!=='SYNTHETIC_ONLY'||typeof this.transport.challenge!=='function'||typeof this.transport.perform!=='function')clientReject('SYNTHETIC_CLIENT_PORTS_REQUIRED');}
 #now(){const n=this.clock();if(!Number.isSafeInteger(n)||!Number.isFinite(new Date(n).getTime()))return clientReject('CLIENT_CLOCK_INVALID');return n;}
 async #bounded<T>(work:(signal:AbortSignal)=>Promise<T>,deadline:number){
  const wait=Math.min(this.timeoutMs,deadline-this.#now());if(wait<=0)return clientReject('CLIENT_REQUEST_EXPIRED');const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
  try{return await Promise.race([Promise.resolve().then(()=>{if(this.#now()>=deadline)return clientReject('CLIENT_REQUEST_EXPIRED');return work(controller.signal);}),new Promise<never>((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new ClientFailure('CLIENT_REQUEST_TIMEOUT'));},wait);})]);}finally{if(timer)clearTimeout(timer);}
 }
 async #current(scope:ClientScope,requestKey:string,target:unknown,ceiling=Infinity){
  this.#ports();const c=cloneV1(await this.#bounded(()=>this.authority.current({scope:cloneV1(scope),requestKey,target:cloneV1(target)}),Math.min(ceiling,this.#now()+this.timeoutMs))),now=this.#now();
  if(!recordV1(c,['transport','scope','requestKey','target','checkedAt','expiresAt'])||c.transport!=='SYNTHETIC_ONLY'||!clientSame(c.scope,scope)||c.requestKey!==requestKey||!clientSame(c.target,target)||!isoV1(c.checkedAt)||!isoV1(c.expiresAt)||Date.parse(c.checkedAt)>now||now-Date.parse(c.checkedAt)>30000||Date.parse(c.expiresAt)<=now)return clientReject('CLIENT_CURRENT_AUTHORITY_REQUIRED');this.#ports();return Math.min(Date.parse(c.expiresAt),ceiling);
 }
 async #sign(scope:ClientScope,kind:'CHALLENGE_REQUEST'|'REQUEST_PROOF',request:unknown,deadline:number){
  this.#ports();const purpose=(scope.mode==='RECOVERY'?'EXECUTION_RECOVERY_':'EXECUTION_')+kind as Purpose,bytes=Buffer.from(canonicalJson({purpose,request:cloneV1(request)}));
  const signature=await this.#bounded(signal=>{this.#ports();return this.signer.sign(purpose,Buffer.from(bytes),signal);},deadline);if(!clientBase64(signature,64))clientReject('CLIENT_SIGNATURE_INVALID');this.#ports();return signature;
 }
 #result(events:ClientEntry[]){const first=events[0]!,last=events.at(-1)!;return{transport:'SYNTHETIC_ONLY' as const,state:last.snapshot.state,reason:last.snapshot.reason,requestKey:first.snapshot.requestKey,requestRef:cloneV1(first.ref),resultRef:cloneV1(last.ref),response:last.snapshot.state==='RESPONSE_RECORDED'?cloneV1(last.snapshot.payload):null,executionAuthorized:false,dispatchPerformed:false,writerReleaseVerified:false,ackAudited:false};}
 async execute(rawScope:unknown,rawOperation:unknown){
  try{
   this.#ports();const scope=readClientScope(rawScope),operation=readClientOperation(scope,cloneV1(rawOperation),this.#now()),key:ClientJournalScope={projectId:scope.projectId,executionId:scope.executionId,executionGeneration:scope.executionGeneration,requestKey:operation.requestKey};
   return await this.store.exclusive(cloneV1(key),async tx=>{
    let loaded:Awaited<ReturnType<SyntheticClientTransaction['read']>>;try{loaded=await tx.read();}catch{throw new StorageFailure();}
    let journal=readClientJournal(loaded,key,this.#now()),events=journal.events,p=journal.prepared,issued=journal.issued;
    const append=async(state:ClientState,payload:unknown,reason:ClientReason='NONE')=>{
     const snapshot={transport:'SYNTHETIC_ONLY' as const,sequence:events.length+1,state,requestKey:key.requestKey,preparedRef:events[0]?.ref??null,previousRef:events.at(-1)?.ref??null,at:new Date(this.#now()).toISOString(),payload:cloneV1(payload),reason};
     const entry:ClientEntry={ref:{id:randomUUID(),version:1,contentHash:clientHash(snapshot)},snapshot};readClientJournal({complete:true,events:[...events,entry]},key,this.#now());
     try{await tx.appendAndSync(cloneV1(entry));}catch{throw new StorageFailure();}events.push(entry);journal=readClientJournal({complete:true,events},key,this.#now());p=journal.prepared;issued=journal.issued;
    };
    const unknown=async(reason:ClientReason)=>{await append('UNKNOWN',null,reason);return this.#result(events);};
    if(p&&(!clientSame(p.scope,scope)||!clientSame(p.operation,operation.operation)))return clientReject('CLIENT_REQUEST_CONFLICT');
    if(!events.length){
     let authorityExpiresAt=await this.#current(scope,key.requestKey,operation.target);const request={requestId:randomUUID(),purpose:'EXECUTION_REQUEST',grantRef:cloneV1(scope.grantRef),credentialGeneration:scope.credentialGeneration,target:cloneV1(operation.target),clientNonce:randomBytes(32).toString('base64url'),issuedAt:new Date(this.#now()).toISOString()};
     const signature=await this.#sign(scope,'CHALLENGE_REQUEST',request,Math.min(authorityExpiresAt,Date.parse(request.issuedAt)+30000));authorityExpiresAt=await this.#current(scope,key.requestKey,operation.target,authorityExpiresAt);
     await append('PREPARED',{scope,operation:operation.operation,target:operation.target,request,signature,authorityExpiresAt:new Date(authorityExpiresAt).toISOString()});
    }
    if(!p)return clientReject('CLIENT_LEDGER_INVALID');
    let last=events.at(-1)!.snapshot.state;if(last==='RESPONSE_RECORDED'||last==='UNKNOWN')return this.#result(events);
    if(last==='CHALLENGE_ATTEMPTED'||last==='REQUEST_ATTEMPTED')return unknown(last==='CHALLENGE_ATTEMPTED'?'CHALLENGE_UNCERTAIN':'REQUEST_UNCERTAIN');
    if(last==='PREPARED'){
     if(this.#now()>=Math.min(Date.parse(p.request.issuedAt)+30000,Date.parse(p.authorityExpiresAt)))return unknown('REQUEST_EXPIRED');
     const deadline=await this.#current(scope,key.requestKey,p.target,Math.min(Date.parse(p.authorityExpiresAt),Date.parse(p.request.issuedAt)+30000));await append('CHALLENGE_ATTEMPTED',null);
     try{this.#ports();const response=await this.#bounded(signal=>{this.#ports();return this.transport.challenge(cloneV1(scope),cloneV1(p!.request),p!.signature,signal);},deadline);readClientChallenge(response,p,this.#now());await append('CHALLENGE_RECEIVED',response);}
     catch(error){if(error instanceof StorageFailure)throw error;return unknown(error instanceof ClientFailure&&error.message==='CLIENT_RESPONSE_INVALID'?'INVALID_RESPONSE':'CHALLENGE_UNCERTAIN');}
    }
    last=events.at(-1)!.snapshot.state;if(last!=='CHALLENGE_RECEIVED'||!issued||!p)return clientReject('CLIENT_LEDGER_INVALID');
    if(this.#now()>=Math.min(Date.parse(issued.challenge.expiresAt),Date.parse(p.authorityExpiresAt)))return unknown('REQUEST_EXPIRED');
    try{
     let deadline=await this.#current(scope,key.requestKey,p.target,Math.min(Date.parse(issued.challenge.expiresAt),Date.parse(p.authorityExpiresAt)));const proof={requestId:p.request.requestId,...p.target,grantRef:cloneV1(scope.grantRef),credentialGeneration:scope.credentialGeneration,serverNonce:issued.challenge.serverNonce};
     const signature=await this.#sign(scope,'REQUEST_PROOF',proof,deadline);deadline=await this.#current(scope,key.requestKey,p.target,deadline);readClientProof({proof,signature},p,issued);await append('REQUEST_ATTEMPTED',{proof,signature});this.#ports();
     const response=await this.#bounded(signal=>{this.#ports();return this.transport.perform(cloneV1(scope),{kind:p!.operation.kind,commandId:p!.operation.commandId},cloneV1(issued.ref),cloneV1(proof),signature,p!.operation.bodyRaw,signal);},deadline);readClientResponse(response,p,issued,this.#now());await append('RESPONSE_RECORDED',response);return this.#result(events);
    }catch(error){if(error instanceof StorageFailure)throw error;return unknown(error instanceof ClientFailure&&error.message==='CLIENT_RESPONSE_INVALID'?'INVALID_RESPONSE':error instanceof ClientFailure&&error.message==='CLIENT_REQUEST_EXPIRED'?'REQUEST_EXPIRED':'REQUEST_UNCERTAIN');}
   });
  }catch(error){if(error instanceof ClientFailure)throw error;return clientReject('CLIENT_STORAGE_UNAVAILABLE');}
 }
}
