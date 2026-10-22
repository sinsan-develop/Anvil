import assert from 'node:assert/strict';
import {test} from 'node:test';
import {canonicalJson} from '../../../contracts/canonical.ts';
import {sentResponseBasisFixture} from './sent-response-basis-fixture.ts';

test('응답 조회는 명시 readonly current만 사용하고 부재시 기존 생성 current로 우회하지 않는다',async()=>{
 const f=await sentResponseBasisFixture();let writes=0,reads=0;
 const v=await f.bound(s=>s.currentSentResponse(f.e,f.claimRef),c=>({...c,current:async()=>{writes++;throw Error('MUTATING_CURRENT_FORBIDDEN');},currentReadOnly:async()=>{reads++;return c.current();}}));
 assert.equal(v.purpose,'SENT_RESPONSE_ONLY');assert.equal(writes,0);assert.equal(reads,2);
 await assert.rejects(f.bound(s=>s.currentSentResponse(f.e,f.claimRef),c=>({...c,currentReadOnly:undefined})),{message:'PROVIDER_SEND_CURRENT_UNAVAILABLE'});
 assert.equal(writes,0);
});

test('마지막 context await 중 기한 경과는 응답용과 기존 SEND 모두 최종 성공으로 반환하지 않는다',async()=>{
 for(const method of ['currentSentResponse','current'])for(const mode of ['PERMIT','HUMAN']){
  const f=await sentResponseBasisFixture();let reads=0;
  if(mode==='HUMAN')f.actor.authSession.absoluteExpiresAt=new Date(Date.parse(f.f.basis.fact.checkedAt)+200).toISOString();
  await assert.rejects(f.bound(s=>s[method](f.e,f.claimRef),c=>({...c,current:async()=>{
   const value=await c.current();if(++reads===2)f.f.advance(mode==='HUMAN'?300:26000);return value;
  }})),{message:'PROVIDER_SEND_CURRENT_UNAVAILABLE'});
  assert.equal(reads,2);assert(!f.calls.some(s=>/^(INSERT|UPDATE|DELETE|BEGIN|COMMIT)/.test(s)));
 }
});

test('응답 전용 current는 BUSY에서 원 THREAD·소비 permit/nonce를 읽고 새 SEND 권한은 반환하지 않는다',async()=>{
 const f=await sentResponseBasisFixture();f.fault('busy');const before=canonicalJson(f.f.state());
 const result=await f.bound(s=>s.currentSentResponse(f.e,f.claimRef));
 assert.equal(result.purpose,'SENT_RESPONSE_ONLY');assert.equal(result.executionAuthorized,false);assert.equal(result.dispatchPerformed,false);
 assert.deepEqual(result.attemptRef,f.attempt.localAttemptRef);assert.deepEqual(result.permitRef,f.attempt.permitRef);
 assert.deepEqual(result.basis.parentThreadClaimRef,f.claimRef);assert.deepEqual(result.basis.claimRef,f.claimRef);
 assert.equal(result.basis.expiresAt,f.e.expiresAt);assert.equal('key' in result,false);
 await assert.rejects(f.bound(s=>s.current(f.e,f.claimRef)));assert.equal(canonicalJson(f.f.state()),before);
 assert(!f.calls.some(s=>/^(INSERT|UPDATE|DELETE|BEGIN|COMMIT)/.test(s)));
});

test('응답 전용 current도 부모/permit 부재·시도 불일치·소비 nonce 부재·HUMAN 만료는 거절한다',async()=>{
 for(const mode of ['missingClaim','missingPermit','attempt','nonce','expired']){
  const f=await sentResponseBasisFixture();f.fault(mode);
  if(mode==='attempt')f.attempt.localAttemptRef={...f.attempt.localAttemptRef,version:2};
  if(mode==='nonce')f.f.state().challenges=[];
  if(mode==='expired')f.actor.authSession.absoluteExpiresAt='2020-01-01T00:00:00.000Z';
  await assert.rejects(f.bound(s=>s.currentSentResponse(f.e,f.claimRef)),{message:'PROVIDER_SEND_CURRENT_UNAVAILABLE'});
  assert(!f.calls.some(s=>/^(INSERT|UPDATE|DELETE|BEGIN|COMMIT)/.test(s)));
 }
});
