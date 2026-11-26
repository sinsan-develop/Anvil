import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {arrayV1,cloneV1,isoV1,recordV1,refV1,uuidV1,type RuntimeRefV1 as Ref} from '../../../../contracts/runtime/validation-v1.ts';
import {readSourceScopesV1,type SourceScopeV1} from '../../../../contracts/runtime/source-scope-v1.ts';
import {AccessRepository,AuthFailure,type AuthenticatedIdentity} from '../access/repository.ts';
import {currentProjectController,persistProjectReceipt,projectReplay,recordProjectDenial,type ProjectCommand} from '../access/project-command.ts';
import {assertKnowledgeTextSafe} from '../knowledge/knowledge-entry.ts';
import {authorizeRuntimePolicy,ProjectLimitPolicies} from './runtime-policy.ts';
import {readSyntheticGrantRevocationRecord} from './execution-grant-revocation.ts';
type Scope={projectId:string;executionId:string;executionGeneration:number};
type Subject={userId:string;clientId:string;humanSessionId:string;credentialGeneration:number;controlGeneration:number};
interface Current{transport:'NORMAL_PROTECTED';scope:Scope;grantRef:Ref;grantKind:'EXECUTION';grantSubject:Subject;grantState:'ACTIVE'|'EXPIRED'|'REVOKED';sourceScopes:SourceScopeV1[];permissionPolicyRef:Ref;budgetPolicyRef:Ref;checkedAt:string;expiresAt:string}
interface Snapshot{transport:'NORMAL_PROTECTED';state:'NORMAL_REVOCATION_STORED';scope:Scope;request:ProjectCommand;requestHash:string;requestedBy:Subject;currentBinding:Omit<Current,'checkedAt'|'expiresAt'>;reason:string;recordedAt:string;authorityExpiresAt:string;revocationEffectiveVerified:false;credentialRevocationVerified:false;writerReleaseVerified:false;executionAuthorized:false;dispatchPerformed:false}
export interface NormalGrantRevocationRecord{ref:Ref;snapshot:Snapshot}
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b),hash=(v:unknown)=>contentHash(canonicalJson(v)),positive=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>0;
const fail=(code='GRANT_REVOCATION_INPUT_INVALID',status=412):never=>{throw new AuthFailure(code,status);};
function requestOf(raw:unknown):ProjectCommand{
 if(!recordV1(raw,['schemaVersion','projectId','commandId','clientId','controlGeneration','operation','targetId','expectedVersion','baselineRefs','approvalRef','payload'])||raw.schemaVersion!==1||!uuidV1(raw.projectId)||!uuidV1(raw.commandId)||!uuidV1(raw.clientId)||!positive(raw.controlGeneration)||raw.operation!=='revokeExecutionGrant'||!uuidV1(raw.targetId)||!positive(raw.expectedVersion)||!arrayV1(raw.baselineRefs,0)||raw.approvalRef!==null||Buffer.byteLength(canonicalJson(raw))>2097152)return fail();
 const p=raw.payload;if(!recordV1(p,['grantRef','permissionPolicyRef','budgetPolicyRef','reason'])||![p.grantRef,p.permissionPolicyRef,p.budgetPolicyRef].every(refV1)||typeof p.reason!=='string'||!p.reason.trim()||p.reason.length>20000)return fail();assertKnowledgeTextSafe(p.reason);return cloneV1(raw) as unknown as ProjectCommand;
}
function currentOf(raw:unknown,scope:Scope,request:ProjectCommand,at:number){
 if(!recordV1(raw,['transport','scope','grantRef','grantKind','grantSubject','grantState','sourceScopes','permissionPolicyRef','budgetPolicyRef','checkedAt','expiresAt'])||raw.transport!=='NORMAL_PROTECTED'||!same(raw.scope,scope)||raw.grantKind!=='EXECUTION'||!['ACTIVE','EXPIRED','REVOKED'].includes(raw.grantState)||![raw.grantRef,raw.permissionPolicyRef,raw.budgetPolicyRef].every(refV1)||!isoV1(raw.checkedAt)||!isoV1(raw.expiresAt)||Date.parse(raw.checkedAt)>at||at-Date.parse(raw.checkedAt)>30000||Date.parse(raw.expiresAt)<=at||Buffer.byteLength(canonicalJson(raw))>2097152)return fail('GRANT_REVOCATION_CURRENT_REQUIRED');
 const s=raw.grantSubject;if(!recordV1(s,['userId','clientId','humanSessionId','credentialGeneration','controlGeneration'])||![s.userId,s.clientId,s.humanSessionId].every(uuidV1)||!positive(s.credentialGeneration)||!positive(s.controlGeneration))return fail('GRANT_REVOCATION_CURRENT_REQUIRED');readSourceScopesV1(raw.sourceScopes);
 const c=cloneV1(raw) as unknown as Current,p=request.payload;if(!same(c.grantRef,p.grantRef)||!same(c.permissionPolicyRef,p.permissionPolicyRef)||!same(c.budgetPolicyRef,p.budgetPolicyRef))return fail('GRANT_REVOCATION_TARGET_CHANGED');const{checkedAt:_,expiresAt:__,...binding}=c;return{c,binding};
}
/** 과거 기록의 문법/결박만 검사한다. 현재 허가나 실제 회수 효과를 재부여하지 않는다. */
export function readNormalGrantRevocationRecord(raw:unknown,scope:Scope):NormalGrantRevocationRecord{
 if(!recordV1(scope,['projectId','executionId','executionGeneration'])||!uuidV1(scope.projectId)||!uuidV1(scope.executionId)||!positive(scope.executionGeneration)||!recordV1(raw,['ref','snapshot'])||!refV1(raw.ref)||raw.ref.version!==1||!recordV1(raw.snapshot,['transport','state','scope','request','requestHash','requestedBy','currentBinding','reason','recordedAt','authorityExpiresAt','revocationEffectiveVerified','credentialRevocationVerified','writerReleaseVerified','executionAuthorized','dispatchPerformed'])||Buffer.byteLength(canonicalJson(raw))>2097152)return fail('GRANT_REVOCATION_RECORD_INVALID',503);
 const s=raw.snapshot,r=s.requestedBy;if(s.transport!=='NORMAL_PROTECTED'||s.state!=='NORMAL_REVOCATION_STORED'||!same(s.scope,scope)||raw.ref.contentHash!==hash(s)||s.revocationEffectiveVerified!==false||s.credentialRevocationVerified!==false||s.writerReleaseVerified!==false||s.executionAuthorized!==false||s.dispatchPerformed!==false||!isoV1(s.recordedAt)||!isoV1(s.authorityExpiresAt)||Date.parse(s.authorityExpiresAt)<=Date.parse(s.recordedAt)||Date.parse(s.authorityExpiresAt)>Date.parse(s.recordedAt)+30000||!recordV1(r,['userId','clientId','humanSessionId','credentialGeneration','controlGeneration'])||![r.userId,r.clientId,r.humanSessionId].every(uuidV1)||!positive(r.credentialGeneration)||!positive(r.controlGeneration))return fail('GRANT_REVOCATION_RECORD_INVALID',503);
 const request=requestOf(s.request),bound=currentOf({...s.currentBinding,checkedAt:s.recordedAt,expiresAt:s.authorityExpiresAt},scope,request,Date.parse(s.recordedAt));
 if(!same(bound.binding,s.currentBinding)||bound.c.grantState==='REVOKED'||request.projectId!==scope.projectId||request.targetId!==scope.executionId||request.expectedVersion!==scope.executionGeneration||request.clientId!==r.clientId||request.controlGeneration!==r.controlGeneration||s.requestHash!==hash(request)||s.reason!==request.payload.reason)return fail('GRANT_REVOCATION_RECORD_INVALID',503);return cloneV1(raw) as unknown as NormalGrantRevocationRecord;
}

