import {ApiClient,ApiError} from '../../api/client.ts';
import {documentControl,type DocumentBuffer,type DocumentSession,type DocumentWrite} from './editor-api.ts';
import type {UploadDocumentImportBuffer} from './import-api.ts';
import {readCandidatePermissionPolicy} from '../connections/candidate-policy-api.ts';
import {readApproval,validApprovalDetails,type ApprovalRequestWork,type ApprovalCommand} from '../decisions/api.ts';
import {ordered} from '../knowledge/review-view.ts';
import {digestBytes,uuid} from '../project-create/baseline-validation.ts';
import {isKnownDocumentRejection} from './mutation-result.ts';
export interface ImportUploadApproval {request:ApprovalRequestWork|null;requestId:string;commandHash:string|null;ownerUserId:string;sourceHash:string;inputKey:string;rejectedRequests?:{command:ApprovalCommand;failure:{code:string;status:number}}[]}
const same=(a:unknown,b:unknown)=>ordered(a)===ordered(b),digest=(v:unknown)=>digestBytes(new TextEncoder().encode(ordered(v)));
function fail(code='IMPORT_UPLOAD_APPROVAL_MISMATCH',status=409):never{throw new ApiError(code,status);}
function check(active:()=>boolean){if(!active())fail('SAVE_CONTINUATION_PAUSED',412);}
export function importApprovalInputKey(b:DocumentBuffer){return ordered({ownerUserId:b.ownerUserId,projectId:b.projectId,documentId:b.documentId,baseVersion:b.baseVersion,baseHash:b.baseHash??null,controlGeneration:b.controlGeneration,formRef:b.formRef,title:b.title,body:b.body,mediaType:b.mediaType,content:b.content,reason:b.reason,stageNodeRef:b.stageNodeRef??null});}
export function matchesImportApprovalInput(b:DocumentBuffer,s:DocumentSession){const p=b.importState;if(!p||p.source==='CREATED_ORIGINAL')return false;const c=p.upload,t=p.attachmentTarget;return b.ownerUserId===s.user.id&&p.ownerUserId===s.user.id&&b.projectId===c.projectId&&b.controlGeneration===c.controlGeneration&&s.clientId===c.clientId&&!b.pending&&!b.importPreparationId&&!b.importCandidateRef&&!b.proposalState&&!b.designIndexState&&!b.workPlanState&&!b.designDependencyState&&!b.formEntry&&(t?b.documentId===t.id&&b.baseVersion===t.version&&b.baseHash===t.contentHash:b.documentId===null&&b.baseVersion===0)&&(!p.uploadApproval||p.uploadApproval.inputKey===importApprovalInputKey(b));}
async function sourceHash(p:UploadDocumentImportBuffer){return digest({ownerUserId:p.ownerUserId,name:p.name,bytes:Array.from(p.bytes),recordCommandId:p.recordCommandId,attachmentTarget:p.attachmentTarget??null,upload:{...p.upload,approvalRef:null}});}
async function frozen(b:DocumentBuffer,s:DocumentSession){
 const p=b.importState,c=p?.upload;
 if(!p||p.source==='CREATED_ORIGINAL'||!c||!matchesImportApprovalInput(b,s)||!p.attempted||p.uncertain||p.failure?.code!=='APPROVAL_REQUIRED'||p.failure.status!==412||p.record||p.candidate||p.uploadApproval?.commandHash||p.uploadApproval?.request?.pending||p.uploadApproval?.request?.uncertain||c.schemaVersion!==1||!uuid(c.projectId)||!uuid(c.commandId)||!uuid(p.recordCommandId)||!uuid(c.clientId)||!uuid(s.user.id)||!Number.isSafeInteger(c.controlGeneration)||c.controlGeneration<1||c.operation!=='uploadArtifact'||c.targetId!==null||c.expectedVersion!==0||!same(c.baselineRefs,[])||c.approvalRef!==null||!/^[A-Za-z0-9_-]{43}$/.test(s.csrfToken))fail();
 if(p.bytes.length>20*1024*1024||!['text/plain;charset=utf-8','text/markdown;charset=utf-8','application/octet-stream','image/png'].includes(String(c.payload.mediaType))||!same(c.payload,{bytes:p.bytes.length,mediaType:c.payload.mediaType,contentHash:await digestBytes(p.bytes)}))fail();return structuredClone(c);
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
export async function newImportUploadApproval(b:DocumentBuffer,s:DocumentSession):Promise<ApprovalRequestWork>{const candidate=await frozen(b,s);return{projectId:b.projectId,ownerUserId:s.user.id,ownerClientId:s.clientId,controlGeneration:b.controlGeneration,candidate,details:{reason:'',risks:{data:'',security:'',cost:'',interruption:'',unverified:''},rollback:{method:'',limitations:'',evidenceRefs:[]},expiresAt:''},pending:null,resultId:null,failure:null,uncertain:false,dirty:false};}
export async function prepareImportUploadApproval(client:ApiClient,input:ApprovalRequestWork,source:DocumentBuffer,s:DocumentSession,active:()=>boolean):Promise<ApprovalCommand>{
 const b=structuredClone(source),w=structuredClone(input),c=await frozen(b,s);check(active);
 if(w.projectId!==b.projectId||w.ownerUserId!==s.user.id||w.ownerClientId!==s.clientId||w.controlGeneration!==c.controlGeneration||w.pending||w.resultId||!same(w.candidate,c))fail();
 const current=await basis(client,c,s,active),details={...w.details,candidateCommandId:c.commandId,actionScope:await scope(c,s)};check(active);
 if(!validApprovalDetails(details)||Date.parse(details.expiresAt)<=Date.now()||Date.parse(details.expiresAt)>current.expires||/-----BEGIN (?:[A-Z0-9]+ )?PRIVATE KEY-----|\bBearer\s+[A-Za-z0-9._~+\/-]{12,}|\b(?:api[_-]?key|access[_-]?token|secret|password|passwd|token)\s*[=:]\s*\S+/i.test(ordered(details)))fail('APPROVAL_INPUT_INVALID',422);
 return{schemaVersion:1,projectId:b.projectId,commandId:crypto.randomUUID(),clientId:s.clientId,controlGeneration:c.controlGeneration,operation:'requestApproval',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:{details}};
}
export async function bindImportUploadApproval(client:ApiClient,source:DocumentBuffer,requestId:string,s:DocumentSession,active:()=>boolean):Promise<DocumentBuffer>{
 let b=structuredClone(source);const initial=b.importState;
 if(initial&&initial.source!=='CREATED_ORIGINAL'&&initial.upload.approvalRef){await validateImportUploadBinding(initial,b.formRef,s,active);if(initial.uncertain||initial.record||initial.candidate)fail();b={...b,importState:{...initial,upload:{...initial.upload,approvalRef:null},uploadApproval:{...initial.uploadApproval!,commandHash:null},failure:{code:'APPROVAL_REQUIRED',status:412}}};}
 const c=await frozen(b,s);check(active);const p=b.importState as UploadDocumentImportBuffer,a=p.uploadApproval;
 if(!uuid(requestId)||a?.request?.resultId&&a.request.resultId!==requestId)fail();
 const current=await basis(client,c,s,active),view=await readApproval(client,b.projectId,requestId);check(active);const r=view.request,expected=await scope(c,s);check(active);
 if(!same(r.policyRef,current.policyRef)||r.details.candidateCommandId!==c.commandId||!same(r.details.actionScope,expected))fail();
 if(!view.basisCurrent||view.effectiveState!=='APPROVED'||view.expired||view.decision?.decision!=='APPROVE'||view.consumption||Date.parse(r.details.expiresAt)<=Date.now()||Date.parse(r.details.expiresAt)>current.expires)fail('APPROVAL_NOT_USABLE',412);
 const upload={...c,approvalRef:{requestId:r.id,decisionId:view.decision.id,scopeDigest:r.scopeDigest}},commandHash=await digest(upload),snapshotHash=await sourceHash(p);check(active);
 return{...b,importState:{...p,upload,uploadApproval:{...a,request:a?.request??null,requestId,commandHash,ownerUserId:s.user.id,sourceHash:snapshotHash,inputKey:importApprovalInputKey(b)},failure:null}};
}
export async function validateImportUploadBinding(p:UploadDocumentImportBuffer,formRef:DocumentBuffer['formRef'],s:DocumentSession,active:()=>boolean){
 const a=p.uploadApproval,c=p.upload;check(active);
 if(!a||!c.approvalRef||a.ownerUserId!==s.user.id||a.requestId!==c.approvalRef.requestId||a.request?.pending||a.request?.uncertain||a.commandHash!==await digest(c)||a.sourceHash!==await sourceHash(p)||!same(JSON.parse(a.inputKey).formRef,formRef))fail();check(active);
}
export async function validateImportUploadApproval(client:ApiClient,p:UploadDocumentImportBuffer,formRef:DocumentBuffer['formRef'],s:DocumentSession,active:()=>boolean){
 await validateImportUploadBinding(p,formRef,s,active);const a=p.uploadApproval!,c=p.upload;
 const current=await basis(client,c,s,active),v=await readApproval(client,c.projectId,a.requestId);check(active);const r=v.request,expected=await scope(c,s);check(active);
 if(!same(r.policyRef,current.policyRef)||r.details.candidateCommandId!==c.commandId||!same(r.details.actionScope,expected)||!same(c.approvalRef,{requestId:r.id,decisionId:v.decision?.id,scopeDigest:r.scopeDigest})||!v.basisCurrent||v.decision?.decision!=='APPROVE')fail();
 if(v.consumption){if(v.effectiveState!=='CONSUMED'||v.consumption.commandId!==c.commandId||v.consumption.requestHash!==a.commandHash)fail();}
 else if(v.effectiveState!=='APPROVED'||v.expired||Date.parse(r.details.expiresAt)<=Date.now()||Date.parse(r.details.expiresAt)>current.expires)fail('APPROVAL_NOT_USABLE',412);check(active);
}
export function reopenImportUploadApproval(b:DocumentBuffer,s:DocumentSession):DocumentBuffer{
 const p=b.importState;if(!p||p.source==='CREATED_ORIGINAL')fail();const a=p.uploadApproval,w=a?.request;
 if(p.uncertain||!matchesImportApprovalInput(b,s)||!a||a.commandHash||a.requestId||!w?.pending||w.resultId||w.uncertain||!isKnownDocumentRejection(w.failure))fail();
 return{...b,importState:{...p,uploadApproval:{...a,rejectedRequests:[...(a.rejectedRequests??[]),{command:w.pending,failure:w.failure!}],request:{...w,pending:null,failure:null,uncertain:false,dirty:true}}}};
}
