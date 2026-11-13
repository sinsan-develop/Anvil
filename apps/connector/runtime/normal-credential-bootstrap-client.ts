import {createHash} from 'node:crypto';
import {canonicalJson,parseWireJson} from '../../../contracts/canonical.ts';
import {cloneV1,isoV1,recordV1,refV1,uuidV1,type RuntimeRefV1 as Ref} from '../../../contracts/runtime/validation-v1.ts';

/** 새 private owned-host protocol. 일반 token getter/임의 bytes signer가 아니다. */
export interface NormalOwnedScope {projectId:string;connectorId:string;executionId:string;executionGeneration:number;grantRef:Ref;credentialGeneration:number}
export interface NormalOwnedHostSession {send(operation:string,payload:unknown):Promise<unknown>;close():Promise<{state:string}>}
export interface NormalOwnedHostFactory {open(signal:AbortSignal):Promise<NormalOwnedHostSession>}
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
function origin(v:string){let u:URL;try{u=new URL(v);}catch{return fail();}if(u.protocol!=='https:'||u.origin!==v||u.username||u.password)return fail();return v;}
type Config={attemptId:string;origin:string;ca:string;scope:NormalOwnedScope};
type Ports={host:NormalOwnedHostFactory;now?:()=>number};
class Channel {
 readonly config:Config;readonly now:()=>number;readonly factory:NormalOwnedHostFactory;readonly open:NormalOwnedHostFactory['open'];
 unknown=false;busy=false;
 constructor(config:Config,ports:Ports){if(!uuidV1(config?.attemptId)||!scopeValid(config?.scope)||typeof ports?.host?.open!=='function')fail();
  if(!recordV1(config,['attemptId','origin','ca','scope'])||typeof config.ca!=='string'||!config.ca||Buffer.byteLength(config.ca)>65536)fail();
  this.config=cloneV1(config);origin(config.origin);this.now=ports.now??Date.now;this.factory=ports.host;this.open=ports.host.open;}
 async operation<T>(signal:AbortSignal,expires:number,run:(send:(op:string,p:unknown)=>Promise<any>)=>Promise<T>):Promise<T>{
  if(this.unknown)fail('NORMAL_OWNED_UNKNOWN');if(this.busy)fail('NORMAL_OWNED_BUSY');
  if(!(signal instanceof AbortSignal)||signal.aborted||expires<=this.now())fail('NORMAL_OWNED_CANCELLED');
  this.busy=true;let session:NormalOwnedHostSession|undefined,sent=false,done=false,count=0,timer:ReturnType<typeof setTimeout>|undefined;
  let closing:Promise<{state:string}>|undefined;
  const closeOnce=(s:NormalOwnedHostSession)=>closing??=(Promise.resolve().then(()=>s.close()));
  const local=new AbortController(),end=Math.min(Date.now()+10000,Date.now()+expires-this.now());
  let rejectAbort:(e:Error)=>void=()=>{};
  const cancelled=new Promise<never>((_,reject)=>{rejectAbort=reject;});
  const stop=()=>{local.abort();rejectAbort(Error(sent?'NORMAL_OWNED_UNKNOWN':'NORMAL_OWNED_CANCELLED'));};
  signal.addEventListener('abort',stop,{once:true});timer=setTimeout(stop,Math.max(1,end-Date.now()));
  const check=()=>{if(done||local.signal.aborted||signal.aborted||Date.now()>=end||this.now()>=expires)fail(sent?'NORMAL_OWNED_UNKNOWN':'NORMAL_OWNED_CANCELLED');};
  try{
   if(this.factory.open!==this.open)fail();
   const opening=Promise.resolve(this.open.call(this.factory,local.signal));
   opening.then(s=>{if(done||local.signal.aborted){this.unknown=true;void closeOnce(s).catch(()=>{});}},()=>{});
   session=await Promise.race([opening,cancelled]);check();const send=session.send;
   const answer=await Promise.race([run(async(op,p)=>{
    check();if(++count>64||Buffer.byteLength(canonicalJson(p))>64500||session!.send!==send)fail();
    sent=true;const result=await Promise.race([Promise.resolve(send.call(session,op,p)),cancelled]);check();return result;
   }),cancelled]);check();return answer;
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
 async prepare(request:Omit<NormalOwnedRequest,'auth'>,signal:AbortSignal):Promise<NormalOwnedPrepared>{
  const v=await this.#call('PREPARE',{...request,auth:null},signal);
  try{if(!recordV1(v,['path','query','auth','challengeRef','requestId','expiresAt'])||v.path!==request.path||v.query!==request.query||
   typeof v.auth!=='string'||!/^[A-Za-z0-9_-]{1,8192}$/.test(v.auth)||!refV1(v.challengeRef)||!uuidV1(v.requestId)||!isoV1(v.expiresAt)||
   Date.parse(v.expiresAt)>Date.parse(this.#metadata.expiresAt)||Date.parse(v.expiresAt)<=this.#channel.now())fail();
  return v as unknown as NormalOwnedPrepared;}catch{this.#channel.unknown=true;return fail('NORMAL_OWNED_UNKNOWN');}
 }
 request(request:NormalOwnedRequest,signal:AbortSignal):Promise<unknown>{return this.#call('REQUEST',request,signal);}
 async #call(kind:'PREPARE'|'REQUEST',r:NormalOwnedRequest,signal:AbortSignal):Promise<any>{
  const m=this.#metadata,c=this.#channel,base='/api/v1/connectors/'+m.scope.connectorId+'/executions/'+m.scope.executionId;
  if(!recordV1(r,['method','path','query','body','auth','expiresAt'])||!['GET','POST'].includes(r.method)||!r.path.startsWith(base+'/')||
   typeof r.query!=='string'||(r.body!==null&&typeof r.body!=='string')||!isoV1(r.expiresAt))fail();
  const suffix=r.path.slice(base.length),parts=suffix.split('/');
  const allowed=r.method==='GET'&&(suffix==='/commands'||parts.length===5&&parts[1]==='commands'&&uuidV1(parts[2])&&parts[3]==='materials'&&uuidV1(parts[4]))||
   r.method==='POST'&&(suffix==='/observations'||parts.length===4&&parts[1]==='commands'&&uuidV1(parts[2])&&parts[3]==='permit');
  if(!allowed||r.method==='GET'&&r.body!==null||r.method==='POST'&&(r.body===null||r.query!==''))fail();
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
     !Number.isSafeInteger(reply.total)||reply.total<1||reply.total>limit||typeof reply.hash!=='string'||!/^[a-f0-9]{64}$/.test(reply.hash)||
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
  });}finally{bytes.fill(0);}
 }
}
