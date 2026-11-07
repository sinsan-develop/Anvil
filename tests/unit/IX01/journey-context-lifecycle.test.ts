import test from 'node:test';
import assert from 'node:assert/strict';
import {registerJourneyClose,closeJourneyContext,type JourneyOwnedResource} from '../../integration/IX01/journey-context-lifecycle.ts';
const deferred=()=>{let resolve!:()=>void;const promise=new Promise<void>(done=>{resolve=done;});return{promise,resolve};};
const flush=async()=>{for(let n=0;n<6;n++)await Promise.resolve();};

test('정착 중에는 다음 pool/문맥을 만들지 않고 app 뒤 pool 종료를 관측한다',async()=>{
 const owned:JourneyOwnedResource[]=[],app=deferred(),pool=deferred(),events:string[]=[];let created=0;
 const closeApp=registerJourneyClose(owned,'app',()=>{events.push('app');return app.promise;}),closePool=registerJourneyClose(owned,'pool',()=>{events.push('pool');return pool.promise;});
 const task=closeJourneyContext({closeApp,closePool},()=>{events.push('fresh');}).then(()=>{created++;});
 try{await flush();assert.deepEqual(events,['fresh','app']);assert.equal(created,0);app.resolve();await flush();assert.deepEqual(events,['fresh','app','fresh','pool']);assert.equal(created,0);pool.resolve();await task;assert.deepEqual(events,['fresh','app','fresh','pool','fresh']);assert.equal(created,1);}
 finally{app.resolve();pool.resolve();await task;await Promise.allSettled(owned.map(r=>r.close()));}
});

test('명시 종료와 finally는 같은 promise를 기다리고 sync throw도 재호출하지 않는다',async()=>{
 const owned:JourneyOwnedResource[]=[];let appCalls=0,poolCalls=0;
 const closeApp=registerJourneyClose(owned,'app',async()=>{appCalls++;}),closePool=registerJourneyClose(owned,'pool',async()=>{poolCalls++;});
 assert.equal(closeApp(),closeApp());await closeJourneyContext({closeApp,closePool},()=>{});await Promise.allSettled(owned.map(r=>r.close()));assert.equal(appCalls,1);assert.equal(poolCalls,1);
 const failure=Error('SYNTHETIC_CLOSE');let calls=0;const rejected=registerJourneyClose(owned,'throw',()=>{calls++;throw failure;});const first=rejected();assert.equal(first,rejected());await assert.rejects(first,e=>e===failure);await assert.rejects(rejected(),e=>e===failure);assert.equal(calls,1);
});

test('app/pool 거절은 새 문맥 생성을 막고 다른 소유 자원 회수는 계속 관측한다',async()=>{
 for(const phase of ['app','pool']as const){const owned:JourneyOwnedResource[]=[],events:string[]=[];let created=0;const failure=Error('SYNTHETIC_'+phase);
 const closeApp=registerJourneyClose(owned,'app',async()=>{events.push('app');if(phase==='app')throw failure;}),closePool=registerJourneyClose(owned,'pool',async()=>{events.push('pool');if(phase==='pool')throw failure;});registerJourneyClose(owned,'admin',async()=>{events.push('admin');});
 await assert.rejects(closeJourneyContext({closeApp,closePool},()=>{}).then(()=>{created++;}),e=>e===failure);assert.equal(created,0);if(phase==='app')assert.deepEqual(events,['app']);
 const cleanup=await Promise.allSettled([...owned].reverse().map(r=>r.close()));assert.equal(cleanup.filter(r=>r.status==='rejected').length,1);assert.equal(events.filter(x=>x==='app').length,1);assert.equal(events.filter(x=>x==='pool').length,1);assert.equal(events.filter(x=>x==='admin').length,1);
 }
});

test('초기와 각 await 뒤 만료는 pool/다음 문맥 생성을 해당 경계에서 막는다',async()=>{
 for(const expireAt of [1,2,3]){const owned:JourneyOwnedResource[]=[];let checks=0,apps=0,pools=0,created=0;const closeApp=registerJourneyClose(owned,'app',async()=>{apps++;}),closePool=registerJourneyClose(owned,'pool',async()=>{pools++;});
 await assert.rejects(closeJourneyContext({closeApp,closePool},()=>{if(++checks===expireAt)throw Error('SYNTHETIC_EXPIRED');}).then(()=>{created++;}),/SYNTHETIC_EXPIRED/);assert.equal(created,0);assert.equal(apps,expireAt===1?0:1);assert.equal(pools,expireAt===3?1:0);await Promise.allSettled(owned.map(r=>r.close()));assert.equal(apps,1);assert.equal(pools,1);
 }
});

test('부분 factory 실패와 old/new 인스턴스는 직접 캡처한 각 자원만 한 번 회수한다',async()=>{
 const owned:JourneyOwnedResource[]=[],counts=new Map<string,number>();
 const factory=(id:string,fail:boolean)=>{const raw={id,end:async()=>{counts.set(id,(counts.get(id)??0)+1);}};const closePool=registerJourneyClose(owned,id+'Pool',()=>raw.end());if(fail)throw Error('SYNTHETIC_FACTORY');const app={close:async()=>{counts.set(id+'App',(counts.get(id+'App')??0)+1);}};return{closePool,closeApp:registerJourneyClose(owned,id+'App',()=>app.close())};};
 const old=factory('old',false);await closeJourneyContext(old,()=>{});const next=factory('new',false);await closeJourneyContext(next,()=>{});assert.throws(()=>factory('partial',true),/SYNTHETIC_FACTORY/);await Promise.allSettled([...owned].reverse().map(r=>r.close()));assert.deepEqual(Object.fromEntries(counts),{oldApp:1,old:1,newApp:1,new:1,partial:1});
});
