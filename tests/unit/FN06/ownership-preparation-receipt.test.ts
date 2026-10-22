import assert from 'node:assert/strict';
import {test} from 'node:test';
import {canonicalJson} from '../../../contracts/canonical.ts';
import {ownershipPreparationReceiptFixture} from './ownership-preparation-receipt-fixture.ts';
const id=(n:number)=>`40000000-0000-4000-8000-${String(n).padStart(12,'0')}`;

test('원 준비 DB fullref·비순환 intent·명령/허가/감사 원기록을 대조하되 발급 권한을 만들지 않는다',async()=>{
 const f=await ownershipPreparationReceiptFixture(),v=await f.read();assert.equal(v.purpose,'OWNERSHIP_PREPARATION_RECEIPT_BASIS_ONLY');assert.equal(v.approvalState,'NOT_REQUIRED');assert.deepEqual(v.intentRef,f.intentRef);assert.deepEqual(v.preparationRef,f.prep.ref);assert.equal(v.preparationAuthorized,false);assert.equal(v.observationRequestAuthorized,false);assert.equal(v.executionAuthorized,false);assert.equal(v.dispatchPerformed,false);assert.deepEqual(v.missingEvidence,['VERIFIED_WRITER_NONE_OR_RECLAIM','CANDIDATE_PROVENANCE']);
 assert(!canonicalJson(f.intent).includes(f.prep.ref.contentHash));assert(f.queries.every(sql=>! /^(BEGIN|COMMIT|ROLLBACK|INSERT|UPDATE|DELETE|SELECT set_config)/.test(sql)));
});

test('원 명령/receipt/감사·원 subject/정책/target/hash의 개별 불일치를 거절한다',async()=>{
 const changes=[(f:any)=>f.command.state='FAILED',(f:any)=>f.command.actor_id=id(99),(f:any)=>f.command.client_id=id(99),(f:any)=>f.command.receipt_scope_id=id(99),(f:any)=>f.command.receipt_scope_digest='f'.repeat(64),(f:any)=>f.command.receipt_command_id=id(99),(f:any)=>f.command.result_ref.data.intent.details.workerHash='a'.repeat(64),(f:any)=>f.command.result_ref.targetId=id(99),(f:any)=>f.audit.outcome='DENIED',(f:any)=>f.audit.target_ref={...f.intentRef,id:id(99)},(f:any)=>f.audit.scope_digest='a'.repeat(64),(f:any)=>f.audit.recorded_at=new Date('2026-10-24T00:00:00Z'),(f:any)=>f.command.receipt_authorized_at=new Date('2026-10-24T00:00:00Z')];
 for(const change of changes){const f=await ownershipPreparationReceiptFixture();change(f);await assert.rejects(f.read(),{message:'OWNERSHIP_PREPARATION_RECEIPT_UNAVAILABLE'});}
});

test('정합 재해시해도 다른 범위/원 command·허가 대상으로 결박하지 못한다',async()=>{
 const f=await ownershipPreparationReceiptFixture();f.command.request_hash='a'.repeat(64);f.seal();await assert.rejects(f.read(),{message:'OWNERSHIP_PREPARATION_RECEIPT_UNAVAILABLE'});
 const g=await ownershipPreparationReceiptFixture();g.audit.target_ref={...g.intentRef,id:id(99)};g.seal();await assert.rejects(g.read(),{message:'OWNERSHIP_PREPARATION_RECEIPT_UNAVAILABLE'});
});

test('REQUIRE_APPROVAL 미연결·AUTO의 불필요 승인 주입·누락/읽기 오류는 기본 UNAVAILABLE다',async()=>{
 const required=await ownershipPreparationReceiptFixture();required.rules[0]!.disposition='REQUIRE_APPROVAL';required.updatePolicy();required.registration.scope_json.policyRef=required.prep.snapshot.payload.policyRef;required.registration.policy_ref=required.prep.snapshot.payload.policyRef;required.updateRegistration();required.seal();await assert.rejects(required.read(),{message:'OWNERSHIP_PREPARATION_RECEIPT_UNAVAILABLE'});
 assert.equal(required.queries.filter(sql=>sql.includes('FROM anvil.commands c JOIN anvil.authorization_receipts')).length,0,'미연결 승인은 다른 원기록 불일치에 가려지기 전에 거절해야 한다');
 const extra=await ownershipPreparationReceiptFixture();extra.command.approval_consumption_id=id(99);await assert.rejects(extra.read(),{message:'OWNERSHIP_PREPARATION_RECEIPT_UNAVAILABLE'});
 for(const mode of ['READ','MISSING']){const f=await ownershipPreparationReceiptFixture();f.mode(mode);await assert.rejects(f.read(),{message:'OWNERSHIP_PREPARATION_RECEIPT_UNAVAILABLE'});}
});

test('원 이력 검사 뒤에도 현재 세션/정책·기한을 재검사한다',async()=>{
 for(const mode of ['FINAL_SESSION','FINAL_POLICY','FINAL_CLOCK']){const f=await ownershipPreparationReceiptFixture();f.mode(mode);await assert.rejects(f.read(),{message:'OWNERSHIP_PREPARATION_RECEIPT_UNAVAILABLE'});}
});

test('읽기 전용 receipt/audit의 UPDATE 권한 없이 원 근거를 대조한다',async()=>{
 const f=await ownershipPreparationReceiptFixture();f.mode('MINIMAL_APP_ROLE');const v=await f.read();assert.equal(v.approvalState,'NOT_REQUIRED');assert.equal(v.executionAuthorized,false);
});
