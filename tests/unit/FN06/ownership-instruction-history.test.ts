import test from 'node:test';
import assert from 'node:assert/strict';
import {ownershipInstructionHistoryFixture as fixture} from './ownership-instruction-history-fixture.ts';

test('현재 AUTO 준비 아래 원 pair만 읽고 실제 SEND·proof·OS 권위는 미확인으로 남긴다',async()=>{
 const f=await fixture(),r=await f.read();assert.equal(r.purpose,'OWNERSHIP_INSTRUCTION_HISTORY_ONLY');assert.deepEqual(r.commandRef,f.record.ref);assert.deepEqual(r.permitRef,f.permit.ref);
 assert.equal(r.executionAuthorized,false);assert.equal(r.dispatchPerformed,false);assert.equal(r.bindingAuthorized,false);assert.equal(r.proofConsumptionVerified,false);assert.equal(r.writerState,'UNKNOWN');
 assert(r.missingEvidence.includes('PROOF_SIGNATURE_VERIFICATION'));assert(r.missingEvidence.includes('CURRENT_SEND_AUTHORITY'));assert(r.missingEvidence.includes('ACTUAL_LOCAL_ATTEMPT_PARENT_OS'));
 assert(f.queries.every(q=>q.startsWith('SELECT ')));
});
test('선택 echo나 원 row/ref/hash/세대 불일치로 pair를 만들지 않는다',async()=>{
 for(const change of [(f:any)=>f.selection.localAttemptRef.contentHash='0'.repeat(64),(f:any)=>f.selection.osOwnershipRef.id=f.scope.projectId,(f:any)=>f.selection.commandRef.contentHash='0'.repeat(64),(f:any)=>f.selection.envelopeHash='0'.repeat(64),(f:any)=>f.permitRow.proof_result_id=f.scope.projectId,(f:any)=>f.row.generation=2,(f:any)=>f.row.authorization_ref={...f.row.authorization_ref,contentHash:'0'.repeat(64)},(f:any)=>f.row.snapshot_json.request.clientId=f.scope.projectId]){
  const f=await fixture();change(f);await assert.rejects(f.read(),/OWNERSHIP_INSTRUCTION_HISTORY_UNAVAILABLE/);
 }
 const f=await fixture();f.mode('MISSING');await assert.rejects(f.read(),/OWNERSHIP_INSTRUCTION_HISTORY_UNAVAILABLE/);
});
test('조회 도중 HUMAN 회수·기한 경과는 원 pair가 일치해도 거절한다',async()=>{
 for(const mode of ['REVOKE','EXPIRE']){const f=await fixture();f.mode(mode);await assert.rejects(f.read(),/OWNERSHIP_INSTRUCTION_HISTORY_UNAVAILABLE/);assert(f.queries.some(q=>q.includes('FROM anvil.execution_commands')));}
});
test('REQUIRE 준비를 AUTO로 우회하거나 읽기 전에 malformed scope를 쿼리하지 않는다',async()=>{
 const f=await fixture();f.selection.extra=true;await assert.rejects(f.read(),/OWNERSHIP_INSTRUCTION_HISTORY_UNAVAILABLE/);assert.equal(f.queries.length,0);
 const g=await fixture({disposition:'REQUIRE_APPROVAL'});await assert.rejects(g.read(),/OWNERSHIP_INSTRUCTION_HISTORY_UNAVAILABLE/);assert(!g.queries.some(q=>q.includes('FROM anvil.execution_instruction_permits')));
});
test('갱신 HUMAN 세대2와 실행 credential 세대1을 혼동하지 않는다',async()=>{
 const f=await fixture({humanCredentialGeneration:2}),r=await f.read();assert.equal(r.subject.credentialGeneration,2);assert.equal(f.permit.snapshot.scope.credentialGeneration,1);assert.equal(r.executionAuthorized,false);
});
test('현재 HUMAN 준비 재대조 전에 실제 원 proof 소비 이력도 읽으며 누락은 거절한다',async()=>{
 const f=await fixture(),r=await f.read();assert.equal(r.proofHistory?.purpose,'OWNERSHIP_INSTRUCTION_PROOF_HISTORY_ONLY');assert.deepEqual(r.proofHistory.proofRef,f.permit.snapshot.proofRef);assert.equal(r.proofHistory.signatureVerified,false);
 const g=await fixture();g.mode('NO_PROOF');await assert.rejects(g.read(),/OWNERSHIP_INSTRUCTION_HISTORY_UNAVAILABLE/);
});
test('원 SEND 허가/감사·예약/outbox graph를 기존 verifier로 읽고 거절 자료는 반환하지 않는다',async()=>{
 const f=await fixture(),r=await f.read();assert.equal(r.sendAuthorizationGraphRead,true);
 const g=await fixture();g.mode('NO_GRAPH');await assert.rejects(g.read(),/OWNERSHIP_INSTRUCTION_HISTORY_UNAVAILABLE/);assert(g.queries.some(q=>q.includes('JOIN anvil.audit_events')));
});
test('원 허가 주체·예약·outbox가 서로 달라도 저장 pair만으로 허용하지 않는다',async()=>{
 for(const change of [(f:any)=>f.row.authorization_subject.userId=f.scope.projectId,(f:any)=>f.row.budget_hash='0'.repeat(64),(f:any)=>f.row.payload_ref.commandRef={...f.record.ref,contentHash:'0'.repeat(64)},(f:any)=>f.row.outbox_state='PENDING']){const f=await fixture();change(f);await assert.rejects(f.read(),/OWNERSHIP_INSTRUCTION_HISTORY_UNAVAILABLE/);assert(f.queries.some(q=>q.includes('JOIN anvil.audit_events')));}
});
