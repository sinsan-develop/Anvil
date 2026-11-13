import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {canonicalJson} from '../../../contracts/canonical.ts';
import {preparedExecution,httpsFixture} from './normal-start-execution-fixture.ts';
import {NormalProtectedGetClient} from '../../../apps/connector/runtime/normal-protected-get-client.ts';
import {NormalProtectedPostClient} from '../../../apps/connector/runtime/normal-protected-post-client.ts';
import {receiveNormalStart} from '../../../apps/connector/runtime/normal-start-intake.ts';
import {journey} from './normal-request-challenge-fixture.ts';

test('갱신 저장 실패·COMMIT 불명·철회는 재발급/과거 receipt 대체 없이 닫힌다',async()=>{
 for(const mode of ['WRITE','COMMIT_LOST','REVOKED','STORAGE']){
  const h=await journey(undefined,undefined,undefined,undefined,undefined,5000);
  try{
   h.store.mode.offset+=5000;
   const c=await h.newChallenge({...h.exchangeRequest,requestId:randomUUID(),clientNonce:randomBytes(32).toString('base64url'),issuedAt:h.store.now().toISOString()}),p=h.auth(c);
   if(mode==='WRITE')h.store.mode.failWrite=true;
   if(mode==='COMMIT_LOST')h.store.mode.lost=true;
   if(mode==='REVOKED')h.store.mode.revoked=true;
   if(mode==='STORAGE')h.store.mode.storage='UNKNOWN';
   const response=await h.exchange(p);assert.ok(response.statusCode>=400);assert.equal(response.json().credential,undefined);
   assert.equal(h.store.receipts().length,mode==='COMMIT_LOST'?2:1);
   if(mode==='COMMIT_LOST'){
    assert.equal(response.json().code,'EXECUTION_CREDENTIAL_COMMIT_UNKNOWN');assert.equal(h.store.mode.discards,1);
    h.store.mode.lost=false;const repeated=await h.exchange(p);assert.equal(repeated.statusCode,200);assert.equal(repeated.json().delivery,'UNKNOWN');
    assert.deepEqual(repeated.json().receiptRef,{id:h.store.receipts()[1].id,version:1,contentHash:h.store.receipts()[1].content_hash});
    assert.equal(repeated.json().credential,undefined);assert.equal(h.store.receipts().length,2);
   }
   assert.equal(h.f.tables.execution_credentials!.length,1);assert.equal(h.f.tables.execution_credentials![0]!.credential_generation,1);
  }finally{await h.app.close();}
 }
});

test('실제 START/permit 이후 재교환은 새 nonce·cursor로 재수신하되 내구 attempt의 wire1을 보존한다',async()=>{
 const f=await preparedExecution(5000),h=f.h;
 try{
  const started=await f.make().coordinator.start(f.e,f.signal);
  assert.equal(started.state,'RESPONSE_RECORDED');assert.equal(f.mode.wires,1);
  assert.equal(f.q.observations.length,0);assert.equal(f.q.acks.length,0);
  const oldPage:any=await f.get.send(await f.get.prepareCommandPage({afterSequence:0,waitMs:0},f.signal),f.signal);
  const reservation=canonicalJson(h.f.tables.execution_credentials),oldToken=h.token;
  h.store.mode.offset+=5000;
  const request={...h.exchangeRequest,requestId:randomUUID(),clientNonce:randomBytes(32).toString('base64url'),issuedAt:h.store.now().toISOString()};
  const challenge=await h.newChallenge(request),packet=h.auth(challenge);
  const result=await h.exchange(packet);assert.equal(result.statusCode,200,result.body);
  const next=result.json();assert.notEqual(next.credential,oldToken);assert.notDeepEqual(next.receiptRef,h.credentialRef);
  const nativeHttp=httpsFixture({...h,token:next.credential,credentialExpiresAt:next.expiresAt,credentialRef:next.receiptRef});
  const get=new NormalProtectedGetClient(nativeHttp.options,nativeHttp.ports),post=new NormalProtectedPostClient(nativeHttp.options,nativeHttp.ports);
  const rawOld=await h.post(h.signed(h.mk()));assert.equal(rawOld.statusCode,404);
  const fresh:any=await get.send(await get.prepareCommandPage({afterSequence:0,waitMs:0},f.signal),f.signal);
  assert.notEqual(fresh.nextCursor,oldPage.nextCursor);assert.deepEqual(fresh.items[0].envelope,f.e);
  const entriesBefore=canonicalJson([...f.fs.files].map(([p,v])=>[p,v.bytes.toString()]));
  await receiveNormalStart(get,f.intake,fresh.items[0],fresh.proofResultRef,f.signal);
  assert.equal(canonicalJson([...f.fs.files].map(([p,v])=>[p,v.bytes.toString()])),entriesBefore);
  assert.deepEqual(await f.make().coordinator.start(f.e,f.signal),started);
  assert.equal(f.mode.wires,1);assert.equal(f.q.permits.length,1);
  const ack=await f.make().spool.sync(post,f.signal);assert.ok(ack);assert.equal(f.q.observations.length,5);
  assert.equal(nativeHttp.calls.filter(c=>c.method==='POST'&&c.path.endsWith('/observations')).length,1);
  assert.equal(ack.snapshot.highestContiguous,5);assert.equal(f.q.acks.length,1);
  const observationChallenge=h.store.events().find(v=>v.version===1&&v.snapshot_json.request.target.path.endsWith('/observations'));
  assert.ok(observationChallenge);assert.deepEqual(observationChallenge.snapshot_json.credentialRef,next.receiptRef);
  const consumption=h.store.events().find(v=>v.id===observationChallenge.id&&v.version===2);
  assert.ok(consumption);
  const receipt=h.store.receipts().find(v=>v.id===consumption.snapshot_json.consumption.resultRef.id);
  assert.ok(receipt);assert.equal(receipt.snapshot_json.kind,'NORMAL_OBSERVATIONS');
  assert.deepEqual(receipt.snapshot_json.credentialRef,next.receiptRef);
  assert.deepEqual(receipt.snapshot_json.ackRef,ack.ref);
  const old=await h.exchange(h.frame);assert.equal(old.statusCode,200);assert.equal(old.json().delivery,'UNKNOWN');
  assert.deepEqual(old.json().receiptRef,h.credentialRef);assert.equal('credential' in old.json(),false);
  assert.equal(canonicalJson(h.f.tables.execution_credentials),reservation);
  assert.equal(h.store.receipts().filter(r=>r.snapshot_json.kind==='NORMAL_CREDENTIAL_ISSUED').length,2);
  const leak=canonicalJson([h.store.events(),h.store.receipts(),[...f.fs.files].map(([p,v])=>[p,v.bytes.toString()])]);
  assert.equal(leak.includes(oldToken),false);assert.equal(leak.includes(next.credential),false);
  // 만료+새 credential scope의 복합 거절이며 특정 검사 하나의 도달 증거로 해석하지 않는다.
  const rejected=await get.prepareCommandPage({afterSequence:oldPage.items[0].sequence,afterCursor:oldPage.nextCursor,waitMs:0},f.signal);
  await assert.rejects(()=>get.send(rejected,f.signal));
 }finally{await h.app.close();}
});
