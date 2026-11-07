import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {cloneV1,isoV1,recordV1,refV1,uuidV1,type RuntimeRefV1} from '../../../../contracts/runtime/validation-v1.ts';
import {AuthFailure,type AuthenticatedIdentity} from '../access/repository.ts';
import {authorizeMaterial,currentProjectController,persistProjectReceipt,projectMember,type ProjectCommand} from '../access/project-command.ts';
import type {ProjectAssignmentConfirmations} from '../assignments/project-assignment-confirmations.ts';
import {prepareResultCriteria} from './result-criteria.ts';
type Prepared=ReturnType<typeof prepareResultCriteria>;
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b),hash=(v:unknown)=>contentHash(canonicalJson(v));
function fail(code:string,status=503):never{throw new AuthFailure(code,status);}
const select='SELECT v.*,c.actor_id,c.client_id AS command_client_id,c.command_id AS original_command_id,c.operation,c.state,c.expected_version,c.control_generation,c.request_hash,c.policy_ref,c.authorization_receipt_id,c.result_ref,ar.subject_ref AS receipt_subject,ar.policy_ref AS receipt_policy_ref,ar.scope_digest,ar.approval_decision_ref,(SELECT count(*)::int FROM anvil.audit_events a WHERE a.project_id=c.project_id AND a.command_id=c.id AND a.operation_id=c.operation_id AND a.outcome=\'APPLIED\' AND a.source_kind=\'HUMAN_COMMAND\' AND a.scope_digest=ar.scope_digest AND a.target_ref=c.result_ref->\'data\'->\'ref\') AS audit_count FROM anvil.result_criteria_versions v JOIN anvil.commands c ON c.project_id=v.project_id AND c.id=v.command_id JOIN anvil.authorization_receipts ar ON ar.command_id=c.id AND ar.id=c.authorization_receipt_id AND ar.scope_kind=\'PROJECT\' AND ar.scope_id=c.project_id ';
/** 기존 인증/명시 정책 tx의 불변 기준 등록이다. 등록만으로 적용·검수·실행 상태를 바꾸지 않는다. */
export class ProjectResultCriteria{
 readonly assignments:Pick<ProjectAssignmentConfirmations,'read'>;
 constructor(assignments:Pick<ProjectAssignmentConfirmations,'read'>){if(typeof assignments?.read!=='function')fail('RESULT_CRITERIA_READER_REQUIRED');this.assignments=assignments;}
 async #clock(db:PoolClient){const at=(await db.query('SELECT clock_timestamp() AS at')).rows[0]?.at;if(!(at instanceof Date)||!Number.isFinite(at.getTime()))fail('RESULT_CRITERIA_CLOCK_INVALID');return at.toISOString();}
 #data(p:Prepared){return{status:'RESULT_CRITERIA_STORED',snapshot:p.criteriaSnapshot,sourceBindings:p.sourceBindings,registryStored:true,reviewStored:false,completionAccepted:false,executionAuthorized:false,dispatchPerformed:false};}
 async #authorized(db:PoolClient,actor:AuthenticatedIdentity,request:ProjectCommand,policyRef:RuntimeRefV1){
  await currentProjectController(db,actor,request);const policy=await authorizeMaterial(db,actor,request),now=await this.#clock(db),session=actor.authSession;
  if(policy.approvalRequired||!same(policy.ref,policyRef)||!session||!uuidV1(session.id)||!isoV1(session.idleExpiresAt)||!isoV1(session.absoluteExpiresAt)||Math.min(policy.validUntil,Date.parse(session.idleExpiresAt),Date.parse(session.absoluteExpiresAt))<=Date.parse(now))fail('RESULT_CRITERIA_CURRENT_REQUIRED',409);
 }
 async #view(db:PoolClient,actor:AuthenticatedIdentity,row:any,projectId:string,id:string,version:number){
  try{
   if(row.project_id!==projectId||row.criteria_id!==id||Number(row.version)!==version||!refV1(row.assignment_ref)||!uuidV1(row.created_by)||!uuidV1(row.client_id)||!uuidV1(row.command_id)||!(row.created_at instanceof Date))fail('RESULT_CRITERIA_LEDGER_INVALID');
   const a=await this.assignments.read(db,actor,projectId,row.assignment_ref.id,row.assignment_ref.version),p=prepareResultCriteria(a,row.input_json),ref={id,version,contentHash:row.content_hash};
   if(p.projectId!==projectId||!same(p.input.assignmentRef,row.assignment_ref)||!refV1(ref)||p.contentHash!==ref.contentHash||!same(p.criteriaSnapshot,row.criteria_json)||row.operation!=='saveResultCriteria'||row.state!=='APPLIED'||row.actor_id!==row.created_by||row.command_client_id!==row.client_id||Number(row.expected_version)!==version-1||!uuidV1(row.original_command_id)||!refV1(row.policy_ref)||!uuidV1(row.authorization_receipt_id)||row.approval_decision_ref!==null||Number(row.audit_count)!==1||!same(row.receipt_subject,{kind:'HUMAN',userId:row.created_by,clientId:row.client_id})||!same(row.receipt_policy_ref,row.policy_ref))fail('RESULT_CRITERIA_LEDGER_INVALID');
   const original={schemaVersion:1,projectId,commandId:row.original_command_id,clientId:row.client_id,controlGeneration:Number(row.control_generation),operation:'saveResultCriteria',targetId:version===1?null:id,expectedVersion:version-1,baselineRefs:[],approvalRef:null,payload:p.input};
   if(row.request_hash!==hash(original)||row.scope_digest!==hash({projectId,actorId:row.created_by,clientId:row.client_id,controlGeneration:Number(row.control_generation),requestHash:row.request_hash,policyRef:row.policy_ref,targetRef:ref})||row.result_ref?.status!=='APPLIED'||row.result_ref.commandId!==row.original_command_id||row.result_ref.projectId!==projectId||row.result_ref.targetId!==id||row.result_ref.version!==version||row.result_ref.serverReceivedAt!==row.created_at.toISOString()||!same(row.result_ref.data,{ref,...this.#data(p)}))fail('RESULT_CRITERIA_LEDGER_INVALID');
   return{projectId,ref,snapshot:p.criteriaSnapshot,input:p.input,sourceBindings:p.sourceBindings,createdBy:row.created_by,registeredAt:row.created_at.toISOString(),registryStored:true as const,reviewStored:false as const,completionAccepted:false as const,executionAuthorized:false as const,dispatchPerformed:false as const,observedAt:await this.#clock(db)};
  }catch(error){if(error instanceof AuthFailure&&error.statusCode===404)throw error;fail('RESULT_CRITERIA_LEDGER_INVALID');}
 }
 async read(db:PoolClient,actor:AuthenticatedIdentity,projectId:string,id:string,version:number){
  if(!uuidV1(projectId)||!uuidV1(id)||!Number.isSafeInteger(version)||version<1)fail('RESULT_CRITERIA_INPUT_INVALID',400);await projectMember(db,actor,projectId);
  const rows=(await db.query(select+'WHERE v.project_id=$1 AND v.criteria_id=$2 AND v.version=$3 LIMIT 2',[projectId,id,version])).rows;if(!rows.length)fail('NOT_FOUND',404);if(rows.length!==1)fail('RESULT_CRITERIA_LEDGER_INVALID');const v=await this.#view(db,actor,rows[0],projectId,id,version);await projectMember(db,actor,projectId);return cloneV1(v);
 }
 /** 최근 보관 버전만 조회한다. 최신 항목을 자동 활성 기준으로 선택하지 않는다. */
 async list(db:PoolClient,actor:AuthenticatedIdentity,projectId:string,assignmentId:string,version:number){
  if(!uuidV1(projectId)||!uuidV1(assignmentId)||!Number.isSafeInteger(version)||version<1)fail('RESULT_CRITERIA_INPUT_INVALID',400);
  await projectMember(db,actor,projectId);const a=cloneV1(await this.assignments.read(db,actor,projectId,assignmentId,version));
  if(a.projectId!==projectId||a.ref.id!==assignmentId||a.ref.version!==version||!refV1(a.ref)||a.ref.contentHash!==hash(a.snapshot))fail('RESULT_CRITERIA_LEDGER_INVALID');
  const rows=(await db.query('SELECT criteria_id,version,content_hash FROM anvil.result_criteria_versions WHERE project_id=$1 AND assignment_ref=$2::jsonb ORDER BY created_at DESC,criteria_id DESC,version DESC LIMIT 21',[projectId,JSON.stringify(a.ref)])).rows,items=[];
  if(rows.length>21||new Set(rows.map(r=>r.criteria_id+':'+r.version)).size!==rows.length)fail('RESULT_CRITERIA_LEDGER_INVALID');
  for(const row of rows){const reference={id:row.criteria_id,version:Number(row.version),contentHash:row.content_hash};if(!refV1(reference))fail('RESULT_CRITERIA_LEDGER_INVALID');const value=await this.read(db,actor,projectId,reference.id,reference.version);
   if(!same(value.ref,reference)||!same(value.snapshot.assignmentRef,a.ref))fail('RESULT_CRITERIA_LEDGER_INVALID');items.push({ref:value.ref,createdBy:value.createdBy,registeredAt:value.registeredAt,conditionCount:value.snapshot.items.length,registryStored:true,reviewStored:false,completionAccepted:false,executionAuthorized:false,dispatchPerformed:false});
  }
  await projectMember(db,actor,projectId);return cloneV1({projectId,assignmentRef:a.ref,items:items.slice(0,20),hasMore:rows.length>20,selectionState:'NOT_SELECTED',observedAt:await this.#clock(db)});
 }
 async save(db:PoolClient,actor:AuthenticatedIdentity,raw:ProjectCommand,rawPolicyRef:RuntimeRefV1){
  const request=cloneV1(raw),policyRef=cloneV1(rawPolicyRef),input=request.payload;
  if(request.operation!=='saveResultCriteria'||request.approvalRef!==null||request.baselineRefs.length||!refV1(policyRef)||!recordV1(input,['assignmentRef','baseRef','items','reason'])||!refV1(input.assignmentRef)||!Number.isSafeInteger(request.expectedVersion)||request.expectedVersion<0)fail('RESULT_CRITERIA_INPUT_INVALID',422);
  await this.#authorized(db,actor,request,policyRef);const assignment=await this.assignments.read(db,actor,request.projectId,input.assignmentRef.id,input.assignmentRef.version),p=prepareResultCriteria(assignment,input);if(p.projectId!==request.projectId)fail('RESULT_CRITERIA_ASSIGNMENT_INVALID',409);
  let id:string,version:number;
  if(request.targetId===null){if(request.expectedVersion!==0||p.input.baseRef!==null)fail('VERSION_CONFLICT',409);id=randomUUID();version=1;}
  else{
   if(!uuidV1(request.targetId)||!p.input.baseRef||p.input.baseRef.id!==request.targetId||p.input.baseRef.version!==request.expectedVersion)fail('VERSION_CONFLICT',409);
   const heads=(await db.query('SELECT version FROM anvil.result_criteria_versions WHERE project_id=$1 AND criteria_id=$2 ORDER BY version DESC LIMIT 1',[request.projectId,request.targetId])).rows;
   if(heads.length!==1||Number(heads[0].version)!==request.expectedVersion)fail('VERSION_CONFLICT',409);const prior=await this.read(db,actor,request.projectId,request.targetId,request.expectedVersion);if(!same(prior.ref,p.input.baseRef))fail('VERSION_CONFLICT',409);id=request.targetId;version=request.expectedVersion+1;if(!Number.isSafeInteger(version))fail('VERSION_CONFLICT',409);
  }
  await this.#authorized(db,actor,request,policyRef);const ref={id,version,contentHash:p.contentHash},receipt=await persistProjectReceipt(db,actor,request,ref,this.#data(p),policyRef,'EXPLICIT_RESULT_CRITERIA_REGISTRATION_ONLY');
  await db.query("SELECT set_config('anvil.result_criteria_session_id',$1,true)",[actor.authSession!.id]);
  await db.query('INSERT INTO anvil.result_criteria_versions(project_id,criteria_id,version,assignment_ref,content_hash,criteria_json,input_json,created_by,client_id,command_id,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[request.projectId,id,version,JSON.stringify(p.input.assignmentRef),ref.contentHash,JSON.stringify(p.criteriaSnapshot),JSON.stringify(p.input),actor.actorId,actor.clientId,receipt.id,receipt.result.serverReceivedAt]);
  const stored=await this.read(db,actor,request.projectId,id,version);if(!same(stored.ref,ref)||!same(stored.snapshot,p.criteriaSnapshot)||!same(stored.input,p.input))fail('RESULT_CRITERIA_WRITE_UNCONFIRMED');await this.#authorized(db,actor,request,policyRef);return cloneV1(receipt.result);
 }
}
