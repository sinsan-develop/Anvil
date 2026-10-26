import {ApiClient,ApiError} from '../../api/client.ts';
import {documentControl,type DocumentSession,type DocumentWrite} from '../design-trace/editor-api.ts';
import type {ConversationBuffer,ConversationPending} from './conversation-api.ts';
import {readCandidatePermissionPolicy} from '../connections/candidate-policy-api.ts';
import {readApproval,validApprovalDetails,type ApprovalRequestWork,type ApprovalCommand} from '../decisions/api.ts';
import {ordered} from './review-view.ts';
import {digestBytes,uuid} from '../project-create/baseline-validation.ts';
import {isKnownDocumentRejection} from '../design-trace/mutation-result.ts';

export interface ConversationUploadApproval {
 request:ApprovalRequestWork|null;requestId:string;commandHash:string|null;ownerUserId:string;sourceHash:string;
 rejectedRequests?:{command:ApprovalCommand;failure:{code:string;status:number}}[];
}
const same=(a:unknown,b:unknown)=>ordered(a)===ordered(b);
const digest=(v:unknown)=>digestBytes(new TextEncoder().encode(ordered(v)));
function fail(code='CONVERSATION_UPLOAD_APPROVAL_MISMATCH',status=409):never{throw new ApiError(code,status);}
function check(active:()=>boolean){if(!active())fail('CONVERSATION_CONTINUATION_PAUSED',412);}
async function sourceHash(p:ConversationPending){const{uploadApproval:_approval,append:_append,upload,...rest}=p;return digest({...rest,upload:{...upload,approvalRef:null}});}
export function matchesConversationInput(b:ConversationBuffer,p:ConversationPending,s:DocumentSession){
 return b.ownerUserId===s.user.id&&b.ownerClientId===s.clientId&&b.projectId===p.upload.projectId&&b.controlGeneration===p.upload.controlGeneration&&s.clientId===p.upload.clientId&&b.bindingId===p.bindingId&&b.body===p.snapshot.body&&b.kind===p.snapshot.kind&&b.conversationId===p.snapshot.conversationId&&b.headSequence===p.snapshot.headSequence&&same(b.replyTo??null,p.snapshot.replyTo??null)&&same(b.supersedesInstructionRef,p.snapshot.supersedesInstructionRef);
}
async function frozen(b:ConversationBuffer,s:DocumentSession){
 const p=b.pending,c=p?.upload;
 if(!p||!c||!matchesConversationInput(b,p,s)||!b.dirty||!uuid(b.bindingId)||!uuid(p.appendId)||b.result!==null||b.uncertain||b.failure?.code!=='APPROVAL_REQUIRED'||b.failure.status!==412||p.append||p.uploadApproval?.commandHash||p.uploadApproval?.request?.pending||p.uploadApproval?.request?.uncertain||c.schemaVersion!==1||!uuid(c.projectId)||!uuid(c.commandId)||!uuid(c.clientId)||!uuid(s.user.id)||!Number.isSafeInteger(c.controlGeneration)||c.controlGeneration<1||c.operation!=='uploadArtifact'||c.targetId!==null||c.expectedVersion!==0||!same(c.baselineRefs,[])||c.approvalRef!==null||!/^[A-Za-z0-9_-]{43}$/.test(s.csrfToken))fail();
 const bytes=new TextEncoder().encode(p.snapshot.body);if(!p.snapshot.body.isWellFormed()||bytes.length>2*1024*1024||c.payload.mediaType!=='text/plain;charset=utf-8'||!same(c.payload,{bytes:bytes.length,mediaType:'text/plain;charset=utf-8',contentHash:await digestBytes(bytes)}))fail();return structuredClone(c);
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
export async function newConversationUploadApproval(b:ConversationBuffer,s:DocumentSession):Promise<ApprovalRequestWork>{
 const candidate=await frozen(b,s);return{projectId:b.projectId,ownerUserId:s.user.id,ownerClientId:s.clientId,controlGeneration:b.controlGeneration,candidate,details:{reason:'',risks:{data:'',security:'',cost:'',interruption:'',unverified:''},rollback:{method:'',limitations:'',evidenceRefs:[]},expiresAt:''},pending:null,resultId:null,failure:null,uncertain:false,dirty:false};
}
export async function prepareConversationUploadApproval(client:ApiClient,input:ApprovalRequestWork,source:ConversationBuffer,s:DocumentSession,active:()=>boolean):Promise<ApprovalCommand>{
 const b=structuredClone(source),w=structuredClone(input),c=await frozen(b,s);check(active);
 if(w.projectId!==b.projectId||w.ownerUserId!==s.user.id||w.ownerClientId!==s.clientId||w.controlGeneration!==c.controlGeneration||w.pending||w.resultId||!same(w.candidate,c))fail();
 const current=await basis(client,c,s,active),details={...w.details,candidateCommandId:c.commandId,actionScope:await scope(c,s)};check(active);
 if(!validApprovalDetails(details)||Date.parse(details.expiresAt)<=Date.now()||Date.parse(details.expiresAt)>current.expires||/-----BEGIN (?:[A-Z0-9]+ )?PRIVATE KEY-----|\bBearer\s+[A-Za-z0-9._~+\/-]{12,}|\b(?:api[_-]?key|access[_-]?token|secret|password|passwd|token)\s*[=:]\s*\S+/i.test(ordered(details)))fail('APPROVAL_INPUT_INVALID',422);
 return{schemaVersion:1,projectId:b.projectId,commandId:crypto.randomUUID(),clientId:s.clientId,controlGeneration:c.controlGeneration,operation:'requestApproval',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:{details}};
}
export async function bindConversationUploadApproval(client:ApiClient,source:ConversationBuffer,requestId:string,s:DocumentSession,active:()=>boolean):Promise<ConversationBuffer>{
 const b=structuredClone(source),c=await frozen(b,s);check(active);const a=b.pending!.uploadApproval;
 if(!uuid(requestId)||a?.request?.resultId&&a.request.resultId!==requestId)fail();
 const current=await basis(client,c,s,active),view=await readApproval(client,b.projectId,requestId);check(active);const r=view.request,expected=await scope(c,s);check(active);
 if(!same(r.policyRef,current.policyRef)||r.details.candidateCommandId!==c.commandId||!same(r.details.actionScope,expected))fail();
 if(!view.basisCurrent||view.effectiveState!=='APPROVED'||view.expired||view.decision?.decision!=='APPROVE'||view.consumption||Date.parse(r.details.expiresAt)<=Date.now()||Date.parse(r.details.expiresAt)>current.expires)fail('APPROVAL_NOT_USABLE',412);
 const upload={...c,approvalRef:{requestId:r.id,decisionId:view.decision.id,scopeDigest:r.scopeDigest}},commandHash=await digest(upload),snapshotHash=await sourceHash(b.pending!);check(active);
 return{...b,pending:{...b.pending!,upload,uploadApproval:{...a,request:a?.request??null,requestId,commandHash,ownerUserId:s.user.id,sourceHash:snapshotHash}},failure:null};
}
// GET 결박은 허가를 만들지 않는다. 최종 소비/현재 정책/바이트 검사는 파일 API가 다시 집행한다.
export async function validateConversationUploadBinding(p:ConversationPending,s:DocumentSession,active:()=>boolean){
 const a=p.uploadApproval,c=p.upload;check(active);
 if(!a||!c.approvalRef||a.ownerUserId!==s.user.id||a.requestId!==c.approvalRef.requestId||a.request?.pending||a.request?.uncertain||a.commandHash!==await digest(c)||a.sourceHash!==await sourceHash(p))fail();check(active);
}
export async function validateConversationUploadApproval(client:ApiClient,p:ConversationPending,s:DocumentSession,active:()=>boolean){
 await validateConversationUploadBinding(p,s,active);const a=p.uploadApproval!,c=p.upload;
 const current=await basis(client,c,s,active),v=await readApproval(client,c.projectId,a.requestId);check(active);const r=v.request,expected=await scope(c,s);check(active);
 if(!same(r.policyRef,current.policyRef)||r.details.candidateCommandId!==c.commandId||!same(r.details.actionScope,expected)||!same(c.approvalRef,{requestId:r.id,decisionId:v.decision?.id,scopeDigest:r.scopeDigest})||!v.basisCurrent||v.decision?.decision!=='APPROVE')fail();
 if(v.consumption){if(v.effectiveState!=='CONSUMED'||v.consumption.commandId!==c.commandId||v.consumption.requestHash!==a.commandHash)fail();}
 else if(v.effectiveState!=='APPROVED'||v.expired||Date.parse(r.details.expiresAt)<=Date.now()||Date.parse(r.details.expiresAt)>current.expires)fail('APPROVAL_NOT_USABLE',412);
 check(active);
}
export function reopenConversationUploadApproval(b:ConversationBuffer,s:DocumentSession):ConversationBuffer{
 const a=b.pending?.uploadApproval,w=a?.request;
 if(!b.pending||b.uncertain||b.ownerUserId!==s.user.id||b.pending.upload.clientId!==s.clientId||!a||a.commandHash||a.requestId||!w?.pending||w.resultId||w.uncertain||!isKnownDocumentRejection(w.failure))fail();
 return{...b,pending:{...b.pending,uploadApproval:{...a,rejectedRequests:[...(a.rejectedRequests??[]),{command:w.pending,failure:w.failure!}],request:{...w,pending:null,failure:null,uncertain:false,dirty:true}}}};
}
