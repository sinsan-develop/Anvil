import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {normalInstructionPollingFixture} from './normal-instruction-dispatch-fixture.ts';

test('원 START/SEND 혼합 page에서 내구 관측 ACK 이후 cursor를 확정한다',async()=>{
 const f=await normalInstructionPollingFixture();try{
  const r=await f.poll().run(f.signal);assert.equal(r.state,'LIMIT_REACHED',JSON.stringify({r,effects:f.effects,observations:f.h.observations.length}));assert.equal(r.commands,2);assert.equal(r.cursor.afterSequence,f.item.sequence);
  assert.deepEqual(f.effects,{start:1,send:1,sendFail:false});assert.equal(f.h.startPermits.length,1);assert.equal(f.h.permits.length,1);
  assert.equal(f.h.observations.length,9);assert.equal((await f.spool.latestAck()).snapshot.highestContiguous,9);
  const replay=await f.poll().run(f.signal);assert.equal(replay.state,'LIMIT_REACHED');assert.equal(f.effects.start,1);assert.equal(f.effects.send,1);assert.equal(f.h.observations.length,9);
 }finally{await f.h.close();}
});


test('두 번째 SEND 결과불명은 cursor0·원 UNKNOWN을 보존하고 재시작 driver를 늘리지 않는다',async()=>{
 const f=await normalInstructionPollingFixture();try{
  f.effects.sendFail=true;const p=f.poll(),r=await p.run(f.signal);assert.equal(r.state,'UNKNOWN');assert.equal(r.cursor.afterSequence,0);assert.equal(r.commands,1);
  assert.equal(f.effects.send,1);assert.equal(f.h.observations.at(-1).snapshot_json.event.type,'UNKNOWN');
  const calls=f.calls.length;await p.run(f.signal);assert.equal(f.calls.length,calls);
  const replay=await f.poll().run(f.signal);assert.equal(replay.state,'UNKNOWN');assert.equal(replay.cursor.afterSequence,0);assert.equal(f.effects.start,1);assert.equal(f.effects.send,1);
 }finally{await f.h.close();}
});

test('RESPONSE 뒤 부분 관측 실패를 새 owner가 원 ref/시각으로 보충하고 driver를 재호출하지 않는다',async()=>{
 const f=await normalInstructionPollingFixture();try{
  const open=f.fs.fs.open;let failed=false;f.fs.fs.open=async(p:string,flag:any)=>{
   if(!failed&&flag==='wx'&&p.endsWith('observations.lock')&&[...f.fs.files.keys()].filter(k=>/observations\.\d+\.json$/.test(k)).length===7){failed=true;throw Error('RAM_BEFORE_CREATE');}return open(p,flag);
  };
  const first=await f.poll().run(f.signal);assert.equal(first.state,'UNKNOWN');assert.equal(first.cursor.afterSequence,0);assert.equal(failed,true);assert.equal(f.effects.send,1);
  const history=await f.make().observations(f.item.envelope,f.signal);assert.equal(history.state,'RESPONSE_RECORDED');assert.equal(history.inputs.length,4);
  const second=await f.poll().run(f.signal);assert.equal(second.state,'LIMIT_REACHED');assert.equal(second.cursor.afterSequence,f.item.sequence);assert.equal(f.effects.send,1);assert.equal(f.effects.start,1);
  const local=(await f.spool.batch()).events.filter((e:any)=>e.commandId===f.item.envelope.commandId);
  assert.deepEqual(local.map((e:any)=>[e.type,e.localRecordRef,e.occurredAt]),history.inputs.map(e=>[e.type,e.localRecordRef,e.occurredAt]));
 }finally{await f.h.close();}
});

test('역사 permit은 관측만 ACK하고 fresh dispatch/cursor 권위를 만들지 않는다',async()=>{
 const f=await normalInstructionPollingFixture();try{
  await f.receive();await f.make().prepare(f.item.envelope,f.signal);const materialCalls=f.calls.filter(c=>c.path.includes('/materials/')).length;
  const r=await f.poll().run(f.signal);assert.equal(r.state,'UNKNOWN');assert.equal(r.cursor.afterSequence,0);assert.equal(f.effects.send,0);assert.equal(f.h.permits.length,1);assert.equal(f.calls.filter(c=>c.path.includes('/commands/'+f.item.envelope.commandId+'/materials/')).length,materialCalls);
  assert.equal((await f.make().observations(f.item.envelope,f.signal)).state,'PERMIT_RECORDED');
  assert.equal((await f.spool.coverage()).covered,true);
 }finally{await f.h.close();}
});

