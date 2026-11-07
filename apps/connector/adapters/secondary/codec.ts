import {isPromise,isProxy} from 'node:util/types';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {recordV1,refV1,uuidV1} from '../../../../contracts/runtime/validation-v1.ts';
import {readSourceScopesV1} from '../../../../contracts/runtime/source-scope-v1.ts';
import type {AdapterContextV1} from '../../../../contracts/runtime/dispatch-envelope-v1.ts';
import {boundedSdkObject,maxSdkObjectBytes,sdkMessageShape,sdkOpaqueId,supportedSdkUser,SdkObjectFailure} from './schemas.ts';

interface CodecOptions {maxMessageBytes:number;maxIdentities:number;expectedSessionId:string;context:AdapterContextV1}
export interface CodecObservation {readonly kind:string;readonly contextDigest:string;readonly payloadDigest?:string;readonly commandDigest?:string;readonly sessionDigest?:string;readonly duplicate?:boolean;readonly family?:string;readonly resultSubtype?:string;readonly isErrorClaim?:boolean;readonly assistantErrorClaim?:string;readonly code?:string;readonly actualExecutionVerified:false;readonly executionAuthorized:false;readonly dispatched:false;readonly workAccepted:false;readonly ownership:'UNVERIFIED'}
interface CapturePort {capture(value:Readonly<Record<string,unknown>>):unknown}
const flags=Object.freeze({actualExecutionVerified:false,executionAuthorized:false,dispatched:false,workAccepted:false,ownership:'UNVERIFIED' as const});
const promiseThen=Promise.prototype.then;
function freezePrepared(value:Record<string,unknown>):Readonly<Record<string,unknown>> {for(const item of Object.values(value))if(item&&typeof item==='object')freezePrepared(item as Record<string,unknown>);return Object.freeze(value);}
const digest=(value:unknown)=>contentHash(canonicalJson(value));
/** 동기 메모리 객체 codec. 실행·저장·전송 중복방지나 공급자 진위는 보증하지 않는다. */
export class ClaudeSdkMessageCodec {
 #bytes:number;#limit:number;#session:string;#contextDigest:string;#sessionDigest:string;#capture:(value:Readonly<Record<string,unknown>>)=>unknown;
 #identities=new Map<string,{digest:string;recorded:boolean;facts:Readonly<Record<string,unknown>>}>();#busy=false;
 constructor(options:CodecOptions,port:CapturePort){
  if(!Number.isSafeInteger(options.maxMessageBytes)||options.maxMessageBytes<1||options.maxMessageBytes>maxSdkObjectBytes||!Number.isSafeInteger(options.maxIdentities)||options.maxIdentities<1||options.maxIdentities>1024||!sdkOpaqueId(options.expectedSessionId))throw Error('SDK_CONFIG_INVALID');
  const c=boundedSdkObject(options.context,maxSdkObjectBytes).value;
  if(!recordV1(c,['projectId','assignmentId','executionId','executionGeneration','connectionRef','environmentRef','authorizationReceiptRef','capabilityRef','budgetRef','sourceScopes'])||!['projectId','assignmentId','executionId'].every(k=>uuidV1(c[k]))||!Number.isSafeInteger(c.executionGeneration)||c.executionGeneration<1||!['connectionRef','environmentRef','authorizationReceiptRef','capabilityRef','budgetRef'].every(k=>refV1(c[k]))||!Array.isArray(c.sourceScopes))throw Error('SDK_CONTEXT_INVALID');
  if(c.sourceScopes.length)readSourceScopesV1(c.sourceScopes);
  if(!port||isProxy(port))throw Error('SDK_CAPTURE_REQUIRED');
  const capture=Object.getOwnPropertyDescriptor(port,'capture');if(!capture||!('value'in capture)||typeof capture.value!=='function')throw Error('SDK_CAPTURE_REQUIRED');
  const captureFunction=capture.value;this.#capture=value=>Reflect.apply(captureFunction,port,[value]);
  this.#bytes=options.maxMessageBytes;this.#limit=options.maxIdentities;this.#session=options.expectedSessionId;this.#sessionDigest=digest(this.#session);this.#contextDigest=digest(c);
 }
 #out(kind:string,extra:Record<string,unknown>={}):Readonly<CodecObservation>{return Object.freeze({kind,...extra,contextDigest:this.#contextDigest,...flags});}
 #failure(kind:string,error:unknown){return this.#out(kind,{code:error instanceof SdkObjectFailure?error.code:'INPUT_INVALID'});}
 #record(key:string,payloadDigest:string,facts:Record<string,unknown>,identifiers:Record<string,string>,kind:string,preparedUser?:Readonly<Record<string,unknown>>){
  if(this.#busy)return this.#out('UNKNOWN',{code:'CAPTURE_IN_PROGRESS'});
  const previous=this.#identities.get(key);
  if(previous)return previous.digest!==payloadDigest?this.#out('UNKNOWN',{code:'IDENTITY_CONTENT_CONFLICT'}):previous.recorded?this.#out(kind,{...previous.facts,duplicate:true}):this.#out('UNKNOWN',{code:'CAPTURE_OUTCOME_UNKNOWN'});
  if(this.#identities.size>=this.#limit)return this.#out('UNKNOWN',{code:'IDENTITY_LIMIT'});
  // 실패한 보호 관측도 정체성을 점유한다. 외부 효과가 불명이므로 자동 재호출하지 않는다.
  this.#identities.set(key,{digest:payloadDigest,recorded:false,facts:Object.freeze({code:'CAPTURE_OUTCOME_UNKNOWN'})});
  this.#busy=true;
  try{
   const result=this.#capture(Object.freeze({...identifiers,payloadDigest,contextDigest:this.#contextDigest,sessionDigest:this.#sessionDigest,...(preparedUser?{preparedUser}:{})}));
   // native Promise만 intrinsic then으로 거절을 소비한다. 임의 thenable은 호출하지 않는다.
   if(isPromise(result)){Reflect.apply(promiseThen,result,[()=>undefined,()=>undefined]);return this.#out('UNKNOWN',{code:'CAPTURE_OUTCOME_UNKNOWN'});}
   if(!recordV1(result,['state'])||result.state!=='RECORDED')return this.#out('UNKNOWN',{code:'CAPTURE_OUTCOME_UNKNOWN'});
   const saved=Object.freeze({...facts,payloadDigest,sessionDigest:this.#sessionDigest});
   this.#identities.set(key,{digest:payloadDigest,recorded:true,facts:saved});return this.#out(kind,{...saved,duplicate:false});
  }catch{return this.#out('UNKNOWN',{code:'CAPTURE_OUTCOME_UNKNOWN'});}finally{this.#busy=false;}
 }
 prepareUser(commandId:string,raw:unknown){
  if(!sdkOpaqueId(commandId))return this.#out('REJECTED',{code:'COMMAND_ID_INVALID'});
  try{const {value,digest:payloadDigest}=boundedSdkObject(raw,this.#bytes),shape=supportedSdkUser(value);
   if(shape!=='SUPPORTED')return this.#out('REJECTED',{code:shape==='INVALID'?'SDK_USER_INVALID':'SDK_USER_UNSUPPORTED'});
   if(Object.hasOwn(value,'session_id')&&value.session_id!==this.#session)return this.#out('REJECTED',{code:'SESSION_MISMATCH'});
   return this.#record('USER:'+commandId,payloadDigest,{commandDigest:digest(commandId)},{sessionId:this.#session,commandId},'USER_PREPARED',freezePrepared(value));
  }catch(error){return this.#failure('REJECTED',error);}
 }
 normalize(raw:unknown){
  try{const {value,digest:payloadDigest}=boundedSdkObject(raw,this.#bytes),shape=sdkMessageShape(value);
   if(shape.state!=='SUPPORTED')return this.#out(shape.state==='UNSUPPORTED'?'UNSUPPORTED':'UNKNOWN',{code:shape.code});
   if(shape.sessionId!==this.#session)return this.#out('UNKNOWN',{code:'SESSION_MISMATCH'});
   const claims:Record<string,unknown>={family:shape.family};
   if(value.type==='result'){claims.resultSubtype=value.subtype;claims.isErrorClaim=shape.isErrorClaim;}
   if(value.type==='assistant'&&Object.hasOwn(value,'error'))claims.assistantErrorClaim=value.error;
   return this.#record('SDK:'+shape.uuid,payloadDigest,claims,{sessionId:shape.sessionId,messageId:shape.uuid},'OBSERVED');
  }catch(error){return this.#failure('UNKNOWN',error);}
 }
}
