import type {PoolClient} from 'pg';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {cloneV1,isoV1,recordV1,refV1,uuidV1} from '../../../../contracts/runtime/validation-v1.ts';
import {AuthFailure,type AuthenticatedIdentity} from '../access/repository.ts';
import {projectMember} from '../access/project-command.ts';
import {readAssignmentDraftInput} from '../assignments/assignment-input.ts';
import type {ProjectAssignmentConfirmations} from '../assignments/project-assignment-confirmations.ts';
import {ProjectResultSubmissions} from './project-result-submissions.ts';
import {readSubmittedResultRecord} from './result-submission-store.ts';
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b),hash=(v:unknown)=>contentHash(canonicalJson(v));
function fail(code:string,status=503):never{throw new AuthFailure(code,status);}
/** 인증된 caller tx의 원제출과 정확 내용확정 임무를 함께 읽는다.
 * 조건 문구를 typed 시험 기준/등록 증거로 추론하거나 검수·완료·실행 권한을 만들지 않는다. */
export class ProjectResultReviewSources{
 readonly assignments:Pick<ProjectAssignmentConfirmations,'read'>;
 readonly results:Pick<ProjectResultSubmissions,'read'>;
 constructor(assignments:Pick<ProjectAssignmentConfirmations,'read'>,results:Pick<ProjectResultSubmissions,'read'>=new ProjectResultSubmissions()){
  if(typeof assignments?.read!=='function'||typeof results?.read!=='function')fail('RESULT_REVIEW_SOURCE_READER_REQUIRED');this.assignments=assignments;this.results=results;
 }
 async read(db:PoolClient,actor:AuthenticatedIdentity,projectId:string,resultId:string){
  if(!uuidV1(projectId)||!uuidV1(resultId))fail('RESULT_REVIEW_SOURCE_INPUT_INVALID',400);
  await projectMember(db,actor,projectId);
  const raw=cloneV1(await this.results.read(db,actor,projectId,resultId)),at=(await db.query('SELECT clock_timestamp() AS at')).rows[0]?.at;
  if(!(at instanceof Date)||!Number.isFinite(at.getTime())||!recordV1(raw,['ref','snapshot'])||!refV1(raw.ref)||raw.snapshot?.scope?.projectId!==projectId)fail('RESULT_REVIEW_SOURCE_INVALID');
  const result=readSubmittedResultRecord(raw,raw.snapshot.scope,resultId,at.toISOString()),reference=cloneV1(result.snapshot.scope.assignmentRef);
  const assignment=cloneV1(await this.assignments.read(db,actor,projectId,reference.id,reference.version)),s=assignment?.snapshot;
  if(!recordV1(assignment,['projectId','ref','snapshot','observedAt'])||assignment.projectId!==projectId||!same(assignment.ref,reference)||!isoV1(assignment.observedAt)||!recordV1(s,['draftRef','definition','reviewRefs','reason','confirmedBy','confirmedAt','contentConfirmed','readinessIssues','ready','executionAuthorized','dispatchPerformed'])||hash(s)!==reference.contentHash||!refV1(s.draftRef)||s.draftRef.id!==reference.id||s.draftRef.version!==reference.version||!Array.isArray(s.reviewRefs)||!s.reviewRefs.length||s.reviewRefs.length>200||!s.reviewRefs.every(refV1)||!isoV1(s.confirmedAt)||Date.parse(s.confirmedAt)>Date.parse(result.snapshot.submittedAt)||!recordV1(s.confirmedBy,['kind','userId'])||s.confirmedBy.kind!=='HUMAN'||!uuidV1(s.confirmedBy.userId)||!Array.isArray(s.readinessIssues)||s.contentConfirmed!==true||s.ready!==false||s.executionAuthorized!==false||s.dispatchPerformed!==false)fail('RESULT_REVIEW_SOURCE_INVALID');
  const {input}=readAssignmentDraftInput({baseRef:null,definition:s.definition,reason:s.reason}),d=input.definition,issues=['TYPED_CRITERIA_NOT_REGISTERED'];
  if(!same(result.snapshot.manifest.baselineRefs,d.baselineRefs))issues.push('RESULT_BASELINES_MISMATCH');
  if(d.environmentRef===null)issues.push('ENVIRONMENT_NOT_DEFINED');
  if(!d.acceptanceCriteria.length||d.acceptanceCriteria.some(v=>!v.trim()))issues.push('ACCEPTANCE_CRITERIA_MISSING');
  if(!d.verificationRequirements.length||d.verificationRequirements.some(v=>!v.trim()))issues.push('VERIFICATION_REQUIREMENTS_MISSING');
  const value={projectId,result,assignment,criteriaState:'TEXT_ONLY_NOT_MAPPED' as const,issues,reviewStored:false as const,completionAccepted:false as const,executionAuthorized:false as const,dispatchPerformed:false as const};
  if(Buffer.byteLength(canonicalJson(value))>2*1024*1024)fail('RESULT_REVIEW_SOURCES_LIMIT');
  await projectMember(db,actor,projectId);return cloneV1(value);
 }
}
