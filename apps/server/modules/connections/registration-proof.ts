import {createHash,createPublicKey,verify} from 'node:crypto';
import {AuthFailure} from '../access/repository.ts';
import {canonicalJson} from '../../../../contracts/canonical.ts';
export interface HostProofPayload{protocolVersion:1;installationId:string;registrationId:string;scopeDigest:string;publicKeyFingerprint:string;serverNonce:string;clientNonce:string;expiresAt:string}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,hash=/^[0-9a-f]{64}$/;
export function canonicalBase64(value:unknown,size?:number):Buffer{if(typeof value!=='string'||value.length>4096||!/^[A-Za-z0-9_-]+$/.test(value))throw new AuthFailure('HOST_PROOF_INVALID',412);const bytes=Buffer.from(value,'base64url');if(bytes.toString('base64url')!==value||size!==undefined&&bytes.length!==size)throw new AuthFailure('HOST_PROOF_INVALID',412);return bytes;}
export function proofBytes(value:unknown):Buffer{
 const v=value as HostProofPayload;if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).sort().join(',')!=='clientNonce,expiresAt,installationId,protocolVersion,publicKeyFingerprint,registrationId,scopeDigest,serverNonce'||v.protocolVersion!==1||!uuid.test(v.installationId)||!uuid.test(v.registrationId)||!hash.test(v.scopeDigest)||!hash.test(v.publicKeyFingerprint)||typeof v.expiresAt!=='string'||!Number.isFinite(Date.parse(v.expiresAt))||new Date(v.expiresAt).toISOString()!==v.expiresAt)throw new AuthFailure('HOST_PROOF_INVALID',412);
 canonicalBase64(v.serverNonce,32);canonicalBase64(v.clientNonce,32);return Buffer.from(canonicalJson(v),'utf8');
}
export function readHostPublicKey(spki:unknown){
 const bytes=canonicalBase64(spki);try{const key=createPublicKey({key:bytes,format:'der',type:'spki'});if(key.asymmetricKeyType!=='ec'||key.asymmetricKeyDetails?.namedCurve!=='prime256v1'||!key.export({format:'der',type:'spki'}).equals(bytes))throw Error();return key;}catch{throw new AuthFailure('HOST_PROOF_INVALID',412);}
}
export function publicKeyFingerprint(spki:unknown):string{const key=readHostPublicKey(spki);return createHash('sha256').update(key.export({format:'der',type:'spki'})).digest('hex');}
export function verifyHostProof(spki:unknown,signature:unknown,payload:unknown,expected:HostProofPayload,now:Date):true{
 const bytes=proofBytes(payload),basis=proofBytes(expected),sig=canonicalBase64(signature,64);if(!(now instanceof Date)||!Number.isFinite(now.getTime()))throw new AuthFailure('HOST_PROOF_INVALID',412);
 if(Date.parse(expected.expiresAt)<=now.getTime())throw new AuthFailure('HOST_PROOF_EXPIRED',412);
 if(!bytes.equals(basis)||publicKeyFingerprint(spki)!==expected.publicKeyFingerprint)throw new AuthFailure('HOST_PROOF_INVALID',412);
 const key=readHostPublicKey(spki);try{if(!verify('sha256',bytes,{key,dsaEncoding:'ieee-p1363'},sig))throw Error();}catch{throw new AuthFailure('HOST_PROOF_INVALID',412);}return true;
}
