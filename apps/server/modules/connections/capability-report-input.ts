import {AuthFailure} from '../access/repository.ts';
import {isVersionRef} from '../../../../contracts/references.ts';
import type {VersionRef} from '../../../../contracts/generated-types.ts';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {inspectArtifact} from '../../storage/sensitive-inspection.ts';
import {capabilityCodes} from './candidate-input.ts';
export const capabilityReportOperations=['recordCapabilityReport'] as const;
export interface CapabilityArtifactRef {artifactId:string;bytes:number;contentHash:string;mediaType:string}
export interface HumanCapability {code:typeof capabilityCodes[number];documentation:null|{source:string;observedAt:string;versionCompatibility:'CONFIRMED'|'UNVERIFIED'|'UNSUPPORTED'};submittedMeasurementState:'VERIFIED'|'UNVERIFIED'|'UNSUPPORTED';requestedControlLevel:'DIRECT'|'ISOLATED'|'OBSERVED_ONLY'|'UNVERIFIED';evidenceRefs:CapabilityArtifactRef[];limitations:string}
export interface CapabilityReportClaim {schemaVersion:1;connectionRef:VersionRef;environmentRef:VersionRef;tool:{product:string;version:string;adapterVersion:string};observedAt:string|null;expiresAt:string;supersedesRef:VersionRef|null;capabilities:HumanCapability[];reason:string}
function fail():never{throw new AuthFailure('CAPABILITY_REPORT_INPUT_INVALID',422);}
function exact(v:unknown,keys:string[]):v is Record<string,unknown>{return !!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');}
function text(v:unknown,max:number):v is string{return typeof v==='string'&&v.isWellFormed()&&!!v.trim()&&v.length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v);}
export function capabilityInstant(v:unknown):v is string{return typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;}
export function readCapabilityArtifact(v:unknown):CapabilityArtifactRef{if(!exact(v,['artifactId','bytes','contentHash','mediaType'])||!isVersionRef({id:v.artifactId,version:1,contentHash:v.contentHash})||!Number.isSafeInteger(v.bytes)||Number(v.bytes)<0||Number(v.bytes)>2097152||typeof v.mediaType!=='string'||!['text/plain;charset=utf-8','text/markdown;charset=utf-8'].includes(String(v.mediaType)))fail();return structuredClone(v) as unknown as CapabilityArtifactRef;}
export function readCapabilityReportClaim(raw:unknown,context:{now:Date;expiresAt?:number}):CapabilityReportClaim{
 if(!exact(raw,['schemaVersion','connectionRef','environmentRef','tool','observedAt','expiresAt','supersedesRef','capabilities','reason'])||raw.schemaVersion!==1||!isVersionRef(raw.connectionRef)||!isVersionRef(raw.environmentRef)||raw.supersedesRef!==null&&!isVersionRef(raw.supersedesRef)||!exact(raw.tool,['product','version','adapterVersion'])||Object.values(raw.tool).some(x=>!text(x,200))||!text(raw.reason,20000)||!capabilityInstant(raw.expiresAt)||Date.parse(raw.expiresAt)<=context.now.getTime()||Date.parse(raw.expiresAt)>Math.min(context.now.getTime()+7200000,context.expiresAt??Infinity)||raw.observedAt!==null&&(!capabilityInstant(raw.observedAt)||Date.parse(raw.observedAt)>context.now.getTime())||!Array.isArray(raw.capabilities)||raw.capabilities.length!==6)fail();
 const codes=new Set<string>(),artifacts=new Map<string,string>();
 for(const c of raw.capabilities as unknown[]){
  if(!exact(c,['code','documentation','submittedMeasurementState','requestedControlLevel','evidenceRefs','limitations'])||!(capabilityCodes as readonly unknown[]).includes(c.code)||codes.has(String(c.code))||typeof c.submittedMeasurementState!=='string'||!['VERIFIED','UNVERIFIED','UNSUPPORTED'].includes(String(c.submittedMeasurementState))||typeof c.requestedControlLevel!=='string'||!['DIRECT','ISOLATED','OBSERVED_ONLY','UNVERIFIED'].includes(String(c.requestedControlLevel))||!text(c.limitations,20000)||!Array.isArray(c.evidenceRefs)||c.evidenceRefs.length>20)fail();
  codes.add(String(c.code));
  if(c.documentation!==null){const d=c.documentation;if(!exact(d,['source','observedAt','versionCompatibility'])||!text(d.source,2048)||!capabilityInstant(d.observedAt)||Date.parse(d.observedAt)>context.now.getTime()||typeof d.versionCompatibility!=='string'||!['CONFIRMED','UNVERIFIED','UNSUPPORTED'].includes(String(d.versionCompatibility)))fail();try{const u=new URL(d.source as string);if(u.protocol!=='https:'||u.username||u.password)fail();}catch{fail();}}
  const local=new Set<string>();for(const item of c.evidenceRefs as unknown[]){const a=readCapabilityArtifact(item),tuple=canonicalJson(a);if(local.has(a.artifactId)||artifacts.has(a.artifactId)&&artifacts.get(a.artifactId)!==tuple)fail();local.add(a.artifactId);artifacts.set(a.artifactId,tuple);}if(artifacts.size>20)fail();
 }
 const serialized=canonicalJson(raw);if(Buffer.byteLength(serialized,'utf8')>2097152)fail();if(inspectArtifact(Buffer.from(serialized,'utf8')).state==='SUSPECTED')throw new AuthFailure('CAPABILITY_SENSITIVE_CONTENT_SUSPECTED',412);
 return structuredClone(raw) as unknown as CapabilityReportClaim;
}
export function capabilityReportSnapshot(claim:CapabilityReportClaim,projectId:string,reportId:string,actor:{actorId:string;clientId:string},now:Date){
 const value={schemaVersion:1 as const,projectId,reportId,version:1 as const,claim,claimHash:contentHash(canonicalJson(claim)),reportedBy:{kind:'HUMAN' as const,userId:actor.actorId,clientId:actor.clientId},sourceAssurance:'HUMAN_CLAIM' as const,bindingKind:'CANDIDATE_ONLY' as const,recordedAt:now.toISOString(),executableObservationRef:null,probeRunRef:null,authorizationReceiptRef:null,capabilities:capabilityCodes.map(code=>({code,measurement:{state:'UNVERIFIED' as const},controlLevel:'UNVERIFIED' as const})),executionAuthorized:false as const,dispatchPerformed:false as const};
 if(Buffer.byteLength(canonicalJson(value),'utf8')>2097152)fail();return value;
}
