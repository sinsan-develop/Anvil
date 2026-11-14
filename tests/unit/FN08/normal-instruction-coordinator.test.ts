import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {normalInstructionDurableFixture,normalInstructionWireFixture} from './normal-instruction-dispatch-fixture.ts';

for(const fault of ['LOST','PERMIT_HASH_BINDING','REVOKED','EXPIRED','ABORT','CURRENT_ENVELOPE_BINDING','CURRENT_OS','ATTEMPT_SYNC','PERMIT_SYNC'] as const)test('SEND attempt '+fault+'은 추가 허가/재시작 전송 없이 닫는다',async()=>{
 const f=await normalInstructionDurableFixture();try{
  await f.receive();const controller=new AbortController(),current=f.current.current,postBefore=f.calls.length;
  if(fault==='LOST')f.mode.losePermit=true;
  if(fault==='PERMIT_HASH_BINDING')f.mode.mutatePermit=v=>v.permit.envelopeHash='0'.repeat(64);
  if(fault==='REVOKED')f.h.q.j.store.mode.revoked=true;
  if(fault==='EXPIRED')f.mode.wall=60000;
  if(fault==='ABORT')controller.abort();
  if(fault==='CURRENT_ENVELOPE_BINDING'||fault==='CURRENT_OS')f.current.current=async(...args)=>{const v=await current(...args);if(fault==='CURRENT_ENVELOPE_BINDING')v.envelopeHash='0'.repeat(64);else v.osOwnershipRef={...v.osOwnershipRef,id:randomUUID()};return v;};
  if(fault==='ATTEMPT_SYNC')f.fs.mode.failSync=true;
  if(fault==='PERMIT_SYNC'){
   const open=f.fs.fs.open;f.fs.fs.open=async(path:string,flag:any)=>{const h=await open(path,flag);if(flag==='wx'&&path.endsWith('attempt-'+f.item.envelope.commandId+'.000002.json'))h.sync=async()=>{throw Error('RAM_SYNC_UNKNOWN');};return h;};
  }
  const c=f.make();
  if(['EXPIRED','ABORT','ATTEMPT_SYNC','PERMIT_SYNC'].includes(fault))await assert.rejects(c.prepare(f.item.envelope,controller.signal));
  else{const out:any=await c.prepare(f.item.envelope,controller.signal);assert.equal(out.state,'UNKNOWN');assert.equal(out.dispatchPerformed,false);}
  const calls=f.calls.length,permits=f.h.permits.length;
  if(['EXPIRED','ABORT'].includes(fault)){assert.equal(calls,postBefore);assert.equal(permits,0);assert(![...f.fs.files.keys()].some(p=>p.includes('attempt-')));}
  else{
   if(['ATTEMPT_SYNC','PERMIT_SYNC'].includes(fault)){assert(f.fs.files.has(f.fs.path('attempt-'+f.item.envelope.commandId+'.lock')));await assert.rejects(f.make().prepare(f.item.envelope,f.signal));}
   else{const replay:any=await f.make().prepare(f.item.envelope,f.signal);assert.equal(replay.state,'UNKNOWN');}
   assert.equal(f.calls.length,calls);assert.equal(f.h.permits.length,permits);
  }
 }finally{await f.h.close();}
});

test('SEND 현재 관측 대기 중 중복 호출은 BUSY이고 취소 뒤 늦은 관측으로 POST를 시작하지 않는다',async()=>{
 const f=await normalInstructionDurableFixture();try{
  await f.receive();let release!:(v:any)=>void,entered!:()=>void;const seen=new Promise<void>(r=>entered=r),original=f.current.current;
  f.current.current=async(...args)=>{const v=await original(...args);entered();return new Promise(r=>{release=()=>r(v);});};
  const c=f.make(),controller=new AbortController(),before=f.calls.length,pending=c.prepare(f.item.envelope,controller.signal);await seen;
  await assert.rejects(c.prepare(f.item.envelope,f.signal),/BUSY/);controller.abort();const out:any=await pending;assert.equal(out.state,'UNKNOWN');
  release(null);await new Promise<void>(r=>setImmediate(r));assert.equal(f.calls.length,before);assert.equal(f.h.permits.length,0);
  assert.equal((await f.make().prepare(f.item.envelope,f.signal) as any).state,'UNKNOWN');assert.equal(f.calls.length,before);
 }finally{await f.h.close();}
});

