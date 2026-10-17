import {ApiClient,ApiError} from '../../api/client.ts';
import {documentControl,type DocumentSession} from '../design-trace/editor-api.ts';
import {validRef,type Ref} from './api.ts';
import {readSourceRoot,type RootView} from './source-roots-api.ts';
import {readHumanRegistration,trustDigest,trustSame,type TrustView} from './trust-api.ts';
import type {ProjectCommand} from '../../../../server/modules/access/project-command.ts';
import type {SourceReadRequestV1,SourceReadScopeV1} from '../../../../../contracts/runtime/source-read-observation-v1.ts';
import type {SourceReadReportV1} from '../../../../../contracts/runtime/source-read-report-v1.ts';
const exact=(v:any,keys:string)=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===keys.split(',').sort().join(',');
const uuid=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
const instant=(v:unknown):v is string=>typeof v==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
const text=(v:unknown,max:number):v is string=>typeof v==='string'&&!!v.trim()&&v.isWellFormed()&&v.length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v);
const sensitive=(v:unknown)=>/-----BEGIN (?:[A-Z0-9]+ )?PRIVATE KEY-----|\bBearer\s+[A-Za-z0-9._~+\/-]{12,}|\b(?:api[_-]?key|access[_-]?token|secret|password|passwd|token)\s*[=:]\s*\S+/i.test(JSON.stringify(v));
export const sourceReadDigest=trustDigest;
async function rawHash(v:string){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)))].map(n=>n.toString(16).padStart(2,'0')).join('');}
export interface SourceReadBuffer{
 projectId:string;ownerUserId:string;ownerClientId:string;controlGeneration:number;operation:'requestSourceReadObservation'|'revokeSourceReadObservation';
 source:{ref:Ref;displayName:string;hostLabel:string;pathHint:string;connectorRef:Ref;registrationRef:Ref;policyRef:Ref;hostFingerprint:string;installationId:string;credentialGeneration:number};
 grantRef:Ref|null;draft:{filesText:string;expiresAt:string;reason:string};pending:ProjectCommand|null;pendingHash:string|null;resultRef:Ref|null;dirty:boolean;uncertain:boolean;failure:{code:string;status:number}|null;rejectedCommandId?:string;
}
export type SourceReadBufferChange=SourceReadBuffer|null|((previous:SourceReadBuffer|null)=>SourceReadBuffer|null);
function binding(b:SourceReadBuffer,s:DocumentSession){if(!b||!uuid(b.projectId)||!uuid(s.user.id)||!uuid(s.clientId)||b.ownerUserId!==s.user.id||b.ownerClientId!==s.clientId||!Number.isSafeInteger(b.controlGeneration)||b.controlGeneration<1||!/^[A-Za-z0-9_-]{43}$/.test(s.csrfToken))throw new ApiError('SOURCE_READ_BINDING_INVALID');}
function sourceReady(pid:string,s:DocumentSession,generation:number,root:RootView,registration:TrustView){
 if(!root||!root.rawAllowed||root.projectId!==pid||root.status!=='DECLARED'||root.ref.version!==root.headVersion||!validRef(root.ref)||!registration||registration.projectId!==pid||registration.state!=='ISSUED'||registration.connectorState!=='TRUSTED'||registration.derivedExpired||!registration.basis.current||Date.parse(registration.expiresAt)<=Date.now()||root.snapshot.declaration.connectorId!==registration.connectorRef.id||registration.scope.subject.userId!==s.user.id||registration.scope.subject.clientId!==s.clientId||registration.scope.subject.controlGeneration!==generation)throw new ApiError('SOURCE_READ_BASIS_NOT_CURRENT',412);
 return root;
}
export function newSourceReadBuffer(pid:string,s:DocumentSession,generation:number,root:RootView,registration:TrustView):SourceReadBuffer{
 const r=sourceReady(pid,s,generation,root,registration),d=r.snapshot.declaration;
 const b:SourceReadBuffer={projectId:pid,ownerUserId:s.user.id,ownerClientId:s.clientId,controlGeneration:generation,operation:'requestSourceReadObservation',source:{ref:{...r.ref},displayName:r.displayName,hostLabel:d.hostLabel,pathHint:d.pathHint,connectorRef:{...registration.connectorRef},registrationRef:{...registration.registrationRef},policyRef:{...registration.policyRef},hostFingerprint:registration.expectedHostFingerprint,installationId:registration.scope.installationId,credentialGeneration:registration.scope.subject.credentialGeneration},grantRef:null,draft:{filesText:'',expiresAt:new Date(Math.min(Date.now()+120000,Date.parse(registration.expiresAt))).toISOString(),reason:''},pending:null,pendingHash:null,resultRef:null,dirty:false,uncertain:false,failure:null};binding(b,s);return b;
}
export function newSourceReadRevokeBuffer(pid:string,s:DocumentSession,generation:number,view:SourceReadGrantView):SourceReadBuffer{
 if(!view.rawAllowed||view.projectId!==pid||view.storedState==='REVOKED'||!validRef(view.grantRef))throw new ApiError('SOURCE_READ_SCOPE_DENIED',403);
 const scope=view.scope,b:SourceReadBuffer={projectId:pid,ownerUserId:s.user.id,ownerClientId:s.clientId,controlGeneration:generation,operation:'revokeSourceReadObservation',source:{ref:{...scope.sourceRootRef},displayName:view.displayName,hostLabel:'',pathHint:view.declaredPathHint,connectorRef:{...scope.connectorRef},registrationRef:{...scope.registrationRef},policyRef:{...scope.policyRef},hostFingerprint:scope.hostFingerprint,installationId:scope.installationId,credentialGeneration:scope.credentialGeneration},grantRef:{...view.grantRef},draft:{filesText:'',expiresAt:scope.expiresAt,reason:''},pending:null,pendingHash:null,resultRef:null,dirty:false,uncertain:false,failure:null};binding(b,s);return b;
}
function targets(raw:string){
 if(typeof raw!=='string')throw new ApiError('SOURCE_READ_INPUT_INVALID');const lines=raw.split(/\r?\n/),seen=new Set<string>();
 if(!lines.length||lines.length>200)throw new ApiError('SOURCE_READ_INPUT_INVALID');
 return lines.map(relativePath=>{
  if(!relativePath||!relativePath.isWellFormed()||relativePath!==relativePath.normalize('NFC')||new TextEncoder().encode(relativePath).length>1024||/[\u0000-\u001f\u007f\\:%?*"<>|]/.test(relativePath)||relativePath.split('/').some(p=>!p||p.length>255||['.','..'].includes(p)||/[. ]$/.test(p)||/^(CON|PRN|AUX|NUL|COM[1-9¹²³]|LPT[1-9¹²³])(?:\.|$)/i.test(p))||seen.has(relativePath.toUpperCase()))throw new ApiError('SOURCE_READ_INPUT_INVALID');
  seen.add(relativePath.toUpperCase());return{relativePath,kind:'FILE' as const,access:'READ_ATTRIBUTES' as const,recursive:false as const};
 });
}
function payload(b:SourceReadBuffer):SourceReadRequestV1|{grantRef:Ref;reason:string}{
 if(!text(b.draft.reason,20000)||sensitive(b.draft.reason))throw new ApiError('SOURCE_READ_INPUT_INVALID');
 if(b.operation==='revokeSourceReadObservation'){if(!validRef(b.grantRef)||b.grantRef.version!==1)throw new ApiError('SOURCE_READ_INPUT_INVALID');return{grantRef:{...b.grantRef},reason:b.draft.reason};}
 if(b.operation!=='requestSourceReadObservation'||b.grantRef!==null||![b.source.ref,b.source.connectorRef,b.source.registrationRef,b.source.policyRef].every(validRef)||!instant(b.draft.expiresAt))throw new ApiError('SOURCE_READ_INPUT_INVALID');
 const value={sourceRootRef:{...b.source.ref},connectorRef:{...b.source.connectorRef},registrationRef:{...b.source.registrationRef},targets:targets(b.draft.filesText),expiresAt:b.draft.expiresAt,reason:b.draft.reason};
 if(new TextEncoder().encode(JSON.stringify(value)).length>262144)throw new ApiError('SOURCE_READ_INPUT_INVALID');return value;
}
export async function prepareSourceReadCommand(client:ApiClient,b:SourceReadBuffer,s:DocumentSession):Promise<ProjectCommand>{
 binding(b,s);if(b.pending||b.resultRef||b.uncertain)throw new ApiError('SOURCE_READ_PENDING_LOCKED');const p=payload(b),generation=await documentControl(client,b.projectId,s);
 if(generation!==b.controlGeneration)throw new ApiError('CONTROL_GENERATION_CONFLICT',409);
 const v=await client.get<any>(`/api/v1/projects/${b.projectId}/permission-policy`);
 if(v?.configured!==true||!validRef(v.policy?.ref)||!Array.isArray(v.policy.rules))throw new ApiError('PERMISSION_POLICY_UNCONFIGURED',412);
 const matched=v.policy.rules.filter((r:any)=>r.subjectRef?.kind==='HUMAN'&&r.subjectRef.userId===s.user.id&&Array.isArray(r.operations)&&r.operations.includes(b.operation)&&Array.isArray(r.targetScopes)&&r.targetScopes.some((t:any)=>t.kind==='PROJECT'&&t.projectId===b.projectId)&&instant(r.expiresAt)&&Date.parse(r.expiresAt)>Date.now());
 if(!matched.length||matched.some((r:any)=>r.disposition==='DENY'))throw new ApiError('PROJECT_OPERATION_DENIED',403);
 if(matched.some((r:any)=>r.disposition==='REQUIRE_APPROVAL'))throw new ApiError('SOURCE_READ_APPROVAL_NOT_CONNECTED',412);
 if(!matched.some((r:any)=>r.disposition==='AUTO'))throw new ApiError('PROJECT_OPERATION_DENIED',403);
 if(b.operation==='requestSourceReadObservation'){
  const[root,registration]=await Promise.all([readSourceRoot(client,b.projectId,b.source.ref.id,b.source.ref.version),readHumanRegistration(client,b.projectId,b.source.registrationRef.id)]);
  const fresh=sourceReady(b.projectId,s,generation,root,registration);
  if(!trustSame(fresh.ref,b.source.ref)||fresh.snapshot.declaration.pathHint!==b.source.pathHint||!trustSame(registration.registrationRef,b.source.registrationRef)||!trustSame(registration.connectorRef,b.source.connectorRef)||!trustSame(v.policy.ref,b.source.policyRef)||!trustSame(registration.policyRef,b.source.policyRef))throw new ApiError('SOURCE_READ_BASIS_NOT_CURRENT',412);
  const expiry=Date.parse(b.draft.expiresAt),now=Date.now();if(expiry<=now||expiry-now>7200000||expiry>Math.min(Date.parse(registration.expiresAt),...matched.map((r:any)=>Date.parse(r.expiresAt))))throw new ApiError('SOURCE_READ_EXPIRY_INVALID',422);
 }else{
  const view=await readSourceReadGrant(client,b.projectId,b.grantRef!.id);
  if(!view.rawAllowed||!trustSame(view.grantRef,b.grantRef)||view.storedState==='REVOKED')throw new ApiError('SOURCE_READ_BASIS_NOT_CURRENT',412);
 }
 return{schemaVersion:1,projectId:b.projectId,commandId:crypto.randomUUID(),clientId:s.clientId,controlGeneration:b.controlGeneration,operation:b.operation,targetId:b.grantRef?.id??null,expectedVersion:b.grantRef?.version??0,baselineRefs:[],approvalRef:null,payload:{...p}};
}
export async function sendSourceReadCommand(client:ApiClient,b:SourceReadBuffer,s:DocumentSession){
 binding(b,s);const c=b.pending,p=payload(b);
 if(!c||c.schemaVersion!==1||!uuid(c.commandId)||c.projectId!==b.projectId||c.clientId!==s.clientId||c.controlGeneration!==b.controlGeneration||c.operation!==b.operation||c.targetId!==(b.grantRef?.id??null)||c.expectedVersion!==(b.grantRef?.version??0)||!Array.isArray(c.baselineRefs)||c.baselineRefs.length||c.approvalRef!==null||!trustSame(c.payload,p)||await sourceReadDigest(c)!==b.pendingHash)throw new ApiError('SOURCE_READ_PENDING_CHANGED');
 let response:Response;try{response=await client.transport.call(globalThis,`/api/v1/projects/${b.projectId}/commands`,{method:'POST',credentials:'same-origin',redirect:'error',cache:'no-store',headers:{Accept:'application/json','Content-Type':'application/json','X-Anvil-CSRF':s.csrfToken,'Idempotency-Key':c.commandId},body:JSON.stringify(c)});}catch{throw new ApiError('CONNECTION_LOST');}
 let value:any;try{if(!/^application\/json\b/i.test(response.headers.get('content-type')??''))throw Error();value=await response.json();}catch{throw new ApiError('RESPONSE_INVALID',response.status);}
 if(!response.ok)throw new ApiError(typeof value?.code==='string'&&/^[A-Z_]{1,64}$/.test(value.code)?value.code:'REQUEST_FAILED',response.status);
 if(!exact(value,'operationId,commandId,projectId,status,targetId,version,data,evidenceRefs,warnings,serverReceivedAt')||value.status!=='APPLIED'||value.commandId!==c.commandId||value.projectId!==b.projectId||!uuid(value.operationId)||!instant(value.serverReceivedAt)||!Array.isArray(value.evidenceRefs)||value.evidenceRefs.length||!Array.isArray(value.warnings)||value.warnings.length)throw new ApiError('RESPONSE_INVALID');
 const d=value.data,ref=d?.grantRef;
 if(!validRef(ref)||ref.version!==1||!trustSame(d.ref,ref)||value.targetId!==ref.id||value.version!==1||d.scopeDigest!==ref.contentHash||d.executionAuthorized!==false||d.agentDispatchPerformed!==false||d.baselineConfirmed!==false)throw new ApiError('RESPONSE_INVALID');
 if(b.operation==='revokeSourceReadObservation'){
  if(!exact(d,'ref,status,grantRef,scopeDigest,storedState,executionAuthorized,agentDispatchPerformed,baselineConfirmed')||d.status!=='GRANT_REVOKED'||d.storedState!=='REVOKED'||!trustSame(ref,b.grantRef))throw new ApiError('RESPONSE_INVALID');return{grantRef:ref,scope:null};
 }
 if(!exact(d,'ref,status,grantRef,scopeDigest,storedState,scope,observationPermit,executionAuthorized,agentDispatchPerformed,baselineConfirmed')||d.status!=='GRANT_RECORDED'||d.storedState!=='CREATED'||d.observationPermit!=='NOT_ISSUED')throw new ApiError('RESPONSE_INVALID');
 const scope=d.scope;
 if(!instant(scope?.requestedAt)||!Number.isSafeInteger(scope?.credentialGeneration)||scope.credentialGeneration!==b.source.credentialGeneration)throw new ApiError('RESPONSE_INVALID');
 const expected={...p,protocolVersion:1,purpose:'SOURCE_READ_OBSERVATION',installationId:b.source.installationId,projectId:b.projectId,pathHintHash:await rawHash(b.source.pathHint),hostFingerprint:b.source.hostFingerprint,userId:s.user.id,clientId:s.clientId,credentialGeneration:b.source.credentialGeneration,controlGeneration:b.controlGeneration,policyRef:b.source.policyRef,requestedAt:scope.requestedAt};
 if(!trustSame(scope,expected)||Date.parse(scope.expiresAt)<=Date.parse(scope.requestedAt)||Date.parse(scope.expiresAt)-Date.parse(scope.requestedAt)>7200000||await sourceReadDigest(scope)!==ref.contentHash)throw new ApiError('SOURCE_READ_INTEGRITY_FAILED');
 return{grantRef:ref,scope:scope as SourceReadScopeV1};
}
export function settleSourceReadBuffer(previous:SourceReadBuffer|null,expected:SourceReadBuffer,next:SourceReadBuffer){return previous&&expected.pending&&previous.projectId===expected.projectId&&previous.ownerUserId===expected.ownerUserId&&previous.ownerClientId===expected.ownerClientId&&previous.controlGeneration===expected.controlGeneration&&previous.pending?.commandId===expected.pending.commandId&&previous.pendingHash===expected.pendingHash?next:previous;}
const sharedKeys='projectId,grantRef,snapshotRef,scopeDigest,displayName,targetCount,storedState,effectiveState,invalidReasons,expiresAt,observedAt,executionAuthorized,agentDispatchPerformed,baselineConfirmed';
const storedStates=['CREATED','CHALLENGED','PERMIT_ISSUED','REPORT_STORED','REVOKED'];
const invalidReasons=['REVOKED','EXPIRED','EXCHANGE_ATTEMPT_LIMIT','BASIS_NOT_CURRENT'];
const effectiveStates=[...invalidReasons,'REPORTED_OS_UNVERIFIED','PENDING_REPORT','PENDING_EXCHANGE_PROOF','PENDING_EXCHANGE'];
const hash=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{64}$/.test(v);
const flags=(v:any)=>v.executionAuthorized===false&&v.agentDispatchPerformed===false&&v.baselineConfirmed===false;
export interface SourceReadHit{projectId:string;grantRef:Ref;snapshotRef:Ref|null;scopeDigest:string;displayName:string;targetCount:number;storedState:string;effectiveState:string;invalidReasons:string[];expiresAt:string;observedAt:string;executionAuthorized:false;agentDispatchPerformed:false;baselineConfirmed:false}
export type SourceReadGrantView=SourceReadHit&({rawAllowed:true;scope:SourceReadScopeV1;declaredPathHint:string}|{rawAllowed:false});
function hitValid(v:any,pid:string){return v&&v.projectId===pid&&validRef(v.grantRef)&&v.grantRef.version===1&&(v.snapshotRef===null||validRef(v.snapshotRef)&&v.snapshotRef.version===1)&&v.scopeDigest===v.grantRef.contentHash&&text(v.displayName,200)&&Number.isSafeInteger(v.targetCount)&&v.targetCount>=1&&v.targetCount<=200&&storedStates.includes(v.storedState)&&effectiveStates.includes(v.effectiveState)&&Array.isArray(v.invalidReasons)&&v.invalidReasons.length<=4&&new Set(v.invalidReasons).size===v.invalidReasons.length&&v.invalidReasons.every((r:unknown)=>invalidReasons.includes(String(r)))&&(v.invalidReasons.length?v.effectiveState===v.invalidReasons[0]:true)&&instant(v.expiresAt)&&instant(v.observedAt)&&flags(v);}
async function scopeValid(s:any,pid:string,ref:Ref,path:string){
 if(!exact(s,'protocolVersion,purpose,installationId,projectId,sourceRootRef,connectorRef,registrationRef,pathHintHash,hostFingerprint,userId,clientId,credentialGeneration,controlGeneration,policyRef,requestedAt,expiresAt,targets,reason')||s.protocolVersion!==1||s.purpose!=='SOURCE_READ_OBSERVATION'||s.projectId!==pid||![s.installationId,s.userId,s.clientId].every(uuid)||![s.sourceRootRef,s.connectorRef,s.registrationRef,s.policyRef].every(validRef)||![s.credentialGeneration,s.controlGeneration].every(n=>Number.isSafeInteger(n)&&n>0)||!hash(s.hostFingerprint)||!hash(s.pathHintHash)||!text(path,4096)||await rawHash(path)!==s.pathHintHash||!instant(s.requestedAt)||!instant(s.expiresAt)||Date.parse(s.expiresAt)<=Date.parse(s.requestedAt)||Date.parse(s.expiresAt)-Date.parse(s.requestedAt)>7200000||!text(s.reason,20000)||!Array.isArray(s.targets)||s.targets.length<1||s.targets.length>200)throw new ApiError('SOURCE_READ_INTEGRITY_FAILED');
 const parsed=targets(s.targets.map((t:any)=>t?.relativePath).join('\n'));if(!trustSame(parsed,s.targets)||await sourceReadDigest(s)!==ref.contentHash)throw new ApiError('SOURCE_READ_INTEGRITY_FAILED');
}
export async function readSourceReadGrant(client:ApiClient,pid:string,id:string):Promise<SourceReadGrantView>{
 if(!uuid(pid)||!uuid(id))throw new ApiError('CLIENT_PATH_INVALID');const v=await client.get<any>(`/api/v1/projects/${pid}/source-read-grants/${id}`);
 if(!exact(v,sharedKeys+',rawAllowed'+(v?.rawAllowed===true?',scope,declaredPathHint':''))||!hitValid(v,pid)||v.grantRef.id!==id||typeof v.rawAllowed!=='boolean')throw new ApiError('RESPONSE_INVALID');
 if(v.rawAllowed){await scopeValid(v.scope,pid,v.grantRef,v.declaredPathHint);if(v.targetCount!==v.scope.targets.length||v.expiresAt!==v.scope.expiresAt)throw new ApiError('RESPONSE_INVALID');}return v;
}
export async function listSourceReadGrants(client:ApiClient,pid:string,cursor:string|null=null):Promise<{items:SourceReadHit[];nextCursor:string|null;hasMore:boolean}>{
 if(!uuid(pid)||cursor!==null&&(typeof cursor!=='string'||!cursor||cursor.length>4096))throw new ApiError('CLIENT_PATH_INVALID');const q=new URLSearchParams({limit:'20'});if(cursor)q.set('cursor',cursor);const v=await client.get<any>(`/api/v1/projects/${pid}/source-read-grants?${q}`);
 if(!exact(v,'view,items,hasMore,nextCursor,observedAt')||v.view!=='SOURCE_READ_GRANTS'||!Array.isArray(v.items)||v.items.length>20||v.items.some((i:any)=>!exact(i,sharedKeys)||!hitValid(i,pid))||typeof v.hasMore!=='boolean'||(v.hasMore?typeof v.nextCursor!=='string'||!v.nextCursor||v.nextCursor.length>4096:v.nextCursor!==null)||!instant(v.observedAt))throw new ApiError('RESPONSE_INVALID');return v;
}
export interface SourceReadSummary{rootState:string;total:number;observed:number;missing:number;denied:number;changed:number;unverified:number}
interface SnapshotMetadata{projectId:string;snapshotRef:Ref;grantRef:Ref;sourceRootRef:Ref;connectorRef:Ref;observedSummary:SourceReadSummary;observedAt:string;finishedAt:string;receivedAt:string;evidenceClass:'CONNECTOR_REPORTED';osVerification:'UNVERIFIED';executionAuthorized:false;agentDispatchPerformed:false;baselineConfirmed:false}
export type SourceReadSnapshotView=SnapshotMetadata&({rawAllowed:true;report:SourceReadReportV1}|{rawAllowed:false});
const states=['OBSERVED','MISSING','DENIED','CHANGED','UNVERIFIED'];
const reasons:Record<string,string[]>={MISSING:['PATH_NOT_FOUND'],DENIED:['ACCESS_DENIED','REPARSE_DENIED','OUTSIDE_ROOT','NOT_REGULAR_FILE'],CHANGED:['IDENTITY_CHANGED'],UNVERIFIED:['OBSERVER_UNAVAILABLE','UNSUPPORTED_FILESYSTEM','TIME_LIMIT_REACHED','ROOT_UNAVAILABLE']};
const decimal=(v:unknown)=>typeof v==='string'&&/^(0|[1-9][0-9]{0,19})$/.test(v)&&BigInt(v)<=18446744073709551615n;
function facts(v:any,root:boolean){return exact(v,root?'declaredRootRef,kind,canonicalPath,volumeSerialHex,fileIdHex,reparse':'kind,volumeSerialHex,fileIdHex,sizeBytesDecimal,lastWriteFileTimeDecimal,reparse')&&v.kind===(root?'DIRECTORY':'REGULAR_FILE')&&typeof v.volumeSerialHex==='string'&&/^[0-9a-f]{16}$/.test(v.volumeSerialHex)&&typeof v.fileIdHex==='string'&&/^[0-9a-f]{32}$/.test(v.fileIdHex)&&v.reparse===false&&(root?validRef(v.declaredRootRef)&&text(v.canonicalPath,4096)&&!/[\u0000-\u001f\u007f]/.test(v.canonicalPath):decimal(v.sizeBytesDecimal)&&decimal(v.lastWriteFileTimeDecimal));}
export async function readSourceReadSnapshot(client:ApiClient,pid:string,ref:Ref,grantRef:Ref):Promise<SourceReadSnapshotView>{
 if(!uuid(pid)||!validRef(ref)||ref.version!==1||!validRef(grantRef)||grantRef.version!==1)throw new ApiError('CLIENT_PATH_INVALID');const v=await client.get<any>(`/api/v1/projects/${pid}/source-snapshots/${ref.id}/versions/1`),summary=v?.observedSummary;
 if(!exact(v,'projectId,snapshotRef,grantRef,sourceRootRef,connectorRef,observedSummary,observedAt,finishedAt,receivedAt,evidenceClass,osVerification,executionAuthorized,agentDispatchPerformed,baselineConfirmed,rawAllowed'+(v?.rawAllowed===true?',report':''))||v.projectId!==pid||!trustSame(v.snapshotRef,ref)||!trustSame(v.grantRef,grantRef)||![v.sourceRootRef,v.connectorRef].every(validRef)||!flags(v)||typeof v.rawAllowed!=='boolean'||v.evidenceClass!=='CONNECTOR_REPORTED'||v.osVerification!=='UNVERIFIED'||![v.observedAt,v.finishedAt,v.receivedAt].every(instant)||Date.parse(v.finishedAt)<Date.parse(v.observedAt)||Date.parse(v.finishedAt)-Date.parse(v.observedAt)>30000||Date.parse(v.finishedAt)>Date.parse(v.receivedAt)+30000||!exact(summary,'rootState,total,observed,missing,denied,changed,unverified')||!states.includes(summary.rootState)||![summary.total,summary.observed,summary.missing,summary.denied,summary.changed,summary.unverified].every(n=>Number.isSafeInteger(n)&&n>=0)||summary.total<1||summary.total>200||summary.total!==summary.observed+summary.missing+summary.denied+summary.changed+summary.unverified)throw new ApiError('RESPONSE_INVALID');
 if(v.rawAllowed){const r=v.report;
  if(!exact(r,'protocolVersion,commandId,grantRef,scopeDigest,connectorRef,hostFingerprint,observedAt,finishedAt,root,files,localEvidence,contentHash,signature')||r.protocolVersion!==1||!uuid(r.commandId)||!trustSame(r.grantRef,grantRef)||r.scopeDigest!==grantRef.contentHash||!trustSame(r.connectorRef,v.connectorRef)||!hash(r.hostFingerprint)||r.observedAt!==v.observedAt||r.finishedAt!==v.finishedAt||r.contentHash!==ref.contentHash||typeof r.signature!=='string'||!/^[A-Za-z0-9_-]{86}$/.test(r.signature)||!exact(r.root,'state,facts,reasonCode')||!states.includes(r.root.state)||r.root.state!==summary.rootState||!Array.isArray(r.files)||r.files.length!==summary.total)throw new ApiError('RESPONSE_INVALID');
  if(r.root.state==='OBSERVED'?r.root.reasonCode!==null||!facts(r.root.facts,true)||!trustSame(r.root.facts.declaredRootRef,v.sourceRootRef):r.root.facts!==null||!(r.root.state==='DENIED'?['ACCESS_DENIED','REPARSE_DENIED','OUTSIDE_ROOT','ROOT_KIND_INVALID']:reasons[r.root.state]??[]).includes(r.root.reasonCode))throw new ApiError('RESPONSE_INVALID');
  const parsed=targets(r.files.map((f:any)=>f?.relativePath).join('\n')),counts:Record<string,number>={OBSERVED:0,MISSING:0,DENIED:0,CHANGED:0,UNVERIFIED:0};
  for(let i=0;i<r.files.length;i++){const f=r.files[i];if(!exact(f,'relativePath,state,facts,reasonCode')||f.relativePath!==parsed[i]!.relativePath||!states.includes(f.state)||(f.state==='OBSERVED'?f.reasonCode!==null||!facts(f.facts,false)||f.facts.volumeSerialHex!==r.root.facts?.volumeSerialHex:f.facts!==null||!(reasons[f.state]??[]).includes(f.reasonCode))||r.root.state!=='OBSERVED'&&(f.state!=='UNVERIFIED'||f.reasonCode!=='ROOT_UNAVAILABLE'))throw new ApiError('RESPONSE_INVALID');counts[f.state]!++;}
  if(!trustSame([counts.OBSERVED,counts.MISSING,counts.DENIED,counts.CHANGED,counts.UNVERIFIED],[summary.observed,summary.missing,summary.denied,summary.changed,summary.unverified])||!exact(r.localEvidence,'kind,observerProtocolVersion,observerImageHash,ownedProcessRef')||!['NATIVE_METADATA_REPORT','OBSERVER_UNAVAILABLE'].includes(r.localEvidence.kind)||r.localEvidence.observerProtocolVersion!==1||(r.localEvidence.observerImageHash!==null&&!hash(r.localEvidence.observerImageHash))||(r.localEvidence.ownedProcessRef!==null&&!validRef(r.localEvidence.ownedProcessRef)))throw new ApiError('RESPONSE_INVALID');
  if(r.localEvidence.kind==='OBSERVER_UNAVAILABLE'&&(r.localEvidence.observerImageHash!==null||r.localEvidence.ownedProcessRef!==null||r.root.state!=='UNVERIFIED'||r.root.reasonCode!=='OBSERVER_UNAVAILABLE'))throw new ApiError('RESPONSE_INVALID');
  const{contentHash,signature,...body}=r;if(await sourceReadDigest(body)!==contentHash)throw new ApiError('SOURCE_READ_INTEGRITY_FAILED');
 }return v;
}
