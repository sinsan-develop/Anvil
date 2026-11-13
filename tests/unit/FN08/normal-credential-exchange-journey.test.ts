import test from 'node:test';
import assert from 'node:assert/strict';
import inject from 'light-my-request';
import { createHash, createECDH, createPrivateKey, createPublicKey, randomBytes, randomUUID, sign } from 'node:crypto';
import { canonicalJson, contentHash } from '../../../contracts/canonical.ts';
import { executionStartOriginFixture, installExecutionStartOriginMemoryFS } from '../FN09/execution-start-origin-fixture.ts';

await installExecutionStartOriginMemoryFS();
const { buildApp } = await import('../../../apps/server/app.ts');
const { registrationRef } = await import('../../../apps/server/modules/connections/project-registrations.ts');
const { executionChallengeRequestBytes, executionProofBytes } = await import('../../../apps/server/modules/executions/execution-proof.ts');
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
  const mode={offset:1,revoked:false,storage:'READY',storageTtl:Infinity,failWrite:false,badTag:false,lost:false,conns:0,discards:0};
  let receipts:any[]=[];
  const now = () => new Date(Date.parse(grant().snapshot_json.plannedAt) + mode.offset);
  const rows = (values: any[]) => ({rows:values});
  function current(args: unknown[]) {
    if(mode.revoked)return rows([]);
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

  let lock=Promise.resolve();
  const pool={async connect(){
    mode.conns++;
    let drafts:any[]=[],issued:any[]=[],unlock=()=>{};
    return {release(err?:Error){if(err)mode.discards++;},async query(sql:string,args:any[]=[]){
      if(sql==='BEGIN'){const before=lock;lock=new Promise<void>(ok=>unlock=ok);await before;drafts=structuredClone(committed);issued=structuredClone(receipts);return rows([]);}
      if(sql==='COMMIT'){
        if(mode.badTag){unlock();return{command:'ROLLBACK',rows:[]};}
        committed=drafts;receipts=issued;unlock();if(mode.lost)throw Error('합성 응답 유실');return {command:'COMMIT',rows:[]};
      }
      if(sql==='ROLLBACK'){unlock();return rows([]);}
      if(sql.startsWith('SET LOCAL')||sql.startsWith('SELECT set_config('))return rows([]);
      if(sql.startsWith('SELECT project_id')&&sql.includes('FROM anvil.execution_grants')){
        const g=grant();
        assert.deepEqual(args,[g.id,g.version,g.content_hash,g.execution_id,g.snapshot_json.binding.registration.connectorId]);
        return rows([{project_id:g.project_id,fact:g.snapshot_json.binding}]);
      }
      if(sql.startsWith('SELECT * FROM anvil.normal_exchange_current('))return current(args);
      if(sql.startsWith('SELECT clock_timestamp()'))return rows([{at:now()}]);
      if(sql.includes('FROM anvil.usage_reservations')){assert.deepEqual(args,[f.pid]);return rows(tables.usage_reservations!);}
      if(sql.includes('FROM anvil.execution_credentials'))return rows(tables.execution_credentials!.filter(r=>r.project_id===args[0]&&r.grant_id===args[1]&&r.grant_version===args[2]&&r.credential_generation===args[3]).map(r=>{
        const g=grant(),s=r.snapshot_json;
        const reservation_matches=r.content_hash===digest(s)&&s.scopeDigest===g.snapshot_json.scopeDigest&&
          s.executionId===g.execution_id&&s.executionGeneration===g.generation&&
          digest(s.grantRef)===digest({id:g.id,version:g.version,contentHash:g.content_hash})&&
          digest(s.registrationRef)===digest(g.snapshot_json.binding.registration.ref)&&
          digest(g.snapshot_json.binding.executionCredentialReservation)===digest({id:r.id,generation:r.credential_generation});
        return {...r,version:String(r.version),reservation_matches};
      }));
      if(sql.includes('FROM anvil.execution_receipts r LEFT JOIN')){
        return rows(issued.map(r=>{const c=drafts.find(v=>v.version===2&&v.id===r.challenge_id);
         return {...r,consumed_hash:c?.content_hash,consumed:c?.snapshot_json};}));
      }
      if(sql.includes('FROM anvil.execution_challenges')&&sql.includes('request_id=')){
        assert.ok(sql.includes('version=1'));return rows(drafts.filter(r=>r.version===1&&(r.snapshot_json.request.requestId===args[3]||r.snapshot_json.request.clientNonce===args[4])));
      }
      if(sql.includes('FROM anvil.execution_challenges')&&sql.includes('id=$4 AND version=1'))
        return rows(drafts.filter(r=>r.version===1&&r.id===args[3]&&r.content_hash===args[4]));
      if(sql.startsWith('SELECT count(*)')){
        assert.ok(sql.includes('count(*) FILTER (WHERE version=1)'));const challenges=drafts.filter(r=>r.version===1);
        return rows([{total:challenges.length,recent:challenges.filter(v=>Date.parse(v.snapshot_json.publicChallenge.issuedAt)>now().getTime()-60000).length,sequence:drafts.length+1}]);
      }
      if(sql.startsWith('SELECT COALESCE(max(server_sequence)'))return rows([{sequence:drafts.length+1}]);
      if(sql.startsWith('INSERT INTO anvil.execution_challenges(')){
        const [pid,id,gid,gv,seq,hash,raw]=args,s=JSON.parse(raw);assert.deepEqual([pid,gid,gv,seq,hash],[f.pid,grant().id,grant().version,drafts.length+1,digest(s)]);
        drafts.push({id,version:s.previousRef===null?1:2,content_hash:hash,snapshot_json:s});return{rows:[],rowCount:1};
      }
      if(sql.startsWith('INSERT INTO anvil.execution_receipts(')){
        if(mode.failWrite)throw Error('합성 영수증 저장 실패');
        const [pid,id,gid,gv,challenge_id,hash,raw]=args,s=JSON.parse(raw);
        assert.deepEqual([pid,gid,gv,hash],[f.pid,grant().id,grant().version,digest(s)]);
        assert.ok(issued.every(r=>Date.parse(r.snapshot_json.expiresAt)<=Date.parse(s.issuedAt)));issued.push({id,challenge_id,content_hash:hash,snapshot_json:s});return{rows:[],rowCount:1};
      }
      throw Error('지원하지 않는 시험 조회 '+sql);
    }};
  }};
  const storage={async observe(scope:any,stamp:string,signal:AbortSignal){
    assert.ok(signal instanceof AbortSignal);assert.ok(!('query' in scope));assert.deepEqual(scope.evidenceRefs,grant().snapshot_json.binding.checks.storage.evidenceRefs);
    if(mode.storage==='HANG')await new Promise<void>(r=>signal.addEventListener('abort',()=>r(),{once:true}));
    return {state:mode.storage==='READY'?'VERIFIED_CURRENT':'UNKNOWN',scope,checkedAt:stamp,expiresAt:new Date(Math.min(Date.parse(grant().snapshot_json.expiresAt),Date.parse(stamp)+mode.storageTtl)).toISOString()};
  }};
  return {pool,storage,now,mode,events:()=>committed,receipts:()=>receipts};
}

