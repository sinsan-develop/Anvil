import {AuthFailure,type AuthenticatedIdentity} from '../access/repository.ts';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {refV1,uuidV1,isoV1} from '../../../../contracts/runtime/validation-v1.ts';
import type {VersionRef} from '../../../../contracts/generated-types.ts';
const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===keys.sort().join(',');
export interface ApprovalNotification {
 id:string;eventRef:{kind:'APPROVAL_REQUESTED';serverCommandId:string;requestRef:VersionRef;channel:'IN_APP';occurredAt:string};recipientRef:{kind:'HUMAN';userId:string};projectRef:{id:string};severity:'ACTION_REQUIRED';reason:'APPROVAL_REQUESTED';authenticatedTarget:{kind:'APPROVAL_REQUEST';projectId:string;approvalRequestId:string};deliveryState:'STORED_IN_APP';readAt:string|null;
}
export function readNotificationListQuery(q:Record<string,unknown>){
 if(Object.keys(q).some(k=>!['limit','cursor','readState'].includes(k))||q.limit!==undefined&&(typeof q.limit!=='string'||!/^[1-9]\d{0,2}$/.test(q.limit)||Number(q.limit)>200)||q.readState!==undefined&&!['ALL','UNREAD','READ'].includes(q.readState as string)||q.cursor!==undefined&&(typeof q.cursor!=='string'||!q.cursor.length||q.cursor.length>4096))throw new AuthFailure('INPUT_INVALID',400);
 return{readState:(q.readState??'ALL') as 'ALL'|'UNREAD'|'READ',limit:q.limit===undefined?50:Number(q.limit),cursor:q.cursor as string|undefined};
}
export function readNotificationMark(p:unknown):VersionRef{
 if(!exact(p,['notificationRef'])||!exact(p.notificationRef,['id','version','contentHash'])||!refV1(p.notificationRef)||p.notificationRef.version!==1)throw new AuthFailure('NOTIFICATION_INPUT_INVALID',422);
 return structuredClone(p.notificationRef) as unknown as VersionRef;
}
export function notificationRef(value:ApprovalNotification):VersionRef{const{readAt,...body}=value;return{id:value.id,version:1,contentHash:contentHash(canonicalJson(body))};}
export function notificationFromRow(r:Record<string,any>):ApprovalNotification{
 const occurredAt=r.created_at instanceof Date?r.created_at.toISOString():'',readAt=r.read_at instanceof Date?r.read_at.toISOString():r.read_at===null?null:'';
 if(![r.id,r.project_id,r.source_command_id,r.approval_request_id,r.recipient_user_id].every(uuidV1)||Number(r.request_version)!==1||!/^[a-f0-9]{64}$/.test(r.request_content_hash)||r.event_kind!=='APPROVAL_REQUESTED'||r.channel!=='IN_APP'||r.severity!=='ACTION_REQUIRED'||r.reason_code!=='APPROVAL_REQUESTED'||r.delivery_state!=='STORED_IN_APP'||!isoV1(occurredAt)||readAt!==null&&(!isoV1(readAt)||Date.parse(readAt)<Date.parse(occurredAt)))throw new AuthFailure('NOTIFICATION_INTEGRITY_FAILED',503);
 const dto:ApprovalNotification={id:r.id,eventRef:{kind:'APPROVAL_REQUESTED',serverCommandId:r.source_command_id,requestRef:{id:r.approval_request_id,version:1,contentHash:r.request_content_hash},channel:'IN_APP',occurredAt},recipientRef:{kind:'HUMAN',userId:r.recipient_user_id},projectRef:{id:r.project_id},severity:'ACTION_REQUIRED',reason:'APPROVAL_REQUESTED',authenticatedTarget:{kind:'APPROVAL_REQUEST',projectId:r.project_id,approvalRequestId:r.approval_request_id},deliveryState:'STORED_IN_APP',readAt};
 if(notificationRef(dto).contentHash!==r.content_hash)throw new AuthFailure('NOTIFICATION_INTEGRITY_FAILED',503);return dto;
}
/** DB 시각 조회 직전의 monotonic 시각에 결박해 잠금 대기로 기한을 늘리지 않는다. */
export function notificationSessionDeadline(actor:AuthenticatedIdentity,observedAt:Date,before:number){
 const session=actor.authSession,until=session?Math.min(Date.parse(session.idleExpiresAt),Date.parse(session.absoluteExpiresAt)):NaN;
 if(!(observedAt instanceof Date)||!Number.isFinite(observedAt.getTime())||!Number.isFinite(until)||!Number.isFinite(before))throw new AuthFailure('AUTH_REQUIRED',401);
 const deadline=before+until-observedAt.getTime();if(performance.now()>=deadline)throw new AuthFailure('AUTH_REQUIRED',401);return deadline;
}
