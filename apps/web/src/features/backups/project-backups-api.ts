import type {ApprovalRequestWork} from '../decisions/api.ts';
import {ApiClient,ApiError} from '../../api/client.ts';
import {exact,iso,wireHash,browserCanonical} from '../control-handoff/api.ts';
import {documentControl,documentDraftHash,type DocumentSession,type DocumentContent} from '../design-trace/editor-api.ts';
import {NotificationScope} from '../../notifications/project-notifications-api.ts';
import type {ExportJob,ExportSelection,ExportArtifactRef} from '../../../../server/modules/backups/project-backups-input.ts';
import type {ProjectCommand} from '../../../../server/modules/access/project-command.ts';
import type {VersionRef} from '../../../../../contracts/generated-types.ts';
export {NotificationScope as ExportScope};
export type {ExportJob,ExportSelection};
export interface ExportPending {bindingId:string;ownerUserId:string;ownerClientId:string;projectId:string;csrfToken:string;api:ApiClient;transport:typeof fetch;command:ProjectCommand;body:string;receipt:VersionRef|null;accessLost?:boolean;dispatchState?:'UNKNOWN'|'REQUIRED'|'BOUND';approvalRequest?:ApprovalRequestWork|null;approvalEligible?:boolean}
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
const hash=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const ref=(v:unknown):v is VersionRef=>exact(v,['id','version','contentHash'])&&uuid(v.id)&&Number.isSafeInteger(v.version)&&Number(v.version)>0&&hash(v.contentHash);
const artifact=(v:unknown):v is ExportArtifactRef=>exact(v,['artifactId','bytes','contentHash','mediaType'])&&uuid(v.artifactId)&&Number.isSafeInteger(v.bytes)&&Number(v.bytes)>=0&&Number(v.bytes)<=20*1024*1024&&hash(v.contentHash)&&typeof v.mediaType==='string'&&v.mediaType.length>0&&v.mediaType.length<=200;
const same=(a:unknown,b:unknown)=>browserCanonical(a)===browserCanonical(b);
const invalid=():never=>{throw new ApiError('RESPONSE_INVALID');};
export const exportOmitted=['PROJECT_DB_SNAPSHOT','PROJECT_SOURCE','OTHER_PROJECT_MATERIALS','EXECUTION_STATE_RESTORE'];
function pid(projectId:string){if(!uuid(projectId))throw new ApiError('CLIENT_PATH_INVALID');return '/api/v1/projects/'+projectId;}
function freeze<T>(v:T):T{if(v&&typeof v==='object'){Object.freeze(v);for(const x of Object.values(v))freeze(x);}return v;}
export function selectionValid(v:unknown):v is ExportSelection{return exact(v,['kind','documentRef','artifactRef'])&&v.kind==='DOCUMENT_ARTIFACT'&&ref(v.documentRef)&&artifact(v.artifactRef);}
export async function parseExportJob(v:unknown,projectId:string,want?:VersionRef):Promise<ExportJob>{
 if(!exact(v,['ref','manifest','sourceAvailability'])||!ref(v.ref)||v.ref.version!==1||!['READY','BLOCKED'].includes(v.sourceAvailability as string))return invalid();
 const m=v.manifest;if(!exact(m,['schemaVersion','kind','projectId','includeSource','selection','files','omitted','createdAt','createdBy'])||m.schemaVersion!==1||m.kind!=='SELECTED_DOCUMENT_ARTIFACT_EXPORT'||m.projectId!==projectId||m.includeSource!==false||!selectionValid(m.selection)||!Array.isArray(m.files)||m.files.length!==1||!exact(m.files[0],['artifactRef','downloadName'])||!same(m.files[0].artifactRef,m.selection.artifactRef)||m.files[0].downloadName!==m.selection.artifactRef.artifactId+'.bin'||!same(m.omitted,exportOmitted)||!iso(m.createdAt)||!exact(m.createdBy,['kind','userId'])||m.createdBy.kind!=='HUMAN'||!uuid(m.createdBy.userId)||await wireHash(m)!==v.ref.contentHash||want&&!same(v.ref,want))return invalid();
 return freeze(structuredClone(v) as unknown as ExportJob);
}
export async function listExports(api:ApiClient,projectId:string,cursor:string|null=null){const query=new URLSearchParams({view:'SELECTED_ARTIFACT_EXPORTS',limit:'50'});if(cursor!==null){if(!cursor||cursor.length>4096)throw new ApiError('CLIENT_PATH_INVALID');query.set('cursor',cursor);}const v=await api.get<unknown>(pid(projectId)+'/backups?'+query);if(!exact(v,['items','hasMore','nextCursor','observedAt','baselineVersion'])||!Array.isArray(v.items)||v.items.length>50||typeof v.hasMore!=='boolean'||(v.hasMore?typeof v.nextCursor!=='string'||!v.nextCursor||v.nextCursor.length>4096:v.nextCursor!==null)||!iso(v.observedAt)||v.baselineVersion!==null)return invalid();const items:ExportJob[]=[],ids=new Set<string>();for(const x of v.items){const item=await parseExportJob(x,projectId);if(ids.has(item.ref.id)||Date.parse(item.manifest.createdAt)>Date.parse(v.observedAt))return invalid();ids.add(item.ref.id);items.push(item);}if(v.hasMore&&!items.length)return invalid();return{items,hasMore:v.hasMore,nextCursor:v.nextCursor as string|null,observedAt:v.observedAt};}
export async function readExport(api:ApiClient,projectId:string,want:VersionRef){if(!ref(want))return invalid();return parseExportJob(await api.get(pid(projectId)+'/backups/'+want.id),projectId,want);}
/** 명령 직후의 조회만 원선택/작성자에 결박한다. 일반 이력 조회 권한은 바꾸지 않는다. */
export async function readCommandExport(api:ApiClient,p:ExportPending){if(!p.receipt)throw new ApiError('EXPORT_RECEIPT_SCOPE_MISMATCH');const job=await readExport(api,p.projectId,p.receipt);if(!same(job.manifest.selection,p.command.payload.selection)||job.manifest.createdBy.userId!==p.ownerUserId)throw new ApiError('EXPORT_RECEIPT_SCOPE_MISMATCH');return job;}
export function exportFileHref(projectId:string,j:ExportJob){if(j.manifest.projectId!==projectId||!uuid(j.ref.id)||j.sourceAvailability!=='READY')throw new ApiError('EXPORT_SOURCE_BLOCKED');return pid(projectId)+'/backups/'+j.ref.id+'/file';}
export async function exportDocument(api:ApiClient,projectId:string,id:string,version:number){if(!uuid(id)||!Number.isSafeInteger(version)||version<1)throw new ApiError('CLIENT_PATH_INVALID');const d=await api.get<Record<string,any>>(pid(projectId)+'/documents/'+id+'/versions/'+version);if(d.id!==id||d.version!==version||!ref(d.formRef)||!hash(d.contentHash)||typeof d.title!=='string'||!d.content||!artifact(d.content.body)||!Array.isArray(d.content.attachments)||!d.content.attachments.every(artifact)||!Array.isArray(d.content.sections)||!Array.isArray(d.content.sourceRefs)||d.content.sourceRefs.length||await documentDraftHash(d.title,d.formRef,d.content as DocumentContent,d.stageNodeRef??null)!==d.contentHash)return invalid();return{ref:{id,version,contentHash:d.contentHash} as VersionRef,artifacts:[{label:'본문 BODY',ref:d.content.body as ExportArtifactRef},...d.content.attachments.map((r:ExportArtifactRef,index:number)=>({label:'첨부 '+(index+1),ref:r}))]};}
export function exportPendingMatches(p:ExportPending,api:ApiClient,s:DocumentSession,projectId:string){return p.ownerUserId===s.user.id&&p.ownerClientId===s.clientId&&p.projectId===projectId&&p.csrfToken===s.csrfToken&&p.api===api&&p.transport===api.transport;}
export async function prepareExport(api:ApiClient,projectId:string,s:DocumentSession,selection:ExportSelection,reason:string,current:()=>boolean):Promise<ExportPending>{
 if(!selectionValid(selection)||!reason.trim()||reason.length>20000)throw new ApiError('EXPORT_INPUT_INVALID');const userId=s.user.id,clientId=s.clientId,csrf=s.csrfToken,transport=api.transport;
 const active=()=>current()&&s.user.id===userId&&s.clientId===clientId&&s.csrfToken===csrf&&api.transport===transport;if(!active())throw new ApiError('EXPORT_CONTEXT_CHANGED');
 const checked=await exportDocument(api,projectId,selection.documentRef.id,selection.documentRef.version);if(!active()||!same(checked.ref,selection.documentRef)||!checked.artifacts.some(x=>same(x.ref,selection.artifactRef)))throw new ApiError('EXPORT_CONTEXT_CHANGED');
 const generation=await documentControl(api,projectId,s);if(!active())throw new ApiError('EXPORT_CONTEXT_CHANGED');
 const command:ProjectCommand=freeze({schemaVersion:1,projectId,commandId:crypto.randomUUID(),clientId,controlGeneration:generation,operation:'exportProject',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:{includeSource:false,selection:structuredClone(selection),reason}});
 return{bindingId:crypto.randomUUID(),ownerUserId:userId,ownerClientId:clientId,projectId,csrfToken:csrf,api,transport,command,body:browserCanonical(command),receipt:null};
}
export async function sendExport(api:ApiClient,p:ExportPending,s:DocumentSession,current:()=>boolean):Promise<VersionRef>{
 const active=()=>current()&&exportPendingMatches(p,api,s,p.projectId),c=p.command;
 if(!active()||!exact(c,['schemaVersion','projectId','commandId','clientId','controlGeneration','operation','targetId','expectedVersion','baselineRefs','approvalRef','payload'])||c.schemaVersion!==1||!Number.isSafeInteger(c.controlGeneration)||c.controlGeneration<1||!uuid(c.commandId)||c.operation!=='exportProject'||c.projectId!==p.projectId||c.clientId!==p.ownerClientId||c.targetId!==null||c.expectedVersion!==0||c.approvalRef!==null&&!approvalRefValid(c.approvalRef)||c.baselineRefs.length||!exact(c.payload,['includeSource','selection','reason'])||c.payload.includeSource!==false||!selectionValid(c.payload.selection)||browserCanonical(c)!==p.body)throw new ApiError('EXPORT_CONTEXT_CHANGED');
 const generation=await documentControl(api,p.projectId,s);if(!active()||generation!==c.controlGeneration)throw new ApiError('EXPORT_CONTEXT_CHANGED');
 let response:Response;try{response=await p.transport.call(globalThis,pid(p.projectId)+'/commands',{method:'POST',credentials:'same-origin',redirect:'error',cache:'no-store',headers:{Accept:'application/json','Content-Type':'application/json','X-Anvil-CSRF':p.csrfToken,'Idempotency-Key':c.commandId},body:p.body});}catch{throw new ApiError('CONNECTION_LOST');}
 if(!active())throw new ApiError('EXPORT_CONTEXT_CHANGED');let v:unknown;try{if(!/^application\/json\b/i.test(response.headers.get('content-type')??''))throw Error();v=await response.json();}catch{throw new ApiError('RESPONSE_INVALID',response.status);}if(!active())throw new ApiError('EXPORT_CONTEXT_CHANGED');
 if(!response.ok){const code=v&&typeof v==='object'?(v as {code?:unknown}).code:null;throw new ApiError(typeof code==='string'&&/^[A-Z_]{1,64}$/.test(code)?code:'REQUEST_FAILED',response.status);}
 if(!exact(v,['commandId','operationId','projectId','status','targetId','version','data','evidenceRefs','warnings','serverReceivedAt'])||v.commandId!==c.commandId||!uuid(v.operationId)||v.projectId!==p.projectId||v.status!=='APPLIED'||v.version!==1||!exact(v.data,['status','ref'])||v.data.status!=='EXPORT_STORED'||!ref(v.data.ref)||v.data.ref.version!==1||v.targetId!==v.data.ref.id||!iso(v.serverReceivedAt)||!Array.isArray(v.evidenceRefs)||v.evidenceRefs.length||!Array.isArray(v.warnings)||v.warnings.length)return invalid();return freeze(structuredClone(v.data.ref));
}
export function mergeExportPending(old:ExportPending|null,expected:string|null,next:ExportPending|null):ExportPending|null{
 if((old?.bindingId??null)!==expected||old&&!old.receipt&&next===null)return old;
 if(old&&next&&(old.bindingId!==next.bindingId||old.ownerUserId!==next.ownerUserId||old.ownerClientId!==next.ownerClientId||old.projectId!==next.projectId||old.csrfToken!==next.csrfToken||old.api!==next.api||old.transport!==next.transport||(old.command!==next.command||old.body!==next.body)&&exportTransitions.get(next)!==old))return old;
 if(old?.dispatchState==='UNKNOWN'&&next&&next.dispatchState!=='UNKNOWN'&&exportTransitions.get(next)!==old)return old;
 if(old?.dispatchState==='BOUND'&&next&&next.dispatchState==='REQUIRED')return old;
 if(next?.receipt&&(!ref(next.receipt)||next.receipt.version!==1))return old;
 if(old?.receipt&&next){if(next.receipt&&!same(old.receipt,next.receipt))return old;return{...next,receipt:old.receipt};}return next;
}

