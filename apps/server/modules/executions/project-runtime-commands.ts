import {cloneV1} from '../../../../contracts/runtime/validation-v1.ts';
import {AuthFailure} from '../access/repository.ts';
import type {ProjectCommand} from '../access/project-command.ts';
import type {ProjectInitialExecutionQueue} from './execution-commands.ts';
import type {ProjectExecutionStops} from './execution-stop.ts';
import type {ProjectExecutionRecovery} from './execution-recovery.ts';
import type {ProjectUnderstandingReviews} from './execution-understanding.ts';
import type {ProjectExecutionGrantRevocations} from './execution-grant-revocation.ts';
import type {ProjectExecutionInstructionQueue} from './execution-instruction-queue.ts';
export const syntheticHumanExecutionOperations=['queueExecutionCommand','requestExecutionStop','authorizeExecutionRecovery','reviewUnderstanding','revokeExecutionGrant'] as const;
export interface SyntheticHumanExecutionPorts{
 readonly transport:'SYNTHETIC_ONLY';queue:Pick<ProjectInitialExecutionQueue,'command'>;stop:Pick<ProjectExecutionStops,'command'>;recovery:Pick<ProjectExecutionRecovery,'command'>;understanding:Pick<ProjectUnderstandingReviews,'command'>;
 revocations?:Pick<ProjectExecutionGrantRevocations,'command'>;
 instructions?:Pick<ProjectExecutionInstructionQueue,'command'|'transport'>;
}
export function checkSyntheticHumanExecutionPorts(p:SyntheticHumanExecutionPorts){if(p?.transport!=='SYNTHETIC_ONLY'||['queue','stop','recovery','understanding'].some(k=>typeof(p as any)[k]?.command!=='function')||p.revocations!==undefined&&typeof p.revocations?.command!=='function'||p.instructions!==undefined&&(p.instructions.transport!=='SYNTHETIC_ONLY'||typeof p.instructions.command!=='function'))throw new AuthFailure('SYNTHETIC_RUNTIME_REQUIRED',503);}
export function enabledSyntheticHumanExecutionOperations(p:SyntheticHumanExecutionPorts){checkSyntheticHumanExecutionPorts(p);return syntheticHumanExecutionOperations.filter(op=>op!=='revokeExecutionGrant'||p.revocations!==undefined);}
/** 기존 서비스가 자신의 HUMAN·제어·정책 transaction을 소유한다. 이 분기는 허가/DB를 만들지 않는다. */
export async function dispatchSyntheticHumanExecution(p:SyntheticHumanExecutionPorts,token:string,csrf:string,request:ProjectCommand){
 checkSyntheticHumanExecutionPorts(p);if(typeof token!=='string'||token.length!==43||!/^[A-Za-z0-9_-]{43}$/.test(token))throw new AuthFailure('AUTH_REQUIRED',401);if(typeof csrf!=='string'||csrf.length!==43||!/^[A-Za-z0-9_-]{43}$/.test(csrf))throw new AuthFailure('CSRF_INVALID',403);
 const followup=request.operation==='queueExecutionCommand'&&request.targetId!==null&&p.instructions!==undefined;
 const service=request.operation==='queueExecutionCommand'?(followup?p.instructions:p.queue):request.operation==='requestExecutionStop'?p.stop:request.operation==='authorizeExecutionRecovery'?p.recovery:request.operation==='reviewUnderstanding'?p.understanding:request.operation==='revokeExecutionGrant'?p.revocations:null;if(!service)throw new AuthFailure('RUNTIME_OPERATION_INVALID',400);
try{const result:any=await service.command(token,csrf,cloneV1(request));checkSyntheticHumanExecutionPorts(p);const s=result?.data?.snapshot;if(!result||result.projectId!==request.projectId||result.status!=='APPLIED'||(request.operation==='reviewUnderstanding'?s?.currentBinding?.transport:s?.transport)!=='SYNTHETIC_ONLY'||s.executionAuthorized!==false||s.dispatchPerformed!==false||s.writerReleaseVerified===true)throw new AuthFailure('RUNTIME_RESULT_INVALID',503);
 if(request.operation==='revokeExecutionGrant'&&(result.data.status!=='SYNTHETIC_GRANT_REVOCATION_STORED'||['revocationEffectiveVerified','credentialRevocationVerified','writerReleaseVerified','executionAuthorized','dispatchPerformed'].some(k=>s[k]!==false||result.data[k]!==false)))throw new AuthFailure('RUNTIME_RESULT_INVALID',503);
 if(followup&&(result.data.status!=='SYNTHETIC_INSTRUCTION_QUEUE_STORED'||s.state!=='SYNTHETIC_INSTRUCTION_QUEUED'||['executionAuthorized','dispatchPerformed'].some(k=>s[k]!==false||result.data[k]!==false)))throw new AuthFailure('RUNTIME_RESULT_INVALID',503);return result;}
 catch(e){if(e instanceof AuthFailure)throw e;throw new AuthFailure('RUNTIME_STORAGE_FAILED',503);}
}
