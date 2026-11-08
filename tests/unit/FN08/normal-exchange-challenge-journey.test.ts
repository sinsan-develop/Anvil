import test from 'node:test';
import assert from 'node:assert/strict';
import { createECDH, createPrivateKey, createPublicKey, randomBytes, randomUUID, sign } from 'node:crypto';
import { canonicalJson, contentHash } from '../../../contracts/canonical.ts';
import { executionStartOriginFixture, installExecutionStartOriginMemoryFS } from '../FN09/execution-start-origin-fixture.ts';

await installExecutionStartOriginMemoryFS();
const { buildApp } = await import('../../../apps/server/app.ts');
const { registrationRef } = await import('../../../apps/server/modules/connections/project-registrations.ts');
const { executionChallengeRequestBytes } = await import('../../../apps/server/modules/executions/execution-proof.ts');
const digest = (value: unknown) => contentHash(canonicalJson(value));
type Fixture = Awaited<ReturnType<typeof executionStartOriginFixture>>;

// 시험 등록의 공개키가 P-256 표준 생성점인지 검산한다. 키 파일을 읽지 않는다.
function fixtureSigner(spki: string) {
  const scalar = Buffer.alloc(32);
  scalar[31] = 1;
  const curve = createECDH('prime256v1');
  curve.setPrivateKey(scalar);
  const point = curve.getPublicKey();
  const key = createPrivateKey({ format: 'jwk', key: { kty: 'EC', crv: 'P-256',
    x: point.subarray(1,33).toString('base64url'), y: point.subarray(33).toString('base64url'), d: scalar.toString('base64url') } });
  assert.equal(createPublicKey(key).export({format:'der',type:'spki'}).toString('base64url'), spki);
  return key;
}

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
    const command = {...f.originCommand(),operation:'queueExecutionCommand',approvalRef:null,payload:{operation:'START_SESSION',executionId,
      executionGeneration:1,preparationRef:prep.ref,permissionPolicyRef:f.policyRef,budgetPolicyRef:intent.budgetPolicyRef,
      payload:{contextBundleRef:intent.contextBundleRef,optionsRef:prep.ref}}};
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
    const key = fixtureSigner(registration.connector.public_key_spki);
    const signature = sign('sha256',executionChallengeRequestBytes('EXECUTION',request),{key,dsaEncoding:'ieee-p1363'}).toString('base64url');
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
