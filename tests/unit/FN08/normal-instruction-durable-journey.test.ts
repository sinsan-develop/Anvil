import test from 'node:test';
import assert from 'node:assert/strict';
import {normalInstructionRuntimeFixture} from './normal-instruction-dispatch-fixture.ts';
import {root,memoryFiles} from './normal-start-local-fixture.ts';
const {NormalStartFileStore}=await import('../../../apps/connector/runtime/normal-start-file-store.ts');

test('원 START SEND 보호 GET에서 내구 RECEIVED와 명령별 permit 한 건까지 연결한다',async()=>{
 const f=await normalInstructionRuntimeFixture({text:'원 지시🙂'.repeat(12000),mediaType:'text/plain;charset=utf-8'});
 try{
  const {NormalInstructionIntake,receiveNormalInstruction}=await import('../../../apps/connector/runtime/normal-instruction-intake.ts');
  const {NormalInstructionCoordinator}=await import('../../../apps/connector/runtime/normal-instruction-coordinator.ts');
  const page=await f.get.send(await f.get.prepareCommandPage({afterSequence:0,waitMs:0},f.signal),f.signal),start=page.items[0]!,item=page.items[1]!;
  assert.notDeepEqual(item.envelope.context.budgetRef,start.envelope.context.budgetRef);assert.notDeepEqual(item.envelope.context.authorizationReceiptRef,start.envelope.context.authorizationReceiptRef);
  const fs=memoryFiles(),store=new NormalStartFileStore(root,{projectId:f.scope.projectId,executionId:f.scope.executionId,executionGeneration:f.scope.executionGeneration},fs.fs),expected={context:start.envelope.context,executorRegistrationRef:start.envelope.executorRegistrationRef};
  const intake=new NormalInstructionIntake(store.instructionIntake(),expected,f.clock);
  const received=await receiveNormalInstruction(f.get,intake,item,page.proofResultRef,f.signal);assert.equal(received.state,'RECEIVED');
  const input=await intake.instruction(item.envelope);assert.equal(input.text,'원 지시🙂'.repeat(12000));
  const make=()=>new NormalInstructionCoordinator({intake,store:store.instructionAttempts(),post:f.post,current:f.current,grantRef:f.scope.grantRef,clock:f.clock,timeoutMs:10000});
  const result=await make().prepare(item.envelope,f.signal);assert.equal(result.state,'PERMIT_RECORDED');assert.equal(result.executionAuthorized,false);assert.equal(result.dispatchPerformed,false);assert.equal(f.h.permits.length,1);
  const rows:any[]=await store.exclusive('attempt-'+item.envelope.commandId,tx=>tx.read());assert.deepEqual(rows.map(r=>r.snapshot.state),['SEND_ATTEMPTED','PERMIT_RECORDED']);
  assert.deepEqual(f.h.permits[0].snapshot_json.request.localAttemptRef,rows[0].ref);assert.deepEqual(rows[1].snapshot.receivedRef,received.receivedRef);
  const before=f.calls.length;assert.deepEqual(await make().prepare(item.envelope,f.signal),result);assert.equal(f.calls.length,before);assert.equal(f.h.permits.length,1);
 }finally{await f.h.close();}
});
