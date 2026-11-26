import type {PoolClient} from 'pg';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {cloneV1,isoV1,recordV1,refV1,uuidV1,type RuntimeRefV1} from '../../../../contracts/runtime/validation-v1.ts';
import {AuthFailure,type AuthenticatedIdentity} from '../access/repository.ts';
import {authorizeMaterial,currentProjectController,persistProjectReceipt,projectMember,type ProjectCommand} from '../access/project-command.ts';
import {prepareSubmittedResult} from './result-submission.ts';
import {readSubmittedResultRecord,type SyntheticSubmittedResult} from './result-submission-store.ts';
import {readPgResultExecution} from './result-execution-pg.ts';
import type {ResultEvidenceScope} from './result-evidence.ts';
import {ProjectListCodec} from '../projects/service.ts';
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b),hash=(v:unknown)=>contentHash(canonicalJson(v));
const fail=(code:string,status=503):never=>{throw new AuthFailure(code,status);};
interface ResultReplay{request:ProjectCommand;result:unknown;actorId:string}
/** 0025 결과 테이블을 사용하는 실제 PG adapter. caller의 인증 tx를 재사용한다.
 * Agent 실행기/현재 OS 관측은 연결하지 않으며 기존 합성 실행의 결과 제출도 WORKER_CLAIM으로만 보관한다. */
