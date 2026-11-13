import {randomBytes,randomUUID} from 'node:crypto';
import {NormalOwnedCredentialPort} from './normal-credential-bootstrap-client.ts';
import {request as httpsRequest,type RequestOptions} from 'node:https';
import type {ClientRequest,IncomingMessage} from 'node:http';
import {canonicalJson,contentHash,parseWireJson} from '../../../contracts/canonical.ts';
import {cloneV1,hashV1,isoV1,recordV1,refV1,uuidV1,type RuntimeRefV1 as Ref} from '../../../contracts/runtime/validation-v1.ts';
import {executionChallengeRequestBytes,executionProofBytes,executionTarget} from '../../server/modules/executions/execution-proof.ts';

/** normal permit·관측 전용 보호 POST. 기본 관측/키 공급자와 자동 재전송은 없다. */
export type NormalHttpsRequestDriver=(url:URL,options:RequestOptions,callback:(response:IncomingMessage)=>void)=>ClientRequest;
export type NormalSignPurpose='EXECUTION_CHALLENGE_REQUEST'|'EXECUTION_REQUEST_PROOF';
/** 실행기 등록 키 서명자. P-256 ECDSA ieee-p1363 서명을 unpadded base64url(64 bytes)로 돌려준다. */
export interface NormalProtectedSigner{sign(purpose:NormalSignPurpose,bytes:Buffer,signal:AbortSignal):Promise<string>}
export interface NormalProtectedPostScope{projectId:string;connectorId:string;executionId:string;executionGeneration:number;grantRef:Ref;credentialGeneration:number}
export interface NormalProtectedPostOptions{origin:string;ca?:string;credential?:string;credentialExpiresAt:string;scope:NormalProtectedPostScope}
export interface NormalProtectedPostPorts{signer?:NormalProtectedSigner;protectedCredential?:NormalOwnedCredentialPort;request?:NormalHttpsRequestDriver;now?:()=>number;monotonicNow?:()=>number;
 setTimeout?:typeof setTimeout;clearTimeout?:typeof clearTimeout}
export interface PreparedNormalPost {kind:'PERMIT'|'OBSERVATIONS';path:string;auth:string;challengeRef:Ref;requestId:string;expiresAt:string}
export interface NormalPermitResult {transport:'NORMAL_PROTECTED';proofResultRef:Ref;permit:{ref:Ref;commandId:string;envelopeHash:string;issuedAt:string;expiresAt:string};cacheControl:'no-store';nonceConsumed:true;executionAuthorized:true;dispatchPerformed:false}
export interface NormalObservationResult {transport:'NORMAL_PROTECTED';proofResultRef:Ref;ack:{ref:Ref;snapshot:any};cacheControl:'no-store';nonceConsumed:true;executionAuthorized:false;dispatchPerformed:false}

