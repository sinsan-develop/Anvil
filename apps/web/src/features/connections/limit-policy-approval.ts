import {ApiClient,ApiError} from '../../api/client.ts';
import {limitCommand,limitPolicyAccess,type LimitBuffer} from './limit-policy-api.ts';
import {documentControl,type DocumentSession} from '../design-trace/editor-api.ts';
import {readApproval,validApprovalDetails,type ApprovalRequestWork,type ApprovalCommand,type ApprovalView} from '../decisions/api.ts';
import {ordered} from '../knowledge/review-view.ts';
const same=(a:unknown,b:unknown)=>ordered(a)===ordered(b);
const uuid=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
async function digest(v:unknown){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ordered(v))))].map(n=>n.toString(16).padStart(2,'0')).join('');}
function fail(code='LIMIT_POLICY_APPROVAL_MISMATCH',status=409):never{throw new ApiError(code,status);}
async function frozen(b:LimitBuffer,s:DocumentSession){
 const c=b.pending;
 if(!uuid(b.bufferId)||!c||b.uncertain||b.result||b.failure?.code!=='APPROVAL_REQUIRED'||b.failure.status!==412||c.approvalRef!==null||b.limitApproval?.request?.pending||b.limitApproval?.request?.uncertain)fail();
 try{await limitCommand(b,s);}catch{fail();}return structuredClone(c);
}
function scope(b:LimitBuffer,c:Awaited<ReturnType<typeof frozen>>,s:DocumentSession,payloadHash:string){return{operation:c.operation,targetRef:b.base?.ref??null,expectedVersion:c.expectedVersion,payloadHash,baselineRefs:[] as never[],environmentRef:null,sourceScopes:[] as never[],limitsRef:null,requestedSubjectRef:{kind:'HUMAN' as const,userId:s.user.id,clientId:s.clientId},controlGeneration:c.controlGeneration};}
async function basis(client:ApiClient,b:LimitBuffer,s:DocumentSession,active:()=>boolean){
 const check=()=>{if(!active())fail('LIMIT_POLICY_APPROVAL_PAUSED',412);};check();const generation=await documentControl(client,b.projectId,s);check();if(generation!==b.controlGeneration)fail('CONTROL_GENERATION_CONFLICT');
 const policy=await limitPolicyAccess(client,b,s,b.pending!.operation as 'applyLimitPolicy'|'revokeLimitPolicy');check();if(!policy.approvalRequired)fail('APPROVAL_NOT_REQUIRED',422);return policy;
}
export async function newLimitPolicyApproval(b:LimitBuffer,s:DocumentSession):Promise<ApprovalRequestWork>{
 const candidate=await frozen(b,s);return{projectId:b.projectId,ownerUserId:s.user.id,ownerClientId:s.clientId,controlGeneration:b.controlGeneration,candidate,details:{reason:'',risks:{data:'',security:'',cost:'',interruption:'',unverified:''},rollback:{method:'',limitations:'',evidenceRefs:[]},expiresAt:''},pending:null,resultId:null,failure:null,uncertain:false,dirty:false};
}
export async function prepareLimitPolicyApproval(client:ApiClient,input:ApprovalRequestWork,source:LimitBuffer,s:DocumentSession,active:()=>boolean):Promise<ApprovalCommand>{
 const b=structuredClone(source),w=structuredClone(input),c=await frozen(b,s);if(!active())fail('LIMIT_POLICY_APPROVAL_PAUSED',412);if(w.projectId!==b.projectId||w.ownerUserId!==s.user.id||w.ownerClientId!==s.clientId||w.controlGeneration!==c.controlGeneration||w.pending||w.resultId||!same(w.candidate,c))fail();const current=await basis(client,b,s,active);
 const details={...w.details,candidateCommandId:c.commandId,actionScope:scope(b,c,s,await digest(c.payload))};
 if(!validApprovalDetails(details)||Date.parse(details.expiresAt)<=Date.now()||Date.parse(details.expiresAt)>current.expires||/-----BEGIN (?:[A-Z0-9]+ )?PRIVATE KEY-----|\bBearer\s+[A-Za-z0-9._~+\/-]{12,}|\b(?:api[_-]?key|access[_-]?token|secret|password|passwd|token)\s*[=:]\s*\S+/i.test(ordered(details)))fail('APPROVAL_INPUT_INVALID',422);if(!active())fail('LIMIT_POLICY_APPROVAL_PAUSED',412);
 return{schemaVersion:1,projectId:b.projectId,commandId:crypto.randomUUID(),clientId:s.clientId,controlGeneration:c.controlGeneration,operation:'requestApproval',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:{details}};
}
export async function bindLimitPolicyApproval(client:ApiClient,source:LimitBuffer,requestId:string,s:DocumentSession,active:()=>boolean):Promise<LimitBuffer>{
 const b=structuredClone(source),c=await frozen(b,s);if(!uuid(requestId)||b.limitApproval?.request?.resultId&&b.limitApproval.request.resultId!==requestId)fail();const current=await basis(client,b,s,active),view=await readApproval(client,b.projectId,requestId),r=view.request;
 if(!active())fail('LIMIT_POLICY_APPROVAL_PAUSED',412);if(!same(r.policyRef,current.policyRef)||r.details.candidateCommandId!==c.commandId||!same(r.details.actionScope,scope(b,c,s,await digest(c.payload))))fail();
 if(!view.basisCurrent||view.effectiveState!=='APPROVED'||view.expired||view.decision?.decision!=='APPROVE'||view.consumption||Date.parse(r.details.expiresAt)<=Date.now()||Date.parse(r.details.expiresAt)>current.expires)fail('APPROVAL_NOT_USABLE',412);if(!active())fail('LIMIT_POLICY_APPROVAL_PAUSED',412);
 const pending={...c,approvalRef:{requestId:r.id,decisionId:view.decision.id,scopeDigest:r.scopeDigest}},commandHash=await digest(pending);if(!active())fail('LIMIT_POLICY_APPROVAL_PAUSED',412);
 return{...b,pending,pendingHash:commandHash,limitApproval:{request:b.limitApproval?.request??null,requestId,commandHash},failure:null};
}
export async function checkLimitPolicyApprovalBinding(b:LimitBuffer,s:DocumentSession){
 const c=await limitCommand(b,s),a=b.limitApproval;if(c.approvalRef===null){if(a)fail('LIMIT_POLICY_RECONCILIATION_REQUIRED');return;}
 const approval=c.approvalRef as any;if(!a?.commandHash||a.requestId!==approval.requestId||a.commandHash!==await digest(c))fail();
}