export class ProjectResultSubmissions{
 async #clock(db:PoolClient){const at=(await db.query('SELECT clock_timestamp() AS at')).rows[0]?.at;if(!(at instanceof Date)||!Number.isFinite(at.getTime()))return fail('RESULT_CLOCK_INVALID');return at.toISOString();}
 async #row(db:PoolClient,projectId:string,id:string){const rows=(await db.query('SELECT * FROM anvil.result_submissions WHERE project_id=$1 AND id=$2 LIMIT 2',[projectId,id])).rows;if(rows.length>1)return fail('RESULT_SUBMISSION_LEDGER_INVALID');return rows[0]??null;}
 #entry(row:any,scope:ResultEvidenceScope,id:string,now:string){
  try{
   const entry=readSubmittedResultRecord({ref:{id:row.id,version:1,contentHash:row.content_hash},snapshot:row.snapshot_json},scope,id,now),s=entry.snapshot;
   if(row.project_id!==scope.projectId||row.execution_id!==scope.executionRef.id||Number(row.generation)!==scope.executionRef.version||!same(row.assignment_ref,scope.assignmentRef)||!same(row.execution_ref,scope.executionRef)||row.manifest_hash!==s.manifestHash||!same(row.manifest_ref,{id,version:1,contentHash:s.manifestHash})||row.submission_state!==s.manifest.submissionState||row.submitted_by!==s.submittedByRef.id||!uuidV1(row.client_id)||!uuidV1(row.command_id)||!(row.submitted_at instanceof Date)||row.submitted_at.toISOString()!==s.submittedAt)return fail('RESULT_SUBMISSION_LEDGER_INVALID');return entry;
  }catch{return fail('RESULT_SUBMISSION_LEDGER_INVALID');}
 }
 /** 현재 submitter 자격을 다시 발급하지 않고, 같은 프로젝트에서 정착한 원 제출만 검산한다. */
 async #verifyOrigins(db:PoolClient,projectId:string,entries:{entry:SyntheticSubmittedResult;commandId:string;clientId:string}[],replay?:ResultReplay){
  if(!entries.length)return;
  try{
   const ids=entries.map(e=>e.commandId);
   if(new Set(ids).size!==ids.length)return fail('RESULT_SUBMISSION_LEDGER_INVALID');
   // 감사 조건을 JOIN에서 걸러 내지 않는다. 유효 행 옆에 잘못된 행이 하나라도 있으면 중복이다.
   const {rows}=await db.query(`
SELECT c.id,c.project_id,c.scope_kind,c.scope_id,c.draft_id,c.actor_id,c.client_id,c.operation,c.state,c.command_id,
 c.operation_id,c.authorization_receipt_id,c.policy_ref,c.expected_version,c.approval_consumption_id,c.payload_ref,
 c.control_generation,c.request_hash,c.result_ref,c.completed_at,ar.authorized_at,a.recorded_at,
 jsonb_build_object('id',ar.id,'command_id',ar.command_id,'scope_kind',ar.scope_kind,'scope_id',ar.scope_id,
  'subject_ref',ar.subject_ref,'policy_ref',ar.policy_ref,'scope_digest',ar.scope_digest,'approval_decision_ref',ar.approval_decision_ref) AS receipt,
 jsonb_build_object('project_id',a.project_id,'command_id',a.command_id,'operation_id',a.operation_id,'event_id',a.event_id,
  'actor_ref',a.actor_ref,'client_ref',a.client_ref,'policy_ref',a.policy_ref,'target_ref',a.target_ref,'approval_ref',a.approval_ref,
  'correction_of',a.correction_of,'outcome',a.outcome,'source_kind',a.source_kind,'reason_code',a.reason_code,'scope_digest',a.scope_digest) AS audit
FROM anvil.commands c
JOIN anvil.authorization_receipts ar ON ar.id=c.authorization_receipt_id AND ar.command_id=c.id
JOIN anvil.audit_events a ON a.project_id=c.project_id AND a.command_id=c.id
WHERE c.project_id=$1 AND c.id=ANY($2::uuid[]) LIMIT $3`,[projectId,ids,ids.length+1]);
   const commands=new Map(rows.map(c=>[c.id,c]));
   if(rows.length!==entries.length||commands.size!==entries.length)return fail('RESULT_SUBMISSION_LEDGER_INVALID');
   for(const {entry,commandId,clientId} of entries){
    const s=entry.snapshot,manifestRef={id:entry.ref.id,version:1,contentHash:s.manifestHash},actorId=s.submittedByRef.id,c=commands.get(commandId);
    if(!c||c.project_id!==projectId||c.scope_kind!=='PROJECT'||c.scope_id!==projectId||c.draft_id!==null||c.actor_id!==actorId||c.client_id!==clientId
     ||c.operation!=='submitResult'||c.state!=='APPLIED'||!uuidV1(c.command_id)||!uuidV1(c.operation_id)||!uuidV1(c.authorization_receipt_id)
     ||!refV1(c.policy_ref)||(c.expected_version!==0&&c.expected_version!=='0')||c.approval_consumption_id!==null||c.payload_ref!==null)return fail('RESULT_SUBMISSION_LEDGER_INVALID');
    const controlGeneration=Number(c.control_generation);
    if((typeof c.control_generation!=='string'&&typeof c.control_generation!=='number')||!Number.isSafeInteger(controlGeneration)||controlGeneration<1||String(controlGeneration)!==String(c.control_generation))return fail('RESULT_SUBMISSION_LEDGER_INVALID');
    const original={schemaVersion:1,projectId,commandId:c.command_id,clientId,controlGeneration,operation:'submitResult',targetId:entry.ref.id,
     expectedVersion:0,baselineRefs:[],approvalRef:null,payload:{scope:s.scope,submissionId:entry.ref.id,manifest:s.manifest}};
    const requestHash=hash(original),scopeDigest=hash({projectId,actorId,clientId,controlGeneration,requestHash,policyRef:c.policy_ref,targetRef:manifestRef});
    const result={operationId:c.operation_id,commandId:c.command_id,projectId,status:'APPLIED',targetId:entry.ref.id,version:1,
     data:{ref:manifestRef,status:'RESULT_SUBMITTED',manifest:s.manifest,sourceKind:'WORKER_CLAIM',completionAccepted:false,executionAuthorized:false,dispatchPerformed:false},
     evidenceRefs:[],warnings:[],serverReceivedAt:s.submittedAt};
    if(c.request_hash!==requestHash||!same(c.result_ref,result)||!(c.completed_at instanceof Date)||c.completed_at.toISOString()!==s.submittedAt)return fail('RESULT_SUBMISSION_LEDGER_INVALID');
    if(replay&&(actorId!==replay.actorId||!same(original,replay.request)||!same(result,replay.result)))return fail('RESULT_SUBMISSION_LEDGER_INVALID');
    const ar=c.receipt,a=c.audit;
    if(!ar||ar.id!==c.authorization_receipt_id||ar.command_id!==commandId||ar.scope_kind!=='PROJECT'||ar.scope_id!==projectId
     ||!same(ar.subject_ref,{kind:'HUMAN',userId:actorId,clientId})||!same(ar.policy_ref,c.policy_ref)||ar.scope_digest!==scopeDigest||ar.approval_decision_ref!==null
     ||!same(s.authorizationReceiptRef,{id:ar.id,version:1,contentHash:scopeDigest})||!(c.authorized_at instanceof Date)||c.authorized_at.toISOString()!==s.submittedAt
     ||!a||a.project_id!==projectId||a.command_id!==commandId||a.operation_id!==c.operation_id||!uuidV1(a.event_id)
     ||!same(a.actor_ref,{kind:'HUMAN',userId:actorId})||a.client_ref!==clientId||!same(a.policy_ref,c.policy_ref)||!same(a.target_ref,manifestRef)
     ||a.approval_ref!==null||a.correction_of!==null||a.outcome!=='APPLIED'||a.source_kind!=='HUMAN_COMMAND'||a.reason_code!=='EXPLICIT_RESULT_CLAIM_ONLY'
     ||a.scope_digest!==scopeDigest||!(c.recorded_at instanceof Date)||c.recorded_at.toISOString()!==s.submittedAt)return fail('RESULT_SUBMISSION_LEDGER_INVALID');
   }
  }catch{return fail('RESULT_SUBMISSION_LEDGER_INVALID');}
 }
 async #assertCurrent(db:PoolClient,actor:AuthenticatedIdentity,request:ProjectCommand,policyRef:RuntimeRefV1){
  await currentProjectController(db,actor,request);
  const final=await authorizeMaterial(db,actor,request),session=actor.authSession;
  if(!session||!uuidV1(session.id)||!isoV1(session.idleExpiresAt)||!isoV1(session.absoluteExpiresAt)||final.approvalRequired||!same(final.ref,policyRef)
   ||Date.parse(await this.#clock(db))>=Math.min(final.validUntil,Date.parse(session.idleExpiresAt),Date.parse(session.absoluteExpiresAt)))return fail('RESULT_SUBMISSION_CURRENT_CHANGED',409);
 }
 async submit(db:PoolClient,actor:AuthenticatedIdentity,request:ProjectCommand,policyRef:RuntimeRefV1){
  request=cloneV1(request);policyRef=cloneV1(policyRef);
  if(request.operation!=='submitResult'||request.approvalRef!==null||request.expectedVersion!==0||request.baselineRefs.length||!recordV1(request.payload,['scope','submissionId','manifest'])||!recordV1(request.payload.scope,['projectId','assignmentRef','executionRef'])||!uuidV1(request.payload.submissionId)||request.targetId!==request.payload.submissionId||request.projectId!==request.payload.scope.projectId)return fail('RESULT_SUBMISSION_INPUT_INVALID',422);
  const prepared=prepareSubmittedResult(request.payload.scope,request.payload.manifest),scope=prepared.scope as ResultEvidenceScope,id=request.payload.submissionId;
  await currentProjectController(db,actor,request);const policy=await authorizeMaterial(db,actor,request);if(policy.approvalRequired||!same(policy.ref,policyRef))return fail('RESULT_SUBMISSION_POLICY_NOT_CURRENT',409);
  const now=await this.#clock(db),session=actor.authSession;
  if(!session||!uuidV1(session.id)||!isoV1(session.idleExpiresAt)||!isoV1(session.absoluteExpiresAt)||Math.min(Date.parse(session.idleExpiresAt),Date.parse(session.absoluteExpiresAt),policy.validUntil)<=Date.parse(now))return fail('RESULT_SUBMISSION_SESSION_NOT_CURRENT',403);
  await readPgResultExecution(db,scope);if(await this.#row(db,scope.projectId,id))return fail('RESULT_SUBMISSION_ID_CONFLICT',409);
  // manifestRef는 receipt에 앞서 확정한다. row snapshot에 receipt를 포함해도 hash 순환이 생기지 않는다.
  const manifestRef={id,version:1,contentHash:prepared.contentHash};
  const receipt=await persistProjectReceipt(db,actor,request,manifestRef,{status:'RESULT_SUBMITTED',manifest:prepared.manifest,sourceKind:'WORKER_CLAIM',completionAccepted:false,executionAuthorized:false,dispatchPerformed:false},policyRef,'EXPLICIT_RESULT_CLAIM_ONLY');
  const submittedByRef={id:actor.actorId,version:actor.credentialGeneration,contentHash:hash({userId:actor.actorId,clientId:actor.clientId,sessionId:session.id,credentialGeneration:actor.credentialGeneration})};
  const snapshot:SyntheticSubmittedResult['snapshot']={transport:'SYNTHETIC_ONLY',scope,submittedByRef,authorizationReceiptRef:receipt.authorizationReceiptRef,manifest:prepared.manifest,manifestHash:prepared.contentHash,submittedAt:receipt.result.serverReceivedAt,sourceKind:'WORKER_CLAIM',evidenceProvenanceVerified:false,completionAccepted:false,formalFailureCounted:false,executionAuthorized:false,dispatchPerformed:false};
  const entry=readSubmittedResultRecord({ref:{id,version:1,contentHash:hash(snapshot)},snapshot},scope,id,await this.#clock(db));
  await db.query("SELECT set_config('anvil.result_session_id',$1,true)",[session.id]);
  await db.query('INSERT INTO anvil.result_submissions(project_id,id,execution_id,generation,assignment_ref,execution_ref,manifest_ref,manifest_hash,submission_state,submitted_by,client_id,command_id,content_hash,snapshot_json,submitted_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)',[scope.projectId,id,scope.executionRef.id,scope.executionRef.version,JSON.stringify(scope.assignmentRef),JSON.stringify(scope.executionRef),JSON.stringify(manifestRef),prepared.contentHash,prepared.manifest.submissionState,actor.actorId,actor.clientId,receipt.id,entry.ref.contentHash,JSON.stringify(snapshot),snapshot.submittedAt]);
  const row=await this.#row(db,scope.projectId,id);if(!row||!same(this.#entry(row,scope,id,await this.#clock(db)),entry))return fail('RESULT_SUBMISSION_WRITE_UNCONFIRMED');
  await this.#assertCurrent(db,actor,request,policyRef);
  return cloneV1(receipt.result);
 }
 async #stored(db:PoolClient,projectId:string,id:string,replay?:ResultReplay){
  const row=await this.#row(db,projectId,id);if(!row)return replay?fail('RESULT_SUBMISSION_LEDGER_INVALID'):fail('NOT_FOUND',404);
  const scope=row.snapshot_json?.scope;if(!scope||scope.projectId!==projectId)return fail('RESULT_SUBMISSION_LEDGER_INVALID');
  const entry=this.#entry(row,scope,id,await this.#clock(db));
  try{await readPgResultExecution(db,entry.snapshot.scope);}catch(e){if(replay)return fail('RESULT_SUBMISSION_LEDGER_INVALID');throw e;}
  await this.#verifyOrigins(db,projectId,[{entry,commandId:row.command_id,clientId:row.client_id}],replay);
  return entry;
 }
 async verifyReplay(db:PoolClient,actor:AuthenticatedIdentity,request:ProjectCommand,previous:unknown,policyRef:RuntimeRefV1){
  if(request.operation!=='submitResult'||!uuidV1(request.projectId)||!uuidV1(request.targetId))return fail('RESULT_SUBMISSION_LEDGER_INVALID');
  await this.#stored(db,request.projectId,request.targetId,{request,result:previous,actorId:actor.actorId});
  await this.#assertCurrent(db,actor,request,policyRef);
 }
 async read(db:PoolClient,actor:AuthenticatedIdentity,projectId:string,id:string){
  if(!uuidV1(projectId)||!uuidV1(id))return fail('RESULT_SUBMISSION_INPUT_INVALID',400);await projectMember(db,actor,projectId);
  const entry=await this.#stored(db,projectId,id);
  await projectMember(db,actor,projectId);return cloneV1(entry);
 }
 async #assignmentRef(db:PoolClient,actor:AuthenticatedIdentity,projectId:string,assignmentId:string,version:number){
  if(!uuidV1(projectId)||!uuidV1(assignmentId)||!Number.isSafeInteger(version)||version<1)return fail('RESULT_SUBMISSION_INPUT_INVALID',400);
  await projectMember(db,actor,projectId);
  const assignmentRows=(await db.query('SELECT content_hash FROM anvil.assignment_versions WHERE project_id=$1 AND assignment_id=$2 AND version=$3 LIMIT 2',[projectId,assignmentId,version])).rows;
  if(!assignmentRows.length)return fail('NOT_FOUND',404);const assignmentRef={id:assignmentId,version,contentHash:assignmentRows[0]?.content_hash};
  if(assignmentRows.length!==1||!refV1(assignmentRef))return fail('RESULT_SUBMISSION_LEDGER_INVALID');
  return assignmentRef;
 }
 async #summaries(db:PoolClient,projectId:string,assignmentRef:RuntimeRefV1,rows:any[],now:string){
  if(rows.length>21||new Set(rows.map(row=>row.id)).size!==rows.length)return fail('RESULT_SUBMISSION_LEDGER_INVALID');
  const items=[],entries=[];
  for(const row of rows){
   const scope=row.snapshot_json?.scope;
   if(!scope||scope.projectId!==projectId||!same(scope.assignmentRef,assignmentRef))return fail('RESULT_SUBMISSION_LEDGER_INVALID');
   const entry=this.#entry(row,scope,row.id,now),s=entry.snapshot;await readPgResultExecution(db,scope);
   entries.push({entry,commandId:row.command_id,clientId:row.client_id});
   items.push({ref:entry.ref,manifestRef:row.manifest_ref,executionRef:scope.executionRef,submissionState:s.manifest.submissionState,submittedByRef:s.submittedByRef,submittedAt:s.submittedAt,sourceKind:s.sourceKind,evidenceProvenanceVerified:false,completionAccepted:false});
  }
  await this.#verifyOrigins(db,projectId,entries);
  return items;
 }
 /** 최근 목록의 no-query 계약은 유지하고 이전 이력은 별도 page로 제공한다. */
 async list(db:PoolClient,actor:AuthenticatedIdentity,projectId:string,assignmentId:string,version:number){
  const assignmentRef=await this.#assignmentRef(db,actor,projectId,assignmentId,version),rows=(await db.query('SELECT * FROM anvil.result_submissions WHERE project_id=$1 AND assignment_ref=$2::jsonb ORDER BY submitted_at DESC,id DESC LIMIT 21',[projectId,JSON.stringify(assignmentRef)])).rows,now=await this.#clock(db),items=await this.#summaries(db,projectId,assignmentRef,rows,now);
  await projectMember(db,actor,projectId);return cloneV1({projectId,assignmentRef,items:items.slice(0,20),hasMore:rows.length>20,observedAt:now});
 }
 async page(db:PoolClient,rawActor:AuthenticatedIdentity,projectId:string,assignmentId:string,version:number,query:Record<string,unknown>,codec:ProjectListCodec){
  if(!query||Object.keys(query).some(k=>k!=='cursor')||query.cursor!==undefined&&(typeof query.cursor!=='string'||!query.cursor.length||query.cursor.length>4096))return fail('RESULT_SUBMISSION_INPUT_INVALID',400);
  const actor=structuredClone(rawActor),assignmentRef=await this.#assignmentRef(db,actor,projectId,assignmentId,version),now=await this.#clock(db),filter={query:canonicalJson({kind:'ASSIGNMENT_RESULT_SUBMISSIONS',projectId,assignmentRef}),archived:false,limit:20};let position:{at:string;id:string}|null=null;
  if(query.cursor!==undefined)try{position=codec.read(String(query.cursor),actor.actorId,filter,new Date(now));}catch{return fail('CURSOR_INVALID',400);}
  const rows=(await db.query(`SELECT *,to_char(submitted_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') cursor_at FROM anvil.result_submissions WHERE project_id=$1 AND assignment_ref=$2::jsonb AND ($3::timestamptz IS NULL OR (submitted_at,id)<($3::timestamptz,$4::uuid)) ORDER BY submitted_at DESC,id DESC LIMIT 21`,[projectId,JSON.stringify(assignmentRef),position?.at??null,position?.id??null])).rows,items=await this.#summaries(db,projectId,assignmentRef,rows,await this.#clock(db)),hasMore=rows.length>20,last=rows[19],nextCursor=hasMore?codec.create(actor.actorId,filter,{at:last.cursor_at,id:last.id},new Date(now)):null;
  await projectMember(db,actor,projectId);return cloneV1({projectId,assignmentRef,items:items.slice(0,20),hasMore,nextCursor,selectionState:'NOT_SELECTED',observedAt:await this.#clock(db)});
 }
}
