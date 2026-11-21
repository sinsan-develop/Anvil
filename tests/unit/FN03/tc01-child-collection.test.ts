import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {collectTc01ChildResult,type Tc01CollectionClock} from '../../../scripts/qa-fn03-tc01-child-collection.ts';
const checked=()=>({status:'CHECKED',stage:'RESULT',code:'JOURNEY_CHECKED',authority:'NOT_ISSUED',fn03:'CHECKED',tc01:'CHECKED',appClosed:true,poolClosed:true,resources:'REMOVED'});
class Child extends EventEmitter {
 stdin=new EventEmitter();stdout=new EventEmitter();effects=0;
 constructor(){super();for(const e of [this,this.stdin,this.stdout])e.on('error',()=>{});}
 kill(){this.effects++;throw Error('FORBIDDEN');}
}
function fixture(){
 const child=new Child(),window={issuedAt:1000,expiresAt:1801000};let wall=1000,mono=20,callback:(()=>void)|undefined,clears=0,sets=0;
 const clock:Tc01CollectionClock={now:()=>wall,monotonic:()=>mono,setTimeout:fn=>{sets++;callback=fn;return 7;},clearTimeout:handle=>{assert.equal(handle,7);clears++;}};
 const start=()=>collectTc01ChildResult(child,window,clock);
 return{child,window,clock,start,finish:()=>child.stdin.emit('finish'),output:(raw=JSON.stringify(checked())+'\n')=>{child.stdout.emit('data',Buffer.from(raw));child.stdout.emit('end');},close:()=>child.emit('close',0,null),fire:()=>{assert(callback);callback();},setTime:(w:number,m:number)=>{wall=w;mono=m;},counts:()=>({clears,sets})};
}
function clean(f:ReturnType<typeof fixture>){for(const e of [f.child,f.child.stdin,f.child.stdout])assert.deepEqual(e.eventNames(),['error']);assert.equal(f.child.effects,0);}

