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

async function ackHistoryFixture(){
 const journal=ramJournal(),spool=new m.NormalObservationSpool(journal,scope,()=>now),aid=randomUUID();
 let last=ref;
 for(let i=0;i<6;i++)last=await spool.record(event());
 const digests=[hash([])];
 for(const e of (await spool.batch()).events)digests.push(hash({previous:digests.at(-1),eventHash:hash(e)}));
 const ack=(version:number,highestContiguous:number,maxSequence:number,gaps:{from:number;to:number}[]=[],id=aid)=>{
  const snapshot={execution:scope,highestContiguous,maxSequence,gaps,contiguousDigest:digests[highestContiguous],
   storedCount:maxSequence-gaps.reduce((n,g)=>n+g.to-g.from+1,0),recordedAt:new Date(now).toISOString(),
   writerReleaseVerified:false,executionAuthorized:false,dispatchPerformed:false};
  return {ref:{id,version,contentHash:hash(snapshot)},snapshot};
 };
 return{journal,spool,ack,last};
}

test('각 행의 hash가 유효해도 ACK 이력이 역순·교차 계열·범위 축소면 모든 소비 입구에서 실패한다',async()=>{
 for(const mode of ['ORDER','FOREIGN','HIGHEST','SAME_MAX_GAP']){
  const {journal,spool,ack,last}=await ackHistoryFixture();
  const first=mode==='HIGHEST'?ack(1,2,4,[{from:3,to:3}]):ack(1,1,5,[{from:2,to:2},{from:4,to:4}]);
  const second=mode==='ORDER'?ack(3,6,6):mode==='FOREIGN'?ack(3,6,6,[],randomUUID()):
   mode==='HIGHEST'?ack(3,1,6,[{from:2,to:2}]):ack(3,1,5,[{from:2,to:3}]);
  const rows=mode==='ORDER'?[second,first]:[first,second];
  for(const item of rows){
   const standalone=ramJournal();
   standalone.data.set('observations',structuredClone(journal.data.get('observations')!));standalone.data.set('acks',[item]);
   assert.deepEqual(await new m.NormalObservationSpool(standalone,scope,()=>now).latestAck(),item,mode);
  }
  journal.data.set('acks',structuredClone(rows));
  let prepared=0,posted=0;
  const client={async prepareObservations(){prepared++;return{};},async send(){posted++;return{executionAuthorized:false,ack:ack(9,6,6)};}};
  await assert.rejects(spool.latestAck(),/NORMAL_OBSERVATION_INVALID/,mode);
  await assert.rejects(spool.coverage(last),/NORMAL_OBSERVATION_INVALID/,mode);
  await assert.rejects(spool.sync(client as any,new AbortController().signal),/NORMAL_OBSERVATION_INVALID/,mode);
  await assert.rejects(spool.acceptAck(ack(9,6,6)),/NORMAL_OBSERVATION_INVALID/,mode);
  assert.equal(prepared,0,mode);assert.equal(posted,0,mode);assert.deepEqual(journal.data.get('acks'),rows,mode);
 }
});

test('새 버전의 낮은 max는 거절하고 정상 gap 보완과 exact older ACK는 원장 끝을 유지한다',async()=>{
 const {journal,spool,ack}=await ackHistoryFixture();
 const a=ack(2,1,5,[{from:2,to:2},{from:4,to:4}]),b=ack(4,5,5),c=ack(5,6,6);
 await spool.acceptAck(a);
 await assert.rejects(spool.acceptAck(ack(3,1,1)),/NORMAL_OBSERVATION_INVALID/);
 await spool.acceptAck(b);await spool.acceptAck(c);
 assert.deepEqual(await spool.acceptAck(a),c);assert.deepEqual(await spool.acceptAck(b),c);assert.deepEqual(await spool.acceptAck(c),c);
 assert.deepEqual(await spool.acceptAck(ack(1,1,1)),c);
 assert.deepEqual(await spool.acceptAck(ack(3,3,5,[{from:4,to:4}])),c);
 await assert.rejects(spool.acceptAck(ack(4,4,4)),/NORMAL_OBSERVATION_INVALID/);
 await assert.rejects(spool.acceptAck(ack(3,1,1)),/NORMAL_OBSERVATION_INVALID/);
 await assert.rejects(spool.acceptAck(ack(3,6,6)),/NORMAL_OBSERVATION_INVALID/);
 assert.deepEqual(await spool.latestAck(),c);assert.deepEqual(journal.data.get('acks'),[a,b,c]);
});

test('관측과 ACK가 10000행이어도 과거 재확인은 허용하고 새 append는 한도에서 차단한다',async()=>{
 const journal=ramJournal(),aid=randomUUID();
 const observations:unknown[]=[],acks:{ref:typeof ref;snapshot:Record<string,unknown>}[]=[];
 let previousRef:typeof ref|null=null,digest=hash([]);
 for(let sequence=1;sequence<=10000;sequence++){
  const observed={...event(),...scope,sequence,eventId:randomUUID()};
  const body={sequence,event:observed,previousRef};
  const observationRef:typeof ref={id:randomUUID(),version:1,contentHash:hash(body)};
  observations.push({ref:observationRef,snapshot:body});previousRef=observationRef;
  digest=hash({previous:digest,eventHash:hash(observed)});
  const snapshot={execution:scope,highestContiguous:sequence,maxSequence:sequence,contiguousDigest:digest,gaps:[],storedCount:sequence,
   writerReleaseVerified:false,executionAuthorized:false,dispatchPerformed:false,recordedAt:new Date(now).toISOString()};
  acks.push({ref:{id:aid,version:sequence,contentHash:hash(snapshot)},snapshot});
 }
 journal.data.set('observations',observations);journal.data.set('acks',acks);
 let appends=0;
 const spool=new m.NormalObservationSpool({transport:'NORMAL_PROTECTED',exclusive:(channel,work)=>journal.exclusive(channel,tx=>work({...tx,
  appendAndSync:async(value:unknown)=>{appends++;await tx.appendAndSync(value);}
 }))},scope,()=>now);
 const tail=acks.at(-1)!;
 assert.deepEqual(await spool.latestAck(),tail);
 assert.deepEqual(await spool.acceptAck(acks[0]),tail);
 await assert.rejects(spool.acceptAck({...tail,ref:{...tail.ref,version:tail.ref.version+1}}),/NORMAL_OBSERVATION_INVALID/);
 assert.equal(appends,0);assert.equal(journal.data.get('acks')!.length,10000);
});
