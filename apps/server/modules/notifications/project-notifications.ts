import {readApprovalDetails} from '../approvals/approval-input.ts';
import {consumableOperations} from '../approvals/project-approvals.ts';
import type {PoolClient} from 'pg';
import {AuthFailure,type AuthenticatedIdentity} from '../access/repository.ts';
import {persistProjectReceipt,projectMember,type ProjectCommand} from '../access/project-command.ts';
import {ProjectListCodec} from '../projects/service.ts';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {isVersionRef} from '../../../../contracts/references.ts';
import type {VersionRef} from '../../../../contracts/generated-types.ts';
import {notificationFromRow,notificationRef,notificationSessionDeadline,readNotificationListQuery,readNotificationMark,type ApprovalNotification} from './notification-input.ts';
const selectNotification=`SELECT n.*,nr.read_at,nr.command_id read_command_id,nr.notification_content_hash read_content_hash,nr.client_id read_client_id,to_char(n.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') cursor_at FROM anvil.notifications n LEFT JOIN anvil.notification_reads nr ON nr.project_id=n.project_id AND nr.notification_id=n.id AND nr.recipient_user_id=n.recipient_user_id`;
async function storage<T>(body:()=>Promise<T>):Promise<T>{try{return await body();}catch(e){if(e instanceof AuthFailure)throw e;const code=(e as {code?:string})?.code;throw new AuthFailure(['42P01','42703','42501'].includes(code??'')?'NOTIFICATION_STORAGE_NOT_READY':'NOTIFICATION_STORAGE_FAILED',503);}}
async function notificationActorContext(db:PoolClient,a:AuthenticatedIdentity){await db.query("SELECT set_config('anvil.actor_id',$1,true),set_config('anvil.client_id',$2,true)",[a.actorId,a.clientId]);}
export class ProjectNotifications {
 async #current(db:PoolClient,a:AuthenticatedIdentity,pid:string){await projectMember(db,a,pid,true);const before=performance.now(),at=(await db.query('SELECT clock_timestamp() AS at')).rows[0]?.at;notificationSessionDeadline(a,at,before);return at as Date;}
 async #verify(db:PoolClient,a:AuthenticatedIdentity,pid:string,row:Record<string,any>):Promise<ApprovalNotification>{
  if(row.project_id!==pid||row.recipient_user_id!==a.actorId)throw new AuthFailure('NOT_FOUND',404);
  const dto=notificationFromRow(row);
  const r=(await db.query('SELECT r.*,c.operation,c.scope_kind,c.state,c.project_id command_project,c.actor_id,c.client_id command_client,c.control_generation source_control_generation,c.command_id caller_command_id,c.result_ref FROM anvil.approval_requests r JOIN anvil.commands c ON c.id=r.command_id AND c.project_id=r.project_id WHERE r.project_id=$1 AND r.id=$2',[pid,dto.eventRef.requestRef.id])).rows[0];
  try{
   if(!r||!r.request_json||typeof r.request_json!=='object')throw Error();
   const{id,version,status,createdAt,...snapshot}=r.request_json,ref=r.result_ref?.data?.ref;
   if(id!==dto.eventRef.requestRef.id||version!==1||status!=='PENDING'||createdAt!==dto.eventRef.occurredAt||createdAt!==r.created_at.toISOString()||r.project_id!==pid||r.command_project!==pid||r.scope_kind!=='PROJECT'||r.state!=='APPLIED'||r.operation!=='requestApproval'||snapshot.controlGeneration!==Number(r.source_control_generation)||r.result_ref.commandId!==r.caller_command_id||r.command_id!==dto.eventRef.serverCommandId||r.actor_id!==a.actorId||r.command_client!==r.client_id||r.created_by!==a.actorId||snapshot.projectId!==pid||canonicalJson(snapshot.requiredDecider)!==canonicalJson({kind:'HUMAN',userId:a.actorId})||canonicalJson(snapshot.requiredDecider)!==canonicalJson(r.required_decider_ref)||canonicalJson(snapshot.requestedBy)!==canonicalJson({kind:'HUMAN',userId:a.actorId,clientId:r.client_id})||!Number.isSafeInteger(snapshot.controlGeneration)||snapshot.controlGeneration<1||!isVersionRef(ref)||canonicalJson(ref)!==canonicalJson(dto.eventRef.requestRef)||ref.contentHash!==r.content_hash||contentHash(canonicalJson(snapshot))!==r.content_hash||r.result_ref.status!=='APPLIED'||r.result_ref.projectId!==pid||r.result_ref.targetId!==id||r.result_ref.version!==1||r.result_ref.data.status!=='APPROVAL_REQUESTED'||canonicalJson(r.result_ref.data.request)!==canonicalJson(r.request_json)||canonicalJson(snapshot.policyRef)!==canonicalJson(r.policy_ref)||canonicalJson(snapshot.details)!==canonicalJson(r.details_json)||snapshot.details?.candidateCommandId!==r.candidate_command_id||canonicalJson(snapshot.details?.actionScope)!==canonicalJson(r.action_scope_json)||snapshot.scopeDigest!==r.scope_digest||contentHash(canonicalJson(r.action_scope_json))!==r.scope_digest||r.expires_at.toISOString()!==snapshot.details?.expiresAt)throw Error();
   readApprovalDetails(snapshot.details,{actorId:a.actorId,clientId:r.client_id,controlGeneration:snapshot.controlGeneration,allowedOperations:consumableOperations,now:new Date(0)});
   if(dto.readAt!==null){
    if(row.read_content_hash!==notificationRef(dto).contentHash||!row.read_command_id||!row.read_client_id)throw Error();
    const c=(await db.query("SELECT c.*,ar.subject_ref,ar.scope_digest FROM anvil.commands c JOIN anvil.authorization_receipts ar ON ar.id=c.authorization_receipt_id AND ar.command_id=c.id AND ar.scope_kind='PROJECT' AND ar.scope_id=c.project_id WHERE c.project_id=$1 AND c.id=$2",[pid,row.read_command_id])).rows[0];
    if(!c||Number(c.expected_version)!==1||!Number.isSafeInteger(Number(c.control_generation))||Number(c.control_generation)<1||!isVersionRef(c.policy_ref)||c.result_ref?.commandId!==c.command_id||c.result_ref?.operationId!==c.operation_id||c.scope_digest!==contentHash(canonicalJson({projectId:pid,actorId:a.actorId,clientId:c.client_id,controlGeneration:Number(c.control_generation),requestHash:c.request_hash,policyRef:c.policy_ref,targetRef:notificationRef(dto)}))||c.scope_kind!=='PROJECT'||c.operation!=='markNotificationRead'||c.state!=='APPLIED'||c.actor_id!==a.actorId||c.client_id!==row.read_client_id||c.result_ref?.status!=='APPLIED'||c.result_ref.projectId!==pid||c.result_ref.targetId!==dto.id||c.result_ref.version!==1||c.result_ref.data?.status!=='NOTIFICATION_READ'||c.result_ref.data.readAt!==dto.readAt||canonicalJson(c.result_ref.data.ref)!==canonicalJson(notificationRef(dto))||canonicalJson(c.subject_ref)!==canonicalJson({kind:'HUMAN',userId:a.actorId,clientId:row.read_client_id}))throw Error();
   }
  }catch{throw new AuthFailure('NOTIFICATION_INTEGRITY_FAILED',503);}return dto;
 }
 async read(db:PoolClient,a:AuthenticatedIdentity,pid:string,id:string){return storage(async()=>{await projectMember(db,a,pid,true);await notificationActorContext(db,a);const row=(await db.query(selectNotification+' WHERE n.project_id=$1 AND n.recipient_user_id=$2 AND n.id=$3',[pid,a.actorId,id])).rows[0];if(!row)throw new AuthFailure('NOT_FOUND',404);const dto=await this.#verify(db,a,pid,row);await this.#current(db,a,pid);return dto;});}
 async list(db:PoolClient,a:AuthenticatedIdentity,pid:string,q:Record<string,unknown>,codec:ProjectListCodec){return storage(async()=>{
  await projectMember(db,a,pid,true);await notificationActorContext(db,a);const input=readNotificationListQuery(q),filter={query:canonicalJson({collection:'FN17_APPROVAL_IN_APP',projectId:pid,recipientUserId:a.actorId,readState:input.readState,order:'CREATED_DESC_ID_DESC'}),archived:false,limit:input.limit};
  let pos:{at:string;id:string}|null=null;if(input.cursor!==undefined)try{pos=codec.read(input.cursor,a.actorId,filter);}catch{throw new AuthFailure('CURSOR_INVALID',400);}
  const rows=(await db.query(selectNotification+` WHERE n.project_id=$1 AND n.recipient_user_id=$2 AND ($3::text='ALL' OR ($3='READ' AND nr.read_at IS NOT NULL) OR ($3='UNREAD' AND nr.read_at IS NULL)) AND ($4::timestamptz IS NULL OR (n.created_at,n.id)<($4::timestamptz,$5::uuid)) ORDER BY n.created_at DESC,n.id DESC LIMIT $6`,[pid,a.actorId,input.readState,pos?.at??null,pos?.id??null,input.limit+1])).rows;
  // 다음 페이지 판단용 한 행도 검증해 손상된 사건을 조용히 누락하지 않는다.
  const checked:ApprovalNotification[]=[];for(const row of rows)checked.push(await this.#verify(db,a,pid,row));
  const observedAt=await this.#current(db,a,pid),hasMore=rows.length>input.limit,last=rows.slice(0,input.limit).at(-1);
  return{items:checked.slice(0,input.limit),hasMore,nextCursor:hasMore?codec.create(a.actorId,filter,{at:last!.cursor_at,id:last!.id},observedAt):null,observedAt:observedAt.toISOString(),baselineVersion:null};
 });}
 async mark(db:PoolClient,a:AuthenticatedIdentity,c:ProjectCommand,policyRef:VersionRef){return storage(async()=>{
  const ref=readNotificationMark(c.payload);if(c.operation!=='markNotificationRead'||c.targetId!==ref.id||c.expectedVersion!==1||c.baselineRefs.length||c.approvalRef!==null)throw new AuthFailure('NOTIFICATION_INPUT_INVALID',422);
  const dto=await this.read(db,a,c.projectId,ref.id);if(canonicalJson(ref)!==canonicalJson(notificationRef(dto)))throw new AuthFailure('NOTIFICATION_REF_CONFLICT',409);
  const at=await this.#current(db,a,c.projectId),readAt=dto.readAt??at.toISOString();if(Date.parse(readAt)<Date.parse(dto.eventRef.occurredAt))throw new AuthFailure('NOTIFICATION_INTEGRITY_FAILED',503);
  const receipt=await persistProjectReceipt(db,a,c,ref,{status:'NOTIFICATION_READ',readAt},policyRef,'EXPLICIT_NOTIFICATION_READ');
  if(dto.readAt===null)await db.query('INSERT INTO anvil.notification_reads(project_id,notification_id,recipient_user_id,client_id,command_id,notification_content_hash,read_at) VALUES($1,$2,$3,$4,$5,$6,$7)',[c.projectId,dto.id,a.actorId,a.clientId,receipt.id,ref.contentHash,readAt]);
  await this.#current(db,a,c.projectId);return receipt.result;
 });}
}
