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
  const mode={offset:1,revoked:false,storage:'READY',failWrite:false,badTag:false,lost:false,conns:0,discards:0,totalBase:0,recentBase:0,corruptReceipt:false,revokeAfterWrite:false};
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

  const sqlArgs:unknown[][]=[];
  let lock=Promise.resolve();
  const pool={async connect(){
    mode.conns++;
    let drafts:any[]=[],issued:any[]=[],unlock=()=>{};
    return {release(err?:Error){if(err)mode.discards++;},async query(sql:string,args:any[]=[]){
      sqlArgs.push(structuredClone(args));
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
      if(sql.startsWith('SELECT * FROM anvil.normal_request_credential(')){
        const [token,cid,eid,gid,version,hash,gen]=args;
        assert.match(token,/^[0-9a-f]{64}$/);
        const g=grant(),c=tables.execution_credentials![0]!;
        const r=issued.find(r=>r.snapshot_json.tokenDigest===token),receipt=r?.snapshot_json;
        if(!r||mode.revoked||mode.corruptReceipt||receipt.expiresAt<=now().toISOString()||
          cid!==registration.row.connector_id||eid!==g.execution_id||gid!==g.id||version!==g.version||hash!==g.content_hash||gen!==c.credential_generation)return rows([]);
        const original=drafts.find(v=>v.id===r.challenge_id&&v.version===1),consumed=drafts.find(v=>v.id===r.challenge_id&&v.version===2);
        const ref={id:r.id,version:1,contentHash:r.content_hash};
        assert.deepEqual(receipt.challengeRef,{id:original.id,version:1,contentHash:digest(original.snapshot_json)});
        assert.deepEqual(receipt.reservationRef,{id:c.id,version:1,contentHash:digest(c.snapshot_json)});
        assert.equal(digest(receipt),r.content_hash);
        assert.deepEqual(consumed.snapshot_json.consumption.resultRef,ref);
        return rows([{project_id:g.project_id,credential_ref:ref,expires_at:new Date(receipt.expiresAt)}]);
      }
      if(sql.startsWith('SELECT * FROM anvil.normal_exchange_current('))return current(args);
      if(sql.startsWith('SELECT clock_timestamp()'))return rows([{at:now()}]);
      if(sql.includes('FROM anvil.usage_reservations')){assert.deepEqual(args,[f.pid]);return rows(tables.usage_reservations!);}
      if(sql.includes('FROM anvil.execution_credentials'))return rows(tables.execution_credentials!.filter(r=>r.project_id===args[0]&&r.grant_id===args[1]&&r.grant_version===args[2]&&r.credential_generation===args[3]).map(r=>({...r,version:String(r.version)})));
      if(sql.includes('FROM anvil.execution_receipts r LEFT JOIN')){
        return rows(issued.map(r=>{const c=drafts.find(v=>v.version===2&&v.id===r.challenge_id);
         return {...r,consumed_hash:c?.content_hash,consumed:c?.snapshot_json};}));
      }
      if(sql.includes('FROM anvil.execution_challenges')&&sql.includes('request_id=')){
        assert.ok(sql.includes('version=1'));return rows(drafts.filter(r=>r.version===1&&(r.snapshot_json.request.requestId===args[3]||r.snapshot_json.request.clientNonce===args[4])));
      }
      if(sql.includes('FROM anvil.execution_challenges')&&sql.includes('id=$4 AND version=1'))
        return rows(drafts.filter(r=>r.version===1&&r.id===args[3]&&r.content_hash===args[4]));
      if(sql.startsWith('SELECT count(*) FILTER (WHERE v.version=1)')){
        const [pid,gid,gv,raw,at]=args;
        assert.deepEqual([pid,gid,gv],[f.pid,grant().id,grant().version]);
        const ref=JSON.parse(raw),all=drafts.filter(v=>v.version===1),mine=all.filter(v=>v.snapshot_json.credentialRef?.contentHash===ref.contentHash);
        return rows([{total:all.length+mode.totalBase+mode.recentBase,sequence:drafts.length+mode.totalBase+mode.recentBase+1,
          recent:mine.filter(v=>Date.parse(v.snapshot_json.publicChallenge.issuedAt)>at.getTime()-60000).length+mode.recentBase,
          live:mine.filter(v=>Date.parse(v.snapshot_json.publicChallenge.expiresAt)>at.getTime()&&!drafts.some(t=>t.id===v.id&&t.version===2)).length}]);
      }
      if(sql.startsWith('SELECT count(*)')){
        assert.ok(sql.includes('count(*) FILTER (WHERE version=1)'));const challenges=drafts.filter(r=>r.version===1);
        return rows([{total:challenges.length,recent:challenges.filter(v=>Date.parse(v.snapshot_json.publicChallenge.issuedAt)>now().getTime()-60000).length,sequence:drafts.length+1}]);
      }
      if(sql.startsWith('SELECT COALESCE(max(server_sequence)'))return rows([{sequence:drafts.length+1}]);
      if(sql.startsWith('INSERT INTO anvil.execution_challenges(')){
        const [pid,id,gid,gv,seq,hash,raw]=args,s=JSON.parse(raw);assert.deepEqual([pid,gid,gv,seq,hash],[f.pid,grant().id,grant().version,drafts.length+1,digest(s)]);
        if(mode.revokeAfterWrite&&s.request.purpose==='EXECUTION_REQUEST')mode.revoked=true;
        drafts.push({id,version:s.previousRef===null?1:2,content_hash:hash,snapshot_json:s});return{rows:[],rowCount:1};
      }
      if(sql.startsWith('INSERT INTO anvil.execution_receipts(')){
        if(mode.failWrite)throw Error('합성 영수증 저장 실패');
        const [pid,id,gid,gv,challenge_id,hash,raw]=args,s=JSON.parse(raw);
        assert.deepEqual([pid,gid,gv,hash],[f.pid,grant().id,grant().version,digest(s)]);
        assert.equal(issued.length,0);issued.push({id,challenge_id,content_hash:hash,snapshot_json:s});return{rows:[],rowCount:1};
      }
      throw Error('지원하지 않는 시험 조회 '+sql);
    }};
  }};
  const storage={async observe(scope:any,stamp:string,signal:AbortSignal){
    assert.ok(signal instanceof AbortSignal);assert.ok(!('query' in scope));assert.deepEqual(scope.evidenceRefs,grant().snapshot_json.binding.checks.storage.evidenceRefs);
    if(mode.storage==='HANG')await new Promise<void>(r=>signal.addEventListener('abort',()=>r(),{once:true}));
    return {state:mode.storage==='READY'?'VERIFIED_CURRENT':'UNKNOWN',scope,checkedAt:stamp,expiresAt:grant().snapshot_json.expiresAt};
  }};
  return {sqlArgs,pool,storage,now,mode,events:()=>committed,receipts:()=>receipts};
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
    undefined,undefined,undefined,undefined,null,undefined,undefined,source,{pool:store.pool} as any,{pool:store.pool,storage:store.storage,origin:'https://anvil-synthetic.invalid'} as any,{origin:'https://anvil-synthetic.invalid'});
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
    const minted=await exchange();
    assert.equal(minted.statusCode,200);
    const token=minted.json().credential as string;
    assert.ok(/^av3ex1_[A-Za-z0-9_-]{43}$/.test(token));
    const mk=()=>({...request,requestId:randomUUID(),purpose:'EXECUTION_REQUEST',clientNonce:randomBytes(32).toString('base64url'),issuedAt:store.now().toISOString(),
      target:{method:'GET',path:path+'/commands',queryHash:digest({waitMs:0}),bodyHash:digest(null)}});
    const signed=(r:ReturnType<typeof mk>)=>({...r,signature:sign('sha256',executionChallengeRequestBytes('EXECUTION',r),{key,dsaEncoding:'ieee-p1363'}).toString('base64url')});
    const post=(payload:unknown,authorization='Bearer '+token,url=path+'/challenges')=>inject((req,rep)=>{
      Object.defineProperty(req.socket,'encrypted',{value:true});app.routing(req,rep);
    },{method:'POST',url,payload:JSON.stringify(payload),headers:{host:'anvil-synthetic.invalid','content-type':'application/json',authorization}});
    return {f,app,store,mk,signed,post,token,credentialRef:minted.json().receiptRef};
  }catch(error){await app.close();throw error;}
}
test('기존 START→예약→credential 발급 행을 인증하고 같은 조회 challenge는 nonce·기한·행을 재사용한다',async()=>{
 const h=await journey();try{
  const r=h.mk(),packet=h.signed(r),[first,second]=await Promise.all([h.post(packet),h.post(packet)]);
  assert.equal(first.statusCode,200,first.body);assert.equal(second.statusCode,200);assert.deepEqual(first.json(),second.json());
  const data=first.json(),c=data.challenge,stored=h.store.events().filter(v=>v.snapshot_json.request.purpose==='EXECUTION_REQUEST');
  assert.equal(stored.length,1);assert.deepEqual(stored[0].snapshot_json.credentialRef,h.credentialRef);
  assert.equal(h.f.actor.credentialGeneration,3);assert.equal(c.credentialGeneration,1);assert.equal(c.purpose,'EXECUTION_REQUEST');
  assert.equal(Buffer.from(c.serverNonce,'base64url').length,32);assert.ok(Date.parse(c.expiresAt)>Date.parse(c.issuedAt));
  assert.ok(Date.parse(c.expiresAt)<=Math.min(Date.parse(c.issuedAt)+30000,Date.parse(h.store.receipts()[0].snapshot_json.expiresAt)));
  assert.equal(data.nonceConsumed,false);assert.equal(data.executionAuthorized,false);
  assert.equal(JSON.stringify([h.store.sqlArgs,h.store.events(),h.store.receipts(),data]).includes(h.token),false);
  const live=await h.post(h.signed(h.mk()));assert.equal(live.statusCode,429);assert.equal(live.json().code,'EXECUTION_REQUEST_CHALLENGE_LIVE_LIMIT');
  const conflict=await h.post(h.signed({...r,clientNonce:h.mk().clientNonce}));assert.equal(conflict.statusCode,409);
  const reused=await h.post(h.signed({...r,requestId:randomUUID()}));assert.equal(reused.statusCode,409);
  h.store.mode.offset+=30001;
  const replay=await h.post(packet);assert.equal(replay.statusCode,200,replay.body);assert.deepEqual(replay.json(),data);
  const fresh=await h.post(h.signed(h.mk()));assert.equal(fresh.statusCode,200,fresh.body);assert.notEqual(fresh.json().challenge.id,c.id);
 }finally{await h.app.close();}
});
test('잘못된 Bearer·범위·등록 서명·GET 대상·세대·현재성·기한은 추가 행 없이 거절한다',async()=>{
 const h=await journey();try{
  const r=h.mk(),p=h.signed(r);
  assert.equal((await h.post(p,'Bearer av3ex1_'+randomBytes(32).toString('base64url'))).statusCode,404);
  assert.equal((await h.post(p,undefined,'/api/v1/connectors/'+randomUUID()+'/executions/'+randomUUID()+'/challenges')).statusCode,404);
  assert.equal((await h.post(h.signed({...r,credentialGeneration:3}))).statusCode,404);
  for(const skew of [-30001,30001])assert.equal((await h.post(h.signed({...r,issuedAt:new Date(h.store.now().getTime()+skew).toISOString()}))).statusCode,412);
  assert.equal((await h.post({...p,signature:randomBytes(64).toString('base64url')})).statusCode,412);
  assert.equal((await h.post(h.signed({...r,target:{...r.target,bodyHash:digest({})}}))).statusCode,412);
  assert.equal((await h.post(h.signed({...r,target:{...r.target,path:r.target.path.replace('/commands','/recovery/stop-instruction')}}))).statusCode,412);
  h.store.mode.corruptReceipt=true;assert.equal((await h.post(p)).statusCode,404);h.store.mode.corruptReceipt=false;
  h.store.mode.revokeAfterWrite=true;assert.ok((await h.post(p)).statusCode>=400);h.store.mode.revoked=false;h.store.mode.revokeAfterWrite=false;
  h.store.mode.offset+=900001;assert.equal((await h.post(p)).statusCode,404);
  assert.equal(h.store.events().length,2);
 }finally{await h.app.close();}
});
test('credential 분당 60·grant v1 수명 10000과 COMMIT 불명은 새 nonce 재발급 없이 처리한다',async()=>{
 const h=await journey();try{
  const p=h.signed(h.mk());
  h.store.mode.recentBase=60;let r=await h.post(p);assert.equal(r.statusCode,429);assert.equal(r.json().code,'EXECUTION_CHALLENGE_RATE_LIMIT');
  h.store.mode.recentBase=0;h.store.mode.totalBase=9999;r=await h.post(p);assert.equal(r.statusCode,429);assert.equal(r.json().code,'EXECUTION_CHALLENGE_LIFETIME_LIMIT');
  h.store.mode.totalBase=0;h.store.mode.badTag=true;r=await h.post(p);assert.equal(r.statusCode,503);assert.equal(r.json().challenge,undefined);
  assert.equal(h.store.events().length,2);
  h.store.mode.badTag=false;h.store.mode.lost=true;r=await h.post(p);assert.equal(r.statusCode,503);assert.equal(r.json().code,'EXECUTION_CHALLENGE_COMMIT_UNKNOWN');assert.equal(r.json().challenge,undefined);
  assert.equal(h.store.mode.discards,2);assert.equal(h.store.events().length,3);h.store.mode.lost=false;
  const again=await h.post(p);assert.equal(again.statusCode,200);assert.deepEqual(again.json().challenge,h.store.events()[2].snapshot_json.publicChallenge);
  assert.equal(h.store.events().length,3);
 }finally{await h.app.close();}
});
