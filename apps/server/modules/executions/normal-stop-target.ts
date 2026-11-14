import {types} from 'node:util';
import type {PoolClient} from 'pg';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {readDispatchEnvelopeV1,type DispatchEnvelopeV1} from '../../../../contracts/runtime/dispatch-envelope-v1.ts';
import {cloneV1,hashV1,isoV1,recordV1,uuidV1,type RuntimeRefV1 as Ref} from '../../../../contracts/runtime/validation-v1.ts';
import type {NormalStopProjectionV1} from '../../../../contracts/runtime/normal-stop-target-v1.ts';
import {AccessRepository,AuthFailure,type AuthenticatedIdentity} from '../access/repository.ts';
import {currentProjectController,type ProjectCommand} from '../access/project-command.ts';
import {authorizeRuntimePolicy,ProjectLimitPolicies} from './runtime-policy.ts';
import {readNormalInstructionFact} from './normal-instruction-command.ts';
import {readCurrent as readGrantCurrent} from './normal-exchange-challenge.ts';
export interface NormalStopOptions{mode:'NORMAL_PROTECTED'}
export type NormalStopSelection={generation:number;grantRef:Ref};
export type NormalStopResolved={projection:NormalStopProjectionV1;parentEnvelope:DispatchEnvelopeV1;policyRef:Ref;scopeDigest:string};
const bad=(code='NORMAL_STOP_TARGET_REJECTED',status=412):never=>{throw new AuthFailure(code,status);};
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b),hash=(v:unknown)=>contentHash(canonicalJson(v));
/** opt-in은 경로 선택일 뿐이다. 임의 current/reader callback 등록은 허용하지 않는다. */
export function readNormalStopOptions(raw:unknown):NormalStopOptions {
 if(!raw||typeof raw!=='object'||types.isProxy(raw)||!recordV1(raw,['mode'])||raw.mode!=='NORMAL_PROTECTED')throw Error('NORMAL_STOP_CONFIGURATION_INVALID');
 return Object.freeze({mode:'NORMAL_PROTECTED'});
}
export function readNormalStopQuery(raw:unknown):NormalStopSelection {
 if(!raw||typeof raw!=='object'||types.isProxy(raw)||!recordV1(raw,['generation','grantId','grantVersion','grantHash'])||
  ![raw.generation,raw.grantVersion].every(v=>typeof v==='string'&&/^[1-9][0-9]{0,15}$/.test(v)&&Number.isSafeInteger(Number(v)))||!uuidV1(raw.grantId)||!hashV1(raw.grantHash))return bad('INPUT_INVALID',400);
 return {generation:Number(raw.generation),grantRef:{id:raw.grantId,version:Number(raw.grantVersion),contentHash:raw.grantHash}};
}
export function normalStopHumanDeadline(actor:AuthenticatedIdentity,at:number){
 const s=actor.authSession;if(!s||!uuidV1(s.id)||!isoV1(s.idleExpiresAt)||!isoV1(s.absoluteExpiresAt))return bad('NORMAL_STOP_HUMAN_REQUIRED');
 const end=Math.min(Date.parse(s.idleExpiresAt),Date.parse(s.absoluteExpiresAt));if(end<=at)return bad('NORMAL_STOP_HUMAN_EXPIRED');return end;
}
/** 원 grant/START 조회·정책 검산은 CURRENT ownership 생산이 아니다.
 * 원 normal CURRENT observation/서명/head/session 계보의 제품 reader가 아직 없으므로 최종412로 닫는다.
 * Synthetic BASIS_ONLY나 native BOOTSTRAP_PREPARED를 대체 권위로 받는 포트가 없다. */
