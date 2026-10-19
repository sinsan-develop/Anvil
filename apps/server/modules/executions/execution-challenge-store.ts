import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { canonicalJson, contentHash } from '../../../../contracts/canonical.ts';
import { cloneV1, isoV1, recordV1, refV1, uuidV1 } from '../../../../contracts/runtime/validation-v1.ts';
import { readServerExecutionFactV1 } from '../../../../contracts/runtime/server-execution-fact-v1.ts';
import { AuthFailure, type AuthenticatedIdentity } from '../access/repository.ts';
import { publicKeyFingerprint } from '../connections/registration-proof.ts';
import { authorizeRuntimePolicy } from './runtime-policy.ts';
import { ProjectExecutionBudget } from './execution-budget.ts';
import type { SyntheticChallengeEntry, SyntheticChallengeScope, SyntheticChallengeStore, SyntheticChallengeTransaction } from './execution-challenges.ts';

export interface SyntheticHostKeys {transport:'SYNTHETIC_ONLY';key(db:PoolClient,registration:unknown):Promise<unknown>}
const bad=(code:string,status=412):never=>{throw new AuthFailure(code,status);};
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const hash=(value:unknown)=>contentHash(canonicalJson(value));
function readScope(value:unknown):SyntheticChallengeScope{
 if(!recordV1(value,['mode','projectId','connectorId','executionId','executionGeneration','grantRef','credentialGeneration'])
  ||!['EXECUTION','RECOVERY'].includes(value.mode)||!uuidV1(value.projectId)||!uuidV1(value.connectorId)||!uuidV1(value.executionId)
  ||!Number.isSafeInteger(value.executionGeneration)||value.executionGeneration<1||!refV1(value.grantRef)||value.credentialGeneration!==1)return bad('SYNTHETIC_CHALLENGE_SCOPE_INVALID',422);
 if(value.mode!=='EXECUTION')return bad('SYNTHETIC_RECOVERY_GRANT_UNSUPPORTED');return cloneV1(value) as unknown as SyntheticChallengeScope;
}
async function clock(db:PoolClient){const at=(await db.query('SELECT clock_timestamp() AS at')).rows[0]?.at;if(!(at instanceof Date)||!Number.isFinite(at.getTime()))return bad('EXECUTION_CLOCK_INVALID',503);return at.toISOString();}

/** 새 전용 P1 PG에서만 사용하는 합성 adapter. 실제 execution token/host·OS/Agent를 제공하지 않는다.
 * 현재 DB의 HUMAN·제어·정책·예산과 불변 grant는 실제 읽지만 source/OS 관측은 기존 합성 binding이다.
 */
