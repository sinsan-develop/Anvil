import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {stopFixture} from './normal-stop-coordinator.test.ts';
import {ramJournal} from './normal-start-local-fixture.ts';
const {NormalStartPolling}=await import('../../../apps/connector/runtime/normal-start-polling.ts');
const {NormalObservationSpool}=await import('../../../apps/connector/runtime/normal-observation-spool.ts');
const {canonicalJson,contentHash}=await import('../../../contracts/canonical.ts');
const hash=(v:unknown)=>contentHash(canonicalJson(v));
function stopTransport(f:Pick<Awaited<ReturnType<typeof stopFixture>>,'scope'|'clock'> & {stopItem:unknown}){
 let reads=0,posts=0,through=0,digest=hash([]);const batches:any[]=[];const aid=randomUUID();
 const get={async prepareCommandPage(v:any){return v;},async send(){reads++;return{items:[f.stopItem],nextCursor:'ram-stop-page',hasMore:false};}};
 let beforePost=async(_n:number)=>{};
 const post={async prepareObservations(body:any){return body;},async send(body:any){await beforePost(posts+1);posts++;batches.push(structuredClone(body));for(const e of body.events){assert.equal(e.sequence,++through);digest=hash({previous:digest,eventHash:hash(e)});}
  const snapshot={execution:f.scope,highestContiguous:through,maxSequence:through,contiguousDigest:digest,gaps:[],storedCount:through,writerReleaseVerified:false,executionAuthorized:false,dispatchPerformed:false,recordedAt:new Date(f.clock()).toISOString()};return{executionAuthorized:false,ack:{ref:{id:aid,version:posts,contentHash:hash(snapshot)},snapshot}};
 }};
 return{get,post,batches,posts:()=>posts,reads:()=>reads,before:(fn:typeof beforePost)=>{beforePost=fn;}};
}
/** STOP 원장/page/ACK는 RAM 역사 형상. 실제 STOP 생산자/normal owner/서버 수용 성공의 증거가 아니다. */
async function setup(count=2,padding=0){
 const f=await stopFixture(),rows=await f.seed(count),journal=ramJournal(),spool=new NormalObservationSpool(journal,f.scope,f.clock);
 for(let i=0;i<padding;i++)await spool.record({type:'HEARTBEAT',commandId:f.e.commandId,envelopeHash:f.e.envelopeHash,localRecordRef:{id:randomUUID(),version:1,contentHash:'a'.repeat(64)},processRef:null,occurredAt:new Date(f.clock()).toISOString(),reasonCode:'NONE'});
 const wire=stopTransport(f),{get,post}=wire;
 const options=()=>({clients:{get,post,expiresAt:new Date(f.clock()+30000).toISOString()} as any,start:{...f.startPorts(),spool},stop:f.ports(),owner:()=> 'RAM-local-owner',deadline:f.clock()+30000,maxPages:1,idleMs:1});
 return{f,rows,journal,spool,...wire,options};
}
test('원 START 수신+RAM STOP 역사→제품 polling/spool ACK; 재시작 추가 시도/driver0이고 cursor0',async()=>{
 const x=await setup();try{const a=await new NormalStartPolling(x.options()).run(x.f.signal);assert.equal(a.state,'UNKNOWN');assert.equal(a.reason,'STOP_UNCONFIRMED');assert.equal(a.commands,0);assert.equal(a.cursor.afterSequence,0);assert.equal(x.posts(),1);assert.equal(x.batches[0].events.length,2);
  const ids=x.batches[0].events.map((e:any)=>e.eventId),b=await new NormalStartPolling(x.options()).run(x.f.signal);assert.equal(b.reason,'STOP_UNCONFIRMED');assert.equal(x.posts(),1);assert.equal(x.f.mode.wires,0);assert.deepEqual((await x.spool.batch()).events.map((e:any)=>e.eventId),ids);
 }finally{await x.f.h.app.close();}
});
test('STOP 원 관측이 두 번째 200건 batch 뒤에 있어도 전체 ACK 전후 cursor는 유지된다',async()=>{
 const x=await setup(2,200);try{let release!:()=>void,entered!:()=>void;const ready=new Promise<void>(r=>{entered=r;});x.before(async n=>{if(n===2){entered();await new Promise<void>(r=>{release=r;});}});
  let done=false;const run=new NormalStartPolling(x.options()).run(x.f.signal).then(v=>{done=true;return v;});await ready;assert.equal(done,false);assert.equal(x.posts(),1);assert.equal((await x.spool.coverage()).covered,false);assert.equal(x.batches[0].events.some((e:any)=>e.commandId===x.f.stopItem.envelope.commandId),false);release();
  const value=await run;assert.equal(value.cursor.afterSequence,0);assert.equal(value.reason,'STOP_UNCONFIRMED');assert.equal(x.posts(),2);assert.deepEqual(x.batches[1].events.map((e:any)=>e.localRecordRef),x.rows.map(r=>r.ref));assert.equal((await x.spool.coverage()).covered,true);
 }finally{await x.f.h.app.close();}
});
test('부분 STOP 역사 POST 사전 실패/불명은 UNKNOWN·원행 보존이며 새 polling도 interrupt/새 시도0',async()=>{
 const x=await setup(1);try{x.before(async()=>{throw Error('RAM_POST_UNKNOWN');});const a=await new NormalStartPolling(x.options()).run(x.f.signal);assert.equal(a.state,'UNKNOWN');assert.equal(a.cursor.afterSequence,0);assert.equal(x.posts(),0);
  x.before(async()=>{});const b=await new NormalStartPolling(x.options()).run(x.f.signal);assert.equal(b.state,'UNKNOWN');assert.equal(b.cursor.afterSequence,0);assert.equal(x.batches[0].events[0].reasonCode,'RECORD_UNCERTAIN');const rows=await x.f.store.exclusive('attempt-'+x.f.stopItem.envelope.commandId,tx=>tx.read());assert.deepEqual(rows,x.rows);assert.equal(x.f.mode.wires,0);
 }finally{await x.f.h.app.close();}
});


