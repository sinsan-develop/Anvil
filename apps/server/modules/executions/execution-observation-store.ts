import type {Pool,PoolClient} from 'pg';
import {cloneV1} from '../../../../contracts/runtime/validation-v1.ts';
import {SyntheticPgChallengeStore,type SyntheticHostKeys} from './execution-challenge-store.ts';
import type {ObservationScope,SyntheticObservationStore,SyntheticObservationTransaction} from './execution-observations.ts';
type Observation=Parameters<SyntheticObservationTransaction['append']>[0];
type Ack=Parameters<SyntheticObservationTransaction['saveAck']>[0];
/** 전용 합성 PG의 관측/ACK 저장 adapter. 현재 HUMAN/제어/정책/예산·키 결박은 기존 grant tx와 같은 connection이다.
 * 실행 credential/관측 proof·nonce 집행/회수 grant·실제 OS 검증을 제공하거나 HTTP에 등록하지 않는다. */
export class SyntheticPgObservationStore implements SyntheticObservationStore{
 readonly transport='SYNTHETIC_ONLY' as const;readonly pool:Pick<Pool,'connect'>;readonly keys:SyntheticHostKeys;
 constructor(pool:Pick<Pool,'connect'>,keys:SyntheticHostKeys){new SyntheticPgChallengeStore(pool,keys);this.pool=pool;this.keys=keys;}
 async transaction<T>(scope:ObservationScope,body:(tx:SyntheticObservationTransaction)=>Promise<T>):Promise<T>{
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
   }};return body(tx);
  });
 }
}