for(const broken of ['lost','forged','no-progress'] as const)test('SEND ACK '+broken+'는 cursor를 보존하며 추가 POST를 자동 반복하지 않는다',async()=>{
 const f=await normalInstructionPollingFixture();try{
  f.hooks.afterSend=()=>{if(broken==='lost')f.mode.loseObservations=true;
   else if(broken==='forged')f.mode.mutateObservations=v=>{v.ack.ref.contentHash='b'.repeat(64);};
   else f.spool.sync=async()=>f.spool.latestAck();};
  const p=f.poll(),r=await p.run(f.signal);assert.equal(r.state,'UNKNOWN');assert.equal(r.cursor.afterSequence,0);assert.equal(f.effects.send,1);
  assert.equal(f.calls.filter(c=>c.path.endsWith('/observations')).length,broken==='no-progress'?1:2);
  const calls=f.calls.length;await p.run(f.signal);assert.equal(f.calls.length,calls);
  assert.equal((await f.make().observations(f.item.envelope,f.signal)).state,'RESPONSE_RECORDED');assert.equal((await f.spool.coverage()).covered,false);
 }finally{await f.h.close();}
});


test('SEND 관측 전 여유 부족은 명시 갱신 후 새 credential로 원 sequence를 ACK한다',async()=>{
 const f=await normalInstructionPollingFixture(5000),j=f.h.q.j;try{
  const {NormalStartPolling}=await import('../../../apps/connector/runtime/normal-start-polling.ts');
  const {NormalProtectedGetClient}=await import('../../../apps/connector/runtime/normal-protected-get-client.ts');
  const {NormalProtectedPostClient}=await import('../../../apps/connector/runtime/normal-protected-post-client.ts');
  let nextRef:any,renewals=0;f.hooks.afterSend=()=>{j.store.mode.offset+=4500;};
  const configOptions=f.options();configOptions.instruction.timeoutMs=10000;
  const p=new NormalStartPolling({...configOptions,renew:async()=>{
   renewals++;const c=await j.newChallenge({...j.exchangeRequest,requestId:randomUUID(),clientNonce:randomBytes(32).toString('base64url'),issuedAt:j.store.now().toISOString()});
   const reply=await j.exchange(j.auth(c));assert.equal(reply.statusCode,200,reply.body);const v=reply.json();nextRef=v.receiptRef;
   const config={...f.config,credential:v.credential,credentialExpiresAt:v.expiresAt};
   return{get:new NormalProtectedGetClient(config,f.ports),post:new NormalProtectedPostClient(config,f.ports),expiresAt:v.expiresAt};
  }});
  const first=await p.run(f.signal);assert.equal(first.state,'NEEDS_RENEWAL');assert.equal(first.cursor.afterSequence,0);assert.equal(f.effects.send,1);assert.equal(f.h.observations.length,5);assert.equal(renewals,0);
  await assert.rejects(()=>p.renew(f.signal),/NOT_EXPIRED/);j.store.mode.offset+=500;await p.renew(f.signal);
  const result=await p.run(f.signal);assert.equal(result.state,'LIMIT_REACHED',JSON.stringify(result));assert.equal(f.effects.send,1);assert.equal(f.effects.start,1);assert.equal(f.h.permits.length,1);
  assert.deepEqual(f.h.observations.map((r:any)=>r.snapshot_json.event.sequence),[1,2,3,4,5,6,7,8,9]);
  const receipt=j.store.receipts().filter((r:any)=>r.snapshot_json.kind==='NORMAL_OBSERVATIONS').at(-1);assert.deepEqual(receipt.snapshot_json.credentialRef,nextRef);
  assert.equal(f.calls.filter(c=>c.path.endsWith('/observations')).length,2);assert.equal((await f.spool.coverage()).covered,true);
 }finally{await f.h.close();}
});

