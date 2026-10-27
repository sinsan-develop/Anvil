import {ApiClient,ApiError} from '../../api/client.ts';
import {stageStartCommand,type StageStartBuffer} from './stage-start-api.ts';
import {documentControl,type DocumentSession} from '../design-trace/editor-api.ts';
import {readCandidatePermissionPolicy} from '../connections/candidate-policy-api.ts';
import {readApproval,validApprovalDetails,type ApprovalRequestWork,type ApprovalCommand,type ApprovalView} from '../decisions/api.ts';
import {ordered} from '../knowledge/review-view.ts';
const same=(a:unknown,b:unknown)=>ordered(a)===ordered(b);
const uuid=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
async function digest(v:unknown){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ordered(v))))].map(n=>n.toString(16).padStart(2,'0')).join('');}
function fail(code='STAGE_START_APPROVAL_MISMATCH',status=409):never{throw new ApiError(code,status);}
function frozen(b:StageStartBuffer,s:DocumentSession){
 const c=b.pending;
 if(!uuid(b.bindingId)||!c||b.uncertain||b.result||b.failure?.code!=='APPROVAL_REQUIRED'||b.failure.status!==412||c.approvalRef!==null||b.stageApproval?.request?.pending||b.stageApproval?.request?.uncertain)fail();
 try{stageStartCommand(b,s);}catch{fail();}return structuredClone(c);
}
function scope(c:ReturnType<typeof frozen>,s:DocumentSession,payloadHash:string){return{operation:c.operation,targetRef:null,expectedVersion:0,payloadHash,baselineRefs:[] as never[],environmentRef:null,sourceScopes:[] as never[],limitsRef:null,requestedSubjectRef:{kind:'HUMAN' as const,userId:s.user.id,clientId:s.clientId},controlGeneration:c.controlGeneration};}
async function basis(client:ApiClient,b:StageStartBuffer,s:DocumentSession,active:()=>boolean){
 const check=()=>{if(!active())fail('STAGE_START_APPROVAL_PAUSED',412);};check();const generation=await documentControl(client,b.projectId,s);check();if(generation!==b.controlGeneration)fail('CONTROL_GENERATION_CONFLICT');
 const policy=await readCandidatePermissionPolicy(client,b.projectId);check();if(!policy)fail('PERMISSION_POLICY_UNCONFIGURED',412);
 const rules=policy.rules.filter(r=>r.subjectRef?.kind==='HUMAN'&&r.subjectRef.userId===s.user.id&&Array.isArray(r.operations)&&r.operations.includes('startStage')&&Array.isArray(r.targetScopes)&&r.targetScopes.some((t:any)=>t?.kind==='PROJECT'&&t.projectId===b.projectId)&&typeof r.expiresAt==='string'&&Date.parse(r.expiresAt)>Date.now());
 if(!rules.length||rules.some(r=>r.disposition==='DENY'))fail('PROJECT_OPERATION_DENIED',403);if(rules.some(r=>r.limitPolicyRef!==null||!['AUTO','REQUIRE_APPROVAL'].includes(r.disposition)))fail('RESPONSE_INVALID',503);if(!rules.some(r=>r.disposition==='REQUIRE_APPROVAL'))fail('APPROVAL_NOT_REQUIRED',422);return{policyRef:policy.ref,expires:Math.min(...rules.map(r=>Date.parse(r.expiresAt)))};
}
export async function newStageStartApproval(b:StageStartBuffer,s:DocumentSession):Promise<ApprovalRequestWork>{
 const candidate=frozen(b,s);return{projectId:b.projectId,ownerUserId:s.user.id,ownerClientId:s.clientId,controlGeneration:b.controlGeneration,candidate,details:{reason:'',risks:{data:'',security:'',cost:'',interruption:'',unverified:''},rollback:{method:'',limitations:'',evidenceRefs:[]},expiresAt:''},pending:null,resultId:null,failure:null,uncertain:false,dirty:false};
}
export async function prepareStageStartApproval(client:ApiClient,input:ApprovalRequestWork,source:StageStartBuffer,s:DocumentSession,active:()=>boolean):Promise<ApprovalCommand>{
 const b=structuredClone(source),w=structuredClone(input),c=frozen(b,s);if(!active())fail('STAGE_START_APPROVAL_PAUSED',412);if(w.projectId!==b.projectId||w.ownerUserId!==s.user.id||w.ownerClientId!==s.clientId||w.controlGeneration!==c.controlGeneration||w.pending||w.resultId||!same(w.candidate,c))fail();const current=await basis(client,b,s,active);
 const details={...w.details,candidateCommandId:c.commandId,actionScope:scope(c,s,await digest(c.payload))};
 if(!validApprovalDetails(details)||Date.parse(details.expiresAt)<=Date.now()||Date.parse(details.expiresAt)>current.expires||/-----BEGIN (?:[A-Z0-9]+ )?PRIVATE KEY-----|\bBearer\s+[A-Za-z0-9._~+\/-]{12,}|\b(?:api[_-]?key|access[_-]?token|secret|password|passwd|token)\s*[=:]\s*\S+/i.test(ordered(details)))fail('APPROVAL_INPUT_INVALID',422);if(!active())fail('STAGE_START_APPROVAL_PAUSED',412);
 return{schemaVersion:1,projectId:b.projectId,commandId:crypto.randomUUID(),clientId:s.clientId,controlGeneration:c.controlGeneration,operation:'requestApproval',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:{details}};
}
export async function bindStageStartApproval(client:ApiClient,source:StageStartBuffer,requestId:string,s:DocumentSession,active:()=>boolean):Promise<StageStartBuffer>{
 const b=structuredClone(source),c=frozen(b,s);if(!uuid(requestId)||b.stageApproval?.request?.resultId&&b.stageApproval.request.resultId!==requestId)fail();const current=await basis(client,b,s,active),view=await readApproval(client,b.projectId,requestId),r=view.request;
 if(!active())fail('STAGE_START_APPROVAL_PAUSED',412);if(!same(r.policyRef,current.policyRef)||r.details.candidateCommandId!==c.commandId||!same(r.details.actionScope,scope(c,s,await digest(c.payload))))fail();
 if(!view.basisCurrent||view.effectiveState!=='APPROVED'||view.expired||view.decision?.decision!=='APPROVE'||view.consumption||Date.parse(r.details.expiresAt)<=Date.now()||Date.parse(r.details.expiresAt)>current.expires)fail('APPROVAL_NOT_USABLE',412);if(!active())fail('STAGE_START_APPROVAL_PAUSED',412);
 const pending={...c,approvalRef:{requestId:r.id,decisionId:view.decision.id,scopeDigest:r.scopeDigest}},commandHash=await digest(pending);if(!active())fail('STAGE_START_APPROVAL_PAUSED',412);
 return{...b,pending,stageApproval:{request:b.stageApproval?.request??null,requestId,commandHash},failure:null};
}
export async function checkStageStartApprovalBinding(b:StageStartBuffer,s:DocumentSession){
 const c=stageStartCommand(b,s),a=b.stageApproval;if(c.approvalRef===null){if(a)fail('STAGE_START_RECONCILIATION_REQUIRED');return;}
 const approval=c.approvalRef as any;if(!a?.commandHash||a.requestId!==approval.requestId||a.commandHash!==await digest(c))fail();
}