async function journey(){
  const executionId = randomUUID();
  const f = await executionStartOriginFixture({normalExecutionId:executionId,connectorEnvironment:true,richContext:true,constitutionContext:true,
    environmentDependencies:true,snapshotRoot:true,originConsumptionStorage:true,budgetElapsedMs:3600000});
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
    undefined,undefined,undefined,undefined,null,undefined,undefined,source,{pool:store.pool} as any,{pool:store.pool,storage:store.storage,origin:'https://anvil-synthetic.invalid'} as any);
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

    const postChallenge=async(r=request)=>{
      const sig=sign('sha256',executionChallengeRequestBytes('EXECUTION',r),{key,dsaEncoding:'ieee-p1363'}).toString('base64url');
      return app.inject({method:'POST',url:path+'/challenges',payload:{...r,signature:sig}});
    };
    const newChallenge=async(r=request)=>{const a=await postChallenge(r);assert.equal(a.statusCode,200);return a.json();};
    const first=await newChallenge();
    const auth=(a=first,change:Record<string,unknown>={})=>{
      const c=a.challenge,proof={requestId:c.requestId,grantRef:c.grantRef,credentialGeneration:c.credentialGeneration,scopeDigest:c.scopeDigest,
        serverNonce:c.serverNonce,clientNonce:c.clientNonce,expiresAt:c.expiresAt,...change};
      const signature=sign('sha256',executionProofBytes('EXECUTION_CREDENTIAL_EXCHANGE',proof),{key,dsaEncoding:'ieee-p1363'}).toString('base64url');
      return {schemaVersion:1,challengeRef:a.ref,proof,signature};
    };
    const frame=auth();
    const exchange=(value=frame,body='{}')=>inject((req,rep)=>{Object.defineProperty(req.socket,'encrypted',{value:true});app.routing(req,rep);},
      {method:'POST',url:path+'/credential-exchange',payload:body,headers:{host:'anvil-synthetic.invalid','content-type':'application/json',
        'anvil-execution-auth':Buffer.from(canonicalJson(value)).toString('base64url')}});
    return {f,app,store,first,auth,frame,exchange,newChallenge,postChallenge,request};
  }catch(error){await app.close();throw error;}
}
test('기존 START의 독립 예약·등록 서명·challenge로 한 번 발급하고 같은 packet은 원 영수증만 돌려준다',async()=>{
 const h=await journey();try{
  const [a,b]=await Promise.all([h.exchange(),h.exchange()]);assert.equal(a.statusCode,200);assert.equal(b.statusCode,200);
  const result=[a.json(),b.json()],first=result.find(r=>r.credential),repeat=result.find(r=>r.delivery==='UNKNOWN');
  assert.ok(first&&repeat);assert.ok(/^av3ex1_[A-Za-z0-9_-]{43}$/.test(first.credential));assert.equal(a.headers['cache-control'],'no-store');
  assert.equal(h.store.receipts().length,1);assert.equal(h.store.events().length,2);assert.deepEqual(first.receiptRef,repeat.receiptRef);
  const s=h.store.receipts()[0].snapshot_json;
  assert.equal(s.tokenDigest,createHash('sha256').update(first.credential).digest('hex'));assert.equal(JSON.stringify([...h.store.events(),...h.store.receipts()]).includes(first.credential),false);
  assert.equal(h.f.tables.execution_credentials![0]!.snapshot_json.state,'RESERVED_NO_TOKEN');assert.equal(s.binding.credentialGeneration,1);assert.equal(h.f.actor.credentialGeneration,3);
  assert.ok(Date.parse(s.expiresAt)<=Math.min(Date.parse(s.issuedAt)+900000,Date.parse(h.f.tables.execution_grants![0]!.snapshot_json.expiresAt)));
  assert.equal((await h.exchange(h.auth(h.first,{scopeDigest:digest('다른 범위')}))).statusCode,412);
  assert.equal((await h.exchange(h.frame,'{"other":true}')).statusCode,412);
  const reread=await h.newChallenge();assert.deepEqual(reread,h.first);
  const second=await h.newChallenge({...h.request,requestId:randomUUID(),clientNonce:randomBytes(32).toString('base64url')});
  assert.equal((await h.exchange(h.auth(second))).statusCode,409);assert.equal(h.store.receipts().length,1);
  for(let i=0;i<3;i++)await h.newChallenge({...h.request,requestId:randomUUID(),clientNonce:randomBytes(32).toString('base64url')});
  const sixth={...h.request,requestId:randomUUID(),clientNonce:randomBytes(32).toString('base64url')};
  const over=await h.postChallenge(sixth);assert.equal(over.statusCode,429);assert.equal(over.json().code,'EXECUTION_CHALLENGE_RATE_LIMIT');
  h.store.mode.offset+=120001;
  assert.ok(h.store.now().getTime()>=Date.parse(h.f.tables.execution_grants![0]!.snapshot_json.expiresAt));
  const expired=await h.exchange();assert.equal(expired.statusCode,412);assert.equal(expired.json().credential,undefined);
 }finally{await h.app.close();}
});
test('보호 저장 부재·지연·서명 오류·철회·만료 시 소비와 발급이 모두 없다',async()=>{
 const h=await journey();try{
  for(const mode of ['UNKNOWN','HANG']){h.store.mode.storage=mode;assert.equal((await h.exchange()).statusCode,412);}
  h.store.mode.storage='READY';assert.equal((await h.exchange({...h.frame,signature:randomBytes(64).toString('base64url')})).statusCode,412);
  h.store.mode.revoked=true;assert.equal((await h.exchange()).statusCode,412);h.store.mode.revoked=false;
  h.store.mode.offset+=120001;assert.equal((await h.exchange()).statusCode,412);
  assert.equal(h.store.events().length,1);assert.equal(h.store.receipts().length,0);
 }finally{await h.app.close();}
});
test('영수증 쓰기 실패·ROLLBACK 태그·COMMIT 응답유실은 원문을 반환하지 않는다',async()=>{
 const h=await journey();try{
  h.store.mode.failWrite=true;const failed=await h.exchange();assert.equal(failed.statusCode,503);assert.equal(failed.json().credential,undefined);
  assert.equal(h.store.events().length,1);assert.equal(h.store.receipts().length,0);h.store.mode.failWrite=false;
  h.store.mode.badTag=true;const bad=await h.exchange();assert.equal(bad.json().code,'EXECUTION_CREDENTIAL_COMMIT_UNKNOWN');assert.equal(h.store.receipts().length,0);
  h.store.mode.badTag=false;h.store.mode.lost=true;const lost=await h.exchange();assert.equal(lost.statusCode,503);assert.equal(lost.json().credential,undefined);
  assert.equal(h.store.mode.discards,2);assert.equal(h.store.receipts().length,1);h.store.mode.lost=false;
  const again=await h.exchange();assert.equal(again.statusCode,200);assert.equal(again.json().delivery,'UNKNOWN');assert.equal(again.json().credential,undefined);
  assert.equal(again.json().receiptRef.id,h.store.receipts()[0].id);assert.equal(h.store.events().length,2);
 }finally{await h.app.close();}
});
test('같은 grant의 만료 경계 재교환은 독립 예약을 보존하고 과거 packet을 원 receipt로 조회한다',async()=>{
 const h=await journey();try{
  h.store.mode.storageTtl=5000;const first=await h.exchange();assert.equal(first.statusCode,200);const a=first.json(),reservation=structuredClone(h.f.tables.execution_credentials);
  const next=async()=>h.newChallenge({...h.request,requestId:randomUUID(),clientNonce:randomBytes(32).toString('base64url'),issuedAt:h.store.now().toISOString()});
  h.store.mode.offset+=4999;const early=await next();assert.equal((await h.exchange(h.auth(early))).statusCode,409);assert.equal(h.store.receipts().length,1);
  h.store.mode.offset++;assert.equal(h.store.now().toISOString(),a.expiresAt);const challenge=await next(),packet=h.auth(challenge);
  const results=await Promise.all([h.exchange(packet),h.exchange(packet)]);for(const r of results)assert.equal(r.statusCode,200,r.body);
  const fresh=results.map(r=>r.json()).find(r=>r.credential),repeat=results.map(r=>r.json()).find(r=>r.delivery==='UNKNOWN');assert.ok(fresh&&repeat);
  assert.notEqual(fresh.credential,a.credential);assert.notDeepEqual(fresh.receiptRef,a.receiptRef);assert.deepEqual(fresh.receiptRef,repeat.receiptRef);
  assert.equal(h.store.receipts().length,2);assert.deepEqual(h.f.tables.execution_credentials,reservation);
  const old=await h.exchange();assert.equal(old.statusCode,200,old.body);assert.deepEqual(old.json(),{receiptRef:a.receiptRef,delivery:'UNKNOWN',expiresAt:a.expiresAt});
  const receipts=h.store.receipts().map(r=>r.snapshot_json);assert.equal(receipts[1].issuedAt,receipts[0].expiresAt);assert.equal(receipts[1].binding.credentialGeneration,1);
  assert.equal(JSON.stringify([...h.store.events(),...h.store.receipts()]).includes(fresh.credential),false);
 }finally{await h.app.close();}
});
