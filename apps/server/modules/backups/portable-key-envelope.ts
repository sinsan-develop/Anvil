import {createCipheriv,createDecipheriv,randomBytes,scrypt} from 'node:crypto';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {readPortableKeyEnvelopeValue,readPortableKeyEnvelopeWire,readPortableKeyIdentity,validPortablePassphrase,portableBase64Bytes,type PortableKeyEnvelope,type PortableKeyIdentity} from '../../../../contracts/runtime/backup-installation-resources-v1.ts';

export function readPortableKeyEnvelope(raw:unknown,expected?:PortableKeyIdentity):PortableKeyEnvelope{
 const e=readPortableKeyEnvelopeWire(raw);
 if(expected!==undefined){const want=readPortableKeyIdentity(expected);for(const key of ['originProjectId','keyId','keyVersion','wrappingVersion','createdAt'] as const)if(e[key]!==want[key])throw Error('INPUT_INVALID');}
 return e;
}
export function portableKeyAAD(value:unknown):Buffer{const e=readPortableKeyEnvelopeValue(value);return Buffer.from(canonicalJson({format:e.format,originProjectId:e.originProjectId,keyId:e.keyId,keyVersion:e.keyVersion,wrappingVersion:e.wrappingVersion,createdAt:e.createdAt,kdf:e.kdf,aead:{name:e.aead.name,nonce:e.aead.nonce}}),'utf8');}
export function portableKeyHash(raw:unknown):string{return contentHash(canonicalJson(readPortableKeyEnvelope(raw)));}
export interface PortableKdfProfile{N:131072;r:8;p:1;dkLen:32;maxmem:268435456}
const profile:Readonly<PortableKdfProfile>=Object.freeze({N:131072,r:8,p:1,dkLen:32,maxmem:268435456});
type Derive=(passphrase:Buffer,salt:Buffer,options:Readonly<PortableKdfProfile>)=>Promise<Buffer>;
export interface PortableKeyCryptoPorts{derive?:Derive;randomBytes?:(size:number)=>Buffer}
const nodeDerive:Derive=(password,salt,options)=>new Promise((resolve,reject)=>scrypt(password,salt,options.dkLen,{N:options.N,r:options.r,p:options.p,maxmem:options.maxmem},(error,key)=>error?reject(error):resolve(key)));
// 프로세스 전체에서 한 KDF만 허용한다. 인스턴스를 새로 만들어도 대기열을 만들지 않는다.
let deriving=false;
export class PortableKeyEnvelopeCrypto{
 readonly #derive:Derive;readonly #random:(size:number)=>Buffer;
 constructor(ports:PortableKeyCryptoPorts={}){this.#derive=ports.derive??nodeDerive;this.#random=ports.randomBytes??randomBytes;}
 async #withKek<T>(passphrase:string,salt:Buffer,use:(key:Buffer)=>T):Promise<T>{
  if(deriving)throw Error('RESOURCE_LIMIT');deriving=true;
  const password=Buffer.from(passphrase,'utf8');let key:Buffer|undefined;
  try{key=await this.#derive(password,salt,profile);if(!Buffer.isBuffer(key)||key.length!==32)throw Error();return use(key);}
  catch{throw Error('KEY_UNLOCK_FAILED');}
  finally{
   try{password.fill(0);if(Buffer.isBuffer(key))key.fill(0);}catch{/* 소거는 best-effort이며 cleanup 오류도 외부 원문으로 반사하지 않는다. */}
   finally{deriving=false;}
  }
 }
 async wrap(input:{identity:PortableKeyIdentity;dek:Uint8Array;passphrase:string}):Promise<string>{
  const identity=readPortableKeyIdentity(input?.identity);
  if(!validPortablePassphrase(input?.passphrase)||!(input.dek instanceof Uint8Array)||input.dek.byteLength!==32)throw Error('INPUT_INVALID');
  let salt:Buffer,nonce:Buffer;
  try{salt=Buffer.from(this.#random(16));nonce=Buffer.from(this.#random(12));}catch{throw Error('KEY_UNLOCK_FAILED');}
  if(salt.length!==16||nonce.length!==12)throw Error('KEY_UNLOCK_FAILED');
  const owned=Buffer.from(input.dek);
  try{return await this.#withKek(input.passphrase,salt,key=>{
   const e:PortableKeyEnvelope={format:'ANVIL_PORTABLE_KEY_V1',...identity,kdf:{name:'scrypt',N:131072,r:8,p:1,dkLen:32,salt:salt.toString('base64url')},aead:{name:'AES-256-GCM',nonce:nonce.toString('base64url'),tag:Buffer.alloc(16).toString('base64url')},ciphertext:Buffer.alloc(32).toString('base64url')};
   const cipher=createCipheriv('aes-256-gcm',key,nonce,{authTagLength:16});cipher.setAAD(portableKeyAAD(e));
   const encrypted=Buffer.concat([cipher.update(owned),cipher.final()]);
   e.aead.tag=cipher.getAuthTag().toString('base64url');e.ciphertext=encrypted.toString('base64url');
   return canonicalJson(e);
  });}finally{owned.fill(0);}
 }
 async unwrap(raw:unknown,passphrase:string,expected:PortableKeyIdentity):Promise<Buffer>{
  const e=readPortableKeyEnvelope(raw,expected);if(!validPortablePassphrase(passphrase))throw Error('INPUT_INVALID');
  return this.#withKek(passphrase,portableBase64Bytes(e.kdf.salt,16),key=>{
   const decipher=createDecipheriv('aes-256-gcm',key,portableBase64Bytes(e.aead.nonce,12),{authTagLength:16});decipher.setAAD(portableKeyAAD(e));decipher.setAuthTag(portableBase64Bytes(e.aead.tag,16));
   let provisional:Buffer|undefined,final:Buffer|undefined;
   try{provisional=decipher.update(portableBase64Bytes(e.ciphertext,32));final=decipher.final();const result=Buffer.concat([provisional,final]);if(result.length!==32){result.fill(0);throw Error();}return result;}
   finally{provisional?.fill(0);final?.fill(0);}
  });
 }
}