test('정확 launcher 보고도 원 finish/end/close까지 로컬 수거만 확정한다',async()=>{
 for(const suffix of ['', '\n']){const f=fixture(),pending=f.start();let settled=false;void pending.then(()=>settled=true);assert.equal(f.counts().sets,1);f.finish();f.output(JSON.stringify(checked())+suffix);f.child.emit('exit',0,null);await Promise.resolve();assert.equal(settled,false);f.close();assert.deepEqual(await pending,{status:'COLLECTED',code:'RESULT_COLLECTED',localCollection:'CONFIRMED',authority:'NOT_ISSUED'});assert.deepEqual(f.counts(),{sets:1,clears:1});clean(f);}
});
test('결과만·exit만·timeout·사후 성공은 완료로 승격하지 않는다',async()=>{
 const f=fixture(),pending=f.start();let settled=0;void pending.then(()=>settled++);f.finish();f.output();f.child.emit('exit',0,null);f.child.emit('killRequested');f.fire();assert.equal((await pending).code,'DEADLINE');f.close();f.output();f.child.emit('error',Error('PRIVATE'));await Promise.resolve();assert.equal(settled,1);clean(f);
});
test('역순/중복 종결·data after end·원 stream/child 오류와 비0 close는 UNKNOWN',async()=>{
 for(const kind of ['end-first','close-first','finish-twice','end-twice','late-data','input-error','output-error','child-error','input-close','output-close','signal','nonzero']){
  const f=fixture(),pending=f.start();
  if(kind==='end-first')f.output();else if(kind==='close-first')f.close();else if(kind==='input-close')f.child.stdin.emit('close');else if(kind==='output-close')f.child.stdout.emit('close');else{
   f.finish();if(kind==='finish-twice')f.finish();f.output();
   if(kind==='end-twice')f.child.stdout.emit('end');if(kind==='late-data')f.child.stdout.emit('data',Buffer.from('x'));
   if(kind==='input-error')f.child.stdin.emit('error',Error('PRIVATE_INPUT'));if(kind==='output-error')f.child.stdout.emit('error',Error('PRIVATE_OUTPUT'));if(kind==='child-error')f.child.emit('error',Error('PRIVATE_CHILD'));
   f.child.emit('close',kind==='nonzero'?1:0,kind==='signal'?'PRIVATE_SIGNAL':null);
  }
  const out=await pending;assert.equal(out.status,'UNKNOWN',kind);assert(!JSON.stringify(out).includes('PRIVATE'));clean(f);
 }
});
test('4KiB/UTF8/단일 JSON/중복/extra/오염 및 STOPPED는 수거 성공 아님',async()=>{
 const good=JSON.stringify(checked());
 for(const raw of [Buffer.alloc(4097),Buffer.from([255]),Buffer.from('\uFEFF'+good),Buffer.from(good+'\n\n'),Buffer.from(good+'\r\n'),Buffer.from(good+'\u2028'),Buffer.from(good+good),Buffer.from(good.replace('"status":"CHECKED"','"status":"CHECKED","status":"CHECKED"')),Buffer.from(JSON.stringify({...checked(),secret:'PRIVATE'})),Buffer.from(JSON.stringify({...checked(),stage:'RUN'})),Buffer.from(JSON.stringify({...checked(),poolClosed:false})),Buffer.from(JSON.stringify({...checked(),authority:'CURRENT'})),Buffer.from(JSON.stringify({...checked(),tc01:'STARTED'})),Buffer.from(JSON.stringify({...checked(),status:'STOPPED',code:'BOUNDARY_OR_OUTCOME_UNKNOWN',resources:'PRESERVED_OR_UNCONFIRMED'}))]){
  const f=fixture(),pending=f.start();f.finish();f.child.stdout.emit('data',raw);f.child.stdout.emit('end');f.close();const out=await pending;assert.equal(out.status,'UNKNOWN');assert(!JSON.stringify(out).includes('PRIVATE'));clean(f);
 }
});
test('원 child·stream 단회 소비와 다른 handle/교체는 분리한다',async()=>{
 const f=fixture(),pending=f.start(),other=new Child();other.stdin.emit('finish');other.stdout.emit('data',Buffer.from(JSON.stringify(checked())));other.stdout.emit('end');other.emit('close',0,null);
 assert.equal((await f.start()).code,'INPUT_INVALID');other.stdin=f.child.stdin;assert.equal((await collectTc01ChildResult(other,f.window,f.clock)).code,'INPUT_INVALID');f.finish();f.output();f.close();assert.equal((await pending).status,'COLLECTED');clean(f);
 const g=fixture(),old=g.child.stdout,p=g.start();g.child.stdout=new EventEmitter();g.finish();assert.equal((await p).code,'HANDLE_CHANGED');assert.deepEqual(old.eventNames(),['error']);
});
test('원 window snapshot·wall/mono 만료와 역행은 고정한다',async()=>{
 for(const [wall,mono]of [[999,20],[1000,19],[1801000,20],[1000,1800020]]){const f=fixture(),pending=f.start();f.window.expiresAt=9999999;f.setTime(wall!,mono!);f.finish();assert.equal((await pending).code,'DEADLINE');clean(f);}
 const f=fixture();f.window.expiresAt++;assert.equal((await f.start()).code,'INPUT_INVALID');assert.equal(f.counts().sets,0);f.window.expiresAt--;assert.equal((await f.start()).code,'INPUT_INVALID');clean(f);
});
test('listener 설치 중 이벤트·timer 동기발화/예외·빈 handle은 불명, 원 listener/timer만 회수',async()=>{
 const f=fixture();const before=(name:string)=>{if(name==='error')f.child.stdin.emit('finish');};f.child.stdin.on('newListener',before);const out=await f.start();assert.equal(out.code,'SETUP_UNKNOWN');assert.equal(f.child.stdin.listenerCount('newListener'),1);f.child.stdin.removeListener('newListener',before);clean(f);assert.equal(f.counts().sets,0);
 for(const mode of ['sync','throw','undefined'] as const){const g=fixture();let clear=0;g.clock.clearTimeout=handle=>{assert.equal(handle,9);clear++;};g.clock.setTimeout=fn=>{if(mode==='sync'){fn();return 9;}if(mode==='throw')throw Error('PRIVATE_TIMER');return undefined;};const r=await g.start();assert.equal(r.status,'UNKNOWN');assert.equal(clear,mode==='sync'?1:0);clean(g);}
});
test('timer가 원 종결을 설치 중 보내도 성공0, cleanup 불명/clock 교체도 UNKNOWN',async()=>{
 const f=fixture();f.clock.setTimeout=()=>{f.finish();f.output();f.close();return 7;};assert.equal((await f.start()).status,'UNKNOWN');assert.equal(f.counts().clears,1);clean(f);
 const g=fixture();g.clock.clearTimeout=()=>{throw Error('PRIVATE_CLEANUP');};const p=g.start();g.finish();g.output();g.close();assert.equal((await p).code,'CLEANUP_UNKNOWN');clean(g);
 const h=fixture(),pending=h.start();h.clock.now=()=>{throw Error('PRIVATE_CLOCK');};h.finish();assert.equal((await pending).code,'COLLECTION_UNKNOWN');assert.equal(h.counts().clears,1);clean(h);
});
test('원 byte는 복사하고 getter/Proxy/shared backing은 평가하거나 수용하지 않는다',async()=>{
 const f=fixture(),pending=f.start();let traps=0;const bytes=Buffer.from(JSON.stringify(checked()));for(const key of ['length','byteLength','byteOffset','buffer'])Object.defineProperty(bytes,key,{get(){traps++;throw Error('PRIVATE');}});
 f.finish();f.child.stdout.emit('data',bytes);Uint8Array.prototype.fill.call(bytes,0);f.child.stdout.emit('end');f.close();assert.equal((await pending).status,'COLLECTED');assert.equal(traps,0);clean(f);
 for(const value of [new Proxy(new Uint8Array(2),{get(){traps++;throw Error('PRIVATE');}}),new Uint8Array(new SharedArrayBuffer(2)), 'PRIVATE_STRING']){const g=fixture(),p=g.start();g.child.stdout.emit('data',value);assert.equal((await p).code,'OUTPUT_INVALID');clean(g);}assert.equal(traps,0);
});
test('한 바이트 분할과 빈 chunk가 고정 stdout 저장량을 늘리지 않는다',async()=>{
 const f=fixture(),pending=f.start();f.finish();for(const b of Buffer.from(JSON.stringify(checked()))){f.child.stdout.emit('data',Buffer.alloc(0));f.child.stdout.emit('data',Buffer.from([b]));}f.child.stdout.emit('end');f.close();assert.equal((await pending).status,'COLLECTED');clean(f);
});
test('입력 getter와 Proxy·clock 형상은 호출 없이 거절',async()=>{
 let reads=0;const f=fixture();const window={issuedAt:1000,get expiresAt(){reads++;return 2000;}};assert.equal((await collectTc01ChildResult(f.child,window,f.clock)).code,'INPUT_INVALID');assert.equal(reads,0);clean(f);
 assert.equal((await collectTc01ChildResult(new Proxy(new Child(),{get(){reads++;throw Error('PRIVATE');}}),f.window,f.clock)).status,'UNKNOWN');assert.equal(reads,0);
 const g=fixture();Object.defineProperty(g.clock,'now',{get(){reads++;throw Error('PRIVATE');},enumerable:true});assert.equal((await g.start()).code,'INPUT_INVALID');assert.equal(reads,0);clean(g);
});
