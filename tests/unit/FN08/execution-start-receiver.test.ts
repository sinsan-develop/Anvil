import assert from 'node:assert/strict';
import test from 'node:test';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {SyntheticExecutionObservations} from '../../../apps/server/modules/executions/execution-observations.ts';
const m:any=await import('../../../apps/connector/runtime/execution-start-receiver.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const id='11111111-1111-4111-8111-111111111111',ref={id,version:1,contentHash:'a'.repeat(64)},now=Date.parse('2026-10-19T12:00:00.000Z');
function envelope(){const context={projectId:id,assignmentId:id,executionId:id,executionGeneration:1,connectionRef:ref,environmentRef:ref,authorizationReceiptRef:ref,capabilityRef:ref,budgetRef:ref,sourceScopes:[{sourceRootRef:ref,mappingRef:null,observationRef:ref,baselineRef:ref,targets:[{relativePath:'src/a.ts',kind:'FILE',access:'READ',recursive:false}]}]};const unsigned={schemaVersion:1,commandId:id,issuedAt:new Date(now-1000).toISOString(),expiresAt:new Date(now+30000).toISOString(),executorRegistrationRef:ref,context,operation:'START_SESSION',payload:{contextBundleRef:ref,optionsRef:ref}};return{...unsigned,envelopeHash:contentHash(canonicalJson(unsigned))};}
function harness(){
 let events:any[]=[],complete=true,failState='',clock=now,consumes=0,sends=0;const order:string[]=[];
 // 합성 port: appendAndSync 성공은 fake durable 배열에 즉시 보존되며 callback 예외로 되돌리지 않는다.
 let tail=Promise.resolve();const store={transport:'SYNTHETIC_ONLY',exclusive:async(_scope:any,fn:any)=>{const prior=tail;let release!:()=>void;tail=new Promise(r=>{release=r;});await prior;try{return await fn({read:async()=>({complete,events:structuredClone(events)}),appendAndSync:async(e:any)=>{order.push(e.snapshot.state);if(e.snapshot.state===failState){complete=false;throw Error('PRIVATE_TOKEN_STORAGE_FAILURE');}events.push(structuredClone(e));}});}finally{release();}}};
 const e=envelope(),expected={context:structuredClone(e.context),executorRegistrationRef:ref,grantRef:ref};
 const authority:any={transport:'SYNTHETIC_ONLY',consume:async(value:any)=>{order.push('CONSUME');consumes++;return{transport:'SYNTHETIC_ONLY',key:{projectId:id,executionId:id,executionGeneration:1,commandId:value.commandId},envelopeHash:value.envelopeHash,grantRef:ref,permitRef:ref,checkedAt:new Date(clock).toISOString(),expiresAt:new Date(clock+1000).toISOString()};}};
 const wire:any={transport:'SYNTHETIC_ONLY',send:async()=>{order.push('WIRE');sends++;return{transport:'SYNTHETIC_ONLY',responseRef:ref};}};
 const make=()=>{assert.equal(typeof m.SyntheticStartReceiver,'function');return new m.SyntheticStartReceiver(store,authority,wire,expected,()=>clock);};
 return{e,expected,store,authority,wire,make,order,get events(){return events;},get consumes(){return consumes;},get sends(){return sends;},set failState(s:string){failState=s;},set clock(n:number){clock=n;},corrupt:()=>{events[0].snapshot.envelopeHash='f'.repeat(64);}};
}
test('수신과 시작시도를 sync한 뒤에만 합성 permit/전송하며 같은 key는 재시작해도 다시 보내지 않는다',async()=>{
 const h=harness(),receiver=h.make();const received=await receiver.receive(h.e);assert.equal(received.state,'RECEIVED');assert.equal(h.sends,0);
 const result=await receiver.start(h.e);assert.equal(result.state,'RESPONSE_RECORDED');assert.deepEqual(h.order,['RECEIVED','START_ATTEMPTED','CONSUME','PERMIT_RECORDED','WIRE','RESPONSE_RECORDED']);assert.equal(result.dispatchPerformed,false);assert.equal(result.executionAuthorized,false);
 assert.deepEqual(await h.make().start(h.e),result);assert.equal(h.sends,1);assert.equal(h.consumes,1);
});
test('응답 유실은 UNKNOWN이며 같은 명령과 새 commandId 모두 자동 재시작하지 않는다',async()=>{
 const h=harness(),r=h.make();await r.receive(h.e);h.wire.send=async()=>{h.order.push('WIRE');throw Error('PRIVATE_TOKEN_RESPONSE_LOST');};
 const unknown=await r.start(h.e);assert.equal(unknown.state,'UNKNOWN');assert.equal(JSON.stringify(unknown).includes('PRIVATE_TOKEN'),false);
 const count=h.order.length;assert.deepEqual(await h.make().start(h.e),unknown);assert.equal(h.order.length,count);
 const {envelopeHash:_,...unsigned}=h.e,newUnsigned={...unsigned,commandId:'22222222-2222-4222-8222-222222222222'};await assert.rejects(h.make().receive({...newUnsigned,envelopeHash:contentHash(canonicalJson(newUnsigned))}),/START_RECORD_CONFLICT/);
});
test('시작시도 sync 실패는 wire0·permit0이고 불완전 저장을 재생성하지 않는다',async()=>{
 const h=harness(),r=h.make();await r.receive(h.e);h.failState='START_ATTEMPTED';assert.equal((await r.start(h.e)).state,'UNKNOWN');assert.equal(h.sends,0);assert.equal(h.consumes,0);
 await assert.rejects(h.make().start(h.e),/START_LEDGER_INCOMPLETE/);assert.equal(h.sends,0);
});
test('전송후 결과 sync 실패와 남은 START_ATTEMPTED는 새 인스턴스에서도 UNKNOWN이다',async()=>{
 const h=harness(),r=h.make();await r.receive(h.e);h.failState='RESPONSE_RECORDED';assert.equal((await r.start(h.e)).state,'UNKNOWN');assert.equal(h.sends,1);await assert.rejects(h.make().start(h.e),/START_LEDGER_INCOMPLETE/);assert.equal(h.sends,1);
 const k=harness(),x=k.make();await x.receive(k.e);k.authority.consume=async()=>{throw Error('PERMIT_RESPONSE_LOST');};assert.equal((await x.start(k.e)).state,'UNKNOWN');assert.equal(k.sends,0);assert.equal((await k.make().start(k.e)).state,'UNKNOWN');
});
test('다른 세대·내용·만료 permit/비합성 provider는 전송하지 않으며 변조 journal도 거절한다',async()=>{
 for(const patch of [{transport:'REAL'},{envelopeHash:'f'.repeat(64)},{key:{projectId:id,executionId:id,executionGeneration:2,commandId:id}},{expiresAt:new Date(now).toISOString()},{checkedAt:new Date(now-30001).toISOString()}]){
  const h=harness(),r=h.make(),consume=h.authority.consume;await r.receive(h.e);h.authority.consume=async(e:any)=>({...await consume(e),...patch});assert.equal((await r.start(h.e)).state,'UNKNOWN');assert.equal(h.sends,0);
 }
 const h=harness(),r=h.make();await r.receive(h.e);h.corrupt();await assert.rejects(h.make().start(h.e),/START_LEDGER_INVALID/);assert.equal(h.sends,0);
 const k=harness();k.wire.transport='REAL';assert.throws(k.make,/SYNTHETIC_START_PORTS_REQUIRED/);
});
test('동시 같은 시작은 하나만 소비·전송하며 예상 binding이 다르면 수신도 저장하지 않는다',async()=>{
 const h=harness(),r=h.make();await r.receive(h.e);const result=await Promise.all([r.start(h.e),h.make().start(h.e)]);assert.deepEqual(result[0],result[1]);assert.equal(h.sends,1);assert.equal(h.consumes,1);
 const k=harness();k.expected.context.executionGeneration=2;await assert.rejects(k.make().receive(k.e),/START_CONTEXT_MISMATCH/);assert.equal(k.events.length,0);
});
test('journal 잠금을 기다리는 동안 기한이 지나면 permit 소비 전 거절한다',async()=>{
 const h=harness(),r=h.make();await r.receive(h.e);const original=h.store.exclusive;
 h.store.exclusive=async(scope:any,fn:any)=>{h.clock=now+30001;return original(scope,fn);};
 await assert.rejects(r.start(h.e),/ENVELOPE_EXPIRED/);assert.equal(h.events.length,1);assert.equal(h.consumes,0);assert.equal(h.sends,0);
});
test('START_ATTEMPTED sync 중 만료되면 기록은 남기고 permit을 소비하지 않는다',async()=>{
 const h=harness(),r=h.make();await r.receive(h.e);const original=h.store.exclusive;
 h.store.exclusive=(scope:any,fn:any)=>original(scope,(tx:any)=>fn({...tx,appendAndSync:async(e:any)=>{await tx.appendAndSync(e);if(e.snapshot.state==='START_ATTEMPTED')h.clock=now+30001;}}));
 assert.equal((await r.start(h.e)).state,'UNKNOWN');assert.equal(h.consumes,0);assert.equal(h.sends,0);assert.equal(h.events[1].snapshot.state,'START_ATTEMPTED');
});
test('소비한 permitRef의 내구 기록이 실패하면 wire는 호출하지 않는다',async()=>{
 const h=harness(),r=h.make();await r.receive(h.e);h.failState='PERMIT_RECORDED';assert.equal((await r.start(h.e)).state,'UNKNOWN');assert.equal(h.consumes,1);assert.equal(h.sends,0);
});
test('store lock/read/release 오류는 고정 오류만 노출한다',async()=>{
 for(const point of ['lock','read','release']){
  const h=harness(),r=h.make(),original=h.store.exclusive;
  h.store.exclusive=async(scope:any,fn:any)=>{if(point==='lock')throw Error('PRIVATE_TOKEN_LOCK_FAILURE');const result=await original(scope,(tx:any)=>fn(point==='read'?{...tx,read:async()=>{throw Error('PRIVATE_TOKEN_READ_FAILURE');}}:tx));if(point==='release')throw Error('PRIVATE_TOKEN_RELEASE_FAILURE');return result;};
  await assert.rejects(r.receive(h.e),(e:Error)=>e.message==='START_STORAGE_UNAVAILABLE'&&!e.message.includes('PRIVATE_TOKEN'));
 }
});
test('permit TTL은 checkedAt+30초 및 원 봉투의 기한을 넘지 못한다',async()=>{
 for(const shorter of [false,true]){
  const h=harness();if(shorter){const {envelopeHash:_,...unsigned}=h.e;unsigned.expiresAt=new Date(now+20000).toISOString();Object.assign(h.e,unsigned,{envelopeHash:contentHash(canonicalJson(unsigned))});}
  const r=h.make(),consume=h.authority.consume;await r.receive(h.e);h.authority.consume=async(e:any)=>({...await consume(e),checkedAt:new Date(now-1000).toISOString(),expiresAt:new Date(now+(shorter?25000:30000)).toISOString()});
  assert.equal((await r.start(h.e)).state,'UNKNOWN');assert.equal(h.sends,0);
 }
});
test('서버 permit 요청에는 sync 완료한 정확 START_ATTEMPTED ref를 전달한다',async()=>{
 const h=harness(),r=h.make(),consume=h.authority.consume;await r.receive(h.e);
 h.authority.consume=async(e:any,localAttemptRef:any)=>{assert.deepEqual(localAttemptRef,h.events[1].ref);return consume(e);};
 assert.equal((await r.start(h.e)).state,'RESPONSE_RECORDED');assert.equal(h.sends,1);
});
test('내구 local ref를 비밀 없는 관측 batch로 연결하고 응답 기록을 STARTED로 승격하지 않는다',async()=>{
 const h=harness(),r=h.make();await r.receive(h.e);await r.start(h.e);const packet=await r.observationBatch(h.e);
 assert.deepEqual(packet.events.map((e:any)=>e.type),['RECEIVED','START_ATTEMPTED','PERMIT_RECORDED','PROVIDER_RESPONSE_RECEIVED']);assert.equal(packet.events.some((e:any)=>e.type==='STARTED'),false);assert.deepEqual(packet.events.map((e:any)=>e.localRecordRef),h.events.map(e=>e.ref));
 let stored:any[]=[],ack:any=null;const server:any={transport:'SYNTHETIC_ONLY',transaction:async(s:any,body:any)=>body({clock:async()=>new Date(now).toISOString(),current:async()=>({transport:'SYNTHETIC_ONLY',scope:s,operation:'SYNC_OBSERVATIONS',authorityRef:ref,checkedAt:new Date(now).toISOString(),expiresAt:new Date(now+1000).toISOString()}),read:async()=>({complete:true,events:structuredClone(stored),ack:structuredClone(ack)}),append:async(e:any)=>{stored.push(structuredClone(e));},saveAck:async(a:any)=>{ack=structuredClone(a);}})};
 const scope={mode:'EXECUTION',projectId:id,connectorId:id,executionId:id,executionGeneration:1,grantRef:ref,credentialGeneration:1},result=await new SyntheticExecutionObservations(server).ingest(scope,packet);
 assert.equal(result.snapshot.highestContiguous,4);assert.equal(result.snapshot.writerReleaseVerified,false);assert.deepEqual(await new SyntheticExecutionObservations(server).ingest(scope,await r.observationBatch(h.e)),result);assert.equal(stored.length,4);assert.equal(h.sends,1);
});
test('만료 봉투의 기존 UNKNOWN 관측도 조회할 수 있지만 새 permit/wire를 호출하지 않는다',async()=>{
 const h=harness(),r=h.make();await r.receive(h.e);h.wire.send=async()=>{throw Error('PRIVATE_TOKEN_RESPONSE_LOST');};await r.start(h.e);
 const first=await r.observationBatch(h.e),count=h.order.length;h.clock=now+30001;assert.deepEqual(await h.make().observationBatch(h.e),first);assert.equal(h.order.length,count);assert.equal(first.events.at(-1).type,'UNKNOWN');assert.equal(JSON.stringify(first).includes('PRIVATE_TOKEN'),false);await assert.rejects(h.make().start(h.e),/ENVELOPE_EXPIRED/);
});
