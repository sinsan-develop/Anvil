import {canonicalJson,parseWireJson} from '../canonical.ts';
import {cloneV1,hashV1,isoV1,recordV1,refV1,uuidV1,type RuntimeRefV1} from './validation-v1.ts';

export const installationResourceActions=['REGISTER_TARGET','ENROLL_KEY','IMPORT_KEY','VERIFY_KEY_COPY','UNLOCK_KEY','REWRAP_KEY','ROTATE_KEY'] as const;
export type InstallationResourceAction=typeof installationResourceActions[number];
export interface PortableKeyIdentity{originProjectId:string;keyId:string;keyVersion:number;wrappingVersion:number;createdAt:string}
export interface PortableKeyEnvelope extends PortableKeyIdentity{format:'ANVIL_PORTABLE_KEY_V1';kdf:{name:'scrypt';N:131072;r:8;p:1;dkLen:32;salt:string};aead:{name:'AES-256-GCM';nonce:string;tag:string};ciphertext:string}
export interface ManageBackupResourcePayload{action:InstallationResourceAction;resourceRef:RuntimeRefV1|null;expectedResourceVersion:number;expectedLeaseGeneration:number|null;slotId:string|null;displayName:string|null;envelopeHash:string|null;reason:string}
const invalid=():never=>{throw Error('INPUT_INVALID');};
const positive=(v:unknown):v is number=>Number.isSafeInteger(v)&&Number(v)>0;
const text=(v:unknown,max:number):v is string=>typeof v==='string'&&v.isWellFormed()&&v.length>=1&&v.length<=max&&!!v.trim()&&!/[\u0000-\u001f\u007f-\u009f]/.test(v);
export function readPortableKeyIdentity(v:unknown):PortableKeyIdentity{if(!recordV1(v,['originProjectId','keyId','keyVersion','wrappingVersion','createdAt'])||!uuidV1(v.originProjectId)||!uuidV1(v.keyId)||!positive(v.keyVersion)||!positive(v.wrappingVersion)||!isoV1(v.createdAt))return invalid();return cloneV1(v) as PortableKeyIdentity;}
export function portableBase64Bytes(v:unknown,size:number):Buffer{if(typeof v!=='string'||v.length!==Math.ceil(size*8/6)||!/^[A-Za-z0-9_-]+$/.test(v))return invalid();const b=Buffer.from(v,'base64url');if(b.length!==size||b.toString('base64url')!==v)return invalid();return b;}
export function readPortableKeyEnvelopeValue(v:unknown):PortableKeyEnvelope{
 if(!recordV1(v,['format','originProjectId','keyId','keyVersion','wrappingVersion','createdAt','kdf','aead','ciphertext'])||v.format!=='ANVIL_PORTABLE_KEY_V1')return invalid();
 readPortableKeyIdentity({originProjectId:v.originProjectId,keyId:v.keyId,keyVersion:v.keyVersion,wrappingVersion:v.wrappingVersion,createdAt:v.createdAt});
 if(!recordV1(v.kdf,['name','N','r','p','dkLen','salt'])||v.kdf.name!=='scrypt'||v.kdf.N!==131072||v.kdf.r!==8||v.kdf.p!==1||v.kdf.dkLen!==32||!recordV1(v.aead,['name','nonce','tag'])||v.aead.name!=='AES-256-GCM')return invalid();
 portableBase64Bytes(v.kdf.salt,16);portableBase64Bytes(v.aead.nonce,12);portableBase64Bytes(v.aead.tag,16);portableBase64Bytes(v.ciphertext,32);
 return cloneV1(v) as PortableKeyEnvelope;
}
export function readPortableKeyEnvelopeWire(raw:unknown):PortableKeyEnvelope{
 let value:string;
 if(typeof raw==='string'){if(!raw.isWellFormed())return invalid();value=raw;}
 else if(raw instanceof Uint8Array){if(raw.byteLength>16384)return invalid();try{value=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(raw);}catch{return invalid();}}
 else return invalid();
 if(Buffer.byteLength(value,'utf8')>16384)return invalid();
 let parsed:unknown;try{parsed=parseWireJson(value);}catch{return invalid();}
 if(canonicalJson(parsed)!==value)return invalid();return readPortableKeyEnvelopeValue(parsed);
}
export function readManageBackupResourcePayload(v:unknown):ManageBackupResourcePayload{
 if(!recordV1(v,['action','resourceRef','expectedResourceVersion','expectedLeaseGeneration','slotId','displayName','envelopeHash','reason'])||!installationResourceActions.includes(v.action)||!text(v.reason,2000))return invalid();
 const fresh=['REGISTER_TARGET','ENROLL_KEY','IMPORT_KEY'].includes(v.action),named=fresh||v.action==='ROTATE_KEY',hashed=['IMPORT_KEY','VERIFY_KEY_COPY','UNLOCK_KEY','REWRAP_KEY'].includes(v.action);
 if(fresh?(v.resourceRef!==null||v.expectedResourceVersion!==0):(!refV1(v.resourceRef)||v.expectedResourceVersion!==v.resourceRef.version))return invalid();
 if(fresh?!uuidV1(v.slotId):v.slotId!==null)return invalid();
 if(named?!text(v.displayName,120):v.displayName!==null)return invalid();
 if(hashed?!hashV1(v.envelopeHash):v.envelopeHash!==null)return invalid();
 if(v.action==='UNLOCK_KEY'?(!Number.isSafeInteger(v.expectedLeaseGeneration)||v.expectedLeaseGeneration<0):v.expectedLeaseGeneration!==null)return invalid();
 return cloneV1(v) as ManageBackupResourcePayload;
}
export function validPortablePassphrase(v:unknown):v is string{return typeof v==='string'&&v.length>=20&&v.length<=512&&v.isWellFormed()&&Buffer.byteLength(v,'utf8')<=1024&&Array.from(v).length>=20&&Array.from(v).length<=256;}
export type InstallationSecretInput=null|{passphrase:string;confirmPassphrase:string}|{passphrase:string;envelope:string}|{oldPassphrase:string;newPassphrase:string;confirmPassphrase:string};
export function readInstallationSecretInput(action:unknown,v:unknown):InstallationSecretInput{
 if(action==='REGISTER_TARGET'){if(v!==null)return invalid();return null;}
 if(action==='ENROLL_KEY'||action==='ROTATE_KEY'){if(!recordV1(v,['passphrase','confirmPassphrase'])||!validPortablePassphrase(v.passphrase)||v.confirmPassphrase!==v.passphrase)return invalid();}
 else if(action==='IMPORT_KEY'||action==='VERIFY_KEY_COPY'||action==='UNLOCK_KEY'){if(!recordV1(v,['passphrase','envelope'])||!validPortablePassphrase(v.passphrase)||typeof v.envelope!=='string')return invalid();readPortableKeyEnvelopeWire(v.envelope);}
 else if(action==='REWRAP_KEY'){if(!recordV1(v,['oldPassphrase','newPassphrase','confirmPassphrase'])||!validPortablePassphrase(v.oldPassphrase)||!validPortablePassphrase(v.newPassphrase)||v.confirmPassphrase!==v.newPassphrase)return invalid();}
 else return invalid();
 return cloneV1(v) as InstallationSecretInput;
}
