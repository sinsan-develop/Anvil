import {ApiClient,ApiError} from '../../api/client.ts';
import {postDocumentCommand,type DocumentWrite,type DocumentSession} from '../design-trace/editor-api.ts';
import type {KnowledgeEntry} from '../../../../server/modules/knowledge/knowledge-entry.ts';
type Ref={id:string;version:number;contentHash:string};
export const knowledgeKinds=['PURPOSE','CONSTITUTION','DECISION','FACT','HYPOTHESIS','FAILURE_SOLUTION','CAUTION'] as const;
export interface KnowledgePending{upload:DocumentWrite;save:DocumentWrite|null;saveId:string;snapshot:{kind:KnowledgeEntry['kind'];title:string;body:string;reason:string}}
export interface KnowledgeBuffer{projectId:string;ownerUserId:string;ownerClientId:string;controlGeneration:number;kind:KnowledgeEntry['kind'];title:string;body:string;reason:string;pending:KnowledgePending|null;resultRef:Ref|null;failure:{code:string;status:number}|null;uncertain:boolean;dirty:boolean}
export interface KnowledgeView{ref:Ref;entry:KnowledgeEntry;body:string;state:'PROPOSED'|'SUPERSEDED'|'EXCLUDED';headVersion:number;supersedesRef:Ref|null;appliedAsConstitution:false;redactionState:'NOT_REDACTED';sensitiveInspection:'KNOWN_PATTERNS_ONLY';agentDelivery:'NOT_CONNECTED';history:{id:string;kind:'PROPOSED'|'CORRECTED'|'EXCLUDED';reason:string;actorRef:{kind:'HUMAN';userId:string};baseRef?:Ref|null;sourceRefs?:KnowledgeEntry['sourceRefs']|null;recordedAt:string}[]}
export interface KnowledgeHit{versionRef:Ref;title:string;kind:KnowledgeEntry['kind'];sourceRefs:KnowledgeEntry['sourceRefs'];reasonSnippet:string;state:'PROPOSED'|'EXCLUDED'}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,hash=/^[0-9a-f]{64}$/;
const isRef=(r:Ref)=>r&&uuid.test(r.id)&&Number.isSafeInteger(r.version)&&r.version>0&&hash.test(r.contentHash);
const canonical=(v:any):string=>JSON.stringify(normalize(v));
function normalize(v:any):any{return Array.isArray(v)?v.map(normalize):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,normalize(v[k])])):v;}
async function digest(bytes:Uint8Array<ArrayBuffer>){return[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');}
async function entryHash(entry:KnowledgeEntry){return digest(new TextEncoder().encode(canonical(entry)));}
function validEntry(e:KnowledgeEntry,pid:string){
  return e&&Object.keys(e).sort().join(',')==='contentRef,kind,reason,relatedRefs,scope,sourceRefs,title'&&knowledgeKinds.includes(e.kind)&&typeof e.title==='string'&&!!e.title.trim()&&e.title.length<=200&&typeof e.reason==='string'&&!!e.reason.trim()&&e.reason.length<=20000&&e.scope?.projectId===pid&&Array.isArray(e.scope.stageRefs)&&!e.scope.stageRefs.length&&Array.isArray(e.scope.taskRefs)&&!e.scope.taskRefs.length&&Array.isArray(e.relatedRefs)&&!e.relatedRefs.length&&Array.isArray(e.sourceRefs)&&e.sourceRefs.length<=200&&e.sourceRefs.every(r=>r&&uuid.test(r.id)&&hash.test(r.contentHash)&&(['ARTIFACT','CONVERSATION','USER_INSTRUCTION'].includes(r.kind)&&Object.keys(r).sort().join(',')==='contentHash,id,kind'||r.kind==='DOCUMENT_VERSION'&&Object.keys(r).sort().join(',')==='contentHash,id,kind,version'&&Number.isSafeInteger(r.version)&&r.version>0))&&e.contentRef&&uuid.test(e.contentRef.artifactId)&&Number.isSafeInteger(e.contentRef.bytes)&&e.contentRef.bytes>=0&&e.contentRef.bytes<=2*1024*1024&&hash.test(e.contentRef.contentHash)&&['text/plain;charset=utf-8','text/markdown;charset=utf-8'].includes(e.contentRef.mediaType);
}
function owner(b:KnowledgeBuffer,s:DocumentSession){if(!uuid.test(b.projectId)||b.ownerUserId!==s.user.id||b.ownerClientId!==s.clientId||!uuid.test(s.clientId)||!Number.isSafeInteger(b.controlGeneration)||b.controlGeneration<1||!/^[A-Za-z0-9_-]{43}$/.test(s.csrfToken))throw new ApiError('KNOWLEDGE_BINDING_INVALID');}
export function newKnowledge(projectId:string,session:DocumentSession,controlGeneration:number):KnowledgeBuffer{
  const b:KnowledgeBuffer={projectId,ownerUserId:session.user.id,ownerClientId:session.clientId,controlGeneration,kind:'FACT',title:'',body:'',reason:'',pending:null,resultRef:null,failure:null,uncertain:false,dirty:false};owner(b,session);return b;
}
export async function prepareKnowledge(b:KnowledgeBuffer,s:DocumentSession):Promise<KnowledgePending>{
  owner(b,s);if(b.pending||b.resultRef||!knowledgeKinds.includes(b.kind)||!b.title.trim()||b.title.length>200||!b.title.isWellFormed()||!b.reason.trim()||b.reason.length>20000||!b.reason.isWellFormed()||!b.body.isWellFormed()||new TextEncoder().encode(b.body).length>2*1024*1024)throw new ApiError('KNOWLEDGE_INPUT_INVALID');
  const bytes=new TextEncoder().encode(b.body),snapshot={kind:b.kind,title:b.title,body:b.body,reason:b.reason};
  return{upload:{schemaVersion:1,projectId:b.projectId,commandId:crypto.randomUUID(),clientId:s.clientId,controlGeneration:b.controlGeneration,operation:'uploadArtifact',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:{mediaType:'text/plain;charset=utf-8',bytes:bytes.length,contentHash:await digest(bytes)}},save:null,saveId:crypto.randomUUID(),snapshot};
}
export async function sendKnowledge(client:ApiClient,b:KnowledgeBuffer,s:DocumentSession,checkpoint:(p:KnowledgePending)=>void,active:()=>boolean):Promise<Ref>{
  owner(b,s);let p=b.pending;if(!p||!uuid.test(p.saveId)||canonical(p.snapshot)!==canonical({kind:b.kind,title:b.title,body:b.body,reason:b.reason}))throw new ApiError('KNOWLEDGE_INPUT_INVALID');
  const u=p.upload,bytes=new TextEncoder().encode(p.snapshot.body);
  if(u.schemaVersion!==1||u.projectId!==b.projectId||!uuid.test(u.commandId)||u.clientId!==s.clientId||u.controlGeneration!==b.controlGeneration||u.operation!=='uploadArtifact'||u.targetId!==null||u.expectedVersion!==0||u.baselineRefs.length||u.approvalRef!==null||canonical(u.payload)!==canonical({mediaType:'text/plain;charset=utf-8',bytes:bytes.length,contentHash:await digest(bytes)}))throw new ApiError('KNOWLEDGE_INPUT_INVALID');
  if(!active())throw new ApiError('KNOWLEDGE_CONTINUATION_PAUSED');
  if(!p.save){
    const r=await postDocumentCommand(client,u,s.csrfToken,bytes),a=r.data?.artifactRef;
    if(!a||!uuid.test(a.artifactId)||canonical({bytes:a.bytes,contentHash:a.contentHash,mediaType:a.mediaType})!==canonical(u.payload)||r.targetId!==a.artifactId||r.version!==null||r.data.status!=='ARTIFACT_READY')throw new ApiError('RESPONSE_INVALID');
    const entry:KnowledgeEntry={kind:p.snapshot.kind,title:p.snapshot.title,contentRef:a,sourceRefs:[{kind:'ARTIFACT',id:a.artifactId,contentHash:a.contentHash}],reason:p.snapshot.reason,scope:{projectId:b.projectId,stageRefs:[],taskRefs:[]},relatedRefs:[]};
    p={...p,save:{...u,commandId:p.saveId,operation:'saveKnowledge',payload:{entry}}};checkpoint(p);
  }
  if(!active())throw new ApiError('KNOWLEDGE_CONTINUATION_PAUSED');
  const c=p.save!,e=c.payload.entry as KnowledgeEntry;
  if(c.schemaVersion!==1||c.projectId!==u.projectId||c.clientId!==u.clientId||c.controlGeneration!==u.controlGeneration||c.commandId!==p.saveId||c.operation!=='saveKnowledge'||c.targetId!==null||c.expectedVersion!==0||c.baselineRefs.length||c.approvalRef!==null||!validEntry(e,b.projectId)||e.title!==b.title||e.kind!==b.kind||e.reason!==b.reason||canonical({bytes:e.contentRef.bytes,contentHash:e.contentRef.contentHash,mediaType:e.contentRef.mediaType})!==canonical(u.payload)||canonical(e.sourceRefs)!==canonical([{kind:'ARTIFACT',id:e.contentRef.artifactId,contentHash:e.contentRef.contentHash}]))throw new ApiError('KNOWLEDGE_INPUT_INVALID');
  const r=await postDocumentCommand(client,c,s.csrfToken),ref=r.data?.ref;
  if(!isRef(ref)||ref.version!==1||r.targetId!==ref.id||r.version!==1||r.data?.status!=='PROPOSED'||canonical(r.data.entry)!==canonical(e)||ref.contentHash!==await entryHash(e))throw new ApiError('RESPONSE_INVALID');
  return ref;
}
export async function readKnowledge(client:ApiClient,pid:string,ref:Ref):Promise<KnowledgeView>{
  if(!uuid.test(pid)||!isRef(ref))throw new ApiError('CLIENT_PATH_INVALID');
  const v=await client.get<KnowledgeView>(`/api/v1/projects/${pid}/knowledge/${ref.id}/versions/${ref.version}`);
  if(!v||canonical(v.ref)!==canonical(ref)||!validEntry(v.entry,pid)||typeof v.body!=='string'||!v.body.isWellFormed()||!Number.isSafeInteger(v.headVersion)||v.headVersion<ref.version||v.appliedAsConstitution!==false||v.redactionState!=='NOT_REDACTED'||v.sensitiveInspection!=='KNOWN_PATTERNS_ONLY'||v.agentDelivery!=='NOT_CONNECTED'||!Array.isArray(v.history)||v.history.length<1||v.history.length>2||v.history.some((e,n)=>!e||!uuid.test(e.id)||e.kind!==(n===0?(ref.version===1?'PROPOSED':'CORRECTED'):'EXCLUDED')||typeof e.reason!=='string'||!e.reason.trim()||e.reason.length>20000||e.kind==='PROPOSED'&&e.reason!==v.entry.reason||e.actorRef?.kind!=='HUMAN'||!uuid.test(e.actorRef.userId)||!Number.isFinite(Date.parse(e.recordedAt))||e.kind==='CORRECTED'&&(!Array.isArray(e.sourceRefs)||!validEntry({...v.entry,sourceRefs:e.sourceRefs},pid)||canonical(e.baseRef)!==canonical(v.supersedesRef))||e.kind!=='CORRECTED'&&(e.baseRef!=null||e.sourceRefs!=null))||await entryHash(v.entry)!==ref.contentHash)throw new ApiError('RESPONSE_INVALID');
  if(ref.version===1?v.supersedesRef!==null:!isRef(v.supersedesRef!)||v.supersedesRef!.id!==ref.id||v.supersedesRef!.version!==ref.version-1)throw new ApiError('RESPONSE_INVALID');
  const expectedState=v.history.length===2?'EXCLUDED':v.headVersion>ref.version?'SUPERSEDED':'PROPOSED';if(v.state!==expectedState)throw new ApiError('RESPONSE_INVALID');
  const bytes=new TextEncoder().encode(v.body);if(bytes.length!==v.entry.contentRef.bytes||await digest(bytes)!==v.entry.contentRef.contentHash)throw new ApiError('KNOWLEDGE_INTEGRITY_FAILED');
  return v;
}
export async function searchKnowledge(client:ApiClient,pid:string,query='',kind='',cursor:string|null=null,status:'PROPOSED'|'EXCLUDED'='PROPOSED'){
  if(!uuid.test(pid)||query.length>200||!query.isWellFormed()||kind&&!knowledgeKinds.includes(kind as KnowledgeEntry['kind'])||cursor!==null&&(typeof cursor!=='string'||cursor.length>4096)||!['PROPOSED','EXCLUDED'].includes(status))throw new ApiError('CLIENT_PATH_INVALID');
  const qs=new URLSearchParams({query,limit:'50'});if(kind)qs.set('kind',kind);if(cursor)qs.set('cursor',cursor);if(status==='EXCLUDED')qs.set('status',status);
  const v=await client.get<{items:KnowledgeHit[];hasMore:boolean;nextCursor:string|null;searchScope:'TITLE_REASON';observedAt:string}>(`/api/v1/projects/${pid}/knowledge?${qs}`);
  if(!v||!Array.isArray(v.items)||v.items.length>50||v.searchScope!=='TITLE_REASON'||typeof v.hasMore!=='boolean'||(v.hasMore?typeof v.nextCursor!=='string'||!v.nextCursor||v.nextCursor.length>4096:v.nextCursor!==null))throw new ApiError('RESPONSE_INVALID');
  if(!Number.isFinite(Date.parse(v.observedAt))||v.items.some(i=>!i||!isRef(i.versionRef)||!knowledgeKinds.includes(i.kind)||kind&&i.kind!==kind||typeof i.title!=='string'||i.title.length>200||typeof i.reasonSnippet!=='string'||i.reasonSnippet.length>200||i.state!==status||!Array.isArray(i.sourceRefs)||i.sourceRefs.length>200))throw new ApiError('RESPONSE_INVALID');
  return v;
}
