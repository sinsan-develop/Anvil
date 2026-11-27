import test,{after,mock} from 'node:test';
import * as crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { createPublicKey, randomBytes, randomUUID } from 'node:crypto';
import { canonicalJson, contentHash } from '../../../contracts/canonical.ts';
import { executionStartOriginFixture, installExecutionStartOriginMemoryFS } from '../FN09/execution-start-origin-fixture.ts';

await installExecutionStartOriginMemoryFS();
// 서버가 발급할 exact 시험 ID의 정책이 이미 있는 RAM 오라클이다. 실제 정책발급 순환의 해결 증거는 아니다.
let originUuid:{executionId:string;calls:number}|undefined;
const fixedRandomUUID=()=>{const value=randomUUID();return originUuid&&++originUuid.calls===7?originUuid.executionId:value;};
const cryptoExports={...Object.fromEntries(Object.entries(crypto).filter(([key])=>key!=='default')),randomUUID:fixedRandomUUID};
const cryptoModule=mock.module('node:crypto',{defaultExport:{...cryptoExports},namedExports:cryptoExports});
after(()=>{originUuid=undefined;cryptoModule.restore();});

const { buildApp } = await import('../../../apps/server/app.ts');
const { registrationRef } = await import('../../../apps/server/modules/connections/project-registrations.ts');
const { executionChallengeRequestBytes } = await import('../../../apps/server/modules/executions/execution-proof.ts');
const digest = (value: unknown) => contentHash(canonicalJson(value));
type Fixture = Awaited<ReturnType<typeof executionStartOriginFixture>>;

// SQL 함수 실행은 별도 검증 범위다. 이 대역의 조회 원본은 앞선 제품 명령이 커밋한 행이다.
function challengeStore(f: Fixture) {
  const tables = f.tables, registration = f.registration!;
  let committed: any[] = [], currentReads = 0;
  const grant = () => tables.execution_grants![0]!;
  const now = () => new Date(Date.parse(grant().snapshot_json.plannedAt) + 1);
  const rows = (values: any[]) => ({rows:values});
  function current(args: unknown[]) {
    const g = grant(), fact = g.snapshot_json.binding, reservation = tables.execution_credentials![0]!;
    const execution = tables.executions![0]!, command = tables.execution_commands![0]!, limit = tables.limits!.find(
      row => row.policy_id === fact.intent.budgetPolicyRef.id && row.version === fact.intent.budgetPolicyRef.version)!;
    const ref = {id:g.id,version:g.version,contentHash:g.content_hash};
    assert.deepEqual(args,[g.project_id,registration.row.connector_id,execution.id,g.id,g.version,g.content_hash,reservation.credential_generation]);
    assert.equal(g.content_hash,digest(g.snapshot_json));
    assert.equal(reservation.content_hash,digest(reservation.snapshot_json));
    assert.equal(reservation.grant_id,g.id);
    assert.equal(reservation.grant_version,g.version);
    assert.deepEqual(reservation.snapshot_json.grantRef,ref);
    assert.deepEqual(reservation.snapshot_json.registrationRef,registrationRef(registration.row as any));
    assert.equal(reservation.snapshot_json.commandId,command.snapshot_json.envelope.commandId);
    assert.equal(command.created_command_id,g.command_id);
    assert.equal(execution.command_id,g.command_id);
    assert.equal(execution.id,g.execution_id);
    assert.deepEqual(fact.executionCredentialReservation,{id:reservation.id,generation:reservation.credential_generation});
    assert.equal(fact.subject.credentialGeneration,f.actor.credentialGeneration);
    assert.equal(limit.content_hash,digest(limit.snapshot_json));
    currentReads++;
    return rows([{binding:{transport:g.snapshot_json.transport,mode:'EXECUTION',projectId:g.project_id,connectorId:registration.row.connector_id,
      executionId:execution.id,executionGeneration:execution.generation,grantRef:ref,scopeDigest:reservation.snapshot_json.scopeDigest,
      credentialGeneration:reservation.credential_generation,publicKeyFingerprint:registration.connector.host_fingerprint},
      spki:registration.connector.public_key_spki,deadline:new Date(reservation.snapshot_json.expiresAt),observed_at:now(),
      budget_ref:fact.budgetReservationRef,budget_policy:{projectId:limit.project_id,ref:fact.intent.budgetPolicyRef,snapshot:limit.snapshot_json}}]);
  }
  const pool = { async connect() {
    let pending: any[] = [];
    return {release(error?: Error){assert.equal(error,undefined);},async query(sql:string,args:unknown[] = []) {
      if(sql === 'BEGIN'){pending = structuredClone(committed);return rows([]);}
      if(sql === 'COMMIT'){committed = pending;return {rows:[],command:'COMMIT'};}
      if(sql === 'ROLLBACK' || sql.startsWith('SET LOCAL') || sql.startsWith('SELECT set_config('))return rows([]);
      if(sql.startsWith('SELECT project_id FROM anvil.execution_grants')){
        const g = grant();
        assert.deepEqual(args,[g.id,g.version,g.content_hash,g.execution_id,g.snapshot_json.binding.registration.connectorId]);
        return rows([{project_id:g.project_id}]);
      }
      if(sql.startsWith('SELECT * FROM anvil.normal_exchange_current('))return current(args);
      if(sql.includes('FROM anvil.execution_credentials')){
        const g=grant(),r=tables.execution_credentials![0]!;
        assert.deepEqual(args,[g.project_id,g.id,g.version,r.credential_generation]);
        assert.deepEqual(r.snapshot_json.registrationRef,g.snapshot_json.binding.registration.ref);
        assert.deepEqual(g.snapshot_json.binding.executionCredentialReservation,{id:r.id,generation:r.credential_generation});
        return rows([{...r,version:String(r.version),reservation_matches:r.content_hash===digest(r.snapshot_json)}]);
      }
      if(sql.includes('FROM anvil.usage_reservations')){assert.deepEqual(args,[f.pid]);return rows(tables.usage_reservations!);}
      if(sql === 'SELECT clock_timestamp() AS at')return rows([{at:now()}]);
      if(sql.includes('FROM anvil.execution_challenges') && sql.includes('request_id=')){
        return rows(pending.filter(r => r.snapshot_json.request.requestId === args[3] || r.snapshot_json.request.clientNonce === args[4]));
      }
      if(sql.startsWith('SELECT count(*)'))return rows([{total:pending.length,recent:pending.length,sequence:pending.length+1}]);
      if(sql.startsWith('INSERT INTO anvil.execution_challenges(')){
        const [project,id,grantId,version,sequence,hash,bytes] = args;
        assert.deepEqual([project,grantId,version,sequence],[f.pid,grant().id,grant().version,1]);
        const snapshot = JSON.parse(String(bytes));
        assert.equal(hash,digest(snapshot));
        pending.push({id,content_hash:hash,snapshot_json:snapshot});
        return {rowCount:1,rows:[]};
      }
      throw Error('여정 대역에서 지원하지 않는 SQL: '+sql);
    }};
  }};
  return {pool,now,events:()=>committed,reads:()=>currentReads};
}