export interface StageStartApprovalTermination{commandHash:string;view:ApprovalView}
/** 현재 불확실 명령은 종료할 수 없다. 요청 원후보와 null→승인참조 전이만 대조한다. */
async function terminationCandidate(b:StageStartBuffer,s:DocumentSession){
 const a=b.stageApproval,w=a?.request;
 if(b.uncertain||b.result||!a||!uuid(a.requestId)||!w||w.uncertain||w.pending||w.resultId!==a.requestId||w.projectId!==b.projectId||w.ownerUserId!==s.user.id||w.ownerClientId!==s.clientId||w.controlGeneration!==b.controlGeneration)fail();
 const c=stageStartCommand(b,s);if(!b.pending||!same({...c,approvalRef:null},w.candidate))fail();
 if(c.approvalRef!==null)await checkStageStartApprovalBinding(b,s);return c;
}
export async function readStageStartApprovalTermination(client:ApiClient,source:StageStartBuffer,s:DocumentSession,active:()=>boolean):Promise<StageStartApprovalTermination>{
 const b=structuredClone(source),c=await terminationCandidate(b,s);if(!active())fail('STAGE_START_APPROVAL_PAUSED',412);
 // 로컬 종결은 실행 정책 결박과 다르다. 현재 소유·기기·제어는 그대로 검사한다.
 const generation=await documentControl(client,b.projectId,s);if(!active())fail('STAGE_START_APPROVAL_PAUSED',412);if(generation!==b.controlGeneration)fail('CONTROL_GENERATION_CONFLICT');
 const v=await readApproval(client,b.projectId,b.stageApproval!.requestId),r=v.request;
 if(!active())fail('STAGE_START_APPROVAL_PAUSED',412);
 if(r.details.candidateCommandId!==c.commandId||!same(r.details.actionScope,scope(c,s,await digest(c.payload))))fail();
 if(c.approvalRef!==null&&!same(c.approvalRef,{requestId:r.id,decisionId:v.decision?.id,scopeDigest:r.scopeDigest}))fail();
 // 현재 소유·제어가 같고 정책만 진행한 REVOKED도 불확실성 없는 로컬 종결로 보존한다.
 const rejected=v.effectiveState==='REJECTED'&&v.storedStatus==='REJECTED'&&v.decision?.decision==='REJECT';
 const changed=v.effectiveState==='CHANGE_REQUESTED'&&v.storedStatus==='CHANGE_REQUESTED'&&v.decision?.decision==='REQUEST_CHANGE';
 const expired=v.effectiveState==='EXPIRED'&&v.expired&&['PENDING','APPROVED'].includes(v.storedStatus);
 const revoked=v.effectiveState==='REVOKED'&&!v.basisCurrent&&['PENDING','APPROVED'].includes(v.storedStatus);
 if(v.consumption||!(rejected||changed||expired||revoked))fail('STAGE_START_APPROVAL_NOT_TERMINAL',412);
 if(!active())fail('STAGE_START_APPROVAL_PAUSED',412);return{commandHash:await digest(c),view:v};
}
/** 명시 종료 순간에도 보호 GET과 현재 조건을 재검사한다. 서버 이력/원명령은 삭제하지 않는다. */
export async function closeStageStartApproval(client:ApiClient,source:StageStartBuffer,expected:StageStartApprovalTermination,s:DocumentSession,active:()=>boolean):Promise<StageStartBuffer>{
 const b=structuredClone(source),proof=await readStageStartApprovalTermination(client,b,s,active);
 const stable=(v:ApprovalView)=>({request:v.request,requestRef:v.requestRef,currentVersion:v.currentVersion,storedStatus:v.storedStatus,effectiveState:v.effectiveState,decision:v.decision,consumption:v.consumption,expired:v.expired,basisCurrent:v.basisCurrent});
 if(proof.commandHash!==expected.commandHash||!same(stable(proof.view),stable(expected.view)))fail();if(!active())fail('STAGE_START_APPROVAL_PAUSED',412);
 return{...b,pending:null,stageApproval:undefined,closedStageApprovals:[...(b.closedStageApprovals??[]),{command:structuredClone(b.pending!),request:structuredClone(b.stageApproval!.request!),view:structuredClone(proof.view)}],uncertain:false,failure:null};
}