export interface NormalGrantRevocationOptions {mode:'NORMAL_PROTECTED'}
/** 현재 회수자의 인증 거래만 사용한다. 원 발급자 로그인·OS 관측·기한은 새 회수 권위가 아니다. */
export class NormalGrantRevocations {
 readonly #access:AccessRepository;readonly #policies:Pick<ProjectLimitPolicies,'resolveCurrent'>;
 constructor(access:AccessRepository,policies:Pick<ProjectLimitPolicies,'resolveCurrent'>=new ProjectLimitPolicies()){this.#access=access;this.#policies=policies;}
 async #now(db:PoolClient){const at=(await db.query('SELECT clock_timestamp() AS at')).rows[0]?.at;if(!(at instanceof Date)||!Number.isFinite(at.getTime()))return fail('GRANT_REVOCATION_CLOCK_INVALID',503);return at.getTime();}
 #human(actor:AuthenticatedIdentity,at:number){const s=actor.authSession;if(!s||!uuidV1(s.id)||!isoV1(s.idleExpiresAt)||!isoV1(s.absoluteExpiresAt))return fail('GRANT_REVOCATION_HUMAN_REQUIRED');const end=Math.min(Date.parse(s.idleExpiresAt),Date.parse(s.absoluteExpiresAt));if(end<=at)return fail('GRANT_REVOCATION_HUMAN_EXPIRED');return end;}
 async #grant(db:PoolClient,request:ProjectCommand,legacy=false){
  const ref=request.payload.grantRef as Ref;
  const rows=(await db.query('SELECT g.*, (SELECT max(x.generation) FROM anvil.executions x WHERE x.project_id=g.project_id AND x.id=g.execution_id) AS current_generation FROM anvil.execution_grants g JOIN anvil.executions e ON e.project_id=g.project_id AND e.id=g.execution_id AND e.generation=g.generation WHERE g.project_id=$1 AND g.execution_id=$2 AND g.id=$3 AND g.version=$4 FOR SHARE OF g,e',[request.projectId,request.targetId,ref.id,ref.version])).rows;
  if(rows.length!==1)return fail('GRANT_REVOCATION_TARGET_CHANGED');const g=rows[0],s=g.snapshot_json,b=s?.binding;
  if(g.project_id!==request.projectId||g.execution_id!==request.targetId||Number(g.generation)!==request.expectedVersion||Number(g.current_generation)!==request.expectedVersion||g.id!==ref.id||Number(g.version)!==ref.version||g.content_hash!==ref.contentHash||g.content_hash!==hash(s)||!isoV1(s?.expiresAt)||s.executionAuthorized!==false||s.dispatchPerformed!==false)return fail('GRANT_REVOCATION_TARGET_CHANGED');
  if(legacy){if(s.transport!=='SYNTHETIC_ONLY')return fail('GRANT_REVOCATION_TARGET_CHANGED');return {g,s,subject:s.kind==='EXECUTION'?b?.subject:s.kind==='RECOVERY'?(({kind:_,...subject})=>subject)(s.reviewer??{}):null,scopes:s.kind==='EXECUTION'?b?.intent?.sourceScopes:b?.sourceScopes};}
  if(!recordV1(s,['kind','state','transport','binding','allowedOperations','expiresAt','scopeDigest','factHash','plannedAt','executionAuthorized','dispatchPerformed'])||s.transport!=='NORMAL_PROTECTED'||s.state!=='GRANTED'||s.kind!=='EXECUTION'||Number(g.version)!==1||!isoV1(s.plannedAt)||Date.parse(s.plannedAt)>=Date.parse(s.expiresAt)||!same(s.allowedOperations,['START_SESSION','SEND_INSTRUCTION','REQUEST_STOP'])||s.factHash!==hash(b)||s.scopeDigest!==hash({binding:b,allowedOperations:s.allowedOperations,expiresAt:s.expiresAt})||b?.transport!=='NORMAL_PROTECTED'||b.projectId!==request.projectId||b.executionId!==request.targetId||b.executionGeneration!==request.expectedVersion)return fail('GRANT_REVOCATION_TARGET_CHANGED');
  const subject=b.subject;if(!recordV1(subject,['userId','clientId','humanSessionId','credentialGeneration','controlGeneration'])||![subject.userId,subject.clientId,subject.humanSessionId].every(uuidV1)||!positive(subject.credentialGeneration)||!positive(subject.controlGeneration))return fail('GRANT_REVOCATION_TARGET_CHANGED');
  readSourceScopesV1(b.intent?.sourceScopes);return {g,s,subject,scopes:b.intent.sourceScopes};
 }
 async #current(db:PoolClient,request:ProjectCommand,scope:Scope){
  const {s,subject,scopes}=await this.#grant(db,request),ref=request.payload.grantRef as Ref;
  const revoked=(await db.query("SELECT id,version,content_hash FROM anvil.execution_grant_revocations WHERE project_id=$1 AND execution_id=$2 AND generation=$3 AND grant_id=$4 AND grant_version=$5 AND created_command_id IS DISTINCT FROM nullif(current_setting('anvil.command_id',true),'')::uuid LIMIT 2",[scope.projectId,scope.executionId,scope.executionGeneration,ref.id,ref.version])).rows;
  if(revoked.length>1||revoked.some(r=>!refV1({id:r.id,version:Number(r.version),contentHash:r.content_hash})))return fail('GRANT_REVOCATION_RECORD_INVALID',503);
  const at=await this.#now(db);
  return currentOf({transport:'NORMAL_PROTECTED',scope,grantRef:ref,grantKind:'EXECUTION',grantSubject:subject,grantState:revoked.length?'REVOKED':Date.parse(s.expiresAt)<=at?'EXPIRED':'ACTIVE',sourceScopes:scopes,permissionPolicyRef:request.payload.permissionPolicyRef,budgetPolicyRef:request.payload.budgetPolicyRef,checkedAt:new Date(at).toISOString(),expiresAt:new Date(at+30000).toISOString()},scope,request,at);
 }
 async #append(db:PoolClient,scope:Scope,record:NormalGrantRevocationRecord,cid:string){
  const s=record.snapshot,r=s.requestedBy,b=s.currentBinding;
  const quota=(await db.query("SELECT count(*)::int AS count,COALESCE(sum(octet_length(anvil.execution_authority_canonical(jsonb_build_object('ref',jsonb_build_object('id',id,'version',version,'contentHash',content_hash),'snapshot',snapshot_json)))),0)::bigint AS total FROM anvil.execution_grant_revocations WHERE project_id=$1 AND execution_id=$2 AND generation=$3",[scope.projectId,scope.executionId,scope.executionGeneration])).rows[0];
  if(!quota||!Number.isSafeInteger(Number(quota.count))||Number(quota.count)<0||Number(quota.count)>=100||!Number.isSafeInteger(Number(quota.total))||Number(quota.total)<0||Number(quota.total)+Buffer.byteLength(canonicalJson(record))>2097152)return fail('GRANT_REVOCATION_TOO_LARGE',422);
  const written=await db.query('INSERT INTO anvil.execution_grant_revocations(project_id,id,version,execution_id,generation,grant_id,grant_version,content_hash,snapshot_json,created_by,client_id,created_command_id) VALUES($1,$2,1,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[scope.projectId,record.ref.id,scope.executionId,scope.executionGeneration,b.grantRef.id,b.grantRef.version,record.ref.contentHash,JSON.stringify(s),r.userId,r.clientId,cid]);if(written.rowCount!==1)return fail('GRANT_REVOCATION_STORAGE_FAILED',503);
 }
 async #readReplay(db:PoolClient,actor:AuthenticatedIdentity,request:ProjectCommand,scope:Scope,previous:unknown){
  try{
   if(!recordV1(previous,['operationId','commandId','projectId','status','targetId','version','data','evidenceRefs','warnings','serverReceivedAt'])
    ||previous.status!=='APPLIED'||!uuidV1(previous.operationId)||previous.projectId!==scope.projectId||previous.commandId!==request.commandId
    ||previous.version!==1||!arrayV1(previous.evidenceRefs,0)||!arrayV1(previous.warnings,0)||!isoV1(previous.serverReceivedAt))return fail('GRANT_REVOCATION_RECORD_INVALID',503);
   const data=previous.data;
   if(!recordV1(data,['ref','snapshot','status','revocationEffectiveVerified','credentialRevocationVerified','writerReleaseVerified','executionAuthorized','dispatchPerformed'])
    ||data.revocationEffectiveVerified!==false||data.credentialRevocationVerified!==false||data.writerReleaseVerified!==false
    ||data.executionAuthorized!==false||data.dispatchPerformed!==false)return fail('GRANT_REVOCATION_RECORD_INVALID',503);
   const legacy=data.status==='SYNTHETIC_GRANT_REVOCATION_STORED';
   if(!legacy&&data.status!=='NORMAL_GRANT_REVOCATION_STORED')return fail('GRANT_REVOCATION_RECORD_INVALID',503);
   const record=legacy?readSyntheticGrantRevocationRecord({ref:data.ref,snapshot:data.snapshot},scope):readNormalGrantRevocationRecord({ref:data.ref,snapshot:data.snapshot},scope);
   const {ref,snapshot:s}=record,b=s.currentBinding;
   if(previous.targetId!==ref.id||!same(s.request,request)||s.requestedBy.userId!==actor.actorId||s.requestedBy.clientId!==actor.clientId)return fail('GRANT_REVOCATION_RECORD_INVALID',503);
   const {rows}=await db.query(`
SELECT r.project_id,r.id,r.version,r.execution_id,r.generation,r.grant_id,r.grant_version,r.content_hash,r.snapshot_json,
 r.created_by,r.client_id,r.created_command_id,r.created_at,
 c.id AS origin_id,c.scope_kind,c.scope_id,c.draft_id,c.operation,c.state,c.actor_id,c.client_id AS command_client_id,c.command_id,
 c.control_generation,c.expected_version,c.request_hash,c.operation_id,c.authorization_receipt_id,c.approval_consumption_id,
 c.policy_ref,c.payload_ref,c.result_ref,c.completed_at,ar.authorized_at,a.recorded_at,
 jsonb_build_object('id',ar.id,'command_id',ar.command_id,'scope_kind',ar.scope_kind,'scope_id',ar.scope_id,'subject_ref',ar.subject_ref,
  'policy_ref',ar.policy_ref,'scope_digest',ar.scope_digest,'approval_decision_ref',ar.approval_decision_ref) AS receipt,
 jsonb_build_object('project_id',a.project_id,'command_id',a.command_id,'operation_id',a.operation_id,'event_id',a.event_id,'actor_ref',a.actor_ref,
  'client_ref',a.client_ref,'policy_ref',a.policy_ref,'target_ref',a.target_ref,'approval_ref',a.approval_ref,'correction_of',a.correction_of,
  'outcome',a.outcome,'source_kind',a.source_kind,'reason_code',a.reason_code,'scope_digest',a.scope_digest) AS audit
FROM anvil.execution_grant_revocations r
JOIN anvil.commands c ON c.project_id=r.project_id AND c.id=r.created_command_id
JOIN anvil.authorization_receipts ar ON ar.id=c.authorization_receipt_id AND ar.command_id=c.id
JOIN anvil.audit_events a ON a.project_id=c.project_id AND a.command_id=c.id
WHERE r.project_id=$1 AND r.id=$2 LIMIT 2`,[scope.projectId,ref.id]);
   if(rows.length!==1)return fail('GRANT_REVOCATION_RECORD_INVALID',503);
   const row=rows[0],ar=row.receipt,a=row.audit;
   const {projectId,executionId,executionGeneration}=scope,{actorId,clientId}=actor,requestHash=hash(request),policyRef=b.permissionPolicyRef;
   const scopeDigest=hash({projectId,actorId,clientId,controlGeneration:request.controlGeneration,requestHash,policyRef,targetRef:ref});
   const storedAt=(v:unknown)=>v instanceof Date&&v.toISOString()===previous.serverReceivedAt;
   // 원 permission/회수창은 과거 사실이다. 재확인의 현재 제어·정책 검사는 이어서 수행한다.
   if(row.project_id!==projectId||row.id!==ref.id||String(row.version)!=='1'||row.content_hash!==ref.contentHash||!same(row.snapshot_json,s)
    ||row.execution_id!==executionId||String(row.generation)!==String(executionGeneration)||row.grant_id!==b.grantRef.id||String(row.grant_version)!==String(b.grantRef.version)
    ||row.created_by!==actorId||row.client_id!==clientId||!uuidV1(row.created_command_id)||row.origin_id!==row.created_command_id||!storedAt(row.created_at)
    ||row.scope_kind!=='PROJECT'||row.scope_id!==projectId||row.draft_id!==null||row.operation!==request.operation||row.state!=='APPLIED'
    ||row.actor_id!==actorId||row.command_client_id!==clientId||row.command_id!==request.commandId||row.request_hash!==requestHash
    ||String(row.control_generation)!==String(request.controlGeneration)||String(row.expected_version)!==String(executionGeneration)
    ||row.operation_id!==previous.operationId||!uuidV1(row.authorization_receipt_id)||row.approval_consumption_id!==null||row.payload_ref!==null
    ||!same(row.policy_ref,policyRef)||!same(row.result_ref,previous)||!storedAt(row.completed_at)
    ||!ar||ar.id!==row.authorization_receipt_id||ar.command_id!==row.created_command_id||ar.scope_kind!=='PROJECT'||ar.scope_id!==projectId
    ||!same(ar.subject_ref,{kind:'HUMAN',userId:actorId,clientId})||!same(ar.policy_ref,policyRef)||ar.approval_decision_ref!==null||ar.scope_digest!==scopeDigest||!storedAt(row.authorized_at)
    ||!a||a.project_id!==projectId||a.command_id!==row.created_command_id||a.operation_id!==row.operation_id||!uuidV1(a.event_id)
    ||!same(a.actor_ref,{kind:'HUMAN',userId:actorId})||a.client_ref!==clientId||!same(a.policy_ref,policyRef)||!same(a.target_ref,ref)
    ||a.approval_ref!==null||a.correction_of!==null||a.outcome!=='APPLIED'||a.source_kind!=='HUMAN_COMMAND'||a.scope_digest!==scopeDigest
    ||a.reason_code!==(legacy?'EXPLICIT_SYNTHETIC_GRANT_REVOCATION_ONLY':'EXPLICIT_NORMAL_GRANT_REVOCATION')||!storedAt(row.recorded_at))return fail('GRANT_REVOCATION_RECORD_INVALID',503);
   return {legacy,record};
  }catch{return fail('GRANT_REVOCATION_RECORD_INVALID',503);}
 }
 async command(token:string,csrf:string,value:ProjectCommand){
  const request=requestOf(value),scope={projectId:request.projectId,executionId:request.targetId!,executionGeneration:request.expectedVersion};
  try{return await this.#access.authenticated(token,csrf,async(db,actor)=>{
   await currentProjectController(db,actor,request);this.#human(actor,await this.#now(db));
   const previous=await projectReplay(db,actor,request);
   if(previous!==undefined){
    const {legacy,record}=await this.#readReplay(db,actor,request,scope,previous),b=record.snapshot.currentBinding;
    const g=await this.#grant(db,request,legacy);if(!same(g.subject,b.grantSubject)||!same(g.scopes,b.sourceScopes)||g.s.kind!==b.grantKind)return fail('GRANT_REVOCATION_TARGET_CHANGED');
    await authorizeRuntimePolicy(db,actor,request,{executionId:scope.executionId,executionGeneration:scope.executionGeneration,permissionPolicyRef:b.permissionPolicyRef,budgetPolicyRef:b.budgetPolicyRef,sourceScopes:b.sourceScopes},this.#policies);
    const identity=await this.#access.authenticateInTransaction(db,token,csrf);
    if(identity.actorId!==actor.actorId||identity.clientId!==actor.clientId||identity.credentialGeneration!==actor.credentialGeneration||identity.authSession?.id!==actor.authSession?.id)return fail('GRANT_REVOCATION_CURRENT_CHANGED');
    const policy=await authorizeRuntimePolicy(db,identity,request,{executionId:scope.executionId,executionGeneration:scope.executionGeneration,permissionPolicyRef:b.permissionPolicyRef,budgetPolicyRef:b.budgetPolicyRef,sourceScopes:b.sourceScopes},this.#policies);
    const at=await this.#now(db);if(at>=Math.min(this.#human(identity,at),policy.validUntil))return fail('GRANT_REVOCATION_EXPIRED');return previous;
   }
   const first=await this.#current(db,request,scope),input={executionId:scope.executionId,executionGeneration:scope.executionGeneration,permissionPolicyRef:first.c.permissionPolicyRef,budgetPolicyRef:first.c.budgetPolicyRef,sourceScopes:first.c.sourceScopes};
   let policy=await authorizeRuntimePolicy(db,actor,request,input,this.#policies);if(first.c.grantState==='REVOKED')return fail('GRANT_ALREADY_REVOKED',409);
   const next=await this.#current(db,request,scope);if(!same(first.binding,next.binding))return fail('GRANT_REVOCATION_CURRENT_CHANGED');policy=await authorizeRuntimePolicy(db,actor,request,input,this.#policies);
   let at=await this.#now(db);const deadline=Math.min(at+30000,this.#human(actor,at),policy.validUntil);if(deadline<=at)return fail('GRANT_REVOCATION_EXPIRED');
   const snapshot:Snapshot={transport:'NORMAL_PROTECTED',state:'NORMAL_REVOCATION_STORED',scope,request,requestHash:hash(request),requestedBy:{userId:actor.actorId,clientId:actor.clientId,humanSessionId:actor.authSession!.id,credentialGeneration:actor.credentialGeneration,controlGeneration:request.controlGeneration},currentBinding:first.binding,reason:request.payload.reason as string,recordedAt:new Date(at).toISOString(),authorityExpiresAt:new Date(deadline).toISOString(),revocationEffectiveVerified:false,credentialRevocationVerified:false,writerReleaseVerified:false,executionAuthorized:false,dispatchPerformed:false};
   const ref={id:randomUUID(),version:1,contentHash:hash(snapshot)},record=readNormalGrantRevocationRecord({ref,snapshot},scope);
   const receipt=await persistProjectReceipt(db,actor,request,ref,{status:'NORMAL_GRANT_REVOCATION_STORED',snapshot,revocationEffectiveVerified:false,credentialRevocationVerified:false,writerReleaseVerified:false,executionAuthorized:false,dispatchPerformed:false},policy.policyRef,'EXPLICIT_NORMAL_GRANT_REVOCATION');
   await this.#append(db,scope,record,receipt.id);
   const final=await this.#current(db,request,scope);if(!same(first.binding,final.binding))return fail('GRANT_REVOCATION_CURRENT_CHANGED');
   const identity=await this.#access.authenticateInTransaction(db,token,csrf);if(identity.actorId!==actor.actorId||identity.clientId!==actor.clientId||identity.credentialGeneration!==actor.credentialGeneration||identity.authSession?.id!==actor.authSession?.id)return fail('GRANT_REVOCATION_CURRENT_CHANGED');
   const finalPolicy=await authorizeRuntimePolicy(db,identity,request,input,this.#policies);at=await this.#now(db);if(finalPolicy.validUntil<deadline||at>=Math.min(deadline,this.#human(identity,at)))return fail('GRANT_REVOCATION_EXPIRED');return receipt.result;
  });}catch(error){await recordProjectDenial(this.#access,token,request.projectId,error);throw error;}
 }
}
