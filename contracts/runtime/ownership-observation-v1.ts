import {canonicalJson,contentHash} from '../canonical.ts';
import {arrayV1,cloneV1,hashV1,isoV1,recordV1,refV1,uuidV1,type RuntimeRefV1} from './validation-v1.ts';

/** Wire/signing shape only: not a registration, signature, process, head or permission verdict. */
export interface OwnershipObservationRequestV1 {
 protocolVersion:1;
 purpose:'OWNERSHIP_OBSERVATION';
 installationId:string;
 projectId:string;
 executionId:string;
 executionGeneration:number;
 registrationRef:RuntimeRefV1;
 publicKeyFingerprint:string;
 observerRef:RuntimeRefV1;
 anchorRef:RuntimeRefV1;
 preparationRef:RuntimeRefV1;
 requestRef:RuntimeRefV1;
 phase:'BOOTSTRAP_PREPARED'|'CURRENT';
 expectedHeadRef:RuntimeRefV1|null;
 nonce:string;
 requestedAt:string;
 expiresAt:string;
}
export interface OwnershipObservationV1 extends OwnershipObservationRequestV1 {
 factsHash:string;
 observedAt:string;
}
export interface OwnershipProcessRefV1 {
 runId:string;generation:number;jobId:string;pid:number;startTicks:string;executableHash:string;
}
export interface OwnershipObservationFactsV1 {
 processRef:OwnershipProcessRefV1;state:'PREPARED'|'RUNNING';everResumed:boolean;active:number;
 processes:{pid:number;startTicks:string;inJob:true;executableHash:string}[];
 killOnClose:false;fileSandboxVerified:false;
}
const requestKeys=['protocolVersion','purpose','installationId','projectId','executionId','executionGeneration','registrationRef','publicKeyFingerprint','observerRef','anchorRef','preparationRef','requestRef','phase','expectedHeadRef','nonce','requestedAt','expiresAt'] as const;
const reportKeys=[...requestKeys,'factsHash','observedAt'];
const invalid=():never=>{throw Error('OWNERSHIP_OBSERVATION_INVALID');};
function validBasis(v:Record<string,any>):boolean {
 if(v.protocolVersion!==1||v.purpose!=='OWNERSHIP_OBSERVATION'||!['installationId','projectId','executionId'].every(k=>uuidV1(v[k]))||!Number.isSafeInteger(v.executionGeneration)||v.executionGeneration<=0)return false;
 if(!['registrationRef','observerRef','anchorRef','preparationRef','requestRef'].every(k=>refV1(v[k]))||!hashV1(v.publicKeyFingerprint))return false;
 if(v.phase==='BOOTSTRAP_PREPARED'?v.expectedHeadRef!==null:v.phase!=='CURRENT'||!refV1(v.expectedHeadRef))return false;
 if(typeof v.nonce!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(v.nonce))return false;
 const nonce=Buffer.from(v.nonce,'base64url');if(nonce.length!==32||nonce.toString('base64url')!==v.nonce)return false;
 if(!isoV1(v.requestedAt)||!isoV1(v.expiresAt))return false;
 const ttl=Date.parse(v.expiresAt)-Date.parse(v.requestedAt);return ttl>0&&ttl<=10000;
}
export function readOwnershipObservationRequestV1(value:unknown):OwnershipObservationRequestV1 {
 if(!recordV1(value,requestKeys)||!validBasis(value))return invalid();
 return cloneV1(value) as unknown as OwnershipObservationRequestV1;
}
export function readOwnershipObservationV1(value:unknown):OwnershipObservationV1 {
 if(!recordV1(value,reportKeys)||!validBasis(value)||!hashV1(value.factsHash)||!isoV1(value.observedAt))return invalid();
 if(Date.parse(value.observedAt)<Date.parse(value.requestedAt)||Date.parse(value.observedAt)>=Date.parse(value.expiresAt))return invalid();
 return cloneV1(value) as unknown as OwnershipObservationV1;
}
/** Keys, registration scope, nonce consumption, facts hash and current head must be checked separately. */
export function ownershipObservationBytesV1(value:unknown):Buffer {
 return Buffer.concat([Buffer.from('ANVIL_OWNERSHIP_OBSERVATION_V1\0','ascii'),Buffer.from(canonicalJson(readOwnershipObservationV1(value)),'utf8')]);
}
/** expected must come from the original authenticated server request, never the caller's report. */
export function matchOwnershipObservationV1(value:unknown,expected:unknown,nowMs:number):OwnershipObservationV1 {
 const report=readOwnershipObservationV1(value),basis=readOwnershipObservationRequestV1(expected);
 if(!Number.isSafeInteger(nowMs)||Date.parse(report.observedAt)>nowMs||nowMs>=Date.parse(report.expiresAt))return invalid();
 const {factsHash:_,observedAt:__,...actual}=report;
 if(canonicalJson(actual)!==canonicalJson(basis))return invalid();
 return report;
}
const positive=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>0;
const ticks=(v:unknown)=>typeof v==='string'&&/^[1-9][0-9]{16,19}$/.test(v);
function process(v:unknown):v is OwnershipProcessRefV1 {
 return recordV1(v,['runId','generation','jobId','pid','startTicks','executableHash'])&&uuidV1(v.runId)&&positive(v.generation)&&uuidV1(v.jobId)&&positive(v.pid)&&ticks(v.startTicks)&&hashV1(v.executableHash);
}
/** Structural/hash binding only. This does NOT authenticate OS observations or advance head/writer authority. */
export function matchOwnershipObservationFactsV1(reportValue:unknown,factsValue:unknown,expectedProcess:unknown):OwnershipObservationFactsV1 {
 const report=readOwnershipObservationV1(reportValue);
 if(!process(expectedProcess)||!recordV1(factsValue,['processRef','state','everResumed','active','processes','killOnClose','fileSandboxVerified'])||!process(factsValue.processRef)||canonicalJson(factsValue.processRef)!==canonicalJson(expectedProcess))return invalid();
 const f=factsValue;
 if(f.killOnClose!==false||f.fileSandboxVerified!==false||!positive(f.active)||!arrayV1(f.processes,128)||f.processes.length!==f.active)return invalid();
 if(report.phase==='BOOTSTRAP_PREPARED'?(f.state!=='PREPARED'||f.everResumed!==false):(f.state!=='RUNNING'||f.everResumed!==true))return invalid();
 const pids=new Set<number>();let root=false;
 for(const p of f.processes){
  if(!recordV1(p,['pid','startTicks','inJob','executableHash'])||!positive(p.pid)||!ticks(p.startTicks)||p.inJob!==true||p.executableHash!==expectedProcess.executableHash||pids.has(p.pid))return invalid();
  pids.add(p.pid);if(p.pid===expectedProcess.pid){if(p.startTicks!==expectedProcess.startTicks)return invalid();root=true;}
 }
 if(!root||report.factsHash!==contentHash(canonicalJson(f)))return invalid();
 return cloneV1(f) as unknown as OwnershipObservationFactsV1;
}
