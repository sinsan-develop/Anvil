import { ApiClient, ApiError } from '../../api/client.ts';
import { documentControl, type DocumentBuffer, type DocumentSession } from '../design-trace/editor-api.ts';
import { readCandidatePermissionPolicy } from '../connections/candidate-policy-api.ts';
import { readApproval, validApprovalDetails, type ApprovalCommand, type ApprovalRequestWork } from './api.ts';
import { ordered } from '../knowledge/review-view.ts';
import { sourceLinksDigest } from '../design-trace/source-links-api.ts';
const same=(a:unknown,b:unknown)=>ordered(a)===ordered(b);
const uuid=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
function fail(code='APPROVAL_CANDIDATE_MISMATCH',status=409):never{throw new ApiError(code,status);}
function frozen(b:DocumentBuffer,s:DocumentSession){
 const w=b.workPlanState,c=w?.pending;
 if(b.ownerUserId!==s.user.id||!uuid(b.projectId)||!w||!uuid(w.bindingId)||w.sent||w.uncertain||w.result||!c||c.schemaVersion!==1||!uuid(c.commandId)||c.projectId!==b.projectId||c.clientId!==s.clientId||c.controlGeneration!==b.controlGeneration||c.operation!=='saveWorkPlanDraft'||c.targetId!==(w.planRef?.id??null)||c.expectedVersion!==(w.planRef?.version??0)||c.baselineRefs.length||c.approvalRef!==null||!same(c.payload,w.input))fail();
 return structuredClone(c);
}
async function basis(client:ApiClient,b:DocumentBuffer,s:DocumentSession,active:()=>boolean){
 const check=()=>{if(!active())fail('WORK_PLAN_CONTINUATION_PAUSED',412);};check();
 const generation=await documentControl(client,b.projectId,s);check();if(generation!==b.controlGeneration)fail('CONTROL_GENERATION_CONFLICT');
 const policy=await readCandidatePermissionPolicy(client,b.projectId);check();if(!policy)fail('PERMISSION_POLICY_UNCONFIGURED',412);
 const rules=policy.rules.filter(r=>r.subjectRef?.kind==='HUMAN'&&r.subjectRef.userId===s.user.id&&r.operations.includes('saveWorkPlanDraft')&&r.targetScopes.some((t:any)=>t.kind==='PROJECT'&&t.projectId===b.projectId)&&Date.parse(r.expiresAt)>Date.now());
 if(!rules.length||rules.some(r=>r.disposition==='DENY'))fail('PROJECT_OPERATION_DENIED',403);
 if(!rules.some(r=>r.disposition==='REQUIRE_APPROVAL'))fail('APPROVAL_NOT_REQUIRED',422);
 return{policyRef:policy.ref,validUntil:Math.min(...rules.map(r=>Date.parse(r.expiresAt)))};
}
export function newWorkPlanApprovalRequest(b:DocumentBuffer,s:DocumentSession):ApprovalRequestWork{
 const candidate=frozen(b,s);return{projectId:b.projectId,ownerUserId:s.user.id,ownerClientId:s.clientId,controlGeneration:b.controlGeneration,candidate,details:{reason:'',risks:{data:'',security:'',cost:'',interruption:'',unverified:''},rollback:{method:'',limitations:'',evidenceRefs:[]},expiresAt:''},pending:null,resultId:null,failure:null,uncertain:false,dirty:false};
}
async function scope(b:DocumentBuffer,s:DocumentSession){const c=b.workPlanState!.pending!;return{operation:c.operation,targetRef:b.workPlanState!.planRef,expectedVersion:c.expectedVersion,payloadHash:await sourceLinksDigest(c.payload),baselineRefs:[] as never[],environmentRef:null,sourceScopes:[] as never[],limitsRef:null,requestedSubjectRef:{kind:'HUMAN' as const,userId:s.user.id,clientId:s.clientId},controlGeneration:c.controlGeneration};}
export async function prepareWorkPlanApprovalRequest(client:ApiClient,input:ApprovalRequestWork,buffer:DocumentBuffer,s:DocumentSession,active:()=>boolean):Promise<ApprovalCommand>{
 const b=structuredClone(buffer),w=structuredClone(input),c=frozen(b,s);
 if(w.ownerUserId!==s.user.id||w.ownerClientId!==s.clientId||w.projectId!==b.projectId||w.controlGeneration!==c.controlGeneration||w.pending||w.resultId||!same(w.candidate,c))fail();
 const current=await basis(client,b,s,active),details={...w.details,candidateCommandId:c.commandId,actionScope:await scope(b,s)};
 if(!validApprovalDetails(details)||Date.parse(details.expiresAt)<=Date.now()||Date.parse(details.expiresAt)>current.validUntil)fail('APPROVAL_INPUT_INVALID',422);
 const command:ApprovalCommand={schemaVersion:1,projectId:b.projectId,commandId:crypto.randomUUID(),clientId:s.clientId,controlGeneration:b.controlGeneration,operation:'requestApproval',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:{details,candidatePayload:structuredClone(c.payload)}};
 if(new TextEncoder().encode(JSON.stringify(command)).length>2*1024*1024)fail('WORK_PLAN_INPUT_TOO_LARGE',413);
 if(!active())fail('WORK_PLAN_CONTINUATION_PAUSED',412);return command;
}
export async function bindWorkPlanApproval(client:ApiClient,buffer:DocumentBuffer,id:string,s:DocumentSession,active:()=>boolean):Promise<DocumentBuffer>{
 const b=structuredClone(buffer),c=frozen(b,s),current=await basis(client,b,s,active),view=await readApproval(client,b.projectId,id),r=view.request;
 if(!active())fail('WORK_PLAN_CONTINUATION_PAUSED',412);
 if(!same(r.policyRef,current.policyRef)||r.details.candidateCommandId!==c.commandId||!same(r.details.actionScope,await scope(b,s))||!same(view.candidatePlan?.payload,c.payload))fail();
 if(!view.basisCurrent||view.effectiveState!=='APPROVED'||view.expired||view.decision?.decision!=='APPROVE'||view.consumption||Date.parse(r.details.expiresAt)<=Date.now()||Date.parse(r.details.expiresAt)>current.validUntil)fail('APPROVAL_NOT_USABLE',412);
 const pending={...c,approvalRef:{requestId:r.id,decisionId:view.decision.id,scopeDigest:r.scopeDigest}},commandHash=await sourceLinksDigest(pending);
 if(!active())fail('WORK_PLAN_CONTINUATION_PAUSED',412);
 return{...b,workPlanState:{...b.workPlanState!,pending,failure:null,approval:{request:b.workPlanState!.approval?.request??newWorkPlanApprovalRequest(buffer,s),requestId:id,commandHash}}};
}
export async function reopenRejectedWorkPlanApproval(client:ApiClient,buffer:DocumentBuffer,s:DocumentSession,active:()=>boolean):Promise<DocumentBuffer>{
 const b=structuredClone(buffer),c=frozen(b,s),approval=b.workPlanState!.approval;if(!approval?.requestId||approval.request.uncertain||approval.request.pending)fail();
 if(!active())fail('WORK_PLAN_CONTINUATION_PAUSED',412);const view=await readApproval(client,b.projectId,approval.requestId);
 if(!active())fail('WORK_PLAN_CONTINUATION_PAUSED',412);
 if(view.consumption||!['REJECTED','CHANGE_REQUESTED'].includes(view.storedStatus)||view.request.details.candidateCommandId!==c.commandId
 ||!same(view.candidatePlan?.payload,c.payload)||!same(view.request.details.actionScope,await scope(b,s)))fail('APPROVAL_NOT_REJECTED',412);
 return{...b,dirty:true,workPlanState:{...b.workPlanState!,bindingId:crypto.randomUUID(),pending:null,approval:undefined,approvalHistory:[...b.workPlanState!.approvalHistory??[],approval],failure:null,sent:false}};
}
