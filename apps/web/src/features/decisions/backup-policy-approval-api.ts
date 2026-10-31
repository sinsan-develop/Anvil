import {ApiError,type ApiClient}from'../../api/client.ts';
import {wireHash}from'../control-handoff/api.ts';
import type{DocumentSession}from'../design-trace/editor-api.ts';
import {backupPolicyApprovalBasis,policySame,validateBackupPolicyPayload,type BackupPolicyBuffer,type BackupPolicyPayload}from'../backups/backup-policy-api.ts';
import {validApprovalDetails,type ApprovalView,type ApprovalRequestWork}from'./api.ts';
export interface BackupPolicyCandidate{candidateCommandId:string;payloadHash:string;payload:BackupPolicyPayload}
export async function validateBackupPolicyCandidate(view:ApprovalView,pid:string):Promise<void>{
 const bad=():never=>{throw new ApiError('RESPONSE_INVALID');};
 if(view?.request?.details?.actionScope?.operation!=='saveBackupPolicy'){if(view.candidateBackupPolicy!==undefined)bad();return;}
 const c=view.candidateBackupPolicy,s=view.request.details.actionScope;
 if(!c||Object.keys(c).sort().join(',')!=='candidateCommandId,payload,payloadHash'||c.candidateCommandId!==view.request.details.candidateCommandId||c.payloadHash!==s.payloadHash||s.baselineRefs.length||s.environmentRef!==null||s.sourceScopes.length||s.limitsRef!==null||view.request.projectId!==pid)bad();
 const payload=validateBackupPolicyPayload(c!.payload);
 if(!policySame(payload.previousRef,s.targetRef)||s.expectedVersion!==(payload.previousRef?.version??0)||await wireHash(payload)!==c!.payloadHash)bad();
}
export async function prepareBackupPolicyApprovalRequest(api:ApiClient,w:ApprovalRequestWork,b:BackupPolicyBuffer,s:DocumentSession,check:()=>boolean){
 const copy={candidate:structuredClone(w.candidate),details:structuredClone(w.details),session:structuredClone(s)},basis=await backupPolicyApprovalBasis(api,b,s,check),p=basis.pending;
 if(w.pending||w.resultId||w.projectId!==b.projectId||w.ownerUserId!==b.ownerUserId||w.ownerClientId!==b.ownerClientId||!policySame(copy.candidate,p.command))throw new ApiError('APPROVAL_CANDIDATE_MISMATCH',409);
 const payload=validateBackupPolicyPayload(copy.candidate.payload),details={...copy.details,candidateCommandId:p.command.commandId,actionScope:{operation:'saveBackupPolicy',targetRef:payload.previousRef,expectedVersion:p.command.expectedVersion,payloadHash:await wireHash(payload),baselineRefs:[],environmentRef:null,sourceScopes:[],limitsRef:null,requestedSubjectRef:{kind:'HUMAN' as const,userId:copy.session.user.id,clientId:copy.session.clientId},controlGeneration:p.command.controlGeneration}};
 if(!basis.current())throw new ApiError('BACKUP_POLICY_CONTEXT_CHANGED',412);
 if(!validApprovalDetails(details)||Date.parse(details.expiresAt)<=Date.now()||Date.parse(details.expiresAt)>basis.until)throw new ApiError('APPROVAL_INPUT_INVALID',422);
 return{schemaVersion:1 as const,projectId:b.projectId,commandId:crypto.randomUUID(),clientId:b.ownerClientId,controlGeneration:p.command.controlGeneration,operation:'requestApproval',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:{details,candidatePayload:payload as unknown as Record<string,unknown>}};
}
