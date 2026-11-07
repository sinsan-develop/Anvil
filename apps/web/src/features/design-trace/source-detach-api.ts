import {ApiClient,ApiError} from '../../api/client.ts';
import {documentControl,postDocumentCommand,type DocumentSession,type DocumentWrite} from './editor-api.ts';
import {readSourceLinks,sourceLinksDigest,type SourceLinkView} from './source-links-api.ts';
import type {DocumentSourceLinkRecord} from '../../../../server/modules/documents/document-source-link-history.ts';
import {isKnownDocumentRejection} from './mutation-result.ts';
type Ref={id:string;version:number;contentHash:string};type Snapshot=DocumentSourceLinkRecord['snapshot'];
export interface SourceDetachReceipt{ref:Ref;snapshot:Snapshot}
export interface SourceDetachBuffer{bindingId:string;ownerUserId:string;ownerClientId:string;projectId:string;documentRef:Ref;sourceLinkRef:Ref;source:Snapshot;reason:string;acknowledged:boolean;pending:DocumentWrite|null;sent:boolean;uncertain:boolean;dispatchId:string|null;receipt:SourceDetachReceipt|null;verified:boolean;failure:{code:string;status:number}|null}
export type SourceDetachChange=(previous:SourceDetachBuffer|null)=>SourceDetachBuffer|null;
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
const exact=(v:any,keys:string[])=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
const ref=(v:any):v is Ref=>exact(v,['id','version','contentHash'])&&uuid(v.id)&&Number.isSafeInteger(v.version)&&v.version>0&&typeof v.contentHash==='string'&&/^[0-9a-f]{64}$/.test(v.contentHash);
const same=(a:Ref,b:Ref)=>a.id===b.id&&a.version===b.version&&a.contentHash===b.contentHash;
const approval=(v:any)=>v===null||exact(v,['requestId','decisionId','scopeDigest'])&&uuid(v.requestId)&&uuid(v.decisionId)&&typeof v.scopeDigest==='string'&&/^[0-9a-f]{64}$/.test(v.scopeDigest);
function fail(code='SOURCE_DETACH_INPUT_INVALID',status=422):never{throw new ApiError(code,status);}
function validate(b:SourceDetachBuffer,s:DocumentSession){
 if(!uuid(b.bindingId)||!uuid(b.projectId)||b.ownerUserId!==s.user.id||b.ownerClientId!==s.clientId||!uuid(s.user.id)||!uuid(s.clientId)||!/^[A-Za-z0-9_-]{43}$/.test(s.csrfToken)||!ref(b.documentRef)||!ref(b.sourceLinkRef)||b.sourceLinkRef.version!==1||!b.source||b.source.projectId!==b.projectId||!ref(b.source.documentRef)||!same(b.source.documentRef,b.documentRef)||b.source.kind!=='LINKED'||b.source.state!=='ACTIVE'||b.source.previousRef!==null||!b.acknowledged||typeof b.reason!=='string'||!b.reason.trim()||!b.reason.isWellFormed()||b.reason.length>20000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(b.reason))fail();
}
export function newSourceDetach(projectId:string,item:SourceLinkView,s:DocumentSession):SourceDetachBuffer{
 if(item.projectId!==projectId||!item.rawAllowed||item.state!=='ACTIVE'||item.comparison!=='UNVERIFIED'||!ref(item.documentRef)||!ref(item.ref)||item.ref.version!==1||item.history?.length!==1||!same(item.history[0]!.ref,item.ref))return fail();
 return{bindingId:crypto.randomUUID(),ownerUserId:s.user.id,ownerClientId:s.clientId,projectId,documentRef:{...item.documentRef},sourceLinkRef:{...item.ref},source:structuredClone(item.history[0]!.snapshot),reason:'',acknowledged:false,pending:null,sent:false,uncertain:false,dispatchId:null,receipt:null,verified:false,failure:null};
}
export async function prepareSourceDetach(client:ApiClient,input:SourceDetachBuffer,s:DocumentSession,active:()=>boolean):Promise<SourceDetachBuffer>{
 const b=structuredClone(input),check=()=>{if(!active())fail('SOURCE_DETACH_PAUSED');};validate(b,s);check();if(b.pending||b.sent||b.receipt)fail();
 const generation=await documentControl(client,b.projectId,s);check();const current=await readSourceLinks(client,b.projectId,b.documentRef,active);check();
 const link=current.items.find(i=>i.ref.id===b.sourceLinkRef.id);if(!link||!link.rawAllowed||link.state!=='ACTIVE'||!same(link.ref,b.sourceLinkRef)||link.history?.length!==1)fail('SOURCE_DETACH_LINK_CHANGED',409);
 if(await sourceLinksDigest(b.source)!==b.sourceLinkRef.contentHash)fail();check();
 const pending:DocumentWrite={schemaVersion:1,projectId:b.projectId,commandId:crypto.randomUUID(),clientId:s.clientId,controlGeneration:generation,operation:'detachDocumentSource',targetId:b.sourceLinkRef.id,expectedVersion:1,baselineRefs:[],approvalRef:null,payload:{sourceLinkRef:{...b.sourceLinkRef},reason:b.reason}};
 return{...b,pending,failure:null};
}
async function validateReceipt(b:SourceDetachBuffer,value:SourceDetachReceipt){
 const snapshot=value?.snapshot,reference=value?.ref,at=snapshot?.recordedAt;
 if(!ref(reference)||reference.id!==b.sourceLinkRef.id||reference.version!==2||typeof at!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(at)||!Number.isFinite(Date.parse(at))||new Date(at).toISOString()!==at||Date.parse(at)<Date.parse(b.source.recordedAt))fail('SOURCE_DETACH_RESPONSE_INVALID',503);
 const expected={...b.source,kind:'DETACHED',state:'DETACHED',previousRef:b.sourceLinkRef,reason:b.reason,recordedAt:at},hash=await sourceLinksDigest(expected);
 if(reference.contentHash!==hash||await sourceLinksDigest(snapshot)!==hash)fail('SOURCE_DETACH_RESPONSE_INVALID',503);
 return structuredClone(value);
}
export async function sendSourceDetach(client:ApiClient,input:SourceDetachBuffer,s:DocumentSession,active:()=>boolean,onDispatch:()=>void):Promise<SourceDetachReceipt>{
 const b=structuredClone(input);validate(b,s);const c=b.pending;
 if(b.receipt||!c||!exact(c,['schemaVersion','projectId','commandId','clientId','controlGeneration','operation','targetId','expectedVersion','baselineRefs','approvalRef','payload'])||c.schemaVersion!==1||!uuid(c.commandId)||c.projectId!==b.projectId||c.clientId!==s.clientId||c.operation!=='detachDocumentSource'||c.targetId!==b.sourceLinkRef.id||c.expectedVersion!==1||!Number.isSafeInteger(c.controlGeneration)||c.controlGeneration<1||!Array.isArray(c.baselineRefs)||c.baselineRefs.length||!approval(c.approvalRef)||!exact(c.payload,['sourceLinkRef','reason'])||!ref(c.payload.sourceLinkRef)||!same(c.payload.sourceLinkRef,b.sourceLinkRef)||c.payload.reason!==b.reason||await sourceLinksDigest(b.source)!==b.sourceLinkRef.contentHash)fail();
 if(!active())fail('SOURCE_DETACH_PAUSED');const generation=await documentControl(client,b.projectId,s);if(!active())fail('SOURCE_DETACH_PAUSED');if(generation!==c.controlGeneration)fail('CONTROL_GENERATION_CONFLICT',409);
 onDispatch();if(!active())fail('SOURCE_DETACH_PAUSED');const result=await postDocumentCommand(client,c,s.csrfToken);
 if(result.targetId!==b.sourceLinkRef.id||result.version!==2||!exact(result.data,['ref','status','snapshot'])||result.data.status!=='DOCUMENT_SOURCE_DETACHED'||result.serverReceivedAt!==result.data.snapshot?.recordedAt)fail('SOURCE_DETACH_RESPONSE_INVALID',503);
 // 전송 이후 이탈해도 같은 binding의 수신 결과는 보존한다. 이탈한 화면에는 표시하지 않는다.
 return validateReceipt(b,{ref:result.data.ref,snapshot:result.data.snapshot});
}
export async function verifySourceDetach(client:ApiClient,input:SourceDetachBuffer,s:DocumentSession,active:()=>boolean){
 const b=structuredClone(input);validate(b,s);if(!b.receipt)fail();await validateReceipt(b,b.receipt);
 const current=await readSourceLinks(client,b.projectId,b.documentRef,active),link=current.items.find(i=>i.ref.id===b.sourceLinkRef.id);
 if(!link&&current.hasMore)fail('SOURCE_DETACH_RESULT_NOT_IN_PAGE',412);
 if(!link||link.state!=='DETACHED'||!same(link.ref,b.receipt.ref))fail('SOURCE_DETACH_REQUERY_MISMATCH',409);return true;
}
export function canCloseSourceDetach(b:SourceDetachBuffer){return !b.sent||b.verified||!b.uncertain&&!b.receipt&&isKnownDocumentRejection(b.failure);}
