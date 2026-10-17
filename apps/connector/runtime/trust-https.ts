import {request} from 'node:https';
import {parseWireJson} from '../../../contracts/canonical.ts';
import {canonicalBase64,proofBytes,publicKeyFingerprint,type HostProofPayload} from '../../server/modules/connections/registration-proof.ts';

const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
const exact=(v:any,keys:string)=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===keys.split(',').sort().join(',');
const safeCodes=new Set(['ORIGIN_INVALID','CONNECTOR_HUMAN_CONFIRMATION_REQUIRED','ALREADY_ISSUED_RECONCILE','CONNECTOR_CREDENTIAL_INVALID','CONNECTOR_PROTOCOL_INPUT_INVALID','CONNECTOR_REGISTRATION_NOT_PENDING','CONNECTOR_CHALLENGE_EXPIRED','CONNECTOR_CHALLENGE_NOT_PENDING','CONNECTOR_FRESH_CLIENT_NONCE_REQUIRED','CONNECTOR_EXCHANGE_RECONCILE_REQUIRED','CONNECTOR_BASIS_NOT_CURRENT','CONNECTOR_HOST_OR_CODE_MISMATCH','CONNECTOR_ENROLLMENT_ALREADY_USED','CONNECTOR_PROOF_NOT_PENDING','CONNECTOR_PROOF_ATTEMPT_LIMIT','HOST_PROOF_INVALID','NOT_FOUND','AUTH_REQUIRED','CONNECTOR_CREDENTIAL_SCOPE_DENIED','CONNECTOR_CREDENTIAL_REQUIRED','CONNECTOR_REGISTRATION_INTEGRITY_FAILED','INPUT_INVALID']);
export class TrustHttpsError extends Error{readonly status:number;constructor(code:string,status=0){super(code);this.status=status;}}
export function readProtocolReply(status:number,body:string):Record<string,any>{
 if(Buffer.byteLength(body)>16384)throw new TrustHttpsError('CONNECTOR_RESPONSE_INVALID');
 if(status>=300&&status<400)throw new TrustHttpsError('CONNECTOR_REDIRECT_DENIED',status);
 let value:any;try{value=parseWireJson(body);}catch{throw new TrustHttpsError('CONNECTOR_RESPONSE_INVALID',status);}
 if(!value||typeof value!=='object'||Array.isArray(value))throw new TrustHttpsError('CONNECTOR_RESPONSE_INVALID',status);
 if(status!==200)throw new TrustHttpsError(safeCodes.has(value.code)?value.code:'CONNECTOR_REQUEST_FAILED',status);
 if(value.executionAuthorized!==false||!Array.isArray(value.grants)||value.grants.length)throw new TrustHttpsError('CONNECTOR_RESPONSE_INVALID');
 return value;
}
export class TrustHttpsClient{
 readonly origin:string;readonly #ca:string;
 constructor(options:{origin:string;ca:string}){let url:URL;try{url=new URL(options.origin);}catch{throw Error('CONNECTOR_HTTPS_CONFIG_INVALID');}if(url.protocol!=='https:'||url.port!=='3830'||url.origin!==options.origin||url.username||url.password||url.pathname!=='/'||url.search||url.hash||!options.ca||Buffer.byteLength(options.ca)>65536)throw Error('CONNECTOR_HTTPS_CONFIG_INVALID');this.origin=url.origin;this.#ca=options.ca;}
 async #send(path:string,body:unknown,credential?:string):Promise<Record<string,any>>{
  const bytes=body===undefined?null:Buffer.from(JSON.stringify(body));if(bytes&&bytes.length>16384){bytes.fill(0);throw new TrustHttpsError('CONNECTOR_PROTOCOL_INPUT_INVALID');}
  return new Promise((resolve,reject)=>{
   let done=false,total=0;const chunks:Buffer[]=[];
   const finish=(error?:Error,value?:Record<string,any>)=>{if(done)return;done=true;clearTimeout(timer);if(error)reject(error);else resolve(value!);};
   const req=request(new URL(path,this.origin),{method:bytes?'POST':'GET',ca:this.#ca,rejectUnauthorized:true,agent:false,headers:{origin:this.origin,accept:'application/json',...(bytes?{'content-type':'application/json','content-length':bytes.length}:{}),...(credential?{authorization:'Bearer '+credential}:{})}},res=>{
    if(res.statusCode&&res.statusCode>=300&&res.statusCode<400){finish(new TrustHttpsError('CONNECTOR_REDIRECT_DENIED',res.statusCode));res.destroy();return;}
    res.on('data',(part:Buffer)=>{total+=part.length;if(total>16384){finish(new TrustHttpsError('CONNECTOR_RESPONSE_INVALID'));req.destroy();}else chunks.push(part);});
    res.on('end',()=>{try{if(!/^application\/json(?:;|$)/i.test(String(res.headers['content-type']??'')))throw new TrustHttpsError('CONNECTOR_RESPONSE_INVALID');finish(undefined,readProtocolReply(res.statusCode??0,Buffer.concat(chunks).toString('utf8')));}catch(e){finish(e instanceof TrustHttpsError?e:new TrustHttpsError('CONNECTOR_RESPONSE_INVALID',res.statusCode));}});
    res.on('error',()=>finish(new TrustHttpsError('CONNECTOR_RESULT_UNKNOWN')));
   });
   const timer=setTimeout(()=>{finish(new TrustHttpsError('CONNECTOR_HTTPS_TIMEOUT'));req.destroy();},10000);
   req.on('error',(error:any)=>finish(new TrustHttpsError(/CERT|TLS|SELF_SIGNED|UNABLE_TO_VERIFY/.test(String(error.code))?'CONNECTOR_TLS_FAILED':'CONNECTOR_RESULT_UNKNOWN')));
   req.on('close',()=>bytes?.fill(0));req.end(bytes??undefined);
  });
 }
 async enroll(value:{registrationId:string;oneTimeCode:string;observedHostFingerprint:string;clientNonce:string;connectorVersion:string;publicKeySpki:string}){
  try{if(!exact(value,'registrationId,oneTimeCode,observedHostFingerprint,clientNonce,connectorVersion,publicKeySpki')||!uuid(value.registrationId)||!/^[A-Za-z0-9._+-]{1,80}$/.test(value.connectorVersion)||publicKeyFingerprint(value.publicKeySpki)!==value.observedHostFingerprint)throw Error();canonicalBase64(value.oneTimeCode,32);canonicalBase64(value.clientNonce,32);}catch{throw new TrustHttpsError('CONNECTOR_PROTOCOL_INPUT_INVALID');}
  return this.#send('/api/v1/connectors/enroll',value);
 }
 async prove(id:string,value:{challengeId:string;payload:HostProofPayload;signature:string}){if(!uuid(id)||!exact(value,'challengeId,payload,signature')||!uuid(value.challengeId))throw new TrustHttpsError('CONNECTOR_PROTOCOL_INPUT_INVALID');this.#proof(value);return this.#send('/api/v1/connectors/registrations/'+id+'/proof',value);}
 async exchange(id:string,value:{kind:'CHALLENGE'|'ISSUE';challengeId?:string;payload:HostProofPayload;signature:string}){if(!uuid(id)||value.kind==='CHALLENGE'&&!exact(value,'kind,payload,signature')||value.kind==='ISSUE'&&(!exact(value,'kind,challengeId,payload,signature')||!uuid(value.challengeId))||!['CHALLENGE','ISSUE'].includes(value.kind))throw new TrustHttpsError('CONNECTOR_PROTOCOL_INPUT_INVALID');this.#proof(value);return this.#send('/api/v1/connectors/registrations/'+id+'/exchange',value);}
 async status(id:string,credential:string){if(!uuid(id)||!/^av3ct1_[A-Za-z0-9_-]{43}$/.test(credential))throw new TrustHttpsError('CONNECTOR_PROTOCOL_INPUT_INVALID');return this.#send('/api/v1/connectors/'+id+'/registration-status',undefined,credential);}
 #proof(value:{payload:HostProofPayload;signature:string}){try{proofBytes(value.payload);canonicalBase64(value.signature,64);}catch{throw new TrustHttpsError('CONNECTOR_PROTOCOL_INPUT_INVALID');}}
}
