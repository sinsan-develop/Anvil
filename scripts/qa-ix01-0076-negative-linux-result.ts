import {types} from 'node:util';
import {canonicalJson,contentHash,parseWireJson} from '../contracts/canonical.ts';
import {hashV1,recordV1,uuidV1} from '../contracts/runtime/validation-v1.ts';
import {current0076NegativeContract,type NegativeStageResult} from './qa-ix01-0076-atomicity-negative.ts';
import type {NegativeClaimJournalPorts} from './qa-ix01-0076-negative-claim.ts';

const bindingPurpose='IX01_0076_NEGATIVE_LINUX_RESULT_BINDING' as const;
const authorityPurpose='IX01_0076_NEGATIVE_LINUX_RESULT_AUTHORITY' as const;
const candidatePurpose='IX01_0076_NEGATIVE_LINUX_RESULT_CANDIDATE' as const;
const terminalPurpose='IX01_0076_NEGATIVE_LINUX_TERMINAL_OBSERVATION' as const;
export const current0076NegativeLinuxResultContract=Object.freeze({
 bindingPurpose,authorityPurpose,candidatePurpose,terminalPurpose,evidence:'SOURCE_STAGE_ONLY' as const,runtimeVerified:false as const,
 executionAuthorized:false as const,acceptance:false as const,durable:false as const,
});

export interface NegativeLinuxResultBinding{
 readonly schemaVersion:1;readonly purpose:typeof bindingPurpose;readonly attemptId:string;readonly approvalId:string;readonly sourceHead:string;
 readonly planHash:string;readonly approvalHash:string;readonly graphHash:string;readonly containerId:string;
 readonly issuedAt:number;readonly expiresAt:number;readonly receiptRoot:string;
}
export interface NegativeLinuxResultAuthorityProjection{
 readonly schemaVersion:1;readonly purpose:typeof authorityPurpose;readonly decision:'VERIFY_RESULT_CANDIDATE_ONLY';
 readonly attemptId:string;readonly approvalId:string;readonly sourceHead:string;readonly planHash:string;readonly approvalHash:string;
 readonly graphHash:string;readonly containerId:string;readonly issuedAt:number;readonly expiresAt:number;readonly claimReceipt:Uint8Array;
 readonly terminalReceipt:Uint8Array;readonly observedAt:number;
}
export interface NegativeLinuxResultAuthorityPorts{
 readonly recipient:object;now():number;monotonic():number;
 assertCurrent(this:object,binding:Readonly<NegativeLinuxResultBinding>):void;
 read(this:object,binding:Readonly<NegativeLinuxResultBinding>):Promise<Readonly<NegativeLinuxResultAuthorityProjection>>;
}
export interface NegativeLinuxResultRecord{
 readonly status:'RESULT_CANDIDATE_RECORDED_NOT_DURABLE'|'UNKNOWN';readonly evidence:'SOURCE_STAGE_ONLY';readonly runtimeVerified:false;
 readonly executionAuthorized:false;readonly acceptance:false;readonly durable:false;
}
const retainedResultHandles=new Map<object,Set<object>>();

