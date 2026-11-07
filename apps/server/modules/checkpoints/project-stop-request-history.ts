import {timingSafeEqual} from 'node:crypto';
import type {PoolClient} from 'pg';
import {canonicalJson,contentHash,parseWireJson} from '../../../../contracts/canonical.ts';
import {refV1,uuidV1,isoV1,recordV1,hashV1} from '../../../../contracts/runtime/validation-v1.ts';
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
 /** 기존 최근20 응답을 바꾸지 않는 과거 보호 페이지다. */
 async page(db:PoolClient,rawActor:AuthenticatedIdentity,pid:string,resultId:string,query:Record<string,unknown>,sign:(encoded:string)=>string){
  const actor=structuredClone(rawActor),session=actor.authSession,start=performance.now(),deadline=start+30000;
  const invalidCursor=():never=>{throw new AuthFailure('CURSOR_INVALID',400);};
  const safe=(v:unknown,min=0)=>{if(typeof v!=='number'&&(typeof v!=='string'||! /^(0|[1-9][0-9]*)$/.test(v)))fail();const n=Number(v);if(!Number.isSafeInteger(n)||n<min)fail();return n;};
  const tuple=(v:any)=>recordV1(v,['requestedAt','id'])&&isoV1(v.requestedAt)&&uuidV1(v.id);
  const upperValid=(v:any)=>recordV1(v,['ref','requestedAt'])&&refV1(v.ref)&&v.ref.version===1&&isoV1(v.requestedAt);
  const beforeOrEqual=(a:{requestedAt:string;id:string},b:{requestedAt:string;id:string})=>a.requestedAt<b.requestedAt||a.requestedAt===b.requestedAt&&a.id<=b.id;
  if(!uuidV1(pid)||!uuidV1(resultId)||!recordV1(query,query?.cursor===undefined?[]:['cursor'])||query.cursor!==undefined&&(typeof query.cursor!=='string'||!query.cursor.length||query.cursor.length>4096)||typeof sign!=='function')throw new AuthFailure('INPUT_INVALID',400);
  if(!uuidV1(actor.actorId)||!uuidV1(actor.clientId)||!Number.isSafeInteger(actor.credentialGeneration)||actor.credentialGeneration<1||!session||!uuidV1(session.id)||!isoV1(session.idleExpiresAt)||!isoV1(session.absoluteExpiresAt))throw new AuthFailure('AUTH_REQUIRED',401);
  const sessionExpiry=Math.min(Date.parse(session.idleExpiresAt),Date.parse(session.absoluteExpiresAt));let expiresAt:string|null=null,firstClock=-Infinity;
  const check=(now?:Date)=>{if(performance.now()>=deadline)throw new AuthFailure('RESULT_STOP_HISTORY_LIMIT',412);if(now!==undefined){if(!(now instanceof Date)||!Number.isFinite(now.getTime())||now.getTime()<firstClock)fail();if(now.getTime()>=sessionExpiry)throw new AuthFailure('AUTH_REQUIRED',401);if(Number.isFinite(firstClock)&&now.getTime()-firstClock>=30000)throw new AuthFailure('RESULT_STOP_HISTORY_LIMIT',412);if(expiresAt!==null&&now.getTime()>=Date.parse(expiresAt))invalidCursor();}};
  const clock=async()=>{check();const rows=(await db.query('SELECT clock_timestamp() AS at')).rows;check();if(rows.length!==1)fail();check(rows[0].at);return rows[0].at as Date;};
  await projectMember(db,actor,pid);check();const initial=await clock();firstClock=initial.getTime();
  const parent=await this.sources.read(db,structuredClone(actor),pid,resultId);check();const e=parent.execution,executionRef=e.scope.executionRef;
  if(parent.projectId!==pid||!refV1(parent.resultRef)||parent.resultRef.id!==resultId||parent.sourceState!=='HISTORICAL_REFERENCE_ONLY'||e.transport!=='SYNTHETIC_ONLY'||e.scope.projectId!==pid||!refV1(executionRef)||!refV1(e.scope.assignmentRef)||hash(e.snapshot)!==executionRef.contentHash)fail();
  const purpose='RESULT_STOP_REQUEST_PAGE_V1',bindingHash=hash({purpose,actor:{userId:actor.actorId,clientId:actor.clientId,sessionId:session.id,credentialGeneration:actor.credentialGeneration},projectId:pid,resultRef:parent.resultRef,executionRef});
  type Position={requestedAt:string;id:string};type Upper={ref:{id:string;version:number;contentHash:string};requestedAt:string};
  let upper:Upper|null=null,cap=0,before:Position|null=null,issuedAt=initial.toISOString();expiresAt=new Date(Math.min(firstClock+1800000,sessionExpiry)).toISOString();
  if(query.cursor!==undefined)try{
   const m=/^([A-Za-z0-9_-]+)\.([a-f0-9]{64})$/.exec(query.cursor as string);if(!m)throw Error();const signature=sign(m[1]!);if(!hashV1(signature)||!timingSafeEqual(Buffer.from(signature,'hex'),Buffer.from(m[2]!,'hex')))throw Error();
   const bytes=Buffer.from(m[1]!,'base64url'),text=bytes.toString('utf8'),v:any=parseWireJson(text);
   if(bytes.toString('base64url')!==m[1]||canonicalJson(v)!==text||!recordV1(v,['schemaVersion','purpose','bindingHash','snapshotUpper','snapshotMaxAuditSequence','before','issuedAt','expiresAt'])||v.schemaVersion!==1||v.purpose!==purpose||v.bindingHash!==bindingHash||v.snapshotUpper!==null&&!upperValid(v.snapshotUpper)||!Number.isSafeInteger(v.snapshotMaxAuditSequence)||v.snapshotMaxAuditSequence<0||v.snapshotUpper===null&&v.snapshotMaxAuditSequence!==0||v.snapshotUpper!==null&&v.snapshotMaxAuditSequence<1||v.before!==null&&!tuple(v.before)||v.before!==null&&(v.snapshotUpper===null||!beforeOrEqual(v.before,{requestedAt:v.snapshotUpper.requestedAt,id:v.snapshotUpper.ref.id}))||!isoV1(v.issuedAt)||!isoV1(v.expiresAt)||Date.parse(v.issuedAt)>firstClock||Date.parse(v.expiresAt)<=firstClock||Date.parse(v.expiresAt)<=Date.parse(v.issuedAt)||Date.parse(v.expiresAt)-Date.parse(v.issuedAt)>1800000||Date.parse(v.expiresAt)>sessionExpiry)throw Error();
   upper=v.snapshotUpper;cap=v.snapshotMaxAuditSequence;before=v.before;issuedAt=v.issuedAt;expiresAt=v.expiresAt;
  }catch{invalidCursor();}
  const scope={projectId:pid,executionId:executionRef.id,executionGeneration:executionRef.version};
  const meta=`SELECT e.id,e.version,e.content_hash,e.snapshot_json->>'requestedAt' AS requested_at,(SELECT count(*) FROM anvil.audit_events a WHERE a.command_id=e.created_command_id) audit_count,(SELECT min(server_sequence) FROM anvil.audit_events a WHERE a.command_id=e.created_command_id) audit_sequence FROM anvil.execution_commands e`;
  let rows:any[]=[];
  if(query.cursor===undefined||upper!==null){
   const result=(await db.query(`SELECT /* stop-page-metadata */ clock_timestamp() AS at,COALESCE((SELECT max(server_sequence) FROM anvil.audit_events WHERE project_id=$1),0) max_sequence,
    (SELECT count(*) FROM anvil.execution_commands e WHERE e.project_id=$1 AND e.execution_id=$2 AND e.generation=$3 AND e.snapshot_json->>'state'='STOP_REQUEST_STORED' AND ((SELECT count(*) FROM anvil.audit_events a WHERE a.command_id=e.created_command_id)<>1 OR EXISTS(SELECT 1 FROM anvil.audit_events a WHERE a.command_id=e.created_command_id AND (a.project_id<>$1 OR a.server_sequence<1 OR a.server_sequence>9007199254740991)))) invalid_count,
    COALESCE((SELECT jsonb_agg(to_jsonb(v) ORDER BY v.requested_at DESC,v.id DESC) FROM (${meta} WHERE e.project_id=$1 AND e.execution_id=$2 AND e.generation=$3 AND e.snapshot_json->>'state'='STOP_REQUEST_STORED'
     AND e.snapshot_json->>'requestedAt'<=$9::text AND ($4::text IS NULL OR (e.snapshot_json->>'requestedAt',e.id)<=($4::text,$5::uuid)) AND ($6::bigint IS NULL OR (SELECT min(server_sequence) FROM anvil.audit_events a WHERE a.command_id=e.created_command_id)<=$6)
     AND ($7::text IS NULL OR (e.snapshot_json->>'requestedAt',e.id)<($7::text,$8::uuid)) ORDER BY e.snapshot_json->>'requestedAt' DESC,e.id DESC LIMIT 21) v),'[]'::jsonb) stop_rows`,[pid,executionRef.id,executionRef.version,upper?.requestedAt??null,upper?.ref.id??null,query.cursor===undefined?null:cap,before?.requestedAt??null,before?.id??null,initial.toISOString()])).rows;
   check();if(result.length!==1||!Array.isArray(result[0].stop_rows)||result[0].stop_rows.length>21||safe(result[0].invalid_count)!==0)fail();check(result[0].at);rows=result[0].stop_rows;
   if(query.cursor===undefined){cap=rows.length?safe(result[0].max_sequence,1):0;if(rows.length){upper={ref:{id:rows[0].id,version:safe(rows[0].version,1),contentHash:rows[0].content_hash},requestedAt:rows[0].requested_at};if(!upperValid(upper))fail();}}
  }
  const metadata=(r:any)=>{const ref={id:r.id,version:safe(r.version,1),contentHash:r.content_hash};if(!refV1(ref)||ref.version!==1||!isoV1(r.requested_at)||r.requested_at>initial.toISOString()||safe(r.audit_count)!==1||safe(r.audit_sequence,1)>cap)fail();return{ref,requestedAt:r.requested_at};};
  let previous=before;for(const row of rows){const v=metadata(row),t={requestedAt:v.requestedAt,id:v.ref.id};if(!upper||!beforeOrEqual(t,{requestedAt:upper.requestedAt,id:upper.ref.id})||previous&&(!beforeOrEqual(t,previous)||t.requestedAt===previous.requestedAt&&t.id===previous.id))fail();previous=t;}
  const records=new Map<string,Awaited<ReturnType<typeof readStoredSyntheticStopCommand>>>();
  const protectedRead=async(v:Upper)=>{check();let record;try{record=await this.readStop(db,structuredClone(actor),structuredClone(scope),structuredClone(v.ref));}catch(error){if(error instanceof AuthFailure&&[401,403].includes(error.statusCode))throw error;if(error instanceof AuthFailure&&error.statusCode===404){await projectMember(db,actor,pid);check();}fail();}check();const s=record.snapshot;if(!same(record.ref,v.ref)||!same(s.scope,scope)||s.currentBinding.context.assignmentId!==e.scope.assignmentRef.id||s.requestedAt!==v.requestedAt||!isoV1(s.expiresAt)||s.expiresAt<=s.requestedAt||Date.parse(s.expiresAt)-Date.parse(s.requestedAt)>30000)fail();records.set(v.ref.id,record);return record;};
  if(upper){if(query.cursor!==undefined){const selected=(await db.query(meta+' /* stop-page-upper */ WHERE e.project_id=$1 AND e.execution_id=$2 AND e.generation=$3 AND e.id=$4 LIMIT 2',[pid,executionRef.id,executionRef.version,upper.ref.id])).rows;check();if(selected.length!==1||!same(metadata(selected[0]),upper))fail();}await protectedRead(upper);}
  const items:Awaited<ReturnType<ProjectStopRequestHistory['read']>>['items']=[];
  for(const row of rows.slice(0,20)){const v=metadata(row),record=records.get(v.ref.id)??await protectedRead(v),s=record.snapshot;items.push({ref:v.ref,requestHash:s.requestHash,requestedAt:s.requestedAt,expiresAt:s.expiresAt,reason:s.reason,grantKind:s.currentBinding.grantKind});}
  const token=(position:Position|null)=>{const encoded=Buffer.from(canonicalJson({schemaVersion:1,purpose,bindingHash,snapshotUpper:upper,snapshotMaxAuditSequence:cap,before:position,issuedAt,expiresAt})).toString('base64url'),signature=sign(encoded);if(!hashV1(signature))fail();return encoded+'.'+signature;};
  const hasMore=rows.length>20,last=items.at(-1),pageCursor=query.cursor===undefined?token(before):query.cursor as string,nextCursor=hasMore&&last?token({requestedAt:last.requestedAt,id:last.ref.id}):null;
  await projectMember(db,actor,pid);check();const final=await clock();
  const value={projectId:pid,resultRef:structuredClone(parent.resultRef),executionRef:structuredClone(executionRef),transport:'SYNTHETIC_ONLY' as const,sourceState:'SERVER_STORED_STOP_INTENTS_ONLY' as const,historyValidation:'DISPLAYED_COMMAND_RECEIPT_AUDIT_HELD_OUTBOX' as const,items,hasMore,stopState:'NOT_OBSERVED' as const,currentAuthorizationVerified:false as const,writerReleaseVerified:false as const,executionAuthorized:false as const,dispatchPerformed:false as const,observedAt:final.toISOString(),pageCursor,nextCursor,snapshotUpper:upper,snapshotMaxAuditSequence:cap,before,cursorIssuedAt:issuedAt,cursorExpiresAt:expiresAt};
  if(Buffer.byteLength(canonicalJson(value))>2*1024*1024)throw new AuthFailure('RESULT_STOP_HISTORY_LIMIT',412);check();return{...value,contentHash:hash(value)};
 }

}