test('live STOP의 둘째 batch ACK 유실 뒤 같은 관측만 재전달하고 interrupt·cursor를 늘리지 않는다',async()=>{
 const {liveStopFixture}=await import('../FN07/normal-first-send-owner.test.ts'),f=await liveStopFixture();
 try{
  assert.equal((await f.run()).state,'LIMIT_REACHED');
  const spool=new NormalObservationSpool(ramJournal(),f.localScope,f.clock),wire=stopTransport({scope:f.localScope,clock:f.clock,stopItem:f.stopItem});
  for(let i=0;i<200;i++)await spool.record({type:'HEARTBEAT',commandId:f.page.items[0]!.envelope.commandId,envelopeHash:f.page.items[0]!.envelope.envelopeHash,
   localRecordRef:{id:randomUUID(),version:1,contentHash:'a'.repeat(64)},processRef:null,occurredAt:new Date(f.clock()).toISOString(),reasonCode:'NONE'});
  let lost:Awaited<ReturnType<typeof wire.post.send>>|undefined,bodyHash:string|undefined,replays=0;
  const post={...wire.post,async send(body:any){if(lost&&hash(body)===bodyHash){replays++;return lost;}
   const result=await wire.post.send(body);if(wire.posts()===2){lost=result;bodyHash=hash(body);throw Error('RAM_ACK_REPLY_LOST');}return result;}};
  const options=()=>({...f.options(),clients:{get:wire.get,post,expiresAt:f.options().clients.expiresAt} as any,start:{...f.options().start,spool},stop:f.stopPorts()});
  const first=await new NormalStartPolling(options()).run(f.signal);
  assert.equal(first.state,'UNKNOWN');assert.equal(first.cursor.afterSequence,0);assert.equal(f.stopCalls.interrupt,1);assert.equal(wire.posts(),2);
  assert.equal(wire.batches[0].events.length,200);assert.deepEqual(wire.batches[1].events.map((e:any)=>e.type),['STOP_UNCONFIRMED','STOP_REQUESTED','STOP_UNCONFIRMED']);
  assert.equal((await spool.coverage()).covered,false);
  const replay=await new NormalStartPolling(options()).run(f.signal);assert.equal(replay.reason,'STOP_UNCONFIRMED');assert.equal(replay.cursor.afterSequence,0);
  assert.equal((await spool.coverage()).covered,true);assert.equal(replays,1);assert.equal(f.stopCalls.interrupt,1);assert.equal(f.effects.close,0);assert.equal(f.effects.create,1);
 }finally{f.authority.abort();await f.h.close();}
});

