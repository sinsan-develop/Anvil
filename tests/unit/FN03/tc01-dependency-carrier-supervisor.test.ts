import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {createTc01DependencyCarrierSupervisor} from '../../../scripts/qa-fn03-tc01-dependency-carrier-supervisor.ts';
const wire=(v:unknown)=>Buffer.from(canonicalJson(v)+'\n');
function fixture(){
 const binding={purpose:'TC01_DEPENDENCY_PREPARATION',attemptId:'b1000000-0000-4000-8000-000000000001',sourceHead:'a'.repeat(40),packageLockSha256:'b'.repeat(64),source:{entry:'scripts/qa-fn03-tc01-dependency-intake.ts',sha256:'c'.repeat(64),closureSha256:'d'.repeat(64)},recipe:'TC01_DEPENDENCY_RECIPE_CANDIDATE_V1',approvalSha256:'e'.repeat(64),consumptionSha256:'f'.repeat(64),issuedAt:1000,expiresAt:1801000};
 const input=wire({schemaVersion:1,kind:'TC01_DEPENDENCY_INPUT_V1',binding,limits:{installationMs:600000,totalMs:1800000}});
 const manifestRaw=canonicalJson({schemaVersion:1,sourceHead:binding.sourceHead,packageLockSha256:binding.packageLockSha256,files:[{path:'node_modules/example/index.js',bytes:0,sha256:contentHash('')}]})+'\n';
 const candidate={status:'CANDIDATE_ONLY',authority:'NOT_ISSUED',manifestRaw,manifestSha256:contentHash(manifestRaw)};
 const output=wire({schemaVersion:1,kind:'TC01_DEPENDENCY_RESULT_V1',binding,result:candidate});
 const child=Object.assign(new EventEmitter(),{stdin:new EventEmitter(),stdout:new EventEmitter()});
 let wall=1001,mono=10,send=0,verified=0,cleared=0,callback=()=>{},sent:Uint8Array|undefined;
 const complete=()=>{child.stdin.emit('finish');child.stdout.emit('data',output);child.stdout.emit('end');child.emit('exit',0,null);child.emit('close',0,null);};
 const ports={now:()=>wall,monotonic:()=>mono,assertCurrent:(c:unknown,r:any)=>{verified++;assert.equal(c,child);assert.equal(r.inputSha256,contentHash(input));assert.deepEqual(r.binding,binding);},setTimeout:(cb:()=>void,ms:number)=>{assert(ms>0&&ms<=1800000);callback=cb;return 1;},clearTimeout:(h:unknown)=>{assert.equal(h,1);cleared++;},transmit:(c:unknown,b:Uint8Array)=>{assert.equal(c,child);assert.deepEqual(Buffer.from(b),input);assert(child.stdin.listenerCount('error')>0&&child.stdout.listenerCount('data')>0&&child.listenerCount('close')>0);send++;sent=b;complete();}};
 return{binding,input,candidate,output,child,ports,complete,tick:()=>callback(),setTime:(w:number,m:number)=>{wall=w;mono=m;},stats:()=>({send,verified,cleared,sent})};
}
const unknown=(r:any)=>{assert.equal(r.status,'UNKNOWN');assert.equal(r.authority,'NOT_ISSUED');assert.equal(r.localCollection,'UNCONFIRMED');assert.equal(Object.hasOwn(r,'candidate'),false);};
const clean=(f:ReturnType<typeof fixture>)=>{for(const e of[f.child,f.child.stdin,f.child.stdout])assert.equal(e.eventNames().length,0);assert(f.stats().sent?.every(b=>b===0)??true);};
test('same original handle, installed listeners and timer precede one send; exact candidate is local only',async()=>{
 const f=fixture(),s=createTc01DependencyCarrierSupervisor(f.ports),r=await s.run(f.child,f.input,f.binding);
 assert.equal(r.status,'COLLECTED');assert.equal(r.localCollection,'CONFIRMED');assert.equal(r.authority,'NOT_ISSUED');assert.deepEqual(r.candidate,f.candidate);assert.equal(f.stats().send,1);assert.equal(f.stats().cleared,1);clean(f);
 unknown(await s.run(f.child,f.input,f.binding));unknown(await createTc01DependencyCarrierSupervisor(f.ports).run(f.child,f.input,f.binding));assert.equal(f.stats().send,1);
});
test('invalid wire/binding/getter/proxy fails before transmit or authority callback',async()=>{
 for(const mode of['wire','binding','getter','proxy']){const f=fixture();let calls=0;let b:any=f.binding,raw:unknown=f.input;if(mode==='wire')raw=Buffer.from('PRIVATE');if(mode==='binding')b={...b,approvalSha256:'0'.repeat(64)};if(mode==='getter')Object.defineProperty(b,'purpose',{get(){calls++;throw Error('PRIVATE');}});if(mode==='proxy')raw=new Proxy(f.input,{get(){calls++;throw Error('PRIVATE');}});unknown(await createTc01DependencyCarrierSupervisor(f.ports).run(f.child,raw,b));assert.equal(f.stats().send,0);assert.equal(f.stats().verified,0);assert.equal(calls,0);clean(f);}
});
test('external same-handle/source/approval failure before send or after close emits no candidate',async()=>{
 for(const after of[false,true]){const f=fixture();f.ports.assertCurrent=()=>{if(!after||f.stats().send)throw Error('PRIVATE');};unknown(await createTc01DependencyCarrierSupervisor(f.ports).run(f.child,f.input,f.binding));assert.equal(f.stats().send,after?1:0);clean(f);}
});
test('synchronous timer expiry, timer throw or absent handle never transmit; own known timer is cleared',async()=>{
 for(const mode of['sync','throw','absent']){const f=fixture();f.ports.setTimeout=(cb)=>{if(mode==='throw')throw Error('PRIVATE');if(mode==='sync')cb();return mode==='absent'?undefined as any:1;};unknown(await createTc01DependencyCarrierSupervisor(f.ports).run(f.child,f.input,f.binding));assert.equal(f.stats().send,0);assert.equal(f.stats().cleared,mode==='sync'?1:0);clean(f);}
});
test('transmit false/throw after synchronous normal close never publishes candidate',async()=>{
 for(const throws of[false,true]){const f=fixture(),original=f.ports.transmit;f.ports.transmit=(c,b)=>{original(c,b);if(throws)throw Error('PRIVATE');return false as any;};unknown(await createTc01DependencyCarrierSupervisor(f.ports).run(f.child,f.input,f.binding));assert.equal(f.stats().send,1);clean(f);}
});
test('timeout preserves owner, no retry or signal; late success and duplicate use cannot recover',async()=>{
 const f=fixture();f.ports.transmit=()=>{};const s=createTc01DependencyCarrierSupervisor(f.ports),p=s.run(f.child,f.input,f.binding);f.tick();unknown(await p);f.complete();unknown(await s.run(f.child,f.input,f.binding));clean(f);
});
test('input finish/output end/close order, bad exit, errors and duplicate finish remain unknown',async()=>{
 for(const mode of['end-first','close-first','exit-only','bad-exit','input-error','output-error','child-error','duplicate-finish']){const f=fixture();f.ports.transmit=()=>{if(mode==='end-first')f.child.stdout.emit('end');if(mode==='close-first')f.child.emit('close',0,null);if(mode==='exit-only')f.child.emit('exit',0,null);if(mode==='bad-exit')f.child.emit('exit',1,null);if(mode==='input-error')f.child.stdin.emit('error',Error('PRIVATE'));if(mode==='output-error')f.child.stdout.emit('error',Error('PRIVATE'));if(mode==='child-error')f.child.emit('error',Error('PRIVATE'));if(mode==='duplicate-finish'){f.child.stdin.emit('finish');f.child.stdin.emit('finish');}};const p=createTc01DependencyCarrierSupervisor(f.ports).run(f.child,f.input,f.binding);f.tick();unknown(await p);clean(f);}
});
test('output cap, malformed/foreign result and shared byte source never become candidate',async()=>{
 for(const mode of['cap','malformed','binding','shared']){const f=fixture();f.ports.transmit=()=>{f.child.stdin.emit('finish');const raw=mode==='cap'?Buffer.alloc(4210689):mode==='malformed'?Buffer.from('PRIVATE'):mode==='shared'?new Uint8Array(new SharedArrayBuffer(1)):Buffer.from(f.output.toString().replace('b1000000','b2000000'));f.child.stdout.emit('data',raw);f.child.stdout.emit('end');f.child.emit('close',0,null);};unknown(await createTc01DependencyCarrierSupervisor(f.ports).run(f.child,f.input,f.binding));clean(f);}
});
test('wall/monotonic expiration or backward movement prevents late completion',async()=>{
 for(const times of[[1801000,11],[1001,1800009],[1000,11],[1002,9]]){const f=fixture();f.ports.transmit=()=>{};const p=createTc01DependencyCarrierSupervisor(f.ports).run(f.child,f.input,f.binding);f.setTime(times[0]!,times[1]!);f.complete();unknown(await p);clean(f);}
});
test('stream replacement and shared stream across original handles are rejected',async()=>{
 const f=fixture();f.ports.transmit=()=>{};const p=createTc01DependencyCarrierSupervisor(f.ports).run(f.child,f.input,f.binding),original=f.child.stdout;f.child.stdout=new EventEmitter();original.emit('end');unknown(await p);assert.equal(original.eventNames().length,0);
 const g=fixture();g.child.stdin=f.child.stdin;unknown(await createTc01DependencyCarrierSupervisor(g.ports).run(g.child,g.input,g.binding));assert.equal(g.stats().send,0);
});
test('clear failure suppresses otherwise exact result and caller-owned listeners survive',async()=>{
 const f=fixture(),listener=()=>{};f.child.on('close',listener);f.ports.clearTimeout=()=>{throw Error('PRIVATE');};unknown(await createTc01DependencyCarrierSupervisor(f.ports).run(f.child,f.input,f.binding));assert.deepEqual(f.child.listeners('close'),[listener]);assert(f.stats().sent?.every(b=>b===0));f.child.off('close',listener);clean(f);
});

