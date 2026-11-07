import assert from 'node:assert/strict';
import {test} from 'node:test';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {providerTurnFixture} from './provider-turn-fixture.ts';
const hash=(v:unknown)=>contentHash(canonicalJson(v));
async function run(x:Awaited<ReturnType<typeof providerTurnFixture>>,claim=x.claim){const p=await x.f.issue(claim);return x.service.ingest(x.f.scope,p.issued.ref,p.proof,p.signature,p.raw);}
test('TURN은 기존 SEND/소비 permit/시도와 같은 THREAD 부모를 대조해 원자 수신하며 원 예약·부모를 보존한다',async()=>{
 const x=await providerTurnFixture(),parent=canonicalJson(x.f.state().entries[0]),r=await run(x);assert.equal(r.receipt.claimRef.contentHash,hash(x.claim));assert.equal(r.executionAuthorized,false);assert.equal(x.f.state().entries.length,2);assert.equal(x.f.state().audits.length,2);assert.equal(canonicalJson(x.f.state().entries[0]),parent);
 const again=await run(x);assert.deepEqual(again.receipt,r.receipt);assert.equal(x.f.state().entries.length,2);
});
test('TURN의 부모 부재·타등록/세대·예약/hash는 거절하며 기존 THREAD·nonce 원장을 보존한다',async()=>{
 for(const fault of ['missing','registration','generation','hash']){const x=await providerTurnFixture();if(fault==='missing')x.f.state().entries=[];if(fault==='registration')x.f.state().entries[0].claim.executorRegistrationRef={...x.parent.executorRegistrationRef,version:2};if(fault==='generation')x.claim.execution.generation=2;if(fault==='hash')x.claim.parentThreadClaimRef!.contentHash='e'.repeat(64);const p=await x.f.issue(x.claim),before=canonicalJson(x.f.state());await assert.rejects(x.service.ingest(x.f.scope,p.issued.ref,p.proof,p.signature,p.raw));assert.equal(canonicalJson(x.f.state()),before);}
});
test('START permit/잘못된 SEND·시도·예약·권한/기한을 TURN으로 재사용하지 않는다',async()=>{
 for(const change of [(x:any)=>x.f.basis.permit.snapshot.state='SYNTHETIC_CONSUMED_NO_AUTHORITY',(x:any)=>x.f.basis.permit.snapshot.request.localAttemptRef.version=2,(x:any)=>x.f.basis.instructionReservation.snapshot.state='SETTLED',(x:any)=>x.f.basis.fact.writerState='UNKNOWN',(x:any)=>x.f.advance(26000),(x:any)=>x.claim.source.method='turn/steer']){const x=await providerTurnFixture();change(x);const p=await x.f.issue(x.claim),before=canonicalJson(x.f.state());await assert.rejects(x.service.ingest(x.f.scope,p.issued.ref,p.proof,p.signature,p.raw));assert.equal(canonicalJson(x.f.state()),before);}
});
test('TURN 원 SEND의 소비 proof/nonce 부재·다른 target·불일치 증거는 거절한다',async()=>{
 for(const fault of ['missing','proof','target']){const x=await providerTurnFixture(),proofRef=x.permit.snapshot.proofRef;if(fault==='missing'){const head=x.f.state().challenges.find((e:any)=>e.snapshot.consumption?.resultRef.id===proofRef.id);x.f.state().challenges=x.f.state().challenges.filter((e:any)=>e.ref.id!==head.ref.id);}if(fault==='proof'){x.permit.snapshot.proofRef={...proofRef,id:x.claim.claimId};x.rehash();x.claim.permitRef=structuredClone(x.permit.ref);}const p=await x.f.issue(x.claim);if(fault==='target'){const e=x.f.state().challenges.find((e:any)=>e.snapshot.consumption?.resultRef.id===proofRef.id);e.snapshot.request.target.bodyHash='e'.repeat(64);}const before=canonicalJson(x.f.state());await assert.rejects(x.service.ingest(x.f.scope,p.issued.ref,p.proof,p.signature,p.raw));assert.equal(canonicalJson(x.f.state()),before);}
});
test('TURN 같은 사건 다른 본문은409이며 감사/nonce/COMMIT 실패는 부모와 원 소비증거를 보존한다',async()=>{
 const x=await providerTurnFixture(),saved=await run(x),different={...x.claim,protectedHandleRef:{...x.claim.protectedHandleRef,contentHash:'e'.repeat(64)}},p=await x.f.issue(different);await assert.rejects(x.service.ingest(x.f.scope,p.issued.ref,p.proof,p.signature,p.raw),(e:any)=>e.statusCode===409);assert.deepEqual(x.f.state().entries[1].receipt,saved.receipt);
 for(const fault of ['audit','nonce','commit','current']){const y=await providerTurnFixture(),q=await y.f.issue(y.claim),before=canonicalJson(y.f.state());y.f.fault(fault);await assert.rejects(y.service.ingest(y.f.scope,q.issued.ref,q.proof,q.signature,q.raw));assert.equal(canonicalJson(y.f.state()),before);}
});
