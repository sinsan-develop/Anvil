import {request as httpsRequest,type RequestOptions} from 'node:https';
import type {ClientRequest,IncomingMessage} from 'node:http';
import {cloneV1,recordV1,hashV1} from '../../../contracts/runtime/validation-v1.ts';
import {ExecutionObservationHttpError,readExecutionObservationOriginV1,prepareExecutionChallengeHttpV1,prepareExecutionObservationsHttpV1,readExecutionChallengeReplyV1,readExecutionObservationsReplyV1,type ExecutionObservationHttpRequest} from '../../../contracts/runtime/execution-observation-http-v1.ts';
export type ObservationHttpsRequestDriver=(url:URL,options:RequestOptions,callback:(response:IncomingMessage)=>void)=>ClientRequest;
interface Options {origin:string;ca:string;scope:unknown;credential:string;credentialExpiresAt:string;expectedScopeDigest?:string}
interface Ports {request?:ObservationHttpsRequestDriver;now?:()=>number;monotonicNow?:()=>number;setTimeout?:typeof setTimeout;clearTimeout?:typeof clearTimeout}
const ignoreLateError=()=>{};
const failure=(code:string,status=0)=>new ExecutionObservationHttpError(code,status);
/** 실제 Node HTTPS driver 코드다. 기본 등록·인증/키·현재허가 producer나 자동 요청은 제공하지 않는다.
 * constructor/import는 socket·파일 IO0이며 모든 테스트는 명시 request 대역만 소비한다. */
