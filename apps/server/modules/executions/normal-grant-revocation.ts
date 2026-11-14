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
 async command(token:string,csrf:string,value:ProjectCommand){
  const request=requestOf(value),scope={projectId:request.projectId,executionId:request.targetId!,executionGeneration:request.expectedVersion};
  try{return await this.#access.authenticated(token,csrf,async(db,actor)=>{
   await currentProjectController(db,actor,request);this.#human(actor,await this.#now(db));
   const previous:any=await projectReplay(db,actor,request);
   if(previous!==undefined){
    const data=previous?.data,legacy=data?.status==='SYNTHETIC_GRANT_REVOCATION_STORED';
    if(!data||(!legacy&&data.status!=='NORMAL_GRANT_REVOCATION_STORED')||previous.status!=='APPLIED'||previous.projectId!==scope.projectId||previous.commandId!==request.commandId||previous.targetId!==data.ref?.id||previous.version!==1||['revocationEffectiveVerified','credentialRevocationVerified','writerReleaseVerified','executionAuthorized','dispatchPerformed'].some(k=>data[k]!==false))return fail('GRANT_REVOCATION_RECORD_INVALID',503);
    const record=legacy?readSyntheticGrantRevocationRecord({ref:data.ref,snapshot:data.snapshot},scope):readNormalGrantRevocationRecord({ref:data.ref,snapshot:data.snapshot},scope),s=record.snapshot,b=s.currentBinding;
    if(!same(s.request,request)||s.requestedBy.userId!==actor.actorId||s.requestedBy.clientId!==actor.clientId)return fail('GRANT_REVOCATION_RECORD_INVALID',503);
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
