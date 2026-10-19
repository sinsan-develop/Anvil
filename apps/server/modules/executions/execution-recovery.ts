import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {arrayV1,cloneV1,recordV1,uuidV1,refV1,hashV1,isoV1,type RuntimeRefV1 as Ref} from '../../../../contracts/runtime/validation-v1.ts';
import {readSourceScopesV1,type SourceScopeV1} from '../../../../contracts/runtime/source-scope-v1.ts';
import {AccessRepository,AuthFailure,type AuthenticatedIdentity} from '../access/repository.ts';
import {currentProjectController,persistProjectReceipt,projectReplay,recordProjectDenial,type ProjectCommand} from '../access/project-command.ts';
import {assertKnowledgeTextSafe} from '../knowledge/knowledge-entry.ts';
import {authorizeRuntimePolicy,ProjectLimitPolicies} from './runtime-policy.ts';
type Scope={projectId:string;executionId:string;executionGeneration:number};
type Ack={sequence:number;batchRef:Ref|null};
type Process={state:'KNOWN';ref:Ref}|{state:'UNKNOWN'};
type Input={lastServerAck:Ack;processIdentity:Process;permissionPolicyRef:Ref;budgetPolicyRef:Ref;purpose:'RECOVER_OBSERVATIONS_AND_REQUEST_GRACEFUL_STOP';reason:string};
interface Current{transport:'SYNTHETIC_ONLY';scope:Scope;originalGrantRef:Ref;originalGrantState:'ACTIVE'|'REVOKED'|'EXPIRED';lastServerAck:Ack;processIdentity:Process;responsibleSessionRef:Ref;
 registration:{ref:Ref;connectorId:string;generation:number;hostPublicKeyFingerprint:string};sourceScopes:SourceScopeV1[];permissionPolicyRef:Ref;budgetPolicyRef:Ref;hostTrustState:'TRUSTED';recoveryPathState:'VERIFIED_CURRENT';checkedAt:string;expiresAt:string}
interface RecoverySnapshot{kind:'RECOVERY';state:'SYNTHETIC_PLAN';transport:'SYNTHETIC_ONLY';scope:Scope;request:ProjectCommand;requestHash:string;
 reviewer:{kind:'HUMAN';userId:string;clientId:string;humanSessionId:string;credentialGeneration:number;controlGeneration:number};binding:Omit<Current,'checkedAt'|'expiresAt'>;
 allowedOperations:['SYNC_OBSERVATIONS','READ_STOP_INSTRUCTION','REPORT_STOP','HEARTBEAT'];plannedAt:string;expiresAt:string;scopeDigest:string;executionAuthorized:false;dispatchPerformed:false;writerReleaseVerified:false}
export interface SyntheticRecoveryRecord{ref:Ref;snapshot:RecoverySnapshot}
/** 같은 인증 transaction에서 현재 실행/ACK/host·불변 append를 제공한다. 실환경/HTTP fallback은 없다.
 * RECOVERY 저장은 새 실행 credential 발급·OS 중지/소유 회수 또는 자료 읽기 허가가 아니다. */
export interface SyntheticRecoveryStore{readonly transport:'SYNTHETIC_ONLY';current(db:PoolClient,actor:AuthenticatedIdentity,scope:Scope):Promise<Current>;
 append(db:PoolClient,scope:Scope,record:SyntheticRecoveryRecord,createdCommandId:string):Promise<void>}
