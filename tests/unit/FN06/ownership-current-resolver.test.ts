import assert from 'node:assert/strict';
import {test} from 'node:test';
import {ownershipCurrentFixture} from './ownership-current-fixture.ts';
import {sentProcessEvidenceFixture} from './sent-process-evidence-fixture.ts';
import {SyntheticSentProcessEvidence} from '../../../apps/connector/runtime/sent-process-evidence.ts';
const ref=(n:number)=>({id:`60000000-0000-4000-8000-${String(n).padStart(12,'0')}`,version:1,contentHash:String(n%10).repeat(64)});

test('실 관측 공급자 부재는 연결 전에 UNAVAILABLE이며 저장 과거 상태로 대체하지 않는다',async()=>{const f=await ownershipCurrentFixture();await assert.rejects(f.read(true),{message:'OWNERSHIP_CURRENT_UNAVAILABLE'});assert.equal(f.stats().connects,0);assert.equal(f.stats().windows,0);});
test('새 CURRENT 원 요청/서명 수용·현재 권한/head/binding을 읽어 합성 BASIS_ONLY만 반환한다',async()=>{
 const f=await ownershipCurrentFixture(),v=await f.read().catch(e=>assert.fail(`${e.message}; sql=${f.queries.slice(-6).join('; ')}`));assert.equal(v.purpose,'SYNTHETIC_OWNERSHIP_CURRENT_BASIS_ONLY');assert.equal(v.currentAuthorityVerified,false);assert.equal(v.writerReleaseVerified,false);assert.equal(v.executionAuthorized,false);assert.equal(v.dispatchPerformed,false);assert.deepEqual(v.archive.anchor,f.anchor);assert.deepEqual(v.archive.binding,f.binding);assert.deepEqual(v.archive.anchorHeadRef,f.anchor.ref);assert.deepEqual(v.archive.bindingHeadRef,f.binding.ref);assert.equal(v.archive.revoked,false);assert.equal(f.stats().windows,1);assert.equal(f.stats().released,1);assert.equal(f.stats().rollbacks,0);assert(!f.queries.some(s=>/^(INSERT|UPDATE|DELETE)/.test(s)));assert(f.calls.filter(s=>s.includes('FROM anvil.auth_sessions')).length>=4);
});
test('과거/동일 read-start 관측·회수 head·최종 세션 회수·공급자 변경을 거절한다',async()=>{for(const mode of ['OLD','REVOKED','FINAL_SESSION','PORT','SIGNATURE']){const f=await ownershipCurrentFixture();f.mode(mode);await assert.rejects(f.read(),{message:'OWNERSHIP_CURRENT_UNAVAILABLE'});assert.equal(f.stats().rollbacks,1);assert.equal(f.stats().released,1);}});
test('다른 원 시도/permit/hash·anchor를 정합 caller selection으로 바꿔도 결박하지 못한다',async()=>{for(const mutate of [(s:any)=>s.permitRef=ref(90),(s:any)=>s.instructionContentHash='f'.repeat(64),(s:any)=>s.ownershipEvidenceRef=ref(91)]){const f=await ownershipCurrentFixture();mutate(f.selection);await assert.rejects(f.read(),{message:'OWNERSHIP_CURRENT_UNAVAILABLE'});assert.equal(f.stats().rollbacks,1);}});
test('새 readId만 붙인 이전 관측도 다음 조회의 현재 자료로 재사용하지 않는다',async()=>{const f=await ownershipCurrentFixture();await f.read();f.mode('REPLAY');await assert.rejects(f.read(),{message:'OWNERSHIP_CURRENT_UNAVAILABLE'});assert.equal(f.stats().windows,2);assert.equal(f.stats().rollbacks,1);});
test('원 snapshot/chain/head를 정합 재해시한 잘못된 서명도 crypto 단계에서 거절한다',async()=>{const f=await ownershipCurrentFixture();f.mode('SIGNATURE');await assert.rejects(f.read(),{message:'OWNERSHIP_CURRENT_UNAVAILABLE'});assert(f.queries.some(q=>q.includes('FROM anvil.execution_ownership_observations')));});
test('COMMIT 응답 손실·release 실패는 UNKNOWN, rollback 실패는 연결폐기다',async()=>{for(const mode of ['COMMIT_LOST','RELEASE_LOST','ROLLBACK_LOST']){const f=await ownershipCurrentFixture();f.mode(mode);await assert.rejects(f.read(),{message:mode==='ROLLBACK_LOST'?'OWNERSHIP_CURRENT_ROLLBACK_UNCONFIRMED':'OWNERSHIP_CURRENT_COMMIT_UNKNOWN'});if(mode!=='RELEASE_LOST')assert.equal(f.stats().destroyed,1);}});
test('무응답 관측은 유한 기한/외부 취소로 종료하고 늦은 DB 호출을 차단한다',async()=>{
 for(const abort of [false,true]){const f=await ownershipCurrentFixture();f.mode('NEVER');const c=new AbortController(),work=f.read(false,{timeoutMs:abort?10000:5,signal:c.signal}).then(()=> 'UNEXPECTED_SUCCESS',e=>e.message);await f.waiting;if(abort)c.abort();let timer:ReturnType<typeof setTimeout>|undefined;const result=await Promise.race([work,new Promise(r=>{timer=setTimeout(()=>r('DID_NOT_SETTLE'),100);})]);if(timer)clearTimeout(timer);assert.equal(result,'OWNERSHIP_CURRENT_UNAVAILABLE');assert.equal(f.stats().destroyed,1);const n=f.queries.length;await assert.rejects(f.lateQuery(),{message:'OWNERSHIP_CURRENT_UNAVAILABLE'});assert.equal(f.queries.length,n,'늦은 callback이 반환한 연결을 다시 사용하지 않는다');}
});
test('BASIS_ONLY 전체를 기존 응답 archive로 넘겨도 현재 권위로 자동 채택하지 않는다',async()=>{
 const f=await ownershipCurrentFixture(),basis=await f.read(),s=await sentProcessEvidenceFixture(),signal=new AbortController().signal;
 const server=await s.responseSource.currentSentResponse(s.selection.envelope,s.selection.parentThreadClaimRef,signal);let observed=0;
 const consumer=new SyntheticSentProcessEvidence(s.responseSource,{transport:'SYNTHETIC_ONLY',async readCurrent(){return basis;}},{transport:'SYNTHETIC_ONLY',async observe(){observed++;throw Error('must not reach observer');}},{clock:()=>Date.parse(server.basis.fact.checkedAt),timeoutMs:100});
 await assert.rejects(consumer.read(s.selection,signal),{message:'SENT_PROCESS_EVIDENCE_UNAVAILABLE'});assert.equal(observed,0);assert.equal(basis.currentAuthorityVerified,false);
});
test('관측 callback이 미완료 query를 남기고 reject하면 rollback 뒤에서 대기하지 않는다',async()=>{
 const f=await ownershipCurrentFixture();f.mode('PENDING_REJECT');let timer:ReturnType<typeof setTimeout>|undefined;
 const result=await Promise.race([f.read().then(()=> 'UNEXPECTED_SUCCESS',e=>e.message),new Promise(r=>{timer=setTimeout(()=>r('DID_NOT_SETTLE'),100);})]);if(timer)clearTimeout(timer);assert.equal(result,'OWNERSHIP_CURRENT_UNAVAILABLE');assert.equal(f.stats().rollbacks,0);assert.equal(f.stats().destroyed,1);
});