export class SyntheticPgChallengeStore implements SyntheticChallengeStore {
 readonly transport='SYNTHETIC_ONLY' as const;
 readonly pool:Pick<Pool,'connect'>;readonly keys:SyntheticHostKeys;
 constructor(pool:Pick<Pool,'connect'>,keys:SyntheticHostKeys){
  if(!keys||keys.transport!=='SYNTHETIC_ONLY'||typeof keys.key!=='function')bad('SYNTHETIC_HOST_KEYS_REQUIRED');this.pool=pool;this.keys=keys;
 }
 async transaction<T>(raw:SyntheticChallengeScope,body:(tx:SyntheticChallengeTransaction)=>Promise<T>):Promise<T>{
  const scope=readScope(raw),db=await this.pool.connect();
  try{
   await db.query('BEGIN');await db.query("SET LOCAL statement_timeout='10s';SET LOCAL lock_timeout='2s'");
   const current=async()=>{
    if(this.keys.transport!=='SYNTHETIC_ONLY')return bad('SYNTHETIC_HOST_KEYS_REQUIRED');
    const g=(await db.query('SELECT g.*,e.transport AS execution_transport,e.state AS execution_state FROM anvil.execution_grants g JOIN anvil.executions e ON e.project_id=g.project_id AND e.id=g.execution_id AND e.generation=g.generation WHERE g.project_id=$1 AND g.id=$2 AND g.version=$3',[scope.projectId,scope.grantRef.id,scope.grantRef.version])).rows[0];
    if(!g||g.content_hash!==scope.grantRef.contentHash||Number(g.generation)!==scope.executionGeneration||g.execution_id!==scope.executionId||hash(g.snapshot_json)!==g.content_hash
     ||g.execution_transport!=='SYNTHETIC_ONLY'||g.execution_state!=='SYNTHETIC_QUEUED'||g.snapshot_json.kind!=='EXECUTION'||g.snapshot_json.state!=='SYNTHETIC_PLAN'
     ||g.snapshot_json.transport!=='SYNTHETIC_ONLY'||g.snapshot_json.executionAuthorized!==false||g.snapshot_json.dispatchPerformed!==false||!isoV1(g.snapshot_json.expiresAt))return bad('EXECUTION_GRANT_NOT_CURRENT');
    const f=readServerExecutionFactV1(g.snapshot_json.binding);
    if(f.projectId!==scope.projectId||f.executionId!==scope.executionId||f.executionGeneration!==scope.executionGeneration||f.registration.connectorId!==scope.connectorId
     ||hash(f)!==g.snapshot_json.factHash)return bad('EXECUTION_GRANT_BINDING_CONFLICT');
    // HUMAN와 같은 순서로 user/session/client를 잠근 뒤 project를 잠가 제어 변경과 직렬화한다.
    const s=(await db.query("SELECT s.*,u.status AS user_status,u.revoked_at AS user_revoked_at,u.credential_generation AS current_generation,cl.revoked_at AS client_revoked_at FROM anvil.auth_sessions s JOIN anvil.users u ON u.id=s.user_id JOIN anvil.clients cl ON cl.user_id=s.user_id AND cl.id=s.client_id WHERE s.id=$1 AND s.user_id=$2 AND s.client_id=$3 FOR UPDATE OF u,s,cl",[f.subject.humanSessionId,f.subject.userId,f.subject.clientId])).rows[0];
    const at=await clock(db);
    if(!s||s.user_status!=='ACTIVE'||s.revoked_at||s.user_revoked_at||s.client_revoked_at||Number(s.credential_generation)!==Number(s.current_generation)
     ||Number(s.current_generation)!==f.subject.credentialGeneration||s.idle_expires_at.getTime()<=Date.parse(at)||s.absolute_expires_at.getTime()<=Date.parse(at))return bad('EXECUTION_HUMAN_SESSION_NOT_CURRENT');
    const actor:AuthenticatedIdentity={actorId:f.subject.userId,clientId:f.subject.clientId,credentialGeneration:f.subject.credentialGeneration,serverOwner:false,reauthUntil:null};
    const request={schemaVersion:1 as const,projectId:scope.projectId,commandId:randomUUID(),clientId:actor.clientId,controlGeneration:f.subject.controlGeneration,operation:'queueExecutionCommand',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:{}};
    const input={executionId:scope.executionId,executionGeneration:scope.executionGeneration,permissionPolicyRef:f.permissionPolicyRef,budgetPolicyRef:f.intent.budgetPolicyRef,sourceScopes:f.intent.sourceScopes};
    const a=await authorizeRuntimePolicy(db,actor,{...request,operation:'authorizeExecution'},input),q=await authorizeRuntimePolicy(db,actor,request,input);
    await new ProjectExecutionBudget().checkDelivery(db,actor,scope.projectId,f.budgetReservationRef);
    const spki=cloneV1(await this.keys.key(db,cloneV1(f.registration)));
    if(publicKeyFingerprint(spki)!==f.registration.hostPublicKeyFingerprint)return bad('EXECUTION_HOST_KEY_NOT_CURRENT');
    const now=await clock(db),expiresAt=new Date(Math.min(Date.parse(g.snapshot_json.expiresAt),s.idle_expires_at.getTime(),s.absolute_expires_at.getTime(),a.validUntil,q.validUntil)).toISOString();
    if(Date.parse(expiresAt)<=Date.parse(now))return bad('EXECUTION_GRANT_EXPIRED');
    await db.query("SELECT set_config('anvil.synthetic_grant_id',$1,true),set_config('anvil.synthetic_grant_hash',$2,true),set_config('anvil.synthetic_project_id',$3,true)",[scope.grantRef.id,scope.grantRef.contentHash,scope.projectId]);
    const reserved=(await db.query('SELECT * FROM anvil.execution_credentials WHERE project_id=$1 AND grant_id=$2 AND grant_version=$3 AND credential_generation=1',[scope.projectId,scope.grantRef.id,scope.grantRef.version])).rows[0];
    if(!reserved){
     const snapshot={transport:'SYNTHETIC_ONLY',state:'SYNTHETIC_RESERVED_NO_TOKEN',grantRef:scope.grantRef,credentialGeneration:1,reservedAt:now,credentialIssued:false,executionAuthorized:false,dispatchPerformed:false};
     await db.query('INSERT INTO anvil.execution_credentials(project_id,id,version,grant_id,grant_version,credential_generation,content_hash,snapshot_json) VALUES($1,$2,1,$3,$4,1,$5,$6)',[scope.projectId,randomUUID(),scope.grantRef.id,scope.grantRef.version,hash(snapshot),JSON.stringify(snapshot)]);
    }else if(reserved.content_hash!==hash(reserved.snapshot_json)||reserved.snapshot_json.state!=='SYNTHETIC_RESERVED_NO_TOKEN'||!same(reserved.snapshot_json.grantRef,scope.grantRef)
     ||reserved.snapshot_json.credentialIssued!==false||reserved.snapshot_json.executionAuthorized!==false||reserved.snapshot_json.dispatchPerformed!==false)return bad('SYNTHETIC_CREDENTIAL_RESERVATION_INVALID',503);
    return{context:{transport:'SYNTHETIC_ONLY',mode:'EXECUTION',projectId:scope.projectId,connectorId:scope.connectorId,executionId:scope.executionId,executionGeneration:scope.executionGeneration,
     grantRef:scope.grantRef,scopeDigest:g.snapshot_json.scopeDigest,credentialGeneration:1,publicKeyFingerprint:f.registration.hostPublicKeyFingerprint,grantExpiresAt:expiresAt},spki,checkedAt:now};
   };
   const tx:SyntheticChallengeTransaction={current,clock:()=>clock(db),read:async()=>{
    const rows=(await db.query('SELECT * FROM anvil.execution_challenges WHERE project_id=$1 AND grant_id=$2 AND grant_version=$3 ORDER BY server_sequence LIMIT 20001',[scope.projectId,scope.grantRef.id,scope.grantRef.version])).rows;
    const events=rows.map(r=>{if(r.snapshot_json?.sequence!==Number(r.server_sequence))return bad('EXECUTION_CHALLENGE_LEDGER_INVALID',503);return{ref:{id:r.id,version:Number(r.version),contentHash:r.content_hash},snapshot:r.snapshot_json};});
    return{complete:rows.length<=20000,events};
   },append:async(e:SyntheticChallengeEntry)=>{
    await db.query('INSERT INTO anvil.execution_challenges(project_id,id,version,grant_id,grant_version,server_sequence,content_hash,snapshot_json) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
     [scope.projectId,e.ref.id,e.ref.version,scope.grantRef.id,scope.grantRef.version,e.snapshot.sequence,e.ref.contentHash,JSON.stringify(e.snapshot)]);
   },recordResult:async(value)=>{
    const snapshot={kind:'SYNTHETIC_PROOF_RESULT',challengeRef:value.challengeRef,requestId:value.requestId,proofHash:value.proofHash,recordedAt:await clock(db),credentialIssued:false,executionAuthorized:false,dispatchPerformed:false};
    const ref={id:randomUUID(),version:1,contentHash:hash(snapshot)};
    await db.query('INSERT INTO anvil.execution_receipts(project_id,id,version,grant_id,grant_version,challenge_id,challenge_version,content_hash,snapshot_json) VALUES($1,$2,1,$3,$4,$5,1,$6,$7)',[scope.projectId,ref.id,scope.grantRef.id,scope.grantRef.version,value.challengeRef.id,ref.contentHash,JSON.stringify(snapshot)]);return ref;
   }};
   const result=await body(tx);await db.query('COMMIT');return result;
  }catch(error){await db.query('ROLLBACK').catch(()=>{});throw error;}finally{db.release();}
 }
}
