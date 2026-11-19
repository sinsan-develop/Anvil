import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';

const subject=()=>import('../../../scripts/qa-ix01-subnet-observation-supervisor.ts');
class Child extends EventEmitter{
 stdin=new EventEmitter();stdout=new EventEmitter();
 calls=0;
 constructor(){super();for(const e of [this,this.stdin,this.stdout])e.on('error',()=>{});}
 kill(){this.calls++;throw Error('FORBIDDEN');}
}
async function fixture(){
 const {collectSubnetObservationChild}=await subject();const child=new Child();
 let wall=1000,mono=20,fire:(()=>void)|undefined,clears=0;
 const clock={now:()=>wall,monotonic:()=>mono,setTimeout(fn:()=>void,ms:number){assert.equal(ms,60_000);fire=fn;return 7;},clearTimeout(id:unknown){assert.equal(id,7);clears++;}};
 const promise=collectSubnetObservationChild(child,{issuedAt:1000,expiresAt:61000},clock);
 let settled=0;void promise.then(()=>settled++);
 return {child,promise,clock,collectSubnetObservationChild,finish(){child.stdin.emit('finish');},
  output(raw='{"code":"CANDIDATE","cidr":"172.16.0.0/28"}\n'){child.stdout.emit('data',Buffer.from(raw));child.stdout.emit('end');},
  close(){child.emit('close',0,null);},fire(){assert(fire);fire();},advance(w:number,m=w){wall+=w;mono+=m;},get clears(){return clears;},get settled(){return settled;}};
}
test('subnet supervisor: 정확 원 입력·결과·close를 수거해도 원격 완료 없이 후보를 발행하지 않는다',async()=>{
 const f=await fixture();f.finish();f.output();await Promise.resolve();assert.equal(f.settled,0);
 f.close();const r=await f.promise;assert.deepEqual(r,{status:'UNKNOWN',code:'REMOTE_COMPLETION_UNVERIFIED',localCollection:'CONFIRMED'});
 assert(!JSON.stringify(r).includes('172.'));assert.equal(f.child.calls,0);assert.equal(f.clears,1);
 for(const e of [f.child,f.child.stdin,f.child.stdout])assert.deepEqual(e.eventNames(),['error']);
});
test('subnet supervisor: 결과만·kill 요청만·기한은 close 증거가 아니며 늦은 이벤트를 폐기한다',async()=>{
 const f=await fixture();f.finish();f.output();f.child.emit('exit',0,null);f.child.emit('killRequested');
 f.advance(60_000);f.fire();const r=await f.promise;assert.equal(r.code,'DEADLINE');assert.equal(r.localCollection,'UNCONFIRMED');
 f.close();f.finish();f.output();f.child.emit('error',Error('PRIVATE'));await Promise.resolve();assert.equal(f.settled,1);assert.equal(f.child.calls,0);
});
test('subnet supervisor: 입력 미완료·stdout 미종결·전송 실패·신호·비0은 UNKNOWN',async()=>{
 for(const kind of ['input','output','stdin-error','stream-error','spawn-error','signal','status']){
  const f=await fixture();if(kind!=='input')f.finish();if(kind!=='output')f.output();
  if(kind==='stdin-error')f.child.stdin.emit('error',Error('PRIVATE'));
  else if(kind==='stream-error')f.child.stdout.emit('error',Error('PRIVATE'));
  else if(kind==='spawn-error')f.child.emit('error',Error('PRIVATE'));
  else f.child.emit('close',kind==='status'?1:0,kind==='signal'?'PRIVATE_SIGNAL':null);
  const r=await f.promise;assert.equal(r.status,'UNKNOWN');assert.equal(r.localCollection,'UNCONFIRMED');assert(!JSON.stringify(r).includes('PRIVATE'));assert.equal(f.child.calls,0);
 }
});
test('subnet supervisor: stdout 상한·정확 형상·UTF8·중복 결과·대역은 거절한다',async()=>{
 for(const raw of [Buffer.alloc(4097),Buffer.from([255]),Buffer.from('{"code":"UNKNOWN","secret":"PRIVATE"}'),Buffer.from('{"code":"UNKNOWN","code":"UNKNOWN"}'),Buffer.from('{"code":"UNKNOWN"}\n{"code":"UNKNOWN"}'),Buffer.from('{"code":"CANDIDATE","cidr":"172.16.255.0/28"}')]){
  const f=await fixture();f.finish();f.child.stdout.emit('data',raw);f.child.stdout.emit('end');f.close();
  const r=await f.promise;assert.equal(r.localCollection,'UNCONFIRMED');assert(!JSON.stringify(r).includes('PRIVATE'));assert.equal(f.child.calls,0);
 }
});
test('subnet supervisor: 다른 handle 이벤트는 수거되지 않고 원 handle 재사용은 거절한다',async()=>{
 const f=await fixture(),other=new Child();other.stdin.emit('finish');other.stdout.emit('data',Buffer.from('{"code":"UNKNOWN"}'));other.stdout.emit('end');other.emit('close',0,null);
 await Promise.resolve();assert.equal(f.settled,0);
 const again=await f.collectSubnetObservationChild(f.child,{issuedAt:1000,expiresAt:61000},f.clock);assert.equal(again.code,'INPUT_INVALID');
 f.finish();f.output('{"code":"NO_CANDIDATE"}');f.close();assert.equal((await f.promise).localCollection,'CONFIRMED');
});
test('subnet supervisor: wall/monotonic 역행 및 총60초 초과는 다음 결과를 채택하지 않는다',async()=>{
 for(const [w,m]of [[-1,0],[0,-1],[60_000,0],[0,60_000]]){const f=await fixture();f.advance(w!,m!);f.finish();f.output();f.close();assert.equal((await f.promise).code,'DEADLINE');assert.equal(f.child.calls,0);}
 const {collectSubnetObservationChild}=await subject();let calls=0;const clock={now:()=>{calls++;return 1000;},monotonic:()=>0,setTimeout:()=>{calls++;return 1;},clearTimeout:()=>{calls++;}};
 const r=await collectSubnetObservationChild(new Child(),{issuedAt:1000,expiresAt:61001},clock);assert.equal(r.code,'INPUT_INVALID');assert.equal(calls,0);
});
test('subnet supervisor: timer 회수 불명·clock 예외와 위조 byte 속성을 안전하게 처리한다',async()=>{
 const f=await fixture();f.clock.clearTimeout=()=>{throw Error('PRIVATE');};f.finish();f.output();f.close();
 assert.deepEqual(await f.promise,{status:'UNKNOWN',code:'COLLECTION_UNKNOWN',localCollection:'UNCONFIRMED'});
 const g=await fixture();g.clock.now=()=>{throw Error('PRIVATE');};g.finish();assert.equal((await g.promise).code,'COLLECTION_UNKNOWN');
 const h=await fixture();let traps=0;const b=new Uint8Array(Buffer.from('{"code":"UNKNOWN"}'));
 for(const key of ['length','byteLength','buffer','byteOffset'])Object.defineProperty(b,key,{get(){traps++;throw Error('PRIVATE');}});
 h.finish();h.child.stdout.emit('data',b);h.child.stdout.emit('end');h.close();assert.equal((await h.promise).localCollection,'CONFIRMED');assert.equal(traps,0);
 const p=await fixture();p.child.stdout.emit('data',new Proxy(b,{get(){traps++;throw Error('PRIVATE');}}));assert.equal((await p.promise).code,'OUTPUT_INVALID');assert.equal(traps,0);
});
test('subnet supervisor: JSON 전체 끝·단일 LF만 허용하고 BOM·이중 LF·CR·Unicode separator는 거절한다',async()=>{
 for(const json of ['{"code":"UNKNOWN"}','{"code":"NO_CANDIDATE"}','{"code":"CANDIDATE","cidr":"172.16.0.0/28"}']){
  for(const suffix of ['', '\n']){const f=await fixture();f.finish();f.output(json+suffix);f.close();assert.equal((await f.promise).localCollection,'CONFIRMED');}
  for(const raw of ['\uFEFF'+json,json+'\n\n',json+'\r',json+'\r\n',json+'\n\r',json+'\u2028',json+'\u2029',json+'\n\u2028',json+'\n\u2029']){
   const f=await fixture();f.finish();f.output(raw);f.close();const r=await f.promise;
   assert.equal(r.code,'OUTPUT_INVALID',JSON.stringify(raw));assert.equal(r.localCollection,'UNCONFIRMED');assert.equal(f.child.calls,0);
  }
 }
});
