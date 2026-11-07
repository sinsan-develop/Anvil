import {ApiClient,ApiError} from '../../api/client.ts';
import {documentControl,type DocumentSession,type DocumentWrite} from '../design-trace/editor-api.ts';
import type {KnowledgeCorrectionBuffer,KnowledgeCorrectionPending} from './correction-api.ts';
import {readCandidatePermissionPolicy} from '../connections/candidate-policy-api.ts';
import {readApproval,validApprovalDetails,type ApprovalRequestWork,type ApprovalCommand} from '../decisions/api.ts';
import {validateKnowledgeView} from './api.ts';
import {ordered} from './review-view.ts';
import {digestBytes,uuid} from '../project-create/baseline-validation.ts';
import {isKnownDocumentRejection} from '../design-trace/mutation-result.ts';

export interface KnowledgeCorrectionUploadApproval {
 request:ApprovalRequestWork|null;requestId:string;commandHash:string|null;ownerUserId:string;sourceHash:string;
 rejectedRequests?:{command:ApprovalCommand;failure:{code:string;status:number}}[];
}
const same=(a:unknown,b:unknown)=>ordered(a)===ordered(b);
const digest=(v:unknown)=>digestBytes(new TextEncoder().encode(ordered(v)));
function fail(code='KNOWLEDGE_CORRECTION_UPLOAD_APPROVAL_MISMATCH',status=409):never{throw new ApiError(code,status);}
function check(active:()=>boolean){if(!active())fail('KNOWLEDGE_CONTINUATION_PAUSED',412);}
async function sourceHash(p:KnowledgeCorrectionPending){const{uploadApproval:_approval,correct:_correct,upload,...rest}=p;return digest({...rest,upload:{...upload,approvalRef:null}});}
export function matchesKnowledgeCorrectionInput(b:KnowledgeCorrectionBuffer,p:KnowledgeCorrectionPending,s:DocumentSession){
 const input={...(b.scope===undefined?{}:{scope:b.scope}),targetRef:b.target.ref,title:b.title,body:b.body,reason:b.reason,changeReason:b.changeReason,...(b.additionalDocumentSources===undefined?{}:{additionalDocumentSources:b.additionalDocumentSources}),...(b.additionalArtifactSources===undefined?{}:{additionalArtifactSources:b.additionalArtifactSources}),...(b.additionalConversationSources===undefined?{}:{additionalConversationSources:b.additionalConversationSources})};
 return b.ownerUserId===s.user.id&&b.ownerClientId===s.clientId&&b.projectId===p.upload.projectId&&b.controlGeneration===p.upload.controlGeneration&&s.clientId===p.upload.clientId&&same(input,p.input);
}
async function frozen(b:KnowledgeCorrectionBuffer,s:DocumentSession){
 const p=b.pending,c=p?.upload;
 if(!p||!c||!matchesKnowledgeCorrectionInput(b,p,s)||!b.dirty||!uuid(p.commandId)||b.savedRef!==null||b.uncertain||b.failure?.code!=='APPROVAL_REQUIRED'||b.failure.status!==412||p.correct||p.uploadApproval?.commandHash||p.uploadApproval?.request?.pending||p.uploadApproval?.request?.uncertain||c.schemaVersion!==1||!uuid(c.projectId)||!uuid(c.commandId)||!uuid(c.clientId)||!uuid(s.user.id)||!Number.isSafeInteger(c.controlGeneration)||c.controlGeneration<1||c.operation!=='uploadArtifact'||c.targetId!==null||c.expectedVersion!==0||!same(c.baselineRefs,[])||c.approvalRef!==null||!/^[A-Za-z0-9_-]{43}$/.test(s.csrfToken))fail();
 await validateKnowledgeView(b.target,b.projectId,b.target.ref);if(!['PROPOSED','CONFIRMED'].includes(b.target.state)||b.target.headVersion!==b.target.ref.version)fail();
 const bytes=new TextEncoder().encode(p.input.body);if(!p.input.body.isWellFormed()||bytes.length>2*1024*1024||c.payload.mediaType!==b.target.entry.contentRef.mediaType||!same(c.payload,{bytes:bytes.length,mediaType:b.target.entry.contentRef.mediaType,contentHash:await digestBytes(bytes)}))fail();return structuredClone(c);
}
async function basis(client:ApiClient,c:DocumentWrite,s:DocumentSession,active:()=>boolean){
 check(active);const generation=await documentControl(client,c.projectId,s);check(active);if(generation!==c.controlGeneration)fail('CONTROL_GENERATION_CONFLICT');
 const policy=await readCandidatePermissionPolicy(client,c.projectId);check(active);if(!policy)fail('PERMISSION_POLICY_UNCONFIGURED',412);
 const rules=policy.rules.filter(r=>same(r.subjectRef,{kind:'HUMAN',userId:s.user.id})&&Array.isArray(r.operations)&&r.operations.includes('uploadArtifact')&&Array.isArray(r.targetScopes)&&r.targetScopes.some((t:unknown)=>same(t,{kind:'PROJECT',projectId:c.projectId}))&&typeof r.expiresAt==='string'&&Date.parse(r.expiresAt)>Date.now());
 if(!rules.length||rules.some(r=>r.disposition==='DENY'))fail('PROJECT_OPERATION_DENIED',403);
 if(rules.some(r=>r.limitPolicyRef!==null||!['AUTO','REQUIRE_APPROVAL'].includes(r.disposition)))fail('RESPONSE_INVALID',503);
 if(!rules.some(r=>r.disposition==='REQUIRE_APPROVAL'))fail('APPROVAL_NOT_REQUIRED',422);
 return{policyRef:policy.ref,expires:Math.min(...rules.map(r=>Date.parse(r.expiresAt)))};
}
async function scope(c:DocumentWrite,s:DocumentSession){return{operation:'uploadArtifact',targetRef:null,expectedVersion:0,payloadHash:await digest(c.payload),baselineRefs:[] as never[],environmentRef:null,sourceScopes:[] as never[],limitsRef:null,requestedSubjectRef:{kind:'HUMAN' as const,userId:s.user.id,clientId:s.clientId},controlGeneration:c.controlGeneration};}
export async function newKnowledgeCorrectionUploadApproval(b:KnowledgeCorrectionBuffer,s:DocumentSession):Promise<ApprovalRequestWork>{
 const candidate=await frozen(b,s);return{projectId:b.projectId,ownerUserId:s.user.id,ownerClientId:s.clientId,controlGeneration:b.controlGeneration,candidate,details:{reason:'',risks:{data:'',security:'',cost:'',interruption:'',unverified:''},rollback:{method:'',limitations:'',evidenceRefs:[]},expiresAt:''},pending:null,resultId:null,failure:null,uncertain:false,dirty:false};
}
export async function prepareKnowledgeCorrectionUploadApproval(client:ApiClient,input:ApprovalRequestWork,source:KnowledgeCorrectionBuffer,s:DocumentSession,active:()=>boolean):Promise<ApprovalCommand>{
 const b=structuredClone(source),w=structuredClone(input),c=await frozen(b,s);check(active);
 if(w.projectId!==b.projectId||w.ownerUserId!==s.user.id||w.ownerClientId!==s.clientId||w.controlGeneration!==c.controlGeneration||w.pending||w.resultId||!same(w.candidate,c))fail();
 const current=await basis(client,c,s,active),details={...w.details,candidateCommandId:c.commandId,actionScope:await scope(c,s)};check(active);
 if(!validApprovalDetails(details)||Date.parse(details.expiresAt)<=Date.now()||Date.parse(details.expiresAt)>current.expires||/-----BEGIN (?:[A-Z0-9]+ )?PRIVATE KEY-----|\bBearer\s+[A-Za-z0-9._~+\/-]{12,}|\b(?:api[_-]?key|access[_-]?token|secret|password|passwd|token)\s*[=:]\s*\S+/i.test(ordered(details)))fail('APPROVAL_INPUT_INVALID',422);
 return{schemaVersion:1,projectId:b.projectId,commandId:crypto.randomUUID(),clientId:s.clientId,controlGeneration:c.controlGeneration,operation:'requestApproval',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:{details}};
}
export async function bindKnowledgeCorrectionUploadApproval(client:ApiClient,source:KnowledgeCorrectionBuffer,requestId:string,s:DocumentSession,active:()=>boolean):Promise<KnowledgeCorrectionBuffer>{
 const b=structuredClone(source),c=await frozen(b,s);check(active);const a=b.pending!.uploadApproval;
 if(!uuid(requestId)||a?.request?.resultId&&a.request.resultId!==requestId)fail();
 const current=await basis(client,c,s,active),view=await readApproval(client,b.projectId,requestId);check(active);const r=view.request,expected=await scope(c,s);check(active);
 if(!same(r.policyRef,current.policyRef)||r.details.candidateCommandId!==c.commandId||!same(r.details.actionScope,expected))fail();
 if(!view.basisCurrent||view.effectiveState!=='APPROVED'||view.expired||view.decision?.decision!=='APPROVE'||view.consumption||Date.parse(r.details.expiresAt)<=Date.now()||Date.parse(r.details.expiresAt)>current.expires)fail('APPROVAL_NOT_USABLE',412);
 const upload={...c,approvalRef:{requestId:r.id,decisionId:view.decision.id,scopeDigest:r.scopeDigest}},commandHash=await digest(upload),snapshotHash=await sourceHash(b.pending!);check(active);
 return{...b,pending:{...b.pending!,upload,uploadApproval:{...a,request:a?.request??null,requestId,commandHash,ownerUserId:s.user.id,sourceHash:snapshotHash}},failure:null};
}
// GET 결박은 허가를 만들지 않는다. 최종 소비/현재 정책/바이트 검사는 파일 API가 다시 집행한다.
export async function validateKnowledgeCorrectionUploadBinding(p:KnowledgeCorrectionPending,s:DocumentSession,active:()=>boolean){
 const a=p.uploadApproval,c=p.upload;check(active);
 if(!a||!c.approvalRef||a.ownerUserId!==s.user.id||a.requestId!==c.approvalRef.requestId||a.request?.pending||a.request?.uncertain||a.commandHash!==await digest(c)||a.sourceHash!==await sourceHash(p))fail();check(active);
}
export async function validateKnowledgeCorrectionUploadApproval(client:ApiClient,p:KnowledgeCorrectionPending,s:DocumentSession,active:()=>boolean){
 await validateKnowledgeCorrectionUploadBinding(p,s,active);const a=p.uploadApproval!,c=p.upload;
 const current=await basis(client,c,s,active),v=await readApproval(client,c.projectId,a.requestId);check(active);const r=v.request,expected=await scope(c,s);check(active);
 if(!same(r.policyRef,current.policyRef)||r.details.candidateCommandId!==c.commandId||!same(r.details.actionScope,expected)||!same(c.approvalRef,{requestId:r.id,decisionId:v.decision?.id,scopeDigest:r.scopeDigest})||!v.basisCurrent||v.decision?.decision!=='APPROVE')fail();
 if(v.consumption){if(v.effectiveState!=='CONSUMED'||v.consumption.commandId!==c.commandId||v.consumption.requestHash!==a.commandHash)fail();}
 else if(v.effectiveState!=='APPROVED'||v.expired||Date.parse(r.details.expiresAt)<=Date.now()||Date.parse(r.details.expiresAt)>current.expires)fail('APPROVAL_NOT_USABLE',412);
 check(active);
}
export function reopenKnowledgeCorrectionUploadApproval(b:KnowledgeCorrectionBuffer,s:DocumentSession):KnowledgeCorrectionBuffer{
 const a=b.pending?.uploadApproval,w=a?.request;
 if(!b.pending||b.uncertain||b.ownerUserId!==s.user.id||!matchesKnowledgeCorrectionInput(b,b.pending,s)||!a||a.commandHash||a.requestId||!w?.pending||w.resultId||w.uncertain||!isKnownDocumentRejection(w.failure))fail();
 return{...b,pending:{...b.pending,uploadApproval:{...a,rejectedRequests:[...(a.rejectedRequests??[]),{command:w.pending,failure:w.failure!}],request:{...w,pending:null,failure:null,uncertain:false,dirty:true}}}};
}