const invalid=():never=>{throw Error('IX01_0076_NEGATIVE_LINUX_RESULT_INVALID');};
function exact(value:unknown,keys:readonly string[]){
 if(!value||typeof value!=='object'||types.isProxy(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))return false;
 const descriptors=Object.getOwnPropertyDescriptors(value);return Reflect.ownKeys(descriptors).length===keys.length&&keys.every(key=>!!descriptors[key]?.enumerable&&Object.hasOwn(descriptors[key]!,'value'));
}
function bindingShape(raw:unknown):raw is Readonly<NegativeLinuxResultBinding>{
 const keys=['schemaVersion','purpose','attemptId','approvalId','sourceHead','planHash','approvalHash','graphHash','containerId','issuedAt','expiresAt','receiptRoot'];
 if(!exact(raw,keys)||!Object.isFrozen(raw))return false;const value=raw as NegativeLinuxResultBinding;
 return value.schemaVersion===1&&value.purpose===bindingPurpose&&uuidV1(value.attemptId)&&uuidV1(value.approvalId)&&/^[a-f0-9]{40}$/.test(value.sourceHead)
  &&[value.planHash,value.approvalHash,value.graphHash,value.containerId].every(hashV1)&&[value.issuedAt,value.expiresAt].every(Number.isSafeInteger)
  &&value.issuedAt<value.expiresAt&&value.expiresAt-value.issuedAt<=1800000
  &&value.receiptRoot==='/home/daon/.local/share/anvil-v3-qa-receipts/ix01-0076-negative-'+value.attemptId;
}
function stageShape(raw:unknown,binding:Readonly<NegativeLinuxResultBinding>):raw is Readonly<NegativeStageResult>{
 const keys=['status','reason','evidence','runtimeVerified','executionAuthorized','priorInstalled','priorLedgered','targetDispatched','sourceSha256','executionSha256','attemptId','planHash','graphHash','expectedSqlState','statementEndLine','catalogBeforeHash','catalogAfterHash'];
 if(!exact(raw,keys)||!Object.isFrozen(raw))return false;const value=raw as NegativeStageResult;
 return value.status==='OBSERVATIONS_MATCHED'&&value.reason===null&&value.evidence==='SOURCE_STAGE_ONLY'&&value.runtimeVerified===false&&value.executionAuthorized===false
  &&value.priorInstalled===106&&value.priorLedgered===106&&value.targetDispatched===true&&value.sourceSha256===current0076NegativeContract.sourceSha256
  &&value.executionSha256===current0076NegativeContract.executionSha256&&value.attemptId===binding.attemptId&&value.planHash===binding.planHash&&value.graphHash===binding.graphHash
  &&value.expectedSqlState==='42723'&&value.statementEndLine===2343&&hashV1(value.catalogBeforeHash)&&value.catalogAfterHash===value.catalogBeforeHash;
}
function authorityMethods(raw:NegativeLinuxResultAuthorityPorts){
 const keys=['recipient','now','monotonic','assertCurrent','read'] as const;if(!exact(raw,keys))invalid();const d=Object.getOwnPropertyDescriptors(raw),recipient=d.recipient!.value as object;
 if(!recipient||typeof recipient!=='object'||types.isProxy(recipient)||!Object.isFrozen(recipient))invalid();for(const key of keys.slice(1))if(typeof d[key]!.value!=='function')invalid();
 return{keys,recipient,now:d.now!.value as NegativeLinuxResultAuthorityPorts['now'],monotonic:d.monotonic!.value as NegativeLinuxResultAuthorityPorts['monotonic'],assertCurrent:d.assertCurrent!.value as NegativeLinuxResultAuthorityPorts['assertCurrent'],read:d.read!.value as NegativeLinuxResultAuthorityPorts['read']};
}
function journalMethods(raw:NegativeClaimJournalPorts){
 const keys=['recipient','schedule','createExclusive','write','syncFile','close','syncDirectory','readback'] as const;if(!exact(raw,keys))invalid();const d=Object.getOwnPropertyDescriptors(raw),recipient=d.recipient!.value as object;
 if(!recipient||typeof recipient!=='object'||types.isProxy(recipient)||!Object.isFrozen(recipient))invalid();for(const key of keys.slice(1))if(typeof d[key]!.value!=='function')invalid();
 return{keys,recipient,schedule:d.schedule!.value as NegativeClaimJournalPorts['schedule'],createExclusive:d.createExclusive!.value as NegativeClaimJournalPorts['createExclusive'],write:d.write!.value as NegativeClaimJournalPorts['write'],syncFile:d.syncFile!.value as NegativeClaimJournalPorts['syncFile'],close:d.close!.value as NegativeClaimJournalPorts['close'],syncDirectory:d.syncDirectory!.value as NegativeClaimJournalPorts['syncDirectory'],readback:d.readback!.value as NegativeClaimJournalPorts['readback']};
}
function ownedBytes(raw:unknown,max:number){
 if(!types.isUint8Array(raw)||types.isProxy(raw))invalid();const value=raw as Uint8Array;if(types.isSharedArrayBuffer(value.buffer)||value.byteLength<1||value.byteLength>max)invalid();return new Uint8Array(value);
}
function claimReceipt(raw:Uint8Array,binding:Readonly<NegativeLinuxResultBinding>){
 let value:unknown;try{const text=new TextDecoder('utf-8',{fatal:true}).decode(raw);value=parseWireJson(text);if(canonicalJson(value)!==text)invalid();}catch{invalid();}
 if(!recordV1(value,['schemaVersion','purpose','attemptId','approvalId','sourceHead','planHash','approvalHash','graphHash','receiptPath','claimedAt','evidence','runtimeVerified','executionAuthorized'])
  ||value.schemaVersion!==1||value.purpose!=='IX01_0076_ATOMICITY_NEGATIVE_CLAIM_RECEIPT'||value.attemptId!==binding.attemptId||value.approvalId!==binding.approvalId
  ||value.sourceHead!==binding.sourceHead||value.planHash!==binding.planHash||value.approvalHash!==binding.approvalHash||value.graphHash!==binding.graphHash
  ||value.receiptPath!==binding.receiptRoot+'/claim-v1.json'||!Number.isSafeInteger(value.claimedAt)||value.claimedAt<binding.issuedAt||value.claimedAt>=binding.expiresAt
  ||value.evidence!=='SOURCE_STAGE_ONLY'||value.runtimeVerified!==false||value.executionAuthorized!==false)invalid();
 return contentHash(raw);
}
function projection(raw:unknown,binding:Readonly<NegativeLinuxResultBinding>,stage:Readonly<NegativeStageResult>,at:number){
 const keys=['schemaVersion','purpose','decision','attemptId','approvalId','sourceHead','planHash','approvalHash','graphHash','containerId','issuedAt','expiresAt','claimReceipt','terminalReceipt','observedAt'];
 if(!exact(raw,keys)||!Object.isFrozen(raw))invalid();const value=raw as NegativeLinuxResultAuthorityProjection;
 if(value.schemaVersion!==1||value.purpose!==authorityPurpose||value.decision!=='VERIFY_RESULT_CANDIDATE_ONLY'||value.attemptId!==binding.attemptId||value.approvalId!==binding.approvalId
  ||value.sourceHead!==binding.sourceHead||value.planHash!==binding.planHash||value.approvalHash!==binding.approvalHash||value.graphHash!==binding.graphHash||value.containerId!==binding.containerId
  ||value.issuedAt!==binding.issuedAt||value.expiresAt!==binding.expiresAt
  ||!Number.isSafeInteger(value.observedAt)||value.observedAt<binding.issuedAt||value.observedAt>at||value.observedAt>=binding.expiresAt)invalid();
 const bytes=ownedBytes(value.claimReceipt,16384),terminal=ownedBytes(value.terminalReceipt,16384);let found:unknown;
 try{const text=new TextDecoder('utf-8',{fatal:true}).decode(terminal);found=parseWireJson(text);if(canonicalJson(found)!==text)invalid();}catch{invalid();}
 if(!recordV1(found,['schemaVersion','purpose','attemptId','approvalId','planHash','graphHash','containerId','executionObservationRef','ownerExit','cleanup','observedAt'])
  ||found.schemaVersion!==1||found.purpose!==terminalPurpose||found.attemptId!==binding.attemptId||found.approvalId!==binding.approvalId||found.planHash!==binding.planHash
  ||found.graphHash!==binding.graphHash||found.containerId!==binding.containerId||!recordV1(found.executionObservationRef,['id','version','contentHash'])
  ||!uuidV1(found.executionObservationRef.id)||found.executionObservationRef.version!==1||found.executionObservationRef.contentHash!==contentHash(canonicalJson(stage))
  ||!recordV1(found.ownerExit,['confirmed','status','signal'])||found.ownerExit.confirmed!==true||!Number.isSafeInteger(found.ownerExit.status)||found.ownerExit.status<0||found.ownerExit.status>255
  ||found.ownerExit.signal!==null||!recordV1(found.cleanup,['confirmed','toolClosed','containerStopped','containerRemoved','unknown'])||found.cleanup.confirmed!==true
  ||found.cleanup.toolClosed!==true||found.cleanup.containerStopped!==true||found.cleanup.containerRemoved!==true||found.cleanup.unknown!==false
  ||found.observedAt!==value.observedAt)invalid();
 return{claimReceiptHash:claimReceipt(bytes,binding),terminalReceiptHash:contentHash(terminal),executionObservationRef:(found as Record<string,any>).executionObservationRef as Readonly<{id:string;version:1;contentHash:string}>,bytes,terminal};
}

