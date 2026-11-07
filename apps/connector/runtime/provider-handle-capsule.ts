import {canonicalJson,parseWireJson} from '../../../contracts/canonical.ts';
import {providerBindingHash,type ProviderBindingInput} from '../../../contracts/runtime/provider-session-claim-v1.ts';

type Handles=Readonly<{threadId:string;turnId:string|null}>;
const invalid=():never=>{throw Error('PROVIDER_HANDLE_CAPSULE_INVALID');};
const handle=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9._:-]{1,512}$/.test(v);
function readHandles(raw:unknown,input:ProviderBindingInput):Handles{
 const v=JSON.parse(canonicalJson(raw));
 if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).sort().join(',')!=='threadId,turnId'
  ||!handle(v.threadId)||(input.kind==='THREAD'?v.turnId!==null:!handle(v.turnId)))return invalid();
 return Object.freeze({threadId:v.threadId,turnId:v.turnId});
}
/** Pure byte preparation only: no native invocation, persistence, capture or authority.
 * Caller owns returned bytes and must zero them; JS strings cannot be reliably erased. */
export function encodeProviderHandleCapsule(rawInput:unknown,rawHandles:unknown):Uint8Array{
 try{
  const bindingHash=providerBindingHash(rawInput),input=JSON.parse(canonicalJson(rawInput)) as ProviderBindingInput;
  const handles=readHandles(rawHandles,input);
  const bytes=new TextEncoder().encode(canonicalJson({schemaVersion:1,bindingHash,...handles}));
  if(bytes.byteLength>4096){bytes.fill(0);return invalid();}return bytes;
 }catch{return invalid();}
}
/** Caller retains ownership of bytes. A match is NOT native authenticity or permission;
 * file/ACL/identity/current-command checks remain separate. */
export function decodeProviderHandleCapsule(bytes:Uint8Array,rawInput:unknown):Handles{
 try{
  const bindingHash=providerBindingHash(rawInput),input=JSON.parse(canonicalJson(rawInput)) as ProviderBindingInput;
  if(!(bytes instanceof Uint8Array)||bytes.byteLength<1||bytes.byteLength>4096)return invalid();
  const text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes),v:any=parseWireJson(text);
  if(!v||Object.keys(v).sort().join(',')!=='bindingHash,schemaVersion,threadId,turnId'
   ||v.schemaVersion!==1||v.bindingHash!==bindingHash||canonicalJson(v)!==text)return invalid();
  return readHandles({threadId:v.threadId,turnId:v.turnId},input);
 }catch{return invalid();}
}