export interface LimitPolicyApprovalTermination{commandHash:string;view:ApprovalView}
/** 현재 불확실 명령은 종료할 수 없다. 요청 원후보와 null→승인참조 전이만 대조한다. */
async function terminationCandidate(b:LimitBuffer,s:DocumentSession){
 const a=b.limitApproval,w=a?.request;
 if(b.uncertain||b.result||!a||!uuid(a.requestId)||!w||w.uncertain||w.pending||w.resultId!==a.requestId||w.projectId!==b.projectId||w.ownerUserId!==s.user.id||w.ownerClientId!==s.clientId||w.controlGeneration!==b.controlGeneration)fail();
 const c=await limitCommand(b,s);if(!b.pending||!same({...c,approvalRef:null},w.candidate))fail();
 if(c.approvalRef!==null)await checkLimitPolicyApprovalBinding(b,s);return c;
}
export async function readLimitPolicyApprovalTermination(client:ApiClient,source:LimitBuffer,s:DocumentSession,active:()=>boolean):Promise<LimitPolicyApprovalTermination>{
 const b=structuredClone(source),c=await terminationCandidate(b,s);if(!active())fail('LIMIT_POLICY_APPROVAL_PAUSED',412);
 // 로컬 종결은 실행 정책 결박과 다르다. 현재 소유·기기·제어는 그대로 검사한다.
 const generation=await documentControl(client,b.projectId,s);if(!active())fail('LIMIT_POLICY_APPROVAL_PAUSED',412);if(generation!==b.controlGeneration)fail('CONTROL_GENERATION_CONFLICT');
 const v=await readApproval(client,b.projectId,b.limitApproval!.requestId),r=v.request;
 if(!active())fail('LIMIT_POLICY_APPROVAL_PAUSED',412);
 if(r.details.candidateCommandId!==c.commandId||!same(r.details.actionScope,scope(b,c,s,await digest(c.payload))))fail();
 if(c.approvalRef!==null&&!same(c.approvalRef,{requestId:r.id,decisionId:v.decision?.id,scopeDigest:r.scopeDigest}))fail();
 // 현재 소유·제어가 같고 정책만 진행한 REVOKED도 불확실성 없는 로컬 종결로 보존한다.
 const rejected=v.effectiveState==='REJECTED'&&v.storedStatus==='REJECTED'&&v.decision?.decision==='REJECT';
 const changed=v.effectiveState==='CHANGE_REQUESTED'&&v.storedStatus==='CHANGE_REQUESTED'&&v.decision?.decision==='REQUEST_CHANGE';
 const expired=v.effectiveState==='EXPIRED'&&v.expired&&['PENDING','APPROVED'].includes(v.storedStatus);
 const revoked=v.effectiveState==='REVOKED'&&!v.basisCurrent&&['PENDING','APPROVED'].includes(v.storedStatus);
 if(v.consumption||!(rejected||changed||expired||revoked))fail('LIMIT_POLICY_APPROVAL_NOT_TERMINAL',412);
 if(!active())fail('LIMIT_POLICY_APPROVAL_PAUSED',412);return{commandHash:await digest(c),view:v};
}
/** 명시 종료 순간에도 보호 GET과 현재 조건을 재검사한다. 서버 이력/원명령은 삭제하지 않는다. */
export async function closeLimitPolicyApproval(client:ApiClient,source:LimitBuffer,expected:LimitPolicyApprovalTermination,s:DocumentSession,active:()=>boolean):Promise<LimitBuffer>{
 const b=structuredClone(source),proof=await readLimitPolicyApprovalTermination(client,b,s,active);
 const stable=(v:ApprovalView)=>({request:v.request,requestRef:v.requestRef,currentVersion:v.currentVersion,storedStatus:v.storedStatus,effectiveState:v.effectiveState,decision:v.decision,consumption:v.consumption,expired:v.expired,basisCurrent:v.basisCurrent});
 if(proof.commandHash!==expected.commandHash||!same(stable(proof.view),stable(expected.view)))fail();if(!active())fail('LIMIT_POLICY_APPROVAL_PAUSED',412);
 return{...b,pending:null,pendingHash:null,limitApproval:undefined,closedLimitApprovals:[...(b.closedLimitApprovals??[]),{command:structuredClone(b.pending!),request:structuredClone(b.limitApproval!.request!),view:structuredClone(proof.view)}],uncertain:false,failure:null};
}
