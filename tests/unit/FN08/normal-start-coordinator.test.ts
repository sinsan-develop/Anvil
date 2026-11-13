import test from 'node:test';
import assert from 'node:assert/strict';
import {preparedExecution} from './normal-start-execution-fixture.ts';
test('permit 응답 유실 UNKNOWN 뒤 새 coordinator는 wire/permit을 반복하지 않는다',async()=>{
 const f=await preparedExecution();try{
  f.http.mode.lose=true;const out=await f.make().coordinator.start(f.e,f.signal);assert.equal(out.state,'UNKNOWN');assert.equal(f.mode.wires,0);assert.equal(f.q.permits.length,1);
  f.http.mode.lose=false;const count=f.http.calls.length;assert.equal((await f.make().coordinator.start(f.e,f.signal)).state,'UNKNOWN');assert.equal(f.http.calls.length,count);assert.equal(f.mode.wires,0);
 }finally{await f.h.app.close();}
});
test('현재성 철회·최종 기한 경과 뒤 wire0, 중복 실행0',async()=>{
 for(const kind of ['revoke','expiry']){
  const f=await preparedExecution();try{
   f.mode.currentHook=async()=>{if(f.mode.currents===2){if(kind==='revoke')throw Error('철회');f.h.store.mode.offset+=30001;}};
   assert.equal((await f.make().coordinator.start(f.e,f.signal)).state,'UNKNOWN');assert.equal(f.mode.wires,0);
   assert.equal((await f.make().coordinator.start(f.e,f.signal)).state,'UNKNOWN');assert.equal(f.mode.wires,0);
  }finally{await f.h.app.close();}
 }
});
test('wire timeout과 늦은 응답 뒤 재시작도 wire1만 유지한다',async()=>{
 const f=await preparedExecution();try{
  f.mode.timeoutMs=25;let late:()=>void=()=>{};f.mode.wireHook=()=>new Promise<void>(ok=>late=ok);
  assert.equal((await f.make().coordinator.start(f.e,f.signal)).state,'UNKNOWN');assert.equal(f.mode.wires,1);late();await new Promise(ok=>setImmediate(ok));
  assert.equal((await f.make().coordinator.start(f.e,f.signal)).state,'UNKNOWN');assert.equal(f.mode.wires,1);
 }finally{await f.h.app.close();}
});
test('같은 실행 병렬 START는 busy이며 앞선 진행을 깨지 않는다',async()=>{
 const f=await preparedExecution();try{
  let go:()=>void=()=>{},reached:()=>void=()=>{};const ready=new Promise<void>(ok=>reached=ok);
  f.mode.wireHook=async()=>{reached();await new Promise<void>(ok=>go=ok);};
  const first=f.make().coordinator.start(f.e,f.signal);await ready;
  await assert.rejects(f.make().coordinator.start(f.e,f.signal),/BUSY/);go();
  assert.equal((await first).state,'RESPONSE_RECORDED');assert.equal(f.mode.wires,1);
 }finally{await f.h.app.close();}
});
test('permit 뒤 intake bytes 변조/누락은 재검산에서 wire0으로 닫는다',async()=>{
 for(const kind of ['corrupt','missing']){
  const f=await preparedExecution();try{
   f.mode.currentHook=async()=>{if(f.mode.currents===2){const key=[...f.fs.files.keys()].find(k=>k.includes('intake-')&&k.endsWith('000001.json'))!;
    if(kind==='missing')f.fs.files.delete(key);else{const file=f.fs.files.get(key)!;file.bytes=Buffer.from(file.bytes.toString().replace(/"bytes":"[^"]+"/,'"bytes":"eA"'));}}};
   assert.equal((await f.make().coordinator.start(f.e,f.signal)).state,'UNKNOWN');assert.equal(f.mode.wires,0);
  }finally{await f.h.app.close();}
 }
});
test('RESPONSE 기록 뒤 관측 일시 실패는 재시작 때 같은 ref/시각으로 보충하고 wire1을 유지한다',async()=>{
 const f=await preparedExecution();try{
  const first=f.make(),original=first.spool.record.bind(first.spool);let once=true;
  first.spool.record=async e=>{if(e.type==='PROVIDER_RESPONSE_RECEIVED'&&once){once=false;throw Error('합성 관측 저장 거절');}return original(e);};
  assert.equal((await first.coordinator.start(f.e,f.signal)).state,'UNKNOWN');assert.equal(f.mode.wires,1);
  const next=f.make();assert.equal((await next.coordinator.start(f.e,f.signal)).state,'RESPONSE_RECORDED');assert.equal(f.mode.wires,1);
  assert.deepEqual((await next.spool.batch()).events.map(e=>e.type),['RECEIVED','PREPARED','START_ATTEMPTED','PERMIT_RECORDED','PROVIDER_RESPONSE_RECEIVED']);
  const ack=await next.spool.sync(f.post,f.signal);assert.equal(ack.snapshot.highestContiguous,5);
 }finally{await f.h.app.close();}
});
test('attempt 기록 뒤 관측 실패는 재시작 복구하되 wire 재개 없이 UNKNOWN이다',async()=>{
 const f=await preparedExecution();try{
  const first=f.make();first.spool.record=async()=>{throw Error('관측 거절');};
  assert.equal((await first.coordinator.start(f.e,f.signal)).state,'UNKNOWN');assert.equal(f.mode.wires,0);
  const next=f.make();assert.equal((await next.coordinator.start(f.e,f.signal)).state,'UNKNOWN');assert.equal(f.mode.wires,0);
  assert.deepEqual((await next.spool.batch()).events.map(e=>e.type),['RECEIVED','PREPARED','START_ATTEMPTED','UNKNOWN']);
 }finally{await f.h.app.close();}
});
test('attempt sync 뒤 같은 길이 변조는 재조회에서 wire0이며 lock을 보존한다',async()=>{
 const f=await preparedExecution();try{
  const open=f.fs.fs.open;
  f.fs.fs.open=async(path:string,...rest:any[])=>{const handle=await open(path,...rest),sync=handle.sync;
   handle.sync=async()=>{await sync();if(path.includes('attempt-')&&path.endsWith('000001.json')){
    const row=f.fs.files.get(path)!;const parsed=JSON.parse(row.bytes.toString());parsed.snapshot.envelopeHash='f'.repeat(64);row.bytes=Buffer.from(JSON.stringify(parsed));
    // canonical key order를 유지하고 LF 하나를 보존한다.
    const {canonicalJson}=await import('../../../contracts/canonical.ts');row.bytes=Buffer.from(canonicalJson(parsed)+'\n');
   }};return handle;};
  await assert.rejects(f.make().coordinator.start(f.e,f.signal),/RECORD_UNCERTAIN/);assert.equal(f.mode.wires,0);
  assert([...f.fs.files.keys()].some(p=>p.includes('attempt-')&&p.endsWith('.lock')));
  await assert.rejects(f.make().coordinator.start(f.e,f.signal),/BUSY/);assert.equal(f.mode.wires,0);
 }finally{await f.h.app.close();}
});
test('관측 실제 sync 불명은 재시작에도 UNKNOWN·wire1이며 lock을 임의 복구하지 않는다',async()=>{
 const f=await preparedExecution();try{
  const open=f.fs.fs.open;
  f.fs.fs.open=async(path:string,...rest:any[])=>{const handle=await open(path,...rest),sync=handle.sync;
   handle.sync=async()=>{await sync();if(path.endsWith('observations.000005.json'))throw Error('합성 sync 불명');};return handle;};
  assert.equal((await f.make().coordinator.start(f.e,f.signal)).state,'UNKNOWN');assert.equal(f.mode.wires,1);
  assert.equal((await f.make().coordinator.start(f.e,f.signal)).state,'UNKNOWN');assert.equal(f.mode.wires,1);
  assert([...f.fs.files.keys()].some(p=>p.endsWith('observations.lock')));
 }finally{await f.h.app.close();}
});
test('현재성 공급자의 stall/늦은 결과는 유한 UNKNOWN이며 permit/wire를 나중에 실행하지 않는다',async()=>{
 const f=await preparedExecution();try{
  let finish=()=>{};f.mode.timeoutMs=20;f.mode.currentHook=()=>new Promise<void>(ok=>finish=ok);
  const calls=f.http.calls.length;
  assert.equal((await f.make().coordinator.start(f.e,f.signal)).state,'UNKNOWN');assert.equal(f.mode.wires,0);
  finish();await new Promise(ok=>setImmediate(ok));assert.equal(f.http.calls.length,calls);
  assert.equal((await f.make().coordinator.start(f.e,f.signal)).state,'UNKNOWN');assert.equal(f.mode.wires,0);
 }finally{await f.h.app.close();}
});
