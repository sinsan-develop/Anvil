import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import {AuthFailure,type AuthenticatedIdentity} from '../access/repository.ts';
import {authorizeMaterial,type ProjectCommand} from '../access/project-command.ts';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {isVersionRef} from '../../../../contracts/references.ts';
import {isoV1,uuidV1} from '../../../../contracts/runtime/validation-v1.ts';
import {notificationRef,notificationSessionDeadline,type ApprovalNotification} from './notification-input.ts';
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
/** 호출자는 원 request/receipt/capture를 완료한 같은 인증 transaction이다. 별도 연결·COMMIT·재생은 없다. */
export async function recordApprovalRequestNotification(db:PoolClient,actor:AuthenticatedIdentity,input:{command:ProjectCommand;request:Record<string,any>;receipt:{id:string;result:Record<string,any>};initialPolicyValidUntil?:number}):Promise<void>{
 let dto:ApprovalNotification;
 try{
  const {command:c,request:r,receipt}=input,result=receipt.result,ref=result?.data?.ref;
  if(c.schemaVersion!==1||c.operation!=='requestApproval'||!uuidV1(c.projectId)||!uuidV1(c.commandId)||c.clientId!==actor.clientId||c.targetId!==null||c.expectedVersion!==0||c.baselineRefs.length||c.approvalRef!==null||!uuidV1(receipt.id)||!isVersionRef(ref)||ref.version!==1||r.id!==ref.id||r.version!==1||r.status!=='PENDING'||r.projectId!==c.projectId||r.controlGeneration!==c.controlGeneration||!isVersionRef(r.policyRef)||!isoV1(r.createdAt)||r.createdAt!==result.serverReceivedAt||!same(r.requiredDecider,{kind:'HUMAN',userId:actor.actorId})||!same(r.requestedBy,{kind:'HUMAN',userId:actor.actorId,clientId:actor.clientId})||!same(r.details,c.payload.details)||!same(r.details?.actionScope?.requestedSubjectRef,{kind:'HUMAN',userId:actor.actorId,clientId:actor.clientId})||r.details.actionScope.controlGeneration!==c.controlGeneration||result.status!=='APPLIED'||result.projectId!==c.projectId||result.commandId!==c.commandId||result.targetId!==ref.id||result.version!==1||result.data.status!=='APPROVAL_REQUESTED'||!same(result.data.request,r))throw Error();
  const {id:_id,version:_version,status:_status,createdAt:_at,...snapshot}=r;if(contentHash(canonicalJson(snapshot))!==ref.contentHash)throw Error();
  dto={id:randomUUID(),eventRef:{kind:'APPROVAL_REQUESTED',serverCommandId:receipt.id,requestRef:ref,channel:'IN_APP',occurredAt:r.createdAt},recipientRef:{kind:'HUMAN',userId:actor.actorId},projectRef:{id:c.projectId},severity:'ACTION_REQUIRED',reason:'APPROVAL_REQUESTED',authenticatedTarget:{kind:'APPROVAL_REQUEST',projectId:c.projectId,approvalRequestId:r.id},deliveryState:'STORED_IN_APP',readAt:null};
 }catch{throw new AuthFailure('NOTIFICATION_INTEGRITY_FAILED',503);}
 try{
  const initial=await authorizeMaterial(db,actor,input.command);
  if(!same(initial.ref,input.request.policyRef))throw new AuthFailure('APPROVAL_BASIS_NOT_CURRENT',412);
  let policyUntil=Math.min(initial.validUntil,input.initialPolicyValidUntil??initial.validUntil);
  const checkPolicy=async()=>{const current=await authorizeMaterial(db,actor,input.command);if(!same(current.ref,input.request.policyRef))throw new AuthFailure('APPROVAL_BASIS_NOT_CURRENT',412);policyUntil=Math.min(policyUntil,current.validUntil);if(Date.now()>=policyUntil)throw new AuthFailure('PROJECT_OPERATION_DENIED',403);};
  // RLS 전체 건수는 SQL의 기존 migration owner 전용 void 통로만 검사한다.
  await db.query('SELECT anvil.assert_approval_notification_capacity($1)',[dto.projectRef.id]);
  const before=performance.now(),at=(await db.query('SELECT clock_timestamp() AS at')).rows[0]?.at;
  const sessionDeadline=notificationSessionDeadline(actor,at,before),requestDeadline=before+Date.parse(input.request.details.expiresAt)-at.getTime();
  if(Date.parse(input.request.details.expiresAt)<=at.getTime())throw new AuthFailure('APPROVAL_INPUT_INVALID',422);
  await checkPolicy();
  const policyDeadline=before+policyUntil-at.getTime();
  if(performance.now()>=policyDeadline)throw new AuthFailure('PROJECT_OPERATION_DENIED',403);
  const ref=notificationRef(dto);
  await db.query('INSERT INTO anvil.notifications(id,project_id,source_command_id,approval_request_id,request_version,request_content_hash,recipient_user_id,event_kind,channel,severity,reason_code,delivery_state,created_at,content_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)',[dto.id,dto.projectRef.id,dto.eventRef.serverCommandId,dto.eventRef.requestRef.id,1,dto.eventRef.requestRef.contentHash,actor.actorId,dto.eventRef.kind,dto.eventRef.channel,dto.severity,dto.reason,dto.deliveryState,dto.eventRef.occurredAt,ref.contentHash]);
  await checkPolicy();
  if(performance.now()>=policyDeadline)throw new AuthFailure('PROJECT_OPERATION_DENIED',403);
  if(performance.now()>=sessionDeadline)throw new AuthFailure('AUTH_REQUIRED',401);
  if(performance.now()>=requestDeadline)throw new AuthFailure('APPROVAL_INPUT_INVALID',422);
 }catch(e){if(e instanceof AuthFailure)throw e;const error=e as {code?:string;message?:string};if(error.code==='P0001'&&error.message==='NOTIFICATION_CAPACITY_EXCEEDED')throw new AuthFailure('NOTIFICATION_CAPACITY_EXCEEDED',429);throw new AuthFailure(['42P01','42703'].includes(error.code??'')?'NOTIFICATION_STORAGE_NOT_READY':'NOTIFICATION_STORAGE_FAILED',503);}
}
