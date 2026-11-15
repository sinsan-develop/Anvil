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

test('첫 SEND 4행 뒤 strict close 불명은 정착한 init만 보존한다',async()=>{
 const {firstSendFixture}=await import('../FN07/normal-first-send-owner.test.ts');const f=await firstSendFixture();
 try{
  let uncertain=false;const open=f.fs.fs.open.bind(f.fs.fs);
  f.fs.fs.open=async(path:string,flags:any)=>{const file=await open(path,flags);
   if(flags==='wx'&&path.endsWith('attempt-'+f.item.envelope.commandId+'.lock')){
    const close=file.close.bind(file);file.close=async()=>{await close();if(!uncertain&&f.effects.rows.some(v=>v.snapshot.state==='SESSION_INIT_CONFIRMED')){
     uncertain=true;throw Error('RAM_DISPATCH_CLOSE_UNKNOWN');}};
   }return file;
  };
  const out=await f.run();assert.equal(uncertain,true);assert.equal(out.state,'UNKNOWN');assert.equal(out.cursor.afterSequence,0);
  assert.equal(f.effects.rows.at(-1)?.snapshot.state,'SESSION_INIT_CONFIRMED');assert.equal(f.effects.close,1);
  assert([...f.fs.files.keys()].some(p=>p.endsWith('attempt-'+f.item.envelope.commandId+'.lock')));
  assert.equal((await f.run()).state,'UNKNOWN');assert.equal(f.effects.create,1);
 }finally{await f.h.close();}
});

test('같은 READY에 경쟁하는 두 SEND의 단발 permit은 Query 하나만 생성한다',async()=>{
 const {firstSendFixture}=await import('../FN07/normal-first-send-owner.test.ts'),f=await firstSendFixture();
 try{
  const q=f.h.q,request=q.request;request.commandId=randomUUID();
  const response=await f.h.app.inject({method:'POST',url:'/api/v1/projects/'+f.h.f.pid+'/commands',
   headers:{host:'anvil-synthetic.invalid',origin:'https://anvil-synthetic.invalid',cookie:'__Host-anvil.sid='+f.h.f.token,'x-anvil-csrf':f.h.f.csrf},payload:request});
  assert.equal(response.statusCode,200,response.body);
  const page=await f.get.send(await f.get.prepareCommandPage({afterSequence:0,waitMs:0},f.signal),f.signal);
  const item=page.items.find(v=>v.envelope.commandId===request.commandId);assert.ok(item?.materials&&item.envelope.operation==='SEND_INSTRUCTION');
  const {receiveNormalInstruction}=await import('../../../apps/connector/runtime/normal-instruction-intake.ts');
  await receiveNormalInstruction(f.get,f.intake,item,page.proofResultRef,f.signal);const competing=f.make(),permit=await competing.prepare(item.envelope,f.signal);
  const {NormalInstructionWire}=await import('../../../apps/connector/adapters/secondary/normal-instruction-wire.ts');
  const wire=NormalInstructionWire.forFirstSend(f.worker,f.source);let other='';
  f.hooks.inCreate=async()=>{other=(await competing.dispatch(item.envelope,permit,wire,f.signal)).state;};
  const outcome=await f.run();
  assert.equal(other,'UNKNOWN');assert.equal(f.h.permits.length,2);assert.equal(f.effects.create,1);assert.equal(f.effects.iterate,1);
  assert.equal((await f.make().history(f.item,f.signal)).state,'FIRST_SEND_INPUT_AND_INIT_RECORDED');
  assert.equal(outcome.state,'UNKNOWN');assert.equal(outcome.cursor.afterSequence,0);
 }finally{f.authority.abort();await f.h.close();}
});

test('마지막 SEND close 대기 중 원 호출 취소는 보유 Query를 닫고 cursor를 보존한다',async()=>{
 const {firstSendFixture}=await import('../FN07/normal-first-send-owner.test.ts'),f=await firstSendFixture();
 const entered=Promise.withResolvers<void>(),release=Promise.withResolvers<void>();const abort=new AbortController();
 try{
  const open=f.fs.fs.open.bind(f.fs.fs);f.fs.fs.open=async(path:string,flags:any)=>{
   const file=await open(path,flags);if(flags==='wx'&&path.endsWith('attempt-'+f.item.envelope.commandId+'.lock')){
    const close=file.close.bind(file);file.close=async()=>{if(f.effects.rows.at(-1)?.snapshot.state==='SESSION_INIT_CONFIRMED'){entered.resolve();await release.promise;}await close();};
   }return file;
  };
  const {NormalStartPolling}=await import('../../../apps/connector/runtime/normal-start-polling.ts');
  const pending=new NormalStartPolling(f.options()).run(abort.signal);await entered.promise;
  abort.abort();await new Promise(resolve=>setImmediate(resolve));
  const closed=f.effects.close;release.resolve();const result=await pending;
  assert.equal(closed,1);assert.equal(result.state,'UNKNOWN');assert.equal(result.cursor.afterSequence,0);assert.equal(f.effects.create,1);
 }finally{release.resolve();f.authority.abort();await f.h.close();}
});
