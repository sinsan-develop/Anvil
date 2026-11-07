import {canonicalJson,contentHash} from '../canonical.ts';

export interface ProviderRef {id:string;version:number;contentHash:string}
export interface ProviderBindingInput {
 schemaVersion:1;claimId:string;kind:'THREAD'|'TURN';projectId:string;
 assignmentRef:ProviderRef;agentSessionRef:ProviderRef;responsibleBindingRef:ProviderRef;
 connectionRef:ProviderRef;environmentRef:ProviderRef;executorRegistrationRef:ProviderRef;
 execution:{id:string;generation:number};commandId:string;envelopeHash:string;
 authorizationReceiptRef:ProviderRef;permitRef:ProviderRef;localAttemptRef:ProviderRef;
 provider:{product:'CODEX_APP_SERVER';version:'0.161.0'};parentThreadClaimRef:ProviderRef|null;
 source:{method:'thread/start'|'turn/start'|'turn/steer';requestIdDigest:string;responseRef:ProviderRef;responsePayloadDigest:string};
 capturedAt:string;usableBefore:string;
}
export interface ProviderSessionClaim extends ProviderBindingInput {protectedHandleRef:ProviderRef}
const fields=['schemaVersion','claimId','kind','projectId','assignmentRef','agentSessionRef','responsibleBindingRef','connectionRef','environmentRef','executorRegistrationRef','execution','commandId','envelopeHash','authorizationReceiptRef','permitRef','localAttemptRef','provider','parentThreadClaimRef','source','capturedAt','usableBefore'];
const refFields=['assignmentRef','agentSessionRef','responsibleBindingRef','connectionRef','environmentRef','executorRegistrationRef','authorizationReceiptRef','permitRef','localAttemptRef'] as const;
const uuid=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
const hex=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const positive=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>0;
const exact=(v:any,keys:string[])=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
const ref=(v:any):v is ProviderRef=>exact(v,['id','version','contentHash'])&&uuid(v.id)&&positive(v.version)&&hex(v.contentHash);
const utc=(v:any)=>typeof v==='string'&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
function invalid():never{throw Error('PROVIDER_SESSION_CLAIM_INVALID');}
function plain(raw:unknown):any {
 // Canonical traversal rejects accessors without invoking them and prevents lossy cloning.
 try{return JSON.parse(canonicalJson(raw));}catch{return invalid();}
}
function input(raw:unknown):ProviderBindingInput {
 const v=plain(raw);
 if(!exact(v,fields)||v.schemaVersion!==1||!uuid(v.claimId)||!uuid(v.projectId)||!['THREAD','TURN'].includes(v.kind)
  ||!refFields.every(k=>ref(v[k]))||!exact(v.execution,['id','generation'])||!uuid(v.execution.id)||!positive(v.execution.generation)
  ||!uuid(v.commandId)||!hex(v.envelopeHash)||!exact(v.provider,['product','version'])||v.provider.product!=='CODEX_APP_SERVER'||v.provider.version!=='0.161.0'
  ||!exact(v.source,['method','requestIdDigest','responseRef','responsePayloadDigest'])||!hex(v.source.requestIdDigest)||!ref(v.source.responseRef)||v.source.responseRef.id===v.claimId||!hex(v.source.responsePayloadDigest)
  ||!utc(v.capturedAt)||!utc(v.usableBefore)||Date.parse(v.usableBefore)<=Date.parse(v.capturedAt)||Date.parse(v.usableBefore)-Date.parse(v.capturedAt)>86400000
  ||(v.kind==='THREAD'?(v.parentThreadClaimRef!==null||v.source.method!=='thread/start'):(!ref(v.parentThreadClaimRef)||!['turn/start','turn/steer'].includes(v.source.method))))return invalid();
 return v;
}
/** Pure metadata derivation only: no capture, filesystem, current authorization or dispatch. */
export function providerBindingHash(raw:unknown):string {
 return contentHash(canonicalJson({domain:'ANVIL_PROVIDER_HANDLE_BINDING_V1',bindingInput:input(raw)}));
}
export function providerProtectedHandleRef(raw:unknown,ciphertextHash:string):ProviderRef {
 const v=input(raw);if(!hex(ciphertextHash))return invalid();
 return{id:v.claimId,version:1,contentHash:contentHash(canonicalJson({format:'DPAPI_CURRENT_USER_V1',bindingHash:providerBindingHash(v),ciphertextHash}))};
}
/** Historical claim validity is not evidence of present authorization, provider identity or OS ownership. */
export function validateProviderSessionClaim(raw:unknown,parent?:unknown):{claim:ProviderSessionClaim;ref:ProviderRef} {
 const v=plain(raw);if(!exact(v,[...fields,'protectedHandleRef']))return invalid();
 const {protectedHandleRef,...rest}=v,checked=input(rest);
 if(!ref(protectedHandleRef)||protectedHandleRef.id!==checked.claimId||protectedHandleRef.version!==1)return invalid();
 if(checked.kind==='TURN'){
  const p=validateProviderSessionClaim(parent);
  if(p.claim.kind!=='THREAD'||canonicalJson(p.ref)!==canonicalJson(checked.parentThreadClaimRef)
   ||!['projectId','assignmentRef','agentSessionRef','responsibleBindingRef','connectionRef','environmentRef','executorRegistrationRef','execution','provider'].every(k=>canonicalJson((checked as any)[k])===canonicalJson((p.claim as any)[k]))
   ||Date.parse(checked.capturedAt)<Date.parse(p.claim.capturedAt)||Date.parse(checked.usableBefore)>Date.parse(p.claim.usableBefore))return invalid();
 }else if(parent!==undefined)return invalid();
 const claim={...checked,protectedHandleRef};
 return{claim,ref:{id:claim.claimId,version:1,contentHash:contentHash(canonicalJson(claim))}};
}
export function verifyProviderHandleBinding(raw:unknown,ciphertextHash:string,parent?:unknown):void {
 const {claim}=validateProviderSessionClaim(raw,parent),{protectedHandleRef,...rest}=claim;
 if(canonicalJson(providerProtectedHandleRef(rest,ciphertextHash))!==canonicalJson(protectedHandleRef))throw Error('PROVIDER_HANDLE_BINDING_INVALID');
}
