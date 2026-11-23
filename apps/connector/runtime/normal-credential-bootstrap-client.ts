import {createHash} from 'node:crypto';
import {canonicalJson,parseWireJson} from '../../../contracts/canonical.ts';
import {cloneV1,hashV1,isoV1,recordV1,refV1,uuidV1,type RuntimeRefV1 as Ref} from '../../../contracts/runtime/validation-v1.ts';

/** 새 private owned-host protocol. 일반 token getter/임의 bytes signer가 아니다. */
export interface NormalOwnedScope {projectId:string;connectorId:string;executionId:string;executionGeneration:number;grantRef:Ref;credentialGeneration:number}
export type HostCloseDisposition = 'HOST_REQUEST_VALIDATED' | 'OPERATION_UNKNOWN';
export interface NormalUnderstandingResultBinding {requestRef:Ref;acquisitionRef:Ref;bodyHash:string}
export interface NormalUnderstandingResultPrepare extends NormalUnderstandingResultBinding {attemptId:string;slotId:string}
export interface NormalPreparedUnderstandingResult {state:'NATIVE_DISCOVERY_RESULT_PREPARED';requestRef:Ref;acquisitionRef:Ref;preparedHash:string;auth:string;expiresAt:string}
export type NormalUnderstandingResultSendOperation='NORMAL_EXECUTION_UNDERSTANDING_RESULT_SEND'|'NORMAL_EXECUTION_BEGIN'|'NORMAL_EXECUTION_WRITE'|'NORMAL_EXECUTION_EXECUTE';
export interface NormalOwnedHostSession {
 readonly invalidated?:AbortSignal;
 current?():void;
 inspectionBudget?():{frames:number;remainingMs:number};
 prepareUnderstandingResult?(binding:NormalUnderstandingResultPrepare):Promise<unknown>;
 sendUnderstandingResult?(operation:NormalUnderstandingResultSendOperation,payload:unknown):Promise<unknown>;
 send(operation:string,payload:unknown):Promise<unknown>;
 close(disposition:HostCloseDisposition):Promise<{state:string}>;
}
export interface NormalOwnedHostFactory {open(signal:AbortSignal,request?:Readonly<NormalOwnedMetadata>):Promise<NormalOwnedHostSession>}
export interface NormalOwnedMetadata {slotId:string;receiptRef:Ref;origin:string;scope:NormalOwnedScope;expiresAt:string;caHash:string}
export interface NormalOwnedRequest {method:'GET'|'POST';path:string;query:string;body:string|null;auth:string|null;expiresAt:string}
export interface NormalOwnedPrepared {path:string;query:string;auth:string;challengeRef:Ref;requestId:string;expiresAt:string}
const limit=2812587,chunkSize=48000,known=new WeakSet<object>();
const digest=(b:Uint8Array|string)=>createHash('sha256').update(b).digest('hex');
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const scopeValid=(s:any)=>recordV1(s,['projectId','connectorId','executionId','executionGeneration','grantRef','credentialGeneration'])&&
 ['projectId','connectorId','executionId'].every(k=>uuidV1(s[k]))&&refV1(s.grantRef)&&
 [s.executionGeneration,s.credentialGeneration].every(v=>Number.isSafeInteger(v)&&v>0);
