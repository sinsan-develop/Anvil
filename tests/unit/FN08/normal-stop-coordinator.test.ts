import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {preparedExecution} from './normal-start-execution-fixture.ts';
const {canonicalJson,contentHash}=await import('../../../contracts/canonical.ts');
const {normalStopScopeRefV1}=await import('../../../contracts/runtime/normal-stop-target-v1.ts');
const {receiptKeyV1}=await import('../../../contracts/runtime/dispatch-receipt-v1.ts');
const {NormalStopCoordinator}=await import('../../../apps/connector/runtime/normal-stop-coordinator.ts');
const hash=(v:unknown)=>contentHash(canonicalJson(v));
const ref=()=>({id:randomUUID(),version:1,contentHash:'a'.repeat(64)});
/** 原 START는 제품 서버/내구 intake. STOP target/행은 미구현 producer의 RAM 역사 형상이며 현재 소유 증명이 아니다. */
export async function stopFixture(receive=true){
 const f=await preparedExecution(Infinity,receive),target={kind:'NORMAL_STOP_SCOPE_V1' as const,...f.scope,grantRef:f.grantRef,parentStartCommandRef:f.item.commandRef,parentStartEnvelopeHash:f.e.envelopeHash,executorRegistrationRef:f.e.executorRegistrationRef,sessionBindingRef:ref(),roleBindingRef:ref(),bindingGeneration:1,ownershipRef:ref(),mode:'COOPERATIVE_REQUEST_ONLY' as const,forceKillAllowed:false as const};
 const {envelopeHash:_,...base}=f.e,unsigned={...base,commandId:randomUUID(),operation:'REQUEST_STOP' as const,payload:{sessionBindingRef:target.sessionBindingRef,stopScopeRef:normalStopScopeRefV1(target,f.e.commandId)}};
 const item={sequence:f.item.sequence+1,commandRef:ref(),envelope:{...unsigned,envelopeHash:hash(unsigned)},materials:null,materialsDescriptorHash:null,stopTarget:target};
 const original={startCommandRef:f.item.commandRef,startEnvelope:f.e,grantRef:f.grantRef,sessionBindingRef:target.sessionBindingRef,roleBindingRef:target.roleBindingRef,bindingGeneration:1,ownershipRef:target.ownershipRef};
 const ports=()=>({intake:f.intake,store:f.store.stopAttempts(),original,clock:f.clock,timeoutMs:1000});
 const seed=async(count=2,mutate?:(rows:any[])=>void)=>{const rows:any[]=[];for(let i=0;i<count;i++){const snapshot={sequence:i+1,state:i===0?'STOP_ATTEMPTED':'STOP_UNCONFIRMED',key:receiptKeyV1(item.envelope),commandRef:item.commandRef,envelopeHash:item.envelope.envelopeHash,stopScopeRef:item.envelope.payload.stopScopeRef,target,previousRef:rows.at(-1)?.ref??null,recordedAt:new Date(f.clock()).toISOString()};rows.push({ref:{...ref(),contentHash:hash(snapshot)},snapshot});}mutate?.(rows);await f.store.exclusive('attempt-'+item.envelope.commandId,async tx=>{await tx.read();for(const r of rows)await tx.appendAndSync(r);});return rows;};
 return{...f,target,original,stopItem:item,ports,seed,coordinator:()=>new NormalStopCoordinator(ports())};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 test('원 START 수신 뒤에도 normal owner 부재는 새 STOP 시도/관측 없이 거절한다',async()=>{
  const f=await stopFixture();try{const c=f.coordinator();await assert.rejects(c.recordObservations(f.stopItem,f.make().spool,f.signal),/NORMAL_STOP_OWNER_UNAVAILABLE/);assert.equal(f.mode.wires,0);assert(![...f.fs.files.keys()].some(k=>k.includes('attempt-'+f.stopItem.envelope.commandId)||k.endsWith('observations.jsonl')));}finally{await f.h.app.close();}
 });
 test('RAM 역사 STOP 체인만 관측 복구하며 재시작도 원 관측 ID/시각을 보존한다',async()=>{
  const f=await stopFixture();try{const rows=await f.seed(),spool=f.make().spool;
   const a=await f.coordinator().recordObservations(f.stopItem,spool,f.signal),b=await f.coordinator().recordObservations(f.stopItem,spool,f.signal);
   assert.equal(a.state,'STOP_UNCONFIRMED');assert.deepEqual(a,b);assert.equal(a.executionAuthorized,false);assert.equal(a.writerReleaseVerified,false);assert.equal(f.mode.wires,0);
   const saved=await f.store.exclusive('observations',tx=>tx.read()) as any[];assert.equal(saved.length,2);assert.deepEqual(saved.map(r=>r.snapshot.event.localRecordRef),rows.map(r=>r.ref));assert.deepEqual(saved.map(r=>r.snapshot.event.occurredAt),rows.map(r=>r.snapshot.recordedAt));assert.equal(saved.at(-1).snapshot.event.type,'STOP_UNCONFIRMED');
  }finally{await f.h.app.close();}
 });
 test('재해시한 교차 target/명령/namespace·다른 원 START는 역사 관측을 만들지 않는다',async()=>{
  const f=await stopFixture();try{await f.seed();const cases=[(v:any)=>v.stopTarget.ownershipRef=ref(),(v:any)=>v.stopTarget.parentStartCommandRef=ref(),(v:any)=>v.stopTarget.executorRegistrationRef=ref(),(v:any)=>v.commandRef=ref(),(v:any)=>v.envelope.context.executionGeneration++];
   for(const mutate of cases){const item=structuredClone(f.stopItem);mutate(item);item.envelope.payload.stopScopeRef=normalStopScopeRefV1(item.stopTarget,f.e.commandId);const{envelopeHash:_,...body}=item.envelope;item.envelope.envelopeHash=hash(body);await assert.rejects(f.coordinator().observations(item,f.signal));}
   const item=structuredClone(f.stopItem);item.envelope.payload.stopScopeRef=normalStopScopeRefV1(item.stopTarget,item.commandRef.id);const{envelopeHash:_,...body}=item.envelope;item.envelope.envelopeHash=hash(body);await assert.rejects(f.coordinator().observations(item,f.signal));
   const original=structuredClone(f.original);original.startEnvelope={...f.e,commandId:randomUUID()};await assert.rejects(new NormalStopCoordinator({...f.ports(),original}).observations(f.stopItem,f.signal));assert.equal(f.mode.wires,0);
  }finally{await f.h.app.close();}
 });
 test('원 START 미수신은 역사 STOP이 있어도 거절한다',async()=>{
  const f=await stopFixture(false);try{await f.seed();await assert.rejects(f.coordinator().observations(f.stopItem,f.signal),/START_NOT_RECEIVED/);assert.equal(f.mode.wires,0);}finally{await f.h.app.close();}
 });
 test('부분 행은 원 시각의 불명 관측만 반환하고 새 종결행을 append하지 않는다',async()=>{
  const f=await stopFixture();try{const rows=await f.seed(1),value=await f.coordinator().observations(f.stopItem,f.signal);assert.equal(value.state,'UNKNOWN');assert.equal(value.inputs[0]!.reasonCode,'RECORD_UNCERTAIN');assert.deepEqual(await f.store.exclusive('attempt-'+f.stopItem.envelope.commandId,tx=>tx.read()),rows);
   f.h.store.mode.offset+=60000;const past=await f.coordinator().observations(f.stopItem,f.signal);assert.deepEqual(past,value);
  }finally{await f.h.app.close();}
 });
 test('잘못된 역사 chain은 fallback하지 않고 실패를 봉인한다',async()=>{
  const f=await stopFixture();try{await f.seed(2,rows=>{rows[1].snapshot.previousRef=ref();rows[1].ref.contentHash=hash(rows[1].snapshot);});const c=f.coordinator();await assert.rejects(c.observations(f.stopItem,f.signal));await assert.rejects(c.observations(f.stopItem,f.signal),/UNKNOWN/);assert.equal(f.mode.wires,0);}finally{await f.h.app.close();}
 });
 test('strict CLOSE 불명은 관측 전에 실패·원 lock 보존·재시작0이다',async()=>{
  const f=await stopFixture();try{await f.seed();const open=f.fs.fs.open;let closes=0;f.fs.fs.open=async(path:string,flag:any)=>{const handle=await open(path,flag);if(path.endsWith('attempt-'+f.stopItem.envelope.commandId+'.lock'))handle.close=async()=>{closes++;throw Error('RAM_CLOSE_UNKNOWN');};return handle;};
   const spool=f.make().spool;await assert.rejects(f.coordinator().recordObservations(f.stopItem,spool,f.signal),/NORMAL_LOCAL_STORAGE_UNAVAILABLE/);assert.equal((await spool.batch()).events.length,0);await assert.rejects(f.coordinator().observations(f.stopItem,f.signal),/NORMAL_LOCAL_BUSY/);assert.equal(closes,1);
  }finally{await f.h.app.close();}
 });
 test('원메서드 교체/accessor/Proxy·취소 입력은 조회/부작용0으로 닫힌다',async()=>{
  const f=await stopFixture();try{let traps=0;const proxy=new Proxy(f.stopItem,{ownKeys(){traps++;throw Error();}});await assert.rejects(f.coordinator().observations(proxy,f.signal));assert.equal(traps,0);
   const item=structuredClone(f.stopItem);Object.defineProperty(item,'envelope',{get(){traps++;return f.stopItem.envelope;},enumerable:true});await assert.rejects(f.coordinator().observations(item,f.signal));assert.equal(traps,0);
   const abort=new AbortController();abort.abort();await assert.rejects(f.coordinator().observations(f.stopItem,abort.signal),/CANCELLED/);
   const original=f.intake.readStatus;f.intake.readStatus=async()=>({state:'RECEIVED'} as any);assert.throws(()=>f.coordinator(),/PORT_CHANGED/);f.intake.readStatus=original;
  }finally{await f.h.app.close();}
 });
 test('읽기 대기 중 취소·늦은 결과는 관측 append와 다음 시도를 열지 않는다',async()=>{
  const f=await stopFixture();try{const rows=await f.seed();let release!:(r:unknown[])=>void,entered!:()=>void;const ready=new Promise<void>(r=>{entered=r;});let calls=0;
   const store={transport:'NORMAL_PROTECTED' as const,exclusive:async<T>(_key:any,body:(tx:any)=>Promise<T>)=>{calls++;return body({read:()=>{entered();return new Promise<unknown[]>(r=>{release=r;});},appendAndSync:async()=>assert.fail('새 시도 금지')});}};
   const c=new NormalStopCoordinator({...f.ports(),store}),abort=new AbortController(),run=c.observations(f.stopItem,abort.signal);await ready;abort.abort();await assert.rejects(run,/INTERRUPTED/);release(rows);await new Promise(r=>setImmediate(r));await assert.rejects(c.observations(f.stopItem,f.signal),/UNKNOWN/);assert.equal(calls,1);
  }finally{await f.h.app.close();}
 });

 test('관측 append sync 불명은 원 STOP 행과 lock을 보존하며 새 coordinator도 추가 실행0이다',async()=>{
  const f=await stopFixture();try{const rows=await f.seed(),spool=f.make().spool;f.fs.mode.failSync=true;
   await assert.rejects(f.coordinator().recordObservations(f.stopItem,spool,f.signal));assert([...f.fs.files.keys()].some(p=>p.endsWith('observations.lock')));f.fs.mode.failSync=false;
   await assert.rejects(f.coordinator().recordObservations(f.stopItem,spool,f.signal),/NORMAL_LOCAL_BUSY/);assert.deepEqual(await f.store.exclusive('attempt-'+f.stopItem.envelope.commandId,tx=>tx.read()),rows);assert.equal(f.mode.wires,0);
  }finally{await f.h.app.close();}
 });
 test('역사 시각 미래·hash 변경·STOPPED 전이·중복 ref는 정본 재해시 후에도 거절한다',async()=>{
  const f=await stopFixture();try{const rows=await f.seed(),cases=[(r:any[])=>r[1].snapshot.recordedAt=new Date(f.clock()+1).toISOString(),(r:any[])=>r[1].ref.contentHash='b'.repeat(64),(r:any[])=>r[1].snapshot.state='STOPPED',(r:any[])=>r[1].ref.id=r[0].ref.id];
   for(const [i,mutate] of cases.entries()){const bad=structuredClone(rows);mutate(bad);if(i!==1)bad[1].ref.contentHash=hash(bad[1].snapshot);const store={transport:'NORMAL_PROTECTED' as const,exclusive:async<T>(_k:any,body:(t:any)=>Promise<T>)=>body({read:async()=>bad,appendAndSync:async()=>assert.fail('append0')})};await assert.rejects(new NormalStopCoordinator({...f.ports(),store}).observations(f.stopItem,f.signal));}
  }finally{await f.h.app.close();}
 });

}