test('기존 START 명령이 저장한 실행 세대 1 예약으로 challenge를 발급하고 같은 응답을 재조회한다',async()=>{
  const executionId = randomUUID();
  const f = await executionStartOriginFixture({normalExecutionId:executionId,connectorEnvironment:true,richContext:true,constitutionContext:true,
    environmentDependencies:true,snapshotRoot:true,originConsumptionStorage:true});
  const prep = f.preparation.data, intent = prep.snapshot.intent, registration = f.registration!;
  const evidence = {basis:prep.snapshot.basisRefs,source:intent.sourceScopes.map((s:any)=>s.observationRef),
    capability:[intent.capabilityRef],osFence:[prep.ref],storage:[prep.ref]};
  const source = { async observe(scope:unknown,checkedAt:string,signal:AbortSignal){
    assert.equal(signal.aborted,false);
    return {scope,registrationRef:registrationRef(registration.row as any),checkedAt,expiresAt:f.actor.authSession.idleExpiresAt,
      writerState:'NONE',stageRef:f.stage.data.snapshot.input.stageRef,demand:{attempts:1,calls:1,spoolBytes:1024,cost:null,costStatus:'VERIFIED_NO_CHARGE'},
      understandingReviewRef:null,checks:{...Object.fromEntries(Object.entries(evidence).map(([k,evidenceRefs])=>[k,{state:'VERIFIED_CURRENT',evidenceRefs}])),
        understanding:{state:'NOT_REQUIRED',evidenceRefs:[]}}};
  }};
  const store = challengeStore(f);
  const app = buildApp({},undefined,{repository:f.access,origin:'https://anvil-synthetic.invalid',artifactRoot:f.root},
    undefined,undefined,undefined,undefined,null,undefined,undefined,source,{pool:store.pool} as any);
  try {
    assert.equal(f.tables.execution_grants!.length,0);
    assert.equal(f.tables.execution_credentials?.length ?? 0,0);
    const originCommand=f.originCommand();
    originUuid={executionId,calls:0};
    const saved=await app.inject({method:'POST',url:'/api/v1/projects/'+f.pid+'/commands',payload:originCommand,headers:{host:'anvil-synthetic.invalid',origin:'https://anvil-synthetic.invalid',cookie:'__Host-anvil.sid='+f.token,'x-anvil-csrf':f.csrf}}).finally(()=>{originUuid=undefined;});
    assert.equal(saved.statusCode,200,saved.body);const origin=saved.json().data;assert.equal(origin.snapshot.execution.executionId,executionId);
    const originQuery=f.db.query;
    f.db.query=(async(sql:string,args:any[]=[])=>{
      if(sql==='SELECT anvil.fn111_normal_start_parent_current($1,$2,$3,$4,$5::jsonb,$6) AS valid'){
        assert(f.active());assert.deepEqual(args.slice(0,4),[f.actor.authSession.id,f.actor.actorId,f.actor.clientId,f.pid]);assert.equal(args[5],String(f.modes.tx));
        const input=JSON.parse(args[4]),q=input.request,p=q.payload;assert.equal(input.purpose,'NORMAL_START_ORIGIN_PARENT_CURRENT');assert.equal(input.mode,'DIRECT');
        const used=f.tables.executions!.some(row=>row.project_id===f.pid&&row.id===executionId&&f.commands.get(row.command_id)?.command_id!==q.commandId);
        return{rows:[{valid:p.executionId===executionId&&p.executionGeneration===1&&canonicalJson(p.originParent)===canonicalJson({originRef:origin.ref,reservationRef:origin.reservation.ref})&&!used}]};
      }
      return originQuery(sql,args);
    })as typeof f.db.query;
    const command = {...f.originCommand(),operation:'queueExecutionCommand',approvalRef:null,payload:{operation:'START_SESSION',executionId,
      executionGeneration:1,preparationRef:prep.ref,permissionPolicyRef:f.policyRef,budgetPolicyRef:intent.budgetPolicyRef,
      payload:{contextBundleRef:intent.contextBundleRef,optionsRef:prep.ref},originParent:{originRef:origin.ref,reservationRef:origin.reservation.ref}}};
    const created = await app.inject({method:'POST',url:'/api/v1/projects/'+f.pid+'/commands',payload:command,headers:{
      host:'anvil-synthetic.invalid',origin:'https://anvil-synthetic.invalid',cookie:'__Host-anvil.sid='+f.token,'x-anvil-csrf':f.csrf}});
    assert.equal(created.statusCode,200,created.body);
    const result = created.json().data, reservation = f.tables.execution_credentials![0]!;
    assert.equal(result.status,'NORMAL_QUEUE_STORED');
    assert.equal(f.tables.execution_credentials!.length,1);
    assert.equal(reservation.snapshot_json.state,'RESERVED_NO_TOKEN');
    assert.equal(reservation.credential_generation,1);
    assert.equal(f.actor.credentialGeneration,3);
    const path = '/api/v1/connectors/'+registration.row.connector_id+'/executions/'+result.snapshot.executionId;
    const request = {requestId:randomUUID(),purpose:'CREDENTIAL_EXCHANGE',grantRef:result.snapshot.grantRef,
      credentialGeneration:reservation.credential_generation,target:{method:'POST',path:path+'/credential-exchange',queryHash:digest({}),bodyHash:digest({})},
      clientNonce:randomBytes(32).toString('base64url'),issuedAt:store.now().toISOString()};
    const publicKey=createPublicKey({key:Buffer.from(registration.connector.public_key_spki,'base64url'),format:'der',type:'spki'});
    assert.equal(publicKey.asymmetricKeyDetails?.namedCurve,'prime256v1');
    const signature = f.signConnectorBytes(executionChallengeRequestBytes('EXECUTION',request));
    const post = () => app.inject({method:'POST',url:path+'/challenges',payload:{...request,signature}});
    const first = await post(), replay = await post();
    assert.equal(first.statusCode,200,first.body);
    assert.equal(replay.statusCode,200,replay.body);
    assert.deepEqual(first.json(),replay.json());
    assert.equal(store.events().length,1);
    assert.equal(store.reads(),4);
    assert.equal(first.json().challenge.serverNonce,store.events()[0].snapshot_json.publicChallenge.serverNonce);
    assert.equal(first.json().credentialIssued,false);
    assert.equal(first.json().nonceConsumed,false);
    assert.equal(first.json().dispatchPerformed,false);
  } finally { await app.close(); }
});