test('STOP 두 행 정착 뒤 spool 쓰기 전 중단돼도 원 요청 시각과 첫 참조를 재시작에서 복구한다',async()=>{
 const {liveStopFixture}=await import('../FN07/normal-first-send-owner.test.ts');
 const {NormalStopCoordinator}=await import('../../../apps/connector/runtime/normal-stop-coordinator.ts');
 const f=await liveStopFixture(),journal=ramJournal(),wire=stopTransport({scope:f.localScope,clock:f.clock,stopItem:f.stopItem});
 try{
  assert.equal((await f.run()).state,'LIMIT_REACHED');
  let interruptAt=0;
  f.stopHooks.interrupt=async()=>{interruptAt=f.clock();f.mode.wall+=37;};
  const interruptedStore={transport:'NORMAL_PROTECTED' as const,async exclusive(channel:string){
   assert.equal(channel,'observations');throw Error('RAM_RESTART_BEFORE_SPOOL_LOCK');
  }};
  const firstSpool=new NormalObservationSpool(interruptedStore,f.localScope,f.clock);
  await assert.rejects(new NormalStopCoordinator(f.stopPorts()).recordObservations(f.stopItem,firstSpool,f.signal,f.worker),/RAM_RESTART_BEFORE_SPOOL_LOCK/);
  const rows=await f.stopRows();
  assert.equal(rows.length,2);assert.equal(f.stopCalls.interrupt,1);
  const restartedSpool=new NormalObservationSpool(journal,f.localScope,f.clock);
  assert.deepEqual((await restartedSpool.batch()).events,[]);
  const options=()=>({...f.options(),clients:{get:wire.get,post:wire.post,expiresAt:f.options().clients.expiresAt} as any,
   start:{...f.options().start,spool:restartedSpool},stop:f.stopPorts()});
  let release!:()=>void,entered!:()=>void;
  const beforeAck=new Promise<void>(resolve=>{entered=resolve;});
  wire.before(()=>{entered();return new Promise<void>(resolve=>{release=resolve;});});
  const run=new NormalStartPolling(options()).run(f.signal);
  await Promise.race([beforeAck,run.then(()=>assert.fail('복구 관측을 ACK 포트로 전달하지 못함'))]);
  const observed=(await restartedSpool.batch()).events;
  const coverage=(await restartedSpool.coverage()).covered;
  release();
  const result=await run;
  assert.equal(coverage,false);assert.equal(result.cursor.afterSequence,0);assert.equal(result.reason,'STOP_UNCONFIRMED');
  assert.deepEqual(observed.map(e=>e.type),['STOP_UNCONFIRMED','STOP_REQUESTED','STOP_UNCONFIRMED']);
  const requested=observed[1]!;
  assert.deepEqual(requested.localRecordRef,rows[0].ref);
  assert.equal(requested.occurredAt,rows[1].snapshot.requestedAt);
  assert(Date.parse(requested.occurredAt)<=interruptAt);
  assert(Date.parse(rows[1].snapshot.recordedAt)-Date.parse(requested.occurredAt)>=37);
  const replay=await new NormalStartPolling(options()).run(f.signal);
  assert.equal(replay.cursor.afterSequence,0);assert.equal(wire.posts(),1);
  assert.deepEqual((await restartedSpool.batch()).events,observed);
  assert.equal(f.stopCalls.interrupt,1);assert.equal(f.effects.close,0);assert.equal(f.effects.create,1);
 }finally{f.authority.abort();await f.h.close();}
});

test('live STOP 페이지는 scope가 다른 정상 spool에서 interrupt와 관측 POST를 실행하지 않는다',async()=>{
 const {liveStopFixture}=await import('../FN07/normal-first-send-owner.test.ts'),f=await liveStopFixture();
 try{
  assert.equal((await f.run()).state,'LIMIT_REACHED');
  const journal=ramJournal(),wrong={...f.localScope,executionGeneration:f.localScope.executionGeneration+1};
  const spool=new NormalObservationSpool(journal,wrong,f.clock),wire=stopTransport({scope:wrong,clock:f.clock,stopItem:f.stopItem});
  const base=f.options(),poll=new NormalStartPolling({...base,start:{...base.start,spool},stop:f.stopPorts(),
   clients:{get:wire.get,post:wire.post,expiresAt:base.clients.expiresAt} as any});
  const result=await poll.run(f.signal);
  assert.equal(result.state,'UNKNOWN');assert.equal(result.cursor.afterSequence,0);assert.equal(wire.reads(),1);
  assert.equal(f.stopCalls.interrupt,0);assert.equal(wire.posts(),0);assert.equal(journal.data.size,0);assert.deepEqual(await f.stopRows(),[]);
  await poll.run(f.signal);assert.equal(wire.reads(),1);assert.equal(f.stopCalls.interrupt,0);
 }finally{f.authority.abort();await f.h.close();}
});
