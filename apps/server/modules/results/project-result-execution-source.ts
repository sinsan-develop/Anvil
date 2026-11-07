import type {PoolClient} from 'pg';
import {canonicalJson} from '../../../../contracts/canonical.ts';
import {cloneV1,uuidV1} from '../../../../contracts/runtime/validation-v1.ts';
import {AuthFailure,type AuthenticatedIdentity} from '../access/repository.ts';
import {projectMember} from '../access/project-command.ts';
import type {ProjectResultSubmissions} from './project-result-submissions.ts';
import {readSubmittedResultRecord} from './result-submission-store.ts';
import {readPgResultExecution} from './result-execution-pg.ts';
const fail=(code='RESULT_EXECUTION_SOURCE_INVALID',status=503):never=>{throw new AuthFailure(code,status);};
/** 원 결과와 결박된 역사 START/영수증 참조만 공개한다. 실Agent·현재실행/권한 관측은 하지 않는다. */
export class ProjectResultExecutionSource{
 readonly results:Pick<ProjectResultSubmissions,'read'>;
 constructor(results:Pick<ProjectResultSubmissions,'read'>){if(typeof results?.read!=='function')fail('RESULT_EXECUTION_READER_REQUIRED');this.results=results;}
 async read(db:PoolClient,rawActor:AuthenticatedIdentity,pid:string,id:string){
  if(!uuidV1(pid)||!uuidV1(id))fail('RESULT_EXECUTION_INPUT_INVALID',400);const actor=structuredClone(rawActor);await projectMember(db,actor,pid);
  const result=await this.results.read(db,structuredClone(actor),pid,id),at=(await db.query('SELECT clock_timestamp() AS at')).rows[0]?.at;if(!(at instanceof Date)||!Number.isFinite(at.getTime()))fail();
  try{if(result.snapshot.scope.projectId!==pid)fail();readSubmittedResultRecord(result,result.snapshot.scope,id,at.toISOString());}catch{fail();}
  const execution=await readPgResultExecution(db,result.snapshot.scope),value={projectId:pid,resultRef:cloneV1(result.ref),sourceState:'HISTORICAL_REFERENCE_ONLY' as const,execution,observationState:'NOT_QUERIED' as const,actualProviderObserved:false as const,currentAuthorizationVerified:false as const,completionAccepted:false as const,formalFailureCounted:false as const,writerReleaseVerified:false as const,executionAuthorized:false as const,dispatchPerformed:false as const,observedAt:at.toISOString()};
  if(Buffer.byteLength(canonicalJson(value))>2*1024*1024)fail('RESULT_EXECUTION_SOURCE_LIMIT');await projectMember(db,actor,pid);return cloneV1(value);
 }
}
