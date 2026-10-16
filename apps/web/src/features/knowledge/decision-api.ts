import{ApiClient,ApiError}from'../../api/client.ts';
import{postDocumentCommand,type DocumentSession,type DocumentWrite}from'../design-trace/editor-api.ts';
import{validateKnowledgeView,type KnowledgeView}from'./api.ts';
import{ordered,knowledgeReason,knowledgeOutcomes,type KnowledgeOutcome,type KnowledgeStoredReview,type KnowledgeReviewRef}from'./review-view.ts';
import{constitutionHash,constitutionRef}from'./constitution-proof.ts';
export interface KnowledgeDecisionBuffer{projectId:string;ownerUserId:string;ownerClientId:string;controlGeneration:number;kind:'REVIEW'|'CONFIRM'|'APPLY';applicationBaseRef?:KnowledgeView['ref']|null;target:KnowledgeView;items:KnowledgeStoredReview['items'];outcome:KnowledgeOutcome;reason:string;acknowledged:boolean;pending:DocumentWrite|null;savedId:string|null;failure:{code:string;status:number}|null;dirty:boolean;uncertain:boolean}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function bound(b:KnowledgeDecisionBuffer,s:DocumentSession){if(!uuid.test(b.projectId)||b.ownerUserId!==s.user.id||b.ownerClientId!==s.clientId||!uuid.test(s.clientId)||!/^[A-Za-z0-9_-]{43}$/.test(s.csrfToken)||!Number.isSafeInteger(b.controlGeneration)||b.controlGeneration<1||b.target?.entry.scope.projectId!==b.projectId||!['PROPOSED','CONFIRMED'].includes(b.target.state)||b.target.ref.version!==b.target.headVersion||!['REVIEW','CONFIRM','APPLY'].includes(b.kind))throw new ApiError('KNOWLEDGE_DECISION_BINDING_INVALID');}
export function newKnowledgeDecision(pid:string,target:KnowledgeView,s:DocumentSession,generation:number,kind:'REVIEW'|'CONFIRM'|'APPLY'):KnowledgeDecisionBuffer{
 const b:KnowledgeDecisionBuffer={projectId:pid,ownerUserId:s.user.id,ownerClientId:s.clientId,controlGeneration:generation,kind,target:structuredClone(target),items:(target.contentReviewCriteria?.items??[]).map(i=>({criterionId:i.criterionId,outcome:'NOT_EXECUTED',reason:'',evidenceRefs:[]})),outcome:'NOT_EXECUTED',reason:'',acknowledged:false,pending:null,savedId:null,failure:null,dirty:false,uncertain:false};bound(b,s);return b;
}
async function payload(b:KnowledgeDecisionBuffer,s:DocumentSession){
 bound(b,s);await validateKnowledgeView(b.target,b.projectId,b.target.ref);if(!knowledgeReason(b.reason)||!b.target.contentReviewCriteria||!b.target.contentReviews)throw new ApiError('KNOWLEDGE_DECISION_INPUT_INVALID');
 if(b.kind==='APPLY'){
  if(b.applicationBaseRef===undefined||b.applicationBaseRef!==null&&(!constitutionRef(b.applicationBaseRef)||b.applicationBaseRef.id!==b.projectId)||!b.acknowledged||b.target.entry.kind!=='CONSTITUTION'||b.target.state!=='CONFIRMED'||!b.target.currentConfirmationValid||!b.target.confirmation||b.target.appliedAsConstitution)throw new ApiError('CONSTITUTION_APPLICATION_NOT_READY');
  return{versionRef:{...b.target.ref},confirmationId:b.target.confirmation.eventId,reason:b.reason,acknowledged:true};
 }
 if(b.kind==='CONFIRM'){
  const latest=b.target.contentReviews[0];if(!b.acknowledged||b.target.confirmation||b.target.state!=='PROPOSED'||!latest||latest.ref.outcome!=='ACCEPTED')throw new ApiError('KNOWLEDGE_CONFIRMATION_REVIEW_REQUIRED');
  return{versionRef:{...b.target.ref},reviewRefs:[structuredClone(latest.ref)],reason:b.reason};
 }
 const criteria=b.target.contentReviewCriteria.items;
 if(!knowledgeOutcomes.includes(b.outcome)||!Array.isArray(b.items)||b.items.length!==criteria.length||new Set(b.items.map(i=>i?.criterionId)).size!==criteria.length||b.items.some(i=>!criteria.some(c=>c.criterionId===i?.criterionId)||Object.keys(i).sort().join(',')!=='criterionId,evidenceRefs,outcome,reason'||!knowledgeOutcomes.includes(i.outcome)||!knowledgeReason(i.reason)||!Array.isArray(i.evidenceRefs)||i.evidenceRefs.length)||b.outcome==='ACCEPTED'&&b.items.some(i=>i.outcome!=='ACCEPTED'))throw new ApiError('KNOWLEDGE_REVIEW_INPUT_INVALID');
 return{targetKind:'KNOWLEDGE',targetRef:{...b.target.ref},criteriaVersion:1,items:structuredClone(b.items),outcome:b.outcome,reason:b.reason};
}
function command(b:KnowledgeDecisionBuffer,s:DocumentSession,p:Record<string,unknown>,id:string):DocumentWrite{return{schemaVersion:1,projectId:b.projectId,commandId:id,clientId:s.clientId,controlGeneration:b.controlGeneration,operation:b.kind==='REVIEW'?'recordContentReview':b.kind==='APPLY'?'applyConstitution':'confirmKnowledge',targetId:b.kind==='APPLY'?b.projectId:b.target.ref.id,expectedVersion:b.kind==='APPLY'?(b.applicationBaseRef?.version??0):b.target.ref.version,baselineRefs:[],approvalRef:null,payload:p};}
export async function prepareKnowledgeDecision(b:KnowledgeDecisionBuffer,s:DocumentSession){if(b.pending||b.savedId)throw new ApiError('KNOWLEDGE_DECISION_PENDING');return command(b,s,await payload(b,s),crypto.randomUUID());}
export async function sendKnowledgeDecision(client:ApiClient,b:KnowledgeDecisionBuffer,s:DocumentSession,active:()=>boolean){
 const p=await payload(b,s),c=b.pending;if(!c||!uuid.test(c.commandId)||ordered(c)!==ordered(command(b,s,p,c.commandId)))throw new ApiError('KNOWLEDGE_DECISION_INPUT_INVALID');if(!active())throw new ApiError('KNOWLEDGE_DECISION_PAUSED');
 const r=await postDocumentCommand(client,c,s.csrfToken),d=r.data,ref=b.target.ref;
 if(b.kind==='APPLY'){
  const application={projectId:b.projectId,...p,reviewRef:b.target.contentReviews![0]!.ref,previousApplicationRef:b.applicationBaseRef,appliedBy:{kind:'HUMAN',userId:s.user.id,clientId:s.clientId},controlGeneration:b.controlGeneration},applicationRef={id:b.projectId,version:(b.applicationBaseRef?.version??0)+1,contentHash:await constitutionHash(application)};
  if(r.targetId!==b.projectId||r.version!==applicationRef.version||d.status!=='CONSTITUTION_APPLIED'||ordered(d.ref)!==ordered(applicationRef)||ordered(d.application)!==ordered(application))throw new ApiError('RESPONSE_INVALID');return{kind:'APPLY' as const,id:b.projectId,applicationRef};
 }
 if(r.targetId!==ref.id||r.version!==ref.version||ordered(d?.ref)!==ordered(ref))throw new ApiError('RESPONSE_INVALID');
 if(b.kind==='REVIEW'){const rr=d.reviewRef as KnowledgeReviewRef;if(d.status!=='REVIEW_RECORDED'||!rr||!uuid.test(rr.id)||ordered(rr.targetRef)!==ordered(ref)||rr.criteriaVersion!==1||rr.outcome!==b.outcome)throw new ApiError('RESPONSE_INVALID');return{kind:'REVIEW' as const,id:rr.id,reviewRef:rr};}
 if(d.status!=='CONFIRMED'||!uuid.test(d.eventId)||d.confirmationId!==d.eventId||d.reason!==b.reason||ordered(d.reviewRefs)!==ordered(p.reviewRefs))throw new ApiError('RESPONSE_INVALID');return{kind:'CONFIRM' as const,id:d.eventId};
}
