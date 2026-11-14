import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {stopFixture} from './normal-stop-coordinator.test.ts';
import {ramJournal} from './normal-start-local-fixture.ts';
const {NormalStartPolling}=await import('../../../apps/connector/runtime/normal-start-polling.ts');
const {NormalObservationSpool}=await import('../../../apps/connector/runtime/normal-observation-spool.ts');
const {canonicalJson,contentHash}=await import('../../../contracts/canonical.ts');
const hash=(v:unknown)=>contentHash(canonicalJson(v));
/** STOP 원장/page/ACK는 RAM 역사 형상. 실제 STOP 생산자/normal owner/서버 수용 성공의 증거가 아니다. */
async function setup(count=2,padding=0){
 const f=await stopFixture(),rows=await f.seed(count),journal=ramJournal(),spool=new NormalObservationSpool(journal,f.scope,f.clock);let reads=0,posts=0,through=0,digest=hash([]);const batches:any[]=[];const aid=randomUUID();
 for(let i=0;i<padding;i++)await spool.record({type:'HEARTBEAT',commandId:f.e.commandId,envelopeHash:f.e.envelopeHash,localRecordRef:{id:randomUUID(),version:1,contentHash:'a'.repeat(64)},processRef:null,occurredAt:new Date(f.clock()).toISOString(),reasonCode:'NONE'});
 const get={async prepareCommandPage(v:any){return v;},async send(){reads++;return{items:[f.stopItem],nextCursor:'ram-stop-page',hasMore:false};}};
 let beforePost=async(_n:number)=>{};
 const post={async prepareObservations(body:any){return body;},async send(body:any){await beforePost(posts+1);posts++;batches.push(structuredClone(body));for(const e of body.events){assert.equal(e.sequence,++through);digest=hash({previous:digest,eventHash:hash(e)});}
  const snapshot={execution:f.scope,highestContiguous:through,maxSequence:through,contiguousDigest:digest,gaps:[],storedCount:through,writerReleaseVerified:false,executionAuthorized:false,dispatchPerformed:false,recordedAt:new Date(f.clock()).toISOString()};return{executionAuthorized:false,ack:{ref:{id:aid,version:posts,contentHash:hash(snapshot)},snapshot}};
 }};
 const options=()=>({clients:{get,post,expiresAt:new Date(f.clock()+30000).toISOString()} as any,start:{...f.startPorts(),spool},stop:f.ports(),owner:()=> 'RAM-local-owner',deadline:f.clock()+30000,maxPages:1,idleMs:1});
 return{f,rows,journal,spool,batches,options,posts:()=>posts,reads:()=>reads,before:(fn:typeof beforePost)=>{beforePost=fn;}};
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