/** 보호 claim·실행·정리의 일치 결과를 비내구 source 후보로만 정착한다. 실제 성공 receipt·실행/정리 권위를 발급하지 않는다. */
export function create0076NegativeLinuxResultRecorder(rawAuthority:NegativeLinuxResultAuthorityPorts,rawJournal:NegativeClaimJournalPorts){
 const authority=authorityMethods(rawAuthority),journal=journalMethods(rawJournal);let used=false,lastWall=-1,lastMono=-1,wallEnd=-1,monoEnd=-1;
 const retain=(handle:object)=>{let found=retainedResultHandles.get(journal.recipient);if(!found){found=new Set<object>();retainedResultHandles.set(journal.recipient,found);}found.add(handle);};
 const release=(handle:object)=>{const found=retainedResultHandles.get(journal.recipient);found?.delete(handle);if(found?.size===0)retainedResultHandles.delete(journal.recipient);};
 const result=(status:NegativeLinuxResultRecord['status']):Readonly<NegativeLinuxResultRecord>=>Object.freeze({status,evidence:'SOURCE_STAGE_ONLY',runtimeVerified:false,executionAuthorized:false,acceptance:false,durable:false});
 const unchanged=()=>authority.keys.every(key=>rawAuthority[key]===authority[key])&&journal.keys.every(key=>rawJournal[key]===journal[key]);
 const current=(binding:Readonly<NegativeLinuxResultBinding>)=>{
  if(!unchanged())invalid();const wall=authority.now.call(rawAuthority),mono=authority.monotonic.call(rawAuthority);
  if(!Number.isSafeInteger(wall)||!Number.isFinite(mono)||mono<0||wall<binding.issuedAt||wall<lastWall||mono<lastMono)invalid();
  if(lastWall<0){wallEnd=Math.min(binding.expiresAt,wall+600000);monoEnd=mono+(wallEnd-wall);}
  if(wall>=wallEnd||mono>=monoEnd)invalid();lastWall=wall;lastMono=mono;if(authority.assertCurrent.call(authority.recipient,binding)!==undefined)invalid();return{wall,mono};
 };
 const bounded=async<T>(binding:Readonly<NegativeLinuxResultBinding>,work:()=>Promise<T>,late?:(value:T)=>void):Promise<Readonly<{ok:true;value:T}>|Readonly<{ok:false}>>=>{
  let remaining:number;try{const point=current(binding);remaining=Math.floor(Math.min(wallEnd-point.wall,monoEnd-point.mono));if(remaining<1)invalid();}catch{return{ok:false};}
  let expired=false,resolveTimeout!:(value:Readonly<{timeout:true}>)=>void,cancel:(()=>void)|undefined;const timeout=new Promise<Readonly<{timeout:true}>>(resolve=>{resolveTimeout=resolve;});
  try{cancel=journal.schedule.call(journal.recipient,()=>{expired=true;resolveTimeout(Object.freeze({timeout:true}));},remaining);if(typeof cancel!=='function'||expired)invalid();current(binding);}catch{try{cancel?.();}catch{}return{ok:false};}
  const operation=Promise.resolve().then(async()=>{try{if(expired)invalid();current(binding);return{value:await work()} as const;}catch{return{error:true} as const;}});
  const raced=await Promise.race([operation,timeout]);let cancelFailed=false;try{cancel();}catch{cancelFailed=true;}
  if('timeout'in raced){if(late)void operation.then(found=>{'value'in found&&late((found as {value:T}).value);}).catch(()=>{});return{ok:false};}
  if('error'in raced)return{ok:false};if(cancelFailed){late?.(raced.value);return{ok:false};}try{current(binding);}catch{late?.(raced.value);return{ok:false};}return{ok:true,value:raced.value};
 };
 const handleFrom=(raw:unknown)=>{if(!raw||typeof raw!=='object'||types.isProxy(raw))return undefined;const d=Object.getOwnPropertyDescriptor(raw,'handle');const handle=d&&Object.hasOwn(d,'value')?d.value:undefined;return handle&&typeof handle==='object'&&!types.isProxy(handle)&&Object.isFrozen(handle)?handle as object:undefined;};
 const record=async(binding:Readonly<NegativeLinuxResultBinding>,stage:Readonly<NegativeStageResult>):Promise<Readonly<NegativeLinuxResultRecord>>=>{
  if(used||!bindingShape(binding)||!stageShape(stage,binding))return result('UNKNOWN');used=true;
  const authorityResult=await bounded(binding,()=>authority.read.call(authority.recipient,binding));if(!authorityResult.ok)return result('UNKNOWN');let verified:{claimReceiptHash:string;terminalReceiptHash:string;executionObservationRef:Readonly<{id:string;version:1;contentHash:string}>;bytes:Uint8Array;terminal:Uint8Array}|undefined;
  try{verified=projection(authorityResult.value,binding,stage,current(binding).wall);}catch{return result('UNKNOWN');}finally{verified?.bytes.fill(0);verified?.terminal.fill(0);}if(!verified)return result('UNKNOWN');
  const recordedAt=current(binding).wall,path=binding.receiptRoot+'/result-candidate-v1.json';const candidate=Object.freeze({schemaVersion:1,purpose:candidatePurpose,attemptId:binding.attemptId,approvalId:binding.approvalId,sourceHead:binding.sourceHead,
   planHash:binding.planHash,approvalHash:binding.approvalHash,graphHash:binding.graphHash,containerId:binding.containerId,claimReceiptHash:verified.claimReceiptHash,
   terminalReceiptHash:verified.terminalReceiptHash,executionObservationRef:verified.executionObservationRef,
   sourceSha256:stage.sourceSha256,executionSha256:stage.executionSha256,priorInstalled:stage.priorInstalled,priorLedgered:stage.priorLedgered,sqlState:stage.expectedSqlState,
   statementEndLine:stage.statementEndLine,catalogBeforeHash:stage.catalogBeforeHash,catalogAfterHash:stage.catalogAfterHash,ownerExitConfirmed:true,cleanupConfirmed:true,recordedAt,
   evidence:'SOURCE_STAGE_ONLY' as const,runtimeVerified:false as const,executionAuthorized:false as const,acceptance:false as const,durable:false as const});
  const expected=new Uint8Array(Buffer.from(canonicalJson(candidate),'utf8')),created=await bounded(binding,()=>journal.createExclusive.call(journal.recipient,path),found=>{const late=handleFrom(found);if(late)retain(late);});if(!created.ok){expected.fill(0);return result('UNKNOWN');}
  const handle=handleFrom(created.value);if(handle)retain(handle);if(!exact(created.value,['kind','handle'])||created.value.kind!=='CREATED'||!handle){expected.fill(0);return result('UNKNOWN');}
  const write=await bounded(binding,()=>journal.write.call(journal.recipient,handle,new Uint8Array(expected)));if(!write.ok||write.value!=='WRITTEN'){expected.fill(0);return result('UNKNOWN');}
  const sync=await bounded(binding,()=>journal.syncFile.call(journal.recipient,handle));if(!sync.ok||sync.value!=='SYNCED'){expected.fill(0);return result('UNKNOWN');}
  const close=await bounded(binding,()=>journal.close.call(journal.recipient,handle));if(!close.ok||close.value!=='CLOSED'){expected.fill(0);return result('UNKNOWN');}release(handle);
  const directory=await bounded(binding,()=>journal.syncDirectory.call(journal.recipient,binding.receiptRoot));if(!directory.ok||directory.value!=='SYNCED'){expected.fill(0);return result('UNKNOWN');}
  const read=await bounded(binding,()=>journal.readback.call(journal.recipient,path));if(!read.ok){expected.fill(0);return result('UNKNOWN');}
  try{const found=ownedBytes(read.value,32768),same=Buffer.from(found).equals(Buffer.from(expected));found.fill(0);expected.fill(0);return result(same?'RESULT_CANDIDATE_RECORDED_NOT_DURABLE':'UNKNOWN');}catch{expected.fill(0);return result('UNKNOWN');}
 };
 return Object.freeze({record});
}
