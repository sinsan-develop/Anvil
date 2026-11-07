import {canonicalJson,contentHash} from '../canonical.ts';
import {arrayV1,cloneV1,hashV1,isoV1,recordV1,refV1,uuidV1,type RuntimeRefV1} from './validation-v1.ts';
import {readOwnershipObservationRequestV1,type OwnershipObservationRequestV1} from './ownership-observation-v1.ts';

export interface OwnershipScopeV1 {installationId:string;projectId:string;executionId:string;executionGeneration:number}
export type OwnershipEventKindV1='PREPARATION_GRANTED'|'OBSERVATION_REQUESTED'|'OBSERVATION_ACCEPTED'|'ANCHOR_ADOPTED'|'BINDING_RECORDED'|'REVOKED'|'EXPIRED'|'UNKNOWN';
export interface OwnershipEventV1 {
 ref:RuntimeRefV1;
 snapshot:{schemaVersion:1;purpose:'OWNERSHIP_EVENT';scope:OwnershipScopeV1;sequence:number;previousRef:RuntimeRefV1|null;kind:OwnershipEventKindV1;
  subject:{userId:string;clientId:string;humanSessionId:string;controlGeneration:number;credentialGeneration:number};
  registrationRef:RuntimeRefV1;commandRef:RuntimeRefV1;authorizationReceiptRef:RuntimeRefV1;auditRef:RuntimeRefV1;
  payload:Record<string,any>;at:string;expiresAt:string};
}
export interface OwnershipHeadV1 {
 ref:RuntimeRefV1;
 snapshot:{schemaVersion:1;purpose:'OWNERSHIP_HEAD';scope:OwnershipScopeV1;anchorRef:RuntimeRefV1;generation:number;previousHeadRef:RuntimeRefV1|null;
  currentEventRef:RuntimeRefV1;state:'ACTIVE'|'REVOKED'|'EXPIRED'|'UNKNOWN';updatedAt:string;expiresAt:string};
}
const fail=():never=>{throw Error('OWNERSHIP_LEDGER_INVALID');};
const positive=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>0;
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const digest=(v:unknown)=>contentHash(canonicalJson(v));
const terminal=(kind:unknown)=>['REVOKED','EXPIRED','UNKNOWN'].includes(String(kind));
function scope(v:unknown):v is OwnershipScopeV1{return recordV1(v,['installationId','projectId','executionId','executionGeneration'])&&uuidV1(v.installationId)&&uuidV1(v.projectId)&&uuidV1(v.executionId)&&positive(v.executionGeneration);}
function process(v:unknown){return recordV1(v,['runId','generation','jobId','pid','startTicks','executableHash'])&&uuidV1(v.runId)&&positive(v.generation)&&uuidV1(v.jobId)&&positive(v.pid)&&typeof v.startTicks==='string'&&/^[1-9][0-9]{16,19}$/.test(v.startTicks)&&hashV1(v.executableHash);}
function headBasis(p:Record<string,any>){return p.phase==='BOOTSTRAP_PREPARED'?p.expectedHeadRef===null:p.phase==='CURRENT'&&refV1(p.expectedHeadRef);}
function payloadValid(e:OwnershipEventV1):boolean {
 const s=e.snapshot,p=s.payload;
 switch(s.kind){
  case 'PREPARATION_GRANTED':return recordV1(p,['policyRef','observerRef','publicKeyFingerprint','hostHash','workerHash','rootId','runId','processGeneration','actions','writerState'])
   &&refV1(p.policyRef)&&refV1(p.observerRef)&&hashV1(p.publicKeyFingerprint)&&hashV1(p.hostHash)&&hashV1(p.workerHash)&&uuidV1(p.rootId)&&uuidV1(p.runId)&&positive(p.processGeneration)
   &&arrayV1(p.actions,3)&&same(p.actions,['PREPARE','OBSERVE','CANCEL_PREPARED'])&&p.writerState==='NONE'
   &&Date.parse(s.expiresAt)-Date.parse(s.at)<=120000;
  case 'OBSERVATION_REQUESTED':{
   if(!recordV1(p,['request','processRef'])||!recordV1(p.request,['protocolVersion','purpose','installationId','projectId','executionId','executionGeneration','registrationRef','publicKeyFingerprint','observerRef','anchorRef','preparationRef','phase','expectedHeadRef','nonce','requestedAt','expiresAt'])||!process(p.processRef))return false;
   let r:OwnershipObservationRequestV1;try{r=readOwnershipObservationRequestV1({...p.request,requestRef:e.ref});}catch{return false;}
   return same({installationId:r.installationId,projectId:r.projectId,executionId:r.executionId,executionGeneration:r.executionGeneration},s.scope)&&same(r.registrationRef,s.registrationRef)&&r.requestedAt===s.at&&Date.parse(r.expiresAt)<=Date.parse(s.expiresAt);
  }
  case 'OBSERVATION_ACCEPTED':return recordV1(p,['requestRef','observationRef','phase','expectedHeadRef','anchorRef','preparationRef'])&&refV1(p.requestRef)&&refV1(p.observationRef)&&refV1(p.anchorRef)&&refV1(p.preparationRef)&&headBasis(p);
  case 'ANCHOR_ADOPTED':return recordV1(p,['anchorRef','preparationRef','observationEventRef','expectedHeadRef'])&&refV1(p.anchorRef)&&refV1(p.preparationRef)&&refV1(p.observationEventRef)&&p.expectedHeadRef===null;
  case 'BINDING_RECORDED':return recordV1(p,['anchorRef','bindingRef','expectedHeadRef'])&&refV1(p.anchorRef)&&refV1(p.bindingRef)&&refV1(p.expectedHeadRef);
  default:return terminal(s.kind)&&recordV1(p,['anchorRef','expectedHeadRef','preparationRef','reasonCode'])&&(p.anchorRef===null||refV1(p.anchorRef))&&(p.expectedHeadRef===null||refV1(p.expectedHeadRef)&&p.anchorRef!==null)&&refV1(p.preparationRef)&&typeof p.reasonCode==='string'&&/^[A-Z][A-Z0-9_]{0,63}$/.test(p.reasonCode);
 }
}
/** Immutable structural/hash contract, NOT authenticated storage or an OS/currentness verdict. */
export function readOwnershipEventV1(value:unknown):OwnershipEventV1 {
 let v:any;try{v=cloneV1(value);}catch{return fail();}
 if(!recordV1(v,['ref','snapshot'])||!refV1(v.ref)||v.ref.version!==1||!recordV1(v.snapshot,['schemaVersion','purpose','scope','sequence','previousRef','kind','subject','registrationRef','commandRef','authorizationReceiptRef','auditRef','payload','at','expiresAt']))return fail();
 const s=v.snapshot;
 if(s.schemaVersion!==1||s.purpose!=='OWNERSHIP_EVENT'||!scope(s.scope)||!positive(s.sequence)||!isoV1(s.at)||!isoV1(s.expiresAt)
  ||!recordV1(s.subject,['userId','clientId','humanSessionId','controlGeneration','credentialGeneration'])||!['userId','clientId','humanSessionId'].every(k=>uuidV1(s.subject[k]))||!positive(s.subject.controlGeneration)||!positive(s.subject.credentialGeneration)
  ||!['registrationRef','commandRef','authorizationReceiptRef','auditRef'].every(k=>refV1(s[k]))
  ||(s.sequence===1?s.previousRef!==null:!refV1(s.previousRef))||s.previousRef?.id===v.ref.id||!payloadValid(v as unknown as OwnershipEventV1)
  ||(!terminal(s.kind)&&Date.parse(s.expiresAt)<=Date.parse(s.at))||v.ref.contentHash!==digest(s)||Buffer.byteLength(canonicalJson(s))>256*1024)return fail();
 return v as OwnershipEventV1;
}
/** The request event omits its future self-reference; its immutable fullref is attached only after hashing. */
export function ownershipRequestFromEventV1(value:unknown):OwnershipObservationRequestV1 {
 const e=readOwnershipEventV1(value);if(e.snapshot.kind!=='OBSERVATION_REQUESTED')return fail();
 return readOwnershipObservationRequestV1({...e.snapshot.payload.request,requestRef:e.ref});
}
/** Run under the same authenticated project lock as persistence; this pure check does not acquire one. */
export function checkOwnershipEventAppendV1(previousValue:unknown,nextValue:unknown,nowMs:number):OwnershipEventV1 {
 const next=readOwnershipEventV1(nextValue),s=next.snapshot;
 if(!Number.isSafeInteger(nowMs)||Date.parse(s.at)>nowMs||!terminal(s.kind)&&Date.parse(s.expiresAt)<=nowMs)return fail();
 if(previousValue===null){if(s.sequence!==1||s.previousRef!==null||s.kind!=='PREPARATION_GRANTED')return fail();return next;}
 const previous=readOwnershipEventV1(previousValue),p=previous.snapshot;
 if(!same(s.scope,p.scope)||s.sequence!==p.sequence+1||!same(s.previousRef,previous.ref)||Date.parse(s.at)<Date.parse(p.at)||Date.parse(s.expiresAt)>Date.parse(p.expiresAt)||s.kind==='PREPARATION_GRANTED')return fail();
 if(s.kind==='EXPIRED'&&(Date.parse(s.at)<Date.parse(p.expiresAt)||nowMs<Date.parse(p.expiresAt)))return fail();
 if(!terminal(s.kind)&&(!same(s.subject,p.subject)||!same(s.registrationRef,p.registrationRef)))return fail();
 const a=s.payload,b=p.payload;
 if(terminal(p.kind)){
  if(p.kind!=='UNKNOWN'||!['REVOKED','EXPIRED'].includes(s.kind)||!same(a.preparationRef,b.preparationRef)||!same(a.anchorRef,b.anchorRef))return fail();
 }else if(terminal(s.kind)){
  const preparation=p.kind==='PREPARATION_GRANTED'?previous.ref:p.kind==='OBSERVATION_REQUESTED'?b.request.preparationRef:b.preparationRef;
  if(preparation&&!same(a.preparationRef,preparation))return fail();
 }else if(s.kind==='OBSERVATION_ACCEPTED'){
  if(p.kind!=='OBSERVATION_REQUESTED'||!same(a.requestRef,previous.ref)||!same(s.subject,p.subject)||!same(s.registrationRef,p.registrationRef))return fail();
  const r=ownershipRequestFromEventV1(previous);
  if(Date.parse(s.at)>=Date.parse(r.expiresAt)||nowMs>=Date.parse(r.expiresAt))return fail();
  if(a.phase!==r.phase||!same(a.expectedHeadRef,r.expectedHeadRef)||!same(a.anchorRef,r.anchorRef)||!same(a.preparationRef,r.preparationRef))return fail();
 }else if(s.kind==='ANCHOR_ADOPTED'){
  if(p.kind!=='OBSERVATION_ACCEPTED'||b.phase!=='BOOTSTRAP_PREPARED'||!same(a.observationEventRef,previous.ref)||!same(a.anchorRef,b.anchorRef)||!same(a.preparationRef,b.preparationRef))return fail();
 }else if(s.kind==='OBSERVATION_REQUESTED'){
  const r=ownershipRequestFromEventV1(next);
  if(p.kind==='PREPARATION_GRANTED'){
   if(r.phase!=='BOOTSTRAP_PREPARED'||!same(r.preparationRef,previous.ref)||!same(r.observerRef,b.observerRef)||r.publicKeyFingerprint!==b.publicKeyFingerprint||a.processRef.runId!==b.runId||a.processRef.generation!==b.processGeneration||a.processRef.executableHash!==b.workerHash||!same(s.registrationRef,p.registrationRef)||!same(s.subject,p.subject))return fail();
  }else if(!(p.kind==='ANCHOR_ADOPTED'||p.kind==='BINDING_RECORDED'||p.kind==='OBSERVATION_ACCEPTED'&&b.phase==='CURRENT')||r.phase!=='CURRENT'||!same(r.anchorRef,b.anchorRef)||b.preparationRef&&!same(r.preparationRef,b.preparationRef))return fail();
 }else if(s.kind==='BINDING_RECORDED'){
  if(!(p.kind==='ANCHOR_ADOPTED'||p.kind==='OBSERVATION_ACCEPTED'&&b.phase==='CURRENT')||!same(a.anchorRef,b.anchorRef))return fail();
 }else return fail();
 return next;
}
export function readOwnershipHeadV1(value:unknown):OwnershipHeadV1 {
 let v:any;try{v=cloneV1(value);}catch{return fail();}
 if(!recordV1(v,['ref','snapshot'])||!refV1(v.ref)||!recordV1(v.snapshot,['schemaVersion','purpose','scope','anchorRef','generation','previousHeadRef','currentEventRef','state','updatedAt','expiresAt']))return fail();
 const s=v.snapshot;
 if(s.schemaVersion!==1||s.purpose!=='OWNERSHIP_HEAD'||!scope(s.scope)||!refV1(s.anchorRef)||!positive(s.generation)||v.ref.version!==s.generation||!refV1(s.currentEventRef)||!['ACTIVE','REVOKED','EXPIRED','UNKNOWN'].includes(s.state)||!isoV1(s.updatedAt)||!isoV1(s.expiresAt)
  ||(s.generation===1?s.previousHeadRef!==null:!refV1(s.previousHeadRef)||s.previousHeadRef.id!==v.ref.id||s.previousHeadRef.version!==s.generation-1)||v.ref.contentHash!==digest(s))return fail();
 return v as OwnershipHeadV1;
}
/** A write PLAN, not a write/lease/dispatch grant. Storage must still verify the event chain,
 * accepted signed observation, original preparation, nonce one-use and atomic CAS in one transaction. */
