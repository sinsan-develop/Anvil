import type {ApprovalDetails} from '../../../../server/modules/approvals/approval-input.ts';
import {ApiClient,ApiError} from '../../api/client.ts';
import {browserCanonical as canonical,wireHash,uuid,ref as validRef,type ControlRef as Ref} from '../control-handoff/api.ts';
import {documentControl,type DocumentSession,type DocumentWrite} from '../design-trace/editor-api.ts';
import {sourceLinkOwned,replaceSourceLinkPending,type SourceLinkBuffer} from '../design-trace/source-link-command-api.ts';
import {readSourceLinks} from '../design-trace/source-links-api.ts';
import {readCandidatePermissionPolicy} from '../connections/candidate-policy-api.ts';
import {readApproval,validApprovalDetails,type ApprovalRequestWork,type ApprovalCommand} from './api.ts';
const same=(a:unknown,b:unknown)=>canonical(a)===canonical(b);
function fail(code='APPROVAL_CANDIDATE_MISMATCH',status=409):never{throw new ApiError(code,status);}
function candidate(api:ApiClient,b:SourceLinkBuffer,s:DocumentSession){
 const p=b.pending;if(!sourceLinkOwned(b,api,s,b.projectId)||!p||!['PREPARED','REQUIRED'].includes(p.state)||p.result||p.command.approvalRef!==null||p.command.operation!==b.operation||p.body!==canonical(p.command)||p.command.projectId!==b.projectId||p.command.clientId!==s.clientId||!same(p.command.payload,b.payload))fail('DOCUMENT_SOURCE_COMMAND_PRESERVED',412);return structuredClone(p.command);
}
function target(b:SourceLinkBuffer):Ref|null{if(b.operation==='linkDocumentSource')return null;if(!validRef(b.payload.sourceLinkRef))fail();return structuredClone(b.payload.sourceLinkRef);}
async function basis(api:ApiClient,b:SourceLinkBuffer,s:DocumentSession,active:()=>boolean){
 const check=()=>{if(!active()||!sourceLinkOwned(b,api,s,b.projectId))fail('DOCUMENT_SOURCE_CONTEXT_CHANGED',412);};check();const c=candidate(api,b,s),generation=await documentControl(api,b.projectId,s);check();if(generation!==c.controlGeneration)fail('CONTROL_GENERATION_CONFLICT');
 const policy=await readCandidatePermissionPolicy(api,b.projectId);check();if(!policy)fail('PERMISSION_POLICY_UNCONFIGURED',412);
 const rules=policy.rules.filter(r=>r.subjectRef?.kind==='HUMAN'&&r.subjectRef.userId===s.user.id&&Array.isArray(r.operations)&&r.operations.includes(c.operation)&&Array.isArray(r.targetScopes)&&r.targetScopes.some((t:Record<string,unknown>)=>t?.kind==='PROJECT'&&t.projectId===b.projectId)&&typeof r.expiresAt==='string'&&Date.parse(r.expiresAt)>Date.now());
 if(!rules.length||rules.some(r=>r.disposition==='DENY'))fail('PROJECT_OPERATION_DENIED',403);if(rules.some(r=>r.limitPolicyRef!==null||!['AUTO','REQUIRE_APPROVAL'].includes(r.disposition)))fail('RESPONSE_INVALID',503);if(!rules.some(r=>r.disposition==='REQUIRE_APPROVAL'))fail('APPROVAL_NOT_REQUIRED',422);
 if(b.operation==='proposeDocumentSourceChange'){const links=await readSourceLinks(api,b.projectId,b.documentRef,active);check();if(!links.items.some(x=>x.rawAllowed&&x.state==='ACTIVE'&&same(x.ref,b.payload.sourceLinkRef)))fail('APPROVAL_TARGET_CHANGED');}
 if(await wireHash(c)!==b.pending!.hash)fail();check();return{c,policyRef:policy.ref,until:Math.min(...rules.map(r=>Date.parse(r.expiresAt)))};
}
export function newSourceLinkApprovalRequest(api:ApiClient,b:SourceLinkBuffer,s:DocumentSession):ApprovalRequestWork{
 const c=candidate(api,b,s);return{projectId:b.projectId,ownerUserId:s.user.id,ownerClientId:s.clientId,controlGeneration:c.controlGeneration,candidate:c,details:{reason:'',risks:{data:'',security:'',cost:'',interruption:'',unverified:''},rollback:{method:'',limitations:'',evidenceRefs:[]},expiresAt:''},pending:null,resultId:null,failure:null,uncertain:false,dirty:false};
}
export async function prepareSourceLinkApprovalRequest(api:ApiClient,input:ApprovalRequestWork,b:SourceLinkBuffer,s:DocumentSession,active:()=>boolean):Promise<ApprovalCommand>{
 const w=structuredClone(input),{c,until}=await basis(api,b,s,active);
 if(w.ownerUserId!==s.user.id||w.ownerClientId!==s.clientId||w.projectId!==b.projectId||w.controlGeneration!==c.controlGeneration||w.pending||w.resultId||!same(w.candidate,c))fail();
 const details:ApprovalDetails={...w.details,candidateCommandId:c.commandId,actionScope:{operation:c.operation,targetRef:target(b),expectedVersion:c.expectedVersion,payloadHash:await wireHash(c.payload),baselineRefs:[],environmentRef:null,sourceScopes:[],limitsRef:null,requestedSubjectRef:{kind:'HUMAN',userId:s.user.id,clientId:s.clientId},controlGeneration:c.controlGeneration}};
 if(!validApprovalDetails(details)||Date.parse(details.expiresAt)<=Date.now()||Date.parse(details.expiresAt)>until||/-----BEGIN (?:[A-Z0-9]+ )?PRIVATE KEY-----|\bBearer\s+[A-Za-z0-9._~+\/-]{12,}|\b(?:api[_-]?key|access[_-]?token|secret|password|passwd|token)\s*[=:]\s*\S+/i.test(canonical(details)))fail('APPROVAL_INPUT_INVALID',422);
 if(!active())fail('DOCUMENT_SOURCE_CONTEXT_CHANGED',412);return{schemaVersion:1,projectId:b.projectId,commandId:crypto.randomUUID(),clientId:s.clientId,controlGeneration:c.controlGeneration,operation:'requestApproval',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:{details}};
}
export async function bindSourceLinkApproval(api:ApiClient,b:SourceLinkBuffer,requestId:string,s:DocumentSession,active:()=>boolean){
 if(!uuid(requestId))fail();const {c,policyRef,until}=await basis(api,b,s,active),view=await readApproval(api,b.projectId,requestId);if(!active())fail('DOCUMENT_SOURCE_CONTEXT_CHANGED',412);
 const r=view.request,expected={operation:c.operation,targetRef:target(b),expectedVersion:c.expectedVersion,payloadHash:await wireHash(c.payload),baselineRefs:[],environmentRef:null,sourceScopes:[],limitsRef:null,requestedSubjectRef:{kind:'HUMAN',userId:s.user.id,clientId:s.clientId},controlGeneration:c.controlGeneration};
 if(!same(r.policyRef,policyRef)||r.details.candidateCommandId!==c.commandId||!same(r.details.actionScope,expected)||!view.basisCurrent||view.effectiveState!=='APPROVED'||view.expired||view.decision?.decision!=='APPROVE'||view.consumption||Date.parse(r.details.expiresAt)<=Date.now()||Date.parse(r.details.expiresAt)>until)fail('APPROVAL_NOT_USABLE',412);
 const command:DocumentWrite={...c,approvalRef:{requestId:r.id,decisionId:view.decision.id,scopeDigest:r.scopeDigest}},hash=await wireHash(command);if(!active())fail('DOCUMENT_SOURCE_CONTEXT_CHANGED',412);return replaceSourceLinkPending(b,command,hash);
}
