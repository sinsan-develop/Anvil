import type {PoolClient} from 'pg';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {refV1,uuidV1,isoV1} from '../../../../contracts/runtime/validation-v1.ts';
import {AuthFailure,type AuthenticatedIdentity} from '../access/repository.ts';
import {projectMember} from '../access/project-command.ts';
import type {ProjectResultExecutionSource} from '../results/project-result-execution-source.ts';
import {readStoredSyntheticStopCommand} from '../executions/execution-stop-store.ts';
const hash=(v:unknown)=>contentHash(canonicalJson(v)),same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
function fail():never{throw new AuthFailure('RESULT_STOP_HISTORY_INVALID',503);}
/** 원제출의 정확 실행에 보관된 요청만 읽는다. 실제 전달/정지/쓰기 회수를 관측하지 않는다. */
export class ProjectStopRequestHistory{
 readonly sources:Pick<ProjectResultExecutionSource,'read'>;readonly readStop:typeof readStoredSyntheticStopCommand;
 constructor(sources:Pick<ProjectResultExecutionSource,'read'>,readStop=readStoredSyntheticStopCommand){if(typeof sources?.read!=='function'||typeof readStop!=='function')fail();this.sources=sources;this.readStop=readStop;}
 async read(db:PoolClient,rawActor:AuthenticatedIdentity,pid:string,resultId:string){
  if(!uuidV1(pid)||!uuidV1(resultId))throw new AuthFailure('INPUT_INVALID',400);const actor=structuredClone(rawActor);await projectMember(db,actor,pid);const parent=await this.sources.read(db,structuredClone(actor),pid,resultId),e=parent.execution,ref=e.scope.executionRef;
  if(parent.projectId!==pid||!refV1(parent.resultRef)||parent.resultRef.id!==resultId||parent.sourceState!=='HISTORICAL_REFERENCE_ONLY'||e.transport!=='SYNTHETIC_ONLY'||e.scope.projectId!==pid||!refV1(ref)||!refV1(e.scope.assignmentRef)||hash(e.snapshot)!==ref.contentHash)fail();
  const scope={projectId:pid,executionId:ref.id,executionGeneration:ref.version},rows=(await db.query(`SELECT clock_timestamp() AS at,COALESCE((SELECT jsonb_agg(to_jsonb(v) ORDER BY v.requested_at DESC,v.id DESC) FROM
   (SELECT id,version,content_hash,snapshot_json->>'requestedAt' AS requested_at FROM anvil.execution_commands WHERE project_id=$1 AND execution_id=$2 AND generation=$3 AND snapshot_json->>'state'='STOP_REQUEST_STORED' ORDER BY snapshot_json->>'requestedAt' DESC,id DESC LIMIT 21) v),'[]'::jsonb) AS stop_rows`,[pid,ref.id,ref.version])).rows;
  if(rows.length!==1||!(rows[0].at instanceof Date)||!Number.isFinite(rows[0].at.getTime())||!Array.isArray(rows[0].stop_rows)||rows[0].stop_rows.length>21)fail();const at=rows[0].at.toISOString(),selected=rows[0].stop_rows.slice(0,20),items: {ref:{id:string;version:number;contentHash:string};requestHash:string;requestedAt:string;expiresAt:string;reason:string;grantKind:'EXECUTION'|'RECOVERY'}[]=[],ids=new Set<string>();let previous:{at:string;id:string}|null=null;
  for(const row of selected){const r={id:row.id,version:Number(row.version),contentHash:row.content_hash};if(!refV1(r)||r.version!==1||ids.has(r.id)||!isoV1(row.requested_at)||row.requested_at>at||previous&&(row.requested_at>previous.at||row.requested_at===previous.at&&r.id>=previous.id))fail();ids.add(r.id);previous={at:row.requested_at,id:r.id};
   const record=await this.readStop(db,structuredClone(actor),structuredClone(scope),structuredClone(r)),s=record.snapshot;if(!same(record.ref,r)||!same(s.scope,scope)||s.currentBinding.context.assignmentId!==e.scope.assignmentRef.id||s.requestedAt!==row.requested_at||!isoV1(s.expiresAt)||s.expiresAt<=s.requestedAt||Date.parse(s.expiresAt)-Date.parse(s.requestedAt)>30000)fail();items.push({ref:r,requestHash:s.requestHash,requestedAt:s.requestedAt,expiresAt:s.expiresAt,reason:s.reason,grantKind:s.currentBinding.grantKind});
  }
  await projectMember(db,actor,pid);const value={projectId:pid,resultRef:structuredClone(parent.resultRef),executionRef:structuredClone(ref),transport:'SYNTHETIC_ONLY' as const,sourceState:'SERVER_STORED_STOP_INTENTS_ONLY' as const,historyValidation:'DISPLAYED_COMMAND_RECEIPT_AUDIT_HELD_OUTBOX' as const,items,hasMore:rows[0].stop_rows.length>20,stopState:'NOT_OBSERVED' as const,currentAuthorizationVerified:false as const,writerReleaseVerified:false as const,executionAuthorized:false as const,dispatchPerformed:false as const,observedAt:at};if(Buffer.byteLength(canonicalJson(value))>2*1024*1024)throw new AuthFailure('RESULT_STOP_HISTORY_LIMIT',412);return{...value,contentHash:hash(value)};
 }
}
