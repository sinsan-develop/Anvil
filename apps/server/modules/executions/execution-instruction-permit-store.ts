import type {Pool,PoolClient} from 'pg';
import {canonicalJson} from '../../../../contracts/canonical.ts';
import {readServerExecutionFactV1} from '../../../../contracts/runtime/server-execution-fact-v1.ts';
import {cloneV1,isoV1} from '../../../../contracts/runtime/validation-v1.ts';
import {AuthFailure,type AuthenticatedIdentity} from '../access/repository.ts';
import {SyntheticPgChallengeStore,type SyntheticHostKeys} from './execution-challenge-store.ts';
import type {SyntheticChallengeScope as Scope,SyntheticChallengeTransaction} from './execution-challenges.ts';
import type {SyntheticAuthenticatedInstructionPermitStore} from './execution-authenticated-instruction-permits.ts';
import type {SyntheticPgInstructionPermitBasis} from './execution-instruction-permit-basis.ts';
import type {SyntheticPgInstructionPermitJournal} from './execution-instruction-permit-journal.ts';

type JointTransaction=Parameters<Parameters<SyntheticAuthenticatedInstructionPermitStore['transaction']>[1]>[0];
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const reject=():never=>{throw new AuthFailure('INSTRUCTION_PERMIT_STORE_UNAVAILABLE',503);};
/** 기존 challenge의 같은 db/잠금/COMMIT 안에 SEND basis와 전용 journal을 연결한다.
 * 필수 host key/basis 제공자만 사용하며 실제 key/token 발급·기본 서버 활성화·START표 변경은 없다.
 * 합성 adapter의 source 연결이며 actual SQL/권한·원문/OS 진위·Agent 실행 증거가 아니다. */
export class SyntheticPgInstructionPermitStore implements SyntheticAuthenticatedInstructionPermitStore{
 readonly transport='SYNTHETIC_ONLY' as const;readonly pool:Pick<Pool,'connect'>;readonly keys:SyntheticHostKeys;
 readonly basis:Pick<SyntheticPgInstructionPermitBasis,'transport'|'current'>;readonly journal:Pick<SyntheticPgInstructionPermitJournal,'transport'|'read'|'append'>;
 constructor(pool:Pick<Pool,'connect'>,keys:SyntheticHostKeys,basis:Pick<SyntheticPgInstructionPermitBasis,'transport'|'current'>,journal:Pick<SyntheticPgInstructionPermitJournal,'transport'|'read'|'append'>){this.pool=pool;this.keys=keys;this.basis=basis;this.journal=journal;this.#ports();}
 #ports(){if(typeof this.pool?.connect!=='function'||this.keys?.transport!=='SYNTHETIC_ONLY'||typeof this.keys.key!=='function'||this.basis?.transport!=='SYNTHETIC_ONLY'||typeof this.basis.current!=='function'||this.journal?.transport!=='SYNTHETIC_ONLY'||typeof this.journal.read!=='function'||typeof this.journal.append!=='function')reject();}
 async transaction<T>(rawScope:Scope,body:(tx:JointTransaction)=>Promise<T>):Promise<T>{
  try{
   this.#ports();const scope=cloneV1(rawScope);let selected:PoolClient|undefined;
   const bound={connect:async()=>{this.#ports();selected=await this.pool.connect();return selected;}};
   return await new SyntheticPgChallengeStore(bound,this.keys).transaction(cloneV1(scope),async challenges=>{
    if(!selected)return reject();const result=await body(this.bind(selected,scope,challenges));this.#ports();return result;
   });
  }catch{return reject();}
 }
 /** caller의 단일 challenge tx에만 결합한다. 독립 pool/COMMIT을 열지 않는다. */
 bind(db:PoolClient,scope:Scope,challenges:SyntheticChallengeTransaction):JointTransaction{
    this.#ports();
    const current=async(commandId:string)=>{
     this.#ports();const before=await challenges.current(),context:any=before.context;
     if(!Object.keys(scope).every(k=>same(context[k],(scope as any)[k]))||!isoV1(context.grantExpiresAt))return reject();
     const grants=(await db.query('SELECT snapshot_json FROM anvil.execution_grants WHERE project_id=$1::uuid AND id=$2::uuid AND version=$3::bigint AND content_hash=$4::text LIMIT 2',[scope.projectId,scope.grantRef.id,scope.grantRef.version,scope.grantRef.contentHash])).rows;
     if(grants.length!==1)return reject();const fact=readServerExecutionFactV1(grants[0].snapshot_json?.binding),subject=fact.subject;
     const rows=(await db.query('SELECT id,user_id,client_id,credential_generation,idle_expires_at,absolute_expires_at FROM anvil.auth_sessions WHERE id=$1::uuid AND user_id=$2::uuid AND client_id=$3::uuid LIMIT 2',[subject.humanSessionId,subject.userId,subject.clientId])).rows;
     if(rows.length!==1)return reject();const session=rows[0];
     if(session.id!==subject.humanSessionId||session.user_id!==subject.userId||session.client_id!==subject.clientId||Number(session.credential_generation)!==subject.credentialGeneration||!(session.idle_expires_at instanceof Date)||!(session.absolute_expires_at instanceof Date)||!Number.isFinite(session.idle_expires_at.getTime())||!Number.isFinite(session.absolute_expires_at.getTime()))return reject();
     const actor:AuthenticatedIdentity={actorId:subject.userId,clientId:subject.clientId,credentialGeneration:subject.credentialGeneration,serverOwner:false,reauthUntil:null,authSession:{id:subject.humanSessionId,idleExpiresAt:session.idle_expires_at.toISOString(),absoluteExpiresAt:session.absolute_expires_at.toISOString()}};
     const basis=cloneV1(await this.basis.current(db,actor,cloneV1(scope),commandId)),after=await challenges.current(),end:any=after.context,now=await challenges.clock();this.#ports();
     if(!same(context,end)||!isoV1(now)||Date.parse(end.grantExpiresAt)<=Date.parse(now)||basis.fact.registration.hostPublicKeyFingerprint!==end.publicKeyFingerprint)return reject();
     basis.fact.expires.humanSession=new Date(Math.min(Date.parse(basis.fact.expires.humanSession),Date.parse(context.grantExpiresAt),Date.parse(end.grantExpiresAt))).toISOString();return basis;
    };
    return{challenges,permits:{clock:challenges.clock,current,read:async()=>{this.#ports();const value=await this.journal.read(db,cloneV1(scope));this.#ports();return value;},append:async record=>{this.#ports();await this.journal.append(db,cloneV1(scope),cloneV1(record));this.#ports();}}};
 }
}
