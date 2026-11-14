import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {normalInstructionDurableFixture,normalInstructionWireFixture} from './normal-instruction-dispatch-fixture.ts';

const response=()=>({transport:'NORMAL_PROTECTED' as const,responseRef:{id:randomUUID(),version:1,contentHash:'a'.repeat(64)},processRef:null});

test('permit에 사용한 OS 현재성 ref가 바뀌면 dispatch driver0',async()=>{
 const f=await normalInstructionDurableFixture();try{
  await f.receive();const original=f.current.current;const otherId=randomUUID();let changed=false,calls=0;
  f.current.current=async(...args)=>{const v=await original(...args);return changed?{...v,osOwnershipRef:{...v.osOwnershipRef,id:otherId}}:v;};
  const c=f.make(),p=await c.prepare(f.item.envelope,f.signal);changed=true;
  const {NormalInstructionWire}=await import('../../../apps/connector/adapters/secondary/normal-instruction-wire.ts');
  const out=await c.dispatch(f.item.envelope,p,new NormalInstructionWire({driver:{async send(){calls++;return response();}}}),f.signal);
  assert.equal(out.state,'UNKNOWN');assert.equal(calls,0);
 }finally{await f.h.close();}
});

test('prepare 뒤 wall이 멈춰도 원 단조 기한을 넘긴 결과는 소비하지 않는다',async t=>{
 const f=await normalInstructionDurableFixture();try{
  await f.receive();const c=f.make(),p=await c.prepare(f.item.envelope,f.signal);let calls=0;
  const {NormalInstructionWire}=await import('../../../apps/connector/adapters/secondary/normal-instruction-wire.ts');
  const tick=performance.now();t.mock.method(performance,'now',()=>tick+60000);
  await assert.rejects(c.dispatch(f.item.envelope,p,new NormalInstructionWire({driver:{async send(){calls++;return response();}}}),f.signal));
  assert.equal(calls,0);
 }finally{t.mock.restoreAll();await f.h.close();}
});

for(const fault of ['CLONE','COMMAND','GENERATION','SESSION','RESULT_PERMIT','ABORT','EXPIRED'] as const)test('명시 dispatch '+fault+' 입력은 driver0',async()=>{
 const f=await normalInstructionWireFixture();try{
  const {contentHash,canonicalJson}=await import('../../../contracts/canonical.ts');
  const e:any=structuredClone(f.item.envelope),controller=new AbortController();let p=f.prepared;
  if(fault==='CLONE')p=structuredClone(p);
  if(fault==='COMMAND')e.commandId=randomUUID();
  if(fault==='GENERATION')e.context.executionGeneration++;
  if(fault==='SESSION')e.payload.sessionBindingRef.id=randomUUID();
  if(['COMMAND','GENERATION','SESSION'].includes(fault)){const {envelopeHash:_,...body}=e;e.envelopeHash=contentHash(canonicalJson(body));}
  if(fault==='RESULT_PERMIT')p.permit!.ref.id=randomUUID();
  if(fault==='ABORT')controller.abort();if(fault==='EXPIRED')f.mode.wall=60000;
  const before=f.calls.length;await assert.rejects(f.c.dispatch(e,p,f.wire,controller.signal));assert.equal(f.driverCalls(),0);assert.equal(f.calls.length,before);assert.equal(f.rows().length,2);
 }finally{await f.h.close();}
});

test('adapter의 위조 capability/기본 driver 부재/변조된 driver는 실행을 만들지 않는다',async()=>{
 const f=await normalInstructionWireFixture();try{
  const {NormalInstructionWire}=await import('../../../apps/connector/adapters/secondary/normal-instruction-wire.ts');
  assert.throws(()=>new NormalInstructionWire({} as any),/DRIVER_REQUIRED/);
  await assert.rejects(f.wire.send({},f.signal),/ELIGIBLE/);
  f.driver.send=async()=>{throw Error('교체된 driver 도달 금지');};
  assert.equal((await f.c.dispatch(f.item.envelope,f.prepared,f.wire,f.signal)).state,'UNKNOWN');assert.equal(f.driverCalls(),0);
 }finally{await f.h.close();}
});