export class NormalProtectedPostError extends Error{
 readonly code:string;readonly status:number;
 /** GET을 보낸 뒤 결과를 알 수 없으면 true다. 같은 packet 재전송 여부는 호출자가 정한다. */
 readonly outcomeUnknown:boolean;
 /** challenge 발급 뒤 준비가 실패해 서버에 소비되지 않은 challenge가 남았을 수 있으면 true다.
  * credential당 살아 있는 challenge는 하나라서 그 기한(최대 30초)까지 다음 준비는 429로 거절될 수 있다. */
 challengeMayBeLive=false;
 constructor(code:string,status=0,outcomeUnknown=false){super(code);this.name='NormalProtectedPostError';this.code=code;this.status=status;this.outcomeUnknown=outcomeUnknown;}
}
function fail(code:string,status=0,unknown=false):never{throw new NormalProtectedPostError(code,status,unknown);}
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const positive=(v:unknown):v is number=>Number.isSafeInteger(v)&&Number(v)>0;
const limits={CHALLENGE:16384,PERMIT:16384,OBSERVATIONS:1024*1024,RESPONSE:2*1024*1024} as const;
const ignoreLateError=()=>{};
function base64(v:unknown,n:number){
 if(typeof v!=='string'||v.length!==Math.ceil(n*4/3)||!/^[A-Za-z0-9_-]+$/.test(v))return false;
 const b=Buffer.from(v,'base64url');return b.length===n&&b.toString('base64url')===v;
}
function readOrigin(v:unknown){
 if(typeof v!=='string')return fail('NORMAL_POST_CONFIG_INVALID');
 let u:URL;try{u=new URL(v);}catch{return fail('NORMAL_POST_CONFIG_INVALID');}
 if(u.protocol!=='https:'||u.origin!==v||u.username||u.password||u.pathname!=='/'||u.search||u.hash)fail('NORMAL_POST_CONFIG_INVALID');
 return v;
}
function readScope(s:unknown):NormalProtectedPostScope{
 if(!recordV1(s,['projectId','connectorId','executionId','executionGeneration','grantRef','credentialGeneration'])||
   !['projectId','connectorId','executionId'].every(k=>uuidV1((s as any)[k]))||!positive(s.executionGeneration)||!refV1(s.grantRef)||!positive(s.credentialGeneration))
  return fail('NORMAL_POST_CONFIG_INVALID');
 return cloneV1(s as NormalProtectedPostScope);
}

