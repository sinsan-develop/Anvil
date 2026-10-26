import {ApiClient,ApiError} from '../api/client.ts';
import {exact,iso,wireHash,browserCanonical} from '../features/control-handoff/api.ts';
import {documentControl,type DocumentSession} from '../features/design-trace/editor-api.ts';
import type {ApprovalNotification} from '../../../server/modules/notifications/notification-input.ts';
import type {VersionRef} from '../../../../contracts/generated-types.ts';
import type {ProjectCommand} from '../../../server/modules/access/project-command.ts';
export type {ApprovalNotification};
export type ReadState='ALL'|'UNREAD'|'READ';
export interface NotificationView{notification:ApprovalNotification;ref:VersionRef}
export interface NotificationPage{items:NotificationView[];hasMore:boolean;nextCursor:string|null;observedAt:string;baselineVersion:null}
export interface NotificationReceipt{commandId:string;readAt:string}
export interface NotificationPending{
 bindingId:string;ownerUserId:string;ownerClientId:string;projectId:string;csrfToken:string;
 api:ApiClient;transport:typeof fetch;view:NotificationView;command:ProjectCommand;body:string;
 receipt:NotificationReceipt|null;accessLost?:boolean;
}
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
const validRef=(v:unknown):v is VersionRef=>exact(v,['id','version','contentHash'])&&uuid(v.id)&&v.version===1&&typeof v.contentHash==='string'&&/^[a-f0-9]{64}$/.test(v.contentHash);
const invalid=():never=>{throw new ApiError('RESPONSE_INVALID');};
const paused=():never=>{throw new ApiError('NOTIFICATION_CONTEXT_CHANGED');};
const same=(a:unknown,b:unknown)=>browserCanonical(a)===browserCanonical(b);
function owner(projectId:string,userId:string){if(!uuid(projectId)||!uuid(userId))throw new ApiError('CLIENT_PATH_INVALID');}
function freeze<T>(v:T):T{if(v&&typeof v==='object'){Object.freeze(v);for(const x of Object.values(v))freeze(x);}return v;}
export async function parseNotification(value:unknown,projectId:string,userId:string,want?:VersionRef):Promise<NotificationView>{
 owner(projectId,userId);
 if(!exact(value,['id','eventRef','recipientRef','projectRef','severity','reason','authenticatedTarget','deliveryState','readAt'])||!uuid(value.id)||!exact(value.eventRef,['kind','serverCommandId','requestRef','channel','occurredAt'])||value.eventRef.kind!=='APPROVAL_REQUESTED'||!uuid(value.eventRef.serverCommandId)||!validRef(value.eventRef.requestRef)||value.eventRef.channel!=='IN_APP'||!iso(value.eventRef.occurredAt)||!exact(value.recipientRef,['kind','userId'])||value.recipientRef.kind!=='HUMAN'||value.recipientRef.userId!==userId||!exact(value.projectRef,['id'])||value.projectRef.id!==projectId||value.severity!=='ACTION_REQUIRED'||value.reason!=='APPROVAL_REQUESTED'||!exact(value.authenticatedTarget,['kind','projectId','approvalRequestId'])||value.authenticatedTarget.kind!=='APPROVAL_REQUEST'||value.authenticatedTarget.projectId!==projectId||value.authenticatedTarget.approvalRequestId!==value.eventRef.requestRef.id||value.deliveryState!=='STORED_IN_APP'||value.readAt!==null&&(!iso(value.readAt)||Date.parse(value.readAt)<Date.parse(value.eventRef.occurredAt)))return invalid();
 const notification=structuredClone(value) as unknown as ApprovalNotification,{readAt,...core}=notification;
 const ref:VersionRef={id:notification.id,version:1,contentHash:await wireHash(core)};
 if(want!==undefined&&(!validRef(want)||!same(ref,want)))return invalid();
 return freeze({notification,ref});
}
export async function listNotifications(client:ApiClient,projectId:string,userId:string,readState:ReadState='ALL',cursor:string|null=null):Promise<NotificationPage>{
 owner(projectId,userId);if(!['ALL','UNREAD','READ'].includes(readState)||cursor!==null&&(typeof cursor!=='string'||!cursor||cursor.length>4096))throw new ApiError('CLIENT_PATH_INVALID');
 const query=new URLSearchParams({limit:'50',readState});if(cursor!==null)query.set('cursor',cursor);
 const v=await client.get<unknown>(`/api/v1/projects/${projectId}/notifications?${query}`);
 if(!exact(v,['items','hasMore','nextCursor','observedAt','baselineVersion'])||!Array.isArray(v.items)||v.items.length>50||typeof v.hasMore!=='boolean'||(v.hasMore?typeof v.nextCursor!=='string'||!v.nextCursor||v.nextCursor.length>4096:v.nextCursor!==null)||!iso(v.observedAt)||v.baselineVersion!==null)return invalid();
 const items:NotificationView[]=[];const ids=new Set<string>();
 for(const item of v.items){const parsed=await parseNotification(item,projectId,userId),d=parsed.notification;if(ids.has(d.id)||readState==='READ'&&d.readAt===null||readState==='UNREAD'&&d.readAt!==null||Date.parse(d.eventRef.occurredAt)>Date.parse(v.observedAt)||d.readAt!==null&&Date.parse(d.readAt)>Date.parse(v.observedAt))return invalid();ids.add(d.id);items.push(parsed);}
 if(v.hasMore&&!items.length)return invalid();
 return{items,hasMore:v.hasMore,nextCursor:v.nextCursor as string|null,observedAt:v.observedAt,baselineVersion:null};
}
export async function readNotification(client:ApiClient,projectId:string,userId:string,want:VersionRef):Promise<NotificationView>{
 owner(projectId,userId);if(!validRef(want))throw new ApiError('CLIENT_PATH_INVALID');
 return parseNotification(await client.get(`/api/v1/projects/${projectId}/notifications/${want.id}`),projectId,userId,want);
}
export function notificationPendingMatches(p:NotificationPending,client:ApiClient,session:DocumentSession,projectId:string):boolean{
 return p.ownerUserId===session.user.id&&p.ownerClientId===session.clientId&&p.projectId===projectId&&p.csrfToken===session.csrfToken&&p.api===client&&p.transport===client.transport;
}
export async function prepareNotificationRead(client:ApiClient,projectId:string,session:DocumentSession,view:NotificationView,current:()=>boolean):Promise<NotificationPending>{
 owner(projectId,session.user.id);if(!uuid(session.clientId)||!/^[A-Za-z0-9_-]{43}$/.test(session.csrfToken))return paused();
 const userId=session.user.id,clientId=session.clientId,csrfToken=session.csrfToken,transport=client.transport;
 const active=()=>current()&&session.user.id===userId&&session.clientId===clientId&&session.csrfToken===csrfToken&&client.transport===transport;
 if(!active())return paused();
 const checked=await parseNotification(view.notification,projectId,userId,view.ref);if(!active())return paused();
 const generation=await documentControl(client,projectId,session);if(!active())return paused();
 const command:ProjectCommand=freeze({schemaVersion:1,projectId,commandId:crypto.randomUUID(),clientId,controlGeneration:generation,operation:'markNotificationRead',targetId:checked.ref.id,expectedVersion:1,baselineRefs:[],approvalRef:null,payload:{notificationRef:checked.ref}});
 return{bindingId:crypto.randomUUID(),ownerUserId:userId,ownerClientId:clientId,projectId,csrfToken,api:client,transport,view:checked,command,body:browserCanonical(command),receipt:null};
}
export async function sendNotificationRead(client:ApiClient,pending:NotificationPending,session:DocumentSession,current:()=>boolean):Promise<NotificationReceipt>{
 const p=pending,c=p.command;
 const active=()=>current()&&notificationPendingMatches(p,client,session,p.projectId);
 if(!active()||!exact(c,['schemaVersion','projectId','commandId','clientId','controlGeneration','operation','targetId','expectedVersion','baselineRefs','approvalRef','payload'])||!uuid(c.commandId)||c.schemaVersion!==1||c.projectId!==p.projectId||c.clientId!==p.ownerClientId||c.operation!=='markNotificationRead'||c.targetId!==p.view.ref.id||c.expectedVersion!==1||c.baselineRefs.length||c.approvalRef!==null||!exact(c.payload,['notificationRef'])||!same(c.payload.notificationRef,p.view.ref)||browserCanonical(c)!==p.body)return paused();
 await parseNotification(p.view.notification,p.projectId,p.ownerUserId,p.view.ref);if(!active())return paused();
 const generation=await documentControl(client,p.projectId,session);if(!active()||generation!==c.controlGeneration)return paused();
 let response:Response;
 try{response=await p.transport.call(globalThis,`/api/v1/projects/${p.projectId}/commands`,{method:'POST',credentials:'same-origin',redirect:'error',cache:'no-store',headers:{Accept:'application/json','Content-Type':'application/json','X-Anvil-CSRF':p.csrfToken,'Idempotency-Key':c.commandId},body:p.body});}catch{if(!active())return paused();throw new ApiError('CONNECTION_LOST');}
 if(!active())return paused();
 let v:unknown;try{if(!/^application\/json\b/i.test(response.headers.get('content-type')??''))throw Error();v=await response.json();}catch{throw new ApiError('RESPONSE_INVALID',response.status);}
 if(!active())return paused();
 if(!response.ok){const code=v&&typeof v==='object'?(v as {code?:unknown}).code:null;throw new ApiError(typeof code==='string'&&/^[A-Z_]{1,64}$/.test(code)?code:'REQUEST_FAILED',response.status);}
 if(!exact(v,['commandId','operationId','projectId','status','targetId','version','data','evidenceRefs','warnings','serverReceivedAt'])||v.commandId!==c.commandId||!uuid(v.operationId)||v.projectId!==p.projectId||v.status!=='APPLIED'||v.targetId!==c.targetId||v.version!==1||!Array.isArray(v.evidenceRefs)||v.evidenceRefs.length!==0||!Array.isArray(v.warnings)||v.warnings.length!==0||!iso(v.serverReceivedAt)||!exact(v.data,['status','ref','readAt'])||v.data.status!=='NOTIFICATION_READ'||!validRef(v.data.ref)||!same(v.data.ref,p.view.ref)||!iso(v.data.readAt)||Date.parse(v.data.readAt)<Date.parse(p.view.notification.eventRef.occurredAt)||Date.parse(v.serverReceivedAt)<Date.parse(p.view.notification.eventRef.occurredAt))return invalid();
 return{commandId:c.commandId,readAt:v.data.readAt};
}
/** Same-command state updates retain a confirmed receipt even before React re-renders. */
export function mergeNotificationPending(current:NotificationPending|null,expected:string|null,next:NotificationPending|null):NotificationPending|null{
 if((current?.bindingId??null)!==expected||current&&!current.receipt&&next===null)return current;
 if(next&&current&&(next.bindingId!==current.bindingId||next.ownerUserId!==current.ownerUserId||next.ownerClientId!==current.ownerClientId||next.projectId!==current.projectId||next.csrfToken!==current.csrfToken||next.api!==current.api||next.transport!==current.transport||next.view!==current.view||next.command!==current.command||next.body!==current.body))return current;
 if(next?.receipt&&(!exact(next.receipt,['commandId','readAt'])||next.receipt.commandId!==next.command.commandId||!iso(next.receipt.readAt)||Date.parse(next.receipt.readAt)<Date.parse(next.view.notification.eventRef.occurredAt)))return current;
 if(current?.receipt&&next){if(next.receipt&&!same(next.receipt,current.receipt))return current;return{...next,receipt:current.receipt};}
 return next;
}
export interface NotificationTicket{revision:number;sequence:number}
/** Render-time owner and physical transport fencing prevents ABA and delayed responses. */
export class NotificationScope{
 private revision=0;private sequence=0;private alive=true;private session:DocumentSession|null=null;private api:ApiClient|null=null;private transport:typeof fetch|null=null;private projectId:string|null=null;private userId:string|null=null;private clientId:string|null=null;private csrfToken:string|null=null;
 bind(session:DocumentSession|null,api:ApiClient,projectId:string|null):void{
  if(this.session!==session||this.api!==api||this.transport!==api.transport||this.projectId!==projectId||this.userId!==(session?.user.id??null)||this.clientId!==(session?.clientId??null)||this.csrfToken!==(session?.csrfToken??null)){this.revision++;this.sequence++;this.session=session;this.api=api;this.transport=api.transport;this.projectId=projectId;this.userId=session?.user.id??null;this.clientId=session?.clientId??null;this.csrfToken=session?.csrfToken??null;}this.alive=true;
 }
 ticket():NotificationTicket{return{revision:this.revision,sequence:++this.sequence};}
 current(ticket:NotificationTicket):boolean{return this.alive&&ticket.revision===this.revision&&ticket.sequence===this.sequence&&this.userId===(this.session?.user.id??null)&&this.clientId===(this.session?.clientId??null)&&this.csrfToken===(this.session?.csrfToken??null)&&this.transport===this.api?.transport;}
 dispose():void{this.alive=false;this.revision++;this.sequence++;}
}
