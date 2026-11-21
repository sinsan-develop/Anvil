import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createHash} from 'node:crypto';
import {createTc01DependencyPreparation,type Tc01DependencyPreparationPorts} from '../../../scripts/qa-fn03-tc01-dependency-preparation.ts';

const digest=(v:Uint8Array)=>createHash('sha256').update(v).digest('hex');
function fixture(){
 const lockBytes=Buffer.from(JSON.stringify({lockfileVersion:3,packages:{'':{name:'fixture'},'node_modules/example':{resolved:'https://registry.npmjs.org/example/-/example-1.tgz',integrity:'sha512-YQ=='}}}));
 const input={binding:{attemptId:'11111111-1111-4111-8111-111111111111',sourceHead:'a'.repeat(40),lockSha256:digest(lockBytes),issuedAt:1000,expiresAt:901000},lockBytes};
 const child=Object.assign(new EventEmitter(),{stdout:new EventEmitter(),stderr:new EventEmitter()});
 let wall=1000,mono=0,mask=0o022,timer:(()=>void)|undefined;
 const calls:string[]=[],commands:any[]=[],requests:any[]=[];
 const complete=()=>{child.stdout.emit('data',Buffer.from('private install output'));child.stdout.emit('end');child.stderr.emit('end');child.emit('exit',0,null);child.emit('close',0,null);};
 const ports:Tc01DependencyPreparationPorts={
  now:()=>wall,monotonic:()=>mono,
  assertApproved:r=>{requests.push(r);},
  verify:r=>{calls.push('verify:'+r.phase);},
  prepare:r=>{calls.push('prepare');requests.push(r);},
  takeChild:command=>{calls.push('take');commands.push(command);return child;},
  start:(same,command)=>{assert.equal(same,child);assert.equal(command,commands[0]);assert.equal(mask,0o077);assert.ok(child.listenerCount('close'));assert.ok(timer);calls.push('start');complete();},
  umask:value=>{const old=mask;if(value!==undefined)mask=value;return old;},
  setTimeout:(fn,ms)=>{assert.equal(ms,600000);timer=fn;return 17;},
  clearTimeout:id=>{assert.equal(id,17);timer=undefined;calls.push('clear');},
 };
 return {input,ports,child,calls,commands,requests,complete,wall:(v:number)=>{wall=v;},mono:(v:number)=>{mono=v;},fire:()=>timer?.(),mask:()=>mask,timer:()=>timer};
}
test('fixed candidate: original handle close, mask restore, no manifest or authority',async()=>{
 const f=fixture(),owner=createTc01DependencyPreparation(f.ports),r=await owner.run(f.input);
 assert.deepEqual(r,{status:'COLLECTED',code:'INSTALL_EXIT_COLLECTED',recipe:'TC01_DEPENDENCY_RECIPE_CANDIDATE_V1',authority:'NOT_ISSUED',manifest:'NOT_ISSUED'});
 assert.deepEqual(f.calls,['verify:BEFORE_PREPARE','prepare','verify:BEFORE_START','take','start','clear','verify:AFTER_CLOSE']);
 const c=f.commands[0],root='/home/daon/anvil-fn03-tc01-'+f.input.binding.attemptId+'-qa',receipt='/home/daon/.local/share/anvil-v3-qa-receipts/fn03-tc01-'+f.input.binding.attemptId+'-dependency-preparation';
 assert.equal(c.cwd,root);assert.equal(c.file,'/opt/node-v24.22.1-linux-x64/bin/node');
 assert.deepEqual(c.args,['/opt/node-v24.22.1-linux-x64/lib/node_modules/npm/bin/npm-cli.js','ci','--ignore-scripts','--no-audit','--no-fund','--bin-links=false','--omit=dev','--include=optional','--userconfig='+receipt+'/npm-user.conf','--globalconfig='+receipt+'/npm-global.conf','--cache='+receipt+'/npm-cache','--registry=https://registry.npmjs.org/']);
 assert.equal(c.shell,false);assert.deepEqual(c.stdio,['ignore','pipe','pipe']);assert.equal(c.timeoutMs,600000);assert.equal(c.maxOutputBytes,65536);assert.equal(c.env.HOME,receipt);assert.equal(Object.hasOwn(c.env,'NODE_OPTIONS'),false);
 assert.equal(f.mask(),0o022);assert.equal(f.timer(),undefined);assert.equal(f.child.listenerCount('close'),0);assert.equal(JSON.stringify(r).includes('private'),false);
 assert.equal((await owner.run(f.input)).status,'UNKNOWN');assert.equal(f.calls.filter(x=>x==='start').length,1);
});

