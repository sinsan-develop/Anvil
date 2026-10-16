import{ApiClient,ApiError}from'../../api/client.ts';
import{postDocumentCommand,type DocumentSession,type DocumentWrite}from'../design-trace/editor-api.ts';
import{validateKnowledgeView,type KnowledgeView}from'./api.ts';
export interface KnowledgeExclusionBuffer{projectId:string;ownerUserId:string;ownerClientId:string;controlGeneration:number;target:KnowledgeView;reason:string;pending:DocumentWrite|null;savedEventId:string|null;uncertain:boolean;dirty:boolean;failure:{code:string;status:number}|null}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function bound(b:KnowledgeExclusionBuffer,s:DocumentSession){if(!uuid.test(b.projectId)||b.ownerUserId!==s.user.id||b.ownerClientId!==s.clientId||!uuid.test(s.clientId)||!/^[A-Za-z0-9_-]{43}$/.test(s.csrfToken)||!Number.isSafeInteger(b.controlGeneration)||b.controlGeneration<1||b.target?.entry.scope.projectId!==b.projectId||!['PROPOSED','SUPERSEDED'].includes(b.target.state))throw new ApiError('KNOWLEDGE_EXCLUSION_BINDING_INVALID');}
export function newKnowledgeExclusion(pid:string,view:KnowledgeView,s:DocumentSession,generation:number):KnowledgeExclusionBuffer{
 const b:KnowledgeExclusionBuffer={projectId:pid,ownerUserId:s.user.id,ownerClientId:s.clientId,controlGeneration:generation,target:structuredClone(view),reason:'',pending:null,savedEventId:null,uncertain:false,dirty:false,failure:null};bound(b,s);return b;
}
async function payload(b:KnowledgeExclusionBuffer,s:DocumentSession){
 bound(b,s);await validateKnowledgeView(b.target,b.projectId,b.target.ref);if(typeof b.reason!=='string'||!b.reason.trim()||b.reason.length>20000||!b.reason.isWellFormed())throw new ApiError('KNOWLEDGE_EXCLUSION_INPUT_INVALID');
 return{versionRef:{...b.target.ref},reason:b.reason};
}
export async function prepareKnowledgeExclusion(b:KnowledgeExclusionBuffer,s:DocumentSession):Promise<DocumentWrite>{
 if(b.pending||b.savedEventId)throw new ApiError('KNOWLEDGE_EXCLUSION_PENDING');const p=await payload(b,s);
 return{schemaVersion:1,projectId:b.projectId,commandId:crypto.randomUUID(),clientId:s.clientId,controlGeneration:b.controlGeneration,operation:'excludeKnowledge',targetId:b.target.ref.id,expectedVersion:b.target.ref.version,baselineRefs:[],approvalRef:null,payload:p};
}
export async function sendKnowledgeExclusion(client:ApiClient,b:KnowledgeExclusionBuffer,s:DocumentSession,active:()=>boolean){
 const p=await payload(b,s),c=b.pending;
 if(!c||!uuid.test(c.commandId)||c.schemaVersion!==1||c.operation!=='excludeKnowledge'||c.projectId!==b.projectId||c.clientId!==s.clientId||c.controlGeneration!==b.controlGeneration||c.targetId!==b.target.ref.id||c.expectedVersion!==b.target.ref.version||c.baselineRefs.length||c.approvalRef!==null||Object.keys(c.payload).sort().join(',')!=='reason,versionRef'||JSON.stringify(c.payload)!==JSON.stringify(p))throw new ApiError('KNOWLEDGE_EXCLUSION_INPUT_INVALID');
 if(!active())throw new ApiError('KNOWLEDGE_EXCLUSION_PAUSED');
 const r=await postDocumentCommand(client,c,s.csrfToken),d=r.data,ref=b.target.ref;
 if(r.targetId!==ref.id||r.version!==ref.version||d?.status!=='EXCLUDED'||d.ref?.id!==ref.id||d.ref?.version!==ref.version||d.ref?.contentHash!==ref.contentHash||d.reason!==b.reason||!uuid.test(d.eventId))throw new ApiError('RESPONSE_INVALID');
 return{eventId:d.eventId,ref};
}
