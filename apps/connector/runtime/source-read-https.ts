import {request,type RequestOptions} from 'node:https';
import type {ClientRequest,IncomingMessage} from 'node:http';
import {canonicalJson,contentHash,parseWireJson} from '../../../contracts/canonical.ts';
import {recordV1,refV1,uuidV1,type RuntimeRefV1} from '../../../contracts/runtime/validation-v1.ts';
import {readSourceReadScopeV1,readSourceReadPreflightV1,readSourceReadChallengeV1,readSourceReadPermitV1,sourceReadBase64V1,type SourceReadScopeV1,type SourceReadPreflightV1,type SourceReadChallengeV1,type SourceReadPermitV1} from '../../../contracts/runtime/source-read-observation-v1.ts';
import {readSourceReadReportV1,type SourceReadReportV1} from '../../../contracts/runtime/source-read-report-v1.ts';

export type SourceReadRequestFactory=(url:URL,options:RequestOptions,callback:(response:IncomingMessage)=>void)=>ClientRequest;
const flags=['executionAuthorized','agentDispatchPerformed','baselineConfirmed'];
const safeCodes=new Set(['SOURCE_READ_EXPIRED','SOURCE_READ_BASIS_NOT_CURRENT','SOURCE_READ_PROOF_INVALID','SOURCE_READ_EXCHANGE_RECONCILE_REQUIRED','SOURCE_READ_EXCHANGE_ATTEMPT_LIMIT','SOURCE_READ_CREDENTIAL_INVALID','SOURCE_READ_REPORT_CONFLICT','SOURCE_READ_INTEGRITY_FAILED','SOURCE_READ_TIME_INVALID','SOURCE_READ_INPUT_INVALID','NOT_FOUND']);
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
export class SourceReadHttpsError extends Error {readonly status:number;constructor(code:string,status=0){super(code);this.status=status;}}
const fail=(code='SOURCE_READ_INPUT_INVALID'):never=>{throw new SourceReadHttpsError(code);};
const noExecution=(v:Record<string,any>)=>flags.every(key=>v[key]===false);

