import {ApiClient,ApiError} from '../../api/client.ts';
import {postDocumentCommand,type DocumentSession,type DocumentWrite} from '../design-trace/editor-api.ts';
export interface ShareRef {id:string;version:number;contentHash:string}
export interface ShareTarget {kind:'PROJECT';projectId:string}
export interface ShareSnapshot {projectId:string;createdBy:string;clientId:string;controlGeneration:number;versionRefs:ShareRef[];explicitTargets:(ShareTarget&{version:number})[];purpose:string;policyRef:ShareRef;recordedAt:string}
export interface ShareEffects {transferPerformed:false;sharedEventCreated:false;approvalConsumed:false;executionAuthorized:false}
export type ShareView=({requestRef:ShareRef;state:'RECORDED_ONLY';currentCheck:'UNAVAILABLE';reasonCode:'SOURCE_OR_TARGET_UNAVAILABLE'}|{requestRef:ShareRef;state:'RECORDED_ONLY';currentCheck:'METADATA_ELIGIBLE';recordedAt:string;snapshot:ShareSnapshot})&ShareEffects;
export interface ShareWrite extends Omit<DocumentWrite,'operation'> {operation:'requestKnowledgeShare'}
export interface KnowledgeShareRequestBuffer {projectId:string;ownerUserId:string;ownerClientId:string;controlGeneration:number;versionRefs:ShareRef[];explicitTargets:ShareTarget[];purpose:string;pending:ShareWrite|null;uncertain:boolean;dirty:boolean;resultRef:ShareRef|null;failure:{code:string;status:number}|null}
export type KnowledgeShareChange=KnowledgeShareRequestBuffer|null|((previous:KnowledgeShareRequestBuffer|null)=>KnowledgeShareRequestBuffer|null);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
const ref=(v:any):v is ShareRef=>exact(v,['id','version','contentHash'])&&typeof v.id==='string'&&uuid.test(v.id)&&Number.isSafeInteger(v.version)&&Number(v.version)>0&&typeof v.contentHash==='string'&&/^[a-f0-9]{64}$/.test(v.contentHash);
const iso=(v:unknown):v is string=>typeof v==='string'&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
function canonical(value:any):string {if(value===null||typeof value!=='object')return JSON.stringify(value);if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';}
async function hash(v:unknown){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(v))))].map(v=>v.toString(16).padStart(2,'0')).join('');}
function input(versionRefs:ShareRef[],explicitTargets:ShareTarget[],purpose:string,pid:string){
 if(!uuid.test(pid)||!Array.isArray(versionRefs)||!versionRefs.length||versionRefs.length>200||versionRefs.some(r=>!ref(r))||new Set(versionRefs.map(r=>r.id)).size!==versionRefs.length||!Array.isArray(explicitTargets)||!explicitTargets.length||explicitTargets.length>200||explicitTargets.some(t=>!exact(t,['kind','projectId'])||t.kind!=='PROJECT'||typeof t.projectId!=='string'||!uuid.test(t.projectId)||t.projectId===pid)||new Set(explicitTargets.map(t=>t.projectId)).size!==explicitTargets.length||typeof purpose!=='string'||!purpose.trim()||purpose.length>20000||!purpose.isWellFormed())throw new ApiError('KNOWLEDGE_SHARE_INPUT_INVALID');
 return{versionRefs:structuredClone(versionRefs),explicitTargets:structuredClone(explicitTargets),purpose};
}
function bound(b:KnowledgeShareRequestBuffer,s:DocumentSession){if(!b||b.ownerUserId!==s.user.id||b.ownerClientId!==s.clientId||!uuid.test(s.user.id)||!uuid.test(s.clientId)||!/^[A-Za-z0-9_-]{43}$/.test(s.csrfToken)||!Number.isSafeInteger(b.controlGeneration)||b.controlGeneration<1)throw new ApiError('KNOWLEDGE_SHARE_BINDING_INVALID');}
export function newKnowledgeShareRequest(pid:string,s:DocumentSession,generation:number,refs:ShareRef[]):KnowledgeShareRequestBuffer {const b:KnowledgeShareRequestBuffer={projectId:pid,ownerUserId:s.user.id,ownerClientId:s.clientId,controlGeneration:generation,versionRefs:structuredClone(refs),explicitTargets:[],purpose:'',pending:null,uncertain:false,dirty:false,resultRef:null,failure:null};bound(b,s);if(!uuid.test(pid)||!Array.isArray(refs)||!refs.length||refs.some(r=>!ref(r)))throw new ApiError('KNOWLEDGE_SHARE_INPUT_INVALID');return b;}
export async function prepareKnowledgeShareRequest(b:KnowledgeShareRequestBuffer,s:DocumentSession):Promise<ShareWrite>{bound(b,s);if(b.pending||b.resultRef||b.uncertain)throw new ApiError('KNOWLEDGE_SHARE_PENDING');return{schemaVersion:1,projectId:b.projectId,commandId:crypto.randomUUID(),clientId:s.clientId,controlGeneration:b.controlGeneration,operation:'requestKnowledgeShare',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:input(b.versionRefs,b.explicitTargets,b.purpose,b.projectId)};}
export async function validateKnowledgeShareView(value:unknown,pid:string,expected?:ShareRef):Promise<ShareView>{
 try{
  const v=value as any,effects=['transferPerformed','sharedEventCreated','approvalConsumed','executionAuthorized'];
  if(!v||!ref(v.requestRef)||v.requestRef.version!==1||v.state!=='RECORDED_ONLY'||effects.some(k=>v[k]!==false)||expected&&canonical(v.requestRef)!==canonical(expected))throw Error();
  if(v.currentCheck==='UNAVAILABLE'){if(!exact(v,['requestRef','state','currentCheck','reasonCode',...effects])||v.reasonCode!=='SOURCE_OR_TARGET_UNAVAILABLE')throw Error();return structuredClone(v) as unknown as ShareView;}
  if(v.currentCheck!=='METADATA_ELIGIBLE'||!exact(v,['requestRef','state','currentCheck','recordedAt','snapshot',...effects])||!iso(v.recordedAt))throw Error();
  const s=v.snapshot as ShareSnapshot;
  if(!exact(s,['projectId','createdBy','clientId','controlGeneration','versionRefs','explicitTargets','purpose','policyRef','recordedAt'])||s.projectId!==pid||!uuid.test(s.createdBy)||!uuid.test(s.clientId)||!Number.isSafeInteger(s.controlGeneration)||s.controlGeneration<1||!ref(s.policyRef)||s.recordedAt!==v.recordedAt||!Array.isArray(s.explicitTargets)||s.explicitTargets.some(t=>!exact(t,['kind','projectId','version'])||!Number.isSafeInteger(t.version)||t.version<1))throw Error();
  input(s.versionRefs,s.explicitTargets.map(({kind,projectId})=>({kind,projectId})),s.purpose,pid);
  if(await hash(s)!==v.requestRef.contentHash)throw Error();return structuredClone(v) as unknown as ShareView;
 }catch{throw new ApiError('RESPONSE_INVALID');}
}
export async function sendKnowledgeShareRequest(client:ApiClient,b:KnowledgeShareRequestBuffer,s:DocumentSession,active:()=>boolean):Promise<ShareView>{
 bound(b,s);const payload=input(b.versionRefs,b.explicitTargets,b.purpose,b.projectId),c=b.pending;
 if(!c||!exact(c,['schemaVersion','projectId','commandId','clientId','controlGeneration','operation','targetId','expectedVersion','baselineRefs','approvalRef','payload'])||!uuid.test(c.commandId)||c.schemaVersion!==1||c.projectId!==b.projectId||c.clientId!==s.clientId||c.controlGeneration!==b.controlGeneration||c.operation!=='requestKnowledgeShare'||c.targetId!==null||c.expectedVersion!==0||canonical(c.baselineRefs)!=='[]'||c.approvalRef!==null||canonical(c.payload)!==canonical(payload))throw new ApiError('KNOWLEDGE_SHARE_BINDING_INVALID');
 if(!active())throw new ApiError('KNOWLEDGE_SHARE_PAUSED');
 // 기존 same-origin transport의 새 명령 wire만 확장한다. 공통 DocumentWrite의 다른 연산은 변경하지 않는다.
 const response=await postDocumentCommand(client,c as unknown as DocumentWrite,s.csrfToken);
 if(!active())throw new ApiError('KNOWLEDGE_SHARE_PAUSED');
 const d=response.data;if(!d||!exact(d,'ref' in d?['ref','request']:['request']))throw new ApiError('RESPONSE_INVALID');
 const view=await validateKnowledgeShareView(d.request,b.projectId);
 if(!active())throw new ApiError('KNOWLEDGE_SHARE_PAUSED');
 if(response.commandId!==c.commandId||response.projectId!==b.projectId||response.targetId!==view.requestRef.id||response.version!==1||'ref' in d&&canonical(d.ref)!==canonical(view.requestRef))throw new ApiError('RESPONSE_INVALID');
 if(view.currentCheck==='METADATA_ELIGIBLE'){const v=view.snapshot;if(v.createdBy!==s.user.id||v.clientId!==s.clientId||v.controlGeneration!==b.controlGeneration||canonical(v.versionRefs)!==canonical(payload.versionRefs)||canonical(v.explicitTargets.map(({kind,projectId})=>({kind,projectId})))!==canonical(payload.explicitTargets)||v.purpose!==payload.purpose)throw new ApiError('RESPONSE_INVALID');}
 return view;
}
export async function readKnowledgeShareRequest(client:ApiClient,pid:string,r:ShareRef):Promise<ShareView>{if(!uuid.test(pid)||!ref(r)||r.version!==1)throw new ApiError('CLIENT_PATH_INVALID');return validateKnowledgeShareView(await client.get('/api/v1/projects/'+pid+'/knowledge-share-requests/'+r.id+'/versions/1?contentHash='+r.contentHash),pid,r);}
export interface KnowledgeSharePage {items:ShareView[];hasMore:boolean;nextCursor:string|null;observedAt:string}
export async function listKnowledgeShareRequests(client:ApiClient,pid:string,cursor:string|null=null,limit=20):Promise<KnowledgeSharePage>{
 if(!uuid.test(pid)||!Number.isSafeInteger(limit)||limit<1||limit>200||cursor!==null&&(typeof cursor!=='string'||!cursor||cursor.length>4096))throw new ApiError('CLIENT_PATH_INVALID');
 const params=new URLSearchParams({limit:String(limit)});if(cursor)params.set('cursor',cursor);const v=await client.get<any>('/api/v1/projects/'+pid+'/knowledge-share-requests?'+params);
 if(!exact(v,['items','hasMore','nextCursor','observedAt'])||!Array.isArray(v.items)||v.items.length>limit||typeof v.hasMore!=='boolean'||v.hasMore!==(typeof v.nextCursor==='string'&&v.nextCursor.length>0)||!v.hasMore&&v.nextCursor!==null||typeof v.nextCursor==='string'&&v.nextCursor.length>4096||!iso(v.observedAt))throw new ApiError('RESPONSE_INVALID');
 const items:ShareView[]=[];for(const item of v.items)items.push(await validateKnowledgeShareView(item,pid));if(new Set(items.map(i=>i.requestRef.id)).size!==items.length)throw new ApiError('RESPONSE_INVALID');return{items,hasMore:v.hasMore,nextCursor:v.nextCursor as string|null,observedAt:v.observedAt};
}