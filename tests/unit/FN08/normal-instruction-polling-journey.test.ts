import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {normalInstructionPollingFixture} from './normal-instruction-dispatch-fixture.ts';

test('원 START/SEND 혼합 page에서 내구 관측 ACK 이후 cursor를 확정한다',async()=>{
 const f=await normalInstructionPollingFixture();try{
  const r=await f.poll().run(f.signal);assert.equal(r.state,'LIMIT_REACHED',JSON.stringify({r,effects:f.effects,observations:f.h.observations.length}));assert.equal(r.commands,2);assert.equal(r.cursor.afterSequence,f.item.sequence);
  assert.deepEqual(f.effects,{start:1,send:1,sendFail:false});assert.equal(f.h.startPermits.length,1);assert.equal(f.h.permits.length,1);
  assert.equal(f.h.observations.length,9);const ack=await f.spool.latestAck();assert.ok(ack);assert.equal(ack.snapshot.highestContiguous,9);
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
  const recoverOpen=f.fs.fs.open;
  let sendHistory=false,supplemented=false,earlyAckReads=0;
  f.fs.fs.open=async(path:string,flag:string)=>{
   if(path.includes('attempt-'+f.item.envelope.commandId+'.')&&path.endsWith('.json'))sendHistory=true;
   if(sendHistory&&!supplemented&&/acks\.\d+\.json$/.test(path))earlyAckReads++;
   if(flag==='wx'&&path.endsWith('observations.000008.json')){assert.equal(sendHistory,true);supplemented=true;}
   return recoverOpen(path,flag);
  };
  const second=await f.poll().run(f.signal);assert.equal(second.state,'LIMIT_REACHED');assert.equal(second.cursor.afterSequence,f.item.sequence);assert.equal(f.effects.send,1);assert.equal(f.effects.start,1);
  assert.equal(supplemented,true);assert.equal(earlyAckReads,0,'과거 SEND는 원 관측을 보충한 뒤 기존 ACK를 검산한다');
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

test('별도 원문 후속 SEND는 같은 Query에 한 번 yield하고 세 관측 ACK로 이력을 복구한다',async()=>{
 const {firstSendFixture}=await import('../FN07/normal-first-send-owner.test.ts');
 const messages:any[]=[],f=await firstSendFixture('yield-first',{async provide(_query,input){for await(const message of input)messages.push(message);}});
 try{
  const first=await f.run();assert.equal(first.state,'LIMIT_REACHED',JSON.stringify(first));
  const second=await f.h.queueFollowup('서로 다른 두 번째 지시 🙂');
  const next=await f.run();assert.equal(next.state,'LIMIT_REACHED',JSON.stringify({next,status:f.calls.slice(-6).map(c=>[c.path.split('/').at(-1),c.status]),permit:f.h.permits.length}));
  assert.deepEqual(messages.map(m=>m.message.content),['서로 다른 두 번째 지시 🙂']);
  const rows=[...f.fs.files.entries()].filter(([p])=>p.includes('attempt-'+second.commandId)&&p.endsWith('.json')).sort().map(([,v])=>JSON.parse(v.bytes.toString()));
  assert.equal(rows.length,4);assert.equal(rows[3].snapshot.state,'LIVE_SEND_INPUT_YIELDED');
  assert.equal(rows[3].snapshot.firstSendKey.commandId,f.item.envelope.commandId);
  assert.deepEqual(rows[3].snapshot.inputEvidence.instructionRef,second.plan.instructionRef);
  assert.deepEqual(f.h.observations.filter(v=>v.snapshot_json.event.commandId===second.commandId).map(v=>v.snapshot_json.event.type),['RECEIVED','PREPARED','PERMIT_RECORDED']);
  assert.equal((await f.run()).state,'LIMIT_REACHED');assert.equal(messages.length,1);assert.equal(f.effects.create,1);assert.equal(f.effects.iterate,1);
 }finally{f.authority.abort();await f.h.close();}
});

test('후속 SEND의 201번째 permit 관측은 첫 200 ACK와 구분하고 마지막 ACK 유실 뒤 같은 기록을 복구한다',async()=>{
 const {firstSendFixture}=await import('../FN07/normal-first-send-owner.test.ts');
 const {NormalStartPolling}=await import('../../../apps/connector/runtime/normal-start-polling.ts');
 let yields=0,id='',hash='';const f=await firstSendFixture('yield-first',{async provide(_query,input){
  for await(const _ of input)yields++;
  for(let i=0;i<198;i++)await f.spool.record({type:'HEARTBEAT',commandId:id,envelopeHash:hash,localRecordRef:{id:randomUUID(),version:1,contentHash:'c'.repeat(64)},processRef:null,occurredAt:new Date(f.clock()).toISOString(),reasonCode:'NONE'});
 }});
 try{
  const opts=f.options();opts.instruction.timeoutMs=10000;
  assert.equal((await new NormalStartPolling(opts).run(f.signal)).state,'LIMIT_REACHED');
  const second=await f.h.queueFollowup('201번째 필수 관측');id=second.commandId;
  const envelope=f.h.f.tables.execution_commands!.find(c=>c.snapshot_json.request?.commandId===id)!.snapshot_json.envelope;hash=envelope.envelopeHash;
  const before=f.calls.length;f.mode.mutateObservations=()=>{f.mode.loseObservations=true;};
  const interrupted=await new NormalStartPolling(opts).run(f.signal);assert.equal(interrupted.state,'UNKNOWN');assert.equal(interrupted.cursor.afterSequence,0);assert.equal(yields,1);
  const history=await f.make().observations(envelope,f.signal);assert.equal(history.state,'LIVE_SEND_INPUT_YIELDED');const required=history.inputs.at(-1)!.localRecordRef;
  const posts=f.calls.slice(before).filter(c=>c.path.endsWith('/observations')).map(c=>c.body as any);
  assert.deepEqual(posts.map(v=>v.events.length),[200,1]);assert(!posts[0].events.some((e:any)=>e.localRecordRef.id===required.id));
  assert.deepEqual(posts[1].events[0].localRecordRef,required);assert.equal((await f.spool.coverage()).covered,false);
  f.mode.mutateObservations=null;f.mode.loseObservations=false;
  const recovered=await new NormalStartPolling(opts).run(f.signal);assert.equal(recovered.state,'LIMIT_REACHED');assert.equal(yields,1);assert.equal(f.effects.create,1);assert.equal(f.effects.iterate,1);
 }finally{f.authority.abort();await f.h.close();}
});

test('후속 정상 이력은 부모 전체와 현재 자료·등록·init fullref를 역사 재판독한다',async()=>{
 const {firstSendFixture}=await import('../FN07/normal-first-send-owner.test.ts');
 const {prepareLiveFollowup}=await import('./normal-instruction-dispatch-fixture.ts');
 const {canonicalJson,contentHash}=await import('../../../contracts/canonical.ts');
 let yields=0;const f=await firstSendFixture('yield-first',{async provide(_query,input){for await(const _ of input)yields++;}});
 try{
  assert.equal((await f.run()).state,'LIMIT_REACHED');const {item,c,prepared}=await prepareLiveFollowup(f,'다른 자료 검산');
  assert.equal((await c.dispatch(item.envelope,prepared,f.wire,f.signal)).state,'LIVE_SEND_INPUT_YIELDED');
  const path=(id:string,n:number)=>f.fs.path('attempt-'+id+'.'+String(n).padStart(6,'0')+'.json');
  const latest=f.fs.files.get(path(item.envelope.commandId,4))!,original=Buffer.from(latest.bytes);
  const first=JSON.parse(f.fs.files.get(path(f.item.envelope.commandId,4))!.bytes.toString());
  for(const key of ['firstTerminalRef','startReadyRef','initConfirmationRef','registrationRef','instructionRef','instructionDigest']){
   const r=JSON.parse(original.toString());
   if(key==='instructionRef')r.snapshot.inputEvidence.instructionRef=first.snapshot.inputEvidence.instructionRef;
   else if(key==='instructionDigest')r.snapshot.inputEvidence.instructionDigest=first.snapshot.inputEvidence.instructionDigest;
   else r.snapshot[key].contentHash='1'.repeat(64);
   r.ref.contentHash=contentHash(canonicalJson(r.snapshot));latest.bytes=Buffer.from(canonicalJson(r)+'\n');
   await assert.rejects(f.make().history(item,f.signal),key);latest.bytes=Buffer.from(original);
  }
  const t=f.item.envelope.commandId,third=JSON.parse(f.fs.files.get(path(t,3))!.bytes.toString());
  const u={...third.snapshot,sequence:5,state:'UNKNOWN',previousRef:first.ref,dispatchAttemptRef:third.ref,recordedAt:first.snapshot.recordedAt};
  f.fs.files.set(path(t,5),{bytes:Buffer.from(canonicalJson({snapshot:u,ref:{id:randomUUID(),version:1,contentHash:contentHash(canonicalJson(u))}})+'\n'),ino:99999,link:false});
  await assert.rejects(f.make().history(item,f.signal));assert.equal((await f.run()).cursor.afterSequence,0);assert.equal(yields,1);
  const attempts=f.store.instructionAttempts();let forged=0;
  const substituted=f.make({store:{...attempts,exclusive:async(key:any,body:any)=>{
   const r:any=await attempts.exclusive(key,body);
   if(r?.state==='LIVE_SEND_INPUT_YIELDED'){forged++;return{...r,state:'RESPONSE_RECORDED'};}return r;
  }}});
  await assert.rejects(substituted.history(item,f.signal));assert.equal(forged,1);
  f.fs.files.delete(path(t,5));const store=f.store.instructionAttempts(),legacy=f.make({store:{...store,exclusive:(key:any,body:any)=>store.exclusive(key,tx=>body({read:()=>tx.read(),appendAndSync:(v:unknown)=>tx.appendAndSync(v)}))}});
  await assert.rejects(legacy.history(item,f.signal));
 }finally{f.authority.abort();await f.h.close();}
});

for(const mode of ['CORRUPT_ACK_BEFORE_INTAKE','ACK_READ_UNKNOWN_BEFORE_PERMIT'] as const)
test('새 SEND는 손상 또는 읽기 불명 ACK 원장에서 원문·permit·wire·관측을 멈춘다 '+mode,async()=>{
 const {firstSendFixture}=await import('../FN07/normal-first-send-owner.test.ts');
 const {NormalStartPolling}=await import('../../../apps/connector/runtime/normal-start-polling.ts');
 const {receiveNormalInstruction}=await import('../../../apps/connector/runtime/normal-instruction-intake.ts');
 let yields=0;const f=await firstSendFixture('yield-first',{async provide(_query,input){for await(const _ of input)yields++;}});
 try{
  const poll=new NormalStartPolling(f.options()),first=await poll.run(f.signal);
  assert.equal(first.state,'LIMIT_REACHED');assert.equal(first.cursor.afterSequence,f.item.sequence);
  const second=await f.h.queueFollowup('새 지시 원장 gate');
  if(mode==='ACK_READ_UNKNOWN_BEFORE_PERMIT'){
   const page=await f.get.send(await f.get.prepareCommandPage({afterSequence:first.cursor.afterSequence,afterCursor:first.cursor.afterCursor,waitMs:0},f.signal),f.signal);
   assert.equal(page.items.length,1);const item=page.items[0]!;
   assert.ok(item.materials);assert.equal(item.envelope.commandId,second.commandId);
   await receiveNormalInstruction(f.get,f.intake,item,page.proofResultRef,f.signal);
   assert.equal((await f.make().observations(item.envelope,f.signal)).state,'NOT_PREPARED');
  }
  const ack=[...f.fs.files.keys()].find(key=>/acks\.\d+\.json$/.test(key));
  assert.ok(ack,'실제 로컬 ACK 행');
  if(mode==='CORRUPT_ACK_BEFORE_INTAKE')f.fs.files.get(ack)!.bytes=Buffer.from('{"partial":');
  else{
   const open=f.fs.fs.open;
   f.fs.fs.open=async(target:string,flag:string)=>{if(target===ack)throw Object.assign(Error('합성 읽기 불명'),{code:'EACCES'});return open(target,flag);};
  }
  const before=f.calls.length,observations=f.h.observations.length,permits=f.h.permits.length,fsRecords=new Map([...f.fs.files].map(([path,file])=>[path,Buffer.from(file.bytes)]));
  const result=await poll.run(f.signal);
  assert.equal(result.state,'UNKNOWN');assert.equal(result.commands,0);assert.deepEqual(result.cursor,first.cursor);
  assert.deepEqual(f.calls.slice(before).map(c=>c.path.split('/').at(-1)),['challenges','commands']);
  assert.equal(f.h.observations.length,observations);assert.equal(f.h.permits.length,permits);
  const added=[...f.fs.files.keys()].filter(path=>!fsRecords.has(path));
  assert.deepEqual(added,[f.fs.path('acks.lock')],'원 읽기 불명 잠금만 기존 방식대로 보존한다');
  for(const [path,bytes] of fsRecords)assert.deepEqual(f.fs.files.get(path)?.bytes,bytes);
  assert.equal(yields,0);
  assert.deepEqual((await poll.run(f.signal)).cursor,first.cursor);assert.equal(f.calls.length,before+2);
 }finally{f.authority.abort();await f.h.close();}
});

test('ACK가 정상 미완료인 원장은 다음 SEND를 차단하지 않고 해당 page에서 원 순번을 ACK한다',async()=>{
 const {firstSendFixture}=await import('../FN07/normal-first-send-owner.test.ts');
 const {NormalStartPolling}=await import('../../../apps/connector/runtime/normal-start-polling.ts');
 let yields=0;const f=await firstSendFixture('yield-first',{async provide(_query,input){for await(const _ of input)yields++;}});
 try{
  const poll=new NormalStartPolling(f.options()),first=await poll.run(f.signal);assert.equal(first.state,'LIMIT_REACHED');
  await f.spool.record({type:'HEARTBEAT',commandId:f.item.envelope.commandId,envelopeHash:f.item.envelope.envelopeHash,
   localRecordRef:{id:randomUUID(),version:1,contentHash:'c'.repeat(64)},processRef:null,occurredAt:new Date(f.clock()).toISOString(),reasonCode:'NONE'});
  assert.equal((await f.spool.coverage()).covered,false);
  await f.h.queueFollowup('원 순번이 아직 ACK되지 않은 상태의 새 지시');
  const next=await poll.run(f.signal);
  assert.equal(next.state,'LIMIT_REACHED');assert.equal(next.commands,1);assert.ok(next.cursor.afterSequence>first.cursor.afterSequence);
  assert.equal((await f.spool.coverage()).covered,true);assert.equal(yields,1);
 }finally{f.authority.abort();await f.h.close();}
});

test('다른 범위의 정상 spool에서 단독 SEND 페이지는 원문·permit·wire·관측 저장을 시작하지 않는다',async()=>{
 const {firstSendFixture}=await import('../FN07/normal-first-send-owner.test.ts');
 const {NormalStartPolling}=await import('../../../apps/connector/runtime/normal-start-polling.ts');
 const {NormalObservationSpool}=await import('../../../apps/connector/runtime/normal-observation-spool.ts');
 const {ramJournal}=await import('./normal-start-local-fixture.ts');
 let yields=0;const f=await firstSendFixture('yield-first',{async provide(_query,input){for await(const _ of input)yields++;}});
 try{
  const first=await f.run();assert.equal(first.state,'LIMIT_REACHED');assert.ok(first.cursor.afterCursor);
  await f.h.queueFollowup('다른 실행 범위에 저장할 수 없는 지시');
  // 앞 START를 되풀이하지 않도록 기존 확정 cursor의 다음 page만 실제 보호 client로 요청한다.
  const prepare=f.get.prepareCommandPage.bind(f.get);
  f.get.prepareCommandPage=(input,signal)=>prepare({...input,...first.cursor},signal);
  const journal=ramJournal(),wrong={...f.localScope,executionId:randomUUID()},spool=new NormalObservationSpool(journal,wrong,f.clock);
  const opts=f.options(),before=f.calls.length,permits=f.h.permits.length,observations=f.h.observations.length,local=[...f.fs.files.keys()];
  const poll=new NormalStartPolling({...opts,start:{...opts.start,spool}}),result=await poll.run(f.signal);
  assert.deepEqual(f.calls.slice(before).map(c=>c.path.split('/').at(-1)),['challenges','commands']);
  assert.equal(result.state,'UNKNOWN');assert.equal(result.cursor.afterSequence,0);assert.equal(yields,0);
  assert.equal(f.h.permits.length,permits);assert.equal(f.h.observations.length,observations);assert.deepEqual([...f.fs.files.keys()],local);assert.equal(journal.data.size,0);
 }finally{f.authority.abort();await f.h.close();}
});

test('polling은 원 SEND item과 사용할 page proof의 Proxy/접근자를 실행하지 않는다',async()=>{
 const {NormalStartPolling}=await import('../../../apps/connector/runtime/normal-start-polling.ts');
 const f=await normalInstructionPollingFixture();try{
  for(const boundary of ['ITEM_PROXY','ITEM_ACCESSOR','PROOF_PROXY','PROOF_ACCESSOR']){
   let traps=0;
   const trap=()=>{traps++;throw Error('합성 page 접근자 호출');};
   const page={...f.page,items:[{...f.item}],hasMore:false};
   if(boundary==='ITEM_PROXY')page.items[0]=new Proxy(f.item,{get:trap,ownKeys:trap});
   if(boundary==='ITEM_ACCESSOR')Object.defineProperty(page.items[0]!,'sequence',{enumerable:true,get:trap});
   if(boundary==='PROOF_PROXY')page.proofResultRef=new Proxy(f.page.proofResultRef,{get:trap,ownKeys:trap});
   if(boundary==='PROOF_ACCESSOR')Object.defineProperty(page,'proofResultRef',{enumerable:true,get:trap});
   const options=f.options(),calls=f.calls.length;
   const get={prepareCommandPage:async()=>({}),send:async()=>page} as unknown as typeof options.clients.get;
   const result=await new NormalStartPolling({...options,clients:{...options.clients,get}}).run(f.signal);
   assert.equal(result.state,'UNKNOWN',boundary);assert.equal(result.cursor.afterSequence,0,boundary);
   assert.equal(traps,0,boundary);assert.equal(f.calls.length,calls,boundary);
   assert.deepEqual(f.effects,{start:0,send:0,sendFail:false},boundary);
   assert.equal(f.fs.files.size,0,boundary);assert.equal(f.h.permits.length,0,boundary);
  }
 }finally{await f.h.close();}
});