if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)test('원 live Query에 첫 STOP 거래가 닫힌 뒤 한 번만 협력 interrupt를 전달한다',async()=>{
 const {liveStopFixture}=await import('../FN07/normal-first-send-owner.test.ts'),f=await liveStopFixture();
 try{
  assert.equal((await f.run()).state,'LIMIT_REACHED');
  f.stopHooks.interrupt=async()=>{const rows=await f.stopRows();assert.deepEqual(rows.map(r=>r.snapshot.state),['STOP_ATTEMPTED']);};
  const coordinator=()=>new NormalStopCoordinator(f.stopPorts());
  const value=await coordinator().recordObservations(f.stopItem,f.spool,f.signal,f.worker);
  assert.equal(f.stopCalls.interrupt,1);assert.equal(value.state,'STOP_UNCONFIRMED');assert.equal(value.writerReleaseVerified,false);
  assert.deepEqual((await f.stopRows()).map(r=>r.snapshot.state),['STOP_ATTEMPTED','STOP_UNCONFIRMED']);
  await coordinator().recordObservations(f.stopItem,f.spool,f.signal,f.worker);assert.equal(f.stopCalls.interrupt,1);
  const events=(await f.spool.batch()).events.filter(e=>e.commandId===f.stopItem.envelope.commandId);
  assert.deepEqual(events.map(e=>e.type),['STOP_UNCONFIRMED','STOP_REQUESTED','STOP_UNCONFIRMED']);
 }finally{f.authority.abort();await f.h.close();}
});