test('원문 마지막 재읽기 중 취소는 첫 SEND_ATTEMPTED 쓰기보다 먼저 거절한다',async()=>{
 const f=await normalInstructionDurableFixture();try{
  await f.receive();const open=f.fs.fs.open,c=new AbortController();let reads=0;
  f.fs.fs.open=async(path:string,flag:any)=>{const h=await open(path,flag);if(flag==='wx'&&path.endsWith('intake-'+f.item.envelope.commandId+'.lock')&&++reads===2)c.abort();return h;};
  const before=f.calls.length;await assert.rejects(f.make().prepare(f.item.envelope,c.signal));assert.equal(f.calls.length,before);
  assert(![...f.fs.files.keys()].some(p=>p.includes('attempt-')&&p.endsWith('.json')));assert.equal(f.h.permits.length,0);
 }finally{await f.h.close();}
});

test('원 SEND_ATTEMPTED만 남은 RAM 재시작과 만료된 PERMIT_RECORDED 조회는 새 허가를 만들지 않는다',async()=>{
 const f=await normalInstructionDurableFixture();try{
  await f.receive();const first:any=await f.make().prepare(f.item.envelope,f.signal);assert.equal(first.state,'PERMIT_RECORDED');const before=f.calls.length;
  f.mode.wall=60000;const historical:any=await f.make().prepare(f.item.envelope,f.signal);assert.deepEqual(historical,first);assert.equal(historical.executionAuthorized,false);
  // 완전한 첫 행만 있는 별도 재시작 상태를 RAM에서 구성한다. 실제 crash/전원손실 증거가 아니다.
  f.fs.files.delete(f.fs.path('attempt-'+f.item.envelope.commandId+'.000002.json'));
  const incomplete:any=await f.make().prepare(f.item.envelope,f.signal);assert.equal(incomplete.state,'UNKNOWN');assert.equal(f.calls.length,before);assert.equal(f.h.permits.length,1);
 }finally{await f.h.close();}
});

test('현재 관측 await 중 기한 경과는 원 attempt UNKNOWN으로 보존하고 POST를 시작하지 않는다',async()=>{
 const f=await normalInstructionDurableFixture();try{
  await f.receive();const original=f.current.current;f.current.current=async(...args)=>{const v=await original(...args);f.mode.wall=60000;return v;};
  const before=f.calls.length,result:any=await f.make().prepare(f.item.envelope,f.signal);assert.equal(result.state,'UNKNOWN');assert.equal(f.calls.length,before);assert.equal(f.h.permits.length,0);
 }finally{await f.h.close();}
});

for(const fault of ['DISPATCH_SYNC','DISPATCH_PARTIAL','DISPATCH_READBACK','RESPONSE_SYNC','DISPATCH_CLOSE'] as const)test('SEND '+fault+' 불명은 원 lock을 보존하고 새 owner에서 wire를 재개하지 않는다',async()=>{
 const f=await normalInstructionWireFixture();try{
  const open=f.fs.fs.open,command=f.item.envelope.commandId,lock=f.fs.path('attempt-'+command+'.lock');let closeCalls=0;
  f.fs.fs.open=async(path:string,flag:any)=>{const handle=await open(path,flag);
   if(flag==='wx'&&path.endsWith('attempt-'+command+'.000003.json')){
    if(fault==='DISPATCH_SYNC')handle.sync=async()=>{throw Error('RAM_DISPATCH_SYNC_UNKNOWN');};
    if(fault==='DISPATCH_PARTIAL'){const write=handle.writeFile;handle.writeFile=async(b:Buffer)=>write(b.subarray(0,3));}
    if(fault==='DISPATCH_READBACK'){const sync=handle.sync;handle.sync=async()=>{await sync();const file=f.fs.files.get(path)!;file.bytes=Buffer.from(file.bytes.toString().replace('SEND_DISPATCH_ATTEMPTED','SEND_DISPATCH_ATTE?PTED'));};}
   }
   if(flag==='wx'&&path.endsWith('attempt-'+command+'.000004.json')&&fault==='RESPONSE_SYNC')handle.sync=async()=>{throw Error('RAM_RESPONSE_SYNC_UNKNOWN');};
   if(flag==='wx'&&path===lock&&fault==='DISPATCH_CLOSE')handle.close=async()=>{closeCalls++;throw Error('RAM_CLOSE_UNKNOWN');};
   return handle;
  };
  await assert.rejects(f.c.dispatch(f.item.envelope,f.prepared,f.wire,f.signal));assert(f.fs.files.has(lock));assert.equal(f.driverCalls(),['RESPONSE_SYNC','DISPATCH_CLOSE'].includes(fault)?1:0);
  const before=f.calls.length;await assert.rejects(f.make().prepare(f.item.envelope,f.signal),/BUSY/);assert.equal(f.calls.length,before);
  if(fault==='DISPATCH_CLOSE'){assert.equal(closeCalls,1);assert.equal(f.rows().at(-1).snapshot.state,'RESPONSE_RECORDED');}
 }finally{await f.h.close();}
});

