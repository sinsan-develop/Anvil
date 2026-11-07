import type {PoolClient} from 'pg';
import {canonicalJson} from '../../../../contracts/canonical.ts';
import {cloneV1,refV1,uuidV1} from '../../../../contracts/runtime/validation-v1.ts';
import {AuthFailure,type AuthenticatedIdentity} from '../access/repository.ts';
import {projectMember} from '../access/project-command.ts';
import type {ProjectAssignmentConfirmations} from '../assignments/project-assignment-confirmations.ts';
import {prepareCheckpointDraft} from './checkpoint-input.ts';

/** 확정 임무의 정확 버전으로 기록 내용을 준비한다. 저장·현재 사실 확인·재개 허가는 아니다. */
export class ProjectCheckpointPreparation{
 readonly assignments:Pick<ProjectAssignmentConfirmations,'read'>;
 constructor(assignments:Pick<ProjectAssignmentConfirmations,'read'>){this.assignments=assignments;}
 async prepare(db:PoolClient,rawActor:AuthenticatedIdentity,projectId:string,rawRef:unknown,rawInput:unknown){
  if(!uuidV1(projectId)||!refV1(rawRef))throw new AuthFailure('CHECKPOINT_INPUT_INVALID',422);
  const actor=structuredClone(rawActor),ref=cloneV1(rawRef),input=cloneV1(rawInput);
  await projectMember(db,actor,projectId);
  const assignment=await this.assignments.read(db,actor,projectId,ref.id,ref.version);
  if(assignment.projectId!==projectId||canonicalJson(assignment.ref)!==canonicalJson(ref))throw new AuthFailure('VERSION_CONFLICT',409);
  let prepared:ReturnType<typeof prepareCheckpointDraft>;
  try{prepared=prepareCheckpointDraft(assignment,input);}catch(error){throw new AuthFailure(error instanceof Error&&/^CHECKPOINT_[A-Z_]+$/.test(error.message)?error.message:'CHECKPOINT_INPUT_INVALID',422);}
  await projectMember(db,actor,projectId);
  const result={projectId,assignmentRef:ref,sourceState:'FIXED_ASSIGNMENT_REFERENCE_ONLY' as const,...prepared};
  if(Buffer.byteLength(canonicalJson(result))>2*1024*1024)throw new AuthFailure('CHECKPOINT_RESPONSE_TOO_LARGE',422);
  return result;
 }
}