function fail(code='NORMAL_OWNED_INVALID'):never{throw Error(code);}
function base64url(value:unknown,length?:number):value is string{
 if(typeof value!=='string'||!/^[A-Za-z0-9_-]{1,8192}$/.test(value))return false;
 const bytes=Buffer.from(value,'base64url');
 return (length===undefined||bytes.length===length)&&bytes.toString('base64url')===value;
}
export function readPreparedUnderstandingResult(raw:unknown,binding:NormalUnderstandingResultBinding,slot:NormalOwnedMetadata,now:number,deadline:number):NormalPreparedUnderstandingResult{
 if(!recordV1(raw,['state','requestRef','acquisitionRef','preparedHash','auth','expiresAt'])||
    raw.state!=='NATIVE_DISCOVERY_RESULT_PREPARED'||!refV1(raw.requestRef)||!refV1(raw.acquisitionRef)||
    !same(raw.requestRef,binding.requestRef)||!same(raw.acquisitionRef,binding.acquisitionRef)||!hashV1(raw.preparedHash)||
    !base64url(raw.auth)||!isoV1(raw.expiresAt)||Date.parse(raw.expiresAt)<=now||
    Date.parse(raw.expiresAt)>Math.min(deadline,Date.parse(slot.expiresAt)))fail('NORMAL_OWNED_RESULT_INVALID');
 const wire=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.from(raw.auth,'base64url'));
 const frame=parseWireJson(wire);
 const scope=slot.scope;
 const path='/api/v1/connectors/'+scope.connectorId+'/executions/'+scope.executionId+'/understanding-response-read/'+binding.requestRef.id+'/result';
 if(canonicalJson(frame)!==wire||!recordV1(frame,['schemaVersion','challengeRef','proof','signature'])||
    frame.schemaVersion!==1||!refV1(frame.challengeRef)||frame.challengeRef.version!==1||!base64url(frame.signature,64)||
    !recordV1(frame.proof,['requestId','method','path','queryHash','bodyHash','grantRef','credentialGeneration','serverNonce'])||
    !uuidV1(frame.proof.requestId)||frame.proof.method!=='POST'||frame.proof.path!==path||
    frame.proof.queryHash!==digest(canonicalJson({}))||frame.proof.bodyHash!==binding.bodyHash||
    !same(frame.proof.grantRef,scope.grantRef)||frame.proof.credentialGeneration!==scope.credentialGeneration||
    !base64url(frame.proof.serverNonce,32))fail('NORMAL_OWNED_RESULT_INVALID');
 return cloneV1(raw) as unknown as NormalPreparedUnderstandingResult;
}
/** Pure purpose framing. The protected host and the once-only handoff stay with the original spool owner. */
export function frameUnderstandingResult(attemptId:string,slot:NormalOwnedMetadata,prepared:NormalPreparedUnderstandingResult,binding:NormalUnderstandingResultBinding,bytes:Buffer){
 if(bytes.length+Buffer.byteLength(prepared.auth)>2097152||digest(bytes)!==binding.bodyHash)fail('NORMAL_OWNED_RESULT_INVALID');
 const body=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
 const data=parseWireJson(body),scope=slot.scope;
 if(!recordV1(data,['schemaVersion','kind','metadata'])||data.schemaVersion!==1||data.kind!=='DISCOVERY_METADATA'||
    canonicalJson(data)!==body)fail('NORMAL_OWNED_RESULT_INVALID');
 const value=data.metadata;
 if(!recordV1(value,['attribution','projectId','executionId','executionGeneration','requestRef','acquisitionRef','contextBundleRef','initConfirmationRef','tailRef','ranges','wholeConversationComplete','executionAuthorized'])||
    value.attribution!=='SESSION_ONLY'||value.projectId!==scope.projectId||value.executionId!==scope.executionId||
    value.executionGeneration!==scope.executionGeneration||!same(value.requestRef,binding.requestRef)||!same(value.acquisitionRef,binding.acquisitionRef)||
    value.wholeConversationComplete!==false||value.executionAuthorized!==false)fail('NORMAL_OWNED_RESULT_INVALID');
 const {requestRef,acquisitionRef,preparedHash,auth}=prepared;
 const target={attemptId,slotId:slot.slotId,requestRef,acquisitionRef,preparedHash,auth};
 const direct={...target,body};
 if(Buffer.byteLength(canonicalJson(direct))<=64000)return {kind:'DIRECT' as const,payload:direct};
 const begin={...target,kind:'UNDERSTANDING_RESULT_SEND',bodyLength:bytes.length,bodyHash:binding.bodyHash};
 return {kind:'CHUNKED' as const,begin,chunkSize};
}
function origin(v:string){let u:URL;try{u=new URL(v);}catch{return fail();}if(u.protocol!=='https:'||u.origin!==v||u.username||u.password)return fail();return v;}
type Config={attemptId:string;origin:string;ca:string;scope:NormalOwnedScope};
type Ports={host:NormalOwnedHostFactory;now?:()=>number};
class Channel {
 readonly config:Config;readonly now:()=>number;readonly factory:NormalOwnedHostFactory;readonly open:NormalOwnedHostFactory['open'];
 unknown=false;busy=false;
 constructor(config:Config,ports:Ports){if(!uuidV1(config?.attemptId)||!scopeValid(config?.scope)||typeof ports?.host?.open!=='function')fail();
  if(!recordV1(config,['attemptId','origin','ca','scope'])||typeof config.ca!=='string'||!config.ca||Buffer.byteLength(config.ca)>65536)fail();
  this.config=cloneV1(config);origin(config.origin);this.now=ports.now??Date.now;this.factory=ports.host;this.open=ports.host.open;}
 async operation<T>(signal:AbortSignal,expires:number,run:(send:(op:string,p:unknown)=>Promise<any>)=>Promise<T>,request?:Readonly<NormalOwnedMetadata>):Promise<T>{
  if(this.unknown)fail('NORMAL_OWNED_UNKNOWN');if(this.busy)fail('NORMAL_OWNED_BUSY');
  if(!(signal instanceof AbortSignal)||signal.aborted||expires<=this.now())fail('NORMAL_OWNED_CANCELLED');
  this.busy=true;let session:NormalOwnedHostSession|undefined,sent=false,done=false,count=0,timer:ReturnType<typeof setTimeout>|undefined;
  let closing:Promise<{state:string}>|undefined;
  let disposition:HostCloseDisposition='OPERATION_UNKNOWN';
  const closeOnce=(s:NormalOwnedHostSession)=>closing??=(Promise.resolve().then(()=>s.close(disposition)));
  const local=new AbortController(),end=Math.min(Date.now()+10000,Date.now()+expires-this.now());
  let rejectAbort:(e:Error)=>void=()=>{};
  const cancelled=new Promise<never>((_,reject)=>{rejectAbort=reject;});
  const stop=()=>{local.abort();rejectAbort(Error(sent?'NORMAL_OWNED_UNKNOWN':'NORMAL_OWNED_CANCELLED'));};
  signal.addEventListener('abort',stop,{once:true});timer=setTimeout(stop,Math.max(1,end-Date.now()));
  const check=()=>{if(done||local.signal.aborted||signal.aborted||Date.now()>=end||this.now()>=expires)fail(sent?'NORMAL_OWNED_UNKNOWN':'NORMAL_OWNED_CANCELLED');};
  try{
   if(this.factory.open!==this.open)fail();
   const opening=Promise.resolve(this.open.call(this.factory,local.signal,request?cloneV1(request):undefined));
   opening.then(s=>{if(done||local.signal.aborted){this.unknown=true;void closeOnce(s).catch(()=>{});}},()=>{});
   session=await Promise.race([opening,cancelled]);check();const send=session.send;
   const answer=await Promise.race([run(async(op,p)=>{
    check();if(++count>64||Buffer.byteLength(canonicalJson(p))>64500||session!.send!==send)fail();
    sent=true;const result=await Promise.race([Promise.resolve(send.call(session,op,p)),cancelled]);check();return result;
   }),cancelled]);check();disposition='HOST_REQUEST_VALIDATED';return answer;
  }catch(e){if(sent)this.unknown=true;throw e;}
  finally{done=true;if(timer!==undefined)clearTimeout(timer);signal.removeEventListener('abort',stop);local.abort();
   if(session){let closeTimer:ReturnType<typeof setTimeout>|undefined;try{
    const status=await Promise.race([closeOnce(session),new Promise<{state:string}>(r=>{closeTimer=setTimeout(()=>r({state:'UNKNOWN'}),1000);})]);
    if(status?.state!=='CLOSED_CONFIRMED')this.unknown=true;
   }catch{this.unknown=true;}finally{if(closeTimer!==undefined)clearTimeout(closeTimer);}}
   this.busy=false;if(this.unknown)fail('NORMAL_OWNED_UNKNOWN');
  }
 }
}
export class NormalCredentialBootstrapClient {
 #channel:Channel;#started=false;#latest:NormalOwnedCredentialPort|undefined;
 constructor(config:Config,ports:Ports){this.#channel=new Channel(config,ports);}
 async bootstrap(signal:AbortSignal):Promise<NormalOwnedCredentialPort>{
  if(this.#started)fail('NORMAL_OWNED_ALREADY_STARTED');this.#started=true;const c=this.#channel;
  const m=await c.operation(signal,c.now()+10000,async send=>{
   const bytes=Buffer.from(canonicalJson(c.config));let v:any;
   try{if(bytes.length<=64000)v=await send('NORMAL_EXECUTION_BOOTSTRAP',c.config);
   else{if(bytes.length>2097152)fail();const start=await send('NORMAL_EXECUTION_BOOTSTRAP_BEGIN',{attemptId:c.config.attemptId,total:bytes.length,hash:digest(bytes)});
    if(!recordV1(start,['handle'])||!uuidV1(start.handle))fail();for(let offset=0;offset<bytes.length;offset+=chunkSize){const b=bytes.subarray(offset,offset+chunkSize);
     const ack=await send('NORMAL_EXECUTION_WRITE',{handle:start.handle,offset,bytes:b.toString('base64url')});
     if(!recordV1(ack,['handle','offset'])||ack.handle!==start.handle||ack.offset!==offset+b.length)fail();}
    v=await send('NORMAL_EXECUTION_EXECUTE',{handle:start.handle});}
   }finally{bytes.fill(0);}
   if(!recordV1(v,['slotId','receiptRef','origin','scope','expiresAt','caHash'])||v.caHash!==digest(c.config.ca)||!uuidV1(v.slotId)||!refV1(v.receiptRef)||!isoV1(v.expiresAt)||
    v.origin!==c.config.origin||!same(v.scope,c.config.scope)||Date.parse(v.expiresAt)<=c.now()||Date.parse(v.expiresAt)>c.now()+900000)fail();
   return cloneV1(v) as NormalOwnedMetadata;
  });
  if(c.unknown)fail('NORMAL_OWNED_UNKNOWN');return this.#latest=new NormalOwnedCredentialPort(c,m,secret);
 }
 async renew(previous:NormalOwnedCredentialPort,signal:AbortSignal):Promise<NormalOwnedCredentialPort>{
  const c=this.#channel;if(c.unknown)fail('NORMAL_OWNED_UNKNOWN');
  if(previous!==this.#latest||!known.has(previous))fail('NORMAL_OWNED_PREDECESSOR');
  const old=previous.metadata;if(c.now()<Date.parse(old.expiresAt))fail('NORMAL_OWNED_NOT_EXPIRED');
  const m=await c.operation(signal,c.now()+10000,async send=>{
   const payload={...c.config,previous:old},bytes=Buffer.from(canonicalJson(payload));let v:any;
   try{if(bytes.length<=64000)v=await send('NORMAL_EXECUTION_RENEW',payload);
    else{if(bytes.length>2097152)fail();const start=await send('NORMAL_EXECUTION_RENEW_BEGIN',{attemptId:c.config.attemptId,total:bytes.length,hash:digest(bytes)});
     if(!recordV1(start,['handle'])||!uuidV1(start.handle))fail();
     for(let offset=0;offset<bytes.length;offset+=chunkSize){const part=bytes.subarray(offset,offset+chunkSize);
      const ack=await send('NORMAL_EXECUTION_WRITE',{handle:start.handle,offset,bytes:part.toString('base64url')});
      if(!recordV1(ack,['handle','offset'])||ack.handle!==start.handle||ack.offset!==offset+part.length)fail();}
     v=await send('NORMAL_EXECUTION_EXECUTE',{handle:start.handle});}
   }finally{bytes.fill(0);}
   if(!recordV1(v,['slotId','receiptRef','origin','scope','expiresAt','caHash'])||v.caHash!==old.caHash||!uuidV1(v.slotId)||
    v.slotId===old.slotId||!refV1(v.receiptRef)||same(v.receiptRef,old.receiptRef)||!isoV1(v.expiresAt)||
    v.origin!==old.origin||!same(v.scope,old.scope)||Date.parse(v.expiresAt)<=c.now()||Date.parse(v.expiresAt)>c.now()+900000)fail();
   return cloneV1(v) as NormalOwnedMetadata;
  });
  return this.#latest=new NormalOwnedCredentialPort(c,m,secret);
 }
}
const secret=Symbol('owned credential');
export class NormalOwnedCredentialPort {
 #channel:Channel;#metadata:NormalOwnedMetadata;
 constructor(channel:Channel,metadata:NormalOwnedMetadata,key:symbol){if(key!==secret)fail();this.#channel=channel;this.#metadata=cloneV1(metadata);known.add(this);}
 get metadata():NormalOwnedMetadata{return cloneV1(this.#metadata);}
 matches(origin:string,scope:NormalOwnedScope,expiresAt:string,ca:string|undefined){return known.has(this)&&typeof ca==='string'&&digest(ca)===this.#metadata.caHash&&origin===this.#metadata.origin&&same(scope,this.#metadata.scope)&&expiresAt===this.#metadata.expiresAt;}
 /** 고정 범위 획득 전용. 일반 target 및 원문 읽기 권위를 열지 않는다. */
 async prepareUnderstandingRange(signal:AbortSignal):Promise<{kind:'PACKET';packet:NormalOwnedPrepared}|{kind:'NOT_ACQUIRED';status:'NONE'|'DENIED'|'EXPIRED'}>{
  const m=this.#metadata,r={method:'GET' as const,path:'/api/v1/connectors/'+m.scope.connectorId+'/executions/'+m.scope.executionId+'/understanding-response-read/range',query:'',body:null,auth:null,expiresAt:m.expiresAt};
  const v=await this.#call('UNDERSTANDING_RANGE_PREPARE',r,signal);
  try{if(v?.kind==='NORMAL_UNDERSTANDING_RANGE_NOT_ACQUIRED')return {kind:'NOT_ACQUIRED',status:this.#notAcquired(v,r,'PREPARE',true)};
   return {kind:'PACKET',packet:this.#prepared(v,r)};
  }catch{this.#channel.unknown=true;return fail('NORMAL_OWNED_UNKNOWN');}
 }
 async requestUnderstandingRange(request:NormalOwnedRequest,signal:AbortSignal):Promise<{kind:'RESPONSE';value:unknown}|{kind:'NOT_ACQUIRED';status:'DENIED'|'EXPIRED'}>{
  const v=await this.#call('UNDERSTANDING_RANGE_REQUEST',request,signal);
  try{if(v?.kind==='NORMAL_UNDERSTANDING_RANGE_NOT_ACQUIRED'){
   const status=this.#notAcquired(v,request,'REQUEST',true),packet=parseWireJson(Buffer.from(request.auth!,'base64url').toString('utf8')) as any;
   if(v.requestId!==packet?.proof?.requestId||status==='NONE')fail();return {kind:'NOT_ACQUIRED',status};
  }return {kind:'RESPONSE',value:v};}catch{this.#channel.unknown=true;return fail('NORMAL_OWNED_UNKNOWN');}
 }
 /** 목적 전용 응답은 Channel의 원 close가 확인된 다음에만 해석한다. */
 async prepareUnderstandingDiscovery(signal:AbortSignal):Promise<{kind:'PACKET';packet:NormalOwnedPrepared}|{kind:'NOT_ACQUIRED';status:'NONE'|'DENIED'|'EXPIRED'}>{
  const m=this.#metadata,r={method:'GET' as const,path:'/api/v1/connectors/'+m.scope.connectorId+'/executions/'+m.scope.executionId+'/understanding-response-read',query:'',body:null,auth:null,expiresAt:m.expiresAt};
  const v=await this.#call('PREPARE',r,signal);
  try{
   if(v?.kind==='NORMAL_UNDERSTANDING_NOT_ACQUIRED')return {kind:'NOT_ACQUIRED',status:this.#notAcquired(v,r,'PREPARE')};
   return {kind:'PACKET',packet:this.#prepared(v,r)};
  }catch{this.#channel.unknown=true;return fail('NORMAL_OWNED_UNKNOWN');}
 }
 #notAcquired(v:any,r:NormalOwnedRequest,stage:'PREPARE'|'REQUEST',range=false):'NONE'|'DENIED'|'EXPIRED'{
  if(!recordV1(v,['kind','status','stage','path','query','requestId','slotRef','expiresAt'])||v.kind!==(range?'NORMAL_UNDERSTANDING_RANGE_NOT_ACQUIRED':'NORMAL_UNDERSTANDING_NOT_ACQUIRED')||v.stage!==stage||v.path!==r.path||v.query!==''||!uuidV1(v.requestId)||!same(v.slotRef,this.#metadata.receiptRef)||!isoV1(v.expiresAt)||Date.parse(v.expiresAt)<=this.#channel.now()||Date.parse(v.expiresAt)>Date.parse(r.expiresAt)||Date.parse(v.expiresAt)>Date.parse(this.#metadata.expiresAt)||!(v.status==='DENIED'||v.status==='EXPIRED'||stage==='PREPARE'&&v.status==='NONE'))fail();
  return v.status;
 }
 async requestUnderstandingDiscovery(request:NormalOwnedRequest,signal:AbortSignal):Promise<{kind:'RESPONSE';value:unknown}|{kind:'NOT_ACQUIRED';status:'DENIED'|'EXPIRED'}>{
  const m=this.#metadata;
  if(request.method!=='GET'||request.path!=='/api/v1/connectors/'+m.scope.connectorId+'/executions/'+m.scope.executionId+'/understanding-response-read'||request.query!==''||request.body!==null)fail();
  const v=await this.#call('REQUEST',request,signal);
  try{if(v?.kind==='NORMAL_UNDERSTANDING_NOT_ACQUIRED'){
   const status=this.#notAcquired(v,request,'REQUEST');
   const packet=parseWireJson(Buffer.from(request.auth!,'base64url').toString('utf8')) as any;
   if(v.requestId!==packet?.proof?.requestId||status==='NONE')fail();return {kind:'NOT_ACQUIRED',status};
  }return {kind:'RESPONSE',value:v};}catch{this.#channel.unknown=true;return fail('NORMAL_OWNED_UNKNOWN');}
 }
 async prepare(request:Omit<NormalOwnedRequest,'auth'>,signal:AbortSignal):Promise<NormalOwnedPrepared>{
  const v=await this.#call('PREPARE',{...request,auth:null},signal);
  try{return this.#prepared(v,request);}catch{this.#channel.unknown=true;return fail('NORMAL_OWNED_UNKNOWN');}
 }
 #prepared(v:any,request:Omit<NormalOwnedRequest,'auth'>):NormalOwnedPrepared{
  if(!recordV1(v,['path','query','auth','challengeRef','requestId','expiresAt'])||v.path!==request.path||v.query!==request.query||
   typeof v.auth!=='string'||!/^[A-Za-z0-9_-]{1,8192}$/.test(v.auth)||!refV1(v.challengeRef)||!uuidV1(v.requestId)||!isoV1(v.expiresAt)||
   Date.parse(v.expiresAt)>Date.parse(this.#metadata.expiresAt)||Date.parse(v.expiresAt)<=this.#channel.now())fail();
  return v as unknown as NormalOwnedPrepared;
 }
 request(request:NormalOwnedRequest,signal:AbortSignal):Promise<unknown>{return this.#call('REQUEST',request,signal);}
 async #call(kind:'PREPARE'|'REQUEST'|'UNDERSTANDING_RANGE_PREPARE'|'UNDERSTANDING_RANGE_REQUEST',r:NormalOwnedRequest,signal:AbortSignal):Promise<any>{
  const m=this.#metadata,c=this.#channel,base='/api/v1/connectors/'+m.scope.connectorId+'/executions/'+m.scope.executionId;
  if(!recordV1(r,['method','path','query','body','auth','expiresAt'])||!['GET','POST'].includes(r.method)||!r.path.startsWith(base+'/')||
   typeof r.query!=='string'||(r.body!==null&&typeof r.body!=='string')||!isoV1(r.expiresAt))fail();
  const suffix=r.path.slice(base.length),parts=suffix.split('/');
  // 등록 서명은 원 private read/close의 출처 증명이 아니다. 목적 증명 연결 전 raw 전송을 닫는다.
  if(r.method==='POST'&&parts.length===4&&parts[1]==='understanding-response-read'&&uuidV1(parts[2])&&parts[3]==='result')fail('NORMAL_OWNED_RESULT_UNAVAILABLE');
  const range=kind==='UNDERSTANDING_RANGE_PREPARE'||kind==='UNDERSTANDING_RANGE_REQUEST';
  if(range&&(r.method!=='GET'||suffix!=='/understanding-response-read/range'||r.query!==''||r.body!==null||(kind==='UNDERSTANDING_RANGE_PREPARE'?r.auth!==null:!base64url(r.auth))))fail();
  const allowed=range||r.method==='GET'&&(suffix==='/commands'||suffix==='/understanding-response-read'||parts.length===5&&parts[1]==='commands'&&uuidV1(parts[2])&&parts[3]==='materials'&&uuidV1(parts[4]))||
   r.method==='POST'&&(suffix==='/observations'||parts.length===4&&parts[1]==='understanding-response-read'&&uuidV1(parts[2])&&parts[3]==='result'||parts.length===4&&parts[1]==='commands'&&uuidV1(parts[2])&&parts[3]==='permit');
  if(!allowed||parts[1]==='understanding-response-read'&&r.query!==''||r.method==='GET'&&r.body!==null||r.method==='POST'&&(r.body===null||r.query!==''))fail();
  const responseLimit=parts[1]==='understanding-response-read'?2097152:limit;
  const bytes=Buffer.from(r.body??'','utf8');if(bytes.length>2097152)fail();
  try{return await c.operation(signal,Math.min(Date.parse(m.expiresAt),Date.parse(r.expiresAt)),async send=>{
   const header={attemptId:c.config.attemptId,slotId:m.slotId,kind,request:{...r,body:null},bodyLength:bytes.length,bodyHash:digest(bytes),bodyIsNull:r.body===null};
   let reply:any;
   if(Buffer.byteLength(canonicalJson({...header,body:r.body}))<=64000)reply=await send('NORMAL_EXECUTION_CALL',{...header,body:r.body});
   else{
    const start=await send('NORMAL_EXECUTION_BEGIN',header);
    if(!recordV1(start,['handle'])||!uuidV1(start.handle))fail();
    for(let offset=0;offset<bytes.length;offset+=chunkSize){
     const part=bytes.subarray(offset,Math.min(offset+chunkSize,bytes.length));
     const ack=await send('NORMAL_EXECUTION_WRITE',{handle:start.handle,offset,bytes:part.toString('base64url')});
     if(!recordV1(ack,['handle','offset'])||ack.handle!==start.handle||ack.offset!==offset+part.length)fail();
    }
    reply=await send('NORMAL_EXECUTION_EXECUTE',{handle:start.handle});
   }
   const buffers:Buffer[]=[];let offset=0,handle:string|undefined,hash:string|undefined,total:number|undefined,wireExpiry:string|undefined;
   try{while(true){
    if(!recordV1(reply,['handle','offset','total','hash','expiresAt','bytes','done'])||!uuidV1(reply.handle)||reply.offset!==offset||
     !Number.isSafeInteger(reply.total)||reply.total<1||reply.total>responseLimit||typeof reply.hash!=='string'||!/^[a-f0-9]{64}$/.test(reply.hash)||
     !isoV1(reply.expiresAt)||Date.parse(reply.expiresAt)>Date.parse(m.expiresAt)||Date.parse(reply.expiresAt)<=c.now()||
     typeof reply.bytes!=='string'||!/^[A-Za-z0-9_-]+$/.test(reply.bytes)||typeof reply.done!=='boolean')fail();
    if(handle!==undefined&&(reply.handle!==handle||reply.hash!==hash||reply.total!==total||reply.expiresAt!==wireExpiry))fail();
    handle=reply.handle;hash=reply.hash;total=reply.total;wireExpiry=reply.expiresAt;const part=Buffer.from(reply.bytes,'base64url');
    if(part.length<1||part.length>chunkSize||part.toString('base64url')!==reply.bytes||offset+part.length>total!)fail();
    buffers.push(part);offset+=part.length;if(reply.done!==(offset===total))fail();
    if(reply.done)break;reply=await send('NORMAL_EXECUTION_READ',{handle,offset});
   }
   const all=Buffer.concat(buffers);try{if(digest(all)!==hash)fail();return parseWireJson(new TextDecoder('utf-8',{fatal:true}).decode(all));}finally{all.fill(0);}
   }finally{for(const b of buffers)b.fill(0);}
  },m);}finally{bytes.fill(0);}
 }
}
