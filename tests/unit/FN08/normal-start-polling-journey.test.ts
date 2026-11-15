import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {randomUUID,randomBytes} from 'node:crypto';
import {preparedExecution,httpsFixture} from './normal-start-execution-fixture.ts';
import {NormalStartCoordinator} from '../../../apps/connector/runtime/normal-start-coordinator.ts';
import {NormalStartPolling} from '../../../apps/connector/runtime/normal-start-polling.ts';
import {NormalProtectedGetClient} from '../../../apps/connector/runtime/normal-protected-get-client.ts';
import {NormalProtectedPostClient} from '../../../apps/connector/runtime/normal-protected-post-client.ts';
function options(f:Awaited<ReturnType<typeof preparedExecution>>){
 return {clients:{get:f.get,post:f.post,expiresAt:f.h.credentialExpiresAt},start:f.startPorts(),owner:()=> 'RAM-owner',
  deadline:f.clock()+50000,maxPages:1,idleMs:1};
}
test('hasMore page는 idle 없이 원 sequence/cursor 쌍으로 다음 빈 page를 조회한다',async()=>{
 const f=await preparedExecution(Infinity,false),timer=globalThis.setTimeout;let idleCalls=0,pages=0;
 try{
  const send=f.get.send.bind(f.get),prepare=f.get.prepareCommandPage.bind(f.get),inputs:any[]=[];
  f.get.prepareCommandPage=async(input,signal)=>{inputs.push({...input});return prepare(input,signal);};
  f.get.send=async(packet,signal)=>{const value:any=await (send as any)(packet,signal);return packet.kind==='COMMANDS'&&++pages===1?{...value,hasMore:true}:value;};
  // 실제 GET/codec 결과 뒤 controller의 hasMore 분기만 주입한다.
  globalThis.setTimeout=((fn:any,ms:any,...args:any[])=>{if(ms===3000)idleCalls++;return timer(fn,ms,...args);}) as typeof setTimeout;
  const r=await new NormalStartPolling({...options(f),maxPages:2,idleMs:3000}).run(f.signal);
  assert.equal(r.state,'LIMIT_REACHED');assert.equal(r.pages,2);assert.equal(r.commands,1);assert.equal(idleCalls,0);
  assert.equal(inputs[0].afterSequence,0);assert.equal(inputs[0].afterCursor,undefined);
  assert.equal(inputs[1].afterSequence,r.cursor.afterSequence);assert.ok(inputs[1].afterCursor);
  assert.equal(f.mode.wires,1);
 }finally{globalThis.setTimeout=timer;await f.h.app.close();}
});
test('실제 제품 polling→자료→내구 START→permit/wire1→ACK, 재시작/갱신도 wire 추가0',async()=>{
 const f=await preparedExecution(5000,false),h=f.h;
 try{
  assert.equal(f.fs.files.size,0);let renewals=0;
  const p=new NormalStartPolling({...options(f),renew:async()=>{
   renewals++;const request={...h.exchangeRequest,requestId:randomUUID(),clientNonce:randomBytes(32).toString('base64url'),issuedAt:h.store.now().toISOString()};
   const c=await h.newChallenge(request),reply=await h.exchange(h.auth(c));assert.equal(reply.statusCode,200);
   const v=reply.json(),http=httpsFixture({...h,token:v.credential,credentialExpiresAt:v.expiresAt,credentialRef:v.receiptRef});
   return {get:new NormalProtectedGetClient(http.options,http.ports),post:new NormalProtectedPostClient(http.options,http.ports),expiresAt:v.expiresAt};
  }});
  const first=await p.run(f.signal);assert.equal(first.state,'LIMIT_REACHED');assert.equal(first.commands,1);
  assert.equal(f.mode.wires,1);assert.equal(f.q.permits.length,1);assert.equal(f.q.observations.length,5);assert.equal(f.q.acks.length,1);
  assert.ok(first.cursor.afterSequence>0);assert.ok(first.cursor.afterCursor);
  const replay=await new NormalStartPolling(options(f)).run(f.signal);assert.equal(replay.state,'LIMIT_REACHED');
  assert.equal(f.mode.wires,1);assert.equal(f.q.permits.length,1);
  h.store.mode.offset+=5000;assert.equal((await p.run(f.signal)).state,'NEEDS_RENEWAL');assert.equal(renewals,0);
  await p.renew(f.signal);assert.equal(renewals,1);const next=await p.run(f.signal);
  assert.equal(next.state,'LIMIT_REACHED');assert.equal(next.commands,1);assert.notEqual(next.cursor.afterCursor,first.cursor.afterCursor);
  assert.equal(f.mode.wires,1);assert.equal(f.q.permits.length,1);assert.equal(f.q.observations.length,5);
 }finally{await h.app.close();}
});
test('자료 중간 실패와 UNKNOWN wire는 cursor를 건너뛰지 않고 새 요청으로 치유하지 않는다',async()=>{
 for(const mode of ['MATERIAL','WIRE']){
  const f=await preparedExecution(Infinity,false);try{
   if(mode==='MATERIAL')f.http.mode.alter=(path,value)=>path.includes('/materials/')?{...value,bytes:'invalid'}:value;
   else f.mode.wireHook=async()=>{throw Error('RAM wire 불명');};
   const p=new NormalStartPolling(options(f)),r=await p.run(f.signal);
   assert.equal(r.state,'UNKNOWN');assert.equal(r.cursor.afterSequence,0);assert.equal(r.cursor.afterCursor,undefined);
   assert.equal(f.mode.wires,mode==='WIRE'?1:0);const calls=f.http.calls.length;
   assert.equal((await p.run(f.signal)).state,'UNKNOWN');assert.equal(f.http.calls.length,calls);
   await assert.rejects(()=>p.renew(f.signal),/UNKNOWN/);
   if(mode==='WIRE'){
    assert.equal(f.q.observations.at(-1).snapshot_json.event.type,'UNKNOWN');
    assert.equal((await new NormalStartPolling(options(f)).run(f.signal)).state,'UNKNOWN');assert.equal(f.mode.wires,1);
   }
  }finally{await f.h.app.close();}
 }
});
test('wire 뒤 여유 부족의 pending 관측은 명시 갱신의 새 POST로 ACK하고 cursor를 확정한다',async()=>{
 const f=await preparedExecution(5000,false),h=f.h;try{
  f.mode.wireHook=async()=>{h.store.mode.offset+=4500;};let nextRef:any,newCalls:any[]=[];
  const p=new NormalStartPolling({...options(f),renew:async()=>{
   const c=await h.newChallenge({...h.exchangeRequest,requestId:randomUUID(),clientNonce:randomBytes(32).toString('base64url'),issuedAt:h.store.now().toISOString()});
   const reply=await h.exchange(h.auth(c));assert.equal(reply.statusCode,200);const v=reply.json();nextRef=v.receiptRef;
   const http=httpsFixture({...h,token:v.credential,credentialExpiresAt:v.expiresAt,credentialRef:v.receiptRef});newCalls=http.calls;
   return {get:new NormalProtectedGetClient(http.options,http.ports),post:new NormalProtectedPostClient(http.options,http.ports),expiresAt:v.expiresAt};
  }});
  const first=await p.run(f.signal);assert.equal(first.state,'NEEDS_RENEWAL');assert.equal(first.cursor.afterSequence,0);
  assert.equal(f.mode.wires,1);assert.equal(f.q.observations.length,0);assert.equal(f.q.acks.length,0);
  await assert.rejects(()=>p.renew(f.signal),/NOT_EXPIRED/);h.store.mode.offset+=500;await p.renew(f.signal);
  const result=await p.run(f.signal);assert.equal(result.state,'LIMIT_REACHED');assert.equal(f.mode.wires,1);assert.equal(f.q.permits.length,1);
  assert.equal(f.q.observations.length,5);assert.equal(f.q.acks.length,1);
  assert.equal(newCalls.filter(v=>v.method==='POST'&&v.path.endsWith('/observations')).length,1);
  const receipt=h.store.receipts().find(v=>v.snapshot_json.kind==='NORMAL_OBSERVATIONS');assert.ok(receipt);
  assert.deepEqual(receipt.snapshot_json.credentialRef,nextRef);assert.equal(result.commands,1);
 }finally{await h.app.close();}
});
test('부분 page fault injection은 첫 durable 처리 뒤 둘째 실패에서도 cursor0과 재시작 wire1을 보존한다',async()=>{
 const f=await preparedExecution(Infinity,false);try{
  // controller의 중간 실패 경계만 주입한다. 실제 서버가 중복 START page를 만들었다는 증거가 아니다.
  const original=f.get.send.bind(f.get);
  f.get.send=async(packet:any,signal:AbortSignal)=>{
   const value:any=await original(packet,signal);
   if(packet.kind!=='COMMANDS')return value;
   const second=structuredClone(value.items[0]);
   second.sequence+=10;second.materials.manifestRef.id=randomUUID();
   second.materialsDescriptorHash=contentHash(canonicalJson(second.materials));
   return {...value,items:[value.items[0],second],hasMore:true};
  };
  const result=await new NormalStartPolling(options(f)).run(f.signal);
  assert.equal(result.state,'UNKNOWN');assert.equal(result.commands,1);assert.equal(result.cursor.afterSequence,0);
  assert.equal(f.mode.wires,1);assert.equal(f.q.permits.length,1);assert.equal(f.q.acks.length,1);
  f.get.send=original;const replay=await new NormalStartPolling(options(f)).run(f.signal);
  assert.equal(replay.state,'LIMIT_REACHED');assert.equal(f.mode.wires,1);assert.equal(f.q.permits.length,1);
 }finally{await f.h.app.close();}
});
test('서버 관측 저장 뒤 ACK 응답 유실: 자료 GET이 차단돼도 원 START 관측을 복구한다',async()=>{
 const f=await preparedExecution(Infinity,false);try{
  let lost=0;
  f.http.mode.alter=(path,value)=>{
   if(path.endsWith('/observations')){lost++;throw Error('서버 저장 뒤 ACK 응답 유실');}
   return value;
  };
  const first=await new NormalStartPolling(options(f)).run(f.signal);
  assert.equal(first.state,'UNKNOWN');assert.equal(first.cursor.afterSequence,0);assert.equal(lost,1);
  assert.equal(f.q.acks.length,1);assert.equal(f.mode.wires,1);assert.equal(f.q.permits.length,1);
  const events=structuredClone(f.q.observations.map(r=>r.snapshot_json.event)),pending=await f.startPorts().spool.coverage();
  assert.equal(events.length,5);assert.equal(pending.covered,false);assert.ok(pending.ref);
  const before=f.http.calls.length;const currents=f.mode.currents;
  f.http.mode.alter=(path,value)=>{if(path.includes('/materials/'))throw Error('자료 접근 거절');return value;};
  const replay=await new NormalStartPolling(options(f)).run(f.signal);
  assert.equal(replay.state,'LIMIT_REACHED');assert.equal(replay.commands,1);assert.ok(replay.cursor.afterSequence>0);assert.ok(replay.cursor.afterCursor);
  const calls=f.http.calls.slice(before);
  assert.equal(calls.filter(c=>c.path.includes('/materials/')).length,0);
  assert.equal(calls.filter(c=>c.method==='POST'&&c.path.endsWith('/observations')).length,1);
  assert.equal(f.mode.currents,currents);assert.equal(f.mode.wires,1);assert.equal(f.q.permits.length,1);
  assert.deepEqual(f.q.observations.map(r=>r.snapshot_json.event),events);
  assert.equal((await f.startPorts().spool.coverage(pending.ref)).covered,true);
 }finally{await f.h.app.close();}
});
test('완전 수신과 정상 부분 수신만 있는 첫 START는 각각 기존 원문 검산 후 한 번 실행한다',async()=>{
 for(const partial of [false,true]){
  const f=await preparedExecution();try{
   const intake=[...f.fs.files.keys()].filter(p=>p.includes('intake-')&&p.endsWith('.json')).sort();
   const kept=Buffer.from(f.fs.files.get(intake[0]!)!.bytes);
   if(partial){assert.equal(JSON.parse(f.fs.files.get(intake.at(-1)!)!.bytes.toString()).entry.snapshot.kind,'RECEIVED');f.fs.files.delete(intake.at(-1)!);}
   const before=f.http.calls.length;
   const result=await new NormalStartPolling(options(f)).run(f.signal);
   assert.equal(result.state,'LIMIT_REACHED');assert.equal(result.commands,1);assert.ok(result.cursor.afterSequence>0);
   assert.equal(f.mode.wires,1);assert.equal(f.q.permits.length,1);assert.ok(f.mode.currents>0);
   assert.equal(f.http.calls.slice(before).filter(c=>c.path.includes('/materials/')).length,partial?intake.length-1:0);
   assert.deepEqual(f.fs.files.get(intake[0]!)!.bytes,kept);
  }finally{await f.h.app.close();}
 }
});
test('시도 이력이 있는데 수신이 없거나 불완전·손상·다른 fullref이면 새 호출 없이 UNKNOWN을 보존한다',async()=>{
 for(const fault of ['missing','partial','corrupt','other-received-id']){
  const f=await preparedExecution();try{
   const run=await f.make().coordinator.start(f.e,f.signal);assert.equal(run.state,'RESPONSE_RECORDED');
   const intake=[...f.fs.files.keys()].filter(p=>p.includes('intake-')&&p.endsWith('.json')).sort();
   const terminal=f.fs.files.get(intake.at(-1)!)!;
   if(fault==='missing'){for(const path of intake)f.fs.files.delete(path);}
   else if(fault==='partial')f.fs.files.delete(intake.at(-1)!);
   else if(fault==='corrupt'){
    const first=f.fs.files.get(intake[0]!)!,record=JSON.parse(first.bytes.toString());record.bytes='eA';first.bytes=Buffer.from(canonicalJson(record)+'\n');
   }else{
    const record=JSON.parse(terminal.bytes.toString()),original=structuredClone(record.entry.ref);record.entry.ref.id=randomUUID();terminal.bytes=Buffer.from(canonicalJson(record)+'\n');
    f.intake.receivedForPage=async()=>original; // 외부 메서드 교체로 원장 검산을 가장할 수 없다.
   }
   const before=f.http.calls.length,currents=f.mode.currents,local=await f.startPorts().spool.batch();
   const result=await new NormalStartPolling(options(f)).run(f.signal);
   assert.equal(result.state,'UNKNOWN',fault);assert.equal(result.commands,0);assert.deepEqual(result.cursor,{afterSequence:0});
   assert.equal(f.http.calls.slice(before).filter(c=>/\/materials\/|\/observations$|\/permits$/.test(c.path)).length,0);
   assert.deepEqual(await f.startPorts().spool.batch(),local);assert.equal(f.q.observations.length,0);
   assert.equal(f.mode.currents,currents);assert.equal(f.q.permits.length,1);assert.equal(f.mode.wires,1);
  }finally{await f.h.app.close();}
 }
});
test('이전 RESPONSE가 있어도 만료되거나 회수된 credential은 관측 POST와 cursor를 열지 않는다',async()=>{
 for(const fault of ['expiry','revocation']){
  const f=await preparedExecution(5000);try{
   assert.equal((await f.make().coordinator.start(f.e,f.signal)).state,'RESPONSE_RECORDED');
   const before=f.http.calls.length;
   if(fault==='expiry')f.h.store.mode.offset+=5000;else f.h.store.mode.revoked=true;
   const result=await new NormalStartPolling(options(f)).run(f.signal);
   assert.equal(result.state,fault==='expiry'?'NEEDS_RENEWAL':'UNKNOWN');
   assert.deepEqual(result.cursor,{afterSequence:0});assert.equal(result.commands,0);
   assert.equal(f.http.calls.slice(before).filter(c=>c.path.includes('/materials/')||c.path.endsWith('/observations')).length,0);
   assert.equal(f.q.acks.length,0);assert.equal(f.mode.wires,1);assert.equal(f.q.permits.length,1);
  }finally{await f.h.app.close();}
 }
});
test('완전 수신과 PERMIT_RECORDED에서 중단된 원 시도는 UNKNOWN 관측을 ACK해도 cursor를 유지한다',async()=>{
 const f=await preparedExecution();try{
  const channel='attempt-'+f.e.commandId,exclusive=f.store.exclusive.bind(f.store),ports=f.startPorts();
  const coordinator=new NormalStartCoordinator({...ports,post:f.post,store:{
   transport:'NORMAL_PROTECTED',exclusive:(name,body)=>exclusive(name,tx=>body({...tx,appendAndSync(value){
    if(name===channel&&(value as {snapshot:{state:string}}).snapshot.state==='UNKNOWN')throw Error('UNKNOWN 쓰기 진입 전 합성 거절');
    return tx.appendAndSync(value);
   }}))
  }});
  f.mode.currentHook=async()=>{if(f.mode.currents===2)throw Error('permit 내구화 이후 현재성 거절');};
  assert.equal((await coordinator.start(f.e,f.signal)).state,'UNKNOWN');
  const states=()=>exclusive(channel,async tx=>(await tx.read()).map(v=>(v as {snapshot:{state:string}}).snapshot.state));
  assert.deepEqual(await states(),['START_ATTEMPTED','PERMIT_RECORDED']);
  assert.equal(f.q.permits.length,1);assert.equal(f.mode.wires,0);
  const before=f.http.calls.length,currents=f.mode.currents;
  const replay=await new NormalStartPolling(options(f)).run(f.signal);
  assert.equal(replay.state,'UNKNOWN');assert.equal(replay.commands,0);assert.deepEqual(replay.cursor,{afterSequence:0});
  assert.deepEqual(await states(),['START_ATTEMPTED','PERMIT_RECORDED','UNKNOWN']);
  assert.equal(f.http.calls.slice(before).filter(c=>c.path.includes('/materials/')||c.path.endsWith('/permit')).length,0);
  assert.equal(f.mode.currents,currents);assert.equal(f.q.permits.length,1);assert.equal(f.mode.wires,0);
  assert.equal(f.q.observations.at(-1).snapshot_json.event.type,'UNKNOWN');assert.equal(f.q.acks.length,1);
  const coverage=await f.startPorts().spool.coverage();assert.ok(coverage.ref);assert.equal(coverage.covered,true);
 }finally{await f.h.app.close();}
});

