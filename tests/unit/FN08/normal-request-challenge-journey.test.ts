import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {digest,journey} from './normal-request-challenge-fixture.ts';
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
