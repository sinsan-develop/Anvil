import {canonicalJson,parseWireJson} from '../../../contracts/canonical.ts';
import {providerBindingHash,providerProtectedHandleRef,validateProviderSessionClaim,verifyProviderHandleBinding} from '../../../contracts/runtime/provider-session-claim-v1.ts';
import {encodeProviderHandleCapsule,decodeProviderHandleCapsule} from './provider-handle-capsule.ts';

const invalid=():never=>{throw Error('PROVIDER_HANDLE_PROTOCOL_INVALID');};
const exact=(v:any,keys:string[])=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
const hash=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
function frame(v:unknown):Uint8Array{const bytes=new TextEncoder().encode(canonicalJson(v));if(bytes.length>16384){bytes.fill(0);return invalid();}return bytes;}
function reply(bytes:Uint8Array,keys:string[]):any{
 if(!(bytes instanceof Uint8Array)||bytes.length<1||bytes.length>16384)invalid();
 const v:any=parseWireJson(new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes));
 if(!exact(v,['ok','data'])||v.ok!==true||!exact(v.data,keys)||!hash(v.data.ciphertextHash))invalid();return v.data;
}
/** Protocol only: no spawn, root creation, credential operation or permission.
 * Raw identifiers belong only to the owned private-pipe frame; caller must wipe it.
 * JS string/GC erasure is not guaranteed. Native identity/current/prepared journal
 * checks are the caller's separate prerequisites, NOT authenticated by this codec. */
export function encodeProviderCaptureRequest(rawInput:unknown,handles:unknown):Uint8Array{
 let capsule:Uint8Array|undefined;
 try{
  const bindingHash=providerBindingHash(rawInput),input=JSON.parse(canonicalJson(rawInput));
  capsule=encodeProviderHandleCapsule(input,handles);
  return frame({operation:'CREATE_PROVIDER_HANDLE',claimId:input.claimId,bindingHash,kind:input.kind,capturedAt:input.capturedAt,usableBefore:input.usableBefore,capsule:Buffer.from(capsule.buffer,capsule.byteOffset,capsule.byteLength).toString('base64url')});
 }catch{return invalid();}finally{capsule?.fill(0);}
}
export function readProviderCaptureReply(bytes:Uint8Array,rawInput:unknown){
 try{const v=reply(bytes,['ciphertextHash']),protectedHandleRef=providerProtectedHandleRef(rawInput,v.ciphertextHash);
  return{protectedHandleRef,ciphertextHash:v.ciphertextHash as string,executionAuthorized:false as const};
 }catch{return invalid();}
}
export function encodeProviderResolveRequest(rawClaim:unknown,ciphertextHash:string,parent?:unknown):Uint8Array{
 try{
  const{claim}=validateProviderSessionClaim(rawClaim,parent);verifyProviderHandleBinding(claim,ciphertextHash,parent);
  const{protectedHandleRef:_,...input}=claim;
  return frame({operation:'RESOLVE_PROVIDER_HANDLE',claimId:claim.claimId,bindingHash:providerBindingHash(input),kind:claim.kind,capturedAt:claim.capturedAt,usableBefore:claim.usableBefore,ciphertextHash});
 }catch{return invalid();}
}
/** Success transfers plaintext bytes to the private reader, which must wipe them.
 * A response with matching metadata is not proof of DPAPI/OS identity/current authority. */
export function readProviderResolveReply(bytes:Uint8Array,rawClaim:unknown,ciphertextHash:string,parent?:unknown):Uint8Array{
 let plaintext:Buffer|undefined;
 try{
  const{claim}=validateProviderSessionClaim(rawClaim,parent);verifyProviderHandleBinding(claim,ciphertextHash,parent);
  const v=reply(bytes,['ciphertextHash','plaintext']);
  if(v.ciphertextHash!==ciphertextHash||typeof v.plaintext!=='string'||v.plaintext.length<1||v.plaintext.length>5462||!/^[A-Za-z0-9_-]+$/.test(v.plaintext))invalid();
  plaintext=Buffer.from(v.plaintext,'base64url');if(plaintext.length>4096||plaintext.toString('base64url')!==v.plaintext)invalid();
  const{protectedHandleRef:_,...input}=claim;decodeProviderHandleCapsule(plaintext,input);
  const returned=plaintext;plaintext=undefined;return returned;
 }catch{return invalid();}finally{plaintext?.fill(0);}
}