export class ExecutionObservationHttpsClient {
 readonly ackAudited=false;readonly writerReleaseVerified=false;readonly actualExecutionVerified=false;readonly executionAuthorized=false;readonly dispatchPerformed=false;
 #origin:string;#ca:string;#scope:unknown;#credential:string;#credentialExpiry:string;#expectedScopeDigest:string|undefined;
 #request:ObservationHttpsRequestDriver;#now:()=>number;#monotonic:()=>number;#set:typeof setTimeout;#clear:typeof clearTimeout;
 constructor(options:Options,ports:Ports={}){
  try{this.#origin=readExecutionObservationOriginV1(options.origin);if(typeof options.ca!=='string'||!options.ca||Buffer.byteLength(options.ca)>65536||typeof options.credential!=='string'||!/^av3ex1_[A-Za-z0-9_-]{43}$/.test(options.credential)||options.expectedScopeDigest!==undefined&&!hashV1(options.expectedScopeDigest))throw Error();this.#scope=cloneV1(options.scope);this.#ca=options.ca;this.#credential=options.credential;this.#credentialExpiry=options.credentialExpiresAt;this.#expectedScopeDigest=options.expectedScopeDigest;this.#request=ports.request??httpsRequest;this.#now=ports.now??Date.now;this.#monotonic=ports.monotonicNow??(()=>performance.now());this.#set=ports.setTimeout??setTimeout;this.#clear=ports.clearTimeout??clearTimeout;if([this.#request,this.#now,this.#monotonic,this.#set,this.#clear].some(v=>typeof v!=='function'))throw Error();}catch{throw failure('EXECUTION_HTTP_CONFIG_INVALID');}
 }
 #basis(){return{origin:this.#origin,scope:cloneV1(this.#scope),credential:this.#credential,credentialExpiresAt:this.#credentialExpiry,...(this.#expectedScopeDigest?{expectedScopeDigest:this.#expectedScopeDigest}:{})};}
 #clock(){const now=this.#now();if(!Number.isSafeInteger(now)||!Number.isFinite(new Date(now).getTime()))throw failure('EXECUTION_HTTP_CLOCK_INVALID');return now;}
 #tick(){const tick=this.#monotonic();if(!Number.isFinite(tick))throw failure('EXECUTION_HTTP_CLOCK_INVALID');return tick;}
 async challenge(request:unknown,signature:string,requestExpiresAt:string,signal?:AbortSignal){const started=this.#tick();try{const startedWall=this.#clock(),raw={...this.#basis(),request:cloneV1(request),signature,requestExpiresAt},prepared=prepareExecutionChallengeHttpV1(raw,startedWall);return await this.#send(prepared,16384,started,startedWall,signal,(bytes)=>readExecutionChallengeReplyV1(bytes,raw,this.#clock()));}catch(e){throw e instanceof ExecutionObservationHttpError?e:failure('EXECUTION_HTTP_INPUT_INVALID');}}
 async observations(input:unknown,signal?:AbortSignal){const started=this.#tick();try{const startedWall=this.#clock();if(!recordV1(input,['request','operation','issued','proof','signature','requestExpiresAt']))throw failure('EXECUTION_HTTP_INPUT_INVALID');const raw={...this.#basis(),...cloneV1(input)},prepared=prepareExecutionObservationsHttpV1(raw,startedWall);return await this.#send(prepared,1048576,started,startedWall,signal,(bytes)=>readExecutionObservationsReplyV1(bytes,raw,this.#clock()));}catch(e){throw e instanceof ExecutionObservationHttpError?e:failure('EXECUTION_HTTP_INPUT_INVALID');}}
 #send<T>(prepared:ExecutionObservationHttpRequest,limit:number,started:number,startedWall:number,signal:AbortSignal|undefined,decode:(bytes:Uint8Array)=>T):Promise<T>{
  return new Promise<T>((resolve,reject)=>{
   let done=false,total=0,req:ClientRequest|undefined,res:IncomingMessage|undefined,timer:ReturnType<typeof setTimeout>|undefined;const chunks:Buffer[]=[],body=Buffer.from(prepared.bodyRaw,'utf8');
   const budget=Math.min(10000,Date.parse(prepared.expiresAt)-startedWall);let lastTick=started;const remaining=()=>{const tick=this.#tick();if(tick<lastTick)throw failure('EXECUTION_HTTP_CLOCK_INVALID');lastTick=tick;return Math.min(budget-(tick-started),Date.parse(prepared.expiresAt)-this.#clock());};
   const destroy=()=>{try{res?.destroy();}catch{}try{req?.destroy();}catch{}};
   const cleanup=()=>{if(timer!==undefined){this.#clear(timer);timer=undefined;}signal?.removeEventListener('abort',onAbort);if(req){req.removeListener('error',onRequestError);req.removeListener('close',onRequestClose);req.removeListener('response',onResponse);req.on('error',ignoreLateError);}if(res){res.removeListener('data',onData);res.removeListener('end',onEnd);res.removeListener('aborted',onResponseAborted);res.removeListener('close',onResponseClose);res.removeListener('error',onResponseError);res.on('error',ignoreLateError);}for(const chunk of chunks)chunk.fill(0);chunks.length=0;body.fill(0);};
   const finish=(error:ExecutionObservationHttpError|null,value?:T)=>{if(done)return;done=true;cleanup();if(error){destroy();reject(error);}else resolve(value!);};
   const onAbort=()=>finish(failure('EXECUTION_HTTP_CANCELLED'));
   const onRequestError=()=>finish(failure('EXECUTION_HTTP_OUTCOME_UNKNOWN'));
   const onRequestClose=()=>{if(!done)finish(failure('EXECUTION_HTTP_OUTCOME_UNKNOWN'));};
   const onResponseError=()=>finish(failure('EXECUTION_HTTP_OUTCOME_UNKNOWN'));
   const onResponseAborted=()=>finish(failure('EXECUTION_HTTP_OUTCOME_UNKNOWN'));
   const onResponseClose=()=>{if(!done)finish(failure('EXECUTION_HTTP_OUTCOME_UNKNOWN'));};
   const current=()=>{if(signal?.aborted)throw failure('EXECUTION_HTTP_CANCELLED');if(remaining()<=0)throw failure('EXECUTION_HTTP_TIMEOUT');};
   const onData=(part:unknown)=>{if(done)return;try{current();if(!(part instanceof Uint8Array)||part.byteLength>limit-total)throw failure('EXECUTION_HTTP_RESPONSE_LIMIT');total+=part.byteLength;chunks.push(Buffer.from(part));}catch(e){finish(e instanceof ExecutionObservationHttpError?e:failure('EXECUTION_HTTP_OUTCOME_UNKNOWN'));}};
   const onEnd=()=>{if(done)return;let bytes:Buffer|undefined;try{current();bytes=Buffer.concat(chunks,total);const value=decode(bytes);current();finish(null,value);}catch(e){finish(e instanceof ExecutionObservationHttpError?e:failure('EXECUTION_HTTP_RESPONSE_INVALID'));}finally{bytes?.fill(0);}};
   const onResponse=(response:IncomingMessage)=>{if(done){response.on('error',ignoreLateError);try{response.destroy();}catch{}return;}if(res){response.on('error',ignoreLateError);try{response.destroy();}catch{}finish(failure('EXECUTION_HTTP_RESPONSE_INVALID'));return;}res=response;
    try{current();const status=res.statusCode??0;if(status>=300&&status<400)throw failure('EXECUTION_HTTP_REDIRECT_DENIED',status);if(status!==200)throw failure('EXECUTION_HTTP_STATUS_REJECTED',status);const headers=res.rawHeaders;if(!Array.isArray(headers)||headers.length%2||headers.length>200)throw failure('EXECUTION_HTTP_RESPONSE_INVALID');let contentType:string|null=null;for(let i=0;i<headers.length;i+=2){const name=headers[i],value=headers[i+1];if(typeof name!=='string'||typeof value!=='string'||/[\r\n]/.test(value))throw failure('EXECUTION_HTTP_RESPONSE_INVALID');if(name.toLowerCase()==='content-type'){if(contentType!==null)throw failure('EXECUTION_HTTP_RESPONSE_INVALID');contentType=value;}if(name.toLowerCase()==='content-encoding'&&value.toLowerCase()!=='identity')throw failure('EXECUTION_HTTP_RESPONSE_INVALID');}if(!contentType||!/^application\/json(?:;\s*charset=utf-8)?$/i.test(contentType))throw failure('EXECUTION_HTTP_RESPONSE_INVALID');res.on('data',onData);res.on('end',onEnd);res.on('aborted',onResponseAborted);res.on('close',onResponseClose);res.on('error',onResponseError);
    }catch(e){finish(e instanceof ExecutionObservationHttpError?e:failure('EXECUTION_HTTP_RESPONSE_INVALID'));}
   };
   try{if(signal!==undefined&&!(signal instanceof AbortSignal))throw failure('EXECUTION_HTTP_INPUT_INVALID');current();if(body.length>limit)throw failure('EXECUTION_HTTP_INPUT_INVALID');const headers:Record<string,string|number>={accept:'application/json','content-length':body.length};for(let i=0;i<prepared.rawHeaders.length;i+=2)headers[prepared.rawHeaders[i]!.toLowerCase()]=prepared.rawHeaders[i+1]!;
    req=this.#request(new URL(prepared.path,this.#origin),{method:'POST',ca:this.#ca,rejectUnauthorized:true,agent:false,headers},onResponse);if(done){cleanup();destroy();return;}req.on('error',onRequestError);req.on('close',onRequestClose);signal?.addEventListener('abort',onAbort,{once:true});current();timer=this.#set(()=>finish(failure('EXECUTION_HTTP_TIMEOUT')),Math.max(1,Math.ceil(remaining())));req.end(body);
   }catch(e){finish(e instanceof ExecutionObservationHttpError?e:failure('EXECUTION_HTTP_OUTCOME_UNKNOWN'));}
  });
 }
}
