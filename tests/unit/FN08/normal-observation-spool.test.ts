import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {ramJournal,scope,id} from './normal-start-local-fixture.ts';
const m=await import('../../../apps/connector/runtime/normal-observation-spool.ts');
const hash=(v:unknown)=>contentHash(canonicalJson(v)),ref={id,version:1,contentHash:'a'.repeat(64)},now=Date.parse('2026-11-14T00:00:00Z');
const event=(command=id)=>({type:'RECEIVED',commandId:command,envelopeHash:'a'.repeat(64),localRecordRef:{...ref,id:randomUUID()},processRef:null,occurredAt:new Date(now).toISOString(),reasonCode:'NONE'});
test('관측은 명령이 달라도 실행/세대 전체 순번이며 정확 batch hash로 저장한다',async()=>{
 const j=ramJournal(),s=new m.NormalObservationSpool(j,scope,()=>now);
 await s.record(event());await s.record(event(randomUUID()));const b=await s.batch();
 assert.deepEqual(b.events.map((e:any)=>e.sequence),[1,2]);assert.equal(b.batchHash,hash(b.events));assert.equal(Object.keys(b.events[0]).length,12);
});
test('ACK full hash·prefix digest·gaps/count를 검산하고 과거 ACK로 후퇴하지 않는다',async()=>{
 const j=ramJournal(),s=new m.NormalObservationSpool(j,scope,()=>now);await s.record(event());const b=await s.batch();
 const snap={execution:scope,highestContiguous:1,maxSequence:1,contiguousDigest:hash({previous:hash([]),eventHash:hash(b.events[0])}),gaps:[],storedCount:1,
 writerReleaseVerified:false,executionAuthorized:false,dispatchPerformed:false,recordedAt:new Date(now).toISOString()};
 const ack={ref:{id:randomUUID(),version:1,contentHash:hash(snap)},snapshot:snap};
 await s.acceptAck(ack);await s.record(event(randomUUID()));
 const newer={...snap,highestContiguous:2,maxSequence:2,storedCount:2,contiguousDigest:hash({previous:snap.contiguousDigest,eventHash:hash((await s.batch()).events[1])})};
 const a2={ref:{id:ack.ref.id,version:2,contentHash:hash(newer)},snapshot:newer};await s.acceptAck(a2);await s.acceptAck(ack);
 assert.deepEqual(await s.latestAck(),a2);assert.equal(j.data.get('acks')!.length,2);
 for(const change of [{contiguousDigest:'b'.repeat(64)},{storedCount:0},{gaps:[{from:1,to:1}]},{maxSequence:3},{highestContiguous:0,storedCount:0,gaps:[{from:1,to:1}],contiguousDigest:hash([])}]){
  const bad={...snap,...change};await assert.rejects(s.acceptAck({ref:{id:randomUUID(),version:1,contentHash:hash(bad)},snapshot:bad}));
 }
});
test('빈 저장 ACK를 maxSequence1/gap끝1로 위장하면 거절한다',async()=>{
 const now=Date.parse('2026-11-14T00:00:00Z'),hash=(x:unknown)=>contentHash(canonicalJson(x)),ref={id,version:1,contentHash:'a'.repeat(64)};
 const spool=new m.NormalObservationSpool(ramJournal(),scope,()=>now);
 await spool.record({type:'RECEIVED',commandId:id,envelopeHash:'a'.repeat(64),localRecordRef:ref,processRef:null,occurredAt:new Date(now).toISOString(),reasonCode:'NONE'});
 const snapshot={execution:scope,highestContiguous:0,maxSequence:1,contiguousDigest:hash([]),gaps:[{from:1,to:1}],storedCount:0,writerReleaseVerified:false,executionAuthorized:false,dispatchPerformed:false,recordedAt:new Date(now).toISOString()};
 await assert.rejects(spool.acceptAck({ref:{...ref,contentHash:hash(snapshot)},snapshot}));
});
test('ACK 저장 집합은 신규에서 줄지 않고 과거 ACK는 최신 저장 집합의 부분집합이어야 한다',async()=>{
 const j=ramJournal(),s=new m.NormalObservationSpool(j,scope,()=>now);for(let i=0;i<4;i++)await s.record(event(randomUUID()));
 const events=(await s.batch()).events,aid=randomUUID();let one=hash([]),all=one;
 for(const [i,e] of events.entries()){all=hash({previous:all,eventHash:hash(e)});if(i===0)one=all;}
 const snap=(maxSequence:number,gaps:{from:number;to:number}[],storedCount:number,highestContiguous=1)=>({execution:scope,highestContiguous,maxSequence,
  contiguousDigest:highestContiguous===4?all:one,gaps,storedCount,writerReleaseVerified:false,executionAuthorized:false,dispatchPerformed:false,recordedAt:new Date(now).toISOString()});
 const ack=(version:number,snapshot:any)=>({ref:{id:aid,version,contentHash:hash(snapshot)},snapshot});
 const a=ack(1,snap(3,[{from:2,to:2}],2)),bad=ack(2,snap(4,[{from:2,to:3}],2)),good=ack(2,snap(4,[],4,4));
 await s.acceptAck(a);await assert.rejects(s.acceptAck(bad));assert.deepEqual(await s.latestAck(),a);
 await s.acceptAck(good);await s.acceptAck(a);assert.deepEqual(await s.latestAck(),good);
 const j2=ramJournal();j2.data.set('observations',structuredClone(j.data.get('observations')!));
 const s2=new m.NormalObservationSpool(j2,scope,()=>now);await s2.acceptAck(bad);
 await assert.rejects(s2.acceptAck(a));assert.deepEqual(await s2.latestAck(),bad);
});