for(const target of ['attempt','permit','material'] as const)test('dispatch 원 '+target+' 내구 행 변조는 driver0',async()=>{
 const f=await normalInstructionWireFixture();try{
  const {canonicalJson,contentHash}=await import('../../../contracts/canonical.ts');
  const path=target==='material'?[...f.fs.files.keys()].find(p=>p.includes('intake-')&&p.endsWith('.000001.json'))!:f.fs.path('attempt-'+f.item.envelope.commandId+(target==='attempt'?'.000001.json':'.000002.json'));
  const file=f.fs.files.get(path)!,entry=JSON.parse(file.bytes.toString());
  if(target==='material')entry.bytes='WA';else {if(target==='permit')entry.snapshot.permit.ref.id=randomUUID();else entry.snapshot.sessionBindingRef.id=randomUUID();entry.ref.contentHash=contentHash(canonicalJson(entry.snapshot));}
  file.bytes=Buffer.from(canonicalJson(entry)+'\n');
  const result=await f.c.dispatch(f.item.envelope,f.prepared,f.wire,f.signal).catch(()=>null);if(result)assert.equal(result.state,'UNKNOWN');assert.equal(f.driverCalls(),0);
 }finally{await f.h.close();}
});

test('prepare strict-close 불명은 원 반환 객체 eligibility를 발급하지 않는다',async()=>{
 const f=await normalInstructionDurableFixture();try{
  await f.receive();const open=f.fs.fs.open,lock=f.fs.path('attempt-'+f.item.envelope.commandId+'.lock');let closes=0;
  f.fs.fs.open=async(path:string,flag:any)=>{const h=await open(path,flag);if(flag==='wx'&&path===lock)h.close=async()=>{closes++;throw Error('RAM_CLOSE_UNKNOWN');};return h;};
  const c=f.make();await assert.rejects(c.prepare(f.item.envelope,f.signal));assert.equal(closes,1);assert(f.fs.files.has(lock));
  await assert.rejects(c.dispatch(f.item.envelope,{} as any,{} as any,f.signal),/UNKNOWN/);await assert.rejects(f.make().prepare(f.item.envelope,f.signal),/BUSY/);
 }finally{await f.h.close();}
});

test('dispatch await 중 원 결과 변조는 이미 고정한 permit/proof 원본에 영향을 주지 않는다',async()=>{
 const f=await normalInstructionWireFixture();try{
  const original=structuredClone(f.prepared),open=f.fs.fs.open;let mutated=false;
  f.fs.fs.open=async(path:string,flag:any)=>{const h=await open(path,flag);if(!mutated&&flag==='wx'&&path.endsWith('attempt-'+f.item.envelope.commandId+'.lock')){mutated=true;f.prepared.permit!.ref.id=randomUUID();f.prepared.proofResultRef!.id=randomUUID();}return h;};
  const out=await f.c.dispatch(f.item.envelope,f.prepared,f.wire,f.signal);assert.equal(out.state,'RESPONSE_RECORDED');assert.equal(f.driverCalls(),1);assert.deepEqual(f.rows()[2].snapshot.permit,original.permit);assert.deepEqual(f.rows()[2].snapshot.proofResultRef,original.proofResultRef);
 }finally{await f.h.close();}
});

test('SEND_DISPATCH_ATTEMPTED 이후 재시작은 UNKNOWN을 내구 기록하고 새 결과 권위를 만들지 않는다',async()=>{
 const f=await normalInstructionWireFixture();try{
  await f.c.dispatch(f.item.envelope,f.prepared,f.wire,f.signal);assert.equal(f.driverCalls(),1);
  // 실제 OS crash가 아니라 원 3행만 보존한 RAM 재시작 상태다.
  f.fs.files.delete(f.fs.path('attempt-'+f.item.envelope.commandId+'.000004.json'));
  const c=f.make(),history=await c.prepare(f.item.envelope,f.signal);assert.equal(history.state,'UNKNOWN');assert.equal(f.rows().at(-1).snapshot.state,'UNKNOWN');
  await assert.rejects(c.dispatch(f.item.envelope,history,f.wire,f.signal),/ELIGIBLE/);assert.equal(f.driverCalls(),1);
 }finally{await f.h.close();}
});

