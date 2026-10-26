import {ApiClient,ApiError} from '../../api/client.ts';
import {documentControl,type DocumentSession} from '../design-trace/editor-api.ts';
import {readCandidatePermissionPolicy} from '../connections/candidate-policy-api.ts';
import {readApproval,validApprovalDetails,type ApprovalRequestWork,type ApprovalCommand} from '../decisions/api.ts';
import {browserCanonical,wireHash} from '../control-handoff/api.ts';
import {exportDocument,exportPendingMatches,selectionValid,bindExportApprovalCommand,type ExportPending} from './project-backups-api.ts';
const same=(a:unknown,b:unknown)=>browserCanonical(a)===browserCanonical(b);
function fail(code='APPROVAL_CANDIDATE_MISMATCH',status=409):never{throw new ApiError(code,status);}
function candidate(p:ExportPending,s:DocumentSession){
 const c=p.command;if(!exportPendingMatches(p,p.api,s,p.projectId)||p.receipt||p.accessLost||p.dispatchState!=='REQUIRED'||c.schemaVersion!==1||c.operation!=='exportProject'||c.projectId!==p.projectId||c.clientId!==s.clientId||c.targetId!==null||c.expectedVersion!==0||c.baselineRefs.length||c.approvalRef!==null||c.payload.includeSource!==false||!selectionValid(c.payload.selection)||typeof c.payload.reason!=='string'||!c.payload.reason.trim()||browserCanonical(c)!==p.body)fail();return c;
}
async function actionScope(p:ExportPending,s:DocumentSession){const c=candidate(p,s);return{operation:'exportProject',targetRef:null,expectedVersion:0,payloadHash:await wireHash(c.payload),baselineRefs:[] as never[],environmentRef:null,sourceScopes:[] as never[],limitsRef:null,requestedSubjectRef:{kind:'HUMAN' as const,userId:s.user.id,clientId:s.clientId},controlGeneration:c.controlGeneration};}
async function basis(api:ApiClient,p:ExportPending,s:DocumentSession,active:()=>boolean){
 const check=()=>{if(!active()||!exportPendingMatches(p,api,s,p.projectId))fail('EXPORT_CONTEXT_CHANGED',412);};check();const c=candidate(p,s),generation=await documentControl(api,p.projectId,s);check();if(generation!==c.controlGeneration)fail('CONTROL_GENERATION_CONFLICT');
 const policy=await readCandidatePermissionPolicy(api,p.projectId);check();if(!policy)fail('PERMISSION_POLICY_UNCONFIGURED',412);
 const rules=policy.rules.filter(r=>r.subjectRef?.kind==='HUMAN'&&r.subjectRef.userId===s.user.id&&Array.isArray(r.operations)&&r.operations.includes('exportProject')&&Array.isArray(r.targetScopes)&&r.targetScopes.some((t:any)=>t?.kind==='PROJECT'&&t.projectId===p.projectId)&&typeof r.expiresAt==='string'&&Date.parse(r.expiresAt)>Date.now());
 if(!rules.length||rules.some(r=>r.disposition==='DENY'))fail('PROJECT_OPERATION_DENIED',403);
 if(rules.some(r=>r.limitPolicyRef!==null||!['AUTO','REQUIRE_APPROVAL'].includes(r.disposition)))fail('RESPONSE_INVALID',503);
 if(!rules.some(r=>r.disposition==='REQUIRE_APPROVAL'))fail('APPROVAL_NOT_REQUIRED',422);
 const selection=c.payload.selection as import('./project-backups-api.ts').ExportSelection,d=await exportDocument(api,p.projectId,selection.documentRef.id,selection.documentRef.version);check();if(!same(d.ref,selection.documentRef)||!d.artifacts.some(a=>same(a.ref,selection.artifactRef)))fail('APPROVAL_TARGET_CHANGED');
 return{policyRef:policy.ref,validUntil:Math.min(...rules.map(r=>Date.parse(r.expiresAt)))};
}
export function newExportApprovalRequest(p:ExportPending,s:DocumentSession):ApprovalRequestWork{const c=candidate(p,s);return{projectId:p.projectId,ownerUserId:s.user.id,ownerClientId:s.clientId,controlGeneration:c.controlGeneration,candidate:structuredClone(c),details:{reason:'',risks:{data:'',security:'',cost:'',interruption:'',unverified:''},rollback:{method:'',limitations:'',evidenceRefs:[]},expiresAt:''},pending:null,resultId:null,failure:null,uncertain:false,dirty:false};}
export async function prepareExportApprovalRequest(api:ApiClient,w:ApprovalRequestWork,p:ExportPending,s:DocumentSession,active:()=>boolean):Promise<ApprovalCommand>{
 const c=candidate(p,s),input=structuredClone(w);if(input.pending||input.resultId||input.uncertain||input.projectId!==p.projectId||input.ownerUserId!==s.user.id||input.ownerClientId!==s.clientId||input.controlGeneration!==c.controlGeneration||!same(input.candidate,c))fail();
 const current=await basis(api,p,s,active),details={...input.details,candidateCommandId:c.commandId,actionScope:await actionScope(p,s)};
 if(!validApprovalDetails(details)||Date.parse(details.expiresAt)<=Date.now()||Date.parse(details.expiresAt)>current.validUntil||/-----BEGIN (?:[A-Z0-9]+ )?PRIVATE KEY-----|\bBearer\s+[A-Za-z0-9._~+\/-]{12,}|\b(?:api[_-]?key|access[_-]?token|secret|password|passwd|token)\s*[=:]\s*\S+/i.test(browserCanonical(details)))fail('APPROVAL_INPUT_INVALID',422);
 if(!active())fail('EXPORT_CONTEXT_CHANGED',412);
 return{schemaVersion:1,projectId:p.projectId,commandId:crypto.randomUUID(),clientId:s.clientId,controlGeneration:c.controlGeneration,operation:'requestApproval',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:{details}};
}
export async function bindExportApproval(api:ApiClient,p:ExportPending,requestId:string,s:DocumentSession,active:()=>boolean):Promise<ExportPending>{
 const c=candidate(p,s),current=await basis(api,p,s,active),view=await readApproval(api,p.projectId,requestId);if(!active())fail('EXPORT_CONTEXT_CHANGED',412);
 const r=view.request,scope=await actionScope(p,s);if(!active())fail('EXPORT_CONTEXT_CHANGED',412);
 if(!same(r.policyRef,current.policyRef)||r.details.candidateCommandId!==c.commandId||!same(r.details.actionScope,scope))fail();
 if(!view.basisCurrent||view.effectiveState!=='APPROVED'||view.expired||view.decision?.decision!=='APPROVE'||view.consumption||Date.parse(r.details.expiresAt)<=Date.now()||Date.parse(r.details.expiresAt)>current.validUntil)fail('APPROVAL_NOT_USABLE',412);
 if(!active())fail('EXPORT_CONTEXT_CHANGED',412);return bindExportApprovalCommand(p,{requestId:r.id,decisionId:view.decision.id,scopeDigest:r.scopeDigest});
}
