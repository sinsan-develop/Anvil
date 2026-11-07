import type {PoolClient} from 'pg';
import {cloneV1,recordV1,refV1,uuidV1} from '../../../../contracts/runtime/validation-v1.ts';
import {AuthFailure,type AuthenticatedIdentity} from '../access/repository.ts';
import {projectMember} from '../access/project-command.ts';
import type {ProjectAssignmentConfirmations} from '../assignments/project-assignment-confirmations.ts';
import type {ResponsibleSessions} from '../assignments/responsible-sessions.ts';
import type {ProjectResultSubmissions} from './project-result-submissions.ts';
import type {ProjectResultCriteria} from './project-result-criteria.ts';
import type {ProjectResultReviews} from './project-result-reviews.ts';
import {prepareResultRework} from './result-rework-input.ts';
interface Readers{assignments:Pick<ProjectAssignmentConfirmations,'read'>;results:Pick<ProjectResultSubmissions,'read'>;criteria:Pick<ProjectResultCriteria,'read'>;reviews:Pick<ProjectResultReviews,'read'>;sessions:Pick<ResponsibleSessions,'readRole'|'readBinding'>}
/** 실제 불변 reader들로 명시 원문을 읽는 보완 초안 준비. 저장/현재 권한/dispatch는 하지 않는다. */
export class ProjectResultReworkPreparation{
 readonly readers:Readers;
 constructor(readers:Readers){if([readers?.assignments?.read,readers?.results?.read,readers?.criteria?.read,readers?.reviews?.read,readers?.sessions?.readRole,readers?.sessions?.readBinding].some(v=>typeof v!=='function'))throw new AuthFailure('RESULT_REWORK_READERS_REQUIRED',503);this.readers=readers;}
 async prepare(db:PoolClient,rawActor:AuthenticatedIdentity,pid:string,rawInput:unknown){
  const actor=structuredClone(rawActor),input=cloneV1(rawInput);
  if(!uuidV1(pid)||!recordV1(input,['resultRef','reviewRef','responsibleBindingRef','missingItems','sourceScopes','reason'])||!refV1(input.resultRef)||!refV1(input.reviewRef)||!refV1(input.responsibleBindingRef))throw new AuthFailure('RESULT_REWORK_INPUT_INVALID',422);
  await projectMember(db,actor,pid);const p=this.readers;
  const result=await p.results.read(db,structuredClone(actor),pid,input.resultRef.id),review=await p.reviews.read(db,structuredClone(actor),pid,input.reviewRef.id),scope=result.snapshot.scope;
  if(scope.projectId!==pid||review.projectId!==pid||!refV1(review.snapshot.input.criteriaRef)||!refV1(scope.assignmentRef))throw new AuthFailure('RESULT_REWORK_SOURCE_INVALID',503);
  const cr=review.snapshot.input.criteriaRef,assignment=await p.assignments.read(db,structuredClone(actor),pid,scope.assignmentRef.id,scope.assignmentRef.version),criteria=await p.criteria.read(db,structuredClone(actor),pid,cr.id,cr.version),binding=await p.sessions.readBinding(db,structuredClone(actor),pid,input.responsibleBindingRef.id,input.responsibleBindingRef.version);
  if(!refV1(binding.snapshot.roleRef))throw new AuthFailure('RESULT_REWORK_SOURCE_INVALID',503);
  const rr=binding.snapshot.roleRef,role=await p.sessions.readRole(db,structuredClone(actor),pid,rr.id,rr.version),at=(await db.query('SELECT clock_timestamp() AS at')).rows[0]?.at;
  if(!(at instanceof Date)||!Number.isFinite(at.getTime()))throw new AuthFailure('RESULT_REWORK_CLOCK_INVALID',503);
  let value:ReturnType<typeof prepareResultRework>;try{value=prepareResultRework({assignment,result,criteria,review,role,binding},input,at.toISOString());}catch(e){if(e instanceof Error&&/^RESULT_REWORK_/.test(e.message))throw new AuthFailure(e.message,422);throw new AuthFailure('RESULT_REWORK_SOURCE_INVALID',503);}
  await projectMember(db,actor,pid);return cloneV1(value);
 }
}
