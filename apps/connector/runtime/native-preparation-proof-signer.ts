import {createHash,createPublicKey,verify,type KeyObject} from 'node:crypto';
import {canonicalJson,parseWireJson} from '../../../contracts/canonical.ts';
import {recordV1,uuidV1,isoV1,cloneV1} from '../../../contracts/runtime/validation-v1.ts';
import {nativeHash,nativeSame,nativeRequestProofBytes} from '../../../contracts/runtime/native-preparation-authority-v1.ts';
import {consumeNativeProofSigningContext,type NativeHttpsBinding} from './native-preparation-https.ts';
export interface NativeProofKeyMapping{binding:NativeHttpsBinding;keyId:string;publicKeySpki:string;fingerprint:string;expiresAt:string}
/** 현재 등록/키 사용 인가의 구체 공급자는 미등록이다. 선언 true로 대체하지 않는다. */
export interface NativeProofMappingSource{transport:'SOURCE_ONLY_MODEL';binding:NativeHttpsBinding;resolve(signal:AbortSignal):Promise<NativeProofKeyMapping>}
export interface NativeProofExchange{transport:'SOURCE_ONLY_MODEL';exchange(frame:string,signal:AbortSignal,remainingMs:()=>number):Promise<string>}
const unavailable=():never=>{throw Error('NATIVE_PROOF_SIGNER_UNAVAILABLE');};
const own=(v:object,k:string)=>{const d=Object.getOwnPropertyDescriptor(v,k);if(!d||!('value'in d))return unavailable();return d.value;};
function data(v:unknown,depth=0):void{if(depth>16)return unavailable();if(v&&typeof v==='object'){const proto=Object.getPrototypeOf(v);if(!Array.isArray(v)&&proto!==Object.prototype&&proto!==null)return unavailable();for(const k of Reflect.ownKeys(v)){if(typeof k!=='string')return unavailable();data(own(v,k),depth+1);}}else if(!['string','number','boolean','undefined'].includes(typeof v)&&v!==null)return unavailable();}
const shape=(v:unknown,keys:string[]):v is Record<string,any>=>{data(v);return recordV1(v,keys);};
function publicKey(spki:unknown,fingerprint:unknown):KeyObject{
 if(typeof spki!=='string'||spki.length>512||typeof fingerprint!=='string'||!/^[a-f0-9]{64}$/.test(fingerprint))return unavailable();const raw=Buffer.from(spki,'base64url');if(raw.toString('base64url')!==spki||createHash('sha256').update(raw).digest('hex')!==fingerprint)return unavailable();const key=createPublicKey({key:raw,format:'der',type:'spki'});if(key.asymmetricKeyType!=='ec'||key.asymmetricKeyDetails?.namedCurve!=='prime256v1'||!key.export({format:'der',type:'spki'}).equals(raw))return unavailable();return key;
}
/** import/constructor IO0. 실제 helper/키 조회를 실행하는 기본 exchange는 없다. */
export class NativePreparationProofSigner{
 readonly transport='SOURCE_ONLY_MODEL' as const;
 #mapping:NativeProofMappingSource|null;#exchange:NativeProofExchange|null;#resolve:unknown;#call:unknown;#binding:NativeHttpsBinding|null;#now:()=>number;#lastWall=-Infinity;
 constructor(mapping:NativeProofMappingSource|null=null,exchange:NativeProofExchange|null=null,ports:{now?:()=>number}={}){
  this.#mapping=mapping;this.#exchange=exchange;this.#resolve=mapping?own(mapping,'resolve'):null;this.#call=exchange?own(exchange,'exchange'):null;const binding=mapping?own(mapping,'binding'):null;if(binding)data(binding);this.#binding=binding?cloneV1(binding):null;this.#now=Object.hasOwn(ports,'now')?own(ports,'now'):Date.now;if(typeof this.#now!=='function')unavailable();
 }
 #ports(){const m=this.#mapping,e=this.#exchange;if(!m||!e||own(m,'transport')!=='SOURCE_ONLY_MODEL'||own(e,'transport')!=='SOURCE_ONLY_MODEL'||own(m,'resolve')!==this.#resolve||own(e,'exchange')!==this.#call||typeof this.#resolve!=='function'||typeof this.#call!=='function')return unavailable();data(own(m,'binding'));if(!nativeSame(own(m,'binding'),this.#binding))return unavailable();return{m,e};}
 readonly sign=async(bytes:Buffer,signal:AbortSignal,context?:object):Promise<string>=>{
  let copy:Buffer|undefined;
  try{
   const lease=consumeNativeProofSigningContext(context,bytes,signal);copy=Buffer.from(bytes);if(!copy.equals(nativeRequestProofBytes(lease.request))||!nativeSame(lease.binding,this.#binding))return unavailable();
   const check=(expiry?:string)=>{lease.remainingMs();this.#ports();const wall=this.#now();if(signal.aborted||!Number.isSafeInteger(wall)||wall<this.#lastWall||wall>=Date.parse(lease.callExpiresAt)||wall>=Date.parse(lease.authority.snapshot.expiresAt)||wall>=Date.parse(String(lease.challenge.expiresAt))||expiry!==undefined&&wall>=Date.parse(expiry))return unavailable();this.#lastWall=wall;return wall;};
   const resolve=async()=>{check();const p=this.#ports(),raw=await Reflect.apply(this.#resolve as Function,p.m,[signal]) as unknown;check();if(!shape(raw,['binding','keyId','publicKeySpki','fingerprint','expiresAt'])||!nativeSame(raw.binding,lease.binding)||!uuidV1(raw.keyId)||!isoV1(raw.expiresAt)||raw.fingerprint!==lease.authority.snapshot.scope.hostPublicKeyFingerprint)return unavailable();check(raw.expiresAt);publicKey(raw.publicKeySpki,raw.fingerprint);return cloneV1(raw) as NativeProofKeyMapping;};
   const mapping=await resolve();check(mapping.expiresAt);const remainingMs=Math.min(lease.remainingMs(),Math.floor(Date.parse(mapping.expiresAt)-check(mapping.expiresAt)));if(remainingMs<1||remainingMs>10000)return unavailable();const callExpiresAt=new Date(Math.min(Date.parse(lease.callExpiresAt),Date.parse(mapping.expiresAt))).toISOString();const frame=canonicalJson({operation:'SIGN_NATIVE_PREPARATION_PROOF',keyId:mapping.keyId,authority:lease.authority,challenge:lease.challenge,request:lease.request,remainingMs,callExpiresAt});if(Buffer.byteLength(frame)>65536)return unavailable();
   const p=this.#ports();check(mapping.expiresAt);const raw=await Reflect.apply(this.#call as Function,p.e,[frame,signal,()=>Math.min(lease.remainingMs(),Math.floor(Date.parse(mapping.expiresAt)-check(mapping.expiresAt)))]) as unknown;check(mapping.expiresAt);
   const after=await resolve();if(!nativeSame(after,mapping))return unavailable();check(mapping.expiresAt);if(typeof raw!=='string'||Buffer.byteLength(raw)>65536)return unavailable();const response=parseWireJson(raw);if(!shape(response,['keyId','publicKeySpki','fingerprint','requestHash','signature'])||response.keyId!==mapping.keyId||response.publicKeySpki!==mapping.publicKeySpki||response.fingerprint!==mapping.fingerprint||response.requestHash!==nativeHash(lease.request)||typeof response.signature!=='string')return unavailable();const signature=Buffer.from(response.signature,'base64url');if(signature.length!==64||signature.toString('base64url')!==response.signature||!verify('sha256',copy,{key:publicKey(response.publicKeySpki,response.fingerprint),dsaEncoding:'ieee-p1363'},signature))return unavailable();check(mapping.expiresAt);return response.signature;
  }catch{return unavailable();}finally{copy?.fill(0);}
 };
}
