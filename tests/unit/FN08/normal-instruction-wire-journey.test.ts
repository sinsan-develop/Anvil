import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {normalInstructionDurableFixture} from './normal-instruction-dispatch-fixture.ts';

test('원 서버 SEND 수신/permit 뒤 명시 driver는 내구 dispatch 선기록과 원 지시를 한 번 소비한다',async()=>{
 const f=await normalInstructionDurableFixture();try{
  const {NormalInstructionWire}=await import('../../../apps/connector/adapters/secondary/normal-instruction-wire.ts');
  await f.receive();const coordinator=f.make(),prepared=await coordinator.prepare(f.item.envelope,f.signal),original=await f.intake.instruction(f.item.envelope);
  const responseRef={id:randomUUID(),version:1,contentHash:'a'.repeat(64)};let calls=0;
  const wire=new NormalInstructionWire({driver:{async send(input:any,signal:AbortSignal){calls++;assert.equal(signal.aborted,false);
   const rows=[...f.fs.files.entries()].filter(([p])=>p.includes('attempt-'+f.item.envelope.commandId)&&p.endsWith('.json')).sort(([a],[b])=>a.localeCompare(b)).map(([,v])=>JSON.parse(v.bytes.toString()));
   assert.deepEqual(rows.map(r=>r.snapshot.state),['SEND_ATTEMPTED','PERMIT_RECORDED','SEND_DISPATCH_ATTEMPTED']);
   assert.deepEqual(input.localAttemptRef,rows[0].ref);assert.deepEqual(input.dispatchAttemptRef,rows[2].ref);assert.deepEqual(input.permit,prepared.permit);assert.deepEqual(input.proofResultRef,prepared.proofResultRef);
   assert.deepEqual(input.envelope,f.item.envelope);assert.deepEqual(Buffer.from(input.instruction.bytes),Buffer.from(original.bytes));assert.equal(input.instruction.text,original.text);
   assert.equal(input.executionAuthorized,false);assert.equal(input.actualExecutionVerified,false);
   return{transport:'NORMAL_PROTECTED',responseRef,processRef:null};}}});
  const result=await coordinator.dispatch(f.item.envelope,prepared,wire,f.signal);assert.equal(result.state,'RESPONSE_RECORDED');assert.deepEqual(result.responseRef,responseRef);assert.equal(result.processRef,null);assert.equal(result.actualExecutionVerified,false);assert.equal(result.dispatchPerformed,false);assert.equal(calls,1);
  const before=f.calls.length;await assert.rejects(coordinator.dispatch(f.item.envelope,prepared,wire,f.signal),/ELIGIBLE/);
  const restarted=f.make(),history=await restarted.prepare(f.item.envelope,f.signal);assert.deepEqual(history,prepared);
  await assert.rejects(restarted.dispatch(f.item.envelope,history,wire,f.signal),/ELIGIBLE/);assert.equal(calls,1);assert.equal(f.calls.length,before);assert.equal(f.h.permits.length,1);
 }finally{await f.h.close();}
});