test('관측 append 불명 lock은 재시작에도 그대로 남아 추가 driver를 막는다',async()=>{
 const f=await normalInstructionPollingFixture();try{
  const open=f.fs.fs.open;let failed=false;f.fs.fs.open=async(p:string,flag:any)=>{if(!failed&&flag==='wx'&&p.includes('observations.000008.json')){failed=true;throw Error('RAM_APPEND_UNKNOWN');}return open(p,flag);};
  assert.equal((await f.poll().run(f.signal)).state,'UNKNOWN');assert.equal(failed,true);
  assert([...f.fs.files.keys()].some(k=>k.endsWith('observations.lock')));
  assert.equal((await f.poll().run(f.signal)).state,'UNKNOWN');assert.equal(f.effects.send,1);assert.equal(f.effects.start,1);
 }finally{await f.h.close();}
});


test('SEND 원 ref가 두 번째 batch에 있으면 첫 200 ACK로 cursor를 확정하지 않는다',async()=>{
 const f=await normalInstructionPollingFixture();try{
  const {NormalStartPolling}=await import('../../../apps/connector/runtime/normal-start-polling.ts');
  f.hooks.afterSend=async()=>{for(let i=0;i<201;i++)await f.spool.record({type:'HEARTBEAT',commandId:f.item.envelope.commandId,envelopeHash:f.item.envelope.envelopeHash,
   localRecordRef:{id:randomUUID(),version:1,contentHash:'c'.repeat(64)},processRef:null,occurredAt:new Date(f.clock()).toISOString(),reasonCode:'NONE'});};
  let replies=0;f.mode.mutateObservations=v=>{if(++replies===3)v.ack.ref.contentHash='b'.repeat(64);};
  const o=f.options();o.instruction.timeoutMs=10000;const r=await new NormalStartPolling(o).run(f.signal);
  assert.equal(r.state,'UNKNOWN');assert.equal(r.cursor.afterSequence,0);assert.equal(f.effects.send,1);
  const posts=f.calls.filter(c=>c.path.endsWith('/observations')).map(c=>c.body as any);assert.deepEqual(posts.map(b=>b.events.length),[5,200,5]);
  const source=await f.make().observations(f.item.envelope,f.signal),wanted=source.inputs.at(-1)!.localRecordRef;
  assert(!posts[1].events.some((e:any)=>e.localRecordRef.id===wanted.id));assert(posts[2].events.some((e:any)=>e.localRecordRef.id===wanted.id));
  const coverage=await f.spool.coverage();assert.equal(coverage.sequence,210);assert.equal(coverage.highestContiguous,205);assert.equal(coverage.covered,false);
  f.mode.mutateObservations=null;const restart=await f.poll().run(f.signal);assert.equal(restart.state,'LIMIT_REACHED');assert.equal(f.effects.send,1);assert.equal(f.effects.start,1);assert.equal((await f.spool.coverage()).highestContiguous,210);
 }finally{await f.h.close();}
});


test('역사 RESPONSE 복구는 현재 지시 자료가 정정되어 GET412여도 새 GET 없이 ACK한다',async()=>{
 const f=await normalInstructionPollingFixture(Infinity,{text:"START context와 별도인 후속 원지시",mediaType:"text/plain;charset=utf-8"});try{
  const open=f.fs.fs.open;let failed=false;f.fs.fs.open=async(p:string,flag:any)=>{
   if(!failed&&flag==='wx'&&p.endsWith('observations.lock')&&[...f.fs.files.keys()].filter(k=>/observations\.\d+\.json$/.test(k)).length===7){failed=true;throw Error('RAM_BEFORE_CREATE');}return open(p,flag);
  };
  assert.equal((await f.poll().run(f.signal)).state,'UNKNOWN');assert.equal(f.effects.send,1);
  assert.equal((await f.make().history(f.item,f.signal)).state,'RESPONSE_RECORDED');
  f.h.x.mode.afterReadCorrection=true;f.h.x.mode.correctionOnlySelected=true;
  const part=f.item.materials.groups[0]!.parts[0]!,path=`${f.h.prefix}/commands/${f.item.envelope.commandId}/materials/${part.materialId}`;
  const before=f.calls.filter(c=>c.path===path).length,second=await f.poll().run(f.signal);
  assert.equal(second.state,'LIMIT_REACHED',JSON.stringify({second,calls:f.calls.slice(-3).map(c=>({path:c.path,status:c.status,error:c.error}))}));assert.equal(f.calls.filter(c=>c.path===path).length,before);assert.equal(f.effects.send,1);assert.equal(f.effects.start,1);assert.equal((await f.spool.coverage()).covered,true);
  const proof=await f.h.prepare(path);const denied=await proof.get();assert.equal(denied.statusCode,412,denied.body);
 }finally{await f.h.close();}
});


