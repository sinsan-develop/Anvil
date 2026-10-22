import assert from 'node:assert/strict';
import {test} from 'node:test';
import {ownershipArchiveFixture} from './ownership-archive-fixture.ts';
test('인증된 소비 경로는 같은 transaction의 HUMAN session을 처음·종료 직전 검사한다',async()=>{
 const f=await ownershipArchiveFixture(),result=await f.store.acceptAuthenticated(f.access,f.authToken,f.csrf,f.scope,f.input,new AbortController().signal);
 assert.equal(result.executionAuthorized,false);assert.equal(result.dispatchPerformed,false);assert.equal(f.sessionReads(),2);assert.equal(f.stats().commits,1);
 assert(!JSON.stringify(result).includes(f.authToken));assert(!JSON.stringify(result).includes(f.csrf));
});
test('최종 HUMAN session 회수·다른 주체·재인증 기한·CSRF 불일치는 수용을 rollback한다',async()=>{
 for(const mode of ['SESSION_REVOKED','ACTOR','CLIENT','SESSION','GENERATION','REAUTH','CSRF','INSTALLATION']){const f=await ownershipArchiveFixture(),before=f.state();
  if(mode==='SESSION_REVOKED')f.fault(mode);
  if(mode==='ACTOR')f.authRow.uid='30000000-0000-4000-8000-000000000099';
  if(mode==='CLIENT')f.authRow.client_id='30000000-0000-4000-8000-000000000099';
  if(mode==='SESSION')f.authRow.id='30000000-0000-4000-8000-000000000099';
  if(mode==='GENERATION')f.authRow.current_generation=f.authRow.credential_generation=2;
  if(mode==='REAUTH')f.authRow.reauth_until=new Date('2026-10-23T00:00:00Z');
  if(mode==='INSTALLATION')f.access.installationId='30000000-0000-4000-8000-000000000099';
  await assert.rejects(()=>f.store.acceptAuthenticated(f.access,f.authToken,mode==='CSRF'?'x'.repeat(43):f.csrf,f.scope,f.input,new AbortController().signal),{message:'OWNERSHIP_ARCHIVE_UNAVAILABLE'});
  assert.deepEqual(f.state(),before,mode);assert.equal(f.stats().commits,0,mode);
 }
});
test('원 준비/요청과 서명 검증을 소비해 bootstrap의 관측·채택·head를 한 transaction으로 기록한다',async()=>{
 const f=await ownershipArchiveFixture(),before=f.state(),result=await f.store.accept(f.scope,f.input,new AbortController().signal),after=f.state();
 assert.equal(result.purpose,'OWNERSHIP_ARCHIVE_SYNTHETIC_COMMIT');assert.equal(result.executionAuthorized,false);assert.equal(result.dispatchPerformed,false);
 assert.equal(after.observations.length,1);assert.equal(after.anchors.length,1);assert.equal(after.events.length,before.events.length+2);assert.equal(after.events.at(-1).snapshot_json.kind,'ANCHOR_ADOPTED');assert.equal(after.head.head_generation,1);assert.equal(after.head.snapshot_json.state,'ACTIVE');
 assert.deepEqual(f.stats(),{released:1,commits:1,rollbacks:0,currentReads:2});
 await assert.rejects(()=>f.store.accept(f.scope,f.input,new AbortController().signal));assert.deepEqual(f.state(),after);
});
test('CURRENT는 최초 anchor를 다시 만들지 않고 exact head CAS를 갱신한다',async()=>{
 const f=await ownershipArchiveFixture(true),before=f.state();await f.store.accept(f.scope,f.input,new AbortController().signal);const after=f.state();
 assert.equal(after.anchors.length,before.anchors.length);assert.equal(after.events.length,before.events.length+1);assert.equal(after.head.head_generation,2);assert.deepEqual(after.head.snapshot_json.previousHeadRef,f.input.expectedHeadRef);
});
test('읽기/쓰기/최종기한·현재권한/CAS 실패는 원 상태로 rollback하고 자동 재시도하지 않는다',async()=>{
 for(const [mode,current]of[['READ',false],['WRITE',false],['LATE',false],['AUTH',false],['CAS',true],['COMMIT',false]] as const){const f=await ownershipArchiveFixture(current),before=f.state();f.fault(mode);await assert.rejects(()=>f.store.accept(f.scope,f.input,new AbortController().signal),(e:Error)=>e.message===(mode==='COMMIT'?'OWNERSHIP_ARCHIVE_COMMIT_UNKNOWN':'OWNERSHIP_ARCHIVE_UNAVAILABLE'));assert.deepEqual(f.state(),before,mode);assert.equal(f.stats().commits,0);assert.equal(f.stats().rollbacks,1);assert.equal(f.stats().released,1);}
});
test('기본 authority 없음·다른 scope/nonce/head·취소는 수용하지 않는다',async()=>{
 const f=await ownershipArchiveFixture();await assert.rejects(()=>f.withoutAuthority().accept(f.scope,f.input,new AbortController().signal));
 for(const mutate of [(i:any)=>i.report.nonce='AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE',(i:any)=>i.expectedHeadRef=i.requestRef,(i:any)=>i.expectedTailRef={...i.expectedTailRef,version:2}]){const g=await ownershipArchiveFixture(),before=g.state(),input=structuredClone(g.input);mutate(input);await assert.rejects(()=>g.store.accept(g.scope,input,new AbortController().signal));assert.deepEqual(g.state(),before);}
 const g=await ownershipArchiveFixture(),before=g.state(),signal=AbortSignal.abort();await assert.rejects(()=>g.store.accept(g.scope,g.input,signal));assert.deepEqual(g.state(),before);
});
test('rollback 실패 연결은 pool에 정상 반환하지 않고 폐기한다',async()=>{
 const f=await ownershipArchiveFixture(),before=f.state();f.fault('ROLLBACK');await assert.rejects(()=>f.store.accept(f.scope,f.input,new AbortController().signal),{message:'OWNERSHIP_ARCHIVE_ROLLBACK_UNCONFIRMED'});assert.deepEqual(f.state(),before);assert.deepEqual(f.connection(),{destroyed:1,returnedDirty:false});
});
test('합성 권위 포트가 await 중 변경되면 저장을 진행하지 않는다',async()=>{
 const f=await ownershipArchiveFixture(),before=f.state();f.fault('TRANSPORT');await assert.rejects(()=>f.store.accept(f.scope,f.input,new AbortController().signal),{message:'OWNERSHIP_ARCHIVE_UNAVAILABLE'});assert.deepEqual(f.state(),before);assert.equal(f.stats().commits,0);
});
test('COMMIT 뒤 응답 유실은 UNKNOWN이며 rollback으로 미저장을 단정하지 않는다',async()=>{
 const f=await ownershipArchiveFixture();f.fault('COMMIT_REPLY_LOST');await assert.rejects(()=>f.store.accept(f.scope,f.input,new AbortController().signal),{message:'OWNERSHIP_ARCHIVE_COMMIT_UNKNOWN'});const saved=f.state();assert.equal(saved.observations.length,1);assert.equal(saved.head.head_generation,1);assert.equal(f.connection().destroyed,1);assert.equal(f.stats().commits,1);
 f.fault('');await assert.rejects(()=>f.store.accept(f.scope,f.input,new AbortController().signal));assert.deepEqual(f.state(),saved);
});
test('다른 project/세대·재해시 후보 anchor·정상 서명한 다른 nonce도 원 요청으로 채택하지 않는다',async()=>{
 for(const field of ['projectId','executionGeneration'] as const){const f=await ownershipArchiveFixture(),before=f.state(),scope={...f.scope,[field]:field==='projectId'?'30000000-0000-4000-8000-000000000099':2};await assert.rejects(()=>f.store.accept(scope,f.input,new AbortController().signal));assert.deepEqual(f.state(),before);}
 const f=await ownershipArchiveFixture(),before=f.state();f.fault('CANDIDATE');await assert.rejects(()=>f.store.accept(f.scope,f.input,new AbortController().signal));assert.deepEqual(f.state(),before);
 const g=await ownershipArchiveFixture(),original=g.state(),i=structuredClone(g.input);i.report.nonce='AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE';i.signature=g.signed(i.report);await assert.rejects(()=>g.store.accept(g.scope,i,new AbortController().signal));assert.deepEqual(g.state(),original);
});