test('sync 한 번의 200건 ACK는 원 201번째 ref coverage가 아니며 다음 한 번만 나머지를 보낸다',async()=>{
 const j=ramJournal(),s=new m.NormalObservationSpool(j,scope,()=>now);let last:any;
 for(let i=0;i<201;i++)last=await s.record(event());
 const fixed=await s.coverage(last);assert.equal(fixed.sequence,201);assert.equal(fixed.covered,false);
 const all=[...(await s.batch()).events,...(await s.batch(200)).events],aid=randomUUID();let calls=0,digest=hash([]),through=0;
 const client={async prepareObservations(body:any){return body;},async send(body:any){calls++;assert.equal(body.events.length,calls===1?200:1);
  for(const e of body.events){assert.equal(e.sequence,++through);digest=hash({previous:digest,eventHash:hash(e)});}
  const snapshot={execution:scope,highestContiguous:through,maxSequence:through,contiguousDigest:digest,gaps:[],storedCount:through,writerReleaseVerified:false,executionAuthorized:false,dispatchPerformed:false,recordedAt:new Date(now).toISOString()};
  return{executionAuthorized:false,ack:{ref:{id:aid,version:calls,contentHash:hash(snapshot)},snapshot}};
 }};
 await s.sync(client as any,new AbortController().signal);assert.equal(calls,1);assert.equal((await s.coverage(last)).covered,false);
 await s.sync(client as any,new AbortController().signal);assert.equal(calls,2);assert.equal((await s.coverage(last)).covered,true);assert.equal(all.length,201);
 await assert.rejects(s.coverage({...last,contentHash:'b'.repeat(64)}));
});


test('coverage의 getter/proxy ref는 실행하지 않고 거절한다',async()=>{
 const s=new m.NormalObservationSpool(ramJournal(),scope,()=>now);let reads=0;
 await assert.rejects(s.coverage(Object.defineProperty({...ref},'id',{enumerable:true,get(){reads++;return id;}})));
 await assert.rejects(s.coverage(new Proxy({...ref},{getPrototypeOf(){reads++;return Object.prototype;}})));
 assert.equal(reads,0);
});