test('기존 attempt와 수신행 소실 또는 손상은 신규 GET으로 fallback하지 않는다',async()=>{
 for(const fault of ['MISSING','CORRUPT'] as const){
  const f=await normalInstructionPollingFixture();try{
   await f.receive();await f.make().prepare(f.item.envelope,f.signal);
   const files=[...f.fs.files.entries()].filter(([p])=>p.includes('intake-'+f.item.envelope.commandId)&&p.endsWith('.json'));
   if(fault==='MISSING')for(const [p] of files)f.fs.files.delete(p);else files[0]![1].bytes=Buffer.from('{}');
   const before=f.calls.filter(c=>c.path.includes('/commands/'+f.item.envelope.commandId+'/materials/')).length;
   const r=await f.poll().run(f.signal);assert.equal(r.state,'UNKNOWN');assert.equal(r.cursor.afterSequence,0);assert.equal(f.effects.send,0);assert.equal(f.h.permits.length,1);
   assert.equal(f.calls.filter(c=>c.path.includes('/commands/'+f.item.envelope.commandId+'/materials/')).length,before);
  }finally{await f.h.close();}
 }
});

test('첫 SEND 로컬 4행은 마지막 permit의 두 번째 batch ACK 뒤에만 cursor를 확정한다',async()=>{
 const {firstSendFixture}=await import('../FN07/normal-first-send-owner.test.ts');const f=await firstSendFixture();
 try{
  const create=f.source.create.bind(f.source);f.source.create=async(...args)=>{
   for(let i=0;i<201;i++)await f.spool.record({type:'HEARTBEAT',commandId:f.item.envelope.commandId,envelopeHash:f.item.envelope.envelopeHash,
    localRecordRef:{id:randomUUID(),version:1,contentHash:'c'.repeat(64)},processRef:null,occurredAt:new Date(f.clock()).toISOString(),reasonCode:'NONE'});
   return create(...args);
  };
  const {NormalStartPolling}=await import('../../../apps/connector/runtime/normal-start-polling.ts'),opts=f.options();opts.instruction.timeoutMs=10000;
  let replies=0;f.mode.mutateObservations=v=>{if(++replies===3)v.ack.ref.contentHash='b'.repeat(64);};
  const first=await new NormalStartPolling(opts).run(f.signal);assert.equal(first.state,'UNKNOWN');assert.equal(first.cursor.afterSequence,0);
  const history=await f.make().observations(f.item.envelope,f.signal);assert.equal(history.state,'FIRST_SEND_INPUT_AND_INIT_RECORDED');assert.equal(history.inputs.at(-1)?.type,'PERMIT_RECORDED');
  const wanted=history.inputs.at(-1)!.localRecordRef;
  const posts=f.calls.filter(c=>c.path.endsWith('/observations')).map(c=>c.body as any);
  assert.equal(posts.length,3);assert.equal(posts[1].events.length,200);assert(!posts[1].events.some((e:any)=>e.localRecordRef.id===wanted.id));
  assert(posts[2].events.some((e:any)=>e.localRecordRef.id===wanted.id));assert.equal((await f.spool.coverage()).covered,false);
  f.mode.mutateObservations=null;const replay=await new NormalStartPolling(opts).run(f.signal);
  assert.equal(replay.state,'LIMIT_REACHED');assert.equal(replay.cursor.afterSequence,f.item.sequence);
  assert.equal(f.effects.create,1);assert.equal(f.effects.inputs.length,1);assert.equal(f.effects.iterate,1);
 }finally{f.authority.abort();await f.h.close();}
});
