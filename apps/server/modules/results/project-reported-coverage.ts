import type {PoolClient} from 'pg';
import {cloneV1,refV1,uuidV1} from '../../../../contracts/runtime/validation-v1.ts';
import {AuthFailure,type AuthenticatedIdentity} from '../access/repository.ts';
import {projectMember} from '../access/project-command.ts';
import type {ProjectResultSubmissions} from './project-result-submissions.ts';
import type {ProjectResultCriteria} from './project-result-criteria.ts';
import {prepareReportedCoverage} from './reported-coverage.ts';
function fail(code:string,status=503):never{throw new AuthFailure(code,status);}
/** 같은 HUMAN 조회 tx의 원제출/등록기준만 결합한다. 검수권한·출처 관측·변경 연산은 없다. */
export class ProjectReportedCoverage{
 readonly results:Pick<ProjectResultSubmissions,'read'>;readonly criteria:Pick<ProjectResultCriteria,'read'>;
 constructor(results:Pick<ProjectResultSubmissions,'read'>,criteria:Pick<ProjectResultCriteria,'read'>){if(typeof results?.read!=='function'||typeof criteria?.read!=='function')fail('RESULT_COVERAGE_READER_REQUIRED');this.results=results;this.criteria=criteria;}
 async read(db:PoolClient,actor:AuthenticatedIdentity,projectId:string,resultId:string,criteriaId:string,version:number){
  if(!uuidV1(projectId)||!uuidV1(resultId)||!uuidV1(criteriaId)||!Number.isSafeInteger(version)||version<1)fail('RESULT_COVERAGE_INPUT_INVALID',400);
  const identity=structuredClone(actor);await projectMember(db,identity,projectId);
  const result=cloneV1(await this.results.read(db,structuredClone(identity),projectId,resultId)),criteria=cloneV1(await this.criteria.read(db,structuredClone(identity),projectId,criteriaId,version));
  if(result.ref?.id!==resultId||result.snapshot?.scope?.projectId!==projectId||criteria.projectId!==projectId||!refV1(criteria.ref)||criteria.ref.id!==criteriaId||criteria.ref.version!==version||criteria.registryStored!==true||criteria.reviewStored!==false||criteria.completionAccepted!==false||criteria.executionAuthorized!==false||criteria.dispatchPerformed!==false)fail('RESULT_COVERAGE_SOURCE_INVALID');
  const at=(await db.query('SELECT clock_timestamp() AS at')).rows[0]?.at;if(!(at instanceof Date)||!Number.isFinite(at.getTime()))fail('RESULT_COVERAGE_CLOCK_INVALID');
  let value:ReturnType<typeof prepareReportedCoverage>;try{value=prepareReportedCoverage(result,{ref:criteria.ref,snapshot:criteria.snapshot},at.toISOString());}catch(cause){if(cause instanceof Error&&cause.message==='RESULT_COVERAGE_BINDING_INVALID')fail('RESULT_COVERAGE_BINDING_INVALID',412);fail('RESULT_COVERAGE_SOURCE_INVALID');}
  await projectMember(db,identity,projectId);return value;
 }
}
