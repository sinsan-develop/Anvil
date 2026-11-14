import test from 'node:test';
import assert from 'node:assert/strict';
const {NormalStartPolling}=await import('../../../apps/connector/runtime/normal-start-polling.ts');
function setup(ttl=10000){
 let now=Date.now(),owner='owner-1',calls=0,renewals=0;const inputs:any[]=[];
 const get={async prepareCommandPage(v:any){inputs.push(v);return v;},async send(){calls++;return {items:[],nextCursor:'opaque-empty',hasMore:false};}};
 const post={async prepareObservations(){throw Error('빈 spool');},async send(){throw Error('빈 spool');}},spool={async sync(){return null;}},start={clock:()=>now,spool,timeoutMs:1000} as any;
 const clients={get,post,expiresAt:new Date(now+ttl).toISOString()} as any;
 const p=new NormalStartPolling({clients,start,owner:()=>owner,deadline:now+Math.max(20000,ttl),maxPages:2,idleMs:1,
  renew:async()=>{renewals++;return {...clients,get:{...get},post:{...post},expiresAt:new Date(now+10000).toISOString()} as any;}});
 return{p,inputs,get,start,clients,now:()=>now,advance:(n:number)=>{now+=n;},owner:(v:string)=>{owner=v;},calls:()=>calls,renewals:()=>renewals};
}
test('빈 page는 유한 대기 후 0/no-cursor로 다시 조회하며 자동 갱신하지 않는다',async()=>{
 const f=setup(),r=await f.p.run(new AbortController().signal);
 assert.equal(r.state,'LIMIT_REACHED');assert.equal(r.pages,2);
 assert.deepEqual(f.inputs,[{afterSequence:0,waitMs:0},{afterSequence:0,waitMs:0}]);assert.equal(f.renewals(),0);
});
test('spool 전체 묶음은 개별 POST 10초를 다시 씌우지 않고 원 남은 기한을 사용한다',async()=>{
 const f=setup(30000),timer=globalThis.setTimeout;let latest=0,checked=0;
 globalThis.setTimeout=((fn:any,ms:any,...args:any[])=>{latest=Number(ms);return timer(fn,ms,...args);}) as typeof setTimeout;
 try{
  f.start.spool.sync=async()=>{assert.equal(latest,30000);checked++;return null;};
  const r=await f.p.run(new AbortController().signal);assert.equal(r.state,'LIMIT_REACHED');assert.equal(checked,2);
 }finally{globalThis.setTimeout=timer;}
});
test('만료는 명시 renew까지만 멈추고 새 client와 cursor0으로 전환한다',async()=>{
 const f=setup();f.advance(10000);
 assert.equal((await f.p.run(new AbortController().signal)).state,'NEEDS_RENEWAL');assert.equal(f.calls(),0);assert.equal(f.renewals(),0);
 await f.p.renew(new AbortController().signal);assert.equal(f.renewals(),1);
 assert.equal((await f.p.run(new AbortController().signal)).state,'LIMIT_REACHED');assert.equal(f.inputs[0].afterSequence,0);
});
test('진행 중 두 번째 loop 거절은 첫 loop를 보존하고 owner 변경은 닫힌다',async()=>{
 const f=setup();let release!:()=>void;
 f.get.send=async()=>{await new Promise<void>(r=>{release=r;});return {items:[],nextCursor:'opaque-empty',hasMore:false};};
 const running=f.p.run(new AbortController().signal);await new Promise(r=>setTimeout(r,5));
 await assert.rejects(()=>f.p.run(new AbortController().signal),/BUSY/);
 await assert.rejects(()=>f.p.renew(new AbortController().signal),/BUSY/);
 f.owner('owner-2');release();const result=await running;assert.equal(result.state,'UNKNOWN');assert.equal(result.reason,'OWNER_CHANGED');
 const n=f.inputs.length;assert.equal((await f.p.run(new AbortController().signal)).state,'UNKNOWN');assert.equal(f.inputs.length,n);
});
test('여유 부족은 실제 만료와 구분하고 이미 취소된 갱신은 호출0이다',async()=>{
 const f=setup();f.advance(9500);
 const r=await f.p.run(new AbortController().signal);assert.equal(r.state,'NEEDS_RENEWAL');assert.equal(r.renewalNotBefore,f.clients.expiresAt);assert.equal(f.inputs.length,0);
 await assert.rejects(()=>f.p.renew(new AbortController().signal),/NOT_EXPIRED/);
 f.advance(500);const abort=new AbortController();abort.abort();
 await assert.rejects(()=>f.p.renew(abort.signal),/CANCELLED/);assert.equal(f.renewals(),0);
 await assert.rejects(()=>f.p.renew({} as any),/SIGNAL_REQUIRED/);
});
test('빈 hasMore는 무한 loop로 바꾸지 않고 deadline/idle abort를 구분한다',async()=>{
 const f=setup();f.get.send=async()=>({items:[],nextCursor:'not-progress',hasMore:true});
 const r=await f.p.run(new AbortController().signal);assert.equal(r.state,'UNKNOWN');assert.equal(r.pages,0);assert.equal(f.inputs.length,1);
 const g=setup();g.advance(20000);assert.equal((await g.p.run(new AbortController().signal)).state,'EXPIRED');assert.equal(g.inputs.length,0);
 const h=setup(),signal=new AbortController();signal.abort();assert.equal((await h.p.run(signal.signal)).state,'CANCELLED');assert.equal(h.inputs.length,0);
});
test('abort를 무시한 늦은 GET은 유한 종료하고 cursor 승격·후속 전송하지 않는다',async()=>{
 const f=setup();let release!:(v:any)=>void;f.get.send=()=>new Promise(r=>{release=r;});
 const abort=new AbortController(),run=f.p.run(abort.signal);await new Promise(r=>setTimeout(r,5));abort.abort();
 const r=await run;assert.equal(r.state,'UNKNOWN');assert.equal(r.cursor.afterSequence,0);
 release({items:[],hasMore:false,nextCursor:'late'});await new Promise(r=>setImmediate(r));
 const n=f.inputs.length;await f.p.run(new AbortController().signal);assert.equal(f.inputs.length,n);
});
