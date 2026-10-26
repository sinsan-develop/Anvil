import {ApiClient,ApiError} from '../../api/client.ts';
import {recheckBaselineCommand,type BaselineBuffer} from './baseline-api.ts';
import {digestBytes,exact,same,uuid} from './baseline-validation.ts';
import {documentControl,type DocumentSession} from '../design-trace/editor-api.ts';
import {readCandidatePermissionPolicy} from '../connections/candidate-policy-api.ts';
import {readApproval,validApprovalDetails,type ApprovalRequestWork,type ApprovalCommand} from '../decisions/api.ts';
import {ordered} from '../knowledge/review-view.ts';
import {isKnownDocumentRejection} from '../design-trace/mutation-result.ts';
const digest=(v:unknown)=>digestBytes(new TextEncoder().encode(ordered(v)));
export function releaseRejectedBaselineApproval(b:BaselineBuffer,s:DocumentSession):BaselineBuffer{
 const a=b.baselineApproval,w=a?.request;if(b.ownerUserId!==s.user.id||b.ownerClientId!==s.clientId||b.uncertain||!b.pending||b.upload||b.pending.approvalRef!==null||!a||a.commandHash||a.requestId||!w||w.resultId||w.uncertain||!w.pending||!w.failure||!isKnownDocumentRejection(w.failure)||!same(w.candidate,b.pending))fail('BASELINE_RECONCILIATION_REQUIRED');
 return{...b,baselineApproval:{...a,rejectedRequests:[...(a.rejectedRequests??[]),{command:structuredClone(w.pending),failure:{...w.failure}}],request:{...w,pending:null,failure:null,uncertain:false,dirty:true}}};
}
function fail(code='BASELINE_APPROVAL_MISMATCH',status=409):never{throw new ApiError(code,status);}
async function frozen(b:BaselineBuffer,s:DocumentSession){
 const c=b.pending;
 if(![b.projectId,b.bindingId,s.user.id,s.clientId].every(uuid)||b.ownerUserId!==s.user.id||b.ownerClientId!==s.clientId||b.uncertain||b.failure?.code!=='APPROVAL_REQUIRED'||b.failure.status!==412||!c||b.upload||!uuid(c.commandId)||c.schemaVersion!==1||c.projectId!==b.projectId||c.clientId!==s.clientId||!Number.isSafeInteger(b.controlGeneration)||b.controlGeneration<1||c.controlGeneration!==b.controlGeneration||!['saveBaselineDraft','reviewBaselineContent','confirmBaseline'].includes(c.operation)||c.approvalRef!==null||c.baselineRefs.length||b.baselineApproval?.request?.pending||b.baselineApproval?.request?.uncertain||!/^[A-Za-z0-9_-]{43}$/.test(s.csrfToken))fail();
 recheckBaselineCommand(b,s);return structuredClone(c);
}
async function basis(client:ApiClient,b:BaselineBuffer,s:DocumentSession,active:()=>boolean){
 const check=()=>{if(!active())fail('BASELINE_APPROVAL_PAUSED',412);};check();const generation=await documentControl(client,b.projectId,s);check();if(generation!==b.controlGeneration)fail('CONTROL_GENERATION_CONFLICT');
 const policy=await readCandidatePermissionPolicy(client,b.projectId);check();if(!policy)fail('PERMISSION_POLICY_UNCONFIGURED',412);
 const rules=policy.rules.filter(r=>r.subjectRef?.kind==='HUMAN'&&r.subjectRef.userId===s.user.id&&Array.isArray(r.operations)&&r.operations.includes(b.pending!.operation)&&Array.isArray(r.targetScopes)&&r.targetScopes.some((t:any)=>t?.kind==='PROJECT'&&t.projectId===b.projectId)&&typeof r.expiresAt==='string'&&Date.parse(r.expiresAt)>Date.now());
 if(!rules.length||rules.some(r=>r.disposition==='DENY'))fail('PROJECT_OPERATION_DENIED',403);if(rules.some(r=>r.limitPolicyRef!==null||!['AUTO','REQUIRE_APPROVAL'].includes(r.disposition)))fail('RESPONSE_INVALID',503);if(!rules.some(r=>r.disposition==='REQUIRE_APPROVAL'))fail('APPROVAL_NOT_REQUIRED',422);return{policyRef:policy.ref,expires:Math.min(...rules.map(r=>Date.parse(r.expiresAt)))};
}
export async function newBaselineApproval(b:BaselineBuffer,s:DocumentSession):Promise<ApprovalRequestWork>{
 const candidate=await frozen(b,s);return{projectId:b.projectId,ownerUserId:s.user.id,ownerClientId:s.clientId,controlGeneration:b.controlGeneration,candidate,details:{reason:'',risks:{data:'',security:'',cost:'',interruption:'',unverified:''},rollback:{method:'',limitations:'',evidenceRefs:[]},expiresAt:''},pending:null,resultId:null,failure:null,uncertain:false,dirty:false};
}
export async function prepareBaselineApproval(client:ApiClient,input:ApprovalRequestWork,source:BaselineBuffer,s:DocumentSession,active:()=>boolean):Promise<ApprovalCommand>{
 const b=structuredClone(source),w=structuredClone(input),c=await frozen(b,s);if(!active())fail('BASELINE_APPROVAL_PAUSED',412);if(w.projectId!==b.projectId||w.ownerUserId!==s.user.id||w.ownerClientId!==s.clientId||w.controlGeneration!==c.controlGeneration||w.pending||w.resultId||!same(w.candidate,c))fail();const current=await basis(client,b,s,active);
 const details={...w.details,candidateCommandId:c.commandId,actionScope:{operation:c.operation,targetRef:((c.operation==='saveBaselineDraft'?c.payload.baseRef:c.payload.draftRef)??null) as any,expectedVersion:c.expectedVersion,payloadHash:await digest(c.payload),baselineRefs:[] as never[],environmentRef:null,sourceScopes:[] as never[],limitsRef:null,requestedSubjectRef:{kind:'HUMAN' as const,userId:s.user.id,clientId:s.clientId},controlGeneration:c.controlGeneration}};
 if(!validApprovalDetails(details)||Date.parse(details.expiresAt)<=Date.now()||Date.parse(details.expiresAt)>current.expires||/-----BEGIN (?:[A-Z0-9]+ )?PRIVATE KEY-----|\bBearer\s+[A-Za-z0-9._~+\/-]{12,}|\b(?:api[_-]?key|access[_-]?token|secret|password|passwd|token)\s*[=:]\s*\S+/i.test(ordered(details)))fail('APPROVAL_INPUT_INVALID',422);if(!active())fail('BASELINE_APPROVAL_PAUSED',412);
 return{schemaVersion:1,projectId:b.projectId,commandId:crypto.randomUUID(),clientId:s.clientId,controlGeneration:c.controlGeneration,operation:'requestApproval',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:{details}};
}
export async function bindBaselineApproval(client:ApiClient,source:BaselineBuffer,requestId:string,s:DocumentSession,active:()=>boolean):Promise<BaselineBuffer>{
 const b=structuredClone(source),c=await frozen(b,s);if(!uuid(requestId)||b.baselineApproval?.request?.resultId&&b.baselineApproval.request.resultId!==requestId)fail();const current=await basis(client,b,s,active),view=await readApproval(client,b.projectId,requestId),r=view.request;
 if(!active())fail('BASELINE_APPROVAL_PAUSED',412);if(!same(r.policyRef,current.policyRef)||r.details.candidateCommandId!==c.commandId||!same(r.details.actionScope,{operation:c.operation,targetRef:((c.operation==='saveBaselineDraft'?c.payload.baseRef:c.payload.draftRef)??null) as any,expectedVersion:c.expectedVersion,payloadHash:await digest(c.payload),baselineRefs:[],environmentRef:null,sourceScopes:[],limitsRef:null,requestedSubjectRef:{kind:'HUMAN',userId:s.user.id,clientId:s.clientId},controlGeneration:c.controlGeneration}))fail();
 if(!view.basisCurrent||view.effectiveState!=='APPROVED'||view.expired||view.decision?.decision!=='APPROVE'||view.consumption||Date.parse(r.details.expiresAt)<=Date.now()||Date.parse(r.details.expiresAt)>current.expires)fail('APPROVAL_NOT_USABLE',412);if(!active())fail('BASELINE_APPROVAL_PAUSED',412);
 const pending={...c,approvalRef:{requestId:r.id,decisionId:view.decision.id,scopeDigest:r.scopeDigest}},commandHash=await digest(pending);if(!active())fail('BASELINE_APPROVAL_PAUSED',412);
 const baselineApproval={...b.baselineApproval,request:b.baselineApproval?.request??null,requestId,commandHash};
 return{...b,pending,baselineApproval,rejectedCommands:[...b.rejectedCommands,{command:structuredClone(c),failure:{code:'APPROVAL_REQUIRED',status:412},baselineApproval:structuredClone(baselineApproval)}],failure:null};
}

/** 명시 결박 뒤의 전송은 저장된 정확 원명령 digest와 함께 대조한다. */
export async function checkBaselineApprovalBinding(b:BaselineBuffer,s:DocumentSession):Promise<void>{
 const c=recheckBaselineCommand(b,s),a=b.baselineApproval;
 if(c.approvalRef===null){if(a)fail('BASELINE_RECONCILIATION_REQUIRED');return;}
 if(!a||!a.commandHash||a.requestId!==c.approvalRef.requestId||a.commandHash!==await digest(c))fail();
}