if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 for(const mode of ['no-current','scope','owner','target','expired','method','cancel','store'] as const)test('독립 STOP 현재성과 원 객체가 일치할 때만 호출 '+mode,async()=>{
  const {liveStopFixture}=await import('../FN07/normal-first-send-owner.test.ts'),f=await liveStopFixture(),abort=new AbortController();
  try{
   assert.equal((await f.run()).state,'LIMIT_REACHED');
   f.stopHooks.current=w=>{
    if(mode==='no-current')return null;
    if(mode==='scope')w.scopeDigest='0'.repeat(64);
    if(mode==='owner')w.owner={};
    if(mode==='target')w.projection.target.ownershipRef=ref();
    if(f.stopCalls.current===2){
     if(mode==='expired')w.projection.expiresAt=w.projection.checkedAt;
     if(mode==='method')f.stopQuery().interrupt=async()=>assert.fail('교체된 메서드 호출');
     if(mode==='cancel')abort.abort();
    }
    return w;
   };
   const ports=f.stopPorts();if(mode==='store')ports.store=f.store.stopAttempts();
   await assert.rejects(new NormalStopCoordinator(ports).recordObservations(f.stopItem,f.spool,abort.signal,f.worker));
   assert.equal(f.stopCalls.interrupt,0);assert.equal(f.effects.close,0);
   const late=mode==='expired'||mode==='method'||mode==='cancel';assert.equal((await f.stopRows()).length,late?1:0);
   if(late){const history=await new NormalStopCoordinator(f.stopPorts()).observations(f.stopItem,f.signal);assert.equal(history.state,'UNKNOWN');assert.deepEqual(history.inputs.map(e=>e.type),['STOP_UNCONFIRMED']);}
  }finally{f.authority.abort();await f.h.close();}
 });
 test('첫 SEND 정착 전 STOP은 거절하고 다른 명령의 재진입도 원 Query에 도달하지 않는다',async()=>{
  const {liveStopFixture}=await import('../FN07/normal-first-send-owner.test.ts'),f=await liveStopFixture();
  const run=(item=f.stopItem)=>new NormalStopCoordinator(f.stopPorts()).recordObservations(item,f.spool,f.signal,f.worker);
  try{
   f.hooks.inCreate=async()=>{await assert.rejects(run(),/OWNER_UNAVAILABLE/);assert.equal((await f.stopRows()).length,0);};
   assert.equal((await f.run()).state,'LIMIT_REACHED');
   const other=structuredClone(f.stopItem);other.commandRef=ref();other.envelope.commandId=randomUUID();
   const {envelopeHash:_,...unsigned}=other.envelope;other.envelope.envelopeHash=hash(unsigned);
   f.stopHooks.interrupt=async()=>{await assert.rejects(run(other),/OWNER_UNAVAILABLE/);};
   assert.equal((await run()).state,'STOP_UNCONFIRMED');assert.equal(f.stopCalls.interrupt,1);
   assert.equal(f.effects.create,1);assert.equal(f.effects.close,0);
  }finally{f.authority.abort();await f.h.close();}
 });
 test('첫 STOP 쓰기 거래의 close 불명은 원 lock과 시도행을 남기고 interrupt는 없다',async()=>{
  const {liveStopFixture}=await import('../FN07/normal-first-send-owner.test.ts'),f=await liveStopFixture();
  try{
   assert.equal((await f.run()).state,'LIMIT_REACHED');
   const open=f.fs.fs.open.bind(f.fs.fs);let lost=0;
   f.fs.fs.open=async(p:string,flag:any)=>{const file=await open(p,flag);if(flag==='wx'&&p.endsWith('attempt-'+f.stopItem.envelope.commandId+'.lock')){
    const close=file.close.bind(file);file.close=async()=>{if([...f.fs.files.keys()].some(k=>k.includes(f.stopItem.envelope.commandId)&&k.endsWith('.json'))){lost++;throw Error('RAM_STOP_CLOSE_LOST');}await close();};
   }return file;};
   const run=()=>new NormalStopCoordinator(f.stopPorts()).recordObservations(f.stopItem,f.spool,f.signal,f.worker);
   await assert.rejects(run(),/LOCAL_STORAGE_UNAVAILABLE/);await assert.rejects(run(),/LOCAL_BUSY/);
   assert.equal(f.stopCalls.interrupt,0);assert.equal(lost,1);assert([...f.fs.files.keys()].some(k=>k.endsWith(f.stopItem.envelope.commandId+'.lock')));
  }finally{f.authority.abort();await f.h.close();}
 });
}