export class NormalProtectedPostClient{
 readonly executionAuthorized=false;readonly dispatchPerformed=false;
 #packets=new WeakMap<object,{body:string;command:string|null;envelopeHash:string|null}>();
 #origin:string;#ca:string;#credential:string;#credentialExpiry:number;#scope:NormalProtectedPostScope;#base:string;
 #owned:NormalOwnedCredentialPort|undefined;
 #signer:NormalProtectedSigner;#request:NormalHttpsRequestDriver;#now:()=>number;#monotonic:()=>number;#set:typeof setTimeout;#clear:typeof clearTimeout;
 constructor(options:NormalProtectedPostOptions,ports:NormalProtectedPostPorts){
  this.#origin=readOrigin(options?.origin);this.#scope=readScope(options?.scope);
  this.#owned=ports?.protectedCredential;
  if(this.#owned!==undefined){if(!(this.#owned instanceof NormalOwnedCredentialPort)||options.credential!==undefined||ports.signer!==undefined||ports.request!==undefined||
    !this.#owned.matches(this.#origin,this.#scope,options.credentialExpiresAt,options.ca))fail('NORMAL_POST_CONFIG_INVALID');}
  else if(typeof options.ca!=='string'||!options.ca||Buffer.byteLength(options.ca)>65536||typeof options.credential!=='string'||
    !/^av3ex1_[A-Za-z0-9_-]{43}$/.test(options.credential)||!base64(options.credential.slice(7),32)||!isoV1(options.credentialExpiresAt))fail('NORMAL_POST_CONFIG_INVALID');
  this.#ca=options.ca??'';this.#credential=options.credential??'';this.#credentialExpiry=Date.parse(options.credentialExpiresAt);
  this.#base='/api/v1/connectors/'+this.#scope.connectorId+'/executions/'+this.#scope.executionId;
  this.#signer=ports?.signer as NormalProtectedSigner;this.#request=ports?.request??httpsRequest;this.#now=ports?.now??Date.now;
  this.#monotonic=ports?.monotonicNow??(()=>performance.now());this.#set=ports?.setTimeout??setTimeout;this.#clear=ports?.clearTimeout??clearTimeout;
  if((!this.#owned&&typeof this.#signer?.sign!=='function')||[this.#request,this.#now,this.#monotonic,this.#set,this.#clear].some(f=>typeof f!=='function'))fail('NORMAL_POST_CONFIG_INVALID');
 }
 #clock(){const n=this.#now();if(!Number.isSafeInteger(n)||!Number.isFinite(new Date(n).getTime()))return fail('NORMAL_POST_CLOCK_INVALID');return n;}
 #live(){if(this.#clock()>=this.#credentialExpiry)fail('NORMAL_POST_CREDENTIAL_EXPIRED');}
 async #sign(purpose:NormalSignPurpose,bytes:Buffer,signal:AbortSignal){
  const until=Math.min(this.#credentialExpiry,this.#clock()+20000),controller=new AbortController();
  const owned=Buffer.from(bytes);let timer:ReturnType<typeof setTimeout>|undefined;
  let listener:()=>void=()=>{};
  const cancelled=new Promise<never>((_,reject)=>{
   listener=()=>{controller.abort();reject(new NormalProtectedPostError('NORMAL_POST_SIGNER_UNAVAILABLE'));};
   signal.addEventListener('abort',listener,{once:true});timer=this.#set(listener,Math.max(1,until-this.#clock()));
  });
  try{
   if(signal.aborted||this.#clock()>=until)listener();
   const pending=Promise.resolve().then(()=>{if(controller.signal.aborted)throw Error();return this.#signer.sign(purpose,owned,controller.signal);});
   const s=await Promise.race([pending,cancelled]);
   if(signal.aborted||controller.signal.aborted||this.#clock()>=until)fail('NORMAL_POST_SIGNER_UNAVAILABLE');
   if(!base64(s,64))fail('NORMAL_POST_SIGNATURE_INVALID');return s as string;
  }catch{return fail('NORMAL_POST_SIGNER_UNAVAILABLE');}
  finally{if(timer!==undefined)this.#clear(timer);signal.removeEventListener('abort',listener);controller.abort();owned.fill(0);}
 }
 /** challenge 발급 → proof 서명. 서버 challenge 기한(최대 30초)과 credential 기한 중 이른 시각까지만 packet을 쓸 수 있다. */
 async #prepare(path:string,bodyRaw:string,signal:AbortSignal){
  if(!(signal instanceof AbortSignal)||signal.aborted)fail('NORMAL_POST_CANCELLED');this.#live();
  if(this.#owned)return this.#owned.prepare({method:'POST',path,query:'',body:bodyRaw,expiresAt:new Date(this.#credentialExpiry).toISOString()},signal);
  let target:ReturnType<typeof executionTarget>;try{target=executionTarget('POST',path,[],bodyRaw);}catch{return fail('NORMAL_POST_INPUT_INVALID');}
  const s=this.#scope,request={requestId:randomUUID(),purpose:'EXECUTION_REQUEST',grantRef:cloneV1(s.grantRef),credentialGeneration:s.credentialGeneration,
   target,clientNonce:randomBytes(32).toString('base64url'),issuedAt:new Date(this.#clock()).toISOString()};
  const requestSignature=await this.#sign('EXECUTION_CHALLENGE_REQUEST',executionChallengeRequestBytes('EXECUTION',request),signal);
  const body=canonicalJson({...request,signature:requestSignature});
  // 발급 전에는 서버 효과가 없으므로 실패는 결과 불명이 아니다. 발급 응답 유실은 challenge가 남을 수 있음을 알린다.
  let reply:unknown;
  try{reply=await this.#send('POST',this.#base+'/challenges','',body,['Content-Type','application/json'],limits.CHALLENGE,
   Math.min(Date.parse(request.issuedAt)+30000,this.#credentialExpiry),signal,'CHALLENGE');}
  catch(e){if(e instanceof NormalProtectedPostError&&e.outcomeUnknown)e.challengeMayBeLive=true;throw e;}
  try{return await this.#afterChallenge(path,[],target,request,reply,signal);}
  catch(e){const out=e instanceof NormalProtectedPostError?e:new NormalProtectedPostError('NORMAL_POST_INPUT_INVALID');out.challengeMayBeLive=true;throw out;}
 }
 async #afterChallenge(path:string,query:[string,string][],target:ReturnType<typeof executionTarget>,request:{requestId:string;clientNonce:string;issuedAt:string},reply:any,signal:AbortSignal){
  const s=this.#scope,c=reply?.challenge;
  if(!recordV1(reply,['ref','challenge','credentialIssued','nonceConsumed','executionAuthorized','dispatchPerformed'])||!refV1(reply.ref)||reply.ref.version!==1||
    reply.credentialIssued!==false||reply.nonceConsumed!==false||reply.executionAuthorized!==false||reply.dispatchPerformed!==false||
    !recordV1(c,['id','requestId','purpose','grantRef','credentialGeneration','scopeDigest','serverNonce','clientNonce','issuedAt','expiresAt'])||c.id!==reply.ref.id||
    c.requestId!==request.requestId||c.purpose!=='EXECUTION_REQUEST'||!same(c.grantRef,s.grantRef)||c.credentialGeneration!==s.credentialGeneration||!hashV1(c.scopeDigest)||
    c.clientNonce!==request.clientNonce||!base64(c.serverNonce,32)||!isoV1(c.issuedAt)||!isoV1(c.expiresAt)||Date.parse(c.issuedAt)>this.#clock()||Date.parse(c.expiresAt)<=Date.parse(c.issuedAt)||
    Date.parse(c.expiresAt)>Date.parse(c.issuedAt)+30000||Date.parse(c.expiresAt)>this.#credentialExpiry||Date.parse(c.expiresAt)<=this.#clock())
   fail('NORMAL_POST_CHALLENGE_INVALID',0,true);
  const proof={requestId:request.requestId,...target,grantRef:cloneV1(s.grantRef),credentialGeneration:s.credentialGeneration,serverNonce:c.serverNonce};
  const proofSignature=await this.#sign('EXECUTION_REQUEST_PROOF',executionProofBytes('EXECUTION_REQUEST_PROOF',proof),signal);
  const wire=Buffer.from(canonicalJson({schemaVersion:1,challengeRef:reply.ref,proof,signature:proofSignature}));
  if(wire.length>4096)fail('NORMAL_POST_INPUT_INVALID');
  const suffix=query.length?'?'+new URLSearchParams(query).toString():'';
  return {path,query:suffix,auth:wire.toString('base64url'),challengeRef:cloneV1(reply.ref) as Ref,requestId:request.requestId,
   expiresAt:new Date(Math.min(Date.parse(c.expiresAt),this.#credentialExpiry)).toISOString()};
 }
 async preparePermit(commandId:string,raw:unknown,signal:AbortSignal):Promise<PreparedNormalPost>{
  if(!uuidV1(commandId)||!recordV1(raw,['envelopeHash','localAttemptRef','sourceObservationRefs','osOwnershipRef'])||
   !hashV1(raw.envelopeHash)||!refV1(raw.localAttemptRef)||!refV1(raw.osOwnershipRef)||!Array.isArray(raw.sourceObservationRefs)||
   raw.sourceObservationRefs.length<1||raw.sourceObservationRefs.length>200||!raw.sourceObservationRefs.every(refV1)||
   new Set(raw.sourceObservationRefs.map(canonicalJson)).size!==raw.sourceObservationRefs.length)fail('NORMAL_POST_INPUT_INVALID');
  const envelopeHash=raw.envelopeHash,body=canonicalJson(raw);if(Buffer.byteLength(body)>limits.PERMIT)fail('NORMAL_POST_INPUT_INVALID');
  const value=await this.#prepare(this.#base+'/commands/'+commandId+'/permit',body,signal);
  const p=Object.freeze({kind:'PERMIT' as const,path:value.path,auth:value.auth,challengeRef:value.challengeRef,requestId:value.requestId,expiresAt:value.expiresAt});
  this.#packets.set(p,{body,command:commandId,envelopeHash});return p;
 }
 async prepareObservations(raw:unknown,signal:AbortSignal):Promise<PreparedNormalPost>{
  if(!recordV1(raw,['events','batchHash'])||!Array.isArray(raw.events)||raw.events.length<1||raw.events.length>200||
    !hashV1(raw.batchHash)||contentHash(canonicalJson(raw.events))!==raw.batchHash)fail('NORMAL_POST_INPUT_INVALID');
  const body=canonicalJson(raw);if(Buffer.byteLength(body)>limits.OBSERVATIONS)fail('NORMAL_POST_INPUT_INVALID');
  const value=await this.#prepare(this.#base+'/observations',body,signal);
  const p=Object.freeze({kind:'OBSERVATIONS' as const,path:value.path,auth:value.auth,challengeRef:value.challengeRef,requestId:value.requestId,expiresAt:value.expiresAt});
  this.#packets.set(p,{body,command:null,envelopeHash:null});return p;
 }
 async send(p:PreparedNormalPost,signal:AbortSignal):Promise<NormalPermitResult|NormalObservationResult>{
  if(!(signal instanceof AbortSignal)||signal.aborted)fail('NORMAL_POST_CANCELLED');
  const saved=this.#packets.get(p);if(!saved)fail('NORMAL_POST_PACKET_INVALID');
  this.#live();const expiry=Date.parse(p.expiresAt);if(this.#clock()>=expiry)fail('NORMAL_POST_PACKET_EXPIRED');
  const raw:any=await this.#send('POST',p.path,'',saved.body,['Content-Type','application/json','Anvil-Execution-Auth',p.auth],
   limits.RESPONSE,Math.min(expiry,this.#credentialExpiry),signal,'POST');
  try{
   const variant=p.kind==='PERMIT'?'permit':'ack';
   if(!recordV1(raw,['transport','proofResultRef',variant,'cacheControl','nonceConsumed','executionAuthorized','dispatchPerformed'])||
    raw.transport!=='NORMAL_PROTECTED'||!refV1(raw.proofResultRef)||raw.cacheControl!=='no-store'||raw.nonceConsumed!==true||
    raw.dispatchPerformed!==false||raw.executionAuthorized!==(p.kind==='PERMIT'))throw Error();
   if(p.kind==='PERMIT'){
    const v=raw.permit,now=this.#clock();
    if(!recordV1(v,['ref','commandId','envelopeHash','issuedAt','expiresAt'])||!refV1(v.ref)||v.commandId!==saved.command||v.envelopeHash!==saved.envelopeHash||
     !isoV1(v.issuedAt)||!isoV1(v.expiresAt)||Date.parse(v.issuedAt)>now||Date.parse(v.expiresAt)<=now||
     Date.parse(v.expiresAt)>Math.min(Date.parse(v.issuedAt)+30000,expiry,this.#credentialExpiry))throw Error();
    // ref는 서버 full permit snapshot의 hash이며 축약 응답의 hash가 아니다.
   }else{
    const ack=raw.ack,v=ack?.snapshot,scope=this.#scope;
    if(!recordV1(ack,['ref','snapshot'])||!refV1(ack.ref)||!recordV1(v,['execution','highestContiguous','maxSequence','contiguousDigest','gaps','storedCount','writerReleaseVerified','executionAuthorized','dispatchPerformed','recordedAt'])||
     !same(v.execution,{projectId:scope.projectId,executionId:scope.executionId,executionGeneration:scope.executionGeneration})||
     ack.ref.contentHash!==contentHash(canonicalJson(v))||!isoV1(v.recordedAt)||Date.parse(v.recordedAt)>this.#clock()||
     v.writerReleaseVerified!==false||v.executionAuthorized!==false||v.dispatchPerformed!==false)throw Error();
   }
   return cloneV1(raw) as unknown as NormalPermitResult|NormalObservationResult;
  }catch{fail('NORMAL_POST_RESPONSE_INVALID',200,true);}
 }
 /** HTTPS 한 번. 리다이렉트·200 외 상태·JSON 아닌 응답·압축·상한 초과를 거절한다. 요청을 보낸 뒤의 연결 실패는 결과 불명이다. */
 #send(method:'GET'|'POST',path:string,query:string,bodyRaw:string|null,extra:string[],limit:number,expires:number,signal:AbortSignal,stage:'CHALLENGE'|'POST'):Promise<unknown>{
  if(this.#owned){const at=extra.indexOf('Anvil-Execution-Auth');return this.#owned.request({method,path,query,body:bodyRaw,auth:at<0?null:extra[at+1]!,expiresAt:new Date(expires).toISOString()},signal)
   .catch(()=>fail('NORMAL_POST_OUTCOME_UNKNOWN',0,true));}
  const started=this.#tick(),startedWall=this.#clock(),budget=Math.min(20000,expires-startedWall);
  if(budget<=0)return Promise.reject(new NormalProtectedPostError('NORMAL_POST_PACKET_EXPIRED'));
  return new Promise<unknown>((resolve,reject)=>{
   let done=false,sent=false,total=0,req:ClientRequest|undefined,res:IncomingMessage|undefined,timer:ReturnType<typeof setTimeout>|undefined,last=started;
   const chunks:Buffer[]=[],body=bodyRaw===null?null:Buffer.from(bodyRaw,'utf8');
   const unknownCode=stage==='POST'?'NORMAL_POST_OUTCOME_UNKNOWN':'NORMAL_POST_CHALLENGE_OUTCOME_UNKNOWN';
   const remaining=()=>{const t=this.#tick();if(t<last)throw new NormalProtectedPostError('NORMAL_POST_CLOCK_INVALID',0,sent);last=t;return Math.min(budget-(t-started),expires-this.#clock());};
   const destroy=()=>{try{res?.destroy();}catch{}try{req?.destroy();}catch{}};
   const cleanup=()=>{if(timer!==undefined){this.#clear(timer);timer=undefined;}signal.removeEventListener('abort',onAbort);
    if(req){req.removeListener('error',onLost);req.removeListener('close',onClose);req.on('error',ignoreLateError);}
    if(res){res.removeListener('data',onData);res.removeListener('end',onEnd);res.removeListener('aborted',onLost);res.removeListener('close',onClose);res.removeListener('error',onLost);res.on('error',ignoreLateError);}
    for(const c of chunks)c.fill(0);chunks.length=0;body?.fill(0);};
   const finish=(error:NormalProtectedPostError|null,value?:unknown)=>{if(done)return;done=true;cleanup();if(error){destroy();reject(error);}else resolve(value);};
   const err=(e:unknown,fallback:string)=>e instanceof NormalProtectedPostError?e:new NormalProtectedPostError(fallback,0,sent);
   const onAbort=()=>finish(new NormalProtectedPostError(sent?unknownCode:'NORMAL_POST_CANCELLED',0,sent));
   const onLost=()=>finish(new NormalProtectedPostError(sent?unknownCode:'NORMAL_POST_UNAVAILABLE',0,sent));
   const onClose=()=>{if(!done)onLost();};
   const current=()=>{if(signal.aborted)throw new NormalProtectedPostError(sent?unknownCode:'NORMAL_POST_CANCELLED',0,sent);
    if(remaining()<=0)throw new NormalProtectedPostError(sent?unknownCode:'NORMAL_POST_TIMEOUT',0,sent);};
   const onData=(part:unknown)=>{if(done)return;try{current();if(!(part instanceof Uint8Array)||part.byteLength>limit-total)throw new NormalProtectedPostError('NORMAL_POST_RESPONSE_LIMIT',200,sent);
    total+=part.byteLength;chunks.push(Buffer.from(part));}catch(e){finish(err(e,unknownCode));}};
   const onEnd=()=>{if(done)return;let bytes:Buffer|undefined;try{current();bytes=Buffer.concat(chunks,total);if(!bytes.length)throw Error();
    const text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);finish(null,parseWireJson(text));}
    catch(e){finish(e instanceof NormalProtectedPostError?e:new NormalProtectedPostError('NORMAL_POST_RESPONSE_INVALID',200,sent));}finally{bytes?.fill(0);}};
   const onResponse=(response:IncomingMessage)=>{
    if(done||res){response.on('error',ignoreLateError);try{response.destroy();}catch{}if(!done)finish(new NormalProtectedPostError('NORMAL_POST_RESPONSE_INVALID',0,sent));return;}
    res=response;
    try{current();const status=res.statusCode??0;
     // 4xx는 서버가 효과 없이 끝낸 것이다. 5xx는 COMMIT 불명(503)이나 프록시 시간초과·응답 직렬화 실패처럼 이미 소비됐을 수 있어 결과 불명이다.
     if(status>=300&&status<400)throw new NormalProtectedPostError('NORMAL_POST_REDIRECT_DENIED',status,false);
     if(status!==200)throw new NormalProtectedPostError(stage==='POST'?'NORMAL_POST_REJECTED':'NORMAL_POST_CHALLENGE_REJECTED',status,status>=500);
     const h=res.rawHeaders;if(!Array.isArray(h)||h.length%2||h.length>200)throw new NormalProtectedPostError('NORMAL_POST_RESPONSE_INVALID',status,sent);
     let type:string|null=null,cache:string|null=null;
     for(let i=0;i<h.length;i+=2){const name=h[i],value=h[i+1];
      if(typeof name!=='string'||typeof value!=='string'||/[\r\n]/.test(value))throw new NormalProtectedPostError('NORMAL_POST_RESPONSE_INVALID',status,sent);
      const n=name.toLowerCase();if(n==='content-type'){if(type!==null)throw new NormalProtectedPostError('NORMAL_POST_RESPONSE_INVALID',status,sent);type=value;}
      if(n==='cache-control'){if(cache!==null)throw Error();cache=value;}
      if(n==='content-encoding'&&value.toLowerCase()!=='identity')throw new NormalProtectedPostError('NORMAL_POST_RESPONSE_INVALID',status,sent);}
     if(stage==='POST'&&cache!=='no-store')throw new NormalProtectedPostError('NORMAL_POST_RESPONSE_INVALID',status,sent);
     if(!type||!/^application\/json(?:;\s*charset=utf-8)?$/i.test(type))throw new NormalProtectedPostError('NORMAL_POST_RESPONSE_INVALID',status,sent);
     res.on('data',onData);res.on('end',onEnd);res.on('aborted',onLost);res.on('close',onClose);res.on('error',onLost);
    }catch(e){finish(err(e,'NORMAL_POST_RESPONSE_INVALID'));}
   };
   try{
    current();if(body&&body.length>(stage==='CHALLENGE'?limits.CHALLENGE:limits.OBSERVATIONS))throw new NormalProtectedPostError('NORMAL_POST_INPUT_INVALID');
    // Origin·Cookie·CSRF는 보내지 않는다. 서버는 이 헤더가 있으면 거절한다.
    const headers:Record<string,string|number>={accept:'application/json',authorization:'Bearer '+this.#credential};
    if(body)headers['content-length']=body.length;
    for(let i=0;i<extra.length;i+=2)headers[extra[i]!.toLowerCase()]=extra[i+1]!;
    req=this.#request(new URL(path+query,this.#origin),{method,ca:this.#ca,rejectUnauthorized:true,agent:false,headers},onResponse);
    if(done){cleanup();destroy();return;}
    req.on('error',onLost);req.on('close',onClose);signal.addEventListener('abort',onAbort,{once:true});current();
    timer=this.#set(()=>finish(new NormalProtectedPostError(sent?unknownCode:'NORMAL_POST_TIMEOUT',0,sent)),Math.max(1,Math.ceil(remaining())));
    // 연결 전 실패(DNS·연결 거부·인증서 거절)도 보수적으로 결과 불명으로 본다. 같은 packet 재전송은 서버가 한 번만 소비한다.
    sent=true;body?req.end(body):req.end();
   }catch(e){finish(err(e,sent?unknownCode:'NORMAL_POST_UNAVAILABLE'));}
  });
 }
 #tick(){const t=this.#monotonic();if(!Number.isFinite(t))return fail('NORMAL_POST_CLOCK_INVALID');return t;}
}
