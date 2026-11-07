import type {ApprovalRequestWork,ApprovalView} from '../decisions/api.ts';
import {ApiClient,ApiError} from '../../api/client.ts';
import {documentControl,type DocumentSession} from '../design-trace/editor-api.ts';
import {ordered} from '../knowledge/review-view.ts';
import {validRef,type Ref} from './api.ts';
import type {ProjectCommand} from '../../../../server/modules/access/project-command.ts';
import type {ExecutionLimits,LimitPolicyRecord} from '../../../../server/modules/executions/runtime-policy.ts';

export type {ExecutionLimits,LimitPolicyRecord};
export type LimitOperation='applyLimitPolicy'|'revokeLimitPolicy';
export interface LimitBuffer {
 limitApproval?:{request:ApprovalRequestWork|null;requestId:string;commandHash:string|null};closedLimitApprovals?:{command:ProjectCommand;request:ApprovalRequestWork;view:ApprovalView}[];
 bufferId:string;projectId:string;ownerUserId:string;ownerClientId:string;controlGeneration:number;
 base:LimitPolicyRecord|null;draft:{limits:ExecutionLimits;reason:string;costText?:string};pending:ProjectCommand|null;pendingHash:string|null;
 dirty:boolean;uncertain:boolean;failure:{code:string;status:number}|null;result:LimitPolicyRecord|null;
}
export type LimitBufferChange=(previous:LimitBuffer|null)=>LimitBuffer|null;
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
const exact=(v:any,keys:string[])=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
const integer=(v:unknown,max:number,min=1)=>Number.isSafeInteger(v)&&Number(v)>=min&&Number(v)<=max;
const instant=(v:unknown):v is string=>typeof v==='string'&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
const same=(a:unknown,b:unknown)=>ordered(a)===ordered(b);
const sensitive=(v:unknown)=>/-----BEGIN (?:[A-Z0-9]+ )?PRIVATE KEY-----|\bBearer\s+[A-Za-z0-9._~+\/-]{12,}|\b(?:api[_-]?key|access[_-]?token|secret|password|passwd|token)\s*[=:]\s*\S+/i.test(JSON.stringify(v));
const reasonValid=(v:unknown):v is string=>typeof v==='string'&&!!v.trim()&&v.length<=20000&&v.isWellFormed()&&!sensitive(v);
function fail(code='LIMIT_INPUT_INVALID',status=0):never{throw new ApiError(code,status);}
async function digest(v:unknown){const bytes=new TextEncoder().encode(ordered(v));if(bytes.length>2*1024*1024)fail();return[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');}
function limitsValid(v:any):v is ExecutionLimits{
 const keys=['maxAttempts','maxElapsedMs','maxCalls','maxConcurrentAssignments','maxSpoolBytes','maxOfflineMs'];
 return(exact(v,keys)||exact(v,[...keys,'maxCost','currency']))&&integer(v.maxAttempts,3)&&integer(v.maxElapsedMs,7200000)
  &&integer(v.maxCalls,50)&&v.maxConcurrentAssignments===1&&integer(v.maxSpoolBytes,1073741824)&&integer(v.maxOfflineMs,Math.min(300000,v.maxElapsedMs),0)
  &&(!Object.hasOwn(v,'maxCost')||typeof v.maxCost==='number'&&Number.isFinite(v.maxCost)&&v.maxCost>=0&&v.maxCost<=Number.MAX_SAFE_INTEGER&&typeof v.currency==='string'&&/^[A-Z]{3}$/.test(v.currency));
}
function binding(b:LimitBuffer,s:DocumentSession){
 if(!uuid(b.bufferId)||!uuid(b.projectId)||b.ownerUserId!==s.user.id||!uuid(s.user.id)||b.ownerClientId!==s.clientId||!uuid(s.clientId)||!/^[A-Za-z0-9_-]{43}$/.test(s.csrfToken)||!integer(b.controlGeneration,Number.MAX_SAFE_INTEGER))fail('LIMIT_BINDING_INVALID');
}
export {validateView as validateStoredLimitPolicy};
async function validateView(v:LimitPolicyRecord,pid:string,ref:Ref){
 const s=v?.snapshot;
 if(!exact(v,['projectId','ref','snapshot'])||v.projectId!==pid||!same(v.ref,ref)||!validRef(ref)||ref.version>=Number.MAX_SAFE_INTEGER
  ||!exact(s,['limits','scope','reason','policyBaseVersion','state','previousRef','decidedBy','decidedAt','expiresAt','executionAuthorized','dispatchPerformed'])
  ||!limitsValid(s.limits)||!same(s.scope,{kind:'PROJECT',projectId:pid})||!reasonValid(s.reason)||s.policyBaseVersion!==ref.version-1
  ||!['APPLIED','REVOKED'].includes(s.state)||!instant(s.decidedAt)||!instant(s.expiresAt)||!exact(s.decidedBy,['kind','userId'])||s.decidedBy.kind!=='HUMAN'||!uuid(s.decidedBy.userId)
  ||s.executionAuthorized!==false||s.dispatchPerformed!==false
  ||(ref.version===1?s.previousRef!==null||s.state!=='APPLIED':!validRef(s.previousRef)||s.previousRef.id!==ref.id||s.previousRef.version!==ref.version-1)
  ||s.state==='APPLIED'&&Date.parse(s.expiresAt)!==Date.parse(s.decidedAt)+s.limits.maxElapsedMs||await digest(s)!==ref.contentHash)fail('LIMIT_POLICY_RESPONSE_INVALID');
 return structuredClone(v);
}
/** 고정 보관본일 뿐 현재 head·예산 가용량·OS/Agent 강제/실행 허가를 인증하지 않는다. */
export async function readLimitPolicy(client:ApiClient,pid:string,ref:Ref):Promise<LimitPolicyRecord>{
 if(!uuid(pid)||!validRef(ref)||ref.version>=Number.MAX_SAFE_INTEGER)fail('CLIENT_PATH_INVALID');
 const selected=structuredClone(ref);
 return validateView(await client.get<LimitPolicyRecord>('/api/v1/projects/'+pid+'/limit-policies/'+selected.id+'/versions/'+selected.version),pid,selected);
}
export function newLimitBuffer(pid:string,s:DocumentSession,generation:number,base:LimitPolicyRecord|null=null):LimitBuffer{
 const b:LimitBuffer={bufferId:crypto.randomUUID(),projectId:pid,ownerUserId:s.user.id,ownerClientId:s.clientId,controlGeneration:generation,base:base?structuredClone(base):null,
 draft:{limits:base?structuredClone(base.snapshot.limits):{maxAttempts:3,maxElapsedMs:7200000,maxCalls:50,maxConcurrentAssignments:1,maxSpoolBytes:1073741824,maxOfflineMs:300000},reason:''},
 pending:null,pendingHash:null,dirty:false,uncertain:false,failure:null,result:null};binding(b,s);return b;
}
export async function limitPolicyAccess(client:ApiClient,b:LimitBuffer,s:DocumentSession,operation:LimitOperation){
 binding(b,s);if(!['applyLimitPolicy','revokeLimitPolicy'].includes(operation))fail();
 const[generation,v]=await Promise.all([documentControl(client,b.projectId,s),client.get<{configured:boolean;policy:null|{ref:Ref;rules:any[]}}>('/api/v1/projects/'+b.projectId+'/permission-policy')]);
 if(generation!==b.controlGeneration)fail('CONTROL_GENERATION_CONFLICT',409);
 if(!v?.configured||!v.policy)fail('PROJECT_POLICY_REQUIRED',412);
 if(!validRef(v.policy.ref)||!Array.isArray(v.policy.rules))fail('RESPONSE_INVALID');
 const matched=v.policy.rules.filter(r=>r?.subjectRef?.kind==='HUMAN'&&r.subjectRef.userId===s.user.id&&Array.isArray(r.operations)&&r.operations.includes(operation)&&Array.isArray(r.targetScopes)&&r.targetScopes.some((t:any)=>same(t,{kind:'PROJECT',projectId:b.projectId}))&&instant(r.expiresAt)&&Date.parse(r.expiresAt)>Date.now());
 if(!matched.length||matched.some(r=>r.disposition==='DENY'))fail('PROJECT_OPERATION_DENIED',403);
 if(matched.some(r=>!['AUTO','REQUIRE_APPROVAL'].includes(r.disposition)||r.limitPolicyRef!==null))fail('RESPONSE_INVALID');
 return{approvalRequired:matched.some(r=>r.disposition==='REQUIRE_APPROVAL'),policyRef:v.policy.ref,expires:Math.min(...matched.map(r=>Date.parse(r.expiresAt)))};
}
function payload(b:LimitBuffer,operation:LimitOperation){
 // 원문은 App 입력 보존용이며 API payload에는 포함하지 않는다. 빈칸을 명시한 0으로 바꾸지 않는다.
 const cost=b.draft.costText;
 if(operation==='applyLimitPolicy'&&cost!==undefined&&(typeof cost!=='string'||!/^\d*\.?\d+(?:[eE][+-]?\d+)?$/.test(cost)||!Number.isFinite(Number(cost))||Number(cost)!==b.draft.limits.maxCost))fail('LIMIT_COST_INPUT_INVALID');
 if(!reasonValid(b.draft.reason)||!limitsValid(b.draft.limits))fail();
 const base=b.base,version=base?.ref.version??0;
 if(version>=Number.MAX_SAFE_INTEGER-1||operation==='revokeLimitPolicy'&&(!base||base.snapshot.state!=='APPLIED'))fail();
 return{...(operation==='applyLimitPolicy'?{limits:structuredClone(b.draft.limits)}:{}),scope:{kind:'PROJECT',projectId:b.projectId},reason:b.draft.reason,policyBaseVersion:version};
}
export async function freezeLimitCommand(b:LimitBuffer,s:DocumentSession,operation:LimitOperation){
 binding(b,s);if(b.pending||b.result||!['applyLimitPolicy','revokeLimitPolicy'].includes(operation))fail('LIMIT_PENDING_CHANGED');
 if(b.base)await validateView(b.base,b.projectId,b.base.ref);
 const c:ProjectCommand={schemaVersion:1,projectId:b.projectId,commandId:crypto.randomUUID(),clientId:s.clientId,controlGeneration:b.controlGeneration,operation,targetId:b.base?.ref.id??null,expectedVersion:b.base?.ref.version??0,baselineRefs:[],approvalRef:null,payload:payload(b,operation)};
 const hash=await digest(c);b.pending=c;b.pendingHash=hash;b.failure=null;
}
export async function limitCommand(b:LimitBuffer,s:DocumentSession):Promise<ProjectCommand>{
 binding(b,s);const c=b.pending,operation=c?.operation as LimitOperation;
 if(!c||!['applyLimitPolicy','revokeLimitPolicy'].includes(operation)||!uuid(c.commandId)||!same(c,{schemaVersion:1,projectId:b.projectId,commandId:c.commandId,clientId:s.clientId,controlGeneration:b.controlGeneration,operation,targetId:b.base?.ref.id??null,expectedVersion:b.base?.ref.version??0,baselineRefs:[],approvalRef:c.approvalRef,payload:payload(b,operation)})||await digest(c)!==b.pendingHash)fail('LIMIT_PENDING_CHANGED');
 if(c.approvalRef!==null){const a=c.approvalRef as any;if(!exact(a,['requestId','decisionId','scopeDigest'])||!uuid(a.requestId)||!uuid(a.decisionId)||typeof a.scopeDigest!=='string'||!b.limitApproval||b.limitApproval.requestId!==a.requestId||b.limitApproval.commandHash!==b.pendingHash)fail('LIMIT_PENDING_CHANGED');}
 else if(b.limitApproval?.commandHash)fail('LIMIT_PENDING_CHANGED');
 return c;
}
export async function sendLimitCommand(client:ApiClient,b:LimitBuffer,s:DocumentSession):Promise<LimitPolicyRecord>{
 const c=await limitCommand(b,s),operation=c.operation as LimitOperation;
 let response:Response;try{response=await client.transport.call(globalThis,'/api/v1/projects/'+b.projectId+'/commands',{method:'POST',credentials:'same-origin',redirect:'error',cache:'no-store',headers:{Accept:'application/json','Content-Type':'application/json','X-Anvil-CSRF':s.csrfToken,'Idempotency-Key':c.commandId},body:JSON.stringify(c)});}catch{fail('CONNECTION_LOST');}
 let r:any;try{if(!/^application\/json\b/i.test(response.headers.get('content-type')??''))throw Error();r=await response.json();}catch{fail('RESPONSE_INVALID',response.status);}
 if(!response.ok)fail(typeof r?.code==='string'&&/^[A-Z_]{1,64}$/.test(r.code)?r.code:'REQUEST_FAILED',response.status);
 const d=r?.data,ref=d?.ref;
 if(r?.projectId!==b.projectId||r.commandId!==c.commandId||r.status!=='APPLIED'||!uuid(r.operationId)||!instant(r.serverReceivedAt)||!validRef(ref)||r.targetId!==ref.id||r.version!==ref.version||ref.version!==c.expectedVersion+1||c.targetId!==null&&ref.id!==c.targetId||d.status!==(operation==='applyLimitPolicy'?'LIMIT_POLICY_APPLIED':'LIMIT_POLICY_REVOKED'))fail('LIMIT_POLICY_RESPONSE_INVALID');
 const v=await validateView({projectId:b.projectId,ref,snapshot:d.snapshot},b.projectId,ref),p=c.payload;
 if(v.snapshot.decidedBy.userId!==s.user.id||!same(v.snapshot.previousRef,b.base?.ref??null)||v.snapshot.reason!==p.reason||!same(v.snapshot.scope,p.scope)||!same(v.snapshot.limits,operation==='applyLimitPolicy'?p.limits:b.base!.snapshot.limits)||operation==='revokeLimitPolicy'&&v.snapshot.expiresAt!==b.base!.snapshot.expiresAt||v.snapshot.state!==(operation==='applyLimitPolicy'?'APPLIED':'REVOKED'))fail('LIMIT_POLICY_RESPONSE_INVALID');
 return v;
}
export function matchesLimitBuffer(previous:LimitBuffer|null,expected:LimitBuffer){
 return previous?.bufferId===expected.bufferId&&previous.pendingHash===expected.pendingHash&&same(previous.pending,expected.pending)&&same(previous.draft,expected.draft)&&same(previous.base,expected.base)&&same(previous.limitApproval,expected.limitApproval);
}
export function settleLimitBuffer(previous:LimitBuffer|null,expected:LimitBuffer,next:LimitBuffer|null){
 if(!matchesLimitBuffer(previous,expected))return previous;
 if(previous!.uncertain&&!next?.result){if(!next?.pending)return previous;return{...next,uncertain:true};}
 return next;
}

/** Editor 내부 요청 전이는 같은 원명령에서 여러 번 진행한다. 요청 자체의 before/after CAS는 각 reducer가 검사한다. */
export function updateLimitApprovalBuffer(previous:LimitBuffer|null,expected:LimitBuffer,change:(b:LimitBuffer)=>LimitBuffer):LimitBuffer|null{
 if(!previous||previous.bufferId!==expected.bufferId||previous.projectId!==expected.projectId||previous.ownerUserId!==expected.ownerUserId
  ||previous.ownerClientId!==expected.ownerClientId||previous.controlGeneration!==expected.controlGeneration
  ||previous.pendingHash!==expected.pendingHash||!same(previous.pending,expected.pending)||!same(previous.draft,expected.draft)||!same(previous.base,expected.base)
  ||!same(previous.result,expected.result)||previous.uncertain!==expected.uncertain)return previous;
 return change(previous);
}