const hash=(v:unknown)=>contentHash(canonicalJson(v)),same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b),positive=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>0;
const fail=(code='RECOVERY_INPUT_INVALID',status=412):never=>{throw new AuthFailure(code,status);};
const scopeValid=(v:unknown):v is Scope=>recordV1(v,['projectId','executionId','executionGeneration'])&&uuidV1(v.projectId)&&uuidV1(v.executionId)&&positive(v.executionGeneration);
const ackValid=(v:unknown):v is Ack=>recordV1(v,['sequence','batchRef'])&&Number.isSafeInteger(v.sequence)&&v.sequence>=0&&(v.sequence===0?v.batchRef===null:refV1(v.batchRef));
const processValid=(v:unknown):v is Process=>recordV1(v,['state'])&&v.state==='UNKNOWN'||recordV1(v,['state','ref'])&&v.state==='KNOWN'&&refV1(v.ref);
function readRequest(raw:unknown):ProjectCommand{
 if(!recordV1(raw,['schemaVersion','projectId','commandId','clientId','controlGeneration','operation','targetId','expectedVersion','baselineRefs','approvalRef','payload'])||raw.schemaVersion!==1||!uuidV1(raw.projectId)||!uuidV1(raw.commandId)||!uuidV1(raw.clientId)||!positive(raw.controlGeneration)||raw.operation!=='authorizeExecutionRecovery'||!uuidV1(raw.targetId)||!positive(raw.expectedVersion)||!arrayV1(raw.baselineRefs,0)||raw.approvalRef!==null||Buffer.byteLength(canonicalJson(raw))>2097152)return fail();
 const p=raw.payload;if(!recordV1(p,['lastServerAck','processIdentity','permissionPolicyRef','budgetPolicyRef','purpose','reason'])||!ackValid(p.lastServerAck)||!processValid(p.processIdentity)||!refV1(p.permissionPolicyRef)||!refV1(p.budgetPolicyRef)||p.purpose!=='RECOVER_OBSERVATIONS_AND_REQUEST_GRACEFUL_STOP'||typeof p.reason!=='string'||!p.reason.trim()||p.reason.length>20000)return fail();assertKnowledgeTextSafe(p.reason);return cloneV1(raw) as unknown as ProjectCommand;
}
function current(raw:unknown,scope:Scope,at:number){
 if(!recordV1(raw,['transport','scope','originalGrantRef','originalGrantState','lastServerAck','processIdentity','responsibleSessionRef','registration','sourceScopes','permissionPolicyRef','budgetPolicyRef','hostTrustState','recoveryPathState','checkedAt','expiresAt'])||raw.transport!=='SYNTHETIC_ONLY'||!scopeValid(raw.scope)||!same(raw.scope,scope)||!refV1(raw.originalGrantRef)||!['ACTIVE','REVOKED','EXPIRED'].includes(raw.originalGrantState)||!ackValid(raw.lastServerAck)||!processValid(raw.processIdentity)||!refV1(raw.responsibleSessionRef)||!recordV1(raw.registration,['ref','connectorId','generation','hostPublicKeyFingerprint'])||!refV1(raw.registration.ref)||!uuidV1(raw.registration.connectorId)||!positive(raw.registration.generation)||!hashV1(raw.registration.hostPublicKeyFingerprint)||!refV1(raw.permissionPolicyRef)||!refV1(raw.budgetPolicyRef)||raw.hostTrustState!=='TRUSTED'||raw.recoveryPathState!=='VERIFIED_CURRENT'||!isoV1(raw.checkedAt)||!isoV1(raw.expiresAt)||Date.parse(raw.checkedAt)>at||at-Date.parse(raw.checkedAt)>30000||Date.parse(raw.expiresAt)<=at||Buffer.byteLength(canonicalJson(raw))>2097152)return fail('RECOVERY_CURRENT_REQUIRED');
 readSourceScopesV1(raw.sourceScopes);const c=cloneV1(raw) as unknown as Current,{checkedAt:_,expiresAt:__,...binding}=c;return{c,binding};
}

