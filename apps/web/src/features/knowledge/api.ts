import {knowledgeSearchScopeWire,type KnowledgeSearchScope} from './knowledge-search-scope.ts';
import {validateKnowledgeUploadBinding,validateKnowledgeUploadApproval,type KnowledgeUploadApproval} from './knowledge-upload-approval.ts';
import {ApiClient,ApiError} from '../../api/client.ts';
import {postDocumentCommand,type DocumentWrite,type DocumentSession} from '../design-trace/editor-api.ts';
import {validKnowledgeScope,knowledgeScopeOf} from './knowledge-scope.ts';
import type {KnowledgeScope} from '../../../../server/modules/knowledge/knowledge-entry.ts';
import type {KnowledgeEntry} from '../../../../server/modules/knowledge/knowledge-entry.ts';
import{validateKnowledgeReviewMetadata,type KnowledgeReviewCriteria,type KnowledgeStoredReview,type KnowledgeReviewRef}from'./review-view.ts';
import{readConversationMessage}from'./conversation-api.ts';
import type{MessageRef}from'../../../../server/modules/knowledge/conversation-input.ts';
import{validateConstitutionRecord,type ConstitutionRecord}from'./constitution-proof.ts';
type Ref={id:string;version:number;contentHash:string};
export const knowledgeKinds=['PURPOSE','CONSTITUTION','DECISION','FACT','HYPOTHESIS','FAILURE_SOLUTION','CAUTION'] as const;
export interface KnowledgePending{uploadApproval?:KnowledgeUploadApproval;upload:DocumentWrite;save:DocumentWrite|null;saveId:string;snapshot:{scope?:KnowledgeScope;kind:KnowledgeEntry['kind'];title:string;body:string;reason:string;sourceRefs:KnowledgeEntry['sourceRefs']}}
export interface KnowledgeBuffer{projectId:string;ownerUserId:string;ownerClientId:string;controlGeneration:number;scope?:KnowledgeScope;kind:KnowledgeEntry['kind'];title:string;body:string;reason:string;sourceRefs:KnowledgeEntry['sourceRefs'];pending:KnowledgePending|null;resultRef:Ref|null;failure:{code:string;status:number;quarantinedArtifactId?:string}|null;uncertain:boolean;dirty:boolean}
export interface KnowledgeView{ref:Ref;entry:KnowledgeEntry;body:string;state:'PROPOSED'|'CONFIRMED'|'SUPERSEDED'|'EXCLUDED';headVersion:number;supersedesRef:Ref|null;contentReviewCriteria?:KnowledgeReviewCriteria;contentReviews?:KnowledgeStoredReview[];confirmation?:null|{eventId:string;reviewRefs:KnowledgeReviewRef[];reason:string;actorRef:{kind:'HUMAN';userId:string};recordedAt:string};currentConfirmationValid?:boolean;appliedAsConstitution:boolean;constitutionApplication?:ConstitutionRecord;redactionState:'NOT_REDACTED';sensitiveInspection:'KNOWN_PATTERNS_ONLY';agentDelivery:'NOT_CONNECTED';history:{id:string;kind:'PROPOSED'|'CORRECTED'|'CONFIRMED'|'EXCLUDED';reason:string;actorRef:{kind:'HUMAN';userId:string};baseRef?:Ref|null;sourceRefs?:KnowledgeEntry['sourceRefs']|null;reviewRefs?:KnowledgeReviewRef[]|null;recordedAt:string}[]}
export interface KnowledgeHit{versionRef:Ref;title:string;kind:KnowledgeEntry['kind'];sourceRefs:KnowledgeEntry['sourceRefs'];reasonSnippet:string;state:'PROPOSED'|'CONFIRMED'|'EXCLUDED';currentConfirmationValid?:boolean}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,hash=/^[0-9a-f]{64}$/;
const isRef=(r:Ref)=>r&&uuid.test(r.id)&&Number.isSafeInteger(r.version)&&r.version>0&&hash.test(r.contentHash);
const canonical=(v:any):string=>JSON.stringify(normalize(v));
function normalize(v:any):any{return Array.isArray(v)?v.map(normalize):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,normalize(v[k])])):v;}
async function digest(bytes:Uint8Array<ArrayBuffer>){return[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');}
async function entryHash(entry:KnowledgeEntry){return digest(new TextEncoder().encode(canonical(entry)));}
function validSources(refs:KnowledgeEntry['sourceRefs']){return Array.isArray(refs)&&refs.length<=200&&new Set(refs.map(r=>canonical(r))).size===refs.length&&refs.every(r=>r&&uuid.test(r.id)&&hash.test(r.contentHash)&&(['ARTIFACT','CONVERSATION','USER_INSTRUCTION'].includes(r.kind)&&Object.keys(r).sort().join(',')==='contentHash,id,kind'||r.kind==='DOCUMENT_VERSION'&&Object.keys(r).sort().join(',')==='contentHash,id,kind,version'&&Number.isSafeInteger(r.version)&&r.version>0));}
function validEntry(e:KnowledgeEntry,pid:string){
  return e&&Object.keys(e).sort().join(',')==='contentRef,kind,reason,relatedRefs,scope,sourceRefs,title'&&knowledgeKinds.includes(e.kind)&&typeof e.title==='string'&&!!e.title.trim()&&e.title.length<=200&&typeof e.reason==='string'&&!!e.reason.trim()&&e.reason.length<=20000&&validKnowledgeScope(e.scope,pid,e.kind)&&Array.isArray(e.relatedRefs)&&!e.relatedRefs.length&&Array.isArray(e.sourceRefs)&&e.sourceRefs.length<=200&&e.sourceRefs.every(r=>r&&uuid.test(r.id)&&hash.test(r.contentHash)&&(['ARTIFACT','CONVERSATION','USER_INSTRUCTION'].includes(r.kind)&&Object.keys(r).sort().join(',')==='contentHash,id,kind'||r.kind==='DOCUMENT_VERSION'&&Object.keys(r).sort().join(',')==='contentHash,id,kind,version'&&Number.isSafeInteger(r.version)&&r.version>0))&&e.contentRef&&uuid.test(e.contentRef.artifactId)&&Number.isSafeInteger(e.contentRef.bytes)&&e.contentRef.bytes>=0&&e.contentRef.bytes<=2*1024*1024&&hash.test(e.contentRef.contentHash)&&['text/plain;charset=utf-8','text/markdown;charset=utf-8'].includes(e.contentRef.mediaType);
}
function owner(b:KnowledgeBuffer,s:DocumentSession){if(!uuid.test(b.projectId)||b.ownerUserId!==s.user.id||b.ownerClientId!==s.clientId||!uuid.test(s.clientId)||!Number.isSafeInteger(b.controlGeneration)||b.controlGeneration<1||!/^[A-Za-z0-9_-]{43}$/.test(s.csrfToken))throw new ApiError('KNOWLEDGE_BINDING_INVALID');}
export function newKnowledge(projectId:string,session:DocumentSession,controlGeneration:number):KnowledgeBuffer{
  const b:KnowledgeBuffer={projectId,ownerUserId:session.user.id,ownerClientId:session.clientId,controlGeneration,scope:{projectId,stageRefs:[],taskRefs:[]},kind:'FACT',title:'',body:'',reason:'',sourceRefs:[],pending:null,resultRef:null,failure:null,uncertain:false,dirty:false};owner(b,session);return b;
}
export async function newKnowledgeFromConversation(client:ApiClient,pid:string,cid:string,sourceRef:MessageRef,s:DocumentSession,generation:number){
 const b=newKnowledge(pid,s,generation),v=await readConversationMessage(client,pid,cid,sourceRef);b.body=v.body;b.sourceRefs=[{...v.sourceRef,kind:v.message.kind==='USER_INSTRUCTION'?'USER_INSTRUCTION':'CONVERSATION'}];b.dirty=true;return b;
}
export async function prepareKnowledge(input:KnowledgeBuffer,session:DocumentSession):Promise<KnowledgePending>{
  const b=structuredClone(input),s=structuredClone(session);
  owner(b,s);if(!validKnowledgeScope(knowledgeScopeOf(b),b.projectId,b.kind)||b.pending||b.resultRef||!knowledgeKinds.includes(b.kind)||!b.title.trim()||b.title.length>200||!b.title.isWellFormed()||!b.reason.trim()||b.reason.length>20000||!b.reason.isWellFormed()||!b.body.isWellFormed()||!validSources(b.sourceRefs)||b.sourceRefs.length>=200||new TextEncoder().encode(b.body).length>2*1024*1024)throw new ApiError('KNOWLEDGE_INPUT_INVALID');
  const bytes=new TextEncoder().encode(b.body),snapshot={kind:b.kind,title:b.title,body:b.body,reason:b.reason,sourceRefs:structuredClone(b.sourceRefs),...(b.scope===undefined?{}:{scope:structuredClone(b.scope)})};
  return{upload:{schemaVersion:1,projectId:b.projectId,commandId:crypto.randomUUID(),clientId:s.clientId,controlGeneration:b.controlGeneration,operation:'uploadArtifact',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:{mediaType:'text/plain;charset=utf-8',bytes:bytes.length,contentHash:await digest(bytes)}},save:null,saveId:crypto.randomUUID(),snapshot};
}
export async function sendKnowledge(client:ApiClient,input:KnowledgeBuffer,session:DocumentSession,checkpoint:(p:KnowledgePending)=>void,active:()=>boolean):Promise<Ref>{
  const b=structuredClone(input),s=structuredClone(session);
  owner(b,s);let p=b.pending;if(!validKnowledgeScope(knowledgeScopeOf(b),b.projectId,b.kind)||!p||!uuid.test(p.saveId)||!validSources(b.sourceRefs)||b.sourceRefs.length>=200||canonical(p.snapshot)!==canonical({kind:b.kind,title:b.title,body:b.body,reason:b.reason,sourceRefs:b.sourceRefs,...(b.scope===undefined?{}:{scope:b.scope})}))throw new ApiError('KNOWLEDGE_INPUT_INVALID');
  const u=p.upload,bytes=new TextEncoder().encode(p.snapshot.body);
  if(u.schemaVersion!==1||u.projectId!==b.projectId||!uuid.test(u.commandId)||u.clientId!==s.clientId||u.controlGeneration!==b.controlGeneration||u.operation!=='uploadArtifact'||u.targetId!==null||u.expectedVersion!==0||u.baselineRefs.length||u.approvalRef!==null&&!p.uploadApproval?.commandHash||u.approvalRef===null&&!!p.uploadApproval||canonical(u.payload)!==canonical({mediaType:'text/plain;charset=utf-8',bytes:bytes.length,contentHash:await digest(bytes)}))throw new ApiError('KNOWLEDGE_INPUT_INVALID');
  if(!active())throw new ApiError('KNOWLEDGE_CONTINUATION_PAUSED');
  if(u.approvalRef!==null)await validateKnowledgeUploadBinding(p,s,active);
  if(!p.save){
    if(u.approvalRef!==null)await validateKnowledgeUploadApproval(client,p,s,active);
    if(!active())throw new ApiError('KNOWLEDGE_CONTINUATION_PAUSED');
    const r=await postDocumentCommand(client,u,s.csrfToken,bytes);
    if(!active())throw new ApiError('KNOWLEDGE_CONTINUATION_PAUSED');
    const a=r.data?.artifactRef;
    if(!a||!uuid.test(a.artifactId)||canonical({bytes:a.bytes,contentHash:a.contentHash,mediaType:a.mediaType})!==canonical(u.payload)||r.targetId!==a.artifactId||r.version!==null||r.data.status!=='ARTIFACT_READY')throw new ApiError('RESPONSE_INVALID');
    const entry:KnowledgeEntry={kind:p.snapshot.kind,title:p.snapshot.title,contentRef:a,sourceRefs:[...p.snapshot.sourceRefs,{kind:'ARTIFACT',id:a.artifactId,contentHash:a.contentHash}],reason:p.snapshot.reason,scope:structuredClone(knowledgeScopeOf(b)),relatedRefs:[]};
    p={...p,save:{...u,approvalRef:null,commandId:p.saveId,operation:'saveKnowledge',payload:{entry}}};checkpoint(p);
  }
  if(!active())throw new ApiError('KNOWLEDGE_CONTINUATION_PAUSED');
  const c=p.save!,e=c.payload.entry as KnowledgeEntry;
if(c.schemaVersion!==1||c.projectId!==u.projectId||c.clientId!==u.clientId||c.controlGeneration!==u.controlGeneration||c.commandId!==p.saveId||c.operation!=='saveKnowledge'||c.targetId!==null||c.expectedVersion!==0||c.baselineRefs.length||c.approvalRef!==null||!validEntry(e,b.projectId)||canonical(e.scope)!==canonical(knowledgeScopeOf(b))||e.title!==b.title||e.kind!==b.kind||e.reason!==b.reason||canonical({bytes:e.contentRef.bytes,contentHash:e.contentRef.contentHash,mediaType:e.contentRef.mediaType})!==canonical(u.payload)||canonical(e.sourceRefs)!==canonical([...p.snapshot.sourceRefs,{kind:'ARTIFACT',id:e.contentRef.artifactId,contentHash:e.contentRef.contentHash}]))throw new ApiError('KNOWLEDGE_INPUT_INVALID');
  const r=await postDocumentCommand(client,c,s.csrfToken),ref=r.data?.ref;
  if(!isRef(ref)||ref.version!==1||r.targetId!==ref.id||r.version!==1||r.data?.status!=='PROPOSED'||canonical(r.data.entry)!==canonical(e)||ref.contentHash!==await entryHash(e))throw new ApiError('RESPONSE_INVALID');
  if(!active())throw new ApiError('KNOWLEDGE_CONTINUATION_PAUSED');
  return ref;
}
export async function readKnowledge(client:ApiClient,pid:string,ref:Ref):Promise<KnowledgeView>{
  if(!uuid.test(pid)||!isRef(ref))throw new ApiError('CLIENT_PATH_INVALID');
  const v=await client.get<KnowledgeView>(`/api/v1/projects/${pid}/knowledge/${ref.id}/versions/${ref.version}`);
  return validateKnowledgeView(v,pid,ref);
}
export async function validateKnowledgeView(v:KnowledgeView,pid:string,ref:Ref):Promise<KnowledgeView>{
  if(!uuid.test(pid)||!isRef(ref))throw new ApiError('CLIENT_PATH_INVALID');
  if(!v||canonical(v.ref)!==canonical(ref)||!validEntry(v.entry,pid)||typeof v.body!=='string'||!v.body.isWellFormed()||!Number.isSafeInteger(v.headVersion)||v.headVersion<ref.version||typeof v.appliedAsConstitution!=='boolean'||v.redactionState!=='NOT_REDACTED'||v.sensitiveInspection!=='KNOWN_PATTERNS_ONLY'||v.agentDelivery!=='NOT_CONNECTED'||!Array.isArray(v.history)||v.history.length<1||v.history.length>3||v.history[0]?.kind!==(ref.version===1?'PROPOSED':'CORRECTED')||!['','CONFIRMED','EXCLUDED','CONFIRMED,EXCLUDED'].includes(v.history.slice(1).map(e=>e.kind).join(','))||new Set(v.history.map(e=>e?.id)).size!==v.history.length||v.history.some(e=>!e||!uuid.test(e.id)||typeof e.reason!=='string'||!e.reason.trim()||e.reason.length>20000||e.kind==='PROPOSED'&&e.reason!==v.entry.reason||e.actorRef?.kind!=='HUMAN'||!uuid.test(e.actorRef.userId)||!Number.isFinite(Date.parse(e.recordedAt))||e.kind==='CORRECTED'&&(!Array.isArray(e.sourceRefs)||!validEntry({...v.entry,sourceRefs:e.sourceRefs},pid)||canonical(e.baseRef)!==canonical(v.supersedesRef))||e.kind!=='CORRECTED'&&(e.baseRef!=null||e.sourceRefs!=null)||e.kind!=='CONFIRMED'&&e.reviewRefs!=null)||await entryHash(v.entry)!==ref.contentHash)throw new ApiError('RESPONSE_INVALID');
  if(ref.version===1?v.supersedesRef!==null:!isRef(v.supersedesRef!)||v.supersedesRef!.id!==ref.id||v.supersedesRef!.version!==ref.version-1)throw new ApiError('RESPONSE_INVALID');
  if(v.appliedAsConstitution){const record=v.constitutionApplication;if(!record||v.entry.kind!=='CONSTITUTION'||!v.confirmation||record.application.confirmationId!==v.confirmation.eventId||canonical(record.application.versionRef)!==canonical(ref))throw new ApiError('RESPONSE_INVALID');await validateConstitutionRecord(record,pid);}else if(v.constitutionApplication!==undefined)throw new ApiError('RESPONSE_INVALID');
  const expectedState=v.history.some(e=>e.kind==='EXCLUDED')?'EXCLUDED':v.headVersion>ref.version?'SUPERSEDED':v.history.some(e=>e.kind==='CONFIRMED')?'CONFIRMED':'PROPOSED';if(v.state!==expectedState)throw new ApiError('RESPONSE_INVALID');validateKnowledgeReviewMetadata(v);
  const bytes=new TextEncoder().encode(v.body);if(bytes.length!==v.entry.contentRef.bytes||await digest(bytes)!==v.entry.contentRef.contentHash)throw new ApiError('KNOWLEDGE_INTEGRITY_FAILED');
  return v;
}
export async function searchKnowledge(client:ApiClient,pid:string,query='',kind='',cursor:string|null=null,status:'ACTIVE'|'PROPOSED'|'CONFIRMED'|'EXCLUDED'='ACTIVE',scope:KnowledgeSearchScope|null=null){
  if(!uuid.test(pid)||query.length>200||!query.isWellFormed()||kind&&!knowledgeKinds.includes(kind as KnowledgeEntry['kind'])||cursor!==null&&(typeof cursor!=='string'||cursor.length>4096)||!['ACTIVE','PROPOSED','CONFIRMED','EXCLUDED'].includes(status))throw new ApiError('CLIENT_PATH_INVALID');
  const scopeWire=scope===null?null:knowledgeSearchScopeWire(scope);
  const qs=new URLSearchParams({query,limit:'50'});if(scopeWire!==null)qs.set('scope',scopeWire);if(kind)qs.set('kind',kind);if(cursor)qs.set('cursor',cursor);if(status!=='ACTIVE')qs.set('status',status);
  const v=await client.get<{items:KnowledgeHit[];hasMore:boolean;nextCursor:string|null;searchScope:'TITLE_REASON';observedAt:string}>(`/api/v1/projects/${pid}/knowledge?${qs}`);
  if(!v||!Array.isArray(v.items)||v.items.length>50||v.searchScope!=='TITLE_REASON'||typeof v.hasMore!=='boolean'||(v.hasMore?typeof v.nextCursor!=='string'||!v.nextCursor||v.nextCursor.length>4096:v.nextCursor!==null))throw new ApiError('RESPONSE_INVALID');
  if(!Number.isFinite(Date.parse(v.observedAt))||v.items.some(i=>!i||!isRef(i.versionRef)||!knowledgeKinds.includes(i.kind)||kind&&i.kind!==kind||typeof i.title!=='string'||i.title.length>200||typeof i.reasonSnippet!=='string'||i.reasonSnippet.length>200||(status==='ACTIVE'?!['PROPOSED','CONFIRMED'].includes(i.state):i.state!==status)||i.state==='CONFIRMED'&&typeof i.currentConfirmationValid!=='boolean'||!Array.isArray(i.sourceRefs)||i.sourceRefs.length>200))throw new ApiError('RESPONSE_INVALID');
  return v;
}
