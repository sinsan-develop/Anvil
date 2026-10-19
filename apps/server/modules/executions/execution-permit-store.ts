import type {Pool,PoolClient} from 'pg';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {cloneV1} from '../../../../contracts/runtime/validation-v1.ts';
import {AuthFailure} from '../access/repository.ts';
import {SyntheticPgChallengeStore,type SyntheticHostKeys} from './execution-challenge-store.ts';
import type {SyntheticChallengeScope} from './execution-challenges.ts';
import type {SyntheticPermitTransaction} from './execution-permits.ts';
import type {SyntheticAuthenticatedPermitStore} from './execution-authenticated-permits.ts';
type JointTransaction=Parameters<Parameters<SyntheticAuthenticatedPermitStore['transaction']>[1]>[0];
export interface SyntheticPermitFacts{
 transport:'SYNTHETIC_ONLY';
 /** 현재 source/OS·writer·기준 사실을 제공한다. grant의 과거 VERIFIED를 실제 현재 관측으로 자동 승격하지 않는다. */
 current(db:PoolClient,scope:SyntheticChallengeScope,storedBinding:unknown):Promise<unknown>;
}
/** P1 전용 PG 연결. 실제 source/OS/credential/HTTP·Agent 기본값이나 활성화 경로가 없다. */
export class SyntheticPgPermitStore implements SyntheticAuthenticatedPermitStore{
 readonly transport='SYNTHETIC_ONLY' as const;readonly pool:Pick<Pool,'connect'>;readonly keys:SyntheticHostKeys;readonly facts:SyntheticPermitFacts;
 constructor(pool:Pick<Pool,'connect'>,keys:SyntheticHostKeys,facts:SyntheticPermitFacts){
  new SyntheticPgChallengeStore(pool,keys);if(!facts||facts.transport!=='SYNTHETIC_ONLY'||typeof facts.current!=='function')throw new AuthFailure('SYNTHETIC_PERMIT_FACTS_REQUIRED',412);this.pool=pool;this.keys=keys;this.facts=facts;
 }
 async transaction<T>(scope:SyntheticChallengeScope,body:(tx:JointTransaction)=>Promise<T>):Promise<T>{
  let db:PoolClient|undefined;const bound={connect:async()=>{db=await this.pool.connect();return db;}};
  return new SyntheticPgChallengeStore(bound,this.keys).transaction(cloneV1(scope),async challenges=>{
   if(!db)throw Error('PERMIT_CONNECTION_UNAVAILABLE');const client=db;
   const permits:SyntheticPermitTransaction={clock:challenges.clock,current:async(commandId)=>{
    if(this.facts.transport!=='SYNTHETIC_ONLY')throw new AuthFailure('SYNTHETIC_PERMIT_FACTS_REQUIRED',412);
    const c=await challenges.current(),rows=(await client.query("SELECT * FROM anvil.execution_commands WHERE project_id=$1 AND execution_id=$2 AND generation=$3 AND snapshot_json->'envelope'->>'commandId'=$4 LIMIT 2",[scope.projectId,scope.executionId,scope.executionGeneration,commandId])).rows;
    if(rows.length!==1)throw new AuthFailure('PERMIT_COMMAND_NOT_FOUND',412);const command=rows[0];
    const grant=(await client.query('SELECT snapshot_json FROM anvil.execution_grants WHERE project_id=$1 AND id=$2 AND version=$3 AND content_hash=$4',[scope.projectId,scope.grantRef.id,scope.grantRef.version,scope.grantRef.contentHash])).rows[0];
    if(!grant)throw new AuthFailure('PERMIT_GRANT_NOT_FOUND',412);
    const fact=cloneV1(await this.facts.current(client,cloneV1(scope),cloneV1(grant.snapshot_json.binding)));
    return{fact,grantRef:cloneV1(scope.grantRef),grantExpiresAt:(c.context as any).grantExpiresAt,commandRef:{id:command.id,version:Number(command.version),contentHash:command.content_hash},commandSnapshot:cloneV1(command.snapshot_json),authorizationReceiptRef:cloneV1(command.authorization_ref)};
   },read:async()=>{
    const rows=(await client.query('SELECT * FROM anvil.execution_start_permits WHERE project_id=$1 AND execution_id=$2 AND generation=$3 LIMIT 2',[scope.projectId,scope.executionId,scope.executionGeneration])).rows;
    return{complete:rows.length<=1,permits:rows.map(r=>({ref:{id:r.id,version:Number(r.version),contentHash:r.content_hash},snapshot:r.snapshot_json}))};
   },append:async value=>{
    if(value.ref.contentHash!==contentHash(canonicalJson(value.snapshot)))throw Error('PERMIT_HASH_MISMATCH');
    await client.query('INSERT INTO anvil.execution_start_permits(project_id,execution_id,generation,id,version,proof_result_id,proof_result_version,content_hash,snapshot_json) VALUES($1,$2,$3,$4,1,$5,$6,$7,$8)',[scope.projectId,scope.executionId,scope.executionGeneration,value.ref.id,value.snapshot.proofRef.id,value.snapshot.proofRef.version,value.ref.contentHash,JSON.stringify(value.snapshot)]);
   }};return body({challenges,permits});
  });
 }
}