test('원 worker START 준비 인수는 네 필수 관측 ACK 뒤에만 cursor를 진행한다',async()=>{
 const f=await preparedExecution(Infinity,false);
 try{
  const {NormalClaudeStartWire}=await import('../../../apps/connector/adapters/secondary/normal-start-wire.ts');
  const start=f.startPorts(),wire=NormalClaudeStartWire.forWorker({intake:start.intake,current:start.current,grantRef:start.grantRef,clock:start.clock,timeoutMs:start.timeoutMs});
  const result=await new NormalStartPolling({...options(f),start:{...start,wire}}).run(f.signal);
  assert.equal(result.state,'LIMIT_REACHED');assert.equal(result.commands,1);assert.ok(result.cursor.afterSequence>0);
  assert.deepEqual(f.q.observations.map(row=>row.snapshot_json.event.type),['RECEIVED','PREPARED','START_ATTEMPTED','PERMIT_RECORDED']);
  assert.equal(f.q.acks.at(-1)?.snapshot_json.highestContiguous,4);
  const rows=[...f.fs.files].filter(([key])=>key.includes('attempt-')&&key.endsWith('.json')).map(([,v])=>JSON.parse(v.bytes.toString()));
  assert.deepEqual(rows.map(row=>row.snapshot.state),['START_ATTEMPTED','PERMIT_RECORDED','START_READY_RECORDED']);
  assert.equal(rows[2].snapshot.responseRef,null);assert.equal(rows[2].snapshot.processRef,null);
  const before=f.http.calls.filter(x=>x.path.includes('/materials/')).length;
  const replay=await new NormalStartPolling(options(f)).run(f.signal);
  assert.equal(replay.state,'LIMIT_REACHED');assert.deepEqual(replay.cursor,result.cursor);
  assert.equal(f.mode.wires,0);assert.equal(f.q.permits.length,1);
  assert.equal(f.http.calls.filter(x=>x.path.includes('/materials/')).length,before);assert.equal(f.q.observations.length,4);
 }finally{await f.h.app.close();}
});

