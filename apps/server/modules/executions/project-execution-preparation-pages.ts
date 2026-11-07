import type {PoolClient} from 'pg';
import {canonicalJson} from '../../../../contracts/canonical.ts';
import {refV1,uuidV1,isoV1} from '../../../../contracts/runtime/validation-v1.ts';
import {AuthFailure,type AuthenticatedIdentity} from '../access/repository.ts';
import {projectMember} from '../access/project-command.ts';
import {ProjectListCodec} from '../projects/service.ts';
import type {ProjectAssignmentConfirmations} from '../assignments/project-assignment-confirmations.ts';
import type {ProjectExecutionPreparations} from './project-execution-preparations.ts';
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const invalid=():never=>{throw new AuthFailure('EXECUTION_PREPARATION_PAGE_INTEGRITY_FAILED',503);};
/** 원문 reader를 통과한 과거 준비 기록만 투영한다. 현재 실행 허가는 생성하지 않는다. */
export async function readExecutionPreparationPage(db:PoolClient,actor:AuthenticatedIdentity,projectId:string,id:string,version:number,query:Record<string,unknown>,dependencies:{assignments:Pick<ProjectAssignmentConfirmations,'read'>;preparations:Pick<ProjectExecutionPreparations,'read'>},codec:ProjectListCodec){
 if(!uuidV1(projectId)||!uuidV1(id)||!Number.isSafeInteger(version)||version<1||Object.keys(query).some(k=>k!=='cursor')||query.cursor!==undefined&&(typeof query.cursor!=='string'||!query.cursor.length||query.cursor.length>4096))throw new AuthFailure('INPUT_INVALID',400);
 await projectMember(db,actor,projectId);
 const assignment=await dependencies.assignments.read(db,actor,projectId,id,version);
 if(assignment.projectId!==projectId||!refV1(assignment.ref)||assignment.ref.id!==id||assignment.ref.version!==version||assignment.snapshot.contentConfirmed!==true||assignment.snapshot.executionAuthorized!==false||assignment.snapshot.dispatchPerformed!==false)throw new AuthFailure('VERSION_CONFLICT',409);
 const filter={query:canonicalJson({projectId,assignmentRef:assignment.ref,order:'created_at DESC,id DESC',pageSize:20}),archived:false,limit:20};
 let position:{at:string;id:string}|null=null;
 if(query.cursor!==undefined){try{position=codec.read(query.cursor as string,actor.actorId,filter);}catch{throw new AuthFailure('CURSOR_INVALID',400);}}
 const rows=(await db.query(`SELECT id,version,content_hash,to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS created_position FROM anvil.execution_preparations WHERE project_id=$1 AND assignment_id=$2 AND assignment_version=$3 AND ($4::timestamptz IS NULL OR (created_at,id)<($4::timestamptz,$5::uuid)) ORDER BY created_at DESC,id DESC LIMIT 21`,[projectId,id,version,position?.at??null,position?.id??null])).rows;
 if(rows.length>21)invalid();
 let previous=position;
 for(const row of rows){if(!uuidV1(row.id)||Number(row.version)!==1||typeof row.created_position!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(row.created_position)||!Number.isFinite(Date.parse(row.created_position)))invalid();if(previous&&(row.created_position>previous.at||row.created_position===previous.at&&row.id>=previous.id))invalid();previous={at:row.created_position,id:row.id};}
 const items=[];
 for(const row of rows.slice(0,20)){
  const value=await dependencies.preparations.read(db,actor,projectId,row.id,Number(row.version)),s=value.snapshot;
  if(value.projectId!==projectId||!refV1(value.ref)||value.ref.id!==row.id||value.ref.version!==Number(row.version)||value.ref.contentHash!==row.content_hash||!same(s.intent.assignmentRef,assignment.ref)||s.intent.projectId!==projectId||!isoV1(s.checkedAt))invalid();
  items.push({ref:value.ref,mode:s.intent.mode,checkedAt:s.checkedAt,missingConditions:s.missingConditions});
 }
 const last=rows[Math.min(rows.length,20)-1],result={projectId,assignmentRef:assignment.ref,items,nextCursor:rows.length>20?codec.create(actor.actorId,filter,{at:last.created_position,id:last.id}):null,currentness:'NOT_RECHECKED' as const,executionAuthorized:false as const,dispatchPerformed:false as const};
 if(Buffer.byteLength(canonicalJson(result),'utf8')>2*1024*1024)throw new AuthFailure('EXECUTION_PREPARATION_PAGE_TOO_LARGE',503);
 return result;
}
