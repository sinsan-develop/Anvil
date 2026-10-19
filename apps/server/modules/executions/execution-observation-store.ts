import type {Pool,PoolClient} from 'pg';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {cloneV1} from '../../../../contracts/runtime/validation-v1.ts';
import {SyntheticPgChallengeStore,type SyntheticHostKeys} from './execution-challenge-store.ts';
import type {ObservationScope,SyntheticObservationStore,SyntheticObservationTransaction} from './execution-observations.ts';
import type {SyntheticAuthenticatedObservationTransaction} from './execution-authenticated-observations.ts';
type Observation=Parameters<SyntheticObservationTransaction['append']>[0];
type Ack=Parameters<SyntheticObservationTransaction['saveAck']>[0];
const hash=(v:unknown)=>contentHash(canonicalJson(v)),same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
/** 전용 합성 PG의 관측/ACK 저장 adapter. 현재 HUMAN/제어/정책/예산·키 결박은 기존 grant tx와 같은 connection이다.
 * 단독 transaction은 관측 저장만, withChallenges는 같은 SQL tx의 서명/nonce 연결용 port다.
 * 실행 credential/회수 grant·실제 OS 검증을 제공하거나 HTTP에 등록하지 않는다. */
export class SyntheticPgObservationStore implements SyntheticObservationStore{
 readonly transport='SYNTHETIC_ONLY' as const;readonly pool:Pick<Pool,'connect'>;readonly keys:SyntheticHostKeys;
 constructor(pool:Pick<Pool,'connect'>,keys:SyntheticHostKeys){new SyntheticPgChallengeStore(pool,keys);this.pool=pool;this.keys=keys;}
 async transaction<T>(scope:ObservationScope,body:(tx:SyntheticObservationTransaction)=>Promise<T>):Promise<T>{
  return this.withChallenges(scope,tx=>body(tx.observations));
 }
 async withChallenges<T>(scope:ObservationScope,body:(tx:SyntheticAuthenticatedObservationTransaction)=>Promise<T>):Promise<T>{
  let db:PoolClient|undefined;
  // 기존 현재 검사/잠금/COMMIT/rollback을 재사용하되 새 connection이나 nested BEGIN을 열지 않는다.
  const boundPool={connect:async()=>{db=await this.pool.connect();return db;}};
  return new SyntheticPgChallengeStore(boundPool,this.keys).transaction(cloneV1(scope),async grant=>{
   if(!db)throw Error('OBSERVATION_CONNECTION_UNAVAILABLE');const client=db;
   const tx:SyntheticObservationTransaction={clock:grant.clock,current:async()=>{
    const c=await grant.current();return{transport:'SYNTHETIC_ONLY',scope:cloneV1(scope),operation:'SYNC_OBSERVATIONS',authorityRef:cloneV1(scope.grantRef),checkedAt:c.checkedAt,expiresAt:(c.context as any).grantExpiresAt};
   },read:async()=>{
    const rows=(await client.query('SELECT * FROM anvil.execution_observations WHERE project_id=$1 AND execution_id=$2 AND generation=$3 ORDER BY event_sequence LIMIT 10001',[scope.projectId,scope.executionId,scope.executionGeneration])).rows;
    const events=rows.map(r=>{if(r.snapshot_json?.event?.sequence!==Number(r.event_sequence))throw Error('OBSERVATION_LEDGER_INVALID');return{ref:{id:r.id,version:Number(r.version),contentHash:r.content_hash},snapshot:r.snapshot_json};});
    const latest=(await client.query('SELECT * FROM anvil.execution_acknowledgements WHERE project_id=$1 AND execution_id=$2 AND generation=$3 ORDER BY version DESC LIMIT 1',[scope.projectId,scope.executionId,scope.executionGeneration])).rows[0];
    return{complete:rows.length<=10000,events,ack:latest?{ref:{id:latest.id,version:Number(latest.version),contentHash:latest.content_hash},snapshot:latest.snapshot_json}:null};
   },append:async(e:Observation)=>{
    await client.query('INSERT INTO anvil.execution_observations(project_id,execution_id,generation,id,version,event_sequence,grant_id,grant_version,content_hash,snapshot_json) VALUES($1,$2,$3,$4,1,$5,$6,$7,$8,$9)',[scope.projectId,scope.executionId,scope.executionGeneration,e.ref.id,e.snapshot.event.sequence,scope.grantRef.id,scope.grantRef.version,e.ref.contentHash,JSON.stringify(e.snapshot)]);
   },saveAck:async(a:Ack)=>{
    await client.query('INSERT INTO anvil.execution_acknowledgements(project_id,execution_id,generation,id,version,grant_id,grant_version,content_hash,snapshot_json) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[scope.projectId,scope.executionId,scope.executionGeneration,a.ref.id,a.ref.version,scope.grantRef.id,scope.grantRef.version,a.ref.contentHash,JSON.stringify(a.snapshot)]);
   }};
   const results:SyntheticAuthenticatedObservationTransaction['results']={bind:async(proofResultRef,ack,bodyHash)=>{
    const snapshot={transport:'SYNTHETIC_ONLY',proofResultRef:cloneV1(proofResultRef),ackRef:cloneV1(ack.ref),bodyHash,recordedAt:await grant.clock(),executionAuthorized:false,dispatchPerformed:false};
    await client.query('INSERT INTO anvil.execution_observation_results(project_id,execution_id,generation,proof_result_id,proof_result_version,ack_id,ack_version,content_hash,snapshot_json) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[scope.projectId,scope.executionId,scope.executionGeneration,proofResultRef.id,proofResultRef.version,ack.ref.id,ack.ref.version,hash(snapshot),JSON.stringify(snapshot)]);
   },read:async(proofResultRef)=>{
    const r=(await client.query('SELECT r.content_hash AS binding_hash,r.snapshot_json AS binding_snapshot,a.* FROM anvil.execution_observation_results r JOIN anvil.execution_acknowledgements a ON a.project_id=r.project_id AND a.execution_id=r.execution_id AND a.generation=r.generation AND a.id=r.ack_id AND a.version=r.ack_version WHERE r.project_id=$1 AND r.execution_id=$2 AND r.generation=$3 AND r.proof_result_id=$4 AND r.proof_result_version=$5',[scope.projectId,scope.executionId,scope.executionGeneration,proofResultRef.id,proofResultRef.version])).rows[0];
    if(!r)return null;const s=r.binding_snapshot,ack={ref:{id:r.id,version:Number(r.version),contentHash:r.content_hash},snapshot:r.snapshot_json};
    if(hash(s)!==r.binding_hash||!same(s.proofResultRef,proofResultRef)||!same(s.ackRef,ack.ref)||hash(ack.snapshot)!==ack.ref.contentHash)throw Error('OBSERVATION_RESULT_BINDING_INVALID');return{bodyHash:s.bodyHash,ack};
   }};return body({challenges:grant,observations:tx,results});
  });
 }
}
