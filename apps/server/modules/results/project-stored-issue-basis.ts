import type {PoolClient} from 'pg';
import {cloneV1,uuidV1,isoV1} from '../../../../contracts/runtime/validation-v1.ts';
import {AuthFailure,type AuthenticatedIdentity} from '../access/repository.ts';
import {projectMember} from '../access/project-command.ts';
import type {ProjectResultSubmissions} from './project-result-submissions.ts';
import type {ProjectObservationJournal} from '../checkpoints/project-observation-journal.ts';
import {prepareStoredIssueBasis} from './stored-issue-basis.ts';
type Ports={results:Pick<ProjectResultSubmissions,'read'>;journal:Pick<ProjectObservationJournal,'read'>};
function fail(code='STORED_ISSUE_BASIS_INVALID',status=503):never{throw new AuthFailure(code,status);}
/** 현재 HUMAN 조회 권한으로 보관 범위를 읽는다. 새 issue 사건/관측 사실·쓰기/실행은 없다. */
export class ProjectStoredIssueBasis{
 readonly ports:Ports;
 constructor(ports:Ports){if(typeof ports?.results?.read!=='function'||typeof ports.journal?.read!=='function')fail();this.ports=ports;}
 async read(db:PoolClient,rawActor:AuthenticatedIdentity,pid:string,id:string){
  if(!uuidV1(pid)||!uuidV1(id))fail('INPUT_INVALID',400);const actor=structuredClone(rawActor),session=actor.authSession;
  if(!session||!uuidV1(session.id)||!isoV1(session.idleExpiresAt)||!isoV1(session.absoluteExpiresAt))fail('AUTH_REQUIRED',401);
  const validUntil=new Date(Math.min(Date.parse(session.idleExpiresAt),Date.parse(session.absoluteExpiresAt))).toISOString();
  const clock=async()=>{const rows=(await db.query('SELECT clock_timestamp() AS at')).rows;if(rows.length!==1||!(rows[0]?.at instanceof Date)||!Number.isFinite(rows[0].at.getTime()))fail();const at=rows[0].at;if(at.getTime()>=Date.parse(validUntil))fail('AUTH_REQUIRED',401);return at.toISOString();};
  const before=await clock();await projectMember(db,actor,pid,true);
  const result=cloneV1(await this.ports.results.read(db,structuredClone(actor),pid,id));if(result.ref?.id!==id||result.snapshot?.scope?.projectId!==pid)fail();
  // 기존 reader가 전체 저장원장·ACK를 같은 statement에서 검증한 뒤의 최근20 표시만 소비한다.
  const journal=cloneV1(await this.ports.journal.read(db,structuredClone(actor),pid,id));
  await projectMember(db,actor,pid,true);const asOf=await clock();if(Date.parse(asOf)<Date.parse(before))fail();
  let basis:ReturnType<typeof prepareStoredIssueBasis>;try{basis=prepareStoredIssueBasis(result,journal,asOf);}catch{fail();}
  return{validUntil,basis};
 }
}