if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 test('interrupt 대기 중 취소 후 늦은 반환은 새 행·요청 관측·재호출을 만들지 않는다',async()=>{
  const {liveStopFixture}=await import('../FN07/normal-first-send-owner.test.ts'),f=await liveStopFixture(),abort=new AbortController();
  const entered=Promise.withResolvers<void>(),release=Promise.withResolvers<void>();
  try{
   assert.equal((await f.run()).state,'LIMIT_REACHED');
   f.stopHooks.interrupt=async()=>{entered.resolve();await release.promise;};
   const run=new NormalStopCoordinator(f.stopPorts()).recordObservations(f.stopItem,f.spool,abort.signal,f.worker);
   await entered.promise;abort.abort();await assert.rejects(run,/INTERRUPTED/);
   release.resolve();await new Promise(resolve=>setImmediate(resolve));
   const restored=await new NormalStopCoordinator(f.stopPorts()).recordObservations(f.stopItem,f.spool,f.signal,f.worker);
   assert.equal(restored.state,'UNKNOWN');assert.equal(f.stopCalls.interrupt,1);assert.equal(f.effects.close,0);
   assert.deepEqual((await f.stopRows()).map(r=>r.snapshot.state),['STOP_ATTEMPTED']);
   assert.deepEqual((await f.spool.batch()).events.filter(e=>e.commandId===f.stopItem.envelope.commandId).map(e=>e.type),['STOP_UNCONFIRMED']);
  }finally{release.resolve();f.authority.abort();await f.h.close();}
 });
 test('원 interrupt의 명시 실패는 호출 전달만 기록하고 종료나 writer 해제를 확인하지 않는다',async()=>{
  const {liveStopFixture}=await import('../FN07/normal-first-send-owner.test.ts'),f=await liveStopFixture();
  try{
   assert.equal((await f.run()).state,'LIMIT_REACHED');f.stopHooks.interrupt=async()=>{throw Error('RAM_INTERRUPT_REJECTED');};
   const run=()=>new NormalStopCoordinator(f.stopPorts()).recordObservations(f.stopItem,f.spool,f.signal,f.worker);
   const result=await run();assert.equal(result.state,'STOP_UNCONFIRMED');assert.equal(result.writerReleaseVerified,false);
   await run();assert.equal(f.stopCalls.interrupt,1);assert.equal(f.effects.close,0);
   assert.equal((await f.spool.batch()).events.some(e=>e.type==='STOPPED'),false);
  }finally{f.authority.abort();await f.h.close();}
 });
}


