import {validateKnowledgeCorrectionUploadApproval,validateKnowledgeCorrectionUploadBinding,type KnowledgeCorrectionUploadApproval} from './knowledge-correction-upload-approval.ts';
import{ApiClient,ApiError}from'../../api/client.ts';
import{postDocumentCommand,type DocumentSession,type DocumentWrite}from'../design-trace/editor-api.ts';
import{validateKnowledgeView,type KnowledgeView}from'./api.ts';
import {validKnowledgeScope} from './knowledge-scope.ts';
import type{KnowledgeScope}from'../../../../server/modules/knowledge/knowledge-entry.ts';
import type{KnowledgeEntry,TextArtifactRef}from'../../../../server/modules/knowledge/knowledge-entry.ts';
import type{KnowledgeDocumentSource}from'./knowledge-document-source.ts';
import{knowledgeCorrectionSourceRefs as sourceRefs}from'./knowledge-correction-sources.ts';
type Ref=KnowledgeView['ref'];
interface CorrectionInput{scope?:KnowledgeScope;targetRef:Ref;title:string;body:string;reason:string;changeReason:string;additionalDocumentSources?:KnowledgeDocumentSource[];additionalArtifactSources?:import('./knowledge-artifact-source.ts').KnowledgeArtifactSource[];additionalConversationSources?:import('./knowledge-correction-sources.ts').KnowledgeCorrectionConversationSource[]}
export interface KnowledgeCorrectionPending{uploadApproval?:KnowledgeCorrectionUploadApproval;upload:DocumentWrite;correct:DocumentWrite|null;commandId:string;input:CorrectionInput}
export interface KnowledgeCorrectionBuffer{projectId:string;ownerUserId:string;ownerClientId:string;controlGeneration:number;scope?:KnowledgeScope;target:KnowledgeView;title:string;body:string;reason:string;changeReason:string;additionalDocumentSources?:KnowledgeDocumentSource[];additionalArtifactSources?:import('./knowledge-artifact-source.ts').KnowledgeArtifactSource[];additionalConversationSources?:import('./knowledge-correction-sources.ts').KnowledgeCorrectionConversationSource[];pending:KnowledgeCorrectionPending|null;savedRef:Ref|null;failure:{code:string;status:number;quarantinedArtifactId?:string}|null;uncertain:boolean;dirty:boolean}
export type KnowledgeCorrectionChange=KnowledgeCorrectionBuffer|null|((current:KnowledgeCorrectionBuffer|null)=>KnowledgeCorrectionBuffer|null);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const normalize=(v:any):any=>Array.isArray(v)?v.map(normalize):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,normalize(v[k])])):v,canonical=(v:any)=>JSON.stringify(normalize(v));
async function digest(bytes:Uint8Array<ArrayBuffer>){return[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');}
function bound(b:KnowledgeCorrectionBuffer,s:DocumentSession){if(!uuid.test(b.projectId)||b.ownerUserId!==s.user.id||b.ownerClientId!==s.clientId||!uuid.test(s.user.id)||!uuid.test(s.clientId)||!/^[A-Za-z0-9_-]{43}$/.test(s.csrfToken)||!Number.isSafeInteger(b.controlGeneration)||b.controlGeneration<1||b.target?.entry.scope.projectId!==b.projectId||!['PROPOSED','CONFIRMED'].includes(b.target.state)||b.target.headVersion!==b.target.ref.version||!Number.isSafeInteger(b.target.ref.version+1))throw new ApiError('KNOWLEDGE_CORRECTION_BINDING_INVALID');}
export function newKnowledgeCorrection(pid:string,target:KnowledgeView,s:DocumentSession,generation:number):KnowledgeCorrectionBuffer{
 const b:KnowledgeCorrectionBuffer={projectId:pid,ownerUserId:s.user.id,ownerClientId:s.clientId,controlGeneration:generation,scope:structuredClone(target.entry.scope),target:structuredClone(target),title:target.entry.title,body:target.body,reason:target.entry.reason,changeReason:'',additionalDocumentSources:[],additionalArtifactSources:[],additionalConversationSources:[],pending:null,savedRef:null,failure:null,uncertain:false,dirty:false};bound(b,s);return b;
}
function capture(b:KnowledgeCorrectionBuffer):CorrectionInput{return{...(b.scope===undefined?{}:{scope:structuredClone(b.scope)}),targetRef:{...b.target.ref},title:b.title,body:b.body,reason:b.reason,changeReason:b.changeReason,...(b.additionalDocumentSources===undefined?{}:{additionalDocumentSources:structuredClone(b.additionalDocumentSources)}),...(b.additionalArtifactSources===undefined?{}:{additionalArtifactSources:structuredClone(b.additionalArtifactSources)}),...(b.additionalConversationSources===undefined?{}:{additionalConversationSources:structuredClone(b.additionalConversationSources)})};}
async function metadata(b:KnowledgeCorrectionBuffer,s:DocumentSession){
 bound(b,s);await validateKnowledgeView(b.target,b.projectId,b.target.ref);
 if(!validKnowledgeScope(b.scope??b.target.entry.scope,b.projectId,b.target.entry.kind)||typeof b.title!=='string'||!b.title.trim()||b.title.length>200||!b.title.isWellFormed()||typeof b.body!=='string'||!b.body.isWellFormed()||typeof b.reason!=='string'||!b.reason.trim()||b.reason.length>20000||!b.reason.isWellFormed()||typeof b.changeReason!=='string'||!b.changeReason.trim()||b.changeReason.length>20000||!b.changeReason.isWellFormed())throw new ApiError('KNOWLEDGE_CORRECTION_INPUT_INVALID');
 const bytes=new TextEncoder().encode(b.body);if(bytes.length>2*1024*1024||sourceRefs(b).length>=200)throw new ApiError('KNOWLEDGE_CORRECTION_INPUT_TOO_LARGE');
 return{bytes,payload:{mediaType:b.target.entry.contentRef.mediaType,bytes:bytes.length,contentHash:await digest(bytes)}};
}
export async function prepareKnowledgeCorrection(input:KnowledgeCorrectionBuffer,session:DocumentSession):Promise<KnowledgeCorrectionPending>{
 const b=structuredClone(input),s=structuredClone(session);
 if(b.pending||b.savedRef)throw new ApiError('KNOWLEDGE_CORRECTION_PENDING');const m=await metadata(b,s);
 return{input:capture(b),upload:{schemaVersion:1,projectId:b.projectId,commandId:crypto.randomUUID(),clientId:s.clientId,controlGeneration:b.controlGeneration,operation:'uploadArtifact',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:m.payload},correct:null,commandId:crypto.randomUUID()};
}
export async function sendKnowledgeCorrection(client:ApiClient,input:KnowledgeCorrectionBuffer,session:DocumentSession,checkpoint:(p:KnowledgeCorrectionPending)=>void,active:()=>boolean):Promise<Ref>{
 const b=structuredClone(input),s=structuredClone(session);
 const m=await metadata(b,s);let p=b.pending;if(!p||!uuid.test(p.commandId)||canonical(p.input)!==canonical(capture(b)))throw new ApiError('KNOWLEDGE_CORRECTION_INPUT_INVALID');const u=p.upload;
 if(u.schemaVersion!==1||u.projectId!==b.projectId||!uuid.test(u.commandId)||u.clientId!==s.clientId||u.controlGeneration!==b.controlGeneration||u.operation!=='uploadArtifact'||u.targetId!==null||u.expectedVersion!==0||u.baselineRefs.length||(u.approvalRef!==null&&!p.uploadApproval)||canonical(u.payload)!==canonical(m.payload))throw new ApiError('KNOWLEDGE_CORRECTION_INPUT_INVALID');
 if(u.approvalRef!==null){if(p.correct)await validateKnowledgeCorrectionUploadBinding(p,s,active);else await validateKnowledgeCorrectionUploadApproval(client,p,s,active);}
 if(!active())throw new ApiError('KNOWLEDGE_CORRECTION_PAUSED');
 if(!p.correct){
  const r=await postDocumentCommand(client,u,s.csrfToken,m.bytes),a=r.data?.artifactRef as TextArtifactRef;
  if(!a||!uuid.test(a.artifactId)||canonical({bytes:a.bytes,contentHash:a.contentHash,mediaType:a.mediaType})!==canonical(m.payload)||r.targetId!==a.artifactId||r.version!==null||r.data.status!=='ARTIFACT_READY')throw new ApiError('RESPONSE_INVALID');
  if(!active())throw new ApiError('KNOWLEDGE_CORRECTION_PAUSED');
  const entry:KnowledgeEntry={...structuredClone(b.target.entry),title:b.title,contentRef:a,sourceRefs:sourceRefs(b,a),reason:b.reason,scope:structuredClone(b.scope??b.target.entry.scope)};
  p={...p,correct:{...u,commandId:p.commandId,operation:'correctKnowledge',approvalRef:null,targetId:b.target.ref.id,expectedVersion:b.target.ref.version,payload:{baseRef:{...b.target.ref},entry,reason:b.changeReason,sourceRefs:sourceRefs(b)}}};checkpoint(p);
 }
 if(!active())throw new ApiError('KNOWLEDGE_CORRECTION_PAUSED');const c=p.correct!,e=c.payload.entry as KnowledgeEntry;
 if(!e?.contentRef||!uuid.test(e.contentRef.artifactId)||canonical({bytes:e.contentRef.bytes,contentHash:e.contentRef.contentHash,mediaType:e.contentRef.mediaType})!==canonical(m.payload))throw new ApiError('KNOWLEDGE_CORRECTION_INPUT_INVALID');
 const expectedEntry={...structuredClone(b.target.entry),title:b.title,contentRef:e.contentRef,sourceRefs:sourceRefs(b,e.contentRef),reason:b.reason,scope:structuredClone(b.scope??b.target.entry.scope)},expectedPayload={baseRef:{...b.target.ref},entry:expectedEntry,reason:b.changeReason,sourceRefs:sourceRefs(b)};
 if(c.schemaVersion!==1||c.projectId!==u.projectId||c.clientId!==u.clientId||c.controlGeneration!==u.controlGeneration||c.operation!=='correctKnowledge'||c.commandId!==p.commandId||c.targetId!==b.target.ref.id||c.expectedVersion!==b.target.ref.version||c.baselineRefs.length||c.approvalRef!==null||canonical(c.payload)!==canonical(expectedPayload))throw new ApiError('KNOWLEDGE_CORRECTION_INPUT_INVALID');
 const r=await postDocumentCommand(client,c,s.csrfToken),d=r.data,ref=d?.ref;
 if(!ref||ref.id!==b.target.ref.id||ref.version!==b.target.ref.version+1||r.targetId!==ref.id||r.version!==ref.version||d.status!=='PROPOSED'||canonical(d.entry)!==canonical(expectedEntry)||canonical(d.baseRef)!==canonical(b.target.ref)||canonical(d.supersedesRef)!==canonical(b.target.ref)||d.reason!==b.changeReason||canonical(d.changeSources)!==canonical(sourceRefs(b))||!uuid.test(d.eventId)||ref.contentHash!==await digest(new TextEncoder().encode(canonical(expectedEntry))))throw new ApiError('RESPONSE_INVALID');if(!active())throw new ApiError('KNOWLEDGE_CORRECTION_PAUSED');return ref;
}