/** P1 내부 HUMAN 회수 계획 저장. 실제 제공자와 PG guard/credential·recovery HTTP는 아직 연결하지 않는다. */
export class ProjectExecutionRecovery{
 readonly access:AccessRepository;readonly store:SyntheticRecoveryStore;readonly policies:Pick<ProjectLimitPolicies,'resolveCurrent'>;
 constructor(access:AccessRepository,store:SyntheticRecoveryStore,policies:Pick<ProjectLimitPolicies,'resolveCurrent'>=new ProjectLimitPolicies()){this.access=access;this.store=store;this.policies=policies;this.#port();}
 #port(){if(this.store?.transport!=='SYNTHETIC_ONLY'||typeof this.store.current!=='function'||typeof this.store.append!=='function')fail('SYNTHETIC_RECOVERY_STORE_REQUIRED');}
 async #now(db:PoolClient){const at=(await db.query('SELECT clock_timestamp() AS at')).rows[0]?.at;if(!(at instanceof Date)||!Number.isFinite(at.getTime()))return fail('RECOVERY_CLOCK_INVALID',503);return at.getTime();}
 #human(actor:AuthenticatedIdentity,at:number){const s=actor.authSession;if(!s||!uuidV1(s.id)||!isoV1(s.idleExpiresAt)||!isoV1(s.absoluteExpiresAt)||!(actor.reauthUntil instanceof Date)||!Number.isFinite(actor.reauthUntil.getTime())||actor.reauthUntil.getTime()<=at)return fail('REAUTHENTICATION_REQUIRED');const deadline=Math.min(Date.parse(s.idleExpiresAt),Date.parse(s.absoluteExpiresAt),actor.reauthUntil.getTime());if(deadline<=at)return fail('RECOVERY_HUMAN_EXPIRED');return deadline;}
 async command(token:string,csrf:string,value:ProjectCommand){
  const request=readRequest(value),p=request.payload as unknown as Input,scope={projectId:request.projectId,executionId:request.targetId!,executionGeneration:request.expectedVersion};
  try{return await this.access.authenticated(token,csrf,async(db,actor)=>{
   this.#port();await currentProjectController(db,actor,request);let at=await this.#now(db);this.#human(actor,at);
   const first=current(await this.store.current(db,actor,cloneV1(scope)),scope,await this.#now(db));
   if(!same(first.c.permissionPolicyRef,p.permissionPolicyRef)||!same(first.c.budgetPolicyRef,p.budgetPolicyRef))fail('RECOVERY_POLICY_CHANGED');
   const policyInput={executionId:scope.executionId,executionGeneration:scope.executionGeneration,permissionPolicyRef:p.permissionPolicyRef,budgetPolicyRef:p.budgetPolicyRef,sourceScopes:first.c.sourceScopes};
   let policy=await authorizeRuntimePolicy(db,actor,request,policyInput,this.policies);at=await this.#now(db);this.#human(actor,at);
   const replay=await projectReplay(db,actor,request);if(replay!==undefined)return replay;
   if(!same(first.c.lastServerAck,p.lastServerAck)||!same(first.c.processIdentity,p.processIdentity))fail('RECOVERY_TARGET_CHANGED');
   const next=current(await this.store.current(db,actor,cloneV1(scope)),scope,await this.#now(db));if(!same(first.binding,next.binding))fail('RECOVERY_CURRENT_CHANGED');
   policy=await authorizeRuntimePolicy(db,actor,request,policyInput,this.policies);at=await this.#now(db);const deadline=Math.min(at+600000,this.#human(actor,at),policy.validUntil,Date.parse(first.c.expiresAt),Date.parse(next.c.expiresAt));if(deadline<=at)fail('RECOVERY_EXPIRED');
   const reviewer={kind:'HUMAN' as const,userId:actor.actorId,clientId:actor.clientId,humanSessionId:actor.authSession!.id,credentialGeneration:actor.credentialGeneration,controlGeneration:request.controlGeneration},allowedOperations:RecoverySnapshot['allowedOperations']=['SYNC_OBSERVATIONS','READ_STOP_INSTRUCTION','REPORT_STOP','HEARTBEAT'],expiresAt=new Date(deadline).toISOString(),requestHash=hash(request);
   const snapshot:RecoverySnapshot={kind:'RECOVERY',state:'SYNTHETIC_PLAN',transport:'SYNTHETIC_ONLY',scope,request,requestHash,reviewer,binding:first.binding,allowedOperations,plannedAt:new Date(at).toISOString(),expiresAt,scopeDigest:hash({binding:first.binding,requestHash,reviewer,allowedOperations,expiresAt}),executionAuthorized:false,dispatchPerformed:false,writerReleaseVerified:false};
   if(Buffer.byteLength(canonicalJson(snapshot))>2097152)fail('RECOVERY_PLAN_TOO_LARGE',422);const record={ref:{id:randomUUID(),version:1,contentHash:hash(snapshot)},snapshot};
   const receipt=await persistProjectReceipt(db,actor,request,record.ref,{status:'SYNTHETIC_RECOVERY_STORED',snapshot,executionAuthorized:false,dispatchPerformed:false,writerReleaseVerified:false},policy.policyRef,'EXPLICIT_SYNTHETIC_RECOVERY_ONLY');
   this.#port();await this.store.append(db,cloneV1(scope),cloneV1(record),receipt.id);this.#port();const final=current(await this.store.current(db,actor,cloneV1(scope)),scope,await this.#now(db));at=await this.#now(db);
   if(!same(first.binding,final.binding)||Date.parse(final.c.expiresAt)<deadline||at>=Math.min(deadline,Date.parse(final.c.expiresAt),this.#human(actor,at)))fail('RECOVERY_CURRENT_CHANGED');const finalPolicy=await authorizeRuntimePolicy(db,actor,request,policyInput,this.policies);this.#port();at=await this.#now(db);current(final.c,scope,at);if(finalPolicy.validUntil<deadline||at>=Math.min(deadline,Date.parse(final.c.expiresAt),finalPolicy.validUntil,this.#human(actor,at)))fail('RECOVERY_EXPIRED');return receipt.result;
  });}catch(error){await recordProjectDenial(this.access,token,request.projectId,error);throw error;}
 }
}
