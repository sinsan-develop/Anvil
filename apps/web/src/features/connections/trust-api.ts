import {ApiClient,ApiError} from '../../api/client.ts';
import {documentControl,type DocumentSession} from '../design-trace/editor-api.ts';
import type {ProjectCommand} from '../../../../server/modules/access/project-command.ts';
import {validRef,type Ref} from './api.ts';
import {readApproval} from '../decisions/api.ts';
import type {ApprovalDetails,ApprovalScope} from '../../../../server/modules/approvals/approval-input.ts';
export interface TrustHit{registrationRef:Ref;connectorRef:Ref;hostLabel:string;state:string;derivedExpired:boolean;expiresAt:string;proofedAt:string|null;revokedAt:string|null}
export interface TrustScope{kind:'HOST_TRUST_REGISTRATION';installationId:string;projectId:string;subject:{kind:'HUMAN';userId:string;clientId:string;credentialGeneration:number;controlGeneration:number};policyRef:Ref;expectedHostFingerprint:string;hostLabel:string;expiresAt:string;credentialScope:'REGISTRATION_STATUS_ONLY';grants:[]}
export interface TrustView extends TrustHit{projectId:string;connectorState:string;expectedHostFingerprint:string;observedHostFingerprint:string|null;scopeDigest:string;scope:TrustScope;policyRef:Ref;createdAt:string;issuedAt:string|null;failedAttempts:number;credential:{issued:boolean;expiresAt:string|null;revokedAt:string|null;status:string};basis:{current:boolean;reasons:string[]};confirmation:{allowed:boolean;reasons:string[]};grants:[];executionAuthorized:false;observedAt:string}
export interface TrustBuffer{projectId:string;ownerUserId:string;ownerClientId:string;controlGeneration:number;draft:{hostLabel:string;expectedHostFingerprint:string;expiresAt:string;reason:string};pending:ProjectCommand|null;pendingHash:string|null;targetRef:Ref|null;policyRef:Ref|null;actionExpiresAt:string|null;uncertain:boolean;failure:{code:string;status:number}|null;resultRegistrationId:string|null;approvalWork?:{details:Omit<ApprovalDetails,'actionScope'|'candidateCommandId'>;pending:ProjectCommand|null;requestId:string|null;uncertain:boolean}|null}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,hash=/^[0-9a-f]{64}$/;
const exact=(v:any,keys:string)=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===keys.split(',').sort().join(',');
const instant=(v:unknown):v is string=>typeof v==='string'&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
const optionalInstant=(v:unknown)=>v===null||instant(v);
const text=(v:unknown,max=20000):v is string=>typeof v==='string'&&!!v.trim()&&v.isWellFormed()&&v.length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v);
const sensitive=(v:unknown)=>/-----BEGIN (?:[A-Z0-9]+ )?PRIVATE KEY-----|\bBearer\s+[A-Za-z0-9._~+\/-]{12,}|\b(?:api[_-]?key|access[_-]?token|secret|password|passwd|token)\s*[=:]\s*\S+/i.test(JSON.stringify(v));
const states=['CREATED','CHALLENGED','PROVED_WAITING_CONFIRMATION','CONFIRMED','REJECTED','ISSUED','REVOKED'];
const hitKeys='registrationRef,connectorRef,hostLabel,state,derivedExpired,expiresAt,proofedAt,revokedAt';
const hitValid=(v:any)=>validRef(v?.registrationRef)&&validRef(v.connectorRef)&&text(v.hostLabel,200)&&states.includes(v.state)&&typeof v.derivedExpired==='boolean'&&instant(v.expiresAt)&&optionalInstant(v.proofedAt)&&optionalInstant(v.revokedAt);
function normalize(v:any):any{return Array.isArray(v)?v.map(normalize):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,normalize(v[k])])):v;}
export const trustSame=(a:unknown,b:unknown)=>JSON.stringify(normalize(a))===JSON.stringify(normalize(b));
export async function trustDigest(v:unknown){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(normalize(v)))))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export async function listHumanRegistrations(client:ApiClient,pid:string,cursor:string|null=null){
 if(!uuid.test(pid)||cursor!==null&&(typeof cursor!=='string'||!cursor||cursor.length>4096))throw new ApiError('CLIENT_PATH_INVALID');
 const q=new URLSearchParams({limit:'50'});if(cursor)q.set('cursor',cursor);
 const v=await client.get<{view:string;items:TrustHit[];hasMore:boolean;nextCursor:string|null;observedAt:string}>(`/api/v1/projects/${pid}/connector-registrations?${q}`);
 if(!exact(v,'view,items,hasMore,nextCursor,observedAt')||v.view!=='HOST_TRUST_REGISTRATIONS_ONLY'||!Array.isArray(v.items)||v.items.length>50||v.items.some(x=>!exact(x,hitKeys)||!hitValid(x))||typeof v.hasMore!=='boolean'||(v.hasMore?typeof v.nextCursor!=='string'||!v.nextCursor||v.nextCursor.length>4096:v.nextCursor!==null)||!instant(v.observedAt))throw new ApiError('RESPONSE_INVALID');return v;
}
export async function validateTrustView(v:TrustView,pid:string,id:string){
 if(!exact(v,hitKeys+',projectId,connectorState,expectedHostFingerprint,observedHostFingerprint,scopeDigest,scope,policyRef,createdAt,issuedAt,failedAttempts,credential,basis,confirmation,grants,executionAuthorized,observedAt')||!hitValid(v)||v.projectId!==pid||v.registrationRef.id!==id||!['REGISTRATION_PENDING','TRUSTED','REVOKED'].includes(v.connectorState)||!hash.test(v.expectedHostFingerprint)||v.observedHostFingerprint!==null&&v.observedHostFingerprint!==v.expectedHostFingerprint||!hash.test(v.scopeDigest)||!validRef(v.policyRef)||!instant(v.createdAt)||!optionalInstant(v.issuedAt)||!instant(v.observedAt)||!Number.isInteger(v.failedAttempts)||v.failedAttempts<0||v.failedAttempts>5||!Array.isArray(v.grants)||v.grants.length||v.executionAuthorized!==false)throw new ApiError('RESPONSE_INVALID');
 const s=v.scope;if(!exact(s,'kind,installationId,projectId,subject,policyRef,expectedHostFingerprint,hostLabel,expiresAt,credentialScope,grants')||s.kind!=='HOST_TRUST_REGISTRATION'||!uuid.test(s.installationId)||s.projectId!==pid||!exact(s.subject,'kind,userId,clientId,credentialGeneration,controlGeneration')||s.subject.kind!=='HUMAN'||!uuid.test(s.subject.userId)||!uuid.test(s.subject.clientId)||!Number.isSafeInteger(s.subject.credentialGeneration)||s.subject.credentialGeneration<1||!Number.isSafeInteger(s.subject.controlGeneration)||s.subject.controlGeneration<1||!validRef(s.policyRef)||s.expectedHostFingerprint!==v.expectedHostFingerprint||s.hostLabel!==v.hostLabel||s.expiresAt!==v.expiresAt||s.credentialScope!=='REGISTRATION_STATUS_ONLY'||!Array.isArray(s.grants)||s.grants.length||await trustDigest(s)!==v.scopeDigest)throw new ApiError('RESPONSE_INVALID');
 if(await trustDigest({registrationId:id,version:v.registrationRef.version,state:v.state,scopeDigest:v.scopeDigest})!==v.registrationRef.contentHash||await trustDigest({connectorId:v.connectorRef.id,registrationId:id,scopeDigest:v.scopeDigest,generation:v.connectorRef.version})!==v.connectorRef.contentHash)throw new ApiError('RESPONSE_INVALID');
 const c=v.credential,b=v.basis,a=v.confirmation,reasons=['REVOKED','REGISTRATION_EXPIRED','POLICY_CHANGED','CONTROL_GENERATION_CHANGED','CREDENTIAL_GENERATION_CHANGED','SESSION_OR_POLICY_NOT_CURRENT','PROOF_ATTEMPT_LIMIT','PROOF_NOT_READY','REAUTHENTICATION_REQUIRED','CONFIRMATION_POLICY_DENIED'];
 if(!exact(c,'issued,expiresAt,revokedAt,status')||typeof c.issued!=='boolean'||!optionalInstant(c.expiresAt)||!optionalInstant(c.revokedAt)||!['NOT_ISSUED','REVOKED','EXPIRED','ACTIVE_STATUS_ONLY','BASIS_NOT_CURRENT'].includes(c.status)||!c.issued&&(c.expiresAt!==null||c.revokedAt!==null||c.status!=='NOT_ISSUED')||c.issued&&c.expiresAt===null||!exact(b,'current,reasons')||!exact(a,'allowed,reasons')||typeof b.current!=='boolean'||typeof a.allowed!=='boolean'||![b.reasons,a.reasons].every(x=>Array.isArray(x)&&x.every(r=>reasons.includes(r)))||b.current!==!b.reasons.length||a.allowed!==!a.reasons.length||a.allowed&&(!b.current||v.state!=='PROVED_WAITING_CONFIRMATION'||v.proofedAt===null||v.derivedExpired))throw new ApiError('RESPONSE_INVALID');return v;
}
export async function readHumanRegistration(client:ApiClient,pid:string,id:string){if(!uuid.test(pid)||!uuid.test(id))throw new ApiError('CLIENT_PATH_INVALID');return validateTrustView(await client.get<TrustView>(`/api/v1/projects/${pid}/connector-registrations/${id}`),pid,id);}
export function trustBinding(b:TrustBuffer,s:DocumentSession){if(!uuid.test(b.projectId)||b.ownerUserId!==s.user.id||b.ownerClientId!==s.clientId||!uuid.test(s.clientId)||!/^[A-Za-z0-9_-]{43}$/.test(s.csrfToken)||!Number.isSafeInteger(b.controlGeneration)||b.controlGeneration<1)throw new ApiError('TRUST_BINDING_INVALID');}
export function newTrustBuffer(projectId:string,s:DocumentSession,controlGeneration:number):TrustBuffer{const b:TrustBuffer={projectId,ownerUserId:s.user.id,ownerClientId:s.clientId,controlGeneration,draft:{hostLabel:'',expectedHostFingerprint:'',expiresAt:'',reason:''},pending:null,pendingHash:null,targetRef:null,policyRef:null,actionExpiresAt:null,uncertain:false,failure:null,resultRegistrationId:null};trustBinding(b,s);return b;}
export async function prepareTrustRegistration(b:TrustBuffer,s:DocumentSession,policyRef:Ref):Promise<ProjectCommand>{
 trustBinding(b,s);const p=b.draft;if(b.pending||b.resultRegistrationId||!text(p.hostLabel,200)||/[\r\n\t]/.test(p.hostLabel)||!hash.test(p.expectedHostFingerprint)||!instant(p.expiresAt)||Date.parse(p.expiresAt)<=Date.now()||Date.parse(p.expiresAt)>Date.now()+600000||!text(p.reason)||sensitive(p)||!validRef(policyRef))throw new ApiError('TRUST_INPUT_INVALID');
 return{schemaVersion:1,projectId:b.projectId,commandId:crypto.randomUUID(),clientId:s.clientId,controlGeneration:b.controlGeneration,operation:'registerConnector',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:{kind:'HOST_TRUST_REGISTRATION',...structuredClone(p),policyRef:{...policyRef}}};
}
export async function trustAccess(client:ApiClient,pid:string,s:DocumentSession,operation:string){
 if(!['registerConnector','confirmConnectorRegistration','revokeConnector'].includes(operation))throw new ApiError('TRUST_INPUT_INVALID');
 const[generation,value]=await Promise.all([documentControl(client,pid,s),client.get<{configured:boolean;policy:null|{ref:Ref;rules:any[]}}>(`/api/v1/projects/${pid}/permission-policy`)]);
 if(!value?.configured||!value.policy)throw new ApiError('PROJECT_POLICY_REQUIRED',412);if(!validRef(value.policy.ref)||!Array.isArray(value.policy.rules))throw new ApiError('RESPONSE_INVALID');
 const rules=value.policy.rules.filter(r=>r.subjectRef?.kind==='HUMAN'&&r.subjectRef.userId===s.user.id&&r.operations?.includes(operation)&&r.targetScopes?.some((t:any)=>t.kind==='PROJECT'&&t.projectId===pid)&&instant(r.expiresAt)&&Date.parse(r.expiresAt)>Date.now());
 if(!rules.length||rules.some(r=>r.disposition==='DENY'))throw new ApiError('PROJECT_OPERATION_DENIED',403);
 return{generation,policyRef:value.policy.ref,approvalRequired:rules.some(r=>r.disposition==='REQUIRE_APPROVAL'),validUntil:new Date(Math.min(...rules.map(r=>Date.parse(r.expiresAt)))).toISOString()};
}
export async function freezeTrustCommand(b:TrustBuffer,s:DocumentSession,c:ProjectCommand,targetRef:Ref|null,policyRef:Ref,expiresAt:string){
 trustBinding(b,s);if(b.pending||c.projectId!==b.projectId||c.clientId!==s.clientId||c.controlGeneration!==b.controlGeneration||!uuid.test(c.commandId)||!['registerConnector','confirmConnectorRegistration','revokeConnector'].includes(c.operation)||c.approvalRef!==null||c.baselineRefs.length||!validRef(policyRef)||!instant(expiresAt)||Date.parse(expiresAt)<=Date.now()||(targetRef===null?c.targetId!==null||c.expectedVersion!==0:!validRef(targetRef)||targetRef.id!==c.targetId||targetRef.version!==c.expectedVersion))throw new ApiError('TRUST_PENDING_CHANGED');
 b.pending=structuredClone(c);b.pendingHash=await trustDigest(c);b.targetRef=targetRef?{...targetRef}:null;b.policyRef={...policyRef};b.actionExpiresAt=expiresAt;b.uncertain=false;b.failure=null;
}
export async function prepareTrustAction(client:ApiClient,b:TrustBuffer,s:DocumentSession,id:string,operation:'confirmConnectorRegistration'|'revokeConnector',decision:'APPROVE'|'REJECT',reason:string,displayed?:TrustView){
 trustBinding(b,s);if(b.pending||!text(reason)||sensitive(reason))throw new ApiError('TRUST_INPUT_INVALID');
 const a=await trustAccess(client,b.projectId,s,operation),v=await readHumanRegistration(client,b.projectId,id);
 if(displayed&&(!trustSame(v.registrationRef,displayed.registrationRef)||!trustSame(v.connectorRef,displayed.connectorRef)||v.scopeDigest!==displayed.scopeDigest||v.observedHostFingerprint!==displayed.observedHostFingerprint))throw new ApiError('CONNECTOR_VERSION_CONFLICT',409);
 if(a.generation!==b.controlGeneration||v.scope.subject.userId!==s.user.id||v.scope.subject.clientId!==s.clientId)throw new ApiError('TRUST_BINDING_INVALID');
 if(operation==='confirmConnectorRegistration'&&!v.confirmation.allowed)throw new ApiError('TRUST_CONFIRMATION_NOT_READY',412);
 if(operation==='revokeConnector'&&v.state==='REVOKED')throw new ApiError('CONNECTOR_VERSION_CONFLICT',409);
 const target=operation==='revokeConnector'?v.connectorRef:v.registrationRef;
 const payload=operation==='revokeConnector'?{connectorRef:{...target},reason}:{registrationId:id,observedHostFingerprint:v.observedHostFingerprint!,scopeDigest:v.scopeDigest,decision,reason};
 const c:ProjectCommand={schemaVersion:1,projectId:b.projectId,commandId:crypto.randomUUID(),clientId:s.clientId,controlGeneration:b.controlGeneration,operation,targetId:target.id,expectedVersion:target.version,baselineRefs:[],approvalRef:null,payload};
 // 회수는 과거 등록기한과 별개인 현재 회수 정책 기한을 사용한다.
 await freezeTrustCommand(b,s,c,target,a.policyRef,operation==='revokeConnector'?a.validUntil:new Date(Math.min(Date.parse(a.validUntil),Date.parse(v.expiresAt))).toISOString());b.resultRegistrationId=id;return{command:c,approvalRequired:a.approvalRequired,view:v};
}
export async function sendTrustCommand(client:ApiClient,b:TrustBuffer,s:DocumentSession):Promise<{receipt:any;oneTimeCode:string|null}>{
 trustBinding(b,s);const c=b.pending;if(!c||b.pendingHash!==await trustDigest(c)||c.projectId!==b.projectId||c.clientId!==s.clientId||c.controlGeneration!==b.controlGeneration||!b.policyRef||!b.actionExpiresAt||!['registerConnector','confirmConnectorRegistration','revokeConnector'].includes(c.operation)||c.baselineRefs.length||c.schemaVersion!==1||!uuid.test(c.commandId)||sensitive(c.payload))throw new ApiError('TRUST_PENDING_CHANGED');
 const access=await trustAccess(client,b.projectId,s,c.operation);if(access.generation!==b.controlGeneration||!trustSame(access.policyRef,b.policyRef))throw new ApiError('CONNECTOR_POLICY_CHANGED',409);
 if(!b.uncertain&&Date.parse(b.actionExpiresAt)<=Date.now())throw new ApiError('TRUST_ACTION_EXPIRED',412);
 if(access.approvalRequired&&c.approvalRef===null)throw new ApiError('APPROVAL_REQUIRED',412);
 if(c.operation!=='registerConnector'){
  const id=c.operation==='confirmConnectorRegistration'?String(c.payload.registrationId):b.resultRegistrationId;
  if(!id||!uuid.test(id))throw new ApiError('TRUST_PENDING_CHANGED');const current=await readHumanRegistration(client,b.projectId,id),ref=c.operation==='revokeConnector'?current.connectorRef:current.registrationRef;
  if(!b.uncertain&&(!trustSame(ref,b.targetRef)||c.operation==='confirmConnectorRegistration'&&(!current.confirmation.allowed||current.scopeDigest!==c.payload.scopeDigest||current.observedHostFingerprint!==c.payload.observedHostFingerprint)))throw new ApiError('CONNECTOR_VERSION_CONFLICT',409);
 }
 let response:Response;try{response=await client.transport.call(globalThis,`/api/v1/projects/${b.projectId}/commands`,{method:'POST',credentials:'same-origin',redirect:'error',cache:'no-store',headers:{Accept:'application/json','Content-Type':'application/json','X-Anvil-CSRF':s.csrfToken,'Idempotency-Key':c.commandId},body:JSON.stringify(c)});}catch{throw new ApiError('CONNECTION_LOST');}
 let value:any;try{if(!/^application\/json\b/i.test(response.headers.get('content-type')??''))throw Error();value=await response.json();}catch{throw new ApiError('RESPONSE_INVALID',response.status);}
 if(!response.ok)throw new ApiError(typeof value?.code==='string'&&/^[A-Z_]{1,64}$/.test(value.code)?value.code:'REQUEST_FAILED',response.status);
 const d=value?.data;if(value.status!=='APPLIED'||value.commandId!==c.commandId||value.projectId!==b.projectId||!uuid.test(value.operationId)||!instant(value.serverReceivedAt)||d?.executionAuthorized!==false||!Array.isArray(d.grants)||d.grants.length)throw new ApiError('RESPONSE_INVALID');
 if(c.operation==='registerConnector'){
  if(d.status!=='REGISTRATION_CREATED'||!validRef(d.registrationRef)||!validRef(d.connectorRef)||value.targetId!==d.registrationRef.id||value.version!==1||d.registrationRef.version!==1||d.oneTimeCode!==null&&(typeof d.oneTimeCode!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(d.oneTimeCode))||d.oneTimeCode===null&&d.secretDisposition!=='ALREADY_ISSUED_RECONCILE'||d.oneTimeCode!==null&&d.secretDisposition!=='DELIVERED_ONCE')throw new ApiError('RESPONSE_INVALID');
  const code=d.oneTimeCode;return{receipt:{registrationRef:d.registrationRef,connectorRef:d.connectorRef,status:d.status,secretDisposition:d.secretDisposition},oneTimeCode:code};
 }
 if(c.operation==='confirmConnectorRegistration'){if(!validRef(d.registrationRef)||d.registrationRef.id!==c.targetId||d.registrationRef.version!==c.expectedVersion+1||d.status!==(c.payload.decision==='APPROVE'?'CONFIRMED':'REJECTED')||!trustSame(d.previousRef,b.targetRef))throw new ApiError('RESPONSE_INVALID');}
 else if(d.status!=='REVOKED'||!validRef(d.connectorRef)||d.connectorRef.id!==c.targetId||d.connectorRef.version!==c.expectedVersion+1||d.registrationId!==b.resultRegistrationId||!trustSame(d.previousRef,b.targetRef))throw new ApiError('RESPONSE_INVALID');
 return{receipt:{...d},oneTimeCode:null};
}
async function trustApprovalScope(b:TrustBuffer,s:DocumentSession):Promise<ApprovalScope>{
 trustBinding(b,s);const c=b.pending;if(!c||b.pendingHash!==await trustDigest(c)||!b.policyRef||!b.actionExpiresAt||!['registerConnector','confirmConnectorRegistration','revokeConnector'].includes(c.operation)||(b.targetRef===null?c.targetId!==null||c.expectedVersion!==0:!validRef(b.targetRef)||b.targetRef.id!==c.targetId||b.targetRef.version!==c.expectedVersion))throw new ApiError('TRUST_PENDING_CHANGED');
 return{operation:c.operation,targetRef:b.targetRef,expectedVersion:c.expectedVersion,payloadHash:await trustDigest(c.payload),baselineRefs:[],environmentRef:null,sourceScopes:[],limitsRef:null,requestedSubjectRef:{kind:'HUMAN',userId:s.user.id,clientId:s.clientId},controlGeneration:b.controlGeneration};
}
export async function prepareTrustApproval(b:TrustBuffer,s:DocumentSession,details:Omit<ApprovalDetails,'actionScope'|'candidateCommandId'>):Promise<ProjectCommand>{
 const scope=await trustApprovalScope(b,s);if(b.pending!.approvalRef!==null||!exact(details,'reason,risks,rollback,expiresAt')||!text(details.reason)||!exact(details.risks,'data,security,cost,interruption,unverified')||!Object.values(details.risks).every(v=>text(v))||!exact(details.rollback,'method,limitations,evidenceRefs')||!text(details.rollback.method)||!text(details.rollback.limitations)||!Array.isArray(details.rollback.evidenceRefs)||details.rollback.evidenceRefs.length||!instant(details.expiresAt)||Date.parse(details.expiresAt)<=Date.now()||Date.parse(details.expiresAt)>Date.parse(b.actionExpiresAt!)||sensitive(details))throw new ApiError('APPROVAL_INPUT_INVALID');
 return{schemaVersion:1,projectId:b.projectId,commandId:crypto.randomUUID(),clientId:s.clientId,controlGeneration:b.controlGeneration,operation:'requestApproval',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:{details:{...structuredClone(details),candidateCommandId:b.pending!.commandId,actionScope:scope}}};
}
export async function bindTrustApproval(client:ApiClient,b:TrustBuffer,s:DocumentSession,requestId:string){
 const scope=await trustApprovalScope(b,s),v=await readApproval(client,b.projectId,requestId),c=b.pending!;
 if(!trustSame(v.request.details.actionScope,scope)||v.request.details.candidateCommandId!==c.commandId||!trustSame(v.request.policyRef,b.policyRef)||!v.basisCurrent||v.decision?.decision!=='APPROVE'||!['APPROVED','CONSUMED'].includes(v.effectiveState)||v.expired)throw new ApiError('APPROVAL_NOT_USABLE',412);
 const pending={...structuredClone(c),approvalRef:{requestId,decisionId:v.decision.id,scopeDigest:v.request.scopeDigest}},digest=await trustDigest(pending);
 if(v.consumption&&(v.consumption.commandId!==c.commandId||v.consumption.requestHash!==digest))throw new ApiError('APPROVAL_CANDIDATE_MISMATCH');
 return{...b,pending,pendingHash:digest,failure:null};
}