function approvalRefValid(v:unknown):boolean{return exact(v,['requestId','decisionId','scopeDigest'])&&uuid(v.requestId)&&uuid(v.decisionId)&&hash(v.scopeDigest);}
const exportTransitions=new WeakMap<ExportPending,ExportPending>();
/** 불명 상태는 명확한 이번 응답 또는 검증한 일회 결박으로만 전이한다. */
export function markExportDispatch(p:ExportPending):ExportPending{const next={...p,dispatchState:'UNKNOWN' as const,approvalEligible:p.dispatchState!=='UNKNOWN'&&p.command.approvalRef===null};exportTransitions.set(next,p);return next;}
export function markExportApprovalRequired(p:ExportPending):ExportPending{if(p.receipt||p.accessLost||p.command.approvalRef!==null||(p.dispatchState!=='UNKNOWN'||p.approvalEligible!==true))throw new ApiError('EXPORT_CONTEXT_CHANGED');const next={...p,dispatchState:'REQUIRED' as const,approvalEligible:false};exportTransitions.set(next,p);return next;}
export function bindExportApprovalCommand(p:ExportPending,approvalRef:unknown):ExportPending{
 if(p.receipt||p.accessLost||p.dispatchState!=='REQUIRED'||p.command.approvalRef!==null||!approvalRefValid(approvalRef))throw new ApiError('APPROVAL_CANDIDATE_MISMATCH',409);
 const command=freeze({...p.command,approvalRef:structuredClone(approvalRef)}),next={...p,command,body:browserCanonical(command),dispatchState:'BOUND' as const};exportTransitions.set(next,p);return next;
}