export function advanceOwnershipHeadV1(currentValue:unknown,eventValue:unknown,headId:string,nowMs:number):OwnershipHeadV1 {
 const event=readOwnershipEventV1(eventValue),e=event.snapshot,p=e.payload;
 if(!uuidV1(headId)||!Number.isSafeInteger(nowMs)||Date.parse(e.at)>nowMs||!terminal(e.kind)&&Date.parse(e.expiresAt)<=nowMs)return fail();
 let previous:OwnershipHeadV1|null=null,state:OwnershipHeadV1['snapshot']['state']='ACTIVE',generation=1,expiry=e.expiresAt;
 if(currentValue===null){if(e.kind!=='ANCHOR_ADOPTED'||p.expectedHeadRef!==null)return fail();}
 else{
  previous=readOwnershipHeadV1(currentValue);const s=previous.snapshot;
  if(previous.ref.id!==headId||!same(s.scope,e.scope)||!same(p.anchorRef,s.anchorRef)||!same(p.expectedHeadRef,previous.ref)||same(s.currentEventRef,event.ref)||Date.parse(e.at)<Date.parse(s.updatedAt)||Date.parse(e.expiresAt)>Date.parse(s.expiresAt)||!Number.isSafeInteger(s.generation+1))return fail();
  if(e.kind==='EXPIRED'){if(Date.parse(e.at)<Date.parse(s.expiresAt)||!['ACTIVE','UNKNOWN'].includes(s.state))return fail();state='EXPIRED';}
  else if(e.kind==='REVOKED'){if(!['ACTIVE','UNKNOWN'].includes(s.state))return fail();state='REVOKED';}
  else if(e.kind==='UNKNOWN'){if(s.state!=='ACTIVE')return fail();state='UNKNOWN';}
  else if(s.state!=='ACTIVE'||Date.parse(s.expiresAt)<=nowMs||!(e.kind==='OBSERVATION_ACCEPTED'&&p.phase==='CURRENT'||e.kind==='BINDING_RECORDED'))return fail();
  generation=s.generation+1;expiry=s.expiresAt<e.expiresAt?s.expiresAt:e.expiresAt;
 }
 const snapshot:OwnershipHeadV1['snapshot']={schemaVersion:1,purpose:'OWNERSHIP_HEAD',scope:cloneV1(e.scope),anchorRef:cloneV1(p.anchorRef),generation,previousHeadRef:previous?.ref??null,currentEventRef:event.ref,state,updatedAt:e.at,expiresAt:expiry};
 return readOwnershipHeadV1({ref:{id:headId,version:generation,contentHash:digest(snapshot)},snapshot});
}