test('port mutation of owned input before finish, after finish or after synchronous close stays unknown',async()=>{
 for(const phase of['before-finish','after-finish','after-close']){const f=fixture();f.ports.transmit=(_c,b)=>{if(phase==='before-finish')b[0]=0;f.child.stdin.emit('finish');if(phase==='after-finish')b[0]=0;f.child.stdout.emit('data',f.output);f.child.stdout.emit('end');f.child.emit('close',0,null);if(phase==='after-close')b[0]=0;};unknown(await createTc01DependencyCarrierSupervisor(f.ports).run(f.child,f.input,f.binding));clean(f);}
});
test('caller input mutation cannot rebind owned bytes; asynchronous port mutation before finish is rejected',async()=>{
 for(const mutateOwned of[false,true]){const f=fixture(),original=Buffer.from(f.input),expected=structuredClone(f.binding);let sent:Uint8Array|undefined;
  f.ports.assertCurrent=(_c,r)=>{assert.deepEqual(r.binding,expected);assert.equal(r.inputSha256,contentHash(original));};f.ports.transmit=(_c,b)=>{sent=b;};
  const p=createTc01DependencyCarrierSupervisor(f.ports).run(f.child,f.input,f.binding);f.input.fill(0);f.binding.sourceHead='0'.repeat(40);assert.deepEqual(Buffer.from(sent!),original);if(mutateOwned)sent![0]=0;f.complete();const r=await p;if(mutateOwned)unknown(r);else assert.equal(r.status,'COLLECTED');assert(sent!.every(b=>b===0));clean(f);
 }
});
test('expiration during own timer cleanup suppresses success without extra child effects',async()=>{
 const f=fixture(),clear=f.ports.clearTimeout;f.ports.clearTimeout=h=>{clear(h);f.setTime(1801000,1800009);};unknown(await createTc01DependencyCarrierSupervisor(f.ports).run(f.child,f.input,f.binding));assert.equal(f.stats().send,1);clean(f);
});
test('events from external validation during setup never unlock transmission',async()=>{
 const f=fixture();f.ports.assertCurrent=()=>{if(f.child.stdin.listenerCount('finish'))f.child.stdin.emit('finish');};unknown(await createTc01DependencyCarrierSupervisor(f.ports).run(f.child,f.input,f.binding));assert.equal(f.stats().send,0);clean(f);
});

test('expected approval/consumption/source binding is owned before the first clock callback',async()=>{
 for(const key of['approvalSha256','consumptionSha256','source']){const f=fixture(),expected=structuredClone(f.binding);if(key==='source')expected.source.sha256='0'.repeat(64);else(expected as any)[key]='0'.repeat(64);let clocks=0;
  f.ports.now=()=>{clocks++;if(key==='source')expected.source.sha256=f.binding.source.sha256;else(expected as any)[key]=(f.binding as any)[key];return 1001;};
  unknown(await createTc01DependencyCarrierSupervisor(f.ports).run(f.child,f.input,expected));assert.equal(clocks,1);assert.equal(f.stats().send,0);assert.equal(f.stats().verified,0);clean(f);
 }
 const f=fixture();let clocks=0;f.ports.now=()=>{clocks++;return 1001;};Object.defineProperty(f.binding.source,'sha256',{get(){throw Error('PRIVATE');}});unknown(await createTc01DependencyCarrierSupervisor(f.ports).run(f.child,f.input,f.binding));assert.equal(clocks,0);
});