if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)test('시도 쓰기 거래가 body를 실행하지 않고 반환하면 원 Query에 도달하지 않는다',async()=>{
 const {liveStopFixture}=await import('../FN07/normal-first-send-owner.test.ts'),f=await liveStopFixture();
 try{
  const store=f.stop.store,open=store.exclusive.bind(store);let count=0;
  store.exclusive=async(key,body)=>{if(++count===2)return undefined as never;return open(key,body);};
  assert.equal((await f.run()).state,'LIMIT_REACHED');
  await assert.rejects(new NormalStopCoordinator(f.stopPorts()).recordObservations(f.stopItem,f.spool,f.signal,f.worker));
  assert.equal(f.stopCalls.interrupt,0);assert.equal((await f.stopRows()).length,0);
 }finally{f.authority.abort();await f.h.close();}
});

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)test('선점 전 접근자 재진입과 다른 STOP의 경쟁에서도 원 Query는 한 요청만 소비한다',async()=>{
 const {requestNormalLiveStop}=await import('../../../apps/connector/runtime/normal-first-send-owner.ts');
 const {liveStopFixture}=await import('../FN07/normal-first-send-owner.test.ts'),f=await liveStopFixture();
 const entered=Promise.withResolvers<void>(),release=Promise.withResolvers<void>();
 const invoke=(item=f.stopItem)=>requestNormalLiveStop(f.worker,item,f.original,f.stop.store,f.signal,()=>{});
 const settled=(item=f.stopItem)=>invoke(item).then(()=>'delivered',()=>'rejected');
 let normal:ReturnType<typeof settled>|undefined,getters=0;
 try{
  assert.equal((await f.run()).state,'LIMIT_REACHED');
  const other=structuredClone(f.stopItem);other.commandRef=ref();other.envelope.commandId=randomUUID();
  const {envelopeHash:_,...unsigned}=other.envelope;other.envelope.envelopeHash=hash(unsigned);
  let thirdActive=false;
  f.stopHooks.current=async w=>{
   if(f.stopCalls.current===1){entered.resolve();await release.promise;}
   else if(thirdActive){w.commandRef=other.commandRef;w.envelopeHash=other.envelope.envelopeHash;}
   return w;
  };
  const invalid=structuredClone(f.stopItem);
  Object.defineProperty(invalid,'envelope',{enumerable:true,get(){getters++;normal??=settled();return f.stopItem.envelope;}});
  await assert.rejects(invoke(invalid));
  normal??=settled();await entered.promise;
  const before=f.stopCalls.current;thirdActive=true;
  const contender=await settled(other),otherReads=f.stopCalls.current-before;
  thirdActive=false;release.resolve();
  const original=await normal;
  assert.deepEqual({getters,contender,otherReads,original,interrupt:f.stopCalls.interrupt},
   {getters:0,contender:'rejected',otherReads:0,original:'delivered',interrupt:1});
  assert.deepEqual((await f.stopRows()).map(row=>row.snapshot.state),['STOP_ATTEMPTED','STOP_UNCONFIRMED']);
 }finally{release.resolve();if(normal)await normal;f.authority.abort();await f.h.close();}
});
