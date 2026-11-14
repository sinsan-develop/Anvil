import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {normalInstructionDurableFixture} from './normal-instruction-dispatch-fixture.ts';

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
