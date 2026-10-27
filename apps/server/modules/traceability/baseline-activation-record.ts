import {AuthFailure} from '../access/repository.ts';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {isVersionRef} from '../../../../contracts/references.ts';
import type {VersionRef} from '../../../../contracts/generated-types.ts';
import {isApprovalRef,type ApprovalRef} from '../approvals/approval-input.ts';
export interface BaselineActivationSnapshot{schemaVersion:1;purpose:'DESIGN_BASELINE_ACTIVATION';projectId:string;activationId:string;generation:number;previousActivationRef:VersionRef|null;changeRef:VersionRef;impactRef:VersionRef;approvedDesignRef:VersionRef;confirmedPlanRef:VersionRef;candidatePayloadHash:string;approvalRef:ApprovalRef;approvalConsumptionId:string;commandId:string;policyRef:VersionRef;controlGeneration:number;recordedBy:{kind:'HUMAN';userId:string;clientId:string};activatedAt:string}
export interface BaselineActivationRecord{ref:VersionRef;snapshot:BaselineActivationSnapshot}
const keys=['schemaVersion','purpose','projectId','activationId','generation','previousActivationRef','changeRef','impactRef','approvedDesignRef','confirmedPlanRef','candidatePayloadHash','approvalRef','approvalConsumptionId','commandId','policyRef','controlGeneration','recordedBy','activatedAt'];
export const activationUuid=(v:unknown):v is string=>isVersionRef({id:v,version:1,contentHash:'0'.repeat(64)});
export const activationSame=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
export const activationUnavailable=()=>new AuthFailure('BASELINE_ACTIVATION_STORAGE_UNAVAILABLE',503);
export function readBaselineActivationRecord(value:unknown):BaselineActivationRecord{
 try{canonicalJson(value);const v=value as BaselineActivationRecord,s=v?.snapshot;
  if(!v||Object.keys(v).sort().join(',')!=='ref,snapshot'||!s||Object.keys(s).sort().join(',')!==[...keys].sort().join(',')||!isVersionRef(v.ref)||s.schemaVersion!==1||s.purpose!=='DESIGN_BASELINE_ACTIVATION'||!activationUuid(s.projectId)||!activationUuid(s.activationId)||!Number.isSafeInteger(s.generation)||s.generation<1||s.generation!==v.ref.version||s.activationId!==v.ref.id||![s.changeRef,s.impactRef,s.approvedDesignRef,s.confirmedPlanRef,s.policyRef].every(isVersionRef)||!isApprovalRef(s.approvalRef)||![s.approvalConsumptionId,s.commandId].every(activationUuid)||!Number.isSafeInteger(s.controlGeneration)||s.controlGeneration<1||!s.recordedBy||Object.keys(s.recordedBy).sort().join(',')!=='clientId,kind,userId'||s.recordedBy.kind!=='HUMAN'||![s.recordedBy.userId,s.recordedBy.clientId].every(activationUuid)||!/^[a-f0-9]{64}$/.test(s.candidatePayloadHash)||typeof s.activatedAt!=='string'||!Number.isFinite(Date.parse(s.activatedAt))||new Date(s.activatedAt).toISOString()!==s.activatedAt||v.ref.contentHash!==contentHash(canonicalJson(s)))throw Error();
  if(s.generation===1?s.previousActivationRef!==null:!isVersionRef(s.previousActivationRef)||s.previousActivationRef.version!==s.generation-1||s.previousActivationRef.id===s.activationId)throw Error();
  return structuredClone(v);
 }catch{throw activationUnavailable();}
}
export function createBaselineActivationRecord(snapshot:BaselineActivationSnapshot):BaselineActivationRecord{return readBaselineActivationRecord({ref:{id:snapshot.activationId,version:snapshot.generation,contentHash:contentHash(canonicalJson(snapshot))},snapshot});}