for(const fault of ['THROW','MALFORMED','TIMEOUT','LATE_RESPONSE'] as const)test('driver '+fault+' 뒤 UNKNOWN과 재시작 단발성을 보존한다',async()=>{
 const f=await normalInstructionWireFixture(500);try{
  let calls=0,release!:(v:any)=>void;
  const wire=f.wireWith(async()=>{calls++;if(fault==='THROW')throw Error('RAM_RESPONSE_LOST');if(fault==='MALFORMED')return{...f.observed,accepted:true};return new Promise(r=>release=r);});
  const out=await f.c.dispatch(f.item.envelope,f.prepared,wire,f.signal);assert.equal(out.state,'UNKNOWN');assert.equal(out.responseRef,null);assert.equal(calls,1);
  if(release&&fault==='LATE_RESPONSE'){release(f.observed);await new Promise<void>(r=>setImmediate(r));}
  const before=f.calls.length,restarted=f.make(),history=await restarted.prepare(f.item.envelope,f.signal);assert.equal(history.state,'UNKNOWN');
  await assert.rejects(restarted.dispatch(f.item.envelope,history,f.wire,f.signal),/ELIGIBLE/);assert.equal(calls,1);assert.equal(f.calls.length,before);assert.equal(f.rows().at(-1).snapshot.state,'UNKNOWN');
 }finally{await f.h.close();}
});

test('driver 대기 중 중복/BUSY 및 취소/늦은 응답은 추가 wire0',async()=>{
 const f=await normalInstructionWireFixture();try{
  let entered!:()=>void,release!:(v:any)=>void,calls=0;const seen=new Promise<void>(r=>entered=r),abort=new AbortController();
  const wire=f.wireWith(async()=>{calls++;entered();return new Promise(r=>release=r);});
  const pending=f.c.dispatch(f.item.envelope,f.prepared,wire,abort.signal);await seen;
  await assert.rejects(f.c.dispatch(f.item.envelope,f.prepared,wire,f.signal),/BUSY/);
  abort.abort();assert.equal((await pending).state,'UNKNOWN');release(f.observed);await new Promise<void>(r=>setImmediate(r));
  assert.equal(calls,1);assert.equal(f.rows().at(-1).snapshot.state,'UNKNOWN');await assert.rejects(f.c.dispatch(f.item.envelope,f.prepared,wire,f.signal),/UNKNOWN/);
 }finally{await f.h.close();}
});

test('adapter 재검산의 current 대기 중 취소는 늦은 관측 후에도 driver0',async()=>{
 const f=await normalInstructionDurableFixture();try{
  await f.receive();let count=0,entered!:()=>void,release!:()=>void,calls=0;const seen=new Promise<void>(r=>entered=r),original=f.current.current;
  f.current.current=async(...args)=>{const v=await original(...args);if(++count===3){entered();return new Promise(r=>release=()=>r(v));}return v;};
  const {NormalInstructionWire}=await import('../../../apps/connector/adapters/secondary/normal-instruction-wire.ts');
  const c=f.make(),p=await c.prepare(f.item.envelope,f.signal),abort=new AbortController(),wire=new NormalInstructionWire({driver:{async send(){calls++;return response();}}});
  const pending=c.dispatch(f.item.envelope,p,wire,abort.signal);await seen;abort.abort();assert.equal((await pending).state,'UNKNOWN');
  release();await new Promise<void>(r=>setImmediate(r));assert.equal(calls,0);assert.equal((await f.make().prepare(f.item.envelope,f.signal)).state,'UNKNOWN');
 }finally{await f.h.close();}
});

