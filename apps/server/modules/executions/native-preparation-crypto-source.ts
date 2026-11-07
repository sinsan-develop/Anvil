import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {recordV1,refV1,uuidV1,isoV1} from '../../../../contracts/runtime/validation-v1.ts';
import type {NativePreparationSource,NativePreparationHostSource} from './project-native-preparations.ts';
export interface NativePreparationCryptoPorts{randomBytes?:(size:number)=>Uint8Array;randomUUID?:()=>string;now?:()=>number}
const unavailable=():never=>{throw Error('NATIVE_CRYPTO_SOURCE_UNAVAILABLE');};
const own=(v:object,k:string)=>{const d=Object.getOwnPropertyDescriptor(v,k);if(!d||!('value'in d))return unavailable();return d.value;};
const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>{if(!recordV1(v,keys))return false;return keys.every(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return !!d&&'value'in d;});};
const sourceRef=(v:unknown)=>exact(v,['id','version','contentHash'])&&refV1(v);
const wipe=(value:unknown)=>{try{Uint8Array.prototype.fill.call(value as Uint8Array,0);}catch{}};
const asyncFunctionPrototype=Object.getPrototypeOf(async()=>{});
/** 준비용 난수 생산만 제공한다. 인증·현재권위·보호 delivery/ACK가 아니며 app에 기본 등록하지 않는다. */
export class NativePreparationCryptoSource{
 readonly transport='SOURCE_ONLY_MODEL' as const;
 #ports:NativePreparationCryptoPorts;#keys:string[];#random:(size:number)=>Uint8Array;#uuid:()=>string;#now:()=>number;#lastWall=-Infinity;
 constructor(ports:NativePreparationCryptoPorts={}){
  const read=()=>{try{if(!ports||typeof ports!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(ports))||Object.getOwnPropertySymbols(ports).length)return unavailable();const keys=Object.getOwnPropertyNames(ports).sort();if(keys.some(k=>!['randomBytes','randomUUID','now'].includes(k)))return unavailable();const random=Object.hasOwn(ports,'randomBytes')?own(ports,'randomBytes'):((size:number)=>randomBytes(size)),uuid=Object.hasOwn(ports,'randomUUID')?own(ports,'randomUUID'):randomUUID,now=Object.hasOwn(ports,'now')?own(ports,'now'):Date.now;if([random,uuid,now].some(v=>typeof v!=='function'))return unavailable();return{keys,random:random as (size:number)=>Uint8Array,uuid:uuid as ()=>string,now:now as ()=>number};}catch{return unavailable();}};
  const config=read();this.#ports=ports;this.#keys=config.keys;this.#random=config.random;this.#uuid=config.uuid;this.#now=config.now;
 }
 #same(){if(Object.getOwnPropertySymbols(this.#ports).length||Object.getOwnPropertyNames(this.#ports).sort().join(',')!==this.#keys.join(','))return unavailable();for(const key of this.#keys){const expected=key==='randomBytes'?this.#random:key==='randomUUID'?this.#uuid:this.#now;if(own(this.#ports,key)!==expected)return unavailable();}}
 #check(expires?:number){this.#same();const now=this.#now();this.#same();if(!Number.isSafeInteger(now)||!Number.isFinite(new Date(now).getTime())||now<this.#lastWall||expires!==undefined&&now>=expires)return unavailable();this.#lastWall=now;return now;}
 readonly allocate:NativePreparationSource['allocate']=(count)=>{try{if(!Number.isSafeInteger(count)||![1,2,4,5].includes(count))return unavailable();this.#check();const ids:string[]=[];for(let i=0;i<count;i++){this.#check();const id=this.#uuid();this.#check();if(!uuidV1(id)||ids.includes(id))return unavailable();ids.push(id);}return ids;}catch{return unavailable();}};
 readonly nonce:NativePreparationHostSource['nonce']=()=>{let raw:Uint8Array|undefined,copy:Buffer|undefined;try{this.#check();raw=this.#random(32);this.#check();if(!(raw instanceof Uint8Array)||raw.byteLength!==32)return unavailable();copy=Buffer.from(raw);const value=copy.toString('base64url');this.#check();return value;}catch{return unavailable();}finally{wipe(copy);wipe(raw);}};
 readonly credential:NativePreparationSource['credential']=async(_db,_actor,input)=>{
  let raw:Uint8Array|undefined,random:Buffer|undefined,opaque:Buffer|undefined,view:Uint8Array|undefined;
  try{
   if(!exact(input,['registrationRef','channelProfileRef','expiresAt','acceptSecret'])||!sourceRef(input.registrationRef)||!sourceRef(input.channelProfileRef)||!isoV1(input.expiresAt)||typeof input.acceptSecret!=='function'||Object.getPrototypeOf(input.acceptSecret)===asyncFunctionPrototype)return unavailable();const accept=input.acceptSecret,expires=Date.parse(input.expiresAt),now=this.#check();if(expires<=now||expires-now>120000)return unavailable();
   const credentialId=this.#uuid();this.#check(expires);if(!uuidV1(credentialId))return unavailable();raw=this.#random(32);this.#check(expires);if(!(raw instanceof Uint8Array)||raw.byteLength!==32)return unavailable();random=Buffer.from(raw);opaque=Buffer.from(random.toString('base64url'),'ascii');if(opaque.length!==43)return unavailable();const credentialDigest=createHash('sha256').update(opaque).digest('hex');view=Uint8Array.from(opaque);
   this.#check(expires);if(own(input,'acceptSecret')!==accept)return unavailable();const result:unknown=Reflect.apply(accept,undefined,[view]);if(result!==undefined){if(result instanceof Promise)void Promise.prototype.then.call(result,()=>{},()=>{});return unavailable();}this.#check(expires);if(own(input,'acceptSecret')!==accept)return unavailable();return{credentialId,credentialGeneration:1,credentialDigest};
  }catch{return unavailable();}finally{wipe(view);wipe(opaque);wipe(random);wipe(raw);}
 };
}
