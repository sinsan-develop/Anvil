import type {PoolClient} from 'pg';
import {canonicalJson,contentHash,parseWireJson} from '../../../../contracts/canonical.ts';
import {timingSafeEqual} from 'node:crypto';
import {cloneV1,refV1,uuidV1,recordV1,isoV1,hashV1} from '../../../../contracts/runtime/validation-v1.ts';
import {AuthFailure,type AuthenticatedIdentity} from '../access/repository.ts';
import {projectMember} from '../access/project-command.ts';
import type {ProjectResultExecutionSource} from '../results/project-result-execution-source.ts';
import {inspectStoredObservationJournal} from '../executions/execution-observations.ts';
function fail(code='RESULT_OBSERVATION_LEDGER_INVALID',status=503):never{throw new AuthFailure(code,status);}
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const hash=(v:unknown)=>contentHash(canonicalJson(v)),purpose='RESULT_OBSERVATION_PAGE_V1';
const sequence=(v:unknown,min=0):v is number=>Number.isSafeInteger(v)&&Number(v)>=min&&Number(v)<=10000;
/** 원제출에 고정된 합성 실행의 서버 보관 주장/연속 ACK만 읽는다. 현재 OS·권한·회수 사실이 아니다. */
export class ProjectObservationJournal{
 readonly sources:Pick<ProjectResultExecutionSource,'read'>;
 constructor(sources:Pick<ProjectResultExecutionSource,'read'>){if(typeof sources?.read!=='function')fail('RESULT_OBSERVATION_READER_REQUIRED');this.sources=sources;}
 async #load(db:PoolClient,rawActor:AuthenticatedIdentity,pid:string,resultId:string){
  if(!uuidV1(pid)||!uuidV1(resultId))fail('RESULT_OBSERVATION_INPUT_INVALID',400);const actor=structuredClone(rawActor);await projectMember(db,actor,pid);
  const parent=await this.sources.read(db,structuredClone(actor),pid,resultId),scope=parent.execution.scope,ref=scope.executionRef;
  if(parent.projectId!==pid||!refV1(parent.resultRef)||parent.resultRef.id!==resultId||scope.projectId!==pid||!refV1(ref)||parent.sourceState!=='HISTORICAL_REFERENCE_ONLY'||parent.execution.transport!=='SYNTHETIC_ONLY'||contentHash(canonicalJson(parent.execution.snapshot))!==ref.contentHash)fail();
  // 관측과 최신 ACK는 같은 statement snapshot에서 읽어 동시 append의 중간 조합을 만들지 않는다.
  const rows=(await db.query(`SELECT clock_timestamp() AS at,
   COALESCE((SELECT jsonb_agg(to_jsonb(v)||jsonb_build_object('grant_hash',g.content_hash) ORDER BY v.event_sequence)
    FROM (SELECT * FROM anvil.execution_observations WHERE project_id=$1 AND execution_id=$2 AND generation=$3 ORDER BY event_sequence LIMIT 10001) v
    LEFT JOIN anvil.execution_grants g ON g.project_id=v.project_id AND g.id=v.grant_id AND g.version=v.grant_version AND g.execution_id=v.execution_id AND g.generation=v.generation),'[]'::jsonb) AS observation_rows,
   (SELECT to_jsonb(v)||jsonb_build_object('grant_hash',g.content_hash) FROM anvil.execution_acknowledgements v
    LEFT JOIN anvil.execution_grants g ON g.project_id=v.project_id AND g.id=v.grant_id AND g.version=v.grant_version AND g.execution_id=v.execution_id AND g.generation=v.generation
    WHERE v.project_id=$1 AND v.execution_id=$2 AND v.generation=$3 ORDER BY v.version DESC LIMIT 1) AS ack_row`,[pid,ref.id,ref.version])).rows;
  if(rows.length!==1)fail();const row=rows[0],at=row.at;if(!(at instanceof Date)||!Number.isFinite(at.getTime())||!Array.isArray(row.observation_rows)||row.observation_rows.length>10000)fail();let journal;
  try{
   const entry=(v:any)=>{if(!v||v.project_id!==pid||v.execution_id!==ref.id||Number(v.generation)!==ref.version||!refV1({id:v.grant_id,version:Number(v.grant_version),contentHash:v.grant_hash}))fail();return{ref:{id:v.id,version:Number(v.version),contentHash:v.content_hash},snapshot:v.snapshot_json};};
   const events=row.observation_rows.map((v:any)=>{const e=entry(v);if(v.event_sequence!==e.snapshot?.event?.sequence&&!same(Number(v.event_sequence),e.snapshot?.event?.sequence)||!same(e.snapshot?.grantRef,{id:v.grant_id,version:Number(v.grant_version),contentHash:v.grant_hash}))fail();return e;});
   journal=inspectStoredObservationJournal({projectId:pid,executionId:ref.id,executionGeneration:ref.version},{complete:true,events,ack:row.ack_row===null?null:entry(row.ack_row)},at.toISOString());
  }catch{fail();}
  await projectMember(db,actor,pid);return{projectId:pid,resultRef:cloneV1(parent.resultRef),executionRef:cloneV1(ref),transport:'SYNTHETIC_ONLY' as const,sourceState:'SERVER_STORED_SYNTHETIC_CLAIMS_ONLY' as const,ledgerValidation:'HASH_SEQUENCE_ACK_ONLY' as const,items:journal.events.sort((a,b)=>b.snapshot.event.sequence-a.snapshot.event.sequence),storedCount:journal.events.length,hasMore:journal.events.length>20,ack:journal.ack,localSequence:null,localSequenceState:'NOT_OBSERVED' as const,actualProviderObserved:false as const,currentAuthorizationVerified:false as const,completionAccepted:false as const,formalFailureCounted:false as const,writerReleaseVerified:false as const,executionAuthorized:false as const,dispatchPerformed:false as const,observedAt:at.toISOString()};
 }
 async read(db:PoolClient,actor:AuthenticatedIdentity,pid:string,resultId:string){
  const full=await this.#load(db,actor,pid,resultId),value={...full,items:full.items.slice(0,20)};this.#limit(value);return value;
 }
 #limit(value:unknown){if(Buffer.byteLength(canonicalJson(value))>2*1024*1024)fail('RESULT_OBSERVATION_RESPONSE_LIMIT',412);}
 async page(db:PoolClient,rawActor:AuthenticatedIdentity,pid:string,resultId:string,query:Record<string,unknown>,sign:(encoded:string)=>string){
  const actor=structuredClone(rawActor),session=actor.authSession;
  if(!recordV1(query,query?.cursor===undefined?[]:['cursor'])||query.cursor!==undefined&&(typeof query.cursor!=='string'||!query.cursor.length||query.cursor.length>4096)||typeof sign!=='function')fail('RESULT_OBSERVATION_PAGE_INPUT_INVALID',400);
  if(!uuidV1(actor.actorId)||!uuidV1(actor.clientId)||!Number.isSafeInteger(actor.credentialGeneration)||actor.credentialGeneration<1||!session||!uuidV1(session.id)||!isoV1(session.idleExpiresAt)||!isoV1(session.absoluteExpiresAt))fail('RESULT_OBSERVATION_PAGE_AUTH_REQUIRED',403);
  const full=await this.#load(db,actor,pid,resultId),now=full.observedAt,bindingHash=hash({purpose,actor:{userId:actor.actorId,clientId:actor.clientId,sessionId:session.id,credentialGeneration:actor.credentialGeneration},projectId:pid,resultRef:full.resultRef,executionRef:full.executionRef});
  let cap=full.items[0]?.snapshot.event.sequence??0,before:number|null=null,issuedAt=now,expiresAt=new Date(Math.min(Date.parse(now)+30000,Date.parse(session.idleExpiresAt),Date.parse(session.absoluteExpiresAt))).toISOString(),digest:string|null=null;
  if(query.cursor!==undefined)try{
   const m=/^([A-Za-z0-9_-]+)\.([a-f0-9]{64})$/.exec(query.cursor as string);if(!m)throw Error();const signed=sign(m[1]!);if(!hashV1(signed)||!timingSafeEqual(Buffer.from(signed,'hex'),Buffer.from(m[2]!,'hex')))throw Error();const bytes=Buffer.from(m[1]!,'base64url'),text=bytes.toString('utf8'),v=parseWireJson(text);
   if(bytes.toString('base64url')!==m[1]||canonicalJson(v)!==text||!recordV1(v,['purpose','bindingHash','snapshotMaxSequence','snapshotDigest','beforeSequence','issuedAt','expiresAt'])||v.purpose!==purpose||v.bindingHash!==bindingHash||!sequence(v.snapshotMaxSequence)||v.beforeSequence!==null&&(!sequence(v.beforeSequence,1)||v.beforeSequence>v.snapshotMaxSequence)||!hashV1(v.snapshotDigest)||!isoV1(v.issuedAt)||!isoV1(v.expiresAt)||Date.parse(v.issuedAt)>Date.parse(now)||Date.parse(v.expiresAt)<=Date.parse(now)||Date.parse(v.expiresAt)<=Date.parse(v.issuedAt)||Date.parse(v.expiresAt)-Date.parse(v.issuedAt)>30000)throw Error();
   cap=v.snapshotMaxSequence;before=v.beforeSequence;digest=v.snapshotDigest;issuedAt=v.issuedAt;expiresAt=v.expiresAt;
  }catch{fail('RESULT_OBSERVATION_CURSOR_INVALID',412);}
  const snapshot=full.items.filter(e=>e.snapshot.event.sequence<=cap),snapshotDigest=hash(snapshot.map(e=>e.ref));if(digest!==null&&digest!==snapshotDigest)fail('RESULT_OBSERVATION_CURSOR_STALE',412);
  const rows=snapshot.filter(e=>before===null||e.snapshot.event.sequence<before),hasMore=rows.length>20,items=rows.slice(0,20);
  const token=(position:number|null)=>{const encoded=Buffer.from(canonicalJson({purpose,bindingHash,snapshotMaxSequence:cap,snapshotDigest,beforeSequence:position,issuedAt,expiresAt})).toString('base64url'),signature=sign(encoded);if(!hashV1(signature))fail();return encoded+'.'+signature;};
  const pageCursor=query.cursor===undefined?token(before):query.cursor as string,nextCursor=hasMore?token(items[items.length-1]!.snapshot.event.sequence):null;
  await projectMember(db,actor,pid);const clock=(await db.query('SELECT clock_timestamp() AS at')).rows;if(clock.length!==1||!(clock[0].at instanceof Date)||!Number.isFinite(clock[0].at.getTime())||clock[0].at.getTime()<Date.parse(now)||clock[0].at.getTime()>=Math.min(Date.parse(expiresAt),Date.parse(session.idleExpiresAt),Date.parse(session.absoluteExpiresAt)))fail('RESULT_OBSERVATION_CURSOR_EXPIRED',412);
  const value={...full,items,hasMore,nextCursor,pageCursor,snapshotMaxSequence:cap,snapshotDigest,snapshotCount:snapshot.length,beforeSequence:before,cursorExpiresAt:expiresAt};this.#limit(value);return value;
 }
}