test('fresh 결과 발급 이후 단조 시각 후퇴는 driver0',async t=>{
 const f=await normalInstructionWireFixture();try{
  t.mock.method(performance,'now',()=>0);
  await assert.rejects(f.c.dispatch(f.item.envelope,f.prepared,f.wire,f.signal),/EXPIRED/);assert.equal(f.driverCalls(),0);
 }finally{t.mock.restoreAll();await f.h.close();}
});

for(const mode of ['FAKE_CLAIM','PROTOTYPE_SWAP'] as const)test('전용 wire 우회 '+mode+'는 관측을 발급하지 못한다',async t=>{
 const f=await normalInstructionWireFixture();try{
  const {claimNormalInstructionDispatch}=await import('../../../apps/connector/runtime/normal-instruction-coordinator.ts');
  const {NormalInstructionWire}=await import('../../../apps/connector/adapters/secondary/normal-instruction-wire.ts');
  let calls=0;const fake=async(cap:object,signal:AbortSignal)=>{calls++;claimNormalInstructionDispatch(cap,signal);return f.observed;};
  const wire=mode==='FAKE_CLAIM'?{transport:'NORMAL_PROTECTED' as const,send:fake}:f.wire;
  if(mode==='PROTOTYPE_SWAP')t.mock.method(NormalInstructionWire.prototype,'send',fake);
  await assert.rejects(f.c.dispatch(f.item.envelope,f.prepared,wire,f.signal),/WIRE_REQUIRED/);
  assert.equal(calls,0);assert.equal(f.driverCalls(),0);assert.equal(f.rows().length,2);
 }finally{t.mock.restoreAll();await f.h.close();}
});

test('wire 재검산에서 짧아진 current 기한의 timer가 pending driver를 취소한다',async t=>{
 const f=await normalInstructionDurableFixture();try{
  await f.receive();const original=f.current.current;let checks=0;
  f.current.current=async(...args)=>{const v=await original(...args);if(++checks===3)v.expiresAt=new Date(f.clock()+40).toISOString();return v;};
  const c=f.make({timeoutMs:500}),p=await c.prepare(f.item.envelope,f.signal);
  const {NormalInstructionWire}=await import('../../../apps/connector/adapters/secondary/normal-instruction-wire.ts');
  const timers=new Map<any,{callback:()=>void;ms:number}>(),realSet=setTimeout,realClear=clearTimeout;
  t.mock.method(globalThis,'setTimeout',(callback:any,ms:any,...args:any[])=>{const handle=realSet(callback,ms,...args);timers.set(handle,{callback:()=>callback(...args),ms:Number(ms)});return handle;});
  t.mock.method(globalThis,'clearTimeout',(handle:any)=>{timers.delete(handle);return realClear(handle);});
  let shorter=false,aborted=false,calls=0;
  const wire=new NormalInstructionWire({driver:{async send(_input,signal){calls++;const timer=[...timers.values()].find(v=>v.ms<=40);shorter=!!timer;
   if(timer)queueMicrotask(timer.callback);
   return new Promise(r=>signal.addEventListener('abort',()=>{aborted=true;r(response());},{once:true}));
  }}});
  const out=await c.dispatch(f.item.envelope,p,wire,f.signal);assert.equal(out.state,'UNKNOWN');assert.equal(calls,1);assert.equal(aborted,true);assert.equal(shorter,true);
 }finally{t.mock.restoreAll();await f.h.close();}
});

test('원 wire에 나중에 심은 accessor는 getter 실행 없이 거절한다',async()=>{
 const f=await normalInstructionWireFixture();try{
  let traps=0;Object.defineProperty(f.wire,'send',{get(){traps++;throw Error('실행 금지');}});
  await assert.rejects(f.c.dispatch(f.item.envelope,f.prepared,f.wire,f.signal),/WIRE_REQUIRED/);assert.equal(traps,0);assert.equal(f.driverCalls(),0);
 }finally{await f.h.close();}
});
