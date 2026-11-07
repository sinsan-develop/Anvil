import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {recordV1,refV1,uuidV1,hashV1,isoV1,arrayV1} from '../../../../contracts/runtime/validation-v1.ts';
import {readSourceScopesV1} from '../../../../contracts/runtime/source-scope-v1.ts';
import {copyControlData} from '../control-handoff/control-grant.ts';
import {assertKnowledgeTextSafe} from '../knowledge/knowledge-entry.ts';
import {AuthFailure,type AuthenticatedIdentity} from '../access/repository.ts';
import type {ProjectCommand} from '../access/project-command.ts';
export const startOriginOperations=['registerExecutionStartOrigin','readExecutionStartOrigins'] as const;
export const startOriginFlags=Object.freeze({credentialIssued:false,executionAuthorized:false,dispatchPerformed:false,writerReservationPerformed:false});
export const originHash=(v:unknown)=>contentHash(canonicalJson(v));
export const originSame=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
export function originFailure(code='EXECUTION_START_ORIGIN_INVALID',status=503):never{throw new AuthFailure(code,status);}
function invalid():never{throw new AuthFailure('INPUT_INVALID',422);}
function freeze<T>(v:T):T{if(v&&typeof v==='object'){for(const x of Object.values(v))freeze(x);Object.freeze(v);}return v;}
export function copyStartOrigin<T=any>(v:unknown):T{try{return freeze(copyControlData(v,2097152)) as T;}catch{return invalid();}}
function text(v:unknown){if(typeof v!=='string'||!v.isWellFormed()||!v.trim()||v.length>20000)invalid();try{assertKnowledgeTextSafe(v);}catch{invalid();}}
const refs=(v:unknown)=>arrayV1(v,200)&&v.every(refV1)&&new Set(v.map(canonicalJson)).size===v.length;
export function originActor(a:AuthenticatedIdentity){return canonicalJson({actorId:a.actorId,clientId:a.clientId,credentialGeneration:a.credentialGeneration,session:a.authSession});}
export function readExecutionStartOriginCommand(raw:unknown):ProjectCommand{
 const v:any=copyStartOrigin(raw);if(!recordV1(v,['schemaVersion','projectId','commandId','clientId','controlGeneration','operation','targetId','expectedVersion','baselineRefs','approvalRef','payload'])||v.schemaVersion!==1||![v.projectId,v.commandId,v.clientId].every(uuidV1)||!Number.isSafeInteger(v.controlGeneration)||v.controlGeneration<1||v.operation!=='registerExecutionStartOrigin'||v.targetId!==null||v.expectedVersion!==0||!Array.isArray(v.baselineRefs)||v.baselineRefs.length)invalid();
 if(v.approvalRef!==null)throw new AuthFailure('EXECUTION_START_ORIGIN_APPROVAL_NOT_CONNECTED',412);
 const p=v.payload;if(!recordV1(p,['stageRequestRef','assignmentRef','preparationRef','roleBindingRef','reason'])||![p.stageRequestRef,p.assignmentRef,p.preparationRef,p.roleBindingRef].every(refV1))invalid();text(p.reason);return v as ProjectCommand;
}
export const originObservationKinds=['STAGE_REQUEST','ASSIGNMENT','RESPONSIBLE_BINDING','LOGICAL_SESSION','PREPARATION','METHODOLOGY_APPLICATION','CONNECTION_DEFINITION','ENVIRONMENT_VERSION','CONTEXT_BUNDLE','PERMISSION_POLICY','LIMIT_POLICY'] as const;
export function readExecutionStartOriginSnapshot(raw:unknown):any{
 const s:any=copyStartOrigin(raw);if(!recordV1(s,['schemaVersion','purpose','projectId','originId','execution','stageRequestRef','assignmentRef','preparationRef','roleBindingRef','sessionBindingRef','taskRef','connectionRef','environmentRef','contextBundleRef','options','basisRefs','sourceScopes','latestInstructionRefs','observedPolicyRef','budgetPolicyRef','subject','executionCredential','sourceObservations','unresolvedChecks','reason','recordedAt','expiresAt','credentialIssued','executionAuthorized','dispatchPerformed','writerReservationPerformed'])||s.schemaVersion!==1||s.purpose!=='EXECUTION_START_ORIGIN'||!uuidV1(s.projectId)||!uuidV1(s.originId)||Object.keys(startOriginFlags).some(k=>s[k]!==false))invalid();
 if(!recordV1(s.execution,['executionId','executionGeneration'])||!uuidV1(s.execution.executionId)||s.execution.executionGeneration!==1||!recordV1(s.executionCredential,['credentialId','credentialGeneration'])||!uuidV1(s.executionCredential.credentialId)||s.executionCredential.credentialGeneration!==1)invalid();
 if(!['stageRequestRef','assignmentRef','preparationRef','roleBindingRef','sessionBindingRef','connectionRef','environmentRef','contextBundleRef','observedPolicyRef','budgetPolicyRef'].every(k=>refV1(s[k]))||!refs(s.basisRefs)||!s.basisRefs.length)invalid();
 if(!recordV1(s.taskRef,['planRef','taskCode','applicationRef','nodeId'])||![s.taskRef.planRef,s.taskRef.applicationRef].every(refV1)||!['taskCode','nodeId'].every(k=>typeof s.taskRef[k]==='string'&&s.taskRef[k].trim()&&s.taskRef[k].isWellFormed()))invalid();
 const o=s.options;if(!recordV1(o,['preparationRef','format','utf8Bytes','contentHash'])||!originSame(o.preparationRef,s.preparationRef)||o.format!=='CLAUDE_QUERY_DATA_V1'||!Number.isSafeInteger(o.utf8Bytes)||o.utf8Bytes<1||o.utf8Bytes>2097152||!hashV1(o.contentHash))invalid();
 const a=s.subject;if(!recordV1(a,['kind','userId','clientId','humanSessionId','credentialGeneration','controlGeneration'])||a.kind!=='HUMAN'||![a.userId,a.clientId,a.humanSessionId].every(uuidV1)||!['credentialGeneration','controlGeneration'].every(k=>Number.isSafeInteger(a[k])&&a[k]>0))invalid();
 if(!arrayV1(s.sourceObservations,originObservationKinds.length)||s.sourceObservations.length!==originObservationKinds.length||new Set(s.sourceObservations.map((v:any)=>v.kind)).size!==originObservationKinds.length||s.sourceObservations.some((v:any)=>!recordV1(v,['kind','ref','observationHash'])||!originObservationKinds.includes(v.kind)||!refV1(v.ref)||!hashV1(v.observationHash)))invalid();
 const observed:any={STAGE_REQUEST:s.stageRequestRef,ASSIGNMENT:s.assignmentRef,RESPONSIBLE_BINDING:s.roleBindingRef,LOGICAL_SESSION:s.sessionBindingRef,PREPARATION:s.preparationRef,METHODOLOGY_APPLICATION:s.taskRef.applicationRef,CONNECTION_DEFINITION:s.connectionRef,ENVIRONMENT_VERSION:s.environmentRef,CONTEXT_BUNDLE:s.contextBundleRef,PERMISSION_POLICY:s.observedPolicyRef,LIMIT_POLICY:s.budgetPolicyRef};if(s.sourceObservations.some((v:any)=>!originSame(v.ref,observed[v.kind])||v.observationHash!==v.ref.contentHash))invalid();
 if(!arrayV1(s.latestInstructionRefs,200)||s.latestInstructionRefs.some((v:any)=>!recordV1(v,['kind','id','contentHash'])||v.kind!=='CONVERSATION'||!uuidV1(v.id)||!hashV1(v.contentHash))||!arrayV1(s.unresolvedChecks,200)||!s.unresolvedChecks.length||s.unresolvedChecks.some((v:any)=>typeof v!=='string'||!/^[A-Z][A-Z0-9_]{0,99}$/.test(v))||!['ACTUAL_RUNTIME_NOT_OBSERVED','SDK_SESSION_NOT_CLAIMED','EXECUTION_CREDENTIAL_NOT_ISSUED'].every(k=>s.unresolvedChecks.includes(k)))invalid();
 try{readSourceScopesV1(s.sourceScopes);}catch{invalid();}text(s.reason);if(!isoV1(s.recordedAt)||!isoV1(s.expiresAt)||Date.parse(s.expiresAt)<=Date.parse(s.recordedAt))invalid();return s;
}
export function readExecutionStartOriginReservation(raw:unknown):any{
 const q:any=copyStartOrigin(raw);if(!recordV1(q,['schemaVersion','purpose','credentialId','credentialGeneration','projectId','originRef','executionId','executionGeneration','sessionBindingRef','roleBindingRef','state','reservedAt','expiresAt','credentialIssued','executionAuthorized','dispatchPerformed'])||q.schemaVersion!==1||q.purpose!=='EXECUTION_START_ORIGIN_CREDENTIAL_RESERVATION'||![q.credentialId,q.projectId,q.executionId].every(uuidV1)||q.credentialGeneration!==1||q.executionGeneration!==1||![q.originRef,q.sessionBindingRef,q.roleBindingRef].every(refV1)||q.state!=='RESERVED_NOT_ISSUED'||q.credentialIssued!==false||q.executionAuthorized!==false||q.dispatchPerformed!==false||!isoV1(q.reservedAt)||!isoV1(q.expiresAt)||Date.parse(q.expiresAt)<=Date.parse(q.reservedAt))invalid();return q;
}