test('준비 permit 사건이 201번째이면 첫 200 ACK와 마지막 ACK 응답 유실에서 cursor 0을 보존한다',async()=>{
 const f=await preparedExecution();try{
  const {NormalClaudeStartWire}=await import('../../../apps/connector/adapters/secondary/normal-start-wire.ts');
  const p=f.startPorts();
  for(let i=0;i<197;i++)await p.spool.record({type:'HEARTBEAT',commandId:f.e.commandId,envelopeHash:f.e.envelopeHash,
   localRecordRef:{id:randomUUID(),version:1,contentHash:'c'.repeat(64)},processRef:null,occurredAt:new Date(f.clock()).toISOString(),reasonCode:'NONE'});
  const owner=NormalClaudeStartWire.forWorker({intake:f.intake,current:p.current,grantRef:f.grantRef,clock:f.clock,timeoutMs:1000});
  let posts=0;
  f.http.mode.alter=(path,value)=>{if(path.endsWith('/observations')&&++posts===2)throw Error('두 번째 저장 완료 후 ACK 응답 유실');return value;};
  const first=await new NormalStartPolling({...options(f),start:{...p,wire:owner}}).run(f.signal);
  assert.equal(first.state,'UNKNOWN');assert.equal(first.commands,0);assert.equal(first.cursor.afterSequence,0);
  assert.equal(posts,2);assert.deepEqual(f.q.acks.map(v=>v.snapshot_json.highestContiguous),[200,201]);
  const local=await p.spool.coverage();assert.equal(local.highestContiguous,200);assert.equal(local.sequence,201);assert.equal(local.covered,false);
  assert.equal(f.q.observations[200].snapshot_json.event.type,'PERMIT_RECORDED');
  const savedEvents=f.q.observations.map(row=>row.snapshot_json.event.eventId),currents=f.mode.currents,count=f.http.calls.length;
  f.http.mode.alter=(path,value)=>{if(path.includes('/materials/'))throw Error('과거 자료 접근 거절');return value;};
  const replay=await new NormalStartPolling(options(f)).run(f.signal);
  assert.equal(replay.state,'LIMIT_REACHED');assert.equal(replay.commands,1);assert.ok(replay.cursor.afterSequence>0);
  assert.ok(local.ref);assert.equal((await p.spool.coverage(local.ref)).covered,true);
  assert.deepEqual(f.q.observations.map(row=>row.snapshot_json.event.eventId),savedEvents);
  assert.equal(f.mode.currents,currents);assert.equal(f.mode.wires,0);assert.equal(f.q.permits.length,1);
  assert.equal(f.http.calls.slice(count).filter(v=>v.path.includes('/materials/')).length,0);
 }finally{await f.h.app.close();}
});