test('wrong binding/hash/lock, input extra field and getters fail before any port effect',async()=>{
 const variants=[(f:ReturnType<typeof fixture>)=>{f.input.binding.lockSha256='b'.repeat(64);},(f:ReturnType<typeof fixture>)=>{f.input.binding.attemptId='../outside';},(f:ReturnType<typeof fixture>)=>{f.input.binding.sourceHead='a'.repeat(39);},(f:ReturnType<typeof fixture>)=>{(f.input as any).argv=['other'];},(f:ReturnType<typeof fixture>)=>{f.input.lockBytes=Buffer.from('{"lockfileVersion":3,"lockfileVersion":3,"packages":{}}');f.input.binding.lockSha256=digest(f.input.lockBytes);},(f:ReturnType<typeof fixture>)=>{f.input.lockBytes=Buffer.from(JSON.stringify({lockfileVersion:3,packages:{'':{},'node_modules/x':{link:true,resolved:'file:../elsewhere',integrity:'sha512-YQ=='}}}));f.input.binding.lockSha256=digest(f.input.lockBytes);}];
 for(const alter of variants){const f=fixture();alter(f);assert.equal((await createTc01DependencyPreparation(f.ports).run(f.input)).status,'UNKNOWN');assert.deepEqual(f.calls,[]);assert.deepEqual(f.requests,[]);}
 const f=fixture();let calls=0;Object.defineProperty(f.input,'lockBytes',{get(){calls++;return Buffer.from('secret');}});assert.equal((await createTc01DependencyPreparation(f.ports).run(f.input)).status,'UNKNOWN');assert.equal(calls,0);
 const g=fixture();g.input.lockBytes=new Proxy(g.input.lockBytes,{get(){throw Error('must not run');}});assert.equal((await createTc01DependencyPreparation(g.ports).run(g.input)).status,'UNKNOWN');assert.deepEqual(g.calls,[]);
});
test('external approval and exact void verification/preparation are required; no self-issued authority',async()=>{
 for(const name of ['assertApproved','verify','prepare'] as const){const f=fixture();(f.ports as any)[name]=()=>false;assert.equal((await createTc01DependencyPreparation(f.ports).run(f.input)).status,'UNKNOWN');assert.equal(f.calls.includes('start'),false);}
 const f=fixture();f.ports.assertApproved=()=>{throw Error('raw secret authority failure');};const r=await createTc01DependencyPreparation(f.ports).run(f.input);assert.equal(r.status,'UNKNOWN');assert.deepEqual(f.calls,[]);assert.equal(JSON.stringify(r).includes('secret'),false);
});
test('owned binding/lock are frozen before callbacks; command is immutable and no inherited env',async()=>{
 const f=fixture(),original=f.ports.verify;f.ports.verify=r=>{f.input.binding.sourceHead='b'.repeat(40);f.input.lockBytes.fill(0);assert.equal((r.binding as any).sourceHead,'a'.repeat(40));assert.ok(Object.isFrozen(r.binding));original(r);};
 assert.equal((await createTc01DependencyPreparation(f.ports).run(f.input)).status,'COLLECTED');
 const c=f.commands[0];assert.ok(Object.isFrozen(c));assert.ok(Object.isFrozen(c.args));assert.ok(Object.isFrozen(c.env));assert.deepEqual(Object.keys(c.env),['PATH','LANG','LC_ALL','HOME','GIT_CONFIG_NOSYSTEM','GIT_CONFIG_SYSTEM','GIT_CONFIG_GLOBAL','GIT_CONFIG_COUNT','GIT_OPTIONAL_LOCKS','GIT_NO_REPLACE_OBJECTS','GIT_NO_LAZY_FETCH','GIT_TERMINAL_PROMPT','GIT_ATTR_NOSYSTEM','GIT_PAGER']);
});
test('synchronous timer expiry/throw/missing handle never start and retain UNKNOWN',async()=>{
 for(const mode of ['fire','throw','missing']){const f=fixture();f.ports.setTimeout=(fn)=>{if(mode==='throw')throw Error('timer');if(mode==='fire')fn();return mode==='missing'?undefined:17;};const r=await createTc01DependencyPreparation(f.ports).run(f.input);assert.equal(r.status,'UNKNOWN');assert.equal(f.calls.includes('start'),false);assert.equal(f.child.listenerCount('close'),0);assert.equal(f.calls.includes('clear'),mode==='fire');}
});
test('timer registration synchronous child event cannot turn setup into success',async()=>{
 const f=fixture();f.ports.setTimeout=()=>{f.complete();return 17;};assert.equal((await createTc01DependencyPreparation(f.ports).run(f.input)).status,'UNKNOWN');assert.equal(f.calls.includes('start'),false);assert.equal(f.calls.includes('clear'),true);
});
test('wrong event order, exit-only, status/signal and lost handle never promote',async()=>{
 const actions=[(f:ReturnType<typeof fixture>)=>f.child.emit('close',0,null),(f:ReturnType<typeof fixture>)=>{f.child.emit('exit',0,null);f.fire();},(f:ReturnType<typeof fixture>)=>f.child.emit('exit',1,null),(f:ReturnType<typeof fixture>)=>f.child.emit('exit',0,'SIGTERM'),(f:ReturnType<typeof fixture>)=>{f.child.stdout=new EventEmitter();f.child.emit('close',0,null);},(f:ReturnType<typeof fixture>)=>{f.child.stdout.emit('end');f.child.stdout.emit('data',Buffer.from('late'));}];
 for(const action of actions){const f=fixture();f.ports.start=()=>{f.calls.push('start');action(f);};const r=await createTc01DependencyPreparation(f.ports).run(f.input);assert.equal(r.status,'UNKNOWN');assert.equal(f.calls.includes('verify:AFTER_CLOSE'),false);assert.equal(f.mask(),0o022);assert.equal(f.timer(),undefined);}
});
test('stdout+stderr cap includes both; one-byte/empty events need no raw accumulation',async()=>{
 for(const n of [65536,65537]){const f=fixture();f.ports.start=()=>{f.child.stdout.emit('data',Buffer.alloc(32768));f.child.stderr.emit('data',Buffer.alloc(n-32768));f.child.stdout.emit('end');f.child.stderr.emit('end');f.child.emit('exit',0,null);f.child.emit('close',0,null);};assert.equal((await createTc01DependencyPreparation(f.ports).run(f.input)).status,n===65536?'COLLECTED':'UNKNOWN');}
 const f=fixture();f.ports.start=()=>{for(let i=0;i<4096;i++){f.child.stdout.emit('data',Buffer.alloc(0));f.child.stderr.emit('data',Buffer.from([65]));}f.complete();};assert.equal((await createTc01DependencyPreparation(f.ports).run(f.input)).status,'COLLECTED');
});
test('timeout or clock loss preserves child and late success does not verify or retry',async()=>{
 for(const mode of ['timer','wall','mono']){const f=fixture();f.ports.start=()=>{f.calls.push('start');};const owner=createTc01DependencyPreparation(f.ports),pending=owner.run(f.input);if(mode==='timer')f.fire();else{if(mode==='wall')f.wall(601000);else f.mono(600000);f.complete();}assert.equal((await pending).status,'UNKNOWN');f.complete();assert.equal(f.calls.includes('verify:AFTER_CLOSE'),false);assert.equal((await owner.run(f.input)).status,'UNKNOWN');assert.equal(f.calls.filter(x=>x==='start').length,1);}
});
test('wall/mono budget includes preparation; no promotion of nonpositive remaining time',async()=>{
 for(const clock of ['wall','mono']){const f=fixture(),original=f.ports.prepare;f.ports.prepare=r=>{original(r);if(clock==='wall')f.wall(601000);else f.mono(600000);};assert.equal((await createTc01DependencyPreparation(f.ports).run(f.input)).status,'UNKNOWN');assert.equal(f.calls.includes('take'),false);}
 const f=fixture();f.input.binding.expiresAt=1000;assert.equal((await createTc01DependencyPreparation(f.ports).run(f.input)).status,'UNKNOWN');assert.deepEqual(f.calls,[]);
});
test('shorter approval window controls timer and command cap',async()=>{
 const f=fixture();f.input.binding.expiresAt=1500;f.ports.setTimeout=(fn,ms)=>{assert.equal(ms,500);return 17;};f.ports.start=()=>f.complete();assert.equal((await createTc01DependencyPreparation(f.ports).run(f.input)).status,'COLLECTED');assert.equal(f.commands[0].timeoutMs,500);
});
test('start false/throw even after synchronous close and mask restore failure stay UNKNOWN',async()=>{
 for(const mode of ['false','throw','restore']){const f=fixture();f.ports.start=()=>{f.complete();if(mode==='throw')throw Error('private');if(mode==='false')return false as any;};if(mode==='restore'){const original=f.ports.umask;f.ports.umask=v=>{if(v===0o022)throw Error('restore');return original(v);};}assert.equal((await createTc01DependencyPreparation(f.ports).run(f.input)).status,'UNKNOWN');assert.equal(f.calls.includes('verify:AFTER_CLOSE'),false);assert.equal(f.timer(),undefined);}
});
test('cleanup or post-close source check failure prevents collected result',async()=>{
 for(const mode of ['clear','verify']){const f=fixture();if(mode==='clear')f.ports.clearTimeout=()=>{throw Error('private');};else{const original=f.ports.verify;f.ports.verify=r=>{original(r);if(r.phase==='AFTER_CLOSE')throw Error('changed');};}assert.equal((await createTc01DependencyPreparation(f.ports).run(f.input)).status,'UNKNOWN');assert.equal(f.child.listenerCount('close'),0);}
});
test('original handle consumed once across factories; shared or foreign streams rejected',async()=>{
 const f=fixture();assert.equal((await createTc01DependencyPreparation(f.ports).run(f.input)).status,'COLLECTED');assert.equal((await createTc01DependencyPreparation(f.ports).run(f.input)).status,'UNKNOWN');assert.equal(f.calls.filter(x=>x==='start').length,1);
 const g=fixture();g.child.stderr=g.child.stdout;assert.equal((await createTc01DependencyPreparation(g.ports).run(g.input)).status,'UNKNOWN');assert.equal(g.calls.includes('start'),false);
});

test('preparation does not occupy native initialize/consume receipt or artifact namespace',async()=>{
 const f=fixture(),attempt=f.input.binding.attemptId,receipt='/home/daon/.local/share/anvil-v3-qa-receipts/fn03-tc01-'+attempt,artifact='/tmp/fn03-tc01-'+attempt,created=new Set<string>();
 f.ports.prepare=r=>{const root=r.preparationRoot as string;assert.equal(root,receipt+'-dependency-preparation');created.add(root);created.add(r.cache as string);for(const c of r.configs as readonly string[])created.add(c);};
 f.ports.verify=r=>{assert.deepEqual(r.requiredAbsent,[receipt,artifact]);for(const absent of r.requiredAbsent as readonly string[])assert.equal(created.has(absent),false);};
 assert.equal((await createTc01DependencyPreparation(f.ports).run(f.input)).status,'COLLECTED');
 assert.equal(created.has(receipt),false);assert.equal(created.has(artifact),false);assert.equal(f.commands[0].env.HOME,receipt+'-dependency-preparation');
 // 기존 native initialize의 missing(receipt), consume의 mkdir(receipt)와 충돌하지 않는 RAM namespace.
 created.add(receipt);assert.equal(created.has(receipt),true);assert.equal(created.size,5);
});