for(const point of ['DISPATCH_SYNC','DISPATCH_CLOSE'] as const)test(point+' 동안 기한 경과는 성공 결과를 만들지 않는다',async()=>{
 const f=await normalInstructionWireFixture();try{
  const open=f.fs.fs.open,command=f.item.envelope.commandId;
  f.fs.fs.open=async(path:string,flag:any)=>{const h=await open(path,flag);
   if(flag==='wx'&&point==='DISPATCH_SYNC'&&path.endsWith('attempt-'+command+'.000003.json')){const sync=h.sync;h.sync=async()=>{await sync();f.mode.wall=60000;};}
   if(flag==='wx'&&point==='DISPATCH_CLOSE'&&path.endsWith('attempt-'+command+'.lock')){const close=h.close;h.close=async()=>{await close();f.mode.wall=60000;};}
   return h;
  };
  const out=await f.c.dispatch(f.item.envelope,f.prepared,f.wire,f.signal).catch(()=>null);if(out)assert.equal(out.state,'UNKNOWN');
  assert.equal(f.driverCalls(),point==='DISPATCH_SYNC'?0:1);
  const c=f.make(),history=await c.prepare(f.item.envelope,f.signal);await assert.rejects(c.dispatch(f.item.envelope,history,f.wire,f.signal),/ELIGIBLE/);assert.equal(f.driverCalls(),point==='DISPATCH_SYNC'?0:1);
 }finally{await f.h.close();}
});


test('observations는 최신 RESPONSE 원체인만 투영하며 만료·조회가 새 dispatch 권위를 만들지 않는다',async()=>{
 const f=await normalInstructionWireFixture();try{
  await f.c.dispatch(f.item.envelope,f.prepared,f.wire,f.signal);const rows=f.rows(),calls=f.calls.length;f.mode.wall+=60000;
  const v=await f.make().observations(f.item.envelope,f.signal);assert.equal(v.state,'RESPONSE_RECORDED');
  assert.deepEqual(v.inputs.map(e=>e.type),['RECEIVED','PREPARED','PERMIT_RECORDED','PROVIDER_RESPONSE_RECEIVED']);
  assert.deepEqual(v.inputs.slice(1).map(e=>[e.localRecordRef,e.occurredAt]),[rows[0],rows[1],rows[3]].map(r=>[r.ref,r.snapshot.recordedAt]));
  assert.equal(v.inputs[3]!.reasonCode,'UNVERIFIED_PROVIDER_CLAIM');assert.equal(f.calls.length,calls);assert.equal(f.driverCalls(),1);
  const file=[...f.fs.files.entries()].find(([p])=>p.includes('attempt-'+f.item.envelope.commandId)&&p.endsWith('.000002.json'))!;file[1].bytes=Buffer.from('{}');
  await assert.rejects(f.make().observations(f.item.envelope,f.signal));assert.equal(f.driverCalls(),1);
 }finally{await f.h.close();}
});


test('역사 관측은 hash를 다시 봉인한 다른 세대/세션/원수신 ref도 거절한다',async()=>{
 for(const change of [(v:any)=>{v.key.executionGeneration++;},(v:any)=>{v.sessionBindingRef.id=randomUUID();},(v:any)=>{v.receivedRef.id=randomUUID();}]){
  const f=await normalInstructionWireFixture();try{
   const file=[...f.fs.files.entries()].find(([p])=>p.includes('attempt-'+f.item.envelope.commandId)&&p.endsWith('.000001.json'))!,calls=f.calls.length;
   const row=JSON.parse(file[1].bytes.toString());change(row.snapshot);row.ref.contentHash=contentHash(canonicalJson(row.snapshot));file[1].bytes=Buffer.from(canonicalJson(row));
   await assert.rejects(f.make().observations(f.item.envelope,f.signal),/NORMAL_LOCAL_STORAGE_UNAVAILABLE/);assert.equal(f.calls.length,calls);assert.equal(f.driverCalls(),0);
   assert(f.fs.files.has(f.fs.path('attempt-'+f.item.envelope.commandId+'.lock')));
  }finally{await f.h.close();}
 }
});
