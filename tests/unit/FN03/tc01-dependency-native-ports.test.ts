import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {posix} from 'node:path';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {createTc01DependencyCarrierEntry} from '../../../scripts/qa-fn03-tc01-dependency-carrier-entry.ts';
import {readTc01DependencyCarrierResult} from '../../../scripts/qa-fn03-tc01-dependency-carrier-wire.ts';
import {createTc01DependencyNativePorts} from '../../../scripts/qa-fn03-tc01-dependency-native-ports.ts';

function fixture(){
 const lock=Buffer.from('{"lockfileVersion":3,"packages":{"":{}}}');
 const binding={attemptId:'a1000000-0000-4000-8000-000000000001',sourceHead:'a'.repeat(40),lockSha256:contentHash(lock),issuedAt:1000,expiresAt:1801000};
 const root='/home/daon/anvil-fn03-tc01-'+binding.attemptId+'-qa',receipt='/home/daon/.local/share/anvil-v3-qa-receipts/fn03-tc01-'+binding.attemptId,prep=receipt+'-dependency-preparation';
 const wireBinding={purpose:'TC01_DEPENDENCY_PREPARATION',attemptId:binding.attemptId,sourceHead:binding.sourceHead,packageLockSha256:binding.lockSha256,source:{entry:'scripts/qa-fn03-tc01-dependency-intake.ts',sha256:'b'.repeat(64),closureSha256:'c'.repeat(64)},recipe:'TC01_DEPENDENCY_RECIPE_CANDIDATE_V1',approvalSha256:'d'.repeat(64),consumptionSha256:'e'.repeat(64),issuedAt:1000,expiresAt:1801000};
 const wire=Buffer.from(canonicalJson({schemaVersion:1,kind:'TC01_DEPENDENCY_INPUT_V1',binding:wireBinding,limits:{installationMs:600000,totalMs:1800000}})+'\n');
 let ino=1,fd=10,wall=1000,mono=0,mask=0o022,timer:(()=>void)|undefined;
 const nodes=new Map<string,any>(),data=new Map<string,Buffer>(),handles=new Map<number,string>(),calls:string[]=[],commands:any[]=[],retained:any[]=[];
 const add=(path:string,mode:number,body?:Buffer)=>{nodes.set(path,{dev:1,ino:ino++,uid:path==='/home'?0:1000,gid:1000,mode,size:body?.length??0,mtimeMs:1,ctimeMs:1,nlink:body?1:2});if(body)data.set(path,body);};
 for(const path of [root,posix.dirname(receipt)]){let p=path;while(p!=='/'){if(!nodes.has(p))add(p,p===root?0o040700:0o040755);p=posix.dirname(p);}}
 const stat=(p:string)=>{calls.push('stat');const s=nodes.get(p);if(!s)throw Object.assign(Error('absent'),{code:'ENOENT'});return{...s};};
 const child=Object.assign(new EventEmitter(),{stdout:new EventEmitter(),stderr:new EventEmitter()});
 const hooks={current:()=>{},verify:(_r:any)=>{},spawn:()=>{},close:()=>{}};
 const complete=()=>{add(root+'/node_modules',0o040755);add(root+'/node_modules/a',0o100644,Buffer.from('x'));child.stdout.emit('end');child.stderr.emit('end');child.emit('exit',0,null);child.emit('close',0,null);};
 const io={context:()=>({platform:'linux',uid:1000}),lstat:stat,fstat:(n:number)=>stat(handles.get(n)!),realpath:(p:string)=>p,
  mkdir:(p:string,mode:number)=>{calls.push('mkdir:'+p);assert(!nodes.has(p));add(p,0o040000|mode);},
  open:(p:string,kind:'READ'|'DIRECTORY'|'CREATE',mode?:number)=>{calls.push('open:'+p);if(kind==='CREATE'){assert(!nodes.has(p));add(p,0o100000|mode!,Buffer.alloc(0));}else assert(nodes.has(p));const n=fd++;handles.set(n,p);return n;},
  read:(n:number,b:Buffer,o:number,l:number,p:number)=>{const raw=data.get(handles.get(n)!)!;const count=Math.max(0,Math.min(l,raw.length-p));raw.copy(b,o,p,p+count);return count;},
  sync:(n:number)=>{assert(handles.has(n));calls.push('sync');},close:(n:number)=>{assert(handles.has(n));handles.delete(n);hooks.close();},
  readdir:(p:string,limit:number)=>[...nodes.keys()].filter(k=>posix.dirname(k)===p).map(k=>posix.basename(k)).slice(0,limit),
  spawn:(c:any)=>{calls.push('spawn');commands.push(c);hooks.spawn();queueMicrotask(complete);return child;},
  umask:(v?:number)=>{const old=mask;if(v!==undefined)mask=v;return old;},setTimeout:(fn:()=>void,_ms:number)=>{timer=fn;return 1;},clearTimeout:(_h:unknown)=>{timer=undefined;},
 };
 const supervisor={now:()=>wall,monotonic:()=>mono,assertCurrent:(b:any)=>{assert.deepEqual({...b},binding);hooks.current();},verify:(r:any)=>hooks.verify(r),retainChild:(c:unknown)=>{retained.push(c);}};
 const receiver={assertCurrent:()=>{},takeLockBytes:()=>({sourceHead:binding.sourceHead,packageLockSha256:binding.lockSha256,bytes:lock})};
 const make=()=>createTc01DependencyNativePorts(binding,supervisor,io);
 const run=async()=>{const adapter=make();try{return await createTc01DependencyCarrierEntry(receiver,adapter.ports,adapter.files).run(wire,wireBinding);}finally{adapter.dispose();}};
 return{binding,wireBinding,wire,root,receipt,prep,io,supervisor,receiver,child,hooks,calls,commands,handles,nodes,retained,complete,make,run,fire:()=>timer?.(),setTime:(w:number,m:number)=>{wall=w;mono=m;},mask:()=>mask};
}
test('existing receiver -> native adapter -> original intake collects exact same child and tree in RAM',async()=>{
 const f=fixture(),result=await f.run();assert.equal(typeof result,'string');
 const r=readTc01DependencyCarrierResult(Buffer.from(result as string),f.wireBinding,{startedAt:1000,monotonicStartedAt:0,now:1000,monotonicNow:0});
 assert.equal(r.candidate.status,'CANDIDATE_ONLY');assert.equal(r.authority,'NOT_ISSUED');assert.equal(f.commands.length,1);assert.deepEqual(f.retained,[f.child]);assert.equal(f.handles.size,0);assert.equal(f.mask(),0o022);
 assert(!f.nodes.has(f.receipt));assert(!f.nodes.has('/tmp/fn03-tc01-'+f.binding.attemptId));assert(f.nodes.has(f.prep));assert.equal(f.commands[0].shell,false);assert.deepEqual(f.commands[0].stdio,['ignore','pipe','pipe']);assert(f.commands[0].args.includes('--bin-links=false'));
});
test('factory has no effects; controller denial, nonlinux, changed binding and arbitrary start are closed',async()=>{
 const f=fixture(),a=f.make();assert.equal(f.calls.length,0);assert.throws(()=>a.ports.start(new EventEmitter(),{} as any));assert.equal(f.calls.length,0);a.dispose();
 for(const mode of ['denied','platform','identity']){const g=fixture();if(mode==='denied')g.hooks.current=()=>{throw Error('PRIVATE');};if(mode==='platform')g.io.context=()=>({platform:'win32',uid:1000});if(mode==='identity')g.supervisor.assertCurrent=()=>false as any;const r=await g.run();assert.equal((r as any).status,'UNKNOWN');assert.equal(g.commands.length,0);assert(!g.calls.some(x=>x.startsWith('mkdir')));}
});
test('reserved receipt and artifact remain absent; preparation collision or unsafe parent blocks spawn',async()=>{
 for(const mode of ['collision','parent','symlink']){const f=fixture();const parent=f.nodes.get(posix.dirname(f.prep));if(mode==='collision')f.nodes.set(f.prep,{...parent});if(mode==='parent')parent.mode=0o040777;if(mode==='symlink')parent.mode=0o120777;const r=await f.run();assert.equal((r as any).status,'UNKNOWN');assert.equal(f.commands.length,0);assert(!f.nodes.has(f.receipt));assert.equal(f.handles.size,0);}
});
test('timeout, output overflow and reversed close preserve UNKNOWN with no tree observation or retry',async()=>{
 for(const mode of ['timeout','overflow','close','spawn']){const f=fixture();f.io.spawn=c=>{f.commands.push(c);if(mode==='spawn')throw Error('PRIVATE');queueMicrotask(()=>{if(mode==='timeout')f.fire();if(mode==='overflow')f.child.stdout.emit('data',Buffer.alloc(65537));if(mode==='close')f.child.emit('close',0,null);});return f.child;};const r=await f.run();assert.equal((r as any).status,'UNKNOWN');assert.equal(f.commands.length,1);assert(!f.calls.includes('open:'+f.root+'/node_modules/a'));assert.equal(f.handles.size,0);assert.equal(JSON.stringify(r).includes('PRIVATE'),false);f.complete();}
});
test('expiry after original child acquisition retains original and never emits candidate',async()=>{
 const f=fixture();f.supervisor.retainChild=c=>{f.retained.push(c);f.setTime(601000,600000);};const r=await f.run();assert.equal((r as any).status,'UNKNOWN');assert.deepEqual(f.retained,[f.child]);assert.equal(f.commands.length,1);assert.equal(f.handles.size,0);
});
test('pre-start phase, original command snapshot and pre-spawn reserved paths cannot be bypassed',async()=>{
 const seed=fixture();let request:any;seed.hooks.verify=r=>{const {phase,...rest}=r;request=rest;};await seed.run();
 const f=fixture(),a=f.make(),command=structuredClone(seed.commands[0]);a.ports.assertApproved(request);a.ports.verify({...request,phase:'BEFORE_PREPARE'});a.ports.prepare(request);
 assert.throws(()=>a.ports.takeChild(command));assert.equal(f.commands.length,0);a.ports.verify({...request,phase:'BEFORE_START'});const h=a.ports.takeChild(command) as EventEmitter;command.args.push('--OTHER');assert.throws(()=>a.ports.start(h,command));assert.equal(f.commands.length,0);a.dispose();
 const g=fixture();let starts=0;g.hooks.verify=r=>{if(r.phase==='BEFORE_START'&&++starts===2)g.nodes.set(g.receipt,{...g.nodes.get(posix.dirname(g.receipt))});};assert.equal((await g.run() as any).status,'UNKNOWN');assert.equal(g.commands.length,0);
});
test('umask has only captured read/restrict/restore sequence, restoration survives expiry',async()=>{
 const seed=fixture();let request:any;seed.hooks.verify=r=>{const {phase,...rest}=r;request=rest;};await seed.run();
 const f=fixture(),a=f.make();assert.throws(()=>a.ports.umask(0));assert.equal(f.mask(),0o022);a.ports.assertApproved(request);a.ports.verify({...request,phase:'BEFORE_PREPARE'});a.ports.prepare(request);a.ports.verify({...request,phase:'BEFORE_START'});a.ports.takeChild(seed.commands[0]);
 assert.equal(a.ports.umask(),0o022);assert.throws(()=>a.ports.umask(0));assert.equal(f.mask(),0o022);a.ports.umask(0o077);assert.equal(f.mask(),0o077);f.setTime(1801000,1800000);a.ports.umask(0o022);assert.equal(f.mask(),0o022);assert.throws(()=>a.ports.umask(0));assert.equal(f.mask(),0o022);a.dispose();
});
test('UNKNOWN dispose keeps bounded raw error sinks until original close, with no signal or later effects',async()=>{
 const f=fixture();f.io.spawn=c=>{f.commands.push(c);queueMicrotask(()=>f.fire());return f.child;};const a=f.make();const r=await createTc01DependencyCarrierEntry(f.receiver,a.ports,a.files).run(f.wire,f.wireBinding);assert.equal((r as any).status,'UNKNOWN');a.dispose();
 const before=f.calls.length;for(const target of [f.child,f.child.stdout,f.child.stderr]){assert.equal(target.listenerCount('error'),1);assert.doesNotThrow(()=>target.emit('error',Error('PRIVATE')));}assert.equal(f.child.listenerCount('close'),1);f.child.emit('close',null,'SIGTERM');for(const target of [f.child,f.child.stdout,f.child.stderr])assert.equal(target.listenerCount('error'),0);assert.equal(f.child.listenerCount('close'),0);assert.equal(f.calls.length,before);assert.equal(f.commands.length,1);
});
test('sync completion during original-handle handoff is collected; stream replacement and early AFTER_CLOSE are rejected',async()=>{
 const f=fixture();f.io.spawn=c=>{f.commands.push(c);return f.child;};f.supervisor.retainChild=c=>{f.retained.push(c);f.complete();};assert.equal(typeof await f.run(),'string');
 const g=fixture();let adapter:ReturnType<typeof g.make>,request:any;g.hooks.verify=r=>{request=r;};g.hooks.spawn=()=>{const before=g.calls.length;assert.throws(()=>adapter.ports.verify({...request,phase:'AFTER_CLOSE'}));assert.equal(g.calls.length,before);};g.io.spawn=c=>{g.commands.push(c);g.hooks.spawn();queueMicrotask(()=>{g.child.stdout=new EventEmitter();g.child.stderr.emit('end');});return g.child;};adapter=g.make();const result=await createTc01DependencyCarrierEntry(g.receiver,adapter.ports,adapter.files).run(g.wire,g.wireBinding);assert.equal((result as any).status,'UNKNOWN');adapter.dispose();g.child.emit('close',null,null);
});