export class NormalStopTargets {
 readonly #access:AccessRepository;readonly #policies:Pick<ProjectLimitPolicies,'resolveCurrent'>;
 constructor(access:AccessRepository,policies:Pick<ProjectLimitPolicies,'resolveCurrent'>=new ProjectLimitPolicies()){this.#access=access;this.#policies=policies;}
 async read(token:string,project:string,execution:string,query:unknown){
  const selection=readNormalStopQuery(query);if(!uuidV1(project)||!uuidV1(execution))return bad('INPUT_INVALID',400);
  const check=()=>{
   if(Object.getPrototypeOf(this)!==NormalStopTargets.prototype||Object.getOwnPropertyDescriptor(this,'current')||Object.getOwnPropertyDescriptor(NormalStopTargets.prototype,'current')?.value!==originalCurrent)return bad('NORMAL_STOP_CURRENT_SOURCE_CHANGED');
  };
  check();
  const result=await this.#access.authenticated(token,null,async(db,actor)=>{
   check();const value=await originalCurrent.call(this,db,actor,project,execution,selection);check();return value;
  });
  check();return result;
 }
 async current(db:PoolClient,actor:AuthenticatedIdentity,project:string,execution:string,selection:NormalStopSelection,submitted?:ProjectCommand):Promise<NormalStopResolved>{
  const {generation,grantRef:g}=selection;
  const rows=(await db.query('SELECT g.*,c.id AS start_id,c.version AS start_version,c.content_hash AS start_hash,c.envelope_hash AS start_envelope_hash,c.snapshot_json AS start_snapshot FROM anvil.execution_grants g JOIN anvil.execution_commands c ON c.project_id=g.project_id AND c.created_command_id=g.command_id AND c.grant_id=g.id AND c.grant_version=g.version WHERE g.project_id=$1 AND g.execution_id=$2 AND g.generation=$3 AND g.id=$4 AND g.version=$5 AND anvil.normal_start_material_complete($1,g.command_id) LIMIT 2',[project,execution,generation,g.id,g.version])).rows;
  if(rows.length!==1)return bad('NORMAL_STOP_START_PARENT_REQUIRED');const row=rows[0],s=row.snapshot_json,f=readNormalInstructionFact(s?.binding);
  if(row.project_id!==project||row.execution_id!==execution||Number(row.generation)!==generation||row.id!==g.id||Number(row.version)!==1||g.version!==1||row.content_hash!==g.contentHash||hash(s)!==g.contentHash||
   !recordV1(s,['kind','state','transport','binding','allowedOperations','expiresAt','scopeDigest','factHash','plannedAt','executionAuthorized','dispatchPerformed'])||s.transport!=='NORMAL_PROTECTED'||s.kind!=='EXECUTION'||s.state!=='GRANTED'||s.executionAuthorized!==false||s.dispatchPerformed!==false||
   !same(s.allowedOperations,['START_SESSION','SEND_INSTRUCTION','REQUEST_STOP'])||s.factHash!==hash(f)||s.scopeDigest!==hash({binding:f,allowedOperations:s.allowedOperations,expiresAt:s.expiresAt})||f.projectId!==project||f.executionId!==execution||f.executionGeneration!==generation)return bad('NORMAL_STOP_GRANT_INVALID');
  if(!same(f.subject,{userId:actor.actorId,clientId:actor.clientId,humanSessionId:actor.authSession?.id,credentialGeneration:actor.credentialGeneration,controlGeneration:f.subject.controlGeneration}))return bad('NORMAL_STOP_SUBJECT_MISMATCH');
  const request:ProjectCommand=submitted??{schemaVersion:1,projectId:project,commandId:g.id,clientId:actor.clientId,controlGeneration:f.subject.controlGeneration,operation:'requestExecutionStop',targetId:execution,expectedVersion:generation,baselineRefs:[],approvalRef:null,payload:{}};
  if(request.controlGeneration!==f.subject.controlGeneration||submitted&&(!same(request.payload.grantRef,g)||!same(request.payload.sessionBindingRef,f.agentSession.sessionRef)||!same(request.payload.permissionPolicyRef,f.permissionPolicyRef)||!same(request.payload.budgetPolicyRef,f.intent.budgetPolicyRef)))return bad('NORMAL_STOP_SUBJECT_MISMATCH');
  await currentProjectController(db,actor,request);
  const current=await readGrantCurrent(db,project,f.registration.connectorId,execution,{grantRef:g,credentialGeneration:f.executionCredentialReservation.generation});
  normalStopHumanDeadline(actor,current.now.getTime());
  const e=readDispatchEnvelopeV1(row.start_snapshot?.envelope,current.now.getTime()),{envelope:_,...intent}=row.start_snapshot;
  if(e.operation!=='START_SESSION'||e.envelopeHash!==row.start_envelope_hash||hash(intent)!==row.start_hash||Number(row.start_version)!==1||!uuidV1(row.start_id)||!same(intent.grantRef,g)||e.context.projectId!==project||e.context.executionId!==execution||e.context.executionGeneration!==generation||!same(e.executorRegistrationRef,f.registration.ref)||e.expiresAt!==s.expiresAt)return bad('NORMAL_STOP_START_PARENT_REQUIRED');
  await authorizeRuntimePolicy(db,actor,request,{executionId:execution,executionGeneration:generation,permissionPolicyRef:f.permissionPolicyRef,budgetPolicyRef:f.intent.budgetPolicyRef,sourceScopes:cloneV1(f.intent.sourceScopes)},this.#policies);
  // 여기까지 보호 원기록/등록/정책만 확인했다. 과거 osFence evidenceRefs를 현재 head로 선택하지 않는다.
  return bad('NORMAL_STOP_CURRENT_NOT_CONNECTED');
 }
}

// 모듈 초기 원 메서드만 사용한다. 공개 prototype/instance 교체는 current 공급자가 아니다.
const originalCurrent=NormalStopTargets.prototype.current;
