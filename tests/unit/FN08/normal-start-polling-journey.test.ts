import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {preparedExecution,httpsFixture} from './normal-start-execution-fixture.ts';
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
  const original=f.get.send.bind(f.get);let material=0;
  f.get.send=async(packet:any,signal:AbortSignal)=>{
   const value:any=await original(packet,signal);
   if(packet.kind==='COMMANDS')return {...value,items:[value.items[0],{...value.items[0],sequence:value.items[0].sequence+10}],hasMore:true};
   if(++material>f.item.materials.groups.flatMap((g:any)=>g.parts).length)throw Error('합성 둘째 item 자료 실패');
   return value;
  };
  const result=await new NormalStartPolling(options(f)).run(f.signal);
  assert.equal(result.state,'UNKNOWN');assert.equal(result.commands,1);assert.equal(result.cursor.afterSequence,0);
  assert.equal(f.mode.wires,1);assert.equal(f.q.permits.length,1);assert.equal(f.q.acks.length,1);
  f.get.send=original;const replay=await new NormalStartPolling(options(f)).run(f.signal);
  assert.equal(replay.state,'LIMIT_REACHED');assert.equal(f.mode.wires,1);assert.equal(f.q.permits.length,1);
 }finally{await f.h.app.close();}
});