/** 읽기 관측 전용. 서버 현재권한/서명·실 OS 증거는 별도이며 일반 실행 권한을 만들지 않는다. */
export class SourceReadHttpsClient {
 readonly #origin:string;readonly #ca:string;readonly #scope:SourceReadScopeV1;readonly #grant:RuntimeRefV1;readonly #request:SourceReadRequestFactory;readonly #now:()=>number;
 #state='INIT';#challenge:{id:string;payload:SourceReadChallengeV1}|null=null;#credential:string|null=null;#credentialExpiry:string|null=null;#permit:SourceReadPermitV1|null=null;#cancelPending:(()=>void)|null=null;
 constructor(options:{origin:string;ca:string;scope:unknown;grantRef:RuntimeRefV1},dependencies:{request?:SourceReadRequestFactory;now?:()=>number}={}){
  try{const url=new URL(options.origin);if(url.protocol!=='https:'||url.port!=='3830'||url.origin!==options.origin||url.username||url.password||url.pathname!=='/'||url.search||url.hash||typeof options.ca!=='string'||!options.ca||Buffer.byteLength(options.ca)>65536)throw Error();
   this.#scope=readSourceReadScopeV1(options.scope);if(!refV1(options.grantRef)||options.grantRef.version!==1||options.grantRef.contentHash!==contentHash(canonicalJson(this.#scope)))throw Error();this.#grant={...options.grantRef};this.#origin=url.origin;this.#ca=options.ca;
  }catch{throw new SourceReadHttpsError('SOURCE_READ_CONFIG_INVALID');}
  this.#request=dependencies.request??request;this.#now=dependencies.now??Date.now;
 }
 get state(){return this.#state;}
 close(){this.#state='CLOSED';this.#credential=null;this.#permit=null;this.#challenge=null;this.#cancelPending?.();}
 #active(){const now=this.#now();if(!Number.isSafeInteger(now)||now<Date.parse(this.#scope.requestedAt)||now>=Math.min(Date.parse(this.#scope.expiresAt),this.#credentialExpiry?Date.parse(this.#credentialExpiry):Infinity))fail('SOURCE_READ_EXPIRED');return now;}
 async #step<T>(expected:string,pending:string,next:string,action:()=>Promise<T>):Promise<T>{
  if(this.#state!==expected)fail('SOURCE_READ_RECONCILE_REQUIRED');this.#active();this.#state=pending;
  try{const value=await action();if(this.#state!==pending)fail('SOURCE_READ_CANCELLED');this.#active();this.#state=next;return value;}
  catch(error){this.#credential=null;this.#permit=null;this.#challenge=null;if(this.#state!=='CLOSED')this.#state='UNKNOWN';throw error instanceof SourceReadHttpsError?error:new SourceReadHttpsError('SOURCE_READ_RESPONSE_INVALID');}
 }
 async #send(suffix:string,body:unknown,max:number,signal?:AbortSignal):Promise<Record<string,any>>{
  this.#active();if(signal?.aborted)fail('SOURCE_READ_CANCELLED');
  const text=body===undefined?null:canonicalJson(body);if(text!==null&&Buffer.byteLength(text)>max)fail();
  const bytes=text===null?null:Buffer.from(text),path='/api/v1/connectors/'+this.#scope.connectorRef.id+'/source-read-grants/'+this.#grant.id+'/'+suffix;
  const remaining=Math.min(10000,Date.parse(this.#scope.expiresAt)-this.#now(),this.#credentialExpiry?Date.parse(this.#credentialExpiry)-this.#now():Infinity);
  return new Promise((resolve,reject)=>{
   let done=false,total=0,timer:ReturnType<typeof setTimeout>|undefined,req:ClientRequest|undefined;const chunks:Buffer[]=[];
   const finish=(error?:SourceReadHttpsError,value?:Record<string,any>)=>{if(done)return;done=true;if(timer)clearTimeout(timer);signal?.removeEventListener('abort',cancel);if(this.#cancelPending===cancel)this.#cancelPending=null;bytes?.fill(0);for(const chunk of chunks)chunk.fill(0);if(error)reject(error);else resolve(value!);};
   const cancel=()=>{finish(new SourceReadHttpsError('SOURCE_READ_CANCELLED'));req?.destroy();};
   this.#cancelPending=cancel;
   try{
    req=this.#request(new URL(path,this.#origin),{method:bytes?'POST':'GET',ca:this.#ca,rejectUnauthorized:true,agent:false,headers:{origin:this.#origin,accept:'application/json',...(bytes?{'content-type':'application/json','content-length':bytes.length}:{}),...(this.#credential?{authorization:'Bearer '+this.#credential}:{})}},response=>{
     if(done){response.destroy();return;}const status=response.statusCode??0;
     if(status>=300&&status<400){finish(new SourceReadHttpsError('SOURCE_READ_REDIRECT_DENIED',status));response.destroy();return;}
     response.on('data',(part:Buffer)=>{if(done)return;total+=part.length;if(total>max){finish(new SourceReadHttpsError('SOURCE_READ_RESPONSE_INVALID'));req?.destroy();return;}chunks.push(Buffer.from(part));});
     response.on('end',()=>{if(done)return;try{
      if(!/^application\/json(?:;|$)/i.test(String(response.headers['content-type']??''))||response.headers['content-encoding']&&response.headers['content-encoding']!=='identity')fail('SOURCE_READ_RESPONSE_INVALID');
      if(['permit','exchange'].includes(suffix)&&status===200&&!/(?:^|,)\s*no-store\s*(?:,|$)/i.test(String(response.headers['cache-control']??'')))fail('SOURCE_READ_RESPONSE_INVALID');
      const joined=Buffer.concat(chunks);let raw:string;try{raw=new TextDecoder('utf-8',{fatal:true}).decode(joined);}finally{joined.fill(0);}
      const value=parseWireJson(raw) as Record<string,any>;if(!value||typeof value!=='object'||Array.isArray(value))fail('SOURCE_READ_RESPONSE_INVALID');
      const errorCode=(value as Record<string,unknown>).code;
      if(status!==200)throw new SourceReadHttpsError(typeof errorCode==='string'&&safeCodes.has(errorCode)?errorCode:'SOURCE_READ_REQUEST_FAILED',status);
      finish(undefined,value);
     }catch(e){finish(e instanceof SourceReadHttpsError?e:new SourceReadHttpsError('SOURCE_READ_RESPONSE_INVALID'));}});
     response.on('error',()=>finish(new SourceReadHttpsError('SOURCE_READ_RESULT_UNKNOWN')));
     response.on('aborted',()=>finish(new SourceReadHttpsError('SOURCE_READ_RESULT_UNKNOWN')));
    });
    req.on('error',()=>finish(new SourceReadHttpsError('SOURCE_READ_RESULT_UNKNOWN')));
    timer=setTimeout(()=>{finish(new SourceReadHttpsError('SOURCE_READ_HTTPS_TIMEOUT'));req?.destroy();},Math.max(1,remaining));
    signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted){cancel();return;}req.end(bytes??undefined);
   }catch{finish(new SourceReadHttpsError('SOURCE_READ_RESULT_UNKNOWN'));req?.destroy();}
  });
 }
 async challenge(value:unknown,signature:string,signal?:AbortSignal){
  const p=readSourceReadPreflightV1(value),s=this.#scope;sourceReadBase64V1(signature,64);
  if(!same(p,{protocolVersion:1,purpose:'SOURCE_READ_PREFLIGHT',installationId:s.installationId,projectId:s.projectId,connectorId:s.connectorRef.id,registrationId:s.registrationRef.id,connectorGeneration:s.connectorRef.version,grantRef:this.#grant,scopeDigest:this.#grant.contentHash,publicKeyFingerprint:s.hostFingerprint,clientNonce:p.clientNonce,expiresAt:s.expiresAt}))fail();
  return this.#step('INIT','CHALLENGE_PENDING','CHALLENGED',async()=>{
   const v=await this.#send('exchange',{step:'CHALLENGE',preflight:p,signature},256*1024,signal);
   if(!recordV1(v,['status','grantRef','scopeDigest','challenge',...flags])||v.status!=='SOURCE_READ_EXCHANGE_PROOF_REQUIRED'||!noExecution(v)||!same(v.grantRef,this.#grant)||v.scopeDigest!==this.#grant.contentHash||!recordV1(v.challenge,['id','payload'])||!uuidV1(v.challenge.id))fail('SOURCE_READ_RESPONSE_INVALID');
   const payload=readSourceReadChallengeV1(v.challenge.payload);
   if(!same(payload,{...p,purpose:'SOURCE_READ_EXCHANGE',serverNonce:payload.serverNonce,issuedAt:payload.issuedAt,expiresAt:payload.expiresAt})||Date.parse(payload.issuedAt)<Date.parse(s.requestedAt)||Date.parse(payload.issuedAt)>this.#now()||Date.parse(payload.expiresAt)<=this.#now()||Date.parse(payload.expiresAt)>Date.parse(s.expiresAt))fail('SOURCE_READ_RESPONSE_INVALID');
   this.#challenge={id:v.challenge.id,payload};return structuredClone(this.#challenge);
  });
 }
 async issue(signature:string,signal?:AbortSignal){
  sourceReadBase64V1(signature,64);
  return this.#step('CHALLENGED','ISSUE_PENDING','ISSUED',async()=>{
   if(!this.#challenge||Date.parse(this.#challenge.payload.expiresAt)<=this.#now())fail('SOURCE_READ_EXPIRED');
   const v=await this.#send('exchange',{step:'ISSUE',challengeId:this.#challenge!.id,payload:this.#challenge!.payload,signature},256*1024,signal);
   if(!recordV1(v,['status','grantRef','scope','scopeDigest','credentialId','credential','expiresAt',...flags])||!noExecution(v)||v.status!=='SOURCE_READ_ISSUED'||!same(v.grantRef,this.#grant)||v.scope!=='SOURCE_OBSERVE_READ_ONLY'||v.scopeDigest!==this.#grant.contentHash||!uuidV1(v.credentialId)||typeof v.credential!=='string'||!/^av3sr1_[A-Za-z0-9_-]{43}$/.test(v.credential)||!Number.isFinite(Date.parse(v.expiresAt))||Date.parse(v.expiresAt)<=this.#now()||Date.parse(v.expiresAt)>Math.min(this.#now()+300000,Date.parse(this.#scope.expiresAt)))fail('SOURCE_READ_RESPONSE_INVALID');
   sourceReadBase64V1(v.credential.slice(7),32);this.#credential=v.credential;this.#credentialExpiry=v.expiresAt;
   return{credentialId:v.credentialId as string,expiresAt:v.expiresAt as string};
  });
 }
 async permit(signal?:AbortSignal){return this.#step('ISSUED','PERMIT_PENDING','PERMITTED',async()=>{
  const v=await this.#send('permit',undefined,512*1024,signal),permit=readSourceReadPermitV1(v,{scope:this.#scope,grantRef:this.#grant},this.#now());
  if(permit.expiresAt!==this.#credentialExpiry)fail('SOURCE_READ_RESPONSE_INVALID');this.#permit=permit;return structuredClone(permit);
 });}
 async report(value:SourceReadReportV1,signal?:AbortSignal){return this.#step('PERMITTED','REPORT_PENDING','DONE',async()=>{
  if(!this.#permit)fail();const report=readSourceReadReportV1(value,{scope:this.#scope,grantRef:this.#grant,credentialIssuedAt:this.#permit!.issuedAt,credentialExpiresAt:this.#permit!.expiresAt,receivedAt:new Date(this.#now()).toISOString()});
  const v=await this.#send('reports',report,1024*1024,signal),summary={rootState:report.root.state,total:report.files.length,observed:0,missing:0,denied:0,changed:0,unverified:0};
  for(const file of report.files)summary[({OBSERVED:'observed',MISSING:'missing',DENIED:'denied',CHANGED:'changed',UNVERIFIED:'unverified'} as const)[file.state]]++;
  if(!recordV1(v,['status','grantRef','scopeDigest','snapshotRef','observedSummary','evidenceClass','osVerification',...flags])||!noExecution(v)||v.status!=='REPORT_STORED'||!same(v.grantRef,this.#grant)||v.scopeDigest!==this.#grant.contentHash||!refV1(v.snapshotRef)||v.snapshotRef.version!==1||v.snapshotRef.contentHash!==report.contentHash||!same(v.observedSummary,summary)||v.evidenceClass!=='CONNECTOR_REPORTED'||v.osVerification!=='UNVERIFIED')fail('SOURCE_READ_RESPONSE_INVALID');
  this.#credential=null;this.#permit=null;this.#challenge=null;return structuredClone(v);
 });}
}
